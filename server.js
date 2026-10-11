import express from 'express';
import { createClient } from '@libsql/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'node:url';
import { createReservation, releaseExpiredBookings as expireReservations } from './server/reservations.js';
import { updateTrip, updateRoute } from './server/adminEdits.js';

// Load environment variables (.env.local takes priority)
if (fs.existsSync('.env.local')) {
  dotenv.config({ path: '.env.local' });
} else {
  dotenv.config();
}

export const app = express();
app.locals.paymentRandom = Math.random;
app.use(express.json());
app.use(express.static('dist'));

// Enable CORS for development (e.g. Vite on localhost:5173)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Initialize Turso (libSQL) database client
const dbUrl = process.env.TURSO_DATABASE_URL || 'file:local.db';
const dbAuthToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient({
  url: dbUrl,
  authToken: dbAuthToken,
});

// Auto-initialize tables & migrations if needed
async function initDatabase() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Ensure default admin user exists
    await db.execute({
      sql: `INSERT OR IGNORE INTO users (id, username, role) VALUES ('usr_admin', 'admin', 'admin')`,
      args: [],
    });

    // Auto-migrate bookings columns if not present
    try {
      await db.execute(`ALTER TABLE bookings ADD COLUMN username TEXT;`);
    } catch (_) {}
    try {
      await db.execute(`ALTER TABLE bookings ADD COLUMN expires_at TEXT;`);
    } catch (_) {}

    console.log('[Turso] Database schema verified and initialized.');
  } catch (err) {
    console.error('[Turso Init Error]:', err.message);
  }
}
export const databaseReady = initDatabase();

// Helper: Clean up expired reservations and release held seats back to inventory
async function releaseExpiredBookings() { await expireReservations(db); }

