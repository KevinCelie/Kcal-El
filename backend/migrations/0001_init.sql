CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goal INTEGER NOT NULL DEFAULT 2000,
  energy_unit TEXT NOT NULL DEFAULT 'kcal',
  qty_step DOUBLE PRECISION NOT NULL DEFAULT 0.5
);

CREATE TABLE IF NOT EXISTS foods (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kcal_per_100g DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS foods_user_id_idx ON foods(user_id);
CREATE INDEX IF NOT EXISTS foods_name_trgm_idx ON foods (lower(name));

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_grams DOUBLE PRECISION NOT NULL DEFAULT 0,
  kcal_per_100g DOUBLE PRECISION NOT NULL DEFAULT 0,
  kcal_total DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recipes_user_id_idx ON recipes(user_id);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  grams DOUBLE PRECISION NOT NULL,
  kcal_per_100g DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_id_idx ON recipe_ingredients(recipe_id);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  meal TEXT NOT NULL,
  food_id TEXT REFERENCES foods(id) ON DELETE SET NULL,
  recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  unit_mode TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  kcal_total DOUBLE PRECISION NOT NULL,
  is_recipe BOOLEAN NOT NULL DEFAULT false,
  recipe_snapshot JSONB,
  ts BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS journal_entries_user_date_idx ON journal_entries(user_id, date);
