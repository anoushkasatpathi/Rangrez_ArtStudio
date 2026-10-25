# Rangrez (रंगरेज़) Art Studio

**Rangrez** (Hindi रंगरेज़, "the colourer": a traditional Indian dyer) is a full-stack art studio website. Customers buy one-of-a-kind paintings, book a wall painting, and request custom pottery. The studio admin manages paintings, bookings and pottery requests.

- **Frontend:** React 18 + Vite (`frontend/`)
- **Backend:** Node.js + Express (`backend/`)
- **Database:** Supabase Postgres, reached through the `pg` library with `DATABASE_URL`

## Prerequisites

1. Node.js 20 LTS or newer from <https://nodejs.org/> (npm is included).
2. A terminal (PowerShell on Windows).
3. Extract the project and enter the folder:

```powershell
cd C:\path\to\rangrez
```

## 1. Fill in `backend/.env`

`backend/.env` is already in the package with placeholders (it is listed in `.gitignore`, so it is never pushed). Open it and fill in:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | Your Supabase connection string. Replace `<PASSWORD>` with your database password. |
| `ADMIN_EMAIL` | The studio admin's login email. `npm run seed` creates or updates this account. Default: `admin@kalagrha.test` (the earlier name is kept here on purpose so the existing admin account keeps working). |
| `ADMIN_PASSWORD` | The admin's password. Choose a strong one. |
| `JWT_SECRET` | A long random string used to sign login tokens. |
| `PORT` | Backend port. Leave `3001`. |
| `FRONTEND_URL` | Where the website runs. Leave `http://localhost:3000`. |
| `API_URL` | Where the API runs. Leave `http://localhost:3001`. |
| `COOKIE_SECURE` | `false` for local http development. |

Generate a `JWT_SECRET`:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`frontend/.env` only has `VITE_API_URL`. Leave it empty for local development (Vite proxies `/api` to the backend).

## 2. Install and start the backend

```powershell
cd backend
npm install
npm run migrate   # creates tables and concurrency indexes (safe to re-run)
npm run seed      # loads 12 paintings, 5 pottery items, 6 glazes, the ₹150/sq ft rate and the admin (safe to re-run)
npm start
```

Keep this window open. The API listens on **http://localhost:3001**.

If your Supabase database already has the tables and seed data from before, you do **not** need to run `migrate` or `seed` again: the rename to Rangrez changed only the frontend. Running them again is harmless.

## 3. Install and start the frontend

Open a second terminal:

```powershell
cd C:\path\to\rangrez\frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

To make a production build: `npm run build` in `frontend/`. The files go to `frontend/dist`, and the backend serves that folder when it exists.

## Home page notes

- **Opening animation** plays once per browser session. To see it again, open a new tab or clear the site's session storage. It is skipped automatically for visitors who turn on "reduce motion" in their system settings.
- **Cover-flow speed:** change `COVERFLOW_SPEED` at the top of `frontend/src/home/CoverFlow.jsx`.
- **Trail speeds:** change `TOP_SPEED` / `BOTTOM_SPEED` at the top of `frontend/src/home/PaintingTrails.jsx`.
- **Fonts** come from Google Fonts: Elsie Swash Caps (big Home headlines), DM Sans (body), Cormorant Garamond (inner-page headings) and Tiro Devanagari Hindi (रंगरेज़). To change the headline font, edit `--display` at the top of `frontend/src/styles.css` and the Google Fonts link above it.
- **Logo files** are in `frontend/public/`: `logo.svg` (light backgrounds), `logo-dark.svg` (dark backgrounds), `logo-mark.svg`, `favicon.svg`, plus the alternative design `logo-alt.svg`, `logo-alt-dark.svg` and `logo-mark-alt.svg`.

## Tests

```powershell
cd backend
node --test tests/rules.test.js
```

The tests need a working `DATABASE_URL`. **Known issue (not changed in this update):** tests 4 and 5 adjust records through an in-memory `memory` store that `server.js` no longer provides, so those two fail with a `TypeError`. Tests 1 to 3 (RBAC 401/403/404, painting bought only once, duplicate wall date) pass.

## Troubleshooting

**Database connection error.** Check `DATABASE_URL` in `backend/.env`: project reference, region, port and password. Don't wrap the URL in quotes. Then run `npm run migrate` again.

**`prepared statements` error with the Supabase pooler.** Use the Session pooler string on port **5432** for `migrate` and `seed`, then switch back to the port 6543 string for normal use if you prefer.

**Port already in use.** The frontend uses 3000 and the backend 3001. Close the other program, or change `PORT` (and `FRONTEND_URL` / the Vite proxy) to match.

**Login cookie or CORS issue.** Use `http://localhost:3000` (not `127.0.0.1`), with `FRONTEND_URL=http://localhost:3000` and `COOKIE_SECURE=false`.

**"The Rangrez API is unavailable".** The website can't reach the backend. Start the backend first (`npm start` in `backend`), then the frontend.

**Fonts look plain.** The display font loads from Google Fonts, so you need an internet connection. Without it, the page falls back to a serif font but still works.

## Project tree

```text
rangrez/
├── README.md
├── DESIGN.md
├── plan.md, TODO.md            (earlier planning notes)
├── .gitignore
├── backend/                    (unchanged in this update)
│   ├── .env.example
│   ├── .env                    (placeholders; fill in, never commit)
│   ├── package.json
│   ├── migrations/001_initial.sql
│   ├── scripts/migrate.js, seed.js
│   ├── src/db.js, seed-data.js, server.js
│   └── tests/rules.test.js
├── frontend/
│   ├── .env.example
│   ├── .env                    (placeholder)
│   ├── package.json
│   ├── index.html
│   ├── vite.config.js
│   ├── public/
│   │   ├── favicon.svg, logo*.svg
│   │   └── images/p-001.jpg … p-012.jpg
│   └── src/
│       ├── main.jsx            (routes, header, footer, pages)
│       ├── AdminScreen.jsx
│       ├── api.js
│       ├── styles.css          (global styles)
│       ├── DisplayText.jsx     (headline with the Devanagari-style bar)
│       ├── HomeExperience.jsx  (Home page)
│       ├── home.css            (Home page styles)
│       └── home/
│           ├── IntroHallway.jsx    (opening animation)
│           ├── CoverFlow.jsx       (hero painting row)
│           ├── PaintingTrails.jsx  (two opposite trails)
│           ├── ServicesPinned.jsx  (pinned services section)
│           ├── AboutCards.jsx
│           ├── FrameImage.jsx      (image with placeholder fallback)
│           └── motion.js           (smooth scroll, reveal, parallax helpers)
└── seed/seed.json
```

The zip leaves out `node_modules`, `dist` and `.git`.
