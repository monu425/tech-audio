export interface PageMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  statusCounts?: Record<string, number>
}

export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  status: string
  emailVerified: boolean
  avatarUrl: string | null
  createdAt: string
}

export interface SessionMe {
  user: AdminUser
  permissions: string[]
  roleLabel: string
}

export interface DashboardData {
  counts: {
    products: number
    productsPublished: number
    customers: number
    customersNew30d: number
    reviewsPending: number
    couponsActive: number
    orders: number
    revenueMinor: number
  }
  revenueSeries: { date: string; revenueMinor: number; orders: number }[]
  ordersByStatus: { status: string; count: number }[]
  topProducts: {
    productId: string
    name: string
    imageUrl: string | null
    slug: string | null
    units: number
    revenueMinor: number
  }[]
  recentOrders: OrderSummary[]
  lowStockItems: {
    id: string
    name: string
    sku: string
    imageUrl: string | null
    available: number
    threshold: number
    variantsCount: number
  }[]
}

export interface BrandRef {
  id: string
  name: string
}

export interface CategoryRef {
  id: string
  name: string
}

export interface Product {
  id: string
  name: string
  slug: string
  sku: string
  shortDescription: string | null
  description: string | null
  brand: BrandRef | null
  category: CategoryRef | null
  images: { url: string; alt: string }[]
  priceMinor: number
  compareAtMinor: number | null
  currency: string
  stock: number
  reserved: number
  availableStock: number
  lowStockThreshold: number
  status: string
  featured: boolean
  attributes: { key: string; value: string }[]
  tags: string[]
  variants: {
    id: string
    sku: string
    options: Record<string, string>
    priceMinor: number | null
    compareAtMinor: number | null
    stock: number
    reserved: number
    available: number
    active: boolean
  }[]
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  ratingAverage: number
  ratingCount: number
}

export type ProductListItem = Product

export interface ProductFormMeta {
  brands: { id: string; name: string; slug: string; status: string }[]
  categories: { id: string; name: string; slug: string; level: number }[]
  statuses: string[]
  currencies: string[]
}

export interface OrderSummary {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string | null
  currency: string
  customer: { id: string; name: string | null; email: string | null }
  itemsCount: number
  subtotalMinor: number
  discountMinor: number
  shippingMinor: number
  taxMinor: number
  totalMinor: number
  shippingMethod: { id: string; name: string; estimatedDays: string } | null
  couponCode: string | null
  createdAt: string
  updatedAt: string
}

export interface OrderItem {
  id: string
  productId: string
  variantId: string | null
  name: string
  slug: string
  sku: string
  imageUrl: string | null
  optionSummary: string | null
  unitPriceMinor: number
  quantity: number
  lineTotalMinor: number
}

export interface OrderDetail extends OrderSummary {
  items: OrderItem[]
  notes: string | null
  shippingAddress: {
    fullName: string
    line1: string
    line2: string | null
    city: string
    state: string | null
    postalCode: string
    country: string
    phone: string | null
  } | null
  timeline: { status: string; note: string | null; at: string }[]
}

export interface CustomerSummary {
  id: string
  name: string
  email: string
  status: string
  avatarUrl: string | null
  lastLoginAt: string | null
  createdAt: string
  orderCount: number
  totalSpentMinor: number
}

export interface CustomerDetail {
  customer: {
    id: string
    name: string
    email: string
    role: string
    status: string
    emailVerified: boolean
    avatarUrl: string | null
    lastLoginAt: string | null
    createdAt: string
    addresses: {
      id: string
      label: string | null
      fullName: string
      line1: string
      line2: string | null
      city: string
      state: string | null
      postalCode: string
      country: string
      phone: string | null
      isDefault: boolean
    }[]
  }
  orders: { items: OrderSummary[]; meta: { totalItems: number } }
}

export interface Coupon {
  id: string
  code: string
  type: 'percentage' | 'fixed'
  value: number
  minSubtotalMinor: number
  maxDiscountMinor: number | null
  currency: string
  startsAt: string | null
  expiresAt: string | null
  usageLimit: number | null
  usedCount: number
  perUserLimit: number | null
  enabled: boolean
  statusLabel: string
  createdAt: string
  updatedAt: string
}

export interface ReviewItem {
  id: string
  rating: number
  title: string | null
  body: string | null
  images: { url: string; alt: string }[]
  status: string
  verifiedPurchase: boolean
  helpfulCount: number
  product: { id: string; name: string; imageUrl: string | null; status: string } | null
  user: { id: string; name: string | null } | null
  createdAt: string
}

export interface CategoryRow {
  id: string
  name: string
  slug: string
  parentId: string | null
  description: string | null
  imageUrl: string | null
  status: string
  productsCount: number
  createdAt: string
}

export interface BrandRow {
  id: string
  name: string
  slug: string
  description: string | null
  logoUrl: string | null
  status: string
  createdAt: string
}

export interface StaffMember {
  id: string
  name: string
  email: string
  role: string
  status: string
  emailVerified: boolean
  roleLabel: string
  lastLoginAt: string | null
  createdAt: string
}

export interface SalesReport {
  summary: {
    revenueMinor: number
    orders: number
    itemsSold: number
    avgOrderMinor: number
    lastPeriodRevenueMinor: number
    revenueChangePercent: number | null
    lastDayOrders: number
  }
  series: { key: string; label: string; revenueMinor: number; orders: number }[]
}

export interface TopProductsReport {
  items: {
    productId: string
    name: string
    sku: string | null
    slug: string | null
    imageUrl: string | null
    priceMinor: number | null
    units: number
    revenueMinor: number
    sharePercent: number
  }[]
  meta: { unitsTotal: number; revenueMinor: number }
}

export interface PlatformSettings {
  store: { storeName: string; storeEmail: string }
  taxRatePercent: number
  currency: string
  shippingMethods: { id: string; name: string; description: string; estimatedDays: string }[]
}

export interface AuditLogEntry {
  id: string
  actorId: string | null
  actorName: string | null
  actorRole: string | null
  action: string
  resource: string | null
  resourceId: string | null
  method: string | null
  path: string | null
  status: number
  summary: string | null
  meta: Record<string, unknown>
  ip: string | null
  userAgent: string | null
  createdAt: string
}
