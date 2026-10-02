// Ficha de un ejercicio: cómo se hace (contenido/tecnica.json) y tus mejores marcas en él. La explicación de por qué
// está en tu plan sale de explicar.js y las alternativas de checkin.js.
import { e1rm } from './motor-plan.js';

/** Cómo se hace: {pasos, ojo} del ejercicio o, si no tiene propios, los de su patrón de movimiento. */
export function tecnicaDe(ej, tecnica) {
  let t = tecnica.ejercicios?.[ej.id];
  for (let i = 0; typeof t === 'string' && i < 5; i++) t = tecnica.ejercicios[t];
  return (t && typeof t === 'object' ? t : tecnica.patrones?.[ej.patron]) || { pasos: [], ojo: [] };
}

/**
 * Tus marcas en un ejercicio, con las series anotadas (semanal.seriesAnotadas).
 * @param asistido el peso es la ayuda de la máquina: devuelve menorAyuda en vez de la serie más pesada y el máximo estimado
 * @returns {{veces, ultima: {fecha, series}, pesada: {carga_kg, reps, fecha}, mejor: {carga_kg, reps, fecha, estimado}, reps: {reps, fecha}} | null}
 *   pesada: la serie con más peso; mejor: la de mayor 1RM estimado (Epley); reps: más repeticiones (sin peso o con segundos).
 */
export function marcas(series, ejercicioId, { asistido = false } = {}) {
  const mias = series.filter(s => s.ejercicio_id === ejercicioId && (s.reps != null || s.carga_kg != null));
  if (!mias.length) return null;
  const fechas = [...new Set(mias.map(s => s.fecha))].sort();
  const ultima = fechas.at(-1);
  if (asistido) {
    // El peso es la ayuda de la máquina: la mejor marca es la menor ayuda (con más repeticiones, si empatan).
    const conAyuda = mias.filter(s => Number(s.carga_kg) > 0 && Number(s.reps) > 0);
    const menor = conAyuda.length ? conAyuda.reduce((a, s) => (Number(s.carga_kg) < Number(a.carga_kg) || (Number(s.carga_kg) === Number(a.carga_kg) && Number(s.reps) > Number(a.reps)) ? s : a)) : null;
    const masReps = mias.filter(s => Number(s.reps) > 0);
    const reps = masReps.length ? masReps.reduce((a, s) => (Number(s.reps) > Number(a.reps) ? s : a)) : null;
    return {
      veces: fechas.length, asistido: true,
      ultima: { fecha: ultima, series: mias.filter(s => s.fecha === ultima) },
      menorAyuda: menor && { carga_kg: menor.carga_kg, reps: menor.reps, fecha: menor.fecha },
      reps: reps && { reps: reps.reps, fecha: reps.fecha },
    };
  }
  const conPeso = mias.filter(s => Number(s.carga_kg) > 0 && Number(s.reps) > 0);
  const maxPor = (xs, f) => xs.reduce((a, s) => (f(s) > f(a) ? s : a));
  const pesada = conPeso.length ? maxPor(conPeso, s => Number(s.carga_kg) * 1000 + Number(s.reps)) : null;
  const mejor = conPeso.length ? maxPor(conPeso, e1rm) : null;
  const masReps = mias.filter(s => Number(s.reps) > 0);
  const reps = masReps.length ? maxPor(masReps, s => Number(s.reps)) : null;
  const corto = s => s && { carga_kg: s.carga_kg, reps: s.reps, fecha: s.fecha };
  return {
    veces: fechas.length,
    ultima: { fecha: ultima, series: mias.filter(s => s.fecha === ultima) },
    pesada: corto(pesada),
    mejor: mejor && { ...corto(mejor), estimado: Math.round(e1rm(mejor) * 2) / 2 },
    reps: reps && { reps: reps.reps, fecha: reps.fecha },
  };
}
