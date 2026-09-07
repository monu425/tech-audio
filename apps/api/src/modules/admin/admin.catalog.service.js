import { ProductStatuses, ReviewStatuses } from '@shop/types'
import Product from '../catalog/product.model.js'
import Brand from '../catalog/brand.model.js'
import Category from '../catalog/category.model.js'
import User from '../auth/user.model.js'
import Coupon from '../coupon/coupon.model.js'
import Inventory from '../inventory/inventory.model.js'
import StockMovement from '../inventory/stock.movement.model.js'
import Review from '../reviews/review.model.js'
import {
  createProduct,
  updateProduct,
  slugify,
  getCategoryTree,
  createCategory,
  createBrand
} from '../catalog/catalog.service.js'
import { moderateReview, refreshProductRating } from '../reviews/review.service.js'
import { couponStatusLabel } from '../coupon/coupon.service.js'
import { adjustStock, escapeRegex } from '../inventory/stock.service.js'
import { BadRequestError, NotFoundError, ConflictError } from '../../utils/errors.js'

async function loadRelations() {
  const [brands, categories] = await Promise.all([Brand.find().lean(), Category.find().lean()])
  const brandById = new Map(brands.map((brand) => [brand._id.toString(), brand]))
  const categoryById = new Map(categories.map((category) => [category._id.toString(), category]))
  return { brandById, categoryById }
}

function computeVariantAvailability(raw) {
  return Math.max(0, raw.stock - (raw.reserved ?? 0))
}

function toAdminProductDto(raw, { brandById, categoryById }) {
  const leafCategoryId = raw.categoryIds?.length
    ? raw.categoryIds[raw.categoryIds.length - 1].toString()
    : null
  const brand = raw.brandId ? brandById.get(raw.brandId.toString()) : null
  const category = leafCategoryId ? categoryById.get(leafCategoryId) : null
  const doc = raw.toObject ? raw.toObject() : raw
  const variants = (doc.variants ?? []).map((variant) => ({
    id: variant._id.toString(),
    sku: variant.sku,
    options: variant.options ?? {},
    priceMinor: variant.priceMinor ?? null,
    compareAtMinor: variant.compareAtMinor ?? null,
    stock: variant.stock,
    reserved: variant.reserved ?? 0,
    available: computeVariantAvailability(variant),
    active: variant.active !== false
  }))
  const hasVariants = variants.length > 0
  const availableStock = hasVariants
    ? variants.reduce((sum, variant) => sum + variant.available, 0)
    : Math.max(0, doc.stock - (doc.reserved ?? 0))
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    sku: doc.sku,
    shortDescription: doc.shortDescription,
    description: doc.description,
    brand: brand ? { id: brand._id.toString(), name: brand.name } : null,
    category: category ? { id: category._id.toString(), name: category.name } : null,
    images: doc.images ?? [],
    priceMinor: doc.priceMinor,
    compareAtMinor: doc.compareAtMinor ?? null,
    currency: doc.currency,
    stock: doc.stock,
    reserved: doc.reserved ?? 0,
    availableStock,
    lowStockThreshold: doc.lowStockThreshold ?? 5,
    status: doc.status,
    featured: doc.featured,
    attributes: doc.attributes ?? [],
    tags: doc.tags ?? [],
    variants,
    publishedAt: doc.publishedAt ?? null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ratingAverage: doc.ratingAverage ?? 0,
    ratingCount: doc.ratingCount ?? 0
  }
}

const availabilityExpression = {
  $cond: [
    { $gt: [{ $size: { $filter: { input: '$variants', as: 'v', cond: '$$v.active' } } }, 0] },
    {
      $reduce: {
        input: { $filter: { input: '$variants', as: 'v', cond: '$$v.active' } },
        initialValue: 0,
        in: {
          $add: ['$$value', { $subtract: ['$$this.stock', { $ifNull: ['$$this.reserved', 0] }] }]
        }
      }
    },
    { $subtract: ['$stock', { $ifNull: ['$reserved', 0] }] }
  ]
}

