import mongoose from 'mongoose'

const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    items: {
      type: [
        {
          productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Product',
            required: true
          },
          addedAt: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { timestamps: true, versionKey: false }
)

wishlistSchema.index({ 'items.productId': 1 })

const Wishlist = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema)

export default Wishlist
