import { getTranslations, setRequestLocale } from "next-intl/server";

import { TableCard, Td, Th } from "@/components/TableCard";
import { money, num, pct } from "@/lib/format";
import { getLevels } from "@/lib/results";

export const dynamic = "force-dynamic";

const PATTERNS = ["smooth", "erratic", "intermittent", "lumpy"] as const;
const CONFIDENCE = ["low", "medium", "high"] as const;

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("levels");
  const td = await getTranslations("dashboard");

  let rows = null;
  try {
    rows = await getLevels();
  } catch {
    rows = null;
  }

  const patternLabel = (p: string | null) =>
    p && (PATTERNS as readonly string[]).includes(p)
      ? t(`patterns.${p}`)
      : t("patterns.unknown");

  const confidenceLabel = (c: string | null) =>
    c && (CONFIDENCE as readonly string[]).includes(c) ? t(`confidenceLevels.${c}`) : "—";

  return (
    <section>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      {rows === null ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{td("noRun")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t("empty")}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t("summary", { count: rows.length })}
          </p>
          <div className="mt-4">
            <TableCard>
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <Th>{t("sku")}</Th>
                  <Th>{t("location")}</Th>
                  <Th align="right">{t("serviceLevel")}</Th>
                  <Th align="right">{t("leadTime")}</Th>
                  <Th align="right">{t("safetyStock")}</Th>
                  <Th align="right">{t("reorderPoint")}</Th>
                  <Th align="right">{t("orderUpTo")}</Th>
                  <Th align="right">{t("holdingCost")}</Th>
                  <Th>{t("pattern")}</Th>
                  <Th>{t("confidence")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <Td className="font-medium">{r.sku}</Td>
                    <Td>{r.locationCode}</Td>
                    <Td align="right">{pct(r.serviceLevel)}</Td>
                    <Td align="right">{num(r.leadTimeDays)}</Td>
                    <Td align="right">{num(r.safetyStock)}</Td>
                    <Td align="right">{num(r.reorderPoint)}</Td>
                    <Td align="right">{num(r.orderUpTo)}</Td>
                    <Td align="right">{money(r.holdingCost)}</Td>
                    <Td>{patternLabel(r.pattern)}</Td>
                    <Td>{confidenceLabel(r.confidence)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          </div>
        </>
      )}
    </section>
  );
}
