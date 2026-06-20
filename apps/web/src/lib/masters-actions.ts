"use server";

import { saveLocation, saveProduct, saveSupplier } from "./masters";

export interface MasterState {
  status: "idle" | "saved" | "error";
  entity?: "location" | "supplier" | "product";
}

function num(value: FormDataEntryValue | null, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function bool(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

function id(value: FormDataEntryValue | null): string | undefined {
  const v = String(value ?? "").trim();
  return v.length > 0 ? v : undefined;
}

export async function saveLocationAction(
  _prev: MasterState,
  formData: FormData,
): Promise<MasterState> {
  try {
    const ok = await saveLocation({
      id: id(formData.get("id")),
      code: String(formData.get("code") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      type: String(formData.get("type") ?? "store"),
      isActive: bool(formData.get("isActive")),
    });
    return { status: ok ? "saved" : "error", entity: "location" };
  } catch {
    return { status: "error", entity: "location" };
  }
}

export async function saveSupplierAction(
  _prev: MasterState,
  formData: FormData,
): Promise<MasterState> {
  try {
    const ok = await saveSupplier({
      id: id(formData.get("id")),
      code: String(formData.get("code") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      minOrderValue: num(formData.get("minOrderValue")),
      defaultLeadTimeDays: Math.trunc(num(formData.get("defaultLeadTimeDays"), 7)),
    });
    return { status: ok ? "saved" : "error", entity: "supplier" };
  } catch {
    return { status: "error", entity: "supplier" };
  }
}

export async function saveProductAction(
  _prev: MasterState,
  formData: FormData,
): Promise<MasterState> {
  try {
    const supplierId = String(formData.get("primarySupplierId") ?? "").trim();
    const ok = await saveProduct({
      id: id(formData.get("id")),
      sku: String(formData.get("sku") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      unitCost: num(formData.get("unitCost")),
      unitPrice: num(formData.get("unitPrice")),
      packSize: num(formData.get("packSize"), 1),
      primarySupplierId: supplierId.length > 0 ? supplierId : null,
      isActive: bool(formData.get("isActive")),
    });
    return { status: ok ? "saved" : "error", entity: "product" };
  } catch {
    return { status: "error", entity: "product" };
  }
}
