"""Estadistica de demanda por (SKU, location).

Implementado en stdlib puro (math/statistics) para mantener las funciones
testeables sin dependencias externas. Ver spec seccion 4.1-4.2 y 4.7.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from enum import Enum

# Umbrales Syntetos-Boylan
ADI_THRESHOLD = 1.32
CV2_THRESHOLD = 0.49

# Umbrales de confianza (numero de periodos observados)
CONFIDENCE_LOW_MAX = 12
CONFIDENCE_HIGH_MIN = 52


class DemandPattern(str, Enum):
    SMOOTH = "smooth"
    ERRATIC = "erratic"
    INTERMITTENT = "intermittent"
    LUMPY = "lumpy"


class Confidence(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass(frozen=True)
class DemandStats:
    mean_daily: float
    std_daily: float
    adi: float | None
    cv2: float | None
    pattern: DemandPattern | None
    data_points: int
    confidence: Confidence

    @property
    def needs_advanced_model(self) -> bool:
        """True si el patron es intermitente/lumpy (marcado para fase 2)."""
        return self.pattern in (DemandPattern.INTERMITTENT, DemandPattern.LUMPY)


def classify_pattern(adi: float | None, cv2: float | None) -> DemandPattern | None:
    if adi is None or cv2 is None:
        return None
    if adi < ADI_THRESHOLD and cv2 < CV2_THRESHOLD:
        return DemandPattern.SMOOTH
    if adi < ADI_THRESHOLD and cv2 >= CV2_THRESHOLD:
        return DemandPattern.ERRATIC
    if adi >= ADI_THRESHOLD and cv2 < CV2_THRESHOLD:
        return DemandPattern.INTERMITTENT
    return DemandPattern.LUMPY


def classify_confidence(data_points: int) -> Confidence:
    if data_points < CONFIDENCE_LOW_MAX:
        return Confidence.LOW
    if data_points >= CONFIDENCE_HIGH_MIN:
        return Confidence.HIGH
    return Confidence.MEDIUM


def compute_demand_stats(
    daily_demand: list[float],
    in_stock_flags: list[bool] | None = None,
) -> DemandStats:
    """Calcula estadistica de demanda a partir de la serie diaria.

    Args:
        daily_demand: demanda observada por dia (ventas).
        in_stock_flags: por dia, True si habia stock. Los dias en quiebre se
            excluyen para no contaminar la demanda real con ceros por faltante.
            Si es None, se usan todos los dias.
    """
    if in_stock_flags is not None and len(in_stock_flags) != len(daily_demand):
        raise ValueError("in_stock_flags debe tener la misma longitud que daily_demand")

    if in_stock_flags is None:
        observed = list(daily_demand)
    else:
        observed = [d for d, in_stock in zip(daily_demand, in_stock_flags) if in_stock]

    data_points = len(observed)
    confidence = classify_confidence(data_points)

    if data_points == 0:
        return DemandStats(0.0, 0.0, None, None, None, 0, confidence)

    mean_daily = statistics.fmean(observed)
    std_daily = statistics.stdev(observed) if data_points > 1 else 0.0

    nonzero = [d for d in observed if d > 0]
    if nonzero:
        adi = data_points / len(nonzero)
        size_mean = statistics.fmean(nonzero)
        size_std = statistics.stdev(nonzero) if len(nonzero) > 1 else 0.0
        cv2 = (size_std / size_mean) ** 2 if size_mean > 0 else 0.0
    else:
        adi = None
        cv2 = None

    pattern = classify_pattern(adi, cv2)
    return DemandStats(mean_daily, std_daily, adi, cv2, pattern, data_points, confidence)
