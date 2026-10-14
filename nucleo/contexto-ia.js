// Lo que la IA lee además del plan (ver_resumen): cómo se sintieron las últimas sesiones, el esfuerzo anotado, las
// respuestas de los check-ins, la tendencia de los ejercicios principales y los ejercicios favoritos o evitados.
// Va resumido (pocas cifras por tema) para gastar menos y que la IA explique con datos reales, no inventados.
import { porSesion, ritmo } from './progreso-ejercicio.js';

const SENTIR = { facil: 'muy fácil', justo: 'justo', brutal: 'brutal' };
const fechaDe = s => String(s.inicio || s.fecha || '').slice(0, 10);
const deTrabajo = x => x.tipo !== 'calentamiento';
const promedio = xs => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);
const rpeDe = x => (x.rpe != null ? Number(x.rpe) : x.rir != null ? 10 - Number(x.rir) : null);

/**
 * @param historial sesiones con series (como datos.historial): {id, inicio, titulo, series:[{ejercicio_id, tipo, carga_kg, reps, rir, rpe}]}
 * @param sensaciones {[id de sesión]: 'facil'|'justo'|'brutal'}
 * @param checkins [{creado, respuestas: {semana, energia, sueno, estres, obstaculos}}]
 */
export function contextoIA({ historial = [], sensaciones = {}, checkins = [], indice, hoy, respuestas = {} }) {
  const nombre = id => indice?.porId.get(id)?.nombre || id;
  const sesiones = [...historial].sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)));
  const ultimas = sesiones.slice(0, 6).map(s => {
    const trabajo = (s.series || []).filter(deTrabajo), rpes = trabajo.map(rpeDe).filter(v => v != null);
    return { fecha: fechaDe(s), titulo: s.titulo || null, series_trabajo: trabajo.length, rpe_promedio: promedio(rpes),
      ...(sensaciones[s.id] ? { se_sintio: SENTIR[sensaciones[s.id]] || sensaciones[s.id] } : {}) };
  });
  const desde = new Date(Date.parse(hoy + 'T12:00:00Z') - 13 * 864e5).toISOString().slice(0, 10);
  const recientes = sesiones.filter(s => fechaDe(s) >= desde).flatMap(s => (s.series || []).filter(deTrabajo));
  const rpes = recientes.map(rpeDe).filter(v => v != null);
  const esfuerzo = { series_trabajo: recientes.length, con_esfuerzo_anotado: rpes.length, rpe_promedio: promedio(rpes), al_fallo: rpes.filter(v => v >= 10).length };
  // Tendencia de los 5 ejercicios más hechos con peso: máximo estimado y cuánto cambia por semana.
  const series = sesiones.flatMap(s => (s.series || []).filter(deTrabajo).map(x => ({ ...x, fecha: fechaDe(s) })));
  const veces = new Map();
  for (const x of series) if (x.ejercicio_id && Number(x.carga_kg) > 0) veces.set(x.ejercicio_id, (veces.get(x.ejercicio_id) || 0) + 1);
  const tendencias = [...veces].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => {
    const filas = porSesion(series, id), r = ritmo(filas, hoy, { campo: 'e1rm' });
    const ult = filas.at(-1);
    return { ejercicio: nombre(id), ultimo_maximo_estimado_kg: ult?.e1rm ?? null, ultima_vez: ult?.fecha ?? null,
      ...(r ? { tendencia: r.tendencia, kg_por_semana: Math.round(r.porSemana * 10) / 10 } : { tendencia: 'sin datos suficientes' }) };
  });
  const ultimosCheckins = [...checkins].sort((a, b) => String(b.creado).localeCompare(String(a.creado))).slice(0, 3).map(c => {
    const r = c.respuestas || {};
    return { semana: r.semana ?? null, energia: r.energia ?? null, sueno: r.sueno ?? null, estres: r.estres ?? null, faltas_por: r.obstaculos?.length ? r.obstaculos : null };
  });
  return {
    ultimas_sesiones: ultimas, esfuerzo_ultimas_2_semanas: esfuerzo, ultimos_checkins: ultimosCheckins, tendencias,
    ejercicios_favoritos: (respuestas.favoritos || []).map(nombre), ejercicios_evitados: (respuestas.prohibidos || []).map(nombre),
  };
}
