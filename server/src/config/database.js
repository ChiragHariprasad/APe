import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database pool error:', err);
});

export default pool;
