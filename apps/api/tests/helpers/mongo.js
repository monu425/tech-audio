import { MongoMemoryServer } from 'mongodb-memory-server'

let mongo
let uri

export async function startTestDb() {
  mongo = await MongoMemoryServer.create()
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
