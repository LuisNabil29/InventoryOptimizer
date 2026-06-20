from app.engines.impact import aggregate_impact
from app.engines.redistribution import Position, build_redistribution


def test_transfer_from_surplus_to_deficit():
    positions = [
        Position("p1", "loc-surplus", on_hand=100, order_up_to=60, unit_margin=5, unit_price=12),
        Position("p1", "loc-deficit", on_hand=10, order_up_to=50, unit_margin=5, unit_price=12),
    ]
    lines = build_redistribution(positions)
    assert len(lines) == 1
    line = lines[0]
    assert line.from_location_id == "loc-surplus"
    assert line.to_location_id == "loc-deficit"
    assert line.qty == 40  # min(deficit 40, surplus 40)
    assert line.expected_margin_recovered == 40 * 5


def test_no_transfer_when_no_surplus():
    positions = [
        Position("p1", "loc-a", on_hand=10, order_up_to=50, unit_margin=5, unit_price=12),
        Position("p1", "loc-b", on_hand=20, order_up_to=50, unit_margin=5, unit_price=12),
    ]
    assert build_redistribution(positions) == []


def test_impact_aggregates_transfers_and_released_capital():
    positions = [
        Position("p1", "loc-surplus", on_hand=100, order_up_to=60, unit_margin=5, unit_price=12),
        Position("p1", "loc-deficit", on_hand=10, order_up_to=50, unit_margin=5, unit_price=12),
    ]
    lines = build_redistribution(positions)
    impact = aggregate_impact(lines, positions, unit_costs={"p1": 7})
    assert impact.recovered_margin == 40 * 5
    assert impact.recovered_revenue == 40 * 12
    # surplus en loc-surplus = 100-60 = 40 unidades * costo 7
    assert impact.released_capital == 40 * 7
