// Movimiento breve, siempre opcional: si la persona pidió reducir movimiento en su sistema, nada se anima. Solo
// opacidad y desplazamientos cortos: nunca se agranda ni se deforma un dibujo, y nada se repite en bucle.
const reducir = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: true };
export const sinMovimiento = () => reducir.matches;
const SUAVE = 'cubic-bezier(.2,.7,.3,1)';

function animar(el, cuadros, opciones) {
  if (!el?.animate || sinMovimiento()) return null;
  return el.animate(cuadros, { easing: SUAVE, ...opciones });
}

/** Paso nuevo con el teclado: el foco va a su título, para que se lea qué cambió. */
export function enfocarTitulo(raiz) {
  const h = raiz?.querySelector('h1, h2');
  if (!h) return;
  h.tabIndex = -1;
  h.focus({ preventScroll: true });
}

/** Entrada de una vista nueva: aparece y sube 6 px. Al volver atrás, entra desde la izquierda. */
export const entrarVista = (el, vuelta = false) => animar(el, [{ opacity: 0, translate: vuelta ? '-14px 0' : '0 6px' }, { opacity: 1, translate: '0 0' }], { duration: vuelta ? 200 : 180 });

/** Cambio de paso del cuestionario: entra desde el lado hacia donde se avanza (1) o se retrocede (-1). */
export const entrarPaso = (el, direccion = 1) => animar(el, [{ opacity: 0, translate: `${direccion * 14}px 0` }, { opacity: 1, translate: '0 0' }], { duration: 200 });

/** Entrada escalonada de varias piezas (la portada y las opciones del inicio): una tras otra, cada 60 ms. */
export function entrarEnOrden(elementos, { paso = 60, desde = 40 } = {}) {
  [...elementos].filter(Boolean).forEach((el, i) => animar(el, [{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }],
    { duration: 240, delay: desde + i * paso, fill: 'backwards' }));
}

/** Entrada breve de una pose del asistente (al aparecer o al cambiar de pose). */
export const entrarPose = el => animar(el, [{ opacity: 0, translate: '0 4px' }, { opacity: 1, translate: '0 0' }], { duration: 200 });

/** Celebración de una sola vez: la tarjeta aparece y el dibujo da un salto corto, sin cambiar de tamaño. */
export function celebrar(tarjeta, personaje) {
  animar(tarjeta, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 260 });
  animar(personaje, [{ translate: '0 0' }, { translate: '0 -10px', offset: 0.35 }, { translate: '0 0', offset: 0.7 }, { translate: '0 -4px', offset: 0.85 }, { translate: '0 0' }],
    { duration: 600, delay: 60 }); // en total, menos de 700 ms
}

const ESTILO = ['backgroundColor', 'borderColor', 'boxShadow', 'color'];
const estiloDe = el => { const c = getComputedStyle(el); return Object.fromEntries(ESTILO.map(k => [k, c[k]])); };

/** Selector para reencontrar un control después de repintar: su id, su nombre y valor, o sus atributos data-*. */
function selectorDe(el) {
  if (!el || el === document.body || !el.tagName) return null;
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.tagName === 'INPUT' && el.name) return `input[name="${CSS.escape(el.name)}"]${['radio', 'checkbox'].includes(el.type) ? `[value="${CSS.escape(el.value)}"]` : ''}`;
  // Las casillas de una misma lista comparten sus data-* y se distinguen por su valor.
  const datos = [...el.attributes].filter(a => a.name.startsWith('data-') || (a.name === 'value' && ['radio', 'checkbox'].includes(el.type)));
  return datos.length ? el.tagName.toLowerCase() + datos.map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') : null;
}

/**
 * Repinta una vista sin mover la pantalla ni perder el foco del teclado. Si se indica el control tocado, su borde y
 * su fondo pasan del estado anterior al nuevo en 140 ms (solo color: nada cambia de tamaño ni empuja a los demás).
 */
export function repintarConservando(pintar, tocado = null) {
  const y = scrollY, enfocado = document.activeElement;
  const selector = selectorDe(tocado), selectorFoco = selectorDe(enfocado);
  const visible = el => el.closest('label') || el; // una casilla se ve en su etiqueta
  const antes = tocado?.isConnected ? estiloDe(visible(tocado)) : null;
  pintar();
  scrollTo(0, y);
  const foco = selectorFoco && document.querySelector(selectorFoco);
  if (foco && foco !== document.activeElement) foco.focus({ preventScroll: true });
  const nuevo = selector && document.querySelector(selector);
  if (nuevo && antes) {
    const despues = estiloDe(visible(nuevo));
    if (ESTILO.some(k => antes[k] !== despues[k])) animar(visible(nuevo), [antes, despues], { duration: 140, easing: 'ease-out' });
  }
  return nuevo;
}
