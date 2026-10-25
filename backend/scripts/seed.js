import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { pool } from '../src/db.js';
import { seedData } from '../src/seed-data.js';

dotenv.config();

if (!pool) {
  console.error('DATABASE_URL is required for seeding.');
  process.exit(1);
}
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required for seeding.');
  process.exit(1);
}

const client = await pool.connect();
try {
  await client.query('BEGIN');
  for (const painting of seedData.paintings) {
    await client.query(
      `INSERT INTO paintings (id, title, artist, description, price, image_url, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, artist=EXCLUDED.artist,
       description=EXCLUDED.description, price=EXCLUDED.price, image_url=EXCLUDED.image_url`,
      [painting.id, painting.title, painting.artist, painting.description, painting.price, painting.imageUrl, painting.status]
    );
  }
  for (const item of seedData.potteryItems) {
    await client.query('INSERT INTO pottery_items (id,name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name', [item.id, item.name]);
  }
  for (const glaze of seedData.glazes) {
    await client.query('INSERT INTO glazes (id,name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name', [glaze.id, glaze.name]);
  }
  await client.query(`INSERT INTO settings (key,value) VALUES ('mural_rate_per_sqft',$1)
    ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, [String(seedData.muralRate)]);
  const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  await client.query(
    `INSERT INTO users (id,name,email,password_hash,role) VALUES ($1,$2,$3,$4,'admin')
     ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name, password_hash=EXCLUDED.password_hash, role='admin'`,
    [crypto.randomUUID(), 'KALĀGṚHA studio admin', process.env.ADMIN_EMAIL.toLowerCase(), passwordHash]
  );
  await client.query('COMMIT');
  console.log(`Seeded ${seedData.paintings.length} paintings, ${seedData.potteryItems.length} pottery items and ${seedData.glazes.length} glazes.`);
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
