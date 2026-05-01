import type { PropValue } from '@/api/nodes'

export function formatPropValue(v: PropValue | unknown): string {
  if (v == null) return '—'
  if (Array.isArray(v)) return v.length ? v.join(', ') : '[]'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  return String(v)
}

export function detectType(v: unknown): string {
  if (v == null) return 'null'
  if (Array.isArray(v)) return 'list'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'float'
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return 'datetime'
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date'
    return 'string'
  }
  return typeof v
}

/** Pick column keys from a list of nodes for the table header. */
export function pickColumns(items: { properties: Record<string, unknown> }[], idField: string, max = 6): string[] {
  const seen = new Set<string>()
  const cols: string[] = [idField]
  seen.add(idField)
  for (const it of items) {
    for (const k of Object.keys(it.properties || {})) {
      if (seen.has(k)) continue
      seen.add(k)
      cols.push(k)
      if (cols.length >= max) return cols
    }
  }
  return cols
}
