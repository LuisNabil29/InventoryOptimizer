"""Genera datos demo (historia de ventas + snapshots) para un tenant.

Disena un desbalance deliberado para que la corrida del motor produzca
redistribucion, plan de compras, venta perdida y capital liberado visibles.

Uso: python -m app.jobs.seed_demo <tenant_id>
"""

from __future__ import annotations

import random
import sys
from datetime import date, timedelta

from app.db import tenant_connection

DEMO_TENANT = "11111111-1111-1111-1111-111111111111"

# Tasa diaria base de demanda por (store_code, sku).
BASE_RATES = {
    ("ST-001", "SKU-1001"): 8.0,
    ("ST-002", "SKU-1001"): 5.0,
    ("ST-001", "SKU-1002"): 2.0,
    ("ST-002", "SKU-1002"): 2.5,
    ("ST-001", "SKU-1003"): 3.0,
    ("ST-002", "SKU-1003"): 3.5,
}

# Stock actual (snapshot al cierre) por (location_code, sku) -> on_hand.
# Disena donantes (sobreinventario) y receptores (deficit / quiebre).
CURRENT_ON_HAND = {
    ("ST-001", "SKU-1001"): 400,  # donante
    ("ST-002", "SKU-1001"): 0,    # quiebre -> receptor + venta perdida
    ("ST-001", "SKU-1002"): 60,
    ("ST-002", "SKU-1002"): 45,
    ("ST-001", "SKU-1003"): 140,  # donante
    ("ST-002", "SKU-1003"): 8,    # receptor
    ("WH-001", "SKU-1001"): 50,
    ("WH-001", "SKU-1002"): 30,
    ("WH-001", "SKU-1003"): 40,
}

STOCKOUT_LOC_SKU = ("ST-002", "SKU-1001")
STOCKOUT_DAYS = 12
HISTORY_DAYS = 90


def run(tenant_id: str) -> None:
    random.seed(42)
    period_end = date.today() - timedelta(days=1)
    period_start = period_end - timedelta(days=HISTORY_DAYS - 1)
    stockout_start = period_end - timedelta(days=STOCKOUT_DAYS - 1)

    with tenant_connection(tenant_id) as conn:
        cur = conn.cursor()
        locations = {
            r["code"]: r["id"]
            for r in _fetch(cur, "select id, code from locations")
        }
        products = {
            r["sku"]: r
            for r in _fetch(cur, "select id, sku, unit_price, unit_cost from products")
        }

        # Limpiar datos previos del tenant para una corrida determinista.
        cur.execute("delete from inventory_movements")
        cur.execute("delete from inventory_snapshots")

        movements: list[tuple] = []
        snapshots: list[tuple] = []

        day = period_start
        while day <= period_end:
            for (store, sku), rate in BASE_RATES.items():
                loc_id = locations[store]
                prod = products[sku]
                is_stockout = (
                    (store, sku) == STOCKOUT_LOC_SKU and day >= stockout_start
                )
                if is_stockout:
                    # Dia en quiebre: sin venta y snapshot en 0.
                    snapshots.append(
                        (tenant_id, day, loc_id, prod["id"], 0, 0)
                    )
                    continue
                qty = max(0, round(random.gauss(rate, rate * 0.35)))
                if qty > 0:
                    movements.append(
                        (
                            tenant_id,
                            day,
                            loc_id,
                            prod["id"],
                            "sale",
                            qty,
                            prod["unit_price"],
                            prod["unit_cost"],
                            "seed",
                            f"seed-{store}-{sku}-{day.isoformat()}",
                        )
                    )
            day += timedelta(days=1)

        # Snapshot actual (cierre) por (location, sku).
        for (loc_code, sku), on_hand in CURRENT_ON_HAND.items():
            snapshots.append(
                (tenant_id, period_end, locations[loc_code], products[sku]["id"], on_hand, 0)
            )

        cur.executemany(
            """insert into inventory_movements
               (tenant_id, occurred_on, location_id, product_id, type, qty,
                unit_price, unit_cost, source, external_id)
               values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (tenant_id, external_id) do nothing""",
            movements,
        )
        cur.executemany(
            """insert into inventory_snapshots
               (tenant_id, snapshot_on, location_id, product_id, qty_on_hand, qty_on_order)
               values (%s,%s,%s,%s,%s,%s)
               on conflict (tenant_id, snapshot_on, location_id, product_id)
               do update set qty_on_hand = excluded.qty_on_hand""",
            snapshots,
        )

        print(
            f"seed: {len(movements)} ventas, {len(snapshots)} snapshots "
            f"({period_start} -> {period_end})"
        )


def _fetch(cur, sql: str) -> list[dict]:
    cur.execute(sql)
    return cur.fetchall()


if __name__ == "__main__":
    run(sys.argv[1] if len(sys.argv) > 1 else DEMO_TENANT)
