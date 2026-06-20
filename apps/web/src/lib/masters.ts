import { withTenant } from "./prisma";
import { getCurrentTenantId } from "./tenant";

export interface LocationView {
  id: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

export interface SupplierView {
  id: string;
  code: string;
  name: string;
  minOrderValue: number;
  defaultLeadTimeDays: number;
}

export interface ProductView {
  id: string;
  sku: string;
  name: string;
  unitCost: number;
  unitPrice: number;
  packSize: number;
  primarySupplierId: string | null;
  isActive: boolean;
}

export interface MastersData {
  locations: LocationView[];
  suppliers: SupplierView[];
  products: ProductView[];
}

export async function getMasters(): Promise<MastersData | null> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) return null;
  return withTenant(tenantId, async (tx) => {
    const [locations, suppliers, products] = await Promise.all([
      tx.location.findMany({ where: { tenantId }, orderBy: { code: "asc" } }),
      tx.supplier.findMany({ where: { tenantId }, orderBy: { code: "asc" } }),
      tx.product.findMany({ where: { tenantId }, orderBy: { sku: "asc" } }),
    ]);
    return {
      locations: locations.map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        type: l.type,
        isActive: l.isActive,
      })),
      suppliers: suppliers.map((s) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        minOrderValue: Number(s.minOrderValue),
        defaultLeadTimeDays: s.defaultLeadTimeDays,
      })),
      products: products.map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        unitCost: Number(p.unitCost),
        unitPrice: Number(p.unitPrice),
        packSize: Number(p.packSize),
        primarySupplierId: p.primarySupplierId,
        isActive: p.isActive,
      })),
    };
  });
}

export interface LocationInput {
  id?: string;
  code: string;
  name: string;
  type: string;
  isActive: boolean;
}

export async function saveLocation(input: LocationInput): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId || !input.code || !input.name) return false;
  await withTenant(tenantId, async (tx) => {
    if (input.id) {
      await tx.location.update({
        where: { id: input.id },
        data: { code: input.code, name: input.name, type: input.type, isActive: input.isActive },
      });
    } else {
      await tx.location.create({
        data: {
          tenantId,
          code: input.code,
          name: input.name,
          type: input.type,
          isActive: input.isActive,
        },
      });
    }
  });
  return true;
}

export interface SupplierInput {
  id?: string;
  code: string;
  name: string;
  minOrderValue: number;
  defaultLeadTimeDays: number;
}

export async function saveSupplier(input: SupplierInput): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId || !input.code || !input.name) return false;
  await withTenant(tenantId, async (tx) => {
    if (input.id) {
      await tx.supplier.update({
        where: { id: input.id },
        data: {
          code: input.code,
          name: input.name,
          minOrderValue: input.minOrderValue,
          defaultLeadTimeDays: input.defaultLeadTimeDays,
        },
      });
    } else {
      await tx.supplier.create({
        data: {
          tenantId,
          code: input.code,
          name: input.name,
          minOrderValue: input.minOrderValue,
          defaultLeadTimeDays: input.defaultLeadTimeDays,
        },
      });
    }
  });
  return true;
}

export interface ProductInput {
  id?: string;
  sku: string;
  name: string;
  unitCost: number;
  unitPrice: number;
  packSize: number;
  primarySupplierId: string | null;
  isActive: boolean;
}

export async function saveProduct(input: ProductInput): Promise<boolean> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId || !input.sku || !input.name) return false;
  await withTenant(tenantId, async (tx) => {
    const data = {
      sku: input.sku,
      name: input.name,
      unitCost: input.unitCost,
      unitPrice: input.unitPrice,
      packSize: input.packSize,
      primarySupplierId: input.primarySupplierId,
      isActive: input.isActive,
    };
    if (input.id) {
      await tx.product.update({ where: { id: input.id }, data });
    } else {
      await tx.product.create({ data: { tenantId, ...data } });
    }
  });
  return true;
}
