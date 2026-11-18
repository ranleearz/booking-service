import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pool } from './pool.js'

export async function migrate(): Promise<void> {
  const dir = resolveMigrationsDir()
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  const files = fs.readdirSync(dir).filter((file) => file.endsWith('.sql')).sort()
  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE id = $1', [file])
    if (applied.rowCount) continue
    const sql = fs.readFileSync(path.join(dir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [file])
      await client.query('COMMIT')
    } catch (error) {
      try {
        await client.query('ROLLBACK')
      } catch (rollbackError) {
        console.error(rollbackError)
      }
      throw error
    } finally {
      client.release()
    }
  }
}

function resolveMigrationsDir(): string {
  const beside = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')
  if (fs.existsSync(beside)) return beside
  return path.resolve(process.cwd(), 'src/db/migrations')
}
