import { api } from './client'
import type { PrimaryLabel, RelType, SecondaryLabel } from './schema'

export type PropValue = string | number | boolean | null | string[] | number[]

export interface NodeData {
  _id: string
  labels: string[]
  properties: Record<string, PropValue>
}

export interface NodeListItem {
  n: NodeData
  labels: string[]
  elementId: string
}

export interface NodeListResponse {
  count: number
  items: NodeListItem[]
}

export interface NodeConnection {
  rel: RelType | string
  props: Record<string, PropValue>
  other: NodeData
  otherLabels: string[]
}

export interface NodeDetailResponse {
  n: NodeData
  labels: string[]
  connections: NodeConnection[]
}

export interface LabelsResponse {
  primary: PrimaryLabel[]
  secondary: SecondaryLabel[]
}

export interface ListParams {
  limit?: number
  skip?: number
  /** filter as { key: value } -> serialized as where=k:v,k:v */
  where?: Record<string, string>
}

const serializeWhere = (where?: Record<string, string>) => {
  if (!where) return ''
  const parts = Object.entries(where)
    .filter(([, v]) => v !== '' && v != null)
    .map(([k, v]) => `${k}:${v}`)
  return parts.join(',')
}

export const nodesApi = {
  labels: async (): Promise<LabelsResponse> => {
    const { data } = await api.get<LabelsResponse>('/api/nodes/labels')
    return data
  },
  list: async (label: string, params: ListParams = {}): Promise<NodeListResponse> => {
    const where = serializeWhere(params.where)
    const { data } = await api.get<NodeListResponse>(`/api/nodes/${label}`, {
      params: {
        limit: params.limit ?? 50,
        skip: params.skip ?? 0,
        ...(where ? { where } : {}),
      },
    })
    return data
  },
  get: async (label: string, id: string): Promise<NodeDetailResponse> => {
    const { data } = await api.get<NodeDetailResponse>(`/api/nodes/${label}/${encodeURIComponent(id)}`)
    return data
  },
  createSingle: async (label: string, properties: Record<string, unknown>): Promise<NodeDetailResponse> => {
    const { data } = await api.post(`/api/nodes/single-label`, { label, properties })
    return data
  },
  createMulti: async (labels: string[], properties: Record<string, unknown>): Promise<NodeDetailResponse> => {
    const { data } = await api.post(`/api/nodes/multi-label`, { labels, properties })
    return data
  },
  patchProps: async (label: string, id: string, properties: Record<string, unknown>) => {
    const { data } = await api.patch(`/api/nodes/${label}/${encodeURIComponent(id)}/properties`, { properties })
    return data
  },
  patchPropsBulk: async (label: string, filter: Record<string, string>, properties: Record<string, unknown>) => {
    const { data } = await api.patch<{ updated: number }>(`/api/nodes/${label}/properties`, { filter, properties })
    return data
  },
  removeProps: async (label: string, id: string, properties: string[]) => {
    const { data } = await api.delete(`/api/nodes/${label}/${encodeURIComponent(id)}/properties`, { data: { properties } })
    return data
  },
  removePropsBulk: async (label: string, filter: Record<string, string>, properties: string[]) => {
    const { data } = await api.delete<{ updated: number }>(`/api/nodes/${label}/properties`, { data: { filter, properties } })
    return data
  },
  updateLabels: async (label: string, id: string, add: string[] = [], remove: string[] = []) => {
    const { data } = await api.patch(`/api/nodes/${label}/${encodeURIComponent(id)}/labels`, { add, remove })
    return data
  },
  delete: async (label: string, id: string) => {
    const { data } = await api.delete<{ deleted: number }>(`/api/nodes/${label}/${encodeURIComponent(id)}`)
    return data
  },
  deleteBulk: async (label: string, body: { ids?: string[]; filter?: Record<string, string> }) => {
    const { data } = await api.delete<{ deleted: number }>(`/api/nodes/${label}`, { data: body })
    return data
  },
}
