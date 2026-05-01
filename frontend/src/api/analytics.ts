import { api } from './client'

export interface ListResponse<T> {
  count: number
  items: T[]
}

export interface TopClienteMonto {
  cliente_id: string
  nombre: string
  pais: string
  num_transacciones: number
  monto_total: number
  monto_promedio: number
}

export interface TxPorCanal {
  canal: string
  estado: string
  total: number
  monto_total: number
  score_promedio: number
}

export interface TxPaisRiesgo {
  pais: string
  transacciones: number
  monto_total: number
  score_riesgo_promedio: number
  clientes_muestra: string[]
}

export interface AnilloSospechoso {
  cuenta_a: string
  cuenta_b: string
  ida: { tx: string; monto: number; fecha: string }[]
  regreso: { tx: string; monto: number; fecha: string }[]
  volumen_total: number
}

export interface DispositivoCompartido {
  dispositivo: string
  tipo: string
  sistema_op: string
  num_clientes: number
  clientes_muestra: string[]
}

export interface ComercioConAlertas {
  comercio_id: string
  nombre: string
  categoria: string
  pais: string
  num_alertas: number
  score_promedio: number
  severidades: string[]
}

export interface ResumenGrafo {
  totales: { nodos?: number; relaciones?: number }
  por_label: { label: string; total: number }[]
  por_relacion: { tipo: string; total: number }[]
}

export interface PathSegment {
  start: { _id: string; labels: string[]; properties: Record<string, unknown> }
  relationship: { _id: string; type: string; properties: Record<string, unknown> }
  end: { _id: string; labels: string[]; properties: Record<string, unknown> }
}

export interface PathClientes {
  p?: { start: PathSegment['start']; end: PathSegment['end']; segments: PathSegment[] } | null
  distancia: number | null
}

export const analyticsApi = {
  topClientesMonto: async (limit = 10) => {
    const { data } = await api.get<ListResponse<TopClienteMonto>>(
      '/api/analytics/top-clientes-monto',
      { params: { limit } },
    )
    return data
  },
  txPorCanal: async () => {
    const { data } = await api.get<ListResponse<TxPorCanal>>(
      '/api/analytics/transacciones-por-canal',
    )
    return data
  },
  txPaisRiesgo: async () => {
    const { data } = await api.get<ListResponse<TxPaisRiesgo>>(
      '/api/analytics/transacciones-pais-riesgo',
    )
    return data
  },
  anillosSospechosos: async (minMonto = 500) => {
    const { data } = await api.get<ListResponse<AnilloSospechoso>>(
      '/api/analytics/anillos-sospechosos',
      { params: { min_monto: minMonto } },
    )
    return data
  },
  dispositivosCompartidos: async (minClientes = 2) => {
    const { data } = await api.get<ListResponse<DispositivoCompartido>>(
      '/api/analytics/dispositivos-compartidos',
      { params: { min_clientes: minClientes } },
    )
    return data
  },
  comerciosConAlertas: async () => {
    const { data } = await api.get<ListResponse<ComercioConAlertas>>(
      '/api/analytics/comercios-con-alertas',
    )
    return data
  },
  resumenGrafo: async () => {
    const { data } = await api.get<ResumenGrafo>('/api/analytics/resumen-grafo')
    return data
  },
  pathClientes: async (from: string, to: string, max = 4) => {
    const { data } = await api.get<PathClientes>('/api/analytics/path-clientes', {
      params: { from, to, max },
    })
    return data
  },
}
