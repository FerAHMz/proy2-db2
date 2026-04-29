from __future__ import annotations

import argparse
import csv
import os
import sys
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from neo4j import GraphDatabase, Session, basic_auth

CSV_DIR = Path(__file__).parent / "csv"
load_dotenv(Path(__file__).parent / ".env")

URI = os.getenv("NEO4J_URI")
USER = os.getenv("NEO4J_USERNAME")
PASSWORD = os.getenv("NEO4J_PASSWORD")
DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

if not all([URI, USER, PASSWORD]):
    print("[ERROR] Faltan credenciales NEO4J_* en el archivo .env", file=sys.stderr)
    sys.exit(1)

BATCH_SIZE = 500
TRUTHY = frozenset({"true", "1", "yes", "si"})


def parse_bool(v: Any) -> bool:
    return str(v).strip().lower() in TRUTHY


def parse_list(v: str | None) -> list[str]:
    if not v:
        return []
    return [x for x in v.split(";") if x]


def chunks(rows: list[dict], size: int = BATCH_SIZE) -> Iterator[list[dict]]:
    for i in range(0, len(rows), size):
        yield rows[i:i + size]


def read_csv(name: str) -> list[dict]:
    path = CSV_DIR / name
    if not path.exists():
        print(f"[WARN] No existe: {path}")
        return []
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def prep_cliente(r: dict) -> dict:
    return {
        "cliente_id": r["cliente_id"],
        "nombre": r["nombre"],
        "documento": r["documento"],
        "correo": r["correo"],
        "telefonos": parse_list(r["telefonos"]),
        "pais": r["pais"],
        "fecha_reg": r["fecha_reg"],
        "ingresos": float(r["ingresos"]),
        "score_risk": float(r["score_risk"]),
        "es_activo": parse_bool(r["es_activo"]),
        "extra_labels": parse_list(r["extra_labels"]),
    }


def prep_cuenta(r: dict) -> dict:
    return {
        "cuenta_id": r["cuenta_id"],
        "numero_cuenta": r["numero_cuenta"],
        "tipo_cuenta": r["tipo_cuenta"],
        "moneda": r["moneda"],
        "saldo_actual": float(r["saldo_actual"]),
        "estado": r["estado"],
        "ingresos": float(r["ingresos"]),
        "score_risk": float(r["score_risk"]),
        "fecha_apertura": r["fecha_apertura"],
        "es_principal": parse_bool(r["es_principal"]),
        "extra_label": r["extra_labels"],
    }


def prep_tarjeta(r: dict) -> dict:
    return {
        "tarjeta_id": r["tarjeta_id"],
        "tipo": r["tipo"],
        "marca": r["marca"],
        "estado": r["estado"],
        "limite": float(r["limite"]),
        "fecha_emision": r["fecha_emision"],
        "es_virtual": parse_bool(r["es_virtual"]),
        "intentos_pin": int(r["intentos_pin"]),
    }


def prep_transaccion(r: dict) -> dict:
    return {
        "transaccion_id": r["transaccion_id"],
        "tipo": r["tipo"],
        "monto": float(r["monto"]),
        "moneda": r["moneda"],
        "fecha_hora": r["fecha_hora"],
        "canal": r["canal"],
        "estado": r["estado"],
        "score_risk": float(r["score_risk"]),
        "es_internacional": parse_bool(r["es_internacional"]),
        "tags": parse_list(r["tags"]),
    }


def prep_dispositivo(r: dict) -> dict:
    return {
        "dispositivo_id": r["dispositivo_id"],
        "tipo": r["tipo"],
        "sistema_op": r["sistema_op"],
        "ips": parse_list(r["ips"]),
        "contador_tx": int(r["contador_tx"]),
        "fecha_reg": r["fecha_reg"],
        "ultima_conexion": r["ultima_conexion"],
        "es_confiable": parse_bool(r["es_confiable"]),
    }


def prep_ubicacion(r: dict) -> dict:
    return {
        "ubicacion_id": r["ubicacion_id"],
        "country": r["country"],
        "city": r["city"],
        "latitude": float(r["latitude"]),
        "longitude": float(r["longitude"]),
        "timezone": r["timezone"],
        "ip_address": r["ip_address"],
        "is_high_risk_country": parse_bool(r["is_high_risk_country"]),
    }


def prep_comercio(r: dict) -> dict:
    return {
        "comercio_id": r["comercio_id"],
        "name": r["name"],
        "category": r["category"],
        "country": r["country"],
        "city": r["city"],
        "is_online": parse_bool(r["is_online"]),
        "created_at": r["created_at"],
        "last_seen_at": r["last_seen_at"],
        "rating": float(r["rating"]),
    }


