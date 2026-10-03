import { validarCambio } from './validador.js';
import { seriesRetiradas } from './series-retiradas.js';
import { registroCardio } from './cardio.js';

// Cambia solo la selección de hoy. Los registros realizados siguen perteneciendo a la persona.
export function prepararSesionVacia(ctx) {
  const { plan, hoy, respuestas, registro = {}, sesiones = [] } = ctx;
  if (!plan?.dias?.length || plan.bloqueado) return { error: 'Primero completa tu perfil y arma tu plan.' };
  if (ctx.derivados.alerta === 'bloqueo') return { error: 'Hay una alerta pendiente de autorización. Completa esa revisión antes de empezar una sesión.' };
  const anterior = plan.dias.find(d => d.fecha === hoy);
  if (anterior?.ejercicios.some(e => e.indicacion)) return { error: 'Hay ejercicios indicados por un profesional. Conserva esa sesión y agrega ejercicios desde el banco.' };
  const nuevo = structuredClone(plan);
  const semanaReal = Math.max(1, Math.floor((Date.parse(hoy) - Date.parse(plan.inicio)) / 604800000) + 1);
  if (!anterior && semanaReal > plan.semanas + 1) return { error: 'Tu plan terminó hace más de una semana. Arma uno nuevo para empezar una sesión vacía.' };
  const lugar = anterior?.lugar || respuestas.lugares?.find(l => l.principal)?.nombre || respuestas.lugares?.[0]?.nombre || 'Casa';
  const dia = { fecha: hoy, semana: anterior?.semana || Math.min(plan.semanas, semanaReal),
    foco: 'Sesión libre', lugar, libre: true, ejercicios: [], calentamiento: [], estiramiento: [], cardio: null, racional: 'Sesión armada por ti desde cero.' };
  nuevo.dias = nuevo.dias.filter(d => d.fecha !== hoy).concat(dia).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const v = validarCambio(plan, nuevo, ctx);
  if (!v.ok) return { error: v.errores.map(e => e.mensaje).join(' ') };
  const conservar = {};
  for (const e of anterior?.ejercicios || []) {
    const series = seriesRetiradas(e, { hoy, registro, sesiones });
    if (series.length) conservar[e.ejercicio_id] = { ejercicio: structuredClone(e), series };
  }
  // También se conserva cardio o ejercicios del historial que no estén en la selección actual.
  const cubiertos = new Set(Object.keys(conservar));
  for (const s of sesiones.find(s => s.fecha === hoy && !s.origen)?.series || []) {
    const id = s.ejercicio_id || `guardado:${s.ejercicio_nombre || 'Cardio'}`;
    if (cubiertos.has(id) || anterior?.ejercicios.some(e => e.ejercicio_id === id && registro[hoy]?.[id])) continue;
    (conservar[id] ||= { ejercicio: { ejercicio_id: s.ejercicio_id, nombre: s.ejercicio_nombre }, series: [] }).series.push(structuredClone(s));
  }
  const cardio = registroCardio(anterior?.cardio, ctx.cardioHecho?.[hoy]);
  if (cardio) {
    for (const [id, entrada] of Object.entries(conservar)) {
      entrada.series = entrada.series.filter(s => !(s.duracion_seg && !s.reps && s.ejercicio_nombre === cardio.ejercicio_nombre));
      if (!entrada.series.length) delete conservar[id];
    }
    conservar[`cardio:${cardio.ejercicio_nombre}`] = { ejercicio: { nombre: cardio.ejercicio_nombre }, series: [cardio] };
  }
  return { plan: nuevo, conservar, cantidad: 0, minutos: 0 };
}
