import { escapeRegex } from '../inventory/stock.service.js'
import { ConflictError, NotFoundError } from '../../utils/errors.js'
import { ProductStatuses, StockStatus } from '@shop/types'
import { Types } from 'mongoose'
import Product, { productBaseAvailableStock } from './product.model.js'
import Brand, { toPublicBrand } from './brand.model.js'
import Category, { toPublicCategory } from './category.model.js'

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 200)
}

async function ensureUniqueSlug(Model, slug, excludeId, fieldMessage = 'Slug already exists') {
  const filter = { slug }
  if (excludeId) filter._id = { $ne: excludeId }
  if (await Model.findOne(filter)) throw new ConflictError(fieldMessage, 'SLUG_TAKEN')
  return slug
}

export function normalizeSkuValue(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase()
}

/**
 * Ensures none of the given SKUs (product-level or variant-level) is already
 * used by another product in the catalog, and that there are no duplicates
 * within the supplied set.
 */
export async function assertSkuAvailable(skus, excludeId = null) {
  const needles = [...new Set(skus.map(normalizeSkuValue).filter(Boolean))]
  if (needles.length === 0) return

  const seen = new Set()
  for (const sku of needles) {
    if (seen.has(sku)) {
      throw new ConflictError(`SKU ${sku} is already in use`, 'SKU_EXISTS')
    }
    seen.add(sku)
  }

  const filter = excludeId ? { _id: { $ne: excludeId } } : {}
  const found = await Product.findOne({
    ...filter,
    $or: needles.flatMap((sku) => [{ sku }, { 'variants.sku': sku }])
  })
    .select('_id sku variants.sku')
    .lean()
  if (!found) return

  const taken = needles.find(
    (sku) => found.sku === sku || (found.variants ?? []).some((variant) => variant.sku === sku)
  )
  throw new ConflictError(`SKU ${taken} is already in use`, 'SKU_EXISTS')
}

function normalizeOptions(options) {
  const out = {}
  for (const [key, value] of Object.entries(options ?? {})) {
    const cleanKey = String(key).trim()
    if (cleanKey) out[cleanKey] = String(value).trim()
  }
  return out
}

function normalizeVariants(variants) {
  return (variants ?? []).map((variant) => ({
    sku: variant.sku,
    options: normalizeOptions(variant.options),
    priceMinor: variant.priceMinor ?? null,
    compareAtMinor: variant.compareAtMinor ?? null,
    stock: Math.max(0, Math.round(variant.stock ?? 0)),
    reserved: 0,
    active: variant.active !== false
  }))
}

function setCategoryPath(product, category) {
  product.categoryIds = []
  if (category) {
    product.categoryIds = [...(category.ancestors ?? []), category._id]
  }
}

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export async function listBrandsPublic() {
  const brands = await Brand.find({ status: 'active' }).sort({ name: 1 }).lean()
  return { items: brands.map(toPublicBrand), meta: { totalItems: brands.length } }
}

export async function getBrandBySlug(slug) {
  const brand = await Brand.findOne({ slug, status: 'active' }).lean()
  if (!brand) throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND')
  return toPublicBrand(brand)
}

