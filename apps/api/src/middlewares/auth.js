import User from '../modules/auth/user.model.js'
import Session from '../modules/auth/session.model.js'
import { verifyAccessToken } from '../services/security.service.js'
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../constants/cookies.js'
import { AuthenticationError, AuthorizationError } from '../utils/errors.js'
import { roleHasPermission, isAdminRole } from '../constants/permissions.js'

export function extractBearerToken(req) {
  const header = req.headers.authorization
  if (!header) return null
  const [scheme, token] = header.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

export function extractAccessToken(req) {
  return extractBearerToken(req) ?? req.cookies?.[ACCESS_COOKIE] ?? null
}

export function extractRefreshToken(req) {
  const bodyToken = req.body?.refreshToken
  return bodyToken ?? req.cookies?.[REFRESH_COOKIE] ?? null
}

async function loadAuthenticatedUser(req) {
  const token = extractAccessToken(req)
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload || payload.type !== 'access' || !payload.sub || !payload.sid) return null

  const [user, session] = await Promise.all([
    User.findById(payload.sub),
    Session.findById(payload.sid)
  ])
  if (!user || !session) return null
  if (session.user.toString() !== user._id.toString()) return null
  if (user.status !== 'active' || !user.emailVerifiedAt) return null
  if (session.revokedAt) return null
  if (session.expiresAt && session.expiresAt.getTime() <= Date.now()) return null

  return { user, payload }
}

export async function requireAuth(req, _res, next) {
  try {
    const result = await loadAuthenticatedUser(req)
    if (!result) {
      throw new AuthenticationError('Authentication required')
    }
    req.user = result.user
    req.auth = result.payload
    next()
  } catch (err) {
    next(err)
  }
}

export async function optionalAuth(req, _res, next) {
  try {
    const result = await loadAuthenticatedUser(req)
    if (result) {
      req.user = result.user
      req.auth = result.payload
    }
    next()
  } catch {
    next()
  }
}

export function requirePermission(permission) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'))
    }
    if (!roleHasPermission(req.user.role, permission)) {
      return next(new AuthorizationError('You do not have permission to perform this action'))
    }
    next()
  }
}

export function requireAdmin() {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'))
    }
    if (!isAdminRole(req.user.role)) {
      return next(new AuthorizationError('You do not have permission to access this resource'))
    }
    next()
  }
}

export function requireSuperAdmin() {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AuthenticationError('Authentication required'))
    }
    if (req.user.role !== 'super_admin') {
      return next(new AuthorizationError('Super admin access required'))
    }
    next()
  }
}
