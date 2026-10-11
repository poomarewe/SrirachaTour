import { createClient } from '@libsql/client';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { bangkokDate } from '../shared/journey.js';

export async function fixtureDatabase() {
  const directory = await mkdtemp(path.join(tmpdir(), 'sriracha-journey-'));
  const url = `file:${path.join(directory, 'test.db').replaceAll('\\', '/')}`;
  const db = createClient({ url });
  await db.executeMultiple(await readFile(new URL('../schema.sql', import.meta.url), 'utf8'));
  await db.execute('ALTER TABLE bookings ADD COLUMN username TEXT');
  await db.execute('ALTER TABLE bookings ADD COLUMN expires_at TEXT');
  await db.executeMultiple(`
    INSERT INTO users (id, username, role) VALUES ('test_user', 'traveler', 'user'), ('test_other', 'other', 'user'), ('usr_admin', 'admin', 'admin');
    INSERT INTO locations (id, code, name_en, name_th, station_name_en, station_name_th) VALUES
      ('src', 'SRC', 'Sriracha', 'ศรีราชา', 'Tukcom Sriracha', 'ตึกคอม ศรีราชา'),
      ('bkk', 'BKK', 'Bangkok', 'กรุงเทพฯ', 'Ekkamai Terminal', 'สถานีเอกมัย');
    INSERT INTO routes (id, origin_id, destination_id) VALUES ('outbound', 'src', 'bkk'), ('inbound', 'bkk', 'src');
    INSERT INTO vehicles (id, name, plate_number, vehicle_type, total_seats) VALUES ('van', 'VIP Minivan', 'TEST-13', 'VIP Minivan', 13), ('bus', 'Minibus', 'TEST-20', 'Minibus', 20);
  `);
  const today = bangkokDate(), tomorrow = bangkokDate(new Date(Date.now() + 86400000));
  for (const date of [today, tomorrow]) {
    for (const [suffix, vehicle, capacity, seats, time] of [['van', 'van', 13, 13, '23:00'], ['bus', 'bus', 20, 20, '23:30'], ['full', 'van', 13, 0, '23:40'], ['unsupported', 'van', 12, 12, '23:45']]) {
      await db.execute({ sql: 'INSERT INTO trips (id, route_id, vehicle_id, departure_date, departure_time, arrival_time, fare, total_seats, available_seats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [`${date}-${suffix}`, 'outbound', vehicle, date, time, '23:59', 180, capacity, seats] });
    }
    await db.execute({ sql: 'INSERT INTO trips (id, route_id, vehicle_id, departure_date, departure_time, arrival_time, fare, total_seats, available_seats) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', args: [`${date}-return`, 'inbound', 'van', date, '23:00', '23:59', 180, 13, 13] });
  }
  await db.execute({ sql: "INSERT INTO trips (id, route_id, vehicle_id, departure_date, departure_time, arrival_time, fare, total_seats, available_seats, status) VALUES ('departed', 'outbound', 'van', '2020-01-01', '06:00', '08:00', 180, 13, 13, 'departed')", args: [] });
  return { db, url, directory, today, tomorrow, async cleanup() { db.close(); const resolved = path.resolve(directory); if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(resolved).startsWith('sriracha-journey-')) throw new Error('Unexpected test directory'); await rm(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } };
}
