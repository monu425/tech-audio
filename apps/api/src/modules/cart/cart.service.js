import Cart from './cart.model.js'
import Product, {
  productBaseAvailableStock,
  variantAvailableStock
} from '../catalog/product.model.js'
import { sha256 } from '../../services/security.service.js'
import { NotFoundError, BadRequestError } from '../../utils/errors.js'
import { ProductStatuses } from '@shop/types'
import { validateCoupon } from '../coupon/coupon.service.js'
export const GUEST_CART_COOKIE = 'cart_id'
export const GUEST_CART_MAX_AGE = 30 * 24 * 60 * 60 * 1000

export function hashGuestToken(token) {
  return sha256(token)
}

function asOptionObject(options) {
  if (options instanceof Map) return Object.fromEntries(options)
  return { ...(options ?? {}) }
}

function optionSummary(variant, product) {
  if (!variant) return null
  const options = asOptionObject(variant.options)
  const names = product.variants
    ?.filter((item) => item.active)
    .flatMap((item) => Object.keys(asOptionObject(item.options)))
  const keys = [...new Set(names ?? Object.keys(options))]
  const parts = keys.filter((key) => options[key] != null).map((key) => `${key}: ${options[key]}`)
  return parts.length ? parts.join(' · ') : null
}

function discountPercent(compareAtMinor, priceMinor) {
  if (!compareAtMinor || compareAtMinor <= priceMinor) return null
  return Math.round(((compareAtMinor - priceMinor) / compareAtMinor) * 100)
}

async function hydrateLine(item, product) {
  if (item.quantity < 1) return null
  let variant = null
  const hasVariants = (product.variants ?? []).some((entry) => entry.active)
  if (item.variantId) {
    variant = (product.variants ?? []).find(
      (entry) => entry._id.toString() === item.variantId.toString()
    )
    if (!variant || !variant.active) return null
  } else if (hasVariants) {
    return null
  }
  const availableStock = variant
    ? variantAvailableStock(variant)
    : productBaseAvailableStock(product)
  const priceMinor = variant?.priceMinor ?? product.priceMinor
  const compareAtMinor = variant?.compareAtMinor ?? product.compareAtMinor ?? null

  return {
    productId: product._id.toString(),
    variantId: variant ? variant._id.toString() : null,
    name: product.name,
    slug: product.slug,
    sku: variant?.sku ?? product.sku,
    image: product.images?.[0] ?? null,
    optionSummary: variant ? optionSummary(variant, product) : null,
    unitPriceMinor: priceMinor,
    compareAtMinor,
    discountPercent: discountPercent(compareAtMinor, priceMinor),
    quantity: item.quantity,
    availableStock,
    lineTotalMinor: priceMinor * item.quantity
  }
}

async function recomputeCartDoc(cart, { userId }) {
  if (!cart) {
    return { dto: emptyCartDto(), changed: false, cart: null }
  }
  const productIds = [...new Set(cart.items.map((item) => item.productId))]
  const products = await Product.find({ _id: { $in: productIds } }).lean()
  const productById = new Map(products.map((product) => [product._id.toString(), product]))

  const kept = []
  const lines = []
  let changed = false

  for (const item of cart.items) {
    const product = productById.get(item.productId.toString())
    if (!product || product.status !== ProductStatuses.PUBLISHED) {
      changed = true
      continue
    }
    const line = await hydrateLine(item, product)
    if (!line) {
      changed = true
      continue
    }
    if (line.quantity > line.availableStock && line.availableStock > 0) {
      line.quantity = line.availableStock
      item.quantity = line.availableStock
      changed = true
    }
    if (line.quantity <= 0 || line.availableStock <= 0) {
      changed = true
      continue
    }
    kept.push(item)
    lines.push(line)
  }

  if (changed) {
    cart.items = kept
  }

  const subtotalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0)
  const currency = lines[0]?.unitPriceMinor !== undefined ? 'USD' : 'USD'

  let discountMinor = 0
  let couponDescription = null
  let couponCode = cart.couponCode ?? null
  if (couponCode) {
    try {
      const couponResult = await validateCoupon(couponCode, { subtotalMinor, userId })
      discountMinor = couponResult.discountMinor
      couponDescription = couponResult.description
    } catch {
      couponCode = null
      cart.couponCode = null
      changed = true
    }
  }

  const itemsCount = lines.reduce((sum, line) => sum + line.quantity, 0)

  return {
    cart,
    changed,
    dto: {
      id: cart._id.toString(),
      lines,
      totals: {
        itemsCount,
        subtotalMinor,
        discountMinor,
        shippingMinor: 0,
        taxMinor: 0,
        grandTotalMinor: subtotalMinor - discountMinor,
        currency
      },
      couponCode,
      couponDescription
    }
  }
}

