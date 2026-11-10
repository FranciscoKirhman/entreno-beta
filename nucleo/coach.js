import { alarmaCoach } from './alarma-coach.js';
// Chat del coach. Primero intenta resolver el mensaje con reglas (gratis, al instante y sin señal); solo lo que
// no entiende se manda a la IA (supabase/functions/coach). Las reglas cubren lo más común: faltar, mover un día,
// "hoy no quiero piernas", máquina ocupada, poco tiempo, dormir mal, dolor, "¿por qué?" y "¿qué me toca?".
// Nada cambia el plan sin preguntar: primero se muestra cómo queda la sesión de hoy o la semana, y se aplica solo
// cuando la persona confirma (y elige si es solo hoy o desde hoy en adelante, cuando corresponde).
import { sufijo } from './unidades.js';
import { normalizar } from './catalogo.js';
import { marcarFaltada, moverSesion, intercambiar, opcionesParaHoy, sesionesParaHoy, sesionDe, sumarDias, diaSemana, nombreDia, nombreSimple, familia } from './agenda.js';
import { alternativas, recortarSesion } from './checkin.js';
import { evaluarDia, ajustarSesion, TEXTO_RECOMENDACION } from './bienestar.js';
import { explicarEjercicio } from './explicar.js';
import { contextoDolor } from './dolor.js';
import { planDeCuidado } from './cuidado.js';
import { reconocer } from './importar-plan.js';
import { articulacionesBloqueadas } from './catalogo.js';
import { duracionEstimada, cargaSugerida, registrosParaCarga, lugaresDe } from './motor-plan.js';
import { alternativasNoHecha, alternativaEnFecha, fechasLibres, fechaEscrita, semanaDe, firma, diaCorto, calendarioNoHecha } from './sin-registro.js';
import { semanaDe as semanaDelBloque, adelantarDescarga } from './ciclos.js';
import { CAMBIOS_SEMANA_A_MEDIAS, cambioSemanaAMedias, confirmarSemanaAMedias } from './semana-a-medias.js';

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

// Lo que nombra una sesión cuando se pide ("hoy glúteo", "cámbiame a pierna"): cada palabra escrita y con qué se busca en
// el nombre de las sesiones del plan.
const PIDE = [
  [/\b(gluteos?|poto)\b/, ['gluteo']], [/\b(cuadriceps?|cuads?)\b/, ['cuadriceps']], [/\b(femoral(es)?|isquios?)\b/, ['femoral']],
  [/\b(piernas?|tren inferior|inferior)\b/, ['pierna', 'inferior', 'gluteo', 'cuadriceps', 'femoral']],
  [/\b(tren superior|superior|torso)\b/, ['torso', 'superior', 'espalda', 'pecho']],
  [/\bespaldas?\b/, ['espalda']], [/\bpechos?\b/, ['pecho']], [/\bhombros?\b/, ['hombro']], [/\b(brazos?|biceps|triceps)\b/, ['brazo', 'biceps', 'triceps']],
  [/\bempuje\b/, ['empuje']], [/\btiron\b/, ['tiron']],
];
const palabrasPedidas = n => { const p = PIDE.filter(([re]) => re.test(n)).flatMap(([, x]) => x); return p.length ? [...new Set(p)] : null; };
const NIEGA = /\b(no quiero|no tengo ganas de|prefiero no|no puedo|no voy a)\b/;
const QUIERE_ENTRENAR = /\b(quiero|quisiera|me gustaria|prefiero|necesito|voy a|vengo a|vine a|puedo|podria) (\w+ )?(entrenar|ejercitar)\b|\b(hagamos|entrenemos)\b|\bentrenar hoy\b/;
const QUIERE_HACER = /\b(quiero|quisiera|me gustaria|prefiero) (\w+ )?(hacer|trabajar)\b/;
const CAMBIAR = /\b(mueve|mueveme|mover|cambia|cambiar|cambiame|pasa|pasar|pasame|trae|traeme|traer|adelanta|adelantame|adelantar)\b/;
// Eso habla de un ejercicio, una dosis o el plan, no de qué sesión hacer hoy.
const SOBRE_OTRA_COSA = /\b(series?|repeticiones|reps?|kilos?|kg|pesos?|ejercicios?|maquinas?|mancuernas?|barra|minutos?|min|plan|bloque|proxim[oa]|semana que viene)\b/;

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
  // "No entrené ayer", "no pude entrenar el lunes", "falté el 2 de octubre": la sesión de ese día no se hizo.
  if (/\b(falte|no fui|no pude ir|me salte|me perdi|no alcance a ir|no entrene|no pude entrenar|no alcance a entrenar|no hice (la sesion|el entreno|el entrenamiento|nada)|no fui a entrenar)\b/.test(n)) {
    return { intencion: 'falte', fecha: fechaEscrita(texto, hoy) || fechaMencionada(n, hoy, { pasado: true }) || hoy };
  }
  const fechas = fechasMencionadas(n, hoy), soloHoy = fechas.every(f => f === hoy);
  // "Hoy no tenía sesión pero quiero entrenar": primero lo que quiere hacer, no lo que no toca.
  if (soloHoy && !NIEGA.test(n) && QUIERE_ENTRENAR.test(n) && !SOBRE_OTRA_COSA.test(n)) return { intencion: 'hacer_hoy', palabras: palabrasPedidas(n) };
  if (/\b(no quiero|no tengo ganas de|prefiero no|otra opcion|otra cosa|cambiar el dia)\b/.test(n) && !/\b(maquina|ocupad)\b/.test(n)) {
    const evitar = FAMILIAS.find(([re]) => re.test(n))?.[1] || (dia ? familia(dia.plantilla) : null);
    return { intencion: 'otra_opcion', evitar };
  }
  if (CAMBIAR.test(n) && fechas.length) {
    const de = fechas.length > 1 ? fechas[0] : hoy, a = fechas.at(-1);
    // "Cámbiame glúteo a hoy" nombra un solo día, el de hoy: no es mover un día a otro, es hacer otra sesión hoy (abajo).
    if (de !== a) return { intencion: 'mover', de, a };
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
  // "Hoy glúteo o cuádriceps", "cámbiame a glúteo", "quiero hacer pierna": qué sesión hacer hoy.
  const palabras = palabrasPedidas(n);
  if (palabras && soloHoy && !NIEGA.test(n) && !SOBRE_OTRA_COSA.test(n) && (fechas.length || CAMBIAR.test(n) || QUIERE_HACER.test(n))) return { intencion: 'hacer_hoy', palabras };
  return { intencion: 'desconocida' };
}

