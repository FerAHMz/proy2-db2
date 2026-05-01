import { api } from './client'
import type { PrimaryLabel, PropType, RelType, SecondaryLabel } from './schema'

export interface CsvMapping {
  property: string
  type: PropType
}

export interface CsvNodesConfig {
  mode: 'nodes'
  label: PrimaryLabel
  matchKey: string
  secondaryLabels?: SecondaryLabel[]
  mappings: Record<string, CsvMapping>
}

export interface CsvRelationshipsConfig {
  mode: 'relationships'
  type: RelType
  fromLabel: PrimaryLabel
  fromKey: string
  toLabel: PrimaryLabel
  toKey: string
  mappings: Record<string, CsvMapping>
}

export type CsvConfig = CsvNodesConfig | CsvRelationshipsConfig

export interface CsvUploadResult {
  rows_in_csv: number
  upserted: number
}

export async function uploadCsv(file: File, config: CsvConfig): Promise<CsvUploadResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('config', JSON.stringify(config))
  const { data } = await api.post<CsvUploadResult>('/api/csv/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}
