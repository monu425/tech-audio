import mongoose from 'mongoose'
import { CURRENCY, ProductStatuses, StockStatus } from '@shop/types'

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, trim: true, maxlength: 80 },
    options: { type: Map, of: String },
    priceMinor: { type: Number, min: 0, default: null },
    compareAtMinor: { type: Number, min: 0, default: null },
    stock: { type: Number, min: 0, default: 0 },
    reserved: { type: Number, min: 0, default: 0 },
    active: { type: Boolean, default: true }
  },
  { _id: true, versionKey: false }
)

variantSchema.index({ sku: 1 })

const attributeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    value: { type: String, required: true, trim: true, maxlength: 200 }
  },
  { _id: false }
)

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    alt: { type: String, trim: true, maxlength: 300, default: null }
  },
  { _id: false }
)

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 220
    },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 80 },
    shortDescription: { type: String, trim: true, maxlength: 500, default: null },
    description: { type: String, trim: true, maxlength: 50000, default: null },
    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Brand',
      default: null,
      index: true
    },
    // Full category path: root -> ... -> leaf.
    categoryIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Category',
      default: []
    },
    images: { type: [imageSchema], default: [] },
    priceMinor: { type: Number, required: true, min: 0 },
    compareAtMinor: { type: Number, min: 0, default: null },
    currency: { type: String, default: CURRENCY, uppercase: true, maxlength: 3 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    reserved: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    attributes: { type: [attributeSchema], default: [] },
    variants: { type: [variantSchema], default: [] },
    tags: { type: [String], default: [] },
    seo: {
      title: { type: String, trim: true, maxlength: 160, default: null },
      description: { type: String, trim: true, maxlength: 320, default: null },
      keywords: { type: [String], default: [] }
    },
    status: {
      type: String,
      enum: Object.values(ProductStatuses),
      default: ProductStatuses.DRAFT,
      index: true
    },
    featured: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 }
  },
  { timestamps: true, versionKey: false }
)

productSchema.index({ categoryIds: 1 })
productSchema.index({ status: 1, publishedAt: -1 })
productSchema.index({ status: 1, featured: 1, publishedAt: -1 })
productSchema.index({ status: 1, ratingAverage: -1 })
productSchema.index({ status: 1, priceMinor: 1 })
productSchema.index({ name: 1, sku: 1, shortDescription: 1, tags: 1 })

const Product = mongoose.models.Product || mongoose.model('Product', productSchema)

export function productBaseAvailableStock(product) {
  const activeVariants = product.variants?.filter((variant) => variant.active) ?? []
  if (activeVariants.length > 0) {
    return activeVariants.reduce((sum, variant) => sum + (variant.stock - variant.reserved), 0)
  }
  return product.stock - product.reserved
}

export function productStockStatus(available) {
  if (available <= 0) return StockStatus.OUT_OF_STOCK
  return StockStatus.IN_STOCK
}

export function variantAvailableStock(variant) {
  return variant.active ? variant.stock - variant.reserved : 0
}

export default Product
