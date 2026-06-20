import { getTranslations, setRequestLocale } from "next-intl/server";

import { IngestionPanel } from "@/components/IngestionPanel";
import { TableCard, Td, Th } from "@/components/TableCard";
import { money } from "@/lib/format";
import { getIngestionOverview } from "@/lib/ingestion-ui";

export const dynamic = "force-dynamic";

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("ingestion");

  const overview = await getIngestionOverview();
  const jobs = overview?.jobs ?? [];
  const runs = overview?.runs ?? [];

  return (
    <section>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t("subtitle")}</p>

      <IngestionPanel />

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-base font-semibold">{t("recentJobs")}</h2>
          {jobs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("noJobs")}</p>
          ) : (
            <TableCard>
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <Th>{t("colEntity")}</Th>
                  <Th>{t("colStatus")}</Th>
                  <Th align="right">{t("colRows")}</Th>
                  <Th align="right">{t("colWhen")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <Td className="font-medium">{t(`entities.${j.entity}`)}</Td>
                    <Td>{j.status}</Td>
                    <Td align="right">
                      {j.validRows}/{j.totalRows}
                    </Td>
                    <Td align="right">{fmtWhen(j.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>

        <div>
          <h2 className="mb-2 text-base font-semibold">{t("recentRuns")}</h2>
          {runs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t("noRuns")}</p>
          ) : (
            <TableCard>
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <Th>{t("colRun")}</Th>
                  <Th>{t("colStatus")}</Th>
                  <Th align="right">{t("colTransfers")}</Th>
                  <Th align="right">{t("colPOs")}</Th>
                  <Th align="right">{t("colMargin")}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <Td className="font-medium">{r.runDate}</Td>
                    <Td>{r.status}</Td>
                    <Td align="right">{r.transfers ?? "—"}</Td>
                    <Td align="right">{r.purchaseOrders ?? "—"}</Td>
                    <Td align="right">
                      {r.recoveredMargin !== null ? money(r.recoveredMargin) : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableCard>
          )}
        </div>
      </div>
    </section>
  );
}
