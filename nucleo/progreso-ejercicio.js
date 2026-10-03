// Progreso de un ejercicio, como los gráficos de Hevy y el ritmo del tablero: por cada sesión, la carga más alta, el
// máximo estimado (1RM), el volumen y las repeticiones; y cuánto cambió el máximo estimado en las últimas semanas.
// Trabaja con las series de trabajo anotadas (semanal.seriesAnotadas). En los asistidos el peso es la ayuda de la
// máquina: no hay máximo estimado ni volumen, y la mejor sesión es la de menos ayuda.
import { e1rm } from './motor-plan.js';
import { sumarDias } from './agenda.js';

const n = v => (v == null || v === '' ? null : Number(v));
const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const medio = x => Math.round(x * 2) / 2;

/**
 * Una fila por sesión en que se hizo el ejercicio, de la más antigua a la más nueva.
 * @returns [{fecha, peso, e1rm, volumen, reps, duracion, series}] peso: la carga más alta (en asistidos, la menor ayuda)
 */
export function porSesion(series, id, { asistido = false } = {}) {
  const fechas = new Map();
  for (const s of series) if (s.ejercicio_id === id && (n(s.reps) > 0 || n(s.duracion_seg) > 0)) (fechas.get(s.fecha) || fechas.set(s.fecha, []).get(s.fecha)).push(s);
  return [...fechas.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([fecha, xs]) => {
    const conPeso = xs.filter(s => n(s.carga_kg) > 0 && n(s.reps) > 0);
    const max = f => (xs.length ? Math.max(0, ...xs.map(s => n(f(s)) || 0)) : 0) || null;
    return {
      fecha, series: xs,
      peso: conPeso.length ? (asistido ? Math.min(...conPeso.map(s => n(s.carga_kg))) : Math.max(...conPeso.map(s => n(s.carga_kg)))) : null,
      e1rm: !asistido && conPeso.length ? medio(Math.max(...conPeso.map(e1rm))) : null,
      volumen: !asistido && conPeso.length ? Math.round(conPeso.reduce((a, s) => a + n(s.carga_kg) * n(s.reps), 0)) : null,
      reps: max(s => s.reps),
      duracion: max(s => s.duracion_seg),
    };
  });
}

/** Qué medidas tienen datos, en el orden en que se muestran. */
export function medidasCon(filas, { asistido = false } = {}) {
  const hay = k => filas.filter(f => f[k] != null).length >= 1;
  return (asistido ? ['peso', 'reps'] : ['peso', 'e1rm', 'volumen', 'reps', 'duracion']).filter(hay);
}

export const PERIODOS = [['3m', '3 meses', 91], ['1a', '1 año', 365], ['todo', 'Todo', null]];
/** Primer día del período: 3 meses, 1 año o desde la primera sesión. */
export function desdePeriodo(periodo, hoy, filas) {
  const p = PERIODOS.find(x => x[0] === periodo) || PERIODOS[0];
  const primera = filas[0]?.fecha || hoy;
  return p[2] ? sumarDias(hoy, -p[2] + 1) : (primera < hoy ? primera : sumarDias(hoy, -6));
}

/**
 * Ritmo de progreso: la recta que mejor pasa por la medida de cada sesión en las últimas semanas (mínimos cuadrados),
 * para que una sesión mala o muy buena no lo cambie todo.
 * @param campo 'e1rm' (por defecto), 'peso', 'reps' o 'duracion'
 * @returns {{campo, desde, hasta, porSemana, semanas, sesiones, tendencia: 'sube' | 'estable' | 'baja'} | null}
 *   null si hay menos de 3 sesiones o abarcan menos de 2 semanas.
 */
export function ritmo(filas, hoy, { campo = 'e1rm', semanas = 8 } = {}) {
  const inicio = sumarDias(hoy, -semanas * 7 + 1);
  const ps = filas.filter(f => f.fecha >= inicio && f.fecha <= hoy && f[campo] != null);
  if (ps.length < 3 || dias(ps[0].fecha, ps.at(-1).fecha) < 14) return null;
  const xs = ps.map(p => dias(ps[0].fecha, p.fecha)), ys = ps.map(p => p[campo]);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  const pendiente = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / xs.reduce((a, x) => a + (x - mx) ** 2, 0);
  const desde = my + pendiente * (xs[0] - mx), hasta = my + pendiente * (xs.at(-1) - mx);
  const porSemana = pendiente * 7;
  // Menos de un 0,25% por semana (o de un cuarto de kilo, repetición o segundo) es estar estable.
  const umbral = Math.max(0.25, Math.abs(my) * 0.0025);
  const redondear = campo === 'reps' || campo === 'duracion' ? Math.round : medio;
  return {
    campo, desde: redondear(desde), hasta: redondear(hasta), porSemana: Math.round(porSemana * 10) / 10,
    semanas: Math.max(2, Math.round(dias(ps[0].fecha, ps.at(-1).fecha) / 7)), sesiones: ps.length,
    tendencia: Math.abs(porSemana) < umbral ? 'estable' : porSemana > 0 ? 'sube' : 'baja',
  };
}
