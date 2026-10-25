CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paintings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  image_url TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('available', 'sold')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  painting_id TEXT NOT NULL REFERENCES paintings(id),
  price_at_purchase NUMERIC(12,2) NOT NULL CHECK (price_at_purchase >= 0),
  status TEXT NOT NULL CHECK (status IN ('placed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS only_one_placed_order_per_painting
  ON orders (painting_id) WHERE status = 'placed';

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wall_bookings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  booking_date DATE NOT NULL,
  wall_size_sqft INTEGER NOT NULL CHECK (wall_size_sqft BETWEEN 10 AND 500),
  address TEXT NOT NULL CHECK (char_length(address) BETWEEN 3 AND 500),
  rate_per_sqft NUMERIC(12,2) NOT NULL CHECK (rate_per_sqft >= 0),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  status TEXT NOT NULL CHECK (status IN ('requested', 'confirmed', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_booking_per_date
  ON wall_bookings (booking_date) WHERE status IN ('requested', 'confirmed');

CREATE TABLE IF NOT EXISTS pottery_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS glazes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pottery_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  item_id TEXT NOT NULL REFERENCES pottery_items(id),
  glaze_id TEXT NOT NULL REFERENCES glazes(id),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 12),
  needed_by DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
