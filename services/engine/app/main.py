"""API FastAPI del motor (endpoints on-demand). Ver spec seccion 2 y 7.

Expone calculo puro (niveles objetivo, impacto) que la web invoca para
simulaciones. La corrida batch completa con persistencia se orquesta en
app/jobs/run.py.
"""

from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.core.targets import TargetLevels, compute_target_levels
from app.engines.impact import aggregate_impact
from app.engines.purchasing import (
    PurchaseRequirement,
    build_purchase_orders,
)
from app.engines.redistribution import Position, TransferLine, build_redistribution
from app.jobs.run import run as run_batch

app = FastAPI(title="Inventory Optimizer Engine", version="0.1.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# ---------- Corrida del motor ----------


class RunRequest(BaseModel):
    tenant_id: str
    trigger: str = "on_demand"


class RunResponse(BaseModel):
    run_id: str
    status: str


@app.post("/runs")
def trigger_run(req: RunRequest) -> RunResponse:
    run_id = run_batch(req.tenant_id, req.trigger)
    return RunResponse(run_id=run_id, status="success")


# ---------- Niveles objetivo ----------


class TargetLevelRequest(BaseModel):
    service_level: float = Field(gt=0, lt=1)
    mean_daily: float
    std_daily: float
    lead_time_days: float
    unit_cost: float
    cost_of_capital_pct: float
    review_period_days: float = 1.0
    lead_time_std: float = 0.0


@app.post("/target-levels")
def target_levels(req: TargetLevelRequest) -> TargetLevels:
    return compute_target_levels(
        service_level=req.service_level,
        mean_daily=req.mean_daily,
        std_daily=req.std_daily,
        lead_time_days=req.lead_time_days,
        unit_cost=req.unit_cost,
        cost_of_capital_pct=req.cost_of_capital_pct,
        review_period_days=req.review_period_days,
        lead_time_std=req.lead_time_std,
    )


# ---------- Simulacion de impacto ----------


class PositionIn(BaseModel):
    product_id: str
    location_id: str
    on_hand: float
    order_up_to: float
    unit_margin: float
    unit_price: float


class SimulateRequest(BaseModel):
    positions: list[PositionIn]
    unit_costs: dict[str, float] = Field(default_factory=dict)


class SimulateResponse(BaseModel):
    transfers: list[dict]
    recovered_revenue: float
    recovered_margin: float
    released_capital: float


@app.post("/simulate")
def simulate(req: SimulateRequest) -> SimulateResponse:
    positions = [
        Position(
            product_id=p.product_id,
            location_id=p.location_id,
            on_hand=p.on_hand,
            order_up_to=p.order_up_to,
            unit_margin=p.unit_margin,
            unit_price=p.unit_price,
        )
        for p in req.positions
    ]
    transfers: list[TransferLine] = build_redistribution(positions)
    impact = aggregate_impact(transfers, positions, req.unit_costs)
    return SimulateResponse(
        transfers=[t.__dict__ for t in transfers],
        recovered_revenue=impact.recovered_revenue,
        recovered_margin=impact.recovered_margin,
        released_capital=impact.released_capital,
    )


# ---------- Plan de compras ----------


class RequirementIn(BaseModel):
    product_id: str
    supplier_id: str
    net_requirement: float
    unit_cost: float
    unit_margin: float
    moq: float = 0.0
    order_multiple: float = 1.0
    location_id: str | None = None


class PurchaseRequest(BaseModel):
    requirements: list[RequirementIn]
    min_order_values: dict[str, float] = Field(default_factory=dict)
    auto_fill: bool = True


@app.post("/purchase-plan")
def purchase_plan(req: PurchaseRequest) -> list[dict]:
    requirements = [
        PurchaseRequirement(
            product_id=r.product_id,
            supplier_id=r.supplier_id,
            net_requirement=r.net_requirement,
            unit_cost=r.unit_cost,
            unit_margin=r.unit_margin,
            moq=r.moq,
            order_multiple=r.order_multiple,
            location_id=r.location_id,
        )
        for r in req.requirements
    ]
    orders = build_purchase_orders(requirements, req.min_order_values, req.auto_fill)
    return [
        {
            "supplier_id": o.supplier_id,
            "total_value": o.total_value,
            "meets_min_order": o.meets_min_order,
            "lines": [line.__dict__ for line in o.lines],
        }
        for o in orders
    ]
