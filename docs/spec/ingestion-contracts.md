# Contratos de Ingesta — CSV y API

Define cómo los clientes cargan datos al optimizador. Acompaña a
[inventory-optimizer.md](inventory-optimizer.md) y
[data-model.md](data-model.md).

Dos canales con **el mismo modelo lógico** por entidad:
- **CSV**: carga manual desde la UI (o subida a un endpoint de archivo).
- **API REST**: integración automatizada (POST batch JSON).

Entidades soportadas: `sales`, `inventory`, `products`, `suppliers`,
`supplier_products`.

Reglas comunes:
- Las entidades se referencian por **códigos de negocio** (`sku`, `location_code`,
  `supplier_code`), no por UUID interno.
- Fechas en formato **ISO 8601** `YYYY-MM-DD`.
- Decimales con punto (`.`); sin separador de miles.
- Codificación **UTF-8**; CSV con encabezado en la primera fila.
- Toda carga genera un `ingestion_jobs` con validación **por fila** y reporte de
  errores; las filas válidas se procesan aunque otras fallen (modo parcial), salvo
  que se pida `atomic=true`.

---

## 1. Esquemas CSV

### 1.1 `sales.csv`

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `date` | date | sí | Fecha de la venta |
| `location_code` | string | sí | Debe existir (tipo `store` o `warehouse`) |
| `sku` | string | sí | Debe existir en `products` |
| `quantity` | number | sí | > 0 |
| `unit_price` | number | no | Si falta, usa `products.unit_price` |
| `unit_cost` | number | no | Si falta, usa `products.unit_cost` |
| `external_id` | string | no | Idempotencia por fila |

```csv
date,location_code,sku,quantity,unit_price,unit_cost,external_id
2026-06-01,ST-001,SKU-1001,3,49.90,28.00,sale-0001
2026-06-01,ST-002,SKU-1001,1,49.90,28.00,sale-0002
```

### 1.2 `inventory.csv`

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `date` | date | sí | Fecha del snapshot |
| `location_code` | string | sí | Debe existir |
| `sku` | string | sí | Debe existir |
| `qty_on_hand` | number | sí | >= 0 permitido; negativos se marcan |
| `qty_on_order` | number | no | Default 0 |

```csv
date,location_code,sku,qty_on_hand,qty_on_order
2026-06-01,ST-001,SKU-1001,12,0
2026-06-01,WH-001,SKU-1001,340,120
```

### 1.3 `products.csv`

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `sku` | string | sí | Único por tenant (upsert) |
| `name` | string | sí | |
| `unit_cost` | number | no | Default 0 |
| `unit_price` | number | no | Default 0 |
| `pack_size` | number | no | Default 1 |
| `primary_supplier_code` | string | no | Debe existir si se provee |

```csv
sku,name,unit_cost,unit_price,pack_size,primary_supplier_code
SKU-1001,Cable USB-C 1m,28.00,49.90,1,SUP-ACME
```

### 1.4 `suppliers.csv`

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `supplier_code` | string | sí | Único por tenant (upsert) |
| `name` | string | sí | |
| `min_order_value` | number | no | Default 0 |
| `default_lead_time_days` | integer | no | Default `tenant_settings.global_lead_time_days` |

```csv
supplier_code,name,min_order_value,default_lead_time_days
SUP-ACME,Acme Distribución,5000,10
```

### 1.5 `supplier_products.csv`

| Columna | Tipo | Requerido | Notas |
|---|---|---|---|
| `supplier_code` | string | sí | Debe existir |
| `sku` | string | sí | Debe existir |
| `lead_time_days` | integer | no | Null -> fallback proveedor/global |
| `moq` | number | no | Default 0 |
| `order_multiple` | number | no | Default 1 |
| `unit_cost` | number | no | Costo específico del proveedor |

```csv
supplier_code,sku,lead_time_days,moq,order_multiple,unit_cost
SUP-ACME,SKU-1001,10,50,10,27.50
```

---

## 2. API REST

Base: `https://{host}/api/v1`. Todas las respuestas en JSON.

### 2.1 Autenticación

