// Anotar sin cerrar el teclado, como Hevy: "Siguiente" pasa de kilos a repeticiones y de ahí a la serie siguiente.
// En Android es la tecla de acción del teclado (enterkeyhint); el teclado numérico del iPhone no la trae, así que ahí
// aparece una barra con "Siguiente" pegada arriba del teclado mientras se escribe en una serie.
const CAMPOS = 'input[data-ej]:is([data-c="kg"], [data-c="reps"], [data-c="dist"], [data-c="seg"])';
let barra = null, raizActual = null;

const campos = raiz => [...raiz.querySelectorAll(CAMPOS)].filter(c => !c.disabled && c.offsetParent !== null);

/** El campo que sigue (kilos, repeticiones, la serie de abajo); null en el último. */
export function campoSiguiente(raiz, actual) {
  const lista = campos(raiz), i = lista.indexOf(actual);
  return i >= 0 ? lista[i + 1] || null : null;
}

function avanzar(actual) {
  const sig = campoSiguiente(raizActual, actual);
  if (!sig) { actual.blur(); return; }
  // Salir de las repeticiones puede marcar la serie y volver a dibujar la sesión: hoy.js deja el foco en el campo
  // equivalente del dibujo nuevo, que se busca por sus data-*.
  const selector = `input[data-ej="${CSS.escape(sig.dataset.ej)}"][data-i="${sig.dataset.i}"][data-c="${sig.dataset.c}"]`;
  sig.focus({ preventScroll: true });
  const nuevo = sig.isConnected ? sig : raizActual.querySelector(selector);
  if (nuevo && document.activeElement !== nuevo) nuevo.focus({ preventScroll: true });
  nuevo?.select?.();
  nuevo?.scrollIntoView({ block: 'nearest' });
}

const tactil = () => matchMedia('(pointer: coarse)').matches && 'visualViewport' in window;

function ubicar() {
  if (!barra || barra.hidden) return;
  const vv = visualViewport;
  barra.style.bottom = `${Math.max(0, innerHeight - (vv.offsetTop + vv.height))}px`;
}

function crearBarra() {
  barra = document.createElement('div');
  barra.className = 'barra-teclado';
  barra.hidden = true;
  barra.innerHTML = '<button type="button" data-teclado="siguiente">Siguiente</button>';
  // pointerdown sin acción por defecto: el campo no pierde el foco y el teclado no se cierra.
  barra.addEventListener('pointerdown', ev => ev.preventDefault());
  barra.addEventListener('click', ev => {
    const actual = document.activeElement;
    if (ev.target.closest('[data-teclado="siguiente"]') && actual?.matches?.(CAMPOS)) avanzar(actual);
  });
  document.body.append(barra);
  visualViewport.addEventListener('resize', ubicar);
  visualViewport.addEventListener('scroll', ubicar);
}

/** Se llama una vez por dibujo de la sesión, con el contenedor de las series. */
export function activarTecladoSeries(raiz) {
  raizActual = raiz;
  const lista = campos(raiz);
  lista.forEach((c, i) => c.setAttribute('enterkeyhint', i === lista.length - 1 ? 'done' : 'next'));
  if (raiz.dataset.teclado) return;
  raiz.dataset.teclado = '1';
  raiz.addEventListener('keydown', ev => {
    if (ev.key !== 'Enter' || ev.isComposing || !ev.target.matches?.(CAMPOS)) return;
    ev.preventDefault();
    avanzar(ev.target);
  });
  if (!tactil()) return;
  raiz.addEventListener('focusin', ev => {
    if (!ev.target.matches?.(CAMPOS)) return;
    if (!barra) crearBarra();
    barra.hidden = false;
    ubicar();
  });
  raiz.addEventListener('focusout', () => setTimeout(() => {
    if (barra && !document.activeElement?.matches?.(CAMPOS)) barra.hidden = true;
  }, 0));
}

// Al cerrar el teclado, el iPhone a veces deja corridos los elementos fijos de abajo (la barra del descanso queda
// flotando sobre el borde) hasta que la página se mueve. Un desplazamiento de un píxel, ida y vuelta, los reubica.
if (typeof visualViewport !== 'undefined' && typeof addEventListener === 'function') {
  let abierto = false;
  visualViewport.addEventListener('resize', () => {
    const ahora = innerHeight - visualViewport.height > 120;
    if (abierto && !ahora) requestAnimationFrame(() => { const y = scrollY; scrollTo(scrollX, y + 1); scrollTo(scrollX, y); });
    abierto = ahora;
  });
}