def prep_alerta(r: dict) -> dict:
    return {
        "alerta_id": r["alerta_id"],
        "tipo": r["tipo"],
        "descripcion": r["descripcion"],
        "fecha_creacion": r["fecha_creacion"],
        "severidad": r["severidad"],
        "score_riesgo": float(r["score_riesgo"]),
        "estado": r["estado"],
        "reglas_disparadas": parse_list(r["reglas_disparadas"]),
    }


CYPHER_NODES: dict[str, str] = {
    "Cliente": """
        UNWIND $rows AS row
        MERGE (c:Cliente {cliente_id: row.cliente_id})
        SET c.nombre = row.nombre,
            c.documento = row.documento,
            c.correo = row.correo,
            c.telefonos = row.telefonos,
            c.pais = row.pais,
            c.fecha_reg = date(row.fecha_reg),
            c.ingresos = row.ingresos,
            c.score_risk = row.score_risk,
            c.es_activo = row.es_activo
        WITH c, row
        FOREACH (lbl IN row.extra_labels |
            FOREACH (_ IN CASE WHEN lbl = 'VIP' THEN [1] ELSE [] END |
                SET c:VIP)
            FOREACH (_ IN CASE WHEN lbl = 'Riesgo' THEN [1] ELSE [] END |
                SET c:Riesgo)
        )
    """,
    "Cuenta": """
        UNWIND $rows AS row
        MERGE (c:Cuenta {cuenta_id: row.cuenta_id})
        SET c.numero_cuenta = row.numero_cuenta,
            c.tipo_cuenta = row.tipo_cuenta,
            c.moneda = row.moneda,
            c.saldo_actual = row.saldo_actual,
            c.estado = row.estado,
            c.ingresos = row.ingresos,
            c.score_risk = row.score_risk,
            c.fecha_apertura = date(row.fecha_apertura),
            c.es_principal = row.es_principal
        WITH c, row
        FOREACH (_ IN CASE WHEN row.extra_label = 'CuentaIndividual' THEN [1] ELSE [] END |
            SET c:CuentaIndividual)
        FOREACH (_ IN CASE WHEN row.extra_label = 'CuentaCorporativa' THEN [1] ELSE [] END |
            SET c:CuentaCorporativa)
        FOREACH (_ IN CASE WHEN row.extra_label = 'CuentaVIP' THEN [1] ELSE [] END |
            SET c:CuentaVIP)
    """,
    "Tarjeta": """
        UNWIND $rows AS row
        MERGE (t:Tarjeta {tarjeta_id: row.tarjeta_id})
        SET t.tipo = row.tipo,
            t.marca = row.marca,
            t.estado = row.estado,
            t.limite = row.limite,
            t.fecha_emision = date(row.fecha_emision),
            t.es_virtual = row.es_virtual,
            t.intentos_pin = row.intentos_pin
    """,
    "Transaccion": """
        UNWIND $rows AS row
        MERGE (t:Transaccion {transaccion_id: row.transaccion_id})
        SET t.tipo = row.tipo,
            t.monto = row.monto,
            t.moneda = row.moneda,
            t.fecha_hora = datetime(row.fecha_hora),
            t.canal = row.canal,
            t.estado = row.estado,
            t.score_risk = row.score_risk,
            t.es_internacional = row.es_internacional,
            t.tags = row.tags
    """,
    "Dispositivo": """
        UNWIND $rows AS row
        MERGE (d:Dispositivo {dispositivo_id: row.dispositivo_id})
        SET d.tipo = row.tipo,
            d.sistema_op = row.sistema_op,
            d.ips = row.ips,
            d.contador_tx = row.contador_tx,
            d.fecha_reg = datetime(row.fecha_reg),
            d.ultima_conexion = datetime(row.ultima_conexion),
            d.es_confiable = row.es_confiable
    """,
    "Ubicacion": """
        UNWIND $rows AS row
        MERGE (u:Ubicacion {ubicacion_id: row.ubicacion_id})
        SET u.country = row.country,
            u.city = row.city,
            u.latitude = row.latitude,
            u.longitude = row.longitude,
            u.timezone = row.timezone,
            u.ip_address = row.ip_address,
            u.is_high_risk_country = row.is_high_risk_country
    """,
    "Comercio": """
        UNWIND $rows AS row
        MERGE (c:Comercio {comercio_id: row.comercio_id})
        SET c.name = row.name,
            c.category = row.category,
            c.country = row.country,
            c.city = row.city,
            c.is_online = row.is_online,
            c.created_at = datetime(row.created_at),
            c.last_seen_at = datetime(row.last_seen_at),
            c.rating = row.rating
    """,
    "AlertaFraude": """
        UNWIND $rows AS row
        MERGE (a:AlertaFraude {alerta_id: row.alerta_id})
        SET a.tipo = row.tipo,
            a.descripcion = row.descripcion,
            a.fecha_creacion = datetime(row.fecha_creacion),
            a.severidad = row.severidad,
            a.score_riesgo = row.score_riesgo,
            a.estado = row.estado,
            a.reglas_disparadas = row.reglas_disparadas
    """,
}


