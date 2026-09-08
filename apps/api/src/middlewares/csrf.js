import { isAllowedSource } from '../config/env.js'
import { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE } from '../constants/cookies.js'
import { AuthorizationError } from '../utils/errors.js'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF protection for cookie-authenticated state-changing requests.
 *
 * Defense in depth:
 *  1. Requests authenticated via an `Authorization` bearer header are immune
 *     to CSRF (an attacker cannot set custom headers cross-origin) and skip.
 *  2. Double-submit token: when the browser echoes the readable `csrf_token`
 *     cookie in `X-CSRF-Token` it must match the cookie exactly.
 *  3. Origin / Referer allow-list: a cross-site request from a non-allow-listed
 *     source is rejected even when no token is supplied.
 *  4. Requests carrying neither a token nor an Origin/Referer header are
 *     non-browser clients (curl, server-to-server, native apps). Browsers
 *     always send Origin on cross-site POST, so allowing these does not open a
 *     CSRF vector; cross-site cookie attachment is additionally gated by
 *     SameSite on the auth cookies.
 */
export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next()

  const bearer = req.headers.authorization
  if (bearer) return next()

  const hasAuthCookie = Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE])
  if (!hasAuthCookie) return next()

  const headerToken = req.headers['x-csrf-token']
  const cookieToken = req.cookies?.[CSRF_COOKIE]
  if (
    headerToken &&
    cookieToken &&
    typeof headerToken === 'string' &&
    headerToken.length > 0 &&
    headerToken === cookieToken
  ) {
    return next()
  }

  const origin = req.headers.origin
  const referer = req.headers.referer
  const source = origin ?? referer
  if (!isAllowedSource(source)) {
    return next(new AuthorizationError('Cross-site request rejected', 'CSRF_BLOCKED'))
  }
  next()
}
