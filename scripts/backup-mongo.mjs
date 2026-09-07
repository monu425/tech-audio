#!/usr/bin/env node
/**
 * MongoDB backup for the Voltify platform.
 *
 * Uses `mongodump` to write a timestamped, gzipped archive of the configured
 * database into BACKUP_DIR (default: .data/backups). Keeps a rolling set of
 * the latest KEEP count (default 14) backups, pruning the oldest ones.
 *
 * Runtime requirement: the `mongodump` binary from the mongo-database-tools
 * package must be on PATH (or set MONGODUMP_BIN). It ships with the official
 * `mongo:7` docker image referenced by docker-compose.yml.
 *
 * Usage:
 *   node scripts/backup-mongo.mjs
 *   BACKUP_DIR=/var/backups KEEP=30 node scripts/backup-mongo.mjs
 * Restore a backup (destructive, run explicitly):
 *   mongorestore --uri "$MONGODB_URI" --gzip --archive=/path/to/ecommerce.gz
 */
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const envFile = process.env.API_ENV_FILE ?? path.join(repoRoot, 'apps/api/.env')
if (existsSync(envFile)) {
  const { config } = await import('dotenv')
  config({ path: envFile })
}

const { env } = await import(path.join(repoRoot, 'apps/api/src/config/env.js'))

const mongodumpBin = process.env.MONGODUMP_BIN ?? 'mongodump'
const backupRoot = process.env.BACKUP_DIR ?? path.join(repoRoot, '.data', 'backups')
const keep = Number(process.env.KEEP ?? 14)
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const dest = path.join(backupRoot, stamp)
const archivePath = path.join(dest, 'ecommerce.gz')

function fail(message) {
  console.error(`[backup] ${message}`)
  process.exit(1)
}

async function hasBinary() {
  try {
    await execFileAsync(mongodumpBin, ['--version'], { timeout: 15_000 })
    return true
  } catch {
    return false
  }
}

async function run() {
  if (!(await hasBinary())) {
    fail(
      `"${mongodumpBin}" not found on PATH. Install mongo-database-tools, or run inside the mongo:7 image: docker compose exec mongo mongodump --uri "$MONGODB_URI" ...`
    )
  }

  await mkdir(dest, { recursive: true })
  console.log(`[backup] dumping ${env.mongodbUri} -> ${archivePath}`)

  await execFileAsync(mongodumpBin, ['--uri', env.mongodbUri, '--archive', archivePath, '--gzip'], {
    timeout: 0
  })

  const entries = (await readdir(backupRoot)).sort().reverse()
  const stale = entries.filter((_entry, index) => index >= keep)
  for (const entry of stale) {
    console.log(`[backup] pruning ${path.join(backupRoot, entry)}`)
    await rm(path.join(backupRoot, entry), { recursive: true, force: true })
  }

  const archiveSize = (await stat(archivePath)).size
  console.log(`[backup] done. ${entries.length} backup(s) retained (keep=${keep}).`)
  console.log(`[backup] archive size: ${archiveSize} bytes`)
}

run().catch((error) => {
  fail(error.message)
})
