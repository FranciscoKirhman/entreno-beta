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
/** Una fila anotada (reps es lo que se escribió en la caja) → los campos que se guardan. */
export function camposGuardados(e, r) {
  const u = unidadDe(e);
  return {
    carga_kg: u === 'seg' ? null : r.kg ?? null,
    reps: u === 'reps' ? r.reps ?? null : null,
    duracion_seg: u === 'seg' ? r.reps ?? null : null,
    ...(u === 'm' ? { distancia_m: r.reps ?? null } : {}),
  };
}
