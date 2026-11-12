// La sesión en curso, en palabras, para el coach con IA. El servidor solo conoce el plan guardado en la cuenta: no ve
// lo que la persona cambió en plena sesión ni lo que ya hizo. El 11 de noviembre de 2026 el coach respondió tres
// veces sobre un ejercicio que ya se había cambiado por otro en el teléfono, y tomó "lo cambié" como un pedido de
// cambio. Con una sesión empezada, cada mensaje del chat lleva este resumen en un campo aparte (sesion_en_curso,
// app/coach-ui.js) y el servidor lo agrega solo al mensaje para la IA (mensajesCoach). Nunca se pega al texto de la
// persona: la alarma y las reglas (nucleo/coach.js) leerían "llevo 20 minutos" como poco tiempo y "porque cambié"
// como una pregunta de por qué.

const n = x => String(Math.round(Number(x) * 10) / 10).replace('.', ',');
const TRABAJO = new Set(['normal', 'fallo']);

/**
 * @param dia      el día como está en el teléfono: {foco, ejercicios: [{ejercicio_id, nombre, series, reps_min, reps_max, rir, carga_kg, unidad}]}
 * @param registro lo anotado hoy: {[clave del ejercicio]: filas [{hecho, kg, reps, rir, rpe, tipo}]}
 * @param clave    (e, k) => la clave del ejercicio en `registro`
 * @returns el texto, o '' si no hay nada que contar
 */
export function resumenSesionEnCurso(dia, registro = {}, { nombreDe = e => e.nombre || e.ejercicio_id, clave = (e, k) => e.ejercicio_id || `i${k}`, minutos = null } = {}) {
  const ejs = dia?.ejercicios || [];
  if (!ejs.length) return '';
  const lineas = ejs.map((e, k) => {
    const filas = (registro[clave(e, k)] || []).filter(x => x?.hecho && TRABAJO.has(x.tipo || 'normal'));
    const unidad = e.unidad === 'seg' ? ' s' : e.unidad === 'm' ? ' m' : '';
    const pide = `${e.series} × ${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${unidad}${e.carga_kg != null ? ` con ${n(e.carga_kg)} kg` : ''}${e.rir != null ? `, ${e.rir} en reserva` : ''}`;
    const reserva = x => (x.tipo === 'fallo' ? 0 : x.rir != null ? Number(x.rir) : x.rpe != null ? 10 - Number(x.rpe) : null);
    const hecho = filas.map(x => `${x.kg != null ? `${n(x.kg)} × ` : ''}${x.reps ?? '?'}${reserva(x) != null ? ` (${n(reserva(x))} en reserva)` : ''}`);
    const faltan = Math.max(0, (Number(e.series) || 0) - filas.length);
    const estado = !filas.length ? 'sin empezar' : `hecho ${hecho.join('; ')}${faltan ? `; faltan ${faltan}` : '; completo'}`;
    return `${k + 1}. ${nombreDe(e)}${e.superserie ? ` (superserie ${e.superserie})` : ''}: pide ${pide}; ${estado}.`;
  });
  return [`Sesión en curso ahora en mi teléfono${dia.foco ? ` (${dia.foco})` : ''}${minutos != null ? `, llevo ${Math.round(minutos)} minutos` : ''}. Es lo vigente: puede diferir del plan guardado en la cuenta, porque cambié cosas en plena sesión.`,
    ...lineas].join('\n').slice(0, 4000);
}
