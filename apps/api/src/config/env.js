import 'dotenv/config'

function readString(name, fallback = '') {
  const value = process.env[name]
  return value === undefined || value === '' ? fallback : value
}

function readNumber(name, fallback) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function readBool(name, fallback = false) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function readList(name, fallback = []) {
  const value = process.env[name]
  if (value === undefined || value === '') return fallback
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function stripSchemeAndPath(value) {
  return String(value)
    .replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
    .split('/')[0]
}

/**
 * Whether a request source (Origin/Referer) is allowed by the configured
 * CORS origin allow-list. Entries may be exact origins ("http://localhost:3000")
 * or host wildcards prefixed with "*." (e.g. "https://*.example.com") which
 * match any subdomain under that host.
 */
export function isAllowedSource(source) {
  if (!source) return true
  const allowed = env.corsOrigins
  if (allowed.includes('*')) return true
  const sourceHost = stripSchemeAndPath(source)
  return allowed.some((entry) => {
    if (source === entry) return true
    const match = /^\*\.(.*)$/.exec(entry.replace(/^[a-z][a-z0-9+.-]*:\/\//i, ''))
    if (match) {
      const suffix = match[1]
      return sourceHost === suffix || sourceHost.endsWith(`.${suffix}`)
    }
    return sourceHost === stripSchemeAndPath(entry)
  })
}

export const env = {
  nodeEnv: readString('NODE_ENV', 'development'),
  isProduction: readString('NODE_ENV') === 'production',
  isTest: readString('NODE_ENV') === 'test',
  port: readNumber('PORT', 4000),

  apiUrl: readString('API_URL', 'http://localhost:4000'),
  storeUrl: readString('STORE_URL', 'http://localhost:3000'),
  adminUrl: readString('ADMIN_URL', 'http://localhost:3001'),
  corsOrigins: readList('CORS_ORIGINS', [
    'http://localhost:3000',
    'http://localhost:3001',
    // Preview hosts served on *.monkeycode-ai.live during local development.
    'https://*.monkeycode-ai.live',
    'http://*.monkeycode-ai.live'
  ]),

  mongodbUri: readString(
    'MONGODB_URI',
    readBool('USE_MEMORY_DB') ? undefined : 'mongodb://127.0.0.1:27017/ecommerce'
  ),

  accessTokenSecret: readString('ACCESS_TOKEN_SECRET', 'dev-access-secret-change-me'),
  refreshTokenSecret: readString('REFRESH_TOKEN_SECRET', 'dev-refresh-secret-change-me'),
  accessTokenExpiresIn: readString('ACCESS_TOKEN_EXPIRES_IN', '15m'),
  refreshTokenExpiresIn: readString('REFRESH_TOKEN_EXPIRES_IN', '7d'),

  argon2MemoryCost: readNumber('ARGON2_MEMORY_COST', 65536),
  argon2TimeCost: readNumber('ARGON2_TIME_COST', 3),
  argon2Parallelism: readNumber('ARGON2_PARALLELISM', 4),

  cookieSecure: readBool('COOKIE_SECURE', false),
  cookieSameSite: readString('COOKIE_SAME_SITE', 'lax'),

  mailTransport: readString('MAIL_TRANSPORT', 'console'),
  smtpHost: readString('SMTP_HOST'),
  smtpPort: readNumber('SMTP_PORT', 587),
  smtpUser: readString('SMTP_USER'),
  smtpPassword: readString('SMTP_PASSWORD'),
  smtpFrom: readString('SMTP_FROM', 'Voltify <no-reply@voltify.local>'),

  adminEmail: readString('ADMIN_EMAIL', 'admin@example.com'),
  adminPassword: readString('ADMIN_PASSWORD', 'Admin1234!'),

  taxRatePercent: readNumber('TAX_RATE_PERCENT', 0),
  // Comma separated active payment providers; only cod is bundled in this build.
  paymentProviders: readList('PAYMENT_PROVIDERS', ['cod']),

  globalRateLimit: {
    windowMs: readNumber('RATE_LIMIT_WINDOW_MS', 60_000),
    max: readNumber('RATE_LIMIT_MAX', 120)
  },

  bodyLimit: readString('BODY_LIMIT', '1mb'),

  mediaUploadDir: readString('MEDIA_UPLOAD_DIR', 'uploads'),
  mediaMaxUploadBytes: readNumber('MEDIA_MAX_UPLOAD_BYTES', 5 * 1024 * 1024)
}
