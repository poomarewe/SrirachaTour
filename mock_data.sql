-- ==============================================================================
-- SRIRACHA TOUR - TURSO (libSQL / SQLite) MOCK UP DATA (SEED DATA)
-- ==============================================================================
-- Description: Realistic mockup data for Sriracha Tour.
--              Uses SQLite dynamic date functions (date('now', '+N days'))
--              so trips are always current and never expired!
-- ==============================================================================

PRAGMA foreign_keys = ON;

-- Clear previous mock data
DELETE FROM booking_seats;
DELETE FROM bookings;
DELETE FROM trips;
DELETE FROM routes;
DELETE FROM vehicles;
DELETE FROM locations;

-- ==============================================================================
-- 1. LOCATIONS (Stations in Chonburi, Bangkok, Pattaya)
-- ==============================================================================
INSERT INTO locations (id, code, name_en, name_th, station_name_en, station_name_th, address, latitude, longitude) VALUES
(
    'loc_src',
    'SRC',
    'Sriracha',
    'ศรีราชา',
    'Tukcom Sriracha / Pacific Park',
    'จุดจอดตึกคอม ศรีราชา / แปซิฟิกพาร์ค',
    'Sukhumvit Road, Si Racha Sub-district, Si Racha District, Chon Buri 20110',
    13.167812,
    100.930432
),
(
    'loc_bkk',
    'BKK',
    'Bangkok',
    'กรุงเทพฯ',
    'Eastern Bus Terminal (Ekkamai)',
    'สถานีขนส่งผู้โดยสารกรุงเทพฯ (เอกมัย)',
    'Sukhumvit Road, Phra Khanong, Khlong Toei, Bangkok 10110',
    13.719918,
    100.583259
),
(
    'loc_pty',
    'PTY',
    'Pattaya',
    'พัทยา',
    'North Pattaya Bus Terminal',
    'สถานีขนส่งพัทยาเหนือ',
    'Pattaya Sai 3 Rd, Bang Lamung District, Chon Buri 20150',
    12.949214,
    100.902341
),
(
    'loc_cbi',
    'CBI',
    'Chonburi',
    'ชลบุรี',
    'Chonburi Bus Terminal / Central Chonburi',
    'สถานีขนส่งผู้โดยสารจังหวัดชลบุรี (บายพาส)',
    'Sukhumvit Rd, Samet, Mueang Chon Buri District, Chon Buri 20000',
    13.332451,
    100.971239
);

-- ==============================================================================
-- 2. VEHICLES
-- ==============================================================================
INSERT INTO vehicles (id, name, plate_number, vehicle_type, total_seats, amenities) VALUES
(
    'veh_van_01',
    'VIP Minivan #01',
    '10-8801 ชลบุรี',
    'VIP Minivan',
    13,
    '["Air Conditioning", "Leather VIP Seats", "USB Charging Port", "Seatbelts"]'
),
(
    'veh_van_02',
    'VIP Minivan #02',
    '10-8802 ชลบุรี',
    'VIP Minivan',
    13,
    '["Air Conditioning", "Leather VIP Seats", "USB Charging Port", "Seatbelts"]'
),
(
    'veh_van_03',
    'VIP Minivan #03',
    '10-8803 ชลบุรี',
    'VIP Minivan',
    13,
    '["Air Conditioning", "Leather VIP Seats", "Seatbelts"]'
),
(
    'veh_bus_01',
    'Express Minibus #01',
    '10-9101 ชลบุรี',
    'Minibus',
    20,
    '["Air Conditioning", "Spacious Legroom", "CCTV", "Luggage Rack", "Seatbelts"]'
),
(
    'veh_bus_02',
    'Express Minibus #02',
    '10-9102 ชลบุรี',
    'Minibus',
    20,
    '["Air Conditioning", "Spacious Legroom", "CCTV", "Luggage Rack", "Seatbelts"]'
);

-- ==============================================================================
-- 3. ROUTES
-- ==============================================================================
INSERT INTO routes (id, origin_id, destination_id, distance_km, duration_minutes, duration_display_en, duration_display_th, base_fare) VALUES
-- Sriracha <-> Bangkok
(
    'route_src_bkk',
    'loc_src',
    'loc_bkk',
    115.5,
    135,
    '2h 15m',
    '2 ชม. 15 นาที',
    180.0
),
(
    'route_bkk_src',
    'loc_bkk',
    'loc_src',
    115.5,
    135,
    '2h 15m',
    '2 ชม. 15 นาที',
    180.0
),
-- Sriracha <-> Pattaya
(
    'route_src_pty',
    'loc_src',
    'loc_pty',
    32.0,
    45,
    '45m',
    '45 นาที',
    80.0
),
(
    'route_pty_src',
    'loc_pty',
    'loc_src',
    32.0,
    45,
    '45m',
    '45 นาที',
    80.0
),
-- Sriracha <-> Chonburi
(
    'route_src_cbi',
    'loc_src',
    'loc_cbi',
    24.0,
    35,
    '35m',
    '35 นาที',
    60.0
),
(
    'route_cbi_src',
    'loc_cbi',
    'loc_src',
    24.0,
    35,
    '35m',
    '35 นาที',
    60.0
),
-- Bangkok <-> Pattaya
(
    'route_bkk_pty',
    'loc_bkk',
    'loc_pty',
    145.0,
    120,
    '2h 00m',
    '2 ชม. 00 นาที',
    160.0
),
(
    'route_pty_bkk',
    'loc_pty',
    'loc_bkk',
    145.0,
    120,
    '2h 00m',
    '2 ชม. 00 นาที',
    160.0
);

