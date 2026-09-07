import Coupon, { CouponUsage } from './coupon.model.js'
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

export async function validateCoupon(code, { subtotalMinor, userId } = {}) {
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
  const discountMinor = computeCouponDiscount(coupon, subtotalMinor)
  return {
    coupon,
    discountMinor,
    description:
      coupon.type === 'percentage'
        ? `${coupon.value}% off`
        : `${(coupon.value / 100).toFixed(2)} ${coupon.currency} off`
  }
}

export async function useCoupon(coupon, userId) {
  await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } })
  if (userId) {
    await CouponUsage.updateOne(
      { coupon: coupon._id, user: userId },
      { $inc: { usedCount: 1 } },
      { upsert: true }
    )
  }
}
