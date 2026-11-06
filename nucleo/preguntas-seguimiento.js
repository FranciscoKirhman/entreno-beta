import { guardarEnBorrador, guardarCambioEjercicio } from './ciclo-siguiente.js';
import { esDeTrabajoGuardada } from './registro.js';
import { sumarDias } from './agenda.js';
import { lunesDe, hechasPorMusculo, planeadasPorMusculo, CON_FRANJA } from './volumen-semana.js';
import { alternativas } from './checkin.js';
import { articulacionesBloqueadas, esAsistido } from './catalogo.js';
import { lugaresDe, incrementoPara } from './motor-plan.js';
import { describir } from './sesion-viva.js';
import { deshacer } from './superseries.js';
import { TOPE_SERIES_SESION } from './tiempo-sesion.js';
const nombre = (indice, id) => indice.porId.get(id)?.nombre || 'Ejercicio';
const ZONAS = new Set(['hombro', 'codo', 'muneca', 'lumbar', 'cadera', 'rodilla', 'tobillo', 'cuello', 'espalda', 'pecho']);
const MUSCULOS = { gluteo: 'glúteos', cuadriceps: 'cuádriceps', femoral: 'femorales', aductor_abductor: 'aductores y abductores', espalda: 'espalda', pecho: 'pecho', hombro: 'hombros', biceps: 'bíceps', triceps: 'tríceps' };
export function preguntasSeguimiento({ plan, sesiones = [], respuestas = {}, saludFeed = {}, notas = {}, indice, hoy }) {
  const out = [], bloque = plan.inicio || 'actual', fechas = new Map();
  for (const s of sesiones.filter(s => s.fecha <= hoy)) for (const id of new Set((s.series || []).filter(esDeTrabajoGuardada).map(x => x.ejercicio_id).filter(Boolean))) {
    if (!fechas.has(id)) fechas.set(id, new Set()); fechas.get(id).add(s.fecha);
  }
  for (const [id, fs] of fechas) {
    const ds = [...fs].sort();
    if (ds.length !== 2 || ds[0] < (plan.inicio || sumarDias(hoy, -28)) || ds[1] < sumarDias(hoy, -14)) continue;
    if ((respuestas.favoritos || []).includes(id) || (respuestas.prohibidos || []).includes(id)) continue;
    out.push({ id: `nuevo:${bloque}:${id}`, tipo: 'nuevo', fecha: ds[1], ejercicio_id: id, dato: { fechas: ds }, titulo: `¿Te gustó ${nombre(indice, id)}?`, texto: 'Es nuevo en tu historial y ya lo hiciste dos veces. Lo que elijas quedará para tu próximo bloque.', opciones: [
      { id: 'favorito', etiqueta: 'Dejarlo como favorito', efecto: 'favorito' }, { id: 'sacar', etiqueta: 'Sacarlo del próximo bloque', efecto: 'evitar' }, { id: 'igual', etiqueta: 'Me da igual', efecto: 'nada' },
    ] });
  }
  // Solo campos estructurados de molestias. El texto libre no se interpreta como diagnóstico.
  const zonas = new Map();
  const agregar = (fecha, id, r) => {
    if (fecha > hoy || fecha < sumarDias(hoy, -14) || !ZONAS.has(r?.dolor_zona) || !['leve', 'me_preocupa'].includes(r?.molestia)) return;
    const previa = zonas.get(r.dolor_zona);
    if (!previa || fecha > previa.fecha) zonas.set(r.dolor_zona, { fecha, ejercicio_id: id, zona: r.dolor_zona });
  };
  for (const s of sesiones) for (const n of s.notas || []) agregar(s.fecha, n.ejercicio_id, n.respuestas);
  for (const [fecha, ns] of Object.entries(notas)) for (const [id, r] of Object.entries(ns || {})) agregar(fecha, id, r);
  for (const [zona, dato] of zonas) {
    const prefijo = `molestia:${bloque}:${zona}`;
    const respondidas = Object.entries(saludFeed.respuestas || {}).filter(([id, r]) => r.dato?.zona === zona || id === prefijo || id.startsWith(prefijo + ':'));
    const ultimaRespuesta = respondidas.map(([, r]) => r.fecha).filter(Boolean).sort().at(-1);
    if (ultimaRespuesta && dato.fecha <= ultimaRespuesta) continue;
    const id = `${prefijo}:${dato.fecha}`;
    if (saludFeed.respuestas?.[id]) continue;
    out.push({ id, tipo: 'molestia', salud: true, fecha: dato.fecha, zona, dato, titulo: '¿Sigue molestando?', texto: `Anotaste una molestia en ${zona === 'muneca' ? 'la muñeca' : zona}. ¿Cómo está ahora? Esta respuesta es privada y no se envía al coach con IA.`, opciones: [
      { id: 'no', etiqueta: 'Ya no molesta', efecto: 'molestia_resuelta' }, { id: 'poco', etiqueta: 'Un poco, aliviar la próxima sesión', efecto: 'aliviar' }, { id: 'harto', etiqueta: 'Harto, ver alternativas y consultar', efecto: 'alternativa_zona' },
    ] });
  }
  const semanas = [-14, -7].map(n => sumarDias(lunesDe(hoy), n));
  if (semanas[0] >= plan.inicio) {
    const indiceVolumen = { porId: new Map([...indice.porId].filter(([, e]) => Array.isArray(e.musculos_primarios) && Array.isArray(e.musculos_secundarios))) };
    const series = sesiones.flatMap(s => (s.series || []).filter(esDeTrabajoGuardada).map(x => ({ ...x, fecha: s.fecha })));
    const valores = semanas.map(desde => ({ desde, hasta: sumarDias(desde, 6), p: planeadasPorMusculo(plan, indiceVolumen, desde, sumarDias(desde, 6)), h: hechasPorMusculo(series, indiceVolumen, desde, sumarDias(desde, 6)) }));
    const presentes = new Set(sesiones.map(s => s.fecha));
    // Si faltó la mayoría de las sesiones, conviene recuperar la semana antes que añadir volumen.
    const consistente = valores.every(v => { const ds = plan.dias.filter(d => d.fecha >= v.desde && d.fecha <= v.hasta); return ds.length && ds.filter(d => presentes.has(d.fecha)).length / ds.length >= 0.75; });
    if (consistente) for (const musculo of CON_FRANJA) {
      if (!valores.every(v => v.p[musculo] >= 4 && v.p[musculo] - (v.h[musculo] || 0) >= 2 && (v.h[musculo] || 0) / v.p[musculo] < 0.8)) continue;
      const candidatos = plan.dias.filter(d => d.fecha >= hoy && d.fecha <= sumarDias(hoy, 13) && !presentes.has(d.fecha) && d.ejercicios.some(e => indice.porId.get(e.ejercicio_id)?.musculos_primarios?.includes(musculo))).slice(0, 3);
      const dato = valores.map(v => ({ desde: v.desde, hasta: v.hasta, planeadas: v.p[musculo], hechas: v.h[musculo] || 0 }));
      out.push({ id: `volumen:${bloque}:${musculo}`, tipo: 'volumen', fecha: valores.at(-1).hasta, musculo, dato, titulo: `¿Sumamos trabajo de ${MUSCULOS[musculo]}?`, texto: `Dos semanas bajo lo planificado: ${dato.map(v => `${v.hechas} de ${v.planeadas} series`).join('; ')}. Elige el día que te acomoda o déjalo para el próximo bloque.`, opciones: [
        ...candidatos.map(d => ({ id: `sumar:${d.fecha}`, etiqueta: `Sumar 2 series: ${d.foco}, ${Number(d.fecha.slice(8))}/${Number(d.fecha.slice(5, 7))}`, efecto: 'sumar_volumen', fecha: d.fecha })),
        { id: 'prioridad', etiqueta: 'Priorizarlo en el próximo bloque', efecto: 'prioridad' },
      ] });
    }
  }
  return out;
}