export function emptyCartDto() {
  return {
    id: null,
    lines: [],
    totals: {
      itemsCount: 0,
      subtotalMinor: 0,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      grandTotalMinor: 0,
      currency: 'USD'
    },
    couponCode: null,
    couponDescription: null
  }
}

export async function getCartByUser(userId) {
  const cart = await Cart.findOne({ user: userId })
  const { dto, changed, cart: doc } = await recomputeCartDoc(cart, { userId })
  if (changed && doc) await doc.save()
  return dto
}

export async function getCartByGuest(guestToken) {
  const cart = await Cart.findOne({ guestTokenHash: hashGuestToken(guestToken) })
  const { dto, changed, cart: doc } = await recomputeCartDoc(cart, {})
  if (changed && doc) await doc.save()
  return dto
}

async function getOrCreateGuestCart(guestToken) {
  const tokenHash = hashGuestToken(guestToken)
  let cart = await Cart.findOne({ guestTokenHash: tokenHash })
  if (!cart) {
    cart = await Cart.create({
      guestTokenHash: tokenHash,
      items: [],
      expiresAt: new Date(Date.now() + GUEST_CART_MAX_AGE)
    })
  }
  return cart
}

async function getOrCreateUserCart(userId) {
  let cart = await Cart.findOne({ user: userId })
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] })
  }
  return cart
}

async function fetchLineProduct(productId) {
  const product = await Product.findOne({
    _id: productId,
    status: ProductStatuses.PUBLISHED
  }).lean()
  if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')
  return product
}

function resolveVariant(product, variantId) {
  const hasVariants = (product.variants ?? []).some((entry) => entry.active)
  if (hasVariants && !variantId) {
    throw new BadRequestError('Please select product options first', 'VARIANT_REQUIRED')
  }
  if (variantId) {
    const variant = (product.variants ?? []).find(
      (entry) => entry._id.toString() === variantId.toString()
    )
    if (!variant || !variant.active) {
      throw new BadRequestError('Selected option is unavailable', 'VARIANT_NOT_FOUND')
    }
    return variant
  }
  return null
}

function maxAvailableFor(product, variant) {
  return variant ? variantAvailableStock(variant) : productBaseAvailableStock(product)
}

export async function addToCart({ user, guestToken, productId, variantId, quantity }) {
  const product = await fetchLineProduct(productId)
  const variant = resolveVariant(product, variantId)
  const available = maxAvailableFor(product, variant)

  const cart = user ? await getOrCreateUserCart(user) : await getOrCreateGuestCart(guestToken)

  let item = cart.items.find(
    (entry) =>
      entry.productId.toString() === productId.toString() &&
      (entry.variantId?.toString() ?? null) === (variantId?.toString() ?? null)
  )
  const newQuantity = (item?.quantity ?? 0) + quantity
  if (newQuantity > available) {
    if (available <= 0) {
      throw new BadRequestError('This item is currently out of stock', 'OUT_OF_STOCK')
    }
    throw new BadRequestError(`Only ${available} available in stock`, 'INSUFFICIENT_STOCK')
  }
  if (item) {
    item.quantity = newQuantity
  } else {
    cart.items.push({
      productId,
      variantId: variant?._id ?? null,
      quantity
    })
  }
  await cart.save()
  const result = await recomputeCartDoc(cart, { userId: user ?? null })
  if (result.changed) await result.cart.save()
  return result.dto
}

export async function updateCartItem({ user, guestToken, productId, variantId, quantity }) {
  const filter = { productId, variantId: variantId ?? null }
  const cart = user
    ? await Cart.findOne({ user })
    : await Cart.findOne({ guestTokenHash: hashGuestToken(guestToken) })
  if (!cart) throw new NotFoundError('Cart not found', 'CART_NOT_FOUND')

  const item = cart.items.find(
    (entry) =>
      entry.productId.toString() === filter.productId.toString() &&
      (entry.variantId?.toString() ?? null) === (filter.variantId?.toString() ?? null)
  )
  if (!item) throw new NotFoundError('Item not in cart', 'CART_ITEM_NOT_FOUND')

  if (quantity <= 0) {
    cart.items = cart.items.filter((entry) => entry !== item)
    await cart.save()
    const result = await recomputeCartDoc(cart, { userId: user ?? null })
    if (result.changed) await result.cart.save()
    return result.dto
  }

  const product = await Product.findById(item.productId).lean()
  const variant = item.variantId
    ? (product.variants ?? []).find((entry) => entry._id.toString() === item.variantId.toString())
    : null
  const available = maxAvailableFor(product, variant)
  const clamped = Math.min(quantity, available > 0 ? available : item.quantity)
  if (clamped <= 0) {
    throw new BadRequestError('This item is currently out of stock', 'OUT_OF_STOCK')
  }
  item.quantity = clamped
  await cart.save()
  const result = await recomputeCartDoc(cart, { userId: user ?? null })
  if (result.changed) await result.cart.save()
  return result.dto
}