CYPHER_RELS: dict[str, str] = {
    "POSEE": """
        UNWIND $rows AS row
        MATCH (cli:Cliente {cliente_id: row.cliente_id})
        MATCH (cta:Cuenta {cuenta_id: row.cuenta_id})
        MERGE (cli)-[r:POSEE]->(cta)
        SET r.desde = date(row.desde),
            r.es_principal = row.es_principal,
            r.canal_apertura = row.canal_apertura
    """,
    "TIENE_TARJETA": """
        UNWIND $rows AS row
        MATCH (cta:Cuenta {cuenta_id: row.cuenta_id})
        MATCH (t:Tarjeta {tarjeta_id: row.tarjeta_id})
        MERGE (cta)-[r:TIENE_TARJETA]->(t)
        SET r.fecha_asignacion = date(row.fecha_asignacion),
            r.fecha_vencimiento = date(row.fecha_vencimiento),
            r.canal_emision = row.canal_emision
    """,
    "ORIGEN": """
        UNWIND $rows AS row
        MATCH (c:Cuenta {cuenta_id: row.cuenta_id})
        MATCH (t:Transaccion {transaccion_id: row.transaccion_id})
        MERGE (c)-[r:ORIGEN]->(t)
        SET r.saldo_disponible_antes = row.saldo_disponible_antes,
            r.tipo_debito = row.tipo_debito,
            r.moneda = row.moneda
    """,
    "DESTINO": """
        UNWIND $rows AS row
        MATCH (t:Transaccion {transaccion_id: row.transaccion_id})
        MATCH (c:Cuenta {cuenta_id: row.cuenta_id})
        MERGE (t)-[r:DESTINO]->(c)
        SET r.banco_destino = row.banco_destino,
            r.es_beneficiario_nuevo = row.es_beneficiario_nuevo,
            r.moneda = row.moneda
    """,
    "USANDO": """
        UNWIND $rows AS row
        MATCH (t:Transaccion {transaccion_id: row.transaccion_id})
        MATCH (d:Dispositivo {dispositivo_id: row.dispositivo_id})
        MERGE (t)-[r:USANDO]->(d)
        SET r.metodo_autenticacion = row.metodo_autenticacion,
            r.es_dispositivo_confiable = row.es_dispositivo_confiable,
            r.intentos = row.intentos
    """,
    "DESDE": """
        UNWIND $rows AS row
        MATCH (t:Transaccion {transaccion_id: row.transaccion_id})
        MATCH (u:Ubicacion {ubicacion_id: row.ubicacion_id})
        MERGE (t)-[r:DESDE]->(u)
        SET r.precision = row.precision,
            r.es_ubicacion_habitual = row.es_ubicacion_habitual,
            r.tipo_red = row.tipo_red
    """,
    "EN": """
        UNWIND $rows AS row
        MATCH (t:Transaccion {transaccion_id: row.transaccion_id})
        MATCH (c:Comercio {comercio_id: row.comercio_id})
        MERGE (t)-[r:EN]->(c)
        SET r.es_primera_vez = row.es_primera_vez,
            r.monto_propina = row.monto_propina,
            r.cantidad_items = row.cantidad_items
    """,
    "USADA_EN": """
        UNWIND $rows AS row
        MATCH (ta:Tarjeta {tarjeta_id: row.tarjeta_id})
        MATCH (tx:Transaccion {transaccion_id: row.transaccion_id})
        MERGE (ta)-[r:USADA_EN]->(tx)
        SET r.intentos_validacion = row.intentos_validacion,
            r.medio_realizado = row.medio_realizado,
            r.recurrente = row.recurrente
    """,
    "GENERA": """
        UNWIND $rows AS row
        MATCH (c:Cuenta {cuenta_id: row.cuenta_id})
        MATCH (a:AlertaFraude {alerta_id: row.alerta_id})
        MERGE (c)-[r:GENERA]->(a)
        SET r.confianza = row.confianza,
            r.regla = row.regla,
            r.automatica = row.automatica
    """,
    "GENERADA_POR": """
        UNWIND $rows AS row
        MATCH (a:AlertaFraude {alerta_id: row.alerta_id})
        MATCH (t:Transaccion {transaccion_id: row.transaccion_id})
        MERGE (a)-[r:GENERADA_POR]->(t)
        SET r.confianza = row.confianza,
            r.regla = row.regla,
            r.automatica = row.automatica
    """,
}


