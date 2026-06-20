import { prisma, withTenant } from "./prisma";

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

/**
 * Datos del tablero para el tenant actual. Sin auth de UI aun, se resuelve el
 * primer tenant (demo). TODO(auth): derivar el tenant de la sesion del usuario.
 */
export async function getDashboardData(): Promise<DashboardData | null> {
  const tenant = await prisma.tenant.findFirst({ orderBy: { createdAt: "asc" } });
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
