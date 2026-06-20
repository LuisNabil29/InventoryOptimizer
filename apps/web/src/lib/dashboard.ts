import { prisma, withTenant } from "./prisma";
import { getCurrentTenantId } from "./tenant";

export interface DashboardData {
  tenantName: string;
  hasRun: boolean;
  recoveredMargin: number;
  recoveredRevenue: number;
  releasedCapital: number;
  lostMargin: number;
  transfers: number;
}

const EMPTY = {
  hasRun: false,
  recoveredMargin: 0,
  recoveredRevenue: 0,
  releasedCapital: 0,
  lostMargin: 0,
  transfers: 0,
};

/** Datos del tablero para el tenant de la sesion actual. */
export async function getDashboardData(): Promise<DashboardData | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    return null;
  }
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    return null;
  }

  return withTenant(tenant.id, async (tx) => {
    const run = await tx.engineRun.findFirst({
      where: { status: "success" },
      orderBy: { startedAt: "desc" },
    });
    if (!run) {
      return { tenantName: tenant.name, ...EMPTY };
    }

    const [impact, lost, transfers] = await Promise.all([
      tx.impactSimulation.findFirst({
        where: { runId: run.id },
        orderBy: { createdAt: "desc" },
      }),
      tx.lostSalesEstimate.aggregate({
        where: { runId: run.id },
        _sum: { lostMargin: true },
      }),
      tx.redistributionLine.count({ where: { plan: { runId: run.id } } }),
    ]);

    return {
      tenantName: tenant.name,
      hasRun: true,
      recoveredMargin: Number(impact?.recoveredMargin ?? 0),
      recoveredRevenue: Number(impact?.recoveredRevenue ?? 0),
      releasedCapital: Number(impact?.releasedCapital ?? 0),
      lostMargin: Number(lost._sum.lostMargin ?? 0),
      transfers,
    };
  });
}
