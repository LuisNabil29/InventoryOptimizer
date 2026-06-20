"use server";

import { updateSettings } from "./settings";

export interface SettingsState {
  status: "idle" | "saved" | "error";
}

function pct(value: FormDataEntryValue | null): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, Math.round((n / 100) * 10000) / 10000));
}

function int(value: FormDataEntryValue | null, min: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, n);
}

function num(value: FormDataEntryValue | null, min: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, n);
}

export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    const ok = await updateSettings({
      costOfCapitalPct: pct(formData.get("costOfCapitalPct")),
      defaultServiceLevel: pct(formData.get("defaultServiceLevel")),
      globalLeadTimeDays: int(formData.get("globalLeadTimeDays"), 1),
      reviewPeriodDays: int(formData.get("reviewPeriodDays"), 1),
      abcAPct: pct(formData.get("abcAPct")),
      abcBPct: pct(formData.get("abcBPct")),
      abcBasis: String(formData.get("abcBasis") ?? "margin"),
      stockoutThreshold: num(formData.get("stockoutThreshold"), 0),
      defaultLocale: String(formData.get("defaultLocale") ?? "es"),
      defaultTheme: String(formData.get("defaultTheme") ?? "system"),
    });
    if (!ok) return { status: "error" };
    return { status: "saved" };
  } catch {
    return { status: "error" };
  }
}
