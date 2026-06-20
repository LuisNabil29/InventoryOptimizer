import { createHash, timingSafeEqual } from "node:crypto";

import { prisma } from "./prisma";

export interface AuthContext {
  tenantId: string;
  scopes: string[];
}

interface ApiKeyRow {
  tenant_id: string;
  key_hash: string;
  scopes: string[];
  revoked_at: Date | null;
}

/**
 * Autentica un header `Authorization: Bearer <key>` contra api_keys.
 * El formato de key es `<prefix>_<secret>`; el prefijo (todo menos el ultimo
 * segmento) se usa para el lookup y el hash sha256 del key completo se compara
 * en tiempo constante.
 */
export async function authenticateApiKey(
  authHeader: string | null,
): Promise<AuthContext | null> {
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const key = authHeader.slice("Bearer ".length).trim();
  const lastUnderscore = key.lastIndexOf("_");
  if (lastUnderscore <= 0) {
    return null;
  }
  const prefix = key.slice(0, lastUnderscore);

  const rows = await prisma.$queryRaw<ApiKeyRow[]>`
    select tenant_id, key_hash, scopes, revoked_at
    from auth_lookup_api_key(${prefix})
  `;
  if (rows.length === 0) {
    return null;
  }
  const row = rows[0];
  if (row.revoked_at) {
    return null;
  }

  const computed = createHash("sha256").update(key).digest("hex");
  const a = Buffer.from(computed);
  const b = Buffer.from(row.key_hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  return { tenantId: row.tenant_id, scopes: row.scopes };
}

export function hasScope(ctx: AuthContext, scope: string): boolean {
  return ctx.scopes.includes(scope);
}
