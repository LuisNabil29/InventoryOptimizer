import math

import pytest

from app.core.targets import compute_target_levels, safety_stock, z_score


def test_z_score_known_values():
    assert z_score(0.95) == pytest.approx(1.6448536, abs=1e-5)
    assert z_score(0.5) == pytest.approx(0.0, abs=1e-9)
    assert z_score(0.975) == pytest.approx(1.959964, abs=1e-5)


def test_z_score_out_of_range():
    with pytest.raises(ValueError):
        z_score(0.0)
    with pytest.raises(ValueError):
        z_score(1.0)


def test_worked_example_from_spec():
    # spec seccion 4.3: d_bar=20, sigma_d=6, LT=7, R=1, SL=0.95
    levels = compute_target_levels(
        service_level=0.95,
        mean_daily=20,
        std_daily=6,
        lead_time_days=7,
        unit_cost=10,
        cost_of_capital_pct=0.20,
        review_period_days=1,
        lead_time_std=0,
    )
    # SS = 1.6448536 * sqrt(8 * 36) = 1.6448536 * 16.97056
    assert levels.safety_stock == pytest.approx(27.914, abs=0.01)
    assert levels.order_up_to == pytest.approx(20 * 8 + levels.safety_stock, abs=1e-6)
    assert levels.reorder_point == pytest.approx(20 * 7 + levels.safety_stock, abs=1e-6)
    # rounding to integers matches the spec figures
    assert math.ceil(levels.safety_stock) == 28
    assert math.ceil(levels.order_up_to) == 188
    assert math.ceil(levels.reorder_point) == 168


def test_safety_stock_with_lead_time_variability():
    ss_no_lt = safety_stock(0.95, mean_daily=20, std_daily=6, lead_time_days=7, lead_time_std=0)
    ss_with_lt = safety_stock(0.95, mean_daily=20, std_daily=6, lead_time_days=7, lead_time_std=2)
    assert ss_with_lt > ss_no_lt


def test_holding_cost_in_target():
    levels = compute_target_levels(
        service_level=0.95,
        mean_daily=20,
        std_daily=6,
        lead_time_days=7,
        unit_cost=10,
        cost_of_capital_pct=0.20,
    )
    assert levels.holding_cost == pytest.approx(levels.safety_stock * 10 * 0.20, abs=1e-6)
