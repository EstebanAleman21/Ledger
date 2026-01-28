-- Supabase schema for Ledger Finance Tracker (source of truth)
-- Requires: extension pgcrypto for gen_random_uuid()

create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('cash', 'debit', 'credit', 'savings', 'investment')),
  currency text not null check (currency in ('MXN', 'USD')),
  balance numeric not null default 0,
  opening_balance numeric not null default 0,
  credit_limit numeric,
  statement_day integer check (statement_day >= 1 and statement_day <= 31),
  color text,
  icon text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  color text,
  parent_id uuid references categories(id),
  type text not null check (type in ('income', 'expense', 'both')),
  budget numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  description text not null,
  amount numeric not null,
  type text not null check (type in ('income', 'expense', 'transfer', 'adjustment')),
  category_id uuid references categories(id),
  account_id uuid references accounts(id),
  to_account_id uuid references accounts(id),
  currency text not null check (currency in ('MXN', 'USD')),
  converted_amount numeric,
  conversion_rate numeric,
  tags text[] default '{}',
  notes text,
  needs_review boolean not null default false,
  import_hash text unique,
  source text not null default 'app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id),
  month text not null,
  amount numeric not null,
  rollover boolean not null default false,
  rollover_amount numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rates (
  id uuid primary key default gen_random_uuid(),
  from_currency text not null check (from_currency in ('MXN', 'USD')),
  to_currency text not null check (to_currency in ('MXN', 'USD')),
  rate numeric not null,
  date date not null,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (from_currency, to_currency)
);

create table if not exists rules (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references categories(id),
  field text not null check (field in ('description', 'amount', 'tags')),
  operator text not null check (operator in ('contains', 'equals', 'startsWith', 'endsWith', 'greaterThan', 'lessThan')),
  value text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists settings (
  key text primary key,
  value text not null
);

create table if not exists installments (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete restrict,
  description text not null,
  amount numeric not null,
  months_total integer not null check (months_total > 0),
  months_remaining integer not null check (months_remaining >= 0 and months_remaining <= months_total),
  has_interest boolean not null default false,
  interest_amount_per_month numeric not null default 0,
  purchase_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists installments_account_id_idx on installments(account_id);
