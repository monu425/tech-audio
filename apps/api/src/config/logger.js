import crypto from 'node:crypto'
import { pino } from 'pino'

import { env } from './env.js'

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password',
  'newPassword',
  'currentPassword',
  'accessToken',
  'refreshToken',
  'otp',
  '*.otp',
  '*.token',
  '*.secret',
  '*.password'
]

const baseLogger = pino({
  level: env.isTest ? 'silent' : env.isProduction ? 'info' : 'debug',
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime
})

export function createRequestId(req) {
  const existing = req.headers['x-request-id'] ?? req.headers['x-correlation-id'] ?? undefined
  const id = Array.isArray(existing) ? existing[0] : existing
  return id && id.length <= 128 ? id : crypto.randomUUID()
}

export function httpLoggerOptions() {
  return {
    logger: baseLogger,
    genReqId: createRequestId,
    autoLogging: {
      ignore: (req) => req.url === '/api/v1/health'
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          ip: req.remoteAddress
        }
      },
      res(res) {
        return {
          statusCode: res.statusCode
        }
      },
      err(err) {
        return {
          type: err.type,
          message: err.message,
          code: err.code,
          stack: env.isProduction ? undefined : err.stack
        }
      }
    },
    customLogLevel(_req, res, err) {
      if (err || res.statusCode >= 500) return 'error'
      if (res.statusCode >= 400) return 'warn'
      return 'info'
    }
  }
}

export function createLogger(name, bindings = {}) {
  return baseLogger.child({ module: name, ...bindings })
}

export default baseLogger
