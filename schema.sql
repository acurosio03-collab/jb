-- Skema ARDZ STORE (opsional: tabel dibuat otomatis oleh API saat pertama dibuka)

CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE TABLE IF NOT EXISTS images (
    id SERIAL PRIMARY KEY,
    mime TEXT NOT NULL,
    data_b64 TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
    description TEXT NOT NULL DEFAULT '',
    images JSONB NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','RESERVED','SOLD')),
    reserved_until TIMESTAMPTZ,
    sold_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS accounts_status_idx ON accounts(status);

CREATE TABLE IF NOT EXISTS services (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
    description TEXT NOT NULL DEFAULT '',
    image_id INTEGER,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL DEFAULT ''
  );

INSERT INTO settings(key, value) VALUES
    ('store_name','ARDZ STORE'),
    ('tagline','JB AKUN FREE FIRE & JASA POSTING'),
    ('wa_number','6285199264394'),
    ('banner_title','Marketplace Akun Free Fire Terpercaya'),
    ('banner_subtitle','Beli akun Free Fire pilihan atau titipkan promosi akunmu lewat Jasa Posting ARDZ STORE.'),
    ('about','ARDZ STORE melayani jual beli (JB) akun Free Fire dan jasa posting akun.'),
    ('hours','Setiap hari, 08.00 - 22.00 WIB'),
    ('instagram',''),
    ('logo_image_id',''),
    ('banner_image_id','')
   ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS login_attempts (
    id SERIAL PRIMARY KEY,
    ip TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('account','service')),
    ref_id INTEGER,
    product_name TEXT NOT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','DONE','CANCELLED')),
    wa_text TEXT NOT NULL DEFAULT '',
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

CREATE INDEX IF NOT EXISTS orders_created_idx ON orders(created_at DESC);
