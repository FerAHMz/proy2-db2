import neo4j from 'neo4j-driver';
import 'dotenv/config';

const URI = process.env.NEO4J_URI;
const USER = process.env.NEO4J_USERNAME;
const PASSWORD = process.env.NEO4J_PASSWORD;
export const DATABASE = process.env.NEO4J_DATABASE || 'neo4j';

if (!URI || !USER || !PASSWORD) {
  console.error('Faltan variables NEO4J_* en .env');
  process.exit(1);
}

export const driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD), {
  maxConnectionLifetime: 60 * 60 * 1000,
});

export async function verifyConnection() {
  await driver.verifyConnectivity();
  console.log(`[Neo4j] Conectado a ${URI} (db=${DATABASE})`);
}

const isTemporal = (v) =>
  neo4j.isDate?.(v) ||
  neo4j.isDateTime?.(v) ||
  neo4j.isLocalDateTime?.(v) ||
  neo4j.isTime?.(v) ||
  neo4j.isLocalTime?.(v) ||
  neo4j.isDuration?.(v);

const isNode = (v) => v && v.labels && v.properties;
const isRelationship = (v) => v && v.type && v.start !== undefined && v.end !== undefined;
const isPath = (v) => v && Array.isArray(v.segments);

// Convierte tipos del driver Neo4j a primitivas/JSON serializables.
export function toPlain(value) {
  if (value === null || value === undefined) return value;
  if (neo4j.isInt(value)) return value.toNumber();
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value !== 'object') return value;
  if (isTemporal(value)) return value.toString();
  if (isNode(value)) {
    return {
      _id: value.elementId ?? value.identity?.toString(),
      labels: value.labels,
      properties: toPlain(value.properties),
    };
  }
  if (isRelationship(value)) {
    return {
      _id: value.elementId ?? value.identity?.toString(),
      type: value.type,
      startId: value.startNodeElementId ?? value.start?.toString(),
      endId: value.endNodeElementId ?? value.end?.toString(),
      properties: toPlain(value.properties),
    };
  }
  if (isPath(value)) {
    return {
      start: toPlain(value.start),
      end: toPlain(value.end),
      segments: value.segments.map((s) => ({
        start: toPlain(s.start),
        relationship: toPlain(s.relationship),
        end: toPlain(s.end),
      })),
    };
  }
  const out = {};
  for (const k of Object.keys(value)) out[k] = toPlain(value[k]);
  return out;
}

const recordToObject = (record) => {
  const obj = {};
  for (const key of record.keys) obj[key] = toPlain(record.get(key));
  return obj;
};

export async function run(cypher, params = {}, accessMode = 'WRITE') {
  const session = driver.session({
    database: DATABASE,
    defaultAccessMode: accessMode === 'READ' ? neo4j.session.READ : neo4j.session.WRITE,
  });
  try {
    const res = await session.run(cypher, params);
    return res.records.map(recordToObject);
  } finally {
    await session.close();
  }
}

export const read = (cypher, params) => run(cypher, params, 'READ');
export const write = (cypher, params) => run(cypher, params, 'WRITE');

export async function closeDriver() {
  await driver.close();
}
