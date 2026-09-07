import { Router } from 'express'

import healthRouter from '../modules/health/health.routes.js'
import authRouter from '../modules/auth/auth.routes.js'
import catalogRouter from '../modules/catalog/catalog.routes.js'
import cartRouter from '../modules/cart/cart.routes.js'
import wishlistRouter from '../modules/wishlist/wishlist.routes.js'
import addressRouter from '../modules/address/address.routes.js'
import { ordersRouter, checkoutRouter } from '../modules/orders/order.routes.js'
import adminRouter from '../modules/admin/admin.routes.js'
import mediaRouter from '../modules/media/media.routes.js'

const v1Router = Router()

v1Router.use('/health', healthRouter)
v1Router.use('/auth', authRouter)
v1Router.use('/catalog', catalogRouter)
v1Router.use('/cart', cartRouter)
v1Router.use('/wishlist', wishlistRouter)
v1Router.use('/addresses', addressRouter)
v1Router.use('/orders', ordersRouter)
v1Router.use('/checkout', checkoutRouter)
v1Router.use('/admin', adminRouter)
v1Router.use('/media', mediaRouter)

export default v1Router
