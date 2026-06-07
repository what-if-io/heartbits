import postgres from 'postgres'

// Integration tests run only when a test database is configured; otherwise they
// describe.skip so `bun test` (and `make check`) stay fast and DB-free.
export const hasTestDb = !!process.env.TEST_DATABASE_URL

// Superuser connection to the test DB — used to seed/clean rows bypassing RLS.
export function adminSql() {
  const url = process.env.TEST_ADMIN_DATABASE_URL
  if (!url) throw new Error('TEST_ADMIN_DATABASE_URL is required for integration tests')
  return postgres(url, { max: 2, transform: { undefined: null } })
}
