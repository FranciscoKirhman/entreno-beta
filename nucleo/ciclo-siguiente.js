// Mi plan: lo que la persona deja elegido para su siguiente ciclo (bloque) y el historial de sus músculos prioridad.
// El borrador vive en las respuestas (respuestas.ciclo_siguiente), así viaja con la cuenta y el respaldo como el resto
// del perfil. Se aplica recién al armar el bloque siguiente, que la persona confirma con un botón (AGENTS.md, regla 10).

/** Lo que el borrador puede cambiar del perfil. */
export const CAMPOS_CICLO = ['musculos_prioridad', 'dias_meta', 'duracion_min', 'rotacion', 'cambios_ejercicios'];
const MAX_HISTORIAL = 20;

/** El borrador del siguiente ciclo, solo con sus campos válidos, o null si no hay nada elegido. */
export function borradorCiclo(r) {
  const b = r?.ciclo_siguiente;
  if (!b || typeof b !== 'object') return null;
  const limpio = Object.fromEntries(CAMPOS_CICLO.filter(k => b[k] !== undefined).map(k => [k, structuredClone(b[k])]));
  // Compatibilidad con las copias completas de la primera versión del feed: recuperar solo las decisiones
  // identificables en sus respuestas, nunca reponer el resto de una lista antigua sobre el perfil actual.
  const cambios = {};
  for (const [id, x] of Object.entries(r.preguntas_coach || {}).sort((a, b) => (a[1].fecha || '').localeCompare(b[1].fecha || ''))) {
    if (!id.startsWith('nuevo:')) continue;
    const ejercicio = id.split(':').at(-1);
    if (x.opcion === 'favorito' && b.favoritos?.includes?.(ejercicio)) cambios[ejercicio] = 'favorito';
    if (x.opcion === 'sacar' && b.prohibidos?.includes?.(ejercicio)) cambios[ejercicio] = 'evitar';
  }
  for (const [id, accion] of Object.entries(b.cambios_ejercicios || {})) if (['favorito', 'evitar'].includes(accion)) cambios[id] = accion;
  delete limpio.cambios_ejercicios;
  if (Object.keys(cambios).length) limpio.cambios_ejercicios = cambios;
  return Object.keys(limpio).length ? limpio : null;
}

/** Las respuestas con las que se arma el siguiente ciclo: el perfil con el borrador encima. */
export function respuestasDelCiclo(r) {
  const b = borradorCiclo(r);
  if (!b) return r;
  const { cambios_ejercicios, ...campos } = b;
  const nuevo = { ...r, ...campos };
  if (cambios_ejercicios) {
    const favoritos = new Set(r.favoritos || []), prohibidos = new Set(r.prohibidos || []);
    for (const [id, accion] of Object.entries(cambios_ejercicios)) {
      if (accion === 'favorito') { favoritos.add(id); prohibidos.delete(id); }
      else { prohibidos.add(id); favoritos.delete(id); }
    }
    nuevo.favoritos = [...favoritos]; nuevo.prohibidos = [...prohibidos];
  }
  return nuevo;
}


/** Una decisión por ejercicio: sumar a una lista y quitar de la otra, sobre el perfil que esté vigente. */
export function guardarCambioEjercicio(r, id, accion) {
  const b = { ...(borradorCiclo(r) || {}) }, cambios = { ...b.cambios_ejercicios };
  if (['favorito', 'evitar'].includes(accion)) cambios[id] = accion; else delete cambios[id];
  if (Object.keys(cambios).length) b.cambios_ejercicios = cambios; else delete b.cambios_ejercicios;
  const nuevo = { ...r };
  if (Object.keys(b).length) nuevo.ciclo_siguiente = b; else delete nuevo.ciclo_siguiente;
  return nuevo;
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
  const aplicado = respuestasDelCiclo({ ...nuevo, ciclo_siguiente: b });
  delete aplicado.ciclo_siguiente;
  return aplicado;
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

/**
 * Quita del borrador los campos que se acaban de cambiar por otro camino (el chat con proponer_requisitos): lo más
 * nuevo manda y el borrador no lo vuelve a pisar en el siguiente ciclo.
 * @returns nuevas respuestas
 */
export function quitarDelBorrador(r, campos) {
  const b = borradorCiclo(r);
  if (!b) return r;
  for (const k of campos) delete b[k];
  if (campos.some(k => ['favoritos', 'prohibidos'].includes(k))) delete b.cambios_ejercicios;
  const nuevo = { ...r };
  if (Object.keys(b).length) nuevo.ciclo_siguiente = b; else delete nuevo.ciclo_siguiente;
  return nuevo;
}

const sumar = (f, n) => new Date(Date.parse(f + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
/** El lunes en que parte el bloque siguiente: el primero después del último día del plan. */
export function inicioDelSiguiente(plan) {
  const fin = (plan?.dias || []).map(d => d.fecha).sort().at(-1);
  if (!fin) return null;
  const dia = sumar(fin, 1);
  return sumar(dia, (8 - new Date(dia + 'T12:00:00Z').getUTCDay()) % 7);
}

/** Para la IA (ver_resumen): lo que la persona ya eligió para su siguiente bloque y cuándo parte, o null. */
export function cicloParaIA(r, plan) {
  const b = borradorCiclo(r);
  if (!b) return null;
  return { parte: inicioDelSiguiente(plan), cambios: b, nota: 'Elegido por la persona en Mi plan; se aplica al armar el siguiente bloque.' };
}
