// Cliente del motor Python (FastAPI). Ver services/engine.

const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:8000";
const ENGINE_TOKEN = process.env.ENGINE_INTERNAL_TOKEN ?? "";

async function engineFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ENGINE_TOKEN ? { "X-Internal-Token": ENGINE_TOKEN } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`engine ${path} failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export interface SimulatePosition {
  product_id: string;
  location_id: string;
  on_hand: number;
  order_up_to: number;
  unit_margin: number;
  unit_price: number;
}

export interface SimulateResult {
  transfers: unknown[];
  recovered_revenue: number;
  recovered_margin: number;
  released_capital: number;
}

export function simulateImpact(
  positions: SimulatePosition[],
  unitCosts: Record<string, number>,
): Promise<SimulateResult> {
  return engineFetch<SimulateResult>("/simulate", {
    positions,
    unit_costs: unitCosts,
  });
}

export interface RunResult {
  run_id: string;
  status: string;
}

export function triggerRun(tenantId: string, trigger = "on_demand"): Promise<RunResult> {
  return engineFetch<RunResult>("/runs", { tenant_id: tenantId, trigger });
}
