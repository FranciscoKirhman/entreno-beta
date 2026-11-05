// Preguntas con evidencia y efectos explícitos. Aquí solo se calculan propuestas, nunca se guarda un plan.
import { ritmoPersonal } from './tiempo-sesion.js';
import { tendenciaDescansos, reloj } from './descansos.js';
import { esDeTrabajoGuardada } from './registro.js';
import { leerNota, describir } from './sesion-viva.js';
import { incrementoPara, lugaresDe } from './motor-plan.js';
import { esAsistido, articulacionesBloqueadas } from './catalogo.js';
import { alternativas } from './checkin.js';
import { calcularCambio } from './coach.js';
import { guardarEnBorrador } from './ciclo-siguiente.js';
import { sumarDias } from './agenda.js';

const reserva = s => s.tipo === 'fallo' ? 0 : s.rir != null ? Number(s.rir) : s.rpe != null ? 10 - Number(s.rpe) : null;
const orden = s => `${s.fecha}T${s.hora || '00:00'}`;
const mediana = xs => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const nombre = (indice, id) => indice.porId.get(id)?.nombre || 'Ejercicio';

export function preguntasCoach({ plan, sesiones = [], respuestas = {}, descansos = {}, notas = {}, indice, hoy }) {
  if (!plan?.dias?.length || plan.libre || plan.bloqueado) return [];
  const desde = [plan.inicio || '', sumarDias(hoy, -28)].sort().at(-1);
  const recientes = [...sesiones].filter(s => s.fecha >= desde && s.fecha <= hoy).sort((a, b) => orden(b).localeCompare(orden(a)));
  const bloque = plan.inicio || 'actual', preguntas = [];
  const ultimas = recientes.slice(0, 3), minutos = Number(respuestas.duracion_min);
  if (minutos > 0 && ultimas.length === 3 && ultimas.every(s => Number(s.duracion_min) > minutos)) {
    const real = mediana(ultimas.map(s => Number(s.duracion_min)));
    const ritmo = ritmoPersonal({ sesiones: recientes, plan, porId: indice.porId, hasta: hoy });
    const ids = new Set(ultimas.map(s => s.id));
    const descanso = tendenciaDescansos(Object.fromEntries(Object.entries(descansos).filter(([id]) => ids.has(id))));
    const dato = { sesiones: ultimas.map(s => ({ id: s.id, fecha: s.fecha, minutos: Number(s.duracion_min) })), perfil: minutos, ritmo, descansos: descanso };
    preguntas.push({ id: `tiempo:${bloque}`, tipo: 'tiempo', fecha: ultimas[0].fecha, dato,
      titulo: '¿Cómo acomodamos tu tiempo?',
      texto: `Tus últimas tres sesiones duraron ${ultimas.map(s => s.duracion_min).join(', ')} minutos y tu perfil dice ${minutos}.${ritmo ? ` Tu ritmo medido es ${String(ritmo.factor).replace('.', ',')} veces el estimado.` : ''}${descanso?.basicos ? ` Descansaste ${reloj(descanso.basicos.real)} en los básicos, frente a ${reloj(descanso.basicos.pedido)} pedidos.` : ''}`,
      opciones: [
        { id: 'subir', etiqueta: `Usar ${Math.ceil(real / 5) * 5} minutos en el próximo bloque`, efecto: 'borrador', cambios: { duracion_min: Math.ceil(real / 5) * 5 } },
        { id: 'mantener', etiqueta: `Mantener ${minutos} minutos y sacar lo opcional al empezar`, efecto: 'opcionales' },
        ...(Number(respuestas.dias_meta) > 1 ? [{ id: 'menos', etiqueta: 'Un día menos en el próximo bloque', efecto: 'borrador', cambios: { dias_meta: Number(respuestas.dias_meta) - 1 } }] : []),
      ] });
  }
  const ids = new Set(recientes.flatMap(s => (s.series || []).map(x => x.ejercicio_id).filter(Boolean)));
  for (const id of ids) {
    const xs = recientes.filter(s => (s.series || []).some(x => x.ejercicio_id === id && esDeTrabajoGuardada(x))).slice(0, 2);
    const datos = xs.map(s => {
      const e = plan.dias.find(d => d.fecha === s.fecha)?.ejercicios.find(e => e.ejercicio_id === id);
      let series = (s.series || []).filter(x => x.ejercicio_id === id && esDeTrabajoGuardada(x));
      if ((s.notas || []).some(n => n.ejercicio_id === id && n.respuestas?.comprobacion)) {
        const ultima = series.map(x => x.tipo).lastIndexOf('fallo');
        series = series.filter((_, i) => i !== ultima);
      }
      const reservas = series.map(reserva).filter(x => x != null && Number.isFinite(x));
      return { id: s.id, fecha: s.fecha, pedido: e?.rir, real: reservas.length ? mediana(reservas) : null };
    });
    if (datos.length === 2 && datos.every(d => d.pedido != null && d.real != null && d.real < Number(d.pedido))) {
      preguntas.push({ id: `esfuerzo:${bloque}:${id}`, tipo: 'esfuerzo', ejercicio_id: id, fecha: xs[0].fecha, dato: datos,
        titulo: `${nombre(indice, id)} te costó más`, texto: `En tus últimas dos sesiones dejaste menos repeticiones en reserva de lo pedido: ${datos.map(d => `${d.real} en vez de ${d.pedido}`).join('; ')}. ¿Fue el peso, el cansancio o la técnica?`,
        opciones: [{ id: 'bajar', etiqueta: 'Bajar un escalón', efecto: 'bajar' }, { id: 'nada', etiqueta: 'Fue un mal día, seguir igual', efecto: 'nada' }, { id: 'tecnica', etiqueta: 'Ver la técnica', efecto: 'tecnica' }] });
    }
  }
  // Las notas del día y las guardadas se deduplican por fecha y ejercicio.
  const ocupadas = new Map();
  const anotar = (fecha, id, texto) => {
    if (!id || fecha < desde || fecha > hoy || leerNota(texto) !== 'ocupada') return;
    if (!ocupadas.has(id)) ocupadas.set(id, new Set());
    ocupadas.get(id).add(fecha);
  };
  for (const s of recientes) for (const n of s.notas || []) anotar(s.fecha, n.ejercicio_id, n.nota);
  for (const [f, ns] of Object.entries(notas)) for (const [id, n] of Object.entries(ns || {})) anotar(f, id, typeof n === 'string' ? n : n?.nota);
  for (const [id, fechas] of ocupadas) if (fechas.size >= 2 && plan.dias.some(d => d.fecha >= hoy && d.ejercicios.some(e => e.ejercicio_id === id))) {
    preguntas.push({ id: `ocupada:${bloque}:${id}`, tipo: 'ocupada', ejercicio_id: id, fecha: [...fechas].sort().at(-1), dato: { fechas: [...fechas].sort(), ejercicio_id: id },
      titulo: 'La misma máquina ocupada', texto: `Anotaste ${nombre(indice, id)} como ocupada en ${fechas.size} días distintos. ¿La reemplazamos?`,
      opciones: [{ id: 'reemplazar', etiqueta: 'Reemplazarla desde hoy', efecto: 'reemplazar' }, { id: 'ocasional', etiqueta: 'Solo cuando esté ocupada', efecto: 'ocasional' }] });
  }
  return preguntas.filter(p => !respuestas.preguntas_coach?.[p.id]).sort((a, b) => b.fecha.localeCompare(a.fecha) || a.id.localeCompare(b.id));
}

