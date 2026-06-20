import { prisma } from "./prisma";

/**
 * Resuelve el tenant actual. Sin auth de UI aun, devuelve el primer tenant
 * (demo). TODO(auth): derivar el tenant de la sesion del usuario autenticado.
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  return tenant?.id ?? null;
}
