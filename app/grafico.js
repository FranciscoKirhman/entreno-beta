// Gráficos de línea simples, sin librerías y sin señal: una serie por gráfico (dos medidas de distinta escala van en
// dos gráficos, nunca con dos ejes). También barras sobre y bajo un cero, alineadas con las líneas. Línea de 2 px, puntos de 8 px con un anillo del color de la tarjeta, grilla
// suave y un aviso al tocar o pasar sobre cada punto. El color es --serie-1 (validado en claro y oscuro).
import { esc } from './comun.js';
import { analisisSerie, curvaSuave } from '../nucleo/analisis-grafico.js';

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


// ── Gráfico de progreso (ficha del ejercicio y medidas del cuerpo) ────────────────────────────────────────────────
// De borde a borde de la tarjeta, para que se entienda de un vistazo: arriba el valor actual grande, su fecha y cuánto
// cambió en el período; abajo una línea suave (nunca inventa picos ni valles: curvaSuave en nucleo/analisis-grafico.js)
// con un área en degradado, una línea punteada en el récord, la etiqueta del mínimo y fechas solo en los extremos y al
// medio, sin grilla ni eje de valores. Al pasar el puntero, tocar o deslizar el dedo, una burbuja sobre la sesión más
// cercana dice su valor, su fecha y el cambio contra la anterior, y debajo aparecen las series de ese día con un
// enlace a la sesión. Deslizar en vertical sigue desplazando la página. Con teclado: flechas, Inicio, Fin y Escape.

const GH_ANCHO = 343, GH_ALTO = 190, GH_LADO = 18, GH_ARRIBA = 30, GH_ABAJO = 26;
const larga = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).replace(/\./g, '');
const f1 = v => (Math.round(v * 10) / 10).toString();
const MARCA = { en_curso: 'en curso', descarga: 'semana de descarga' };
const flecha = d => (d > 0 ? '▲' : '▼');
/** "60 kg" → el número grande y la unidad más chica. */
const partes = t => { const m = /^([−+-]?[\d.,:]+)(\s.+)?$/.exec(t || ''); return m ? `${esc(m[1])}${m[2] ? ` <span class="gh-unidad">${esc(m[2].trim())}</span>` : ''}` : esc(t); };
const lapso = (a, b) => { const d = dias(a, b); return d < 14 ? `${d} ${d === 1 ? 'día' : 'días'}` : `${Math.round(d / 7)} semanas`; };
let ghN = 0;

/**
 * @param puntos [{fecha, valor, texto, corto?, detalle?, sesion?, marca?}] texto: el valor como se lee arriba
 *   ("45 kg × 8"); corto: el valor con su unidad para las etiquetas del gráfico ("45 kg"); detalle: las series de ese
 *   día; sesion: id para abrirla; marca: 'en_curso' (sesión de hoy sin guardar) o 'descarga'
 * @param titulo  qué se mide y cuántas sesiones, para el texto alternativo
 * @param nombre  qué se mide ("Máximo estimado"), bajo el valor grande
 * @param periodo el período en palabras ("3 meses"), para el texto alternativo
 * @param cambio  (diferencia) → texto con unidad ("+2,5 kg"); el signo se reemplaza por la flecha. Sin él, no hay cambios
 * @param mejorBaja true si bajar es mejorar (la ayuda de los asistidos); neutro: sin récord, verde ni rojo (medidas del cuerpo)
 * @param meta    {valor, texto}: una meta (peso del cuerpo), línea punteada con su etiqueta
 * @param bajo    HTML justo debajo del gráfico (los botones de período)
 * @param nota    texto bajo el gráfico cuando hay un solo punto
 */