- Header `Authorization: Bearer <api_key>`.
- La API key está asociada a un tenant (`api_keys.tenant_id`); el scope del tenant
  se aplica automáticamente vía RLS. No se acepta `tenant_id` en el body.
- Scopes: `ingest:write`, `read`.

```http
Authorization: Bearer iok_live_3f9a...c21
```

### 2.2 Ingesta batch

`POST /api/v1/ingest/{entity}` donde `entity ∈ {sales, inventory, products,
suppliers, supplier_products}`.

Headers:
- `Authorization: Bearer <api_key>` (requerido)
- `Idempotency-Key: <uuid>` (requerido) — reintentos con la misma key devuelven el
  job existente, no reprocesan.
- `Content-Type: application/json`

Body:

```json
{
  "atomic": false,
  "rows": [
    {
      "date": "2026-06-01",
      "location_code": "ST-001",
      "sku": "SKU-1001",
      "quantity": 3,
      "unit_price": 49.90,
      "external_id": "sale-0001"
    }
  ]
}
```

- `atomic` (opcional, default `false`): si `true`, una sola fila inválida aborta
  todo el lote.
- `rows`: campos iguales a las columnas CSV de la entidad.
- Límite **[DEFAULT]**: 10,000 filas por request; lotes mayores se paginan.

Respuesta `202 Accepted` (procesamiento asíncrono):

```json
{
  "job_id": "8f0e...",
  "status": "pending",
  "entity": "sales",
  "received_rows": 1
}
```

### 2.3 Estado de un job

`GET /api/v1/jobs/{job_id}`

```json
{
  "job_id": "8f0e...",
  "entity": "sales",
  "source": "api",
  "status": "completed",
  "total_rows": 1000,
  "valid_rows": 998,
  "error_rows": 2,
  "errors": [
    { "row": 14, "field": "sku", "message": "unknown sku SKU-9999" },
    { "row": 88, "field": "quantity", "message": "must be > 0" }
  ],
  "created_at": "2026-06-19T20:00:00Z",
  "finished_at": "2026-06-19T20:00:04Z"
}
```

Estados: `pending -> validating -> processing -> completed | failed`.

### 2.4 Disparar una corrida del motor

`POST /api/v1/runs`

```json
{ "run_date": "2026-06-19", "period_start": "2026-03-19", "period_end": "2026-06-19" }
```

Respuesta `202`:

```json
{ "run_id": "a1b2...", "status": "running", "trigger": "on_demand" }
```

### 2.5 Consultar resultados

- `GET /api/v1/runs/{run_id}` — estado y métricas.
- `GET /api/v1/runs/{run_id}/impact` — `impact_simulations`.
- `GET /api/v1/runs/{run_id}/redistribution` — líneas de redistribución.
- `GET /api/v1/runs/{run_id}/purchase-orders` — borradores de OC por proveedor.
- `GET /api/v1/runs/{run_id}/target-levels?sku=...&location=...`

### 2.6 Errores

Formato uniforme:

```json
{ "error": { "code": "validation_error", "message": "...", "details": [] } }
```

Códigos HTTP: `400` validación, `401` auth, `403` scope/tenant, `404` no existe,
`409` conflicto idempotencia, `422` lote inválido en modo `atomic`, `429` rate
limit, `500` interno.

---

## 3. Validaciones por entidad (resumen)

| Entidad | Validaciones clave |
|---|---|
| `sales` | `quantity > 0`; `location_code`/`sku` existen; `date` válida |
| `inventory` | `qty_on_hand` numérico; `qty_on_order >= 0`; unicidad (date,location,sku) |
| `products` | `sku` no vacío; `primary_supplier_code` existe si se da; precios >= 0 |
| `suppliers` | `supplier_code` no vacío; `min_order_value >= 0` |
| `supplier_products` | refs existen; `moq >= 0`; `order_multiple > 0` |

---

## 4. Idempotencia y reprocesamiento

- **Movimientos** (`sales`): la unicidad `(tenant_id, external_id)` evita duplicar.
  Sin `external_id`, la deduplicación es responsabilidad del cliente.
- **Snapshots / maestros**: upsert por la clave natural
  (`(date,location,sku)` o `code`/`sku`).
- **Jobs API**: `Idempotency-Key` por request; mismo key = mismo job.
