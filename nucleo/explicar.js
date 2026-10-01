import { prioridadEsfuerzo } from './series.js';

// Botón "¿Por qué?": para cada ejercicio del plan, qué decisión se tomó y qué texto y qué paper la respaldan.
// Las respuestas salen de contenido/evidencia.json (los mismos textos que lee la persona en la biblioteca), así
// que si cambia un texto, cambia la explicación.

/** Sección "## …" de un texto de evidencia: lo que hacemos, por qué y las referencias [n] que cita. */
export function seccion(evidencia, archivo, encabezado) {
  const doc = evidencia.textos.find(t => t.archivo === archivo || t.id === archivo);
  if (!doc) return null;
  const partes = doc.texto.split(/\n(?=## )/);
  const p = partes.find(x => x.startsWith('## ') && x.toLowerCase().includes(encabezado.toLowerCase()));
  if (!p) return null;
  const que = (p.match(/\*\*Qué hacemos\.\*\*\s*([^\n]+)/) || [])[1] || null;
  const porque = (p.match(/\*\*Por qué\.\*\*\s*([^\n]+)/) || [])[1] || p.split('\n').slice(1).join(' ').trim();
  const refs = [...new Set([...p.matchAll(/\[(\d+(?:,\s*\d+)*)\]/g)].flatMap(m => m[1].split(',').map(n => Number(n.trim()))))];
  return { documento: doc.titulo, archivo: doc.archivo, titulo: p.split('\n')[0].replace(/^##\s*/, ''), que, porque, refs };
}

const NOMBRE_PATRON = {
  sentadilla: 'sentadilla', bisagra: 'bisagra de cadera', empuje_horizontal: 'empuje horizontal', empuje_vertical: 'empuje vertical',
  tiron_horizontal: 'tirón horizontal (remo)', tiron_vertical: 'tirón vertical', unilateral_pierna: 'pierna a una pierna',
  extension_cadera: 'extensión de cadera', extension_rodilla: 'extensión de rodilla', flexion_rodilla: 'flexión de rodilla',
};
const NOMBRE_MUSCULO = {
  gluteo: 'glúteo', cuadriceps: 'cuádriceps', femoral: 'femoral', aductor_abductor: 'aductores y abductores', pecho: 'pecho',
  espalda: 'espalda', hombro: 'hombro', biceps: 'bíceps', triceps: 'tríceps', core: 'core', pantorrilla: 'pantorrilla',
  antebrazo: 'antebrazo', trapecio: 'trapecio', erectores: 'zona lumbar',
};
const lista = xs => xs.map(m => NOMBRE_MUSCULO[m] || m).join(', ');

/** Enlace a videos de técnica. Por ahora una búsqueda en YouTube; más adelante, videos elegidos uno por uno. */
export const enlaceVideo = ej => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${ej.nombre} técnica correcta`)}`;

/**
 * @param p.e        ejercicio del plan ({ejercicio_id, series, reps_min, reps_max, rir, descanso_seg, unidad, prioridad, carga_kg})
 * @param p.dia      día del plan donde está
 * @param p.plan     plan completo (para saber si es semana de descarga)
 * @param p.respuestas cuestionario (favoritos, lesiones, objetivo)
 * @param p.indice   crearIndice(catalogo)
 * @param p.evidencia contenido/evidencia.json
 */
export function explicarEjercicio(p) {
  const { e, dia, plan, respuestas: r = {}, indice, evidencia } = p;
  const ej = indice.porId.get(e.ejercicio_id);
  if (!ej) return null;
  const P = '00-principios.md';
  const motivos = [];
  const agregar = (pregunta, respuesta, sec) => motivos.push({ pregunta, respuesta, fuente: sec ? { documento: sec.documento, seccion: sec.titulo, archivo: sec.archivo } : null, refs: sec?.refs || [] });

  // El ejercicio
  const prioritarios = (r.musculos_prioridad || []).filter(m => ej.musculos_primarios.includes(m));
  let texto = `Trabaja ${lista(ej.musculos_primarios)}${ej.musculos_secundarios.length ? ` y en menor medida ${lista(ej.musculos_secundarios)}` : ''}`;
  texto += NOMBRE_PATRON[ej.patron] ? `, con un movimiento de ${NOMBRE_PATRON[ej.patron]}.` : '.';
  if ((r.favoritos || []).includes(ej.id)) texto += ' Lo marcaste como favorito, así que se queda fijo.';
  if (prioritarios.length) texto += ` Es una de tus zonas prioritarias (${lista(prioritarios)}), por eso va antes y recibe más series.`;
  if (e.prioridad === 1) texto += ' Es de lo principal del día: va primero, cuando estás más fresco.';
  else if (e.prioridad >= 3) texto += ' Es complementario: si falta tiempo, es de lo primero que se salta.';
  agregar('¿Por qué este ejercicio?', texto, prioritarios.length ? seccion(evidencia, '01-ganar-musculo.md', 'Cómo es tu plan') : seccion(evidencia, P, 'dos veces por semana'));

  // Series
  agregar(`¿Por qué ${e.series} series?`, 'Las series de cada ejercicio suman las series semanales de cada músculo, que es lo que más pesa para ganar músculo. Se parte en un rango moderado y se sube solo si te recuperas bien.', seccion(evidencia, P, 'Suficientes series'));

  // Repeticiones o segundos
  if (e.unidad === 'seg') agregar(`¿Por qué ${e.reps_min} a ${e.reps_max} segundos?`, 'Es un ejercicio de estabilidad: lo que cuenta es sostener la posición con buena técnica, no cuántas veces se repite.', null);
  else agregar(`¿Por qué ${e.reps_min} a ${e.reps_max} repeticiones?`, e.reps_max <= 6
    ? 'Rangos bajos con carga alta, porque tu objetivo incluye fuerza máxima.'
    : 'En este rango se gana músculo igual que con cargas más pesadas, con menos desgaste para las articulaciones.', seccion(evidencia, P, 'Pesado o liviano'));

  // Reserva
  agregar(`¿Por qué dejar ${e.rir} repeticiones de reserva?`, 'Llegar cerca del fallo da el mismo estímulo que llegar al fallo, con menos cansancio para las series y sesiones siguientes.', seccion(evidencia, P, 'Cerca del fallo'));

  // Qué priorizar si no calzan repeticiones y reserva
  const zonas0 = (r.lesiones || []).filter(l => l.activa !== false).map(l => l.region);
  const pr = prioridadEsfuerzo(e, ej, p.derivados || {}, zonas0);
  agregar('¿Qué priorizo si no me salen las repeticiones?', pr.texto, seccion(evidencia, P, 'Cerca del fallo'));

  // Descanso
  if (e.descanso_seg) agregar(`¿Por qué descansar ${String(Math.round(e.descanso_seg / 60 * 10) / 10).replace('.', ',')} minutos?`, 'Con descansos cortos la serie siguiente sale con menos repeticiones.', seccion(evidencia, P, 'Descansar'));

  // Carga y progresión
  if (e.unidad !== 'seg') agregar('¿Cuándo subo el peso?', 'Cuando completes todas las series en el tope de repeticiones con la reserva indicada. Antes, apunta a una repetición más con el mismo peso.', seccion(evidencia, P, 'Progresar de a poco'));

  // Descarga
  if (plan && dia && dia.semana === plan.semana_descarga) agregar('¿Por qué esta semana es más liviana?', 'Es la semana de descarga: la mitad de las series y más reserva, para que la fatiga baje y llegues mejor al próximo bloque.', seccion(evidencia, P, 'Semanas de descarga'));

  // Molestias
  const zonas = (r.lesiones || []).filter(l => l.activa !== false).map(l => l.region);
  const tocan = ej.carga_articular.filter(a => zonas.includes(a));
  if (tocan.length) agregar('¿Y mi molestia?', `Este ejercicio usa ${tocan.join(' y ')}, donde marcaste una molestia leve. Si duele más de 3 sobre 10 o empeora al día siguiente, usa "Tengo un problema" para cambiarlo.`, seccion(evidencia, '06-dolor-y-lesiones.md', 'Por qué dejamos seguir'));

  const citadas = [...new Set(motivos.flatMap(m => m.refs))].sort((a, b) => a - b);
  return {
    ejercicio: ej.nombre,
    video: enlaceVideo(ej),
    motivos,
    referencias: citadas.map(n => evidencia.referencias?.find(x => x.n === n)).filter(Boolean),
  };
}
