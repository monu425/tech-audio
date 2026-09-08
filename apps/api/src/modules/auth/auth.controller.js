import {
  register,
  resendVerification,
  verifyEmail,
  login,
  refreshSession,
  logout,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateMe,
  listSessions,
  removeSession,
  removeAllOtherSessions
} from '../../services/auth.service.js'
import { sendSuccess, sendCreated } from '../../utils/respond.js'
import { setAuthCookies, clearAuthCookies } from '../../constants/cookies.js'
import { extractRefreshToken } from '../../middlewares/auth.js'
import { AuthenticationError } from '../../utils/errors.js'

function requestMeta(req) {
  return {
    userAgent: req.headers['user-agent'] ?? '',
    ip: req.ip ?? '',
    deviceName: req.body?.deviceName ?? ''
  }
}

export const registerHandler = async (req, res, next) => {
  try {
    const data = await register(req.body)
    return sendCreated(res, {
      message: 'Account created. A verification code has been sent to your email.',
      data: { user: data.user, expiresInSeconds: data.expiresInSeconds }
    })
  } catch (err) {
    next(err)
  }
}

export const resendVerificationHandler = async (req, res, next) => {
  try {
    const data = await resendVerification(req.body)
    return sendSuccess(res, {
      message: 'A new verification code has been sent to your email.',
      data: { expiresInSeconds: data.expiresInSeconds }
    })
  } catch (err) {
    next(err)
  }
}

export const verifyEmailHandler = async (req, res, next) => {
  try {
    const data = await verifyEmail(req.body)
    setAuthCookies(res, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    })
    return sendSuccess(res, {
      message: 'Email verified. You are now signed in.',
      data: { user: data.user }
    })
  } catch (err) {
    next(err)
  }
}

export const loginHandler = async (req, res, next) => {
  try {
    const data = await login(req.body, requestMeta(req))
    setAuthCookies(res, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    })
    return sendSuccess(res, {
      message: 'Signed in successfully',
      data: { user: data.user }
    })
  } catch (err) {
    next(err)
  }
}

export const refreshHandler = async (req, res, next) => {
  try {
    const refreshToken = extractRefreshToken(req)
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token missing')
    }
    const data = await refreshSession(refreshToken, {
      userAgent: req.headers['user-agent'] ?? '',
      ip: req.ip ?? ''
    })
    setAuthCookies(res, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken
    })
    return sendSuccess(res, {
      message: 'Session refreshed',
      data: { user: data.user }
    })
  } catch (err) {
    next(err)
  }
}

export const logoutHandler = async (req, res, next) => {
  try {
    const refreshToken = extractRefreshToken(req)
    await logout(refreshToken)
    clearAuthCookies(res)
    return sendSuccess(res, { message: 'Signed out successfully' })
  } catch (err) {
    next(err)
  }
}

export const forgotPasswordHandler = async (req, res, next) => {
  try {
    await forgotPassword(req.body)
    return sendSuccess(res, {
      message: 'If that email is registered, a password reset code has been sent to it.'
    })
  } catch (err) {
    next(err)
  }
}

export const resetPasswordHandler = async (req, res, next) => {
  try {
    await resetPassword(req.body)
    clearAuthCookies(res)
    return sendSuccess(res, {
      message: 'Password reset successful. Please sign in with your new password.'
    })
  } catch (err) {
    next(err)
  }
}

export const changePasswordHandler = async (req, res, next) => {
  try {
    await changePassword({ user: req.user, ...req.body })
    clearAuthCookies(res)
    return sendSuccess(res, {
      message: 'Password changed successfully. Please sign in again.'
    })
  } catch (err) {
    next(err)
  }
}

export const meHandler = async (req, res, next) => {
  try {
    const data = await getMe(req.user._id)
    return sendSuccess(res, { message: 'Profile fetched', data })
  } catch (err) {
    next(err)
  }
}

export const updateMeHandler = async (req, res, next) => {
  try {
    const data = await updateMe(req.user._id, req.body)
    return sendSuccess(res, { message: 'Profile updated', data })
  } catch (err) {
    next(err)
  }
}

export const sessionsHandler = async (req, res, next) => {
  try {
    const data = await listSessions(req.user._id, req.auth?.sid)
    return sendSuccess(res, { message: 'Sessions fetched', data })
  } catch (err) {
    next(err)
  }
}

export const revokeSessionHandler = async (req, res, next) => {
  try {
    const data = await removeSession(req.user._id, req.params.sessionId, req.auth?.sid)
    return sendSuccess(res, { message: 'Session revoked', data })
  } catch (err) {
    next(err)
  }
}

export const revokeOthersHandler = async (req, res, next) => {
  try {
    const data = await removeAllOtherSessions(req.user._id, req.auth?.sid)
    return sendSuccess(res, { message: 'Other sessions revoked', data })
  } catch (err) {
    next(err)
  }
}
