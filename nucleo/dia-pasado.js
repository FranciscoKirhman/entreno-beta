// Anotar un día pasado o corregir una sesión ya guardada, como en Hevy. Se trabaja sobre un borrador:
//   { fecha, titulo, duracion_min, comentario, id?, ejercicios: [{ ejercicio_id, nombre, unidad, series: [{ kg, reps, rir, tipo }] }] }
// kg va siempre en kilos; en las series por tiempo, reps son segundos. Al guardar se arma la sesión con el mismo
// formato que guarda Hoy, así el historial, los récords, el resumen y la cuenta la tratan igual.

const vacia = () => ({ kg: null, reps: null, rir: null, tipo: 'efectiva' });

/** Un borrador nuevo para una fecha: con los ejercicios del plan de ese día (series vacías), o vacío. */
export function borradorNuevo(fecha, dia = null) {
  return {
    fecha, titulo: dia?.foco || 'Sesión', duracion_min: null, comentario: '',
    ejercicios: (dia?.ejercicios || []).filter(e => e.ejercicio_id).map(e => ({
      ejercicio_id: e.ejercicio_id, nombre: e.nombre, unidad: e.unidad === 'seg' ? 'seg' : 'reps',
      plan: { series: e.series, reps_min: e.reps_min, reps_max: e.reps_max, rir: e.rir, carga_kg: e.carga_kg ?? null },
      series: Array.from({ length: e.series || 1 }, vacia),
    })),
  };
}

/** Una sesión guardada en el teléfono → borrador para corregirla. */
export function borradorDeSesion(s, indice) {
  const ejercicios = [];
  for (const x of s.series || []) {
    const clave = x.ejercicio_id || x.ejercicio_nombre;
    let g = ejercicios.find(e => (e.ejercicio_id || e.nombre) === clave);
    if (!g) ejercicios.push(g = { ejercicio_id: x.ejercicio_id || null, nombre: x.ejercicio_nombre || indice?.porId.get(x.ejercicio_id)?.nombre || 'Ejercicio', unidad: x.duracion_seg != null && x.reps == null ? 'seg' : 'reps', series: [] });
    g.series.push({ kg: x.carga_kg ?? null, reps: g.unidad === 'seg' ? x.duracion_seg ?? null : x.reps ?? null, rir: x.rir ?? (x.rpe != null ? Math.max(0, 10 - x.rpe) : null), tipo: x.tipo || 'efectiva', distancia_m: x.distancia_m });
  }
  return { id: s.id, fecha: s.fecha, hora: s.hora, titulo: s.titulo || 'Sesión', duracion_min: s.duracion_min ?? null, comentario: s.comentario || '', notas: s.notas || [], ejercicios };
}

export const nuevaSerie = vacia;

/** Las series para guardar: solo las que traen repeticiones o segundos, en el formato de Hoy. */
export function seriesDelBorrador(b) {
  const out = [];
  let orden = 0;
  for (const e of b.ejercicios) {
    for (const s of e.series) {
      if (!(Number(s.reps) > 0)) continue;
      const seg = e.unidad === 'seg';
      const rir = s.tipo === 'fallo' ? 0 : s.rir ?? null;
      out.push({ orden: orden++, ejercicio_id: e.ejercicio_id, ejercicio_nombre: e.nombre, tipo: s.tipo || 'efectiva',
        carga_kg: seg ? null : s.kg ?? null, reps: seg ? null : Number(s.reps), duracion_seg: seg ? Number(s.reps) : null,
        rpe: rir == null ? null : 10 - rir, rir, ...(s.distancia_m ? { distancia_m: s.distancia_m } : {}) });
    }
  }
  return out;
}

/** Qué falta para poder guardar, o null. */
export function problemaBorrador(b, hoy) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.fecha || '')) return 'Elige la fecha.';
  if (b.fecha > hoy) return 'No se puede anotar un día que todavía no llega.';
  if (!seriesDelBorrador(b).length) return 'Anota al menos una serie con repeticiones o segundos.';
  return null;
}

/** La sesión lista para guardar (mantiene el id si se está corrigiendo). */
export function sesionDelBorrador(b, nuevoId) {
  const n = Number(b.duracion_min);
  return { id: b.id || nuevoId, fecha: b.fecha, hora: b.hora || null, // sin hora inventada: la cuenta usa mediodía
    titulo: (b.titulo || '').trim() || 'Sesión',
    duracion_min: n > 0 ? Math.round(n) : null, comentario: (b.comentario || '').trim() || null, series: seriesDelBorrador(b), notas: b.notas || [] };
}
