export class AppError extends Error {
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', fields, details } = {}) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.fields = fields
    this.details = details
    this.isOperational = true
    Error.captureStackTrace?.(this, this.constructor)
  }

  toJSON() {
    const body = { code: this.code }
    if (this.fields) body.fields = this.fields
    if (this.details !== undefined) body.details = this.details
    return body
  }
}

export class ValidationError extends AppError {
  constructor(fields, message = 'Validation failed') {
    super(message, {
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      fields: fields ?? {}
    })
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHENTICATED') {
    super(message, { statusCode: 401, code })
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    super(message, { statusCode: 403, code })
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, { statusCode: 404, code })
  }
}

export class ConflictError extends AppError {
  constructor(message, code = 'CONFLICT') {
    super(message, { statusCode: 409, code })
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request', code = 'BAD_REQUEST') {
    super(message, { statusCode: 400, code })
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, { statusCode: 429, code: 'TOO_MANY_REQUESTS' })
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message = 'Payment required') {
    super(message, { statusCode: 402, code: 'PAYMENT_REQUIRED' })
  }
}
