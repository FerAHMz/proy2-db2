import { Router } from 'express';
import { read } from '../db/neo4j.js';
import { asyncHandler, badRequest } from '../lib/async.js';

const router = Router();

const Q_TOP_CLIENTES_MONTO = `
  MATCH (c:Cliente)-[:POSEE]->(:Cuenta)-[:ORIGEN]->(t:Transaccion)
  WHERE t.estado = 'completada'
  RETURN c.cliente_id AS cliente_id,
         c.nombre AS nombre,
         c.pais AS pais,
         count(t) AS num_transacciones,
         round(sum(t.monto), 2) AS monto_total,
         round(avg(t.monto), 2) AS monto_promedio
  ORDER BY monto_total DESC
  LIMIT toInteger($limit)
`;

const Q_TX_POR_CANAL = `
  MATCH (t:Transaccion)
  RETURN t.canal AS canal,
         t.estado AS estado,
         count(*) AS total,
         round(sum(t.monto), 2) AS monto_total,
         round(avg(t.score_risk), 3) AS score_promedio
  ORDER BY canal, estado
`;

const Q_TX_PAIS_RIESGO = `
  MATCH (t:Transaccion)-[:DESDE]->(u:Ubicacion)
  WHERE u.is_high_risk_country = true
  OPTIONAL MATCH (cuenta:Cuenta)-[:ORIGEN]->(t)
  OPTIONAL MATCH (cli:Cliente)-[:POSEE]->(cuenta)
  RETURN u.country AS pais,
         count(t) AS transacciones,
         round(sum(t.monto), 2) AS monto_total,
         round(avg(t.score_risk), 3) AS score_riesgo_promedio,
         collect(DISTINCT cli.cliente_id)[..5] AS clientes_muestra
  ORDER BY monto_total DESC
`;

const Q_ANILLOS = `
  MATCH (c1:Cuenta)-[:ORIGEN]->(t1:Transaccion)-[:DESTINO]->(c2:Cuenta),
        (c2)-[:ORIGEN]->(t2:Transaccion)-[:DESTINO]->(c1)
  WHERE t1.monto > $minMonto AND t2.monto > $minMonto
    AND t1.transaccion_id <> t2.transaccion_id
  RETURN c1.cuenta_id AS cuenta_a,
         c2.cuenta_id AS cuenta_b,
         collect({tx: t1.transaccion_id, monto: t1.monto, fecha: toString(t1.fecha_hora)})[..3] AS ida,
         collect({tx: t2.transaccion_id, monto: t2.monto, fecha: toString(t2.fecha_hora)})[..3] AS regreso,
         round(sum(t1.monto + t2.monto), 2) AS volumen_total
  ORDER BY volumen_total DESC
  LIMIT 25
`;

const Q_DISP_COMPARTIDOS = `
  MATCH (cli:Cliente)-[:POSEE]->(:Cuenta)-[:ORIGEN]->(t:Transaccion)-[:USANDO]->(d:Dispositivo)
  WITH d, collect(DISTINCT cli.cliente_id) AS clientes
  WHERE size(clientes) >= toInteger($min)
  RETURN d.dispositivo_id AS dispositivo,
         d.tipo AS tipo,
         d.sistema_op AS sistema_op,
         size(clientes) AS num_clientes,
         clientes[..10] AS clientes_muestra
  ORDER BY num_clientes DESC
  LIMIT 50
`;

const Q_RESUMEN_NODOS = `
  MATCH (n)
  UNWIND labels(n) AS label
  RETURN label, count(*) AS total
  ORDER BY total DESC
`;

const Q_RESUMEN_RELS = `
  MATCH ()-[r]->()
  RETURN type(r) AS tipo, count(*) AS total
  ORDER BY total DESC
`;

const Q_RESUMEN_TOTALES = `
  CALL { MATCH (n) RETURN count(n) AS nodos }
  CALL { MATCH ()-[r]->() RETURN count(r) AS relaciones }
  RETURN nodos, relaciones
`;

const Q_COMERCIOS_ALERTAS = `
  MATCH (a:AlertaFraude)-[:GENERADA_POR]->(t:Transaccion)-[:EN]->(c:Comercio)
  RETURN c.comercio_id AS comercio_id,
         c.name AS nombre,
         c.category AS categoria,
         c.country AS pais,
         count(DISTINCT a) AS num_alertas,
         round(avg(a.score_riesgo), 3) AS score_promedio,
         collect(DISTINCT a.severidad) AS severidades
  ORDER BY num_alertas DESC
  LIMIT 20
`;

