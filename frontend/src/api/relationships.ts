import { api } from './client'
import type { RelType } from './schema'
import type { NodeData } from './nodes'

export interface RelEndpoint {
  label: string
  id: string
}

export interface RelData {
  relId: string
  type: RelType | string
  props: Record<string, unknown>
  a: NodeData
  b: NodeData
  labelsA: string[]
  labelsB: string[]
}

export interface RelListResponse {
  count: number
  items: RelData[]
}

export const relationshipsApi = {
  list: async (type: RelType, limit = 50): Promise<RelListResponse> => {
    const { data } = await api.get<RelListResponse>(`/api/relationships/${type}`, {
      params: { limit },
    })
    return data
  },
  create: async (
    from: RelEndpoint,
    to: RelEndpoint,
    type: RelType,
    properties: Record<string, unknown>,
  ) => {
    const { data } = await api.post(`/api/relationships`, { from, to, type, properties })
    return data
  },
  patchProps: async (
    type: RelType | string,
    from: RelEndpoint,
    to: RelEndpoint,
    properties: Record<string, unknown>,
  ) => {
    const { data } = await api.patch(`/api/relationships/${type}/properties`, {
      from, to, properties,
    })
    return data
  },
  patchPropsBulk: async (
    type: RelType,
    filter: Record<string, string>,
    properties: Record<string, unknown>,
  ) => {
    const { data } = await api.patch<{ updated: number }>(
      `/api/relationships/${type}/bulk-properties`,
      { filter, properties },
    )
    return data
  },
  removeProps: async (
    type: RelType | string,
    from: RelEndpoint,
    to: RelEndpoint,
    properties: string[],
  ) => {
    const { data } = await api.delete(`/api/relationships/${type}/properties`, {
      data: { from, to, properties },
    })
    return data
  },
  removePropsBulk: async (type: RelType, filter: Record<string, string>, properties: string[]) => {
    const { data } = await api.delete<{ updated: number }>(
      `/api/relationships/${type}/bulk-properties`,
      { data: { filter, properties } },
    )
    return data
  },
  delete: async (type: RelType | string, from: RelEndpoint, to: RelEndpoint) => {
    const { data } = await api.delete<{ deleted: number }>(`/api/relationships/${type}`, {
      data: { from, to },
    })
    return data
  },
  deleteBulk: async (type: RelType, filter: Record<string, string>) => {
    const { data } = await api.delete<{ deleted: number }>(`/api/relationships/${type}/bulk`, {
      data: { filter },
    })
    return data
  },
}
