import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import supertest from 'supertest'

// Deterministic OTPs; real crypto preserved.
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
import { hashPassword } from '../src/services/security.service.js'
import Order from '../src/modules/orders/order.model.js'
import Product from '../src/modules/catalog/product.model.js'
import {
  createBrand,
  createCategory,
  createProduct
} from '../src/modules/catalog/catalog.service.js'
import { UserRoles, OrderStatuses } from '@shop/types'

const STORE_ORIGIN = 'http://localhost:3000'
const TEST_OTP = '123456'

function makeAddress() {
  return {
    fullName: 'Shopper',
    line1: '1 Market Street',
    city: 'Berlin',
    postalCode: '10115',
    country: 'DE',
    phone: null
  }
}

describe('reviews (purchaser gating + admin delete)', () => {
  let app
  let request
  let admin
  let products

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

  async function createAdminAgent() {
    const jar = supertest.agent(app)
    const res = await jar
      .post('/api/v1/auth/login')
      .set('Origin', STORE_ORIGIN)
      .send({ email: 'admin@example.com', password: 'Admin12345!' })
    expect(res.status).toBe(200)
    return jar
  }

  async function seedOrder({ user, status, productList }) {
    const items = productList.map((product) => ({
      productId: product._id,
      variantId: null,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      imageUrl: null,
      optionSummary: null,
      unitPriceMinor: product.priceMinor,
      quantity: 1,
      lineTotalMinor: product.priceMinor
    }))
    const subtotal = items.reduce((sum, item) => sum + item.lineTotalMinor, 0)
    const order = await Order.create({
      orderNumber: `SH-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      user,
      status,
      items,
      subtotalMinor: subtotal,
      discountMinor: 0,
      shippingMinor: 0,
      taxMinor: 0,
      totalMinor: subtotal,
      shippingAddress: makeAddress()
    })
    return order
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
    const tee = await createProduct({
      name: 'Everyday Tee',
      sku: 'TEE-001',
      priceMinor: 2000,
      stock: 5,
      categoryId: category.id,
      status: 'published'
    })
    const jacket = await createProduct({
      name: 'Denim Jacket',
      sku: 'JKT-001',
      priceMinor: 8000,
      stock: 3,
      categoryId: category.id,
      status: 'published'
    })
    const gadget = await createProduct({
      name: 'Portable Speaker',
      sku: 'SPK-001',
      priceMinor: 6000,
      stock: 3,
      categoryId: category.id,
      status: 'published'
    })
    const backpack = await createProduct({
      name: 'Daypack',
      sku: 'BAG-001',
      priceMinor: 4000,
      stock: 3,
      categoryId: category.id,
      status: 'published'
    })
    products = {
      tee: await Product.findById(tee.id).lean(),
      jacket: await Product.findById(jacket.id).lean(),
      gadget: await Product.findById(gadget.id).lean(),
      backpack: await Product.findById(backpack.id).lean()
    }

    app = createApp()
    request = supertest(app)
    admin = await createAdminAgent()
  })

  afterAll(async () => {
    await disconnectDB()
    await stopTestDb()
    vi.clearAllMocks()
  })

  describe('purchaser-only review creation', () => {
    let buyer
    let buyerId
    let buyerOrderId
    let stranger

    beforeAll(async () => {
      const buyerEmail = makeEmail('buyer')
      buyer = await verifiedAgent(buyerEmail)
      const buyerUser = await User.findOne({ email: buyerEmail }).lean()
      buyerId = buyerUser._id

      const confirmed = await seedOrder({
        user: buyerId,
        status: OrderStatuses.CONFIRMED,
        productList: [products.tee, products.jacket]
      })
      buyerOrderId = confirmed._id.toString()

      await seedOrder({
        user: buyerId,
        status: OrderStatuses.CANCELLED,
        productList: [products.gadget]
      })

      stranger = await verifiedAgent(makeEmail('stranger'))
    })

    it('allows a purchaser whose order is accepted (confirmed) and links verified purchase', async () => {
      const res = await buyer.post('/api/v1/catalog/reviews').send({
        productId: products.tee._id.toString(),
        rating: 5,
        title: 'Great tee',
        body: 'Fits perfectly.',
        orderId: buyerOrderId
      })
      expect(res.status).toBe(201)
      const reviewId = res.body.data.id

      const moderated = await admin
        .post(`/api/v1/admin/reviews/${reviewId}/moderate`)
        .send({ status: 'approved' })
      expect(moderated.status).toBe(200)

      const visible = await request.get(`/api/v1/catalog/products/${products.tee.slug}/reviews`)
      expect(visible.body.data.meta.totalItems).toBe(1)
      expect(visible.body.data.items[0].verifiedPurchase).toBe(true)
    })

    it('allows a purchaser to review another purchased product without an order id', async () => {
      const res = await buyer.post('/api/v1/catalog/reviews').send({
        productId: products.jacket._id.toString(),
        rating: 4,
        body: 'Solid denim.'
      })
      expect(res.status).toBe(201)
      expect(res.body.data.id).toBeTruthy()
    })

    it('rejects a review when the only matching order is still pending', async () => {
      const email = makeEmail('pending-buyer')
      const agent = await verifiedAgent(email)
      const user = await User.findOne({ email }).lean()
      await seedOrder({
        user: user._id,
        status: OrderStatuses.PENDING,
        productList: [products.gadget]
      })
      const res = await agent.post('/api/v1/catalog/reviews').send({
        productId: products.gadget._id.toString(),
        rating: 3,
        body: 'Never accepted.'
      })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('VERIFIED_PURCHASE_REQUIRED')
    })

    it('rejects a review when the only matching order was cancelled', async () => {
      const email = makeEmail('cancelled-buyer')
      const agent = await verifiedAgent(email)
      const user = await User.findOne({ email }).lean()
      await seedOrder({
        user: user._id,
        status: OrderStatuses.CANCELLED,
        productList: [products.tee]
      })
      const res = await agent.post('/api/v1/catalog/reviews').send({
        productId: products.tee._id.toString(),
        rating: 2,
        body: 'Never kept it.'
      })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('VERIFIED_PURCHASE_REQUIRED')
    })

    it('rejects a review from a user who never purchased the product', async () => {
      const res = await stranger.post('/api/v1/catalog/reviews').send({
        productId: products.jacket._id.toString(),
        rating: 1,
        body: 'Never bought this.'
      })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('VERIFIED_PURCHASE_REQUIRED')
    })

    it('rejects attaching another customers order id', async () => {
      const res = await stranger.post('/api/v1/catalog/reviews').send({
        productId: products.tee._id.toString(),
        rating: 1,
        body: 'Hijack attempt.',
        orderId: buyerOrderId
      })
      expect(res.status).toBe(403)
    })

    it('rejects a purchaser reviewing a product they did not buy', async () => {
      const res = await buyer.post('/api/v1/catalog/reviews').send({
        productId: products.gadget._id.toString(),
        rating: 5,
        body: 'Not in my order.'
      })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('VERIFIED_PURCHASE_REQUIRED')
    })
  })

  describe('admin delete review', () => {
    let reviewer
    let reviewId

    beforeAll(async () => {
      const email = makeEmail('delete-reviewer')
      reviewer = await verifiedAgent(email)
      const user = await User.findOne({ email }).lean()
      const order = await seedOrder({
        user: user._id,
        status: OrderStatuses.DELIVERED,
        productList: [products.backpack]
      })
      const created = await reviewer.post('/api/v1/catalog/reviews').send({
        productId: products.backpack._id.toString(),
        rating: 5,
        body: 'About to be deleted.',
        orderId: order._id.toString()
      })
      expect(created.status).toBe(201)
      reviewId = created.body.data.id
    })

    it('requires an admin account', async () => {
      const res = await reviewer.delete(`/api/v1/admin/reviews/${reviewId}`)
      expect(res.status).toBe(403)
    })

    it('deletes an approved review and refreshes the public rating', async () => {
      const moderated = await admin
        .post(`/api/v1/admin/reviews/${reviewId}/moderate`)
        .send({ status: 'approved' })
      expect(moderated.status).toBe(200)

      const before = await request.get(`/api/v1/catalog/products/${products.backpack.slug}/reviews`)
      expect(before.body.data.meta.totalItems).toBe(1)

      const deleted = await admin.delete(`/api/v1/admin/reviews/${reviewId}`)
      expect(deleted.status).toBe(200)
      expect(deleted.body.data.id).toBe(reviewId)

      const after = await request.get(`/api/v1/catalog/products/${products.backpack.slug}/reviews`)
      expect(after.status).toBe(200)
      expect(after.body.data.meta.totalItems).toBe(0)

      const detail = await request.get(`/api/v1/catalog/products/${products.backpack.slug}`)
      expect(detail.body.data.ratingCount).toBe(0)
    })

    it('returns 404 for an unknown review', async () => {
      const missing = await admin.delete('/api/v1/admin/reviews/000000000000000000000000')
      expect(missing.status).toBe(404)
      expect(missing.body.error.code).toBe('REVIEW_NOT_FOUND')
    })
  })
})
