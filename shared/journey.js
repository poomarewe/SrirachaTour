export const VAN_ROWS = [[null, null, null, '1A', '1B'], ['2A', null, null, '2B', '2C'], ['3A', null, null, '3B', '3C'], ['4A', '4B', '4C', '4D', '4E']];
export const BUS_ROWS = Array.from({ length: 5 }, (_, i) => [`${i + 1}A`, `${i + 1}B`, null, `${i + 1}C`, `${i + 1}D`]);
export function seatRows(capacity) { return Number(capacity) === 13 ? VAN_ROWS : Number(capacity) === 20 ? BUS_ROWS : []; }
export function seatLabels(capacity) { return seatRows(capacity).flat().filter(Boolean); }
export function bangkokDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = key => parts.find(p => p.type === key).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function departureTimestamp(date, time) { return Date.parse(`${date}T${time.length === 5 ? time + ':00' : time}+07:00`); }
export function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00+07:00`);
  return Number.isFinite(parsed.getTime()) && bangkokDate(parsed) === date;
}
export function isBookable(trip, now = Date.now()) {
  return trip?.status === 'scheduled' && departureTimestamp(trip.departure_date, trip.departure_time || trip.departure || '') > now;
}
export function contactErrors(passenger = {}) {
  const errors = {};
  if (typeof passenger.name !== 'string' || !passenger.name.trim() || passenger.name.trim().length > 120) errors.name = 'nameRequired';
  if (typeof passenger.phone !== 'string' || passenger.phone.length > 30 || !/^\+?[\d ()-]+$/.test(passenger.phone.trim()) || !/^\d{7,15}$/.test(passenger.phone.replace(/\D/g, ''))) errors.phone = 'phoneInvalid';
  if (passenger.email && (typeof passenger.email !== 'string' || passenger.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passenger.email.trim()))) errors.email = 'emailInvalid';
  return errors;
}
export function normalizeBooking(row) {
  let seats = row.seats || row.seat_numbers || [];
  if (typeof seats === 'string') { try { seats = JSON.parse(seats); } catch { seats = []; } }
  const trip = row.trip || row;
  return {
    id: row.id, username: row.username, code: row.code || row.booking_code, ticket: row.ticket || row.ticket_number,
    status: row.payment_status || row.status, bookingStatus: row.booking_status || 'confirmed', expired: /hold expired/i.test(row.notes || ''),
    total: Number(row.total ?? row.total_amount), expiresAt: row.expiresAt || row.expires_at,
    seats, passenger: row.passenger || { name: row.passenger_name, phone: row.passenger_phone, email: row.passenger_email || '' },
    trip: { ...trip, id: row.trip_id || trip.id, departure: trip.departure || trip.departure_time, arrival: trip.arrival || trip.arrival_time, fare: Number(trip.fare), vehicle: trip.vehicle || trip.vehicle_type },
  };
}
export function holdActive(booking, now = Date.now()) {
  return booking?.status === 'pending_payment' && booking.bookingStatus !== 'cancelled' && Date.parse(booking.expiresAt) > now;
}
