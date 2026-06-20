import pytest

from app.core.censored import estimate_lost_sales, expected_rate_from_in_stock


def test_expected_rate_uses_only_in_stock_days():
    demand = [10, 12, 0, 0, 8]
    flags = [True, True, False, False, True]
    rate = expected_rate_from_in_stock(demand, flags)
    assert rate == pytest.approx((10 + 12 + 8) / 3)


def test_estimate_lost_sales_basic():
    # tasa 10/dia, 3 dias de quiebre, sin estacionalidad, ventas residuales 0
    est = estimate_lost_sales(
        expected_rate=10,
        seasonal_indices=[1.0, 1.0, 1.0],
        actual_sales_on_stockout_days=[0, 0, 0],
        unit_price=50,
        unit_cost=30,
    )
    assert est.stockout_days == 3
    assert est.lost_units == 30
    assert est.lost_revenue == 30 * 50
    assert est.lost_margin == 30 * 20


def test_lost_units_never_negative():
    est = estimate_lost_sales(
        expected_rate=5,
        seasonal_indices=[1.0],
        actual_sales_on_stockout_days=[100],
        unit_price=50,
        unit_cost=30,
    )
    assert est.lost_units == 0


def test_seasonal_index_scales_demand():
    est = estimate_lost_sales(
        expected_rate=10,
        seasonal_indices=[1.5, 0.5],
        actual_sales_on_stockout_days=[0, 0],
        unit_price=10,
        unit_cost=4,
    )
    # 10*1.5 + 10*0.5 = 20
    assert est.lost_units == 20
