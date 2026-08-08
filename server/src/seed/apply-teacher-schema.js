import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.resolve(__dirname, '../../sql/teacher_schema.sql');

async function run() {
  console.log('Applying teacher schema to Neon database...');
  const sql = fs.readFileSync(sqlPath, 'utf-8');
  try {
    await db.query(sql);
    console.log('Successfully applied teacher schema to Neon database!');
  } catch (err) {
    console.error('Failed to apply teacher schema:', err);
  } finally {
    await db.end();
  }
}

run();
