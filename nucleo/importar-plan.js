// Importa un plan escrito (lo que te pasó tu entrenador, una nota, un PDF copiado) y lo transforma en sesiones
// agendadas. Entiende formatos comunes en español:
//
//   Lunes - Pierna
//   1. Sentadilla 4x8 80kg
//   Hip thrust 3 x 10-12 @ 100 kg RIR 2
//   Plancha 3x45s
//
// Lo que no reconoce con seguridad queda marcado para que la persona (o la IA) lo elija; nunca se adivina en
// silencio. Para fotos o PDF escaneados, la IA primero los transcribe a este formato.
import { normalizar } from './catalogo.js';
import { elegirDias } from './motor-plan.js';

const DIAS = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

// Palabras de uso común en Chile → nombres del catálogo.
const SINONIMOS = [
  [/\bbanca( plana)?\b|\bpress plano\b|\bpecho plano\b/, 'press de banca'],
  [/\bbanca inclinada\b|\bpress inclinado\b/, 'press inclinado'],
  [/\bpeso muerto rumano\b|\brdl\b|\brumano\b/, 'peso muerto rumano'],
  [/\bjalon( al pecho)?\b|\bpulldown\b/, 'jalon al pecho'],
  [/\bestocadas?\b|\bzancadas?\b|\blunges?\b/, 'zancadas'],
  [/\bbulgaras?\b|\bsplit squat\b/, 'sentadilla bulgara'],
  [/\bgemelos?\b|\bpantorrillas?\b|\bcalf\b/, 'pantorrilla'],
  [/\bextension(es)? de (cuadriceps|pierna)\b|\bcuadriceps maquina\b/, 'extension de cuadriceps'],
  [/\bcurl (femoral|de pierna)\b|\bisquios?\b|\bfemoral(es)?\b/, 'curl femoral'],
  [/\bfondos?\b|\bdips?\b/, 'fondos'],
  [/\babdominales?\b|\bcrunch\b/, 'abdominal'],
  [/\bmilitar\b/, 'press militar'],
  [/\bhombro(s)? con mancuernas?\b/, 'press de hombros con mancuernas'],
  [/\blaterales\b/, 'elevaciones laterales'],
  [/\babductor(es)?\b/, 'abductora'],
  [/\baductor(es)?\b/, 'aductora'],
  [/\bdominadas? asistidas?\b/, 'dominadas asistidas'],
];
const EQUIPO = [
  [/\bbarra\b/, 'barra_rack'], [/\bmancuernas?\b/, 'mancuernas'], [/\bpolea|cable\b/, 'poleas'],
  [/\bsmith\b/, 'smith'], [/\bmaquina\b/, 'maquinas'], [/\bbanda|elastico\b/, 'bandas'], [/\bkettlebell|pesa rusa\b/, 'kettlebells'],
];
const VACIAS = new Set(['de', 'con', 'en', 'al', 'a', 'la', 'el', 'los', 'las', 'y', 'para', 'por', 'un', 'una']);
const tokens = s => normalizar(s).split(' ').filter(t => t && !VACIAS.has(t));

/** El ejercicio del catálogo que mejor calza con un nombre escrito a mano, con un puntaje de 0 a 1. */
export function reconocer(nombre, indice) {
  let n = normalizar(nombre);
  for (const [re, canon] of SINONIMOS) if (re.test(n)) { n = n.replace(re, canon); }
  const pedidos = tokens(n);
  const equipo = EQUIPO.filter(([re]) => re.test(normalizar(nombre))).map(([, eq]) => eq);
  if (!pedidos.length) return { ejercicio: null, puntaje: 0 };
  let mejor = null, mejorP = 0;
  for (const e of indice.ejercicios) {
    const propios = new Set([e.nombre, e.nombre_hevy, ...(e.alias || [])].flatMap(tokens));
    const comunes = pedidos.filter(t => propios.has(t) || [...propios].some(p => p.length > 4 && (p.startsWith(t) || t.startsWith(p)))).length;
    let p = comunes / pedidos.length;
    const largo = tokens(e.nombre).length;
    p -= Math.max(0, largo - comunes) * 0.04;               // nombres con muchas palabras de más pierden
    if (equipo.length) p += equipo.some(eq => e.equipamiento.includes(eq)) ? 0.15 : -0.15;
    else p -= (e.preferencia - 1) * 0.03;                  // sin equipo dicho, la variante más común
    if (p > mejorP) { mejor = e; mejorP = p; }
  }
  return { ejercicio: mejorP >= 0.5 ? mejor : null, sugerido: mejor, puntaje: Math.max(0, Math.min(1, mejorP)) };
}

const num = s => (s == null ? null : Number(String(s).replace(',', '.')));

