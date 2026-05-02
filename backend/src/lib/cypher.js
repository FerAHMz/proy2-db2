import { assertPropNames } from '../config/schema.js';

// Construye una clausula WHERE a partir de un objeto plano de filtros.
// Usa toString() en ambos lados para que el filtro funcione sin importar
// el tipo (string, integer, float, boolean) — el frontend envia strings
// desde inputs y el DB puede tener int/bool/etc. Sin esta coercion el
// filtro retorna 0 silenciosamente cuando los tipos no coinciden.
// Devuelve { where: "toString(n.x) = toString($f_x) AND ...", params: { f_x, f_y } }.
export function buildWhere(filter, alias = 'n') {
  const keys = Object.keys(filter || {});
  assertPropNames(keys);
  const params = {};
  const clauses = keys.map((k) => {
    params[`f_${k}`] = filter[k];
    return `toString(${alias}.${k}) = toString($f_${k})`;
  });
  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export const removePropsClause = (props, alias = 'n') =>
  props.map((p) => `${alias}.${p}`).join(', ');
