import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { dbEnabled, pool, query, withTransaction } from './db.js';
import { seedData } from './seed-data.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env') });

const app = express();
const port = Number(process.env.PORT || 3001);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET is required in backend/.env');
const memory = undefined;
const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');
const isProductionLike = process.env.NODE_ENV === 'production' || Boolean(process.env.COOKIE_SECURE);
const cookieSecure = process.env.COOKIE_SECURE !== 'false';

const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function send(res, data, status = 200) {
  return res.status(status).json(data);
}

function todayUtc() {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
}

function dateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return null;
  return parsed;
}

function daysFromToday(value) {
  const parsed = dateOnly(value);
  if (!parsed) return null;
  return Math.round((parsed - todayUtc()) / 86400000);
}

function makeId() {
  return crypto.randomUUID();
}

function safeUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function setSession(res, user) {
  const token = jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: '7d' });
  res.cookie('kalagrha_session', token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSecure ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/'
  });
}

function clearSession(res) {
  res.clearCookie('kalagrha_session', {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSecure ? 'none' : 'lax',
    path: '/'
  });
}

async function findUserById(id) {
  if (!id) return null;
  if (!dbEnabled) return memory.users.find((user) => user.id === id) || null;
  const result = await query('SELECT id,name,email,role FROM users WHERE id=$1', [id]);
  return result.rows[0] || null;
}

async function findUserByEmail(email) {
  if (!dbEnabled) return memory.users.find((user) => user.email === email.toLowerCase()) || null;
  const result = await query('SELECT * FROM users WHERE lower(email)=lower($1)', [email]);
  return result.rows[0] || null;
}

async function passwordUserByEmail(email) {
  if (!dbEnabled) return memory.users.find((user) => user.email === email.toLowerCase()) || null;
  const result = await query('SELECT * FROM users WHERE lower(email)=lower($1)', [email]);
  return result.rows[0] || null;
}

const authRequired = asyncRoute(async (req, res, next) => {
  const token = req.cookies.kalagrha_session;
  if (!token) throw httpError(401, 'You must be logged in.');
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await findUserById(payload.sub);
    if (!user) throw httpError(401, 'Your session is no longer valid.');
    req.user = user;
    next();
  } catch (error) {
    if (error.status) throw error;
    throw httpError(401, 'You must be logged in.');
  }
});

function roleRequired(role) {
  return asyncRoute(async (req, res, next) => {
    if (!req.user) throw httpError(401, 'You must be logged in.');
    if (req.user.role !== role) throw httpError(403, 'You do not have permission for this action.');
    next();
  });
}

function requireString(value, field, max = 500) {
  if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > max) {
    throw httpError(400, `${field} is required and must be ${max} characters or fewer.`);
  }
  return value.trim();
}

function requirePositiveNumber(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw httpError(400, `${field} must be a valid non-negative number.`);
  return number;
}

function requireIntegerRange(value, field, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) {
    throw httpError(400, `${field} must be an integer between ${min} and ${max}.`);
  }
  return number;
}

async function listPaintings(status) {
  if (!dbEnabled) return status ? memory.paintings.filter((p) => p.status === status) : memory.paintings;
  const params = status ? [status] : [];
  const result = await query(
    `SELECT id,title,artist,description,price::float,image_url AS "imageUrl",status,created_at AS "createdAt"
     FROM paintings ${status ? 'WHERE status=$1' : ''} ORDER BY created_at DESC`,
    params
  );
  return result.rows;
}

async function getPainting(id) {
  if (!dbEnabled) return memory.paintings.find((p) => p.id === id) || null;
  const result = await query(
    `SELECT id,title,artist,description,price::float,image_url AS "imageUrl",status,created_at AS "createdAt"
     FROM paintings WHERE id=$1`,
    [id]
  );
  return result.rows[0] || null;
}

