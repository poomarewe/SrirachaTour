import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureDatabase } from './fixtures.js';
let fixture, server, db, base;
async function request(path, body, user = 'admin') {
  const res = await fetch(base + path, { method: body === undefined ? 'GET' : 'PUT', headers: { 'Content-Type': 'application/json', 'x-admin-user': user }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, data: await res.json() };
}
before(async () => {
  fixture = await fixtureDatabase(); process.env.TURSO_DATABASE_URL = fixture.url; process.env.TURSO_AUTH_TOKEN = '';
  const module = await import('../server.js'); db = module.db; await module.databaseReady;
  server = module.app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve)); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { if (server) await new Promise(resolve => server.close(resolve)); db?.close(); await fixture?.cleanup(); });
test('route and trip editing is restricted to admins', async () => {
  for (const path of ['/api/admin/routes/outbound', `/api/admin/trips/${fixture.tomorrow}-van`]) assert.equal((await request(path, { fare: 220, base_fare: 220 }, 'traveler')).status, 403);
  assert.equal((await request('/api/admin/locations', undefined, 'traveler')).status, 403);
});
test('route defaults and translated durations update without repricing existing trips', async () => {
  assert.equal((await request('/api/admin/routes/outbound', { base_fare: 210.5, duration_minutes: 95, distance_km: 80 })).status, 200);
  const route = (await request('/api/admin/routes')).data.find(r => r.id === 'outbound');
  assert.equal(route.base_fare, 210.5); assert.equal(route.duration_display_en, '1h 35m'); assert.equal(route.duration_display_th, '1 ชม. 35 นาที');
  assert.equal(route.origin_id, 'src'); assert.equal(route.destination_id, 'bkk');
  assert.equal((await request('/api/admin/trips')).data.find(t => t.id === `${fixture.tomorrow}-van`).fare, 180);
  assert.equal((await request('/api/admin/locations')).data.length, 2);
});
test('invalid and duplicate route changes roll back and unknown records return 404', async () => {
  for (const body of [{ origin_id: 'bkk' }, { base_fare: -1 }, { duration_minutes: 0 }, { duration_minutes: 1.5 }, { destination_id: 'missing' }, { base_fare: null }]) assert.equal((await request('/api/admin/routes/outbound', body)).status, 400);
  assert.equal((await request('/api/admin/routes/outbound', { origin_id: 'bkk', destination_id: 'src', base_fare: 999 })).status, 409);
  assert.equal((await request('/api/admin/routes/missing', { base_fare: 10 })).status, 404);
  assert.equal((await request('/api/admin/routes')).data.find(r => r.id === 'outbound').base_fare, 210.5);
});
test('existing departures save date, time, fare and route and vehicle changes preserve inventory', async () => {
  const path = `/api/admin/trips/${fixture.tomorrow}-return`;
  assert.equal((await request(path, { route_id: 'outbound', vehicle_id: 'bus', departure_time: '22:15', arrival_time: '23:45', departure_date: fixture.tomorrow, fare: 230, status: 'scheduled' })).status, 200);
  const trip = (await request('/api/admin/trips')).data.find(t => t.id === `${fixture.tomorrow}-return`);
  assert.equal(trip.route_id, 'outbound'); assert.equal(trip.vehicle_id, 'bus'); assert.equal(trip.total_seats, 20); assert.equal(trip.available_seats, 20); assert.equal(trip.fare, 230); assert.equal(trip.departure_time, '22:15');
  for (const body of [{ fare: -1 }, { fare: null }, { departure_time: '25:00' }, { departure_date: '2020-01-01' }, { departure_date: '2026-02-30' }, { vehicle_id: 'missing' }, { status: 'wrong' }, { total_seats: 21 }, { available_seats: 21 }]) assert.equal((await request(path, body)).status, 400);
  assert.equal((await request('/api/admin/trips/missing', { fare: 200 })).status, 404);
});
test('booked trips keep allocated seats and booking totals when fares change', async () => {
  const tripId = `${fixture.tomorrow}-van`;
  const res = await fetch(base + '/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tripId, seats: ['1A'], username: 'traveler', passenger: { name: 'Traveler', phone: '0812345678' } }) });
  assert.equal(res.status, 201); const booking = await res.json();
  for (const body of [{ vehicle_id: 'bus' }, { route_id: 'inbound' }, { total_seats: 20 }]) assert.equal((await request(`/api/admin/trips/${tripId}`, body)).status, 409);
  assert.equal((await request(`/api/admin/trips/${tripId}`, { available_seats: 13 })).status, 400);
  assert.equal((await request(`/api/admin/trips/${tripId}`, { fare: 250 })).status, 200);
  const trip = (await request('/api/admin/trips')).data.find(t => t.id === tripId); assert.equal(trip.available_seats, 12);
  const saved = await (await fetch(base + `/api/bookings/${booking.id}`)).json(); assert.equal(saved.total_amount, 180); assert.deepEqual(JSON.parse(saved.seat_numbers), ['1A']);
  assert.equal((await request('/api/admin/routes/outbound', { origin_id: 'bkk', destination_id: 'src' })).status, 409);
});
