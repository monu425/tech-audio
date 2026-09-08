import Wishlist from './wishlist.model.js'
import Product from '../catalog/product.model.js'
import { NotFoundError, BadRequestError, ConflictError } from '../../utils/errors.js'
import { ProductStatuses } from '@shop/types'

const MAX_WISHLIST_ITEMS = 100

async function wishlistFor(userId) {
  let wishlist = await Wishlist.findOne({ user: userId })
  if (!wishlist) {
    wishlist = await Wishlist.create({ user: userId, items: [] })
  }
  return wishlist
}

async function productsFor(ids) {
  return Product.find({
    _id: { $in: ids },
    status: ProductStatuses.PUBLISHED
  })
    .sort({ createdAt: -1 })
    .lean()
}

function toSummary(product) {
  const availableStock = product.stock - product.reserved
  return {
    id: product._id.toString(),
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    image: product.images?.[0] ?? null,
    priceMinor: product.priceMinor,
    compareAtMinor: product.compareAtMinor ?? null,
    availableStock,
    discountPercent:
      product.compareAtMinor && product.compareAtMinor > product.priceMinor
        ? Math.round(((product.compareAtMinor - product.priceMinor) / product.compareAtMinor) * 100)
        : null
  }
}

export async function getWishlist(userId) {
  const wishlist = await wishlistFor(userId)
  const products = await productsFor(wishlist.items.map((item) => item.productId))
  const byId = new Map(products.map((product) => [product._id.toString(), product]))
  const items = wishlist.items
    .filter((item) => byId.has(item.productId.toString()))
    .map((item) => ({
      product: toSummary(byId.get(item.productId.toString())),
      addedAt: item.addedAt
    }))
  return { items, meta: { totalItems: items.length } }
}

export async function addToWishlist(userId, productId) {
  const product = await Product.findById(productId).lean()
  if (!product || product.status !== ProductStatuses.PUBLISHED) {
    throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')
  }
  const wishlist = await wishlistFor(userId)
  const exists = wishlist.items.some((item) => item.productId.toString() === productId.toString())
  if (exists) throw new ConflictError('Product already in wishlist', 'ALREADY_IN_WISHLIST')
  if (wishlist.items.length >= MAX_WISHLIST_ITEMS) {
    throw new BadRequestError('Wishlist is full', 'WISHLIST_LIMIT_REACHED')
  }
  wishlist.items.push({ productId, addedAt: new Date() })
  await wishlist.save()
  return { itemCount: wishlist.items.length }
}

export async function removeFromWishlist(userId, productId) {
  const wishlist = await wishlistFor(userId)
  wishlist.items = wishlist.items.filter(
    (item) => item.productId.toString() !== productId.toString()
  )
  await wishlist.save()
  return { itemCount: wishlist.items.length }
}

export async function moveWishlistItemToCart(userId, productId, { variantId } = {}, addToCartFn) {
  const wishlist = await wishlistFor(userId)
  const item = wishlist.items.find((entry) => entry.productId.toString() === productId.toString())
  if (!item) throw new NotFoundError('Item not in wishlist', 'NOT_IN_WISHLIST')

  const product = await Product.findOne({
    _id: productId,
    status: ProductStatuses.PUBLISHED
  }).lean()
  if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')

  let resolvedVariantId = variantId ?? null
  const activeVariants = (product.variants ?? []).filter((entry) => entry.active)
  if (activeVariants.length > 0) {
    if (resolvedVariantId) {
      const variant = activeVariants.find(
        (entry) => entry._id.toString() === resolvedVariantId.toString()
      )
      if (!variant) {
        throw new BadRequestError('Selected option is unavailable', 'VARIANT_NOT_FOUND')
      }
    } else if (activeVariants.length === 1) {
      resolvedVariantId = activeVariants[0]._id
    } else {
      throw new BadRequestError(
        'This product has multiple options. Choose an option to move it to cart.',
        'VARIANT_REQUIRED'
      )
    }
  }

  const cart = await addToCartFn({ productId, variantId: resolvedVariantId, quantity: 1 })
  wishlist.items = wishlist.items.filter(
    (entry) => entry.productId.toString() !== productId.toString()
  )
  await wishlist.save()
  return cart
}
