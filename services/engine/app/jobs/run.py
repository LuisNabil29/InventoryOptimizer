"""Corrida batch del motor para un tenant.

Lee datos (ventas, snapshots, maestros, politicas), calcula con las funciones
puras del core y persiste resultados (demand_stats, target_levels, venta
perdida, redistribucion, compras e impacto). Idempotente por (tenant, run_date,
trigger).

Uso: python -m app.jobs.run <tenant_id> [trigger]
"""

from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date, timedelta

from app.core.abc import classify_abc
from app.core.censored import estimate_lost_sales, expected_rate_from_in_stock
from app.core.statistics import compute_demand_stats
from app.core.targets import compute_target_levels
from app.db import tenant_connection
from app.engines.impact import aggregate_impact
from app.engines.purchasing import PurchaseRequirement, build_purchase_orders
from app.engines.redistribution import Position, build_redistribution

DEMO_TENANT = "11111111-1111-1111-1111-111111111111"
HISTORY_DAYS = 90


def run(tenant_id: str, trigger: str = "batch") -> str:
    with tenant_connection(tenant_id) as conn:
        cur = conn.cursor()
        run_date = date.today()

        settings = _one(cur, "select * from tenant_settings")
        cost_of_capital = float(settings["cost_of_capital_pct"])
        default_sl = float(settings["default_service_level"])
        review_period = int(settings["review_period_days"])
        global_lead = int(settings["global_lead_time_days"])
        abc_a = float(settings["abc_a_pct"])
        abc_b = float(settings["abc_b_pct"])

        # Reemplaza corrida previa del mismo dia/trigger (cascada a resultados).
        cur.execute(
            "delete from engine_runs where run_date = %s and trigger = %s",
            (run_date, trigger),
        )

        products = {r["id"]: r for r in _all(cur, "select * from products")}
        suppliers = {r["id"]: r for r in _all(cur, "select * from suppliers")}
        supplier_products = {
            (r["supplier_id"], r["product_id"]): r
            for r in _all(cur, "select * from supplier_products")
        }

        period_end = _scalar(cur, "select max(occurred_on) from inventory_movements") or (
            run_date - timedelta(days=1)
        )
        period_start = period_end - timedelta(days=HISTORY_DAYS - 1)

        run_id = _scalar(
            cur,
            """insert into engine_runs
               (tenant_id, run_date, trigger, status, period_start, period_end)
               values (%s,%s,%s,'running',%s,%s) returning id""",
            (tenant_id, run_date, trigger, period_start, period_end),
        )

        # --- Cargar ventas y snapshots ---
        sales = defaultdict(dict)  # (product,location) -> {date: qty}
        for r in _all(
            cur,
            """select product_id, location_id, occurred_on, sum(qty) as qty
               from inventory_movements where type='sale'
                 and occurred_on between %s and %s
               group by product_id, location_id, occurred_on""",
            (period_start, period_end),
        ):
            sales[(r["product_id"], r["location_id"])][r["occurred_on"]] = float(r["qty"])

        stockout = set()  # (product, location, date) con qty<=0
        latest_on_hand: dict[tuple, dict] = {}
        for r in _all(cur, "select * from inventory_snapshots"):
            key = (r["product_id"], r["location_id"], r["snapshot_on"])
            if float(r["qty_on_hand"]) <= float(settings["stockout_threshold"]):
                stockout.add(key)
            pl = (r["product_id"], r["location_id"])
            prev = latest_on_hand.get(pl)
            if prev is None or r["snapshot_on"] > prev["snapshot_on"]:
                latest_on_hand[pl] = r

        # --- Politicas de nivel de servicio ---
        sl_by_class, sl_override = _load_service_levels(cur)
        abc_class_ids = _load_abc_class_ids(cur)

        # --- ABC por contribucion de margen ---
        contributions: dict[str, float] = defaultdict(float)
        for (product_id, _loc), by_date in sales.items():
            p = products[product_id]
            margin = float(p["unit_price"]) - float(p["unit_cost"])
            contributions[product_id] += sum(by_date.values()) * margin
        abc = classify_abc(contributions, a_pct=abc_a, b_pct=abc_b)

        # Rango completo de fechas para series diarias.
        all_days = [period_start + timedelta(days=i) for i in range((period_end - period_start).days + 1)]

        pairs = set(sales) | set(latest_on_hand)
        demand_rows = []
        target_rows = []
        lost_rows = []
        positions: list[Position] = []
        target_by_pair: dict[tuple, float] = {}

        for product_id, location_id in pairs:
            p = products[product_id]
            by_date = sales.get((product_id, location_id), {})
            daily = [by_date.get(d, 0.0) for d in all_days]
            flags = [(product_id, location_id, d) not in stockout for d in all_days]

            stats = compute_demand_stats(daily, flags)

            service_level = _resolve_sl(
                product_id, abc.get(product_id), sl_override, sl_by_class, abc_class_ids, default_sl
            )
            lead_time = _resolve_lead_time(
                p, supplier_products, suppliers, global_lead
            )

            target = compute_target_levels(
                service_level=service_level,
                mean_daily=stats.mean_daily,
                std_daily=stats.std_daily,
                lead_time_days=lead_time,
                unit_cost=float(p["unit_cost"]),
                cost_of_capital_pct=cost_of_capital,
                review_period_days=review_period,
            )
            target_by_pair[(product_id, location_id)] = target.order_up_to

            demand_rows.append(
                (
                    tenant_id, run_id, product_id, location_id,
                    stats.mean_daily, stats.std_daily, stats.adi, stats.cv2,
                    stats.pattern.value if stats.pattern else None,
                    stats.data_points, stats.confidence.value,
                    stats.confidence.value == "low",
                )
            )
            target_rows.append(
                (
                    tenant_id, run_id, product_id, location_id,
                    service_level, lead_time, target.safety_stock,
                    target.reorder_point, target.order_up_to, target.holding_cost,
                )
            )

            # Venta perdida en dias de quiebre.
            stockout_days = [d for d in all_days if (product_id, location_id, d) in stockout]
            if stockout_days:
                rate = expected_rate_from_in_stock(daily, flags)
                actual = [by_date.get(d, 0.0) for d in stockout_days]
                est = estimate_lost_sales(
                    expected_rate=rate,
                    seasonal_indices=[1.0] * len(stockout_days),
                    actual_sales_on_stockout_days=actual,
                    unit_price=float(p["unit_price"]),
                    unit_cost=float(p["unit_cost"]),
                )
                lost_rows.append(
                    (
                        tenant_id, run_id, product_id, location_id,
                        est.stockout_days, est.lost_units, est.lost_revenue, est.lost_margin,
                    )
                )

            on_hand = float(latest_on_hand[(product_id, location_id)]["qty_on_hand"]) if (
                product_id, location_id
            ) in latest_on_hand else 0.0
            positions.append(
                Position(
                    product_id=product_id,
                    location_id=location_id,
                    on_hand=on_hand,
                    order_up_to=target.order_up_to,
                    unit_margin=float(p["unit_price"]) - float(p["unit_cost"]),
                    unit_price=float(p["unit_price"]),
                )
            )

        # --- Redistribucion ---
        transfers = build_redistribution(positions)

        # --- Compras (consolidado por producto) ---
        requirements = _build_requirements(
            products, supplier_products, suppliers, positions, target_by_pair
        )
        min_order_values = {sid: float(s["min_order_value"]) for sid, s in suppliers.items()}
        orders = build_purchase_orders(requirements, min_order_values, auto_fill=True)

        # --- Impacto ---
        unit_costs = {pid: float(p["unit_cost"]) for pid, p in products.items()}
        impact = aggregate_impact(transfers, positions, unit_costs)

        # --- Persistir ---
        _persist(
            cur, tenant_id, run_id, demand_rows, target_rows, lost_rows,
            transfers, orders, impact, abc, abc_class_ids,
        )

        metrics = {
            "pairs": len(pairs),
            "transfers": len(transfers),
            "purchase_orders": len(orders),
            "recovered_margin": impact.recovered_margin,
            "released_capital": impact.released_capital,
        }
        cur.execute(
            "update engine_runs set status='success', finished_at=now(), metrics=%s where id=%s",
            (json.dumps(metrics), run_id),
        )
        print(f"run {run_id} success: {json.dumps(metrics)}")
        return str(run_id)


