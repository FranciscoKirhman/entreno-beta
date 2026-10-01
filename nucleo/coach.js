// Chat del coach. Primero intenta resolver el mensaje con reglas (gratis, al instante y sin señal); solo lo que
// no entiende se manda a la IA (supabase/functions/coach). Las reglas cubren lo más común: faltar, mover un día,
// "hoy no quiero piernas", máquina ocupada, poco tiempo, dormir mal, dolor, "¿por qué?" y "¿qué me toca?".
import { normalizar } from './catalogo.js';
import { marcarFaltada, moverSesion, intercambiar, opcionesParaHoy, sesionDe, sumarDias, diaSemana, nombreDia, familia } from './agenda.js';
import { alternativas, recortarSesion } from './checkin.js';
import { evaluarDia, ajustarSesion, TEXTO_RECOMENDACION } from './bienestar.js';
import { explicarEjercicio } from './explicar.js';
import { planDeCuidado } from './cuidado.js';
import { reconocer } from './importar-plan.js';
import { articulacionesBloqueadas } from './catalogo.js';

const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const ZONAS = { hombro: 'hombro', hombros: 'hombro', codo: 'codo', codos: 'codo', rodilla: 'rodilla', rodillas: 'rodilla', espalda: 'lumbar', lumbar: 'lumbar', cintura: 'lumbar', muneca: 'muneca', munecas: 'muneca', cuello: 'cuello', tobillo: 'tobillo', cadera: 'cadera' };
const FAMILIAS = [[/pierna|piernas|tren inferior|gluteo|cuadriceps/, 'pierna'], [/torso|tren superior|pecho|espalda|brazos?/, 'torso'], [/empuje/, 'empuje'], [/tiron/, 'tiron']];

/** Fecha mencionada en el texto: hoy, mañana, ayer, o un día de la semana (pasado o futuro según el verbo). */
export function fechaMencionada(n, hoy, { pasado = false } = {}) {
  if (/\bpasado manana\b/.test(n)) return sumarDias(hoy, 2);
  if (/\bmanana\b/.test(n)) return sumarDias(hoy, 1);
  if (/\banteayer\b/.test(n)) return sumarDias(hoy, -2);
  if (/\bayer\b/.test(n)) return sumarDias(hoy, -1);
  if (/\bhoy\b/.test(n)) return hoy;
  const m = n.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/);
  if (!m) return null;
  const d = DIAS[m[1]], h = diaSemana(hoy);
  // "El martes" dicho un martes es hoy; si no, el último (pasado) o el próximo (futuro).
  return pasado ? sumarDias(hoy, -(((h - d) + 7) % 7)) : sumarDias(hoy, ((d - h) + 7) % 7);
}

