-- Inventory Optimizer - esquema de referencia (PostgreSQL 16+)
-- Multi-tenant por tenant_id + Row-Level Security.
-- Ejecutar como rol privilegiado (migraciones). El rol de app NO debe tener BYPASSRLS.

begin;

create extension if not exists pgcrypto;  -- gen_random_uuid

-- ============================================================
-- Identidad y configuracion
-- ============================================================

create table if not exists tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  status      text not null default 'active',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  password_hash text,
  locale        text not null default 'es',
  theme         text not null default 'system',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists memberships (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null default 'member',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table if not exists tenant_settings (
  tenant_id             uuid primary key references tenants(id) on delete cascade,
  cost_of_capital_pct   numeric(6,4)  not null default 0.20,
  default_service_level numeric(6,4)  not null default 0.95,
  global_lead_time_days integer       not null default 7,
  review_period_days    integer       not null default 1,
  abc_a_pct             numeric(6,4)  not null default 0.80,
  abc_b_pct             numeric(6,4)  not null default 0.15,
  abc_basis             text          not null default 'margin',
  stockout_threshold    numeric(18,4) not null default 0,
  default_locale        text          not null default 'es',
  default_theme         text          not null default 'system',
  updated_at            timestamptz   not null default now()
);

-- ============================================================
-- Maestros de negocio
-- ============================================================

create table if not exists locations (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  code       text not null,
  name       text not null,
  type       text not null,                 -- store | warehouse
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists suppliers (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references tenants(id) on delete cascade,
  code                   text not null,
  name                   text not null,
  min_order_value        numeric(18,4) not null default 0,
  default_lead_time_days integer not null default 7,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists products (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references tenants(id) on delete cascade,
  sku                 text not null,
  name                text not null,
  unit_cost           numeric(18,4) not null default 0,
  unit_price          numeric(18,4) not null default 0,
  pack_size           numeric(18,4) not null default 1,
  primary_supplier_id uuid references suppliers(id) on delete set null,
  is_active           boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table if not exists supplier_products (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references tenants(id) on delete cascade,
  supplier_id    uuid not null references suppliers(id) on delete cascade,
  product_id     uuid not null references products(id) on delete cascade,
  lead_time_days integer,
  moq            numeric(18,4) not null default 0,
  order_multiple numeric(18,4) not null default 1,
  unit_cost      numeric(18,4),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (tenant_id, supplier_id, product_id)
);

-- ============================================================
-- Datos transaccionales
-- ============================================================

create table if not exists inventory_movements (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  occurred_on  date not null,
  location_id  uuid not null references locations(id) on delete cascade,
  product_id   uuid not null references products(id) on delete cascade,
  type         text not null,                -- sale|receipt|transfer_in|transfer_out|adjustment
  qty          numeric(18,4) not null,
  unit_price   numeric(18,4),
  unit_cost    numeric(18,4),
  source       text not null default 'csv',
  external_id  text,
  created_at   timestamptz not null default now(),
  unique (tenant_id, external_id)
);
create index if not exists idx_mov_demand on inventory_movements (tenant_id, product_id, location_id, occurred_on);
create index if not exists idx_mov_type on inventory_movements (tenant_id, type, occurred_on);

create table if not exists inventory_snapshots (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  snapshot_on  date not null,
  location_id  uuid not null references locations(id) on delete cascade,
  product_id   uuid not null references products(id) on delete cascade,
  qty_on_hand  numeric(18,4) not null default 0,
  qty_on_order numeric(18,4) not null default 0,
  created_at   timestamptz not null default now(),
  unique (tenant_id, snapshot_on, location_id, product_id)
);
create index if not exists idx_snap on inventory_snapshots (tenant_id, product_id, location_id, snapshot_on);

-- ============================================================
-- Clasificacion y politicas de nivel de servicio
-- ============================================================

create table if not exists classification_schemes (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  code       text not null,
  name       text not null,
  kind       text not null default 'custom', -- abc | custom
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists classifications (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  scheme_id  uuid not null references classification_schemes(id) on delete cascade,
  code       text not null,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, scheme_id, code)
);

create table if not exists product_classifications (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  product_id        uuid not null references products(id) on delete cascade,
  classification_id uuid not null references classifications(id) on delete cascade,
  assigned_by       text not null default 'system',
  created_at        timestamptz not null default now(),
  unique (tenant_id, product_id, classification_id)
);

create table if not exists service_level_policies (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  classification_id uuid references classifications(id) on delete cascade,
  product_id        uuid references products(id) on delete cascade,
  service_level     numeric(6,4) not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ( (classification_id is not null) <> (product_id is not null) )
);
create unique index if not exists uq_slp_class on service_level_policies (tenant_id, classification_id)
  where classification_id is not null;
create unique index if not exists uq_slp_prod on service_level_policies (tenant_id, product_id)
  where product_id is not null;

-- ============================================================
-- Resultados del motor
-- ============================================================

create table if not exists engine_runs (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  run_date     date not null,
  trigger      text not null default 'batch',
  status       text not null default 'running',
  period_start date,
  period_end   date,
  metrics      jsonb,
  error        text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  unique (tenant_id, run_date, trigger)
);

create table if not exists demand_stats (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  run_id            uuid not null references engine_runs(id) on delete cascade,
  product_id        uuid not null references products(id) on delete cascade,
  location_id       uuid not null references locations(id) on delete cascade,
  mean_daily        numeric(18,6) not null,
  std_daily         numeric(18,6) not null,
  adi               numeric(18,6),
  cv2               numeric(18,6),
  pattern           text,
  data_points       integer not null default 0,
  confidence        text not null default 'low',
  fallback_to_class boolean not null default false,
  unique (run_id, product_id, location_id)
);

create table if not exists target_levels (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references tenants(id) on delete cascade,
  run_id             uuid not null references engine_runs(id) on delete cascade,
  product_id         uuid not null references products(id) on delete cascade,
  location_id        uuid not null references locations(id) on delete cascade,
  service_level_used numeric(6,4) not null,
  lead_time_days     numeric(10,2) not null,
  safety_stock       numeric(18,4) not null,
  reorder_point      numeric(18,4) not null,
  order_up_to        numeric(18,4) not null,
  holding_cost       numeric(18,4) not null,
  unique (run_id, product_id, location_id)
);

create table if not exists lost_sales_estimates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references tenants(id) on delete cascade,
  run_id        uuid not null references engine_runs(id) on delete cascade,
  product_id    uuid not null references products(id) on delete cascade,
  location_id   uuid not null references locations(id) on delete cascade,
  stockout_days integer not null default 0,
  lost_units    numeric(18,4) not null default 0,
  lost_revenue  numeric(18,4) not null default 0,
  lost_margin   numeric(18,4) not null default 0,
  unique (run_id, product_id, location_id)
);

create table if not exists redistribution_plans (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  run_id     uuid not null references engine_runs(id) on delete cascade,
  status     text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists redistribution_lines (
  id                         uuid primary key default gen_random_uuid(),
  tenant_id                  uuid not null references tenants(id) on delete cascade,
  plan_id                    uuid not null references redistribution_plans(id) on delete cascade,
  product_id                 uuid not null references products(id) on delete cascade,
  from_location_id           uuid not null references locations(id),
  to_location_id             uuid not null references locations(id),
  qty                        numeric(18,4) not null,
  expected_margin_recovered  numeric(18,4) not null default 0,
  expected_revenue_recovered numeric(18,4) not null default 0,
  status                     text not null default 'draft'
);

create table if not exists purchase_plans (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references tenants(id) on delete cascade,
  run_id     uuid not null references engine_runs(id) on delete cascade,
  status     text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  plan_id         uuid not null references purchase_plans(id) on delete cascade,
  supplier_id     uuid not null references suppliers(id),
  total_value     numeric(18,4) not null default 0,
  meets_min_order boolean not null default true,
  status          text not null default 'draft',
  created_at      timestamptz not null default now()
);

create table if not exists po_lines (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  po_id           uuid not null references purchase_orders(id) on delete cascade,
  product_id      uuid not null references products(id) on delete cascade,
  location_id     uuid references locations(id),
  net_requirement numeric(18,4) not null,
  order_qty       numeric(18,4) not null,
  unit_cost       numeric(18,4) not null,
  line_value      numeric(18,4) not null,
  is_fill         boolean not null default false
);

create table if not exists impact_simulations (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references tenants(id) on delete cascade,
  run_id            uuid not null references engine_runs(id) on delete cascade,
  recovered_revenue numeric(18,4) not null default 0,
  recovered_margin  numeric(18,4) not null default 0,
  released_capital  numeric(18,4) not null default 0,
  breakdown         jsonb,
  created_at        timestamptz not null default now()
);

-- ============================================================
-- Ingesta y API keys
-- ============================================================

create table if not exists ingestion_jobs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references tenants(id) on delete cascade,
  entity          text not null,
  source          text not null,
  status          text not null default 'pending',
  total_rows      integer not null default 0,
  valid_rows      integer not null default 0,
  error_rows      integer not null default 0,
  errors          jsonb,
  idempotency_key text,
  created_at      timestamptz not null default now(),
  finished_at     timestamptz,
  unique (tenant_id, idempotency_key)
);

create table if not exists api_keys (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references tenants(id) on delete cascade,
  name         text not null,
  key_prefix   text not null,
  key_hash     text not null,
  scopes       text[] not null default '{ingest:write,read}',
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now(),
  unique (tenant_id, key_prefix)
);

commit;

-- ============================================================
-- Row-Level Security
-- Aplica aislamiento por tenant en toda tabla con columna tenant_id.
-- La aplicacion fija: select set_config('app.current_tenant', '<uuid>', true);
-- ============================================================

do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'tenant_id'
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
    execute format('drop policy if exists tenant_isolation on %I;', t);
    execute format(
      'create policy tenant_isolation on %I '
      'using (tenant_id = current_setting(''app.current_tenant'', true)::uuid) '
      'with check (tenant_id = current_setting(''app.current_tenant'', true)::uuid);',
      t
    );
  end loop;
end $$;

-- Rol de aplicacion (sin BYPASSRLS). Ajustar password via variable de entorno.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app') then
    create role app login password 'app_password_change_me';
  end if;
end $$;

grant usage on schema public to app;
grant select, insert, update, delete on all tables in schema public to app;
alter default privileges in schema public grant select, insert, update, delete on tables to app;
