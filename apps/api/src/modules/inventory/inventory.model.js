import mongoose from 'mongoose'

const inventorySchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    // null row = the product-level (non-variant) pool; otherwise a specific variant
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    sku: { type: String, required: true, trim: true, maxlength: 80 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    reserved: { type: Number, required: true, min: 0, default: 0 }
  },
  { timestamps: true, versionKey: false }
)

inventorySchema.index(
  { productId: 1, variantId: 1 },
  { unique: true, partialFilterExpression: { variantId: { $type: 'objectId' } } }
)
inventorySchema.index(
  { productId: 1 },
  { unique: true, partialFilterExpression: { variantId: null } }
)
inventorySchema.index({ sku: 1 })

const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema)

export default Inventory
