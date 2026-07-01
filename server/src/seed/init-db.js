/**
 * Database initialization script.
 * Reads and executes the schema.sql file to create all tables.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function initDb() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
  });

  try {
    const schemaPath = path.resolve(__dirname, '../../sql/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');

    console.log('Initializing database schema...');
    await pool.query(schema);
    console.log('Database schema created successfully.');
  } catch (err) {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDb();