// -----------------------------------------------------------------------------
// AUTH / USER LOGIN (Simple username login: creates if not found, no password)
// -----------------------------------------------------------------------------
app.post('/api/auth/login', async (req, res) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    if (username.length > 80) return res.status(400).json({ error: 'Username must be 80 characters or fewer.' });
    if (!username) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    // Check if user already exists (case-insensitive)
    const existing = await db.execute({
      sql: `SELECT * FROM users WHERE LOWER(username) = LOWER(?)`,
      args: [username],
    });

    if (existing.rows.length > 0) {
      return res.json({ success: true, user: existing.rows[0], isNew: false });
    }

    // Auto-create new user
    const newId = `usr_${Date.now()}`;
    const role = username.toLowerCase() === 'admin' ? 'admin' : 'user';

    await db.execute({
      sql: `INSERT INTO users (id, username, role) VALUES (?, ?, ?)`,
      args: [newId, username, role],
    });

    const newUser = { id: newId, username, role, created_at: new Date().toISOString() };
    return res.status(201).json({ success: true, user: newUser, isNew: true });
  } catch (err) {
    console.error('[Auth Error]:', err.message);
    res.status(500).json({ error: 'Failed to process login', message: err.message });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const username = (req.query.username || '').trim();
    if (!username) return res.status(400).json({ error: 'Username required.' });

    const result = await db.execute({
      sql: `SELECT * FROM users WHERE LOWER(username) = LOWER(?)`,
      args: [username],
    });

    if (!result.rows.length) return res.status(404).json({ error: 'User not found.' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// PUBLIC: GET /api/trips - Query scheduled trips from Turso view
// -----------------------------------------------------------------------------
app.get('/api/trips', async (req, res) => {
  try {
    await releaseExpiredBookings();
    const { from, to, date } = req.query;
    let query = 'SELECT * FROM v_trip_catalog WHERE 1=1';
    const args = [];

    if (from) {
      query += ' AND (from_location = ? OR from_location_th = ?)';
      args.push(from, from);
    }
    if (to) {
      query += ' AND (to_location = ? OR to_location_th = ?)';
      args.push(to, to);
    }
    if (date) {
      query += ' AND departure_date = ?';
      args.push(date);
    }

    query += ' ORDER BY departure ASC';

    const result = await db.execute({ sql: query, args });
    res.json(result.rows);
  } catch (err) {
    console.error('[Turso Error] GET /api/trips failed:', err.message);
    res.status(500).json({ error: 'Failed to fetch trips from database', message: err.message });
  }
});

// -----------------------------------------------------------------------------
// PUBLIC: GET /api/trips/:id/seats - Get occupied seats and trip layout
// -----------------------------------------------------------------------------
app.get('/api/trips/:id/seats', async (req, res) => {
  try {
    const { id } = req.params;
    await releaseExpiredBookings();

    const tripRes = await db.execute({
      sql: `
        SELECT
          t.id,
          t.departure_date,
          t.departure_time,
          t.arrival_time,
          t.fare,
          t.total_seats,
          t.available_seats,
          t.status,
          COALESCE(v.vehicle_type, CASE WHEN t.total_seats <= 13 THEN 'VIP Minivan' ELSE 'Minibus' END) AS vehicle_type,
          COALESCE(v.name, 'Sriracha Tour Express') AS vehicle_name,
          orig.name_en AS from_location,
          orig.name_th AS from_location_th,
          dest.name_en AS to_location,
          dest.name_th AS to_location_th
        FROM trips t
        JOIN routes r ON t.route_id = r.id
        JOIN locations orig ON r.origin_id = orig.id
        JOIN locations dest ON r.destination_id = dest.id
        LEFT JOIN vehicles v ON t.vehicle_id = v.id
        WHERE t.id = ?
      `,
      args: [id],
    });

    if (!tripRes.rows.length) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const trip = tripRes.rows[0];

    // Occupied seats: paid bookings OR active pending holds (expires_at > now)
    const now = new Date().toISOString();
    const seatsRes = await db.execute({
      sql: `
        SELECT bs.seat_number
        FROM booking_seats bs
        JOIN bookings b ON bs.booking_id = b.id
        WHERE bs.trip_id = ?
          AND b.booking_status != 'cancelled' AND (
            b.payment_status = 'paid'
            OR (b.payment_status = 'pending_payment' AND (b.expires_at IS NULL OR b.expires_at > ?))
          )
      `,
      args: [id, now],
    });

    const occupiedSeats = seatsRes.rows.map(r => r.seat_number);

    res.json({
      trip,
      totalSeats: trip.total_seats,
      availableSeats: trip.available_seats,
      vehicleType: trip.vehicle_type,
      vehicleName: trip.vehicle_name,
      occupiedSeats,
    });
  } catch (err) {
    console.error('[Get Seats Error]:', err.message);
    res.status(500).json({ error: 'Failed to fetch seats', message: err.message });
  }
});

// -----------------------------------------------------------------------------
// PUBLIC: POST /api/bookings - Create passenger booking with 10-minute hold
// -----------------------------------------------------------------------------
app.post('/api/bookings', async (req, res) => {
  try { res.status(201).json(await createReservation(db, req.body)); }
  catch (error) {
    const status = error.status || (error.code === 'SQLITE_BUSY' ? 503 : 500);
    res.status(status).json({ error: error.status ? error.message : 'Could not reserve seats. Please check your booking before retrying.', code: error.status ? error.code : 'RESERVATION_ERROR', ...error.extra });
  }
});

// -----------------------------------------------------------------------------
// PUBLIC: POST /api/bookings/:id/pay - Simulate payment (10% fail, 90% success)
// -----------------------------------------------------------------------------
app.post('/api/bookings/:id/pay', async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod = 'promptpay' } = req.body;
    if (!['promptpay', 'card'].includes(paymentMethod)) return res.status(400).json({ error: 'Choose a supported payment method.' });

    await releaseExpiredBookings();

    const bookingRes = await db.execute({
      sql: `
        SELECT
          b.*,
          t.departure_date,
          t.departure_time,
          t.arrival_time,
          t.fare,
          orig.name_en AS from_location,
          orig.name_th AS from_location_th,
          dest.name_en AS to_location,
          dest.name_th AS to_location_th,
          orig.station_name_en AS from_station,
          orig.station_name_th AS from_station_th,
          dest.station_name_en AS to_station,
          dest.station_name_th AS to_station_th,
          COALESCE(v.vehicle_type, 'VIP Minivan') AS vehicle_type,
          COALESCE(v.name, 'Sriracha Tour Express') AS vehicle_name
        FROM bookings b
        JOIN trips t ON b.trip_id = t.id
        JOIN routes r ON t.route_id = r.id
        JOIN locations orig ON r.origin_id = orig.id
        JOIN locations dest ON r.destination_id = dest.id
        LEFT JOIN vehicles v ON t.vehicle_id = v.id
        WHERE b.id = ?
      `,
      args: [id],
    });

    if (!bookingRes.rows.length) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    const booking = bookingRes.rows[0];

    // If already paid, return existing ticket
    if (booking.payment_status === 'paid') {
      return res.json({
        success: true,
        alreadyPaid: true,
        booking,
        ticketNumber: booking.ticket_number,
      });
    }

    // Check expiration
    const now = new Date();
    const expiresAt = booking.expires_at ? new Date(booking.expires_at) : null;
    if (booking.payment_status === 'cancelled' || booking.booking_status === 'cancelled' || (expiresAt && now >= expiresAt)) {
      await releaseExpiredBookings();
      return res.status(410).json({
        error: 'Your 10-minute reservation hold has expired. Please select your seats again.',
        expired: true,
      });
    }

    // 10% Chance of payment failure simulation (User requirement)
    const isFailed = app.locals.paymentRandom() < 0.10;
    if (isFailed) {
      return res.status(400).json({
        success: false,
        failed: true,
        error: 'Payment failed: Transaction was declined by the bank/payment gateway. Please try again or use another payment method.',
        canRetry: true,
        expiresAt: booking.expires_at,
      });
    }

    // 90% Success: mark as paid
    const methodStr = paymentMethod === 'card' ? 'credit_card' : 'promptpay';
    const paymentUpdate = await db.execute({
      sql: `UPDATE bookings
            SET payment_status = 'paid',
                payment_method = ?,
                booking_status = 'confirmed'
            WHERE id = ? AND payment_status = 'pending_payment' AND booking_status = 'confirmed' AND expires_at > ?`,
      args: [methodStr, id, new Date().toISOString()],
    });

    if (!paymentUpdate.rowsAffected) {
      const latest = await db.execute({ sql: 'SELECT payment_status, payment_method FROM bookings WHERE id = ?', args: [id] });
      if (latest.rows[0]?.payment_status !== 'paid') return res.status(410).json({ error: 'The hold is no longer active.', expired: true });
      return res.json({ success: true, alreadyPaid: true, booking: { ...booking, ...latest.rows[0] }, ticketNumber: booking.ticket_number });
    }
    const updatedBooking = {
      ...booking,
      payment_status: 'paid',
      payment_method: methodStr,
    };

    res.json({
      success: true,
      booking: updatedBooking,
      ticketNumber: booking.ticket_number,
    });
  } catch (err) {
    console.error('[Payment Error]:', err.message);
    res.status(500).json({ error: 'Payment processing error', message: err.message });
  }
});

