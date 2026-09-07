import { emailSchema, passwordSchema } from '@shop/validation'
import { z } from '@shop/validation'

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Name must be at least 2 characters')
      .max(80, 'Name cannot exceed 80 characters'),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })
  .transform(({ confirmPassword: _confirmPassword, ...rest }) => rest)

export const verifyEmailSchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Code must be 6 digits')
})

export const resendVerificationSchema = z.object({
  email: emailSchema
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(100)
})

export const forgotPasswordSchema = z.object({
  email: emailSchema
})

export const resetPasswordSchema = z
  .object({
    email: emailSchema,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, 'Code must be 6 digits'),
    newPassword: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })
  .transform(({ confirmPassword: _confirmPassword, ...rest }) => rest)

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(100),
    newPassword: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  })
  .transform(({ confirmPassword: _confirmPassword, ...rest }) => rest)

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    avatarUrl: z.string().trim().url('Avatar must be a valid URL').max(2048).optional().nullable()
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update'
  })

export const sessionParamsSchema = z.object({
  sessionId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid session id')
})

export const logoutSchema = z
  .object({
    refreshToken: z.string().optional()
  })
  .default({})
