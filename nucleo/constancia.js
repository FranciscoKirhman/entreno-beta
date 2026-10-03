// Constancia, como Hevy y el tablero: qué días entrenaste, cuántas veces por semana, la racha de semanas seguidas con
// al menos un entrenamiento y cuántos días van desde el último. Cuenta días, no sesiones: dos sesiones el mismo día
// son un día entrenado.
import { sumarDias, diaSemana } from './agenda.js';

const lunesDe = iso => sumarDias(iso, -((diaSemana(iso) + 6) % 7));
const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

/**
 * @param fechas  días con al menos una serie de trabajo ('AAAA-MM-DD'; se aceptan repetidas)
 * @param semanas cuántas semanas muestra el calendario, contando la actual
 * @returns {{
 *   semanas: [{lunes, dias: [{fecha, entreno, futuro}], total}],  de la más antigua a la actual, de lunes a domingo
 *   racha, rachaIncluyeEsta, diasDesdeUltimo, ultima, estaSemana, promedio
 * }}
 *   racha: semanas seguidas con al menos un día entrenado. La semana actual cuenta si ya entrenaste; si todavía no,
 *   la racha se cuenta hasta la semana pasada (la semana no ha terminado). promedio: días por semana en las últimas
 *   8 semanas completas, o en las que hay desde el primer entrenamiento si son menos.
 */
export function constanciaEntreno(fechas, hoy, { semanas = 12 } = {}) {
  const hechos = new Set(fechas.filter(f => f <= hoy));
  const lunesHoy = lunesDe(hoy);
  const semana = lunes => {
    const ds = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)).map(fecha => ({ fecha, entreno: hechos.has(fecha), futuro: fecha > hoy }));
    return { lunes, dias: ds, total: ds.filter(d => d.entreno).length };
  };
  const lista = Array.from({ length: semanas }, (_, i) => semana(sumarDias(lunesHoy, -7 * (semanas - 1 - i))));
  const ordenadas = [...hechos].sort();
  const ultima = ordenadas.at(-1) || null;
  const estaSemana = semana(lunesHoy).total;
  let racha = 0;
  for (let l = estaSemana ? lunesHoy : sumarDias(lunesHoy, -7); semana(l).total > 0; l = sumarDias(l, -7)) racha++;
  const primera = ordenadas[0];
  const completas = primera ? Math.min(8, Math.max(0, Math.floor(dias(lunesDe(primera), lunesHoy) / 7))) : 0;
  const promedio = completas ? Array.from({ length: completas }, (_, i) => semana(sumarDias(lunesHoy, -7 * (i + 1))).total).reduce((a, b) => a + b, 0) / completas : null;
  return {
    semanas: lista, racha, rachaIncluyeEsta: estaSemana > 0, ultima, estaSemana,
    diasDesdeUltimo: ultima ? dias(ultima, hoy) : null,
    promedio: promedio == null ? null : Math.round(promedio * 10) / 10,
  };
}
