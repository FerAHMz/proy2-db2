from __future__ import annotations

import csv
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

from faker import Faker

OUT_DIR = Path(__file__).parent / "csv"
OUT_DIR.mkdir(parents=True, exist_ok=True)

random.seed(42)
fake = Faker("es_ES")
Faker.seed(42)

N_CLIENTES = 600
N_CUENTAS = 1100
N_TARJETAS = 1500
N_TRANSACCIONES = 1800
N_DISPOSITIVOS = 250
N_UBICACIONES = 150
N_COMERCIOS = 350
N_ALERTAS = 120

HIGH_RISK_COUNTRIES: frozenset[str] = frozenset({"NG", "VE", "RU", "IR", "KP"})
COUNTRIES: list[str] = [
    "GT", "MX", "US", "ES", "CO", "AR", "PE", "CL", "BR", "CA",
    "FR", "DE", "IT", "UK", "PA", "CR", "HN", "SV", "NI", "DO",
    "NG", "VE", "RU", "IR", "KP",
]
CITIES_BY_COUNTRY: dict[str, list[str]] = {
    "GT": ["Guatemala", "Quetzaltenango", "Mixco"],
    "MX": ["CDMX", "Guadalajara", "Monterrey"],
    "US": ["New York", "Miami", "Houston", "Los Angeles"],
    "ES": ["Madrid", "Barcelona", "Sevilla"],
    "CO": ["Bogota", "Medellin", "Cali"],
    "AR": ["Buenos Aires", "Cordoba"],
    "PE": ["Lima", "Cusco"],
    "CL": ["Santiago", "Valparaiso"],
    "BR": ["Sao Paulo", "Rio de Janeiro"],
    "CA": ["Toronto", "Vancouver"],
    "FR": ["Paris", "Lyon"],
    "DE": ["Berlin", "Munich"],
    "IT": ["Roma", "Milan"],
    "UK": ["London", "Manchester"],
    "PA": ["Panama"],
    "CR": ["San Jose"],
    "HN": ["Tegucigalpa"],
    "SV": ["San Salvador"],
    "NI": ["Managua"],
    "DO": ["Santo Domingo"],
    "NG": ["Lagos"],
    "VE": ["Caracas"],
    "RU": ["Moscow"],
    "IR": ["Tehran"],
    "KP": ["Pyongyang"],
}

CANALES = ["web", "app_movil", "atm", "sucursal", "pos", "telefono"]
TIPOS_TRANSACCION = ["transferencia", "compra", "retiro", "deposito", "pago"]
ESTADOS_TX = ["completada", "pendiente", "rechazada", "reversada"]
ESTADOS_CUENTA = ["activa", "bloqueada", "cerrada"]
MARCAS_TARJETA = ["Visa", "Mastercard", "Amex", "Discover"]
SISTEMAS_OP = ["iOS", "Android", "Windows", "macOS", "Linux"]
CATEGORIAS_COMERCIO = [
    "supermercado", "restaurante", "tecnologia", "ropa", "viajes",
    "salud", "entretenimiento", "servicios", "educacion", "lujo",
]
TIPOS_ALERTA = [
    "monto_inusual", "geolocalizacion_anomala", "alta_frecuencia",
    "dispositivo_desconocido", "patron_repetido", "comercio_riesgoso",
]
SEVERIDADES = ["baja", "media", "alta", "critica"]
TIPOS_DISPOSITIVO = ["movil", "laptop", "desktop", "tablet"]
METODOS_AUTH = ["pin", "huella", "rostro", "otp_sms", "otp_email", "ninguno"]
TIPOS_RED = ["wifi_publica", "wifi_privada", "datos_moviles", "vpn"]
MEDIOS_PAGO = ["google_pay", "apple_pay", "pos_chip", "pos_banda", "online", "nfc"]


def iso_date(d: datetime) -> str:
    return d.strftime("%Y-%m-%d")


def iso_dt(d: datetime) -> str:
    return d.strftime("%Y-%m-%dT%H:%M:%S")


def random_dt(start_days_ago: int = 730, end_days_ago: int = 0) -> datetime:
    delta = random.randint(end_days_ago, start_days_ago)
    seconds = random.randint(0, 86_399)
    return datetime.now(timezone.utc) - timedelta(days=delta, seconds=seconds)


# ';' como separador interno de listas: compatible con LOAD CSV nativo de Neo4j.
def list_to_csv(items: list[str]) -> str:
    return ";".join(items)


