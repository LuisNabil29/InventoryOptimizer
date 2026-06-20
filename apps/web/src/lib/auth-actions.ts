"use server";

import { redirect } from "next/navigation";

import { routing } from "@/i18n/routing";
import { createSession, destroySession, getSession } from "./session";
import { login, userBelongsToTenant } from "./user-auth";

export interface LoginState {
  error: string | null;
}

function safeLocale(value: FormDataEntryValue | null): string {
  const v = String(value ?? "");
  return (routing.locales as readonly string[]).includes(v) ? v : routing.defaultLocale;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const locale = safeLocale(formData.get("locale"));

  if (!email || !password) {
    return { error: "missing" };
  }

  const result = await login(email, password);
  if (!result) {
    return { error: "invalid" };
  }

  const membership = result.memberships[0];
  await createSession({
    userId: result.userId,
    tenantId: membership.tenant_id,
    email: result.email,
    name: result.name,
  });
  redirect(`/${locale}`);
}

export async function logoutAction(formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  await destroySession();
  redirect(`/${locale}/login`);
}

export async function switchTenantAction(formData: FormData): Promise<void> {
  const locale = safeLocale(formData.get("locale"));
  const tenantId = String(formData.get("tenantId") ?? "");
  const session = await getSession();
  if (!session || !tenantId) {
    redirect(`/${locale}/login`);
  }
  if (await userBelongsToTenant(session!.userId, tenantId)) {
    await createSession({
      userId: session!.userId,
      tenantId,
      email: session!.email,
      name: session!.name,
    });
  }
  redirect(`/${locale}`);
}
