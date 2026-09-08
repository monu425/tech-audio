import mongoose from 'mongoose'
import { CURRENCY, OrderPaymentStatuses, OrderStatuses, PaymentMethods } from '@shop/types'

const orderLineSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, maxlength: 220 },
    sku: { type: String, required: true, trim: true, maxlength: 80 },
    imageUrl: { type: String, maxlength: 2048, default: null },
    optionSummary: { type: String, maxlength: 300, default: null },
    unitPriceMinor: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    lineTotalMinor: { type: Number, required: true, min: 0 }
  },
  { versionKey: false }
)

const addressSnapshotSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200, default: null },
    city: { type: String, required: true, trim: true, maxlength: 120 },
    state: { type: String, trim: true, maxlength: 120, default: null },
    postalCode: { type: String, required: true, trim: true, maxlength: 20 },
    country: { type: String, required: true, minlength: 2, maxlength: 2 },
    phone: { type: String, trim: true, maxlength: 40, default: null }
  },
  { _id: false, versionKey: false }
)

const timelineEventSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: Object.values(OrderStatuses),
      required: true
    },
    note: { type: String, trim: true, maxlength: 500, default: null },
    at: { type: Date, default: Date.now }
  },
  { _id: false, versionKey: false }
)

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: Object.values(OrderStatuses),
      default: OrderStatuses.PENDING,
      index: true
    },
    paymentStatus: {
      type: String,
      enum: Object.values(OrderPaymentStatuses),
      default: OrderPaymentStatuses.PENDING
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethods),
      default: null
    },
    currency: { type: String, default: CURRENCY, uppercase: true, maxlength: 3 },
    items: { type: [orderLineSchema], default: [] },
    couponCode: { type: String, maxlength: 40, default: null },
    couponDescription: { type: String, maxlength: 200, default: null },
    subtotalMinor: { type: Number, required: true, min: 0 },
    discountMinor: { type: Number, required: true, min: 0 },
    shippingMinor: { type: Number, required: true, min: 0 },
    taxMinor: { type: Number, required: true, min: 0 },
    totalMinor: { type: Number, required: true, min: 0 },
    shippingMethod: {
      id: { type: String, maxlength: 60, default: null },
      name: { type: String, maxlength: 120, default: null },
      estimatedDays: { type: String, maxlength: 60, default: null }
    },
    shippingAddress: { type: addressSnapshotSchema, required: true },
    billingAddress: { type: addressSnapshotSchema, default: null },
    email: { type: String, trim: true, maxlength: 254, default: null },
    notes: { type: String, trim: true, maxlength: 1000, default: null },
    timeline: { type: [timelineEventSchema], default: [] },
    cancelledAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    couponReleasedAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
)

orderSchema.index({ user: 1, createdAt: -1 })
orderSchema.index({ status: 1, createdAt: -1 })
orderSchema.index({ email: 1, createdAt: -1 })

const Order = mongoose.models.Order || mongoose.model('Order', orderSchema)

export default Order

const COUNTER_KEY = 'order_number'
let counterModel = null

function getCounterModel() {
  if (counterModel) return counterModel
  const counterSchema = new mongoose.Schema(
    {
      key: { type: String, required: true, unique: true },
      seq: { type: Number, required: true, default: 0 }
    },
    { versionKey: false }
  )
  counterModel = mongoose.models.Counter || mongoose.model('Counter', counterSchema)
  return counterModel
}

export async function nextOrderNumber() {
  const Counter = getCounterModel()
  const counter = await Counter.findOneAndUpdate(
    { key: COUNTER_KEY },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  )
  const seq = String(counter.seq).padStart(6, '0')
  const prefix = `SH-${new Date().getUTCFullYear()}`
  return `${prefix}-${seq}`
}
