import { ValidationError } from '../utils/errors.js'

const VALIDATED_QUERY = Symbol('validatedQuery')

export function validatedQuery(req) {
  return req[VALIDATED_QUERY] ?? req.query
}

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source])
    if (!result.success) {
      const fields = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.') || '_root'
        fields[key] = issue.message
      }
      return next(new ValidationError(fields))
    }
    // Replace the incoming data with the validated (parsed/coerced/defaulted) data.
    // Express 5 exposes req.query through a getter-only property, so the parsed
    // object is carried on a symbol and read through validatedQuery().
    if (source === 'query') {
      req[VALIDATED_QUERY] = result.data
    } else {
      req[source] = result.data
    }
    next()
  }
}

export function validateBody(schema) {
  return validate(schema, 'body')
}

export function validateQuery(schema) {
  return validate(schema, 'query')
}

export function validateParams(schema) {
  return validate(schema, 'params')
}
