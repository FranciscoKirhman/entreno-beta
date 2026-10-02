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
