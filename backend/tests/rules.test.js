import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DB_MODE = 'demo';
process.env.COOKIE_SECURE = 'false';

const { app, memory } = await import('../src/server.js');
let server;
let baseUrl;
let customerCookie;
let secondCustomerCookie;
let firstOrderId;
let firstBookingId;
let potteryId;

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

async function call(path, options = {}, cookie = '') {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}), ...(options.headers || {}) }
  });
  const body = await response.json();
  return { response, body, cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}

async function signup(name, email) {
  const result = await call('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password: 'password-123' }) });
  assert.equal(result.response.status, 201);
  return result.cookie;
}

before(() => {
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test('RBAC returns 401 for guests and 403 for customers on admin actions', async () => {
  const guest = await call('/api/orders');
  assert.equal(guest.response.status, 401);
  customerCookie = await signup('Asha Customer', 'asha@example.test');
  const forbidden = await call('/api/paintings', { method: 'POST', body: JSON.stringify({ id: 'p-x', title: 'Nope', artist: 'Nope', description: 'Nope', price: 10, imageUrl: '/images/p-001.jpg' }) }, customerCookie);
  assert.equal(forbidden.response.status, 403);
});

test('a painting can only be bought once and another customer sees 404 for the first order', async () => {
  secondCustomerCookie = await signup('Bina Customer', 'bina@example.test');
  const first = await call('/api/orders', { method: 'POST', body: JSON.stringify({ paintingId: 'p-001' }) }, customerCookie);
  assert.equal(first.response.status, 201);
  firstOrderId = first.body.order.id;
  const [second, privateRecord] = await Promise.all([
    call('/api/orders', { method: 'POST', body: JSON.stringify({ paintingId: 'p-001' }) }, secondCustomerCookie),
    call(`/api/orders/${firstOrderId}`, {}, secondCustomerCookie)
  ]);
  assert.equal(second.response.status, 409);
  assert.equal(second.body.error, 'This painting was just sold.');
  assert.equal(privateRecord.response.status, 404);
});

test('bookings enforce the 7-day window and reject a concurrent date duplicate', async () => {
  const tooSoon = await call('/api/bookings', { method: 'POST', body: JSON.stringify({ bookingDate: futureDate(6), wallSizeSqft: 40, address: 'Studio lane' }) }, customerCookie);
  assert.equal(tooSoon.response.status, 400);
  const tooLate = await call('/api/bookings', { method: 'POST', body: JSON.stringify({ bookingDate: futureDate(91), wallSizeSqft: 40, address: 'Studio lane' }) }, customerCookie);
  assert.equal(tooLate.response.status, 400);
  const bookingBody = { bookingDate: futureDate(14), wallSizeSqft: 40, address: '12 Studio Lane' };
  const first = await call('/api/bookings', { method: 'POST', body: JSON.stringify(bookingBody) }, customerCookie);
  assert.equal(first.response.status, 201);
  firstBookingId = first.body.booking.id;
  const duplicate = await call('/api/bookings', { method: 'POST', body: JSON.stringify(bookingBody) }, secondCustomerCookie);
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.error, 'That date was just taken.');
});

test('booking cancellation refuses dates less than 3 days away', async () => {
  const booking = memory.bookings.find((entry) => entry.id === firstBookingId);
  booking.bookingDate = futureDate(2);
  const result = await call(`/api/bookings/${firstBookingId}/cancel`, { method: 'POST' }, customerCookie);
  assert.equal(result.response.status, 400);
  assert.match(result.body.error, /3 days/);
});

test('pottery requests can be edited while requested but not after acceptance', async () => {
  const created = await call('/api/pottery-requests', { method: 'POST', body: JSON.stringify({ itemId: 'i-01', glazeId: 'g-01', quantity: 2, neededBy: futureDate(20) }) }, customerCookie);
  assert.equal(created.response.status, 201);
  potteryId = created.body.request.id;
  const edited = await call(`/api/pottery-requests/${potteryId}`, { method: 'PATCH', body: JSON.stringify({ itemId: 'i-02', glazeId: 'g-02', quantity: 3, neededBy: futureDate(21) }) }, customerCookie);
  assert.equal(edited.response.status, 200);
  memory.potteryRequests.find((entry) => entry.id === potteryId).status = 'accepted';
  const rejected = await call(`/api/pottery-requests/${potteryId}`, { method: 'PATCH', body: JSON.stringify({ itemId: 'i-03', glazeId: 'g-03', quantity: 1, neededBy: futureDate(22) }) }, customerCookie);
  assert.equal(rejected.response.status, 400);
  assert.match(rejected.body.error, /requested/);
});
