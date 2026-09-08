import { Router } from 'express'

import { authLimiter } from '../../config/rateLimit.js'
import { requireAuth } from '../../middlewares/auth.js'
import { validateBody, validateParams } from '../../middlewares/validate.js'
import {
  registerSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateMeSchema,
  sessionParamsSchema,
  logoutSchema
} from './auth.validators.js'
import {
  registerHandler,
  resendVerificationHandler,
  verifyEmailHandler,
  loginHandler,
  logoutHandler,
  refreshHandler,
  forgotPasswordHandler,
  resetPasswordHandler,
  changePasswordHandler,
  meHandler,
  updateMeHandler,
  sessionsHandler,
  revokeSessionHandler,
  revokeOthersHandler
} from './auth.controller.js'

const authRouter = Router()

authRouter.post('/register', authLimiter(), validateBody(registerSchema), registerHandler)
authRouter.post('/verify-email', authLimiter(), validateBody(verifyEmailSchema), verifyEmailHandler)
authRouter.post(
  '/resend-verification',
  authLimiter(),
  validateBody(resendVerificationSchema),
  resendVerificationHandler
)
authRouter.post('/login', authLimiter(), validateBody(loginSchema), loginHandler)
authRouter.post('/logout', validateBody(logoutSchema), logoutHandler)
authRouter.post('/refresh', refreshHandler)
authRouter.post(
  '/forgot-password',
  authLimiter(),
  validateBody(forgotPasswordSchema),
  forgotPasswordHandler
)
authRouter.post(
  '/reset-password',
  authLimiter(),
  validateBody(resetPasswordSchema),
  resetPasswordHandler
)

// ---- Authenticated endpoints ----
authRouter.use(requireAuth)

authRouter.post('/change-password', validateBody(changePasswordSchema), changePasswordHandler)
authRouter.get('/me', meHandler)
authRouter.patch('/me', validateBody(updateMeSchema), updateMeHandler)
authRouter.get('/sessions', sessionsHandler)
authRouter.post('/sessions/revoke-others', revokeOthersHandler)
authRouter.delete('/sessions/:sessionId', validateParams(sessionParamsSchema), revokeSessionHandler)

export default authRouter
