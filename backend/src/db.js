import pg from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required in backend/.env');
if (!/^postgres(ql)?:/i.test(process.env.DATABASE_URL)) throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
export const dbEnabled = true;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10
});

export function query(text, params) {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  return pool.query(text, params);
}

export async function withTransaction(work) {
  if (!pool) throw new Error('DATABASE_URL is not configured');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
