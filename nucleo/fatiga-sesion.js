// La fatiga dentro de una sesión: un ejercicio que llega después de otros del mismo músculo no rinde como fresco.
// Nace de un error real (21 de octubre de 2026): un día de pecho con banca 4 series a RPE 8 a 9 y press inclinado 4 a
// RIR 1, y después el press en máquina con el peso de cuando se hace fresco (75 para 10 a 12). Salió 75 × 6 al fallo.
// Las cargas iniciales salen de la mejor serie de las últimas semanas, que casi siempre se hizo fresco, así que hay que
// descontar lo que viene antes en el mismo día. Es una regla práctica, calibrada con ese caso, no un resultado de
// ensayos: el orden de los ejercicios sí cambia las repeticiones que salen (ver contenido/evidencia/01-ganar-musculo.md).

const POR_SERIE = 0.02, PISO = 0.8;
// Sobre este número de series de un músculo en una misma sesión, cada serie extra rinde poco y cansa igual.
export const SERIES_SESION = { aviso: 12, tope: 16 };

const cuenta = ej => ej && ej.tipo !== 'core' && ej.tipo !== 'cardio' && ej.tipo !== 'movilidad';
const comparten = (a, b) => a.musculos_primarios.some(m => b.musculos_primarios.includes(m));

/**
 * Series de trabajo del mismo músculo (principal) que van antes del ejercicio `k` en el día. Cuentan en proporción a
 * los músculos que comparten: la sentadilla (cuádriceps y glúteo) después del hip thrust (glúteo) suma media serie
 * por cada una, porque el cuádriceps llega fresco.
 */
export function seriesPrevias(ejercicios, k, porId) {
  const ej = porId.get(ejercicios[k]?.ejercicio_id);
  if (!cuenta(ej)) return 0;
  const total = ejercicios.slice(0, k).reduce((n, e) => {
    const otro = porId.get(e.ejercicio_id);
    if (!cuenta(otro) || (e.unidad || 'reps') !== 'reps') return n;
    const parte = ej.musculos_primarios.filter(m => otro.musculos_primarios.includes(m)).length / ej.musculos_primarios.length;
    return n + (e.series || 0) * parte;
  }, 0);
  return Math.round(total * 10) / 10;
}

/** Cuánto rinde un ejercicio después de `previas` series del mismo músculo: 2% menos por serie, hasta un 20%. */
export const factorFatiga = previas => Math.max(PISO, 1 - POR_SERIE * previas);

/**
 * Las cargas del día descontando la fatiga de lo que va antes del mismo músculo. Solo toca cargas en kilos de
 * ejercicios por repeticiones (no la ayuda de un asistido) y deja una nota corta con el porqué.
 * @param incrementoDe (ej) => kg del escalón de ese ejercicio en el lugar
 * @param esAsistido   (ej) => true si el peso es ayuda
 */
export function conFatigaPrevia(ejercicios, porId, incrementoDe, esAsistido = () => false) {
  return ejercicios.map((e, k) => {
    const ej = porId.get(e.ejercicio_id);
    if (e.carga_kg == null || !ej || esAsistido(ej) || (e.unidad || 'reps') !== 'reps') return e;
    const previas = seriesPrevias(ejercicios, k, porId);
    const f = factorFatiga(previas);
    if (f >= 0.97) return e;
    const inc = incrementoDe(ej) || 2.5;
    const carga = Math.max(inc, Math.floor((e.carga_kg * f) / inc + 1e-9) * inc);
    if (carga >= e.carga_kg) return e;
    const nota = `Más liviano que fresco (unos ${Math.round((1 - f) * 100)}% menos): llegas con ${String(Math.round(previas)).replace('.', ',')} series del mismo músculo.`;
    return { ...e, carga_kg: Number(carga.toFixed(2)), nota: e.nota ? `${e.nota} ${nota}` : nota };
  });
}

const NOTA_FATIGA = /\s*Más liviano que fresco \(unos \d+% menos\): llegas con [\d,]+ series del mismo músculo\./g;
// Lo que conFatigaPrevia descuenta de verdad: bajo 3% no toca la carga.
const aplicado = previas => { const f = factorFatiga(previas); return f >= 0.97 ? 1 : f; };

