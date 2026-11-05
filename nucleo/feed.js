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

/** Una identidad por hecho; las vistas pasan al historial. Las preguntas respondidas nunca vuelven al feed. */
export function armarFeed({ sesiones = [], plan = null, indice, hoy, progresionSesion = {}, vivaHecho = {}, feedVistas = {}, respuestas = {}, marcas = {}, descansos = {}, notas = {} }) {
  const tarjetas = [], asistidos = new Set(indice.ejercicios.filter(esAsistido).map(e => e.id));
  const ss = [...sesiones].filter(s => s.fecha <= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''));
  const records = recordsPorSesion(ss, { asistidos });
  const series = ss.flatMap(s => (s.series || []).filter(esDeTrabajoGuardada).map(x => ({ ...x, fecha: s.fecha })));
  for (const s of ss) {
    const ids = new Set();
    for (const r of records.get(s.id || s.fecha) || []) {
      if (ids.has(r.ejercicio_id)) continue;
      ids.add(r.ejercicio_id);
      tarjetas.push({ id: `record:${s.id || s.fecha}:${r.ejercicio_id}`, tipo: 'avance', fecha: s.fecha, titulo: `Récord en ${nombre(indice, r.ejercicio_id)}`,
        texto: r.tipo === 'menos_ayuda' ? 'Usaste menos ayuda que antes.' : 'Superaste una de tus marcas anteriores.', serie: r.serie, ejercicio_id: r.ejercicio_id });
    }
  }
  for (const id of new Set(series.map(s => s.ejercicio_id).filter(Boolean))) {
    if (asistidos.has(id)) continue;
    const puntos = porSesion(series, id).filter(p => p.e1rm > 0).slice(-8);
    if (puntos.length < 2) continue;
    const ultimo = puntos.at(-1), primero = puntos[0];
    tarjetas.push({ id: `fuerza:${id}:${ultimo.fecha}`, tipo: 'avance', fecha: ultimo.fecha, ejercicio_id: id, titulo: `Tu fuerza en ${nombre(indice, id)}`,
      texto: 'Máximo estimado a partir de tus series, no es una prueba de fuerza máxima.', puntos: puntos.map(p => ({ fecha: p.fecha, valor: p.e1rm })), antes: primero.e1rm, ahora: ultimo.e1rm });
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
    tarjetas.push({ id: `progresion:${id}:${r.huella || r.cuando}`, tipo: 'cambio', cuando: r.cuando, fecha: s?.fecha || hoy, titulo: 'Para la próxima', texto: (r.cambios || []).map(c => `${c.nombre}: ${c.motivo}`).join(' '), sesionId: id, cambios: r.cambios || [] });
  }
  for (const [fecha, cambios] of Object.entries(vivaHecho).filter(([f]) => f <= hoy)) for (const [id, c] of Object.entries(cambios || {})) {
    tarjetas.push({ id: `viva:${fecha}:${id}`, tipo: 'cambio', fecha, cuando: c.t, titulo: 'Ajuste durante la sesión', texto: `${c.hecho || 'Sesión ajustada'}. ${c.motivo || ''}`, antes: c.antes, ahora: c.ahora });
  }
  for (const d of sesionesPorRevisar(plan, ss, { hoy, marcas })) tarjetas.push({ id: `falta:${d.fecha}`, tipo: 'falta', fecha: d.fecha, titulo: `${d.foco} quedó sin registro`, texto: 'Revisa si la hiciste o elige cómo recuperarla.', accion: 'revisar' });
  const preguntas = preguntasCoach({ plan, sesiones: ss, respuestas, descansos, notas, indice, hoy });
  tarjetas.push(...preguntas.map(p => ({ ...p, tipo: 'pregunta', pregunta: p })));
  const unicas = [...new Map(tarjetas.map(t => [t.id, t])).values()].sort(ordenar);
  let abiertas = 0;
  const nuevas = unicas.filter(t => !feedVistas[t.id] && (t.tipo !== 'pregunta' || ++abiertas <= 2));
  const historial = new Map(unicas.filter(t => feedVistas[t.id]).map(t => [t.id, t]));
  for (const [id, v] of Object.entries(feedVistas)) if (v.tarjeta) historial.set(id, v.tarjeta);
  for (const [id, r] of Object.entries(respuestas.preguntas_coach || {})) historial.set(id, { id, tipo: 'respondida', fecha: r.fecha, titulo: r.titulo || 'Pregunta respondida', texto: r.texto, respuesta: r.respuesta || r.opcion });
  return { nuevas, historial: [...historial.values()].sort(ordenar) };
}

export const verTarjeta = (vistas, tarjeta, cuando = Date.now()) => ({ ...vistas, [tarjeta.id]: { cuando, tarjeta: structuredClone(tarjeta) } });
