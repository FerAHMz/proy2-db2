# Proyecto 2 - DB2: Deteccion de Fraude con Neo4j

Backend de un sistema de **deteccion de fraude bancario** sobre Neo4j AuraDB.
Modela clientes, cuentas, tarjetas, transacciones, dispositivos, ubicaciones,
comercios y alertas; cada operacion CRUD esta pensada como una accion real
que un equipo de compliance/fraude ejecuta sobre el sistema.

- **`data-loader/`** – scripts Python que generan ~5,800 nodos sinteticos en
  CSV y los cargan a Aura.
- **`backend/`** – API REST en Node.js (Express + neo4j-driver).
- **`frontend/`** – UI de gestion en Vue 3 + Vite + Tailwind. Cada accion
  CRUD de la rubrica esta accesible desde una pantalla. Detalles en
  [`frontend/README.md`](./frontend/README.md).

---

## 1. Modelo de datos

### Etiquetas (8 primarias + 5 secundarias)

| Label primaria | Labels secundarias |
|---|---|
| `Cliente` | `VIP`, `Riesgo` |
| `Cuenta` | `CuentaIndividual`, `CuentaCorporativa`, `CuentaVIP` |
| `Tarjeta`, `Transaccion`, `Dispositivo`, `Ubicacion`, `Comercio`, `AlertaFraude` | – |

Cada label tiene >=7 propiedades cubriendo todos los tipos requeridos:
`String`, `Integer`, `Float`, `Boolean`, `List`, `Date`, `DateTime`.

### Tipos de relacion (10)

`POSEE`, `TIENE_TARJETA`, `ORIGEN`, `DESTINO`, `USANDO`, `DESDE`, `EN`,
`USADA_EN`, `GENERA`, `GENERADA_POR`. Cada una con 3 propiedades.

---

## 2. Aplicacion funcional – cobertura de la rubrica

> Todas las acciones listadas tienen un endpoint en el backend que las
> ejecuta y, **cada una de ellas debe existir como pantalla, formulario,
> boton o panel concreto en el frontend** — no basta con que el endpoint
> exista, debe ser invocable desde la UI con datos reales.
>
> Todos los `curl` mostrados fueron ejecutados contra la instancia de Aura
> y devolvieron 200/201. Asumen que el backend corre en `http://localhost:4000`.

### Creacion de nodos

**Contexto bancario**: alta de comercios nuevos en la red de adquirencia,
alta de clientes con segmentacion VIP/Riesgo y apertura de cuentas con
sus datos contractuales.

- **Crear nodo con 1 label** — `POST /api/nodes/single-label`
  Pantalla en frontend: formulario *"Registrar entidad simple"* con un
  combo `label` (Comercio, Tarjeta, Dispositivo, Ubicacion, AlertaFraude,
  Transaccion) y campos dinamicos para las propiedades.

- **Crear nodo con 2+ labels** — `POST /api/nodes/multi-label`
  Pantalla en frontend: formulario *"Registrar cliente / cuenta con
  segmentacion"*. Primera label primaria + checkboxes con las labels
  secundarias permitidas (`VIP`, `Riesgo`, `CuentaIndividual`,
  `CuentaCorporativa`, `CuentaVIP`).

- **Crear nodo con >=5 propiedades** — los dos endpoints anteriores
  aceptan cualquier objeto de propiedades. El frontend debe **validar
  que se ingresen al menos 5 campos** antes de habilitar el boton "Guardar"
  para cubrir este item.

```bash
curl -X POST http://localhost:4000/api/nodes/single-label \
  -H "Content-Type: application/json" \
  -d '{"label":"Comercio","properties":{"comercio_id":"COM-99999","name":"Joyeria Diamante","category":"lujo","country":"VE","is_online":true,"rating":1.8}}'

curl -X POST http://localhost:4000/api/nodes/multi-label \
  -H "Content-Type: application/json" \
  -d '{"labels":["Cliente","VIP","Riesgo"],"properties":{"cliente_id":"CLI-99999","nombre":"Mariana Pereira","correo":"mariana@x.com","pais":"GT","ingresos":22500.5,"score_risk":0.82}}'
```

