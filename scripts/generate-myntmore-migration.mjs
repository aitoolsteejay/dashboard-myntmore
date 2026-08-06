import fs from 'node:fs'
import path from 'node:path'
import Papa from 'papaparse'

const root = process.cwd()
const exportDir = path.join(root, 'myntmore-database-export')
const manifestPath = path.join(exportDir, 'manifest.json')
const sourceSchemaPath = path.join(exportDir, 'schema.sql')
const outputPath = path.join(exportDir, 'myntmore-migration.sql')

if (!fs.existsSync(manifestPath) || !fs.existsSync(sourceSchemaPath)) {
  throw new Error('Expected manifest.json and schema.sql in myntmore-database-export/')
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
let sourceSchema = fs.readFileSync(sourceSchemaPath, 'utf8')

const section = (start, end) => {
  const startIndex = sourceSchema.indexOf(start)
  const endIndex = sourceSchema.indexOf(end, startIndex + start.length)
  if (startIndex < 0 || endIndex < 0) throw new Error(`Missing schema section: ${start}`)
  return sourceSchema.slice(startIndex + start.length, endIndex).trim()
}

const qualify = (sql) => sql
  .replaceAll('public.', 'myntmore.')
  .replaceAll("SET search_path TO 'public'", "SET search_path TO 'myntmore'")
  .replaceAll(' search_path = public', ' search_path = myntmore')

let definitions = section('-- ENUM TYPES --', '-- CONSTRAINTS (PK / FK / UNIQUE / CHECK) --')
definitions = definitions
  .replace(/acceptance_rate numeric DEFAULT\s+CASE[\s\S]*?END,/m, 'acceptance_rate numeric DEFAULT 0,')
  .replace(/response_rate numeric DEFAULT\s+CASE[\s\S]*?END,/m, 'response_rate numeric DEFAULT 0,')
  .replace(/weighted_value numeric DEFAULT \(\(deal_value \* \(probability\)::numeric\) \/ 100\.0\),/m, 'weighted_value numeric DEFAULT 0,')

const constraints = section('-- CONSTRAINTS (PK / FK / UNIQUE / CHECK) --', '-- INDEXES --')
let functions = section('-- FUNCTIONS --', '-- TRIGGERS --')
const rls = sourceSchema.slice(sourceSchema.indexOf('-- ROW LEVEL SECURITY --') + '-- ROW LEVEL SECURITY --'.length).trim()

functions = functions.replace(
  /BEGIN\n  INSERT INTO public\.profiles/,
  `BEGIN
  IF COALESCE((NEW.raw_user_meta_data->>'myntmore_access')::boolean, false) IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles`,
)

const sqlLiteral = (value) => {
  if (value === null || value === undefined || value === '') return 'NULL'
  return `'${String(value).replaceAll("'", "''")}'`
}

const inserts = []
const insertsByTable = new Map()
let parsedTotal = 0
for (const table of manifest.tables) {
  const csvPath = path.join(exportDir, table.csv)
  const parsed = Papa.parse(fs.readFileSync(csvPath, 'utf8'), {
    header: true,
    skipEmptyLines: true,
  })
  if (parsed.errors.length) {
    throw new Error(`${table.table}: ${parsed.errors.map((error) => error.message).join('; ')}`)
  }
  if (parsed.data.length !== table.row_count) {
    throw new Error(`${table.table}: manifest says ${table.row_count}, parsed ${parsed.data.length}`)
  }
  parsedTotal += parsed.data.length
  const columns = parsed.meta.fields ?? []
  if (parsed.data.length === 0) continue
  for (let index = 0; index < parsed.data.length; index += 100) {
    const rows = parsed.data.slice(index, index + 100)
    const insertSql =
      `INSERT INTO myntmore.${table.table} (${columns.map((column) => `"${column}"`).join(', ')}) VALUES\n` +
      rows.map((row) => `  (${columns.map((column) => sqlLiteral(row[column])).join(', ')})`).join(',\n') +
      ';'
    inserts.push(insertSql)
    insertsByTable.set(table.table, [...(insertsByTable.get(table.table) ?? []), insertSql])
  }
}

if (parsedTotal !== manifest.total_rows) {
  throw new Error(`Manifest total is ${manifest.total_rows}, parsed ${parsedTotal}`)
}

const remappedColumns = {
  actionables: ['assignee_id', 'assigner_id'],
  aha_moments: ['created_by'],
  campaign_weekly_data: ['submitted_by'],
  campaigns: ['created_by'],
  client_alerts: ['resolved_by'],
  client_assignments: ['user_id'],
  client_context_notes: ['created_by'],
  client_notifications: ['dismissed_by'],
  clients: ['content_manager_id', 'leadgen_manager_id', 'created_by', 'user_id'],
  growth_initiative_comments: ['author_id'],
  growth_initiatives: ['owner_id', 'created_by'],
  hot_leads: ['owner_id'],
  initiatives: ['owner_id'],
  invites: ['invited_by'],
  mm_weekly_data: ['submitted_by'],
  myntmore_processes: ['owner_id', 'created_by', 'completed_by'],
  process_weekly_updates: ['submitted_by'],
  sales_weekly_data: ['submitted_by'],
  tj_channel_assignments: ['owner_id', 'updated_by'],
  tj_weekly_data: ['submitted_by'],
  user_roles: ['user_id'],
  weekly_data: ['content_submitted_by', 'leadgen_submitted_by'],
}

const remapSql = Object.entries(remappedColumns).flatMap(([table, columns]) =>
  columns.map((column) => `UPDATE myntmore.${table} AS target
SET ${column} = mapping.target_id
FROM migration_user_map AS mapping
WHERE target.${column} = mapping.source_id
  AND mapping.target_id <> mapping.source_id;`),
).join('\n\n')

const migration = `-- Myntmore Lovable Cloud -> shared Supabase migration
-- Generated from ${manifest.generated_at}; ${manifest.table_count} tables / ${manifest.total_rows} rows.
-- Target project: gapaawxbkfmpthfesuyw
-- This script creates only the dedicated myntmore schema. It never drops public objects.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'myntmore') THEN
    RAISE EXCEPTION 'The myntmore schema already exists. Stop and inspect it; this migration will not overwrite it.';
  END IF;
END
$$;

CREATE SCHEMA myntmore;
SET LOCAL search_path TO myntmore, public, auth, extensions;

${qualify(definitions)}

-- Load the exported application rows before adding relational constraints.
${inserts.join('\n\n')}

-- Map Lovable user UUIDs onto shared-project Auth UUIDs by normalized email.
-- Existing users are reused; missing users are created with random passwords.
CREATE TEMP TABLE migration_user_map ON COMMIT DROP AS
SELECT
  profile.id AS source_id,
  COALESCE(existing.id, profile.id) AS target_id,
  lower(profile.email) AS email,
  profile.full_name,
  (existing.id IS NOT NULL) AS existed_before
FROM myntmore.profiles AS profile
LEFT JOIN auth.users AS existing ON lower(existing.email) = lower(profile.email);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM migration_user_map AS mapping
    JOIN auth.users AS existing ON existing.id = mapping.source_id
    WHERE lower(existing.email) <> mapping.email
  ) THEN
    RAISE EXCEPTION 'A Lovable user UUID belongs to a different email in the target Auth system.';
  END IF;
END
$$;

-- Prevent the other internal tool's auth.users triggers from processing migrated users.
ALTER TABLE auth.users DISABLE TRIGGER USER;

INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  mapping.target_id,
  'authenticated',
  'authenticated',
  mapping.email,
  extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'full_name', mapping.full_name,
    'myntmore_access', true,
    'password_reset_required', true
  ),
  now(), now(), '', '', '', ''
FROM migration_user_map AS mapping
WHERE mapping.existed_before = false;

INSERT INTO auth.identities (
  id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  mapping.target_id::text,
  mapping.target_id,
  jsonb_build_object('sub', mapping.target_id::text, 'email', mapping.email),
  'email',
  now(), now(), now()
FROM migration_user_map AS mapping
WHERE mapping.existed_before = false
ON CONFLICT (provider_id, provider) DO NOTHING;

ALTER TABLE auth.users ENABLE TRIGGER USER;

-- Rewrite every exported user reference when an email already existed under another UUID.
${remapSql}

UPDATE myntmore.profiles AS profile
SET id = mapping.target_id
FROM migration_user_map AS mapping
WHERE profile.id = mapping.source_id
  AND mapping.target_id <> mapping.source_id;

-- Add keys and checks only after user IDs have been reconciled.
${qualify(constraints)}

${qualify(functions)}

DROP TRIGGER IF EXISTS on_auth_user_created_myntmore ON auth.users;
CREATE TRIGGER on_auth_user_created_myntmore
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION myntmore.handle_new_user();

${qualify(rls)}

GRANT USAGE ON SCHEMA myntmore TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA myntmore TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA myntmore TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA myntmore TO anon;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA myntmore TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA myntmore TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myntmore GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myntmore GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myntmore GRANT EXECUTE ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myntmore GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;

-- Verify the imported total before committing.
DO $$
DECLARE
  imported_rows bigint;
BEGIN
  SELECT sum(row_count) INTO imported_rows
  FROM (
    ${manifest.tables.map((table) => `SELECT count(*)::bigint AS row_count FROM myntmore.${table.table}`).join('\n    UNION ALL\n    ')}
  ) AS counts;
  IF imported_rows <> ${manifest.total_rows} THEN
    RAISE EXCEPTION 'Expected ${manifest.total_rows} application rows, imported %', imported_rows;
  END IF;
END
$$;

COMMIT;

-- New users have random passwords. Send them password-reset links from Authentication -> Users.
SELECT email, raw_user_meta_data->>'full_name' AS full_name
FROM auth.users
WHERE COALESCE((raw_user_meta_data->>'password_reset_required')::boolean, false)
ORDER BY email;
`

fs.writeFileSync(outputPath, migration)
console.log(`Wrote ${outputPath}`)
console.log(`${manifest.table_count} tables; ${parsedTotal} rows; ${Buffer.byteLength(migration)} bytes`)

// The hosted SQL Editor rejects a ~1 MB query, so also emit ordered, rerunnable parts.
const partsDir = path.join(exportDir, 'migration-parts')
fs.rmSync(partsDir, { recursive: true, force: true })
fs.mkdirSync(partsDir, { recursive: true })

const constraintLines = constraints.split('\n').filter(Boolean)
const nonForeignKeyConstraints = constraintLines.filter((line) => !line.includes(' FOREIGN KEY ')).join('\n')
const foreignKeyConstraints = constraintLines
  .filter((line) => line.includes(' FOREIGN KEY ') && !line.includes('REFERENCES auth.users'))
  .join('\n')
const idempotentInsert = (sql) => sql.replace(/;$/, '\nON CONFLICT (id) DO NOTHING;')
const tableRemap = (table) => (remappedColumns[table] ?? []).map((column) => `UPDATE myntmore.${table} AS target
SET ${column} = mapping.target_id
FROM myntmore._migration_user_map AS mapping
WHERE target.${column} = mapping.source_id
  AND mapping.target_id <> mapping.source_id;`).join('\n\n')

const profileInserts = (insertsByTable.get('profiles') ?? []).map(idempotentInsert).join('\n\n')
const phaseOne = `-- Part 1: isolated schema, table definitions, and shared Auth reconciliation
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'myntmore') THEN
    RAISE EXCEPTION 'The myntmore schema already exists. Stop; do not overwrite it.';
  END IF;
END
$$;
CREATE SCHEMA myntmore;
SET LOCAL search_path TO myntmore, public, auth, extensions;
${qualify(definitions)}
${qualify(nonForeignKeyConstraints)}
${profileInserts}
CREATE TABLE myntmore._migration_user_map AS
SELECT profile.id AS source_id,
       COALESCE(existing.id, profile.id) AS target_id,
       lower(profile.email) AS email,
       profile.full_name,
       (existing.id IS NOT NULL) AS existed_before
FROM myntmore.profiles AS profile
LEFT JOIN auth.users AS existing ON lower(existing.email) = lower(profile.email);
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM myntmore._migration_user_map AS mapping
    JOIN auth.users AS existing ON existing.id = mapping.source_id
    WHERE lower(existing.email) <> mapping.email
  ) THEN
    RAISE EXCEPTION 'A Lovable user UUID belongs to another email in target Auth.';
  END IF;
END
$$;
UPDATE myntmore.profiles AS profile
SET id = mapping.target_id
FROM myntmore._migration_user_map AS mapping
WHERE profile.id = mapping.source_id AND mapping.target_id <> mapping.source_id;
COMMIT;
SELECT 'part_01_complete' AS migration_status,
       count(*) AS profiles,
       count(*) FILTER (WHERE existed_before) AS existing_auth_users,
       count(*) FILTER (WHERE NOT existed_before) AS auth_users_to_create
FROM myntmore._migration_user_map;
`
fs.writeFileSync(path.join(partsDir, '01_schema_auth.sql'), phaseOne)

let partNumber = 2
for (const table of manifest.tables) {
  if (table.table === 'profiles' || table.row_count === 0) continue
  const statements = insertsByTable.get(table.table) ?? []
  for (const [statementIndex, statement] of statements.entries()) {
    const part = `-- Data part ${partNumber}: ${table.table} (${statementIndex + 1}/${statements.length})
BEGIN;
SET LOCAL search_path TO myntmore, public, auth, extensions;
${idempotentInsert(statement)}
${tableRemap(table)}
COMMIT;
SELECT '${table.table}' AS imported_table, count(*) AS imported_rows FROM myntmore.${table.table};
`
    const filename = `${String(partNumber).padStart(2, '0')}_data_${table.table}_${statementIndex + 1}.sql`
    fs.writeFileSync(path.join(partsDir, filename), part)
    partNumber += 1
  }
}

const finalPart = `-- Final part: foreign keys, functions, policies, grants, and verification
BEGIN;
SET LOCAL search_path TO myntmore, public, auth, extensions;
${qualify(foreignKeyConstraints)}
${qualify(functions)}
${qualify(rls)}
GRANT USAGE ON SCHEMA myntmore TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA myntmore TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA myntmore TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA myntmore TO anon;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA myntmore TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA myntmore TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myntmore GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myntmore GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myntmore GRANT EXECUTE ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA myntmore GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
DO $$
DECLARE imported_rows bigint;
BEGIN
  SELECT sum(row_count) INTO imported_rows FROM (
    ${manifest.tables.map((table) => `SELECT count(*)::bigint AS row_count FROM myntmore.${table.table}`).join('\n    UNION ALL\n    ')}
  ) AS counts;
  IF imported_rows <> ${manifest.total_rows} THEN
    RAISE EXCEPTION 'Expected ${manifest.total_rows} rows, imported %', imported_rows;
  END IF;
END
$$;
DROP TABLE myntmore._migration_user_map;
COMMIT;
NOTIFY pgrst, 'reload schema';
SELECT 'migration_complete' AS migration_status, ${manifest.total_rows} AS imported_rows;
`
fs.writeFileSync(path.join(partsDir, `${String(partNumber).padStart(2, '0')}_finalize.sql`), finalPart)

const profileForeignKeys = constraintLines.filter((line) => line.includes(' FOREIGN KEY ') && line.includes('REFERENCES profiles'))
const authForeignKeys = constraintLines.filter((line) => line.includes(' FOREIGN KEY ') && line.includes('REFERENCES auth.users'))
const dropProfileForeignKeys = profileForeignKeys.map((line) => {
  const match = line.match(/^ALTER TABLE public\.([^ ]+) ADD CONSTRAINT ([^ ]+)/)
  if (!match) throw new Error(`Could not parse foreign key: ${line}`)
  return `ALTER TABLE myntmore.${match[1]} DROP CONSTRAINT IF EXISTS ${match[2]};`
}).join('\n')

const authRemapPart = `-- Post-account phase: map the 14 recreated Auth users to all imported records
BEGIN;
SET LOCAL search_path TO myntmore, public, auth, extensions;
CREATE TEMP TABLE auth_user_remap ON COMMIT DROP AS
SELECT profile.id AS source_id, auth_user.id AS target_id, lower(profile.email) AS email
FROM myntmore.profiles AS profile
JOIN auth.users AS auth_user ON lower(auth_user.email) = lower(profile.email);
DO $$
BEGIN
  IF (SELECT count(*) FROM auth_user_remap) <> 14 THEN
    RAISE EXCEPTION 'Expected 14 Auth/profile email matches, found %', (SELECT count(*) FROM auth_user_remap);
  END IF;
  IF EXISTS (SELECT email FROM auth_user_remap GROUP BY email HAVING count(*) <> 1) THEN
    RAISE EXCEPTION 'Duplicate Auth/profile email mapping detected.';
  END IF;
END
$$;
${dropProfileForeignKeys}
${Object.entries(remappedColumns).flatMap(([table, columns]) => columns.map((column) => `UPDATE myntmore.${table} AS target
SET ${column} = mapping.target_id
FROM auth_user_remap AS mapping
WHERE target.${column} = mapping.source_id
  AND mapping.target_id <> mapping.source_id;`)).join('\n\n')}
UPDATE myntmore.profiles AS profile
SET id = mapping.target_id
FROM auth_user_remap AS mapping
WHERE profile.id = mapping.source_id
  AND mapping.target_id <> mapping.source_id;
${qualify(profileForeignKeys.join('\n'))}
${qualify(authForeignKeys.join('\n'))}
COMMIT;
NOTIFY pgrst, 'reload schema';
SELECT count(*) AS mapped_users
FROM myntmore.profiles AS profile
JOIN auth.users AS auth_user ON auth_user.id = profile.id;
`
fs.writeFileSync(path.join(partsDir, `${String(partNumber + 1).padStart(2, '0')}_auth_remap.sql`), authRemapPart)
console.log(`Wrote ${partNumber + 1} SQL Editor parts to ${partsDir}`)
