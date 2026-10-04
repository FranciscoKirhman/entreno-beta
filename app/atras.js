// Volver atrás como en el teléfono: deslizando el dedo desde el borde izquierdo hacia la derecha (iPhone con la app
// instalada, que no trae ese gesto) y con el botón o el gesto "atrás" del teléfono (Android). Lleva a la pantalla de
// la que se vino o cierra la hoja abierta; en las pestañas principales no hay atrás. Mientras se desliza, la pantalla
// actual sigue al dedo y debajo se ve aquella a la que se vuelve, como quedó al salir de ella.
import { cerrarHoja } from './hoja.js';
import { icono } from './iconos.js';
import { sinMovimiento } from './movimiento.js';

// Pantallas sin botón propio de volver, y a dónde vuelven.
const PADRE = { perfil: 'mas', seccion: 'perfil', plan: 'semana', checkin: 'semana', pasado: 'progreso', 'tablero-original': 'mas', resumen: 'hoy', banco: 'hoy' };
// Basta un deslizamiento corto desde el borde (Francisco, 3 de octubre): empezar pegado al borde ya evita los accidentes.
const BORDE = 28, UMBRAL = 44; // px: dónde empieza el gesto y cuánto hay que arrastrar

// Las pantallas que se dejaron: sus propios nodos (ya fuera de la página, con lo que tenían abierto o escrito) y la
// altura a la que estaban. Se guarda la última de cada pantalla, hasta seis.
const fotos = new Map();
let conGesto = false;

/** Guarda la pantalla que se deja (app.js la llama antes de pintar la siguiente). */
export function recordarPantalla(vista, app) {
  if (!vista || !app?.firstChild) return;
  fotos.delete(vista);
  fotos.set(vista, { nodos: [...app.childNodes], y: scrollY });
  if (fotos.size > 6) fotos.delete(fotos.keys().next().value);
}
/** A qué altura estaba una pantalla al dejarla: al volver, queda en el mismo lugar. */
export const alturaDe = vista => fotos.get(vista)?.y;
/** Si la vuelta en curso la hizo el gesto: la pantalla ya entró mientras se deslizaba y no se anima de nuevo. */
export const volviendoConGesto = () => conGesto;

/** Si ir de una pantalla a otra es volver (para que la nueva entre desde la izquierda). */
export const esVuelta = (anterior, vista) => anterior === 'ejercicio' || PADRE[anterior] === vista || (anterior === 'cuestionario' && vista === 'inicio');

