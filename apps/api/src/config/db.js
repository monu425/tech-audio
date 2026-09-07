import mongoose from 'mongoose'

import { env } from './env.js'
import { createLogger } from './logger.js'

const logger = createLogger('db')

const DEFAULT_OPTS = {
  serverSelectionTimeoutMS: 5000,
  maxPoolSize: 20,
  minPoolSize: 1,
  socketTimeoutMS: 45_000,
  autoIndex: !env.isProduction,
  family: 4
}

export async function connectDB(uri = env.mongodbUri, opts = {}) {
  if (!uri) {
    throw new Error('MONGODB_URI is not configured')
  }
  await mongoose.connect(uri, { ...DEFAULT_OPTS, ...opts })
  logger.info({ uri: redactUri(uri) }, 'mongodb connected')
  return mongoose.connection
}

export async function disconnectDB() {
  await mongoose.disconnect()
  logger.info('mongodb disconnected')
}

export function dbState() {
  const state = mongoose.connection.readyState
  // 0 disconnected, 1 connected, 2 connecting, 3 disconnecting
  return state === 1 ? 'connected' : state === 2 ? 'connecting' : 'disconnected'
}

function redactUri(uri) {
  try {
    const url = new URL(uri)
    if (url.username) url.username = '***'
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    return 'mongodb://<redacted>'
  }
}

export default mongoose