/** Todas las fechas mencionadas, en orden de aparición (para "mueve el martes al jueves"). */
function fechasMencionadas(n, hoy) {
  const out = [];
  for (const m of n.matchAll(/\b(hoy|manana|ayer|lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/g)) out.push(fechaMencionada(m[1], hoy));
  return out;
}

/** Qué quiere la persona. Devuelve {intencion, ...datos} o {intencion: 'desconocida'}. */
export function entender(texto, { hoy, indice, plan }) {
  const n = normalizar(texto);
  const dia = sesionDe(plan || { dias: [] }, hoy);
  const ejercicioEn = () => {
    const candidatos = (dia?.ejercicios || []).map(e => ({ e, n: normalizar(e.nombre || '') }));
    const directo = candidatos.find(c => c.n && n.includes(c.n.split(' ').slice(0, 2).join(' ')));
    if (directo) return directo.e.ejercicio_id;
    const sin = n.replace(/\b(la|el|maquina|esta|ocupada?|no hay|no esta|por que|porque|como se hace|tecnica|video|de|cambia|cambiar)\b/g, ' ');
    return reconocer(sin, indice).ejercicio?.id || null;
  };
  if (/\b(dolor|duele|molestia|me lesione|lesion)\b/.test(n)) {
    const zona = Object.entries(ZONAS).find(([k]) => new RegExp(`\\b${k}\\b`).test(n))?.[1] || null;
    const intensidad = Number((n.match(/\b(\d{1,2})\s*(?:de|\/|sobre)\s*10\b/) || [])[1] ?? NaN);
    return { intencion: 'dolor', zona, intensidad: Number.isFinite(intensidad) ? intensidad : null };
  }
  if (/\b(falte|no fui|no pude ir|me salte|me perdi|no alcance a ir)\b/.test(n)) {
    return { intencion: 'falte', fecha: fechaMencionada(n, hoy, { pasado: true }) || hoy };
  }
  if (/\b(no quiero|no tengo ganas de|prefiero no|otra opcion|otra cosa|cambiar el dia)\b/.test(n) && !/\b(maquina|ocupad)\b/.test(n)) {
    const evitar = FAMILIAS.find(([re]) => re.test(n))?.[1] || (dia ? familia(dia.plantilla) : null);
    return { intencion: 'otra_opcion', evitar };
  }
  if (/\b(mueve|mover|cambia|cambiar|pasa|pasar|cambiame)\b/.test(n) && fechasMencionadas(n, hoy).length) {
    const f = fechasMencionadas(n, hoy);
    return { intencion: 'mover', de: f.length > 1 ? f[0] : hoy, a: f.at(-1) };
  }
  if (/\b(ocupad[ao]s?|no hay|no esta|no tienen|esta malo|esta mala)\b/.test(n)) return { intencion: 'maquina_ocupada', ejercicio: ejercicioEn() };
  const min = n.match(/\b(\d{2,3})\s*(min|minutos)\b/);
  if (min && /\b(tengo|solo|alcanzo|me quedan)\b/.test(n)) return { intencion: 'poco_tiempo', minutos: Number(min[1]) };
  if (/\b(dormi|duermo|cansad[oa]|agotad[oa]|reventad[oa]|sin energia|muerto|muerta|chat[oa])\b/.test(n)) {
    const horas = Number((n.match(/\b(\d{1,2})\s*horas?\b/) || [])[1] ?? NaN);
    return { intencion: 'cansancio', sueno_horas: Number.isFinite(horas) ? horas : null, mal: /\b(mal|poco|nada)\b/.test(n) };
  }
  if (/\b(por que|porque)\b/.test(n)) return { intencion: 'por_que', ejercicio: ejercicioEn() };
  if (/\b(como se hace|tecnica|video|como hago)\b/.test(n)) return { intencion: 'tecnica', ejercicio: ejercicioEn() };
  if (/\b(que (me )?toca|mi rutina|mi sesion|hoy que|que hago hoy|que entreno)\b/.test(n)) return { intencion: 'que_toca' };
  return { intencion: 'desconocida' };
}

const resumenDia = d => `${d.foco} (${nombreDia(d.fecha)} ${Number(d.fecha.slice(8))}): ${d.ejercicios.map(e => e.nombre).join(', ')}.`;

/**
 * Responde con reglas. Devuelve {texto, plan?, opciones?, requiere_ia?, explicacion?, cuidado?}.
 * "opciones" son acciones que la app ofrece como botones; se ejecutan con aplicarOpcion().
 * @param ctx { plan, hoy, respuestas, derivados, indice, evidencia, consentimientos: {cuidado_lesiones} }
 */
export function responder(texto, ctx) {
  const { plan, hoy, respuestas: r = {}, indice } = ctx;
  const q = entender(texto, ctx);
  const noPuedo = r.dias_no_puedo || [];
  const dia = plan ? sesionDe(plan, hoy) : null;
  switch (q.intencion) {
    case 'que_toca':
      if (dia) return { texto: `Hoy toca ${resumenDia(dia)}` };
      return { texto: `Hoy no tienes sesión.${(() => { const p = plan?.dias.find(d => d.fecha > hoy); return p ? ` La próxima es ${resumenDia(p)}` : ''; })()}` };
    case 'falte': {
      const res = marcarFaltada(plan, q.fecha, { hoy, noPuedo });
      if (!res.ok) return { texto: res.error };
      const movs = res.cambios.map(c => `${c.foco}: ${nombreDia(c.de)} → ${nombreDia(c.a)} ${Number(c.a.slice(8))}`);
      return { texto: `Listo, reacomodé la semana.${movs.length ? ' ' + movs.join('; ') + '.' : ''}${res.avisos.length ? ' ' + res.avisos.join(' ') : ''}`, plan: res.plan };
    }
    case 'mover': {
      const res = sesionDe(plan, q.a) ? intercambiar(plan, q.de, q.a) : moverSesion(plan, q.de, q.a, { noPuedo });
      if (!res.ok) return { texto: res.error };
      return { texto: `Hecho: ${res.cambios.map(c => c.tipo === 'intercambiar' ? `intercambié el ${nombreDia(c.fechas[0])} con el ${nombreDia(c.fechas[1])}` : `${c.foco} pasa al ${nombreDia(c.a)} ${Number(c.a.slice(8))}`).join('; ')}.${res.avisos.length ? ' Ojo: ' + res.avisos.join(' ') : ''}`, plan: res.plan };
    }
    case 'otra_opcion': {
      const o = opcionesParaHoy(plan, hoy, { evitar: q.evitar });
      return {
        texto: `${o.hoy ? `Hoy tocaba ${o.hoy.foco}.` : 'Hoy no tenías sesión.'} Estas son tus opciones:`,
        opciones: o.opciones.map(x => ({
          etiqueta: x.tipo === 'intercambiar' ? `Hacer hoy ${x.foco} (del ${nombreDia(x.fecha)}) y cambiar los días` : x.tipo === 'traer' ? `Traer ${x.foco} del ${nombreDia(x.fecha)} a hoy` : x.foco,
          accion: x.tipo === 'intercambiar' ? { tipo: 'intercambiar', fechas: [hoy, x.fecha] } : x.tipo === 'traer' ? { tipo: 'mover', de: x.fecha, a: hoy }
            : x.tipo === 'mover' ? { tipo: 'falte', fecha: hoy } : { tipo: 'descanso_activo', fecha: hoy },
          avisos: x.avisos,
        })),
      };
    }
    case 'maquina_ocupada': {
      if (!dia) return { texto: 'Hoy no tienes sesión.' };
      const id = q.ejercicio && dia.ejercicios.some(e => e.ejercicio_id === q.ejercicio) ? q.ejercicio : null;
      if (!id) return { texto: '¿Qué ejercicio? Elige uno:', opciones: dia.ejercicios.map(e => ({ etiqueta: e.nombre, accion: { tipo: 'elegir_alternativa', fecha: hoy, ejercicio: e.ejercicio_id } })) };
      return opcionesAlternativa(ctx, hoy, id);
    }
    case 'poco_tiempo': {
      if (!dia) return { texto: 'Hoy no tienes sesión.' };
      const corta = recortarSesion(dia.ejercicios, q.minutos);
      const nuevo = structuredClone(plan);
      sesionDe(nuevo, hoy).ejercicios = corta.map((e, i) => ({ ...e, orden: i }));
      return { texto: `Con ${q.minutos} minutos: ${corta.map(e => `${e.nombre} ${e.series}×${e.reps_min}-${e.reps_max}`).join(', ')}. Lo demás se salta hoy.`, plan: nuevo };
    }
    case 'cansancio': {
      const ev = evaluarDia({ sueno_horas: q.sueno_horas ?? (q.mal ? 5 : null), cansancio: 4, sueno_calidad: q.mal ? 2 : 3 });
      if (!dia) return { texto: `Anotado. ${TEXTO_RECOMENDACION[ev.recomendacion]} Hoy no tienes sesión, así que descansa.` };
      return {
        texto: `Gracias por contarme. Te recomiendo: ${TEXTO_RECOMENDACION[ev.recomendacion]}`,
        opciones: [
          { etiqueta: 'Hacerla liviana', accion: { tipo: 'ajustar_hoy', fecha: hoy, recomendacion: 'liviana' } },
          { etiqueta: 'Solo lo principal', accion: { tipo: 'ajustar_hoy', fecha: hoy, recomendacion: 'corta' } },
          { etiqueta: 'Moverla y descansar', accion: { tipo: 'falte', fecha: hoy } },
          { etiqueta: 'Hacerla normal igual', accion: { tipo: 'nada' } },
        ],
      };
    }
    case 'dolor': {
      if (!q.zona) return { texto: '¿Dónde te duele? Hombro, codo, rodilla, espalda baja, muñeca, tobillo, cadera o cuello.' };
      const consentido = ctx.consentimientos?.cuidado_lesiones === true;
      const c = planDeCuidado({ zona: q.zona, intensidad: q.intensidad ?? 3, consentimiento: consentido });
      const zonaHoy = dia ? dia.ejercicios.filter(e => indice.porId.get(e.ejercicio_id)?.carga_articular.includes(q.zona)) : [];
      const opciones = zonaHoy.length ? [{ etiqueta: `Sacar de hoy lo que carga ${q.zona}`, accion: { tipo: 'quitar_zona_hoy', fecha: hoy, zona: q.zona } }] : [];
      if (c.tipo === 'derivar') return { texto: `${c.mensaje} ${c.aviso}`, opciones, cuidado: c };
      if (c.tipo === 'requiere_consentimiento') return { texto: `Puedo darte ejercicios de cuidado para el ${q.zona}. Antes necesito que aceptes esto: "${c.texto}"`, opciones: [{ etiqueta: 'Acepto', accion: { tipo: 'consentir_cuidado', zona: q.zona } }, ...opciones], cuidado: c };
      return { texto: `Ejercicios de cuidado para el ${q.zona} (fase "${c.fase?.nombre}"): ${(c.ejercicios || []).map(e => `${e.nombre} ${e.dosis}`).join('; ')}. ${c.fase?.regla || ''} ${c.aviso}`, opciones, cuidado: c };
    }
    case 'por_que': case 'tecnica': {
      const e = dia?.ejercicios.find(x => x.ejercicio_id === q.ejercicio) || plan?.dias.flatMap(d => d.ejercicios).find(x => x.ejercicio_id === q.ejercicio);
      if (!e) return { texto: '¿De qué ejercicio? Escribe el nombre, por ejemplo "¿por qué hip thrust?".' };
      const d = plan.dias.find(x => x.ejercicios.includes(e));
      const ex = explicarEjercicio({ e, dia: d, plan, respuestas: r, indice, evidencia: ctx.evidencia });
      if (q.intencion === 'tecnica') return { texto: `${ex.ejercicio}: mira cómo se hace aquí.`, enlace: ex.video, explicacion: ex };
      return { texto: ex.motivos.slice(0, 3).map(m => `${m.pregunta} ${m.respuesta}`).join(' '), explicacion: ex };
    }
    default:
      return { texto: 'No estoy seguro de qué necesitas. Puedo reagendar si faltaste, darte otra opción para hoy, cambiar una máquina ocupada, acortar la sesión, ajustarla si dormiste mal, ayudarte con un dolor o explicarte por qué de un ejercicio.', requiere_ia: true };
  }
}

function opcionesAlternativa(ctx, fecha, id) {
  const { plan, respuestas: r = {}, indice } = ctx;
  const dia = sesionDe(plan, fecha);
  const lugar = (r.lugares || []).find(l => l.principal) || (r.lugares || [])[0] || { equipamiento: [] };
  const alts = alternativas(id, { indice, equipamiento: lugar.equipamiento || [], bloqueadas: articulacionesBloqueadas(r.lesiones || [], fecha), nivel: ctx.derivados?.nivel, excluir: dia.ejercicios.map(e => e.ejercicio_id) });
  const nombre = indice.porId.get(id)?.nombre;
  if (!alts.length) return { texto: `No hay otra máquina para ${nombre} con tu equipamiento. Haz los demás y vuelve a ${nombre} al final.` };
  return { texto: `En vez de ${nombre} puedes hacer:`, opciones: alts.map(a => ({ etiqueta: a.nombre, accion: { tipo: 'reemplazar_hoy', fecha, de: id, a: a.id } })) };
}

/** Ejecuta una opción elegida en el chat. Devuelve {texto, plan?, consentimiento?}. */
export function aplicarOpcion(accion, ctx) {
  const { plan, indice } = ctx;
  const noPuedo = ctx.respuestas?.dias_no_puedo || [];
  const nuevo = structuredClone(plan);
  switch (accion.tipo) {
    case 'intercambiar': { const r = intercambiar(plan, ...accion.fechas); return { texto: r.ok ? `Hecho: hoy ${sesionDe(r.plan, accion.fechas[0]).foco}.${r.avisos.length ? ' Ojo: ' + r.avisos.join(' ') : ''}` : r.error, plan: r.ok ? r.plan : undefined }; }
    case 'mover': { const r = moverSesion(plan, accion.de, accion.a, { noPuedo }); return { texto: r.ok ? `Listo: ${sesionDe(r.plan, accion.a).foco} quedó para el ${nombreDia(accion.a)} ${Number(accion.a.slice(8))}.${r.avisos?.length ? ' Ojo: ' + r.avisos.join(' ') : ''}` : r.error, plan: r.ok ? r.plan : undefined }; }
    case 'falte': { const r = marcarFaltada(plan, accion.fecha, { hoy: ctx.hoy, noPuedo }); return { texto: r.ok ? `Reacomodé la semana.${r.avisos.length ? ' ' + r.avisos.join(' ') : ''}` : r.error, plan: r.ok ? r.plan : undefined }; }
    case 'descanso_activo': { const r = marcarFaltada(plan, accion.fecha, { hoy: ctx.hoy, noPuedo }); return { texto: 'Hoy descanso activo: 20 a 30 minutos de caminata o bicicleta suave y movilidad. La sesión pasó a otro día.', plan: r.ok ? r.plan : undefined }; }
    case 'ajustar_hoy': { const d = sesionDe(nuevo, accion.fecha); d.ejercicios = ajustarSesion(d.ejercicios, accion.recomendacion); return { texto: TEXTO_RECOMENDACION[accion.recomendacion], plan: nuevo }; }
    case 'reemplazar_hoy': {
      const d = sesionDe(nuevo, accion.fecha), ej = indice.porId.get(accion.a);
      d.ejercicios = d.ejercicios.map(e => (e.ejercicio_id === accion.de ? { ...e, ejercicio_id: ej.id, nombre: ej.nombre, carga_kg: null, nota: 'Cambiado hoy. Elige un peso con la misma reserva.' } : e));
      return { texto: `Cambiado por ${ej.nombre}.`, plan: nuevo };
    }
    case 'elegir_alternativa': return opcionesAlternativa(ctx, accion.fecha, accion.ejercicio);
    case 'quitar_zona_hoy': {
      const d = sesionDe(nuevo, accion.fecha);
      const quedan = d.ejercicios.filter(e => !indice.porId.get(e.ejercicio_id)?.carga_articular.includes(accion.zona));
      if (!quedan.length) return { texto: 'Todo lo de hoy carga esa zona. Mejor descansa o haz cardio suave, y mueve la sesión.' };
      d.ejercicios = quedan.map((e, i) => ({ ...e, orden: i }));
      return { texto: 'Saqué de hoy lo que carga esa zona.', plan: nuevo };
    }
    case 'consentir_cuidado': return { texto: 'Gracias. Vuelve a contarme la molestia para darte los ejercicios.', consentimiento: 'cuidado_lesiones' };
    default: return { texto: 'Perfecto.' };
  }
}