/** Qué hace "atrás" ahora, o null si no hay a dónde volver. Su "destino" es la pantalla a la que lleva, si se sabe. */
export function accionAtras({ vista, extra, ir, conPlan }) {
  if (document.getElementById('hoja')) return () => cerrarHoja();
  // El botón de volver de la pantalla sabe a dónde volver (la ficha, por ejemplo, a la ficha anterior); data-vuelve-a
  // dice a qué pantalla, cuando es otra.
  const boton = document.querySelector('#app .volver, #app [data-atras]:not([hidden]), #vista-seccion #a-perfil');
  if (boton) return Object.assign(() => boton.click(), { destino: boton.dataset.vuelveA || null });
  const padre = vista === 'resumen' && extra?.desde ? extra.desde : vista === 'cuestionario' ? (conPlan ? 'hoy' : 'inicio') : PADRE[vista];
  return padre ? Object.assign(() => ir(padre), { destino: padre }) : null;
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

/** La pantalla a la que se vuelve, debajo de la actual: una capa quieta con sus nodos, a la altura donde estaba. */
function armarCapa(foto) {
  const capa = document.createElement('div');
  capa.className = 'pantalla-anterior';
  capa.inert = true;
  capa.setAttribute('aria-hidden', 'true');
  const contenido = document.createElement('div');
  contenido.className = 'pantalla-anterior-contenido';
  const barra = document.querySelector('body > .barra');
  contenido.style.paddingTop = `${barra && getComputedStyle(barra).display !== 'none' ? barra.offsetHeight : 0}px`;
  const perfiles = document.getElementById('perfiles-prueba');
  if (perfiles && !perfiles.hidden) { const c = perfiles.cloneNode(true); c.removeAttribute('id'); contenido.append(c); }
  const main = document.createElement('main');
  main.append(...foto.nodos);
  const sombra = document.createElement('div');
  sombra.className = 'pantalla-anterior-sombra';
  contenido.append(main);
  capa.append(contenido, sombra);
  document.body.append(capa);
  document.body.classList.add('volviendo-atras');
  return { capa, contenido, sombra, y: foto.y };
}

/** El gesto: una burbuja con la flecha sigue al dedo y, pasado el umbral, se llena para indicar que vuelve. */
function instalarGesto(obtenerAccion) {
  const ua = navigator.userAgent; // un iPad se presenta como Mac con pantalla táctil
  const ios = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !/Android/.test(ua));
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (ios && !instalada) return; // en Safari, su propio gesto de atrás ya pasa por el historial
  const app = document.getElementById('app');
  const moviles = () => [document.getElementById('perfiles-prueba'), app].filter(el => el && !el.hidden);
  let inicio = null, activo = false, listo = false, burbuja = null, cuadro = 0, ultimo = null, capa = null;
  const SUAVE = 'cubic-bezier(.2,.7,.3,1)';
  const desfase = dx => -(1 - Math.min(1, dx / innerWidth)) * innerWidth * 0.3; // la de abajo entra más lento

  const pintar = () => {
    cuadro = 0;
    if (!burbuja || !ultimo) return;
    const avance = Math.min(1, ultimo.dx / UMBRAL);
    burbuja.style.transform = `translate3d(${-52 + avance * 66}px, ${ultimo.y}px, 0)`;
    burbuja.style.opacity = String(Math.min(1, avance * 1.6));
    burbuja.classList.toggle('listo', listo);
    if (capa) {
      moviles().forEach(el => { el.style.translate = `${ultimo.dx}px 0`; });
      capa.contenido.style.translate = `${desfase(ultimo.dx)}px ${-capa.y}px`;
      capa.sombra.style.opacity = String(1 - Math.min(1, ultimo.dx / innerWidth));
    } else if (!sinMovimiento()) app.style.translate = `${Math.min(18, ultimo.dx * 0.12)}px 0`;
  };
  const quitarCapa = () => {
    capa?.capa.remove(); capa = null;
    document.body.classList.remove('volviendo-atras');
    moviles().forEach(el => { el.style.translate = ''; });
  };
  // Mientras la pantalla se corre hacia el lado, la página no se ensancha (el teléfono la alejaría para mostrarla entera).
  const recortar = si => document.documentElement.classList.toggle('deslizando-atras', si);
  const terminar = volver => {
    const accion = volver ? inicio?.accion : null, dx = ultimo?.dx || 0;
    inicio = null; activo = false; listo = false; ultimo = null;
    if (cuadro) { cancelAnimationFrame(cuadro); cuadro = 0; }
    const b = burbuja; burbuja = null;
    if (b) {
      b.style.transition = 'transform .18s ease-in, opacity .18s ease-in';
      b.style.opacity = '0';
      b.style.transform = b.style.transform.replace(/translate3d\([^,]+/, 'translate3d(-52px');
      setTimeout(() => b.remove(), 200);
    }
    if (capa) {
      // La pantalla actual termina de salir hacia la derecha (o vuelve a su lugar) y recién entonces cambia.
      const c = capa, fin = accion ? innerWidth : 0, t = Math.round(120 + 140 * Math.abs(fin - dx) / innerWidth);
      const anims = moviles().map(el => el.animate([{ translate: `${dx}px 0` }, { translate: `${fin}px 0` }], { duration: t, easing: SUAVE, fill: 'forwards' }));
      c.contenido.animate([{ translate: `${desfase(dx)}px ${-c.y}px` }, { translate: `${desfase(fin)}px ${-c.y}px` }], { duration: t, easing: SUAVE, fill: 'forwards' });
      c.sombra.animate([{ opacity: 1 - dx / innerWidth }, { opacity: 1 - fin / innerWidth }], { duration: t, easing: SUAVE, fill: 'forwards' });
      const cerrar = () => {
        if (capa !== c) return;
        if (accion) { conGesto = true; try { accion(); } finally { conGesto = false; } }
        anims.forEach(a => a.cancel());
        quitarCapa();
        recortar(false);
      };
      anims[0] ? anims[0].finished.then(cerrar, cerrar) : cerrar();
      return;
    }
    if (accion) { app.style.translate = ''; recortar(false); accion(); return; }
    if (app.style.translate) {
      const desde = app.style.translate; app.style.translate = '';
      const a = sinMovimiento() ? null : app.animate([{ translate: desde }, { translate: '0 0' }], { duration: 180, easing: SUAVE });
      if (a) a.finished.then(() => recortar(false), () => recortar(false)); else recortar(false);
    } else recortar(false);
  };

  addEventListener('touchstart', ev => {
    if (ev.touches.length !== 1 || ev.touches[0].clientX > BORDE || capa) return;
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
      recortar(true);
      burbuja = document.createElement('div');
      burbuja.className = 'atras-gesto';
      burbuja.setAttribute('aria-hidden', 'true');
      burbuja.innerHTML = icono('flecha', 'icono flecha-atras');
      document.body.append(burbuja);
      // Debajo, la pantalla a la que se vuelve (si se sabe cuál es y sigue guardada).
      const foto = inicio.accion.destino && fotos.get(inicio.accion.destino);
      if (foto && !sinMovimiento() && foto.nodos.every(n => !n.isConnected)) capa = armarCapa(foto);
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
