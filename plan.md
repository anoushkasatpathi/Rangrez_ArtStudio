# Rangrez implementation plan

## Scope and approach

Build Rangrez as a small JavaScript monorepo: an Express API under `backend/` and a Vite React app under `frontend/`. PostgreSQL is accessed through `pg` using `DATABASE_URL`; all prices, roles, ownership, state transitions and concurrency rules are enforced by the server. The seed script is safe to rerun and loads the supplied 12 paintings, 5 pottery items, 6 glazes, INR currency and ₹150/sq ft mural rate while creating or updating the env-based admin. The legacy `studioAccount` from the archive is intentionally ignored.

The API uses signed JWTs stored in an application-owned httpOnly cookie named `kalagrha_session`. Preview cookies use `SameSite=None; Secure`; plain HTTP development uses a separate local cookie configuration. Passwords use bcrypt. A small auth/RBAC middleware layer returns exact 401/403/404 behavior. Painting purchase is an atomic conditional update inside a transaction; wall dates are guarded by a partial unique index and the unique violation is converted into the required 409 message. The frontend consumes the REST API through a small client, uses route-based screens, and keeps a clear loading/empty/error state for each data-loading view.

When no external `DATABASE_URL` is available in the managed preview, the API starts in a deterministic demo mode backed by the supplied seed dataset so the interface remains usable; migrations, seed and production operation use PostgreSQL as documented in `README.md`. No browser-safe secret is shipped to Vite.

## Project structure

- `backend/src/server.js`: Express app, routes, validation, auth, transactions and demo fallback.
- `backend/src/db.js`: PostgreSQL pool, schema migration helper and seed helpers.
- `backend/src/seed-data.js`: normalized copy of the supplied seed data and image paths.
- `backend/migrations/001_initial.sql`: PostgreSQL schema, checks and partial unique indexes.
- `backend/scripts/migrate.js`, `backend/scripts/seed.js`: one-time commands for clean setup.
- `backend/tests/rules.test.js`: critical-rule test harness and documented curl examples.
- `frontend/src/`: React routes, API client, session context, forms, gallery and dashboard UI.
- `frontend/public/images/`: supplied painting images copied from the archive.
- `frontend/public/manus-routes.json`: complete page route manifest for Preview.
- `README.md`, `DESIGN.md`, `.env.example`, `.gitignore`: handoff and operating docs.

## Design

### Design movement

Rangrez is a **retro Indian craft editorial**: the dark gallery of a contemporary art house meets the warm, tactile energy of a 1970s pottery studio and a print lookbook.

### Core principles

1. Let the artwork lead: generous image crops, quiet product cards and strong whitespace.
2. Make warmth functional: the exact Rangrez palette carries both atmosphere and state feedback.
3. Pair editorial drama with plain-language controls so purchasing and booking never feel ambiguous.
4. Use motion as a soft material cue, not as a barrier to completing a form.

### Color philosophy

Tea Green and Khaki create the daylight of a studio wall; Ebony grounds the system like ink; Chestnut carries the hand-painted mark of the brand; Aztec Gold is the glint of glaze and frame. Every surface and control uses these five CSS variables so the interface feels like one room.

### Layout paradigm

The home page moves from a dark, centered “gallery room” into offset editorial bands with vertical labels, horizontal rhythm and overlapping color blobs. Functional pages settle into a readable two-column or stacked form layout with a sticky studio nav and small status chips.

### Signature elements

- A framed, continuously drifting painting rail in the home hero.
- Large display-serif chapter titles with narrow uppercase utility labels.
- Soft Tea Green / Khaki / Aztec Gold blobs and a circular “made by hand” badge.

### Interaction philosophy and animation

Primary interactions should feel like sliding a print across a worktable: 180–260ms ease-out transitions, gentle hover lift, and a home carousel that pauses on hover/focus. Forms use immediate inline validation and visible server messages. Respect reduced-motion preferences and never hide essential content behind animation.

### Typography system

Use `Playfair Display` for display headlines and `DM Sans` for navigation, labels, body copy and form controls. Headlines are compact and high-contrast; supporting copy stays at comfortable reading size. Vertical labels are uppercase, letter-spaced and Ebony/Khaki depending on their surface.

### Brand essence and voice

Rangrez is a warm, independent art studio for people who want a piece of Indian craft in their everyday spaces: **handmade, spirited, considered**. Copy is direct and tactile: “Find the piece that keeps its colour.” and “Give your wall a date worth remembering.”

### Wordmark and signature color

The logo is an SVG matka with a dripping-paint glaze beside a RANGREZ wordmark with a Devanagari-style headline bar. Chestnut `#963F2E` is the ownable signature color: it reads like pigment, kiln heat and a studio stamp across every surface.
