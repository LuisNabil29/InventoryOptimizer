from app.engines.purchasing import (
    PurchaseRequirement,
    build_purchase_orders,
    round_order_qty,
)


def test_round_order_qty_applies_moq_and_multiple():
    # net 23, moq 50, multiple 10 -> max(23,50)=50 -> ceil(50/10)*10=50
    assert round_order_qty(23, moq=50, order_multiple=10) == 50
    # net 64, moq 0, multiple 10 -> ceil(64/10)*10 = 70
    assert round_order_qty(64, moq=0, order_multiple=10) == 70
    # net 0 -> 0
    assert round_order_qty(0, moq=50, order_multiple=10) == 0


def test_build_groups_by_supplier():
    reqs = [
        PurchaseRequirement("p1", "sup-a", 60, unit_cost=10, unit_margin=5, order_multiple=10),
        PurchaseRequirement("p2", "sup-a", 25, unit_cost=8, unit_margin=4, order_multiple=5),
        PurchaseRequirement("p3", "sup-b", 100, unit_cost=2, unit_margin=1, order_multiple=1),
    ]
    orders = build_purchase_orders(reqs, min_order_values={}, auto_fill=False)
    by_supplier = {o.supplier_id: o for o in orders}
    assert set(by_supplier) == {"sup-a", "sup-b"}
    assert len(by_supplier["sup-a"].lines) == 2


def test_auto_fill_reaches_min_order_value():
    reqs = [
        PurchaseRequirement("p1", "sup-a", 10, unit_cost=10, unit_margin=9, order_multiple=10),
        PurchaseRequirement("p2", "sup-a", 10, unit_cost=10, unit_margin=2, order_multiple=10),
    ]
    # base total = 10*10 + 10*10 = 200; min = 500
    orders = build_purchase_orders(reqs, min_order_values={"sup-a": 500}, auto_fill=True)
    po = orders[0]
    assert po.total_value >= 500
    assert po.meets_min_order
    # el relleno va al SKU de mayor margen (p1)
    fill_lines = [line for line in po.lines if line.is_fill]
    assert fill_lines and fill_lines[0].product_id == "p1"


def test_below_min_without_fill_is_flagged():
    reqs = [PurchaseRequirement("p1", "sup-a", 10, unit_cost=10, unit_margin=9, order_multiple=10)]
    orders = build_purchase_orders(reqs, min_order_values={"sup-a": 500}, auto_fill=False)
    assert not orders[0].meets_min_order
