// Tu progreso en un ejercicio, dentro de su ficha (como Hevy): el ritmo de las últimas semanas, un gráfico por medida
// (carga más alta, máximo estimado, volumen, repeticiones o tiempo) por 3 meses, 1 año o todo, tu mejor peso para
// cada número de repeticiones y el historial de cada sesión en que lo hiciste.
import { E, esc, $, hoy, fechaCorta, coma, enUnidad, unidadPeso, peso, volumenTexto, seriesTexto } from './comun.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { porSesion, medidasCon, desdePeriodo, ritmo, PERIODOS } from '../nucleo/progreso-ejercicio.js';
import { recordsPorRepeticiones } from '../nucleo/records.js';
import { lineaSimple } from './grafico.js';

const NOMBRE = { peso: 'Carga más alta', e1rm: 'Máximo estimado', volumen: 'Volumen', reps: 'Repeticiones', duracion: 'Tiempo' };
const elegido = new Map(); // por ejercicio: {medida, periodo}, mientras la app está abierta
let historialCompleto = false;

const num = x => coma(Math.round(x * 10) / 10);
const campoRitmo = (filas, asistido) => (asistido ? 'peso' : filas.some(f => f.e1rm != null) ? 'e1rm' : filas.some(f => f.reps != null) ? 'reps' : 'duracion');

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

function textoPunto(f, medida) {
  switch (medida) {
    case 'peso': { const s = f.series.find(x => Number(x.carga_kg) === f.peso); return `${peso(f.peso)}${s?.reps ? ` × ${s.reps}` : ''}`; }
    case 'e1rm': return `${peso(f.e1rm)} estimado`;
    case 'volumen': return volumenTexto(f.volumen);
    case 'reps': return `${f.reps} repeticiones`;
    default: return `${f.duracion} s`;
  }
}

/** Escala con márgenes y tres líneas de grilla redondeadas. */
function escala(valores, medida) {
  const u = unidadPeso();
  let lo = Math.min(...valores), hi = Math.max(...valores);
  if (lo === hi) { lo -= Math.max(1, lo * 0.1); hi += Math.max(1, hi * 0.1); }
  const margen = (hi - lo) * 0.12;
  lo = Math.max(0, lo - margen); hi += margen;
  const etiqueta = v => (medida === 'reps' ? `${Math.round(v)}` : medida === 'duracion' ? `${Math.round(v)} s` : medida === 'volumen' ? Math.round(v).toLocaleString('es-CL') : `${coma(Math.round(v * 10) / 10)} ${u}`);
  // Líneas en números redondos (1, 2, 2,5 o 5 por una potencia de 10), unas tres en la altura del gráfico.
  const bruto = (hi - lo) / 3, base = 10 ** Math.floor(Math.log10(bruto));
  let paso = [1, 2, 2.5, 5, 10].map(k => k * base).find(k => k >= bruto);
  if (medida === 'reps' || medida === 'duracion') paso = Math.max(1, Math.round(paso)); // sin medias repeticiones
  const marcas = [];
  for (let v = Math.ceil(lo / paso) * paso; v <= hi + 1e-9; v += paso) marcas.push({ valor: v, texto: etiqueta(v) });
  return { min: lo, max: hi, marcas };
}

function graficoHtml(id, filas, medida, periodo) {
  const hasta = hoy(), desde = desdePeriodo(periodo, hasta, filas);
  const enRango = filas.filter(f => f.fecha >= desde && f[medida] != null);
  if (!enRango.length) return `<p class="pequeno suave">Sin sesiones en este período. Prueba con "Todo".</p>`;
  const convertir = v => (['peso', 'e1rm', 'volumen'].includes(medida) ? enUnidad(v) : v);
  const puntos = enRango.map(f => ({ fecha: f.fecha, valor: convertir(f[medida]), texto: textoPunto(f, medida) }));
  const { min, max, marcas } = escala(puntos.map(p => p.valor), medida);
  return lineaSimple({ puntos, desde, hasta, min, max, marcas, titulo: `${NOMBRE[medida]}, ${puntos.length} ${puntos.length === 1 ? 'sesión' : 'sesiones'}`, unir: 400, izquierda: medida === 'volumen' ? 46 : 50 });
}