PrepFn = Callable[[dict], dict]

REL_PREP: dict[str, PrepFn] = {
    "POSEE": lambda r: {
        "cliente_id": r["cliente_id"],
        "cuenta_id": r["cuenta_id"],
        "desde": r["desde"],
        "es_principal": parse_bool(r["es_principal"]),
        "canal_apertura": r["canal_apertura"],
    },
    "TIENE_TARJETA": lambda r: {
        "cuenta_id": r["cuenta_id"],
        "tarjeta_id": r["tarjeta_id"],
        "fecha_asignacion": r["fecha_asignacion"],
        "fecha_vencimiento": r["fecha_vencimiento"],
        "canal_emision": r["canal_emision"],
    },
    "ORIGEN": lambda r: {
        "cuenta_id": r["cuenta_id"],
        "transaccion_id": r["transaccion_id"],
        "saldo_disponible_antes": float(r["saldo_disponible_antes"]),
        "tipo_debito": r["tipo_debito"],
        "moneda": r["moneda"],
    },
    "DESTINO": lambda r: {
        "transaccion_id": r["transaccion_id"],
        "cuenta_id": r["cuenta_id"],
        "banco_destino": r["banco_destino"],
        "es_beneficiario_nuevo": parse_bool(r["es_beneficiario_nuevo"]),
        "moneda": r["moneda"],
    },
    "USANDO": lambda r: {
        "transaccion_id": r["transaccion_id"],
        "dispositivo_id": r["dispositivo_id"],
        "metodo_autenticacion": r["metodo_autenticacion"],
        "es_dispositivo_confiable": parse_bool(r["es_dispositivo_confiable"]),
        "intentos": int(r["intentos"]),
    },
    "DESDE": lambda r: {
        "transaccion_id": r["transaccion_id"],
        "ubicacion_id": r["ubicacion_id"],
        "precision": float(r["precision"]),
        "es_ubicacion_habitual": parse_bool(r["es_ubicacion_habitual"]),
        "tipo_red": r["tipo_red"],
    },
    "EN": lambda r: {
        "transaccion_id": r["transaccion_id"],
        "comercio_id": r["comercio_id"],
        "es_primera_vez": parse_bool(r["es_primera_vez"]),
        "monto_propina": float(r["monto_propina"]),
        "cantidad_items": int(r["cantidad_items"]),
    },
    "USADA_EN": lambda r: {
        "tarjeta_id": r["tarjeta_id"],
        "transaccion_id": r["transaccion_id"],
        "intentos_validacion": int(r["intentos_validacion"]),
        "medio_realizado": r["medio_realizado"],
        "recurrente": parse_bool(r["recurrente"]),
    },
    "GENERA": lambda r: {
        "cuenta_id": r["cuenta_id"],
        "alerta_id": r["alerta_id"],
        "confianza": float(r["confianza"]),
        "regla": r["regla"],
        "automatica": parse_bool(r["automatica"]),
    },
    "GENERADA_POR": lambda r: {
        "alerta_id": r["alerta_id"],
        "transaccion_id": r["transaccion_id"],
        "confianza": float(r["confianza"]),
        "regla": r["regla"],
        "automatica": parse_bool(r["automatica"]),
    },
}


NODE_FILES: list[tuple[str, str, PrepFn]] = [
    ("clientes.csv", "Cliente", prep_cliente),
    ("cuentas.csv", "Cuenta", prep_cuenta),
    ("tarjetas.csv", "Tarjeta", prep_tarjeta),
    ("dispositivos.csv", "Dispositivo", prep_dispositivo),
    ("ubicaciones.csv", "Ubicacion", prep_ubicacion),
    ("comercios.csv", "Comercio", prep_comercio),
    ("transacciones.csv", "Transaccion", prep_transaccion),
    ("alertas.csv", "AlertaFraude", prep_alerta),
]