---

### Visualizacion de nodos

**Contexto bancario**: vista del analista de fraude — ficha de entidad,
tabla con filtros y panel de KPIs.

- **Consultas con filtros mostrando propiedades** — `GET /api/nodes/:label?where=`
  Pantalla en frontend: barra de filtros encima de la tabla con inputs por
  propiedad (`pais`, `estado`, `tipo`...). Cada cambio reconsulta y
  renderiza la tabla.

- **Consultar 1 nodo** — `GET /api/nodes/:label/:id`
  Pantalla en frontend: *"Ficha de entidad"* — al hacer click en una fila
  de la tabla se abre el detalle con todas las propiedades y el array de
  conexiones del grafo.

- **Consultar muchos nodos** — `GET /api/nodes/:label?limit=&skip=`
  Pantalla en frontend: tabla paginada con scroll infinito o controles
  de paginacion.

- **Consultas agregadas** — `GET /api/analytics/*`
  Pantalla en frontend: dashboard con tarjetas/graficos (totales por
  canal, monto por pais, conteo por label) que invocan los endpoints en
  paralelo con `Promise.all`.

```bash
curl http://localhost:4000/api/nodes/Cliente/CLI-99999
curl "http://localhost:4000/api/nodes/Cliente?limit=20&where=pais:GT,es_activo:true"
curl http://localhost:4000/api/analytics/resumen-grafo
```

---

### Gestion de propiedades en nodos

**Contexto bancario**: marcar cuentas bajo investigacion, etiquetar
clientes en sweeps de auditoria, limpiar banderas cuando se cierra un caso.

> Nota: en Cypher la operacion `SET n += $props` realiza simultaneamente
> "agregar" (cuando la propiedad no existia) y "actualizar" (cuando ya
> existia). El **mismo endpoint cubre ambos sub-items de la rubrica**, y
> las pruebas registradas en este README muestran ambos comportamientos.

- **Agregar 1+ propiedades a 1 nodo** — `PATCH /api/nodes/:label/:id/properties`
  Boton *"Agregar campo"* en la ficha de entidad: dialog con par(es)
  clave/valor para extender el nodo.

- **Agregar 1+ propiedades a multiples nodos** — `PATCH /api/nodes/:label/properties`
  Accion masiva *"Etiquetar seleccion"* en la tabla de nodos: el usuario
  define un filtro + las propiedades a aplicar.

- **Actualizar 1+ propiedades de 1 nodo** — mismo endpoint que "agregar a 1".
  En la UI corresponde al modo *"Editar campo"* en la ficha (cada
  propiedad tiene un icono de lapiz que abre un input).

- **Actualizar 1+ propiedades de multiples nodos** — mismo endpoint que
  "agregar a varios". En la UI es la misma accion masiva pero pasando
  como propiedad un nombre que ya existe (ej. cambiar `score_risk` para
  todas las cuentas con `pais=VE`).

- **Eliminar 1+ propiedades de 1 nodo** — `DELETE /api/nodes/:label/:id/properties`
  Icono de tacho junto a cada propiedad en la ficha.

- **Eliminar 1+ propiedades de multiples nodos** — `DELETE /api/nodes/:label/properties`
  Accion masiva *"Limpiar campo"* desde la tabla (filtro + lista de
  campos a remover).

