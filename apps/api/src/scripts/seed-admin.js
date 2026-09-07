import { UserRoles } from '@shop/types'

import { connectDB, disconnectDB } from '../config/db.js'
import { env } from '../config/env.js'
import { createLogger } from '../config/logger.js'
import User from '../modules/auth/user.model.js'
import { hashPassword } from '../services/security.service.js'

const logger = createLogger('seed')

async function seedAdmin() {
  const email = env.adminEmail.toLowerCase()
  const existing = await User.findOne({ email })
  if (existing) {
    existing.role = UserRoles.SUPER_ADMIN
    existing.status = 'active'
    existing.emailVerifiedAt = existing.emailVerifiedAt ?? new Date()
    await existing.save()
    logger.info({ email }, 'admin user already exists — ensured super_admin')
    return
  }

  await User.create({
    name: 'Super Admin',
    email,
    passwordHash: await hashPassword(env.adminPassword),
    role: UserRoles.SUPER_ADMIN,
    status: 'active',
    emailVerifiedAt: new Date()
  })
  logger.info({ email }, 'super admin created')
}

async function run() {
  await connectDB()
  await seedAdmin()
  await disconnectDB()
}

run().catch((err) => {
  logger.error({ err }, 'seed failed')
  process.exit(1)
})
