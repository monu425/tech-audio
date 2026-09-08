import mongoose from 'mongoose'

const cartItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    variantId: { type: mongoose.Schema.Types.ObjectId, default: null },
    quantity: { type: Number, required: true, min: 1, max: 99 }
  },
  { _id: true, versionKey: false }
)

const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    guestTokenHash: {
      type: String,
      select: false
    },
    items: { type: [cartItemSchema], default: [] },
    couponCode: { type: String, trim: true, uppercase: true, maxlength: 40, default: null },
    processingAt: { type: Date, default: null },
    expiresAt: { type: Date, default: null }
  },
  { timestamps: true, versionKey: false }
)

cartSchema.index(
  { guestTokenHash: 1 },
  {
    unique: true,
    partialFilterExpression: { guestTokenHash: { $type: 'string' } },
    name: 'guest_token_uniq'
  }
)
cartSchema.index({ updatedAt: 1 })
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, sparse: true })

const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema)

export default Cart
