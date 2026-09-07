import mongoose from 'mongoose'
import { BrandStatuses } from '@shop/types'

const brandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 160
    },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    logoUrl: { type: String, trim: true, maxlength: 2048, default: null },
    status: {
      type: String,
      enum: Object.values(BrandStatuses),
      default: BrandStatuses.ACTIVE
    },
    seo: {
      title: { type: String, trim: true, maxlength: 160, default: null },
      description: { type: String, trim: true, maxlength: 320, default: null }
    }
  },
  { timestamps: true, versionKey: false }
)

brandSchema.index({ status: 1, name: 1 })

export function toPublicBrand(brand) {
  return {
    id: brand._id.toString(),
    name: brand.name,
    slug: brand.slug,
    description: brand.description,
    logoUrl: brand.logoUrl,
    status: brand.status,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt
  }
}

const Brand = mongoose.models.Brand || mongoose.model('Brand', brandSchema)

export default Brand
