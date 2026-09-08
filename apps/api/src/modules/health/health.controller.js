import { dbState } from '../../config/db.js'
import { env } from '../../config/env.js'
import { sendSuccess } from '../../utils/respond.js'

export function getHealth(req, res, next) {
  try {
    const state = dbState()
    const statusCode = state === 'connected' ? 200 : 503
    return res.status(statusCode).json({
      success: state === 'connected',
      message: state === 'connected' ? 'OK' : 'Service unavailable',
      ...(state === 'connected' ? {} : { error: { code: 'SERVICE_UNAVAILABLE' } }),
      data: {
        status: state === 'connected' ? 'up' : 'degraded',
        database: state,
        environment: env.nodeEnv,
        uptimeSec: Math.round(process.uptime()),
        memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        timestamp: new Date().toISOString()
      }
    })
  } catch (err) {
    return next(err)
  }
}

export function getRoot(_req, res, next) {
  try {
    return sendSuccess(res, {
      message: 'Voltify API is running',
      data: {
        name: '@shop/api',
        version: '0.1.0',
        health: '/api/v1/health',
        docs: '/api/v1/docs'
      }
    })
  } catch (err) {
    return next(err)
  }
}
