import { Router } from 'express';
import { read, write } from '../db/neo4j.js';
import {
  NODE_LABELS,
  SECONDARY_LABELS,
  assertLabel,
  assertSecondaryLabel,
  assertPropName,
  assertPropNames,
  idFieldFor,
} from '../config/schema.js';
import { asyncHandler, badRequest, notFound } from '../lib/async.js';
import { buildWhere, removePropsClause } from '../lib/cypher.js';

const router = Router();

const requireObject = (value, name) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(`${name} es requerido`);
  }
};

const requireNonEmptyArray = (value, name) => {
  if (!Array.isArray(value) || value.length === 0) {
    throw badRequest(`${name} debe ser un array no vacio`);
  }
};

router.get('/labels', (_req, res) => {
  res.json({
    primary: Object.keys(NODE_LABELS),
    secondary: [...SECONDARY_LABELS],
  });
});

router.post('/single-label', asyncHandler(async (req, res) => {
  const { label, properties } = req.body;
  assertLabel(label);
  requireObject(properties, 'properties');
  assertPropNames(Object.keys(properties));

  const rows = await write(
    `CREATE (n:${label} $props) RETURN n`,
    { props: properties },
  );
  res.status(201).json(rows[0]);
}));

router.post('/multi-label', asyncHandler(async (req, res) => {
  const { labels, properties = {} } = req.body;
  if (!Array.isArray(labels) || labels.length < 2) {
    throw badRequest('Se requieren al menos 2 labels');
  }
  // primera = primaria, resto = secundarias permitidas
  assertLabel(labels[0]);
  labels.slice(1).forEach(assertSecondaryLabel);
  assertPropNames(Object.keys(properties));

  const rows = await write(
    `CREATE (n:${labels.join(':')} $props) RETURN n, labels(n) AS labels`,
    { props: properties },
  );
  res.status(201).json(rows[0]);
}));

const parseWhereParam = (raw) => {
  const filter = {};
  if (!raw) return filter;
  for (const part of String(raw).split(',')) {
    const [k, ...rest] = part.split(':');
    if (!k || rest.length === 0) continue;
    assertPropName(k);
    filter[k] = rest.join(':');
  }
  return filter;
};

router.get('/:label', asyncHandler(async (req, res) => {
  const { label } = req.params;
  assertLabel(label);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  const skip = parseInt(req.query.skip || '0', 10);
  const filter = parseWhereParam(req.query.where);

  // toString() coercion: query string siempre llega como texto.
  const params = { skip, limit };
  const clauses = Object.keys(filter).map((k) => {
    params[`f_${k}`] = filter[k];
    return `toString(n.${k}) = $f_${k}`;
  });
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

  const rows = await read(
    `
      MATCH (n:${label})
      ${where}
      RETURN n, labels(n) AS labels, elementId(n) AS elementId
      SKIP toInteger($skip) LIMIT toInteger($limit)
    `,
    params,
  );
  res.json({ count: rows.length, items: rows });
}));

router.get('/:label/:id', asyncHandler(async (req, res) => {
  const { label, id } = req.params;
  assertLabel(label);
  const idField = idFieldFor(label);

  const rows = await read(
    `
      MATCH (n:${label} {${idField}: $id})
      OPTIONAL MATCH (n)-[r]-(m)
      WITH n, r, m
      WHERE r IS NOT NULL OR m IS NULL
      RETURN n,
             labels(n) AS labels,
             [x IN collect(
               CASE WHEN r IS NULL THEN NULL
                    ELSE { rel: type(r), props: properties(r), other: m, otherLabels: labels(m) }
               END
             ) WHERE x IS NOT NULL] AS connections
    `,
    { id },
  );
  if (!rows.length) throw notFound();
  res.json(rows[0]);
}));

