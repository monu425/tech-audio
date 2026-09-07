import argon2 from 'argon2'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

import { env } from '../config/env.js'
import { AuthenticationError, TooManyRequestsError } from '../utils/errors.js'

const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: env.argon2MemoryCost,
  timeCost: env.argon2TimeCost,
  parallelism: env.argon2Parallelism
}

const MAX_LOGIN_ATTEMPTS = 8
const LOCKOUT_MS = 15 * 60 * 1000

export async function hashPassword(password) {
  return argon2.hash(password, ARGON2_OPTS)
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password)
  } catch {
    return false
  }
}

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

export function randomOtp(length = 6) {
  const bytes = crypto.randomBytes(length)
  // Map each byte into the digit range to keep a perfectly uniform distribution
  const digits = Array.from(bytes, (b) => b % 10)
  return digits.join('')
}

export function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function signAccessToken(payload) {
  return jwt.sign({ type: 'access', ...payload }, env.accessTokenSecret, {
    expiresIn: env.accessTokenExpiresIn,
    issuer: 'voltify-api',
    audience: 'voltify'
  })
}

export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.accessTokenSecret, {
      issuer: 'voltify-api',
      audience: 'voltify'
    })
  } catch {
    return null
  }
}

export async function authenticateCredentials(user, password) {
  if (!user) {
    // Constant-ish delay to reduce user enumeration via timing
    await hashPassword(randomToken(32))
    throw new AuthenticationError('Invalid email or password')
  }

  if (user.status === 'locked') {
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new TooManyRequestsError('Account is temporarily locked. Please try again later.')
    }
    // Lock expired -> unlock
    user.status = 'active'
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    await user.save()
  }

  const valid = await verifyPassword(user.passwordHash, password)
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1
    if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
      user.status = 'locked'
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MS)
    }
    await user.save()
    throw new AuthenticationError('Invalid email or password')
  }

  if (user.failedLoginAttempts || user.lockedUntil) {
    user.failedLoginAttempts = 0
    user.lockedUntil = null
    user.status = 'active'
  }
  user.lastLoginAt = new Date()
  await user.save()
  return user
}

export function canAttemptLogin(user) {
  return !(user.status === 'locked' && user.lockedUntil && user.lockedUntil > new Date())
}