def _resolve_sl(product_id, abc_class, sl_override, sl_by_class, abc_class_ids, default_sl):
    if product_id in sl_override:
        return sl_override[product_id]
    if abc_class and abc_class in abc_class_ids:
        class_id = abc_class_ids[abc_class]
        if class_id in sl_by_class:
            return sl_by_class[class_id]
    return default_sl


def _resolve_lead_time(product, supplier_products, suppliers, global_lead):
    sup_id = product["primary_supplier_id"]
    if sup_id:
        sp = supplier_products.get((sup_id, product["id"]))
        if sp and sp["lead_time_days"] is not None:
            return float(sp["lead_time_days"])
        if sup_id in suppliers:
            return float(suppliers[sup_id]["default_lead_time_days"])
    return float(global_lead)


def _build_requirements(products, supplier_products, suppliers, positions, target_by_pair):
    target_total: dict[str, float] = defaultdict(float)
    avail_total: dict[str, float] = defaultdict(float)
    for pos in positions:
        target_total[pos.product_id] += target_by_pair[(pos.product_id, pos.location_id)]
        avail_total[pos.product_id] += pos.on_hand

    requirements: list[PurchaseRequirement] = []
    for product_id, target in target_total.items():
        net = target - avail_total[product_id]
        if net <= 0:
            continue
        p = products[product_id]
        sup_id = p["primary_supplier_id"]
        if not sup_id:
            continue
        sp = supplier_products.get((sup_id, product_id))
        requirements.append(
            PurchaseRequirement(
                product_id=product_id,
                supplier_id=sup_id,
                net_requirement=net,
                unit_cost=float(p["unit_cost"]),
                unit_margin=float(p["unit_price"]) - float(p["unit_cost"]),
                moq=float(sp["moq"]) if sp else 0.0,
                order_multiple=float(sp["order_multiple"]) if sp else 1.0,
            )
        )
    return requirements


