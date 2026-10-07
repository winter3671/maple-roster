import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/backend/tests/**/*.test.ts'],
    pool: 'forks'
  }
})
