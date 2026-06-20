import { getSession } from "./session";

/** Tenant actual derivado de la sesion autenticada. */
export async function getCurrentTenantId(): Promise<string | null> {
  const session = await getSession();
  return session?.tenantId ?? null;
}
