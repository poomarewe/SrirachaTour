import { randomUUID } from 'node:crypto';
import { contactErrors, isBookable, seatLabels } from '../shared/journey.js';

export class BookingError extends Error {
  constructor(status, code, message, extra = {}) { super(message); Object.assign(this, { status, code, extra }); }
}
export async function releaseExpiredBookings(db) {
  const now = new Date().toISOString();
  await db.batch([
    { sql: "UPDATE bookings SET payment_status = 'cancelled', booking_status = 'cancelled', notes = 'Reservation hold expired (10m timeout)' WHERE payment_status = 'pending_payment' AND expires_at IS NOT NULL AND expires_at <= ?", args: [now] },
    { sql: "DELETE FROM booking_seats WHERE booking_id IN (SELECT id FROM bookings WHERE booking_status = 'cancelled')", args: [] },
  ], 'write');
}
export async function createReservation(db, body) {
  const { tripId, seats, passenger, username } = body || {};
  if (typeof tripId !== 'string' || !Array.isArray(seats) || !seats.length || seats.length > 20 || seats.some(seat => typeof seat !== 'string') || new Set(seats).size !== seats.length) throw new BookingError(400, 'INVALID_SEATS', 'Choose valid, unique seats.');
  if (!passenger || Object.keys(contactErrors(passenger)).length) throw new BookingError(400, 'INVALID_CONTACT', 'Enter a valid name, phone number and optional email.');
  if (typeof username !== 'string' || !username.trim()) throw new BookingError(400, 'SIGN_IN_REQUIRED', 'Sign in before reserving seats.');
  await releaseExpiredBookings(db);
  const tx = await db.transaction('write');
  try {
    const user = await tx.execute({ sql: 'SELECT username FROM users WHERE LOWER(username) = LOWER(?)', args: [username.trim()] });
    if (!user.rows.length) throw new BookingError(400, 'SIGN_IN_REQUIRED', 'Sign in before reserving seats.');
    const result = await tx.execute({ sql: `SELECT t.*, orig.name_en AS from_location, orig.name_th AS from_location_th,
      dest.name_en AS to_location, dest.name_th AS to_location_th, orig.station_name_en AS from_station,
      orig.station_name_th AS from_station_th, dest.station_name_en AS to_station, dest.station_name_th AS to_station_th,
      COALESCE(v.vehicle_type, 'VIP Minivan') AS vehicle_type FROM trips t
      JOIN routes r ON t.route_id = r.id JOIN locations orig ON r.origin_id = orig.id
      JOIN locations dest ON r.destination_id = dest.id LEFT JOIN vehicles v ON t.vehicle_id = v.id WHERE t.id = ?`, args: [tripId] });
    const trip = result.rows[0];
    if (!trip) throw new BookingError(404, 'TRIP_NOT_FOUND', 'Selected trip was not found.');
    if (!isBookable(trip)) throw new BookingError(410, 'TRIP_UNAVAILABLE', 'This trip is no longer available for booking.');
    const validSeats = seatLabels(trip.total_seats);
    if (!validSeats.length || seats.some(seat => !validSeats.includes(seat))) throw new BookingError(400, 'INVALID_SEATS', 'These seats are not available on this vehicle.');
    const occupied = await tx.execute({ sql: `SELECT seat_number FROM booking_seats WHERE trip_id = ? AND seat_number IN (${seats.map(() => '?').join(',')})`, args: [tripId, ...seats] });
    if (occupied.rows.length) throw new BookingError(409, 'SEAT_CONFLICT', 'Some seats have just been reserved. Choose replacement seats.', { takenSeats: occupied.rows.map(row => row.seat_number) });
    if (Number(trip.available_seats) < seats.length) throw new BookingError(409, 'SEAT_CONFLICT', 'There are not enough available seats.', { takenSeats: [] });
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase();
    const bookingId = `bk_${randomUUID()}`, bookingCode = `ST${suffix}`, ticketNumber = `ET-SR${suffix}`;
    const total = Number(trip.fare) * seats.length;
    const expiresAt = new Date(Date.now() + 600000).toISOString();
    const contact = { name: passenger.name.trim(), phone: passenger.phone.trim(), email: (passenger.email || '').trim() };
    await tx.execute({ sql: `INSERT INTO bookings (id, booking_code, trip_id, username, passenger_name, passenger_phone, passenger_email,
      seats_count, seat_numbers, total_amount, payment_status, booking_status, ticket_number, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment', 'confirmed', ?, ?)`,
      args: [bookingId, bookingCode, tripId, user.rows[0].username, contact.name, contact.phone, contact.email, seats.length, JSON.stringify(seats), total, ticketNumber, expiresAt] });
    for (const seat of seats) await tx.execute({ sql: 'INSERT INTO booking_seats (id, trip_id, booking_id, seat_number) VALUES (?, ?, ?, ?)', args: [`seat_${randomUUID()}`, tripId, bookingId, seat] });
    await tx.commit();
    return { id: bookingId, code: bookingCode, status: 'pending_payment', total, ticket: ticketNumber, expiresAt, trip, seats, passenger: contact };
  } catch (error) {
    await tx.rollback();
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint failed: booking_seats')) throw new BookingError(409, 'SEAT_CONFLICT', 'Some seats have just been reserved. Choose replacement seats.');
    throw error;
  } finally { tx.close(); }
}
