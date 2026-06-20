# Statement of Intent — Optimizador de Inventario (SaaS)

> Documento de intención confirmado (resultado de entrevista de descubrimiento).
> Base para el spec detallado posterior. Confirmado por el usuario el 2026-06-19.

## Outcome
SaaS que, por período, detecta venta perdida por faltante y sobreinventario por
SKU-sucursal; recomienda (a) un **plan diario de redistribución** entre almacenes y
(b) un **plan de compras con borradores de OC por proveedor**, ambos priorizados por
impacto en dinero; y cuantifica el impacto potencial (venta a recuperar + capital a
liberar) como business case.

## User
Empresas de retail/distribución medianas, cada una como tenant aislado.
- 10–50 sucursales
- 5,000–50,000 SKUs
- Decenas de miles de líneas de movimiento por día

## Why now
La venta perdida hoy es invisible (demanda censurada: cuando no hay stock, la venta
no aparece en los datos). La redistribución entre almacenes y las compras se hacen a
mano o no se hacen. Falta una herramienta que lo cuantifique en dinero y entregue
planes accionables.

## Success criteria

### Niveles de inventario por nivel de servicio
- Niveles objetivo por SKU-sucursal: `SS = Z(SL) × σ(demanda en lead time)`.
- **Distribución normal por default.**
- Detección automática del patrón de demanda (ADI / CV², clasificación
  Syntetos-Boylan) que **marca** SKUs intermitentes/lumpy para aplicarles modelos
  avanzados (Poisson/Croston) en **fase 2**, en lugar de aplicar normal en silencio.
- Lead time por SKU (proveedor principal) con **fallback global** para SKUs sin
  lead time definido.
- **Costo del nivel de servicio**: capital inmovilizado en stock de seguridad ×
  costo de capital (parámetro % global por tenant).

### Redistribución
- Plan **diario** de transferencias entre almacenes, priorizado por $ de impacto.
- Es **recomendación**, no ejecución (el humano lo ejecuta en su ERP/WMS).

### Plan de compras + órdenes de compra
- Plan de compras y **borradores de OC agrupados por proveedor**, calculados contra
  el déficit vs. nivel objetivo (derivado del nivel de servicio).
- Respeta **restricciones de proveedor**: MOQ (cantidad mínima de orden), múltiplos
  de empaque y monto mínimo de pedido.
- **Aprobación humana** antes de colocar. Envío/colocación automática al proveedor
  es **fase 2**.

### Estimación de impacto (business case)
- Simulación / what-if sobre el estado de inventario en un momento dado.
- Estima demanda censurada (venta perdida) usando la tasa de venta histórica del
  SKU en la sucursal cuando sí había stock, ajustada por estacionalidad/tendencia
  observada en sucursales que sí tenían inventario en el período.
- Reporta venta recuperada y capital liberado en **ingreso y margen**.

### Clasificación
- **ABC automático** (por contribución a venta/margen).
- **Clasificaciones personalizables** por tenant (ej. perecederos, marca propia,
  temporada).
- Nivel de servicio asignado por clase, con precedencia:
  **override de SKU > política de clase > default del tenant**.

### Ingesta de datos
- Por **CSV y API**: ventas, inventario (snapshot diario por SKU-sucursal-almacén),
  costos/márgenes, lead times, datos de proveedor (MOQ, múltiplos, mínimos).

### Confianza por datos
- Nivel de confianza por SKU según volumen de datos disponibles.
- SKUs con <12 puntos de demanda caen a la estimación de su clase (no se inventan
  números falsamente precisos).

### Plataforma
- Multi-tenant (aislamiento por tenant).
- i18n: inglés y español.
- Tema claro y oscuro.

## Data necesaria
- **Mínimo funcional:** ~3 meses de historia diaria.
- **Recomendado:** 12–18 meses (captura estacionalidad y tendencia).
- **Ideal:** 24 meses (comparación año contra año).
- Granularidad **diaria** de ventas e inventario (se agrega a semana cuando conviene).

## Constraints
- Calidad/disponibilidad de datos del cliente (lead times, costos, restricciones de
  proveedor).
- Estimación honesta de la demanda censurada.
- Cómputo viable como **batch nocturno**.

## Stack técnico
- **Frontend + API:** Next.js
- **Base de datos:** PostgreSQL
- **Motor de cálculo:** worker en Python (pandas / numpy / scipy)

## Out of scope (v1)
- Ejecución/escritura de transferencias en el ERP del cliente (solo recomienda).
- Colocación automática de OC al proveedor (solo genera borradores).
- Integración bidireccional con ERPs y proveedores.
- Modelos Poisson/Croston completos (solo se marcan los SKUs candidatos).
- Seguimiento de impacto realizado / ROI continuo.
- Pronóstico avanzado con ML.

## Next step
Spec detallado: modelo de datos, fórmulas exactas (stock de seguridad, ABC,
demanda censurada, costo de nivel de servicio, plan de compra), y contratos de
CSV/API.
