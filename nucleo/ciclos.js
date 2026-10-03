// Macrociclo: la secuencia de bloques (mesociclos) de varios meses según el objetivo. Cada bloque dura 4
// semanas por defecto y termina en descarga; la tendencia de bienestar (nucleo/bienestar.js) puede acortarlo
// a 3 o alargarlo a 5. El motor de planes arma cada bloque con los ajustes de su fase.
import { tendencia } from './bienestar.js';
import { TEXTO_DESCARGA, comoDescarga, duracionSesion } from './motor-plan.js';

const FASES = {
  base: { nombre: 'Base', enfoque: 'Aprender y asentar los movimientos con volumen moderado.', series: 0.9, reps: 0, rir: 1 },
  acumulacion: { nombre: 'Acumulación', enfoque: 'Más volumen para ganar músculo, en rangos de repeticiones medios.', series: 1.0, reps: 0, rir: 0 },
  acumulacion_alta: { nombre: 'Acumulación alta', enfoque: 'El bloque con más series: empujar el crecimiento muscular.', series: 1.15, reps: 0, rir: 0 },
  intensificacion: { nombre: 'Intensificación', enfoque: 'Menos series y más carga: convertir el músculo ganado en fuerza.', series: 0.85, reps: -2, rir: 0 },
  mantencion: { nombre: 'Mantención', enfoque: 'Volumen mínimo para mantener lo ganado mientras se baja grasa o en épocas con poco tiempo.', series: 0.8, reps: 0, rir: 0 },
};

const SECUENCIAS = {
  ganar_musculo: ['acumulacion', 'acumulacion_alta', 'intensificacion'],
  recomposicion: ['acumulacion', 'acumulacion_alta', 'intensificacion'],
  ganar_fuerza: ['acumulacion', 'intensificacion', 'intensificacion'],
  bajar_grasa: ['acumulacion', 'acumulacion', 'mantencion'],
  salud: ['base', 'acumulacion', 'acumulacion'],
  volver: ['base', 'acumulacion', 'acumulacion_alta'],
  deporte: ['acumulacion', 'intensificacion', 'mantencion'],
};

const sumarDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

/** Bloques del macrociclo desde una fecha (lunes). Principiantes empiezan siempre con un bloque base. */
export function macrociclo(objetivo, inicio, { nivel = 'intermedio', semanas = 4 } = {}) {
  let seq = [...(SECUENCIAS[objetivo] || SECUENCIAS.salud)];
  if (nivel === 'principiante' && seq[0] !== 'base') seq = ['base', ...seq.slice(0, 2)];
  let f = inicio;
  return seq.map((fase, i) => {
    const b = { n: i + 1, fase, ...FASES[fase], inicio: f, semanas, semana_descarga: semanas, fin: sumarDias(f, semanas * 7 - 1) };
    f = sumarDias(f, semanas * 7);
    return b;
  });
}

/** Corre el bloque n para que parta en `inicio` con `semanas` semanas, y los que siguen detrás de él. */
function reprogramarDesde(bloques, n, inicio, semanas) {
  const out = structuredClone(bloques);
  let f = inicio;
  for (const b of out.filter(x => x.n >= n)) {
    if (b.n === n) { b.semanas = semanas; b.semana_descarga = semanas; }
    b.inicio = f; b.fin = sumarDias(f, b.semanas * 7 - 1); f = sumarDias(b.fin, 1);
  }
  return out;
}

/**
 * El macrociclo del plan vigente. Si el plan es el bloque siguiente del guardado (plan.bloque), avanza y corre
 * las fechas a las del plan; si es otro plan (rehecho o importado de nuevo), parte un macrociclo desde él.
 * @param guardado { objetivo, actual, plan_inicio, bloques } o null
 */
export function macroDelPlan(plan, guardado, { nivel = 'intermedio' } = {}) {
  if (!plan?.inicio || !plan.semana_descarga || plan.objetivo === 'importado') return null;
  if (guardado?.plan_inicio === plan.inicio && guardado.objetivo === plan.objetivo) {
    const b = guardado.bloques.find(x => x.n === guardado.actual);
    // Si el bloque se acortó (descarga adelantada), los que siguen se corren.
    return b && b.semanas !== plan.semanas ? { ...guardado, bloques: reprogramarDesde(guardado.bloques, b.n, plan.inicio, plan.semanas) } : guardado;
  }
  if (guardado && plan.bloque && plan.bloque === guardado.actual + 1 && guardado.bloques.some(b => b.n === plan.bloque)) {
    return { ...guardado, actual: plan.bloque, plan_inicio: plan.inicio, bloques: reprogramarDesde(guardado.bloques, plan.bloque, plan.inicio, plan.semanas) };
  }
  return { objetivo: plan.objetivo, actual: 1, plan_inicio: plan.inicio, bloques: macrociclo(plan.objetivo, plan.inicio, { nivel, semanas: plan.semanas }) };
}

