"""Estimacion de impacto (business case). Ver spec seccion 7."""

from __future__ import annotations

from dataclasses import dataclass

from app.engines.redistribution import Position, TransferLine


@dataclass(frozen=True)
class ImpactSummary:
    recovered_revenue: float
    recovered_margin: float
    released_capital: float


def aggregate_impact(
    transfers: list[TransferLine],
    positions: list[Position],
    unit_costs: dict[str, float],
) -> ImpactSummary:
    """Agrega venta a recuperar y capital a liberar.

    - Venta a recuperar: suma de margen/ingreso de las transferencias propuestas.
    - Capital a liberar: valor del surplus (on_hand - order_up_to) a costo, sobre
      posiciones sobreinventariadas.
    """
    recovered_revenue = sum(t.expected_revenue_recovered for t in transfers)
    recovered_margin = sum(t.expected_margin_recovered for t in transfers)

    released_capital = 0.0
    for pos in positions:
        surplus = pos.on_hand - pos.order_up_to
        if surplus > 0:
            released_capital += surplus * unit_costs.get(pos.product_id, 0.0)

    return ImpactSummary(
        recovered_revenue=recovered_revenue,
        recovered_margin=recovered_margin,
        released_capital=released_capital,
    )