export async function listProductsAdmin(query) {
  const { page, pageSize, q, status, brandId, categoryId, stockFilter } = query
  const match = {}
  if (status) match.status = status
  if (brandId) match.brandId = brandId
  if (categoryId) match.categoryIds = categoryId
  if (q) {
    const needle = escapeRegex(q.trim())
    match.$or = [
      { name: { $regex: needle, $options: 'i' } },
      { sku: { $regex: needle, $options: 'i' } },
      { shortDescription: { $regex: needle, $options: 'i' } },
      { tags: { $regex: needle, $options: 'i' } }
    ]
  }

  const stockMatches = {
    in_stock: { $gt: [availabilityExpression, 0] },
    out_of_stock: { $lte: [availabilityExpression, 0] },
    low_stock: {
      $and: [
        { $lte: [availabilityExpression, { $ifNull: ['$lowStockThreshold', 5] }] },
        { $gt: [availabilityExpression, 0] }
      ]
    }
  }

  const [statusRows, facet] = await Promise.all([
    Product.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Product.aggregate([
      { $match: match },
      { $addFields: { __availability: availabilityExpression } },
      ...(stockFilter && stockFilter !== 'all' && stockMatches[stockFilter]
        ? [{ $match: { $expr: stockMatches[stockFilter] } }]
        : []),
      {
        $facet: {
          total: [{ $count: 'count' }],
          items: [
            { $sort: { updatedAt: -1, createdAt: -1 } },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize }
          ]
        }
      }
    ])
  ])

  const { brandById, categoryById } = await loadRelations()
  const totalItems = facet[0]?.total[0]?.count ?? 0
  const statusCounts = { draft: 0, published: 0, archived: 0 }
  for (const row of statusRows) statusCounts[row._id] = row.count

  return {
    items: (facet[0]?.items ?? []).map((raw) =>
      toAdminProductDto(raw, { brandById, categoryById })
    ),
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      statusCounts
    }
  }
}

export async function getProductAdmin(productId) {
  const product = await Product.findById(productId)
  if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')
  const { brandById, categoryById } = await loadRelations()
  return toAdminProductDto(product, { brandById, categoryById })
}

export async function getProductFormMeta() {
  const [brands, categories] = await Promise.all([
    Brand.find().sort({ name: 1 }).lean(),
    getCategoryTree(false)
  ])
  const flatten = (nodes, level = 0) =>
    nodes.flatMap((node) => [
      { id: node.id, name: node.name, slug: node.slug, level },
      ...flatten(node.children ?? [], level + 1)
    ])
  return {
    brands: brands.map((brand) => ({
      id: brand._id.toString(),
      name: brand.name,
      slug: brand.slug,
      status: brand.status
    })),
    categories: flatten(categories),
    statuses: Object.values(ProductStatuses),
    currencies: ['USD']
  }
}

export async function createProductAdmin(data) {
  const cleaned = { ...data }
  const product = await createProduct(cleaned)
  return getProductAdmin(product.id)
}

export async function updateProductAdmin(productId, data) {
  const existing = await Product.findById(productId)
  if (!existing) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')
  const cleaned = { ...data }
  if (cleaned.variants) {
    cleaned.variants = cleaned.variants.map((variant) => ({ ...variant, reserved: 0 }))
  }
  await updateProduct(productId, cleaned)
  return getProductAdmin(productId)
}

export async function archiveProductAdmin(productId, _actor) {
  const product = await Product.findById(productId)
  if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')
  if (product.status === ProductStatuses.ARCHIVED) {
    throw new BadRequestError('Product is already archived', 'PRODUCT_ALREADY_ARCHIVED')
  }
  product.status = ProductStatuses.ARCHIVED
  product.publishedAt = null
  await product.save()
  return getProductAdmin(productId)
}

