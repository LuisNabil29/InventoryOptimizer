// Entidades y validacion de ingesta. Ver docs/spec/ingestion-contracts.md.

export const INGESTION_ENTITIES = [
  "sales",
  "inventory",
  "products",
  "suppliers",
  "supplier_products",
] as const;

export type IngestionEntity = (typeof INGESTION_ENTITIES)[number];

export function isIngestionEntity(value: string): value is IngestionEntity {
  return (INGESTION_ENTITIES as readonly string[]).includes(value);
}

export interface RowError {
  row: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  validRows: number;
  errorRows: number;
  errors: RowError[];
}

type Row = Record<string, unknown>;

function requireFields(row: Row, index: number, fields: string[]): RowError[] {
  const errors: RowError[] = [];
  for (const field of fields) {
    const value = row[field];
    if (value === undefined || value === null || value === "") {
      errors.push({ row: index, field, message: "required" });
    }
  }
  return errors;
}

function validateRow(entity: IngestionEntity, row: Row, index: number): RowError[] {
  switch (entity) {
    case "sales": {
      const errors = requireFields(row, index, ["date", "location_code", "sku", "quantity"]);
      if (typeof row.quantity === "number" && row.quantity <= 0) {
        errors.push({ row: index, field: "quantity", message: "must be > 0" });
      }
      return errors;
    }
    case "inventory":
      return requireFields(row, index, ["date", "location_code", "sku", "qty_on_hand"]);
    case "products":
      return requireFields(row, index, ["sku", "name"]);
    case "suppliers":
      return requireFields(row, index, ["supplier_code", "name"]);
    case "supplier_products":
      return requireFields(row, index, ["supplier_code", "sku"]);
    default: {
      const _exhaustive: never = entity;
      return _exhaustive;
    }
  }
}

export function validateRows(entity: IngestionEntity, rows: Row[]): ValidationResult {
  const errors: RowError[] = [];
  for (let i = 0; i < rows.length; i++) {
    errors.push(...validateRow(entity, rows[i], i));
  }
  const errorRowIndices = new Set(errors.map((e) => e.row));
  return {
    validRows: rows.length - errorRowIndices.size,
    errorRows: errorRowIndices.size,
    errors,
  };
}