export function progresoEjercicioHtml(id, { asistido = false } = {}) {
  const series = seriesAnotadas(E.sesiones, E.registro);
  const filas = porSesion(series, id, { asistido });
  if (!filas.length) return '';
  const medidas = medidasCon(filas, { asistido });
  const sel = elegido.get(id) || { medida: medidas.includes('e1rm') ? 'e1rm' : medidas[0], periodo: '3m' };
  if (!medidas.includes(sel.medida)) sel.medida = medidas[0];
  const r = ritmo(filas, hoy(), { campo: campoRitmo(filas, asistido) });
  const porReps = asistido ? [] : recordsPorRepeticiones(series.filter(s => s.ejercicio_id === id));
  const nombre = m => (asistido && m === 'peso' ? 'Ayuda' : NOMBRE[m]);
  const sesiones = [...filas].reverse();
  const u = unidadPeso();
  const textoSesion = f => (f.series.some(s => Number(s.carga_kg) > 0) ? seriesTexto(f.series) : f.series.map(s => (s.duracion_seg ? `${s.duracion_seg} s` : s.reps ?? '?')).join(', '));
  return `<section class="tarjeta" id="progreso-ejercicio">
    <h2>Tu progreso</h2>
    <p class="pequeno">${esc(textoRitmo(r, { asistido }) || 'Con 3 sesiones en al menos 2 semanas vas a ver aquí tu ritmo de progreso.')}</p>
    ${medidas.length > 1 ? `<div class="chips-botones chips-medida" role="group" aria-label="Qué medir">${medidas.map(m => `<button type="button" class="chip-opcion" data-medida="${m}" aria-pressed="${m === sel.medida}">${esc(nombre(m))}</button>`).join('')}</div>` : `<p class="sobretitulo">${esc(nombre(medidas[0]))}</p>`}
    <div id="grafico-ejercicio">${graficoHtml(id, filas, sel.medida, sel.periodo)}</div>
    <div class="segmentos periodo" role="group" aria-label="Período">${PERIODOS.map(([v, t]) => `<button type="button" data-periodo="${v}" aria-pressed="${v === sel.periodo}">${t}</button>`).join('')}</div>
    ${porReps.length ? `<details class="extra"><summary>Tu mejor peso para cada número de repeticiones</summary>
      <ul class="pequeno lista-simple por-reps">${porReps.map(x => `<li><span>${x.reps} ${x.reps === 1 ? 'repetición' : 'repeticiones'}</span><span><strong class="num">${esc(`${num(enUnidad(x.carga_kg))} ${u}`)}</strong> <span class="suave">${esc(fechaCorta(x.fecha))}</span></span></li>`).join('')}</ul></details>` : ''}
    <details class="extra"${historialCompleto ? ' open' : ''}><summary>Historial: ${sesiones.length} ${sesiones.length === 1 ? 'sesión' : 'sesiones'}</summary>
      <ul class="pequeno detalle-h historial-ejercicio">${(historialCompleto ? sesiones : sesiones.slice(0, 8)).map(f => `<li><strong>${esc(fechaCorta(f.fecha))}</strong>: <span class="num">${esc(textoSesion(f))}</span></li>`).join('')}</ul>
      ${sesiones.length > 8 ? `<button type="button" class="enlace pequeno" id="historial-ejercicio-todo">${historialCompleto ? 'Ver menos' : `Ver las ${sesiones.length}`}</button>` : ''}
    </details>
  </section>`;
}

export function enlazarProgresoEjercicio(id, { asistido = false } = {}) {
  const caja = $('progreso-ejercicio');
  if (!caja) return;
  const repintar = () => {
    const y = scrollY, abiertos = [...caja.querySelectorAll('details')].map(d => d.open);
    caja.outerHTML = progresoEjercicioHtml(id, { asistido });
    $('progreso-ejercicio').querySelectorAll('details').forEach((d, i) => { if (abiertos[i]) d.open = true; });
    enlazarProgresoEjercicio(id, { asistido });
    scrollTo(0, y);
  };
  const actual = () => ({ medida: caja.querySelector('[data-medida][aria-pressed="true"]')?.dataset.medida, periodo: caja.querySelector('[data-periodo][aria-pressed="true"]')?.dataset.periodo });
  caja.querySelectorAll('[data-medida]').forEach(b => b.onclick = () => { elegido.set(id, { ...actual(), medida: b.dataset.medida }); repintar(); });
  caja.querySelectorAll('[data-periodo]').forEach(b => b.onclick = () => { elegido.set(id, { ...actual(), periodo: b.dataset.periodo }); repintar(); });
  $('historial-ejercicio-todo')?.addEventListener('click', () => { historialCompleto = !historialCompleto; repintar(); });
}
