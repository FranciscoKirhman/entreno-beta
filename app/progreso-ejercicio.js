// Tu progreso en un ejercicio, dentro de su ficha (como Hevy): el ritmo de las últimas semanas, un gráfico por medida
// (carga más alta, máximo estimado, volumen, repeticiones o tiempo) por 3 meses, 1 año o todo, tu mejor peso para
// cada número de repeticiones y el historial de cada sesión en que lo hiciste.
import { E, esc, $, hoy, fechaCorta, coma, enUnidad, unidadPeso, peso, volumenTexto, seriesTexto, indice } from './comun.js';
import { icono } from './iconos.js';
import { nombreAsistente } from './cuestionario.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { porSesion, medidasCon, desdePeriodo, ritmo, PERIODOS, periodoInicial, periodosConDatos } from '../nucleo/progreso-ejercicio.js';
import { recordsPorRepeticiones } from '../nucleo/records.js';
import { lineaHevy } from './grafico.js';
import { trazarGrafico, selectorDe } from './movimiento.js';
import { relojTexto, modoCardio, textoCardio } from '../nucleo/unidades.js';

const NOMBRE = { peso: 'Carga más alta', e1rm: 'Máximo estimado', serie: 'Mejor serie', volumen: 'Volumen de la sesión', reps: 'Repeticiones', duracion: 'Tiempo', distancia: 'Distancia' };
const elegido = new Map(); // por ejercicio: {medida, periodo}, mientras la app está abierta
let historialCompleto = false;

const num = x => coma(Math.round(x * 10) / 10);
const campoRitmo = (filas, asistido) => (asistido ? 'peso' : filas.some(f => f.e1rm != null) ? 'e1rm' : filas.some(f => f.reps != null) ? 'reps' : filas.some(f => f.peso != null) ? 'peso' : 'duracion');

/** El ritmo en una frase. corto: para la lista de Progreso. */
export function textoRitmo(r, { asistido = false, corto = false } = {}) {
  if (!r) return null;
  const u = unidadPeso();
  const cifra = v => (r.campo === 'reps' ? `${v}` : r.campo === 'duracion' ? `${v} s` : `${num(enUnidad(v))} ${u}`);
  const paso = r.campo === 'reps' ? `${num(Math.abs(r.porSemana))} ${Math.abs(r.porSemana) === 1 ? 'repetición' : 'repeticiones'}` : r.campo === 'duracion' ? `${num(Math.abs(r.porSemana))} s` : `${num(enUnidad(Math.abs(r.porSemana)))} ${u}`;
  if (corto) {
    if (r.tendencia === 'estable') return `${asistido ? 'Ayuda estable' : 'Estable'} en ${cifra(r.hasta)}`;
    return `${asistido ? 'Ayuda ' : ''}${r.porSemana > 0 ? '+' : '−'}${paso} por semana`;
  }
  const que = asistido ? 'Tu ayuda' : r.campo === 'e1rm' ? 'Tu máximo estimado' : r.campo === 'reps' ? 'Tus repeticiones' : r.campo === 'duracion' ? 'Tu mejor tiempo' : 'Tu carga más alta';
  const plural = r.campo === 'reps';
  const en = `en ${r.semanas} semanas`;
  if (r.tendencia === 'estable') return `${que} se ${plural ? 'mantienen' : 'mantiene'} en ${r.campo === 'reps' ? `unas ${cifra(r.hasta)}` : `unos ${cifra(r.hasta)}`} las últimas ${r.semanas} semanas.`;
  const verbo = r.tendencia === 'sube' ? (plural ? 'subieron' : 'subió') : (plural ? 'bajaron' : 'bajó');
  const base = `${que} ${verbo} de ${cifra(r.desde)} a ${cifra(r.hasta)} ${en}: cerca de ${paso} por semana.`;
  if (asistido) return `${base} ${r.tendencia === 'baja' ? 'Bajar la ayuda es progresar.' : 'Si la ayuda sube, revisa el descanso y el sueño.'}`;
  return r.tendencia === 'baja' ? `${base} Puede ser una descarga, cansancio o menos sueño.` : base;
}

/** Ritmo de un ejercicio a partir de todas las series anotadas. */
export function ritmoDe(series, id, { asistido = false } = {}) {
  const filas = porSesion(series, id, { asistido });
  return ritmo(filas, hoy(), { campo: campoRitmo(filas, asistido) });
}