REL_FILES: list[tuple[str, str]] = [
    ("rel_posee.csv", "POSEE"),
    ("rel_tiene_tarjeta.csv", "TIENE_TARJETA"),
    ("rel_origen.csv", "ORIGEN"),
    ("rel_destino.csv", "DESTINO"),
    ("rel_usando.csv", "USANDO"),
    ("rel_desde.csv", "DESDE"),
    ("rel_en.csv", "EN"),
    ("rel_usada_en.csv", "USADA_EN"),
    ("rel_genera.csv", "GENERA"),
    ("rel_generada_por.csv", "GENERADA_POR"),
]


CONSTRAINTS: tuple[str, ...] = (
    "CREATE CONSTRAINT cliente_id IF NOT EXISTS FOR (n:Cliente) REQUIRE n.cliente_id IS UNIQUE",
    "CREATE CONSTRAINT cuenta_id IF NOT EXISTS FOR (n:Cuenta) REQUIRE n.cuenta_id IS UNIQUE",
    "CREATE CONSTRAINT tarjeta_id IF NOT EXISTS FOR (n:Tarjeta) REQUIRE n.tarjeta_id IS UNIQUE",
    "CREATE CONSTRAINT transaccion_id IF NOT EXISTS FOR (n:Transaccion) REQUIRE n.transaccion_id IS UNIQUE",
    "CREATE CONSTRAINT dispositivo_id IF NOT EXISTS FOR (n:Dispositivo) REQUIRE n.dispositivo_id IS UNIQUE",
    "CREATE CONSTRAINT ubicacion_id IF NOT EXISTS FOR (n:Ubicacion) REQUIRE n.ubicacion_id IS UNIQUE",
    "CREATE CONSTRAINT comercio_id IF NOT EXISTS FOR (n:Comercio) REQUIRE n.comercio_id IS UNIQUE",
    "CREATE CONSTRAINT alerta_id IF NOT EXISTS FOR (n:AlertaFraude) REQUIRE n.alerta_id IS UNIQUE",
)


def apply_constraints(session: Session) -> None:
    for c in CONSTRAINTS:
        session.run(c)
    print("  -> constraints aplicados")


def reset_db(session: Session) -> None:
    print("Borrando grafo existente...")
    session.run("MATCH (n) DETACH DELETE n")
    print("  -> grafo vacio")


def load_nodes(session: Session) -> None:
    print("\nCargando nodos...")
    for fname, label, prep in NODE_FILES:
        rows = read_csv(fname)
        if not rows:
            continue
        prepped = [prep(r) for r in rows]
        cypher = CYPHER_NODES[label]
        loaded = 0
        for batch in chunks(prepped):
            session.run(cypher, rows=batch)
            loaded += len(batch)
        print(f"  -> {label}: {loaded} nodos")


def load_relationships(session: Session) -> None:
    print("\nCargando relaciones...")
    for fname, rel_type in REL_FILES:
        rows = read_csv(fname)
        if not rows:
            continue
        prepped = [REL_PREP[rel_type](r) for r in rows]
        cypher = CYPHER_RELS[rel_type]
        loaded = 0
        for batch in chunks(prepped):
            session.run(cypher, rows=batch)
            loaded += len(batch)
        print(f"  -> {rel_type}: {loaded} relaciones")


def print_summary(session: Session) -> None:
    print("\nResumen final:")
    nodos = session.run("MATCH (n) RETURN count(n) AS total").single()
    rels = session.run("MATCH ()-[r]->() RETURN count(r) AS total").single()
    print(f"  Nodos totales: {nodos['total']}")
    print(f"  Relaciones totales: {rels['total']}")
    by_label = session.run(
        """
        CALL db.labels() YIELD label
        CALL {
            WITH label
            MATCH (n) WHERE label IN labels(n)
            RETURN count(n) AS c
        }
        RETURN label, c
        ORDER BY c DESC
        """
    )
    print("  Por etiqueta:")
    for row in by_label:
        print(f"    {row['label']:<22} {row['c']}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cargador de datos a Neo4j Aura")
    parser.add_argument("--reset", action="store_true", help="Borrar grafo antes de cargar")
    return parser.parse_args()


def execute() -> None:
    args = parse_args()
    print(f"Conectando a {URI} (db={DATABASE})...")
    driver = GraphDatabase.driver(URI, auth=basic_auth(USER, PASSWORD))
    try:
        driver.verify_connectivity()
        with driver.session(database=DATABASE) as session:
            print("Aplicando constraints...")
            apply_constraints(session)
            if args.reset:
                reset_db(session)
            load_nodes(session)
            load_relationships(session)
            print_summary(session)
    finally:
        driver.close()
    print("\nListo.")


execute()
