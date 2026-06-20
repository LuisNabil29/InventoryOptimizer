import { NextRequest, NextResponse } from "next/server";

import { authenticateApiKey } from "@/lib/auth";
import { triggerRun } from "@/lib/engine";

export async function POST(request: NextRequest) {
  const ctx = await authenticateApiKey(request.headers.get("authorization"));
  if (!ctx) {
    return NextResponse.json(
      { error: { code: "unauthorized", message: "invalid api key" } },
      { status: 401 },
    );
  }

  try {
    const result = await triggerRun(ctx.tenantId, "on_demand");
    return NextResponse.json(
      { run_id: result.run_id, status: result.status, trigger: "on_demand" },
      { status: 202 },
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: {
          code: "engine_error",
          message: err instanceof Error ? err.message : "engine failed",
        },
      },
      { status: 502 },
    );
  }
}
