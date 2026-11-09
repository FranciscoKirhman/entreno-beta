import { recordsPorSesion } from './records.js';
import { porSesion } from './progreso-ejercicio.js';
import { esDeTrabajoGuardada } from './registro.js';
import { esAsistido } from './catalogo.js';
import { sesionesPorRevisar } from './sin-registro.js';
import { preguntasCoach } from './preguntas-coach.js';
import { sumarDias, diaSemana } from './agenda.js';

const fechaNumero = f => Date.parse(f.length === 10 ? `${f}T12:00:00Z` : f) || 0;
const ordenar = (a, b) => (b.cuando || fechaNumero(b.fecha)) - (a.cuando || fechaNumero(a.fecha)) || a.id.localeCompare(b.id);
const nombre = (indice, id) => indice.porId.get(id)?.nombre || 'Ejercicio';
const lunes = f => sumarDias(f, -((diaSemana(f) + 6) % 7));
const lista = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);
// Lo que pide una respuesta va primero: las preguntas abiertas y las sesiones sin registro. Antes quedaban detrás de
// las tarjetas de avance del mismo día (el orden por id ponía "fuerza" y "record" antes de "tiempo").
const accionable = t => (t.tipo === 'pregunta' || t.tipo === 'falta' ? 0 : 1);

/** Una identidad por hecho; las vistas pasan al historial. Las preguntas respondidas nunca vuelven al feed. */
export function armarFeed({ sesiones = [], plan = null, indice, hoy, progresionSesion = {}, vivaHecho = {}, feedVistas = {}, respuestas = {}, marcas = {}, descansos = {}, notas = {}, saludFeed = {} }) {
  const tarjetas = [], asistidos = new Set(indice.ejercicios.filter(esAsistido).map(e => e.id));
  const ss = [...sesiones].filter(s => s.fecha <= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''));
  const records = recordsPorSesion(ss, { asistidos });
  const series = ss.flatMap(s => (s.series || []).filter(esDeTrabajoGuardada).map(x => ({ ...x, fecha: s.fecha })));
  // Los récords de una sesión van juntos, en una tarjeta: una por ejercicio llenaba el feed (6 a 9 tarjetas por sesión).
  const conRecord = new Map(); // fecha → ids con récord ese día
  for (const s of ss) {
    const recs = [...new Map((records.get(s.id || s.fecha) || []).map(r => [r.ejercicio_id, r])).values()];
    if (!recs.length) continue;
    for (const r of recs) (conRecord.get(s.fecha) || conRecord.set(s.fecha, new Set()).get(s.fecha)).add(r.ejercicio_id);
    const uno = recs.length === 1 ? recs[0] : null;
    tarjetas.push({ id: `record:${s.id || s.fecha}`, tipo: 'avance', fecha: s.fecha, titulo: uno ? `Récord en ${nombre(indice, uno.ejercicio_id)}` : `${recs.length} récords`,
      texto: uno ? (uno.tipo === 'menos_ayuda' ? 'Usaste menos ayuda que antes.' : 'Superaste una de tus marcas anteriores.') : `En ${lista(recs.map(r => nombre(indice, r.ejercicio_id)))}.`,
      ...(uno ? { serie: uno.serie, ejercicio_id: uno.ejercicio_id } : { records: recs.map(r => ({ ejercicio_id: r.ejercicio_id, nombre: nombre(indice, r.ejercicio_id), serie: r.serie })) }) });
  }
  // La fuerza, una tarjeta por día con lo que más subió (hasta 3 ejercicios, el gráfico del primero). Lo que tuvo récord
  // ese día ya tiene su tarjeta, y lo que bajó no se muestra como avance.
  const fuerzaPorDia = new Map();
  for (const id of new Set(series.map(s => s.ejercicio_id).filter(Boolean))) {
    if (asistidos.has(id)) continue;
    const puntos = porSesion(series, id).filter(p => p.e1rm > 0).slice(-8);
    if (puntos.length < 2) continue;
    const ultimo = puntos.at(-1), primero = puntos[0], cambio = (ultimo.e1rm / primero.e1rm - 1) * 100;
    if (!(cambio >= 1) || conRecord.get(ultimo.fecha)?.has(id)) continue;
    (fuerzaPorDia.get(ultimo.fecha) || fuerzaPorDia.set(ultimo.fecha, []).get(ultimo.fecha)).push({ id, puntos, antes: primero.e1rm, ahora: ultimo.e1rm, cambio });
  }
  for (const [fecha, xs] of fuerzaPorDia) {
    const top = xs.sort((a, b) => b.cambio - a.cambio || a.id.localeCompare(b.id)).slice(0, 3), m = top[0];
    tarjetas.push({ id: `fuerza:${fecha}`, tipo: 'avance', fecha, ejercicio_id: m.id, titulo: top.length === 1 ? `Tu fuerza en ${nombre(indice, m.id)}` : 'Tu fuerza sube',
      texto: `${top.map(x => `${nombre(indice, x.id)} +${Math.round(x.cambio)}%`).join(', ')}, desde tus primeras series de las últimas 8 sesiones. Es un máximo estimado, no una prueba de fuerza máxima.`,
      puntos: m.puntos.map(p => ({ fecha: p.fecha, valor: p.e1rm })), antes: m.antes, ahora: m.ahora });
  }
  const semanas = [...new Set(ss.filter(s => (s.series || []).some(esDeTrabajoGuardada)).map(s => lunes(s.fecha)))].sort();
  let racha = 0, anterior;
  for (const semana of semanas) {
    racha = anterior && sumarDias(anterior, 7) === semana ? racha + 1 : 1;
    anterior = semana;
    if (racha >= 2) tarjetas.push({ id: `racha:${semana}`, tipo: 'avance', fecha: ss.find(s => lunes(s.fecha) === semana)?.fecha || semana, titulo: `${racha} semanas seguidas entrenando`, texto: 'Al menos una sesión registrada en cada semana.', accion: 'progreso' });
  }
  for (const [id, r] of Object.entries(progresionSesion)) if (r.estado === 'aplicado') {
    const s = ss.find(s => s.id === id);
    tarjetas.push({ id: `progresion:${id}:${r.huella || r.cuando}`, tipo: 'cambio', cuando: r.cuando, fecha: s?.fecha || hoy, titulo: 'Para la próxima', texto: r.cambios?.length === 1 ? 'Cambia 1 ejercicio.' : `Cambian ${r.cambios?.length || 0} ejercicios.`, sesionId: id, cambios: r.cambios || [] });
  }
  for (const [fecha, cambios] of Object.entries(vivaHecho).filter(([f]) => f <= hoy)) for (const [id, c] of Object.entries(cambios || {})) {
    tarjetas.push({ id: `viva:${fecha}:${id}`, tipo: 'cambio', fecha, cuando: c.t, titulo: 'Ajuste durante la sesión', texto: `${c.hecho || 'Sesión ajustada'}. ${c.motivo || ''}`, antes: c.antes, ahora: c.ahora });
  }
  for (const d of sesionesPorRevisar(plan, ss, { hoy, marcas })) tarjetas.push({ id: `falta:${d.fecha}`, tipo: 'falta', fecha: d.fecha, titulo: `${d.foco} quedó sin registro`, texto: 'Revisa si la hiciste o elige cómo recuperarla.', accion: 'revisar' });
  const preguntas = preguntasCoach({ plan, sesiones: ss, respuestas, descansos, notas, saludFeed, indice, hoy });
  tarjetas.push(...preguntas.map(p => ({ ...p, tipo: 'pregunta', pregunta: p })));
  const unicas = [...new Map(tarjetas.map(t => [t.id, t])).values()].sort(ordenar);
  let abiertas = 0;
  const nuevas = unicas.filter(t => !feedVistas[t.id] && (t.tipo !== 'pregunta' || ++abiertas <= 2)).sort((a, b) => accionable(a) - accionable(b) || ordenar(a, b));
  const historial = new Map(unicas.filter(t => feedVistas[t.id]).map(t => [t.id, t]));
  for (const [id, v] of Object.entries(feedVistas)) if (v.tarjeta) historial.set(id, v.tarjeta);
  for (const [id, r] of Object.entries(respuestas.preguntas_coach || {})) historial.set(id, { id, tipo: 'respondida', fecha: r.fecha, titulo: r.titulo || 'Pregunta respondida', texto: r.texto, respuesta: r.respuesta || r.opcion });
  for (const [id, r] of Object.entries(saludFeed.respuestas || {})) historial.set(id, { id, tipo: 'respondida', fecha: r.fecha, titulo: r.titulo, texto: r.texto, respuesta: r.respuesta, salud: true });
  return { nuevas, historial: [...historial.values()].sort(ordenar) };
}

export const verTarjeta = (vistas, tarjeta, cuando = Date.now()) => ({ ...vistas, [tarjeta.id]: { cuando, tarjeta: structuredClone(tarjeta) } });

/** La presentación no archiva ni modifica tarjetas. Preguntas y sesiones pendientes no comparten el tope. */
export function seleccionarTarjetasFeed(feed, { historial = false, verTodo = false } = {}) {
  const todas = historial ? feed.historial : feed.nuevas;
  if (verTodo) return { tarjetas: [...todas], hayMas: false };
  let informativas = 0;
  const tarjetas = todas.filter(t => !historial && accionable(t) === 0 || ++informativas <= 3);
  return { tarjetas, hayMas: tarjetas.length < todas.length };
}
