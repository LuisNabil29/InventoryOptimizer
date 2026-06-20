"""Clasificacion ABC por contribucion acumulada. Ver spec seccion 4.6."""

from __future__ import annotations

from collections.abc import Mapping


def classify_abc(
    contributions: Mapping[str, float],
    a_pct: float = 0.80,
    b_pct: float = 0.15,
) -> dict[str, str]:
    """Asigna clase A/B/C por contribucion acumulada descendente.

    Args:
        contributions: clave -> contribucion (margen o ingreso anualizado).
        a_pct: fraccion acumulada que delimita la clase A.
        b_pct: fraccion adicional que delimita la clase B (A+B = a_pct+b_pct).

    Returns:
        clave -> "A" | "B" | "C".
    """
    if not contributions:
        return {}

    total = sum(max(v, 0.0) for v in contributions.values())
    if total <= 0:
        return {key: "C" for key in contributions}

    ordered = sorted(contributions.items(), key=lambda kv: kv[1], reverse=True)
    a_limit = a_pct
    b_limit = a_pct + b_pct

    result: dict[str, str] = {}
    cumulative = 0.0
    for key, value in ordered:
        cumulative += max(value, 0.0) / total
        if cumulative <= a_limit:
            result[key] = "A"
        elif cumulative <= b_limit:
            result[key] = "B"
        else:
            result[key] = "C"
    return result
