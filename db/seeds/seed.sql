-- Datos demo para desarrollo. Ejecutar como rol privilegiado (bypassa RLS).
-- Idempotente via on conflict.

begin;

-- Tenant demo
insert into tenants (id, name, slug)
values ('11111111-1111-1111-1111-111111111111', 'Demo Retail', 'demo-retail')
on conflict (slug) do nothing;

insert into tenant_settings (tenant_id)
values ('11111111-1111-1111-1111-111111111111')
on conflict (tenant_id) do nothing;

-- Usuario demo (password_hash placeholder; configurar auth real aparte)
insert into users (id, email, name, locale)
values ('22222222-2222-2222-2222-222222222222', 'demo@example.com', 'Demo User', 'es')
on conflict (email) do nothing;

insert into memberships (tenant_id, user_id, role)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'owner')
on conflict (tenant_id, user_id) do nothing;

-- Ubicaciones
insert into locations (tenant_id, code, name, type) values
  ('11111111-1111-1111-1111-111111111111', 'WH-001', 'Centro Distribucion', 'warehouse'),
  ('11111111-1111-1111-1111-111111111111', 'ST-001', 'Sucursal Centro', 'store'),
  ('11111111-1111-1111-1111-111111111111', 'ST-002', 'Sucursal Norte', 'store')
on conflict (tenant_id, code) do nothing;

-- Proveedor
insert into suppliers (tenant_id, code, name, min_order_value, default_lead_time_days) values
  ('11111111-1111-1111-1111-111111111111', 'SUP-ACME', 'Acme Distribucion', 5000, 10)
on conflict (tenant_id, code) do nothing;

-- Productos
insert into products (tenant_id, sku, name, unit_cost, unit_price, pack_size, primary_supplier_id)
select '11111111-1111-1111-1111-111111111111', v.sku, v.name, v.cost, v.price, 1, s.id
from (values
  ('SKU-1001', 'Cable USB-C 1m', 28.00, 49.90),
  ('SKU-1002', 'Cargador 20W', 95.00, 169.00),
  ('SKU-1003', 'Funda silicona', 18.00, 39.90)
) as v(sku, name, cost, price)
cross join (select id from suppliers where code = 'SUP-ACME'
            and tenant_id = '11111111-1111-1111-1111-111111111111') s
on conflict (tenant_id, sku) do nothing;

-- Relacion proveedor-producto
insert into supplier_products (tenant_id, supplier_id, product_id, lead_time_days, moq, order_multiple, unit_cost)
select '11111111-1111-1111-1111-111111111111', sup.id, p.id, 10, 50, 10, p.unit_cost
from products p
join suppliers sup on sup.code = 'SUP-ACME'
  and sup.tenant_id = '11111111-1111-1111-1111-111111111111'
where p.tenant_id = '11111111-1111-1111-1111-111111111111'
on conflict (tenant_id, supplier_id, product_id) do nothing;

-- Esquema y clases ABC
insert into classification_schemes (id, tenant_id, code, name, kind)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'ABC', 'Clasificacion ABC', 'abc')
on conflict (tenant_id, code) do nothing;

insert into classifications (tenant_id, scheme_id, code, name) values
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'A', 'Clase A'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'B', 'Clase B'),
  ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'C', 'Clase C')
on conflict (tenant_id, scheme_id, code) do nothing;

-- Politicas de nivel de servicio por clase
insert into service_level_policies (tenant_id, classification_id, service_level)
select '11111111-1111-1111-1111-111111111111', c.id,
       case c.code when 'A' then 0.98 when 'B' then 0.95 else 0.90 end
from classifications c
where c.tenant_id = '11111111-1111-1111-1111-111111111111'
  and c.scheme_id = '33333333-3333-3333-3333-333333333333'
on conflict do nothing;

commit;
