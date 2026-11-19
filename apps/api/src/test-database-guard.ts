const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const LOCAL_DATABASE_PORTS = new Set(['5432', '15432'])

/**
 * Fail closed before database-backed tests can write to a remote environment.
 * CI uses localhost:5432; the CPD-4 local compose stack exposes localhost:15432.
 */
export function assertLocalTestDatabase(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Database integration tests must never run with NODE_ENV=production')
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for database integration tests')
  }

  let databaseUrl: URL
  try {
    databaseUrl = new URL(connectionString)
  } catch {
    throw new Error('DATABASE_URL is invalid; refusing to run database integration tests')
  }

  const port = databaseUrl.port || '5432'
  if (
    !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
    !LOCAL_DATABASE_HOSTS.has(databaseUrl.hostname) ||
    !LOCAL_DATABASE_PORTS.has(port)
  ) {
    throw new Error(
      'Database integration tests are restricted to local PostgreSQL on localhost ports 5432 or 15432',
    )
  }
}