export async function createBrand(data) {
  const slug = await ensureUniqueSlug(Brand, slugify(data.slug ?? data.name))
  const brand = await Brand.create({ ...data, slug, seo: data.seo ?? {} })
  return toPublicBrand(brand)
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategoriesPublic() {
  const categories = await Category.find({ status: 'active' }).sort({ name: 1 }).lean()
  return { items: categories.map(toPublicCategory) }
}

export async function getCategoryTree(activeOnly = true) {
  const filter = activeOnly ? { status: 'active' } : {}
  const categories = await Category.find(filter).sort({ name: 1 }).lean()
  const nodes = new Map()
  for (const category of categories) {
    nodes.set(category._id.toString(), {
      ...toPublicCategory(category),
      children: []
    })
  }
  const roots = []
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId).children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

async function resolveCategoryForSlug(slug) {
  const category = await Category.findOne({ slug, status: 'active' }).lean()
  if (!category) throw new NotFoundError('Category not found', 'CATEGORY_NOT_FOUND')
  return category
}

export async function getCategoryBySlugPublic(slug) {
  const category = await resolveCategoryForSlug(slug)
  const ancestors = await Category.find({ _id: { $in: category.ancestors ?? [] } }).lean()
  const breadcrumb = [...ancestors, category]
    .sort(
      (a, b) =>
        (category.ancestors ?? []).indexOf(a._id) - (category.ancestors ?? []).indexOf(b._id)
    )
    .map((item) => ({ id: item._id.toString(), name: item.name, slug: item.slug }))
  return { category: toPublicCategory(category), breadcrumb }
}

export async function createCategory(data) {
  const slug = await ensureUniqueSlug(Category, slugify(data.slug ?? data.name))
  let ancestors = []
  if (data.parentId) {
    const parent = await Category.findById(data.parentId).lean()
    if (!parent) throw new NotFoundError('Parent category not found', 'PARENT_NOT_FOUND')
    ancestors = [...(parent.ancestors ?? []), parent._id]
  }
  const category = await Category.create({
    name: data.name,
    slug,
    parentId: data.parentId ?? null,
    ancestors,
    description: data.description ?? null,
    imageUrl: data.imageUrl ?? null,
    status: data.status ?? 'active',
    seo: data.seo ?? {}
  })
  return toPublicCategory(category)
}

// ---------------------------------------------------------------------------
// Product write helpers (seed + admin reuse)
// ---------------------------------------------------------------------------

function computePublishedAt(status, current) {
  if (status === ProductStatuses.PUBLISHED && !current) return new Date()
  if (status !== ProductStatuses.PUBLISHED && status === ProductStatuses.DRAFT) return null
  return current ?? null
}

export async function createProduct(data) {
  const slug = await ensureUniqueSlug(
    Product,
    slugify(data.slug ?? data.name),
    null,
    'Product slug already exists'
  )
  const category = data.categoryId ? await Category.findById(data.categoryId).lean() : null
  if (data.categoryId && !category)
    throw new NotFoundError('Category not found', 'CATEGORY_NOT_FOUND')
  if (data.brandId && !(await Brand.findById(data.brandId).lean())) {
    throw new NotFoundError('Brand not found', 'BRAND_NOT_FOUND')
  }
  const sku = normalizeSkuValue(data.sku)
  const variants = normalizeVariants(data.variants)
  await assertSkuAvailable([sku, ...variants.map((variant) => variant.sku)])
  const product = await Product.create({
    name: data.name,
    slug,
    sku,
    shortDescription: data.shortDescription ?? null,
    description: data.description ?? null,
    brandId: data.brandId ?? null,
    categoryIds: [],
    images: data.images ?? [],
    priceMinor: data.priceMinor,
    compareAtMinor: data.compareAtMinor ?? null,
    currency: data.currency ?? 'USD',
    stock: Math.max(0, Math.round(data.stock ?? 0)),
    reserved: 0,
    lowStockThreshold: data.lowStockThreshold ?? 5,
    attributes: data.attributes ?? [],
    variants,
    tags: data.tags ?? [],
    seo: data.seo ?? {},
    status: data.status ?? ProductStatuses.DRAFT,
    featured: data.featured ?? false,
    publishedAt: computePublishedAt(data.status, null)
  })
  if (category) {
    product.categoryIds = [...(category.ancestors ?? []), category._id]
    await product.save()
  }
  return toProductDoc(product)
}

export async function updateProduct(id, data) {
  const existing = await Product.findById(id)
  if (!existing) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')
  if (data.slug || data.name) {
    const slug = slugify(data.slug ?? data.name)
    await ensureUniqueSlug(Product, slug, id, 'Product slug already exists')
    existing.slug = slug
  }
  const category = data.categoryId ? await Category.findById(data.categoryId).lean() : null
  if (data.categoryId && !category)
    throw new NotFoundError('Category not found', 'CATEGORY_NOT_FOUND')

  const nextStatus = data.status ?? existing.status
  existing.publishedAt = computePublishedAt(nextStatus, existing.publishedAt)
  if (data.status) existing.status = data.status
  if (category) setCategoryPath(existing, category)

  const fields = [
    'name',
    'sku',
    'shortDescription',
    'description',
    'brandId',
    'images',
    'priceMinor',
    'compareAtMinor',
    'currency',
    'stock',
    'lowStockThreshold',
    'attributes',
    'tags',
    'seo',
    'featured'
  ]
  for (const field of fields) {
    if (data[field] !== undefined) existing[field] = data[field]
  }
  if (data.variants !== undefined) {
    const prevBySku = new Map(existing.variants.map((variant) => [variant.sku, variant]))
    existing.variants = normalizeVariants(data.variants).map((variant) => {
      const prev = prevBySku.get(variant.sku)
      if (prev && prev.reserved > 0) {
        return { ...variant, reserved: prev.reserved }
      }
      return variant
    })
  }
  if (typeof data.stock === 'number') {
    existing.stock = Math.max(0, Math.round(data.stock))
    if (existing.reserved > existing.stock) existing.reserved = existing.stock
  }
  if (typeof data.sku === 'string') existing.sku = normalizeSkuValue(data.sku)

  const candidateSkus = [existing.sku, ...(existing.variants ?? []).map((variant) => variant.sku)]
  await assertSkuAvailable(candidateSkus, existing.id)
  await existing.save()
  return toProductDoc(existing)
}

export function toProductDoc(product) {
  const doc = product.toObject ? product.toObject() : product
  return { ...doc, id: doc._id.toString() }
}

// ---------------------------------------------------------------------------
// Public catalogue reads
// ---------------------------------------------------------------------------

function publicStockStatus(available, threshold) {
  if (available <= 0) return StockStatus.OUT_OF_STOCK
  if (threshold && available <= threshold) return StockStatus.LOW_STOCK
  return StockStatus.IN_STOCK
}

function discountPercent(priceMinor, compareAtMinor) {
  if (!compareAtMinor || compareAtMinor <= priceMinor) return null
  return Math.round(((compareAtMinor - priceMinor) / compareAtMinor) * 100)
}

async function loadCatalogMaps() {
  const [brands, categories] = await Promise.all([Brand.find().lean(), Category.find().lean()])
  const brandById = new Map(brands.map((brand) => [brand._id.toString(), brand]))
  const categoryById = new Map(categories.map((category) => [category._id.toString(), category]))
  return { brandById, categoryById }
}

function enrichSummary(raw, { brandById, categoryById }) {
  const leafCategoryId = raw.categoryIds?.length
    ? raw.categoryIds[raw.categoryIds.length - 1].toString()
    : null
  const brand = raw.brandId ? brandById.get(raw.brandId.toString()) : null
  const category = leafCategoryId ? categoryById.get(leafCategoryId) : null
  const available = productBaseAvailableStock(raw)
  const firstImage = raw.images?.[0] ?? null
  return {
    id: raw._id.toString(),
    name: raw.name,
    slug: raw.slug,
    sku: raw.sku,
    brand: brand ? { id: brand._id.toString(), name: brand.name, slug: brand.slug } : null,
    category: category
      ? { id: category._id.toString(), name: category.name, slug: category.slug }
      : null,
    shortDescription: raw.shortDescription,
    image: firstImage,
    priceMinor: raw.priceMinor,
    compareAtMinor: raw.compareAtMinor ?? null,
    currency: raw.currency,
    availableStock: available,
    stockStatus: publicStockStatus(available, raw.lowStockThreshold),
    ratingAverage: raw.ratingCount > 0 ? raw.ratingAverage : null,
    reviewCount: raw.ratingCount ?? 0,
    status: raw.status,
    featured: raw.featured ?? false,
    publishedAt: raw.publishedAt ?? null,
    discountPercent: discountPercent(raw.priceMinor, raw.compareAtMinor)
  }
}

const SORT_MAP = {
  newest: { publishedAt: -1 },
  price_asc: { priceMinor: 1 },
  price_desc: { priceMinor: -1 },
  rating: { ratingAverage: -1, ratingCount: -1 },
  popular: { ratingCount: -1, publishedAt: -1 },
  relevance: { createdAt: -1 }
}

async function buildProductMatch(
  query,
  { brandBySlug, categoryBySlug, activeBrandIds, activeCategoryIds }
) {
  const match = {
    status: ProductStatuses.PUBLISHED,
    publishedAt: { $ne: null }
  }

  if (query.brand) {
    const brand = brandBySlug.get(query.brand) ?? null
    if (!brand || brand.status !== 'active') return null
    match.brandId = brand._id
  }
  if (query.category) {
    const category = categoryBySlug.get(query.category) ?? null
    if (!category || category.status !== 'active') return null
    // Products persist their full category path [root,...,leaf]. Membership of
    // the requested category therefore captures the whole subtree (the category
    // itself and its descendants) while excluding sibling branches that merely
    // share one of this category's ancestors.
    match.categoryIds = category._id
  }
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    match.priceMinor = {}
    if (query.minPrice !== undefined) match.priceMinor.$gte = query.minPrice
    if (query.maxPrice !== undefined) match.priceMinor.$lte = query.maxPrice
  }

  const availabilityExpr = {
    $cond: [
      { $gt: [{ $size: { $filter: { input: '$variants', as: 'v', cond: '$$v.active' } } }, 0] },
      {
        $reduce: {
          input: { $filter: { input: '$variants', as: 'v', cond: '$$v.active' } },
          initialValue: 0,
          in: { $add: ['$$value', { $subtract: ['$$this.stock', '$$this.reserved'] }] }
        }
      },
      { $subtract: ['$stock', '$reserved'] }
    ]
  }

  if (query.inStock !== undefined) {
    if (query.inStock) match.$expr = { $gt: [availabilityExpr, 0] }
    else match.$expr = { $lte: [availabilityExpr, 0] }
  }
  if (query.onSale !== undefined) {
    const onSaleExpr = {
      $and: [
        { $gt: ['$compareAtMinor', 0] },
        { $gt: [{ $subtract: ['$compareAtMinor', '$priceMinor'] }, 0] }
      ]
    }
    if (match.$expr) match.$expr.$and = [...(match.$expr.$and ?? [match.$expr]), onSaleExpr]
    else match.$expr = onSaleExpr
  }

  if (query.q) {
    const needle = escapeRegex(query.q)
    const orClauses = []
    if (!query.brand && activeBrandIds.length > 0) {
      orClauses.push({ brandId: { $in: activeBrandIds } })
    }
    if (!query.category && activeCategoryIds.length > 0) {
      orClauses.push({ categoryIds: { $in: activeCategoryIds } })
    }
    orClauses.push(
      { name: { $regex: needle, $options: 'i' } },
      { sku: { $regex: needle, $options: 'i' } },
      { shortDescription: { $regex: needle, $options: 'i' } },
      { tags: { $regex: needle, $options: 'i' } },
      { 'attributes.value': { $regex: needle, $options: 'i' } }
    )
    if (match.$expr) {
      match.$and = [{ $expr: match.$expr }, { $or: orClauses }]
      delete match.$expr
    } else {
      match.$or = orClauses
    }
  }
  return match
}

