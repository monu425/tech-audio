import supertest from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

// Deterministic OTPs for tests; all real crypto/hashing is preserved via importOriginal
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
import { UserRoles } from '@shop/types'

const STORE_ORIGIN = 'http://localhost:3000'

const TEST_OTP = '123456'

describe('auth flows', () => {
  let app
  let request

  const emailCounters = {}
  function makeEmail(prefix) {
    emailCounters[prefix] = (emailCounters[prefix] || 0) + 1
    return `${prefix}-${emailCounters[prefix]}@example.com`
  }

  async function registerUser(email, password = 'Strong123') {
    const res = await request.post('/api/v1/auth/register').send({
      name: 'Test User',
      email,
      password,
      confirmPassword: password
    })
    expect(res.status).toBe(201)
  }

  async function verifyUser(email) {
    const res = await request.post('/api/v1/auth/verify-email').send({
      email,
      code: TEST_OTP
    })
    expect(res.status).toBe(200)
  }

  // Registers + verifies a user through an agent jar so cookies are captured.
  async function verifiedAgent(email) {
    const jar = supertest.agent(app)
    await registerUser(email)
    const verifyRes = await jar.post('/api/v1/auth/verify-email').send({
      email,
      code: TEST_OTP
    })
    expect(verifyRes.status).toBe(200)
    const cookieHeader = (verifyRes.headers['set-cookie'] ?? []).join(';')
    const refreshToken = /refresh_token=([^;]+)/.exec(cookieHeader)?.[1]
    return { jar, refreshToken }
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
    app = createApp()
    request = supertest(app)
  })

  afterAll(async () => {
    await disconnectDB()
    await stopTestDb()
    vi.clearAllMocks()
  })

  describe('registration', () => {
    it('registers a new unverified customer and sends an OTP email', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Strong123',
        confirmPassword: 'Strong123'
      })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.user.emailVerified).toBe(false)
      expect(res.body.data.user.role).toBe('customer')
      expect(res.body.data.user.passwordHash).toBeUndefined()
      expect(res.body.message).toContain('verification code has been sent')
      // No auth cookies set yet
      expect(res.headers['set-cookie'] ?? []).toHaveLength(0)
    })

    it('rejects duplicate emails', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Strong123',
        confirmPassword: 'Strong123'
      })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('EMAIL_TAKEN')
    })

    it('validates payloads with friendly field errors', async () => {
      const res = await request.post('/api/v1/auth/register').send({
        name: 'J',
        email: 'not-an-email',
        password: 'weak',
        confirmPassword: 'different'
      })
      expect(res.status).toBe(422)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
      expect(Object.keys(res.body.error.fields).length).toBeGreaterThan(0)
    })
  })

  describe('email verification', () => {
    it('rejects an incorrect OTP', async () => {
      const res = await request.post('/api/v1/auth/verify-email').send({
        email: 'jane@example.com',
        code: '000000'
      })
      expect(res.status).toBe(422)
      expect(res.body.error.fields.otp).toContain('Incorrect')
    })

    it('verifies with the correct OTP and signs the user in with cookies', async () => {
      const res = await request.post('/api/v1/auth/verify-email').send({
        email: 'jane@example.com',
        code: TEST_OTP
      })
      expect(res.status).toBe(200)
      expect(res.body.data.user.emailVerified).toBe(true)
      const cookies = (res.headers['set-cookie'] ?? []).join(';')
      expect(cookies).toContain('access_token=')
      expect(cookies).toContain('refresh_token=')
    })

    it('cannot verify twice', async () => {
      const res = await request.post('/api/v1/auth/verify-email').send({
        email: 'jane@example.com',
        code: TEST_OTP
      })
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('EMAIL_ALREADY_VERIFIED')
    })
  })

  describe('login & session', () => {
    it('blocks login for an unverified account', async () => {
      const email = makeEmail('unverified')
      await registerUser(email)
      const res = await request.post('/api/v1/auth/login').send({
        email,
        password: 'Strong123'
      })
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED')
    })

    it('logs in an admin with cookies', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: 'admin@example.com',
        password: 'Admin12345!'
      })
      expect(res.status).toBe(200)
      expect(res.body.data.user.role).toBe('super_admin')
      expect(res.headers['set-cookie'].join(';')).toContain('access_token=')
    })

    it('rejects bad credentials generically', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: 'admin@example.com',
        password: 'wrong-password'
      })
      expect(res.status).toBe(401)
      expect(res.body.message).toBe('Invalid email or password')
    })

    it('returns 401 on protected routes without credentials', async () => {
      const res = await request.get('/api/v1/auth/me')
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHENTICATED')
    })

    it('serves /me using an agent cookie jar', async () => {
      const email = makeEmail('me')
      const { jar } = await verifiedAgent(email)
      const res = await jar.get('/api/v1/auth/me')
      expect(res.status).toBe(200)
      expect(res.body.data.user.email).toBe(email)
    })

    it('supports bearer-token auth', async () => {
      const email = makeEmail('bearer')
      await registerUser(email)
      await verifyUser(email)
      const loginRes = await request.post('/api/v1/auth/login').send({
        email,
        password: 'Strong123'
      })
      const cookies = loginRes.headers['set-cookie']
      const access = /access_token=([^;]+)/.exec(cookies.join(';'))[1]
      const res = await request.get('/api/v1/auth/me').set('Authorization', `Bearer ${access}`)
      expect(res.status).toBe(200)
      expect(res.body.data.user.email).toBe(email)
    })

    it('rotates refresh tokens and invalidates the old one on reuse', async () => {
      const email = makeEmail('rotate')
      const { jar, refreshToken: oldRefresh } = await verifiedAgent(email)

      const rotated = await jar.post('/api/v1/auth/refresh').set('Origin', STORE_ORIGIN)
      expect(rotated.status).toBe(200)

      // Replaying the old token must now fail and revoke the session family
      const replay = await request
        .post('/api/v1/auth/refresh')
        .set('Origin', STORE_ORIGIN)
        .set('Cookie', `refresh_token=${oldRefresh}`)
      expect(replay.status).toBe(401)
      expect(replay.body.error.code).toBe('UNAUTHENTICATED')
    })
  })

  describe('sessions management', () => {
    it('lists sessions, revokes others, and protects the active session', async () => {
      const email = makeEmail('sessions')
      const { jar } = await verifiedAgent(email)

      const second = await request.post('/api/v1/auth/login').send({
        email,
        password: 'Strong123'
      })
      expect(second.status).toBe(200)

      const list = await jar.get('/api/v1/auth/sessions')
      expect(list.status).toBe(200)
      expect(list.body.data.sessions).toHaveLength(2)
      const currentId = list.body.data.sessions.find((s) => s.current).id
      const otherId = list.body.data.sessions.find((s) => !s.current).id
      expect(currentId).toBeTruthy()
      expect(otherId).toBeTruthy()

      // Revoking a non-active session succeeds and drops it from the list
      const removed = await jar
        .delete(`/api/v1/auth/sessions/${otherId}`)
        .set('Origin', STORE_ORIGIN)
      expect(removed.status).toBe(200)

      const after = await jar.get('/api/v1/auth/sessions')
      expect(after.status).toBe(200)
      expect(after.body.data.sessions).toHaveLength(1)
      expect(after.body.data.sessions[0].id).toBe(currentId)

      // The active session itself cannot be revoked via this endpoint
      const guard = await jar
        .delete(`/api/v1/auth/sessions/${currentId}`)
        .set('Origin', STORE_ORIGIN)
      expect(guard.status).toBe(400)
      expect(guard.body.error.code).toBe('CURRENT_SESSION')

      const stillActive = await jar.get('/api/v1/auth/sessions')
      expect(stillActive.status).toBe(200)
      expect(stillActive.body.data.sessions).toHaveLength(1)
    })

    it('revokes all other sessions', async () => {
      const email = makeEmail('sessions-revoke-others')
      const { jar } = await verifiedAgent(email)

      const second = await request.post('/api/v1/auth/login').send({
        email,
        password: 'Strong123'
      })
      expect(second.status).toBe(200)

      const revokeOthers = await jar
        .post('/api/v1/auth/sessions/revoke-others')
        .set('Origin', STORE_ORIGIN)
      expect(revokeOthers.status).toBe(200)

      const afterRevoke = await jar.get('/api/v1/auth/sessions')
      expect(afterRevoke.status).toBe(200)
      expect(afterRevoke.body.data.sessions).toHaveLength(1)
      expect(afterRevoke.body.data.sessions[0].current).toBe(true)
    })
  })

  describe('CSRF protection', () => {
    it('rejects cookie-authenticated unsafe requests from unknown origins', async () => {
      const jar = supertest.agent(app)
      await jar.post('/api/v1/auth/login').send({
        email: 'jane@example.com',
        password: 'Strong123'
      })
      const res = await jar
        .post('/api/v1/auth/change-password')
        .set('Origin', 'https://evil.example.com')
        .send({
          currentPassword: 'Strong123',
          newPassword: 'Strong1234',
          confirmPassword: 'Strong1234'
        })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_BLOCKED')
    })

    it('issues a non-httpOnly csrf_token cookie alongside auth cookies', async () => {
      const res = await request.post('/api/v1/auth/login').send({
        email: 'jane@example.com',
        password: 'Strong123'
      })
      expect(res.status).toBe(200)
      const csrfCookie = res.headers['set-cookie'].find((c) => c.startsWith('csrf_token='))
      expect(csrfCookie).toBeDefined()
      expect(csrfCookie.toLowerCase()).not.toContain('httponly')
    })

    it('accepts a matching double-submit token regardless of origin', async () => {
      const loginRes = await request.post('/api/v1/auth/login').send({
        email: 'jane@example.com',
        password: 'Strong123'
      })
      const cookies = loginRes.headers['set-cookie']
      const csrf = /csrf_token=([^;]+)/.exec(cookies.join(';'))[1]
      const cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ')

      const res = await request
        .post('/api/v1/auth/change-password')
        .set('Cookie', cookieHeader)
        .set('Origin', 'https://evil.example.com')
        .set('X-CSRF-Token', csrf)
        .send({
          currentPassword: 'Strong123',
          newPassword: 'Strong1234',
          confirmPassword: 'Strong1234'
        })
      expect(res.status).toBe(200)
    })

    it('rejects a mismatched token from an unknown origin', async () => {
      const jar = supertest.agent(app)
      await jar.post('/api/v1/auth/login').send({
        email: 'jane@example.com',
        password: 'Strong1234'
      })
      const res = await jar
        .post('/api/v1/auth/change-password')
        .set('Origin', 'https://evil.example.com')
        .set('X-CSRF-Token', 'wrong-token')
        .send({
          currentPassword: 'Strong1234',
          newPassword: 'Strong12345',
          confirmPassword: 'Strong12345'
        })
      expect(res.status).toBe(403)
      expect(res.body.error.code).toBe('CSRF_BLOCKED')
    })
  })

  describe('password reset & change', () => {
    it('sends a reset code then resets the password', async () => {
      const res = await request.post('/api/v1/auth/forgot-password').send({
        email: 'jane@example.com'
      })
      expect(res.status).toBe(200)
      expect(res.body.message).toContain('code has been sent')

      const reset = await request.post('/api/v1/auth/reset-password').send({
        email: 'jane@example.com',
        code: TEST_OTP,
        newPassword: 'BrandNew999',
        confirmPassword: 'BrandNew999'
      })
      expect(reset.status).toBe(200)

      const login = await request.post('/api/v1/auth/login').send({
        email: 'jane@example.com',
        password: 'BrandNew999'
      })
      expect(login.status).toBe(200)
    })

    it('returns a generic response for unknown emails on forgot-password', async () => {
      const res = await request.post('/api/v1/auth/forgot-password').send({
        email: 'nobody@example.com'
      })
      expect(res.status).toBe(200)
      expect(res.body.message).toContain('If that email is registered')
    })

    it('changes password only when current password matches', async () => {
      const jar = supertest.agent(app)
      await jar.post('/api/v1/auth/login').send({
        email: 'jane@example.com',
        password: 'BrandNew999'
      })

      const wrong = await jar
        .post('/api/v1/auth/change-password')
        .set('Origin', STORE_ORIGIN)
        .send({
          currentPassword: 'nope',
          newPassword: 'Another999',
          confirmPassword: 'Another999'
        })
      expect(wrong.status).toBe(422)
      expect(wrong.body.error.fields.currentPassword).toContain('incorrect')

      const ok = await jar.post('/api/v1/auth/change-password').set('Origin', STORE_ORIGIN).send({
        currentPassword: 'BrandNew999',
        newPassword: 'Another999',
        confirmPassword: 'Another999'
      })
      expect(ok.status).toBe(200)

      const oldLogin = await request.post('/api/v1/auth/login').send({
        email: 'jane@example.com',
        password: 'BrandNew999'
      })
      expect(oldLogin.status).toBe(401)
    })
  })

  describe('logout', () => {
    it('clears cookies and revokes the session', async () => {
      const jar = supertest.agent(app)
      await jar.post('/api/v1/auth/login').send({
        email: 'jane@example.com',
        password: 'Another999'
      })
      const out = await jar.post('/api/v1/auth/logout').set('Origin', STORE_ORIGIN).send({})
      expect(out.status).toBe(200)
      const me = await jar.get('/api/v1/auth/me')
      expect(me.status).toBe(401)
    })
  })
})
