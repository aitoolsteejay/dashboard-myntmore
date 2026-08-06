import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import Papa from 'papaparse'

const root = process.cwd()
const exportDir = path.join(root, 'myntmore-database-export')
const profilesPath = path.join(exportDir, 'csv', 'profiles.csv')
const outputPath = path.join(exportDir, 'myntmore-user-credentials.csv')

const parsed = Papa.parse(fs.readFileSync(profilesPath, 'utf8'), {
  header: true,
  skipEmptyLines: true,
})

if (parsed.errors.length) {
  throw new Error(parsed.errors.map((error) => error.message).join('; '))
}

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
const makePassword = () => Array.from(crypto.randomBytes(18), (byte) => alphabet[byte % alphabet.length]).join('')

const credentials = parsed.data
  .map((profile) => ({
    email: String(profile.email ?? '').trim().toLowerCase(),
    full_name: String(profile.full_name ?? '').trim(),
    temporary_password: makePassword(),
  }))
  .filter((profile) => profile.email)
  .sort((left, right) => left.email.localeCompare(right.email))

if (credentials.length !== 14) {
  throw new Error(`Expected 14 profiles, found ${credentials.length}`)
}

fs.writeFileSync(outputPath, Papa.unparse(credentials) + '\n', { mode: 0o600 })
console.log(`Generated ${credentials.length} credentials in the ignored export directory.`)