```bash
# AGREGAR campos nuevos
curl -X PATCH http://localhost:4000/api/nodes/Cuenta/CTA-99999/properties \
  -H "Content-Type: application/json" \
  -d '{"properties":{"bajo_investigacion":true,"motivo_alerta":"tx anomala"}}'

# ACTUALIZAR campos existentes (mismo endpoint)
curl -X PATCH http://localhost:4000/api/nodes/Cuenta/CTA-99999/properties \
  -H "Content-Type: application/json" \
  -d '{"properties":{"score_risk":0.95}}'

# Bulk add/update
curl -X PATCH http://localhost:4000/api/nodes/Cuenta/properties \
  -H "Content-Type: application/json" \
  -d '{"filter":{"estado":"activa"},"properties":{"revisado":true}}'

# Eliminar 1 / muchos
curl -X DELETE http://localhost:4000/api/nodes/Cuenta/CTA-99999/properties \
  -H "Content-Type: application/json" \
  -d '{"properties":["bajo_investigacion","motivo_alerta"]}'

curl -X DELETE http://localhost:4000/api/nodes/Cuenta/properties \
  -H "Content-Type: application/json" \
  -d '{"filter":{"estado":"activa"},"properties":["revisado"]}'
```

---

### Creacion de relaciones con propiedades

**Contexto bancario**: registrar `Cliente -[POSEE]-> Cuenta` cuando se
abre cuenta, vincular `Tarjeta -[USADA_EN]-> Transaccion`, registrar
`Transaccion -[DESDE]-> Ubicacion`.

- **Crear relacion entre 2 nodos existentes** — `POST /api/relationships`
  Pantalla en frontend: dialog *"Vincular entidades"* con dos selects
  (origen y destino), combo del tipo de relacion (limitado a los 10
  validos) y formulario de propiedades.

- **La operacion debe incluir el tipo + minimo 3 propiedades** — el mismo
  endpoint exige `type` y acepta cualquier objeto de propiedades; el
  **frontend debe validar que se ingresen al menos 3 antes de habilitar
  el boton "Vincular"**.

```bash
curl -X POST http://localhost:4000/api/relationships \
  -H "Content-Type: application/json" \
  -d '{"from":{"label":"Cliente","id":"CLI-99999"},"to":{"label":"Cuenta","id":"CTA-99999"},"type":"POSEE","properties":{"desde":"2024-01-15","es_principal":true,"canal_apertura":"sucursal"}}'
```

---

### Gestion de relaciones

**Contexto bancario**: marcar relaciones como auditadas, agregar
`revisado_por` y `fecha_revision` cuando compliance reclasifica un
movimiento, masivos al reclasificar todas las tx en USD.

> Igual que con nodos: `SET r += $props` cubre "agregar" y "actualizar"
> en el mismo endpoint.

- **Agregar 1+ propiedades a 1 relacion** — `PATCH /api/relationships/:type/properties`
  En la ficha de entidad, click sobre una relacion abre un dialog con
  sus propiedades y un boton *"Agregar campo"*.

- **Agregar 1+ propiedades a multiples relaciones** — `PATCH /api/relationships/:type/bulk-properties`
  Pantalla *"Auditoria de relaciones"*: combo del tipo + filtro de
  propiedades + lista de campos a agregar.

- **Actualizar 1+ propiedades de la relacion** — mismo endpoint single.
  Modo edicion sobre cada propiedad de la relacion en la UI.

- **Actualizar 1+ propiedades de multiples relaciones** — mismo endpoint bulk.
  Misma pantalla de auditoria, con campo cuyo nombre ya existe.

- **Eliminar 1+ propiedades de una relacion** — `DELETE /api/relationships/:type/properties`
  Icono de tacho junto a cada propiedad de la relacion en la UI.

- **Eliminar 1+ propiedades de multiples relaciones** — `DELETE /api/relationships/:type/bulk-properties`
  Pantalla de auditoria con accion *"Limpiar campos"*.

