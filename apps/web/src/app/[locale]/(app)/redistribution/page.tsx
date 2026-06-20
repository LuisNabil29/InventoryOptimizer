import { getTranslations, setRequestLocale } from "next-intl/server";

import { TableCard, Td, Th } from "@/components/TableCard";
import { money, num } from "@/lib/format";
import { getRedistribution } from "@/lib/results";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("redistribution");
  const td = await getTranslations("dashboard");

  let lines = null;
  try {
    lines = await getRedistribution();
  } catch {
    lines = null;
  }

  const totalMargin = (lines ?? []).reduce((sum, l) => sum + l.margin, 0);

  return (
    <section>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      {lines === null ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{td("noRun")}</p>
      ) : lines.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t("empty")}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t("summary", { count: lines.length, margin: money(totalMargin) })}
          </p>
          <div className="mt-4">
            <TableCard>
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <Th>{t("sku")}</Th>
                  <Th>{t("from")}</Th>
                  <Th>{t("to")}</Th>
                  <Th align="right">{t("qty")}</Th>
                  <Th align="right">{t("margin")}</Th>
                  <Th align="right">{t("revenue")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lines.map((l, i) => (
                  <tr key={i}>
                    <Td className="font-medium">{l.sku}</Td>
                    <Td>{l.fromCode}</Td>
                    <Td>{l.toCode}</Td>
                    <Td align="right">{num(l.qty)}</Td>
                    <Td align="right">{money(l.margin)}</Td>
                    <Td align="right">{money(l.revenue)}</Td>
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
