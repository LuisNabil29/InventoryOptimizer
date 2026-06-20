from app.core.statistics import (
    Confidence,
    DemandPattern,
    classify_pattern,
    compute_demand_stats,
)


def test_classify_pattern_quadrants():
    assert classify_pattern(1.0, 0.2) == DemandPattern.SMOOTH
    assert classify_pattern(1.0, 0.8) == DemandPattern.ERRATIC
    assert classify_pattern(2.0, 0.2) == DemandPattern.INTERMITTENT
    assert classify_pattern(2.0, 0.8) == DemandPattern.LUMPY
    assert classify_pattern(None, None) is None


def test_smooth_demand_stats():
    demand = [10, 12, 9, 11, 10, 13, 8, 12, 11, 10, 9, 12, 10, 11]
    stats = compute_demand_stats(demand)
    assert stats.mean_daily > 0
    assert stats.pattern == DemandPattern.SMOOTH
    assert stats.confidence == Confidence.MEDIUM
    assert not stats.needs_advanced_model


def test_intermittent_demand_is_flagged():
    # muchos ceros, demanda esporadica
    demand = [0, 0, 0, 5, 0, 0, 0, 0, 4, 0, 0, 0, 6, 0, 0, 0, 0, 5, 0, 0]
    stats = compute_demand_stats(demand)
    assert stats.adi is not None and stats.adi >= 1.32
    assert stats.needs_advanced_model


def test_in_stock_filter_excludes_stockout_zeros():
    demand = [10, 10, 0, 0, 10]
    flags = [True, True, False, False, True]
    stats = compute_demand_stats(demand, flags)
    # solo se consideran 3 dias con stock (todos = 10)
    assert stats.data_points == 3
    assert stats.mean_daily == 10


def test_low_confidence_few_points():
    stats = compute_demand_stats([5, 6, 7])
    assert stats.confidence == Confidence.LOW
