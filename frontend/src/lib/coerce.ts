import type { PropType } from '@/api/schema'

export interface PropEntry {
  name: string
  type: PropType
  value: string
}

export function coerceValue(type: PropType, raw: string): unknown {
  const v = raw ?? ''
  switch (type) {
    case 'string':
      return v
    case 'integer': {
      const n = parseInt(v, 10)
      if (Number.isNaN(n)) throw new Error(`Valor inválido para integer: "${v}"`)
      return n
    }
    case 'float': {
      const n = parseFloat(v)
      if (Number.isNaN(n)) throw new Error(`Valor inválido para float: "${v}"`)
      return n
    }
    case 'boolean':
      return v === 'true' || v === '1'
    case 'date':
    case 'datetime':
      if (!v) throw new Error(`${type} requiere un valor`)
      return v
    case 'list':
      return v.split(',').map((s) => s.trim()).filter(Boolean)
    default:
      return v
  }
}

export function entriesToObject(entries: PropEntry[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {}
  for (const e of entries) {
    if (!e.name) continue
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(e.name)) {
      throw new Error(`Nombre de propiedad inválido: "${e.name}"`)
    }
    obj[e.name] = coerceValue(e.type, e.value)
  }
  return obj
}

export function defaultEntry(): PropEntry {
  return { name: '', type: 'string', value: '' }
}
