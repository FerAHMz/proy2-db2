import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { closeDriver, verifyConnection, read } from './src/db/neo4j.js';
import nodesRouter from './src/routes/nodes.js';
import relationshipsRouter from './src/routes/relationships.js';
import analyticsRouter from './src/routes/analytics.js';
import csvUploadRouter from './src/routes/csvUpload.js';
import { asyncHandler } from './src/lib/async.js';

const PORT = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '*')
  .split(',').map((s) => s.trim()).filter(Boolean);

const ENDPOINT_INDEX = [
  'GET    /api/health',
  'GET    /api/nodes/labels',
  'POST   /api/nodes/single-label                  body: {label, properties}',
  'POST   /api/nodes/multi-label                   body: {labels[], properties}',
  'GET    /api/nodes/:label?limit=&skip=&where=    list with filters',
  'GET    /api/nodes/:label/:id                    single node + connections',
  'PATCH  /api/nodes/:label/:id/properties         add/update props on 1 node',
  'PATCH  /api/nodes/:label/properties             add/update props on many nodes',
  'DELETE /api/nodes/:label/:id/properties         remove props from 1 node',
  'DELETE /api/nodes/:label/properties             remove props from many nodes',
  'PATCH  /api/nodes/:label/:id/labels             add/remove secondary labels',
  'DELETE /api/nodes/:label/:id                    delete 1 node (DETACH)',
  'DELETE /api/nodes/:label                        delete many nodes by ids/filter',
  'POST   /api/relationships                       create rel with props',
  'GET    /api/relationships/:type                 list rels of type',
  'GET    /api/relationships/:type/find            find specific rel',
  'PATCH  /api/relationships/:type/properties      props on 1 rel',
  'PATCH  /api/relationships/:type/bulk-properties props on many rels',
  'DELETE /api/relationships/:type/properties      remove props on 1 rel',
  'DELETE /api/relationships/:type/bulk-properties remove props on many rels',
  'DELETE /api/relationships/:type                 delete 1 rel',
  'DELETE /api/relationships/:type/bulk            delete many rels by filter',
  'GET    /api/analytics/top-clientes-monto',
  'GET    /api/analytics/transacciones-por-canal',
  'GET    /api/analytics/transacciones-pais-riesgo',
  'GET    /api/analytics/anillos-sospechosos',
  'GET    /api/analytics/dispositivos-compartidos',
  'GET    /api/analytics/comercios-con-alertas',
  'GET    /api/analytics/path-clientes',
  'GET    /api/analytics/resumen-grafo',
  'GET    /api/analytics/grafo                     ?limit&label= subgrafo conexo',
  'POST   /api/csv/upload                          multipart: file + config',
];

const buildCorsOptions = () => {
  const wildcard = CORS_ORIGINS.length === 1 && CORS_ORIGINS[0] === '*';
  return { origin: wildcard ? true : CORS_ORIGINS };
};

const app = express();
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '10mb' }));

app.get('/api', (_req, res) => {
  res.json({ name: 'Fraude Neo4j API', endpoints: ENDPOINT_INDEX });
});

app.get('/api/health', asyncHandler(async (_req, res) => {
  const rows = await read('RETURN 1 AS ok', {});
  res.json({ status: 'ok', neo4j: rows[0]?.ok === 1 });
}));

app.use('/api/nodes', nodesRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/csv', csvUploadRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[ERROR]', err);
  res.status(status).json({ error: err.message || 'Internal server error', code: err.code });
});

const start = async () => {
  await verifyConnection();
  app.listen(PORT, () => {
    console.log(`API escuchando en http://localhost:${PORT}`);
    console.log(`CORS origins: ${CORS_ORIGINS.join(', ')}`);
  });
};

const shutdown = async (signal) => {
  console.log(`\nRecibido ${signal}, cerrando driver...`);
  await closeDriver();
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch((err) => {
  console.error('Fallo al iniciar:', err);
  process.exit(1);
});
