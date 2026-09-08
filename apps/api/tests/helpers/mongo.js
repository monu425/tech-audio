import { existsSync } from 'node:fs'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongo
let uri

const CANDIDATE_BINARIES = [
  process.env.MONGOMS_SYSTEM_BINARY,
  '/opt/mongodb/bin/mongod',
  '/usr/bin/mongod',
  '/usr/local/bin/mongod'
].filter(Boolean)

function resolveSystemBinary() {
  return CANDIDATE_BINARIES.find((candidate) => existsSync(candidate))
}

export async function startTestDb() {
  const systemBinary = resolveSystemBinary()
  const options = systemBinary ? { binary: { systemBinary } } : {}
  mongo = await MongoMemoryServer.create(options)
  uri = mongo.getUri('ecommerce_test')
  return uri
}

export async function stopTestDb() {
  if (mongo) {
    await mongo.stop()
    mongo = undefined
    uri = undefined
  }
}

export function getTestUri() {
  return uri
}
