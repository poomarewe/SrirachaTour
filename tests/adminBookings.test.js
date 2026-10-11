import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDatabase } from './fixtures.js';
let fixture, db, server, base;
before(async () => {
  fixture = await fixtureDatabase(); process.env.TURSO_DATABASE_URL = fixture.url; process.env.TURSO_AUTH_TOKEN = '';
  const mod = await import('../server.js'); db = mod.db; await mod.databaseReady;
  server = mod.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); db?.close(); await fixture?.cleanup(); });
async function call(path, method = 'GET', body, username = 'admin') {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'x-admin-user': username }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, data: await r.json() };
}
async function reserve(seats, suffix = 'van') {
  const r = await call('/api/bookings', 'POST', { tripId: `${fixture.tomorrow}-${suffix}`, seats, username: 'traveler', passenger: { name: 'Demo Traveler', phone: '0812345678' } });
  assert.equal(r.status, 201); return r.data;
}
const path = b => `/api/admin/bookings/${b.id}`;
async function available(suffix = 'van') { return Number((await db.execute({ sql: 'SELECT available_seats FROM trips WHERE id = ?', args: [`${fixture.tomorrow}-${suffix}`] })).rows[0].available_seats); }
test('admin contact edits and seat changes preserve price and hold expiry; conflicts roll back', async () => {
  const b = await reserve(['1A']); const other = await reserve(['1B']);
  assert.equal((await call(path(b), 'PUT', { passenger_name: 'Updated Demo', passenger_phone: '0890000000', passenger_email: 'demo@example.com', seats: ['2A','2B'], notes: 'Changed by admin' })).status, 200);
  let saved = (await call(`/api/bookings/${b.id}`)).data;
  assert.equal(saved.passenger_name, 'Updated Demo'); assert.equal(saved.total_amount, 360); assert.equal(saved.expires_at, b.expiresAt); assert.deepEqual(JSON.parse(saved.seat_numbers), ['2A','2B']); assert.equal(await available(), 10);
  assert.equal((await call(path(b), 'PUT', { seats: ['1B'], passenger_name: 'Must roll back' })).status, 409);
  saved = (await call(`/api/bookings/${b.id}`)).data; assert.equal(saved.passenger_name, 'Updated Demo'); assert.deepEqual(JSON.parse(saved.seat_numbers), ['2A','2B']); assert.equal(await available(), 10);
  for (const body of [{ seats:['9Z'] }, { seats:['2A','2A'] }, { passenger_phone:'bad' }, { booking_status:'wrong' }, { payment_status:'wrong' }]) assert.equal((await call(path(b), 'PUT', body)).status, 400);
  assert.equal((await call(path(b), 'DELETE')).status, 200); assert.equal(await available(), 12);
  assert.equal((await call(path(other), 'DELETE')).status, 200); assert.equal(await available(), 13);
});
test('cancellation and deletion release seats once; restoration checks conflicts', async () => {
  const b = await reserve(['1A']);
  assert.equal((await call(path(b)+'/status', 'PUT', { booking_status:'cancelled' })).status, 200); assert.equal(await available(), 13);
  const other = await reserve(['1A']);
  assert.equal((await call(path(b), 'PUT', { booking_status:'confirmed' })).status, 409); assert.equal(await available(), 12);
  assert.equal((await call(path(b), 'DELETE')).status, 200); assert.equal(await available(), 12);
  assert.equal((await call(`/api/bookings/${b.id}`)).status, 404);
  assert.equal((await call(path(b), 'DELETE')).status, 404);
  assert.equal((await call(path(other), 'DELETE')).status, 200); assert.equal(await available(), 13);
});
test('paid removal releases inventory and removes customer history; admin authorization is required', async () => {
  const b = await reserve(['1A','1B'], 'bus');
  assert.equal((await call(path(b), 'PUT', { notes:'no' }, 'traveler')).status, 403);
  assert.equal((await call(path(b), 'DELETE', undefined, 'traveler')).status, 403);
  assert.equal((await call(path(b), 'PUT', { payment_status:'paid' })).status, 200);
  assert.equal((await call(path(b), 'DELETE')).status, 200); assert.equal(await available('bus'), 20);
  assert.ok(!(await call('/api/users/traveler/bookings')).data.some(row => row.id === b.id));
});
test('expired holds cannot be restored or marked paid and removal does not release twice', async () => {
  const b = await reserve(['1A']);
  await db.execute({ sql:'UPDATE bookings SET expires_at = ? WHERE id = ?', args:[new Date(Date.now()-1000).toISOString(),b.id] });
  assert.equal((await call(path(b), 'PUT', { booking_status:'confirmed', payment_status:'paid' })).status, 410);
  assert.equal((await call(path(b), 'DELETE')).status, 200); assert.equal(await available(), 13);
});
test('competing admin seat edits have one winner and do not leave partial updates', async () => {
  const a = await reserve(['1A']), b = await reserve(['1B']);
  const results = await Promise.all([call(path(a),'PUT',{seats:['2A']}),call(path(b),'PUT',{seats:['2A']})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]); assert.equal(await available(),11);
  const locks=(await db.execute({sql:'SELECT seat_number FROM booking_seats WHERE trip_id = ?',args:[`${fixture.tomorrow}-van`]})).rows;
  assert.equal(locks.length,2); assert.equal(locks.filter(r=>r.seat_number==='2A').length,1);
});
