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
import Coupon, { CouponUsage } from '../src/modules/coupon/coupon.model.js'
import { useCoupon } from '../src/modules/coupon/coupon.service.js'
import {
  createBrand,
  createCategory,
  createProduct
} from '../src/modules/catalog/catalog.service.js'
import { UserRoles } from '@shop/types'

const STORE_ORIGIN = 'http://localhost:3000'
const TEST_OTP = '123456'

describe('coupons (product/category restrictions + atomic per-user usage)', () => {
  let app
  let request
  let buyer
  let phone
  let laptop
  let tee
  let electronicsId
  let apparelId

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

  let admin
  let buyerUserId

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
    const electronics = await createCategory({ name: 'Electronics', status: 'active' })
    electronicsId = electronics.id
    const apparel = await createCategory({ name: 'Apparel', status: 'active' })
    apparelId = apparel.id
    const shirts = await createCategory({
      name: 'Shirts',
      status: 'active',
      parentId: apparel.id
    })

    phone = await createProduct({
      name: 'Smartphone',
      sku: 'PHONE-01',
      priceMinor: 10000,
      stock: 5,
      categoryId: electronics.id,
      status: 'published'
    })
    laptop = await createProduct({
      name: 'Laptop',
      sku: 'LAPTOP-01',
      priceMinor: 20000,
      stock: 5,
      categoryId: electronics.id,
      status: 'published'
    })
    tee = await createProduct({
      name: 'Graphic Tee',
      sku: 'TEE-02',
      priceMinor: 3000,
      stock: 5,
      categoryId: shirts.id,
      status: 'published'
    })

    app = createApp()
    request = supertest(app)
    admin = await createAdminAgent()
    const buyerEmail = makeEmail('coupon-buyer')
    buyer = await verifiedAgent(buyerEmail)
    const buyerUser = await User.findOne({ email: buyerEmail }).lean()
    buyerUserId = buyerUser._id
  })

  afterAll(async () => {
    await disconnectDB()
    await stopTestDb()
    vi.clearAllMocks()
  })

  async function createCoupon(payload) {
    return admin.post('/api/v1/admin/coupons').send(payload)
  }

  describe('product-restricted coupons', () => {
    let couponId

    it('admin can create a coupon restricted to specific products', async () => {
      const res = await createCoupon({
        code: 'PHONE10',
        type: 'percentage',
        value: 10,
        productIds: [phone.id]
      })
      expect(res.status).toBe(201)
      expect(res.body.data.productIds).toEqual([phone.id])
      couponId = res.body.data.id
    })

    it('applies the discount only to the eligible product line', async () => {
      await buyer.post('/api/v1/cart/items').send({ productId: phone.id, quantity: 1 })
      await buyer.post('/api/v1/cart/items').send({ productId: laptop.id, quantity: 1 })

      const applied = await buyer.post('/api/v1/cart/coupon').send({ code: 'PHONE10' })
      expect(applied.status).toBe(200)

      const cart = await buyer.get('/api/v1/cart')
      expect(cart.status).toBe(200)
      expect(cart.body.data.totals.subtotalMinor).toBe(30000)
      expect(cart.body.data.totals.discountMinor).toBe(1000)
      expect(cart.body.data.totals.grandTotalMinor).toBe(29000)
      expect(cart.body.data.couponCode).toBe('PHONE10')
    })

    it('drops the coupon when the cart contains no eligible product', async () => {
      await buyer.delete('/api/v1/cart')
      await buyer.post('/api/v1/cart/items').send({ productId: laptop.id, quantity: 2 })

      const applied = await buyer.post('/api/v1/cart/coupon').send({ code: 'PHONE10' })
      expect(applied.status).toBe(200)

      const cart = await buyer.get('/api/v1/cart')
      expect(cart.body.data.couponCode).toBeNull()
      expect(cart.body.data.totals.discountMinor).toBe(0)
      expect(cart.body.data.totals.subtotalMinor).toBe(40000)
    })

    it('admin can update the product restriction scope', async () => {
      const res = await admin
        .patch(`/api/v1/admin/coupons/${couponId}`)
        .send({ productIds: [laptop.id] })
      expect(res.status).toBe(200)
      expect(res.body.data.productIds).toEqual([laptop.id])
    })
  })

  describe('category-restricted coupons', () => {
    it('applies when the product belongs to the restricted category (incl. descendants)', async () => {
      const created = await createCoupon({
        code: 'APPAREL10',
        type: 'percentage',
        value: 10,
        categoryIds: [apparelId]
      })
      expect(created.status).toBe(201)
      expect(created.body.data.categoryIds).toEqual([apparelId])

      await buyer.delete('/api/v1/cart')
      await buyer.post('/api/v1/cart/items').send({ productId: tee.id, quantity: 1 })

      const applied = await buyer.post('/api/v1/cart/coupon').send({ code: 'APPAREL10' })
      expect(applied.status).toBe(200)

      const cart = await buyer.get('/api/v1/cart')
      expect(cart.body.data.couponCode).toBe('APPAREL10')
      expect(cart.body.data.totals.discountMinor).toBe(300)
    })

    it('rejects a coupon restricted to another category', async () => {
      const res = await createCoupon({
        code: 'ELEC10',
        type: 'percentage',
        value: 10,
        categoryIds: [electronicsId]
      })
      expect(res.status).toBe(201)

      await buyer.delete('/api/v1/cart')
      await buyer.post('/api/v1/cart/items').send({ productId: tee.id, quantity: 1 })

      await buyer.post('/api/v1/cart/coupon').send({ code: 'ELEC10' })
      const cart = await buyer.get('/api/v1/cart')
      expect(cart.body.data.couponCode).toBeNull()
      expect(cart.body.data.totals.discountMinor).toBe(0)
    })
  })

  describe('atomic per-user coupon usage', () => {
    it('allows exactly one concurrent use when perUserLimit is 1', async () => {
      const created = await createCoupon({
        code: 'ONCEONLY',
        type: 'percentage',
        value: 10,
        usageLimit: 10,
        perUserLimit: 1
      })
      expect(created.status).toBe(201)

      const coupon = await Coupon.findOne({ code: 'ONCEONLY' })

      const settled = await Promise.allSettled([
        useCoupon(coupon, buyerUserId),
        useCoupon(coupon, buyerUserId)
      ])
      const fulfilled = settled.filter((result) => result.status === 'fulfilled')
      const rejected = settled.filter((result) => result.status === 'rejected')
      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect(rejected[0].reason.code).toBe('COUPON_PER_USER_LIMIT')

      const refreshed = await Coupon.findById(coupon._id).lean()
      expect(refreshed.usedCount).toBe(1)
      const usage = await CouponUsage.findOne({ coupon: coupon._id, user: buyerUserId }).lean()
      expect(usage.usedCount).toBe(1)
    })
  })
})
