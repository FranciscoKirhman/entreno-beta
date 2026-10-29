// La unidad, la etiqueta de demo y cómo se anota (RPE o RIR, mancuernas de a una o el par) no cambian el plan: al
// llegar de la cuenta no deben marcar el perfil como cambiado. JSON de servidor puede ordenar las claves de otra manera.
export function firmaPerfil(respuestas) {
  if (typeof respuestas === 'string') { try { respuestas = JSON.parse(respuestas); } catch { return null; } }
  if (!respuestas || typeof respuestas !== 'object' || Array.isArray(respuestas)) return null;
  const { unidad, demo_privada, escala_esfuerzo, mancuernas, ...plan } = respuestas;
  const ordenar = x => Array.isArray(x) ? x.map(ordenar) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, ordenar(x[k])])) : x;
  return JSON.stringify(ordenar(plan));
}