/** Semana del plan en la que cae hoy (1, 2, …), o null si el plan no empieza o ya terminó. */
export function semanaDe(plan, hoy) {
  const dias = (Date.parse(hoy + 'T12:00:00Z') - Date.parse(plan.inicio + 'T12:00:00Z')) / 864e5;
  if (!(dias >= 0)) return null;
  const s = Math.floor(dias / 7) + 1;
  return s <= plan.semanas ? s : null;
}

/**
 * Si la tendencia de bienestar pide adelantar la descarga y todavía se puede (el bloque dura al menos 3 semanas y
 * la descarga nueva queda por delante), qué semana pasaría a ser de descarga. No cambia nada.
 * @param registros bienestar diario [{fecha, puntaje}], en cualquier orden
 */
export function propuestaDescarga(plan, hoy, registros) {
  if (!plan?.semana_descarga) return null;
  const actual = semanaDe(plan, hoy);
  const nueva = plan.semana_descarga - 1;
  if (!actual || nueva < 3 || nueva <= actual) return null;
  const t = tendencia([...registros].filter(r => r.fecha <= hoy).sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).slice(-21));
  if (t.accion !== 'adelantar_descarga') return null;
  return { semana: nueva, actual, desde: sumarDias(plan.inicio, (nueva - 1) * 7), quita: plan.semana_descarga, motivo: t.motivo };
}

/** La semana `nueva` pasa a ser la descarga y el bloque termina ahí (las semanas siguientes se quitan). */
export function adelantarDescarga(plan, nueva) {
  const out = structuredClone(plan);
  out.dias = out.dias.filter(d => d.semana <= nueva);
  for (const d of out.dias.filter(x => x.semana === nueva)) {
    d.racional = TEXTO_DESCARGA;
    d.ejercicios = d.ejercicios.map(comoDescarga);
  }
  out.semanas = nueva;
  out.semana_descarga = nueva;
  if (out.justificacion) {
    out.justificacion = out.justificacion.replace(/^Plan de \d+ semanas/, `Plan de ${nueva} semanas`)
      .replace(/La semana \d+ es de descarga\./, `La semana ${nueva} es de descarga: se adelantó porque venías con poca energía.`);
  }
  return out;
}

/** Ajusta la duración del bloque en curso según la tendencia de bienestar. Devuelve los bloques reprogramados. */
export function ajustarMacrociclo(bloques, nActual, accion) {
  const out = structuredClone(bloques);
  const b = out.find(x => x.n === nActual);
  if (!b) return out;
  if (accion === 'adelantar_descarga' && b.semanas > 3) b.semanas -= 1;
  if (accion === 'puede_extender' && b.semanas < 5) b.semanas += 1;
  b.semana_descarga = b.semanas;
  b.fin = sumarDias(b.inicio, b.semanas * 7 - 1);
  let f = sumarDias(b.fin, 1);
  for (const x of out.filter(y => y.n > nActual)) {
    x.inicio = f; x.fin = sumarDias(f, x.semanas * 7 - 1); f = sumarDias(x.fin, 1);
  }
  return out;
}

/**
 * Aplica la fase al plan del bloque: series y repeticiones de las semanas normales (no a la descarga).
 * @param minutos tiempo disponible por sesión: si con las series sumadas no cabe, se devuelven desde lo menos prioritario
 */
export function aplicarFase(plan, bloque, { minutos = null } = {}) {
  const nuevo = structuredClone(plan);
  nuevo.fase = bloque.fase;
  nuevo.bloque = bloque.n;
  if (plan.justificacion) nuevo.justificacion = `Bloque ${bloque.n}, ${bloque.nombre.toLowerCase()}: ${bloque.enfoque} ${plan.justificacion}`;
  for (const d of nuevo.dias) {
    if (d.semana === nuevo.semana_descarga) continue;
    const antes = new Map(d.ejercicios.map(e => [e, e.series]));
    for (const e of d.ejercicios) {
      if (e.unidad === 'seg' || e.unidad === 'm') continue;
      e.series = Math.max(1, Math.min(6, Math.round(e.series * bloque.series)));
      if (bloque.reps && e.prioridad === 1) {
        e.reps_min = Math.max(3, e.reps_min + bloque.reps);
        e.reps_max = Math.max(e.reps_min + 1, e.reps_max + bloque.reps);
      }
      e.rir = Math.min(5, e.rir + bloque.rir);
    }
    while (minutos && duracionSesion(d) > minutos) {
      const e = d.ejercicios.filter(x => x.series > antes.get(x)).sort((a, b) => b.prioridad - a.prioridad || b.orden - a.orden)[0];
      if (!e) break;
      e.series--;
    }
  }
  return nuevo;
}