// -----------------------------------------------------------------------------
// PUBLIC: GET /api/bookings/:id - View single booking / E-ticket
// -----------------------------------------------------------------------------
app.get('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await releaseExpiredBookings();

    const result = await db.execute({
      sql: `
        SELECT
          b.*,
          t.departure_date,
          t.departure_time,
          t.arrival_time,
          t.fare,
          orig.name_en AS from_location,
          orig.name_th AS from_location_th,
          dest.name_en AS to_location,
          dest.name_th AS to_location_th,
          orig.station_name_en AS from_station,
          orig.station_name_th AS from_station_th,
          dest.station_name_en AS to_station,
          dest.station_name_th AS to_station_th,
          COALESCE(v.vehicle_type, 'VIP Minivan') AS vehicle_type,
          COALESCE(v.name, 'Sriracha Tour Express') AS vehicle_name
        FROM bookings b
        JOIN trips t ON b.trip_id = t.id
        JOIN routes r ON t.route_id = r.id
        JOIN locations orig ON r.origin_id = orig.id
        JOIN locations dest ON r.destination_id = dest.id
        LEFT JOIN vehicles v ON t.vehicle_id = v.id
        WHERE b.id = ?
      `,
      args: [id],
    });

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// PUBLIC: GET /api/users/:username/bookings - User profile bookings history
// -----------------------------------------------------------------------------
app.get('/api/users/:username/bookings', async (req, res) => {
  try {
    const { username } = req.params;
    await releaseExpiredBookings();

    const result = await db.execute({
      sql: `
        SELECT
          b.*,
          t.departure_date,
          t.departure_time,
          t.arrival_time,
          t.fare,
          orig.name_en AS from_location,
          orig.name_th AS from_location_th,
          dest.name_en AS to_location,
          dest.name_th AS to_location_th,
          orig.station_name_en AS from_station,
          orig.station_name_th AS from_station_th,
          dest.station_name_en AS to_station,
          dest.station_name_th AS to_station_th,
          COALESCE(v.vehicle_type, 'VIP Minivan') AS vehicle_type,
          COALESCE(v.name, 'Sriracha Tour Express') AS vehicle_name
        FROM bookings b
        JOIN trips t ON b.trip_id = t.id
        JOIN routes r ON t.route_id = r.id
        JOIN locations orig ON r.origin_id = orig.id
        JOIN locations dest ON r.destination_id = dest.id
        LEFT JOIN vehicles v ON t.vehicle_id = v.id
        WHERE LOWER(b.username) = LOWER(?)
        ORDER BY b.created_at DESC
      `,
      args: [username],
    });

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// ADMIN GUARD MIDDLEWARE: Restrict /api/admin to users with role = 'admin'
// -----------------------------------------------------------------------------
const requireAdmin = async (req, res, next) => {
  const adminUser = req.headers['x-admin-user'] || req.query.admin_user;
  if (!adminUser) {
    return res.status(403).json({ error: 'Access denied: Administrator username required.' });
  }

  try {
    const userRes = await db.execute({
      sql: 'SELECT role FROM users WHERE LOWER(username) = LOWER(?)',
      args: [String(adminUser).trim()],
    });

    if (!userRes.rows.length || userRes.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: You do not have administrator permissions.' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify admin status.' });
  }
};

app.use('/api/admin', requireAdmin);

// -----------------------------------------------------------------------------
// ADMIN: TRIPS MANAGEMENT (List, Add, Update, Remove)
// -----------------------------------------------------------------------------
app.get('/api/admin/trips', async (req, res) => {
  try {
    const { date, status } = req.query;
    let sql = `
      SELECT
        t.id,
        t.route_id,
        t.vehicle_id,
        orig.name_en AS from_location,
        orig.name_th AS from_location_th,
        dest.name_en AS to_location,
        dest.name_th AS to_location_th,
        t.departure_date,
        t.departure_time,
        t.arrival_time,
        t.fare,
        t.total_seats,
        t.available_seats,
        t.status,
        v.name AS vehicle_name,
        v.vehicle_type
      FROM trips t
      JOIN routes r ON t.route_id = r.id
      JOIN locations orig ON r.origin_id = orig.id
      JOIN locations dest ON r.destination_id = dest.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      WHERE 1=1
    `;
    const args = [];
    if (date) {
      sql += ' AND t.departure_date = ?';
      args.push(date);
    }
    if (status) {
      sql += ' AND t.status = ?';
      args.push(status);
    }
    sql += ' ORDER BY t.departure_date DESC, t.departure_time ASC LIMIT 300';

    const result = await db.execute({ sql, args });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/trips', async (req, res) => {
  try {
    const {
      route_id,
      vehicle_id,
      departure_date,
      departure_time,
      arrival_time,
      fare,
      total_seats,
      available_seats,
      status = 'scheduled',
    } = req.body;

    if (!route_id || !departure_date || !departure_time || !arrival_time || fare == null) {
      return res.status(400).json({ error: 'Missing required trip fields.' });
    }

    const tripId = `trip_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const seats = Math.max(1, Number(total_seats) || 13);
    let avail = available_seats != null ? Number(available_seats) : seats;
    if (isNaN(avail) || avail > seats || avail < 0) {
      avail = seats;
    }

    await db.execute({
      sql: `INSERT INTO trips (id, route_id, vehicle_id, departure_date, departure_time, arrival_time, fare, total_seats, available_seats, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        tripId,
        route_id,
        vehicle_id || null,
        departure_date,
        departure_time,
        arrival_time,
        Number(fare),
        seats,
        avail,
        status,
      ],
    });

    res.status(201).json({ success: true, tripId });
  } catch (err) {
    console.error('[Admin Add Trip Error]:', err.message);
    res.status(500).json({ error: 'Failed to add trip', message: err.message });
  }
});

app.delete('/api/admin/trips/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: 'DELETE FROM trips WHERE id = ?',
      args: [id],
    });
    res.json({ success: true, message: `Trip ${id} deleted.` });
  } catch (err) {
    console.error('[Admin Delete Trip Error]:', err.message);
    res.status(500).json({ error: 'Failed to delete trip', message: err.message });
  }
});

