-- Internal vs external clients. "Internal" clients are Myntmore's own (Enwil and Tejas
-- Jhaveri); everyone else is external. The dashboard, Clients page and Data Entry
-- client picker group by this column, and admins can change it from the Edit Client form.
--
-- Safe to re-run. Run in the Supabase SQL editor.
BEGIN;

ALTER TABLE myntmore.clients
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'external';

ALTER TABLE myntmore.clients DROP CONSTRAINT IF EXISTS clients_client_type_check;
ALTER TABLE myntmore.clients
  ADD CONSTRAINT clients_client_type_check CHECK (client_type IN ('internal', 'external'));

-- Enwil and Tejas Jhaveri are internal (matches the name or the company, any casing).
UPDATE myntmore.clients
SET client_type = 'internal'
WHERE name ILIKE 'enwil%'
   OR company ILIKE 'enwil%'
   OR name ILIKE 'tejas jhaveri%';

COMMIT;

-- Check who ended up where:
SELECT client_type, name, company, status FROM myntmore.clients ORDER BY client_type, name;
