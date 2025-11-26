# Get Packages Endpoint Schema Review

## Checklist

### public.countries
- id uuid PRIMARY KEY DEFAULT gen_random_uuid(), NOT NULL — ❌ Missing table
- country_code text NOT NULL UNIQUE — ❌ Missing
- name text NOT NULL — ❌ Missing
- slug text NOT NULL UNIQUE — ❌ Missing
- image_url text — ❌ Missing
- metadata jsonb DEFAULT '{}'::jsonb — ❌ Missing
- created_at timestamptz NOT NULL DEFAULT now() — ❌ Missing
- updated_at timestamptz NOT NULL DEFAULT now() — ❌ Missing

### public.operators
- id uuid PRIMARY KEY DEFAULT gen_random_uuid(), NOT NULL — ❌ Missing table
- country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT — ❌ Missing
- name text NOT NULL — ❌ Missing
- api_operator_id integer — ❌ Missing
- operator_code text — ❌ Missing
- metadata jsonb DEFAULT '{}'::jsonb — ❌ Missing
- created_at timestamptz NOT NULL DEFAULT now() — ❌ Missing
- updated_at timestamptz NOT NULL DEFAULT now() — ❌ Missing

### public.packages
- id uuid PRIMARY KEY DEFAULT gen_random_uuid(), NOT NULL — ❌ Missing table
- country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT — ❌ Missing
- operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE RESTRICT — ❌ Missing
- external_id text NOT NULL — ❌ Missing
- name text NOT NULL — ❌ Missing
- data_amount_mb integer — ❌ Missing
- validity_days integer — ❌ Missing
- is_unlimited boolean NOT NULL DEFAULT false — ❌ Missing
- price numeric(10,2) NOT NULL — ❌ Missing
- currency_code text DEFAULT 'USD' — ❌ Missing
- short_info text — ❌ Missing
- qr_installation text — ❌ Missing
- manual_installation text — ❌ Missing
- is_fair_usage_policy boolean — ❌ Missing
- fair_usage_policy text — ❌ Missing
- metadata jsonb DEFAULT '{}'::jsonb — ❌ Missing
- created_at timestamptz NOT NULL DEFAULT now() — ❌ Missing
- updated_at timestamptz NOT NULL DEFAULT now() — ❌ Missing

## SQL Migration
```sql
-- Enable gen_random_uuid for UUID defaults (available by default on Supabase)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Countries table
CREATE TABLE IF NOT EXISTS public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL UNIQUE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Operators table
CREATE TABLE IF NOT EXISTS public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
  name text NOT NULL,
  api_operator_id integer,
  operator_code text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Packages table
CREATE TABLE IF NOT EXISTS public.packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE RESTRICT,
  operator_id uuid NOT NULL REFERENCES public.operators(id) ON DELETE RESTRICT,
  external_id text NOT NULL,
  name text NOT NULL,
  data_amount_mb integer,
  validity_days integer,
  is_unlimited boolean NOT NULL DEFAULT false,
  price numeric(10,2) NOT NULL,
  currency_code text DEFAULT 'USD',
  short_info text,
  qr_installation text,
  manual_installation text,
  is_fair_usage_policy boolean,
  fair_usage_policy text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

```
