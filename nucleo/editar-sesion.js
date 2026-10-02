// Edición manual de hoy: prepara una copia, conserva las otras fechas y valida antes de guardar.
import { normalizar, tieneEquipo, nivelAlcanza, articulacionesBloqueadas, cargaZonaBloqueada } from './catalogo.js';
import { prescripcion, comoDescarga, duracionSesion } from './motor-plan.js';
import { validarPlan } from './validador.js';
import { grupos } from './superseries.js';

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

export function editarSesion(accion, ctx) {
  const { plan, hoy, indice, derivados: d } = ctx;
  if (!plan?.dias?.length || plan.bloqueado) return { error: 'Primero arma tu plan.' };
  const nuevo = structuredClone(plan);
  let dia = nuevo.dias.find(x => x.fecha === hoy);
  let ejercicio;
  if (accion.tipo === 'agregar') {
    const ej = indice.porId.get(accion.ejercicio);
    const motivo = motivoNoAgregar(ej, ctx);
    if (motivo) return { error: motivo };
    if (!dia) {
      const semana = Math.max(1, Math.floor((Date.parse(hoy) - Date.parse(plan.inicio)) / 604800000) + 1);
      dia = { fecha: hoy, semana, foco: 'Sesión libre', lugar: ctx.respuestas.lugares?.find(l => l.principal)?.nombre || ctx.respuestas.lugares?.[0]?.nombre,
        ejercicios: [], calentamiento: [], estiramiento: [], cardio: null, racional: 'Sesión armada por ti para hoy.' };
      nuevo.dias.push(dia); nuevo.dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
    }
    const p = prescripcion(ej, 2, d);
    if (ej.tipo === 'cardio') Object.assign(p, { series: 1, reps_min: 120, reps_max: 180, unidad: 'seg', descanso_seg: 0 });
    if (ej.tipo === 'movilidad') Object.assign(p, { series: 1, reps_min: 30, reps_max: 45, unidad: 'seg', descanso_seg: 0 });
    ejercicio = { ejercicio_id: ej.id, nombre: ej.nombre, ...p, prioridad: 2, orden: dia.ejercicios.length, carga_kg: null,
      nota: p.unidad === 'seg' ? 'Agregado por ti. Registra los segundos de cada serie.' : 'Agregado por ti. Elige un peso con la reserva indicada.' };
    if (dia.semana === plan.semana_descarga) ejercicio = comoDescarga(ejercicio);
    dia.ejercicios.push(ejercicio);
  } else if (accion.tipo === 'quitar') {
    const k = dia?.ejercicios.findIndex((e, i) => (e.ejercicio_id || `i${i}`) === accion.ejercicio) ?? -1;
    if (k < 0) return { error: 'Ese ejercicio ya no está en la sesión.' };
    ejercicio = dia.ejercicios[k];
    if (ejercicio.indicacion) return { error: 'Este ejercicio forma parte de una indicación profesional.' };
    const marcadas = ctx.registro?.[hoy]?.[accion.ejercicio]?.some(x => x?.hecho);
    const guardadas = ctx.sesiones?.some(s => s.fecha === hoy && s.series?.some(x => x.ejercicio_id === accion.ejercicio));
    if (marcadas || guardadas) return { error: 'Ya registraste series de este ejercicio. Se conserva para no perder lo que hiciste.' };
    dia.ejercicios.splice(k, 1);
    const g = grupos(dia.ejercicios);
    dia.ejercicios.forEach((e, i) => { e.orden = i; if (!g[i]) delete e.superserie; });
  } else return { error: 'No reconozco ese cambio.' };
  const v = validarPlan(nuevo, ctx);
  if (!v.ok) return { error: v.errores.map(e => e.mensaje).join(' ') };
  return { plan: nuevo, ejercicio, minutos: duracionSesion(dia), cantidad: dia.ejercicios.length, advertencias: v.advertencias };
}