/** Prepara el efecto sobre una copia. El consumidor debe mostrar detalle y confirmar antes de cambiarPlan. */
export function efectoPregunta(pregunta, opcionId, ctx) {
  const o = pregunta.opciones.find(o => o.id === opcionId);
  if (!o) return { error: 'Esa respuesta ya no está disponible.' };
  const r = ctx.respuestas || {}, id = pregunta.ejercicio_id;
  if (o.efecto === 'borrador') return { respuestas: guardarEnBorrador(r, o.cambios), detalle: `Para el próximo bloque: ${Object.entries(o.cambios).map(([k, v]) => `${k === 'dias_meta' ? 'días por semana' : 'minutos por sesión'} de ${r.ciclo_siguiente?.[k] ?? r[k]} a ${v}`).join(', ')}. El bloque actual sigue igual; confirmarás el siguiente al armarlo.` };
  if (o.efecto === 'opcionales') return { respuestas: { ...r, opcionales_al_empezar: true }, detalle: `Mantienes ${r.duracion_min} minutos. Al empezar, la sesión viva propone sacar los ejercicios opcionales sin empezar, muestra antes y después y permite rechazar durante 10 segundos.` };
  if (o.efecto === 'ocasional') return { detalle: 'El ejercicio se mantiene. Cuando esté ocupada, anótalo en la sesión: la sesión viva propone una alternativa para ese día.' };
  if (o.efecto === 'nada' || o.efecto === 'tecnica') return { detalle: o.efecto === 'tecnica' ? 'Verás la ficha y la técnica del ejercicio. Tu plan sigue igual.' : 'Tu plan sigue igual. Guardaré que fue un mal día.', tecnica: o.efecto === 'tecnica' ? id : null };
  const futuros = (ctx.plan?.dias || []).filter(d => d.fecha >= ctx.hoy && !(ctx.hechas || []).includes(d.fecha) && d.ejercicios.some(e => e.ejercicio_id === id));
  if (!futuros.length) return { error: 'Ese ejercicio ya no tiene sesiones pendientes en este bloque.' };
  // No modifica una sesión en curso: sus series hechas y próximas pertenecen a la sesión viva.
  if (futuros.some(d => (ctx.enCurso || []).includes(d.fecha))) return { error: 'Termina la sesión en curso antes de cambiar este ejercicio para las próximas sesiones.' };
  const lugares = lugaresDe(r), lugarDe = d => lugares.find(l => l.nombre === d.lugar) || lugares.find(l => l.principal) || lugares[0];
  if (o.efecto === 'bajar') {
    const plan = structuredClone(ctx.plan), cambios = [], ej = ctx.indice.porId.get(id);
    if (!ej) return { error: 'No encontré ese ejercicio en el catálogo.' };
    for (const d of plan.dias.filter(d => futuros.some(f => f.fecha === d.fecha))) {
      const e = d.ejercicios.find(e => e.ejercicio_id === id), antes = describir(e), paso = incrementoPara(ej, lugarDe(d));
      if (paso && Number(e.carga_kg) > 0) e.carga_kg = Math.max(0, Math.round((Number(e.carga_kg) + (esAsistido(ej) ? paso : -paso)) * 100) / 100);
      else { e.reps_min = Math.max(1, e.reps_min - 1); e.reps_max = Math.max(e.reps_min, e.reps_max - 1); }
      cambios.push({ fecha: d.fecha, antes, despues: describir(e) });
    }
    return { plan, cambios, detalle: `Bajar un escalón en ${nombre(ctx.indice, id)} para ${cambios.length} sesiones pendientes. En ejercicios asistidos se aumenta la ayuda; sin carga, se pide una repetición menos.` };
  }
  if (o.efecto === 'reemplazar') {
    const prohibidos = new Set(r.prohibidos || []);
    const listas = futuros.map(d => alternativas(id, { indice: ctx.indice, equipamiento: lugarDe(d)?.equipamiento || [], bloqueadas: articulacionesBloqueadas(r.lesiones || [], d.fecha), nivel: ctx.derivados?.nivel, excluir: [...prohibidos, ...d.ejercicios.map(e => e.ejercicio_id)] }));
    const candidato = listas[0]?.find(e => listas.every(xs => xs.some(x => x.id === e.id)));
    if (!candidato) return { error: 'No encontré un reemplazo que sirva en todos tus lugares y sesiones pendientes. Puedes cambiarlo solo el día que esté ocupada.' };
    // Reutiliza la prescripción y las cargas del coach, solo en las fechas pendientes.
    const parcial = { ...ctx.plan, dias: futuros };
    const cambio = calcularCambio({ tipo: 'reemplazar_hoy', fecha: ctx.hoy, de: id, a: candidato.id, alcance: 'adelante' }, { ...ctx, plan: parcial });
    if (cambio.error) return cambio;
    const porFecha = new Map(cambio.plan.dias.map(d => [d.fecha, d]));
    return { plan: { ...ctx.plan, dias: ctx.plan.dias.map(d => porFecha.get(d.fecha) || d) }, detalle: `${cambio.propone} Desde hoy, en ${futuros.length} sesiones pendientes.`,
      cambios: futuros.map(d => ({ fecha: d.fecha, antes: `${nombre(ctx.indice, id)}: ${describir(d.ejercicios.find(e => e.ejercicio_id === id))}`, despues: `${candidato.nombre}: ${describir(porFecha.get(d.fecha).ejercicios.find(e => e.ejercicio_id === candidato.id))}` })) };
  }
  return { error: 'No pude preparar esa respuesta.' };
}

export function responderPregunta(respuestas, pregunta, opcion, fecha) {
  return { ...respuestas, preguntas_coach: { ...respuestas.preguntas_coach, [pregunta.id]: { fecha, opcion, respuesta: pregunta.opciones.find(o => o.id === opcion)?.etiqueta || opcion, dato: pregunta.dato, titulo: pregunta.titulo, texto: pregunta.texto } } };
}
