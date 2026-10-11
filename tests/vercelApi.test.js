import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fixtureDatabase } from './fixtures.js';

test('Vercel handler accepts login POST and keeps unknown API paths out of the page fallback', async () => {
  const fixture = await fixtureDatabase();
  process.env.TURSO_DATABASE_URL = fixture.url;
  process.env.TURSO_AUTH_TOKEN = '';
  let server, db;
  try {
    const { default: handler } = await import('../api/index.js');
    ({ db } = await import('../server.js'));
    server = createServer(handler).listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'traveler' }) });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).user.username, 'traveler');
    const invalid = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(invalid.status, 400);
    const unknown = await fetch(base + '/api/not-a-route');
    assert.equal(unknown.status, 404);
    assert.match(unknown.headers.get('content-type'), /application\/json/);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    db?.close();
    await fixture.cleanup();
  }
});
