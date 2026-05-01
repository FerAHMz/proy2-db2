# Frontend — FraudGraph (Vue 3)

UI de gestión sobre el grafo de fraude bancario en Neo4j AuraDB. Cada
operación CRUD requerida por la rúbrica del proyecto está accesible desde
una pantalla, formulario o botón concreto.

## Stack

- Vue 3 + Vite + TypeScript
- Vue Router 4 + Pinia
- Tailwind CSS 3
- `vis-network` (visualización de grafo)
- `chart.js` (analytics)
- `papaparse` (preview de CSV en cliente)
- `axios` (cliente HTTP)

## Setup

Requiere Node 20+.

```bash
cd frontend
npm install
cp .env.example .env   # ajusta VITE_API_BASE si tu backend no está en :4000
npm run dev            # http://localhost:5173
```

El backend debe estar corriendo en la URL configurada por `VITE_API_BASE`
(por defecto `http://localhost:4000`) y aceptar CORS desde
`http://localhost:5173`.

## Cobertura de la rúbrica

| Acción de la rúbrica                                   | Pantalla                          |
|--------------------------------------------------------|-----------------------------------|
| Crear nodo con 1 label                                 | `/nodos/crear` (modo simple)      |
| Crear nodo con 2+ labels                               | `/nodos/crear` (modo segmentado)  |
| Crear nodo con ≥5 propiedades                          | validación en el formulario       |
| Consultar nodos con filtros y mostrar propiedades      | `/nodos/:label`                   |
| Consultar 1 nodo                                       | `/nodos/:label/:id` (ficha)       |
| Consultar muchos nodos                                 | tabla paginada en `/nodos/:label` |
| Realizar consultas agregadas                           | `/dashboard` (8 cards)            |
| Agregar / actualizar 1+ props a un nodo                | ficha → ✎ o + agregar             |
| Agregar / actualizar 1+ props a múltiples nodos        | tabla → ⚙ etiquetar selección     |
| Eliminar 1+ props de un nodo                           | ficha → 🗑 en cada propiedad      |
| Eliminar 1+ props de múltiples nodos                   | tabla → ⌫ limpiar campo           |
| Crear relación (≥3 props) entre 2 nodos                | ficha → ↔ Vincular                |
| Agregar / actualizar props de 1 relación               | ficha → ✎ en la conexión          |
| Agregar / actualizar props de varias relaciones        | `/relaciones` → ⚙                  |
| Eliminar props de 1 relación                           | ficha → × junto a la prop          |
| Eliminar props de varias relaciones                    | `/relaciones` → ⌫                  |
| Eliminar 1 nodo                                        | ficha → 🗑 Eliminar nodo          |
| Eliminar varios nodos                                  | tabla → 🗑 selección o filtro     |
| Eliminar 1 relación                                    | ficha → 🗑 en la conexión         |
| Eliminar varias relaciones                             | `/relaciones` → 🗑                |
| 4–6 consultas Cypher distintas                         | `/dashboard` expone 8             |
| Carga de datos vía CSV                                 | `/csv` (drag-drop + mapeos)       |

## Estructura

```
src/
├── api/              wrappers axios (analytics, nodes, relationships, csv)
├── components/       AppLayout, Modal, PropertyEditor, GraphView, BarChart…
├── lib/              format, props, coerce
├── router/           rutas con lazy-loading
├── stores/           toasts (Pinia)
├── views/            HomeView, DashboardView, NodeListView, NodeDetailView,
│                     NodeCreateView, RelationshipsView, CsvImportView…
└── style.css         Tailwind + componentes utilitarios
```

## Scripts

- `npm run dev`     — servidor de desarrollo Vite
- `npm run build`   — type-check (`vue-tsc`) + build de producción
- `npm run preview` — sirve el build estático
