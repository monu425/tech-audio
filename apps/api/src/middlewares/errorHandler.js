import { ZodError } from 'zod'

import { env } from '../config/env.js'
import { AppError, ValidationError } from '../utils/errors.js'

export function errorHandler(err, req, res, _next) {
  let error = err

  if (error instanceof ZodError) {
    const fields = {}
    for (const issue of error.issues) {
      const key = issue.path.join('.') || '_root'
      fields[key] = issue.message
    }
    error = new ValidationError(fields)
  }

  // Body parser (json/urlencoded) syntax or size errors
  if (
    error &&
    !(error instanceof AppError) &&
    typeof error.status === 'number' &&
    typeof error.type === 'string'
  ) {
    error = new AppError('Malformed request body', {
      statusCode: error.status,
      code: error.status === 413 ? 'PAYLOAD_TOO_LARGE' : 'BAD_REQUEST'
    })
  }

  const statusCode = error.statusCode ?? 500
  const isOperational = error instanceof AppError

  if (!isOperational || statusCode >= 500) {
    const log = req.log ?? console
    log.error(
      {
        err: {
          message: error.message,
          code: error.code,
          stack: env.isProduction ? undefined : error.stack
        },
        requestId: req.id
      },
      'unhandled error'
    )
  }

  if (statusCode >= 500 && !env.isProduction) {
    // Surface details in dev only; production returns a generic message.
    if (!isOperational) {
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_ERROR', message: error.message }
      })
    }
  }

  if (error instanceof AppError) {
    return res.status(statusCode).json({
      success: false,
      message: error.message,
      error: error.toJSON()
    })
  }

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: { code: 'INTERNAL_ERROR' }
  })
}
