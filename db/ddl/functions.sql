-- Funciones de soporte. Aplicar como rol privilegiado.

-- Lookup de API key para autenticacion. SECURITY DEFINER para poder resolver el
-- tenant ANTES de fijar app.current_tenant (el lookup ocurre fuera de RLS).
-- Solo devuelve la fila correspondiente al prefijo dado.
create or replace function auth_lookup_api_key(p_prefix text)
returns table (
  tenant_id  uuid,
  key_hash   text,
  scopes     text[],
  revoked_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select tenant_id, key_hash, scopes, revoked_at
  from api_keys
  where key_prefix = p_prefix
$$;

revoke all on function auth_lookup_api_key(text) from public;
grant execute on function auth_lookup_api_key(text) to app;

-- Membresias de un usuario para el login. SECURITY DEFINER porque memberships
-- tiene RLS y en el login aun no hay tenant fijado (se resuelve cual usar).
create or replace function auth_user_memberships(p_user_id uuid)
returns table (
  tenant_id   uuid,
  tenant_name text,
  tenant_slug text,
  role        text
)
language sql
security definer
set search_path = public
as $$
  select m.tenant_id, t.name, t.slug, m.role
  from memberships m
  join tenants t on t.id = m.tenant_id
  where m.user_id = p_user_id
    and t.status = 'active'
  order by m.created_at
$$;

revoke all on function auth_user_memberships(uuid) from public;
grant execute on function auth_user_memberships(uuid) to app;
