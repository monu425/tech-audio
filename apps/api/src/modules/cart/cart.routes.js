import { Router } from 'express'
import { z } from '@shop/validation'
import { validateBody } from '../../middlewares/validate.js'
import { optionalAuth } from '../../middlewares/auth.js'
import {
  getCartHandler,
  addItemHandler,
  updateItemHandler,
  removeItemHandler,
  clearCartHandler,
  applyCouponHandler,
  removeCouponHandler,
  attachGuestCartToken,
  maybeMergeGuestCart
} from './cart.controller.js'

const cartRouter = Router()

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id')
const optionalVariant = objectId.nullable().optional()

const addItemSchema = z.object({
  productId: objectId,
  variantId: optionalVariant,
  quantity: z.coerce.number().int().min(1).max(99)
})

const updateItemSchema = z.object({
  productId: objectId,
  variantId: optionalVariant,
  quantity: z.coerce.number().int().min(0).max(99)
})

const removeItemSchema = z.object({
  productId: objectId,
  variantId: optionalVariant
})

const couponSchema = z.object({
  code: z.string().trim().min(1).max(40)
})

cartRouter.use(optionalAuth, attachGuestCartToken, maybeMergeGuestCart)

cartRouter.get('/', getCartHandler)
cartRouter.post('/items', validateBody(addItemSchema), addItemHandler)
cartRouter.patch('/items', validateBody(updateItemSchema), updateItemHandler)
cartRouter.delete('/items', validateBody(removeItemSchema), removeItemHandler)
cartRouter.delete('/', clearCartHandler)
cartRouter.post('/coupon', validateBody(couponSchema), applyCouponHandler)
cartRouter.delete('/coupon', removeCouponHandler)

export default cartRouter
