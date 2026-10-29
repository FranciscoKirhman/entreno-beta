// Gráficos de línea simples, sin librerías y sin señal: una serie por gráfico (dos medidas de distinta escala van en
// dos gráficos, nunca con dos ejes). También barras sobre y bajo un cero, alineadas con las líneas. Línea de 2 px, puntos de 8 px con un anillo del color de la tarjeta, grilla
// suave y un aviso al tocar o pasar sobre cada punto. El color es --serie-1 (validado en claro y oscuro).
import { esc } from './comun.js';
import { analisisSerie } from '../nucleo/analisis-grafico.js';

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

// ── Barras sobre y bajo una línea base (el rendimiento de cada sesión contra lo habitual) ──────────────────────────
// Misma escala de fechas, mismo ancho y mismo margen que lineaSimple: van una sobre otra con energía, ánimo y sueño, y el
// mismo día queda en la misma columna. Arriba del cero, --serie-1; abajo, --serie-baja (el par divergente azul y rojo,
// validado en claro y oscuro); la dirección también se lee por el lado del cero. Barras de 6 px con la punta redonda.

/** Una barra con la punta redonda y el lado del cero recto. */
const barra = (cx, desde, hasta) => {
  const a = 3, arriba = hasta < desde, r = Math.min(a, Math.abs(hasta - desde));
  const punta = arriba ? hasta + r : hasta - r;
  return `M${(cx - a).toFixed(1)},${desde.toFixed(1)}V${punta.toFixed(1)}A${a},${r} 0 0 ${arriba ? 1 : 0} ${(cx + a).toFixed(1)},${punta.toFixed(1)}V${desde.toFixed(1)}Z`;
};

/**
 * @param puntos  [{fecha, valor, texto}] valor: diferencia con lo habitual (puede ser negativa)
 * @param limite  la escala va de −limite a +limite (simétrica: el cero queda al medio)
 * @param marcas  [{valor, texto}] líneas de la grilla con su etiqueta; la del cero va más marcada
 */
