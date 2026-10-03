// Edición manual de hoy: agregar, quitar y ordenar ejercicios, solo hoy o desde hoy en adelante (las sesiones que
// vienen con la misma plantilla). Prepara una copia, no toca lo demás y valida antes de guardar.
import { normalizar, tieneEquipo, nivelAlcanza, articulacionesBloqueadas, cargaZonaBloqueada } from './catalogo.js';
import { prescripcion, comoDescarga, duracionSesion } from './motor-plan.js';
import { validarCambio } from './validador.js';
import { grupos } from './superseries.js';
import { seriesRetiradas } from './series-retiradas.js';
import { calentamientoDeSesion } from './calentamiento-sesion.js';

export function buscarEjercicios(indice, { texto = '', musculo = '', equipo = '', nombresMusculos = {}, nombresEquipos = {} } = {}) {
  const palabras = normalizar(texto).split(' ').filter(Boolean);
  return indice.ejercicios.filter(e => {
    const contenido = normalizar([e.nombre, e.nombre_hevy, ...(e.alias || []), ...e.musculos_primarios, ...e.musculos_secundarios, ...e.equipamiento,
      ...[...e.musculos_primarios, ...e.musculos_secundarios].map(m => nombresMusculos[m] || ''), ...e.equipamiento.map(q => nombresEquipos[q] || '')].join(' '));
    return palabras.every(p => contenido.includes(p) || (p.length > 4 && p.endsWith('s') && contenido.includes(p.slice(0, -1)))) && (!musculo || [...e.musculos_primarios, ...e.musculos_secundarios].includes(musculo))
      && (!equipo || e.equipamiento.includes(equipo));
  }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

export function motivoNoAgregar(ej, ctx) {
  const { plan, hoy, respuestas: r, derivados: d } = ctx;
  if (!plan?.dias?.length || plan.bloqueado) return 'Primero arma tu plan.';
  if (!ej) return 'El ejercicio no está en el banco.';
  const dia = plan.dias.find(x => x.fecha === hoy);
  if (dia?.ejercicios.some(e => e.ejercicio_id === ej.id)) return 'Ya está en la sesión de hoy.';
  const lugar = r.lugares?.find(l => l.nombre === dia?.lugar) || r.lugares?.find(l => l.principal) || r.lugares?.[0];
  if (!tieneEquipo(ej, lugar?.equipamiento || [])) return 'No tienes su equipo en el lugar de hoy.';
  if (!nivelAlcanza(d.nivel, ej.nivel_minimo)) return `Requiere nivel ${ej.nivel_minimo}.`;
  const zonas = articulacionesBloqueadas(r.lesiones || [], hoy);
  for (const i of ctx.indicaciones || []) if (!i.hasta || i.hasta >= hoy) for (const z of i.restricciones?.zonas || []) zonas.add(z);
  if (cargaZonaBloqueada(ej, zonas)) return 'Carga una zona que tienes restringida.';
  if (r.prohibidos?.includes(ej.id)) return 'Lo excluiste en tu perfil.';
  return null;
}

// Superseries: si al quitar u ordenar un ejercicio queda solo o separado de su pareja, se hace como serie normal.
function sinSuperseriesSueltas(dia) {
  const g = grupos(dia.ejercicios);
  dia.ejercicios.forEach((e, i) => { e.orden = i; if (!g[i]) delete e.superserie; });
}
/** "Desde hoy en adelante": las sesiones que vienen con la misma plantilla que hoy (la sesión libre no tiene). */
export const siguientes = (plan, dia, accion = { alcance: 'adelante' }) => (accion.alcance === 'adelante' && dia?.plantilla
  ? plan.dias.filter(x => x.fecha > dia.fecha && x.plantilla === dia.plantilla) : []);

export function editarSesion(accion, ctx) {
  const { plan, hoy, indice, derivados: d } = ctx;
  if (!plan?.dias?.length || plan.bloqueado) return { error: 'Primero arma tu plan.' };
  const nuevo = structuredClone(plan);
  let dia = nuevo.dias.find(x => x.fecha === hoy);
  let ejercicio, fueraDelPlan = false, afectados = 0;
  if (accion.tipo === 'agregar') {
    const ej = indice.porId.get(accion.ejercicio);
    const motivo = motivoNoAgregar(ej, ctx);
    if (motivo) return { error: motivo };
    if (!dia) {
      // En la semana de margen después del plan, el día nuevo queda en la última semana: un respaldo no acepta
      // semanas fuera del plan. No es descarga aunque la última lo sea, porque el bloque ya terminó.
      const semanaReal = Math.max(1, Math.floor((Date.parse(hoy) - Date.parse(plan.inicio)) / 604800000) + 1);
      if (semanaReal > plan.semanas + 1) return { error: 'Tu plan terminó hace más de una semana. Arma uno nuevo en Tu plan para agregar ejercicios.' };
      fueraDelPlan = semanaReal > plan.semanas;
      dia = { fecha: hoy, semana: Math.min(plan.semanas, semanaReal), foco: 'Sesión libre', lugar: ctx.respuestas.lugares?.find(l => l.principal)?.nombre || ctx.respuestas.lugares?.[0]?.nombre,
        ejercicios: [], calentamiento: [], estiramiento: [], cardio: null, racional: 'Sesión armada por ti para hoy.' };
      nuevo.dias.push(dia); nuevo.dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
    }
    const nuevoEj = (x, descarga) => {
      const p = prescripcion(ej, 2, d);
      if (ej.tipo === 'cardio') Object.assign(p, { series: 1, reps_min: 120, reps_max: 180, unidad: 'seg', descanso_seg: 0 });
      if (ej.tipo === 'movilidad') Object.assign(p, { series: 1, reps_min: 30, reps_max: 45, unidad: 'seg', descanso_seg: 0 });
      const nuevoE = { ejercicio_id: ej.id, nombre: ej.nombre, ...p, prioridad: 2, orden: x.ejercicios.length, carga_kg: null,
        nota: p.unidad === 'seg' ? 'Agregado por ti. Registra los segundos de cada serie.' : p.unidad === 'm' ? 'Agregado por ti. Anota el peso y los metros de cada serie.' : 'Agregado por ti. Elige un peso con la reserva indicada.' };
      return descarga ? comoDescarga(nuevoE) : nuevoE;
    };
    ejercicio = nuevoEj(dia, !fueraDelPlan && dia.semana === plan.semana_descarga);
    dia.ejercicios.push(ejercicio);
    for (const x of siguientes(nuevo, dia, accion)) if (!x.ejercicios.some(e => e.ejercicio_id === ej.id)) { x.ejercicios.push(nuevoEj(x, x.semana === plan.semana_descarga)); afectados++; }
  } else if (accion.tipo === 'quitar') {
    const k = dia?.ejercicios.findIndex((e, i) => (e.ejercicio_id || `i${i}`) === accion.ejercicio) ?? -1;
    if (k < 0) return { error: 'Ese ejercicio ya no está en la sesión.' };
    ejercicio = dia.ejercicios[k];
    if (ejercicio.indicacion) return { error: 'Este ejercicio forma parte de una indicación profesional.' };
    dia.ejercicios.splice(k, 1);
    sinSuperseriesSueltas(dia);
    for (const x of siguientes(nuevo, dia, accion)) {
      const j = x.ejercicios.findIndex(e => e.ejercicio_id === ejercicio.ejercicio_id && !e.indicacion);
      if (j >= 0 && ejercicio.ejercicio_id) { x.ejercicios.splice(j, 1); sinSuperseriesSueltas(x); afectados++; }
    }
  } else if (accion.tipo === 'ordenar') {
    // El orden nuevo, por id. Lo que no venga en la lista queda al final, en su orden de antes.
    if (!dia?.ejercicios.length) return { error: 'Hoy no hay ejercicios para ordenar.' };
    const pos = id => { const i = (accion.orden || []).indexOf(id); return i < 0 ? Infinity : i; };
    const ordenar = x => { x.ejercicios = x.ejercicios.map((e, i) => [e, i]).sort(([a, i], [b, j]) => pos(a.ejercicio_id || `i${i}`) - pos(b.ejercicio_id || `i${j}`) || i - j).map(([e]) => e); sinSuperseriesSueltas(x); };
    ordenar(dia);
    for (const x of siguientes(nuevo, dia, accion)) { const antes = x.ejercicios.map(e => e.ejercicio_id).join(); ordenar(x); if (x.ejercicios.map(e => e.ejercicio_id).join() !== antes) afectados++; }
  } else return { error: 'No reconozco ese cambio.' };
  // La preparación y sus minutos siguen a los ejercicios elegidos; las indicaciones importadas se conservan.
  if (accion.tipo === 'agregar' || accion.tipo === 'quitar') for (const x of [dia, ...siguientes(nuevo, dia, accion)]) {
    const lugar = ctx.respuestas.lugares?.find(l => l.nombre === x.lugar) || ctx.respuestas.lugares?.find(l => l.principal) || ctx.respuestas.lugares?.[0];
    x.calentamiento = calentamientoDeSesion({ dia: x, porId: indice.porId, equipo: lugar?.equipamiento || [], bloqueadas: articulacionesBloqueadas(ctx.respuestas.lesiones || [], x.fecha) });
  }
  // Un error que el plan ya traía no bloquea agregar ni quitar (nucleo/validador.js: validarCambio).
  const v = validarCambio(plan, nuevo, ctx);
  if (!v.ok) return { error: v.errores.map(e => e.mensaje).join(' ') };
  return { plan: nuevo, ejercicio, minutos: duracionSesion(dia), cantidad: dia.ejercicios.length, advertencias: v.advertencias, siguientes: afectados,
    ...(accion.tipo === 'quitar' ? { conservar: seriesRetiradas(ejercicio, ctx) } : {}) };
}
