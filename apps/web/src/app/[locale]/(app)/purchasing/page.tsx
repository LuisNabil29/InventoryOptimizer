import { getTranslations, setRequestLocale } from "next-intl/server";

import { TableCard, Td, Th } from "@/components/TableCard";
import { money, num } from "@/lib/format";
import { getPurchasing } from "@/lib/results";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("purchasing");
  const td = await getTranslations("dashboard");

  let orders = null;
  try {
    orders = await getPurchasing();
  } catch {
    orders = null;
  }

  const totalValue = (orders ?? []).reduce((sum, o) => sum + o.totalValue, 0);

  return (
    <section>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      {orders === null ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{td("noRun")}</p>
      ) : orders.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">{t("empty")}</p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t("summary", { orders: orders.length, total: money(totalValue) })}
          </p>
          <div className="mt-4 space-y-6">
            {orders.map((o, i) => (
              <div key={i}>
                <div className="mb-2 flex items-baseline justify-between gap-4">
                  <h2 className="text-base font-semibold">
                    {o.supplierName || o.supplierCode}{" "}
                    <span className="text-sm font-normal text-slate-400">{o.supplierCode}</span>
                  </h2>
                  <div className="text-right">
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {t("orderTotal")}:{" "}
                    </span>
                    <span className="font-semibold tabular-nums">{money(o.totalValue)}</span>
                    {!o.meetsMinOrder ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        {t("belowMin")}
                      </span>
                    ) : null}
                  </div>
                </div>
                <TableCard>
                  <thead className="border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <Th>{t("sku")}</Th>
                      <Th align="right">{t("qty")}</Th>
                      <Th align="right">{t("unitCost")}</Th>
                      <Th align="right">{t("lineValue")}</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {o.lines.map((line, j) => (
                      <tr key={j}>
                        <Td className="font-medium">
                          {line.sku}
                          {line.isFill ? (
                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                              {t("fill")}
                            </span>
                          ) : null}
                        </Td>
                        <Td align="right">{num(line.orderQty)}</Td>
                        <Td align="right">{money(line.unitCost)}</Td>
                        <Td align="right">{money(line.lineValue)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </TableCard>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