async function listOrders(user) {
  if (!dbEnabled) return memory.orders.filter((order) => user.role === 'admin' || order.userId === user.id);
  const params = user.role === 'admin' ? [] : [user.id];
  const result = await query(
    `SELECT o.id,o.user_id AS "userId",o.painting_id AS "paintingId",o.price_at_purchase::float AS "priceAtPurchase",
      o.status,o.created_at AS "createdAt",o.cancelled_at AS "cancelledAt",p.title,p.image_url AS "imageUrl",u.name AS "customerName"
     FROM orders o JOIN paintings p ON p.id=o.painting_id JOIN users u ON u.id=o.user_id
     ${user.role === 'admin' ? '' : 'WHERE o.user_id=$1'} ORDER BY o.created_at DESC`,
    params
  );
  return result.rows;
}

async function listBookings(user) {
  if (!dbEnabled) return memory.bookings.filter((booking) => user.role === 'admin' || booking.userId === user.id);
  const params = user.role === 'admin' ? [] : [user.id];
  const result = await query(
    `SELECT b.id,b.user_id AS "userId",b.booking_date::text AS "bookingDate",b.wall_size_sqft AS "wallSizeSqft",
      b.address,b.rate_per_sqft::float AS "ratePerSqft",b.price::float,b.status,b.created_at AS "createdAt",u.name AS "customerName"
     FROM wall_bookings b JOIN users u ON u.id=b.user_id
     ${user.role === 'admin' ? '' : 'WHERE b.user_id=$1'} ORDER BY b.booking_date ASC`,
    params
  );
  return result.rows;
}

async function listPotteryRequests(user) {
  if (!dbEnabled) {
    return memory.potteryRequests.filter((request) => user.role === 'admin' || request.userId === user.id).map(enrichPottery);
  }
  const params = user.role === 'admin' ? [] : [user.id];
  const result = await query(
    `SELECT r.id,r.user_id AS "userId",r.item_id AS "itemId",i.name AS "itemName",r.glaze_id AS "glazeId",
      g.name AS "glazeName",r.quantity,r.needed_by::text AS "neededBy",r.status,r.created_at AS "createdAt",
      r.updated_at AS "updatedAt",u.name AS "customerName"
     FROM pottery_requests r JOIN pottery_items i ON i.id=r.item_id JOIN glazes g ON g.id=r.glaze_id JOIN users u ON u.id=r.user_id
     ${user.role === 'admin' ? '' : 'WHERE r.user_id=$1'} ORDER BY r.created_at DESC`,
    params
  );
  return result.rows;
}

function enrichPottery(request) {
  const item = memory.potteryItems.find((entry) => entry.id === request.itemId);
  const glaze = memory.glazes.find((entry) => entry.id === request.glazeId);
  return { ...request, itemName: item?.name, glazeName: glaze?.name };
}

async function getOwnedOrAdminRecord(collection, id, user) {
  let record;
  if (collection === 'orders') record = (await listOrders(user)).find((entry) => entry.id === id);
  if (collection === 'bookings') record = (await listBookings(user)).find((entry) => entry.id === id);
  if (collection === 'pottery') record = (await listPotteryRequests(user)).find((entry) => entry.id === id);
  if (!record) throw httpError(404, 'Record not found.');
  if (user.role !== 'admin' && record.userId !== user.id) throw httpError(404, 'Record not found.');
  return record;
}

app.get('/api/health', (req, res) => send(res, { ok: true, database: 'postgres' }));

app.post('/api/auth/signup', asyncRoute(async (req, res) => {
  const name = requireString(req.body.name, 'Name', 120);
  const email = requireString(req.body.email, 'Email', 160).toLowerCase();
  const password = requireString(req.body.password, 'Password', 200);
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Enter a valid email address.');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters.');
  if (await findUserByEmail(email)) throw httpError(409, 'An account with that email already exists.');
  const user = { id: makeId(), name, email, role: 'customer', passwordHash: await bcrypt.hash(password, 12) };
  if (dbEnabled) {
    await query('INSERT INTO users (id,name,email,password_hash,role) VALUES ($1,$2,$3,$4,$5)', [user.id, user.name, user.email, user.passwordHash, user.role]);
  } else {
    memory.users.push(user);
  }
  setSession(res, user);
  return send(res, { user: safeUser(user) }, 201);
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const email = requireString(req.body.email, 'Email', 160).toLowerCase();
  const password = requireString(req.body.password, 'Password', 200);
  const user = await passwordUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash || user.passwordHash))) throw httpError(401, 'Email or password is incorrect.');
  setSession(res, user);
  return send(res, { user: safeUser(user) });
}));

