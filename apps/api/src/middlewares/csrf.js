import { isAllowedSource } from '../config/env.js'
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../constants/cookies.js'
import { AuthorizationError } from '../utils/errors.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF protection for cookie-authenticated state-changing requests.
 *
 * Requests authenticated via the Authorization Bearer header are immune to
 * CSRF (an attacker cannot set custom headers cross-origin) and skip this check.
 * Cookie-authenticated non-safe requests must originate from a configured
 * frontend origin (checked via Origin/Referer).
 */
export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next()

  const bearer = req.headers.authorization
  if (bearer) return next()

  const hasAuthCookie = Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE])
  if (!hasAuthCookie) return next()

  const origin = req.headers.origin
  const referer = req.headers.referer
  const source = origin ?? referer

  if (!isAllowedSource(source)) {
    return next(new AuthorizationError('Cross-site request rejected', 'CSRF_BLOCKED'))
  }
  next()
}