-- ==============================================================================
-- 4. INSERT TRIPS (TODAY THROUGH NEXT 7 DAYS)
-- ==============================================================================
-- Using a recursive CTE to generate days (offset 0 to 7), inserting scheduled trips
-- for both morning (06:00-12:00) and afternoon (12:00-18:30)
WITH RECURSIVE days(offset) AS (
    SELECT -1
    UNION ALL
    SELECT offset + 1 FROM days WHERE offset < 7
)
INSERT INTO trips (id, route_id, vehicle_id, departure_date, departure_time, arrival_time, fare, total_seats, available_seats, status)
-- 1. Sriracha -> Bangkok (Morning)
SELECT 'trip_src_bkk_' || date('now', offset || ' day') || '_0600', 'route_src_bkk', 'veh_van_01', date('now', offset || ' day'), '06:00', '08:15', 180.0, 13, 11, 'scheduled' FROM days
UNION ALL
SELECT 'trip_src_bkk_' || date('now', offset || ' day') || '_0730', 'route_src_bkk', 'veh_van_02', date('now', offset || ' day'), '07:30', '09:45', 180.0, 13, 12, 'scheduled' FROM days
UNION ALL
SELECT 'trip_src_bkk_' || date('now', offset || ' day') || '_0845', 'route_src_bkk', 'veh_bus_01', date('now', offset || ' day'), '08:45', '11:00', 180.0, 20, 16, 'scheduled' FROM days
UNION ALL
SELECT 'trip_src_bkk_' || date('now', offset || ' day') || '_1000', 'route_src_bkk', 'veh_van_03', date('now', offset || ' day'), '10:00', '12:15', 180.0, 13, 8,  'scheduled' FROM days
UNION ALL
SELECT 'trip_src_bkk_' || date('now', offset || ' day') || '_1115', 'route_src_bkk', 'veh_van_01', date('now', offset || ' day'), '11:15', '13:30', 180.0, 13, 9,  'scheduled' FROM days

-- 2. Sriracha -> Bangkok (Afternoon)
UNION ALL
SELECT 'trip_src_bkk_' || date('now', offset || ' day') || '_1230', 'route_src_bkk', 'veh_bus_02', date('now', offset || ' day'), '12:30', '14:45', 180.0, 20, 18, 'scheduled' FROM days
UNION ALL
SELECT 'trip_src_bkk_' || date('now', offset || ' day') || '_1330', 'route_src_bkk', 'veh_van_02', date('now', offset || ' day'), '13:30', '15:45', 180.0, 13, 5,  'scheduled' FROM days
UNION ALL
SELECT 'trip_src_bkk_' || date('now', offset || ' day') || '_1500', 'route_src_bkk', 'veh_van_03', date('now', offset || ' day'), '15:00', '17:15', 180.0, 13, 10, 'scheduled' FROM days
UNION ALL
SELECT 'trip_src_bkk_' || date('now', offset || ' day') || '_1630', 'route_src_bkk', 'veh_bus_01', date('now', offset || ' day'), '16:30', '18:45', 180.0, 20, 14, 'scheduled' FROM days
UNION ALL
SELECT 'trip_src_bkk_' || date('now', offset || ' day') || '_1800', 'route_src_bkk', 'veh_van_01', date('now', offset || ' day'), '18:00', '20:15', 180.0, 13, 7,  'scheduled' FROM days

-- 3. Bangkok -> Sriracha
UNION ALL
SELECT 'trip_bkk_src_' || date('now', offset || ' day') || '_0700', 'route_bkk_src', 'veh_van_02', date('now', offset || ' day'), '07:00', '09:15', 180.0, 13, 13, 'scheduled' FROM days
UNION ALL
SELECT 'trip_bkk_src_' || date('now', offset || ' day') || '_0930', 'route_bkk_src', 'veh_bus_02', date('now', offset || ' day'), '09:30', '11:45', 180.0, 20, 19, 'scheduled' FROM days
UNION ALL
SELECT 'trip_bkk_src_' || date('now', offset || ' day') || '_1300', 'route_bkk_src', 'veh_van_01', date('now', offset || ' day'), '13:00', '15:15', 180.0, 13, 10, 'scheduled' FROM days
UNION ALL
SELECT 'trip_bkk_src_' || date('now', offset || ' day') || '_1600', 'route_bkk_src', 'veh_van_03', date('now', offset || ' day'), '16:00', '18:15', 180.0, 13, 11, 'scheduled' FROM days
UNION ALL
SELECT 'trip_bkk_src_' || date('now', offset || ' day') || '_1830', 'route_bkk_src', 'veh_bus_01', date('now', offset || ' day'), '18:30', '20:45', 180.0, 20, 17, 'scheduled' FROM days

