// Récords, como en Hevy: al marcar una serie se compara con todo lo anterior de ese ejercicio. Tipos: más peso, mejor
// máximo estimado (1RM), mejor volumen de una serie (peso × repeticiones), más repeticiones con ese peso o más, más
// repeticiones sin peso y más tiempo. La primera vez que se hace un ejercicio no hay récord: no hay con qué comparar.
// En los ejercicios asistidos el peso es la ayuda de la máquina: ahí el récord es usar menos ayuda que nunca, o hacer
// más repeticiones con la misma ayuda o menos.
import { e1rm } from './motor-plan.js';
import { esDeTrabajoGuardada } from './registro.js';

const n = v => (v == null || v === '' ? null : Number(v));
const conPeso = s => n(s.carga_kg) > 0 && n(s.reps) > 0;
const redondo = x => Math.round(x * 10) / 10;

/**
 * Récords que logra una serie contra las anteriores del mismo ejercicio.
 * @param previas series anteriores del ejercicio [{carga_kg, reps, duracion_seg, rir, rpe}] (de trabajo)
 * @returns [{tipo: 'peso' | 'e1rm' | 'volumen' | 'reps_con_peso' | 'reps' | 'duracion' | 'menos_ayuda' | 'reps_con_ayuda', valor, antes}]
 */
export function recordsDeSerie(previas, s, { asistido = false } = {}) {
  if (!previas.length) return [];
  const out = [];
  const kg = n(s.carga_kg), reps = n(s.reps), seg = n(s.duracion_seg);
  const maximo = (xs, f) => xs.reduce((m, x) => Math.max(m, f(x) || 0), 0);
  if (!asistido && conPeso(s)) {
    const pesadas = previas.filter(conPeso);
    const antesPeso = maximo(pesadas, p => n(p.carga_kg));
    if (pesadas.length && kg > antesPeso) out.push({ tipo: 'peso', valor: kg, antes: antesPeso });
    else {
      const conIgualOMas = pesadas.filter(p => n(p.carga_kg) >= kg);
      const antesReps = maximo(conIgualOMas, p => n(p.reps));
      if (conIgualOMas.length && reps > antesReps) out.push({ tipo: 'reps_con_peso', valor: reps, kg, antes: antesReps });
    }
    const antesE = maximo(pesadas, e1rm), e = e1rm(s);
    if (pesadas.length && e > antesE + 0.05) out.push({ tipo: 'e1rm', valor: redondo(e), antes: redondo(antesE) });
    const antesV = maximo(pesadas, p => n(p.carga_kg) * n(p.reps));
    if (pesadas.length && kg * reps > antesV) out.push({ tipo: 'volumen', valor: redondo(kg * reps), antes: redondo(antesV) });
  }
  if (asistido && conPeso(s)) {
    const conAyuda = previas.filter(conPeso);
    const menorAntes = conAyuda.length ? Math.min(...conAyuda.map(p => n(p.carga_kg))) : null; // la menor ayuda usada antes
    if (menorAntes != null && reps >= 5 && kg < menorAntes) out.push({ tipo: 'menos_ayuda', valor: kg, reps, antes: menorAntes });
    else {
      const conIgualOMenos = conAyuda.filter(p => n(p.carga_kg) <= kg);
      const antesReps = maximo(conIgualOMenos, p => n(p.reps));
      if (conIgualOMenos.length && reps > antesReps) out.push({ tipo: 'reps_con_ayuda', valor: reps, kg, antes: antesReps });
    }
  }
  if (reps > 0 && !(kg > 0)) {
    const sinPeso = previas.filter(p => n(p.reps) > 0 && !(n(p.carga_kg) > 0));
    const antes = maximo(sinPeso, p => n(p.reps));
    if (sinPeso.length && reps > antes) out.push({ tipo: 'reps', valor: reps, antes });
  }
  if (seg > 0) {
    const conTiempo = previas.filter(p => n(p.duracion_seg) > 0);
    const antes = maximo(conTiempo, p => n(p.duracion_seg));
    if (conTiempo.length && seg > antes) out.push({ tipo: 'duracion', valor: seg, antes });
  }
  return out;
}