export function efectoSeguimiento(p, o, ctx) {
  const r = ctx.respuestas || {}, lista = k => r.ciclo_siguiente?.[k] || r[k] || [];
  if (['favorito', 'evitar'].includes(o.efecto)) {
    return { respuestas: guardarCambioEjercicio(r, p.ejercicio_id, o.efecto), detalle: `${nombre(ctx.indice, p.ejercicio_id)} quedaría ${o.efecto === 'favorito' ? 'como favorito' : 'fuera'} en el próximo bloque. El plan actual sigue igual.` };
  }
  if (o.efecto === 'prioridad') return { respuestas: guardarEnBorrador(r, { musculos_prioridad: [...new Set([...lista('musculos_prioridad'), p.musculo])] }), detalle: `${MUSCULOS[p.musculo]} quedaría como prioridad del próximo bloque, que confirmarás al armarlo.` };
  if (o.efecto === 'molestia_resuelta') return { detalle: 'Guardaré que ya no molesta. Esto no borra lesiones ni restricciones de tu perfil.' };
  if (p.tipo === 'nuevo' && o.efecto === 'nada') return { detalle: 'Guardaré que este ejercicio te da igual. El plan y tus preferencias siguen iguales.' };
  if (!['sumar_volumen', 'aliviar', 'alternativa_zona'].includes(o.efecto)) return null;
  const plan = structuredClone(ctx.plan), cambios = [];
  const libre = d => d.fecha >= ctx.hoy && !(ctx.hechas || []).includes(d.fecha) && !(ctx.enCurso || []).includes(d.fecha);
  if (o.efecto === 'sumar_volumen') {
    const d = plan.dias.find(d => d.fecha === o.fecha && libre(d));
    if (!d) return { error: 'Ese día ya no está disponible. Revisa otra fecha.' };
    const e = d.ejercicios.find(e => e.series <= 4 && ctx.indice.porId.get(e.ejercicio_id)?.musculos_primarios?.includes(p.musculo));
    if (!e) return { error: 'No puedo sumar dos series a ese día sin pasar el límite del ejercicio.' };
    const total = d.ejercicios.reduce((n, e) => n + e.series, 0);
    const primarios = ctx.indice.porId.get(e.ejercicio_id).musculos_primarios;
    const pasaMusculo = primarios.some(m => d.ejercicios.reduce((n, e) => n + (ctx.indice.porId.get(e.ejercicio_id)?.musculos_primarios?.includes(m) ? e.series : 0), 0) + 2 > 12);
    if (pasaMusculo || total + 2 > (TOPE_SERIES_SESION[ctx.derivados?.nivel] || 26)) return { error: 'Ese día ya tiene suficiente volumen. Elige otro o priorízalo en el próximo bloque.' };
    const antes = describir(e); e.series += 2;
    d.ejercicios = deshacer(d.ejercicios, new Set([e.ejercicio_id]));
    cambios.push({ fecha: d.fecha, antes, despues: describir(e) });
    return { plan, cambios, detalle: `Sumaría 2 series de ${nombre(ctx.indice, e.ejercicio_id)} solo el ${d.fecha.split('-').reverse().join('/')}. Las demás fechas siguen igual.` };
  }
  const d = plan.dias.filter(libre).sort((a, b) => a.fecha.localeCompare(b.fecha)).find(d => d.ejercicios.some(e => ctx.indice.porId.get(e.ejercicio_id)?.carga_articular?.includes(p.zona)));
  if (!d) return { detalle: 'No hay ejercicios pendientes que carguen esa zona. Si la molestia es fuerte o persiste, consulta a un profesional antes de retomarlos.' };
  const lugares = lugaresDe(r), lugar = lugares.find(l => l.nombre === d.lugar) || lugares.find(l => l.principal) || lugares[0];
  const bloqueadas = articulacionesBloqueadas(r.lesiones || [], ctx.hoy); bloqueadas.add(p.zona);
  for (const e of d.ejercicios) {
    const ej = ctx.indice.porId.get(e.ejercicio_id);
    if (!ej?.carga_articular?.includes(p.zona)) continue;
    const antes = `${ej.nombre}: ${describir(e)}`;
    if (o.efecto === 'aliviar') {
      e.series = Math.min(e.series, 2); e.rir = Math.min(5, (e.rir || 0) + 2);
      const paso = incrementoPara(ej, lugar);
      if (paso && Number(e.carga_kg) > paso && !esAsistido(ej)) e.carga_kg = Math.max(paso, Math.floor(Number(e.carga_kg) * 0.9 / paso) * paso);
    } else {
      const alt = alternativas(e.ejercicio_id, { indice: ctx.indice, equipamiento: lugar?.equipamiento || [], bloqueadas, nivel: ctx.derivados?.nivel, excluir: [...d.ejercicios.map(x => x.ejercicio_id), ...(r.prohibidos || [])] })[0];
      if (!alt) return { detalle: 'No encontré una alternativa que evite cargar esa zona. No cambies el ejercicio por tu cuenta ni entrenes con dolor fuerte; consulta a un profesional.' };
      e.ejercicio_id = alt.id; e.nombre = alt.nombre; e.carga_kg = null; e.rir = Math.max(3, e.rir || 0);
      e.unidad = alt.medida === 'seg' ? 'seg' : 'reps'; e.reps_min = alt.medida === 'seg' ? 20 : 10; e.reps_max = alt.medida === 'seg' ? 30 : 15;
    }
    cambios.push({ fecha: d.fecha, antes, despues: `${e.nombre}: ${describir(e)}` });
  }
  d.ejercicios = deshacer(d.ejercicios, new Set(d.ejercicios.filter(e => ctx.indice.porId.get(e.ejercicio_id)?.carga_articular?.includes(p.zona) || cambios.some(c => c.despues.startsWith(`${e.nombre}:`))).map(e => e.ejercicio_id)));
  return { plan, cambios, detalle: o.efecto === 'aliviar' ? 'La próxima sesión tendría menos series y más reserva en esa zona. Si duele durante el movimiento, para y consulta a un profesional.' : 'Esta alternativa evita la zona según el catálogo; no reemplaza una evaluación. Con molestia fuerte, consulta a un profesional antes de entrenar.' };
}

export function responderSalud(saludFeed, pregunta, opcion, fecha) {
  return { ...saludFeed, respuestas: { ...saludFeed?.respuestas, [pregunta.id]: { fecha, cuando: Date.now(), opcion, respuesta: pregunta.opciones.find(o => o.id === opcion)?.etiqueta || opcion, dato: pregunta.dato, titulo: pregunta.titulo, texto: pregunta.texto } } };
}
