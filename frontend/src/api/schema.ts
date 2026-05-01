export const PRIMARY_LABELS = [
  'Cliente',
  'Cuenta',
  'Tarjeta',
  'Transaccion',
  'Dispositivo',
  'Ubicacion',
  'Comercio',
  'AlertaFraude',
] as const

export type PrimaryLabel = (typeof PRIMARY_LABELS)[number]

export const SECONDARY_LABELS = [
  'VIP',
  'Riesgo',
  'CuentaIndividual',
  'CuentaCorporativa',
  'CuentaVIP',
] as const

export type SecondaryLabel = (typeof SECONDARY_LABELS)[number]

export const ALLOWED_SECONDARIES: Record<PrimaryLabel, SecondaryLabel[]> = {
  Cliente: ['VIP', 'Riesgo'],
  Cuenta: ['CuentaIndividual', 'CuentaCorporativa', 'CuentaVIP'],
  Tarjeta: [],
  Transaccion: [],
  Dispositivo: [],
  Ubicacion: [],
  Comercio: [],
  AlertaFraude: [],
}

export const ID_FIELD: Record<PrimaryLabel, string> = {
  Cliente: 'cliente_id',
  Cuenta: 'cuenta_id',
  Tarjeta: 'tarjeta_id',
  Transaccion: 'transaccion_id',
  Dispositivo: 'dispositivo_id',
  Ubicacion: 'ubicacion_id',
  Comercio: 'comercio_id',
  AlertaFraude: 'alerta_id',
}

export const REL_TYPES = [
  'POSEE',
  'TIENE_TARJETA',
  'ORIGEN',
  'DESTINO',
  'USANDO',
  'DESDE',
  'EN',
  'USADA_EN',
  'GENERA',
  'GENERADA_POR',
] as const

export type RelType = (typeof REL_TYPES)[number]

export const PROP_TYPES = [
  'string',
  'integer',
  'float',
  'boolean',
  'date',
  'datetime',
  'list',
] as const

export type PropType = (typeof PROP_TYPES)[number]
