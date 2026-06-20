"""Niveles objetivo de inventario (modelo periodico order-up-to).

Ver spec seccion 4.3 y 4.5. Usa statistics.NormalDist para Z(SL) (cycle service
level), evitando dependencia de scipy en el nucleo.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from statistics import NormalDist

_STD_NORMAL = NormalDist(0.0, 1.0)


@dataclass(frozen=True)
class TargetLevels:
    service_level_used: float
    lead_time_days: float
    safety_stock: float
    reorder_point: float
    order_up_to: float
    holding_cost: float


def z_score(service_level: float) -> float:
    """Inversa de la normal estandar (cycle service level)."""
    if not 0.0 < service_level < 1.0:
        raise ValueError("service_level debe estar en (0, 1)")
    return _STD_NORMAL.inv_cdf(service_level)


def safety_stock(
    service_level: float,
    mean_daily: float,
    std_daily: float,
    lead_time_days: float,
    review_period_days: float = 1.0,
    lead_time_std: float = 0.0,
) -> float:
    """SS = Z * sqrt((LT+R)*sigma_d^2 + d_bar^2 * sigma_LT^2)."""
    z = z_score(service_level)
    horizon = lead_time_days + review_period_days
    variance = horizon * (std_daily**2) + (mean_daily**2) * (lead_time_std**2)
    return z * math.sqrt(max(variance, 0.0))


def holding_cost(safety_stock_units: float, unit_cost: float, cost_of_capital_pct: float) -> float:
    """Costo anual de mantener el stock de seguridad."""
    return safety_stock_units * unit_cost * cost_of_capital_pct


def compute_target_levels(
    service_level: float,
    mean_daily: float,
    std_daily: float,
    lead_time_days: float,
    unit_cost: float,
    cost_of_capital_pct: float,
    review_period_days: float = 1.0,
    lead_time_std: float = 0.0,
) -> TargetLevels:
    ss = safety_stock(
        service_level,
        mean_daily,
        std_daily,
        lead_time_days,
        review_period_days,
        lead_time_std,
    )
    horizon = lead_time_days + review_period_days
    order_up_to = mean_daily * horizon + ss
    reorder_point = mean_daily * lead_time_days + ss
    hc = holding_cost(ss, unit_cost, cost_of_capital_pct)
    return TargetLevels(
        service_level_used=service_level,
        lead_time_days=lead_time_days,
        safety_stock=ss,
        reorder_point=reorder_point,
        order_up_to=order_up_to,
        holding_cost=hc,
    )
