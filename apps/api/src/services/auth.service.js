import { UserRoles } from '@shop/types'

import User, { toPublicUser } from '../modules/auth/user.model.js'
import {
  authenticateCredentials,
  hashPassword,
  sha256,
  verifyPassword,
  signAccessToken
} from '../services/security.service.js'
import {
  createSession,
  rotateSession,
  revokeSession,
  revokeAllUserSessions,
  listUserSessions
} from '../services/session.service.js'
import { issueOtp, verifyOtp } from '../services/otp.service.js'
import { sendPasswordChangedNotification } from '../services/mailer.service.js'
import {
  AuthenticationError,
  ConflictError,
  ValidationError,
  NotFoundError
} from '../utils/errors.js'
import Session from '../modules/auth/session.model.js'

export async function register({ name, email, password }) {
  const existing = await User.findOne({ email })
  if (existing) {
    throw new ConflictError('An account with this email already exists', 'EMAIL_TAKEN')
  }

  const passwordHash = await hashPassword(password)
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: UserRoles.CUSTOMER,
    status: 'active'
  })

  const { expiresInSeconds } = await issueOtp({
    userId: user._id,
    purpose: 'email_verification',
    email: user.email,
    name: user.name
  })

  return { user: toPublicUser(user), expiresInSeconds }
}

export async function resendVerification({ email }) {
  const user = await User.findOne({ email })
  if (!user) {
    throw new NotFoundError('Account not found', 'ACCOUNT_NOT_FOUND')
  }
  if (user.emailVerifiedAt) {
    throw new ConflictError('Email is already verified', 'EMAIL_ALREADY_VERIFIED')
  }
  const { expiresInSeconds } = await issueOtp({
    userId: user._id,
    purpose: 'email_verification',
    email: user.email,
    name: user.name
  })
  return { expiresInSeconds }
}

export async function verifyEmail({ email, code }) {
  const user = await User.findOne({ email })
  if (!user) {
    throw new NotFoundError('Account not found', 'ACCOUNT_NOT_FOUND')
  }
  if (user.emailVerifiedAt) {
    throw new ConflictError('Email is already verified', 'EMAIL_ALREADY_VERIFIED')
  }
  await verifyOtp({ userId: user._id, purpose: 'email_verification', code })

  user.emailVerifiedAt = new Date()
  await user.save()

  const { refreshToken, session } = await createSession(user, {})
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    sid: session._id.toString()
  })
  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken,
    sessionId: session._id.toString()
  }
}

export async function login({ email, password }, meta = {}) {
  const user = await User.findOne({ email })
  if (user && !user.emailVerifiedAt) {
    throw new AuthenticationError(
      'Please verify your email address before signing in.',
      'EMAIL_NOT_VERIFIED'
    )
  }
  await authenticateCredentials(user, password)

  const { refreshToken, session } = await createSession(user, meta)
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    sid: session._id.toString()
  })

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken,
    sessionId: session._id.toString()
  }
}

export async function refreshSession(refreshTokenPlain, meta = {}) {
  const { refreshToken, session } = await rotateSession(refreshTokenPlain, meta)
  const user = await User.findById(session.user)
  if (!user) {
    throw new AuthenticationError('Account no longer exists')
  }
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    sid: session._id.toString()
  })
  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken
  }
}

export async function logout(refreshTokenPlain) {
  if (!refreshTokenPlain) return
  await Session.updateOne(
    { refreshTokenHash: sha256(refreshTokenPlain), revokedAt: null },
    { revokedAt: new Date(), revokedReason: 'logout' }
  )
}

export async function forgotPassword({ email }) {
  const user = await User.findOne({ email })
  // Do not reveal whether the account exists
  if (!user) {
    return { expiresInSeconds: 600 }
  }
  const { expiresInSeconds } = await issueOtp({
    userId: user._id,
    purpose: 'password_reset',
    email: user.email,
    name: user.name
  })
  return { expiresInSeconds }
}

export async function resetPassword({ email, code, newPassword }) {
  const user = await User.findOne({ email })
  if (!user) {
    throw new NotFoundError('Account not found', 'ACCOUNT_NOT_FOUND')
  }
  await verifyOtp({ userId: user._id, purpose: 'password_reset', code })
  user.passwordHash = await hashPassword(newPassword)
  user.failedLoginAttempts = 0
  user.lockedUntil = null
  user.status = 'active'
  await user.save()
  await revokeAllUserSessions(user._id, 'password_changed')
  return { user: toPublicUser(user) }
}

export async function changePassword({ user, currentPassword, newPassword }) {
  const valid = await verifyPassword(user.passwordHash, currentPassword)
  if (!valid) {
    throw new ValidationError(
      { currentPassword: 'Current password is incorrect' },
      'Change password failed'
    )
  }
  user.passwordHash = await hashPassword(newPassword)
  await user.save()
  await revokeAllUserSessions(user._id, 'password_changed')
  await sendPasswordChangedNotification({ to: user.email, name: user.name }).catch(() => {})
  return { user: toPublicUser(user) }
}

export async function getMe(userId) {
  const user = await User.findById(userId)
  if (!user) throw new NotFoundError('Account not found', 'ACCOUNT_NOT_FOUND')
  return { user: toPublicUser(user) }
}

export async function updateMe(userId, { name, avatarUrl }) {
  const user = await User.findById(userId)
  if (!user) throw new NotFoundError('Account not found', 'ACCOUNT_NOT_FOUND')
  if (name !== undefined) user.name = name
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl
  await user.save()
  return { user: toPublicUser(user) }
}

export async function listSessions(userId) {
  const sessions = await listUserSessions(userId)
  return {
    sessions: sessions.map((session) => ({
      id: session._id.toString(),
      deviceName: session.deviceName,
      userAgent: session.userAgent,
      ip: session.ip,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      expiresAt: session.expiresAt
    }))
  }
}

export async function removeSession(userId, sessionId) {
  const session = await revokeSession(userId, sessionId, 'revoked')
  if (!session) {
    throw new NotFoundError('Session not found', 'SESSION_NOT_FOUND')
  }
  return { revoked: true }
}

export async function removeAllOtherSessions(userId, exceptSessionId) {
  await revokeAllUserSessions(userId, 'revoked', exceptSessionId)
  return { revoked: true }
}
