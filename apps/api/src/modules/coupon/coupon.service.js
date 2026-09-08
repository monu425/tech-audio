import Coupon, { CouponUsage } from './coupon.model.js'
import Product from '../catalog/product.model.js'
import { BadRequestError } from '../../utils/errors.js'

export function computeCouponDiscount(coupon, subtotalMinor) {
  if (coupon.minSubtotalMinor && subtotalMinor < coupon.minSubtotalMinor) {
    throw new BadRequestError(
      `Minimum order value for this coupon is ${(coupon.minSubtotalMinor / 100).toFixed(2)} ${coupon.currency}`,
      'COUPON_MIN_NOT_MET'
    )
  }
  let discount
  if (coupon.type === 'percentage') {
    discount = Math.round((subtotalMinor * coupon.value) / 100)
  } else {
    discount = Math.min(coupon.value, subtotalMinor)
  }
  if (coupon.maxDiscountMinor && discount > coupon.maxDiscountMinor) {
    discount = coupon.maxDiscountMinor
  }
  return Math.min(discount, subtotalMinor)
}

export function couponStatusLabel(coupon) {
  const now = new Date()
  if (!coupon.enabled) return 'inactive'
  if (coupon.startsAt && coupon.startsAt > now) return 'inactive'
  if (coupon.expiresAt && coupon.expiresAt < now) return 'expired'
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) return 'expired'
  return 'active'
}

/**
 * Returns the subtotal of the lines the coupon can be applied to, or null when
 * the coupon is not restricted to specific products/categories. A line is
 * eligible when it matches the product scope (if any) and the category scope
 * (if any). Products store the full ancestor category path in `categoryIds`,
 * so restricting by a parent category also covers its descendants.
 */
export async function couponEligibleSubtotal(coupon, lines) {
  const productIds = coupon.productIds ?? []
  const categoryIds = coupon.categoryIds ?? []
  if (productIds.length === 0 && categoryIds.length === 0) return null

  const items = (lines ?? []).filter((line) => line && line.productId)
  if (items.length === 0) return 0

  const products = await Product.find({
    _id: { $in: items.map((item) => item.productId) }
  })
    .select('categoryIds')
    .lean()
  const productById = new Map(products.map((product) => [product._id.toString(), product]))
  const productScope = new Set(productIds.map((id) => String(id)))
  const categoryScope = new Set(categoryIds.map((id) => String(id)))

  let eligibleMinor = 0
  for (const line of items) {
    const product = productById.get(String(line.productId))
    if (!product) continue
    const inProductScope = productScope.size === 0 || productScope.has(String(line.productId))
    const inCategoryScope =
      categoryScope.size === 0 ||
      (product.categoryIds ?? []).some((id) => categoryScope.has(String(id)))
    if (!inProductScope || !inCategoryScope) continue
    eligibleMinor += line.lineTotalMinor ?? (line.quantity ?? 0) * (line.unitPriceMinor ?? 0)
  }
  return eligibleMinor
}

export async function validateCoupon(code, { subtotalMinor, userId, lines } = {}) {
  const coupon = await Coupon.findOne({ code: String(code).trim().toUpperCase() })
  if (!coupon) throw new BadRequestError('Invalid coupon code', 'COUPON_INVALID')
  const status = couponStatusLabel(coupon)
  if (status !== 'active') {
    throw new BadRequestError('This coupon is no longer valid', 'COUPON_INVALID')
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new BadRequestError('This coupon has reached its usage limit', 'COUPON_EXHAUSTED')
  }
  if (userId && coupon.perUserLimit) {
    const usage = await CouponUsage.findOne({ coupon: coupon._id, user: userId })
    if (usage && usage.usedCount >= coupon.perUserLimit) {
      throw new BadRequestError('You have already used this coupon', 'COUPON_PER_USER_LIMIT')
    }
  }

  let discountBase = subtotalMinor
  const hasScope = (coupon.productIds?.length ?? 0) > 0 || (coupon.categoryIds?.length ?? 0) > 0
  if (hasScope && (lines ?? []).length > 0) {
    const eligibleMinor = await couponEligibleSubtotal(coupon, lines)
    if (eligibleMinor <= 0) {
      throw new BadRequestError(
        'This coupon does not apply to any item in your cart',
        'COUPON_NOT_APPLICABLE'
      )
    }
    discountBase = eligibleMinor
  }

  const discountMinor = computeCouponDiscount(coupon, discountBase)
  return {
    coupon,
    discountMinor,
    description:
      coupon.type === 'percentage'
        ? `${coupon.value}% off`
        : `${(coupon.value / 100).toFixed(2)} ${coupon.currency} off`
  }
}

/**
 * Atomically consumes one use of the coupon. Global capacity is claimed with a
 * guarded `$inc`, and the per-user quota is reserved through the unique
 * `{ coupon, user }` index plus an increment so concurrent double consumption
 * is detected and rolled back.
 */
export async function useCoupon(coupon, userId) {
  const capacityFilter = { _id: coupon._id }
  if (coupon.usageLimit) capacityFilter.usedCount = { $lt: coupon.usageLimit }
  const claimed = await Coupon.findOneAndUpdate(
    capacityFilter,
    { $inc: { usedCount: 1 } },
    { returnDocument: 'after' }
  )
  if (!claimed)
    throw new BadRequestError('This coupon has reached its usage limit', 'COUPON_EXHAUSTED')

  if (userId) {
    const usageFilter = { coupon: coupon._id, user: userId }
    let usage
    try {
      usage = await CouponUsage.findOneAndUpdate(
        usageFilter,
        { $inc: { usedCount: 1 } },
        { returnDocument: 'after', upsert: true }
      )
    } catch (error) {
      if (error?.code !== 11000) throw error
      usage = await CouponUsage.findOneAndUpdate(
        usageFilter,
        { $inc: { usedCount: 1 } },
        { returnDocument: 'after' }
      )
    }
    if (coupon.perUserLimit && usage.usedCount > coupon.perUserLimit) {
      await CouponUsage.updateOne(usageFilter, { $inc: { usedCount: -1 } })
      await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: -1 } })
      throw new BadRequestError('You have already used this coupon', 'COUPON_PER_USER_LIMIT')
    }
  }
}

/**
 * Reverses a previously consumed use (order cancelled/refunded). Kept for the
 * order engineer to call from order cancellation/refund flows.
 */
export async function releaseCouponUse(couponId, userId) {
  await Coupon.updateOne({ _id: couponId }, { $inc: { usedCount: -1 } })
  if (userId) {
    await CouponUsage.updateOne({ coupon: couponId, user: userId }, { $inc: { usedCount: -1 } })
  }
}

/**
 * Reverses a previously consumed use (order cancelled/refunded). Lookup is by
 * the code stored on the order so callers never need to resolve the coupon id.
 */
export async function releaseCouponByCode(code, userId) {
  const coupon = await Coupon.findOne({
    code: String(code ?? '')
      .trim()
      .toUpperCase()
  }).select('_id')
  if (!coupon) return
  await releaseCouponUse(coupon._id, userId)
}
