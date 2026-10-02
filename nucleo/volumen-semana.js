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
