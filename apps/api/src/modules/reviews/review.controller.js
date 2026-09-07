import Product from '../catalog/product.model.js'
import { sendSuccess, sendCreated } from '../../utils/respond.js'
import { validatedQuery } from '../../middlewares/validate.js'
import { listProductReviews, createReview } from './review.service.js'
import { NotFoundError } from '../../utils/errors.js'

export async function listProductReviewsHandler(req, res, next) {
  try {
    const product = await Product.findOne({ slug: req.params.slug }).select('_id').lean()
    if (!product) throw new NotFoundError('Product not found', 'PRODUCT_NOT_FOUND')
    const q = validatedQuery(req)
    const data = await listProductReviews(product._id, {
      page: q.page,
      pageSize: q.pageSize
    })
    return sendSuccess(res, { message: 'Reviews fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function createReviewHandler(req, res, next) {
  try {
    const data = await createReview({
      user: req.user,
      productId: req.body.productId,
      orderId: req.body.orderId,
      rating: req.body.rating,
      title: req.body.title,
      body: req.body.body,
      images: req.body.images
    })
    return sendCreated(res, { message: 'Review submitted', data })
  } catch (err) {
    next(err)
  }
}