```bash
curl -X PATCH http://localhost:4000/api/relationships/POSEE/properties \
  -H "Content-Type: application/json" \
  -d '{"from":{"label":"Cliente","id":"CLI-99999"},"to":{"label":"Cuenta","id":"CTA-99999"},"properties":{"revisado_por":"compliance","fecha_revision":"2026-04-27"}}'

curl -X PATCH http://localhost:4000/api/relationships/ORIGEN/bulk-properties \
  -H "Content-Type: application/json" \
  -d '{"filter":{"moneda":"USD"},"properties":{"flag_internacional":true}}'

curl -X DELETE http://localhost:4000/api/relationships/POSEE/properties \
  -H "Content-Type: application/json" \
  -d '{"from":{"label":"Cliente","id":"CLI-99999"},"to":{"label":"Cuenta","id":"CTA-99999"},"properties":["fecha_revision","revisado_por"]}'

curl -X DELETE http://localhost:4000/api/relationships/ORIGEN/bulk-properties \
  -H "Content-Type: application/json" \
  -d '{"filter":{"moneda":"USD"},"properties":["flag_internacional"]}'
```

---

### Eliminacion de nodos

**Contexto bancario**: cierre definitivo de cuenta, purga GDPR de un
cliente, eliminacion masiva de cuentas en estado `cerrada`.

- **Eliminar 1 nodo** — `DELETE /api/nodes/:label/:id`
  Boton *"Eliminar"* en la ficha de entidad con confirmacion modal.
  Internamente usa `DETACH DELETE` para borrar tambien sus relaciones.

- **Eliminar multiples nodos al mismo tiempo** — `DELETE /api/nodes/:label`
  Pantalla *"Purga masiva"*: el usuario elige una lista de IDs (multi-select
  en la tabla) o un filtro, y la UI muestra el conteo eliminado.

```bash
curl -X DELETE http://localhost:4000/api/nodes/Comercio/COM-99999

curl -X DELETE http://localhost:4000/api/nodes/Cuenta \
  -H "Content-Type: application/json" \
  -d '{"ids":["CTA-99999","CTA-99998"]}'

curl -X DELETE http://localhost:4000/api/nodes/Cuenta \
  -H "Content-Type: application/json" \
  -d '{"filter":{"estado":"cerrada"}}'
```

---

### Eliminacion de relaciones

**Contexto bancario**: revertir asignacion de tarjeta a cuenta (error
operativo), cortar todas las relaciones `USANDO` de un dispositivo
comprometido.

- **Eliminar 1 relacion** — `DELETE /api/relationships/:type`
  Icono "X" junto a cada relacion en la ficha de entidad con
  confirmacion.

- **Eliminar multiples relaciones al mismo tiempo** — `DELETE /api/relationships/:type/bulk`
  Pantalla *"Purga de vinculos"*: combo de tipo + filtro de
  propiedades. Requiere filtro no-vacio (proteccion).

```bash
curl -X DELETE http://localhost:4000/api/relationships/DESTINO \
  -H "Content-Type: application/json" \
  -d '{"from":{"label":"Transaccion","id":"TX-99999"},"to":{"label":"Cuenta","id":"CTA-99999"}}'

curl -X DELETE http://localhost:4000/api/relationships/ORIGEN/bulk \
  -H "Content-Type: application/json" \
  -d '{"filter":{"moneda":"USD"}}'
```

---

### Consultas Cypher

**Contexto bancario**: panel ejecutivo con 8 consultas distintas — cada
miembro del equipo presenta entre 2 y 3 durante la defensa.

- **Entre 4-6 consultas distintas** — el backend expone 8 (excede el minimo).
  Pantalla *"Dashboard analitico"* con tarjetas independientes que
  invocan cada endpoint en paralelo (`Promise.all`).

- **Cada integrante presenta 2 consultas** — el equipo es de 3 personas;
  la UI debe permitir filtrar/parametrizar las queries (limit, monto
  minimo, paises) para que cada presentador pueda demostrar su consulta.

