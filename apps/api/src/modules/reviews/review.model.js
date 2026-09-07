import mongoose from 'mongoose'
import { ReviewStatuses } from '@shop/types'

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120, default: null },
    body: { type: String, trim: true, maxlength: 5000, default: null },
    images: {
      type: [{ url: String, alt: String }],
      default: []
    },
    status: {
      type: String,
      enum: Object.values(ReviewStatuses),
      default: ReviewStatuses.PENDING
    },
    verifiedPurchase: { type: Boolean, default: false },
    helpfulCount: { type: Number, default: 0 }
  },
  { timestamps: true, versionKey: false }
)

reviewSchema.index({ product: 1, status: 1, createdAt: -1 })
reviewSchema.index({ user: 1, createdAt: -1 })

const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema)

export default Review
