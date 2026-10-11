# Sriracha Tour

Customer booking uses full pages: sign in, departures, seats and contact details, simulated payment, and ticket. Thai is the first-visit default; `/en` and `/th` are supported. The existing admin dashboard remains at `/admin`.

Run `npm run dev` for the configured API/database and frontend. Run `npm run build` for a production build, then `npm start` to serve it.

Run `npm test` for booking transactions, seat conflicts, expiry, simulated payment, and customer navigation/recovery checks. Tests create disposable databases in the system temporary folder and never seed the configured database.

Run `npm run build` followed by `npm run preview:isolated` for a disposable demo at http://127.0.0.1:3100. Sign in as `traveler` or `admin`. This preview uses test routes and deterministic successful payments. Set `PREVIEW_PAYMENT_FAILURE_ONCE=1` when starting it to exercise one payment failure before success. Stop it with Ctrl+C to clean up its temporary database.

Payments are simulations. No banking QR or real card details are used, and demo tickets are clearly labeled. The existing username-only sign-in model is preserved.

On Vercel, `api/index.js` serves the Express API and `vercel.json` routes `/api/*` to it before the page fallback. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the project's server environment; use the existing initialized database. Database credentials do not belong in `VITE_*` variables.
