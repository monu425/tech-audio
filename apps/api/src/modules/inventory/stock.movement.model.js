import mongoose from 'mongoose'
import { StockMovementReasons } from '@shop/types'

const stockMovementSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true
    },
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    change: { type: Number, required: true },
    reason: {
      type: String,
      enum: Object.values(StockMovementReasons),
      required: true
    },
    referenceType: {
      type: String,
      enum: ['order', 'manual', 'return'],
      default: 'manual'
    },
    referenceId: { type: String, default: null },
    note: { type: String, trim: true, maxlength: 500, default: null },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  { timestamps: true, versionKey: false }
)

stockMovementSchema.index({ productId: 1, createdAt: -1 })
stockMovementSchema.index({ referenceType: 1, referenceId: 1 })

const StockMovement =
  mongoose.models.StockMovement || mongoose.model('StockMovement', stockMovementSchema)

export default StockMovement
