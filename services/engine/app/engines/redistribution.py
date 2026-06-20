"""Motor de redistribucion (greedy por impacto). Ver spec seccion 5."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Position:
    """Posicion de un SKU en una ubicacion."""

    product_id: str
    location_id: str
    on_hand: float
    order_up_to: float
    unit_margin: float
    unit_price: float


@dataclass(frozen=True)
class TransferLine:
    product_id: str
    from_location_id: str
    to_location_id: str
    qty: float
    expected_margin_recovered: float
    expected_revenue_recovered: float


def build_redistribution(positions: list[Position]) -> list[TransferLine]:
    """Empareja deficits con surplus del mismo SKU entre ubicaciones.

    Greedy: prioriza cubrir los deficits con mayor margen recuperable usando el
    surplus disponible (preferir el donante con mayor surplus).
    """
    lines: list[TransferLine] = []

    by_product: dict[str, list[Position]] = {}
    for pos in positions:
        by_product.setdefault(pos.product_id, []).append(pos)

    for product_id, group in by_product.items():
        deficits = [
            (p, p.order_up_to - p.on_hand) for p in group if p.on_hand < p.order_up_to
        ]
        surplus = {
            p.location_id: p.on_hand - p.order_up_to
            for p in group
            if p.on_hand > p.order_up_to
        }
        # Mayor margen recuperable primero.
        deficits.sort(key=lambda d: d[0].unit_margin * d[1], reverse=True)

        for pos, need in deficits:
            remaining = need
            # Donante con mayor surplus primero.
            donors = sorted(surplus.items(), key=lambda kv: kv[1], reverse=True)
            for donor_loc, available in donors:
                if remaining <= 0:
                    break
                if available <= 0:
                    continue
                move = min(remaining, available)
                lines.append(
                    TransferLine(
                        product_id=product_id,
                        from_location_id=donor_loc,
                        to_location_id=pos.location_id,
                        qty=move,
                        expected_margin_recovered=move * pos.unit_margin,
                        expected_revenue_recovered=move * pos.unit_price,
                    )
                )
                surplus[donor_loc] -= move
                remaining -= move

    return lines
