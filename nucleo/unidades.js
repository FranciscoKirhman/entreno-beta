// Unidad de una prescripción: repeticiones (lo normal), segundos (isométricos como la plancha) o metros (transporte
// con peso, como la caminata del granjero). reps_min y reps_max van en esa unidad; al guardar, los segundos van en
// duracion_seg y los metros en distancia_m.
/** Los de patrón "transporte" del catálogo (nucleo/catalogo.test.js revisa que calcen): sus filas sin terminar
 *  traen metros en reps. */
export const POR_DISTANCIA = new Set(['caminata_granjero']);
export const unidadDe = e => (e?.unidad === 'seg' ? 'seg' : e?.unidad === 'm' ? 'm' : 'reps');
/** " s", " m" o nada, para escribir "3 × 30 a 45 s" o "3 × 20 a 40 m". */
export const sufijo = e => ({ seg: ' s', m: ' m', reps: '' })[unidadDe(e)];
export const porReps = e => unidadDe(e) === 'reps';
// Cardio en la tabla de series, como Hevy: la escaladora se anota en pisos y tiempo ("Stair Machine (Floors)"; los
// pisos van en reps, igual que en Hevy) y la trotadora, la caminata y el trote en km y tiempo. En la fila, dist son
// los pisos o los km y seg el tiempo en segundos.
export const CARDIO_PISOS = new Set(['escaladora']);
export const CARDIO_KM = new Set(['trotadora', 'caminata', 'caminata_inclinada', 'trote']);
export const modoCardio = e => (CARDIO_PISOS.has(e?.ejercicio_id) ? 'pisos' : CARDIO_KM.has(e?.ejercicio_id) ? 'km' : null);

/** "15:00", "1:05:00": segundos como reloj, para el campo de tiempo y lo anterior. */
export function relojTexto(seg) {
  if (seg == null || seg === '' || !Number.isFinite(Number(seg))) return '';
  const s = Math.round(Number(seg)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
}
/**
 * El campo de tiempo de Hevy: los números entran desde la derecha ("1", "15", "150", "1500" → 0:01, 0:15, 1:50,
 * 15:00). Devuelve el texto a mostrar y los segundos (los segundos de más de 59 se suman: 0:90 son 90 s).
 */
export function leerReloj(texto) {
  const d = String(texto ?? '').replace(/\D/g, '').replace(/^0+/, '').slice(-6);
  if (!d) return { texto: '', seg: null };
  const p = d.padStart(6, '0'), h = Number(p.slice(0, 2)), m = Number(p.slice(2, 4)), s = Number(p.slice(4));
  const seg = h * 3600 + m * 60 + s;
  return { texto: h ? `${h}:${p.slice(2, 4)}:${p.slice(4)}` : `${m}:${p.slice(4)}`, seg };
}

/** Una fila anotada (reps es lo que se escribió en la caja) → los campos que se guardan. */
export function camposGuardados(e, r) {
  const cardio = modoCardio(e);
  if (cardio) return { carga_kg: null, reps: cardio === 'pisos' ? r.dist ?? null : null, duracion_seg: r.seg ?? null,
    ...(cardio === 'km' && r.dist != null ? { distancia_m: Math.round(r.dist * 1000) } : {}) };
  const u = unidadDe(e);
  return {
    carga_kg: u === 'seg' ? null : r.kg ?? null,
    reps: u === 'reps' ? r.reps ?? null : null,
    duracion_seg: u === 'seg' ? r.reps ?? null : null,
    ...(u === 'm' ? { distancia_m: r.reps ?? null } : {}),
  };
}