| Endpoint | Pregunta de negocio |
|---|---|
| `GET /api/analytics/top-clientes-monto` | ¿Quien mueve mas dinero? (riesgo de lavado) |
| `GET /api/analytics/transacciones-por-canal` | Distribucion canal/estado para detectar canales con alto rechazo |
| `GET /api/analytics/transacciones-pais-riesgo` | Tx desde paises de alto riesgo (FATF) |
| `GET /api/analytics/anillos-sospechosos?min_monto=1000` | Cuentas que se transfieren mutuamente (smurfing) |
| `GET /api/analytics/dispositivos-compartidos?min_clientes=2` | Dispositivos usados por varios clientes (account takeover) |
| `GET /api/analytics/comercios-con-alertas` | Comercios con mas alertas asociadas |
| `GET /api/analytics/path-clientes?from=X&to=Y&max=4` | shortestPath entre 2 clientes (deteccion de comunidades) |
| `GET /api/analytics/resumen-grafo` | Conteo por label/tipo (KPIs) |

---

### Carga CSV

**Contexto bancario**: el equipo recibe un dump del core bancario o un
archivo de regulador y lo carga sin manipularlo a mano.

- **Carga de data via archivo CSV** — `POST /api/csv/upload`
  Pantalla *"Importar datos"* con drag-and-drop del archivo, preview de
  las primeras filas, editor de mapeos (columna CSV → propiedad +
  tipo: string/integer/float/boolean/date/datetime/list) y boton para
  ejecutar la carga. La UI debe permitir seleccionar `mode: nodes` o
  `relationships` y los matchKeys correspondientes.

```bash
curl -X POST http://localhost:4000/api/csv/upload \
  -F "file=@./clientes.csv" \
  -F 'config={"mode":"nodes","label":"Cliente","matchKey":"cliente_id","mappings":{"cliente_id":{"property":"cliente_id","type":"string"},"nombre":{"property":"nombre","type":"string"},"score_risk":{"property":"score_risk","type":"float"}}}'
```

---

## 3. Resumen de cumplimiento

Acciones de la rubrica vs. endpoint que las ejecuta. **Todas estas
acciones deben ser invocables desde la UI del frontend, no solo
existir en el backend**:

| Accion de la rubrica | Endpoint backend |
|---|---|
| Crear nodo con 1 label | `POST /api/nodes/single-label` |
| Crear nodo con 2+ labels | `POST /api/nodes/multi-label` |
| Crear nodo con >=5 propiedades | cualquiera de los 2 anteriores (validar en UI) |
| Consultar nodos con filtros y mostrar propiedades | `GET /api/nodes/:label?where=` |
| Consultar 1 nodo | `GET /api/nodes/:label/:id` |
| Consultar muchos nodos | `GET /api/nodes/:label` |
| Realizar consultas agregadas | `GET /api/analytics/*` (8 disponibles) |
| Agregar 1+ props a un nodo | `PATCH /api/nodes/:label/:id/properties` |
| Agregar 1+ props a multiples nodos | `PATCH /api/nodes/:label/properties` |
| Actualizar 1+ props de un nodo | `PATCH /api/nodes/:label/:id/properties` |
| Actualizar 1+ props de multiples nodos | `PATCH /api/nodes/:label/properties` |
| Eliminar 1+ props de un nodo | `DELETE /api/nodes/:label/:id/properties` |
| Eliminar 1+ props de multiples nodos | `DELETE /api/nodes/:label/properties` |
| Crear relacion entre 2 nodos | `POST /api/relationships` |
| Relacion incluye tipo + >=3 props | mismo endpoint (validar en UI) |
| Agregar 1+ props a 1 relacion | `PATCH /api/relationships/:type/properties` |
| Agregar 1+ props a multiples relaciones | `PATCH /api/relationships/:type/bulk-properties` |
| Actualizar 1+ props de la relacion | `PATCH /api/relationships/:type/properties` |
| Actualizar 1+ props de multiples relaciones | `PATCH /api/relationships/:type/bulk-properties` |
| Eliminar 1+ props de una relacion | `DELETE /api/relationships/:type/properties` |
| Eliminar 1+ props de multiples relaciones | `DELETE /api/relationships/:type/bulk-properties` |
| Eliminar 1 nodo | `DELETE /api/nodes/:label/:id` |
| Eliminar multiples nodos | `DELETE /api/nodes/:label` |
| Eliminar 1 relacion | `DELETE /api/relationships/:type` |
| Eliminar multiples relaciones | `DELETE /api/relationships/:type/bulk` |
| Realizar entre 4-6 consultas distintas | 8 endpoints en `/api/analytics/*` |
| Cada integrante presenta 2 consultas | 8 disponibles (8 / 3 integrantes) |

