# Rangrez delivery outcomes

## 1. Project foundation and seed data
- [ ] Provide JavaScript everywhere with a React/Vite frontend, Node.js/Express backend, and PostgreSQL access through `pg` using `DATABASE_URL`.
- [ ] Include `README.md`, `DESIGN.md`, `.env.example`, `.gitignore`, `backend/`, `frontend/`, `seed/`, migrations and tests/curl examples; do not commit real `.env` values or credentials.
- [ ] Load the supplied dataset as source of truth: 12 paintings with their titles, artists, descriptions, prices, image paths and available/sold status; 5 pottery items; 6 glazes; INR currency; mural rate ₹150 per sq ft. Ignore the legacy `studioAccount` and seed/update the required env-based admin with role `admin`.
- [ ] Make seed/migration commands rerunnable without overwriting user-edited records during normal startup.

## 2. Authentication and server-side access control
- [ ] Implement customer email/password signup and login with bcrypt/argon2 password hashing, JWT or server sessions, logout, and current-user lookup.
- [ ] Seed at least one admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; admin accounts cannot be signed up through the customer endpoint.
- [ ] Enforce roles on every protected request: not logged in returns 401; wrong role returns 403; a customer requesting another user’s record returns 404.
- [ ] Preserve the application-owned cookie session in embedded HTTPS Preview with `SameSite=None; Secure`, while allowing plain local HTTP development.

## 3. Paintings and one-of-a-kind orders
- [ ] Public/authenticated painting browse supports available and sold records; painting detail is available.
- [ ] Admin can add paintings with title, artist/description, price, image URL and status, and can edit a painting only while it is available.
- [ ] Customers can buy only an available painting. The server creates a `placed` order and marks the painting `sold` atomically in a transaction.
- [ ] Two concurrent buyers cannot both succeed. Use an atomic conditional update and return 409 with exactly `This painting was just sold.` when no row is updated.
- [ ] Customer can view/cancel only their own order; cancellation changes the order to `cancelled` and makes the painting available again. Admin can view all orders but cannot use customer cancellation endpoints.

## 4. Wall painting bookings
- [ ] Customer supplies booking date, wall size in sq ft and required address. Date is inclusive between 7 and 90 days from today; wall size is inclusive 10–500 sq ft; address is non-empty with a sensible maximum length.
- [ ] Price is computed on the server as wall size × seeded rate and stored on the booking; the UI may preview it but never controls it.
- [ ] A date can have only one `requested`/`confirmed` booking at a time. Use a database-level partial unique index and return 409 with exactly `That date was just taken.` on the conflict.
- [ ] Booking transitions are `requested` → `confirmed`/`declined`, or customer `cancelled`; invalid transitions are rejected. Cancelled or declined bookings free the date.
- [ ] A customer can cancel their own booking only until 3 days before its date; after that the server refuses with a clear message. Admin can confirm/decline all bookings but cannot use customer cancellation endpoints.
- [ ] Provide taken dates for the date picker and customer/admin booking lists with loading, empty and error states.

## 5. Custom pottery requests
- [ ] Provide seed-backed item and glaze options. Customer chooses an item, glaze, quantity 1–12 and a needed-by date at least 14 days away.
- [ ] Status transitions are `requested` → `accepted`/`declined`, or customer `cancelled`; server rejects invalid transitions.
- [ ] Customer can edit or cancel only their own request and only while `requested`; admin can view all and accept/decline but cannot use customer cancellation endpoints.
- [ ] Provide clear loading, empty and error states and show server refusal messages inline/toast.

## 6. React screens and Rangrez interface
- [ ] Provide home/landing, signup/login, paintings gallery, painting detail, wall booking, pottery request, customer account tabs and admin dashboard screens.
- [ ] Home combines a dark gallery hero, continuously drifting/hover-pausing painting rail, editorial service sections for paintings/wall/pottery, large serif type, vertical labels, palette blobs, slide counter/badge and reduced-motion-friendly transitions.
- [ ] Functional pages use clean high-contrast layouts with the exact CSS variables Tea Green `#CAEDB8`, Ebony `#56694F`, Chestnut `#963F2E`, Aztec Gold `#CD9B59`, Khaki `#EDE490`.
- [ ] Hide/disable actions unavailable to the current role while retaining server-side guards. Server errors such as “just sold”, “date just taken” and late cancellation are shown clearly.
- [ ] Keep `frontend/public/manus-routes.json` synchronized with every page route and serve it as a static JSON document.

## 7. Documentation and critical-rule checks
- [ ] README documents prerequisites, env setup, DB migration + seed commands, backend/frontend run commands, admin credential location/change process and tests.
- [ ] DESIGN.md explains role/login behavior, database choice, double-buy/double-book protection, and what is finished/left out/next.
- [ ] Include automated or scripted checks covering RBAC 401/403/404, double-buy, double-book, 7–90 day booking window, 3-day cancellation rule and pottery edit-only-while-requested.
