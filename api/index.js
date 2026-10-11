import { app, databaseReady } from '../server.js';

// Vercel runs this handler; the local server continues to use server.js.
export default async function handler(req, res) {
  await databaseReady;
  return app(req, res);
}
