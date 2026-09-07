import { env } from '../config/env.js'
import { randomToken, sha256 } from '../services/security.service.js'
import { AuthenticationError } from '../utils/errors.js'
import { parseDuration } from '../utils/time.js'
import Session from '../modules/auth/session.model.js'

const MAX_HISTORY = 4

function expiresInMs() {
  return parseDuration(env.refreshTokenExpiresIn, 7 * 86_400_000)
}

export async function createSession(user, { userAgent = '', ip = '', deviceName = '' } = {}) {
  const refreshToken = randomToken(32)
  const session = await Session.create({
    user: user._id,
    refreshTokenHash: sha256(refreshToken),
    userAgent: String(userAgent).slice(0, 500),
    ip,
    deviceName: String(deviceName || '').slice(0, 200),
    expiresAt: new Date(Date.now() + expiresInMs())
  })
  return { refreshToken, session }
}

export async function rotateSession(refreshTokenPlain, { userAgent, ip } = {}) {
  const hash = sha256(refreshTokenPlain)
  const session = await Session.findOne({
    $or: [{ refreshTokenHash: hash }, { historyHashes: hash }]
  })

  if (!session) {
    throw new AuthenticationError('Invalid refresh token')
  }

  // Token matches a historical (already rotated) hash => replay/theft signal.
  if (session.refreshTokenHash !== hash) {
    session.revokedAt = new Date()
    session.revokedReason = 'reuse'
    await session.save()
    await revokeAllUserSessions(session.user, 'reuse')
    throw new AuthenticationError('Session has been revoked. Please sign in again')
  }

  if (session.revokedAt) {
    throw new AuthenticationError('Session has been revoked. Please sign in again')
  }

  if (session.expiresAt <= new Date()) {
    session.revokedAt = new Date()
    session.revokedReason = 'revoked'
    await session.save()
    throw new AuthenticationError('Session has expired. Please sign in again')
  }

  const nextToken = randomToken(32)
  session.historyHashes = [...session.historyHashes.slice(-(MAX_HISTORY - 1)), hash]
  session.refreshTokenHash = sha256(nextToken)
  session.expiresAt = new Date(Date.now() + expiresInMs())
  session.lastUsedAt = new Date()
  if (userAgent) session.userAgent = String(userAgent).slice(0, 500)
  if (ip) session.ip = ip
  await session.save()

  return { refreshToken: nextToken, session }
}

export async function revokeSession(userId, sessionId, reason = 'revoked') {
  const session = await Session.findOneAndUpdate(
    { _id: sessionId, user: userId, revokedAt: null },
    { revokedAt: new Date(), revokedReason: reason },
    { returnDocument: 'after' }
  )
  return session
}

export async function revokeAllUserSessions(userId, reason = 'revoked', exceptSessionId) {
  const filter = { user: userId, revokedAt: null }
  if (exceptSessionId) filter._id = { $ne: exceptSessionId }
  await Session.updateMany(filter, { revokedAt: new Date(), revokedReason: reason })
}

export async function listUserSessions(userId) {
  return Session.find({ user: userId, revokedAt: null }).sort({ lastUsedAt: -1 }).limit(50)
}