def _persist(cur, tenant_id, run_id, demand_rows, target_rows, lost_rows,
             transfers, orders, impact, abc, abc_class_ids):
    cur.executemany(
        """insert into demand_stats
           (tenant_id, run_id, product_id, location_id, mean_daily, std_daily,
            adi, cv2, pattern, data_points, confidence, fallback_to_class)
           values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        demand_rows,
    )
    cur.executemany(
        """insert into target_levels
           (tenant_id, run_id, product_id, location_id, service_level_used,
            lead_time_days, safety_stock, reorder_point, order_up_to, holding_cost)
           values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        target_rows,
    )
    if lost_rows:
        cur.executemany(
            """insert into lost_sales_estimates
               (tenant_id, run_id, product_id, location_id, stockout_days,
                lost_units, lost_revenue, lost_margin)
               values (%s,%s,%s,%s,%s,%s,%s,%s)""",
            lost_rows,
        )

    if transfers:
        plan_id = _scalar(
            cur,
            "insert into redistribution_plans (tenant_id, run_id) values (%s,%s) returning id",
            (tenant_id, run_id),
        )
        cur.executemany(
            """insert into redistribution_lines
               (tenant_id, plan_id, product_id, from_location_id, to_location_id,
                qty, expected_margin_recovered, expected_revenue_recovered)
               values (%s,%s,%s,%s,%s,%s,%s,%s)""",
            [
                (
                    tenant_id, plan_id, t.product_id, t.from_location_id,
                    t.to_location_id, t.qty, t.expected_margin_recovered,
                    t.expected_revenue_recovered,
                )
                for t in transfers
            ],
        )

    if orders:
        pplan_id = _scalar(
            cur,
            "insert into purchase_plans (tenant_id, run_id) values (%s,%s) returning id",
            (tenant_id, run_id),
        )
        for po in orders:
            po_id = _scalar(
                cur,
                """insert into purchase_orders
                   (tenant_id, plan_id, supplier_id, total_value, meets_min_order)
                   values (%s,%s,%s,%s,%s) returning id""",
                (tenant_id, pplan_id, po.supplier_id, po.total_value, po.meets_min_order),
            )
            cur.executemany(
                """insert into po_lines
                   (tenant_id, po_id, product_id, net_requirement, order_qty,
                    unit_cost, line_value, is_fill)
                   values (%s,%s,%s,%s,%s,%s,%s,%s)""",
                [
                    (
                        tenant_id, po_id, line.product_id, line.net_requirement,
                        line.order_qty, line.unit_cost, line.line_value, line.is_fill,
                    )
                    for line in po.lines
                ],
            )

    cur.execute(
        """insert into impact_simulations
           (tenant_id, run_id, recovered_revenue, recovered_margin, released_capital)
           values (%s,%s,%s,%s,%s)""",
        (tenant_id, run_id, impact.recovered_revenue, impact.recovered_margin, impact.released_capital),
    )

    # Persistir clasificacion ABC asignada.
    for product_id, class_code in abc.items():
        class_id = abc_class_ids.get(class_code)
        if not class_id:
            continue
        cur.execute(
            """insert into product_classifications
               (tenant_id, product_id, classification_id, assigned_by)
               values (%s,%s,%s,'system')
               on conflict (tenant_id, product_id, classification_id) do nothing""",
            (tenant_id, product_id, class_id),
        )


def _load_service_levels(cur):
    sl_by_class: dict[str, float] = {}
    sl_override: dict[str, float] = {}
    for r in _all(cur, "select * from service_level_policies"):
        if r["classification_id"]:
            sl_by_class[r["classification_id"]] = float(r["service_level"])
        elif r["product_id"]:
            sl_override[r["product_id"]] = float(r["service_level"])
    return sl_by_class, sl_override


def _load_abc_class_ids(cur) -> dict[str, str]:
    rows = _all(
        cur,
        """select c.code, c.id from classifications c
           join classification_schemes s on s.id = c.scheme_id
           where s.kind = 'abc'""",
    )
    return {r["code"]: r["id"] for r in rows}


def _all(cur, sql, params=None) -> list[dict]:
    cur.execute(sql, params or ())
    return cur.fetchall()


def _one(cur, sql, params=None) -> dict:
    cur.execute(sql, params or ())
    return cur.fetchone()


def _scalar(cur, sql, params=None):
    cur.execute(sql, params or ())
    row = cur.fetchone()
    if row is None:
        return None
    return next(iter(row.values()))


if __name__ == "__main__":
    tenant = sys.argv[1] if len(sys.argv) > 1 else DEMO_TENANT
    trig = sys.argv[2] if len(sys.argv) > 2 else "batch"
    run(tenant, trig)
