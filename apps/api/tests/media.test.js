import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startTestDb, stopTestDb } from './helpers/mongo.js'

describe('media uploads', () => {
  let request
  let adminJar
  let customerJar
  let tempDir

  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  )

  beforeAll(async () => {
    // Point upload storage at a throwaway temp directory before booting the app.
    tempDir = mkdtempSync(join(tmpdir(), 'media-test-'))
    process.env.MEDIA_UPLOAD_DIR = tempDir

    const uri = await startTestDb()
    const { connectDB, disconnectDB } = await import('../src/config/db.js')
    await connectDB(uri)
    teardown = async () => {
      await disconnectDB()
      await stopTestDb()
      rmSync(tempDir, { recursive: true, force: true })
    }

    const { createApp } = await import('../src/app.js')
    const app = createApp()
    const supertest = (await import('supertest')).default
    request = supertest(app)

    const { default: User } = await import('../src/modules/auth/user.model.js')
    const { hashPassword } = await import('../src/services/security.service.js')
    const { UserRoles } = await import('@shop/types')
    await User.create({
      name: 'Super Admin',
      email: 'admin@example.com',
      passwordHash: await hashPassword('Admin12345!'),
      role: UserRoles.SUPER_ADMIN,
      status: 'active',
      emailVerifiedAt: new Date()
    })
    await User.create({
      name: 'Plain Customer',
      email: 'customer@example.com',
      passwordHash: await hashPassword('Customer123!'),
      role: UserRoles.CUSTOMER,
      status: 'active',
      emailVerifiedAt: new Date()
    })

    adminJar = supertest.agent(app)
    await adminJar
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3001')
      .send({ email: 'admin@example.com', password: 'Admin12345!' })
      .expect(200)

    customerJar = supertest.agent(app)
    await customerJar
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .send({ email: 'customer@example.com', password: 'Customer123!' })
      .expect(200)
  })

  let teardown

  afterAll(async () => {
    await teardown()
  })

  it('requires an authenticated admin', async () => {
    const anon = await request
      .post('/api/v1/media/images')
      .attach('file', PNG, { filename: 'pixel.png', contentType: 'image/png' })
    expect(anon.status).toBe(401)

    const denied = await customerJar
      .post('/api/v1/media/images')
      .attach('file', PNG, { filename: 'pixel.png', contentType: 'image/png' })
    expect(denied.status).toBe(403)
  })

  it('rejects files that are not allowed mime types', async () => {
    const res = await adminJar
      .post('/api/v1/media/images')
      .attach('file', Buffer.from('hello'), { filename: 'doc.txt', contentType: 'text/plain' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('MEDIA_INVALID_TYPE')
  })

  it('rejects content that does not match an image signature', async () => {
    const res = await adminJar
      .post('/api/v1/media/images')
      .attach('file', Buffer.from('not an image at all'), {
        filename: 'fake.png',
        contentType: 'image/png'
      })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('MEDIA_INVALID_CONTENT')
  })

  it('rejects uploads above the size limit', async () => {
    const oversized = Buffer.alloc(6 * 1024 * 1024, 1)
    const res = await adminJar
      .post('/api/v1/media/images')
      .attach('file', oversized, { filename: 'big.png', contentType: 'image/png' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('MEDIA_INVALID_FILE')
  })

  it('uploads a real PNG and serves it back with the correct type', async () => {
    const res = await adminJar
      .post('/api/v1/media/images')
      .attach('file', PNG, { filename: 'pixel.png', contentType: 'image/png' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const { url, mime, size } = res.body.data
    expect(mime).toBe('image/png')
    expect(size).toBe(PNG.length)
    expect(url).toMatch(/^\/uploads\/[a-z0-9-]+\.png$/)

    const file = await request.get(url)
    expect(file.status).toBe(200)
    expect(file.headers['content-type']).toContain('image/png')
    expect(Buffer.compare(file.body, PNG)).toBe(0)
  })
})