export async function listProductsPublic(query) {
  const { brandById, categoryById } = await loadCatalogMaps()
  const brandBySlug = new Map([...brandById.values()].map((brand) => [brand.slug, brand]))
  const categoryBySlug = new Map(
    [...categoryById.values()].map((category) => [category.slug, category])
  )

  // Resolve search-time brand/category name matches into ids for union matches.
  let searchBrandIds = []
  let searchCategoryIds = []
  if (query.q) {
    const needle = escapeRegex(query.q)
    const [brandHits, categoryHits] = await Promise.all([
      Brand.find({ name: { $regex: needle, $options: 'i' }, status: 'active' })
        .select('_id')
        .lean(),
      Category.find({ name: { $regex: needle, $options: 'i' }, status: 'active' }).lean()
    ])
    searchBrandIds = brandHits.map((b) => b._id)
    searchCategoryIds = categoryHits.flatMap((category) => [
      category._id,
      ...(category.ancestors ?? [])
    ])
  }

  const match = await buildProductMatch(
    { ...query, q: query.q },
    {
      brandBySlug,
      categoryBySlug,
      activeBrandIds: query.brand ? [] : searchBrandIds,
      activeCategoryIds: query.category ? [] : searchCategoryIds
    }
  )
  if (!match)
    return {
      items: [],
      meta: { page: query.page, pageSize: query.pageSize, totalItems: 0, totalPages: 0 },
      facets: emptyFacets()
    }

  const sort = SORT_MAP[query.sort] ?? SORT_MAP.relevance

  const [result, totalCount] = await Promise.all([
    Product.aggregate([
      { $match: match },
      { $sort: sort },
      { $skip: (query.page - 1) * query.pageSize },
      { $limit: query.pageSize },
      {
        $project: {
          _id: 1,
          name: 1,
          slug: 1,
          sku: 1,
          brandId: 1,
          categoryIds: 1,
          shortDescription: 1,
          images: 1,
          priceMinor: 1,
          compareAtMinor: 1,
          currency: 1,
          stock: 1,
          reserved: 1,
          lowStockThreshold: 1,
          variants: 1,
          status: 1,
          featured: 1,
          publishedAt: 1,
          ratingAverage: 1,
          ratingCount: 1
        }
      }
    ]),
    Product.countDocuments(match)
  ])

  const items = result.map((raw) => enrichSummary(raw, { brandById, categoryById }))

  const facets = await computeFacets(match, {
    brandById,
    categoryById,
    minPrice: query.minPrice,
    maxPrice: query.maxPrice
  })

  const totalPages = Math.ceil(totalCount / query.pageSize)
  return {
    items,
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems: totalCount,
      totalPages
    },
    facets
  }
}

