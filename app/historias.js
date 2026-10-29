// Historias de la semana, el mes y el año a pantalla completa, como las de Instagram y el resumen anual de Spotify
// (fase 3 del plan del 28 de octubre de 2026). Arriba, una barra por pantalla que avanza sola; tocar a la derecha avanza
// y a la izquierda vuelve, mantener apretado pausa y deslizar hacia abajo cierra. Una idea por pantalla, con un color
// cada una, números grandes que se cuentan solos y el coach que narra. Los datos salen de nucleo/historias.js; aquí solo
// se dibujan. Se entra desde Entrenar (los círculos de arriba), el Coach (el anillo en su cara) y Progreso (el resumen).
import { E, D, esc, guardar, indice, hoy, peso, volumenTexto, enUnidad, unidadPeso, IMAGENES } from './comun.js';
import { imagenAsistente, nombreAsistente } from './cuestionario.js';
import { historiaSemana, historiaMes, historiaAnio, historiasDeHoy, idHistoria, MESES } from '../nucleo/historias.js';
import { textoPct } from '../nucleo/rendimiento-sesion.js';
import { esAsistido } from '../nucleo/catalogo.js';
import { textoRecord, srcInsignia } from './resumen.js';
import { NOMBRE_MUSCULO, mayuscula } from './musculos.js';
import { imagenSesion } from './imagen-sesion.js';
import { icono } from './iconos.js';
import { sinMovimiento } from './movimiento.js';

// Cuánto dura cada pantalla, según lo que hay que leer.
const DURACION = { portada: 6000, cifra: 7000, records: 8500, barras: 8500, lista: 7500, fuerza: 8500, ranking: 9000, meta: 7000, personalidad: 8000, cierre: 6000 };
const POSE = { semana: 'saludo', mes: 'calendario', año: 'celebra' };
const ICONO_PERSONALIDAD = { constante: 'calendario', records: 'trofeo', preciso: 'objetivo', madrugador: 'reloj', nocturno: 'luna', incansable: 'fuego' };
const FORMATO = {
  entero: x => Math.round(x).toLocaleString('es-CL'),
  peso: x => Math.round(enUnidad(x) || 0).toLocaleString('es-CL'),
  pct: x => textoPct(x),
  dif: x => `${x > 0.5 ? '+' : x < -0.5 ? '−' : ''}${Math.abs(Math.round(x))}`,
};
/** En el repaso del cierre, los volúmenes grandes en corto: "123 mil" o "1,2 millones". */
const corto = x => { const v = Math.round(enUnidad(x) || 0); return v >= 1e6 ? `${String(Math.round(v / 1e5) / 10).replace('.', ',')} millones` : v >= 1e5 ? `${Math.round(v / 1e3)} mil` : v.toLocaleString('es-CL'); };
/** La cifra grande, con su largo: así una de 9 caracteres achica la letra para caber en el ancho. */
const grande = (valor, formato = 'entero') => `<p class="hist-grande" style="--n:${FORMATO[formato](Number(valor) || 0).length}">${numero(valor, formato)}</p>`;

// ── Qué historias hay y cómo se arman ────────────────────────────────────────────────────────────────────────────────
const etiquetaDe = x => (x.tipo === 'semana' ? 'Tu semana' : x.tipo === 'mes' ? mayuscula(MESES[Number(x.mes.slice(5, 7)) - 1]) : `Tu ${x.anio}`);
const deId = id => { const [tipo, v] = String(id).split('|'); return tipo === 'semana' ? { tipo, lunes: v } : tipo === 'mes' ? { tipo, mes: v } : { tipo: 'año', anio: Number(v) }; };
export const disponibles = () => historiasDeHoy({ sesiones: E.sesiones || [], plan: E.plan, hoy: hoy() });
export const hayNueva = () => disponibles().some(x => !E.historiasVistas?.[idHistoria(x)]);

/** Arma la historia de una clave ('semana|2026-10-19', 'mes|2026-10', 'año|2026'). */
export function construir(id) {
  const x = deId(id), asistidos = new Set(indice.ejercicios.filter(esAsistido).map(e => e.id));
  const base = { sesiones: E.sesiones || [], plan: E.plan, bienestar: E.bienestar || {}, indice, asistidos };
  if (x.tipo === 'semana') return historiaSemana({ ...base, lunes: x.lunes, hoy: hoy() });
  if (x.tipo === 'mes') return historiaMes({ ...base, mes: x.mes, rango: D().series_rango || null });
  return historiaAnio({ ...base, anio: x.anio });
}

