import { assertPropNames } from '../config/schema.js';

// Construye una clausula WHERE a partir de un objeto plano de filtros.
// Devuelve { where: "n.x = $f_x AND n.y = $f_y", params: { f_x, f_y } }.
export function buildWhere(filter, alias = 'n') {
  const keys = Object.keys(filter || {});
  assertPropNames(keys);
  const params = {};
  const clauses = keys.map((k) => {
    params[`f_${k}`] = filter[k];
    return `${alias}.${k} = $f_${k}`;
  });
  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export const removePropsClause = (props, alias = 'n') =>
  props.map((p) => `${alias}.${p}`).join(', ');
