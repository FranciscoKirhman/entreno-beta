// Gráficos de línea simples, sin librerías y sin señal: una serie por gráfico (dos medidas de distinta escala van en
// dos gráficos, nunca con dos ejes). Línea de 2 px, puntos de 8 px con un anillo del color de la tarjeta, grilla
// suave y un aviso al tocar o pasar sobre cada punto. El color es --serie-1 (validado en claro y oscuro).
import { esc } from './comun.js';

const ANCHO = 320, ALTO = 112, DER = 10, ARRIBA = 10, ABAJO = 20;
const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const corta = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' }).replace('.', '');

/**
 * @param puntos  [{fecha 'AAAA-MM-DD', valor, texto}] (texto: lo que dice el aviso del punto)
 * @param desde, hasta  fechas del eje horizontal
 * @param min, max      escala vertical fija
 * @param marcas        [{valor, texto}] líneas de la grilla con su etiqueta
 * @param titulo        para lectores de pantalla
 * @param unir          días máximos entre dos puntos para unirlos con línea (si faltan más, se corta)
 * @param izquierda     espacio para las etiquetas de la grilla
 */
export function lineaSimple({ puntos, desde, hasta, min, max, marcas = [], titulo, unir = 3, izquierda = 38 }) {
  const IZQ = izquierda;
  const total = Math.max(1, dias(desde, hasta));
  const x = f => IZQ + (dias(desde, f) / total) * (ANCHO - IZQ - DER);
  const y = v => ARRIBA + (1 - (Math.min(max, Math.max(min, v)) - min) / (max - min)) * (ALTO - ARRIBA - ABAJO);
  const ps = [...puntos].filter(p => p.valor != null && p.fecha >= desde && p.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const tramos = [];
  for (const p of ps) {
    const t = tramos.at(-1);
    if (t && dias(t.at(-1).fecha, p.fecha) <= unir) t.push(p); else tramos.push([p]);
  }
  const grilla = marcas.map(m => `<line x1="${IZQ}" x2="${ANCHO - DER}" y1="${y(m.valor).toFixed(1)}" y2="${y(m.valor).toFixed(1)}" class="g-grilla"/>
    <text x="${IZQ - 6}" y="${(y(m.valor) + 3.5).toFixed(1)}" class="g-eje" text-anchor="end">${esc(m.texto)}</text>`).join('');
  const lineas = tramos.filter(t => t.length > 1).map(t => `<polyline class="g-linea" points="${t.map(p => `${x(p.fecha).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')}"/>`).join('');
  const marcasPuntos = ps.map(p => `<circle class="g-punto" cx="${x(p.fecha).toFixed(1)}" cy="${y(p.valor).toFixed(1)}" r="4"/>`).join('');
  // Zonas de toque más grandes que el punto (para el dedo), con el texto del aviso.
  const toques = ps.map(p => `<circle class="g-toque" cx="${x(p.fecha).toFixed(1)}" cy="${y(p.valor).toFixed(1)}" r="13" data-dato="${esc(`${corta(p.fecha)}: ${p.texto}`)}" tabindex="0" role="button" aria-label="${esc(`${corta(p.fecha)}: ${p.texto}`)}"/>`).join('');
  const ejeX = `<text x="${IZQ}" y="${ALTO - 4}" class="g-eje">${esc(corta(desde))}</text><text x="${ANCHO - DER}" y="${ALTO - 4}" class="g-eje" text-anchor="end">hoy</text>`;
  return `<div class="grafico"><svg viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="${esc(titulo)}">${grilla}${ejeX}${lineas}${marcasPuntos}${toques}</svg><div class="g-aviso" hidden></div></div>`;
}

// El aviso de cada punto: al tocarlo o al pasar el puntero; se cierra tocando fuera.
function mostrar(objetivo) {
  const caja = objetivo.closest('.grafico');
  const aviso = caja?.querySelector('.g-aviso');
  if (!aviso) return;
  const r = objetivo.getBoundingClientRect(), c = caja.getBoundingClientRect();
  aviso.textContent = objetivo.dataset.dato;
  aviso.hidden = false;
  const izquierda = Math.min(Math.max(0, r.left - c.left + r.width / 2 - aviso.offsetWidth / 2), c.width - aviso.offsetWidth);
  aviso.style.left = `${izquierda}px`;
  aviso.style.top = `${Math.max(0, r.top - c.top - aviso.offsetHeight - 2)}px`;
}
function ocultarTodos() { document.querySelectorAll('.g-aviso').forEach(a => { a.hidden = true; }); }
document.addEventListener('click', ev => {
  const p = ev.target.closest?.('[data-dato]');
  ocultarTodos();
  if (p) mostrar(p);
});
document.addEventListener('pointerover', ev => { const p = ev.target.closest?.('[data-dato]'); if (p && ev.pointerType === 'mouse') { ocultarTodos(); mostrar(p); } });
document.addEventListener('focusin', ev => { const p = ev.target.closest?.('[data-dato]'); if (p) { ocultarTodos(); mostrar(p); } });

// ── Gráfico como el de Hevy (ficha del ejercicio, medidas) ─────────────────────────────────────────────────────────
// Arriba, el valor grande y su fecha; al tocar o deslizar el dedo sobre el gráfico, una línea vertical marca el punto
// más cercano y el valor de arriba cambia. Deslizar en vertical sigue desplazando la página. Con teclado, flechas.
const GH_ANCHO = 340, GH_ALTO = 170, GH_DER = 12, GH_ARRIBA = 12, GH_ABAJO = 24;
const larga = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/\./g, '');

/**
 * @param puntos [{fecha, valor, texto}] texto: el valor como se lee arriba ("45 kg × 8")
 * @param marcas [{valor, texto}] grilla con su etiqueta a la izquierda
 */
export function lineaHevy({ puntos, desde, hasta, min, max, marcas = [], titulo, izquierda = 48 }) {
  const IZQ = izquierda, total = Math.max(1, dias(desde, hasta));
  const x = f => IZQ + (dias(desde, f) / total) * (GH_ANCHO - IZQ - GH_DER);
  const y = v => GH_ARRIBA + (1 - (Math.min(max, Math.max(min, v)) - min) / (max - min)) * (GH_ALTO - GH_ARRIBA - GH_ABAJO);
  const ps = [...puntos].filter(p => p.valor != null && p.fecha >= desde && p.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (!ps.length) return '';
  const ult = ps.at(-1);
  const grilla = marcas.map(m => `<line x1="${IZQ}" x2="${GH_ANCHO - GH_DER}" y1="${y(m.valor).toFixed(1)}" y2="${y(m.valor).toFixed(1)}" class="g-grilla"/>
    <text x="${IZQ - 6}" y="${(y(m.valor) + 3.5).toFixed(1)}" class="g-eje" text-anchor="end">${esc(m.texto)}</text>`).join('');
  // Cuatro o cinco fechas parejas en el eje de abajo.
  const n = Math.min(5, Math.max(2, Math.round(total / 30) + 1));
  const ejeX = Array.from({ length: n }, (_, i) => {
    const f = new Date(Date.parse(desde + 'T12:00:00Z') + Math.round((total * i) / (n - 1)) * 864e5).toISOString().slice(0, 10);
    return `<text x="${x(f).toFixed(1)}" y="${GH_ALTO - 6}" class="g-eje" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(corta(f))}</text>`;
  }).join('');
  const base = `<line x1="${IZQ}" x2="${GH_ANCHO - GH_DER}" y1="${GH_ALTO - GH_ABAJO}" y2="${GH_ALTO - GH_ABAJO}" class="g-base"/>`;
  const linea = ps.length > 1 ? `<polyline class="gh-linea" points="${ps.map(p => `${x(p.fecha).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')}"/>` : '';
  const area = ps.length > 1 ? `<polygon class="gh-area" points="${x(ps[0].fecha).toFixed(1)},${GH_ALTO - GH_ABAJO} ${ps.map(p => `${x(p.fecha).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ')} ${x(ult.fecha).toFixed(1)},${GH_ALTO - GH_ABAJO}"/>` : '';
  const circulos = ps.map((p, i) => `<circle class="gh-punto${i === ps.length - 1 ? ' elegido' : ''}" data-i="${i}" cx="${x(p.fecha).toFixed(1)}" cy="${y(p.valor).toFixed(1)}" r="3.6"/>`).join('');
  const datos = ps.map(p => ({ x: +x(p.fecha).toFixed(1), y: +y(p.valor).toFixed(1), t: p.texto, f: larga(p.fecha) }));
  return `<div class="grafico-hevy" data-gh='${esc(JSON.stringify(datos))}'>
    <p class="gh-cab" aria-live="polite"><strong class="gh-valor num">${esc(ult.texto)}</strong> <span class="gh-fecha">${esc(larga(ult.fecha))}</span></p>
    <svg viewBox="0 0 ${GH_ANCHO} ${GH_ALTO}" role="img" tabindex="0" aria-label="${esc(`${titulo}. Usa las flechas para recorrer los puntos.`)}">${grilla}${base}${ejeX}${area}${linea}
      <line class="gh-cursor" x1="${datos.at(-1).x}" x2="${datos.at(-1).x}" y1="${GH_ARRIBA - 6}" y2="${GH_ALTO - GH_ABAJO}"/>${circulos}</svg>
  </div>`;
}

function elegirPunto(caja, i) {
  const datos = JSON.parse(caja.dataset.gh || '[]'), d = datos[i];
  if (!d) return;
  caja.dataset.ghI = i;
  caja.querySelector('.gh-valor').textContent = d.t;
  caja.querySelector('.gh-fecha').textContent = d.f;
  const cursor = caja.querySelector('.gh-cursor');
  cursor.setAttribute('x1', d.x); cursor.setAttribute('x2', d.x);
  caja.querySelectorAll('.gh-punto').forEach(c => c.classList.toggle('elegido', Number(c.dataset.i) === i));
}
function puntoCercano(caja, clientX) {
  const svg = caja.querySelector('svg'), r = svg.getBoundingClientRect();
  const vx = ((clientX - r.left) / r.width) * GH_ANCHO;
  const datos = JSON.parse(caja.dataset.gh || '[]');
  let mejor = 0;
  datos.forEach((d, i) => { if (Math.abs(d.x - vx) < Math.abs(datos[mejor].x - vx)) mejor = i; });
  return mejor;
}
let ghActivo = null;
document.addEventListener('pointerdown', ev => {
  const caja = ev.target.closest?.('.grafico-hevy');
  if (!caja || !ev.target.closest('svg')) return;
  ghActivo = caja;
  elegirPunto(caja, puntoCercano(caja, ev.clientX));
});
document.addEventListener('pointermove', ev => { if (ghActivo && ev.buttons) elegirPunto(ghActivo, puntoCercano(ghActivo, ev.clientX)); });
document.addEventListener('pointerup', () => { ghActivo = null; });
document.addEventListener('pointercancel', () => { ghActivo = null; });
document.addEventListener('keydown', ev => {
  const caja = ev.target.closest?.('.grafico-hevy');
  if (!caja || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
  ev.preventDefault();
  const n = JSON.parse(caja.dataset.gh || '[]').length, i = Number(caja.dataset.ghI ?? n - 1);
  elegirPunto(caja, ev.key === 'Home' ? 0 : ev.key === 'End' ? n - 1 : Math.max(0, Math.min(n - 1, i + (ev.key === 'ArrowRight' ? 1 : -1))));
});
