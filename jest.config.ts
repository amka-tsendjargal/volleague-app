import type { Config } from 'jest'
import nextJest from 'next/jest.js'

// Loads next.config.ts and .env files into the test environment and wires up
// the Next.js SWC transform (so `'use server'`, TS, and JSX all just work).
const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  coverageProvider: 'v8',
  // These are server-side tests (Server Actions + pure helpers), no DOM needed.
  testEnvironment: 'node',
  // Resolve the "@/*" path alias from tsconfig.json.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
}

export default createJestConfig(config)
