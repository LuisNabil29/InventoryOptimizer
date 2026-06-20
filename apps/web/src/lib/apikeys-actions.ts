"use server";

import { createApiKey, revokeApiKey } from "./apikeys";

export interface CreateKeyState {
  status: "idle" | "created" | "error";
  plaintext?: string;
  keyPrefix?: string;
}

export async function createApiKeyAction(
  _prev: CreateKeyState,
  formData: FormData,
): Promise<CreateKeyState> {
  try {
    const name = String(formData.get("name") ?? "").trim();
    const scopes = formData.getAll("scopes").map((s) => String(s));
    const created = await createApiKey(name, scopes);
    if (!created) return { status: "error" };
    return { status: "created", plaintext: created.plaintext, keyPrefix: created.keyPrefix };
  } catch {
    return { status: "error" };
  }
}

export interface RevokeKeyState {
  status: "idle" | "revoked" | "error";
}

export async function revokeApiKeyAction(
  _prev: RevokeKeyState,
  formData: FormData,
): Promise<RevokeKeyState> {
  try {
    const ok = await revokeApiKey(String(formData.get("id") ?? ""));
    return { status: ok ? "revoked" : "error" };
  } catch {
    return { status: "error" };
  }
}
