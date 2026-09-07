import { z } from 'zod'

export { z }
export type { ZodType, ZodIssue } from 'zod'

const EMAIL_MAX = 254
const PASSWORD_MIN = 8
const PASSWORD_MAX = 72

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, 'Email is required')
  .max(EMAIL_MAX, `Email cannot exceed ${EMAIL_MAX} characters`)
  .email('Please provide a valid email address')

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Password cannot exceed ${PASSWORD_MAX} characters`)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase, hyphen separated')

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id format')

export const PAGE_DEFAULTS = { page: 1, pageSize: 20, maxPageSize: 100 } as const

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGE_DEFAULTS.page),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGE_DEFAULTS.maxPageSize)
    .default(PAGE_DEFAULTS.pageSize)
})

export const sortSchema = z
  .string()
  .trim()
  .max(64)
  .regex(/^[a-zA-Z0-9_.:-]+$/, 'Invalid sort key')

export const moneyMinorSchema = z.coerce
  .number()
  .int('Amount must be a whole number of minor units')
  .min(0)
  .max(900_000_000)

export const quantitySchema = z.coerce.number().int().min(1).max(999)

export const urlSchema = z
  .string()
  .trim()
  .url('Must be a valid URL')
  .max(2048)
  .nullable()
  .optional()

export const imageAssetSchema = z.object({
  url: z.string().trim().url('Image URL must be valid').max(2048),
  alt: z.string().trim().max(300).nullable().optional()
})

export const productListQuerySchema = z
  .object({
    q: z.string().trim().max(200).optional(),
    category: z.string().trim().max(160).optional(),
    brand: z.string().trim().max(160).optional(),
    minPrice: moneyMinorSchema.optional(),
    maxPrice: moneyMinorSchema.optional(),
    inStock: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    onSale: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    sort: z
      .enum(['relevance', 'price_asc', 'price_desc', 'newest', 'rating', 'popular'])
      .default('relevance')
  })
  .merge(paginationSchema)

export const slugParamSchema = slugSchema

export const addressInputSchema = z.object({
  label: z.string().trim().max(40).nullable().optional(),
  fullName: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(2).max(200),
  line2: z.string().trim().max(200).nullable().optional(),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().max(120).nullable().optional(),
  postalCode: z.string().trim().min(2).max(20),
  country: z.string().trim().length(2, 'Use 2-letter ISO country code'),
  phone: z.string().trim().max(40).nullable().optional(),
  isDefault: z.boolean().optional()
})

export const checkoutSchema = z.object({
  addressId: z.string().trim().min(1, 'Select a shipping address'),
  shippingMethodId: z.string().trim().min(1, 'Select a shipping method'),
  paymentMethod: z.enum(['cod', 'card']),
  couponCode: z.string().trim().max(40).nullable().optional(),
  email: emailSchema.optional(),
  useDifferentBillingAddress: z.boolean().optional()
})
