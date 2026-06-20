"""Motor de compras y ordenes de compra. Ver spec seccion 6."""

from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass(frozen=True)
class PurchaseRequirement:
    product_id: str
    supplier_id: str
    net_requirement: float
    unit_cost: float
    unit_margin: float
    moq: float = 0.0
    order_multiple: float = 1.0
    location_id: str | None = None


@dataclass(frozen=True)
class POLine:
    product_id: str
    location_id: str | None
    net_requirement: float
    order_qty: float
    unit_cost: float
    line_value: float
    is_fill: bool = False


@dataclass
class PurchaseOrder:
    supplier_id: str
    lines: list[POLine] = field(default_factory=list)
    total_value: float = 0.0
    meets_min_order: bool = True


def round_order_qty(net_requirement: float, moq: float, order_multiple: float) -> float:
    """Aplica MOQ y redondeo hacia arriba al multiplo de orden."""
    if net_requirement <= 0:
        return 0.0
    qty = max(net_requirement, moq)
    if order_multiple and order_multiple > 0:
        qty = math.ceil(qty / order_multiple) * order_multiple
    return qty


def build_purchase_orders(
    requirements: list[PurchaseRequirement],
    min_order_values: dict[str, float] | None = None,
    auto_fill: bool = True,
) -> list[PurchaseOrder]:
    """Agrupa requerimientos por proveedor y aplica restricciones.

    Si el total de una OC no alcanza el min_order_value del proveedor y
    auto_fill=True, agrega volumen a las lineas de mayor margen (marcadas como
    relleno) hasta superar el minimo; si no es posible, marca la OC.
    """
    min_order_values = min_order_values or {}
    by_supplier: dict[str, list[PurchaseRequirement]] = {}
    for req in requirements:
        if req.net_requirement > 0:
            by_supplier.setdefault(req.supplier_id, []).append(req)

    orders: list[PurchaseOrder] = []
    for supplier_id, reqs in by_supplier.items():
        po = PurchaseOrder(supplier_id=supplier_id)
        for req in reqs:
            qty = round_order_qty(req.net_requirement, req.moq, req.order_multiple)
            line = POLine(
                product_id=req.product_id,
                location_id=req.location_id,
                net_requirement=req.net_requirement,
                order_qty=qty,
                unit_cost=req.unit_cost,
                line_value=qty * req.unit_cost,
            )
            po.lines.append(line)

        po.total_value = sum(line.line_value for line in po.lines)
        min_value = min_order_values.get(supplier_id, 0.0)

        if po.total_value < min_value and auto_fill:
            _apply_fill(po, reqs, min_value)

        po.meets_min_order = po.total_value >= min_value
        orders.append(po)

    return orders


def _apply_fill(po: PurchaseOrder, reqs: list[PurchaseRequirement], min_value: float) -> None:
    """Agrega multiplos al SKU de mayor margen hasta superar min_value."""
    ranked = sorted(reqs, key=lambda r: r.unit_margin, reverse=True)
    if not ranked:
        return
    target = ranked[0]
    step_qty = target.order_multiple if target.order_multiple > 0 else 1.0
    step_value = step_qty * target.unit_cost
    if step_value <= 0:
        return

    deficit = min_value - po.total_value
    extra_steps = math.ceil(deficit / step_value)

    new_lines: list[POLine] = []
    for line in po.lines:
        if line.product_id == target.product_id:
            added_qty = extra_steps * step_qty
            new_qty = line.order_qty + added_qty
            new_lines.append(
                POLine(
                    product_id=line.product_id,
                    location_id=line.location_id,
                    net_requirement=line.net_requirement,
                    order_qty=new_qty,
                    unit_cost=line.unit_cost,
                    line_value=new_qty * line.unit_cost,
                    is_fill=True,
                )
            )
        else:
            new_lines.append(line)

    po.lines = new_lines
    po.total_value = sum(line.line_value for line in po.lines)