function textoPunto(f, medida, id) {
  const cardio = modoCardio({ ejercicio_id: id });
  if (cardio === 'pisos' && medida === 'reps') return `${f.reps} pisos`;
  if (cardio && medida === 'distancia') return `${coma(Math.round(f.distancia / 10) / 100)} km`;
  switch (medida) {
    case 'peso': { const s = f.series.find(x => Number(x.carga_kg) === f.peso); return `${peso(f.peso)}${s?.reps ? ` × ${s.reps}` : ''}`; }
    case 'e1rm': return peso(f.e1rm); // "Máximo estimado" ya va bajo el valor
    case 'volumen': return volumenTexto(f.volumen);
    case 'serie': { const s = f.series.find(x => Math.round(Number(x.carga_kg) * Number(x.reps)) === f.serie); return s ? `${peso(s.carga_kg)} × ${s.reps}` : volumenTexto(f.serie); }
    case 'reps': return `${f.reps} repeticiones`;
    case 'distancia': return `${f.distancia} m`;
    default: return relojTexto(f.duracion);
  }
}

/** El valor con su unidad, para las etiquetas del gráfico (récord y mínimo). */
function etiquetaCorta(v, medida, id) {
  if (medida === 'reps') return `${Math.round(v)} ${modoCardio({ ejercicio_id: id }) === 'pisos' ? 'pisos' : 'reps'}`;
  if (medida === 'duracion') return relojTexto(Math.round(v));
  if (medida === 'distancia') return modoCardio({ ejercicio_id: id }) ? `${coma(Math.round(v / 10) / 100)} km` : `${Math.round(v)} m`;
  if (['volumen', 'serie'].includes(medida)) return `${Math.round(v).toLocaleString('es-CL')} ${unidadPeso()}`;
  return `${num(v)} ${unidadPeso()}`;
}

// Los botones de período, cortos como en Hevy; el nombre completo queda para los lectores de pantalla.
const CORTO = { '1m': '1M', '3m': '3M', '6m': '6M', '1a': '1A', todo: 'Todo' };
function botonesPeriodo(filas, medida, periodo) {
  const con = periodosConDatos(filas, hoy(), medida);
  return `<div class="gh-periodos" role="group" aria-label="Período">${PERIODOS.map(([v, t]) => `<button type="button" data-periodo="${v}" aria-pressed="${v === periodo}"${con.has(v) || v === periodo ? '' : ' disabled'}><span aria-hidden="true">${CORTO[v]}</span><span class="sr-only">${t}</span></button>`).join('')}</div>`;
}

/** 'en_curso' si es la sesión de hoy todavía sin guardar; 'descarga' si cayó en la semana de descarga del plan. */
function marcaDe(f, id) {
  const guardada = E.sesiones.some(s => s.fecha === f.fecha && (s.series || []).some(x => x.ejercicio_id === id));
  if (f.fecha === hoy() && !guardada) return 'en_curso';
  const dia = E.plan?.dias?.find(d => d.fecha === f.fecha);
  return dia && E.plan.semana_descarga && dia.semana === E.plan.semana_descarga ? 'descarga' : null;
}

