import { api } from './client'

export interface HealthResponse {
  status: 'ok' | string
  neo4j: boolean
}

export interface ApiIndex {
  name: string
  endpoints: string[]
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/api/health')
  return data
}

export async function getApiIndex(): Promise<ApiIndex> {
  const { data } = await api.get<ApiIndex>('/api')
  return data
}
