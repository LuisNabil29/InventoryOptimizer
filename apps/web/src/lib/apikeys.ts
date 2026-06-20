import { createHash, randomBytes } from "node:crypto";

import { withTenant } from "./prisma";
import { getCurrentTenantId } from "./tenant";

export interface ApiKeyView {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export const AVAILABLE_SCOPES = ["ingest:write", "read"] as const;

export async function listApiKeys(): Promise<ApiKeyView[] | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  return withTenant(tenantId, async (tx) => {
    const keys = await tx.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      keyPrefix: k.keyPrefix,
      scopes: k.scopes,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      revokedAt: k.revokedAt?.toISOString() ?? null,
    }));
  });
}

export interface CreatedApiKey {
  plaintext: string;
  keyPrefix: string;
}

/** Crea una API key y devuelve el secreto en claro UNA sola vez. */
export async function createApiKey(
  name: string,
  scopes: string[],
): Promise<CreatedApiKey | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId || !name.trim()) return null;
  const validScopes = scopes.filter((s) => (AVAILABLE_SCOPES as readonly string[]).includes(s));
  if (validScopes.length === 0) return null;

  const keyPrefix = `iok_${randomBytes(4).toString("hex")}`;
  const secret = randomBytes(24).toString("hex");
  const plaintext = `${keyPrefix}_${secret}`;
  const keyHash = createHash("sha256").update(plaintext).digest("hex");

  await withTenant(tenantId, async (tx) => {
    await tx.apiKey.create({
      data: { tenantId, name: name.trim(), keyPrefix, keyHash, scopes: validScopes },
    });
  });
  return { plaintext, keyPrefix };
}

export async function revokeApiKey(id: string): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId || !id) return false;
  await withTenant(tenantId, async (tx) => {
    await tx.apiKey.updateMany({
      where: { id, tenantId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
  return true;
}
