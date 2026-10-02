// La unidad y la etiqueta de demo no cambian el plan. JSON de servidor puede ordenar las claves de otra manera.
export function firmaPerfil(respuestas) {
  if (typeof respuestas === 'string') { try { respuestas = JSON.parse(respuestas); } catch { return null; } }
  if (!respuestas || typeof respuestas !== 'object' || Array.isArray(respuestas)) return null;
  const { unidad, demo_privada, ...plan } = respuestas;
  const ordenar = x => Array.isArray(x) ? x.map(ordenar) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, ordenar(x[k])])) : x;
  return JSON.stringify(ordenar(plan));
}
