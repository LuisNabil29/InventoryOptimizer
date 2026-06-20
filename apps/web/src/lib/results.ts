import type { PrismaClient } from "@prisma/client";

import { withTenant } from "./prisma";
import { getCurrentTenantId } from "./tenant";

export interface RedistributionLineView {
  sku: string;
  fromCode: string;
  toCode: string;
  qty: number;
  margin: number;
  revenue: number;
}

export interface PurchaseOrderView {
  supplierCode: string;
  supplierName: string;
  totalValue: number;
  meetsMinOrder: boolean;
  lines: {
    sku: string;
    orderQty: number;
    unitCost: number;
    lineValue: number;
    isFill: boolean;
  }[];
}

export interface LevelView {
  sku: string;
  locationCode: string;
  serviceLevel: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  orderUpTo: number;
  holdingCost: number;
  pattern: string | null;
  confidence: string | null;
}

async function latestRunId(tx: PrismaClient): Promise<string | null> {
  const run = await tx.engineRun.findFirst({
    where: { status: "success" },
    orderBy: { startedAt: "desc" },
  });
  return run?.id ?? null;
}

async function productMap(tx: PrismaClient, tenantId: string) {
  const products = await tx.product.findMany({
    where: { tenantId },
    select: { id: true, sku: true },
  });
  return new Map(products.map((p) => [p.id, p.sku]));
}

async function locationMap(tx: PrismaClient, tenantId: string) {
  const locations = await tx.location.findMany({
    where: { tenantId },
    select: { id: true, code: true },
  });
  return new Map(locations.map((l) => [l.id, l.code]));
}

export async function getRedistribution(): Promise<RedistributionLineView[] | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  return withTenant(tenantId, async (tx) => {
    const runId = await latestRunId(tx);
    if (!runId) return [];
    const [lines, products, locations] = await Promise.all([
      tx.redistributionLine.findMany({ where: { plan: { runId } } }),
      productMap(tx, tenantId),
      locationMap(tx, tenantId),
    ]);
    return lines
      .map((l) => ({
        sku: products.get(l.productId) ?? l.productId,
        fromCode: locations.get(l.fromLocationId) ?? l.fromLocationId,
        toCode: locations.get(l.toLocationId) ?? l.toLocationId,
        qty: Number(l.qty),
        margin: Number(l.expectedMarginRecovered),
        revenue: Number(l.expectedRevenueRecovered),
      }))
      .sort((a, b) => b.margin - a.margin);
  });
}

export async function getPurchasing(): Promise<PurchaseOrderView[] | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  return withTenant(tenantId, async (tx) => {
    const runId = await latestRunId(tx);
    if (!runId) return [];
    const [orders, products, suppliers] = await Promise.all([
      tx.purchaseOrder.findMany({
        where: { plan: { runId } },
        include: { lines: true },
      }),
      productMap(tx, tenantId),
      tx.supplier.findMany({ where: { tenantId }, select: { id: true, code: true, name: true } }),
    ]);
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));
    return orders.map((o) => ({
      supplierCode: supplierById.get(o.supplierId)?.code ?? o.supplierId,
      supplierName: supplierById.get(o.supplierId)?.name ?? "",
      totalValue: Number(o.totalValue),
      meetsMinOrder: o.meetsMinOrder,
      lines: o.lines.map((line) => ({
        sku: products.get(line.productId) ?? line.productId,
        orderQty: Number(line.orderQty),
        unitCost: Number(line.unitCost),
        lineValue: Number(line.lineValue),
        isFill: line.isFill,
      })),
    }));
  });
}

export async function getLevels(): Promise<LevelView[] | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  return withTenant(tenantId, async (tx) => {
    const runId = await latestRunId(tx);
    if (!runId) return [];
    const [targets, stats, products, locations] = await Promise.all([
      tx.targetLevel.findMany({ where: { runId } }),
      tx.demandStat.findMany({ where: { runId } }),
      productMap(tx, tenantId),
      locationMap(tx, tenantId),
    ]);
    const statByPair = new Map(
      stats.map((s) => [`${s.productId}:${s.locationId}`, s]),
    );
    return targets
      .map((t) => {
        const stat = statByPair.get(`${t.productId}:${t.locationId}`);
        return {
          sku: products.get(t.productId) ?? t.productId,
          locationCode: locations.get(t.locationId) ?? t.locationId,
          serviceLevel: Number(t.serviceLevelUsed),
          leadTimeDays: Number(t.leadTimeDays),
          safetyStock: Number(t.safetyStock),
          reorderPoint: Number(t.reorderPoint),
          orderUpTo: Number(t.orderUpTo),
          holdingCost: Number(t.holdingCost),
          pattern: stat?.pattern ?? null,
          confidence: stat?.confidence ?? null,
        };
      })
      .sort((a, b) => (a.sku + a.locationCode).localeCompare(b.sku + b.locationCode));
  });
}