export async function getProductInventory(productId) {
  const product = await Product.findById(productId)
  if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')
  const [rows, movements] = await Promise.all([
    Inventory.find({ productId }).sort({ sku: 1 }).lean(),
    StockMovement.find({ productId }).sort({ createdAt: -1 }).limit(100).lean()
  ])

  const doc = product.toObject()
  const hasVariants = (doc.variants ?? []).length > 0
  const variantRows = hasVariants
    ? (doc.variants ?? []).map((variant) => ({
        variantId: variant._id.toString(),
        label: Object.entries(variant.options ?? {})
          .map(([key, value]) => `${key}: ${value}`)
          .join(', '),
        sku: variant.sku
      }))
    : []

  const rowsByKey = new Map()
  for (const row of rows) {
    rowsByKey.set(row.variantId ? row.variantId.toString() : 'base', row)
  }

  const displayRows = hasVariants
    ? variantRows.map((entry) => {
        const row = rowsByKey.get(entry.variantId)
        const variant = (doc.variants ?? []).find((item) => item._id.toString() === entry.variantId)
        return {
          id: row?._id.toString() ?? null,
          variantId: entry.variantId,
          label: entry.label || 'Default',
          sku: entry.sku,
          stock: row?.stock ?? variant?.stock ?? 0,
          reserved: row?.reserved ?? variant?.reserved ?? 0,
          available: (row?.stock ?? variant?.stock ?? 0) - (row?.reserved ?? variant?.reserved ?? 0)
        }
      })
    : [
        {
          id: rowsByKey.get('base')?._id.toString() ?? null,
          variantId: null,
          label: 'Default',
          sku: doc.sku,
          stock: rowsByKey.get('base')?.stock ?? doc.stock ?? 0,
          reserved: rowsByKey.get('base')?.reserved ?? doc.reserved ?? 0,
          available:
            (rowsByKey.get('base')?.stock ?? doc.stock ?? 0) -
            (rowsByKey.get('base')?.reserved ?? doc.reserved ?? 0)
        }
      ]

  const userIds = movements.map((movement) => movement.actorUserId?.toString()).filter(Boolean)
  let actorNames = new Map()
  if (userIds.length > 0) {
    const users = await User.find({ _id: { $in: userIds } })
      .select('name')
      .lean()
    actorNames = new Map(users.map((user) => [user._id.toString(), user.name]))
  }

  return {
    product: {
      id: product._id.toString(),
      name: product.name,
      sku: product.sku,
      hasVariants
    },
    rows: displayRows,
    movements: movements.map((movement) => ({
      id: movement._id.toString(),
      change: movement.change,
      reason: movement.reason,
      note: movement.note,
      referenceType: movement.referenceType,
      referenceId: movement.referenceId,
      sku: rowsByKey.get(movement.variantId ? movement.variantId.toString() : 'base')?.sku ?? null,
      actorName: movement.actorUserId
        ? (actorNames.get(movement.actorUserId.toString()) ?? null)
        : null,
      createdAt: movement.createdAt
    }))
  }
}

export async function adjustProductStock(productId, payload, actor) {
  const product = await Product.findById(productId)
  if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')

  const row = await Inventory.findOne({ productId, variantId: payload.variantId ?? null }).lean()
  const doc = product.toObject()
  let currentStock
  if (payload.variantId) {
    const variant = (doc.variants ?? []).find(
      (item) => item._id.toString() === payload.variantId.toString()
    )
    if (!variant) throw new BadRequestError('Variant not found', 'VARIANT_NOT_FOUND')
    currentStock = row?.stock ?? variant.stock ?? 0
  } else {
    currentStock = row?.stock ?? doc.stock ?? 0
  }
  if (currentStock + payload.delta < 0) {
    throw new BadRequestError('Adjustment cannot take stock below zero', 'INSUFFICIENT_STOCK')
  }

  await adjustStock(productId, {
    variantId: payload.variantId,
    delta: payload.delta,
    reason: payload.reason,
    note: payload.note,
    actorUserId: actor._id
  })
  return getProductInventory(productId)
}

