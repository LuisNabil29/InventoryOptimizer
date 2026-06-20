import { getTranslations, setRequestLocale } from "next-intl/server";

import { StatCard } from "@/components/StatCard";
import { money } from "@/lib/format";
import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  let data = null;
  try {
    data = await getDashboardData();
  } catch {
    data = null;
  }

  return (
    <section>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {data?.tenantName ? (
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {data.tenantName}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("recoveredMargin")} value={money(data?.recoveredMargin ?? 0)} />
        <StatCard label={t("recoveredRevenue")} value={money(data?.recoveredRevenue ?? 0)} />
        <StatCard label={t("releasedCapital")} value={money(data?.releasedCapital ?? 0)} />
        <StatCard label={t("lostSales")} value={money(data?.lostMargin ?? 0)} />
      </div>

      {!data?.hasRun ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t("noRun")}</p>
      ) : null}
    </section>
  );
}
