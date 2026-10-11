import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, nextTick } from 'vue';
import { useJourney } from '../src/useJourney.js';
let scope, j, storage;
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const trip = { id: 'trip', departure_date: '2099-01-01', departure_time: '08:00', arrival_time: '10:15', fare: 180, total_seats: 13, status: 'scheduled', from_location: 'Sriracha', to_location: 'Bangkok' };
const row = { id: 'booking', trip_id: 'trip', username: 'traveler', booking_code: 'ST-test', ticket_number: 'ET-test', total_amount: 360, seat_numbers: '["1A","1B"]', passenger_name: 'Traveler', passenger_phone: '0812345678', payment_status: 'pending_payment', booking_status: 'confirmed', expires_at: '2099-01-01T01:00:00Z', ...trip, id: 'booking' };
beforeEach(() => {
  storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  globalThis.location = { pathname: '/th', search: '' };
  const change = url => { const parsed = new URL(url, 'http://localhost'); location.pathname = parsed.pathname; location.search = parsed.search; };
  globalThis.history = { pushState: (_, __, url) => change(url), replaceState: (_, __, url) => change(url) };
  globalThis.document = { documentElement: { lang: 'th' }, querySelector: () => null, addEventListener() {}, removeEventListener() {} };
  globalThis.window = { scrollTo() {}, addEventListener() {}, removeEventListener() {} };
  globalThis.fetch = async () => response([]);
  scope = effectScope(); j = scope.run(useJourney); j.user = { username: 'traveler', role: 'user' };
});
afterEach(() => { j.dispose(); scope.stop(); });
test('startup stays loading until the remembered user and initial rides are ready', async () => {
  j.user = null; storage.set('sriracha_username', 'traveler');
  const auth = deferred(), rides = deferred();
  globalThis.fetch = path => path.startsWith('/api/auth/me') ? auth.promise : rides.promise;
  const startup = j.init(); await nextTick();
  assert.equal(j.ready, false);
  auth.resolve(response({ username: 'traveler', role: 'user' })); await nextTick();
  assert.equal(j.ready, false);
  rides.resolve(response([])); await startup;
  assert.equal(j.ready, true); assert.equal(j.user.username, 'traveler');
});
test('failed remembered sign-in exits startup loading and offers sign-in again', async () => {
  j.user = null; storage.set('sriracha_username', 'traveler');
  globalThis.fetch = async () => { throw new Error('offline'); };
  await j.init();
  assert.equal(j.ready, true); assert.equal(j.user, null);
  assert.equal(j.username, 'traveler'); assert.equal(j.authError, 'loginError');
});
test('outdated searches cannot replace the newest route results', async () => {
  const first = deferred(), second = deferred(); let count = 0;
  globalThis.fetch = () => ++count === 1 ? first.promise : second.promise;
  const old = j.fetchTrips(), current = j.fetchTrips();
  second.resolve(response([{ trip_id: 'new', fare: 180, seats: 13 }])); await current;
  first.resolve(response([{ trip_id: 'old', fare: 180, seats: 13 }])); await old;
  assert.equal(j.trips[0].id, 'new'); assert.equal(j.tripsBusy, false);
});
test('seat conflicts preserve contact details and every non-conflicting seat', async () => {
  j.selectedTrip = { ...trip }; j.capacity = 13; j.seats = ['1A', '1B']; j.passenger = { name: 'Traveler', phone: '0812345678', email: '' };
  globalThis.fetch = async path => path === '/api/bookings' ? response({ takenSeats: ['1A'], error: 'conflict' }, 409) : response({ trip, totalSeats: 13, occupiedSeats: ['1A'], vehicleType: 'VIP Minivan' });
  await j.reserve(); assert.deepEqual([...j.seats], ['1B']); assert.equal(j.passenger.name, 'Traveler'); assert.equal(j.checkoutError, 'seatConflict');
});
test('a lost reservation response resumes the existing hold without posting twice', async () => {
  j.selectedTrip = { ...trip }; j.capacity = 13; j.seats = ['1A', '1B']; j.passenger = { name: 'Traveler', phone: '0812345678', email: '' };
  let posts = 0;
  globalThis.fetch = async path => { if (path === '/api/bookings') { posts++; throw new Error('lost response'); } return response([row]); };
  await j.reserve(); assert.equal(posts, 1); assert.equal(j.page, 'payment'); assert.equal(j.booking.id, 'booking'); assert.equal(j.uncertain, false); assert.equal(j.busy, false);
  assert.deepEqual([...storage.keys()], ['sriracha_active_booking']);
});
test('an unverified reservation blocks another submission until the lookup succeeds', async () => {
  j.selectedTrip = { ...trip }; j.capacity = 13; j.seats = ['1A', '1B']; j.passenger = { name: 'Traveler', phone: '0812345678', email: '' };
  let posts = 0;
  globalThis.fetch = async path => { if (path === '/api/bookings') posts++; throw new Error('offline'); };
  await j.reserve(); await j.reserve(); assert.equal(posts, 1); assert.equal(j.uncertain, true);
  globalThis.fetch = async () => response([row]); await j.reconcile(); assert.equal(j.page, 'payment'); assert.equal(j.uncertain, false);
});
test('refreshing an already-paid payment route opens a ticket without a stuck loading state', async () => {
  j.page = 'payment'; globalThis.fetch = async () => response({ ...row, payment_status: 'paid' });
  await j.loadBooking('booking'); assert.equal(j.page, 'ticket'); assert.equal(j.bookingBusy, false); assert.equal(j.paid(j.booking), true);
});
test('language switching keeps the draft and only persists the language preference', async () => {
  j.selectedTrip = { ...trip }; j.page = 'checkout'; j.seats = ['1A']; j.passenger.name = 'Traveler';
  j.switchLanguage(); assert.equal(j.locale, 'en'); assert.deepEqual([...j.seats], ['1A']); assert.equal(j.passenger.name, 'Traveler'); assert.ok(location.pathname.startsWith('/en/checkout')); assert.deepEqual([...storage.keys()], ['sriracha_locale']);
});
test('seat loading errors block checkout and unsupported layouts do not expose phantom seats', async () => {
  j.selectedTrip = { ...trip }; j.seats = ['1A']; j.passenger = { name: 'Traveler', phone: '0812345678', email: '' };
  globalThis.fetch = async () => response({ error: 'unavailable' }, 500); await j.loadSeats(); assert.equal(j.validCheckout(), false); assert.equal(j.seatsError, 'seatLoadError');
  globalThis.fetch = async () => response({ trip, totalSeats: 12, occupiedSeats: [], vehicleType: 'VIP Minivan' }); await j.loadSeats(); assert.equal(j.validCheckout(), false); assert.equal(j.seatsError, 'unsupported');
});
test('invalid dates never crash the search and expired holds cannot submit payment', async () => {
  j.route.date = '2026-13-99'; await nextTick(); assert.equal(j.validRoute(), false); assert.equal(j.dateLabel(j.route.date), '');
  j.route.date = '2026-02-30'; assert.equal(j.validRoute(), false);
  j.booking = { ...row, status: 'pending_payment', bookingStatus: 'confirmed', expiresAt: new Date(Date.now() - 1000).toISOString() };
  let requests = 0; globalThis.fetch = async () => { requests++; return response({}); };
  await j.pay(); assert.equal(requests, 0); assert.equal(j.activeHold(j.booking), false);
});