Otros requisitos del proyecto:

| Requisito | Cubierto |
|---|---|
| Caso de uso adecuado (deteccion de fraude) | ✓ |
| >=5 labels distintas | 8 primarias + 5 secundarias |
| >=5 propiedades por label | ✓ |
| >=10 tipos de relaciones | 10 |
| >=3 propiedades por relacion | ✓ |
| Todos los tipos de datos | string, integer, float, boolean, list, date, datetime |
| Carga CSV | `data-loader/load_data.py` + `POST /api/csv/upload` |
| >=5,000 nodos previos en BD | ~5,870 generados |
| Grafo conexo | Garantizado por el generador |

---

## 4. Instrucciones para ejecutar el proyecto completo

### Requisitos

- Python 3.10+
- Node.js 20+
- Conexion a internet (Aura ya esta configurada en los `.env`)

### Paso 1 — Cargar la base de datos (una sola vez)

```bash
cd data-loader
python3 -m venv .venv
source .venv/bin/activate            # en Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Generar los CSV (~5,870 nodos + ~12,000 relaciones)
python generate_csv.py

# Cargar a Neo4j Aura. --reset borra el grafo previo.
python load_data.py --reset
```

Salida esperada al final:

```
Resumen final:
  Nodos totales: 5870
  Relaciones totales: 12345
  Por etiqueta:
    Transaccion           1800
    Tarjeta               1500
    ...
```

### Paso 2 — Levantar el backend

```bash
cd ../backend
npm install
npm start
```

Salida esperada:

```
[Neo4j] Conectado a neo4j+s://907049fa.databases.neo4j.io (db=907049fa)
API escuchando en http://localhost:4000
CORS origins: http://localhost:5173, http://localhost:3000
```

### Paso 3 — Verificar

```bash
curl http://localhost:4000/api/health
# {"status":"ok","neo4j":true}

curl http://localhost:4000/api          # indice de endpoints
curl http://localhost:4000/api/analytics/resumen-grafo
```

### Paso 4 — Conectar el frontend (Vue/React)

El backend acepta CORS desde `http://localhost:5173` (Vite) y
`http://localhost:3000` (CRA/Next). Se cambia con `CORS_ORIGIN` en
`backend/.env`.

```js
// Vue / React
const res = await fetch('http://localhost:4000/api/analytics/resumen-grafo');
const data = await res.json();
```

Para visualizacion en grafo se recomienda
[`vis-network`](https://visjs.github.io/vis-network/) o
[`react-force-graph`](https://github.com/vasturiano/react-force-graph)
consumiendo `GET /api/nodes/:label/:id` (devuelve nodo + conexiones).

### Estructura final del proyecto

```
proy2-db2/
├── README.md
├── data-loader/
│   ├── .env                  (credenciales Aura)
│   ├── requirements.txt
│   ├── generate_csv.py
│   ├── load_data.py
│   └── csv/                  (generados por generate_csv.py)
└── backend/
    ├── .env
    ├── package.json
    ├── server.js
    └── src/
        ├── config/schema.js  (whitelist labels y rel types)
        ├── db/neo4j.js       (driver + serializador)
        ├── lib/
        │   ├── async.js      (asyncHandler, HttpError)
        │   └── cypher.js     (buildWhere, removePropsClause)
        └── routes/
            ├── nodes.js
            ├── relationships.js
            ├── analytics.js
            └── csvUpload.js
```
