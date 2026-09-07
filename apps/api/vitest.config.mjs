import { existsSync } from 'node:fs'
import { defineConfig } from 'vitest/config'

const candidates = [
  process.env.MONGOMS_SYSTEM_BINARY,
  '/opt/mongodb/bin/mongod',
  '/usr/bin/mongod'
].filter(Boolean)
const systemBinary = candidates.find((candidate) => existsSync(candidate))

const env = {}
if (systemBinary) {
  env.MONGOMS_SYSTEM_BINARY = systemBinary
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globals: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    env
  }
})
