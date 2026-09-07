import { Router } from 'express'
import { z, productListQuerySchema } from '@shop/validation'
import { validateQuery, validateParams, validateBody } from '../../middlewares/validate.js'
import { requireAuth } from '../../middlewares/auth.js'
import {
  listBrandsHandler,
  listCategoriesHandler,
  categoryTreeHandler,
  listProductsHandler,
  featuredProductsHandler,
  relatedProductsHandler,
  getProductHandler,
  categoryBySlugHandler,
  suggestionsHandler
} from './catalog.controller.js'
import { listProductReviewsHandler, createReviewHandler } from '../reviews/review.controller.js'

const catalogRouter = Router()

const categoryParamSchema = z.object({
  slug: z.string().trim().min(1).max(160)
})

const suggestionQuerySchema = z.object({
  q: z.string().trim().max(200).default('')
})

const reviewParamsSchema = z.object({
  slug: z.string().trim().min(1).max(220)
})

const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(8)
})

catalogRouter.get('/brands', listBrandsHandler)
catalogRouter.get('/categories', listCategoriesHandler)
catalogRouter.get('/category-tree', categoryTreeHandler)
catalogRouter.get('/categories/:slug', validateParams(categoryParamSchema), categoryBySlugHandler)
catalogRouter.get('/featured', featuredProductsHandler)
catalogRouter.get('/suggestions', validateQuery(suggestionQuerySchema), suggestionsHandler)
catalogRouter.get('/products', validateQuery(productListQuerySchema), listProductsHandler)
catalogRouter.get(
  '/products/:slug/reviews',
  validateParams(reviewParamsSchema),
  validateQuery(reviewListQuerySchema),
  listProductReviewsHandler
)
catalogRouter.get(
  '/products/:slug/related',
  validateParams(reviewParamsSchema),
  relatedProductsHandler
)
catalogRouter.get('/products/:slug', validateParams(categoryParamSchema), getProductHandler)

const createReviewSchema = z.object({
  productId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid product id'),
  rating: z.coerce
    .number()
    .int()
    .min(1, 'Rating must be between 1 and 5')
    .max(5, 'Rating must be between 1 and 5'),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().max(5000).optional(),
  orderId: z
    .string()
    .regex(/^[a-f\d]{24}$/i, 'Invalid order id')
    .optional(),
  images: z
    .array(z.object({ url: z.string().url(), alt: z.string().max(300).optional() }))
    .max(6)
    .optional()
})

catalogRouter.post('/reviews', requireAuth, validateBody(createReviewSchema), createReviewHandler)

export default catalogRouter
