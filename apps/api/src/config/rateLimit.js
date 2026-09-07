import { rateLimit } from 'express-rate-limit'

import { env } from './env.js'

export function createLimiter({
  windowMs = env.globalRateLimit.windowMs,
  max = env.globalRateLimit.max,
  message = 'Too many requests, please try again later.',
  skipSuccessfulRequests = false,
  standardHeaders = 'draft-7',
  legacyHeaders = false
} = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders,
    legacyHeaders,
    skipSuccessfulRequests,
    message: {
      success: false,
      message,
      error: { code: 'TOO_MANY_REQUESTS' }
    }
  })
}

export const globalLimiter = createLimiter()

export function authLimiter() {
  return createLimiter({
    windowMs: 15 * 60 * 1000,
    max: 20,
    skipSuccessfulRequests: true,
    message: 'Too many authentication attempts. Please try again later.'
  })
}
