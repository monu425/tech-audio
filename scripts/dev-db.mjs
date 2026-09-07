import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { MongoMemoryServer } from 'mongodb-memory-server'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const dbPath = path.join(repoRoot, '.data', 'mongodb')

const systemBinary = process.env.MONGOMS_SYSTEM_BINARY

if (!systemBinary || !existsSync(systemBinary)) {
  console.warn(
    '[db] MONGOMS_SYSTEM_BINARY not set (or missing). mongodb-memory-server will download a binary on first run.'
  )
}

await mkdir(dbPath, { recursive: true })

const mongod = await MongoMemoryServer.create({
  instance: {
    port: 27017,
    ip: '127.0.0.1',
    dbPath,
    dbName: 'ecommerce',
    storageEngine: 'wiredTiger'
  }
})

console.log(`[db] MongoDB running at ${mongod.getUri('ecommerce')}`)
console.log('[db] Press Ctrl+C to stop.')

function shutdown() {
  mongod.stop().finally(() => process.exit(0))
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
