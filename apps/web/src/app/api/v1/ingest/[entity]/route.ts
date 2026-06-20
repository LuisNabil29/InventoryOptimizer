import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { authenticateApiKey, hasScope } from "@/lib/auth";
import { isIngestionEntity, validateRows, type RowError } from "@/lib/ingestion";
import { persistRows } from "@/lib/ingestion-persist";
import { withTenant } from "@/lib/prisma";

const MAX_ROWS = 10_000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ entity: string }> },
) {
  const { entity } = await params;

  if (!isIngestionEntity(entity)) {
    return NextResponse.json(
      { error: { code: "not_found", message: `unknown entity ${entity}` } },
      { status: 404 },
    );
  }

  const ctx = await authenticateApiKey(request.headers.get("authorization"));
  if (!ctx) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "invalid api key" } },
      { status: 401 },
    );
  }
  if (!hasScope(ctx, "ingest:write")) {
    return NextResponse.json(
      { error: { code: "forbidden", message: "missing scope ingest:write" } },
      { status: 403 },
    );
  }

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "Idempotency-Key header required" } },
      { status: 400 },
    );
  }

  let body: { rows?: unknown; atomic?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "invalid json" } },
      { status: 400 },
    );
  }

  if (!Array.isArray(body.rows)) {
    return NextResponse.json(
      { error: { code: "validation_error", message: "rows must be an array" } },
      { status: 400 },
    );
  }
  if (body.rows.length > MAX_ROWS) {
    return NextResponse.json(
      { error: { code: "validation_error", message: `max ${MAX_ROWS} rows per request` } },
      { status: 400 },
    );
  }

  const rows = body.rows as Record<string, unknown>[];
  const validation = validateRows(entity, rows);

  if (body.atomic && validation.errorRows > 0) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "atomic batch has invalid rows",
          details: validation.errors,
        },
      },
      { status: 422 },
    );
  }

  const invalidIndices = new Set(validation.errors.map((e) => e.row));
  const validRows = rows
    .map((row, index) => ({ row, index }))
    .filter(({ index }) => !invalidIndices.has(index));

  const result = await withTenant(ctx.tenantId, async (tx) => {
    // Idempotencia: misma key devuelve el job existente (dentro del tenant/RLS).
    const existing = await tx.ingestionJob.findUnique({
      where: { tenantId_idempotencyKey: { tenantId: ctx.tenantId, idempotencyKey } },
    });
    if (existing) {
      return { job: existing, errors: [] as RowError[], processed: existing.validRows, replay: true };
    }

    const persisted = await persistRows(tx, ctx.tenantId, entity, validRows);
    const allErrors: RowError[] = [...validation.errors, ...persisted.errors];
    const errorIndices = new Set(allErrors.map((e) => e.row));
    const job = await tx.ingestionJob.create({
      data: {
        tenantId: ctx.tenantId,
        entity,
        source: "api",
        status: "completed",
        totalRows: rows.length,
        validRows: persisted.processed,
        errorRows: errorIndices.size,
        errors:
          allErrors.length > 0
            ? (allErrors as unknown as Prisma.InputJsonValue)
            : undefined,
        idempotencyKey,
        finishedAt: new Date(),
      },
    });
    return { job, errors: allErrors, processed: persisted.processed, replay: false };
  });

  return NextResponse.json(
    {
      job_id: result.job.id,
      status: result.job.status,
      entity,
      total_rows: result.job.totalRows,
      valid_rows: result.processed,
      error_rows: result.job.errorRows,
      errors: result.errors.slice(0, 100),
      idempotent_replay: result.replay,
    },
    { status: result.replay ? 200 : 202 },
  );
}
