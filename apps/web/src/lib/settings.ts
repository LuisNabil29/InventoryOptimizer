import { withTenant } from "./prisma";
import { getCurrentTenantId } from "./tenant";

export interface TenantSettingsView {
  costOfCapitalPct: number;
  defaultServiceLevel: number;
  globalLeadTimeDays: number;
  reviewPeriodDays: number;
  abcAPct: number;
  abcBPct: number;
  abcBasis: string;
  stockoutThreshold: number;
  defaultLocale: string;
  defaultTheme: string;
}

export interface TenantSettingsUpdate {
  costOfCapitalPct: number;
  defaultServiceLevel: number;
  globalLeadTimeDays: number;
  reviewPeriodDays: number;
  abcAPct: number;
  abcBPct: number;
  abcBasis: string;
  stockoutThreshold: number;
  defaultLocale: string;
  defaultTheme: string;
}

export async function getSettings(): Promise<TenantSettingsView | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  return withTenant(tenantId, async (tx) => {
    const s = await tx.tenantSettings.findUnique({ where: { tenantId } });
    if (!s) return null;
    return {
      costOfCapitalPct: Number(s.costOfCapitalPct),
      defaultServiceLevel: Number(s.defaultServiceLevel),
      globalLeadTimeDays: s.globalLeadTimeDays,
      reviewPeriodDays: s.reviewPeriodDays,
      abcAPct: Number(s.abcAPct),
      abcBPct: Number(s.abcBPct),
      abcBasis: s.abcBasis,
      stockoutThreshold: Number(s.stockoutThreshold),
      defaultLocale: s.defaultLocale,
      defaultTheme: s.defaultTheme,
    };
  });
}

export async function updateSettings(data: TenantSettingsUpdate): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return false;
  await withTenant(tenantId, async (tx) => {
    await tx.tenantSettings.update({
      where: { tenantId },
      data: {
        costOfCapitalPct: data.costOfCapitalPct,
        defaultServiceLevel: data.defaultServiceLevel,
        globalLeadTimeDays: data.globalLeadTimeDays,
        reviewPeriodDays: data.reviewPeriodDays,
        abcAPct: data.abcAPct,
        abcBPct: data.abcBPct,
        abcBasis: data.abcBasis,
        stockoutThreshold: data.stockoutThreshold,
        defaultLocale: data.defaultLocale,
        defaultTheme: data.defaultTheme,
      },
    });
  });
  return true;
}