def gen_clientes() -> list[dict]:
    rows: list[dict] = []
    for i in range(N_CLIENTES):
        country = random.choice(COUNTRIES)
        score = round(random.uniform(0.0, 1.0), 3)
        ingresos = round(random.uniform(800, 25_000), 2)
        secondary_labels: list[str] = []
        if ingresos > 15_000 and score < 0.3:
            secondary_labels.append("VIP")
        if score > 0.7 or country in HIGH_RISK_COUNTRIES:
            secondary_labels.append("Riesgo")
        rows.append({
            "cliente_id": f"CLI-{i + 1:05d}",
            "nombre": fake.name(),
            "documento": fake.unique.bothify(text="DOC-########"),
            "correo": fake.unique.email(),
            "telefonos": list_to_csv([fake.phone_number() for _ in range(random.randint(1, 3))]),
            "pais": country,
            "fecha_reg": iso_date(random_dt(2_000, 30)),
            "ingresos": ingresos,
            "score_risk": score,
            "es_activo": random.choices([True, False], weights=[0.85, 0.15])[0],
            "extra_labels": list_to_csv(secondary_labels),
        })
    return rows


def gen_cuentas() -> list[dict]:
    rows: list[dict] = []
    for i in range(N_CUENTAS):
        tipo = random.choices(
            ["CuentaIndividual", "CuentaCorporativa", "CuentaVIP"],
            weights=[0.7, 0.2, 0.1],
        )[0]
        rows.append({
            "cuenta_id": f"CTA-{i + 1:05d}",
            "numero_cuenta": fake.unique.bothify(text="##########"),
            "tipo_cuenta": tipo,
            "moneda": random.choice(["GTQ", "USD", "EUR", "MXN"]),
            "saldo_actual": round(random.uniform(0, 250_000), 2),
            "estado": random.choices(ESTADOS_CUENTA, weights=[0.85, 0.1, 0.05])[0],
            "ingresos": round(random.uniform(500, 30_000), 2),
            "score_risk": round(random.uniform(0, 1), 3),
            "fecha_apertura": iso_date(random_dt(2_000, 30)),
            "es_principal": random.choice([True, False]),
            "extra_labels": tipo,
        })
    return rows


def gen_tarjetas() -> list[dict]:
    return [
        {
            "tarjeta_id": f"TAR-{i + 1:05d}",
            "tipo": random.choice(["credito", "debito"]),
            "marca": random.choice(MARCAS_TARJETA),
            "estado": random.choices(["activa", "bloqueada", "vencida"], weights=[0.85, 0.1, 0.05])[0],
            "limite": round(random.uniform(1_000, 100_000), 2),
            "fecha_emision": iso_date(random_dt(1_500, 30)),
            "es_virtual": random.choice([True, False]),
            "intentos_pin": random.randint(0, 3),
        }
        for i in range(N_TARJETAS)
    ]


def gen_dispositivos() -> list[dict]:
    return [
        {
            "dispositivo_id": f"DEV-{i + 1:05d}",
            "tipo": random.choice(TIPOS_DISPOSITIVO),
            "sistema_op": random.choice(SISTEMAS_OP),
            "ips": list_to_csv([fake.ipv4() for _ in range(random.randint(1, 4))]),
            "contador_tx": random.randint(0, 200),
            "fecha_reg": iso_dt(random_dt(1_000, 60)),
            "ultima_conexion": iso_dt(random_dt(60, 0)),
            "es_confiable": random.choice([True, False]),
        }
        for i in range(N_DISPOSITIVOS)
    ]


def gen_ubicaciones() -> list[dict]:
    rows: list[dict] = []
    for i in range(N_UBICACIONES):
        country = random.choice(COUNTRIES)
        rows.append({
            "ubicacion_id": f"UBI-{i + 1:05d}",
            "country": country,
            "city": random.choice(CITIES_BY_COUNTRY.get(country, ["Unknown"])),
            "latitude": round(random.uniform(-60, 60), 6),
            "longitude": round(random.uniform(-160, 160), 6),
            "timezone": random.choice(["UTC-6", "UTC-5", "UTC-3", "UTC", "UTC+1", "UTC+2"]),
            "ip_address": fake.ipv4(),
            "is_high_risk_country": country in HIGH_RISK_COUNTRIES,
        })
    return rows