export async function removeCartItem({ user, guestToken, productId, variantId }) {
  const cart = user
    ? await Cart.findOne({ user })
    : await Cart.findOne({ guestTokenHash: hashGuestToken(guestToken) })
  if (!cart) throw new NotFoundError('Cart not found', 'CART_NOT_FOUND')
  cart.items = cart.items.filter(
    (entry) =>
      !(
        entry.productId.toString() === productId.toString() &&
        (entry.variantId?.toString() ?? null) === (variantId?.toString() ?? null)
      )
  )
  await cart.save()
  const result = await recomputeCartDoc(cart, { userId: user ?? null })
  if (result.changed) await result.cart.save()
  return result.dto
}

export async function clearCartContents({ user, guestToken }) {
  const cart = user
    ? await Cart.findOne({ user })
    : await Cart.findOne({ guestTokenHash: hashGuestToken(guestToken) })
  if (cart) {
    cart.items = []
    cart.couponCode = null
    await cart.save()
  }
  return emptyCartDto()
}

export async function setCartCoupon({ user, guestToken, code }) {
  const cleanCode = String(code).trim().toUpperCase()
  await validateCoupon(cleanCode)
  const cart = user ? await getOrCreateUserCart(user) : await getOrCreateGuestCart(guestToken)
  cart.couponCode = cleanCode
  await cart.save()
  const result = await recomputeCartDoc(cart, { userId: user ?? null })
  if (result.changed) await result.cart.save()
  return result.dto
}

export async function removeCartCoupon({ user, guestToken }) {
  const cart = user
    ? await Cart.findOne({ user })
    : await Cart.findOne({ guestTokenHash: hashGuestToken(guestToken) })
  if (cart) {
    cart.couponCode = null
    await cart.save()
  }
  const result = await recomputeCartDoc(cart, { userId: user ?? null })
  if (result.changed) await result.cart.save()
  return result.dto
}

// Called when an authenticated request also carries a guest cart.
export async function mergeGuestCartIntoUser(user, guestToken) {
  if (!guestToken) return null
  const guestCart = await Cart.findOne({ guestTokenHash: hashGuestToken(guestToken) })
  if (!guestCart || guestCart.items.length === 0) return null

  const userCart = await getOrCreateUserCart(user._id)
  const products = await Product.find({
    _id: { $in: guestCart.items.map((item) => item.productId) },
    status: ProductStatuses.PUBLISHED
  }).lean()
  const productById = new Map(products.map((product) => [product._id.toString(), product]))

  let merged = false
  for (const guestItem of guestCart.items) {
    const product = productById.get(guestItem.productId.toString())
    if (!product) continue
    const variant = guestItem.variantId
      ? (product.variants ?? []).find(
          (entry) => entry._id.toString() === guestItem.variantId.toString()
        )
      : null
    if (guestItem.variantId && (!variant || !variant.active)) continue
    if (!guestItem.variantId && (product.variants ?? []).some((entry) => entry.active)) continue
    const available = maxAvailableFor(product, variant)
    if (available <= 0) continue
    const existing = userCart.items.find(
      (entry) =>
        entry.productId.toString() === guestItem.productId.toString() &&
        (entry.variantId?.toString() ?? null) === (guestItem.variantId?.toString() ?? null)
    )
    const desired = Math.min((existing?.quantity ?? 0) + guestItem.quantity, available)
    if (desired > 0) {
      if (existing) existing.quantity = desired
      else
        userCart.items.push({
          productId: guestItem.productId,
          variantId: guestItem.variantId ?? null,
          quantity: desired
        })
      merged = true
    }
  }
  if (merged) {
    if (!userCart.couponCode && guestCart.couponCode) userCart.couponCode = guestCart.couponCode
    await userCart.save()
  }
  await Cart.deleteOne({ _id: guestCart._id })
  return merged ? userCart._id.toString() : null
}