/** Una línea de ejercicio → {nombre, series, reps_min, reps_max, unidad, carga_kg, rir}; null si no es ejercicio. */
export function leerLinea(linea) {
  const l = linea.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, '').trim();
  const m = l.match(/(\d+)\s*(?:series?\s*(?:de)?\s*|[x×]\s*)(\d+)(?:\s*(?:-|–|a)\s*(\d+))?\s*(s|seg|segundos|"|m|metros)?\b/i);
  if (!m) return null;
  const nombre = l.slice(0, m.index).replace(/[:\-–(,]+\s*$/, '').trim();
  if (!nombre) return null;
  const resto = l.slice(m.index + m[0].length);
  const kg = (resto.match(/(\d+(?:[.,]\d+)?)\s*kg/i) || l.match(/(\d+(?:[.,]\d+)?)\s*kg/i) || [])[1];
  const rir = (resto.match(/rir\s*(\d)/i) || [])[1];
  const rpe = (resto.match(/(?:rpe|@)\s*(\d+(?:[.,]\d)?)(?!\s*kg)/i) || [])[1];
  return {
    texto: linea.trim(), nombre,
    series: Number(m[1]), reps_min: Number(m[2]), reps_max: Number(m[3] || m[2]),
    unidad: !m[4] ? 'reps' : /^m/i.test(m[4]) ? 'm' : 'seg',
    carga_kg: num(kg),
    rir: rir != null ? Number(rir) : rpe != null ? Math.max(0, Math.round(10 - num(rpe))) : null,
  };
}

/** Texto completo → días con ejercicios reconocidos y los que hay que revisar. */
export function leerPlanTexto(texto, indice) {
  const dias = [];
  const sinDia = { titulo: 'Día 1', dia_semana: null, ejercicios: [] };
  let actual = null;
  for (const linea of texto.split(/\r?\n/)) {
    const limpia = linea.trim();
    if (!limpia) continue;
    const n = normalizar(limpia);
    const cab = n.match(/^(?:dia\s*(\d+)|(lunes|martes|miercoles|jueves|viernes|sabado|domingo))\b(.*)$/);
    const ej = leerLinea(limpia);
    if (cab && !ej) {
      actual = { titulo: limpia.replace(/[:\-–]\s*$/, ''), dia_semana: cab[2] ? DIAS[cab[2]] : null, orden: cab[1] ? Number(cab[1]) : null,
        foco: limpia.replace(/^\S+(\s+\d+)?\s*[:\-–]?\s*/, '').trim() || null, ejercicios: [] };
      dias.push(actual);
      continue;
    }
    if (!ej) continue;
    const r = reconocer(ej.nombre, indice);
    (actual || sinDia).ejercicios.push({ ...ej, ejercicio_id: r.ejercicio?.id || null, sugerido: r.sugerido?.id || null, puntaje: Number(r.puntaje.toFixed(2)) });
  }
  if (sinDia.ejercicios.length) dias.unshift(sinDia);
  const revisar = dias.flatMap(d => d.ejercicios.filter(e => !e.ejercicio_id).map(e => ({ dia: d.titulo, texto: e.texto, sugerido: e.sugerido })));
  return { dias, revisar };
}

const NOMBRE_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/**
 * Compartir tu plan, como las rutinas de Hevy: una semana del plan en texto que "Importar un plan" sabe leer, sin
 * datos personales. Una línea por día ("Lunes: Torso A") y una por ejercicio ("Press de banca con barra 4x6 a 10
 * RIR 2 45 kg").
 */
export function planATexto(plan, { semana = 1 } = {}) {
  const dias = plan.dias.filter(d => d.semana === semana && d.ejercicios?.length);
  const linea = e => `${e.nombre || e.ejercicio_id} ${e.series}x${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${e.unidad === 'seg' ? 's' : e.unidad === 'm' ? ' m' : ''}${e.unidad === 'm' ? '' : ` RIR ${e.rir}`}${e.carga_kg ? ` ${String(e.carga_kg).replace('.', ',')} kg` : ''}`;
  return [
    'Mi plan de gimnasio, hecho con Entreno. Para usarlo: Entreno, Más, Importar un plan que ya tengo, y pega este texto.',
    '',
    ...dias.flatMap(d => [`${NOMBRE_DIA[new Date(d.fecha + 'T12:00:00Z').getUTCDay()]}: ${d.foco || 'Entrenamiento'}`, ...d.ejercicios.map(linea), '']),
  ].join('\n').trimEnd();
}

/**
 * Pasa el plan importado a sesiones agendadas por semanas, con el mismo formato que el motor.
 * Si el texto decía los días de la semana, se usan esos; si no, se reparten con descanso entre medio.
 */
export function calendarizar(importado, { inicio, semanas = 4, noPuedo = [], indice }) {
  const dias = importado.dias.filter(d => d.ejercicios.length);
  const conDia = dias.every(d => d.dia_semana != null);
  const semana = conDia ? dias.map(d => d.dia_semana) : elegirDias(dias.length, noPuedo);
  const out = [];
  for (let s = 1; s <= semanas; s++) {
    dias.forEach((d, i) => {
      const dow = semana[i];
      const offset = ((dow === 0 ? 7 : dow) - 1) + (s - 1) * 7;
      const fecha = new Date(Date.parse(inicio + 'T12:00:00Z') + offset * 864e5).toISOString().slice(0, 10);
      out.push({
        fecha, semana: s, plantilla: `importado_${i + 1}`, foco: d.foco || d.titulo, tipo: 'entrenamiento', firme: true,
        racional: 'Del plan que importaste.', calentamiento: [], cardio: null,
        ejercicios: d.ejercicios.filter(e => e.ejercicio_id).map((e, j) => ({
          ejercicio_id: e.ejercicio_id, nombre: indice.porId.get(e.ejercicio_id).nombre, orden: j, prioridad: j < 2 ? 1 : j < 4 ? 2 : 3,
          series: e.series, reps_min: e.reps_min, reps_max: e.reps_max, unidad: e.unidad, rir: e.rir ?? 2,
          descanso_seg: j < 2 ? 150 : 90, carga_kg: e.carga_kg, nota: null,
        })),
      });
    });
  }
  return {
    inicio, semanas, semana_descarga: null, objetivo: 'importado', estructura: 'fija', generado_por: 'importado',
    justificacion: 'Plan importado tal como lo escribiste. La app lo agenda y lo ajusta con tus registros y check-ins.',
    dias: out.sort((a, b) => (a.fecha < b.fecha ? -1 : 1)),
  };
}
