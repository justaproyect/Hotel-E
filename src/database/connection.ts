import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';
import * as schema from './schema';

const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected PostgreSQL pool error');
});

let db: ReturnType<typeof drizzle>;

try {
  db = drizzle(pool, { schema });
} catch {
  logger.warn('Database not available, running in mock mode');
  db = {} as ReturnType<typeof drizzle>;
}

export { db };
export { pool };

export function isDbAvailable(): boolean {
  try {
    return pool.totalCount > 0;
  } catch {
    return false;
  }
}
