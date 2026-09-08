export const UserRoles = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin'
} as const
export type UserRole = (typeof UserRoles)[keyof typeof UserRoles]

export const UserStatuses = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  LOCKED: 'locked'
} as const
export type UserStatus = (typeof UserStatuses)[keyof typeof UserStatuses]

export const ProductStatuses = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived'
} as const
export type ProductStatus = (typeof ProductStatuses)[keyof typeof ProductStatuses]

export const OrderStatuses = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  PACKED: 'packed',
  SHIPPED: 'shipped',
  OUT_FOR_DELIVERY: 'out_for_delivery',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  RETURN_REQUESTED: 'return_requested',
  RETURNED: 'returned',
  REFUNDED: 'refunded'
} as const
export type OrderStatus = (typeof OrderStatuses)[keyof typeof OrderStatuses]

export const OrderPaymentStatuses = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PARTIALLY_REFUNDED: 'partially_refunded'
} as const
export type OrderPaymentStatus = (typeof OrderPaymentStatuses)[keyof typeof OrderPaymentStatuses]

export const OrderFulfilmentStatuses = {
  UNFULFILLED: 'unfulfilled',
  FULFILLED: 'fulfilled'
} as const
export type OrderFulfilmentStatus =
  (typeof OrderFulfilmentStatuses)[keyof typeof OrderFulfilmentStatuses]

export const CategoryStatuses = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const
export type CategoryStatus = (typeof CategoryStatuses)[keyof typeof CategoryStatuses]

export const BrandStatuses = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
} as const
export type BrandStatus = (typeof BrandStatuses)[keyof typeof BrandStatuses]

export const ReviewStatuses = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
} as const
export type ReviewStatus = (typeof ReviewStatuses)[keyof typeof ReviewStatuses]

export const CouponTypes = {
  PERCENTAGE: 'percentage',
  FIXED: 'fixed'
} as const
export type CouponType = (typeof CouponTypes)[keyof typeof CouponTypes]

export const CouponStatuses = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  EXPIRED: 'expired'
} as const
export type CouponStatus = (typeof CouponStatuses)[keyof typeof CouponStatuses]

export const StockMovementReasons = {
  MANUAL_ADJUSTMENT: 'manual_adjustment',
  ORDER_PLACED: 'order_placed',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_DELIVERED: 'order_delivered',
  RETURN: 'return',
  RESTOCK: 'restock'
} as const
export type StockMovementReason = (typeof StockMovementReasons)[keyof typeof StockMovementReasons]

export const StockStatus = {
  IN_STOCK: 'in_stock',
  LOW_STOCK: 'low_stock',
  OUT_OF_STOCK: 'out_of_stock'
} as const
export type StockStatusValue = (typeof StockStatus)[keyof typeof StockStatus]

export const PaymentMethods = {
  CASH_ON_DELIVERY: 'cod',
  CARD: 'card'
} as const
export type PaymentMethod = (typeof PaymentMethods)[keyof typeof PaymentMethods]

export const CURRENCY = 'USD'

/** All prices are integers in the smallest currency unit (minor units, e.g. cents for USD). */
export type MoneyMinor = number

export interface ApiSuccess<T> {
  success: true
  message: string
  data: T
}

export interface ApiErrorBody {
  code: string
  message?: string
  fields?: Record<string, string>
}

export interface ApiFailure {
  success: false
  message: string
  error: ApiErrorBody
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export interface PageMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface Page<T> {
  items: T[]
  meta: PageMeta
}

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
}

export interface SeoFields {
  title?: string | null
  description?: string | null
  keywords?: string[] | null
}

export interface MediaAsset {
  url: string
  alt?: string | null
}

export interface Brand {
  id: string
  name: string
  slug: string
  description?: string | null
  logoUrl?: string | null
  status: BrandStatus
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  slug: string
  parentId?: string | null
  description?: string | null
  imageUrl?: string | null
  status: CategoryStatus
  seo?: SeoFields | null
  children?: Category[]
  createdAt: string
  updatedAt: string
}

export interface ProductAttribute {
  name: string
  value: string
}

export interface ProductVariant {
  id: string
  sku: string
  options: Record<string, string>
  priceMinor?: MoneyMinor | null
  compareAtMinor?: MoneyMinor | null
  stock: number
  reserved: number
  active: boolean
}