app.post('/api/auth/logout', (req, res) => {
  clearSession(res);
  return send(res, { ok: true });
});

app.get('/api/auth/me', authRequired, asyncRoute(async (req, res) => send(res, { user: safeUser(req.user) })));

app.get('/api/paintings', asyncRoute(async (req, res) => {
  const status = req.query.status;
  if (status && !['available', 'sold'].includes(status)) throw httpError(400, 'Status must be available or sold.');
  return send(res, { paintings: await listPaintings(status) });
}));

app.get('/api/paintings/:id', asyncRoute(async (req, res) => {
  const painting = await getPainting(req.params.id);
  if (!painting) throw httpError(404, 'Painting not found.');
  return send(res, { painting });
}));

app.post('/api/paintings', authRequired, roleRequired('admin'), asyncRoute(async (req, res) => {
  const id = requireString(req.body.id || makeId(), 'Painting id', 80);
  const title = requireString(req.body.title, 'Title', 180);
  const artist = requireString(req.body.artist, 'Artist', 180);
  const description = requireString(req.body.description || '', 'Description', 1200);
  const price = requirePositiveNumber(req.body.price, 'Price');
  const imageUrl = requireString(req.body.imageUrl, 'Image URL', 500);
  const status = req.body.status === 'sold' ? 'sold' : 'available';
  if (dbEnabled) {
    await query('INSERT INTO paintings (id,title,artist,description,price,image_url,status) VALUES ($1,$2,$3,$4,$5,$6,$7)', [id, title, artist, description, price, imageUrl, status]);
  } else {
    if (memory.paintings.some((p) => p.id === id)) throw httpError(409, 'A painting with that id already exists.');
    memory.paintings.unshift({ id, title, artist, description, price, imageUrl, status });
  }
  return send(res, { painting: await getPainting(id) }, 201);
}));

app.patch('/api/paintings/:id', authRequired, roleRequired('admin'), asyncRoute(async (req, res) => {
  const painting = await getPainting(req.params.id);
  if (!painting) throw httpError(404, 'Painting not found.');
  if (painting.status !== 'available') throw httpError(409, 'Only available paintings can be edited.');
  const next = {
    title: requireString(req.body.title ?? painting.title, 'Title', 180),
    artist: requireString(req.body.artist ?? painting.artist, 'Artist', 180),
    description: requireString(req.body.description ?? painting.description, 'Description', 1200),
    price: requirePositiveNumber(req.body.price ?? painting.price, 'Price'),
    imageUrl: requireString(req.body.imageUrl ?? painting.imageUrl, 'Image URL', 500)
  };
  if (dbEnabled) {
    await query('UPDATE paintings SET title=$1,artist=$2,description=$3,price=$4,image_url=$5 WHERE id=$6 AND status=\'available\'', [next.title, next.artist, next.description, next.price, next.imageUrl, req.params.id]);
  } else {
    Object.assign(painting, next);
  }
  return send(res, { painting: await getPainting(req.params.id) });
}));

app.post('/api/orders', authRequired, roleRequired('customer'), asyncRoute(async (req, res) => {
  const paintingId = requireString(req.body.paintingId, 'Painting id', 80);
  if (!dbEnabled) {
    const painting = memory.paintings.find((entry) => entry.id === paintingId);
    if (!painting || painting.status !== 'available') throw httpError(409, 'This painting was just sold.');
    painting.status = 'sold';
    const order = { id: makeId(), userId: req.user.id, paintingId, priceAtPurchase: painting.price, status: 'placed', createdAt: new Date().toISOString() };
    memory.orders.unshift(order);
    return send(res, { order }, 201);
  }
  const order = await withTransaction(async (client) => {
    const updated = await client.query('UPDATE paintings SET status=\'sold\' WHERE id=$1 AND status=\'available\' RETURNING id,price::float', [paintingId]);
    if (updated.rowCount === 0) throw httpError(409, 'This painting was just sold.');
    const created = await client.query(
      `INSERT INTO orders (id,user_id,painting_id,price_at_purchase,status) VALUES ($1,$2,$3,$4,'placed')
       RETURNING id,user_id AS "userId",painting_id AS "paintingId",price_at_purchase::float AS "priceAtPurchase",status,created_at AS "createdAt"`,
      [makeId(), req.user.id, paintingId, updated.rows[0].price]
    );
    return created.rows[0];
  });
  return send(res, { order }, 201);
}));