export function lineaHevy({ puntos, desde, hasta, titulo = '', nombre = '', periodo = '', cambio = null, mejorBaja = false, neutro = false, meta = null, bajo = '', nota = '' }) {
  const ps = [...puntos].filter(p => p.valor != null && p.fecha >= desde && p.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  if (!ps.length) return '';
  const a = analisisSerie(ps, { mejorBaja });
  const n = ps.length, unico = n === 1, corto = p => p.corto || p.texto;
  const cifra = d => cambio(d).replace(/^[+−-]\s?/, '');
  // Escala vertical: los datos (y la meta), con aire abajo para la etiqueta del mínimo y arriba para la del récord.
  const vs = ps.map(p => p.valor).concat(meta ? [meta.valor] : []);
  const lo0 = Math.min(...vs), hi0 = Math.max(...vs), aire = hi0 - lo0 || Math.max(1, Math.abs(hi0) * 0.1);
  const lo = lo0 >= 0 ? Math.max(0, lo0 - aire * 0.3) : lo0 - aire * 0.3, hi = hi0 + aire * 0.15;
  // Eje horizontal: de la primera a la última sesión del período, sin espacio vacío antes de empezar.
  const total = dias(ps[0].fecha, ps.at(-1).fecha);
  const x = f => (!total ? GH_ANCHO / 2 : GH_LADO + (dias(ps[0].fecha, f) / total) * (GH_ANCHO - 2 * GH_LADO));
  // Con un solo punto el gráfico es bajo: no hay línea que mostrar todavía, y así no queda un recuadro vacío.
  const alto = unico ? 104 : GH_ALTO, piso = alto - GH_ABAJO;
  const y = v => (unico ? (GH_ARRIBA + piso) / 2 + 6 : GH_ARRIBA + (1 - (v - lo) / ((hi - lo) || 1)) * (piso - GH_ARRIBA));
  const pts = ps.map(p => [x(p.fecha), y(p.valor)]), gid = `gh-deg-${++ghN}`;
  // La sesión en curso va al final con un tramo punteado, como "In progress" de Hevy.
  const enCurso = n > 1 && ps.at(-1).marca === 'en_curso';
  const firmes = enCurso ? pts.slice(0, -1) : pts, d = curvaSuave(firmes);
  const tramoFinal = enCurso ? `L${f1(pts.at(-1)[0])},${f1(pts.at(-1)[1])}` : '';
  const linea = (firmes.length > 1 ? `<path class="gh-linea" d="${d}"/>` : '') + (enCurso ? `<path class="gh-linea en-curso" d="M${f1(pts.at(-2)[0])},${f1(pts.at(-2)[1])}${tramoFinal}"/>` : '');
  const area = n > 1 ? `<path class="gh-area" fill="url(#${gid})" d="${d}${tramoFinal}L${f1(pts.at(-1)[0])},${piso}L${f1(pts[0][0])},${piso}Z"/>` : '';
  // Etiquetas al lado contrario de su punto, para no taparlo.
  const alLado = (px, yy, texto, clase) => { const izq = px > GH_ANCHO / 2; return `<text class="${clase}" x="${izq ? GH_LADO : GH_ANCHO - GH_LADO}" y="${f1(yy)}" text-anchor="${izq ? 'start' : 'end'}">${esc(texto)}</text>`; };
  const guia = (v, clase) => `<line class="${clase}" x1="${GH_LADO}" x2="${GH_ANCHO - GH_LADO}" y1="${f1(y(v))}" y2="${f1(y(v))}"/>`;
  let guias = '';
  if (n > 1) {
    // El récord (en las medidas del cuerpo, el valor más alto, sin llamarlo récord) y el mínimo junto a su punto.
    const iTope = neutro ? ps.reduce((m, p, i) => (p.valor > ps[m].valor ? i : m), 0) : a.mejor;
    const iMin = ps.reduce((m, p, i) => (p.valor < ps[m].valor ? i : m), 0);
    guias += guia(ps[iTope].valor, neutro ? 'gh-guia' : 'gh-record') + alLado(pts[iTope][0], pts[iTope][1] - 7, neutro ? corto(ps[iTope]) : `Récord ${corto(ps[iTope])}`, neutro ? 'g-eje' : 'gh-record-texto');
    if (iMin !== iTope && ps[iMin].valor !== ps[iTope].valor) {
      const px = Math.min(GH_ANCHO - GH_LADO, Math.max(GH_LADO, pts[iMin][0]));
      guias += `<text class="g-eje" x="${f1(px)}" y="${piso - 6}" text-anchor="${px < GH_ANCHO / 2 ? 'start' : 'end'}">${esc(corto(ps[iMin]))}</text>`;
    }
  }
  if (unico) guias += guia(ps[0].valor, 'gh-guia');
  if (meta) guias += guia(meta.valor, 'gh-meta') + alLado(pts.at(-1)[0], y(meta.valor) - 7, meta.texto, 'gh-meta-texto');
  const fechaEn = k => new Date(Date.parse(ps[0].fecha + 'T12:00:00Z') + Math.round(total * k) * 864e5).toISOString().slice(0, 10);
  const fecha = (f, xx, ancla) => `<text class="g-eje" x="${f1(xx)}" y="${alto - 7}" text-anchor="${ancla}">${esc(corta(f))}</text>`;
  const fechas = unico ? fecha(ps[0].fecha, GH_ANCHO / 2, 'middle')
    : fecha(ps[0].fecha, GH_LADO, 'start') + (total >= 21 ? fecha(fechaEn(0.5), GH_ANCHO / 2, 'middle') : '') + fecha(ps.at(-1).fecha, GH_ANCHO - GH_LADO, 'end');
  // Con muchas sesiones los puntos taparían la línea: quedan el actual, el récord y los marcados (descarga, en curso).
  const denso = n > 20;
  const circulos = ps.map((p, i) => (denso && i !== n - 1 && i !== a.mejor && !p.marca ? '' : `<circle class="gh-punto${p.marca ? ` ${p.marca}` : ''}${i === n - 1 ? ' actual' : ''}" cx="${f1(pts[i][0])}" cy="${f1(pts[i][1])}" r="${i === n - 1 ? 5 : 3.5}"/>`)).join('');
  // En una semana de descarga se baja a propósito, y la sesión en curso no terminó: el cambio va en gris, no en rojo.
  let enDescarga = false;
  const clase = dd => (!dd || neutro || enDescarga ? 'igual' : (dd > 0) !== mejorBaja ? 'sube' : 'baja');
  const ult = ps.at(-1), dTotal = a.cambios.at(-1).inicio, cuanto = lapso(ps[0].fecha, ult.fecha);
  enDescarga = Boolean(ult.marca);
  const pastilla = unico || !cambio ? '' : `<p class="gh-pastilla ${clase(dTotal)}">${dTotal ? `${flecha(dTotal)} ${esc(cifra(dTotal))}` : 'Sin cambio'} en ${cuanto}</p>`;
  const esRecord = i => i === a.mejor && n > 1 && !neutro;
  const cab = `<div class="gh-cab"><p class="gh-valor num">${partes(ult.texto)}</p>
    <p class="gh-sub">${esc([nombre, larga(ult.fecha) + (MARCA[ult.marca] ? ` (${MARCA[ult.marca]})` : '')].filter(Boolean).join(' · '))}${esRecord(n - 1) ? ' · <b>Récord</b>' : ''}</p>${pastilla}</div>`;
  const datos = ps.map((p, i) => {
    enDescarga = Boolean(p.marca);
    const dd = a.cambios[i].anterior;
    return {
      x: +f1(pts[i][0]), y: +f1(pts[i][1]), t: p.texto, f: corta(p.fecha) + (MARCA[p.marca] ? ` · ${MARCA[p.marca]}` : ''), r: esRecord(i), d: p.detalle || '', s: p.sesion || null,
      c: dd == null || !cambio ? '' : dd ? `<span class="gh-cambio ${clase(dd)}">${flecha(dd)} ${esc(cifra(dd))}</span> vs. anterior` : 'Igual que la anterior',
    };
  });
  const resumen = [titulo, `Último: ${ult.texto}, ${larga(ult.fecha)}`,
    !unico && cambio ? `${dTotal > 0 ? 'Subió' : dTotal < 0 ? 'Bajó' : 'Sin cambio'}${dTotal ? ` ${cifra(dTotal)}` : ''} en ${cuanto}${periodo ? ` (período: ${periodo})` : ''}` : '',
    n > 1 && !neutro ? `Récord: ${ps[a.mejor].texto}` : '', 'Usa las flechas para recorrer los puntos'].filter(Boolean).join('. ');
  return `<div class="grafico-hevy" data-gh='${esc(JSON.stringify(datos))}'>${cab}
    <div class="gh-lienzo"><svg viewBox="0 0 ${GH_ANCHO} ${alto}" role="img" tabindex="0" aria-label="${esc(resumen)}">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="gh-deg-a"/><stop offset="1" class="gh-deg-b"/></linearGradient></defs>
      <line class="g-base" x1="0" x2="${GH_ANCHO}" y1="${piso}" y2="${piso}"/>${guias}${area}${linea}${circulos}
      <line class="gh-cursor" x1="0" x2="0" y1="0" y2="${piso}"/><circle class="gh-sel" cx="0" cy="0" r="7"/>${fechas}</svg>
      <div class="gh-burbuja" hidden aria-live="polite"></div></div>
    ${unico && nota ? `<p class="gh-nota">${esc(nota)}</p>` : ''}${bajo}
    <div class="gh-detalle" hidden></div>
  </div>`;
}

const datosDe = caja => { try { return JSON.parse(caja.dataset.gh || '[]'); } catch { return []; } };

/** Marca la sesión i: cursor, burbuja con su valor y, debajo, sus series con el enlace a la sesión. */
function elegirPunto(caja, i) {
  const d = datosDe(caja)[i];
  if (!d || (caja.classList.contains('gh-activo') && caja.dataset.ghI === String(i))) return;
  caja.dataset.ghI = i;
  caja.classList.add('gh-activo');
  const cursor = caja.querySelector('.gh-cursor'), sel = caja.querySelector('.gh-sel');
  cursor.setAttribute('x1', d.x); cursor.setAttribute('x2', d.x); cursor.setAttribute('y1', d.y + 8);
  sel.setAttribute('cx', d.x); sel.setAttribute('cy', d.y);
  const b = caja.querySelector('.gh-burbuja');
  b.innerHTML = `<strong class="num">${esc(d.t)}</strong><span>${esc(d.f)}${d.r ? ' · <b>Récord</b>' : ''}</span>${d.c ? `<span>${d.c}</span>` : ''}`;
  b.hidden = false;
  const k = caja.querySelector('svg').getBoundingClientRect().width / GH_ANCHO, ancho = b.parentElement.clientWidth;
  // Sobre el punto si cabe; si el punto está muy arriba, a su lado (hacia el centro), sin tapar la sesión elegida.
  const px = d.x * k, py = d.y * k, bw = b.offsetWidth, bh = b.offsetHeight, arriba = py - bh - 14;
  const cabe = arriba >= -6, alto = b.parentElement.clientHeight;
  b.style.left = `${cabe ? Math.min(Math.max(4, px - bw / 2), ancho - bw - 4) : px < ancho / 2 ? Math.min(px + 18, ancho - bw - 4) : Math.max(4, px - bw - 18)}px`;
  b.style.top = `${cabe ? arriba : Math.min(Math.max(-6, py - bh / 2), alto - bh)}px`;
  const det = caja.querySelector('.gh-detalle');
  if (det && (d.d || d.s)) {
    det.hidden = false;
    det.innerHTML = `<span class="gh-detalle-texto num">${esc(d.d)}</span>${d.s ? `<button type="button" class="enlace gh-ver" data-ver-sesion="${esc(d.s)}">Ver la sesión ›</button>` : ''}`;
  }
}
/** Quita el cursor y la burbuja; las series de la última sesión elegida quedan a la vista (con su enlace). */
function soltarPunto(caja) {
  if (!caja.classList.contains('gh-activo')) return;
  caja.classList.remove('gh-activo');
  delete caja.dataset.ghI;
  caja.querySelector('.gh-burbuja').hidden = true;
}
function puntoCercano(caja, clientX) {
  const r = caja.querySelector('svg').getBoundingClientRect(), vx = ((clientX - r.left) / r.width) * GH_ANCHO;
  const datos = datosDe(caja);
  let mejor = 0;
  datos.forEach((d, i) => { if (Math.abs(d.x - vx) < Math.abs(datos[mejor].x - vx)) mejor = i; });
  return mejor;
}
const cajaDe = ev => ev.target.closest?.('.grafico-hevy');
const sobreSvg = ev => Boolean(ev.target.closest?.('.grafico-hevy svg'));
let ghActivo = null;
document.addEventListener('pointerdown', ev => {
  const caja = sobreSvg(ev) ? cajaDe(ev) : null;
  document.querySelectorAll('.grafico-hevy.gh-activo').forEach(c => { if (c !== caja) soltarPunto(c); });
  if (!caja) return;
  ghActivo = caja;
  elegirPunto(caja, puntoCercano(caja, ev.clientX));
});
document.addEventListener('pointermove', ev => {
  if (ghActivo && (ev.buttons || ev.pointerType !== 'mouse')) { elegirPunto(ghActivo, puntoCercano(ghActivo, ev.clientX)); return; }
  if (ev.pointerType === 'mouse' && sobreSvg(ev)) elegirPunto(cajaDe(ev), puntoCercano(cajaDe(ev), ev.clientX)); // pasar el mouse
});
document.addEventListener('pointerup', () => { ghActivo = null; });
document.addEventListener('pointercancel', () => { ghActivo = null; });
// Con el mouse, la burbuja se va al salir del gráfico; con el dedo queda hasta tocar fuera.
document.addEventListener('pointerout', ev => {
  if (ev.pointerType !== 'mouse' || ghActivo || !sobreSvg(ev)) return;
  const svg = ev.target.closest('svg');
  if (!svg.contains(ev.relatedTarget)) soltarPunto(cajaDe(ev));
});
document.addEventListener('keydown', ev => {
  const caja = cajaDe(ev);
  if (!caja || !ev.target.matches?.('svg') || !['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(ev.key)) return;
  ev.preventDefault();
  if (ev.key === 'Escape') { soltarPunto(caja); return; }
  const n = datosDe(caja).length, i = caja.dataset.ghI == null ? null : Number(caja.dataset.ghI);
  elegirPunto(caja, ev.key === 'Home' ? 0 : ev.key === 'End' || i == null ? n - 1 : Math.max(0, Math.min(n - 1, i + (ev.key === 'ArrowRight' ? 1 : -1))));
});
document.addEventListener('focusout', ev => { if (ev.target.matches?.('.grafico-hevy svg')) soltarPunto(cajaDe(ev)); });
