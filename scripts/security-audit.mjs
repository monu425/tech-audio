#!/usr/bin/env node
/**
 * Security configuration audit for the Voltify platform.
 *
 * Loads the API configuration (same env wiring the API server uses) and
 * reports findings for production-readiness concerns such as default JWT
 * secrets, insecure cookies in production, permissive CORS and console mail.
 *
 * Usage:   node scripts/security-audit.mjs
 *          API_ENV_FILE=apps/api/.env node scripts/security-audit.mjs
 * Exit:    0 = no critical findings, 1 = critical findings present.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const envFile = process.env.API_ENV_FILE ?? path.join(repoRoot, 'apps/api/.env')
if (existsSync(envFile)) {
  const { config } = await import('dotenv')
  config({ path: envFile })
}

const { env } = await import(path.join(repoRoot, 'apps/api/src/config/env.js'))

const findings = []

function report(severity, message) {
  findings.push({ severity, message })
}

if (env.nodeEnv !== 'production') {
  report('info', `NODE_ENV is "${env.nodeEnv}" (expected "production" in deploy)`)
}
if (env.accessTokenSecret.startsWith('dev-') || env.refreshTokenSecret.startsWith('dev-')) {
  report(
    'critical',
    'JWT secrets are the development defaults — set ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET'
  )
}
if (env.nodeEnv === 'production' && !env.cookieSecure) {
  report(
    'critical',
    'COOKIE_SECURE is off while NODE_ENV=production — auth cookies would travel over plain HTTP'
  )
}
if (env.nodeEnv === 'production' && env.cookieSameSite === 'none') {
  report('critical', 'COOKIE_SAME_SITE=none without COOKIE_SECURE=true is rejected by browsers')
}
if (env.corsOrigins.includes('*')) {
  report('critical', 'CORS_ORIGINS contains "*" which allows any origin to read API responses')
} else {
  report('info', `CORS allow-list: ${env.corsOrigins.join(', ') || '(none)'}`)
}
if (env.adminPassword === 'Admin1234!' && env.nodeEnv === 'production') {
  report('critical', 'ADMIN_PASSWORD is the documented default seed value')
}
if (env.mailTransport === 'console' && env.nodeEnv === 'production') {
  report('warn', 'MAIL_TRANSPORT is "console" — transactional emails are not actually delivered')
}
if (env.paymentProviders.length === 1 && env.paymentProviders[0] === 'cod') {
  report('info', 'Only the "cod" payment provider is enabled')
}
report('info', `Rate limit: ${env.globalRateLimit.max} req / ${env.globalRateLimit.windowMs} ms`)
report('info', `Body limit: ${env.bodyLimit}; media max upload: ${env.mediaMaxUploadBytes} bytes`)
report('info', `Uploads dir: ${env.mediaUploadDir}`)

for (const finding of findings) {
  const label = finding.severity.padEnd(8).toUpperCase()
  console.log(`[${label}] ${finding.message}`)
}

const criticalCount = findings.filter((finding) => finding.severity === 'critical').length
const warnCount = findings.filter((finding) => finding.severity === 'warn').length
console.log(`\n${findings.length} findings (${criticalCount} critical, ${warnCount} warnings).`)
process.exit(criticalCount > 0 ? 1 : 0)