function emptyFacets() {
  return {
    brands: [],
    categories: [],
    price: { min: 0, max: 0 },
    inStock: false,
    onSale: false
  }
}

async function computeFacets(match, { brandById, categoryById }) {
  const facet = await Product.aggregate([
    { $match: match },
    {
      $facet: {
        brands: [
          { $match: { brandId: { $ne: null } } },
          { $group: { _id: '$brandId', count: { $sum: 1 } } }
        ],
        categories: [
          { $unwind: '$categoryIds' },
          { $group: { _id: '$categoryIds', count: { $sum: 1 } } }
        ],
        price: [
          { $group: { _id: null, min: { $min: '$priceMinor' }, max: { $max: '$priceMinor' } } }
        ]
      }
    }
  ])
  const doc = facet[0] ?? { brands: [], categories: [], price: [] }

  const brands = (doc.brands ?? [])
    .map((row) => {
      const brand = brandById.get(row._id?.toString())
      if (!brand || brand.status !== 'active') return null
      return { slug: brand.slug, name: brand.name, count: row.count }
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)

  const categories = (doc.categories ?? [])
    .map((row) => {
      const category = categoryById.get(row._id?.toString())
      if (!category || category.status !== 'active') return null
      return { slug: category.slug, name: category.name, count: row.count }
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)

  const priceRow = doc.price?.[0]
  return {
    brands,
    categories,
    price: { min: priceRow?.min ?? 0, max: priceRow?.max ?? 0 },
    inStock: true,
    onSale: true
  }
}

export async function getProductBySlugPublic(slug) {
  const product = await Product.findOne({ slug, status: ProductStatuses.PUBLISHED })
    .populate({ path: 'brandId', select: 'name slug' })
    .lean()
  if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')

  const categories = await Category.find({ _id: { $in: product.categoryIds } }).lean()
  const breadcrumb = product.categoryIds
    .map((categoryId) => {
      const category = categories.find((item) => item._id.toString() === categoryId.toString())
      return category
        ? { id: category._id.toString(), name: category.name, slug: category.slug }
        : null
    })
    .filter(Boolean)

  const hasVariants = (product.variants ?? []).some((variant) => variant.active)
  const available = productBaseAvailableStock(product)

  const variants = (product.variants ?? []).map((variant) => {
    const stock = Math.max(0, variant.stock - variant.reserved)
    return {
      id: variant._id.toString(),
      sku: variant.sku,
      options: normalizeOptions(variant.options),
      priceMinor: variant.priceMinor ?? product.priceMinor,
      compareAtMinor: variant.compareAtMinor ?? product.compareAtMinor,
      availableStock: variant.active ? stock : 0,
      stockStatus: publicStockStatus(stock, product.lowStockThreshold),
      active: variant.active
    }
  })

  const optionNames = []
  for (const variant of (product.variants ?? []).filter((item) => item.active)) {
    for (const name of Object.keys(normalizeOptions(variant.options))) {
      if (!optionNames.includes(name)) optionNames.push(name)
    }
  }

  const firstImage = product.images?.[0] ?? null
  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    brand: product.brandId
      ? {
          id: product.brandId._id.toString(),
          name: product.brandId.name,
          slug: product.brandId.slug
        }
      : null,
    breadcrumb,
    shortDescription: product.shortDescription,
    description: product.description,
    images: product.images ?? [],
    priceMinor: product.priceMinor,
    compareAtMinor: product.compareAtMinor ?? null,
    currency: product.currency,
    availableStock: available,
    stockStatus: hasVariants
      ? available > 0
        ? StockStatus.IN_STOCK
        : StockStatus.OUT_OF_STOCK
      : publicStockStatus(available, product.lowStockThreshold),
    discountPercent: discountPercent(product.priceMinor, product.compareAtMinor),
    attributes: product.attributes ?? [],
    variants,
    hasVariants,
    optionNames,
    tags: product.tags ?? [],
    seo: product.seo ?? null,
    featured: product.featured ?? false,
    ratingAverage: product.ratingCount > 0 ? product.ratingAverage : null,
    ratingCount: product.ratingCount ?? 0,
    publishedAt: product.publishedAt ?? null,
    image: firstImage,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  }
}

export async function getFeaturedProducts(limit = 8) {
  const products = await Product.find({
    status: ProductStatuses.PUBLISHED,
    featured: true,
    publishedAt: { $ne: null }
  })
    .sort({ publishedAt: -1 })
    .limit(limit)
    .lean()
  const { brandById, categoryById } = await loadCatalogMaps()
  return products.map((raw) => enrichSummary(raw, { brandById, categoryById }))
}

export async function getRelatedProducts(slug, limit = 8) {
  const product = await Product.findOne({
    slug,
    status: ProductStatuses.PUBLISHED,
    publishedAt: { $ne: null }
  })
    .select('_id brandId categoryIds')
    .lean()
  if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')

  const categoryIds = (product.categoryIds ?? []).map((id) => new Types.ObjectId(String(id)))
  const { brandById, categoryById } = await loadCatalogMaps()

  const projection = {
    name: 1,
    slug: 1,
    sku: 1,
    brandId: 1,
    categoryIds: 1,
    shortDescription: 1,
    images: 1,
    priceMinor: 1,
    compareAtMinor: 1,
    currency: 1,
    stock: 1,
    reserved: 1,
    lowStockThreshold: 1,
    variants: 1,
    status: 1,
    featured: 1,
    publishedAt: 1,
    ratingAverage: 1,
    ratingCount: 1
  }

  const rows = await Product.aggregate([
    {
      $match: {
        status: ProductStatuses.PUBLISHED,
        publishedAt: { $ne: null },
        _id: { $ne: product._id }
      }
    },
    {
      $addFields: {
        categoryOverlap: {
          $size: {
            $setIntersection: [
              { $ifNull: ['$categoryIds', []] },
              ...(categoryIds.length > 0 ? [categoryIds] : [[]])
            ]
          }
        },
        sameBrand: product.brandId ? { $eq: ['$brandId', product.brandId] } : false
      }
    },
    { $sort: { categoryOverlap: -1, sameBrand: -1, ratingCount: -1, ratingAverage: -1 } },
    { $limit: limit },
    { $project: projection }
  ])

  const items = rows.map((raw) => enrichSummary(raw, { brandById, categoryById }))

  // If category/brand matching returned too few suggestions, top up with the
  // most recently published products so the section is never empty.
  if (items.length < limit) {
    const seen = new Set(items.map((item) => item.id))
    const fillCount = limit - items.length
    const fillers = await Product.find({
      status: ProductStatuses.PUBLISHED,
      publishedAt: { $ne: null },
      _id: { $ne: product._id }
    })
      .sort({ publishedAt: -1 })
      .limit(fillCount * 2)
      .lean()
    for (const filler of fillers) {
      if (items.length >= limit) break
      const id = filler._id.toString()
      if (seen.has(id)) continue
      seen.add(id)
      items.push(enrichSummary(filler, { brandById, categoryById }))
    }
  }

  return { items, meta: { totalItems: items.length } }
}

export async function searchSuggestions(query, limit = 8) {
  const q = String(query ?? '').trim()
  if (!q) return { suggestions: [] }
  const needle = escapeRegex(q)

  const [products, categories, brands] = await Promise.all([
    Product.find({
      status: ProductStatuses.PUBLISHED,
      publishedAt: { $ne: null },
      $or: [
        { name: { $regex: needle, $options: 'i' } },
        { sku: { $regex: needle, $options: 'i' } },
        { tags: { $regex: needle, $options: 'i' } }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('name slug images')
      .lean(),
    Category.find({ status: 'active', name: { $regex: needle, $options: 'i' } })
      .limit(limit)
      .select('name slug imageUrl')
      .lean(),
    Brand.find({ status: 'active', name: { $regex: needle, $options: 'i' } })
      .limit(limit)
      .select('name slug logoUrl')
      .lean()
  ])

  const suggestions = [
    ...products.map((product) => ({
      type: 'product',
      name: product.name,
      slug: product.slug,
      imageUrl: product.images?.[0]?.url ?? null
    })),
    ...categories.map((category) => ({
      type: 'category',
      name: category.name,
      slug: category.slug,
      imageUrl: category.imageUrl
    })),
    ...brands.map((brand) => ({
      type: 'brand',
      name: brand.name,
      slug: brand.slug,
      imageUrl: brand.logoUrl
    }))
  ].slice(0, limit + 4)

  return { suggestions }
}

export function ensureSlugUniqueSafe(slug, excludeId) {
  return ensureUniqueSlug(Product, slug, excludeId)
}
