"""Estimacion de demanda censurada (venta perdida por faltante).

Ver spec seccion 4.4.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass


@dataclass(frozen=True)
class LostSalesEstimate:
    stockout_days: int
    lost_units: float
    lost_revenue: float
    lost_margin: float


def expected_rate_from_in_stock(
    daily_demand: list[float],
    in_stock_flags: list[bool],
) -> float:
    """Tasa esperada (media diaria) usando solo dias con stock."""
    if len(daily_demand) != len(in_stock_flags):
        raise ValueError("longitudes distintas")
    in_stock = [d for d, ok in zip(daily_demand, in_stock_flags) if ok]
    if not in_stock:
        return 0.0
    return statistics.fmean(in_stock)


def estimate_lost_sales(
    expected_rate: float,
    seasonal_indices: list[float],
    actual_sales_on_stockout_days: list[float],
    unit_price: float,
    unit_cost: float,
) -> LostSalesEstimate:
    """Estima venta perdida durante dias de quiebre.

    lost_units = sum(expected_rate * s_t) - ventas_reales_en_quiebre
    (acotado a >= 0). Reporta ingreso y margen perdidos.

    Args:
        expected_rate: demanda diaria esperada (de dias con stock).
        seasonal_indices: indice estacional por dia en quiebre (1.0 = neutro).
        actual_sales_on_stockout_days: ventas residuales en esos dias.
    """
    if len(seasonal_indices) != len(actual_sales_on_stockout_days):
        raise ValueError("seasonal_indices y actual_sales deben tener igual longitud")

    stockout_days = len(seasonal_indices)
    expected_demand = sum(expected_rate * s for s in seasonal_indices)
    actual = sum(actual_sales_on_stockout_days)
    lost_units = max(expected_demand - actual, 0.0)

    return LostSalesEstimate(
        stockout_days=stockout_days,
        lost_units=lost_units,
        lost_revenue=lost_units * unit_price,
        lost_margin=lost_units * (unit_price - unit_cost),
    )
