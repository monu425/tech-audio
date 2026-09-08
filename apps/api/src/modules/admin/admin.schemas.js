import { z } from 'zod'
import {
  OrderStatuses,
  OrderPaymentStatuses,
  ProductStatuses,
  BrandStatuses,
  CategoryStatuses,
  ReviewStatuses,
  UserRoles,
  UserStatuses,
  CouponTypes
} from '@shop/types'

export const idParamSchema = z.object({
  id: z.string().min(1)
})

export const mediaUrl = z
  .string()
  .refine((value) => /^https?:\/\//.test(value) || value.startsWith('/uploads/'), {
    message: 'Invalid URL'
  })

export function paginationQuery(defaultPageSize = 20, extra = {}) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(defaultPageSize),
    q: z.string().trim().max(120).optional().default(''),
    ...extra
  })
}

export const listProductsQuery = paginationQuery(20, {
  status: z.enum(Object.values(ProductStatuses)).optional(),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  stockFilter: z.enum(['all', 'in_stock', 'low_stock', 'out_of_stock']).optional().default('all')
})

export const productPayload = z.object({
  name: z.string().trim().min(2).max(200),
  sku: z.string().trim().min(1).max(80),
  shortDescription: z.string().trim().max(300).optional().default(''),
  description: z.string().trim().max(20000).optional().default(''),
  brandId: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  priceMinor: z.coerce.number().int().min(0),
  compareAtMinor: z.coerce.number().int().min(0).nullable().optional(),
  currency: z.string().length(3).optional().default('USD'),
  stock: z.coerce.number().int().min(0).optional().default(0),
  lowStockThreshold: z.coerce.number().int().min(0).optional().default(5),
  images: z
    .array(z.object({ url: mediaUrl, alt: z.string().optional().default('') }))
    .max(12)
    .optional()
    .default([]),
  attributes: z
    .array(z.object({ key: z.string().trim().min(1), value: z.string().trim().min(1) }))
    .optional()
    .default([]),
  tags: z.array(z.string().trim().min(1)).optional().default([]),
  status: z.enum(Object.values(ProductStatuses)).optional(),
  featured: z.boolean().optional(),
  variants: z
    .array(
      z.object({
        sku: z.string().trim().min(1).max(80),
        options: z.record(z.string(), z.string()).optional().default({}),
        priceMinor: z.coerce.number().int().min(0).nullable().optional(),
        compareAtMinor: z.coerce.number().int().min(0).nullable().optional(),
        stock: z.coerce.number().int().min(0).optional().default(0),
        active: z.boolean().optional().default(true)
      })
    )
    .max(200)
    .optional()
})

export const inventoryAdjustPayload = z.object({
  variantId: z.string().nullable().optional(),
  delta: z.coerce
    .number()
    .int()
    .refine((value) => value !== 0, {
      message: 'delta cannot be zero'
    }),
  reason: z
    .enum(['manual_adjustment', 'restock', 'return'])
    .optional()
    .default('manual_adjustment'),
  note: z.string().trim().max(500).optional().default('')
})

export const brandPayload = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional().default(''),
  logoUrl: mediaUrl.nullable().optional(),
  status: z.enum(Object.values(BrandStatuses)).optional(),
  seo: z
    .object({
      title: z.string().trim().max(160).nullable().optional(),
      description: z.string().trim().max(320).nullable().optional()
    })
    .optional()
})

export const categoryPayload = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(1).max(160).optional(),
  parentId: z.string().nullable().optional(),
  description: z.string().trim().max(2000).optional().default(''),
  imageUrl: mediaUrl.nullable().optional(),
  status: z.enum(Object.values(CategoryStatuses)).optional(),
  seo: z
    .object({
      title: z.string().trim().max(160).nullable().optional(),
      description: z.string().trim().max(320).nullable().optional(),
      keywords: z.array(z.string().trim().min(1)).optional()
    })
    .optional()
})

export const couponPayload = z.object({
  code: z.string().trim().min(3).max(40),
  type: z.enum(Object.values(CouponTypes)),
  value: z.coerce.number().int().min(1),
  minSubtotalMinor: z.coerce.number().int().min(0).optional().default(0),
  maxDiscountMinor: z.coerce.number().int().min(0).nullable().optional(),
  currency: z.string().length(3).optional().default('USD'),
  startsAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  usageLimit: z.coerce.number().int().min(1).nullable().optional(),
  perUserLimit: z.coerce.number().int().min(1).nullable().optional(),
  productIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid product id'))
    .max(200)
    .optional()
    .default([]),
  categoryIds: z
    .array(z.string().regex(/^[a-f\d]{24}$/i, 'Invalid category id'))
    .max(100)
    .optional()
    .default([]),
  enabled: z.boolean().optional().default(true)
})

export const couponPatchPayload = couponPayload.partial()

export const orderTransitionPayload = z.object({
  status: z.enum(Object.values(OrderStatuses)),
  note: z.string().trim().max(500).optional().default(''),
  paymentStatus: z.enum(Object.values(OrderPaymentStatuses)).optional()
})

export const paymentStatusPayload = z.object({
  paymentStatus: z.enum(Object.values(OrderPaymentStatuses)),
  note: z.string().trim().max(500).optional().default('')
})

export const listOrdersQuery = paginationQuery(20, {
  status: z.enum(Object.values(OrderStatuses)).optional(),
  paymentStatus: z.enum(Object.values(OrderPaymentStatuses)).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
})

export const listCustomersQuery = paginationQuery(20, {
  status: z.enum(Object.values(UserStatuses)).optional()
})

export const customerStatusPayload = z.object({
  status: z.enum(Object.values(UserStatuses))
})

export const roleChangePayload = z.object({
  role: z.enum(Object.values(UserRoles))
})

export const staffCreatePayload = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128),
  role: z.enum([UserRoles.ADMIN, UserRoles.SUPER_ADMIN])
})

export const reviewModerationPayload = z.object({
  status: z.enum([ReviewStatuses.APPROVED, ReviewStatuses.REJECTED, ReviewStatuses.PENDING])
})

export const settingsPayload = z.object({
  storeName: z.string().trim().min(2).max(80).optional(),
  storeEmail: z.string().trim().email().max(254).optional(),
  taxRatePercent: z.coerce.number().min(0).max(100).optional()
})

export const salesReportQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional().default('day')
})

export const topProductsQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10)
})