/** Los círculos de arriba en Entrenar, como los de Instagram: con anillo de color si hay una nueva. */
export function filaHistoriasHtml() {
  const xs = disponibles();
  if (!xs.length) return '';
  return `<ul class="hist-fila" aria-label="Tus historias">${xs.map(x => {
    const id = idHistoria(x), nueva = !E.historiasVistas?.[id];
    return `<li><button type="button" class="hist-burbuja${nueva ? ' nueva' : ''}" data-historia="${esc(id)}" aria-label="${esc(`${etiquetaDe(x)}${nueva ? ', nueva' : ''}`)}">
      <span class="hist-anillo"><span class="hist-marco">${imagenAsistente(POSE[x.tipo], 'hist-cara-burbuja')}</span></span><span class="hist-burbuja-nombre">${esc(etiquetaDe(x))}</span></button></li>`;
  }).join('')}</ul>`;
}

/** Abre la historia de esa clave. alCerrar: para repintar lo de atrás (el anillo deja de estar nuevo). */
export function abrirPorId(id, opciones = {}) {
  const h = construir(id);
  if (h) abrirHistoria(h, opciones);
  return Boolean(h);
}
/** La primera nueva (desde el anillo del Coach) o, si ya se vieron todas, la primera. */
export function abrirPrimera(opciones = {}) {
  const xs = disponibles();
  const x = xs.find(y => !E.historiasVistas?.[idHistoria(y)]) || xs[0];
  return x ? abrirPorId(idHistoria(x), opciones) : false;
}

