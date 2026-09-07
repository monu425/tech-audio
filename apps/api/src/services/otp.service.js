import Otp from '../modules/auth/otp.model.js'
import { randomOtp, sha256 } from './security.service.js'
import { sendPasswordResetOtp, sendVerificationOtp } from './mailer.service.js'
import { ConflictError, ValidationError } from '../utils/errors.js'
import { parseDuration } from '../utils/time.js'

const OTP_TTL_MS = parseDuration('10m', 600_000)
const MAX_ATTEMPTS = 5
const RESEND_COOLDOWN_MS = 60_000

async function findLatestActive(userId, purpose) {
  return Otp.findOne({
    user: userId,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 })
}

export async function issueOtp({ userId, purpose, email, name }) {
  const latest = await Otp.findOne({
    user: userId,
    purpose,
    consumedAt: null
  }).sort({ createdAt: -1 })

  if (latest && Date.now() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const waitSec = Math.ceil(
      (RESEND_COOLDOWN_MS - (Date.now() - latest.createdAt.getTime())) / 1000
    )
    throw new ConflictError(
      `A code was already sent. Please wait ${waitSec} seconds before requesting another.`,
      'OTP_RESEND_COOLDOWN'
    )
  }

  const otp = randomOtp(6)

  await Otp.updateMany({ user: userId, purpose, consumedAt: null }, { consumedAt: new Date() })

  await Otp.create({
    user: userId,
    purpose,
    codeHash: sha256(otp),
    maxAttempts: MAX_ATTEMPTS,
    expiresAt: new Date(Date.now() + OTP_TTL_MS)
  })

  const ttlMinutes = OTP_TTL_MS / 60_000
  if (purpose === 'password_reset') {
    await sendPasswordResetOtp({ to: email, name, otp, ttlMinutes })
  } else {
    await sendVerificationOtp({ to: email, name, otp, ttlMinutes })
  }

  return { expiresInSeconds: OTP_TTL_MS / 1000 }
}

export async function verifyOtp({ userId, purpose, code }) {
  const record = await findLatestActive(userId, purpose)
  if (!record) {
    throw new ValidationError(
      { otp: 'Code is invalid or has expired. Please request a new one.' },
      'OTP validation failed'
    )
  }

  if (record.attempts >= record.maxAttempts) {
    record.consumedAt = new Date()
    await record.save()
    throw new ValidationError(
      { otp: 'Too many attempts. Please request a new code.' },
      'OTP validation failed'
    )
  }

  const valid = sha256(code) === record.codeHash
  if (!valid) {
    record.attempts += 1
    await record.save()
    throw new ValidationError({ otp: 'Incorrect code. Please try again.' }, 'OTP validation failed')
  }

  record.consumedAt = new Date()
  await record.save()

  // Invalidate any other active codes of the same purpose for this user
  await Otp.updateMany(
    { user: userId, purpose, _id: { $ne: record._id }, consumedAt: null },
    { consumedAt: new Date() }
  )

  return true
}

export async function isEmailVerified(user) {
  return Boolean(user.emailVerifiedAt)
}
