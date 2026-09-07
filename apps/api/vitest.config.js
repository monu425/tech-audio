import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Each file boots its own MongoMemoryServer; run serially to avoid memory spikes.
    fileParallelism: false,
    testTimeout: 45_000,
    hookTimeout: 90_000
  }
})
