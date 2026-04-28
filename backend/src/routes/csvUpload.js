import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import fs from 'node:fs/promises';
import { write } from '../db/neo4j.js';
import {
  assertLabel,
  assertRelType,
  assertPropName,
  idFieldFor,
} from '../config/schema.js';
import { asyncHandler, badRequest } from '../lib/async.js';

const router = Router();
const upload = multer({ dest: 'uploads/', limits: { fileSize: 10 * 1024 * 1024 } });

const TRUTHY = new Set(['true', '1', 'yes', 'si']);

const TYPE_COERCERS = {
  string: (v) => String(v),
  integer: (v) => parseInt(v, 10),
  float: (v) => parseFloat(v),
  boolean: (v) => TRUTHY.has(String(v).toLowerCase()),
  date: (v) => v,
  datetime: (v) => v,
  list: (v) => String(v).split(';').filter(Boolean),
};

const SAFE_LABEL_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

const safeUnlink = async (path) => {
  try { await fs.unlink(path); } catch { /* archivo ya borrado */ }
};

function applyMappings(row, mappings) {
  const out = {};
  for (const [col, spec] of Object.entries(mappings)) {
    const prop = spec.property || col;
    assertPropName(prop);
    const raw = row[col];
    if (raw === undefined || raw === '') continue;
    const coerce = TYPE_COERCERS[spec.type] ?? TYPE_COERCERS.string;
    out[prop] = coerce(raw);
  }
  return out;
}

function buildSetClause(mappings, alias = 'n') {
  return Object.values(mappings).map((spec) => {
    const prop = spec.property;
    assertPropName(prop);
    if (spec.type === 'date') {
      return `${alias}.${prop} = CASE WHEN row.${prop} IS NULL THEN NULL ELSE date(row.${prop}) END`;
    }
    if (spec.type === 'datetime') {
      return `${alias}.${prop} = CASE WHEN row.${prop} IS NULL THEN NULL ELSE datetime(row.${prop}) END`;
    }
    return `${alias}.${prop} = row.${prop}`;
  }).join(',\n');
}

const parseCsvFile = async (filePath) => {
  const text = await fs.readFile(filePath, 'utf-8');
  return parse(text, { columns: true, skip_empty_lines: true });
};

const loadNodes = async (rows, config, mappings) => {
  const { label, matchKey, secondaryLabels = [] } = config;
  assertLabel(label);
  if (!matchKey) throw badRequest('matchKey es requerido para nodos');
  assertPropName(matchKey);
  for (const l of secondaryLabels) {
    if (!SAFE_LABEL_RE.test(l)) throw badRequest(`Label invalida: ${l}`);
  }

  const allLabels = [label, ...secondaryLabels].join(':');
  const cypher = `
    UNWIND $rows AS row
    MERGE (n:${label} { ${matchKey}: row.${matchKey} })
    SET n:${allLabels}
    SET ${buildSetClause(mappings, 'n')}
    RETURN count(n) AS upserted
  `;
  return (await write(cypher, { rows }))[0];
};

const loadRelationships = async (rows, config, mappings) => {
  const { type, fromLabel, fromKey, toLabel, toKey } = config;
  assertRelType(type);
  assertLabel(fromLabel);
  assertLabel(toLabel);
  if (!fromKey || !toKey) throw badRequest('fromKey y toKey son requeridos');
  assertPropName(fromKey);
  assertPropName(toKey);

  const cypher = `
    UNWIND $rows AS row
    MATCH (a:${fromLabel} { ${idFieldFor(fromLabel)}: row.${fromKey} })
    MATCH (b:${toLabel}   { ${idFieldFor(toLabel)}:   row.${toKey}   })
    MERGE (a)-[r:${type}]->(b)
    SET ${buildSetClause(mappings, 'r')}
    RETURN count(r) AS upserted
  `;
  return (await write(cypher, { rows }))[0];
};

router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('Archivo CSV requerido (campo "file")');
  const filePath = req.file.path;

  try {
    const config = JSON.parse(req.body.config || '{}');
    const { mode, mappings = {} } = config;
    if (!['nodes', 'relationships'].includes(mode)) {
      throw badRequest("mode debe ser 'nodes' o 'relationships'");
    }
    Object.values(mappings).forEach((m) => assertPropName(m.property));

    const records = await parseCsvFile(filePath);
    const rows = records.map((r) => applyMappings(r, mappings));

    const result = mode === 'nodes'
      ? await loadNodes(rows, config, mappings)
      : await loadRelationships(rows, config, mappings);

    res.json({ rows_in_csv: rows.length, ...result });
  } finally {
    await safeUnlink(filePath);
  }
}));

export default router;