export async function listCategoriesAdmin() {
  const [categories, productRows] = await Promise.all([
    Category.find().sort({ name: 1 }).lean(),
    Product.aggregate([
      { $unwind: '$categoryIds' },
      { $group: { _id: '$categoryIds', products: { $sum: 1 } } }
    ])
  ])
  const countsById = new Map(productRows.map((row) => [row._id.toString(), row.products]))
  return {
    items: categories.map((category) => ({
      id: category._id.toString(),
      name: category.name,
      slug: category.slug,
      parentId: category.parentId?.toString() ?? null,
      description: category.description,
      imageUrl: category.imageUrl,
      status: category.status,
      seo: category.seo ?? {},
      productsCount: countsById.get(category._id.toString()) ?? 0,
      createdAt: category.createdAt
    }))
  }
}

export async function createCategoryAdmin(data) {
  const category = await createCategory(data)
  return { id: category.id, name: category.name, slug: category.slug }
}

export async function updateCategoryAdmin(categoryId, data) {
  const category = await Category.findById(categoryId)
  if (!category) throw new NotFoundError('Category not found', 'CATEGORY_NOT_FOUND')

  if (data.name !== undefined && data.name !== category.name) {
    const nextSlug = slugify(data.slug ?? data.name)
    const duplicate = await Category.findOne({ slug: nextSlug, _id: { $ne: categoryId } }).lean()
    if (duplicate) throw new ConflictError('Category slug already exists', 'SLUG_TAKEN')
    category.name = data.name
    if (data.slug === undefined) category.slug = nextSlug
  } else if (data.slug !== undefined) {
    const nextSlug = slugify(data.slug)
    const duplicate = await Category.findOne({ slug: nextSlug, _id: { $ne: categoryId } }).lean()
    if (duplicate) throw new ConflictError('Category slug already exists', 'SLUG_TAKEN')
    category.slug = nextSlug
  }

  const fields = ['description', 'imageUrl', 'status', 'seo']
  for (const field of fields) {
    if (data[field] !== undefined) category[field] = data[field]
  }
  await category.save()
  const updated = await Category.findById(categoryId).lean()
  return {
    id: updated._id.toString(),
    name: updated.name,
    slug: updated.slug,
    status: updated.status
  }
}

export async function archiveCategoryAdmin(categoryId) {
  const category = await Category.findById(categoryId)
  if (!category) throw new NotFoundError('Category not found', 'CATEGORY_NOT_FOUND')
  if (category.status === 'inactive') {
    throw new BadRequestError('Category is already inactive', 'CATEGORY_ALREADY_INACTIVE')
  }
  category.status = 'inactive'
  await category.save()
  return { id: category._id.toString(), status: category.status }
}

export async function listBrandsAdmin() {
  const brands = await Brand.find().sort({ name: 1 }).lean()
  return {
    items: brands.map((brand) => ({
      id: brand._id.toString(),
      name: brand.name,
      slug: brand.slug,
      description: brand.description,
      logoUrl: brand.logoUrl,
      status: brand.status,
      seo: brand.seo ?? {},
      createdAt: brand.createdAt
    }))
  }
}

export async function createBrandAdmin(data) {
  const brand = await createBrand(data)
  return { id: brand.id, name: brand.name, slug: brand.slug }
}

export async function updateBrandAdmin(brandId, data) {
  const brand = await Brand.findById(brandId)
  if (!brand) throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND')

  if (data.name !== undefined && data.name !== brand.name) {
    const nextSlug = slugify(data.slug ?? data.name)
    const duplicate = await Brand.findOne({ slug: nextSlug, _id: { $ne: brandId } }).lean()
    if (duplicate) throw new ConflictError('Brand slug already exists', 'SLUG_TAKEN')
    brand.name = data.name
    if (data.slug === undefined) brand.slug = nextSlug
  } else if (data.slug !== undefined) {
    const nextSlug = slugify(data.slug)
    const duplicate = await Brand.findOne({ slug: nextSlug, _id: { $ne: brandId } }).lean()
    if (duplicate) throw new ConflictError('Brand slug already exists', 'SLUG_TAKEN')
    brand.slug = nextSlug
  }

  const fields = ['description', 'logoUrl', 'status', 'seo']
  for (const field of fields) {
    if (data[field] !== undefined) brand[field] = data[field]
  }
  await brand.save()
  const updated = await Brand.findById(brandId).lean()
  return {
    id: updated._id.toString(),
    name: updated.name,
    slug: updated.slug,
    status: updated.status
  }
}

