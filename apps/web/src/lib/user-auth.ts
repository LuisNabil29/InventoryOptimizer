import { prisma } from "./prisma";
import { verifyPassword } from "./password";

export interface MembershipRow {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: string;
}

export interface LoginResult {
  userId: string;
  email: string;
  name: string | null;
  memberships: MembershipRow[];
}

/**
 * Valida email + password contra `users` (sin RLS) y resuelve las membresias
 * del usuario via funcion SECURITY DEFINER. Devuelve null si las credenciales
 * son invalidas o el usuario no pertenece a ningun tenant activo.
 */
export async function login(email: string, password: string): Promise<LoginResult | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true, passwordHash: true },
  });
  if (!user) return null;
  if (!verifyPassword(password, user.passwordHash)) return null;

  const memberships = await prisma.$queryRaw<MembershipRow[]>`
    select tenant_id, tenant_name, tenant_slug, role
    from auth_user_memberships(${user.id}::uuid)
  `;
  if (memberships.length === 0) return null;

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    memberships,
  };
}

/** Verifica que el usuario pertenezca al tenant indicado (para cambiar tenant). */
export async function userBelongsToTenant(userId: string, tenantId: string): Promise<boolean> {
  const memberships = await prisma.$queryRaw<MembershipRow[]>`
    select tenant_id, tenant_name, tenant_slug, role
    from auth_user_memberships(${userId}::uuid)
  `;
  return memberships.some((m) => m.tenant_id === tenantId);
}
