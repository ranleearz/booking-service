CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TYPE user_role AS ENUM ('client', 'admin');
CREATE TYPE booking_status AS ENUM ('confirmed', 'cancelled');
CREATE TYPE notification_type AS ENUM ('booking_created', 'booking_cancelled');

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_email_key UNIQUE (email)
);

CREATE TABLE refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT refresh_tokens_hash_key UNIQUE (token_hash)
);

CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  duration_minutes integer NOT NULL,
  price_cents integer NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT services_duration_check CHECK (duration_minutes >= 15 AND duration_minutes <= 480 AND duration_minutes % 15 = 0),
  CONSTRAINT services_price_check CHECK (price_cents >= 0)
);

CREATE TABLE specialists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE specialist_services (
  specialist_id uuid NOT NULL REFERENCES specialists (id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  PRIMARY KEY (specialist_id, service_id)
);

CREATE TABLE weekly_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES specialists (id) ON DELETE CASCADE,
  weekday smallint NOT NULL,
  start_minute smallint NOT NULL,
  end_minute smallint NOT NULL,
  CONSTRAINT weekly_hours_weekday_check CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT weekly_hours_range_check CHECK (start_minute >= 0 AND start_minute < 1440 AND end_minute > start_minute AND end_minute <= 1440),
  CONSTRAINT weekly_hours_specialist_weekday_key UNIQUE (specialist_id, weekday)
);

CREATE TABLE days_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL REFERENCES specialists (id) ON DELETE CASCADE,
  day date NOT NULL,
  CONSTRAINT days_off_specialist_day_key UNIQUE (specialist_id, day)
);

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES users (id),
  specialist_id uuid NOT NULL REFERENCES specialists (id),
  service_id uuid NOT NULL REFERENCES services (id),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  cancel_reason text,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bookings_range_check CHECK (ends_at > starts_at)
);

ALTER TABLE bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    specialist_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status = 'confirmed');

CREATE INDEX bookings_client_starts_idx ON bookings (client_id, starts_at DESC);
CREATE INDEX bookings_specialist_starts_idx ON bookings (specialist_id, starts_at);
CREATE INDEX bookings_confirmed_range_idx ON bookings (specialist_id, starts_at, ends_at) WHERE status = 'confirmed';

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx ON notifications (user_id) WHERE read_at IS NULL;