app.put('/api/admin/trips/:id', async (req, res) => {
  try {
    await updateTrip(db, req.params.id, req.body);
    res.json({ success: true, message: 'Trip updated.' });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// ADMIN: ROUTES & VEHICLES OPTIONS (For creating new trips)
// -----------------------------------------------------------------------------
app.get('/api/admin/routes', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT
        r.id,
        r.origin_id,
        r.destination_id,
        r.duration_minutes,
        r.duration_display_th,
        r.distance_km,
        r.base_fare,
        r.duration_display_en,
        orig.name_en AS from_en,
        orig.name_th AS from_th,
        dest.name_en AS to_en,
        dest.name_th AS to_th
      FROM routes r
      JOIN locations orig ON r.origin_id = orig.id
      JOIN locations dest ON r.destination_id = dest.id
      WHERE r.is_active = 1
      ORDER BY orig.name_en, dest.name_en
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/routes/:id', async (req, res) => {
  try { await updateRoute(db, req.params.id, req.body); res.json({ success: true, message: 'Route updated.' }); }
  catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

app.get('/api/admin/locations', async (req, res) => {
  try { res.json((await db.execute('SELECT id, name_en, name_th FROM locations WHERE is_active = 1 ORDER BY name_en')).rows); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/vehicles', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT id, name, plate_number, vehicle_type, total_seats
      FROM vehicles
      WHERE is_active = 1
      ORDER BY vehicle_type, name
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// ADMIN: USERS MANAGEMENT (List, Add, Delete, Change Role)
// -----------------------------------------------------------------------------
app.get('/api/admin/users', async (req, res) => {
  try {
    const result = await db.execute(`SELECT * FROM users ORDER BY created_at DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users', async (req, res) => {
  try {
    const { username, role = 'user' } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required.' });
    }

    const newId = `usr_${Date.now()}`;
    await db.execute({
      sql: `INSERT INTO users (id, username, role) VALUES (?, ?, ?)`,
      args: [newId, username.trim(), role],
    });

    res.status(201).json({ success: true, user: { id: newId, username: username.trim(), role } });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute({
      sql: 'DELETE FROM users WHERE id = ?',
      args: [id],
    });
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    await db.execute({
      sql: 'UPDATE users SET role = ? WHERE id = ?',
      args: [role, id],
    });
    res.json({ success: true, message: 'User updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// ADMIN: BOOKINGS MANAGEMENT
// -----------------------------------------------------------------------------
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const result = await db.execute(`
      SELECT
        b.id,
        b.booking_code,
        b.passenger_name,
        b.passenger_phone,
        b.passenger_email,
        b.seats_count,
        b.seat_numbers,
        b.total_amount,
        b.payment_status,
        b.booking_status,
        b.ticket_number,
        b.created_at,
        t.departure_date,
        t.departure_time,
        orig.name_en AS from_location,
        dest.name_en AS to_location
      FROM bookings b
      JOIN trips t ON b.trip_id = t.id
      JOIN routes r ON t.route_id = r.id
      JOIN locations orig ON r.origin_id = orig.id
      JOIN locations dest ON r.destination_id = dest.id
      ORDER BY b.created_at DESC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_status, booking_status } = req.body;
    await db.execute({
      sql: `UPDATE bookings
            SET payment_status = COALESCE(?, payment_status),
                booking_status = COALESCE(?, booking_status)
            WHERE id = ?`,
      args: [payment_status, booking_status, id],
    });
    res.json({ success: true, message: 'Booking status updated.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -----------------------------------------------------------------------------
// SPA Catch-All Route (Ensures /admin, /th, etc. load index.html)
// -----------------------------------------------------------------------------
app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint not found.' }));
app.use((req, res) => {
  const indexPath = path.resolve('dist/index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Not Found');
});

const PORT = process.env.PORT || 3000;
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await databaseReady;
  app.listen(PORT, () => console.log(`Sriracha Tour server running on port ${PORT}`));
}
