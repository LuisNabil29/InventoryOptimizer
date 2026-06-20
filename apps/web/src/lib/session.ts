import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";

export const SESSION_COOKIE = "io_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export interface SessionData {
  userId: string;
  tenantId: string;
  email: string;
  name: string | null;
  exp: number; // epoch segundos
}

function secret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "dev_secret_change_me";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function serializeSession(data: SessionData): string {
  const payload = b64url(JSON.stringify(data));
  return `${payload}.${sign(payload)}`;
}

export function parseSession(token: string | undefined): SessionData | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as SessionData;
    if (typeof data.exp !== "number" || data.exp * 1000 < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

/** Lee y valida la sesion de la cookie (server components / actions). */
export async function getSession(): Promise<SessionData | null> {
  const store = await cookies();
  return parseSession(store.get(SESSION_COOKIE)?.value);
}

export async function createSession(
  data: Omit<SessionData, "exp">,
): Promise<void> {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const token = serializeSession({ ...data, exp });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