router.patch('/:label/:id/properties', asyncHandler(async (req, res) => {
  const { label, id } = req.params;
  const { properties } = req.body;
  assertLabel(label);
  requireObject(properties, 'properties');
  assertPropNames(Object.keys(properties));

  const rows = await write(
    `
      MATCH (n:${label} {${idFieldFor(label)}: $id})
      SET n += $props
      RETURN n, labels(n) AS labels
    `,
    { id, props: properties },
  );
  if (!rows.length) throw notFound();
  res.json(rows[0]);
}));

router.patch('/:label/properties', asyncHandler(async (req, res) => {
  const { label } = req.params;
  const { filter = {}, properties } = req.body;
  assertLabel(label);
  requireObject(properties, 'properties');
  assertPropNames(Object.keys(properties));

  const { where, params } = buildWhere(filter);
  const rows = await write(
    `
      MATCH (n:${label})
      ${where}
      SET n += $props
      RETURN count(n) AS updated
    `,
    { ...params, props: properties },
  );
  res.json(rows[0]);
}));

router.delete('/:label/:id/properties', asyncHandler(async (req, res) => {
  const { label, id } = req.params;
  const { properties } = req.body;
  assertLabel(label);
  requireNonEmptyArray(properties, 'properties');
  assertPropNames(properties);

  const rows = await write(
    `
      MATCH (n:${label} {${idFieldFor(label)}: $id})
      REMOVE ${removePropsClause(properties)}
      RETURN n
    `,
    { id },
  );
  if (!rows.length) throw notFound();
  res.json(rows[0]);
}));

router.delete('/:label/properties', asyncHandler(async (req, res) => {
  const { label } = req.params;
  const { filter = {}, properties } = req.body;
  assertLabel(label);
  requireNonEmptyArray(properties, 'properties');
  assertPropNames(properties);

  const { where, params } = buildWhere(filter);
  const rows = await write(
    `
      MATCH (n:${label})
      ${where}
      REMOVE ${removePropsClause(properties)}
      RETURN count(n) AS updated
    `,
    params,
  );
  res.json(rows[0]);
}));

router.patch('/:label/:id/labels', asyncHandler(async (req, res) => {
  const { label, id } = req.params;
  const { add = [], remove = [] } = req.body;
  assertLabel(label);
  add.forEach(assertSecondaryLabel);
  remove.forEach(assertSecondaryLabel);

  const cypher = [
    `MATCH (n:${label} {${idFieldFor(label)}: $id})`,
    add.length ? `SET n:${add.join(':')}` : null,
    remove.length ? `REMOVE n:${remove.join(':')}` : null,
    `RETURN n, labels(n) AS labels`,
  ].filter(Boolean).join('\n');

  const rows = await write(cypher, { id });
  if (!rows.length) throw notFound();
  res.json(rows[0]);
}));

router.delete('/:label/:id', asyncHandler(async (req, res) => {
  const { label, id } = req.params;
  assertLabel(label);
  const rows = await write(
    `
      MATCH (n:${label} {${idFieldFor(label)}: $id})
      DETACH DELETE n
      RETURN count(n) AS deleted
    `,
    { id },
  );
  res.json(rows[0]);
}));

router.delete('/:label', asyncHandler(async (req, res) => {
  const { label } = req.params;
  const { ids, filter = {} } = req.body || {};
  assertLabel(label);
  const idField = idFieldFor(label);

  const conditions = [];
  const params = {};

  if (Array.isArray(ids) && ids.length) {
    conditions.push(`n.${idField} IN $ids`);
    params.ids = ids;
  }
  const { where, params: filterParams } = buildWhere(filter);
  if (where) {
    conditions.push(where.replace(/^WHERE\s*/, ''));
    Object.assign(params, filterParams);
  }
  if (!conditions.length) throw badRequest('Se requiere ids o filter');

  const rows = await write(
    `
      MATCH (n:${label})
      WHERE ${conditions.join(' AND ')}
      DETACH DELETE n
      RETURN count(n) AS deleted
    `,
    params,
  );
  res.json(rows[0]);
}));

export default router;