export function barrasDivergentes({ puntos, desde, hasta, limite = 10, marcas = [], titulo, izquierda = 38 }) {
  const IZQ = izquierda, total = Math.max(1, dias(desde, hasta));
  const x = f => IZQ + (dias(desde, f) / total) * (ANCHO - IZQ - DER);
  const y = v => ARRIBA + (1 - (Math.max(-limite, Math.min(limite, v)) + limite) / (2 * limite)) * (ALTO - ARRIBA - ABAJO);
  const ps = [...puntos].filter(p => p.valor != null && p.fecha >= desde && p.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const cero = y(0);
  const grilla = marcas.map(m => `<line x1="${IZQ}" x2="${ANCHO - DER}" y1="${y(m.valor).toFixed(1)}" y2="${y(m.valor).toFixed(1)}" class="${m.valor === 0 ? 'g-cero' : 'g-grilla'}"/>
    <text x="${IZQ - 6}" y="${(y(m.valor) + 3.5).toFixed(1)}" class="g-eje" text-anchor="end">${esc(m.texto)}</text>`).join('');
  // Un valor muy chico igual se ve: al menos 2 px desde el cero.
  const barras = ps.map(p => { const fin = y(p.valor), largo = Math.max(2, Math.abs(fin - cero)); return `<path class="${p.valor < 0 ? 'g-barra-baja' : 'g-barra'}" d="${barra(x(p.fecha), cero, p.valor < 0 ? cero + largo : cero - largo)}"/>`; }).join('');
  const toques = ps.map(p => `<rect class="g-toque" x="${(x(p.fecha) - 11).toFixed(1)}" y="${ARRIBA}" width="22" height="${ALTO - ARRIBA - ABAJO}" data-dato="${esc(`${corta(p.fecha)}: ${p.texto}`)}" tabindex="0" role="button" aria-label="${esc(`${corta(p.fecha)}: ${p.texto}`)}"/>`).join('');
  const ejeX = `<text x="${IZQ}" y="${ALTO - 4}" class="g-eje">${esc(corta(desde))}</text><text x="${ANCHO - DER}" y="${ALTO - 4}" class="g-eje" text-anchor="end">hoy</text>`;
  return `<div class="grafico"><svg viewBox="0 0 ${ANCHO} ${ALTO}" role="img" aria-label="${esc(titulo)}">${grilla}${ejeX}${barras}${toques}</svg><div class="g-aviso" hidden></div></div>`;
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

// ── Gráfico de progreso (ficha del ejercicio, medidas), como Hevy y más ───────────────────────────────────────────
// Arriba, el valor grande, su fecha y cuánto cambió contra la sesión anterior y el inicio del período. Al tocar o
// deslizar el dedo, una línea vertical marca el punto más cercano y debajo aparecen las series de ese día con un
// enlace a la sesión. El récord del período lleva su marca y una recta punteada muestra la tendencia con su ritmo por
// semana (nucleo/analisis-grafico.js). Deslizar en vertical sigue desplazando la página. Con teclado, flechas.

const GH_ANCHO = 340, GH_ALTO = 210, GH_DER = 14, GH_ARRIBA = 22, GH_ABAJO = 26;
const larga = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/\./g, '');

/**
 * @param puntos [{fecha, valor, texto, detalle?, sesion?}] texto: el valor como se lee arriba ("45 kg × 8");
 *   detalle: las series de ese día; sesion: id para abrirla
 * @param marcas [{valor, texto}] grilla con su etiqueta a la izquierda
 * @param cambio (diferencia) → texto con unidad ("+2,5 kg"); sin él, no se muestran cambios
 * @param mejorBaja true si bajar es mejorar (la ayuda de los asistidos); neutro: sin verde ni rojo (medidas del cuerpo)
 */
export function lineaHevy({ puntos, desde, hasta, min, max, marcas = [], titulo, izquierda = 48, cambio = null, mejorBaja = false, ritmo = null, neutro = false }) {
  const IZQ = izquierda, total = Math.max(1, dias(desde, hasta));
  const x = f => IZQ + (dias(desde, f) / total) * (GH_ANCHO - IZQ - GH_DER);
  const y = v => GH_ARRIBA + (1 - (Math.min(max, Math.max(min, v)) - min) / (max - min)) * (GH_ALTO - GH_ARRIBA - GH_ABAJO);
  const ps = [...puntos].filter(p => p.valor != null && p.fecha >= desde && p.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (!ps.length) return '';
  const a = analisisSerie(ps, { mejorBaja });
  const piso = GH_ALTO - GH_ABAJO;
  const grilla = marcas.map(m => `<line x1="${IZQ}" x2="${GH_ANCHO - GH_DER}" y1="${y(m.valor).toFixed(1)}" y2="${y(m.valor).toFixed(1)}" class="g-grilla"/>
    <text x="${IZQ - 6}" y="${(y(m.valor) + 4).toFixed(1)}" class="g-eje" text-anchor="end">${esc(m.texto)}</text>`).join('');
  const n = Math.min(5, Math.max(2, Math.round(total / 30) + 1));
  const ejeX = Array.from({ length: n }, (_, i) => {
    const f = new Date(Date.parse(desde + 'T12:00:00Z') + Math.round((total * i) / (n - 1)) * 864e5).toISOString().slice(0, 10);
    return `<text x="${x(f).toFixed(1)}" y="${GH_ALTO - 6}" class="g-eje" text-anchor="${i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}">${esc(corta(f))}</text>`;
  }).join('');
  const base = `<line x1="${IZQ}" x2="${GH_ANCHO - GH_DER}" y1="${piso}" y2="${piso}" class="g-base"/>`;
  const coords = ps.map(p => `${x(p.fecha).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  // La sesión en curso (marca 'en_curso') va al final con una línea punteada, como "In progress" de Hevy.
  const enCurso = ps.length > 1 && ps.at(-1).marca === 'en_curso';
  const firmes = enCurso ? ps.slice(0, -1) : ps;
  const pt = p => `${x(p.fecha).toFixed(1)},${y(p.valor).toFixed(1)}`;
  const linea = (firmes.length > 1 ? `<polyline class="gh-linea" points="${firmes.map(pt).join(' ')}"/>` : '')
    + (enCurso ? `<polyline class="gh-linea en-curso" points="${pt(ps.at(-2))} ${pt(ps.at(-1))}"/>` : '');
  const area = ps.length > 1 ? `<polygon class="gh-area" points="${x(ps[0].fecha).toFixed(1)},${piso} ${coords} ${x(ps.at(-1).fecha).toFixed(1)},${piso}"/>` : '';
  const t = a.tendencia;
  const tendencia = t ? `<line class="gh-tendencia" x1="${x(ps[0].fecha).toFixed(1)}" y1="${y(t.desde).toFixed(1)}" x2="${x(ps.at(-1).fecha).toFixed(1)}" y2="${y(t.hasta).toFixed(1)}"/>` : '';
  // El récord: un anillo y la palabra arriba del punto (si no tapa el borde).
  const r = ps[a.mejor], rx = x(r.fecha), ry = y(r.valor);
  const record = ps.length > 1 && !neutro ? `<circle class="gh-record" cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="7"/><text class="gh-record-texto" x="${Math.min(GH_ANCHO - GH_DER - 18, Math.max(IZQ + 18, rx)).toFixed(1)}" y="${Math.max(10, ry - 11).toFixed(1)}" text-anchor="middle">Récord</text>` : '';
  const circulos = ps.map((p, i) => `<circle class="gh-punto${p.marca ? ` ${p.marca}` : ''}${i === ps.length - 1 ? ' elegido' : ''}" data-i="${i}" cx="${x(p.fecha).toFixed(1)}" cy="${y(p.valor).toFixed(1)}" r="4"/>`).join('');
  // En una semana de descarga se baja a propósito, y la sesión en curso no terminó: el cambio va en gris, no en rojo.
  let enDescarga = false;
  const clase = d => (!d || neutro || enDescarga ? 'igual' : (d > 0) !== mejorBaja ? 'sube' : 'baja');
  const MARCA = { en_curso: 'en curso', descarga: 'semana de descarga' };
  const flecha = d => (!d ? '=' : d > 0 ? '▲' : '▼');
  const cambioTexto = (d, que) => (d == null || !cambio ? '' : `<span class="gh-par"><span class="gh-cambio ${clase(d)}">${flecha(d)} ${esc(cambio(d))}</span> <span class="suave">${que}</span></span>`);
  const datos = ps.map((p, i) => {
    enDescarga = Boolean(p.marca); // descarga o en curso: no se juzga en rojo
    return {
      x: +x(p.fecha).toFixed(1), t: p.texto, f: larga(p.fecha) + (MARCA[p.marca] ? ` · ${MARCA[p.marca]}` : ''), s: p.sesion || null, d: p.detalle || '',
      c: [cambioTexto(a.cambios[i].anterior, 'vs. anterior'), cambioTexto(a.cambios[i].inicio, 'en el período')].filter(Boolean).join(' · '),
      r: i === a.mejor && ps.length > 1 && !neutro, // en las medidas del cuerpo no hay récord
    };
  });
  const ult = datos.at(-1);
  const pie = t && ritmo ? `<p class="gh-pie pequeno suave"><span class="gh-pie-linea"></span>Tendencia: ${esc(ritmo(t.porSemana))} por semana</p>` : '';
  return `<div class="grafico-hevy" data-gh='${esc(JSON.stringify(datos))}'>
    <div class="gh-cab" aria-live="polite"><p><strong class="gh-valor num">${esc(ult.t)}</strong> <span class="gh-fecha">${esc(ult.f)}</span>${ult.r ? ' <span class="gh-chip-record">Récord</span>' : ''}</p>
      <p class="gh-cambios pequeno">${ult.c}</p></div>
    <svg viewBox="0 0 ${GH_ANCHO} ${GH_ALTO}" role="img" tabindex="0" aria-label="${esc(`${titulo}. Usa las flechas para recorrer los puntos.`)}">${grilla}${base}${ejeX}${area}${tendencia}${linea}
      <line class="gh-cursor" x1="${ult.x}" x2="${ult.x}" y1="${GH_ARRIBA - 8}" y2="${piso}"/>${record}${circulos}</svg>
    ${pie}
    <div class="gh-detalle"${ult.d ? '' : ' hidden'}><span class="gh-detalle-texto num">${esc(ult.d)}</span>${ult.s ? `<button type="button" class="enlace gh-ver" data-ver-sesion="${esc(ult.s)}">Ver la sesión ›</button>` : ''}</div>
  </div>`;
}

function elegirPunto(caja, i) {
  const datos = JSON.parse(caja.dataset.gh || '[]'), d = datos[i];
  if (!d || Number(caja.dataset.ghI) === i) return;
  caja.dataset.ghI = i;
  caja.querySelector('.gh-cab p').innerHTML = `<strong class="gh-valor num">${esc(d.t)}</strong> <span class="gh-fecha">${esc(d.f)}</span>${d.r ? ' <span class="gh-chip-record">Récord</span>' : ''}`;
  caja.querySelector('.gh-cambios').innerHTML = d.c;
  const cursor = caja.querySelector('.gh-cursor');
  cursor.setAttribute('x1', d.x); cursor.setAttribute('x2', d.x);
  caja.querySelectorAll('.gh-punto').forEach(c => c.classList.toggle('elegido', Number(c.dataset.i) === i));
  const det = caja.querySelector('.gh-detalle');
  if (det) {
    det.hidden = !d.d;
    det.innerHTML = `<span class="gh-detalle-texto num">${esc(d.d)}</span>${d.s ? `<button type="button" class="enlace gh-ver" data-ver-sesion="${esc(d.s)}">Ver la sesión ›</button>` : ''}`;
  }
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
