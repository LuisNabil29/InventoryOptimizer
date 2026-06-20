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