export async function archiveBrandAdmin(brandId) {
  const brand = await Brand.findById(brandId)
  if (!brand) throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND')
  if (brand.status === 'inactive') {
    throw new BadRequestError('Brand is already inactive', 'BRAND_ALREADY_INACTIVE')
  }
  brand.status = 'inactive'
  await brand.save()
  return { id: brand._id.toString(), status: brand.status }
}

const COUPON_FIELDS = [
  'type',
  'value',
  'minSubtotalMinor',
  'maxDiscountMinor',
  'currency',
  'startsAt',
  'expiresAt',
  'usageLimit',
  'perUserLimit',
  'enabled'
]

function toCouponDto(coupon) {
  const doc = coupon.toObject ? coupon.toObject() : coupon
  return {
    id: doc._id.toString(),
    code: doc.code,
    type: doc.type,
    value: doc.value,
    minSubtotalMinor: doc.minSubtotalMinor ?? 0,
    maxDiscountMinor: doc.maxDiscountMinor ?? null,
    currency: doc.currency,
    startsAt: doc.startsAt ?? null,
    expiresAt: doc.expiresAt ?? null,
    usageLimit: doc.usageLimit ?? null,
    usedCount: doc.usedCount ?? 0,
    perUserLimit: doc.perUserLimit ?? null,
    enabled: doc.enabled ?? true,
    statusLabel: couponStatusLabel(doc),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  }
}

export async function listCouponsAdmin(query) {
  const { page, pageSize, q, statusFilter } = query
  const filter = {}
  if (q) {
    const needle = escapeRegex(q.trim())
    filter.code = { $regex: needle, $options: 'i' }
  }
  const coupons = await Coupon.find(filter).sort({ createdAt: -1 }).lean()
  const status = statusFilter || 'all'
  const filtered =
    status === 'all' ? coupons : coupons.filter((c) => couponStatusLabel(c) === status)
  const totalItems = filtered.length
  const start = (page - 1) * pageSize
  return {
    items: filtered.slice(start, start + pageSize).map((coupon) => toCouponDto(coupon)),
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      statusCounts: await countCouponStatuses()
    }
  }
}

async function countCouponStatuses() {
  const coupons = await Coupon.find().lean()
  const counts = { active: 0, inactive: 0, expired: 0 }
  for (const coupon of coupons) counts[couponStatusLabel(coupon)] += 1
  return counts
}

export async function getCouponAdmin(couponId) {
  const coupon = await Coupon.findById(couponId)
  if (!coupon) throw new NotFoundError('Coupon not found', 'COUPON_NOT_FOUND')
  return toCouponDto(coupon)
}

export async function createCouponAdmin(data) {
  const code = String(data.code).trim().toUpperCase()
  const existing = await Coupon.findOne({ code })
  if (existing) throw new ConflictError('Coupon code already exists', 'COUPON_EXISTS')
  const coupon = await Coupon.create({
    code,
    type: data.type,
    value: data.value,
    minSubtotalMinor: data.minSubtotalMinor ?? 0,
    maxDiscountMinor: data.maxDiscountMinor ?? null,
    currency: data.currency ?? 'USD',
    startsAt: data.startsAt ?? null,
    expiresAt: data.expiresAt ?? null,
    usageLimit: data.usageLimit ?? null,
    perUserLimit: data.perUserLimit ?? null,
    enabled: data.enabled ?? true
  })
  return toCouponDto(coupon)
}