/** Récords de una sesión: cada serie de trabajo contra lo anterior y contra las series previas de la misma sesión. */
export function recordsDeSesion(historial, series, { asistidos = new Set() } = {}) {
  const out = [];
  const vistas = new Map();
  for (const s of series) {
    if (!s.ejercicio_id) continue;
    const previas = [...historial.filter(h => h.ejercicio_id === s.ejercicio_id), ...(vistas.get(s.ejercicio_id) || [])];
    for (const r of recordsDeSerie(previas, s, { asistido: asistidos.has(s.ejercicio_id) })) out.push({ ...r, ejercicio_id: s.ejercicio_id, serie: s });
    vistas.set(s.ejercicio_id, [...(vistas.get(s.ejercicio_id) || []), s]);
  }
  // Por ejercicio y tipo, el mejor de la sesión (si dos series superan el récord, cuenta la mejor).
  const mejor = new Map();
  for (const r of out) {
    const k = `${r.ejercicio_id}|${r.tipo}${['reps_con_peso', 'reps_con_ayuda'].includes(r.tipo) ? `|${r.kg}` : ''}`;
    const supera = (x, y) => (x.tipo === 'menos_ayuda' ? x.valor < y.valor : x.valor > y.valor); // en la ayuda, menos es mejor
    if (!mejor.has(k) || supera(r, mejor.get(k))) mejor.set(k, r);
  }
  return [...mejor.values()];
}

/** El mejor peso para cada número de repeticiones (1 a 15), como "Set records" de Hevy. */
export function recordsPorRepeticiones(series) {
  const mejor = new Map();
  for (const s of series.filter(conPeso)) {
    const r = n(s.reps);
    if (r > 15) continue;
    if (!mejor.has(r) || n(s.carga_kg) > mejor.get(r).carga_kg) mejor.set(r, { reps: r, carga_kg: n(s.carga_kg), fecha: s.fecha });
  }
  return [...mejor.values()].sort((a, b) => a.reps - b.reps);
}

/**
 * Récords de cada sesión guardada contra todas las anteriores, para marcarlos en el historial. Recorre las sesiones
 * en orden una sola vez.
 * @returns Map de la id de la sesión (o su fecha, si no tiene) a sus récords [{tipo, valor, ejercicio_id, ...}]
 */
export function recordsPorSesion(sesiones, { asistidos = new Set() } = {}) {
  const orden = [...sesiones].sort((a, b) => `${a.fecha} ${a.hora || ''}`.localeCompare(`${b.fecha} ${b.hora || ''}`));
  const previas = new Map(), out = new Map();
  for (const ses of orden) {
    const trabajo = (ses.series || []).filter(s => s.ejercicio_id && esDeTrabajoGuardada(s))
      .map(s => ({ ejercicio_id: s.ejercicio_id, carga_kg: s.carga_kg ?? null, reps: s.reps ?? null, duracion_seg: s.duracion_seg ?? null, rir: s.rir ?? null }));
    const ids = new Set(trabajo.map(s => s.ejercicio_id));
    const historial = [...ids].flatMap(id => previas.get(id) || []);
    const recs = recordsDeSesion(historial, trabajo, { asistidos });
    if (recs.length) out.set(ses.id || ses.fecha, recs);
    for (const s of trabajo) (previas.get(s.ejercicio_id) || previas.set(s.ejercicio_id, []).get(s.ejercicio_id)).push(s);
  }
  return out;
}

/**
 * El récord al alcance antes de hacer una serie: con el peso que ya está puesto, cuántas repeticiones faltan para
 * superar algo de lo anterior. Solo se dice cuando conviene buscarlo: si queda a `margen` repeticiones o menos de las
 * que la serie ya pide, nunca en una descarga ni en un ejercicio asistido (ahí el récord es bajar la ayuda).
 * @param previas  series de trabajo anteriores del ejercicio, con las ya hechas hoy
 * @param serie    {carga_kg, reps} lo que pide la serie que viene
 * @returns {{reps: number, extra: number, tipo: 'peso' | 'reps_con_peso' | 'e1rm' | 'reps'} | null}
 *          reps: las que dan récord; extra: cuántas más que las pedidas (0 si con las pedidas ya lo es)
 */
export function recordAlAlcance(previas, serie, { asistido = false, descarga = false, margen = 2, tope = 30 } = {}) {
  const kg = n(serie?.carga_kg), pedidas = n(serie?.reps);
  if (asistido || descarga || !previas?.length || !(pedidas > 0)) return null;
  const sirve = new Set(kg > 0 ? ['peso', 'reps_con_peso', 'e1rm'] : ['reps']);
  for (let reps = pedidas; reps <= Math.min(pedidas + margen, tope); reps++) {
    const r = recordsDeSerie(previas, { carga_kg: kg, reps }).find(x => sirve.has(x.tipo));
    if (r) return { reps, extra: reps - pedidas, tipo: r.tipo };
  }
  return null;
}

/** La frase del récord al alcance, para la tarjeta de la serie que sigue. */
export function textoRecordAlAlcance(r) {
  if (!r) return '';
  if (r.tipo === 'peso') return 'Con este peso ya es récord';
  return r.extra === 0 ? `Con ${r.reps} repeticiones es récord` : `Con ${r.extra} más (${r.reps}) es récord`;
}
