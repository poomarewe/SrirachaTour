import { validDate, departureTimestamp, seatLabels } from '../shared/journey.js';

class EditError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function number(value, label, integer = false, minimum = 0) {
  const n = Number(value);
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(n) || n < minimum || (integer && !Number.isSafeInteger(n))) throw new EditError(400, `${label} is invalid.`);
  return n;
}
async function edit(db, table, id, body, fields, prepare) {
  if (!body || Array.isArray(body) || typeof body !== 'object' || !fields.some(key => Object.hasOwn(body, key))) throw new EditError(400, 'No editable fields supplied.');
  const tx = await db.transaction('write');
  try {
    const current = (await tx.execute({ sql: `SELECT * FROM ${table} WHERE id = ?`, args: [id] })).rows[0];
    if (!current) throw new EditError(404, `${table === 'trips' ? 'Trip' : 'Route'} not found.`);
    const changes = Object.fromEntries(fields.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
    await prepare(tx, current, changes);
    const keys = Object.keys(changes);
    await tx.execute({ sql: `UPDATE ${table} SET ${keys.map(key => `${key} = ?`).join(', ')} WHERE id = ?`, args: [...keys.map(key => changes[key]), id] });
    await tx.commit();
    return { success: true };
  } catch (error) {
    await tx.rollback();
    if (error.message.includes('UNIQUE constraint failed')) throw new EditError(409, 'A route with these locations already exists.');
    throw error;
  } finally { tx.close(); }
}

export function updateTrip(db, id, body) {
  return edit(db, 'trips', id, body, ['route_id', 'vehicle_id', 'departure_date', 'departure_time', 'arrival_time', 'fare', 'status', 'total_seats', 'available_seats'], async (tx, current, changes) => {
    if ('fare' in changes) changes.fare = number(changes.fare, 'Fare');
    if ('departure_date' in changes && !validDate(changes.departure_date)) throw new EditError(400, 'Enter a valid departure date.');
    for (const key of ['departure_time', 'arrival_time']) if (key in changes && (typeof changes[key] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(changes[key]))) throw new EditError(400, 'Enter valid departure and arrival times.');
    if ('status' in changes && !['scheduled', 'boarding', 'departed', 'completed', 'cancelled'].includes(changes.status)) throw new EditError(400, 'Invalid trip status.');
    for (const key of ['route_id', 'vehicle_id']) if (key in changes && (typeof changes[key] !== 'string' || !changes[key])) throw new EditError(400, 'Choose a valid route and vehicle.');
    const merged = { ...current, ...changes };
    if ((merged.departure_date !== current.departure_date || merged.departure_time !== current.departure_time) && ['scheduled', 'boarding'].includes(merged.status) && departureTimestamp(merged.departure_date, merged.departure_time) <= Date.now()) throw new EditError(400, 'A scheduled departure must be in the future.');
    if ('route_id' in changes && !(await tx.execute({ sql: 'SELECT id FROM routes WHERE id = ? AND is_active = 1', args: [changes.route_id] })).rows.length) throw new EditError(400, 'Choose an active route.');
    if ('vehicle_id' in changes) {
      const vehicle = (await tx.execute({ sql: 'SELECT total_seats FROM vehicles WHERE id = ? AND is_active = 1', args: [changes.vehicle_id] })).rows[0];
      if (!vehicle) throw new EditError(400, 'Choose an active vehicle.');
      if (changes.vehicle_id !== current.vehicle_id) changes.total_seats = Number(vehicle.total_seats);
    }
    const structureChanged = ['route_id', 'vehicle_id', 'total_seats'].some(key => key in changes && String(changes[key]) !== String(current[key]));
    if (structureChanged && (await tx.execute({ sql: 'SELECT id FROM bookings WHERE trip_id = ? LIMIT 1', args: [id] })).rows.length) throw new EditError(409, 'This trip has bookings. Its route, vehicle and seat layout cannot be changed.');
    const capacity = 'total_seats' in changes ? number(changes.total_seats, 'Seat capacity', true, 1) : Number(current.total_seats);
    if ('total_seats' in changes) changes.total_seats = capacity;
    if (capacity !== Number(current.total_seats)) {
      const vehicle = (await tx.execute({ sql: 'SELECT total_seats FROM vehicles WHERE id = ?', args: [changes.vehicle_id ?? current.vehicle_id] })).rows[0];
      if (!seatLabels(capacity).length || !vehicle || capacity !== Number(vehicle.total_seats)) throw new EditError(400, 'Seat capacity must match the selected vehicle.');
    }
    if (capacity !== Number(current.total_seats)) changes.available_seats = capacity - (Number(current.total_seats) - Number(current.available_seats));
    if ('available_seats' in changes) {
      changes.available_seats = number(changes.available_seats, 'Available seats', true);
      const allocated = Number((await tx.execute({ sql: 'SELECT COUNT(*) AS n FROM booking_seats WHERE trip_id = ?', args: [id] })).rows[0].n);
      if (changes.available_seats > capacity - allocated) throw new EditError(400, 'Available seats cannot include reserved seats.');
    }
  });
}

export function updateRoute(db, id, body) {
  return edit(db, 'routes', id, body, ['origin_id', 'destination_id', 'base_fare', 'duration_minutes', 'distance_km'], async (tx, current, changes) => {
    if ('base_fare' in changes) changes.base_fare = number(changes.base_fare, 'Base fare');
    if ('distance_km' in changes) changes.distance_km = changes.distance_km === null ? null : number(changes.distance_km, 'Distance');
    if ('duration_minutes' in changes) {
      const minutes = number(changes.duration_minutes, 'Duration', true, 1);
      changes.duration_minutes = minutes;
      const hours = Math.floor(minutes / 60), rest = minutes % 60;
      changes.duration_display_en = [hours && `${hours}h`, rest && `${rest}m`].filter(Boolean).join(' ');
      changes.duration_display_th = [hours && `${hours} ชม.`, rest && `${rest} นาที`].filter(Boolean).join(' ');
    }
    const origin = changes.origin_id ?? current.origin_id, destination = changes.destination_id ?? current.destination_id;
    if (origin === destination) throw new EditError(400, 'Origin and destination must be different.');
    for (const key of ['origin_id', 'destination_id']) if (key in changes && (typeof changes[key] !== 'string' || !changes[key] || !(await tx.execute({ sql: 'SELECT id FROM locations WHERE id = ? AND is_active = 1', args: [changes[key]] })).rows.length)) throw new EditError(400, 'Choose an active location.');
    if ((origin !== current.origin_id || destination !== current.destination_id) && (await tx.execute({ sql: 'SELECT b.id FROM bookings b JOIN trips t ON b.trip_id = t.id WHERE t.route_id = ? LIMIT 1', args: [id] })).rows.length) throw new EditError(409, 'This route has bookings. Its origin and destination cannot be changed.');
  });
}