app.get('/api/orders', authRequired, asyncRoute(async (req, res) => send(res, { orders: await listOrders(req.user) })));
app.get('/api/orders/:id', authRequired, asyncRoute(async (req, res) => send(res, { order: await getOwnedOrAdminRecord('orders', req.params.id, req.user) })));

app.post('/api/orders/:id/cancel', authRequired, roleRequired('customer'), asyncRoute(async (req, res) => {
  const order = await getOwnedOrAdminRecord('orders', req.params.id, req.user);
  if (order.status !== 'placed') throw httpError(400, 'Only placed orders can be cancelled.');
  if (!dbEnabled) {
    order.status = 'cancelled';
    order.cancelledAt = new Date().toISOString();
    const painting = memory.paintings.find((entry) => entry.id === order.paintingId);
    if (painting) painting.status = 'available';
  } else {
    await withTransaction(async (client) => {
      const changed = await client.query('UPDATE orders SET status=\'cancelled\',cancelled_at=NOW() WHERE id=$1 AND user_id=$2 AND status=\'placed\' RETURNING painting_id', [req.params.id, req.user.id]);
      if (changed.rowCount === 0) throw httpError(400, 'Only placed orders can be cancelled.');
      await client.query('UPDATE paintings SET status=\'available\' WHERE id=$1', [changed.rows[0].painting_id]);
    });
  }
  return send(res, { ok: true, message: 'Order cancelled and painting returned to the gallery.' });
}));

app.get('/api/bookings/taken-dates', authRequired, asyncRoute(async (req, res) => {
  if (!dbEnabled) return send(res, { dates: memory.bookings.filter((b) => ['requested', 'confirmed'].includes(b.status)).map((b) => b.bookingDate) });
  const result = await query("SELECT booking_date::text AS date FROM wall_bookings WHERE status IN ('requested','confirmed') ORDER BY booking_date");
  return send(res, { dates: result.rows.map((row) => row.date) });
}));

app.post('/api/bookings', authRequired, roleRequired('customer'), asyncRoute(async (req, res) => {
  const bookingDate = req.body.bookingDate;
  const days = daysFromToday(bookingDate);
  if (days === null || days < 7 || days > 90) throw httpError(400, 'Booking date must be between 7 and 90 days from today.');
  const wallSizeSqft = requireIntegerRange(req.body.wallSizeSqft, 'Wall size', 10, 500);
  const address = requireString(req.body.address, 'Address', 500);
  const ratePerSqft = seedData.muralRate;
  const price = wallSizeSqft * ratePerSqft;
  if (!dbEnabled) {
    if (memory.bookings.some((booking) => booking.bookingDate === bookingDate && ['requested', 'confirmed'].includes(booking.status))) throw httpError(409, 'That date was just taken.');
    const booking = { id: makeId(), userId: req.user.id, bookingDate, wallSizeSqft, address, ratePerSqft, price, status: 'requested', createdAt: new Date().toISOString() };
    memory.bookings.unshift(booking);
    return send(res, { booking }, 201);
  }
  try {
    const result = await query(
      `INSERT INTO wall_bookings (id,user_id,booking_date,wall_size_sqft,address,rate_per_sqft,price,status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'requested')
       RETURNING id,user_id AS "userId",booking_date::text AS "bookingDate",wall_size_sqft AS "wallSizeSqft",address,rate_per_sqft::float AS "ratePerSqft",price::float,status,created_at AS "createdAt"`,
      [makeId(), req.user.id, bookingDate, wallSizeSqft, address, ratePerSqft, price]
    );
    return send(res, { booking: result.rows[0] }, 201);
  } catch (error) {
    if (error.code === '23505') throw httpError(409, 'That date was just taken.');
    throw error;
  }
}));