/**
 * Al cambiar el orden de un día, cada carga se lleva a su lugar nuevo con la regla del plan (conFatigaPrevia): se
 * deshace lo que tenía por las series del mismo músculo que iban antes y se aplica lo que va antes ahora, aunque esas
 * series salgan con la reserva pedida. Antes un ejercicio movido más abajo seguía con su peso de fresco, salvo que lo
 * anterior saliera más duro de lo pedido (Francisco, 27 de octubre de 2026: la banca después del press inclinado). Se
 * redondea al escalón más cercano, así mover y devolver un ejercicio deja la carga como estaba. No toca lo que `tocar`
 * excluye (un ejercicio ya empezado hoy), ni la ayuda de un asistido, ni lo que va por tiempo o metros.
 * @param antes        ejercicios del día en el orden anterior (los mismos objetos que `despues`)
 * @param despues      los mismos ejercicios en el orden nuevo
 * @param incrementoDe (ej) => kg del escalón de ese ejercicio en el lugar
 * @returns los ejercicios de `despues`, con la carga y la nota de fatiga al día
 */
export function cargasAlReordenar(antes, despues, porId, incrementoDe, esAsistido = () => false, tocar = () => true) {
  return despues.map((e, k) => {
    const ej = porId.get(e.ejercicio_id), j = antes.indexOf(e);
    if (j < 0 || e.carga_kg == null || !ej || esAsistido(ej) || (e.unidad || 'reps') !== 'reps' || !tocar(e)) return e;
    const previas = seriesPrevias(despues, k, porId);
    const fAntes = aplicado(seriesPrevias(antes, j, porId)), fAhora = aplicado(previas);
    if (fAntes === fAhora) return e;
    const inc = incrementoDe(ej) || 2.5;
    const carga = Number(Math.max(inc, Math.round((Number(e.carga_kg) / fAntes * fAhora) / inc) * inc).toFixed(2));
    const sinNota = String(e.nota || '').replace(NOTA_FATIGA, '').trim();
    const nota = fAhora < 1 ? `Más liviano que fresco (unos ${Math.round((1 - fAhora) * 100)}% menos): llegas con ${String(Math.round(previas)).replace('.', ',')} series del mismo músculo.` : '';
    return { ...e, carga_kg: carga, nota: [sinNota, nota].filter(Boolean).join(' ') || null };
  });
}

/** Series de trabajo por músculo principal en un día (para el tope por sesión del validador). */
export function seriesPorMusculo(ejercicios, porId) {
  const v = {};
  for (const e of ejercicios) {
    const ej = porId.get(e.ejercicio_id);
    if (!cuenta(ej)) continue;
    for (const m of ej.musculos_primarios) v[m] = (v[m] || 0) + (e.series || 0);
  }
  return v;
}

/**
 * Durante la sesión: si lo ya hecho hoy de otro ejercicio del mismo músculo salió más duro de lo pedido, el peso de
 * este baja. Un punto de reserva menos en promedio, 5%; dos o más, 10%. Cuenta lo que se hizo antes de empezar este
 * ejercicio, esté arriba o abajo en la lista: antes contaba solo lo de arriba, así que mover un ejercicio sobre otro ya
 * hecho le devolvía el peso de fresco y bajarlo se lo quitaba (Francisco, 26 de octubre: "al mover los ejercicios los
 * pesos cambian"). Las series sin hora (registros antiguos) cuentan como antes, por posición.
 * @param hechas {[ejercicio_id]: [{rpe?, rir?, hecho, tipo?, t?}]} filas de hoy; t: cuándo se marcó
 * @returns {{factor, falta}} falta: puntos de reserva que faltaron en promedio
 */
export function ajusteDelDia(ejercicios, k, porId, hechas = {}) {
  const id = ejercicios[k]?.ejercicio_id, ej = porId.get(id);
  if (!cuenta(ej)) return { factor: 1, falta: 0 };
  const propias = (hechas[id] || []).filter(s => s?.hecho && s.t != null).map(s => s.t);
  const empezo = propias.length ? Math.min(...propias) : Infinity;
  const faltas = [];
  ejercicios.forEach((e, j) => {
    const otro = porId.get(e.ejercicio_id);
    if (j === k || e.ejercicio_id === id || !cuenta(otro) || !comparten(ej, otro) || e.rir == null) return;
    for (const s of hechas[e.ejercicio_id] || []) {
      if (!s?.hecho || ['calentamiento', 'drop'].includes(s.tipo)) continue;
      if (s.t != null ? s.t >= empezo : j > k) continue;
      const reserva = s.tipo === 'fallo' ? 0 : s.rir != null ? Number(s.rir) : s.rpe != null ? 10 - Number(s.rpe) : null;
      if (reserva != null) faltas.push(e.rir - reserva);
    }
  });
  if (!faltas.length) return { factor: 1, falta: 0 };
  const falta = faltas.reduce((a, b) => a + b, 0) / faltas.length;
  return { factor: falta >= 2 ? 0.9 : falta >= 1 ? 0.95 : 1, falta: Math.round(falta * 10) / 10 };
}
