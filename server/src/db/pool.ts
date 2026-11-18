import type { QueryResult, QueryResultRow } from 'pg'
import pg from 'pg'
import { config } from '../config.js'

pg.types.setTypeParser(1082, (value) => value)

export type Queryable = {
  query<T extends QueryResultRow = QueryResultRow>(
    queryText: string,
    values?: unknown[],
  ): Promise<QueryResult<T>>
}

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
})

pool.on('error', (error) => {
  console.error(error)
})

export async function query<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool,
): Promise<T[]> {
  const result = await db.query<T>(text, params)
  return result.rows
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params: unknown[] = [],
  db: Queryable = pool,
): Promise<T | null> {
  const rows = await query<T>(text, params, db)
  return rows[0] ?? null
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
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
