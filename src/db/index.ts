import { drizzle } from 'drizzle-orm/node-postgres'

import { env } from '#/env'

import * as schema from './schema.ts'

if (!env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for database access')
}

export const db = drizzle(env.DATABASE_URL, { schema })
