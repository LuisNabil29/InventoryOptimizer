# Inventory Optimizer

SaaS multi-tenant para optimización de inventario: detecta venta perdida por
faltante y sobreinventario por SKU-ubicación, recomienda redistribución diaria y
planes de compra por proveedor, y cuantifica el impacto monetario.

Especificación completa en [docs/spec/inventory-optimizer.md](docs/spec/inventory-optimizer.md).

## Estructura

```
apps/web/          Next.js (UI + API REST, i18n EN/ES, dark/light)
services/engine/   Motor Python (FastAPI + batch): estadística e inventario
db/ddl/            Esquema SQL de referencia (con RLS) + seeds
docs/              Intención y spec
docker-compose.yml Postgres + web + engine (desarrollo)
```

## Requisitos

- Node.js 22+, npm 10+
- Python 3.12+
- Docker 27+ (para Postgres en desarrollo)

## Arranque rápido (desarrollo)

1. Copia variables de entorno:

```powershell
Copy-Item .env.example .env
```

2. Levanta Postgres:

```powershell
docker compose up -d postgres
```

3. Aplica el esquema:

```powershell
docker compose exec -T postgres psql -U app -d inventory -f /ddl/schema.sql
```

4. Motor (Python):

```powershell
cd services/engine
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
pytest
uvicorn app.main:app --reload --port 8000
```

5. Web (Next.js):

```powershell
cd apps/web
npm install
npm run dev
```

## Documentos

- [Intención](docs/intent/inventory-optimizer.md)
- [Spec técnico](docs/spec/inventory-optimizer.md)
- [Modelo de datos](docs/spec/data-model.md)
- [Contratos de ingesta](docs/spec/ingestion-contracts.md)
- [Scaffolding](docs/spec/scaffolding.md)
