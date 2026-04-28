import { badRequest } from '../lib/async.js';

export const NODE_LABELS = Object.freeze({
  Cliente: { idField: 'cliente_id' },
  Cuenta: { idField: 'cuenta_id' },
  Tarjeta: { idField: 'tarjeta_id' },
  Transaccion: { idField: 'transaccion_id' },
  Dispositivo: { idField: 'dispositivo_id' },
  Ubicacion: { idField: 'ubicacion_id' },
  Comercio: { idField: 'comercio_id' },
  AlertaFraude: { idField: 'alerta_id' },
});

export const SECONDARY_LABELS = new Set([
  'VIP', 'Riesgo',
  'CuentaIndividual', 'CuentaCorporativa', 'CuentaVIP',
]);

export const REL_TYPES = new Set([
  'POSEE', 'TIENE_TARJETA', 'ORIGEN', 'DESTINO',
  'USANDO', 'DESDE', 'EN', 'USADA_EN', 'GENERA', 'GENERADA_POR',
]);

const PROP_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export const idFieldFor = (label) => NODE_LABELS[label].idField;

export function assertLabel(label) {
  if (!NODE_LABELS[label]) throw badRequest(`Label invalida: ${label}`);
}

export function assertSecondaryLabel(label) {
  if (!SECONDARY_LABELS.has(label)) throw badRequest(`Label secundaria invalida: ${label}`);
}

export function assertRelType(type) {
  if (!REL_TYPES.has(type)) throw badRequest(`Tipo de relacion invalido: ${type}`);
}

export function assertPropName(name) {
  if (!PROP_NAME_RE.test(name)) throw badRequest(`Nombre de propiedad invalido: ${name}`);
}

export function assertPropNames(names) {
  for (const n of names) assertPropName(n);
}
