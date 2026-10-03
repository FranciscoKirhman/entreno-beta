// Resumen del mes o del año, como Hevy: sesiones, tiempo, series, volumen, récords, días entrenados, músculos
// comparados con el período anterior y los ejercicios más hechos. Usa las sesiones guardadas (de la app y de Hevy).
import { esDeTrabajoGuardada } from './registro.js';
import { recordsPorSesion } from './records.js';
import { hechasPorMusculo } from './volumen-semana.js';

const pad = n => String(n).padStart(2, '0');
/** El período que contiene una fecha y el anterior: { desde, hasta, antes: { desde, hasta } }. */
export function periodo(tipo, fecha) {
  const a = Number(fecha.slice(0, 4)), m = Number(fecha.slice(5, 7));
  if (tipo === 'año') return { tipo, desde: `${a}-01-01`, hasta: `${a}-12-31`, antes: { desde: `${a - 1}-01-01`, hasta: `${a - 1}-12-31` } };
  const fin = (y, mm) => `${y}-${pad(mm)}-${pad(new Date(Date.UTC(y, mm, 0)).getUTCDate())}`;
  const am = m === 1 ? [a - 1, 12] : [a, m - 1];
  return { tipo, desde: `${a}-${pad(m)}-01`, hasta: fin(a, m), antes: { desde: `${am[0]}-${pad(am[1])}-01`, hasta: fin(am[0], am[1]) } };
}

function cifras(sesiones, desde, hasta, { indice, asistidos, records }) {
  const xs = sesiones.filter(s => s.fecha >= desde && s.fecha <= hasta);
  const trabajo = xs.flatMap(s => (s.series || []).filter(esDeTrabajoGuardada).map(x => ({ ...x, fecha: s.fecha })));
  const veces = new Map();
  for (const s of xs) for (const id of new Set((s.series || []).filter(esDeTrabajoGuardada).map(x => x.ejercicio_id || `nombre:${x.ejercicio_nombre}`))) veces.set(id, (veces.get(id) || 0) + 1);
  return {
    sesiones: xs.length,
    dias: new Set(xs.map(s => s.fecha)).size,
    minutos: xs.reduce((a, s) => a + (Number(s.duracion_min) || 0), 0),
    series: trabajo.length,
    volumen: Math.round(trabajo.filter(x => !asistidos.has(x.ejercicio_id)).reduce((a, x) => a + (Number(x.carga_kg) || 0) * (Number(x.reps) || 0), 0)),
    records: xs.reduce((a, s) => a + (records.get(s.id || s.fecha)?.length || 0), 0),
    porMusculo: hechasPorMusculo(trabajo, indice, desde, hasta),
    ejercicios: [...veces.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, n]) => ({ id: id.startsWith('nombre:') ? null : id, nombre: id.startsWith('nombre:') ? id.slice(7) : indice.porId.get(id)?.nombre || id, sesiones: n })),
  };
}

/**
 * @param sesiones las guardadas en el teléfono
 * @returns {{periodo, actual, anterior, musculos: [{musculo, series, antes, cambio}]}}
 */
export function resumenPeriodo(sesiones, { tipo = 'mes', fecha, indice, asistidos = new Set() }) {
  const p = periodo(tipo, fecha);
  const records = recordsPorSesion(sesiones, { asistidos });
  const actual = cifras(sesiones, p.desde, p.hasta, { indice, asistidos, records });
  const anterior = cifras(sesiones, p.antes.desde, p.antes.hasta, { indice, asistidos, records });
  const r1 = x => Math.round(x * 10) / 10;
  const musculos = [...new Set([...Object.keys(actual.porMusculo), ...Object.keys(anterior.porMusculo)])]
    .map(m => ({ musculo: m, series: r1(actual.porMusculo[m] || 0), antes: r1(anterior.porMusculo[m] || 0) }))
    .map(x => ({ ...x, cambio: r1(x.series - x.antes) }))
    .sort((a, b) => b.series - a.series || b.antes - a.antes);
  return { periodo: p, actual, anterior, musculos };
}
