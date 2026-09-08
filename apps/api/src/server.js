import { createApp } from './app.js'
import { connectDB, disconnectDB, syncModelIndexes } from './config/db.js'
import { loadPlatformSettings } from './config/platformConfig.js'
import { env } from './config/env.js'
import { createLogger } from './config/logger.js'

const logger = createLogger('server')

async function start() {
  await connectDB()
  await loadPlatformSettings()
  const app = createApp()

  // In production, autoIndex is disabled (see config/db.js) so indexes must be
  // created explicitly once at boot. This guarantees unique constraints (SKU,
  // slug, email, per-user coupon claim) exist before traffic starts.
  if (env.isProduction) {
    await syncModelIndexes()
  }

  const server = app.listen(env.port, () => {
    logger.info(`api listening on http://localhost:${env.port} (${env.nodeEnv})`)
  })

  function shutdown(signal) {
    logger.info({ signal }, 'shutdown signal received')
    server.close(async () => {
      try {
        await disconnectDB()
      } catch (err) {
        logger.error({ err }, 'error during db disconnect')
      }
      logger.info('api closed')
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  return server
}

start().catch((err) => {
  logger.error({ err }, 'failed to start api')
  process.exit(1)
})
