// Mi plan: lo que la persona deja elegido para su siguiente ciclo (bloque) y el historial de sus músculos prioridad.
// El borrador vive en las respuestas (respuestas.ciclo_siguiente), así viaja con la cuenta y el respaldo como el resto
// del perfil. Se aplica recién al armar el bloque siguiente, que la persona confirma con un botón (AGENTS.md, regla 10).

/** Lo que el borrador puede cambiar del perfil. */
export const CAMPOS_CICLO = ['musculos_prioridad', 'dias_meta', 'duracion_min', 'rotacion'];
const MAX_HISTORIAL = 20;

/** El borrador del siguiente ciclo, solo con sus campos válidos, o null si no hay nada elegido. */
export function borradorCiclo(r) {
  const b = r?.ciclo_siguiente;
  if (!b || typeof b !== 'object') return null;
  const limpio = Object.fromEntries(CAMPOS_CICLO.filter(k => b[k] !== undefined).map(k => [k, structuredClone(b[k])]));
  return Object.keys(limpio).length ? limpio : null;
}

/** Las respuestas con las que se arma el siguiente ciclo: el perfil con el borrador encima. */
export function respuestasDelCiclo(r) {
  const b = borradorCiclo(r);
  return b ? { ...r, ...b } : r;
}

const igualLista = (a = [], b = []) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

/** Una entrada del historial de prioridades, o null si no cambió nada. `desde`: 'ciclo' o 'semana'. */
export function cambioPrioridades(antes = [], despues = [], { fecha, desde = 'ciclo' }) {
  if (igualLista(antes, despues)) return null;
  return { fecha, antes: [...antes], despues: [...despues], desde };
}

/** El historial con la entrada nueva primero (las últimas 20). */
export function anotarCambio(historial = [], entrada) {
  return entrada ? [entrada, ...historial].slice(0, MAX_HISTORIAL) : historial;
}

/**
 * Guarda en el borrador lo elegido para el siguiente ciclo. Un valor igual al del perfil se quita del borrador
 * (no hay cambio pendiente); si no queda nada, el borrador desaparece.
 * @returns nuevas respuestas (no modifica las recibidas)
 */
export function guardarEnBorrador(r, cambios) {
  const b = { ...(borradorCiclo(r) || {}) };
  for (const [k, v] of Object.entries(cambios)) {
    if (!CAMPOS_CICLO.includes(k)) continue;
    const igual = Array.isArray(v) ? igualLista(r[k], v) : String(r[k] ?? '') === String(v ?? '');
    if (igual || v == null) delete b[k]; else b[k] = structuredClone(v);
  }
  const nuevo = { ...r };
  if (Object.keys(b).length) nuevo.ciclo_siguiente = b; else delete nuevo.ciclo_siguiente;
  return nuevo;
}

/**
 * Al armar el bloque siguiente: el borrador pasa al perfil y se borra. Si cambiaron las prioridades, queda anotado.
 * @returns nuevas respuestas
 */
export function aplicarBorrador(r, fecha) {
  const b = borradorCiclo(r);
  const nuevo = { ...r };
  delete nuevo.ciclo_siguiente;
  if (!b) return nuevo;
  if (b.musculos_prioridad) {
    nuevo.historial_prioridades = anotarCambio(r.historial_prioridades, cambioPrioridades(r.musculos_prioridad, b.musculos_prioridad, { fecha, desde: 'ciclo' }));
  }
  return { ...nuevo, ...b };
}

/**
 * Cambia los ejercicios del plan actual desde una fecha, con los de un plan nuevo armado con otras prioridades.
 * Las fechas, los días movidos y lo anterior a `desde` quedan igual: cada día toma los ejercicios del día del plan
 * nuevo con la misma plantilla en la misma semana del bloque (la descarga, de la descarga). Un día sin pareja queda
 * como estaba.
 * @returns {{ plan, cambiados: number }}
 */
export function semanasDesde(actual, nuevo, desde) {
  const plan = structuredClone(actual);
  const descargaNueva = nuevo.semana_descarga;
  const ultimaNormal = Math.max(1, (descargaNueva || (nuevo.semanas || 1) + 1) - 1);
  const semanaNueva = w => (w === actual.semana_descarga && descargaNueva ? descargaNueva : Math.min(w, ultimaNormal));
  let cambiados = 0;
  for (const d of plan.dias) {
    if (d.fecha < desde || !d.semana || !d.ejercicios?.length) continue;
    const w = semanaNueva(d.semana);
    const par = nuevo.dias.find(x => x.semana === w && x.plantilla && x.plantilla === d.plantilla);
    if (!par) continue;
    d.ejercicios = structuredClone(par.ejercicios);
    if (par.foco) d.foco = par.foco;
    cambiados++;
  }
  return { plan, cambiados };
}