app.get('/api/bookings', authRequired, asyncRoute(async (req, res) => send(res, { bookings: await listBookings(req.user) })));
app.get('/api/bookings/:id', authRequired, asyncRoute(async (req, res) => send(res, { booking: await getOwnedOrAdminRecord('bookings', req.params.id, req.user) })));

app.post('/api/bookings/:id/cancel', authRequired, roleRequired('customer'), asyncRoute(async (req, res) => {
  const booking = await getOwnedOrAdminRecord('bookings', req.params.id, req.user);
  if (!['requested', 'confirmed'].includes(booking.status)) throw httpError(400, 'Only requested or confirmed bookings can be cancelled.');
  const days = daysFromToday(booking.bookingDate);
  if (days === null || days < 3) throw httpError(400, 'Bookings can only be cancelled until 3 days before the booked date.');
  if (!dbEnabled) {
    const target = memory.bookings.find((entry) => entry.id === booking.id);
    target.status = 'cancelled';
  } else {
    await query("UPDATE wall_bookings SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status IN ('requested','confirmed')", [req.params.id, req.user.id]);
  }
  return send(res, { ok: true, message: 'Booking cancelled. The date is available again.' });
}));

async function adminBookingAction(req, res, next, status) {
  const booking = (await listBookings(req.user)).find((entry) => entry.id === req.params.id);
  if (!booking) throw httpError(404, 'Booking not found.');
  if (booking.status !== 'requested') throw httpError(400, 'Only requested bookings can be updated.');
  if (!dbEnabled) {
    const target = memory.bookings.find((entry) => entry.id === booking.id);
    target.status = status;
  } else {
    await query('UPDATE wall_bookings SET status=$1 WHERE id=$2 AND status=\'requested\'', [status, req.params.id]);
  }
  return send(res, { ok: true, message: `Booking ${status}.` });
}
app.post('/api/bookings/:id/confirm', authRequired, roleRequired('admin'), asyncRoute((req, res, next) => adminBookingAction(req, res, next, 'confirmed')));
app.post('/api/bookings/:id/decline', authRequired, roleRequired('admin'), asyncRoute((req, res, next) => adminBookingAction(req, res, next, 'declined')));

app.get('/api/pottery/options', asyncRoute(async (req, res) => {
  if (!dbEnabled) return send(res, { items: memory.potteryItems, glazes: memory.glazes });
  const [items, glazes] = await Promise.all([query('SELECT id,name FROM pottery_items ORDER BY name'), query('SELECT id,name FROM glazes ORDER BY name')]);
  return send(res, { items: items.rows, glazes: glazes.rows });
}));

function validatePotteryBody(body) {
  const itemId = requireString(body.itemId, 'Item', 80);
  const glazeId = requireString(body.glazeId, 'Glaze', 80);
  const quantity = requireIntegerRange(body.quantity, 'Quantity', 1, 12);
  const neededBy = body.neededBy;
  const days = daysFromToday(neededBy);
  if (days === null || days < 14) throw httpError(400, 'Needed-by date must be at least 14 days from today.');
  return { itemId, glazeId, quantity, neededBy };
}

