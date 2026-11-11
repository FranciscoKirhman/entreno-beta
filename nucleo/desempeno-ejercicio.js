// Lo que hace falta para decidir sobre un ejercicio cuando el coach pregunta (Tu actividad): sus últimas veces, serie
// por serie, con lo que pedía el plan, y hacia dónde va su máximo estimado. Francisco, 10 de noviembre de 2026: "difícil
// tomar una decisión si no me das el historial del ejercicio ni la performance de este".
import { e1rm } from './motor-plan.js';
import { esDeTrabajoGuardada } from './registro.js';

const num = v => (v == null || v === '' ? null : Number(v));
const coma = x => String(Math.round(Number(x) * 10) / 10).replace('.', ',');
const reservaDe = s => (s.tipo === 'fallo' ? 0 : num(s.rir) != null ? num(s.rir) : num(s.rpe) != null ? Math.max(0, 10 - num(s.rpe)) : null);
// La misma mediana que usa la pregunta del coach (nucleo/preguntas-coach.js), para que la tarjeta no se contradiga.
const mediana = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/**
 * Las últimas `n` sesiones en que se hizo el ejercicio, de la más nueva a la más antigua.
 * @returns {{filas: [{fecha, series: [{kg, reps, seg, reserva}], reserva: number|null, pedido: {rir, carga_kg, reps_min, reps_max}|null, e1rm: number|null}],
 *            tendencia: {antes, ahora, pct, sesiones}|null, puntos: [{fecha, valor}]}}
 */
export function desempenoEjercicio(sesiones = [], id, { plan = null, hoy = '9999-12-31', n = 4, asistido = false } = {}) {
  const veces = sesiones.filter(s => s.fecha <= hoy).map(s => ({ s, series: (s.series || []).filter(x => x.ejercicio_id === id && esDeTrabajoGuardada(x)) }))
    .filter(x => x.series.length).sort((a, b) => b.s.fecha.localeCompare(a.s.fecha) || (b.s.hora || '').localeCompare(a.s.hora || ''));
  const fila = ({ s, series }) => {
    const reservas = series.map(reservaDe).filter(x => x != null && Number.isFinite(x));
    const conPeso = series.filter(x => num(x.carga_kg) > 0 && num(x.reps) > 0);
    const e = plan?.dias?.find(d => d.fecha === s.fecha)?.ejercicios?.find(x => x.ejercicio_id === id) || null;
    return { fecha: s.fecha,
      series: series.map(x => ({ kg: num(x.carga_kg), reps: num(x.reps), seg: num(x.duracion_seg), reserva: reservaDe(x) })),
      reserva: reservas.length ? mediana(reservas) : null,
      pedido: e ? { rir: e.rir ?? null, carga_kg: e.carga_kg ?? null, reps_min: e.reps_min ?? null, reps_max: e.reps_max ?? null } : null,
      e1rm: !asistido && conPeso.length ? Math.round(Math.max(...conPeso.map(e1rm)) * 2) / 2 : null };
  };
  const todas = veces.slice(0, 8).map(fila), filas = todas.slice(0, n);
  const puntos = [...todas].reverse().filter(f => f.e1rm != null).map(f => ({ fecha: f.fecha, valor: f.e1rm }));
  const tendencia = puntos.length >= 2 ? { antes: puntos[0].valor, ahora: puntos.at(-1).valor, pct: Math.round((puntos.at(-1).valor / puntos[0].valor - 1) * 100), sesiones: puntos.length } : null;
  return { filas, tendencia, puntos };
}

/** Las series de una sesión en una línea: "40 kg × 14, 13, 12" si el peso no cambia; si cambia, "40 × 12 · 42,5 × 10". */
export function textoSeries(series = [], unidad = 'kg', aUnidad = x => x) {
  const conReps = series.filter(s => s.reps != null || s.seg != null);
  if (!conReps.length) return '';
  const valor = s => (s.reps != null ? String(s.reps) : `${s.seg} s`);
  const pesos = [...new Set(conReps.map(s => s.kg))];
  if (pesos.length === 1) return `${pesos[0] ? `${coma(aUnidad(pesos[0]))} ${unidad} × ` : ''}${conReps.map(valor).join(', ')}`;
  return conReps.map(s => `${s.kg ? `${coma(aUnidad(s.kg))} × ` : ''}${valor(s)}`).join(' · ');
}

/** La reserva de esa vez contra la pedida: "1 en reserva, pedía 2", "al fallo, pedía 2", "2 en reserva" o "". */
export function textoReserva(fila) {
  if (fila.reserva == null) return '';
  const real = fila.reserva === 0 ? 'al fallo' : `${coma(fila.reserva)} en reserva`;
  return fila.pedido?.rir != null && Number(fila.pedido.rir) !== fila.reserva ? `${real}, pedía ${coma(fila.pedido.rir)}` : real;
}

/** La tendencia en una frase: "Máximo estimado: 52 a 54 kg, 4% más en 5 sesiones". */
export function textoTendencia(t, unidad = 'kg', aUnidad = x => x) {
  if (!t) return '';
  const cambio = t.pct === 0 ? 'igual' : `${Math.abs(t.pct)}% ${t.pct > 0 ? 'más' : 'menos'}`;
  return `Máximo estimado: ${coma(aUnidad(t.antes))} a ${coma(aUnidad(t.ahora))} ${unidad}, ${cambio} en ${t.sesiones} sesiones`;
}

/** Hacia dónde va un cambio de Para la próxima, para decirlo en una palabra: primero el peso, después las repeticiones. */
export function sentidoCambio(antes = {}, despues = {}) {
  const a = num(antes.carga_kg), d = num(despues.carga_kg);
  if (a != null && d != null && d !== a) return d > a ? 'sube' : 'baja';
  if (a == null && d != null) return 'peso';
  const ra = num(antes.reps_max) + num(antes.reps_min), rd = num(despues.reps_max) + num(despues.reps_min);
  if (rd !== ra) return rd > ra ? 'mas_reps' : 'menos_reps';
  return 'igual';
}
export const ETIQUETA_CAMBIO = Object.freeze({ sube: 'Sube el peso', baja: 'Baja el peso', peso: 'Con peso', mas_reps: 'Más repeticiones', menos_reps: 'Menos repeticiones', igual: 'Ajuste' });
