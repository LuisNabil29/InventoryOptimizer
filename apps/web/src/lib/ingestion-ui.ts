import { withTenant } from "./prisma";
import { getCurrentTenantId } from "./tenant";

export interface JobView {
  id: string;
  entity: string;
  source: string;
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  createdAt: string;
}

export interface RunView {
  id: string;
  runDate: string;
  trigger: string;
  status: string;
  transfers: number | null;
  purchaseOrders: number | null;
  recoveredMargin: number | null;
  startedAt: string;
}

export interface IngestionOverview {
  jobs: JobView[];
  runs: RunView[];
}

export async function getIngestionOverview(): Promise<IngestionOverview | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  return withTenant(tenantId, async (tx) => {
    const [jobs, runs] = await Promise.all([
      tx.ingestionJob.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
      tx.engineRun.findMany({ orderBy: { startedAt: "desc" }, take: 8 }),
    ]);
    return {
      jobs: jobs.map((j) => ({
        id: j.id,
        entity: j.entity,
        source: j.source,
        status: j.status,
        totalRows: j.totalRows,
        validRows: j.validRows,
        errorRows: j.errorRows,
        createdAt: j.createdAt.toISOString(),
      })),
      runs: runs.map((r) => {
        const metrics = (r.metrics ?? {}) as Record<string, unknown>;
        return {
          id: r.id,
          runDate: r.runDate.toISOString().slice(0, 10),
          trigger: r.trigger,
          status: r.status,
          transfers: typeof metrics.transfers === "number" ? metrics.transfers : null,
          purchaseOrders:
            typeof metrics.purchase_orders === "number" ? metrics.purchase_orders : null,
          recoveredMargin:
            typeof metrics.recovered_margin === "number" ? metrics.recovered_margin : null,
          startedAt: r.startedAt.toISOString(),
        };
      }),
    };
  });
}