app.post('/api/pottery-requests', authRequired, roleRequired('customer'), asyncRoute(async (req, res) => {
  const data = validatePotteryBody(req.body);
  if (!dbEnabled) {
    if (!memory.potteryItems.some((item) => item.id === data.itemId) || !memory.glazes.some((glaze) => glaze.id === data.glazeId)) throw httpError(400, 'Choose a valid item and glaze.');
    const request = { id: makeId(), userId: req.user.id, ...data, status: 'requested', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    memory.potteryRequests.unshift(request);
    return send(res, { request: enrichPottery(request) }, 201);
  }
  const result = await query(
    `INSERT INTO pottery_requests (id,user_id,item_id,glaze_id,quantity,needed_by,status) VALUES ($1,$2,$3,$4,$5,$6,'requested')
     RETURNING id,user_id AS "userId",item_id AS "itemId",glaze_id AS "glazeId",quantity,needed_by::text AS "neededBy",status,created_at AS "createdAt"`,
    [makeId(), req.user.id, data.itemId, data.glazeId, data.quantity, data.neededBy]
  );
  return send(res, { request: result.rows[0] }, 201);
}));

app.get('/api/pottery-requests', authRequired, asyncRoute(async (req, res) => send(res, { requests: await listPotteryRequests(req.user) })));
app.get('/api/pottery-requests/:id', authRequired, asyncRoute(async (req, res) => send(res, { request: await getOwnedOrAdminRecord('pottery', req.params.id, req.user) })));

app.patch('/api/pottery-requests/:id', authRequired, roleRequired('customer'), asyncRoute(async (req, res) => {
  const request = await getOwnedOrAdminRecord('pottery', req.params.id, req.user);
  if (request.status !== 'requested') throw httpError(400, 'Only requested pottery can be edited.');
  const data = validatePotteryBody(req.body);
  if (!dbEnabled) {
    const target = memory.potteryRequests.find((entry) => entry.id === request.id);
    Object.assign(target, data, { updatedAt: new Date().toISOString() });
  } else {
    await query("UPDATE pottery_requests SET item_id=$1,glaze_id=$2,quantity=$3,needed_by=$4,updated_at=NOW() WHERE id=$5 AND user_id=$6 AND status='requested'", [data.itemId, data.glazeId, data.quantity, data.neededBy, req.params.id, req.user.id]);
  }
  return send(res, { ok: true, message: 'Pottery request updated.' });
}));

app.post('/api/pottery-requests/:id/cancel', authRequired, roleRequired('customer'), asyncRoute(async (req, res) => {
  const request = await getOwnedOrAdminRecord('pottery', req.params.id, req.user);
  if (request.status !== 'requested') throw httpError(400, 'Only requested pottery can be cancelled.');
  if (!dbEnabled) memory.potteryRequests.find((entry) => entry.id === request.id).status = 'cancelled';
  else await query("UPDATE pottery_requests SET status='cancelled',updated_at=NOW() WHERE id=$1 AND user_id=$2 AND status='requested'", [req.params.id, req.user.id]);
  return send(res, { ok: true, message: 'Pottery request cancelled.' });
}));

async function adminPotteryAction(req, status) {
  const request = (await listPotteryRequests(req.user)).find((entry) => entry.id === req.params.id);
  if (!request) throw httpError(404, 'Pottery request not found.');
  if (request.status !== 'requested') throw httpError(400, 'Only requested pottery can be updated.');
  if (!dbEnabled) memory.potteryRequests.find((entry) => entry.id === request.id).status = status;
  else await query('UPDATE pottery_requests SET status=$1,updated_at=NOW() WHERE id=$2 AND status=\'requested\'', [status, req.params.id]);
  return { ok: true, message: `Pottery request ${status}.` };
}
app.post('/api/pottery-requests/:id/accept', authRequired, roleRequired('admin'), asyncRoute(async (req, res) => send(res, await adminPotteryAction(req, 'accepted'))));
app.post('/api/pottery-requests/:id/decline', authRequired, roleRequired('admin'), asyncRoute(async (req, res) => send(res, await adminPotteryAction(req, 'declined'))));

app.use(express.static(frontendRoot));
app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(frontendRoot, 'index.html'), (error) => error && next(error));
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (status >= 500) console.error(error);
  return send(res, { error: status >= 500 ? 'Something went wrong on the server.' : error.message }, status);
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`KALĀGṚHA API listening on http://0.0.0.0:${port} (postgres mode)`);
    if (isProductionLike && !process.env.JWT_SECRET) console.warn('JWT_SECRET is not configured; set it before production use.');
  });
}

export { app, memory };
