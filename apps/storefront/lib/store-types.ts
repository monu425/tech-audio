export interface ImageRef {
  url: string
  alt?: string | null
}

export interface BrandRef {
  id: string
  name: string
  slug: string
}

export interface CategoryRef {
  id: string
  name: string
  slug: string
}

export interface PaginationMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export interface ProductSummary {
  id: string
  name: string
  slug: string
  sku: string
  brand: BrandRef | null
  category: CategoryRef | null
  shortDescription: string | null
  image: ImageRef | null
  priceMinor: number
  compareAtMinor: number | null
  currency: string
  availableStock: number
  stockStatus: string
  ratingAverage: number | null
  reviewCount: number
  discountPercent: number | null
  featured?: boolean
}

export interface ProductVariant {
  id: string
  sku: string
  options: Record<string, string>
  priceMinor: number | null
  compareAtMinor: number | null
  availableStock: number
  stockStatus: string
  active: boolean
}

export interface BreadcrumbItem {
  id: string
  name: string
  slug: string
}

export interface ProductDetail {
  id: string
  name: string
  slug: string
  sku: string
  brand: BrandRef | null
  breadcrumb: BreadcrumbItem[]
  shortDescription: string | null
  description: string | null
  images: ImageRef[]
  priceMinor: number
  compareAtMinor: number | null
  currency: string
  availableStock: number
  stockStatus: string
  discountPercent: number | null
  attributes: Array<{ name: string; value: string }>
  variants: ProductVariant[]
  hasVariants: boolean
  optionNames: string[]
  tags: string[]
  ratingAverage: number | null
  ratingCount: number
  publishedAt: string | null
}

export interface CatalogListData {
  items: ProductSummary[]
  meta: PaginationMeta
  facets: {
    brands: Array<{ slug: string; name: string; count: number }>
    categories: Array<{ slug: string; name: string; count: number }>
    price: { min: number; max: number }
    inStock: number
    onSale: number
  }
}

export interface Review {
  id: string
  rating: number
  title: string | null
  body: string | null
  user: { name: string }
  createdAt: string
  images?: ImageRef[]
}

export interface ReviewsListData {
  items: Review[]
  meta: PaginationMeta
  ratingSummary: {
    average: number
    count: number
    breakdown: Record<string, number>
  }
}

export interface CartLine {
  productId: string
  variantId: string | null
  name: string
  slug: string
  sku: string
  image: ImageRef | null
  optionSummary: string | null
  unitPriceMinor: number
  compareAtMinor: number | null
  discountPercent: number | null
  quantity: number
  availableStock: number
  lineTotalMinor: number
}

export interface CartTotals {
  itemsCount: number
  subtotalMinor: number
  discountMinor: number
  shippingMinor: number
  taxMinor: number
  grandTotalMinor: number
  currency: string
}

export interface CartDto {
  id: string | null
  lines: CartLine[]
  totals: CartTotals
  couponCode: string | null
  couponDescription: string | null
}

export interface Address {
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
}

export interface AddressInput {
  label?: string | null
  fullName: string
  line1: string
  line2?: string | null
  city: string
  state?: string | null
  postalCode: string
  country: string
  phone?: string | null
  isDefault?: boolean
}

export interface ShippingMethod {
  id: string
  name: string
  description: string
  estimatedDays: string
  priceMinor: number
}

export interface CheckoutOptions {
  cart: CartDto
  addresses: Address[]
  shippingMethods: ShippingMethod[]
  paymentMethods: Array<{ id: string; name: string; description: string }>
  taxRatePercent: number
}

export interface OrderLine {
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

export interface OrderSummary {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  paymentMethod: string
  currency: string
  itemsCount: number
  subtotalMinor: number
  discountMinor: number
  shippingMinor: number
  taxMinor: number
  totalMinor: number
  createdAt: string
}

export interface OrderDetail extends OrderSummary {
  email: string
  items: OrderLine[]
  couponCode: string | null
  shippingMethod: { id: string; name: string; description: string } | null
  shippingAddress: {
    fullName: string
    line1: string
    line2: string | null
    city: string
    state: string | null
    postalCode: string
    country: string
    phone: string | null
  }
  billingAddress: Record<string, unknown> | null
  timeline: Array<{ status: string; at: string; note?: string | null }>
}

export interface PublicUser {
  id: string
  name: string
  email: string
  emailVerified: boolean
}

export interface SessionInfo {
  id: string
  deviceName: string
  createdAt: string
  lastUsedAt: string
  current: boolean
  expiresAt: string | null
}
