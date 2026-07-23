import { createClient, type Client } from '@libsql/client'

const g = globalThis as unknown as { db: Client | undefined }

export function getDb(): Client {
  if (!g.db) {
    g.db = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return g.db
}