router.get('/top-clientes-monto', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
  const rows = await read(Q_TOP_CLIENTES_MONTO, { limit });
  res.json({ count: rows.length, items: rows });
}));

router.get('/transacciones-por-canal', asyncHandler(async (_req, res) => {
  const rows = await read(Q_TX_POR_CANAL, {});
  res.json({ count: rows.length, items: rows });
}));

router.get('/transacciones-pais-riesgo', asyncHandler(async (_req, res) => {
  const rows = await read(Q_TX_PAIS_RIESGO, {});
  res.json({ count: rows.length, items: rows });
}));

router.get('/anillos-sospechosos', asyncHandler(async (req, res) => {
  const minMonto = parseFloat(req.query.min_monto || '500');
  const rows = await read(Q_ANILLOS, { minMonto });
  res.json({ count: rows.length, items: rows });
}));

router.get('/dispositivos-compartidos', asyncHandler(async (req, res) => {
  const min = parseInt(req.query.min_clientes || '2', 10);
  const rows = await read(Q_DISP_COMPARTIDOS, { min });
  res.json({ count: rows.length, items: rows });
}));

router.get('/comercios-con-alertas', asyncHandler(async (_req, res) => {
  const rows = await read(Q_COMERCIOS_ALERTAS, {});
  res.json({ count: rows.length, items: rows });
}));

router.get('/grafo', asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '150', 10), 1500);
  const label = req.query.label;
  const seedLabel = label || 'Transaccion';

  // BFS iterativo desde un nodo seed. Hace varias rondas hasta alcanzar el
  // limite pedido o agotar el componente conexo. Cada ronda es un single
  // round-trip con IN $ids, asi que es rapido aun en grafos medianos.
  const seedRows = await read(
    `MATCH (n:${seedLabel}) RETURN elementId(n) AS id LIMIT 1`,
    {},
  );
  if (!seedRows.length) {
    return res.json({ node_count: 0, edge_count: 0, nodes: [], edges: [] });
  }
  const seedId = seedRows[0].id;

  const visited = new Set([seedId]);
  let frontier = [seedId];
  const MAX_ROUNDS = 12;
  for (let r = 0; r < MAX_ROUNDS && frontier.length && visited.size < limit; r++) {
    const rows = await read(
      `MATCH (n)-[]-(m) WHERE elementId(n) IN $ids
       RETURN collect(DISTINCT elementId(m)) AS next`,
      { ids: frontier },
    );
    const next = rows[0]?.next || [];
    const room = limit - visited.size;
    const newOnes = [];
    for (const id of next) {
      if (!visited.has(id)) {
        visited.add(id);
        newOnes.push(id);
        if (visited.size >= limit) break;
      }
    }
    frontier = newOnes;
    if (newOnes.length < room) {
      // Frontera agotada antes del limite; no quedan nodos alcanzables.
      if (newOnes.length === 0) break;
    }
  }

  const nodeIds = Array.from(visited);
  const data = await read(
    `MATCH (n) WHERE elementId(n) IN $ids
     WITH collect(n) AS nodes
     UNWIND nodes AS n
     OPTIONAL MATCH (n)-[r]->(m) WHERE m IN nodes
     WITH nodes, collect(DISTINCT r) AS rels
     RETURN nodes, [e IN rels WHERE e IS NOT NULL] AS edges`,
    { ids: nodeIds },
  );
  const out = data[0] || { nodes: [], edges: [] };
  res.json({
    node_count: out.nodes.length,
    edge_count: out.edges.length,
    nodes: out.nodes,
    edges: out.edges,
  });
}));

router.get('/resumen-grafo', asyncHandler(async (_req, res) => {
  const [labels, rels, totales] = await Promise.all([
    read(Q_RESUMEN_NODOS, {}),
    read(Q_RESUMEN_RELS, {}),
    read(Q_RESUMEN_TOTALES, {}),
  ]);
  res.json({
    totales: totales[0] || {},
    por_label: labels,
    por_relacion: rels,
  });
}));

// shortestPath con max profundidad: la profundidad va inline porque Cypher
// no admite parametrizar el limite del patron de longitud variable.
router.get('/path-clientes', asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) throw badRequest('from y to son requeridos');
  const max = Math.min(parseInt(req.query.max || '4', 10), 6);

  const rows = await read(
    `
      MATCH p = shortestPath(
        (a:Cliente {cliente_id: $from})-[*..${max}]-(b:Cliente {cliente_id: $to})
      )
      RETURN p, length(p) AS distancia
    `,
    { from, to },
  );
  res.json(rows[0] || { path: null, distancia: null });
}));

export default router;
