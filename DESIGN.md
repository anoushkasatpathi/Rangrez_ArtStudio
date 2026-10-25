# Rangrez design notes

## 1. Login and roles

Customers create accounts with an email and password. Passwords are bcrypt hashes, and a signed JWT is stored in the httpOnly `kalagrha_session` cookie. Admin accounts are not sign-up eligible: the repeatable seed command creates or updates the admin from `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The API middleware checks the session and role on every protected route. Guests receive 401, authenticated customers attempting admin work receive 403, and a customer asking for another customer’s order, booking or pottery request receives 404 so ownership is not leaked.

## 2. Database choice

The production data model uses Supabase PostgreSQL through the `pg` library because the requested project already has a PostgreSQL connection string and the rules benefit from transactions, checks and partial unique indexes. The app reads `DATABASE_URL` from `backend/.env` at runtime and does not use client-side Supabase auth or row-level security. PostgreSQL is required; there is no alternate database implementation.

## 3. Preventing duplicate purchases and dates

Buying a painting runs an atomic `UPDATE paintings SET status='sold' WHERE id=$1 AND status='available' RETURNING ...` inside the same transaction as the order insert. If no row is updated the API returns 409 with `This painting was just sold.` The database also has a partial unique index allowing only one placed order per painting. Wall bookings have a partial unique index on `booking_date` for `requested` and `confirmed` rows, so cancelled and declined dates are free again. A unique violation becomes 409 with `That date was just taken.` The server computes and stores the wall price from the seeded ₹150 rate.

## 4. What is finished, out of scope and next

Finished here are the customer/admin flows, supplied seed content and images, server-side validation, state transitions, ownership checks, the home editorial/gallery direction, clean functional screens, documentation and critical-rule tests. Real payments, uploads, email/SMS, password reset, email verification, social login, mobile-specific layout, reviews, coupons, delivery tracking and deployment automation remain out of scope as requested. A next step would be a production backup/recovery plan, a customer notification channel, richer admin editing for existing paintings, and an end-to-end test suite against a disposable Supabase schema.

## 5. Rangrez rename and Home update

The public name is now **Rangrez** (रंगरेज़, "the colourer"), with an original SVG logo: a matka whose glaze is dripping paint, joining painting, wall colour and pottery in one mark. Backend identifiers from the earlier name (the `kalagrha_session` cookie, `admin@kalagrha.test`, the backend package name) were left unchanged on purpose, because this update touched only the frontend.

The Home page was rebuilt as scroll-driven sections: a once-per-session intro where painting frames fly in from two "hallway walls" and turn to face forward; a 3D cover-flow row of paintings (drag, swipe, arrow keys, Sold/Available badges); two trails moving in opposite directions whose speed follows scroll velocity; a pinned services section that cross-fades the three services; and the existing About cards. Headlines use Elsie Swash Caps, an ornamental high-contrast serif with swash capitals. Smooth scrolling uses the small Lenis library. Every animation is skipped for reduced-motion users, and if the scripts fail, all content stays visible.
