import { Router } from 'express'
import { z } from '@shop/validation'
import { validateBody, validateParams } from '../../middlewares/validate.js'
import { requireAuth } from '../../middlewares/auth.js'
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  moveWishlistItemToCart
} from './wishlist.service.js'
import { addToCart } from '../cart/cart.service.js'
import { sendSuccess, sendCreated } from '../../utils/respond.js'

const wishlistRouter = Router()

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid product id')
const productBodySchema = z.object({ productId: objectId })
const productParamSchema = z.object({ productId: objectId })

export async function listHandler(req, res, next) {
  try {
    const data = await getWishlist(req.user._id)
    return sendSuccess(res, { message: 'Wishlist fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function addHandler(req, res, next) {
  try {
    const data = await addToWishlist(req.user._id, req.body.productId)
    return sendCreated(res, { message: 'Added to wishlist', data })
  } catch (err) {
    next(err)
  }
}

export async function removeHandler(req, res, next) {
  try {
    const data = await removeFromWishlist(req.user._id, req.params.productId)
    return sendSuccess(res, { message: 'Removed from wishlist', data })
  } catch (err) {
    next(err)
  }
}

export async function moveHandler(req, res, next) {
  try {
    const data = await moveWishlistItemToCart(req.user._id, req.body.productId, (args) =>
      addToCart({ user: req.user._id, guestToken: null, ...args })
    )
    return sendSuccess(res, { message: 'Moved to cart', data })
  } catch (err) {
    next(err)
  }
}

wishlistRouter.use(requireAuth)

wishlistRouter.get('/', listHandler)
wishlistRouter.post('/items', validateBody(productBodySchema), addHandler)
wishlistRouter.post('/items/move-to-cart', validateBody(productBodySchema), moveHandler)
wishlistRouter.delete('/items/:productId', validateParams(productParamSchema), removeHandler)

export default wishlistRouter
