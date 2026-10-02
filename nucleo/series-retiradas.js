import { tipoParaGuardar } from './registro.js';

// Quitar lo que falta de un ejercicio no elimina las series realmente hechas.
export function seriesRetiradas(ejercicio, { hoy, registro = {}, sesiones = [] }) {
  const id = ejercicio.ejercicio_id;
  const filas = registro[hoy]?.[id];
  if (!filas) return structuredClone(sesiones.find(s => s.fecha === hoy && !s.origen)?.series.filter(s => s.ejercicio_id === id) || []);
  return filas.filter(s => s?.hecho).map(s => ({ ejercicio_id: id, ejercicio_nombre: ejercicio.nombre,
    tipo: tipoParaGuardar(s), carga_kg: ejercicio.unidad === 'seg' ? null : s.kg ?? null,
    reps: ejercicio.unidad === 'seg' ? null : s.reps ?? null, duracion_seg: ejercicio.unidad === 'seg' ? s.reps ?? null : null,
    rpe: s.rpe ?? null, rir: s.rir ?? (s.rpe != null ? 10 - s.rpe : null) }));
}
