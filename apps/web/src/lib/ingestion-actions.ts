"use server";

import { Prisma } from "@prisma/client";

import { parseCsv } from "./csv";
import { triggerRun } from "./engine";
import { isIngestionEntity, validateRows, type RowError } from "./ingestion";
import { persistRows } from "./ingestion-persist";
import { withTenant } from "./prisma";
import { getCurrentTenantId } from "./tenant";

export interface UploadState {
  status: "idle" | "done" | "error";
  message?: string;
  entity?: string;
  totalRows?: number;
  persisted?: number;
  errorRows?: number;
  sampleErrors?: RowError[];
}

export interface RunState {
  status: "idle" | "done" | "error";
  runId?: string;
  runStatus?: string;
}

export async function uploadCsvAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const entity = String(formData.get("entity") ?? "");
  if (!isIngestionEntity(entity)) {
    return { status: "error", message: "badEntity" };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "error", message: "noFile" };
  }

  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    return { status: "error", message: "noSession" };
  }

  let rows: Record<string, unknown>[];
  try {
    rows = parseCsv(await file.text());
  } catch {
    return { status: "error", message: "parse" };
  }
  if (rows.length === 0) {
    return { status: "error", message: "empty" };
  }

  const validation = validateRows(entity, rows);
  const errorRowIndices = new Set(validation.errors.map((e) => e.row));
  const validRows = rows
    .map((row, index) => ({ row, index }))
    .filter((r) => !errorRowIndices.has(r.index));

  const result = await withTenant(tenantId, async (tx) => {
    const persist = await persistRows(tx, tenantId, entity, validRows);
    const allErrors = [...validation.errors, ...persist.errors];
    const errorRows = new Set(allErrors.map((e) => e.row)).size;
    const status = persist.processed === 0 ? "failed" : errorRows > 0 ? "partial" : "success";
    await tx.ingestionJob.create({
      data: {
        tenantId,
        entity,
        source: "csv",
        status,
        totalRows: rows.length,
        validRows: persist.processed,
        errorRows,
        errors: allErrors.slice(0, 100) as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
      },
    });
    return { persisted: persist.processed, errorRows, sampleErrors: allErrors.slice(0, 5) };
  });

  return {
    status: "done",
    entity,
    totalRows: rows.length,
    persisted: result.persisted,
    errorRows: result.errorRows,
    sampleErrors: result.sampleErrors,
  };
}

export async function runEngineAction(_prev: RunState, _formData: FormData): Promise<RunState> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    return { status: "error" };
  }
  try {
    const res = await triggerRun(tenantId, "on_demand");
    return { status: "done", runId: res.run_id, runStatus: res.status };
  } catch {
    return { status: "error" };
  }
}
