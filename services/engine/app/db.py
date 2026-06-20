"""Acceso a PostgreSQL para el motor, respetando RLS por tenant.

Usa el rol de aplicacion (DATABASE_URL) y fija app.current_tenant a nivel de
sesion, de modo que toda consulta queda acotada al tenant.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row


def _dsn() -> str:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError("DATABASE_URL no esta definido")
    return dsn


@contextmanager
def tenant_connection(tenant_id: str) -> Iterator[psycopg.Connection]:
    """Conexion con app.current_tenant fijado (RLS) y filas como dict."""
    conn = psycopg.connect(_dsn(), row_factory=dict_row, autocommit=False)
    try:
        with conn.cursor() as cur:
            cur.execute("select set_config('app.current_tenant', %s, false)", (tenant_id,))
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
