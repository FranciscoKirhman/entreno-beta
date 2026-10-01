// Cómo le fue a la persona en cada ejercicio (contenido/checkin.json → por_ejercicio): forma, rango de
// movimiento, reserva real, molestia y dolor, más una nota libre para el entrenador.
// Esto alimenta tres cosas: el ajuste de cargas (nucleo/progresion.js), las señales de alarma
// (nucleo/checkin.js) y el resumen que lee el entrenador o el coach.

/** Si la carga puede subir según la calidad: con técnica rota o rango parcial, no sube aunque se completen las reps. */
export function calidadPermiteSubir(respuestas = {}) {
  if (respuestas.forma === 'rota') return { ok: false, motivo: 'La técnica se rompió: se repite la carga hasta que salga limpia.' };
  if (respuestas.rango === 'parcial') return { ok: false, motivo: 'El rango de movimiento quedó parcial: se repite la carga hasta completarlo.' };
  if (respuestas.molestia === 'me_preocupa' || (respuestas.dolor ?? 0) >= 4) return { ok: false, motivo: 'Hubo dolor o una molestia que preocupa: no se sube carga en este ejercicio.' };
  return { ok: true, motivo: null };
}

/** Reserva real reportada → número (para comparar con la reserva pedida). "4" significa 4 o más. */
export const reservaReal = r => (r?.reserva_real == null ? null : Number(r.reserva_real));

/** Lo que se le pasa a progresion.ajustarEjercicio: las series registradas con la reserva real si la contaron. */
export function conReservaReportada(series, respuestas) {
  const rr = reservaReal(respuestas);
  if (rr == null || !series.length) return series;
  return series.map((s, i) => (i === series.length - 1 && s.rir == null && s.rpe == null ? { ...s, rir: rr } : s));
}

/** Dolores de las notas de una semana, en el formato de detectarBanderas (nucleo/checkin.js). */
export const doloresDeNotas = notas => notas
  .filter(n => n.respuestas?.dolor != null && n.respuestas.dolor > 0)
  .map(n => ({ region: n.respuestas.dolor_zona || null, intensidad: n.respuestas.dolor, ejercicio: n.ejercicio_id }));

/** Resumen para el entrenador (o para el coach con IA): lo que conviene mirar de la semana. */
export function resumenParaEntrenador(notas, indice) {
  const nombre = id => indice?.porId.get(id)?.nombre || id;
  const items = [];
  for (const n of notas) {
    const r = n.respuestas || {};
    const marcas = [];
    if (r.forma === 'rota') marcas.push('técnica rota');
    else if (r.forma === 'algunas_feas') marcas.push('técnica se desarma al final');
    if (r.rango === 'parcial') marcas.push('rango parcial');
    if (r.molestia === 'me_preocupa') marcas.push(`molestia que preocupa${r.dolor_zona ? ` en ${r.dolor_zona}` : ''}${r.dolor != null ? ` (${r.dolor}/10)` : ''}`);
    else if (r.molestia === 'leve') marcas.push(`molestia leve${r.dolor_zona ? ` en ${r.dolor_zona}` : ''}`);
    if (r.reserva_real === '0') marcas.push('llegó al fallo');
    if (marcas.length || n.nota) items.push({ fecha: n.fecha, ejercicio: nombre(n.ejercicio_id), marcas, nota: n.nota || null, para_entrenador: Boolean(n.para_entrenador) });
  }
  const prioridad = it => (it.marcas.some(m => m.startsWith('molestia que preocupa')) ? 0 : it.marcas.includes('técnica rota') ? 1 : it.para_entrenador ? 2 : 3);
  return items.sort((a, b) => prioridad(a) - prioridad(b) || (a.fecha < b.fecha ? 1 : -1));
}
