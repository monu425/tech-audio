import mongoose from 'mongoose'
import { CouponTypes } from '@shop/types'

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      maxlength: 40
    },
    type: {
      type: String,
      enum: Object.values(CouponTypes),
      required: true
    },
    value: { type: Number, required: true, min: 0 },
    minSubtotalMinor: { type: Number, default: 0, min: 0 },
    maxDiscountMinor: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'USD', maxlength: 3 },
    startsAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null },
    usageLimit: { type: Number, default: null, min: 0 },
    usedCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: null, min: 0 },
    enabled: { type: Boolean, default: true }
  },
  { timestamps: true, versionKey: false }
)

couponSchema.index({ enabled: 1, expiresAt: 1 })

const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema)

export default Coupon

const couponUsageSchema = new mongoose.Schema(
  {
    coupon: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    usedCount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true, versionKey: false }
)

couponUsageSchema.index({ coupon: 1, user: 1 }, { unique: true })

export const CouponUsage =
  mongoose.models.CouponUsage || mongoose.model('CouponUsage', couponUsageSchema)
