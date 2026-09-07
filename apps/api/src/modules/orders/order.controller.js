import { sendSuccess, sendCreated } from '../../utils/respond.js'
import { validatedQuery } from '../../middlewares/validate.js'
import {
  listMyOrders,
  getOrderForUser,
  getCheckoutOptions,
  previewOrder,
  placeOrder,
  cancelMyOrder
} from './order.service.js'

export async function listOrdersHandler(req, res, next) {
  try {
    const q = validatedQuery(req)
    const data = await listMyOrders(req.user._id, {
      page: q.page,
      pageSize: q.pageSize,
      status: q.status
    })
    return sendSuccess(res, { message: 'Orders fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function getOrderHandler(req, res, next) {
  try {
    const data = await getOrderForUser(req.user._id, req.params.id)
    return sendSuccess(res, { message: 'Order fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function cancelOrderHandler(req, res, next) {
  try {
    const data = await cancelMyOrder(req.user._id, req.params.id)
    return sendSuccess(res, { message: 'Order cancelled', data })
  } catch (err) {
    next(err)
  }
}

export async function checkoutOptionsHandler(req, res, next) {
  try {
    const data = await getCheckoutOptions(req.user._id)
    return sendSuccess(res, { message: 'Checkout options fetched', data })
  } catch (err) {
    next(err)
  }
}

export async function previewOrderHandler(req, res, next) {
  try {
    const data = await previewOrder(req.user._id, req.body)
    return sendSuccess(res, { message: 'Order preview computed', data })
  } catch (err) {
    next(err)
  }
}

export async function placeOrderHandler(req, res, next) {
  try {
    const data = await placeOrder(req.user._id, req.body)
    return sendCreated(res, { message: 'Order placed successfully', data })
  } catch (err) {
    next(err)
  }
}
