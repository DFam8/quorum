import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(__dirname, '.env'), override: true })

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.MIGRATION_URL ?? process.env.DATABASE_URL!,
  },
})
