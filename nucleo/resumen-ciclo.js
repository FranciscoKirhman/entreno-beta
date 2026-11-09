import { borradorCiclo, respuestasDelCiclo } from './ciclo-siguiente.js';

/** Cambios pendientes contra el perfil vigente, sin aplicar ni copiar listas antiguas. */
export function cambiosDelBorrador(respuestas) {
  const b = borradorCiclo(respuestas) || {}, despues = respuestasDelCiclo(respuestas);
  return Object.keys(b).flatMap(campo => campo === 'cambios_ejercicios'
    ? Object.keys(b.cambios_ejercicios).map(id => ({ campo, id,
      antes: respuestas.prohibidos?.includes(id) ? 'evitar' : respuestas.favoritos?.includes(id) ? 'favorito' : 'sin_preferencia',
      despues: despues.prohibidos?.includes(id) ? 'evitar' : despues.favoritos?.includes(id) ? 'favorito' : 'sin_preferencia' }))
    : [{ campo, antes: structuredClone(respuestas[campo]), despues: structuredClone(despues[campo]) }]);
}

/** No confundir las sesiones que quedan del bloque anterior (semana cero) con la primera semana nueva. */
export function primeraSemanaDelBloque(plan) {
  const dias = (plan?.dias || []).filter(d => d.semana >= 1);
  const primera = Math.min(...dias.map(d => d.semana));
  return dias.filter(d => d.semana === primera);
}

export function compararInicioBloques(antes, despues) {
  const resumen = p => {
    const dias = primeraSemanaDelBloque(p), ejercicios = dias.flatMap(d => d.ejercicios || []);
    return { sesiones: dias.length, series: ejercicios.reduce((n, e) => n + (Number(e.series) || 0), 0), ejercicios: [...new Set(ejercicios.map(e => e.ejercicio_id).filter(Boolean))] };
  };
  const a = resumen(antes), b = resumen(despues);
  return { antes: a, despues: b, entran: b.ejercicios.filter(id => !a.ejercicios.includes(id)), salen: a.ejercicios.filter(id => !b.ejercicios.includes(id)) };
}
