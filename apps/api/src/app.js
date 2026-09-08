import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { pinoHttp } from 'pino-http'

import { env, isAllowedSource } from './config/env.js'
import { httpLoggerOptions } from './config/logger.js'
import { globalLimiter } from './config/rateLimit.js'
import { csrfProtection } from './middlewares/csrf.js'
import { errorHandler } from './middlewares/errorHandler.js'
import { notFoundHandler } from './middlewares/notFound.js'
import v1Router from './routes/v1.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', env.isProduction)

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
  )

  app.use(
    cors({
      origin(origin, callback) {
        // Allow non-browser clients (no Origin header) and configured origins
        if (isAllowedSource(origin)) {
          return callback(null, true)
        }
        return callback(null, false)
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
      exposedHeaders: ['X-Request-Id']
    })
  )

  app.use(pinoHttp(httpLoggerOptions()))
  app.use((req, res, next) => {
    if (req.id) res.setHeader('X-Request-Id', req.id)
    next()
  })
  app.use(express.json({ limit: env.bodyLimit }))
  app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }))
  app.use(cookieParser())

  app.use(csrfProtection)

  const uploadsDir = path.resolve(env.mediaUploadDir)
  mkdirSync(uploadsDir, { recursive: true })
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', immutable: true }))

  if (!env.isTest) {
    app.use(globalLimiter)
  }

  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'Voltify API is running',
      data: {
        name: '@shop/api',
        version: '0.1.0',
        api: '/api/v1',
        docs: '/api/v1/docs'
      }
    })
  })

  app.use('/api/v1', v1Router)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

export default createApp
