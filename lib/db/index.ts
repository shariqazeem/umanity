/**
 * Database access.
 *
 *  - DATABASE_URL set  -> real Postgres (Ubuntu server, Supabase, Neon, ...)
 *  - DATABASE_URL unset -> embedded PGlite persisted under ./.data/pglite
 *                          (zero-setup local dev; never use on serverless hosts)
 *
 * Migrations in ./drizzle are applied automatically on first use so a fresh
 * clone works with `npm run dev` and nothing else.
 */
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { migrate as migratePg } from 'drizzle-orm/postgres-js/migrator'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import postgres from 'postgres'
import path from 'path'
import * as schema from './schema'

export * from './schema'

export type Db = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>

type Cache = {
  db?: Db
  ready?: Promise<Db>
  driver?: 'postgres' | 'pglite'
}

const g = globalThis as unknown as { __umanityDb?: Cache }
const cache: Cache = (g.__umanityDb ??= {})

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle')

async function init(): Promise<Db> {
  const url = process.env.DATABASE_URL
  if (url) {
    const client = postgres(url, { max: 10, prepare: false })
    const db = drizzlePg(client, { schema })
    await migratePg(db, { migrationsFolder: MIGRATIONS_FOLDER })
    cache.driver = 'postgres'
    return db
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const dataDir = process.env.PGLITE_DATA_DIR || path.join(process.cwd(), '.data', 'pglite')
  const fs = await import('fs')
  fs.mkdirSync(dataDir, { recursive: true })
  const client = new PGlite(dataDir)
  await client.waitReady
  const db = drizzlePglite(client, { schema })
  await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER })
  cache.driver = 'pglite'
  return db
}

/** Returns the (singleton) database handle, running migrations once. */
export async function getDb(): Promise<Db> {
  if (cache.db) return cache.db
  if (!cache.ready) {
    cache.ready = init().then((db) => {
      cache.db = db
      return db
    }).catch((err) => {
      cache.ready = undefined
      throw err
    })
  }
  return cache.ready
}

export function dbDriver() {
  return cache.driver ?? (process.env.DATABASE_URL ? 'postgres' : 'pglite')
}

/** Short random id (url-safe). */
export function newId(prefix = ''): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return prefix ? `${prefix}_${id}` : id
}
