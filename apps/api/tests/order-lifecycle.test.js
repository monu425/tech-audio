import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import supertest from 'supertest'

vi.mock('../src/services/security.service.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    randomOtp: vi.fn(() => '123456')
  }
})

import { connectDB, disconnectDB } from '../src/config/db.js'
import { createApp } from '../src/app.js'
import { startTestDb, stopTestDb } from './helpers/mongo.js'
import User from '../src/modules/auth/user.model.js'
import Coupon from '../src/modules/coupon/coupon.model.js'
import Inventory from '../src/modules/inventory/inventory.model.js'
import StockMovement from '../src/modules/inventory/stock.movement.model.js'
import { hashPassword } from '../src/services/security.service.js'
import {
  createBrand,
  createCategory,
  createProduct
} from '../src/modules/catalog/catalog.service.js'
import { UserRoles } from '@shop/types'

const STORE_ORIGIN = 'http://localhost:3000'
const TEST_OTP = '123456'
const ORDER_STEPS = [
  'confirmed',
  'processing',
  'packed',
  'shipped',
  'out_for_delivery',
  'delivered'
]

describe('order lifecycle: inventory, returns and payments', () => {
  let app
  let request
  let seed
  let admin

  const emailCounters = {}
  function makeEmail(prefix) {
    emailCounters[prefix] = (emailCounters[prefix] || 0) + 1
    return `${prefix}-${emailCounters[prefix]}@example.com`
  }

  async function registerUser(email, password = 'Strong123') {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Shopper',
      email,
      password,
      confirmPassword: password
    })
    expect(res.status).toBe(201)
  }

  async function verifiedAgent(email) {
    const jar = supertest.agent(app)
    await registerUser(email)
    const verifyRes = await jar
      .post('/api/v1/auth/verify-email')
      .set('Origin', STORE_ORIGIN)
      .send({ email, code: TEST_OTP })
    expect(verifyRes.status).toBe(200)
    return jar
  }

  async function inventoryRow(productId, variantId = null) {
    return Inventory.findOne({ productId, variantId })
  }

  async function prepareCheckout(buyer) {
    const addr = await buyer.post('/api/v1/addresses').send({
      fullName: 'Shopper One',
      line1: '1 Market Street',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE'
    })
    expect(addr.status).toBe(201)
    const addressId = addr.body.data.address?.id ?? addr.body.data.id
    const options = await buyer.get('/api/v1/checkout/options')
    const shippingMethodId = options.body.data.shippingMethods[0].id
    return { addressId, shippingMethodId }
  }

  async function addToCart(buyer, product, quantity = 1) {
    const res = await buyer.post('/api/v1/cart/items').send({ productId: product.id, quantity })
    expect(res.status).toBe(200)
  }

  async function placeOrder(buyer) {
    const { addressId, shippingMethodId } = await prepareCheckout(buyer)
    const placed = await buyer.post('/api/v1/checkout/place-order').send({
      addressId,
      shippingMethodId,
      paymentMethod: 'cod'
    })
    expect(placed.status).toBe(201)
    return placed.body.data.order
  }

  async function walkOrder(orderId) {
    for (const status of ORDER_STEPS) {
      const res = await admin.post(`/api/v1/admin/orders/${orderId}/transition`).send({ status })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe(status)
    }
  }

  async function createCoupon(code) {
    const res = await admin.post('/api/v1/admin/coupons').send({
      code,
      type: 'percentage',
      value: 20,
      perUserLimit: 1,
      enabled: true
    })
    expect(res.status).toBe(201)
  }

  beforeAll(async () => {
    const uri = await startTestDb()
    await connectDB(uri)
    await User.create({
      name: 'Super Admin',
      email: 'admin@example.com',
      passwordHash: await hashPassword('Admin12345!'),
      role: UserRoles.SUPER_ADMIN,
      status: 'active',
      emailVerifiedAt: new Date()
    })
    await createBrand({ name: 'Voltify', status: 'active' })
    const category = await createCategory({ name: 'Apparel', status: 'active' })
    seed = {
      tee: await createProduct({
        name: 'Everyday Tee',
        sku: 'TEE-LIFE-001',
        priceMinor: 2000,
        stock: 5,
        categoryId: category.id,
        status: 'published'
      }),
      jacket: await createProduct({
        name: 'Denim Jacket',
        sku: 'JKT-LIFE-001',
        priceMinor: 8000,
        stock: 3,
        categoryId: category.id,
        status: 'published'
      })
    }
    app = createApp()
    request = supertest(app)
    admin = supertest.agent(app)
    const login = await admin
      .post('/api/v1/auth/login')
      .set('Origin', STORE_ORIGIN)
      .send({ email: 'admin@example.com', password: 'Admin12345!' })
    expect(login.status).toBe(200)
  })

  afterAll(async () => {
    await disconnectDB()
    await stopTestDb()
    vi.clearAllMocks()
  })

  it('reserves stock on placement, commits it on delivery and restores it on return', async () => {
    const buyer = await verifiedAgent(makeEmail('inventory'))
    await addToCart(buyer, seed.tee)
    const order = await placeOrder(buyer)

    let row = await inventoryRow(seed.tee.id)
    expect(row.stock).toBe(5)
    expect(row.reserved).toBe(1)

    await walkOrder(order.id)

    row = await inventoryRow(seed.tee.id)
    expect(row.stock).toBe(4)
    expect(row.reserved).toBe(0)

    // Delivery must write an order_delivered ledger entry mirroring the stock drop.
    const movements = await StockMovement.find({ productId: seed.tee.id }).sort('createdAt')
    expect(movements.some((m) => m.reason === 'order_placed' && m.change === -1)).toBe(true)
    expect(movements.some((m) => m.reason === 'order_delivered' && m.change === -1)).toBe(true)

    const requestReturn = await admin
      .post(`/api/v1/admin/orders/${order.id}/transition`)
      .send({ status: 'return_requested', note: 'Customer changed their mind' })
    expect(requestReturn.status).toBe(200)
    const acceptedReturn = await admin
      .post(`/api/v1/admin/orders/${order.id}/transition`)
      .send({ status: 'returned' })
    expect(acceptedReturn.status).toBe(200)

    row = await inventoryRow(seed.tee.id)
    expect(row.stock).toBe(5)
    expect(row.reserved).toBe(0)
  })

  it('releases coupon usage when a customer cancels a pending order', async () => {
    const code = 'SAVE20'
    await createCoupon(code)
    const buyer = await verifiedAgent(makeEmail('cancelcoupon'))

    await addToCart(buyer, seed.jacket)
    const apply = await buyer.post('/api/v1/cart/coupon').set('Origin', STORE_ORIGIN).send({ code })
    expect(apply.status).toBe(200)

    const order = await placeOrder(buyer)

    let coupon = await Coupon.findOne({ code })
    expect(coupon.usedCount).toBe(1)

    const cancelled = await buyer
      .post(`/api/v1/orders/${order.id}/cancel`)
      .set('Origin', STORE_ORIGIN)
      .send({})
    expect(cancelled.status).toBe(200)

    coupon = await Coupon.findOne({ code })
    expect(coupon.usedCount).toBe(0)
  })

  it('marks non-COD orders as paid only when captured and releases coupon use on refund', async () => {
    const code = 'SAVE20'
    const buyer = await verifiedAgent(makeEmail('refundcoupon'))

    await addToCart(buyer, seed.tee)
    await buyer.post('/api/v1/cart/coupon').set('Origin', STORE_ORIGIN).send({ code })

    const order = await placeOrder(buyer)
    expect(order.paymentStatus).toBe('pending')

    await walkOrder(order.id)

    const detail = await admin.get(`/api/v1/admin/orders/${order.id}`)
    expect(detail.body.data.paymentStatus).toBe('paid')

    let coupon = await Coupon.findOne({ code })
    expect(coupon.usedCount).toBe(1)

    const refunded = await admin
      .post(`/api/v1/admin/orders/${order.id}/transition`)
      .send({ status: 'refunded', note: 'Merchant refund' })
    expect(refunded.status).toBe(200)

    coupon = await Coupon.findOne({ code })
    expect(coupon.usedCount).toBe(0)
  })
})
