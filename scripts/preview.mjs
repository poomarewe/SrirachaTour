// Disposable preview: never connects to the configured customer database.
import { fixtureDatabase } from '../tests/fixtures.js';
import { createReservation } from '../server/reservations.js';
const fixture = await fixtureDatabase();
process.env.TURSO_DATABASE_URL = fixture.url;
process.env.TURSO_AUTH_TOKEN = '';
const { app, db, databaseReady } = await import('../server.js');
await databaseReady;
let attempts = 0;
app.locals.paymentRandom = () => process.env.PREVIEW_PAYMENT_FAILURE_ONCE === '1' && attempts++ === 0 ? 0 : 1;
const expired = await createReservation(db, { tripId: `${fixture.tomorrow}-bus`, seats: ['5D'], username: 'traveler', passenger: { name: 'Demo Traveler', phone: '0812345678', email: '' } });
await db.execute({ sql: 'UPDATE bookings SET expires_at = ? WHERE id = ?', args: [new Date(Date.now() - 1000).toISOString(), expired.id] });
const port = Number(process.env.PREVIEW_PORT || 3100);
const server = app.listen(port, '127.0.0.1', () => console.log(`Isolated preview: http://127.0.0.1:${port}`));
async function shutdown() { server.close(async () => { db.close(); await fixture.cleanup(); process.exit(0); }); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