function graficoHtml(id, filas, medida, periodo, asistidoActual = false, nombreMedida = '') {
  const hasta = hoy(), desde = desdePeriodo(periodo, hasta, filas);
  const enRango = filas.filter(f => f.fecha >= desde && f[medida] != null);
  const botones = botonesPeriodo(filas, medida, periodo);
  if (!enRango.length) return `<p class="pequeno suave gh-vacio">Sin sesiones en este período. Prueba con uno más largo.</p>${botones}`;
  const convertir = v => (['peso', 'e1rm', 'volumen', 'serie'].includes(medida) ? enUnidad(v) : v);
  // Las series de ese día y la sesión, para el detalle bajo el gráfico al tocar un punto.
  const detalle = f => (modoCardio({ ejercicio_id: id }) ? f.series.map(s => textoCardio({ ...s, ejercicio_id: id })).filter(Boolean).join(', ')
    : f.series.some(s => Number(s.carga_kg) > 0) ? seriesTexto(f.series) : f.series.map(s => (s.duracion_seg ? relojTexto(s.duracion_seg) : `${s.reps ?? '?'}`)).join(', '));
  const sesionDe = fecha => E.sesiones.find(s => s.fecha === fecha && (s.series || []).some(x => x.ejercicio_id === id))?.id || null;
  const puntos = enRango.map(f => ({ fecha: f.fecha, valor: convertir(f[medida]), marca: marcaDe(f, id), texto: textoPunto(f, medida, id), corto: etiquetaCorta(convertir(f[medida]), medida, id), detalle: `${f.series.length} ${f.series.length === 1 ? 'serie' : 'series'}: ${detalle(f)}`, sesion: sesionDe(f.fecha) }));
  // Cambios y tendencia en la unidad de la medida (los valores ya vienen en kg o lb).
  const u = unidadPeso(), pisos = modoCardio({ ejercicio_id: id }) === 'pisos';
  const abs = (d, txt) => `${d > 0 ? '+' : d < 0 ? '−' : ''}${txt(Math.abs(d))}`;
  const cambio = d => abs(d, v => (['peso', 'e1rm'].includes(medida) ? `${num(v)} ${u}` : medida === 'volumen' ? `${Math.round(v).toLocaleString('es-CL')} ${u}` : medida === 'serie' ? `${Math.round(v).toLocaleString('es-CL')} ${u} de volumen`
    : medida === 'reps' ? `${num(v)} ${pisos ? 'pisos' : 'reps'}` : medida === 'duracion' ? relojTexto(Math.round(v)) : `${Math.round(v)} m`));
  const unaSola = filas.filter(f => f[medida] != null).length === 1;
  return lineaHevy({ puntos, desde, hasta, nombre: nombreMedida, periodo: PERIODOS.find(x => x[0] === periodo)?.[1] || '', bajo: botones,
    titulo: `${medida === 'serie' ? 'Mejor serie (peso × repeticiones)' : NOMBRE[medida]}, ${puntos.length} ${puntos.length === 1 ? 'sesión' : 'sesiones'}`,
    cambio, mejorBaja: asistidoActual && medida === 'peso',
    nota: unaSola ? 'Tu primera marca. Desde la próxima sesión vas a ver aquí cómo cambia.' : 'Una sola sesión en este período. Elige uno más largo para ver la línea.' });
}

export function progresoEjercicioHtml(id, { asistido = false, conHistorial = false } = {}) {
  const series = seriesAnotadas(E.sesiones, E.registro);
  const filas = porSesion(series, id, { asistido });
  if (!filas.length) return '';
  const medidas = medidasCon(filas, { asistido });
  const sel = elegido.get(id) || { medida: medidas.includes('e1rm') ? 'e1rm' : medidas[0], periodo: periodoInicial(filas, hoy()) };
  if (!medidas.includes(sel.medida)) sel.medida = medidas[0];
  // La tendencia no cuenta la semana de descarga ni la sesión en curso: bajan a propósito o no terminaron.
  const filasRitmo = filas.filter(f => !marcaDe(f, id));
  const r = ritmo(filasRitmo, hoy(), { campo: campoRitmo(filasRitmo, asistido) });
  const porReps = asistido ? [] : recordsPorRepeticiones(series.filter(s => s.ejercicio_id === id));
  const cardio = modoCardio({ ejercicio_id: id });
  const nombre = m => (asistido && m === 'peso' ? 'Ayuda' : cardio === 'pisos' && m === 'reps' ? 'Pisos' : NOMBRE[m]);
  const sesiones = [...filas].reverse();
  const u = unidadPeso();
  const textoSesion = f => (cardio ? f.series.map(s => textoCardio({ ...s, ejercicio_id: id }) || '').filter(Boolean).join(', ')
    : f.series.some(s => s.distancia_m != null) ? f.series.map(s => `${s.carga_kg ? `${peso(s.carga_kg)} × ` : ''}${s.distancia_m ?? '?'} m`).join(', ') : f.series.some(s => Number(s.carga_kg) > 0) ? seriesTexto(f.series) : f.series.map(s => (s.duracion_seg ? `${s.duracion_seg} s` : s.reps ?? '?')).join(', '));
  return `<section class="tarjeta" id="progreso-ejercicio">
    <h2>Tu progreso</h2>
    ${medidas.length > 1 ? `<div class="chips-medida-hevy" role="group" aria-label="Qué medir">${medidas.map(m => `<button type="button" class="chip-opcion" data-medida="${m}" aria-pressed="${m === sel.medida}">${esc(nombre(m))}</button>`).join('')}</div>` : ''}
    <div id="grafico-ejercicio">${graficoHtml(id, filas, sel.medida, sel.periodo, asistido, nombre(sel.medida))}</div>
 <p class="pequeno suave gh-ritmo">${esc((cardio === 'pisos' ? textoRitmo(r, { asistido })?.replace(/repeticiones|repetición/g, 'pisos') : textoRitmo(r, { asistido })) || 'Con 3 sesiones en al menos 2 semanas vas a ver aquí tu ritmo de progreso.')}</p>
    ${r && r.tendencia !== 'sube' && !asistido && !cardio ? `<button type="button" class="boton fila-boton preguntar-coach" data-preguntar-coach>${icono('chat', 'icono icono-chico')} ¿Por qué no subo? Pregúntale a ${esc(nombreAsistente())}</button>` : ''}
    ${porReps.length ? `<details class="extra"><summary>Récords por repeticiones</summary>
      <ul class="pequeno lista-simple por-reps">${porReps.map(x => `<li><span>${x.reps} ${x.reps === 1 ? 'repetición' : 'repeticiones'}</span><span><strong class="num">${esc(`${num(enUnidad(x.carga_kg))} ${u}`)}</strong> <span class="suave">${esc(fechaCorta(x.fecha))}</span></span></li>`).join('')}</ul></details>` : ''}
    ${conHistorial ? '' : '<!-- el historial está en la pestaña Historial de la ficha -->'}${!conHistorial ? '' : `<details class="extra"${historialCompleto ? ' open' : ''}><summary>Historial: ${sesiones.length} ${sesiones.length === 1 ? 'sesión' : 'sesiones'}</summary>
      <ul class="pequeno detalle-h historial-ejercicio">${(historialCompleto ? sesiones : sesiones.slice(0, 8)).map(f => `<li><strong>${esc(fechaCorta(f.fecha))}</strong>: <span class="num">${esc(textoSesion(f))}</span></li>`).join('')}</ul>
      ${sesiones.length > 8 ? `<button type="button" class="enlace pequeno" id="historial-ejercicio-todo">${historialCompleto ? 'Ver menos' : `Ver las ${sesiones.length}`}</button>` : ''}
    </details>`}
  </section>`;
}