def gen_comercios() -> list[dict]:
    rows: list[dict] = []
    for i in range(N_COMERCIOS):
        country = random.choice(COUNTRIES)
        rows.append({
            "comercio_id": f"COM-{i + 1:05d}",
            "name": fake.company(),
            "category": random.choice(CATEGORIAS_COMERCIO),
            "country": country,
            "city": random.choice(CITIES_BY_COUNTRY.get(country, ["Unknown"])),
            "is_online": random.choice([True, False]),
            "created_at": iso_dt(random_dt(2_000, 30)),
            "last_seen_at": iso_dt(random_dt(30, 0)),
            "rating": round(random.uniform(1.0, 5.0), 2),
        })
    return rows


def gen_transacciones() -> list[dict]:
    return [
        {
            "transaccion_id": f"TX-{i + 1:06d}",
            "tipo": random.choice(TIPOS_TRANSACCION),
            "monto": round(random.uniform(1, 50_000), 2),
            "moneda": random.choice(["GTQ", "USD", "EUR"]),
            "fecha_hora": iso_dt(random_dt(365, 0)),
            "canal": random.choice(CANALES),
            "estado": random.choices(ESTADOS_TX, weights=[0.78, 0.1, 0.08, 0.04])[0],
            "score_risk": round(random.uniform(0, 1), 3),
            "es_internacional": random.choice([True, False]),
            "tags": list_to_csv(random.sample(
                ["recurrente", "alta", "anomala", "favorito"],
                k=random.randint(0, 2),
            )),
        }
        for i in range(N_TRANSACCIONES)
    ]


def gen_alertas() -> list[dict]:
    return [
        {
            "alerta_id": f"ALR-{i + 1:05d}",
            "tipo": random.choice(TIPOS_ALERTA),
            "descripcion": fake.sentence(nb_words=8),
            "fecha_creacion": iso_dt(random_dt(120, 0)),
            "severidad": random.choices(SEVERIDADES, weights=[0.4, 0.35, 0.2, 0.05])[0],
            "score_riesgo": round(random.uniform(0.3, 1.0), 3),
            "estado": random.choices(
                ["abierta", "en_revision", "cerrada", "falsa"],
                weights=[0.4, 0.3, 0.2, 0.1],
            )[0],
            "reglas_disparadas": list_to_csv(random.sample(
                ["R001", "R002", "R003", "R004", "R005"],
                k=random.randint(1, 3),
            )),
        }
        for i in range(N_ALERTAS)
    ]


# Garantia de conectividad: cada cliente recibe al menos una cuenta antes de
# repartir el remanente al azar.
def gen_posee(clientes: list[dict], cuentas: list[dict]) -> list[dict]:
    cli_ids = [c["cliente_id"] for c in clientes]
    cta_ids = [c["cuenta_id"] for c in cuentas]
    pairs = [(cli_ids[i], cta_ids[i]) for i in range(min(len(cli_ids), len(cta_ids)))]
    pairs.extend((random.choice(cli_ids), cta) for cta in cta_ids[len(cli_ids):])
    return [
        {
            "cliente_id": cli,
            "cuenta_id": cta,
            "desde": iso_date(random_dt(2_000, 30)),
            "es_principal": random.choice([True, False]),
            "canal_apertura": random.choice(["sucursal", "online", "app_movil"]),
        }
        for cli, cta in pairs
    ]


def gen_tiene_tarjeta(cuentas: list[dict], tarjetas: list[dict]) -> list[dict]:
    cta_ids = [c["cuenta_id"] for c in cuentas]
    return [
        {
            "cuenta_id": random.choice(cta_ids),
            "tarjeta_id": t["tarjeta_id"],
            "fecha_asignacion": iso_date(random_dt(1_500, 30)),
            "fecha_vencimiento": iso_date(random_dt(-365, -1_500)),
            "canal_emision": random.choice(["sucursal", "online", "app_movil", "correo"]),
        }
        for t in tarjetas
    ]


