import { Router } from 'express'
import { z } from '@shop/validation'
import { OrderStatuses } from '@shop/types'
import { validateBody, validateQuery, validateParams } from '../../middlewares/validate.js'
import { requireAuth } from '../../middlewares/auth.js'
import {
  listOrdersHandler,
  getOrderHandler,
  cancelOrderHandler,
  checkoutOptionsHandler,
  previewOrderHandler,
  placeOrderHandler
} from './order.controller.js'

const ordersRouter = Router()
const checkoutRouter = Router()

const orderIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid order id')
})

const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(Object.values(OrderStatuses)).optional()
})

const previewBodySchema = z.object({
  shippingMethodId: z.string().trim().min(1).max(60)
})

const placeOrderBodySchema = z.object({
  addressId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid address id'),
  shippingMethodId: z.string().trim().min(1).max(60),
  paymentMethod: z.enum(['cod']),
  notes: z.string().trim().max(1000).nullable().optional()
})

ordersRouter.use(requireAuth)
ordersRouter.get('/', validateQuery(orderListQuerySchema), listOrdersHandler)
ordersRouter.get('/:id', validateParams(orderIdSchema), getOrderHandler)
ordersRouter.post('/:id/cancel', validateParams(orderIdSchema), cancelOrderHandler)

checkoutRouter.use(requireAuth)
checkoutRouter.get('/options', checkoutOptionsHandler)
checkoutRouter.post('/preview', validateBody(previewBodySchema), previewOrderHandler)
checkoutRouter.post('/place-order', validateBody(placeOrderBodySchema), placeOrderHandler)

export { ordersRouter, checkoutRouter }
