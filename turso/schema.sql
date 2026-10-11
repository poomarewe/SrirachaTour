-- ==============================================================================
-- SRIRACHA TOUR - TURSO (libSQL / SQLite) DATABASE SCHEMA
-- ==============================================================================
-- Description: SQLite/libSQL compatible schema for Turso database.
-- Features: Locations, Vehicles, Routes, Trips, Bookings, Seat Allocations,
--           Indexes, Triggers, and Catalog View.
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- 1. DROP EXISTING OBJECTS IF RE-RUNNING
DROP VIEW IF EXISTS v_trip_catalog;
DROP TRIGGER IF EXISTS trg_trips_updated_at;
DROP TRIGGER IF EXISTS trg_bookings_updated_at;
DROP TRIGGER IF EXISTS trg_sync_seats_insert;
DROP TRIGGER IF EXISTS trg_sync_seats_cancel;
DROP TRIGGER IF EXISTS trg_sync_seats_reconfirm;
DROP TABLE IF EXISTS booking_seats;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS trips;
DROP TABLE IF EXISTS routes;
DROP TABLE IF EXISTS vehicles;
DROP TABLE IF EXISTS locations;

-- ==============================================================================
-- 2. USERS (Accounts / Management)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                                      -- e.g. 'usr_admin', 'usr_john'
    username TEXT UNIQUE NOT NULL,                            -- e.g. 'admin', 'john_doe'
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==============================================================================
-- 3. LOCATIONS (Stations & Pickup Points)
-- ==============================================================================
CREATE TABLE locations (
    id TEXT PRIMARY KEY,                                      -- e.g. 'loc_sriracha', 'loc_bangkok'
    code TEXT UNIQUE NOT NULL,                                -- e.g. 'SRC', 'BKK', 'PTY', 'CBI'
    name_en TEXT NOT NULL,                                    -- e.g. 'Sriracha', 'Bangkok'
    name_th TEXT NOT NULL,                                    -- e.g. 'ศรีราชา', 'กรุงเทพฯ'
    station_name_en TEXT,                                     -- e.g. 'Tukcom Sriracha', 'Ekkamai Terminal'
    station_name_th TEXT,                                     -- e.g. 'ตึกคอม ศรีราชา', 'สถานีขนส่งเอกมัย'
    address TEXT,
    latitude REAL,
    longitude REAL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==============================================================================
-- 3. VEHICLES (Minivans & Minibuses)
-- ==============================================================================
CREATE TABLE vehicles (
    id TEXT PRIMARY KEY,                                      -- e.g. 'veh_van_01'
    name TEXT NOT NULL,                                       -- e.g. 'VIP Minivan #01'
    plate_number TEXT NOT NULL,                               -- e.g. '10-8801 ชลบุรี'
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('VIP Minivan', 'Minibus')),
    total_seats INTEGER NOT NULL CHECK (total_seats > 0),
    amenities TEXT DEFAULT '["Air Conditioning", "Seatbelts", "Luggage Space"]', -- JSON string array
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==============================================================================
-- 4. ROUTES (Between Origin and Destination)
-- ==============================================================================
CREATE TABLE routes (
    id TEXT PRIMARY KEY,                                      -- e.g. 'route_src_bkk'
    origin_id TEXT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    destination_id TEXT NOT NULL REFERENCES locations(id) ON DELETE RESTRICT,
    distance_km REAL,
    duration_minutes INTEGER NOT NULL DEFAULT 135,            -- 2h 15m
    duration_display_en TEXT DEFAULT '2h 15m',
    duration_display_th TEXT DEFAULT '2 ชม. 15 นาที',
    base_fare REAL NOT NULL DEFAULT 180.0 CHECK (base_fare >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (origin_id, destination_id)
);

-- ==============================================================================
-- 5. TRIPS (Scheduled Departures)
-- ==============================================================================
CREATE TABLE trips (
    id TEXT PRIMARY KEY,                                      -- e.g. 'trip_20261006_0730_src_bkk'
    route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
    vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
    departure_date TEXT NOT NULL,                             -- 'YYYY-MM-DD'
    departure_time TEXT NOT NULL,                             -- 'HH:MM' (e.g. '07:30')
    arrival_time TEXT NOT NULL,                               -- 'HH:MM' (e.g. '09:45')
    fare REAL NOT NULL CHECK (fare >= 0),
    total_seats INTEGER NOT NULL CHECK (total_seats > 0),
    available_seats INTEGER NOT NULL CHECK (available_seats >= 0 AND available_seats <= total_seats),
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'boarding', 'departed', 'completed', 'cancelled')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==============================================================================
-- 6. BOOKINGS (Customer Reservations)
-- ==============================================================================
CREATE TABLE bookings (
    id TEXT PRIMARY KEY,                                      -- e.g. 'bk_650123'
    booking_code TEXT UNIQUE NOT NULL,                        -- e.g. 'ST650123'
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
    passenger_name TEXT NOT NULL,
    passenger_phone TEXT NOT NULL,
    passenger_email TEXT,
    seats_count INTEGER NOT NULL DEFAULT 1 CHECK (seats_count > 0),
    seat_numbers TEXT NOT NULL DEFAULT '[]',                  -- JSON string array, e.g. '["1A", "1B"]'
    total_amount REAL NOT NULL CHECK (total_amount >= 0),
    payment_status TEXT NOT NULL DEFAULT 'pending_payment'
        CHECK (payment_status IN ('pending_payment', 'paid', 'refunded', 'cancelled', 'failed')),
    booking_status TEXT NOT NULL DEFAULT 'confirmed'
        CHECK (booking_status IN ('confirmed', 'completed', 'cancelled')),
    payment_method TEXT DEFAULT 'promptpay',                  -- 'promptpay', 'credit_card', 'cash'
    ticket_number TEXT,                                       -- e.g. 'ET-SR650123'
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ==============================================================================
-- 7. BOOKING SEATS (Specific Seat Lock to prevent double-booking)
-- ==============================================================================
CREATE TABLE booking_seats (
    id TEXT PRIMARY KEY,
    trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    booking_id TEXT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    seat_number TEXT NOT NULL,                                -- e.g. '1A', '2B'
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (trip_id, seat_number)
);

-- ==============================================================================
-- 8. INDEXES FOR FAST QUERYING
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);
CREATE INDEX IF NOT EXISTS idx_routes_origin_dest ON routes(origin_id, destination_id);
CREATE INDEX IF NOT EXISTS idx_trips_route_date ON trips(route_id, departure_date);
CREATE INDEX IF NOT EXISTS idx_trips_departure_time ON trips(departure_time);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_bookings_code ON bookings(booking_code);
CREATE INDEX IF NOT EXISTS idx_bookings_phone ON bookings(passenger_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_trip ON bookings(trip_id);
CREATE INDEX IF NOT EXISTS idx_booking_seats_trip ON booking_seats(trip_id);

-- ==============================================================================
-- 9. TRIGGERS (Auto timestamp & Seat capacity synchronization)
-- ==============================================================================

-- A. Auto-update 'updated_at' timestamp on update
CREATE TRIGGER trg_trips_updated_at
AFTER UPDATE ON trips
FOR EACH ROW
BEGIN
    UPDATE trips SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER trg_bookings_updated_at
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
    UPDATE bookings SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- B. Auto-decrement available seats on confirmed booking
CREATE TRIGGER trg_sync_seats_insert
AFTER INSERT ON bookings
WHEN NEW.booking_status = 'confirmed'
BEGIN
    UPDATE trips
    SET available_seats = MAX(0, available_seats - NEW.seats_count)
    WHERE id = NEW.trip_id;
END;

-- C. Restore available seats if booking is cancelled
CREATE TRIGGER trg_sync_seats_cancel
AFTER UPDATE OF booking_status ON bookings
WHEN OLD.booking_status != 'cancelled' AND NEW.booking_status = 'cancelled'
BEGIN
    UPDATE trips
    SET available_seats = MIN(total_seats, available_seats + OLD.seats_count)
    WHERE id = NEW.trip_id;
END;

-- D. Re-deduct seats if booking status changed from cancelled back to confirmed
CREATE TRIGGER trg_sync_seats_reconfirm
AFTER UPDATE OF booking_status ON bookings
WHEN OLD.booking_status = 'cancelled' AND NEW.booking_status = 'confirmed'
BEGIN
    UPDATE trips
    SET available_seats = MAX(0, available_seats - NEW.seats_count)
    WHERE id = NEW.trip_id;
END;

-- ==============================================================================
-- 10. CONVENIENT VIEW FOR FRONTEND TRIPS SEARCH
-- ==============================================================================
-- Directly matches the payload format used in Sriracha Tour Vue frontend & Express API
CREATE VIEW IF NOT EXISTS v_trip_catalog AS
SELECT
    t.id AS trip_id,
    r.id AS route_id,
    orig.name_en AS from_location,
    orig.name_th AS from_location_th,
    orig.station_name_en AS from_station,
    orig.station_name_th AS from_station_th,
    dest.name_en AS to_location,
    dest.name_th AS to_location_th,
    dest.station_name_en AS to_station,
    dest.station_name_th AS to_station_th,
    t.departure_date,
    t.departure_time AS departure,
    t.arrival_time AS arrival,
    r.duration_display_en AS duration,
    r.duration_display_th AS duration_th,
    t.fare,
    t.total_seats,
    t.available_seats AS seats,
    COALESCE(v.vehicle_type, 'VIP Minivan') AS vehicle,
    COALESCE(v.name, 'Sriracha Tour Express') AS vehicle_name,
    t.status
FROM trips t
JOIN routes r ON t.route_id = r.id
JOIN locations orig ON r.origin_id = orig.id
JOIN locations dest ON r.destination_id = dest.id
LEFT JOIN vehicles v ON t.vehicle_id = v.id
WHERE t.status = 'scheduled';