def gen_tx_origen_destino(
    cuentas: list[dict], transacciones: list[dict],
) -> tuple[list[dict], list[dict]]:
    origen: list[dict] = []
    destino: list[dict] = []
    cta_ids = [c["cuenta_id"] for c in cuentas]
    n_cta = len(cta_ids)

    # Plantamos N_RINGS anillos de smurfing: pares de cuentas con TX_PER_DIR
    # transferencias en cada direccion, todas con monto > 500 y estado
    # 'completada'. Sin esto, la query de anillos sospechosos retorna 0
    # resultados porque la asignacion random uniforme casi nunca produce
    # pares simetricos.
    N_RINGS = 15
    TX_PER_DIR = 3
    half = n_cta // 2
    pool_a = cta_ids[:half].copy()
    pool_b = cta_ids[half:].copy()
    random.shuffle(pool_a)
    random.shuffle(pool_b)
    ring_pairs = list(zip(pool_a[:N_RINGS], pool_b[:N_RINGS]))

    ring_assignments: list[tuple[str, str]] = []
    for a, b in ring_pairs:
        for _ in range(TX_PER_DIR):
            ring_assignments.append((a, b))
            ring_assignments.append((b, a))
    n_ring_tx = len(ring_assignments)

    # Coverage para el resto: cada cuenta aparece >=1 como ORIGEN y >=1 como
    # DESTINO en las siguientes n_cta transacciones (asi nadie queda fuera del
    # componente conexo).
    shuffled_o = cta_ids.copy()
    shuffled_d = cta_ids.copy()
    random.shuffle(shuffled_o)
    random.shuffle(shuffled_d)

    for i, tx in enumerate(transacciones):
        if i < n_ring_tx:
            a, b = ring_assignments[i]
            tx["monto"] = round(random.uniform(800, 5_000), 2)
            tx["estado"] = "completada"
        elif (i - n_ring_tx) < n_cta:
            j = i - n_ring_tx
            a = shuffled_o[j]
            b = shuffled_d[j] if shuffled_d[j] != a else shuffled_d[(j + 1) % n_cta]
        else:
            a, b = random.sample(cta_ids, 2)
        origen.append({
            "cuenta_id": a,
            "transaccion_id": tx["transaccion_id"],
            "saldo_disponible_antes": round(random.uniform(0, 100_000), 2),
            "tipo_debito": random.choice(["inmediato", "diferido", "programado"]),
            "moneda": tx["moneda"],
        })
        destino.append({
            "transaccion_id": tx["transaccion_id"],
            "cuenta_id": b,
            "banco_destino": fake.company(),
            "es_beneficiario_nuevo": random.choice([True, False]),
            "moneda": tx["moneda"],
        })
    return origen, destino


# Round-robin con shuffle: la primera vuelta cubre cada catalog_id al menos
# una vez para garantizar que ningun nodo quede aislado.
def _coverage_pick(idx: int, n: int, shuffled: list[str], catalog: list[str]) -> str:
    return shuffled[idx] if idx < n else random.choice(catalog)


def gen_tx_dispositivo(transacciones: list[dict], dispositivos: list[dict]) -> list[dict]:
    dev_ids = [d["dispositivo_id"] for d in dispositivos]
    shuffled = dev_ids.copy()
    random.shuffle(shuffled)
    return [
        {
            "transaccion_id": tx["transaccion_id"],
            "dispositivo_id": _coverage_pick(i, len(dev_ids), shuffled, dev_ids),
            "metodo_autenticacion": random.choice(METODOS_AUTH),
            "es_dispositivo_confiable": random.choice([True, False]),
            "intentos": random.randint(1, 5),
        }
        for i, tx in enumerate(transacciones)
    ]


def gen_tx_ubicacion(transacciones: list[dict], ubicaciones: list[dict]) -> list[dict]:
    ubi_ids = [u["ubicacion_id"] for u in ubicaciones]
    shuffled = ubi_ids.copy()
    random.shuffle(shuffled)
    return [
        {
            "transaccion_id": tx["transaccion_id"],
            "ubicacion_id": _coverage_pick(i, len(ubi_ids), shuffled, ubi_ids),
            "precision": round(random.uniform(1, 50), 2),
            "es_ubicacion_habitual": random.choice([True, False]),
            "tipo_red": random.choice(TIPOS_RED),
        }
        for i, tx in enumerate(transacciones)
    ]


def gen_tx_comercio(transacciones: list[dict], comercios: list[dict]) -> list[dict]:
    com_ids = [c["comercio_id"] for c in comercios]
    eligibles = [tx for tx in transacciones if tx["tipo"] in ("compra", "pago")]
    if not eligibles:
        return []
    # Si hay menos transacciones elegibles que comercios, cubrimos solo lo que
    # se pueda y dejamos el resto al fallback de garantia conexa al final.
    coverage = com_ids.copy()
    random.shuffle(coverage)
    return [
        {
            "transaccion_id": tx["transaccion_id"],
            "comercio_id": _coverage_pick(i, len(com_ids), coverage, com_ids),
            "es_primera_vez": random.choice([True, False]),
            "monto_propina": round(random.uniform(0, tx["monto"] * 0.15), 2),
            "cantidad_items": random.randint(1, 12),
        }
        for i, tx in enumerate(eligibles)
    ]


