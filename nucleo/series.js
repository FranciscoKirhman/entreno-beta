// Cada serie: esfuerzo (RPE o RIR), fallo, qué priorizar si no salen las repeticiones o la reserva sale
// distinta, y un consejo para la serie siguiente. Ver contenido/evidencia/00-principios.md, sección 4.

/** Opciones de esfuerzo: una sola lista con las dos escalas (RPE = 10 − RIR), como en Hevy. */
export const ESFUERZO = [
  { rpe: 10, rir: 0, etiqueta: 'Fallo · RPE 10 · RIR 0' },
  { rpe: 9.5, rir: 0.5, etiqueta: 'RPE 9,5 · quizás 1 más' },
  { rpe: 9, rir: 1, etiqueta: 'RPE 9 · RIR 1' },
  { rpe: 8.5, rir: 1.5, etiqueta: 'RPE 8,5 · RIR 1 a 2' },
  { rpe: 8, rir: 2, etiqueta: 'RPE 8 · RIR 2' },
  { rpe: 7.5, rir: 2.5, etiqueta: 'RPE 7,5 · RIR 2 a 3' },
  { rpe: 7, rir: 3, etiqueta: 'RPE 7 · RIR 3' },
  { rpe: 6, rir: 4, etiqueta: 'RPE 6 o menos · RIR 4+' },
];

/** Reserva de una serie anotada: RIR directo, o 10 − RPE; con fallo, 0. */
export function reservaDe(s) {
  if (s.fallo) return 0;
  if (s.rir != null && s.rir !== '') return Number(s.rir);
  if (s.rpe != null && s.rpe !== '') return 10 - Number(s.rpe);
  return null;
}

/**
 * Qué priorizar cuando las repeticiones y la reserva no calzan.
 * - Reserva (RIR): en los ejercicios grandes, para principiantes, con alerta médica o con una molestia en la zona.
 *   Es más seguro y la técnica no se rompe; llegar al fallo no da más músculo.
 * - Repeticiones: en los aislados de quien ya entrena, donde acercarse más al fallo tiene poco riesgo.
 */
export function prioridadEsfuerzo(e, ej, d = {}, zonasConMolestia = []) {
  const grande = ej?.tipo === 'compuesto';
  const cuidado = d.nivel === 'principiante' || (d.rir_minimo ?? 0) >= 3 || (ej?.carga_articular || []).some(a => zonasConMolestia.includes(a));
  if (grande || cuidado || e.unidad === 'seg' || e.unidad === 'm') {
    return { prioriza: 'rir', texto: `Prioriza la reserva: deja ${e.rir} repeticiones sin hacer. Si con ${e.rir} en reserva no llegas a ${e.reps_min}, para ahí y no fuerces; es mejor una repetición menos que llegar al fallo.` };
  }
  return { prioriza: 'reps', texto: `Prioriza las repeticiones: completa ${e.reps_min} a ${e.reps_max} aunque te quede menos reserva. En la última serie puedes llegar cerca del fallo.` };
}

/**
 * Consejo para la serie siguiente según cómo salió esta.
 * @param e  prescripción del ejercicio
 * @param s  serie hecha { kg, reps, rir?, rpe?, fallo? }
 * @param incremento kg que se pueden sumar o restar (null en peso corporal)
 */
export function consejoSerie(e, s, incremento = null, { asistido = false } = {}) {
  const reps = Number(s.reps);
  if (!reps || e.unidad === 'seg' || e.unidad === 'm') return null;
  const r = reservaDe(s);
  const ajuste = incremento ? ` (${String(incremento).replace('.', ',')} kg)` : '';
  // En los asistidos el peso es ayuda: costar más es subir la ayuda, y progresar es bajarla.
  const masDificil = asistido ? `baja la ayuda un escalón${ajuste}` : `sube un escalón${ajuste}`;
  const masFacil = asistido ? `sube la ayuda un escalón${ajuste}` : `baja la carga un escalón${ajuste}`;
  if (s.fallo && e.rir >= 1) return { tipo: 'bajar', texto: `Llegaste al fallo y el plan pedía dejar ${e.rir}. En la siguiente serie ${masFacil} o haz 1 a 2 repeticiones menos.` };
  if (reps < e.reps_min && r != null && r < e.rir) return { tipo: 'bajar', texto: `No llegaste a ${e.reps_min} y quedaste más cerca del fallo de lo pedido: ${masFacil} para la siguiente.` };
  if (reps < e.reps_min && (r == null || r >= e.rir)) return { tipo: 'mantener', texto: `Paraste antes del rango con reserva de sobra. Si te sentías bien, en la siguiente intenta llegar a ${e.reps_min}.` };
  if (reps > e.reps_max && (r == null || r >= e.rir)) return { tipo: 'subir', texto: `Te pasaste del rango con reserva: en la siguiente serie ${masDificil}.` };
  if (r != null && r > e.rir + 1.5) return { tipo: 'subir', texto: `Te sobraban más repeticiones de las pedidas: ${masDificil} o haz más repeticiones.` };
  if (r != null && r < e.rir - 1.5) return { tipo: 'bajar', texto: `Quedaste mucho más cerca del fallo que lo pedido (${e.rir} en reserva): ${masFacil} para la siguiente.` };
  if (r != null && r < e.rir - 0.5) return { tipo: 'mantener', texto: `Quedaste más cerca del fallo que lo pedido (${e.rir} en reserva). Mantén ${asistido ? 'la ayuda' : 'la carga'} y no fuerces más.` };
  return { tipo: 'bien', texto: 'Justo lo pedido. Sigue igual.' };
}
