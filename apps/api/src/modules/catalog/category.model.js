import mongoose from 'mongoose'
import { CategoryStatuses } from '@shop/types'

const categorySchema = new mongoose.Schema(
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
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null
    },
    // Ancestor chain (root first). Kept denormalised for cheap subtree queries.
    ancestors: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Category',
      default: []
    },
    description: { type: String, trim: true, maxlength: 2000, default: null },
    imageUrl: { type: String, trim: true, maxlength: 2048, default: null },
    status: {
      type: String,
      enum: Object.values(CategoryStatuses),
      default: CategoryStatuses.ACTIVE
    },
    seo: {
      title: { type: String, trim: true, maxlength: 160, default: null },
      description: { type: String, trim: true, maxlength: 320, default: null },
      keywords: { type: [String], default: [] }
    }
  },
  { timestamps: true, versionKey: false }
)

categorySchema.index({ parentId: 1, status: 1 })
categorySchema.index({ ancestors: 1, status: 1 })

export function toPublicCategory(category) {
  return {
    id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    parentId: category.parentId ? category.parentId.toString() : null,
    description: category.description,
    imageUrl: category.imageUrl,
    status: category.status,
    seo: category.seo ?? null,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt
  }
}

const Category = mongoose.models.Category || mongoose.model('Category', categorySchema)

export default Category