export interface ProductSummary {
  id: string
  name: string
  slug: string
  sku: string
  brand?: Pick<Brand, 'id' | 'name' | 'slug'> | null
  category?: { id: string; name: string; slug: string } | null
  shortDescription?: string | null
  image?: MediaAsset | null
  priceMinor: MoneyMinor
  compareAtMinor?: MoneyMinor | null
  currency: string
  availableStock: number
  stockStatus: StockStatusValue
  ratingAverage?: number | null
  reviewCount: number
  status: ProductStatus
  featured: boolean
  publishedAt?: string | null
  discountPercent?: number | null
}

export interface Product extends ProductSummary {
  description?: string | null
  brandId?: string | null
  categoryIds: string[]
  categories: { id: string; name: string; slug: string }[]
  images: MediaAsset[]
  attributes: ProductAttribute[]
  variants: ProductVariant[]
  tags: string[]
  seo?: SeoFields | null
  stock: number
  reserved: number
  lowStockThreshold: number
  createdAt: string
  updatedAt: string
}

export interface ProductFacetValue {
  value: string
  count: number
}

export interface ProductFacets {
  brands: ProductFacetValue[]
  categories: ProductFacetValue[]
  price: { min: MoneyMinor; max: MoneyMinor }
  inStock: boolean
  onSale: boolean
}

export interface ProductListResult {
  items: ProductSummary[]
  meta: PageMeta
  facets: ProductFacets
}

export interface SearchSuggestion {
  type: 'product' | 'category' | 'brand'
  slug?: string
  name: string
  imageUrl?: string | null
}

export interface CartLine {
  productId: string
  variantId?: string | null
  name: string
  slug: string
  sku: string
  image?: MediaAsset | null
  optionSummary?: string | null
  unitPriceMinor: MoneyMinor
  compareAtMinor?: MoneyMinor | null
  quantity: number
  availableStock: number
  lineTotalMinor: MoneyMinor
}

export interface CartTotals {
  itemsCount: number
  subtotalMinor: MoneyMinor
  discountMinor: MoneyMinor
  shippingMinor: MoneyMinor
  taxMinor: MoneyMinor
  grandTotalMinor: MoneyMinor
  currency: string
}

export interface Cart {
  id: string
  lines: CartLine[]
  totals: CartTotals
  couponCode?: string | null
  couponDescription?: string | null
}

export interface WishlistItem {
  product: ProductSummary
  addedAt: string
}

export interface Wishlist {
  items: WishlistItem[]
}

export interface Address {
  id: string
  label?: string | null
  fullName: string
  line1: string
  line2?: string | null
  city: string
  state?: string | null
  postalCode: string
  country: string
  phone?: string | null
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface OrderLine {
  productId: string
  variantId?: string | null
  name: string
  slug: string
  sku: string
  imageUrl?: string | null
  optionSummary?: string | null
  unitPriceMinor: MoneyMinor
  quantity: number
  lineTotalMinor: MoneyMinor
}

export interface OrderAddressSnapshot {
  fullName: string
  line1: string
  line2?: string | null
  city: string
  state?: string | null
  postalCode: string
  country: string
  phone?: string | null
}

export interface OrderSummary {
  id: string
  orderNumber: string
  status: OrderStatus
  paymentStatus: OrderPaymentStatus
  paymentMethod?: PaymentMethod | null
  currency: string
  itemsCount: number
  subtotalMinor: MoneyMinor
  discountMinor: MoneyMinor
  shippingMinor: MoneyMinor
  taxMinor: MoneyMinor
  totalMinor: MoneyMinor
  createdAt: string
}

export interface OrderTimelineEvent {
  status: OrderStatus
  note?: string | null
  at: string
}

export interface Order extends OrderSummary {
  items: OrderLine[]
  couponCode?: string | null
  shippingAddress: OrderAddressSnapshot
  billingAddress?: OrderAddressSnapshot | null
  timeline: OrderTimelineEvent[]
}

export interface OrderTotals {
  subtotalMinor: MoneyMinor
  discountMinor: MoneyMinor
  shippingMinor: MoneyMinor
  taxMinor: MoneyMinor
  totalMinor: MoneyMinor
  currency: string
}

export interface ShippingMethodOption {
  id: string
  name: string
  description: string
  priceMinor: MoneyMinor
  estimatedDays: string
}

export interface OrderPreview {
  itemsCount: number
  lines: CartLine[]
  totals: OrderTotals
  shippingMethod?: ShippingMethodOption | null
  couponCode?: string | null
  couponDescription?: string | null
}

export interface PublicUser {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  emailVerified: boolean
  avatarUrl?: string | null
  createdAt: string
}

export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['return_requested', 'refunded'],
  cancelled: [],
  return_requested: ['returned', 'refunded', 'cancelled'],
  returned: ['refunded'],
  refunded: []
}
