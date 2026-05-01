import { api } from './client'

export interface HealthResponse {
  status: 'ok' | string
  neo4j: boolean
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>('/api/health')
  return data
}
