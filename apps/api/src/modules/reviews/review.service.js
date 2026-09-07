import Review from './review.model.js'
import Product from '../catalog/product.model.js'
import Order from '../orders/order.model.js'
import { NotFoundError, AuthorizationError, ConflictError } from '../../utils/errors.js'
import { OrderStatuses } from '@shop/types'

export async function refreshProductRating(productId) {
  const result = await Review.aggregate([
    { $match: { product: productId, status: 'approved' } },
    {
      $group: {
        _id: null,
        average: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ])
  const stats = result[0]
  await Product.updateOne(
    { _id: productId },
    {
      ratingAverage: Math.round((stats?.average ?? 0) * 100) / 100,
      ratingCount: stats?.count ?? 0
    }
  )
}

export async function listProductReviews(productId, { page = 1, pageSize = 10 } = {}) {
  const filter = { product: productId, status: 'approved' }
  const [reviews, totalItems] = await Promise.all([
    Review.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({ path: 'user', select: 'name' })
      .lean(),
    Review.countDocuments(filter)
  ])

  const ratingBreakdown = await Review.aggregate([
    { $match: filter },
    { $group: { _id: '$rating', count: { $sum: 1 } } }
  ])
  const breakdown = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const row of ratingBreakdown) breakdown[row._id] = row.count
  const weightedSum = [1, 2, 3, 4, 5].reduce((sum, rating) => sum + rating * breakdown[rating], 0)
  const average = totalItems > 0 ? Math.round((weightedSum / totalItems) * 100) / 100 : 0

  return {
    items: reviews.map((review) => ({
      id: review._id.toString(),
      rating: review.rating,
      title: review.title,
      body: review.body,
      images: review.images ?? [],
      verifiedPurchase: review.verifiedPurchase,
      helpfulCount: review.helpfulCount,
      user: { name: review.user?.name ?? 'Customer' },
      createdAt: review.createdAt
    })),
    meta: {
      page,
      pageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize)
    },
    ratingSummary: {
      average,
      count: totalItems,
      breakdown
    }
  }
}

export async function getProductRatingSummary(productId) {
  const stats = await Review.aggregate([
    { $match: { product: productId, status: 'approved' } },
    { $group: { _id: null, average: { $avg: '$rating' }, count: { $sum: 1 } } }
  ])
  const average = Math.round((stats[0]?.average ?? 0) * 100) / 100
  return { average, count: stats[0]?.count ?? 0 }
}

export async function createReview({ user, productId, orderId, rating, title, body, images }) {
  const product = await Product.findById(productId).lean()
  if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')

  const already = await Review.findOne({ user: user._id, product: productId })
  if (already) throw new ConflictError('You already reviewed this product', 'ALREADY_REVIEWED')

  let verifiedPurchase = false
  if (orderId) {
    const order = await Order.findOne({
      _id: orderId,
      user: user._id,
      status: OrderStatuses.DELIVERED,
      'items.productId': productId
    }).lean()
    if (!order) throw new AuthorizationError('Verified purchase required to attach an order')
    verifiedPurchase = true
  }

  const review = await Review.create({
    product: productId,
    user: user._id,
    order: orderId ?? null,
    rating,
    title: title ?? null,
    body: body ?? null,
    images: images ?? [],
    verifiedPurchase
  })
  await refreshProductRating(productId)
  return { id: review._id.toString() }
}

export async function moderateReview({ reviewId, status }) {
  const review = await Review.findById(reviewId)
  if (!review) throw new NotFoundError('Review not found', 'REVIEW_NOT_FOUND')
  review.status = status
  await review.save()
  await refreshProductRating(review.product)
  return { id: review._id.toString(), status }
}
