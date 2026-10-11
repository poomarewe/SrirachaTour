import { randomUUID } from 'node:crypto';
import { contactErrors, seatLabels, isBookable } from '../shared/journey.js';
import { BookingError, releaseExpiredBookings } from './reservations.js';

const fields = ['passenger_name', 'passenger_phone', 'passenger_email', 'seats', 'payment_status', 'booking_status', 'notes'];
const invalid = message => new BookingError(400, 'INVALID_BOOKING', message);

export async function editBooking(db, id, body, remove = false) {
  if (!remove && (!body || typeof body !== 'object' || Array.isArray(body) || !fields.some(key => Object.hasOwn(body, key)))) throw invalid('No editable reservation details supplied.');
  await releaseExpiredBookings(db);
  const tx = await db.transaction('write');
  try {
    const current = (await tx.execute({ sql: 'SELECT * FROM bookings WHERE id = ?', args: [id] })).rows[0];
    if (!current) throw new BookingError(404, 'BOOKING_NOT_FOUND', 'Reservation not found.');
    if (remove) {
      // Existing cancellation trigger restores inventory once before deletion.
      await tx.execute({ sql: "UPDATE bookings SET booking_status = 'cancelled' WHERE id = ? AND booking_status != 'cancelled'", args: [id] });
      await tx.execute({ sql: 'DELETE FROM booking_seats WHERE booking_id = ?', args: [id] });
      await tx.execute({ sql: 'DELETE FROM bookings WHERE id = ?', args: [id] });
    } else {
      const changes = Object.fromEntries(fields.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
      const next = { ...current, ...changes };
      if (['passenger_name', 'passenger_phone', 'passenger_email'].some(key => key in changes)) {
        if (Object.keys(contactErrors({ name: next.passenger_name, phone: next.passenger_phone, email: next.passenger_email })).length) throw invalid('Enter a valid name, phone number and optional email.');
        for (const key of ['passenger_name', 'passenger_phone', 'passenger_email']) if (key in changes) changes[key] = (changes[key] || '').trim();
      }
      if (!['pending_payment', 'paid', 'refunded', 'cancelled', 'failed'].includes(next.payment_status)) throw invalid('Invalid payment status.');
      if (!['confirmed', 'completed', 'cancelled'].includes(next.booking_status)) throw invalid('Invalid reservation status.');
      if (next.payment_status === 'failed' && next.booking_status !== 'cancelled') throw invalid('Use pending_payment for a failed demo payment that still holds seats, or cancel the reservation.');
      if ('notes' in changes && (typeof changes.notes !== 'string' || changes.notes.length > 2000)) throw invalid('Notes must be text, up to 2000 characters.');
      if (['refunded', 'cancelled'].includes(next.payment_status)) next.booking_status = changes.booking_status = 'cancelled';
      const originalSeats = JSON.parse(current.seat_numbers);
      const seats = changes.seats ?? originalSeats;
      const trip = (await tx.execute({ sql: 'SELECT * FROM trips WHERE id = ?', args: [current.trip_id] })).rows[0];
      if (!Array.isArray(seats) || !seats.length || seats.some(s => typeof s !== 'string') || new Set(seats).size !== seats.length || ('seats' in changes && seats.some(s => !seatLabels(trip.total_seats).includes(s)))) throw invalid('Choose valid, unique seats on this trip.');
      const seatsChanged = seats.length !== originalSeats.length || seats.some(s => !originalSeats.includes(s));
      const reactivating = current.booking_status === 'cancelled' && next.booking_status !== 'cancelled';
      const inventoryChanged = seatsChanged || (current.booking_status === 'cancelled') !== (next.booking_status === 'cancelled');
      const hasHold = next.expires_at && Date.parse(next.expires_at) > Date.now();
      if (next.booking_status !== 'cancelled' && (reactivating || next.payment_status !== current.payment_status) && ['pending_payment', 'failed'].includes(next.payment_status) && !hasHold) throw new BookingError(410, 'HOLD_EXPIRED', 'The reservation hold has expired. Create a new reservation for pending payment.');
      if (next.booking_status !== 'cancelled' && (seatsChanged || reactivating) && !isBookable(trip)) throw new BookingError(410, 'TRIP_UNAVAILABLE', 'Seats cannot be changed or restored on an unavailable departure.');
      if (current.booking_status === 'cancelled' && !hasHold && next.payment_status === 'paid' && (reactivating || current.payment_status !== 'paid')) throw new BookingError(410, 'HOLD_EXPIRED', 'An expired or cancelled hold cannot be marked paid. Create a new reservation.');
      delete changes.seats;
      if (inventoryChanged) {
        await tx.execute({ sql: "UPDATE bookings SET booking_status = 'cancelled' WHERE id = ? AND booking_status != 'cancelled'", args: [id] });
        await tx.execute({ sql: 'DELETE FROM booking_seats WHERE booking_id = ?', args: [id] });
        if (next.booking_status !== 'cancelled') {
          const occupied = await tx.execute({ sql: `SELECT seat_number FROM booking_seats WHERE trip_id = ? AND seat_number IN (${seats.map(() => '?').join(',')})`, args: [current.trip_id, ...seats] });
          const availability = (await tx.execute({ sql: 'SELECT available_seats FROM trips WHERE id = ?', args: [current.trip_id] })).rows[0];
          if (occupied.rows.length || Number(availability.available_seats) < seats.length) throw new BookingError(409, 'SEAT_CONFLICT', 'Some selected seats are already reserved. Choose different seats.');
        }
        changes.seat_numbers = JSON.stringify(seats);
        changes.seats_count = seats.length;
        changes.total_amount = Math.round(Number(current.total_amount) / Number(current.seats_count) * seats.length * 100) / 100;
        changes.booking_status = next.booking_status;
        // Reconfirm after updating the count so the trigger deducts the new count.
        const countKeys = ['seat_numbers', 'seats_count', 'total_amount'];
        await tx.execute({ sql: `UPDATE bookings SET ${countKeys.map(k => `${k} = ?`).join(', ')} WHERE id = ?`, args: [...countKeys.map(k => changes[k]), id] });
      }
      const keys = Object.keys(changes);
      if (keys.length) await tx.execute({ sql: `UPDATE bookings SET ${keys.map(key => `${key} = ?`).join(', ')} WHERE id = ?`, args: [...keys.map(key => changes[key]), id] });
      if (inventoryChanged && next.booking_status !== 'cancelled') {
        if (next.booking_status === 'completed') {
          // The legacy trigger deducts only on reconfirmation.
          await tx.execute({ sql: 'UPDATE trips SET available_seats = available_seats - ? WHERE id = ?', args: [seats.length, current.trip_id] });
        }
        for (const seat of seats) await tx.execute({ sql: 'INSERT INTO booking_seats (id, trip_id, booking_id, seat_number) VALUES (?, ?, ?, ?)', args: [`seat_${randomUUID()}`, current.trip_id, id, seat] });
      }
    }
    await tx.commit();
    return { success: true };
  } catch (error) {
    await tx.rollback();
    if (error.message?.includes('UNIQUE constraint failed: booking_seats')) throw new BookingError(409, 'SEAT_CONFLICT', 'Some selected seats are already reserved. Choose different seats.');
    throw error;
  } finally { tx.close(); }
}
