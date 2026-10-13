// Arriba de Progreso, como el perfil de Hevy: un gráfico de barras de las últimas semanas (duración, volumen o
// repeticiones) y un panel de cuatro botones que lleva a Estadísticas, Ejercicios, Medidas y Calendario.
import { E, esc, $, hoy, indice, volumenTexto } from './comun.js';
import { sumarDias, diaSemana } from '../nucleo/agenda.js';
import { esAsistido } from '../nucleo/catalogo.js';
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
      if (x.tipo === 'calentamiento') continue;
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

/** Panel de cuatro botones, como el "Dashboard" del perfil de Hevy. */
export function tableroProgresoHtml() {
  const botones = [['p-estadisticas', 'grafico', 'Estadísticas'], ['p-ejercicios', 'pesa', 'Ejercicios'], ['medidas-cuerpo', 'persona', 'Medidas'], ['p-calendario', 'calendario', 'Calendario']];
  return `<div class="tablero-progreso">${botones.map(([id, ic, t]) => `<button type="button" class="tablero-boton" data-ir-seccion="${id}">${icono(ic)}<span>${t}</span></button>`).join('')}</div>`;
}

export function enlazarProgresoHevy(repintar) {
  document.querySelectorAll('[data-metrica-semana]').forEach(b => b.onclick = () => { metrica = b.dataset.metricaSemana; repintar(); });
  document.querySelectorAll('[data-ir-seccion]').forEach(b => b.onclick = () => {
    const destino = $(b.dataset.irSeccion);
    if (!destino) return;
    if (destino.tagName === 'DETAILS') destino.open = true;
    (destino.closest('section, details') || destino).scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
}
