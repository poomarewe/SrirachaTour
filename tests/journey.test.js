import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDatabase } from './fixtures.js';
import { seatLabels, bangkokDate, isBookable, contactErrors, normalizeBooking, holdActive } from '../shared/journey.js';
let fixture, server, app, db, base;
const passenger = { name: 'Test Traveler', phone: '0812345678', email: '' };
async function request(path, body) {
  const result = await fetch(base + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: result.status, data: await result.json() };
}
const booking = (seats, extra = {}) => ({ tripId: `${fixture.tomorrow}-van`, seats, passenger, username: 'traveler', ...extra });
before(async () => {
  fixture = await fixtureDatabase();
  process.env.TURSO_DATABASE_URL = fixture.url; process.env.TURSO_AUTH_TOKEN = '';
  const module = await import('../server.js');
  ({ app, db } = module); await module.databaseReady;
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); db?.close(); await fixture?.cleanup(); });

test('seat layouts, Bangkok dates and normalization use the same rules everywhere', () => {
  assert.equal(seatLabels(13).length, 13); assert.equal(seatLabels(20).length, 20); assert.deepEqual(seatLabels(12), []);
  assert.equal(new Set(seatLabels(13)).size, 13); assert.equal(bangkokDate(new Date('2026-10-07T18:00:00Z')), '2026-10-08');
  assert.equal(isBookable({ status: 'scheduled', departure_date: '2026-10-08', departure_time: '08:00' }, Date.parse('2026-10-08T01:00:00Z')), false);
  assert.deepEqual(contactErrors(passenger), {}); assert.ok(contactErrors({ name: '', phone: 'abc', email: 'bad' }).phone);
  const normalized = normalizeBooking({ id: 'b', seat_numbers: '["1A","1B"]', total_amount: 360, payment_status: 'pending_payment', expires_at: new Date(Date.now() + 1000).toISOString(), passenger_name: 'Name', trip_id: 'trip', departure_time: '08:00', arrival_time: '10:00' });
  assert.deepEqual(normalized.seats, ['1A', '1B']); assert.equal(normalized.trip.id, 'trip'); assert.equal(normalized.total, 360); assert.equal(holdActive(normalized), true);
});
test('sign-in, bilingual catalog and admin access remain compatible', async () => {
  const login = await request('/api/auth/login', { username: 'traveler' }); assert.equal(login.status, 200);
  const catalog = await request(`/api/trips?from=Sriracha&to=Bangkok&date=${fixture.tomorrow}`); assert.equal(catalog.data.length, 4); assert.equal(catalog.data[0].from_station_th, 'ตึกคอม ศรีราชา');
  assert.equal((await request('/api/admin/trips')).status, 403);
  const admin = await fetch(base + '/api/admin/trips', { headers: { 'x-admin-user': 'admin' } }); assert.equal(admin.status, 200);
});
test('invalid contact, duplicate or fabricated seats, unsupported and departed trips never reserve inventory', async () => {
  for (const body of [booking(['1A', '1A']), booking(['99Z']), booking(['1A'], { passenger: { name: '', phone: 'oops' } }), booking(['1A'], { tripId: `${fixture.tomorrow}-unsupported` }), booking(['1A'], { username: '' })]) assert.equal((await request('/api/bookings', body)).status, 400);
  assert.equal((await request('/api/bookings', booking(['1A'], { tripId: 'departed' }))).status, 410);
  assert.equal((await request('/api/bookings', booking(['1A'], { tripId: `${fixture.tomorrow}-full` }))).status, 409);
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM bookings')).rows[0].n), 0);
});
test('competing reservations have one winner and no partial booking', async () => {
  const results = await Promise.all([request('/api/bookings', booking(['1A', '1B'])), request('/api/bookings', booking(['1A'], { username: 'other' }))]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
  const winner = results.find(r => r.status === 201).data;
  const count = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM booking_seats WHERE booking_id = ?', args: [winner.id] }); assert.equal(Number(count.rows[0].n), winner.seats.length);
  assert.equal(Number((await db.execute('SELECT COUNT(*) AS n FROM bookings')).rows[0].n), 1);
});
test('a failed seat insert rolls back the booking, earlier seat inserts and inventory', async () => {
  const before = Number((await db.execute({ sql: 'SELECT available_seats FROM trips WHERE id = ?', args: [`${fixture.tomorrow}-bus`] })).rows[0].available_seats);
  await db.execute("CREATE TRIGGER test_insert_failure BEFORE INSERT ON booking_seats WHEN NEW.seat_number = '2B' BEGIN SELECT RAISE(ABORT, 'test failure'); END");
  const result = await request('/api/bookings', booking(['2A', '2B'], { tripId: `${fixture.tomorrow}-bus` })); assert.equal(result.status, 500);
  await db.execute('DROP TRIGGER test_insert_failure');
  assert.equal(Number((await db.execute({ sql: 'SELECT available_seats FROM trips WHERE id = ?', args: [`${fixture.tomorrow}-bus`] })).rows[0].available_seats), before);
  assert.equal(Number((await db.execute({ sql: 'SELECT COUNT(*) AS n FROM booking_seats WHERE trip_id = ?', args: [`${fixture.tomorrow}-bus`] })).rows[0].n), 0);
});
test('both payment methods support deterministic failure, retry and idempotent completion', async () => {
  const reservation = await request('/api/bookings', booking(['2A', '2B'], { tripId: `${fixture.tomorrow}-bus` })); assert.equal(reservation.status, 201);
  app.locals.paymentRandom = () => 0; const failed = await request(`/api/bookings/${reservation.data.id}/pay`, { paymentMethod: 'promptpay' }); assert.equal(failed.status, 400); assert.equal(failed.data.canRetry, true);
  assert.equal((await request(`/api/bookings/${reservation.data.id}`)).data.payment_status, 'pending_payment');
  app.locals.paymentRandom = () => 1; const paid = await request(`/api/bookings/${reservation.data.id}/pay`, { paymentMethod: 'card' }); assert.equal(paid.status, 200); assert.equal(paid.data.booking.payment_method, 'credit_card');
  assert.equal((await request(`/api/bookings/${reservation.data.id}/pay`, { paymentMethod: 'card' })).data.alreadyPaid, true);
  const qr = await request('/api/bookings', booking(['3A'])); assert.equal((await request(`/api/bookings/${qr.data.id}/pay`, { paymentMethod: 'promptpay' })).data.booking.payment_method, 'promptpay');
  const history = await request('/api/users/traveler/bookings'); assert.ok(history.data.some(b => b.id === qr.data.id && b.payment_status === 'paid'));
});
test('expiry releases seats exactly once and prevents payment', async () => {
  const reservation = await request('/api/bookings', booking(['4A'])); assert.equal(reservation.status, 201);
  await db.execute({ sql: 'UPDATE bookings SET expires_at = ? WHERE id = ?', args: [new Date(Date.now() - 1000).toISOString(), reservation.data.id] });
  assert.equal((await request(`/api/bookings/${reservation.data.id}/pay`, { paymentMethod: 'promptpay' })).status, 410);
  assert.equal((await request(`/api/trips/${fixture.tomorrow}-van/seats`)).data.occupiedSeats.includes('4A'), false);
  const before = Number((await db.execute({ sql: 'SELECT available_seats FROM trips WHERE id = ?', args: [`${fixture.tomorrow}-van`] })).rows[0].available_seats);
  await request(`/api/bookings/${reservation.data.id}`);
  assert.equal(Number((await db.execute({ sql: 'SELECT available_seats FROM trips WHERE id = ?', args: [`${fixture.tomorrow}-van`] })).rows[0].available_seats), before);
  assert.equal((await request('/api/bookings', booking(['4A']))).status, 201);
});
