import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;
const COST = 16384; // N
const BLOCK_SIZE = 8; // r
const PARALLEL = 1; // p

/**
 * Hashea una contrasena con scrypt (stdlib, sin dependencias nativas).
 * Formato: `scrypt$<saltHex>$<hashHex>`.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLEL,
  });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = scryptSync(password, salt, expected.length, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLEL,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