const resumenDia = d => `${d.foco} (${nombreDia(d.fecha)} ${Number(d.fecha.slice(8))}): ${d.ejercicios.map(e => e.nombre).join(', ')}.`;

/**
 * Responde con reglas. Devuelve {texto, plan?, opciones?, requiere_ia?, explicacion?, cuidado?}.
 * "opciones" son acciones que la app ofrece como botones; se ejecutan con aplicarOpcion().
 * @param ctx { plan, hoy, respuestas, derivados, indice, evidencia, consentimientos: {cuidado_lesiones} }
 */
export function responder(texto, ctx) {
  const alarma = alarmaCoach(texto);
  if (alarma) return alarma;
  const { plan, hoy, respuestas: r = {}, indice } = ctx;
  const q = entender(texto, ctx);
  const noPuedo = r.dias_no_puedo || [];
  const dia = plan ? sesionDe(plan, hoy) : null;
  switch (q.intencion) {
    case 'que_toca':
      if (dia) return { texto: `Hoy toca ${resumenDia(dia)}` };
      return { texto: `Hoy no tienes sesión.${(() => { const p = plan?.dias.find(d => d.fecha > hoy); return p ? ` La próxima es ${resumenDia(p)}` : ''; })()}` };
    case 'falte': return opcionesNoHecha(q.fecha, ctx);
    case 'mover': return vistaPrevia(sesionDe(plan, q.a) ? { tipo: 'intercambiar', fechas: [q.de, q.a] } : { tipo: 'mover', de: q.de, a: q.a }, ctx);
    case 'hacer_hoy': return hacerHoy(q, ctx);
    case 'otra_opcion': {
      const o = opcionesParaHoy(plan, hoy, { evitar: q.evitar });
      return {
        titulo: 'Otra opción para hoy',
        texto: `${o.hoy ? `Hoy tocaba ${o.hoy.foco}.` : 'Hoy no tenías sesión.'} Estas son tus opciones:`,
        opciones: o.opciones.map(x => (x.tipo === 'intercambiar' || x.tipo === 'traer' ? opcionHacerHoy({ ...x, accion: x.tipo === 'intercambiar' ? { tipo: 'intercambiar', fechas: [hoy, x.fecha] } : { tipo: 'mover', de: x.fecha, a: hoy } }, dia)
          : x.tipo === 'mover' ? { etiqueta: `Dejar ${nombreSimple(dia?.foco)} para otro día`, accion: { tipo: 'falte', fecha: hoy }, avisos: x.avisos }
            : { etiqueta: 'Descanso activo', nota: '20 a 30 minutos de caminata o bicicleta suave y movilidad', accion: { tipo: 'descanso_activo', fecha: hoy }, avisos: x.avisos })),
      };
    }
    case 'maquina_ocupada': {
      // "Siempre está ocupada" o sin sesión hoy: es un cambio del plan, no de hoy. Lo resuelve el coach con IA.
      const delPlan = /\b(siempre|todas las semanas|cada vez|en mi gimnasio|del plan|en el plan|en mi plan)\b/.test(String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
      if (!dia || delPlan) return { requiere_ia: true, texto: 'Cambiar un ejercicio en todo tu plan lo hace el coach con IA.' + (dia ? ' Para hoy, dime qué máquina y te doy alternativas.' : '') };
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
      // Sin un ejercicio reconocible ("¿por qué mi plan llega hasta el 16?") es una pregunta abierta: la responde la IA.
      if (!e) return { requiere_ia: true, texto: '¿De qué ejercicio? Escribe el nombre, por ejemplo "¿por qué hip thrust?".' };
      const d = plan.dias.find(x => x.ejercicios.includes(e));
      const ex = explicarEjercicio({ e, dia: d, plan, respuestas: r, indice, evidencia: ctx.evidencia });
      if (q.intencion === 'tecnica') return { texto: `${ex.ejercicio}: mira cómo se hace aquí.`, enlace: ex.video, explicacion: ex };
      return { texto: ex.motivos.slice(0, 3).map(m => `${m.pregunta} ${m.respuesta}`).join(' '), explicacion: ex };
    }
    default:
      return { texto: 'No estoy seguro de qué necesitas. Puedo reagendar si faltaste, darte otra opción para hoy, cambiar una máquina ocupada, acortar la sesión, ajustarla si dormiste mal, ayudarte con un dolor o explicarte por qué de un ejercicio.', requiere_ia: true };
  }
}

/**
 * Un botón para hacer hoy una sesión: lo que se hace en grande y lo que pasa con la de hoy debajo. Quien está en el gimnasio
 * no lee una vista previa (Francisco, 9 de noviembre de 2026): el botón ya dice cómo queda, tocarlo es el sí y se puede
 * deshacer. Por eso va directo a 'confirmar', sin otra pregunta.
 */
function opcionHacerHoy(o, dia) {
  const nombre = nombreSimple(dia?.foco);
  return {
    etiqueta: `Hacer hoy ${nombreSimple(o.foco)}`,
    nota: dia?.ejercicios?.length ? `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} pasa al ${fechaCorta(o.fecha)}.` : `Se adelanta desde el ${fechaCorta(o.fecha)}.`,
    accion: { tipo: 'confirmar', accion: o.accion },
    avisos: o.avisos,
  };
}

/** Cuánto calza una sesión con lo pedido: "glúteo o cuádriceps" calza más con "cuádriceps y glúteo" que con "glúteo y femoral". */
const calzaCon = (d, palabras) => (palabras || []).filter(p => normalizar(d?.foco || '').includes(p)).length;

/** "Hoy glúteo", "cámbiame a pierna", "quiero entrenar hoy": un botón por sesión, primero lo pedido. Nunca se le niega. */
function hacerHoy(q, ctx) {
  const { plan, hoy } = ctx;
  const dia = sesionDe(plan, hoy), hechaHoy = (ctx.hechas || []).includes(hoy);
  const otras = sesionesParaHoy(plan, hoy, { hechas: ctx.hechas || [] }).map(o => ({ ...o, calza: calzaCon(o, q.palabras) })).sort((a, b) => b.calza - a.calza);
  const mejor = otras[0]?.calza || 0;
  const verHoy = { etiqueta: 'Ver el entrenamiento de hoy', accion: { tipo: 'ir', vista: 'hoy' } };
  if (dia?.ejercicios?.length && !hechaHoy && calzaCon(dia, q.palabras) > 0 && calzaCon(dia, q.palabras) >= mejor) return { texto: `Hoy ya te toca ${dia.foco}.`, opciones: [verHoy] };
  if (hechaHoy) return { texto: `Hoy ya hiciste ${dia?.foco || 'tu sesión'}. Si quieres sumar algo, empieza una sesión vacía en Entrenar.`, opciones: [verHoy] };
  const lista = mejor ? otras.filter(o => o.calza) : otras;
  if (!lista.length) return { texto: dia?.ejercicios?.length ? `Hoy te toca ${dia.foco} y no hay otra sesión en los próximos días.` : 'No hay sesiones en los próximos días. En Entrenar puedes empezar una sesión vacía.', opciones: [verHoy] };
  return {
    titulo: 'Entrenar hoy',
    texto: `${dia?.ejercicios?.length ? `Hoy tenías ${dia.foco}.` : 'Hoy no tenías sesión.'} Toca la que quieres y queda para hoy.`,
    opciones: lista.slice(0, 4).map(o => opcionHacerHoy(o, dia)),
  };
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
const CAMBIAN_PLAN = new Set(['intercambiar', 'mover', 'falte', 'descanso_activo', 'ajustar_hoy', 'recortar_hoy', 'reemplazar_hoy', 'quitar_zona_hoy', 'descarga_temprana', ...CAMBIOS_SEMANA_A_MEDIAS]);
const fechaCorta = f => `${nombreDia(f)} ${Number(f.slice(8))}`;
const prescCorta = e => `${e.nombre} ${e.series}×${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${sufijo(e)}`;
const finDeSemana = f => sumarDias(f, (7 - diaSemana(f)) % 7);
const movidas = cambios => cambios.map(c => (c.tipo === 'intercambiar' ? `el ${nombreDia(c.fechas[0])} y el ${nombreDia(c.fechas[1])} se cambian` : `${c.foco} del ${nombreDia(c.de)} al ${fechaCorta(c.a)}`));

/**
 * Hace el cambio sobre una copia del plan (no guarda nada). Devuelve {plan, propone, hecho, ir} o {error}.
 *   propone: cómo quedaría, para preguntar; hecho: lo que se dice al aplicarlo; ir: 'hoy' o 'semana'.
 */
export function calcularCambio(accion, ctx) {
  // Una semana que quedó a medias: pasar a menos días, primero lo que faltó, repetirla o descargar (nucleo/semana-a-medias.js).
  if (CAMBIOS_SEMANA_A_MEDIAS.has(accion.tipo)) return cambioSemanaAMedias(accion, ctx);
  const { plan, indice } = ctx;
  const noPuedo = ctx.respuestas?.dias_no_puedo || [];
  const nuevo = structuredClone(plan);
  const sesionHoy = (fecha, ejercicios, frase) => {
    const antes = duracionEstimada(sesionDe(plan, fecha).ejercicios), despues = duracionEstimada(ejercicios);
    return `${frase} ${ejercicios.map(prescCorta).join(', ')} (unos ${despues} minutos${despues !== antes ? `, en vez de ${antes}` : ''}).`;
  };
  switch (accion.tipo) {
    case 'intercambiar': {
      if (accion.fechas.some(f => (ctx.hechas || []).includes(f))) return { error: 'Esa sesión ya está hecha: no la muevo.' };
      const r = intercambiar(plan, ...accion.fechas);
      if (!r.ok) return { error: r.error };
      const [a, b] = accion.fechas, ojo = r.avisos.length ? ' Ojo: ' + r.avisos.join(' ') : '';
      // Con hoy de por medio se dice lo que importa: qué haces hoy y adónde pasa la otra.
      const delHoy = a === ctx.hoy ? a : b === ctx.hoy ? b : null;
      if (delHoy) {
        const otra = delHoy === a ? b : a, enHoy = nombreSimple(sesionDe(r.plan, delHoy).foco), enOtra = nombreSimple(sesionDe(r.plan, otra).foco);
        const mayuscula = t => t.charAt(0).toUpperCase() + t.slice(1);
        return { plan: r.plan, ir: 'hoy', confirmar: `Sí, hacer ${enHoy} hoy`, propone: `Hoy harías ${enHoy}. ${mayuscula(enOtra)} pasa al ${fechaCorta(otra)}.${ojo}`, hecho: `Listo: hoy haces ${enHoy}. ${mayuscula(enOtra)} pasa al ${fechaCorta(otra)}.` };
      }
      return { plan: r.plan, ir: 'semana', confirmar: 'Sí, cambiar los días', propone: `Cambiaría el ${fechaCorta(a)} con el ${fechaCorta(b)}: el ${nombreDia(a)} harías ${sesionDe(r.plan, a).foco} y el ${nombreDia(b)}, ${sesionDe(r.plan, b).foco}.${ojo}`, hecho: `Listo: el ${nombreDia(a)} haces ${sesionDe(r.plan, a).foco}.` };
    }
    case 'mover': {
      if ((ctx.hechas || []).includes(accion.de)) return { error: 'Esa sesión ya está hecha: no la muevo.' };
      const r = moverSesion(plan, accion.de, accion.a, { noPuedo });
      if (!r.ok) return { error: r.error };
      const foco = sesionDe(r.plan, accion.a).foco, ojo = r.avisos?.length ? ' Ojo: ' + r.avisos.join(' ') : '';
      if (accion.a === ctx.hoy) return { plan: r.plan, ir: 'hoy', confirmar: `Sí, hacer ${nombreSimple(foco)} hoy`, propone: `Hoy harías ${nombreSimple(foco)}, que estaba para el ${fechaCorta(accion.de)}.${ojo}`, hecho: `Listo: hoy haces ${nombreSimple(foco)}.` };
      return { plan: r.plan, ir: 'semana', confirmar: 'Sí, moverla', propone: `${foco} pasaría del ${fechaCorta(accion.de)} al ${fechaCorta(accion.a)}.${ojo}`, hecho: `Listo: ${foco} quedó para el ${fechaCorta(accion.a)}.` };
    }
    case 'falte': case 'descanso_activo': {
      const r = marcarFaltada(plan, accion.fecha, { hoy: ctx.hoy, noPuedo, hechas: ctx.hechas || [] });
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
      // El peso del ejercicio nuevo sale de su historial para las repeticiones y la reserva de cada día (en una
      // descarga, más liviano): antes quedaba en blanco y Hoy copiaba el de la vez anterior tal cual.
      const lugares = lugaresDe(ctx.respuestas);
      const lugarDe = x => lugares.find(l => l.nombre === x.lugar) || lugares.find(l => l.principal) || lugares[0] || null;
      for (const x of dias) x.ejercicios = x.ejercicios.map(e => {
        if (e.ejercicio_id !== accion.de) return e;
        const nuevoE = { ...e, ejercicio_id: ej.id, nombre: ej.nombre, carga_kg: null };
        nuevoE.carga_kg = cargaSugerida({ e: nuevoE, ej, registros: registrosParaCarga(ctx.historial || [], ej.id, x.fecha), lugar: lugarDe(x) });
        nuevoE.nota = nuevoE.carga_kg != null ? `Cambiado: el peso sale de tu historial con ${ej.nombre}, para estas repeticiones y esta reserva.` : 'Cambiado. Elige un peso con la misma reserva.';
        return nuevoE;
      });
      const carga = dias[0]?.ejercicios.find(e => e.ejercicio_id === ej.id)?.carga_kg;
      return { plan: nuevo, ir: 'hoy', propone: `Cambiaría ${de} por ${ej.nombre}, con las mismas series y repeticiones${carga != null ? ` y ${String(carga).replace('.', ',')} kg según tu historial` : ''}.`, hecho: adelante ? `Listo: ${ej.nombre} en vez de ${de} desde hoy (${dias.length} ${dias.length === 1 ? 'sesión' : 'sesiones'}).` : `Listo: hoy ${ej.nombre} en vez de ${de}.` };
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
    case 'descarga_temprana': {
      // La propuesta a quien entrena más duro de lo pedido (nucleo/sobrecarga.js): la semana que viene pasa a ser la
      // descarga y el bloque termina ahí. semana: cómo quedaría cada día, con las series antes y después.
      const actual = semanaDelBloque(plan, ctx.hoy), n = Number(accion.semana);
      if (!plan.semana_descarga || !actual || !(n > actual) || n >= plan.semana_descarga) return { error: 'Tu plan cambió desde esa propuesta: la descarga ya no se puede adelantar a esa semana.' };
      const r = adelantarDescarga(plan, n, 'venías entrenando más cerca del fallo de lo pedido');
      const series = d => (d?.ejercicios || []).reduce((a, e) => a + (Number(e.series) || 0), 0);
      const antes = new Map(plan.dias.filter(d => d.semana === n).map(d => [d.fecha, d]));
      const semana = r.dias.filter(d => d.semana === n).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
        .map(d => ({ fecha: d.fecha, foco: d.foco, cambio: `${series(d)} series en vez de ${series(antes.get(d.fecha))}, con 2 más de reserva` }));
      const desde = sumarDias(plan.inicio, (n - 1) * 7), fin = sumarDias(desde, 6), quitadas = (plan.semanas || plan.semana_descarga) - n;
      return {
        plan: r, ir: 'semana', semana,
        propone: `La semana del ${fechaCorta(desde)} pasaría a ser de descarga, con los mismos ejercicios y pesos. El bloque terminaría el ${fechaCorta(fin)}${quitadas ? `, ${quitadas === 1 ? 'una semana' : `${quitadas} semanas`} antes de lo previsto,` : ''} y después armas el siguiente.`,
        hecho: `Listo: la semana del ${fechaCorta(desde)} es de descarga y el bloque termina el ${fechaCorta(fin)}.`,
      };
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
  if (accion.tipo === 'descarga_temprana') return { texto: `${r.propone} ¿La adelanto?`, semana: r.semana, opciones: [confirmar('Sí, adelantar la descarga'), no] };
  if (CAMBIOS_SEMANA_A_MEDIAS.has(accion.tipo)) return { texto: `${r.propone} ¿Lo cambio?`, semana: r.semana, opciones: [confirmar(confirmarSemanaAMedias(accion)), no] };
  return { texto: `${r.propone} ¿Lo cambio?`, opciones: [confirmar(r.confirmar || (r.ir === 'semana' ? 'Sí, cambiar la semana' : 'Sí, cambiar la sesión de hoy')), no] };
}

/** Una opción elegida en el chat. Lo que cambia el plan primero muestra la vista previa; 'confirmar' lo aplica. */
export function aplicarOpcion(accion, ctx) {
  if (accion.tipo === 'confirmar') {
    const r = calcularCambio(accion.accion, ctx);
    return r.error ? { texto: r.error } : { texto: r.hecho, plan: r.plan, ir: r.ir };
  }
  if (CAMBIAN_PLAN.has(accion.tipo)) return vistaPrevia(accion, ctx);
  switch (accion.tipo) {
    case 'no_hecha': return opcionesNoHecha(accion.fecha, ctx);
    case 'elegir_fecha': return elegirFecha(accion.fecha, ctx);
    case 'ver_alternativa': return verAlternativa(accion, ctx);
    case 'aceptar_alternativa': return aceptarAlternativa(accion, ctx);
    case 'la_hice': {
      const d = sesionDe(ctx.plan, accion.fecha);
      return {
        texto: `Anotado: ${d?.foco || 'la sesión'} del ${diaCorto(accion.fecha)} quedó como hecha, sin anotar. Si quieres, registra lo que hiciste; si no, queda así.`,
        marca: { fecha: accion.fecha, valor: 'hecha' },
        opciones: [{ etiqueta: 'Anotar lo que hice', accion: { tipo: 'anotar_pasado', fecha: accion.fecha } }, { etiqueta: 'Dejarla así', accion: { tipo: 'nada_anotar' } }],
      };
    }
    case 'nada_anotar': return { texto: 'Bien, queda como hecha sin detalles.' };
    case 'nada_anotar_sin': return { texto: 'Perfecto, no cambié nada.' };
    case 'elegir_alternativa': return opcionesAlternativa(ctx, accion.fecha, accion.ejercicio);
    case 'consentir_cuidado': return { texto: 'Gracias. Vuelve a contarme la molestia para darte los ejercicios.', consentimiento: 'cuidado_lesiones' };
    case 'nada': return { texto: 'Bien, no cambié nada.' };
    // "Ahora no" a la descarga adelantada: no se vuelve a proponer esta semana (descartar lo guarda la app).
    case 'sobrecarga_no': return { texto: 'Bien, sigues con el plan. Esta semana, para cada serie cuando te queden las repeticiones que pide: la última tiene que salir igual de limpia que la primera.', descartar: accion.clave };
    // "Seguir igual" a una semana a medias (nucleo/semana-a-medias.js): no se vuelve a ofrecer por esa semana.
    case 'semana_a_medias_no': return { texto: 'Bien, sigues con el plan tal cual. No sumes a esta semana lo que faltó, y lo que no hiciste mantiene su peso.', descartar: accion.clave };
    // El tiempo por sesión del perfil, cuando el recorte se rechazó dos veces (nucleo/tiempo-sesion.js: ofertaDeTiempo).
    case 'tiempo_perfil': return { texto: `Listo: tu tiempo por sesión queda en ${accion.minutos} minutos. No te propongo más recortes, y el próximo bloque se arma para ese tiempo.`, descartar: accion.clave, duracion_min: Number(accion.minutos) };
    case 'tiempo_perfil_no': return { texto: 'Bien, lo dejo como está y no te propongo más recortes al empezar. Si un día tienes menos tiempo, usa Ajustar tiempo.', descartar: accion.clave };
    default: return { texto: 'Perfecto.' };
  }
}

// ── Sesiones que no se hicieron: alternativas, vista de la semana y aceptación ──────────────
const avisoOjo = o => (o.avisos?.length ? ` Ojo: ${o.avisos.join(' ')}` : '');

/** "No la hice": las alternativas para esa sesión, cada una con qué se mueve, a qué fecha y qué pasa con las demás. */
export function opcionesNoHecha(fecha, ctx) {
  const r = alternativasNoHecha(ctx.plan, fecha, ctx);
  if (r.error && !sesionDe(ctx.plan, fecha)) {
    // Ese día no había sesión: quizás se refiere a la última que tocaba y no está hecha (de la última semana).
    const antes = ctx.plan.dias.filter(d => d.fecha <= fecha && d.fecha >= sumarDias(fecha, -6) && d.fecha <= ctx.hoy && d.firme !== false && !(ctx.hechas || []).includes(d.fecha)).at(-1);
    if (antes) return { texto: `${r.error} ¿Te refieres a ${antes.foco} del ${diaCorto(antes.fecha)}?`, opciones: [{ etiqueta: `No hice ${antes.foco} del ${diaCorto(antes.fecha)}`, accion: { tipo: 'no_hecha', fecha: antes.fecha } }, { etiqueta: 'No, está todo bien', accion: { tipo: 'nada_anotar_sin' } }] };
  }
  if (r.error) return { texto: r.error };
  const base = firma(ctx.plan);
  const mover = r.opciones.filter(o => !o.saltar);
  const todasChocan = mover.length && mover.every(o => o.avisos.length);
  const texto = !mover.length
    ? `${r.sesion.foco} del ${diaCorto(fecha)} quedó sin hacer. No encontré un día compatible: puedes saltarla o elegir otra fecha.`
    : todasChocan
      ? `${r.sesion.foco} del ${diaCorto(fecha)} quedó sin hacer. Ninguna opción evita dejarla pegada a una sesión del mismo grupo; cada una dice con cuál. También puedes saltarla o elegir otra fecha.`
      : `${r.sesion.foco} del ${diaCorto(fecha)} quedó sin hacer. Elige una opción y te muestro cómo queda la semana antes de cambiar nada.`;
  // Cada opción que la lleva a otro día tiene su letra, y el calendario muestra esa letra en ese día: así se ve adónde
  // va sin leer fechas. Los días libres del calendario se tocan para ponerla ahí (Francisco, 4 de noviembre de 2026).
  let n = 0;
  const conLetra = r.opciones.map(o => (o.destino ? { ...o, letra: 'ABCDEFG'[n++] } : o));
  const calendario = { ...calendarioNoHecha(ctx.plan, fecha, { hoy: ctx.hoy, noPuedo: ctx.respuestas?.dias_no_puedo || [], hechas: ctx.hechas || [], marcas: ctx.marcas || {}, opciones: conLetra }), fecha, base };
  const tocables = calendario.dias.some(d => d.elegible);
  return {
    texto: tocables ? `${texto} En el calendario, cada letra es adónde la lleva esa opción; también puedes tocar un día libre.` : texto,
    calendario,
    opciones: [
      ...conLetra.map(o => ({ etiqueta: o.titulo, ...(o.letra ? { letra: o.letra } : {}), nota: `${o.detalle} ${o.diferencia}${avisoOjo(o)}`, accion: { tipo: 'ver_alternativa', fecha, opcion: o.id, base } })),
      ...(r.fechasLibres.length ? [{ etiqueta: 'Elegir otra fecha', accion: { tipo: 'elegir_fecha', fecha } }] : []),
    ],
  };
}

/** Los días libres para poner la sesión (la persona elige). */
function elegirFecha(fecha, ctx) {
  // La fecha la elige la persona: también los días que marcó que casi nunca puede.
  const libres = fechasLibres(ctx.plan, { hoy: ctx.hoy, hechas: ctx.hechas || [], hasta: sumarDias(ctx.hoy, 13) });
  if (!libres.length) return { texto: 'No quedan días libres en las próximas dos semanas. Puedes saltarla.', opciones: [{ etiqueta: 'Volver a las opciones', accion: { tipo: 'no_hecha', fecha } }] };
  const base = firma(ctx.plan);
  return {
    texto: `¿Qué día quieres hacer ${sesionDe(ctx.plan, fecha)?.foco || 'esa sesión'}? Estos días no tienen sesión:`,
    opciones: [...libres.slice(0, 10).map(f => ({ etiqueta: diaCorto(f), accion: { tipo: 'ver_alternativa', fecha, opcion: 'fecha', destino: f, base } })),
      { etiqueta: 'Volver a las opciones', accion: { tipo: 'no_hecha', fecha } }],
  };
}

/** Busca la alternativa elegida, recalculada con el plan de ahora. */
function buscarAlternativa(accion, ctx) {
  if (accion.opcion === 'fecha') return alternativaEnFecha(ctx.plan, accion.fecha, accion.destino, ctx);
  const r = alternativasNoHecha(ctx.plan, accion.fecha, ctx);
  if (r.error) return r;
  return r.opciones.find(o => o.id === accion.opcion) || { error: 'Esa opción ya no está disponible.' };
}

/** Cómo quedaría la semana con la alternativa elegida; aceptar es lo único que cambia el plan. */
function verAlternativa(accion, ctx) {
  if (accion.base && accion.base !== firma(ctx.plan)) return { ...opcionesNoHecha(accion.fecha, ctx), texto: 'Tu semana cambió desde que viste esas opciones. Estas son las de ahora:' };
  const o = buscarAlternativa(accion, ctx);
  if (o.error) return { texto: o.error, opciones: [{ etiqueta: 'Volver a las opciones', accion: { tipo: 'no_hecha', fecha: accion.fecha } }] };
  const semana = semanaDe(o.plan, { hoy: ctx.hoy, cambios: o.cambios, saltada: o.saltar || o.repartir ? accion.fecha : null, sumas: o.sumas || [] });
  return {
    texto: `${o.titulo}. ${o.detalle}${avisoOjo(o)} Así quedaría tu semana:`,
    semana,
    opciones: [{ etiqueta: 'Aceptar esta opción', accion: { ...accion, tipo: 'aceptar_alternativa', base: firma(ctx.plan) } }, { etiqueta: 'Volver a las opciones', accion: { tipo: 'no_hecha', fecha: accion.fecha } }],
  };
}

/** Aplica la alternativa. Si el plan cambió desde la vista previa (o ya se aceptó), no hace nada dos veces. */
function aceptarAlternativa(accion, ctx) {
  if (accion.base !== firma(ctx.plan)) return { ...opcionesNoHecha(accion.fecha, ctx), texto: 'Tu semana ya cambió desde esa vista previa, así que no apliqué nada. Estas son las opciones de ahora:' };
  const o = buscarAlternativa(accion, ctx);
  if (o.error) return { texto: o.error };
  if (o.saltar) return { texto: `Listo: ${sesionDe(ctx.plan, accion.fecha)?.foco || 'esa sesión'} del ${diaCorto(accion.fecha)} quedó saltada y el resto de la semana sigue igual.`, marca: { fecha: accion.fecha, valor: 'saltada' }, ir: 'semana' };
  // Repartida: las próximas sesiones suman lo principal de la que no se hizo, y esa queda como saltada.
  if (o.repartir) return { texto: `Listo: ${o.detalle} ${sesionDe(ctx.plan, accion.fecha)?.foco || 'Esa sesión'} del ${diaCorto(accion.fecha)} queda como saltada.`, plan: o.plan, marca: { fecha: accion.fecha, valor: 'saltada' }, ir: 'semana' };
  const movida = o.cambios.find(c => c.de === accion.fecha);
  return { texto: `Listo: ${movida.foco} quedó para el ${diaCorto(movida.a)}. ${o.detalle}`, plan: o.plan, ir: movida.a === ctx.hoy ? 'hoy' : 'semana' };
}

