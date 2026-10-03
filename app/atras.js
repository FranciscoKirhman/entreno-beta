// Volver atrás como en el teléfono: deslizando el dedo desde el borde izquierdo hacia la derecha (iPhone con la app
// instalada, que no trae ese gesto) y con el botón o el gesto "atrás" del teléfono (Android). Lleva a la pantalla de
// la que se vino o cierra la hoja abierta; en las pestañas principales no hay atrás.
import { cerrarHoja } from './hoja.js';
import { icono } from './iconos.js';
import { sinMovimiento } from './movimiento.js';

// Pantallas sin botón propio de volver, y a dónde vuelven.
const PADRE = { perfil: 'mas', seccion: 'perfil', plan: 'semana', checkin: 'semana', pasado: 'progreso', 'tablero-original': 'mas', resumen: 'hoy', banco: 'hoy' };
// Basta un deslizamiento corto desde el borde (Francisco, 3 de octubre): empezar pegado al borde ya evita los accidentes.
const BORDE = 28, UMBRAL = 44; // px: dónde empieza el gesto y cuánto hay que arrastrar

/** Si ir de una pantalla a otra es volver (para que la nueva entre desde la izquierda). */
export const esVuelta = (anterior, vista) => anterior === 'ejercicio' || PADRE[anterior] === vista || (anterior === 'cuestionario' && vista === 'inicio');

/** Qué hace "atrás" ahora, o null si no hay a dónde volver. */
export function accionAtras({ vista, extra, ir, conPlan }) {
  if (document.getElementById('hoja')) return () => cerrarHoja();
  // El botón de volver de la pantalla sabe a dónde volver (la ficha, por ejemplo, a la ficha anterior).
  const boton = document.querySelector('#app .volver, #app [data-atras]:not([hidden]), #vista-seccion #a-perfil');
  if (boton) return () => boton.click();
  const padre = vista === 'resumen' && extra?.desde ? extra.desde : vista === 'cuestionario' ? (conPlan ? 'hoy' : 'inicio') : PADRE[vista];
  return padre ? () => ir(padre) : null;
}

/** El botón o el gesto "atrás" del teléfono vuelve dentro de la app. En una pestaña principal, sale como siempre. */
function instalarHistorial(obtenerAccion) {
  if (history.state?.entreno !== 'guardia') {
    history.replaceState({ ...(history.state || {}), entreno: 'base' }, '');
    history.pushState({ entreno: 'guardia' }, '');
  }
  addEventListener('popstate', ev => {
    if (!ev.state?.entreno) return; // otros cambios de dirección (por ejemplo, el enlace de perfiles)
    const accion = obtenerAccion();
    if (accion) { history.pushState({ entreno: 'guardia' }, ''); accion(); }
    else if (ev.state.entreno === 'base') history.back();
  });
}

/** El gesto: una burbuja con la flecha sigue al dedo y, pasado el umbral, se llena para indicar que vuelve. */
function instalarGesto(obtenerAccion) {
  const ua = navigator.userAgent; // un iPad se presenta como Mac con pantalla táctil
  const ios = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !/Android/.test(ua));
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (ios && !instalada) return; // en Safari, su propio gesto de atrás ya pasa por el historial
  const app = document.getElementById('app');
  let inicio = null, activo = false, listo = false, burbuja = null, cuadro = 0, ultimo = null;

  const pintar = () => {
    cuadro = 0;
    if (!burbuja || !ultimo) return;
    const avance = Math.min(1, ultimo.dx / UMBRAL);
    burbuja.style.transform = `translate3d(${-52 + avance * 66}px, ${ultimo.y}px, 0)`;
    burbuja.style.opacity = String(Math.min(1, avance * 1.6));
    burbuja.classList.toggle('listo', listo);
    if (!sinMovimiento()) app.style.translate = `${Math.min(18, ultimo.dx * 0.12)}px 0`;
  };
  const terminar = volver => {
    const accion = volver ? inicio?.accion : null;
    inicio = null; activo = false; listo = false; ultimo = null;
    const b = burbuja; burbuja = null;
    if (b) {
      b.style.transition = 'transform .18s ease-in, opacity .18s ease-in';
      b.style.opacity = '0';
      b.style.transform = b.style.transform.replace(/translate3d\([^,]+/, 'translate3d(-52px');
      setTimeout(() => b.remove(), 200);
    }
    if (accion) { app.style.translate = ''; accion(); return; }
    if (app.style.translate) {
      const desde = app.style.translate; app.style.translate = '';
      if (!sinMovimiento()) app.animate([{ translate: desde }, { translate: '0 0' }], { duration: 180, easing: 'cubic-bezier(.2,.7,.3,1)' });
    }
  };

  addEventListener('touchstart', ev => {
    if (ev.touches.length !== 1 || ev.touches[0].clientX > BORDE) return;
    const accion = obtenerAccion();
    if (!accion) return;
    const t = ev.touches[0];
    inicio = { x: t.clientX, y: t.clientY, tiempo: performance.now(), accion };
  }, { passive: true });

  addEventListener('touchmove', ev => {
    if (!inicio) return;
    const t = ev.touches[0], dx = t.clientX - inicio.x, dy = t.clientY - inicio.y;
    if (!activo) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { inicio = null; return; } // era desplazar la pantalla
      if (dx < 8) return;
      activo = true;
      burbuja = document.createElement('div');
      burbuja.className = 'atras-gesto';
      burbuja.setAttribute('aria-hidden', 'true');
      burbuja.innerHTML = icono('flecha', 'icono flecha-atras');
      document.body.append(burbuja);
    }
    ev.preventDefault(); // mientras se arrastra hacia el lado, la pantalla no se desplaza
    const antes = listo;
    listo = dx >= UMBRAL;
    if (listo && !antes) navigator.vibrate?.(8);
    ultimo = { dx: Math.max(0, dx), y: t.clientY };
    cuadro ||= requestAnimationFrame(pintar);
  }, { passive: false });

  addEventListener('touchend', ev => {
    if (!inicio) return;
    const dx = ev.changedTouches[0].clientX - inicio.x;
    const rapido = dx > 20 && dx / (performance.now() - inicio.tiempo) > 0.3; // un toque rápido hacia el lado también vale
    terminar(activo && (dx >= UMBRAL || rapido));
  });
  addEventListener('touchcancel', () => { if (inicio) terminar(false); });
}

export function instalarAtras(obtenerAccion) {
  instalarHistorial(obtenerAccion);
  instalarGesto(obtenerAccion);
}