def gen_tarjeta_usada_en_tx(tarjetas: list[dict], transacciones: list[dict]) -> list[dict]:
    tar_ids = [t["tarjeta_id"] for t in tarjetas]
    return [
        {
            "tarjeta_id": random.choice(tar_ids),
            "transaccion_id": tx["transaccion_id"],
            "intentos_validacion": random.randint(1, 4),
            "medio_realizado": random.choice(MEDIOS_PAGO),
            "recurrente": random.choice([True, False]),
        }
        for tx in transacciones
        if random.random() < 0.6
    ]


def gen_cuenta_genera_alerta(cuentas: list[dict], alertas: list[dict]) -> list[dict]:
    cta_ids = [c["cuenta_id"] for c in cuentas]
    return [
        {
            "cuenta_id": random.choice(cta_ids),
            "alerta_id": a["alerta_id"],
            "confianza": round(random.uniform(0.5, 1.0), 3),
            "regla": random.choice(["R001", "R002", "R003", "R004", "R005"]),
            "automatica": random.choice([True, False]),
        }
        for a in alertas
    ]


def gen_alerta_generada_por_tx(alertas: list[dict], transacciones: list[dict]) -> list[dict]:
    tx_ids = [t["transaccion_id"] for t in transacciones]
    rows: list[dict] = []
    for alerta in alertas:
        for tx_id in random.sample(tx_ids, k=random.randint(1, 3)):
            rows.append({
                "alerta_id": alerta["alerta_id"],
                "transaccion_id": tx_id,
                "confianza": round(random.uniform(0.5, 1.0), 3),
                "regla": random.choice(["R001", "R002", "R003", "R004", "R005"]),
                "automatica": random.choice([True, False]),
            })
    return rows


def write_csv(filename: str, rows: list[dict]) -> None:
    if not rows:
        return
    path = OUT_DIR / filename
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
    print(f"  -> {path.name}: {len(rows)} filas")


def run() -> None:
    print("Generando nodos...")
    clientes = gen_clientes()
    cuentas = gen_cuentas()
    tarjetas = gen_tarjetas()
    dispositivos = gen_dispositivos()
    ubicaciones = gen_ubicaciones()
    comercios = gen_comercios()
    transacciones = gen_transacciones()
    alertas = gen_alertas()

    write_csv("clientes.csv", clientes)
    write_csv("cuentas.csv", cuentas)
    write_csv("tarjetas.csv", tarjetas)
    write_csv("dispositivos.csv", dispositivos)
    write_csv("ubicaciones.csv", ubicaciones)
    write_csv("comercios.csv", comercios)
    write_csv("transacciones.csv", transacciones)
    write_csv("alertas.csv", alertas)

    print("\nGenerando relaciones...")
    posee = gen_posee(clientes, cuentas)
    tiene_tarjeta = gen_tiene_tarjeta(cuentas, tarjetas)
    origen, destino = gen_tx_origen_destino(cuentas, transacciones)
    usando = gen_tx_dispositivo(transacciones, dispositivos)
    desde = gen_tx_ubicacion(transacciones, ubicaciones)
    en = gen_tx_comercio(transacciones, comercios)
    usada_en = gen_tarjeta_usada_en_tx(tarjetas, transacciones)
    genera = gen_cuenta_genera_alerta(cuentas, alertas)
    generada_por = gen_alerta_generada_por_tx(alertas, transacciones)

    write_csv("rel_posee.csv", posee)
    write_csv("rel_tiene_tarjeta.csv", tiene_tarjeta)
    write_csv("rel_origen.csv", origen)
    write_csv("rel_destino.csv", destino)
    write_csv("rel_usando.csv", usando)
    write_csv("rel_desde.csv", desde)
    write_csv("rel_en.csv", en)
    write_csv("rel_usada_en.csv", usada_en)
    write_csv("rel_genera.csv", genera)
    write_csv("rel_generada_por.csv", generada_por)

    total_nodos = sum(map(len, [
        clientes, cuentas, tarjetas, dispositivos,
        ubicaciones, comercios, transacciones, alertas,
    ]))
    total_rels = sum(map(len, [
        posee, tiene_tarjeta, origen, destino,
        usando, desde, en, usada_en, genera, generada_por,
    ]))
    print(f"\nTotal nodos generados: {total_nodos}")
    print(f"Total relaciones generadas: {total_rels}")
    print(f"\nArchivos en: {OUT_DIR}")


run()
