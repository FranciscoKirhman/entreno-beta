// Arriba de Progreso, como el perfil de Hevy: un gráfico de barras de las últimas semanas (duración, volumen o
// repeticiones) y un panel de cuatro botones que lleva a Estadísticas, Ejercicios, Medidas y Calendario.
import { E, esc, $, hoy, indice, volumenTexto } from './comun.js';
import { sumarDias, diaSemana } from '../nucleo/agenda.js';
import { esAsistido } from '../nucleo/catalogo.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { cuerpoHtml, intensidades, sinTrabajar } from './cuerpo.js';
import { ajuste } from './ajustes-sesion.js';
import { icono } from './iconos.js';

const SEMANAS = 8;
const METRICAS = { duracion: 'Duración', volumen: 'Volumen', reps: 'Reps' };
let metrica = 'duracion';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
const corta = iso => `${Number(iso.slice(8))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;

/** Duración (min), volumen (kg) y repeticiones de cada una de las últimas semanas, de lunes a domingo. */
function porSemana() {
  const lunes = sumarDias(hoy(), -((diaSemana(hoy()) + 6) % 7));
  const semanas = Array.from({ length: SEMANAS }, (_, i) => ({ desde: sumarDias(lunes, -7 * (SEMANAS - 1 - i)), duracion: 0, volumen: 0, reps: 0 }));
  for (const s of E.sesiones) {
    const w = semanas.findLast(x => s.fecha >= x.desde);
    if (!w || s.fecha > sumarDias(w.desde, 6)) continue;
    w.duracion += Number(s.duracion_min) || 0;
    for (const x of s.series || []) {
      if (x.tipo === 'calentamiento' && !ajuste('calentamientoStats')) continue;
      const reps = Number(x.reps) || 0;
      w.reps += reps;
      if (!esAsistido(indice.porId.get(x.ejercicio_id))) w.volumen += (Number(x.carga_kg) || 0) * reps;
    }
  }
  return semanas;
}
const valorTexto = (m, v) => (m === 'duracion' ? (v >= 60 ? `${String(Math.round(v / 6) / 10).replace('.', ',')} h` : `${Math.round(v)} min`) : m === 'volumen' ? volumenTexto(v) : `${Math.round(v).toLocaleString('es-CL')} reps`);

export function graficoSemanasHtml() {
  if (!E.sesiones.length) return '';
  const xs = porSemana(), max = Math.max(1, ...xs.map(x => x[metrica]));
  const actual = xs.at(-1)[metrica];
  return `<section class="tarjeta grafico-semanas" aria-label="Tus últimas ${SEMANAS} semanas">
    <p class="grafico-semanas-total"><strong class="num">${esc(valorTexto(metrica, actual))}</strong> <span class="suave">esta semana</span></p>
    <div class="barras-semanas" role="img" aria-label="${esc(xs.map(x => `semana del ${corta(x.desde)}: ${valorTexto(metrica, x[metrica])}`).join('; '))}">
      ${xs.map((x, i) => `<div class="barra-semana${i === xs.length - 1 ? ' actual' : ''}"><i style="height:${Math.round((x[metrica] / max) * 100)}%"></i><span>${i % 2 === 1 || i === xs.length - 1 ? esc(corta(x.desde)) : ''}</span></div>`).join('')}
    </div>
    <div class="segmentos grafico-semanas-metricas" role="group" aria-label="Qué mostrar">${Object.entries(METRICAS).map(([k, t]) => `<button type="button" data-metrica-semana="${k}" aria-pressed="${k === metrica}">${t}</button>`).join('')}</div>
  </section>`;
}

// Cada botón del panel abre su propia pantalla, como el "Dashboard" de Hevy (Progreso → Estadísticas, etc.).
export const TITULO_SECCION = { estadisticas: 'Estadísticas', ejercicios: 'Ejercicios', medidas: 'Medidas', calendario: 'Calendario' };
let seccion = null;
export const seccionProgreso = () => seccion;
export const elegirSeccionProgreso = s => { seccion = TITULO_SECCION[s] ? s : null; };

/** Panel de cuatro botones, como el "Dashboard" del perfil de Hevy. */
export function tableroProgresoHtml() {
  const botones = [['estadisticas', 'grafico'], ['ejercicios', 'pesa'], ['medidas', 'persona'], ['calendario', 'calendario']];
  return `<div class="tablero-progreso">${botones.map(([id, ic]) => `<button type="button" class="tablero-boton" data-ir-seccion="${id}">${icono(ic)}<span>${TITULO_SECCION[id]}</span>${icono('flecha', 'icono tablero-flecha')}</button>`).join('')}</div>`;
}

export function enlazarProgresoHevy(repintar, abrirSeccion = repintar) {
  document.querySelectorAll('[data-metrica-semana]').forEach(b => b.onclick = () => { metrica = b.dataset.metricaSemana; repintar(); });
  document.querySelectorAll('[data-ir-seccion]').forEach(b => b.onclick = () => {
    elegirSeccionProgreso(b.dataset.irSeccion);
    abrirSeccion();
    const medidas = $('medidas-cuerpo'); if (seccion === 'medidas' && medidas?.tagName === 'DETAILS') medidas.open = true;
  });
}

// ── Esfuerzo, como la tarjeta de OpenGym: lo que anotaste en cada serie, leído de vuelta ──
const PERIODOS_ESF = [[30, '30 días'], [90, '90 días'], [365, '1 año'], [0, 'Todo']];
let diasEsfuerzo = 90;

/** RPE promedio (o RIR), cuántas series fueron cerca del fallo y cuántas tienen el esfuerzo anotado, por semana. */
export function esfuerzoHtml(modo = 'rpe') {
  const todas = seriesAnotadas(E.sesiones, E.registro);
  if (!todas.length) return '';
  const desde = diasEsfuerzo ? sumarDias(hoy(), -diasEsfuerzo) : '';
  const xs = todas.filter(x => x.fecha >= desde);
  const rpe = x => x.rpe ?? (x.rir != null ? 10 - x.rir : null);
  const con = xs.filter(x => rpe(x) != null);
  const fmt = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const prom = con.length ? con.reduce((a, x) => a + rpe(x), 0) / con.length : null;
  const cerca = con.filter(x => rpe(x) >= 9).length;
  const lunes = sumarDias(hoy(), -((diaSemana(hoy()) + 6) % 7));
  const semanas = Array.from({ length: 8 }, (_, i) => sumarDias(lunes, -7 * (7 - i))).map(d => {
    const s = todas.filter(x => x.fecha >= d && x.fecha <= sumarDias(d, 6) && rpe(x) != null);
    return { d, n: s.length, v: s.length ? s.reduce((a, x) => a + rpe(x), 0) / s.length : null };
  });
  const valor = v => (modo === 'rir' ? 10 - v : v);
  return `<section class="tarjeta esfuerzo-progreso" aria-label="Esfuerzo">
    <h3>Esfuerzo</h3>
    <div class="segmentos" role="group" aria-label="Período">${PERIODOS_ESF.map(([d, t]) => `<button type="button" data-dias-esfuerzo="${d}" aria-pressed="${d === diasEsfuerzo}">${t}</button>`).join('')}</div>
    ${con.length ? `<div class="cifras-esfuerzo">
      <span><strong class="num">${fmt(valor(prom))}</strong><small>${modo === 'rir' ? 'RIR' : 'RPE'} promedio</small></span>
      <span><strong class="num">${Math.round((cerca / con.length) * 100)}%</strong><small>cerca del fallo (${modo === 'rir' ? 'RIR 1 o menos' : 'RPE 9 o más'})</small></span>
      <span><strong class="num">${con.length} de ${xs.length}</strong><small>series con esfuerzo anotado</small></span>
    </div>
    <div class="barras-esfuerzo" role="img" aria-label="${esc(semanas.map(w => `semana del ${corta(w.d)}: ${w.v == null ? 'sin datos' : `${fmt(valor(w.v))}, ${w.n} series`}`).join('; '))}">
      ${semanas.map((w, i) => `<div class="barra-semana${i === 7 ? ' actual' : ''}"><i style="height:${w.v == null ? 0 : Math.round(Math.max(0, (w.v - 5) / 5) * 100)}%"></i><span>${i % 2 ? esc(corta(w.d)) : ''}</span></div>`).join('')}
    </div>
    <p class="pequeno suave">Cada barra es el RPE promedio de la semana (de 5 a 10). El promedio solo cuenta las series donde anotaste el esfuerzo.</p>`
      : `<p class="pequeno suave">No anotaste el esfuerzo en este período (${xs.length} series). Tócalo en la columna ${modo === 'rir' ? 'RIR' : 'RPE'} de cada serie y aquí vas a ver tu promedio.</p>`}
  </section>`;
}
export function enlazarEsfuerzo(repintar) {
  document.querySelectorAll('[data-dias-esfuerzo]').forEach(b => b.onclick = () => { diasEsfuerzo = Number(b.dataset.diasEsfuerzo); repintar(); });
}

// ── Tu año, como el mapa de actividad de OpenGym: un cuadro por día, más oscuro cuanto más rato entrenaste ──
export function anioHtml() {
  if (!E.sesiones.length) return '';
  const minutos = new Map();
  for (const s of E.sesiones) minutos.set(s.fecha, (minutos.get(s.fecha) || 0) + (Number(s.duracion_min) || 30));
  const lunesHoy = sumarDias(hoy(), -((diaSemana(hoy()) + 6) % 7));
  const inicio = sumarDias(lunesHoy, -7 * 52);
  const nivel = m => (!m ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 90 ? 3 : 4);
  const columnas = [], meses = [];
  let dias = 0, total = 0;
  for (let w = 0; w <= 52; w++) {
    const lunes = sumarDias(inicio, 7 * w);
    if (w === 0 || lunes.slice(5, 7) !== sumarDias(lunes, -7).slice(5, 7)) meses.push({ w, texto: MESES[Number(lunes.slice(5, 7)) - 1] });
    columnas.push(Array.from({ length: 7 }, (_, d) => {
      const f = sumarDias(lunes, d);
      if (f > hoy()) return '<i class="vacio"></i>';
      const m = minutos.get(f) || 0;
      if (m) { dias++; total += m; }
      return `<i class="n${nivel(m)}" title="${esc(`${corta(f)}${m ? `: ${m} min` : ''}`)}"></i>`;
    }).join(''));
  }
  return `<section class="tarjeta anio-actividad" aria-label="Tu año">
    <h3>Tu año</h3>
    <p class="pequeno suave">${dias} ${dias === 1 ? 'día' : 'días'} entrenados y ${Math.round(total / 60)} horas en las últimas 53 semanas. Cada cuadro es un día; más oscuro, más rato.</p>
    <div class="anio-desliza" id="anio-desliza"><div class="anio-meses" style="grid-template-columns:repeat(53,12px)">${meses.map(m => `<span style="grid-column:${m.w + 1}">${m.texto}</span>`).join('')}</div>
      <div class="anio-cuadros" role="img" aria-label="${esc(`${dias} días entrenados en el último año`)}">${columnas.map(c => `<div>${c}</div>`).join('')}</div></div>
    <div class="anio-leyenda pequeno suave">Menos <i class="n0"></i><i class="n1"></i><i class="n2"></i><i class="n3"></i><i class="n4"></i> Más</div>
  </section>`;
}
/** El año parte mostrando las semanas recientes (a la derecha). */
export function enlazarAnio() { const d = $('anio-desliza'); if (d) d.scrollLeft = d.scrollWidth; }

// ── Mapa de músculos, como OpenGym y Hevy: frente y espalda coloreados por cuánto trabajó cada músculo ──
const PERIODOS_MUSC = [[7, 'Semana'], [30, 'Mes'], [0, 'Todo']];
let diasMusculos = 7;
export function musculosMapaHtml() {
  if (!E.sesiones.length) return '';
  const desde = diasMusculos ? sumarDias(hoy(), -(diasMusculos - 1)) : '';
  const series = seriesAnotadas(E.sesiones, E.registro).filter(x => x.fecha >= desde);
  const t = intensidades(series), faltan = sinTrabajar(t.intensidad);
  return `<section class="tarjeta mapa-musculos" aria-label="Músculos">
    <h3 id="p-musculos">Músculos</h3>
    <div class="segmentos" role="group" aria-label="Período">${PERIODOS_MUSC.map(([d, txt]) => `<button type="button" data-dias-musculos="${d}" aria-pressed="${d === diasMusculos}">${txt}</button>`).join('')}</div>
    ${cuerpoHtml(t.intensidad, { tamano: 'grande', etiqueta: 'Músculos trabajados en el período' })}
    <p class="pequeno ${faltan.length ? '' : 'suave'}">${faltan.length ? `<strong>Sin entrenar ${diasMusculos ? (diasMusculos === 7 ? 'esta semana' : 'este mes') : 'nunca'}:</strong> ${esc(faltan.join(', '))}.` : 'Entrenaste todos los músculos en este período.'}</p>
    <p class="pequeno suave">Más oscuro, más series (la principal de cada ejercicio cuenta entera; la secundaria, media).</p>
  </section>`;
}
export function enlazarMusculosMapa(repintar) {
  document.querySelectorAll('[data-dias-musculos]').forEach(b => b.onclick = () => { diasMusculos = Number(b.dataset.diasMusculos); repintar(); });
}