export function enlazarProgresoEjercicio(id, { asistido = false, ir = null, conHistorial = false } = {}) {
  const caja = $('progreso-ejercicio');
  if (!caja) return;
  // "Ver la sesión" del detalle de un punto abre su resumen.
  caja.addEventListener('click', ev => { const b = ev.target.closest('[data-ver-sesion]'); if (b && ir) ir('resumen', { id: b.dataset.verSesion }); });
  // Estancado o bajando: la pregunta va al Coach con el nombre del ejercicio (la IA lee el historial).
  caja.addEventListener('click', ev => { if (ev.target.closest('[data-preguntar-coach]') && ir) ir('coach', `¿Por qué no subo en ${indice.porId.get(id)?.nombre || 'este ejercicio'}? Revisa mis últimas semanas y dime qué cambiar.`); });
  // Al cambiar de medida o de período la línea se vuelve a trazar, y el foco queda en el botón tocado.
  const repintar = (tocado = null) => {
    const y = scrollY, abiertos = [...caja.querySelectorAll('details')].map(d => d.open), selector = selectorDe(tocado);
    caja.outerHTML = progresoEjercicioHtml(id, { asistido, conHistorial });
    const nueva = $('progreso-ejercicio');
    nueva.querySelectorAll('details').forEach((d, i) => { if (abiertos[i]) d.open = true; });
    enlazarProgresoEjercicio(id, { asistido, ir, conHistorial });
    scrollTo(0, y);
    if (selector) nueva.querySelector(selector)?.focus({ preventScroll: true });
    trazarGrafico(nueva.querySelector('.grafico-hevy'));
  };
  const actual = () => ({ medida: caja.querySelector('[data-medida][aria-pressed="true"]')?.dataset.medida, periodo: caja.querySelector('[data-periodo][aria-pressed="true"]')?.dataset.periodo });
  caja.querySelectorAll('[data-medida]').forEach(b => b.onclick = () => { elegido.set(id, { ...actual(), medida: b.dataset.medida }); repintar(b); });
  caja.querySelectorAll('[data-periodo]').forEach(b => b.onclick = () => { elegido.set(id, { ...actual(), periodo: b.dataset.periodo }); repintar(b); });
  // La medida elegida queda a la vista en la fila que se desliza.
  const fila = caja.querySelector('.chips-medida-hevy'), chip = fila?.querySelector('[aria-pressed="true"]');
  // Solo se desliza si la elegida no se ve entera (antes se corría siempre y la dejaba cortada).
  if (fila && chip) {
    const f = fila.getBoundingClientRect(), c = chip.getBoundingClientRect();
    if (c.left < f.left + 16 || c.right > f.right - 16) fila.scrollLeft += c.left - f.left - 16;
  }
  $('historial-ejercicio-todo')?.addEventListener('click', () => { historialCompleto = !historialCompleto; repintar(); });
}
