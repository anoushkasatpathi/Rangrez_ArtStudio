import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { pool } from '../src/db.js';

dotenv.config();

if (!pool) {
  console.error('DATABASE_URL is required for migrations.');
  process.exit(1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const sql = await fs.readFile(path.join(here, '../migrations/001_initial.sql'), 'utf8');
await pool.query(sql);
await pool.end();
console.log('Migration complete.');
