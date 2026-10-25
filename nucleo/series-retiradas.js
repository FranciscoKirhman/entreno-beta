import { tipoParaGuardar } from './registro.js';
import { camposGuardados } from './unidades.js';

// Quitar lo que falta de un ejercicio no elimina las series realmente hechas.
export function seriesRetiradas(ejercicio, { hoy, registro = {}, sesiones = [] }) {
  const id = ejercicio.ejercicio_id;
  const filas = registro[hoy]?.[id];
  if (!filas) return structuredClone(sesiones.find(s => s.fecha === hoy && !s.origen)?.series.filter(s => s.ejercicio_id === id) || []);
  return filas.filter(s => s?.hecho).map(s => ({ ejercicio_id: id, ejercicio_nombre: ejercicio.nombre,
    tipo: tipoParaGuardar(s), ...camposGuardados(ejercicio, s),
    rpe: s.rpe ?? null, rir: s.rir ?? (s.rpe != null ? 10 - s.rpe : null) }));
}

/**
 * Cualquier cambio del plan (reemplazar solo hoy, Ajustar hoy, el coach) que saca de una sesión en curso un ejercicio
 * con series hechas las deja en retirados[fecha][id], como Quitar: se guardan al terminar. Antes, reemplazar un
 * ejercicio ya empezado las perdía (25 de octubre). Devuelve retirados nuevo; no toca lo que recibe.
 */
export function retiradosAlCambiar(anterior, nuevo, { registro = {}, sesiones = [], retirados = {} }) {
  const r = structuredClone(retirados);
  for (const [fecha, porId] of Object.entries(registro)) {
    const antes = anterior?.dias?.find(d => d.fecha === fecha);
    if (!antes) continue;
    const quedan = new Set(nuevo?.dias?.find(d => d.fecha === fecha)?.ejercicios.map(e => e.ejercicio_id) || []);
    for (const e of antes.ejercicios) {
      const id = e.ejercicio_id;
      if (!id || quedan.has(id) || r[fecha]?.[id] || !(porId?.[id] || []).some(s => s?.hecho)) continue;
      (r[fecha] ||= {})[id] = { ejercicio: structuredClone(e), series: seriesRetiradas(e, { hoy: fecha, registro, sesiones }) };
    }
  }
  return r;
}
