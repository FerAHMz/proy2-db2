import { Router } from 'express';
import { read, write } from '../db/neo4j.js';
import {
  assertLabel,
  assertRelType,
  assertPropName,
  assertPropNames,
  idFieldFor,
} from '../config/schema.js';
import { asyncHandler, badRequest, notFound } from '../lib/async.js';
import { buildWhere, removePropsClause } from '../lib/cypher.js';

const router = Router();

const requireEndpoint = (e, name) => {
  if (!e?.label || !e?.id) throw badRequest(`${name}{label,id} es requerido`);
  assertLabel(e.label);
};

router.post('/', asyncHandler(async (req, res) => {
  const { from, to, type, properties = {} } = req.body;
  if (!type) throw badRequest('type es requerido');
  requireEndpoint(from, 'from');
  requireEndpoint(to, 'to');
  assertRelType(type);
  assertPropNames(Object.keys(properties));

  const rows = await write(
    `
      MATCH (a:${from.label} {${idFieldFor(from.label)}: $fromId})
      MATCH (b:${to.label}   {${idFieldFor(to.label)}:   $toId})
      MERGE (a)-[r:${type}]->(b)
      SET r += $props
      RETURN a, r, b, type(r) AS type
    `,
    { fromId: from.id, toId: to.id, props: properties },
  );
  if (!rows.length) throw notFound('Nodo origen o destino no existe');
  res.status(201).json(rows[0]);
}));

router.get('/:type', asyncHandler(async (req, res) => {
  const { type } = req.params;
  assertRelType(type);
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);

  const rows = await read(
    `
      MATCH (a)-[r:${type}]->(b)
      RETURN elementId(r) AS relId,
             type(r) AS type,
             properties(r) AS props,
             a, b,
             labels(a) AS labelsA,
             labels(b) AS labelsB
      LIMIT toInteger($limit)
    `,
    { limit },
  );
  res.json({ count: rows.length, items: rows });
}));

router.get('/:type/find', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { fromLabel, fromId, toLabel, toId } = req.query;
  assertRelType(type);
  assertLabel(fromLabel);
  assertLabel(toLabel);

  const rows = await read(
    `
      MATCH (a:${fromLabel} {${idFieldFor(fromLabel)}: $fromId})
            -[r:${type}]->
            (b:${toLabel} {${idFieldFor(toLabel)}: $toId})
      RETURN elementId(r) AS relId, type(r) AS type, properties(r) AS props
    `,
    { fromId, toId },
  );
  if (!rows.length) throw notFound();
  res.json(rows[0]);
}));

router.patch('/:type/properties', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { from, to, properties } = req.body;
  assertRelType(type);
  requireEndpoint(from, 'from');
  requireEndpoint(to, 'to');
  if (!properties) throw badRequest('properties es requerido');
  assertPropNames(Object.keys(properties));

  const rows = await write(
    `
      MATCH (a:${from.label} {${idFieldFor(from.label)}: $fromId})
            -[r:${type}]->
            (b:${to.label} {${idFieldFor(to.label)}: $toId})
      SET r += $props
      RETURN r, type(r) AS type, properties(r) AS props
    `,
    { fromId: from.id, toId: to.id, props: properties },
  );
  if (!rows.length) throw notFound('Relacion no encontrada');
  res.json(rows[0]);
}));

router.patch('/:type/bulk-properties', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { filter = {}, properties } = req.body;
  assertRelType(type);
  if (!properties) throw badRequest('properties es requerido');
  assertPropNames(Object.keys(properties));

  const { where, params } = buildWhere(filter, 'r');
  const rows = await write(
    `
      MATCH ()-[r:${type}]->()
      ${where}
      SET r += $props
      RETURN count(r) AS updated
    `,
    { ...params, props: properties },
  );
  res.json(rows[0]);
}));

router.delete('/:type/properties', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { from, to, properties } = req.body;
  assertRelType(type);
  requireEndpoint(from, 'from');
  requireEndpoint(to, 'to');
  if (!Array.isArray(properties) || !properties.length) {
    throw badRequest('properties debe ser un array no vacio');
  }
  assertPropNames(properties);

  const rows = await write(
    `
      MATCH (a:${from.label} {${idFieldFor(from.label)}: $fromId})
            -[r:${type}]->
            (b:${to.label} {${idFieldFor(to.label)}: $toId})
      REMOVE ${removePropsClause(properties, 'r')}
      RETURN r, properties(r) AS props
    `,
    { fromId: from.id, toId: to.id },
  );
  if (!rows.length) throw notFound('Relacion no encontrada');
  res.json(rows[0]);
}));

router.delete('/:type/bulk-properties', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { filter = {}, properties } = req.body;
  assertRelType(type);
  if (!Array.isArray(properties) || !properties.length) {
    throw badRequest('properties debe ser un array no vacio');
  }
  assertPropNames(properties);

  const { where, params } = buildWhere(filter, 'r');
  const rows = await write(
    `
      MATCH ()-[r:${type}]->()
      ${where}
      REMOVE ${removePropsClause(properties, 'r')}
      RETURN count(r) AS updated
    `,
    params,
  );
  res.json(rows[0]);
}));

router.delete('/:type', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { from, to } = req.body || {};
  assertRelType(type);
  requireEndpoint(from, 'from');
  requireEndpoint(to, 'to');

  const rows = await write(
    `
      MATCH (a:${from.label} {${idFieldFor(from.label)}: $fromId})
            -[r:${type}]->
            (b:${to.label} {${idFieldFor(to.label)}: $toId})
      DELETE r
      RETURN count(r) AS deleted
    `,
    { fromId: from.id, toId: to.id },
  );
  res.json(rows[0]);
}));

router.delete('/:type/bulk', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const { filter = {} } = req.body || {};
  assertRelType(type);

  const { where, params } = buildWhere(filter, 'r');
  if (!where) throw badRequest('filter no puede estar vacio (proteccion)');

  const rows = await write(
    `
      MATCH ()-[r:${type}]->()
      ${where}
      DELETE r
      RETURN count(r) AS deleted
    `,
    params,
  );
  res.json(rows[0]);
}));

export default router;
