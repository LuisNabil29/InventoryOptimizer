import type { PrismaClient } from "@prisma/client";

import type { IngestionEntity, RowError } from "./ingestion";

type Row = Record<string, unknown>;

export interface PersistResult {
  processed: number;
  errors: RowError[];
}

function num(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

function toDate(value: unknown): Date {
  return new Date(`${str(value)}T00:00:00Z`);
}

/**
 * Persiste filas validas de una entidad dentro de la transaccion con tenant
 * (RLS ya fijado). Resuelve codigos de negocio a ids y reporta filas cuyas
 * referencias no existen.
 */
export async function persistRows(
  tx: PrismaClient,
  tenantId: string,
  entity: IngestionEntity,
  rows: { row: Row; index: number }[],
): Promise<PersistResult> {
  switch (entity) {
    case "suppliers":
      return persistSuppliers(tx, tenantId, rows);
    case "products":
      return persistProducts(tx, tenantId, rows);
    case "supplier_products":
      return persistSupplierProducts(tx, tenantId, rows);
    case "sales":
      return persistSales(tx, tenantId, rows);
    case "inventory":
      return persistInventory(tx, tenantId, rows);
    default: {
      const _exhaustive: never = entity;
      return _exhaustive;
    }
  }
}

async function persistSuppliers(
  tx: PrismaClient,
  tenantId: string,
  rows: { row: Row; index: number }[],
): Promise<PersistResult> {
  let processed = 0;
  for (const { row } of rows) {
    const code = str(row.supplier_code);
    await tx.supplier.upsert({
      where: { tenantId_code: { tenantId, code } },
      create: {
        tenantId,
        code,
        name: str(row.name),
        minOrderValue: num(row.min_order_value),
        defaultLeadTimeDays: num(row.default_lead_time_days, 7),
      },
      update: {
        name: str(row.name),
        minOrderValue: num(row.min_order_value),
        defaultLeadTimeDays: num(row.default_lead_time_days, 7),
      },
    });
    processed++;
  }
  return { processed, errors: [] };
}

async function persistProducts(
  tx: PrismaClient,
  tenantId: string,
  rows: { row: Row; index: number }[],
): Promise<PersistResult> {
  const errors: RowError[] = [];
  let processed = 0;

  const suppliers = await tx.supplier.findMany({
    where: { tenantId },
    select: { id: true, code: true },
  });
  const supplierByCode = new Map(suppliers.map((s) => [s.code, s.id]));

  for (const { row, index } of rows) {
    const sku = str(row.sku);
    const supplierCode = str(row.primary_supplier_code);
    let primarySupplierId: string | null = null;
    if (supplierCode) {
      const found = supplierByCode.get(supplierCode);
      if (!found) {
        errors.push({
          row: index,
          field: "primary_supplier_code",
          message: `unknown supplier ${supplierCode}`,
        });
        continue;
      }
      primarySupplierId = found;
    }
    await tx.product.upsert({
      where: { tenantId_sku: { tenantId, sku } },
      create: {
        tenantId,
        sku,
        name: str(row.name),
        unitCost: num(row.unit_cost),
        unitPrice: num(row.unit_price),
        packSize: num(row.pack_size, 1),
        primarySupplierId,
      },
      update: {
        name: str(row.name),
        unitCost: num(row.unit_cost),
        unitPrice: num(row.unit_price),
        packSize: num(row.pack_size, 1),
        primarySupplierId,
      },
    });
    processed++;
  }
  return { processed, errors };
}

async function persistSupplierProducts(
  tx: PrismaClient,
  tenantId: string,
  rows: { row: Row; index: number }[],
): Promise<PersistResult> {
  const errors: RowError[] = [];
  let processed = 0;

  const [suppliers, products] = await Promise.all([
    tx.supplier.findMany({ where: { tenantId }, select: { id: true, code: true } }),
    tx.product.findMany({ where: { tenantId }, select: { id: true, sku: true } }),
  ]);
  const supplierByCode = new Map(suppliers.map((s) => [s.code, s.id]));
  const productBySku = new Map(products.map((p) => [p.sku, p.id]));

  for (const { row, index } of rows) {
    const supplierId = supplierByCode.get(str(row.supplier_code));
    const productId = productBySku.get(str(row.sku));
    if (!supplierId) {
      errors.push({ row: index, field: "supplier_code", message: "unknown supplier" });
      continue;
    }
    if (!productId) {
      errors.push({ row: index, field: "sku", message: "unknown sku" });
      continue;
    }
    const leadTime = row.lead_time_days;
    await tx.supplierProduct.upsert({
      where: { tenantId_supplierId_productId: { tenantId, supplierId, productId } },
      create: {
        tenantId,
        supplierId,
        productId,
        leadTimeDays: leadTime == null || leadTime === "" ? null : num(leadTime),
        moq: num(row.moq),
        orderMultiple: num(row.order_multiple, 1),
        unitCost: row.unit_cost == null || row.unit_cost === "" ? null : num(row.unit_cost),
      },
      update: {
        leadTimeDays: leadTime == null || leadTime === "" ? null : num(leadTime),
        moq: num(row.moq),
        orderMultiple: num(row.order_multiple, 1),
        unitCost: row.unit_cost == null || row.unit_cost === "" ? null : num(row.unit_cost),
      },
    });
    processed++;
  }
  return { processed, errors };
}

async function persistSales(
  tx: PrismaClient,
  tenantId: string,
  rows: { row: Row; index: number }[],
): Promise<PersistResult> {
  const errors: RowError[] = [];
  let processed = 0;

  const { locationByCode, productBySku } = await loadCodeMaps(tx, tenantId);

  for (const { row, index } of rows) {
    const locationId = locationByCode.get(str(row.location_code));
    const productId = productBySku.get(str(row.sku));
    if (!locationId) {
      errors.push({ row: index, field: "location_code", message: "unknown location" });
      continue;
    }
    if (!productId) {
      errors.push({ row: index, field: "sku", message: "unknown sku" });
      continue;
    }
    const externalId = str(row.external_id) || null;
    const data = {
      tenantId,
      occurredOn: toDate(row.date),
      locationId,
      productId,
      type: "sale",
      qty: num(row.quantity),
      unitPrice: row.unit_price == null || row.unit_price === "" ? null : num(row.unit_price),
      unitCost: row.unit_cost == null || row.unit_cost === "" ? null : num(row.unit_cost),
      source: "api",
      externalId,
    };
    if (externalId) {
      await tx.inventoryMovement.upsert({
        where: { tenantId_externalId: { tenantId, externalId } },
        create: data,
        update: data,
      });
    } else {
      await tx.inventoryMovement.create({ data });
    }
    processed++;
  }
  return { processed, errors };
}

async function persistInventory(
  tx: PrismaClient,
  tenantId: string,
  rows: { row: Row; index: number }[],
): Promise<PersistResult> {
  const errors: RowError[] = [];
  let processed = 0;

  const { locationByCode, productBySku } = await loadCodeMaps(tx, tenantId);

  for (const { row, index } of rows) {
    const locationId = locationByCode.get(str(row.location_code));
    const productId = productBySku.get(str(row.sku));
    if (!locationId) {
      errors.push({ row: index, field: "location_code", message: "unknown location" });
      continue;
    }
    if (!productId) {
      errors.push({ row: index, field: "sku", message: "unknown sku" });
      continue;
    }
    const snapshotOn = toDate(row.date);
    const qtyOnHand = num(row.qty_on_hand);
    const qtyOnOrder = num(row.qty_on_order);
    await tx.inventorySnapshot.upsert({
      where: {
        tenantId_snapshotOn_locationId_productId: {
          tenantId,
          snapshotOn,
          locationId,
          productId,
        },
      },
      create: { tenantId, snapshotOn, locationId, productId, qtyOnHand, qtyOnOrder },
      update: { qtyOnHand, qtyOnOrder },
    });
    processed++;
  }
  return { processed, errors };
}

async function loadCodeMaps(tx: PrismaClient, tenantId: string) {
  const [locations, products] = await Promise.all([
    tx.location.findMany({ where: { tenantId }, select: { id: true, code: true } }),
    tx.product.findMany({ where: { tenantId }, select: { id: true, sku: true } }),
  ]);
  return {
    locationByCode: new Map(locations.map((l) => [l.code, l.id])),
    productBySku: new Map(products.map((p) => [p.sku, p.id])),
  };
}