-- 4. Sriracha -> Pattaya
UNION ALL
SELECT 'trip_src_pty_' || date('now', offset || ' day') || '_0800', 'route_src_pty', 'veh_bus_01', date('now', offset || ' day'), '08:00', '08:45', 80.0, 20, 16, 'scheduled' FROM days
UNION ALL
SELECT 'trip_src_pty_' || date('now', offset || ' day') || '_1100', 'route_src_pty', 'veh_van_01', date('now', offset || ' day'), '11:00', '11:45', 80.0, 13, 10, 'scheduled' FROM days
UNION ALL
SELECT 'trip_src_pty_' || date('now', offset || ' day') || '_1330', 'route_src_pty', 'veh_bus_02', date('now', offset || ' day'), '13:30', '14:15', 80.0, 20, 16, 'scheduled' FROM days
UNION ALL
SELECT 'trip_src_pty_' || date('now', offset || ' day') || '_1700', 'route_src_pty', 'veh_van_02', date('now', offset || ' day'), '17:00', '17:45', 80.0, 13, 12, 'scheduled' FROM days

-- 5. Sriracha -> Chonburi
UNION ALL
SELECT 'trip_src_cbi_' || date('now', offset || ' day') || '_0900', 'route_src_cbi', 'veh_van_03', date('now', offset || ' day'), '09:00', '09:35', 60.0, 13, 11, 'scheduled' FROM days
UNION ALL
SELECT 'trip_src_cbi_' || date('now', offset || ' day') || '_1400', 'route_src_cbi', 'veh_bus_01', date('now', offset || ' day'), '14:00', '14:35', 60.0, 20, 18, 'scheduled' FROM days;

-- ==============================================================================
-- 5. SAMPLE BOOKINGS & SEAT ALLOCATIONS
-- ==============================================================================
-- Booking 1: Today 07:30 Sriracha -> Bangkok (Paid)
INSERT INTO bookings (
    id, booking_code, trip_id, passenger_name, passenger_phone, passenger_email,
    seats_count, seat_numbers, total_amount, payment_status, booking_status,
    payment_method, ticket_number
) VALUES (
    'bk_650123',
    'ST650123',
    'trip_src_bkk_' || date('now') || '_0730',
    'สมชาย ใจดี (Somchai Jaidee)',
    '081-234-5678',
    'somchai.j@example.com',
    1,
    '["1A"]',
    180.0,
    'paid',
    'confirmed',
    'promptpay',
    'ET-SR650123'
);

INSERT INTO booking_seats (id, trip_id, booking_id, seat_number)
VALUES ('seat_01', 'trip_src_bkk_' || date('now') || '_0730', 'bk_650123', '1A');

-- Booking 2: Today 10:00 Sriracha -> Bangkok (Paid, 2 seats)
INSERT INTO bookings (
    id, booking_code, trip_id, passenger_name, passenger_phone, passenger_email,
    seats_count, seat_numbers, total_amount, payment_status, booking_status,
    payment_method, ticket_number
) VALUES (
    'bk_789210',
    'ST789210',
    'trip_src_bkk_' || date('now') || '_1000',
    'ณิชา วัฒนา (Nicha Wattana)',
    '089-987-6543',
    'nicha.w@example.com',
    2,
    '["2A", "2B"]',
    360.0,
    'paid',
    'confirmed',
    'credit_card',
    'ET-SR789210'
);

INSERT INTO booking_seats (id, trip_id, booking_id, seat_number)
VALUES
    ('seat_02', 'trip_src_bkk_' || date('now') || '_1000', 'bk_789210', '2A'),
    ('seat_03', 'trip_src_bkk_' || date('now') || '_1000', 'bk_789210', '2B');

-- Booking 3: Tomorrow 13:30 Sriracha -> Bangkok (Pending payment)
INSERT INTO bookings (
    id, booking_code, trip_id, passenger_name, passenger_phone, passenger_email,
    seats_count, seat_numbers, total_amount, payment_status, booking_status,
    payment_method, ticket_number
) VALUES (
    'bk_912340',
    'ST912340',
    'trip_src_bkk_' || date('now', '+1 day') || '_1330',
    'Alex Turner',
    '092-555-1212',
    'alex.t@example.com',
    1,
    '["3A"]',
    180.0,
    'pending_payment',
    'confirmed',
    'promptpay',
    'ET-SR912340'
);

INSERT INTO booking_seats (id, trip_id, booking_id, seat_number)
VALUES ('seat_04', 'trip_src_bkk_' || date('now', '+1 day') || '_1330', 'bk_912340', '3A');
