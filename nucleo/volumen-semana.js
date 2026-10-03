// Series de la semana por músculo, para el mapa del cuerpo de Progreso: las hechas contra las del plan. Cada serie
// cuenta 1 para los músculos principales del ejercicio y media para los que ayudan (la forma habitual de contarlas).

/** Lunes de la semana de una fecha 'AAAA-MM-DD'. */
export function lunesDe(fecha) {
  const d = new Date(fecha + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

const sumar = (out, ej, n) => {
  for (const m of ej.musculos_primarios) out[m] = (out[m] || 0) + n;
  for (const m of ej.musculos_secundarios) out[m] = (out[m] || 0) + n / 2;
};

/** Series hechas por músculo. @param series [{fecha, ejercicio_id}] (semanal.seriesAnotadas), una por serie de trabajo. */
export function hechasPorMusculo(series, indice, desde, hasta) {
  const out = {};
  for (const s of series) {
    const ej = indice.porId.get(s.ejercicio_id);
    if (ej && s.fecha >= desde && s.fecha <= hasta) sumar(out, ej, 1);
  }
  return out;
}

/** Series que el plan pone por músculo entre dos fechas. */
export function planeadasPorMusculo(plan, indice, desde, hasta) {
  const out = {};
  for (const d of plan?.dias || []) {
    if (d.fecha < desde || d.fecha > hasta) continue;
    for (const e of d.ejercicios) { const ej = indice.porId.get(e.ejercicio_id); if (ej) sumar(out, ej, Number(e.series) || 0); }
  }
  return out;
}

/**
 * La semana de una fecha, músculo por músculo: hechas, planeadas y cuánto va (0 a 1, para pintar el mapa).
 * Ordenado por lo planeado, de más a menos; los músculos sin plan ni series no aparecen.
 */
export function semanaPorMusculo({ series, plan, indice, hoy }) {
  const desde = lunesDe(hoy);
  const hasta = new Date(Date.parse(desde + 'T12:00:00Z') + 6 * 864e5).toISOString().slice(0, 10);
  const hechas = hechasPorMusculo(series, indice, desde, hasta);
  const planeadas = planeadasPorMusculo(plan, indice, desde, hasta);
  const musculos = [...new Set([...Object.keys(planeadas), ...Object.keys(hechas)])];
  const filas = musculos.map(m => {
    const h = hechas[m] || 0, p = planeadas[m] || 0;
    return { musculo: m, hechas: h, planeadas: p, avance: p ? Math.min(1, h / p) : h ? 1 : 0 };
  }).sort((a, b) => b.planeadas - a.planeadas || b.hechas - a.hechas);
  return { desde, hasta, filas, intensidad: Object.fromEntries(filas.map(f => [f.musculo, f.avance])) };
}

const sumarDias = (f, n) => new Date(Date.parse(f + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
// Los músculos que tienen franja recomendada (los mismos que revisa el validador).
export const CON_FRANJA = ['gluteo', 'cuadriceps', 'femoral', 'aductor_abductor', 'espalda', 'pecho', 'hombro', 'biceps', 'triceps'];

/**
 * Músculos contra lo recomendado, como el tablero: las series de los últimos 12 días llevadas a una semana, contra
 * la franja de tu nivel; si subiste o bajaste respecto de los 12 días anteriores; tu promedio por semana desde que
 * hay registro (hasta 12 semanas); y las semanas anteriores, una por una (de lunes a domingo).
 * @param rango [mínimo, máximo] de series por semana (derivados.series_rango)
 * @returns {{filas: [{musculo, reciente, anterior, cambio, promedio, estado, seguido}], semanas: [{lunes, porMusculo}]}}
 *   estado: 'bajo' (menos de la mitad del mínimo), 'cerca' (bajo el mínimo), 'bien' o 'alto' (más de 4 sobre el
 *   máximo). seguido: lleva los dos períodos de 12 días bajo el mínimo.
 */
export function musculosContraFranja({ series, indice, hoy, rango: [lo, hi], semanas = 6 }) {
  const DIAS = 12;
  const ini = sumarDias(hoy, -(DIAS - 1)), iniAnt = sumarDias(ini, -DIAS), finAnt = sumarDias(ini, -1);
  const porSemana = n => Math.round(n * 7 / DIAS * 10) / 10;
  const rec = hechasPorMusculo(series, indice, ini, hoy), ant = hechasPorMusculo(series, indice, iniAnt, finAnt);
  const primera = series.map(s => s.fecha).filter(Boolean).sort()[0];
  const desde = primera && primera > sumarDias(hoy, -83) ? primera : sumarDias(hoy, -83);
  const total = hechasPorMusculo(series, indice, desde, hoy);
  const semanasHistorial = primera ? Math.max(1, Math.round((Date.parse(hoy) - Date.parse(desde)) / 864e5 + 1) / 7) : 1;
  const estado = v => (v > hi + 4 ? 'alto' : v >= lo ? 'bien' : v >= lo / 2 ? 'cerca' : 'bajo');
  const filas = CON_FRANJA.map(m => {
    const reciente = porSemana(rec[m] || 0), anterior = porSemana(ant[m] || 0);
    return { musculo: m, reciente, anterior, cambio: Math.round((reciente - anterior) * 10) / 10,
      promedio: Math.round((total[m] || 0) / semanasHistorial * 10) / 10, estado: estado(reciente),
      seguido: reciente < lo && anterior < lo && primera <= iniAnt };
  }).filter(f => f.reciente || f.anterior || f.promedio);
  const lunesHoy = lunesDe(hoy);
  const lista = Array.from({ length: semanas }, (_, i) => sumarDias(lunesHoy, -7 * (semanas - i)))
    .map(lunes => ({ lunes, porMusculo: hechasPorMusculo(series, indice, lunes, sumarDias(lunes, 6)) }));
  return { filas, semanas: lista };
}
