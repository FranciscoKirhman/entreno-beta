// Respuesta al toque y foco de la sesión (docs/56-principios-ux.md). Tres cosas, todas sin tocar la lógica:
// 1. Lo que se toca se aplasta un poco bajo el dedo y, al soltar, se estira y vuelve (se siente antes de que pase algo).
// 2. En una sesión empezada, la serie que sigue queda marcada: un solo lugar donde mirar.
// 3. Al marcar una serie, las cifras de arriba que cambiaron dan un pulso corto (acción secundaria).
// Con "reducir movimiento" no hay movimiento; la serie que sigue se marca igual, porque es color y no movimiento.
import { sinMovimiento } from './movimiento.js';

const SUAVE = 'cubic-bezier(.2,.7,.3,1)';
const TOCABLE = 'button, .boton, summary, [role="button"], [role="radio"], label:has(input[type="radio"]), label:has(input[type="checkbox"])';
// Lo que se arrastra, las zonas de toque de las historias y el fondo de las hojas no se aplastan.
const SIN_TOQUE = '.historias, .rueda, .quitar-serie, .hoja-fondo > :not(.hoja), [data-sin-toque], .cal-arrastrando, .reordenando';

let prensado = null, espera = 0;

function cuanto(el) {
  const r = el.getBoundingClientRect(), lado = Math.max(r.width, r.height);
  if (!lado || r.height > 200) return null; // una tarjeta entera no se aplasta
  const s = lado <= 64 ? 0.9 : lado <= 200 ? 0.95 : 0.975;
  return `${(s + 0.012).toFixed(3)} ${(s - 0.012).toFixed(3)}`; // un poco más ancho que alto: se aplasta
}
function prensar(el) {
  const escala = cuanto(el);
  if (!escala || !el.isConnected) return;
  prensado = { el, escala, anim: el.animate([{ scale: '1 1' }, { scale: escala }], { duration: 90, easing: 'ease-out', fill: 'forwards' }) };
}
function soltar() {
  clearTimeout(espera); espera = 0;
  const p = prensado; prensado = null;
  if (!p) return;
  if (p.el.isConnected) p.el.animate([{ scale: p.escala }, { scale: '1.012 1.03', offset: 0.55 }, { scale: '1 1' }], { duration: 240, easing: SUAVE });
  p.anim.cancel();
}

function alTocar(ev) {
  if (sinMovimiento() || ev.button > 0) return;
  const el = ev.target.closest?.(TOCABLE);
  if (!el?.animate || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest(SIN_TOQUE)) return;
  soltar();
  // Con el dedo, una pausa mínima: si era el inicio de un desplazamiento, el toque se cancela y nada se mueve.
  if (ev.pointerType === 'touch') espera = setTimeout(() => { espera = 0; prensar(el); }, 40);
  else prensar(el);
}

// ── La serie que sigue ─────────────────────────────────────────────────────────────────────────────
let cifrasAntes = null, pendiente = 0;
function revisarSesion() {
  pendiente = 0;
  const hoy = document.getElementById('vista-hoy');
  const filas = hoy?.querySelector('[data-terminar]') ? [...hoy.querySelectorAll('.serie-contenedor > .serie')] : [];
  let ultima = -1;
  filas.forEach((f, i) => { if (f.classList.contains('hecha')) ultima = i; });
  const sigue = filas.find((f, i) => i > ultima && !f.classList.contains('hecha')) || filas.find(f => !f.classList.contains('hecha')) || null;
  for (const f of document.querySelectorAll('.serie.sigue')) if (f !== sigue) f.classList.remove('sigue');
  if (sigue && !sigue.classList.contains('sigue')) sigue.classList.add('sigue');

  // Cifras de la cabecera (volumen y series; la duración corre sola y no cuenta).
  const cifras = hoy ? [...hoy.querySelectorAll('.cab-sesion-cifras > span:not(.cab-duracion) > strong')] : [];
  const ahora = cifras.map(c => c.textContent);
  if (cifrasAntes?.length === ahora.length && !sinMovimiento()) cifras.forEach((c, i) => {
    if (ahora[i] !== cifrasAntes[i]) c.animate?.([{ scale: '1', color: 'var(--accent)' }, { scale: '1.16', color: 'var(--accent)', offset: 0.4 }, { scale: '1' }], { duration: 320, delay: 90, easing: SUAVE });
  });
  cifrasAntes = hoy ? ahora : null;
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', alTocar, { passive: true });
  for (const fin of ['pointerup', 'pointercancel', 'dragstart']) document.addEventListener(fin, soltar, { passive: true });
  addEventListener('blur', soltar);
  const app = document.getElementById('app');
  if (app && typeof MutationObserver === 'function') {
    new MutationObserver(() => { if (!pendiente) pendiente = requestAnimationFrame(revisarSesion); })
      .observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }
}
