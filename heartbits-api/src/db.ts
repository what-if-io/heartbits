// ---------------------------------------------------------------------------
// PostgreSQL connection via postgres.js
// ---------------------------------------------------------------------------
import postgres from 'postgres'

if (!process.env['DATABASE_URL']) {
  throw new Error('DATABASE_URL is required')
}

export const sql = postgres(process.env['DATABASE_URL'], {
  // postgres.js connection options
  max: 20,             // connection pool size
  idle_timeout: 30,    // seconds before idle connection is closed
  connect_timeout: 10,
  // Map JS undefined → SQL NULL
  transform: {
    undefined: null,
  },
})

/**
 * Wrap a database operation in a SET LOCAL for Row-Level Security.
 *
 * Every authenticated endpoint calls this so that `app.current_user_id` is
 * visible to RLS policies on `app.*` tables.
 *
 * The SET LOCAL is scoped to the transaction, so we always open one.
 */
export async function withUser<T>(
  userId: string,
  fn: (sql: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  return sql.begin(async (tx) => {
    // SET LOCAL is transaction-scoped — safe even with a pooled connection
    await tx`SELECT set_config('app.current_user_id', ${userId}, true)`
    return fn(tx)
  }) as Promise<T>
}

/**
 * Gracefully close the pool (used in tests / shutdown hooks).
 */
export async function closeDb(): Promise<void> {
  await sql.end()
}