export async function updateCouponAdmin(couponId, data) {
  const coupon = await Coupon.findById(couponId)
  if (!coupon) throw new NotFoundError('Coupon not found', 'COUPON_NOT_FOUND')
  for (const field of COUPON_FIELDS) {
    if (data[field] !== undefined) coupon[field] = data[field]
  }
  await coupon.save()
  return toCouponDto(coupon)
}

export async function toggleCouponAdmin(couponId) {
  const coupon = await Coupon.findById(couponId)
  if (!coupon) throw new NotFoundError('Coupon not found', 'COUPON_NOT_FOUND')
  coupon.enabled = !coupon.enabled
  await coupon.save()
  return toCouponDto(coupon)
}

export async function listReviewsAdmin(query) {
  const { page, pageSize, q, status } = query
  const filter = {}
  if (status) filter.status = status
  if (q) {
    const needle = escapeRegex(q.trim())
    const [products, users] = await Promise.all([
      Product.find({ name: { $regex: needle, $options: 'i' } })
        .select('_id')
        .lean(),
      User.find({ name: { $regex: needle, $options: 'i' } })
        .select('_id')
        .lean()
    ])
    const productIds = products.map((product) => product._id)
    const userIds = users.map((user) => user._id)
    filter.$or = [
      { title: { $regex: needle, $options: 'i' } },
      { body: { $regex: needle, $options: 'i' } }
    ]
    if (productIds.length > 0) filter.$or.push({ product: { $in: productIds } })
    if (userIds.length > 0) filter.$or.push({ user: { $in: userIds } })
  }

  const [reviews, totalItems] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Review.countDocuments(filter)
  ])
  const [productMap, userMap] = await Promise.all([
    loadByIdMap(
      Product,
      reviews.map((review) => review.product),
      'name images status'
    ),
    loadByIdMap(
      User,
      reviews.map((review) => review.user),
      'name email'
    )
  ])

  const statusCountFilter = { ...filter }
  delete statusCountFilter.status
  const statusRows = await Review.aggregate([
    { $match: statusCountFilter },
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ])
  const statusCounts = { pending: 0, approved: 0, rejected: 0 }
  for (const row of statusRows) statusCounts[row._id] = row.count

  return {
    items: reviews.map((review) => ({
      id: review._id.toString(),
      rating: review.rating,
      title: review.title,
      body: review.body,
      images: review.images ?? [],
      status: review.status,
      verifiedPurchase: review.verifiedPurchase,
      helpfulCount: review.helpfulCount,
      product: productMap.get(review.product.toString())
        ? {
            id: review.product.toString(),
            name: productMap.get(review.product.toString()).name,
            imageUrl: productMap.get(review.product.toString()).images?.[0]?.url ?? null,
            status: productMap.get(review.product.toString()).status
          }
        : null,
      user: userMap.get(review.user.toString())
        ? { id: review.user.toString(), name: userMap.get(review.user.toString()).name }
        : null,
      createdAt: review.createdAt
    })),
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      statusCounts
    }
  }
}

export async function moderateReviewAdmin(reviewId, payload) {
  return moderateReview({ reviewId, status: payload.status })
}

export async function rejectReviewAdmin(reviewId) {
  const review = await Review.findById(reviewId)
  if (!review) throw new NotFoundError('Review not found', 'REVIEW_NOT_FOUND')
  review.status = ReviewStatuses.REJECTED
  await review.save()
  await refreshProductRating(review.product)
  return { id: review._id.toString(), status: ReviewStatuses.REJECTED }
}

async function loadByIdMap(Model, ids, fields) {
  const cleanIds = [...new Set(ids.map((id) => id?.toString()).filter(Boolean))]
  const docs =
    cleanIds.length > 0
      ? await Model.find({ _id: { $in: cleanIds } })
          .select(fields)
          .lean()
      : []
  return new Map(docs.map((doc) => [doc._id.toString(), doc]))
}