// ── Cada pantalla ─────────────────────────────────────────────────────────────────────────────────────────────────────
function nombreEj(id) {
  const ej = indice.porId.get(id);
  if (ej) return ej.nombre;
  for (const s of E.sesiones || []) for (const x of s.series || []) if (x.ejercicio_id === id && x.ejercicio_nombre) return x.ejercicio_nombre;
  return 'Ejercicio';
}
const numero = (valor, formato = 'entero') => `<span class="hist-numero" data-valor="${Number(valor) || 0}" data-formato="${formato}">${esc(FORMATO[formato](Number(valor) || 0))}</span>`;
const insigniaHtml = tipo => (IMAGENES.has(srcInsignia(tipo)) ? `<img class="hist-insignia-chica" src="${srcInsignia(tipo)}" alt="" width="40" height="40" decoding="async">` : `<span class="hist-insignia-chica">${icono('trofeo')}</span>`);
const conSigno = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`;

function diasHtml(dias) {
  const estado = d => (d.hecho ? 'entrenaste' : d.planeado ? 'tocaba y no se hizo' : 'descanso');
  return `<ol class="hist-dias">${dias.map((d, i) => `<li class="${d.hecho ? 'hecho' : d.planeado ? 'planeado' : ''}" style="--i:${i}"><i aria-hidden="true">${d.hecho ? icono('visto') : ''}</i><span aria-hidden="true">${d.letra}</span><span class="sr-only">${Number(d.fecha.slice(8))}: ${estado(d)}</span></li>`).join('')}</ol>`;
}
function calendarioHtml(c) {
  const cab = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(l => `<span class="cab" aria-hidden="true">${l}</span>`).join('');
  const vacios = Array.from({ length: c.primero }, () => '<span aria-hidden="true"></span>').join('');
  return `<div class="hist-cal" role="img" aria-label="${esc(`Entrenaste los días ${c.dias.filter(d => d.hecho).map(d => d.dia).join(', ')}`)}">${cab}${vacios}${c.dias.map(d => `<span class="${d.hecho ? 'hecho' : ''}" aria-hidden="true">${d.dia}</span>`).join('')}</div>`;
}
function barrasHtml(p) {
  const max = Math.max(1, ...p.barras.map(b => Math.max(b.valor, b.meta)));
  const n = x => Math.round(x);
  const valor = b => (!b.meta ? `${n(b.valor)}` : p.referencia === 'anterior' ? `${n(b.valor)} · antes ${n(b.meta)}` : `${n(b.valor)} de ${n(b.meta)}`);
  return `<ul class="hist-barras-m">${p.barras.map((b, i) => `<li style="--i:${i}">
      <span class="nombre">${esc(mayuscula(NOMBRE_MUSCULO[b.musculo] || b.musculo))}</span><span class="valor">${esc(valor(b))}</span>
      <span class="pista" aria-hidden="true"><span class="relleno" style="--p:${(b.valor / max * 100).toFixed(1)}%"></span>${b.meta ? `<span class="marca" style="--m:${(b.meta / max * 100).toFixed(1)}%"></span>` : ''}</span></li>`).join('')}</ul>`;
}

function contenidoHtml(p, h) {
  const etiqueta = `<p class="hist-etiqueta">${esc(p.etiqueta)}</p>`;
  const titulo = p.titulo ? `<h2 class="hist-titulo">${esc(p.titulo)}</h2>` : '';
  const detalle = p.detalle ? `<p class="hist-detalle">${esc(p.detalle)}</p>` : '';
  switch (p.forma) {
    case 'portada':
      return `${etiqueta}${titulo}${grande(p.cifra.valor)}<p class="hist-unidad">${esc(p.cifra.texto)}</p>${detalle}${p.dias ? diasHtml(p.dias) : ''}${p.calendario ? calendarioHtml(p.calendario) : ''}`;
    case 'cifra': {
      const formato = { peso: 'peso', pct: 'pct', dif: 'dif' }[p.cifra.unidad] || 'entero';
      const unidad = p.cifra.unidad === 'peso' ? `${unidadPeso()} ${p.texto}` : p.cifra.texto || p.texto;
      const chip = p.comparacion ? `<p class="hist-chip">${icono(p.comparacion.valor >= 0 ? 'sube' : 'baja')}${esc(p.comparacion.texto)}</p>` : '';
      return `${etiqueta}${titulo}${grande(p.cifra.valor, formato)}<p class="hist-unidad">${esc(unidad)}</p>${chip}${detalle}${p.nota ? `<p class="hist-nota">${esc(p.nota)}</p>` : ''}`;
    }
    case 'records':
      return `${etiqueta}${grande(p.cifra.valor)}<p class="hist-unidad">${esc(p.cifra.texto)}</p>
        <ul class="hist-lista">${p.records.map((r, i) => `<li style="--i:${i}">${insigniaHtml(r.tipo)}<span><strong>${esc(nombreEj(r.ejercicio_id))}</strong><small>${esc(mayuscula(textoRecord(r, { corto: true })))}</small></span></li>`).join('')}</ul>`;
    case 'barras':
      return `${etiqueta}${titulo}${p.leyenda ? `<p class="hist-leyenda"><i aria-hidden="true"></i>${esc(p.leyenda)}</p>` : ''}${barrasHtml(p)}`;
    case 'lista':
      return `${etiqueta}${titulo}${p.items.length ? `<ul class="hist-lista">${p.items.map((it, i) => `<li style="--i:${i}"><span class="hist-fecha">${esc(mayuscula(it.detalle))}</span><strong>${esc(it.titulo)}</strong></li>`).join('')}</ul>` : ''}`;
    case 'fuerza':
      return `${etiqueta}${titulo}<ul class="hist-lista hist-fuerza">${p.items.map((it, i) => `<li style="--i:${i}"${it.ejercicio_id === p.destacado ? ' class="destacado"' : ''}><span><strong>${esc(nombreEj(it.ejercicio_id))}</strong><small>De ${esc(peso(it.desde))} a ${esc(peso(it.hasta))}</small></span><b class="hist-pct">${esc(it.cambio ? conSigno(it.cambio) : 'Igual')}</b></li>`).join('')}</ul>`;
    case 'ranking':
      return `${etiqueta}${titulo}<ol class="hist-ranking">${p.items.map((it, i) => `<li style="--i:${i}"><span class="pos" aria-hidden="true">${i + 1}</span><span class="nombre">${esc(nombreEj(it.ejercicio_id))}</span><span class="veces">${it.veces} ${it.veces === 1 ? 'vez' : 'veces'}</span></li>`).join('')}</ol>`;
    case 'meta': {
      const t = p.meta.tipo === 'musculo' ? `Llevar ${NOMBRE_MUSCULO[p.meta.musculo] || p.meta.musculo} a ${p.meta.series} series por semana: es lo que quedó más bajo.` : p.meta.texto;
      return `${etiqueta}${titulo}<p class="hist-meta">${esc(t)}</p>`;
    }
    case 'personalidad': {
      const src = `img/historias/${p.insignia}.webp`;
      return `${etiqueta}<div class="hist-insignia">${IMAGENES.has(src) ? `<img src="${src}" alt="" width="160" height="160" decoding="async">` : icono(ICONO_PERSONALIDAD[p.insignia] || 'estrella')}</div><h2 class="hist-titulo centrado">${esc(p.titulo)}</h2><p class="hist-detalle centrado">${esc(p.texto)}</p>`;
    }
    case 'cierre': {
      const c = h.compartir, dato = (v, t) => `<li><strong>${esc(v)}</strong><span>${esc(t)}</span></li>`;
      const repaso = `<ul class="hist-repaso">${h.tipo === 'año' ? dato(FORMATO.entero(c.sesiones), c.sesiones === 1 ? 'sesión' : 'sesiones') : dato(FORMATO.entero(c.dias), c.dias === 1 ? 'día' : 'días')}${dato(corto(c.volumen), `${unidadPeso()} levantados`)}${dato(FORMATO.entero(c.nRecords), c.nRecords === 1 ? 'con récord' : 'con récords')}</ul>`;
      return `${etiqueta}${titulo}${repaso}<div class="hist-acciones"><button type="button" class="hist-accion" data-hist-compartir>${icono('compartir')}Compartir</button><button type="button" class="hist-accion secundaria" data-hist-otra-vez>Ver de nuevo</button></div>
        <p class="hist-privado">La imagen lleva tus cifras y récords; nunca tu energía, ánimo ni sueño.</p>`;
    }
    default: return `${etiqueta}${titulo}${detalle}`;
  }
}
const coachHtml = p => (p.frase ? `<div class="hist-coach">${imagenAsistente(p.pose, 'hist-pose')}<p class="hist-globo">${esc(p.frase)}</p></div>` : '');

// ── El visor ──────────────────────────────────────────────────────────────────────────────────────────────────────────
let abierta = null;
// Safari y la app instalada tiñen su franja con theme-color: mientras dura la historia, el color de cada pantalla.
const colorBarra = () => document.querySelector('meta[name="theme-color"]');

/** Abre una historia armada (nucleo/historias.js). volver: dónde queda el foco al cerrar. */
export function abrirHistoria(h, { volver = null, alCerrar = null } = {}) {
  if (!h?.pantallas?.length) return;
  cerrarHistoria();
  (E.historiasVistas ||= {})[h.id] = true;
  guardar();
  const raiz = document.createElement('div');
  raiz.id = 'historias'; raiz.className = 'historias'; raiz.tabIndex = -1;
  raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true'); raiz.setAttribute('aria-label', h.titulo);
  raiz.innerHTML = `<div class="hist-barras" aria-hidden="true">${h.pantallas.map(() => '<span><i></i></span>').join('')}</div>
    <div class="hist-cab">
      <span class="hist-quien"><span class="hist-marco hist-cara">${imagenAsistente('saludo', 'hist-cara-img')}</span><span><strong>${esc(nombreAsistente())}</strong><small>${esc(h.titulo)}</small></span></span>
      <button type="button" class="hist-boton" data-hist-pausa aria-pressed="false" aria-label="Pausar">${icono('pausa')}</button>
      <button type="button" class="hist-boton" data-hist-cerrar aria-label="Cerrar">${icono('cerrar')}</button>
    </div>
    <button type="button" class="hist-zona antes" data-hist-ir="-1" aria-label="Pantalla anterior"></button>
    <button type="button" class="hist-zona despues" data-hist-ir="1" aria-label="Pantalla siguiente"></button>
    <div class="hist-escena"></div>
    <p class="sr-only" aria-live="polite" data-hist-donde></p>`;
  // Lo de atrás queda fuera de alcance (lector de pantalla y teclado) mientras la historia está abierta.
  const inertes = [...document.body.children].map(el => [el, el.inert]);
  for (const [el] of inertes) el.inert = true;
  document.body.append(raiz);
  document.documentElement.classList.add('con-historias');
  abierta = { h, i: -1, raiz, volver, alCerrar, inertes, pausada: false, manteniendo: false, tragarClic: false, colorAntes: colorBarra()?.getAttribute('content') ?? null };
  enlazar(abierta);
  ir(0);
  raiz.focus({ preventScroll: true });
}

export function cerrarHistoria() {
  const a = abierta;
  if (!a) return;
  abierta = null;
  document.removeEventListener('keydown', teclas);
  a.raiz.remove();
  for (const [el, antes] of a.inertes) el.inert = antes;
  document.documentElement.classList.remove('con-historias');
  if (a.colorAntes != null) colorBarra()?.setAttribute('content', a.colorAntes);
  a.alCerrar?.();
  (a.volver?.isConnected ? a.volver : document.querySelector(`[data-historia="${CSS.escape(a.h.id)}"]`))?.focus?.({ preventScroll: true });
}

function ir(i) {
  const a = abierta;
  if (!a) return;
  const n = a.h.pantallas.length;
  if (i >= n) return cerrarHistoria();
  a.i = Math.max(0, i);
  const p = a.h.pantallas[a.i];
  a.raiz.dataset.tema = p.tema;
  const color = getComputedStyle(a.raiz).getPropertyValue('--hist-fondo').trim();
  if (color) colorBarra()?.setAttribute('content', color);
  a.raiz.querySelectorAll('.hist-barras span').forEach((s, k) => {
    s.className = k < a.i ? 'llena' : '';
    if (k === a.i) { s.style.setProperty('--hist-dur', `${DURACION[p.forma] || 7000}ms`); void s.offsetWidth; s.className = 'actual'; }
  });
  const escena = a.raiz.querySelector('.hist-escena');
  escena.innerHTML = `<div class="hist-contenido">${contenidoHtml(p, a.h)}</div>${coachHtml(p)}`;
  escena.classList.remove('entra'); void escena.offsetWidth; escena.classList.add('entra');
  a.raiz.querySelector('[data-hist-donde]').textContent = `${a.i + 1} de ${n}: ${p.etiqueta}`;
  contar(escena);
  escena.querySelector('[data-hist-compartir]')?.addEventListener('click', ev => compartir(a.h, ev.currentTarget));
  escena.querySelector('[data-hist-otra-vez]')?.addEventListener('click', () => ir(0));
}

function pausar(si) {
  const a = abierta;
  if (!a) return;
  a.raiz.classList.toggle('en-pausa', si);
  const b = a.raiz.querySelector('[data-hist-pausa]');
  b.setAttribute('aria-pressed', String(si)); b.setAttribute('aria-label', si ? 'Seguir' : 'Pausar');
  b.innerHTML = icono(si ? 'reproducir' : 'pausa');
}

/** Los números grandes se cuentan desde cero, salvo que el teléfono pida reducir movimiento. */
function contar(escena) {
  const nums = [...escena.querySelectorAll('.hist-numero[data-valor]')];
  if (!nums.length || sinMovimiento()) return;
  const t0 = performance.now(), dura = 900;
  const paso = t => {
    if (!nums[0].isConnected) return;
    // El primer cuadro puede traer una hora anterior a t0: sin el tope, la cuenta partía en negativo ("-1").
    const k = Math.max(0, Math.min(1, (t - t0) / dura)), e = 1 - (1 - k) ** 3;
    for (const el of nums) el.textContent = FORMATO[el.dataset.formato](Number(el.dataset.valor) * e);
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function teclas(ev) {
  const a = abierta;
  if (!a) return;
  if (ev.key === 'Escape') { ev.preventDefault(); cerrarHistoria(); }
  else if (ev.key === 'ArrowRight') { ev.preventDefault(); ir(a.i + 1); }
  else if (ev.key === 'ArrowLeft') { ev.preventDefault(); ir(a.i - 1); }
  else if (ev.key === ' ' && !ev.target.closest?.('button')) { ev.preventDefault(); a.pausada = !a.pausada; pausar(a.pausada); }
  else if (ev.key === 'Tab') {
    // El foco no sale de la historia.
    const xs = [...a.raiz.querySelectorAll('button:not([disabled])')];
    if (!xs.length) return;
    const i = xs.indexOf(document.activeElement);
    if (ev.shiftKey && i <= 0) { ev.preventDefault(); xs.at(-1).focus(); }
    else if (!ev.shiftKey && (i === -1 || i === xs.length - 1)) { ev.preventDefault(); xs[0].focus(); }
  }
}

function enlazar(a) {
  const { raiz } = a;
  document.addEventListener('keydown', teclas);
  raiz.querySelector('[data-hist-cerrar]').onclick = () => cerrarHistoria();
  raiz.querySelector('[data-hist-pausa]').onclick = () => { a.pausada = !a.pausada; pausar(a.pausada); };
  // Al terminar la barra, la pantalla siguiente; la última se queda (tiene Compartir).
  raiz.addEventListener('animationend', ev => {
    if (ev.animationName === 'hist-avance' && ev.target.closest('.actual') && a.i < a.h.pantallas.length - 1) ir(a.i + 1);
  });
  raiz.addEventListener('click', ev => {
    const z = ev.target.closest('[data-hist-ir]');
    if (!z) return;
    if (a.tragarClic) { a.tragarClic = false; return; }
    ir(a.i + Number(z.dataset.histIr));
  });
  // Mantener apretado pausa; deslizar hacia abajo cierra. Los botones de arriba y los de la pantalla funcionan solos.
  let inicio = null, espera = null;
  raiz.addEventListener('pointerdown', ev => {
    if (ev.target.closest('.hist-cab button, .hist-escena button')) return;
    inicio = { x: ev.clientX, y: ev.clientY, arrastre: false };
    espera = setTimeout(() => { a.manteniendo = true; pausar(true); }, 220);
  });
  raiz.addEventListener('pointermove', ev => {
    if (!inicio) return;
    const dx = ev.clientX - inicio.x, dy = ev.clientY - inicio.y;
    if (!inicio.arrastre && dy > 12 && Math.abs(dy) > Math.abs(dx)) { inicio.arrastre = true; clearTimeout(espera); pausar(true); }
    if (inicio.arrastre) { raiz.style.transform = `translateY(${Math.max(0, dy)}px) scale(${1 - Math.min(0.08, dy / 2000)})`; raiz.style.opacity = String(Math.max(0.4, 1 - dy / 700)); }
  });
  const soltar = ev => {
    if (!inicio) return;
    clearTimeout(espera);
    const dy = ev.clientY - inicio.y, arrastre = inicio.arrastre;
    inicio = null;
    if (arrastre) {
      a.tragarClic = true;
      if (dy > 110) return cerrarHistoria();
      raiz.style.transform = ''; raiz.style.opacity = '';
      pausar(a.pausada);
    } else if (a.manteniendo) { a.manteniendo = false; a.tragarClic = true; pausar(a.pausada); }
  };
  raiz.addEventListener('pointerup', soltar);
  raiz.addEventListener('pointercancel', soltar);
}

/** La imagen para compartir (app/imagen-sesion.js): cifras, favoritos y récords; nunca datos de salud. */
async function compartir(h, boton) {
  const c = h.compartir;
  boton.disabled = true;
  try {
    const cifras = h.tipo === 'año'
      ? [[c.sesiones, c.sesiones === 1 ? 'sesión' : 'sesiones'], [volumenTexto(c.volumen), 'levantados'], [c.nRecords, c.nRecords === 1 ? 'con récord' : 'con récords']]
      : [[c.dias, c.dias === 1 ? 'día entrenado' : 'días entrenados'], [volumenTexto(c.volumen), 'levantados'], [c.nRecords, c.nRecords === 1 ? 'con récord' : 'con récords']];
    const blob = await imagenSesion({
      titulo: c.personalidad ? `${c.titulo}: ${c.personalidad}` : c.titulo, fecha: c.periodo, cifras, seccion: 'FAVORITOS',
      ejercicios: c.ejercicios.map(x => [nombreEj(x.ejercicio_id), `${x.series} series`]),
      records: c.records.map(r => `${nombreEj(r.ejercicio_id)}: ${textoRecord(r, { corto: true })}`),
    });
    const archivo = new File([blob], `entreno-${h.id.replace('|', '-')}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [archivo] })) { try { await navigator.share({ files: [archivo], title: c.titulo }); } catch { /* cerró el menú */ } return; }
    // Sin menú para compartir (un computador): se descarga la imagen.
    const url = URL.createObjectURL(blob), enlace = document.createElement('a');
    enlace.href = url; enlace.download = archivo.name; abierta?.raiz.append(enlace); enlace.click(); enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } finally { if (boton.isConnected) boton.disabled = false; }
}
