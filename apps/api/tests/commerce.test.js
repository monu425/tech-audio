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
import {
  createBrand,
  createCategory,
  createProduct
} from '../src/modules/catalog/catalog.service.js'
import { UserRoles } from '@shop/types'

const STORE_ORIGIN = 'http://localhost:3000'
const TEST_OTP = '123456'

describe('commerce end-to-end (checkout, orders, reviews)', () => {
  let app
  let request
  let seed

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

  async function seedCatalog() {
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
    return { category, tee, jacket }
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
    seed = await seedCatalog()
    app = createApp()
    request = supertest(app)
  })

  afterAll(async () => {
    await disconnectDB()
    await stopTestDb()
    vi.clearAllMocks()
  })

  describe('checkout flow', () => {
    let buyer
    let addressId
    let shippingMethodId
    let shippingMinor
    let orderNumber
    let orderId

    it('prepares an address and a cart', async () => {
      const email = makeEmail('buyer')
      buyer = await verifiedAgent(email)

      const addr = await buyer.post('/api/v1/addresses').send({
        fullName: 'Shopper One',
        line1: '1 Market Street',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
        phone: '+49 30 123456'
      })
      expect(addr.status).toBe(201)
      addressId = addr.body.data.address?.id ?? addr.body.data.id

      const empty = await buyer.get('/api/v1/cart')
      expect(empty.status).toBe(200)
      expect(empty.body.data.lines).toHaveLength(0)

      const add1 = await buyer
        .post('/api/v1/cart/items')
        .send({ productId: seed.tee.id, quantity: 2 })
      expect(add1.status).toBe(200)
      const add2 = await buyer
        .post('/api/v1/cart/items')
        .send({ productId: seed.jacket.id, quantity: 1 })
      expect(add2.status).toBe(200)

      const cart = await buyer.get('/api/v1/cart')
      expect(cart.status).toBe(200)
      expect(cart.body.data.totals.itemsCount).toBe(3)
      expect(cart.body.data.totals.subtotalMinor).toBe(12000)
    })

    it('exposes checkout options with a shipping method', async () => {
      const res = await buyer.get('/api/v1/checkout/options')
      expect(res.status).toBe(200)
      const methods = res.body.data.shippingMethods
      expect(methods.length).toBeGreaterThan(0)
      expect(res.body.data.paymentMethods.map((m) => m.id)).toContain('cod')
      shippingMethodId = methods[0].id
      shippingMinor = methods[0].priceMinor
      expect(typeof shippingMinor).toBe('number')
    })

    it('previews the order with server-side totals', async () => {
      const res = await buyer.post('/api/v1/checkout/preview').send({ shippingMethodId })
      expect(res.status).toBe(200)
      const totals = res.body.data.totals
      expect(totals.subtotalMinor).toBe(12000)
      expect(totals.discountMinor).toBe(0)
      expect(totals.taxMinor).toBe(0)
      expect(totals.totalMinor).toBe(12000 + shippingMinor)
    })

    it('places the order and clears the cart', async () => {
      const res = await buyer.post('/api/v1/checkout/place-order').send({
        addressId,
        shippingMethodId,
        paymentMethod: 'cod'
      })
      expect(res.status).toBe(201)
      const order = res.body.data.order
      orderId = order.id
      expect(order.status).toBe('pending')
      expect(order.paymentStatus).toBe('pending')
      expect(order.paymentMethod).toBe('cod')
      expect(order.orderNumber).toMatch(/^SH-\d{4}-\d+$/)
      expect(order.subtotalMinor).toBe(12000)
      expect(order.shippingMinor).toBe(shippingMinor)
      expect(order.totalMinor).toBe(
        order.subtotalMinor + order.shippingMinor + order.taxMinor - order.discountMinor
      )
      expect(order.items).toHaveLength(2)
      orderNumber = order.orderNumber

      const cart = await buyer.get('/api/v1/cart')
      expect(cart.status).toBe(200)
      expect(cart.body.data.lines).toHaveLength(0)
    })

    it('lists and reads the placed order back', async () => {
      const list = await buyer.get('/api/v1/orders')
      expect(list.status).toBe(200)
      expect(list.body.data.meta.totalItems).toBe(1)

      const detail = await buyer.get(`/api/v1/orders/${orderId}`)
      expect(detail.status).toBe(200)
      expect(detail.body.data.orderNumber).toBe(orderNumber)
      expect(detail.body.data.items.map((i) => i.sku)).toEqual(['TEE-001', 'JKT-001'])
    })

    it('prevents another user from reading the order', async () => {
      const stranger = await verifiedAgent(makeEmail('stranger'))
      const res = await stranger.get(`/api/v1/orders/${orderId}`)
      expect(res.status).toBe(404)
    })

    it('lets an admin walk the order to delivered and auto-marks COD paid', async () => {
      const admin = await createAdminAgent()

      const list = await admin.get('/api/v1/admin/orders')
      expect(list.status).toBe(200)
      expect(list.body.data.items.map((o) => o.orderNumber)).toContain(orderNumber)

      const steps = [
        'confirmed',
        'processing',
        'packed',
        'shipped',
        'out_for_delivery',
        'delivered'
      ]
      for (const status of steps) {
        const res = await admin.post(`/api/v1/admin/orders/${orderId}/transition`).send({ status })
        expect(res.status).toBe(200)
        expect(res.body.data.status).toBe(status)
      }

      const detail = await admin.get(`/api/v1/admin/orders/${orderId}`)
      expect(detail.status).toBe(200)
      expect(detail.body.data.paymentStatus).toBe('paid')
      expect(detail.body.data.status).toBe('delivered')
    })
  })

  describe('reviews', () => {
    let buyer
    let admin
    let orderId
    let teeReviewId

    beforeAll(async () => {
      const buyerEmail = makeEmail('reviewer')
      buyer = await verifiedAgent(buyerEmail)
      admin = await createAdminAgent()

      const addr = await buyer.post('/api/v1/addresses').send({
        fullName: 'Reviewer One',
        line1: '9 Review Avenue',
        city: 'Munich',
        postalCode: '80331',
        country: 'DE'
      })
      expect(addr.status).toBe(201)
      const addressId = addr.body.data.address?.id ?? addr.body.data.id

      await buyer.post('/api/v1/cart/items').send({ productId: seed.tee.id, quantity: 1 })
      await buyer.post('/api/v1/cart/items').send({ productId: seed.jacket.id, quantity: 1 })

      const options = await buyer.get('/api/v1/checkout/options')
      const shippingMethodId = options.body.data.shippingMethods[0].id

      const placed = await buyer.post('/api/v1/checkout/place-order').send({
        addressId,
        shippingMethodId,
        paymentMethod: 'cod'
      })
      expect(placed.status).toBe(201)
      orderId = placed.body.data.order.id

      const steps = [
        'confirmed',
        'processing',
        'packed',
        'shipped',
        'out_for_delivery',
        'delivered'
      ]
      for (const status of steps) {
        const res = await admin.post(`/api/v1/admin/orders/${orderId}/transition`).send({ status })
        expect(res.status).toBe(200)
      }
    })

    it('creates a review and hides it from the public listing until approved', async () => {
      const res = await buyer.post('/api/v1/catalog/reviews').send({
        productId: seed.tee.id,
        rating: 5,
        title: 'Great tee',
        body: 'Fits perfectly.',
        orderId
      })
      expect(res.status).toBe(201)
      teeReviewId = res.body.data.id

      const hidden = await request.get(`/api/v1/catalog/products/${seed.tee.slug}/reviews`)
      expect(hidden.status).toBe(200)
      expect(hidden.body.data.meta.totalItems).toBe(0)
    })

    it('rejects duplicate reviews for the same product', async () => {
      const res = await buyer.post('/api/v1/catalog/reviews').send({
        productId: seed.tee.id,
        rating: 4,
        body: 'Second attempt'
      })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('ALREADY_REVIEWED')
    })

    it('blocks attaching an order that does not belong to the reviewer', async () => {
      const other = await verifiedAgent(makeEmail('other-reviewer'))
      const res = await other.post('/api/v1/catalog/reviews').send({
        productId: seed.jacket.id,
        rating: 4,
        orderId
      })
      expect(res.status).toBe(403)
    })

    it('moderates the review and reflects it publicly with rating', async () => {
      const pending = await admin.get('/api/v1/admin/reviews').query({ status: 'pending' })
      expect(pending.status).toBe(200)
      const found = pending.body.data.items.find((review) => review.id === teeReviewId)
      expect(found).toBeTruthy()

      const moderated = await admin
        .post(`/api/v1/admin/reviews/${teeReviewId}/moderate`)
        .send({ status: 'approved' })
      expect(moderated.status).toBe(200)

      const visible = await request.get(`/api/v1/catalog/products/${seed.tee.slug}/reviews`)
      expect(visible.status).toBe(200)
      expect(visible.body.data.meta.totalItems).toBe(1)
      expect(visible.body.data.items[0].rating).toBe(5)
      expect(visible.body.data.items[0].verifiedPurchase).toBe(true)
      expect(visible.body.data.ratingSummary.average).toBe(5)
    })

    it('updates the product rating average after approval', async () => {
      const res = await request.get(`/api/v1/catalog/products/${seed.tee.slug}`)
      expect(res.status).toBe(200)
      expect(res.body.data.ratingAverage).toBe(5)
      expect(res.body.data.ratingCount).toBe(1)
    })

    it('can reject a review', async () => {
      const review = await buyer.post('/api/v1/catalog/reviews').send({
        productId: seed.jacket.id,
        rating: 1,
        body: 'Spam-ish'
      })
      expect(review.status).toBe(201)

      const rejected = await admin
        .post(`/api/v1/admin/reviews/${review.body.data.id}/reject`)
        .send({})
      expect(rejected.status).toBe(200)

      const visible = await request.get(`/api/v1/catalog/products/${seed.jacket.slug}/reviews`)
      expect(visible.body.data.meta.totalItems).toBe(0)
    })
  })
})
