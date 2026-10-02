// Chat del coach. Primero intenta resolver el mensaje con reglas (gratis, al instante y sin señal); solo lo que
// no entiende se manda a la IA (supabase/functions/coach). Las reglas cubren lo más común: faltar, mover un día,
// "hoy no quiero piernas", máquina ocupada, poco tiempo, dormir mal, dolor, "¿por qué?" y "¿qué me toca?".
// Nada cambia el plan sin preguntar: primero se muestra cómo queda la sesión de hoy o la semana, y se aplica solo
// cuando la persona confirma (y elige si es solo hoy o desde hoy en adelante, cuando corresponde).
import { normalizar } from './catalogo.js';
import { marcarFaltada, moverSesion, intercambiar, opcionesParaHoy, sesionDe, sumarDias, diaSemana, nombreDia, familia } from './agenda.js';
import { alternativas, recortarSesion } from './checkin.js';
import { evaluarDia, ajustarSesion, TEXTO_RECOMENDACION } from './bienestar.js';
import { explicarEjercicio } from './explicar.js';
import { contextoDolor } from './dolor.js';
import { planDeCuidado } from './cuidado.js';
import { reconocer } from './importar-plan.js';
import { articulacionesBloqueadas } from './catalogo.js';
import { duracionEstimada } from './motor-plan.js';

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
  if (/\b(dolor|duele|molestia|me lesione|lesion|hormigueo|adormecimiento|hinchazon|chasquido|deformidad|fiebre|falta de aire)\b/.test(n)) {
    const zona = Object.entries(ZONAS).find(([k]) => new RegExp(`\\b${k}\\b`).test(n))?.[1] || null;
    // Leer la escala antes de normalizar: normalizar() borra la barra y los decimales.
    const escala = String(texto).toLowerCase().match(/(?:^|[^\d.,])(-?\d+(?:[.,]\d+)?)\s*(?:de|\/|sobre)\s*10\b/);
    const intensidad = escala ? Number(escala[1].replace(',', '.')) : NaN;
    return { intencion: 'dolor', zona, intensidad: Number.isFinite(intensidad) && intensidad >= 0 && intensidad <= 10 ? intensidad : null };
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
    case 'falte': return vistaPrevia({ tipo: 'falte', fecha: q.fecha }, ctx);
    case 'mover': return vistaPrevia(sesionDe(plan, q.a) ? { tipo: 'intercambiar', fechas: [q.de, q.a] } : { tipo: 'mover', de: q.de, a: q.a }, ctx);
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
      return vistaPrevia({ tipo: 'recortar_hoy', fecha: hoy, minutos: q.minutos }, ctx);
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
      const contexto = contextoDolor(texto, ctx.indicaciones || [], hoy, q.zona);
      if (contexto.senales.length || q.intensidad >= 7) {
        const c = planDeCuidado({ zona: q.zona, intensidad: q.intensidad, ...contexto });
        return { texto: `${c.mensaje} ${c.aviso}`, cuidado: c };
      }
      if (!q.zona) return { texto: '¿Dónde te duele? Hombro, codo, rodilla, espalda baja, muñeca, tobillo, cadera o cuello.' };
      if (q.intensidad == null) return { texto: `¿Cuánto te duele el ${q.zona}, de 0 a 10? Escríbelo con la zona, por ejemplo: "Me duele el ${q.zona} 4/10". Antes de darte ejercicios necesito conocer la intensidad.` };
      const consentido = ctx.consentimientos?.cuidado_lesiones === true;
      const c = planDeCuidado({ zona: q.zona, intensidad: q.intensidad, consentimiento: consentido, ...contexto });
      const zonaHoy = dia ? dia.ejercicios.filter(e => indice.porId.get(e.ejercicio_id)?.carga_articular.includes(q.zona)) : [];
      const opciones = zonaHoy.length ? [{ etiqueta: `Sacar de hoy lo que carga ${q.zona}`, accion: { tipo: 'quitar_zona_hoy', fecha: hoy, zona: q.zona } }] : [];
      if (c.tipo === 'derivar') return { texto: `${c.mensaje} ${c.aviso}`, opciones, cuidado: c };
      if (c.tipo === 'requiere_consentimiento') return { texto: `Puedo darte ejercicios de cuidado para el ${q.zona}. Antes necesito que aceptes esto: "${c.texto}"`, opciones: [{ etiqueta: 'Acepto', accion: { tipo: 'consentir_cuidado', zona: q.zona } }, ...opciones], cuidado: c };
      if (c.tipo === 'requiere_contexto' || c.tipo === 'indicacion') return { texto: `${c.mensaje} ${c.aviso}`, opciones, cuidado: c };
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

// ── Cambios al plan: primero la vista previa, después la confirmación ──────────────
const CAMBIAN_PLAN = new Set(['intercambiar', 'mover', 'falte', 'descanso_activo', 'ajustar_hoy', 'recortar_hoy', 'reemplazar_hoy', 'quitar_zona_hoy']);
const fechaCorta = f => `${nombreDia(f)} ${Number(f.slice(8))}`;
const prescCorta = e => `${e.nombre} ${e.series}×${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${e.unidad === 'seg' ? ' s' : ''}`;
const finDeSemana = f => sumarDias(f, (7 - diaSemana(f)) % 7);
const movidas = cambios => cambios.map(c => (c.tipo === 'intercambiar' ? `el ${nombreDia(c.fechas[0])} y el ${nombreDia(c.fechas[1])} se cambian` : `${c.foco} del ${nombreDia(c.de)} al ${fechaCorta(c.a)}`));

/**
 * Hace el cambio sobre una copia del plan (no guarda nada). Devuelve {plan, propone, hecho, ir} o {error}.
 *   propone: cómo quedaría, para preguntar; hecho: lo que se dice al aplicarlo; ir: 'hoy' o 'semana'.
 */
export function calcularCambio(accion, ctx) {
  const { plan, indice } = ctx;
  const noPuedo = ctx.respuestas?.dias_no_puedo || [];
  const nuevo = structuredClone(plan);
  const sesionHoy = (fecha, ejercicios, frase) => {
    const antes = duracionEstimada(sesionDe(plan, fecha).ejercicios), despues = duracionEstimada(ejercicios);
    return `${frase} ${ejercicios.map(prescCorta).join(', ')} (unos ${despues} minutos${despues !== antes ? `, en vez de ${antes}` : ''}).`;
  };
  switch (accion.tipo) {
    case 'intercambiar': {
      const r = intercambiar(plan, ...accion.fechas);
      if (!r.ok) return { error: r.error };
      const [a, b] = accion.fechas;
      return { plan: r.plan, ir: 'semana', propone: `Cambiaría el ${fechaCorta(a)} con el ${fechaCorta(b)}: el ${nombreDia(a)} harías ${sesionDe(r.plan, a).foco} y el ${nombreDia(b)}, ${sesionDe(r.plan, b).foco}.${r.avisos.length ? ' Ojo: ' + r.avisos.join(' ') : ''}`, hecho: `Listo: el ${nombreDia(a)} haces ${sesionDe(r.plan, a).foco}.` };
    }
    case 'mover': {
      const r = moverSesion(plan, accion.de, accion.a, { noPuedo });
      if (!r.ok) return { error: r.error };
      const foco = sesionDe(r.plan, accion.a).foco;
      return { plan: r.plan, ir: 'semana', propone: `${foco} pasaría del ${fechaCorta(accion.de)} al ${fechaCorta(accion.a)}.${r.avisos?.length ? ' Ojo: ' + r.avisos.join(' ') : ''}`, hecho: `Listo: ${foco} quedó para el ${fechaCorta(accion.a)}.` };
    }
    case 'falte': case 'descanso_activo': {
      const r = marcarFaltada(plan, accion.fecha, { hoy: ctx.hoy, noPuedo });
      if (!r.ok) return { error: r.error };
      const movs = movidas(r.cambios);
      const semana = movs.length ? `la semana quedaría así: ${movs.join('; ')}.` : 'no queda un día libre esta semana para recuperarla.';
      const inicio = accion.tipo === 'descanso_activo' ? `Hoy harías descanso activo (20 a 30 minutos de caminata o bicicleta suave y movilidad) y ${semana}` : `Si marco que faltaste el ${fechaCorta(accion.fecha)}, ${semana}`;
      return { plan: r.plan, ir: 'semana', propone: `${inicio}${r.avisos.length ? ' ' + r.avisos.join(' ') : ''}`, hecho: accion.tipo === 'descanso_activo' ? 'Listo: hoy descanso activo, y reacomodé la semana.' : 'Listo, reacomodé la semana.' };
    }
    case 'ajustar_hoy': {
      const d = sesionDe(nuevo, accion.fecha);
      d.ejercicios = ajustarSesion(d.ejercicios, accion.recomendacion).map((e, i) => ({ ...e, orden: i }));
      return { plan: nuevo, ir: 'hoy', propone: sesionHoy(accion.fecha, d.ejercicios, `${TEXTO_RECOMENDACION[accion.recomendacion]} Hoy quedaría:`), hecho: 'Listo, ajusté la sesión de hoy.' };
    }
    case 'recortar_hoy': {
      const d = sesionDe(nuevo, accion.fecha);
      d.ejercicios = recortarSesion(d.ejercicios, accion.minutos).map((e, i) => ({ ...e, orden: i }));
      return { plan: nuevo, ir: 'hoy', propone: `${sesionHoy(accion.fecha, d.ejercicios, `Con ${accion.minutos} minutos, hoy quedaría:`)} Lo demás se salta hoy.`, hecho: `Listo: la sesión de hoy quedó para ${accion.minutos} minutos.` };
    }
    case 'reemplazar_hoy': {
      const ej = indice.porId.get(accion.a), de = indice.porId.get(accion.de)?.nombre || accion.de;
      const adelante = accion.alcance === 'adelante';
      const dias = nuevo.dias.filter(x => (adelante ? x.fecha >= accion.fecha : x.fecha === accion.fecha) && x.ejercicios.some(e => e.ejercicio_id === accion.de));
      for (const x of dias) x.ejercicios = x.ejercicios.map(e => (e.ejercicio_id === accion.de ? { ...e, ejercicio_id: ej.id, nombre: ej.nombre, carga_kg: null, nota: 'Cambiado. Elige un peso con la misma reserva.' } : e));
      return { plan: nuevo, ir: 'hoy', propone: `Cambiaría ${de} por ${ej.nombre}, con las mismas series y repeticiones.`, hecho: adelante ? `Listo: ${ej.nombre} en vez de ${de} desde hoy (${dias.length} ${dias.length === 1 ? 'sesión' : 'sesiones'}).` : `Listo: hoy ${ej.nombre} en vez de ${de}.` };
    }
    case 'quitar_zona_hoy': {
      const toda = accion.alcance === 'semana';
      const carga = e => indice.porId.get(e.ejercicio_id)?.carga_articular.includes(accion.zona);
      const salen = sesionDe(plan, accion.fecha).ejercicios.filter(carga);
      if (sesionDe(plan, accion.fecha).ejercicios.every(carga)) return { error: 'Todo lo de hoy carga esa zona. Mejor descansa o haz cardio suave, y mueve la sesión.' };
      for (const x of nuevo.dias.filter(d => (toda ? d.fecha >= accion.fecha && d.fecha <= finDeSemana(accion.fecha) : d.fecha === accion.fecha))) {
        const quedan = x.ejercicios.filter(e => !carga(e));
        if (quedan.length) x.ejercicios = quedan.map((e, i) => ({ ...e, orden: i }));
      }
      return { plan: nuevo, ir: 'hoy', propone: `Saldría${salen.length === 1 ? '' : 'n'} de hoy ${salen.map(e => e.nombre).join(', ')}, porque carga${salen.length === 1 ? '' : 'n'} la zona del ${accion.zona}.`, hecho: toda ? 'Listo: saqué lo que carga esa zona hasta el domingo.' : 'Listo: saqué de hoy lo que carga esa zona.' };
    }
    default: return { error: 'No sé hacer ese cambio.' };
  }
}

/** Cómo quedaría el cambio y los botones para confirmarlo (con el alcance, cuando se puede elegir). */
export function vistaPrevia(accion, ctx) {
  const r = calcularCambio(accion, ctx);
  if (r.error) return { texto: r.error };
  const confirmar = (etiqueta, extra = {}) => ({ etiqueta, accion: { tipo: 'confirmar', accion: { ...accion, ...extra } } });
  const no = { etiqueta: 'No, dejarlo como está', accion: { tipo: 'nada' } };
  if (accion.tipo === 'reemplazar_hoy') return { texto: `${r.propone} ¿Solo hoy o desde hoy en adelante?`, opciones: [confirmar('Solo hoy', { alcance: 'hoy' }), confirmar('Desde hoy en adelante', { alcance: 'adelante' }), no] };
  if (accion.tipo === 'quitar_zona_hoy') return { texto: `${r.propone} ¿Solo hoy o toda la semana?`, opciones: [confirmar('Solo hoy', { alcance: 'hoy' }), confirmar('Toda la semana', { alcance: 'semana' }), no] };
  return { texto: `${r.propone} ¿Lo cambio?`, opciones: [confirmar(r.ir === 'semana' ? 'Sí, cambiar la semana' : 'Sí, cambiar la sesión de hoy'), no] };
}

/** Una opción elegida en el chat. Lo que cambia el plan primero muestra la vista previa; 'confirmar' lo aplica. */
export function aplicarOpcion(accion, ctx) {
  if (accion.tipo === 'confirmar') {
    const r = calcularCambio(accion.accion, ctx);
    return r.error ? { texto: r.error } : { texto: r.hecho, plan: r.plan, ir: r.ir };
  }
  if (CAMBIAN_PLAN.has(accion.tipo)) return vistaPrevia(accion, ctx);
  switch (accion.tipo) {
    case 'elegir_alternativa': return opcionesAlternativa(ctx, accion.fecha, accion.ejercicio);
    case 'consentir_cuidado': return { texto: 'Gracias. Vuelve a contarme la molestia para darte los ejercicios.', consentimiento: 'cuidado_lesiones' };
    case 'nada': return { texto: 'Bien, no cambié nada.' };
    default: return { texto: 'Perfecto.' };
  }
}
