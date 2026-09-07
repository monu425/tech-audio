import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createApp } from '../src/app.js'
import { connectDB, disconnectDB } from '../src/config/db.js'
import { startTestDb, stopTestDb } from './helpers/mongo.js'

describe('api foundation', () => {
  let request
  let app

  beforeAll(async () => {
    const uri = await startTestDb()
    await connectDB(uri)
    app = createApp()
    const supertest = (await import('supertest')).default
    request = supertest(app)
  })

  afterAll(async () => {
    await disconnectDB()
    await stopTestDb()
  })

  it('returns api info on GET /', async () => {
    const res = await request.get('/')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.name).toBe('@shop/api')
  })

  it('reports healthy when database is connected', async () => {
    const res = await request.get('/api/v1/health')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.status).toBe('up')
    expect(res.body.data.database).toBe('connected')
    expect(res.body.data.timestamp).toBeTruthy()
  })

  it('returns structured 404 for unknown routes', async () => {
    const res = await request.get('/api/v1/nope')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      success: false,
      message: expect.stringContaining('not found'),
      error: { code: 'NOT_FOUND' }
    })
  })

  it('rejects malformed JSON bodies', async () => {
    const res = await request
      .post('/api/v1/health')
      .set('Content-Type', 'application/json')
      .send('{invalid')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('sets security headers (helmet)', async () => {
    const res = await request.get('/api/v1/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-dns-prefetch-control']).toBe('off')
    expect(res.headers['referrer-policy']).toBeDefined()
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('returns an x-request-id header', async () => {
    const res = await request.get('/api/v1/health')
    expect(res.headers['x-request-id']).toBeTruthy()
  })
})
