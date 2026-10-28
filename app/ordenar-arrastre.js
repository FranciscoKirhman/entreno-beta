// Ordenar la sesión como en Hevy: mantener apretada la tarjeta de un ejercicio (su foto, su nombre o el espacio
// alrededor; 0,4 s casi sin moverse) encoge todos a su foto y su nombre. La fila apretada queda levantada bajo el dedo y las demás se corren para hacerle
// lugar; al soltar cae en su lugar, vuelven las series y se guarda el orden de hoy. Es un solo gesto: no hay un modo de
// ordenar que cerrar después. Las series siguen a su ejercicio por id.
// En el iPhone el dedo se sigue con touch*: pointer* se cancela apenas Safari empieza a desplazar la página. El touchmove
// no pasivo está puesto antes del toque (Safari decide al tocar si podrá frenar el desplazamiento) y solo frena la
// página ya levantada la fila: antes, mover el dedo es desplazar y cancela la espera. Con mouse, lo mismo por pointer*.
const ESPERA = 400, HOLGURA = 8, CAIDA = 180, ESCALA = 1.03;

// Escape o irse a otra app a medio arrastre: todo vuelve como estaba. Se escucha una vez; Hoy se repinta seguido.
let cancelarActual = null;
if (typeof document !== 'undefined') {
  addEventListener('keydown', e => { if (e.key === 'Escape') cancelarActual?.(); });
  document.addEventListener('visibilitychange', () => cancelarActual?.());
}

export function enlazarOrdenArrastre(raiz, alGuardar) {
  const lista = raiz.querySelector('.ejercicios-hoy');
  const tarjetas = () => [...lista.querySelectorAll(':scope > .ej')];
  if (!lista || tarjetas().length < 2) return;
  let espera = null, a = null, cayendo = false;
  const dejarDeEsperar = () => { clearTimeout(espera?.reloj); espera = null; };
  const techo = () => (raiz.querySelector('.cab-sesion')?.getBoundingClientRect().bottom ?? 0);

  function esperar(tarjeta, x, y, dedo, mouse) {
    dejarDeEsperar();
    espera = { tarjeta, x, y, dedo, mouse };
    espera.reloj = setTimeout(() => { const e = espera; espera = null; levantar(e); }, ESPERA);
  }

  function levantar({ tarjeta, y, dedo, mouse }) {
    if (!tarjeta.isConnected) return;
    const filas = tarjetas(), i0 = filas.indexOf(tarjeta), antes = scrollY;
    raiz.classList.add('reordenando'); tarjeta.classList.add('levantada');
    navigator.vibrate?.(10);
    // La fila apretada queda bajo el dedo: se desplaza la página y, si arriba no alcanza, la lista baja con aire encima
    // (como Hevy). Debajo de la lista hay una pantalla de aire (estilo-hevy.css) para poder subirla cuando hace falta.
    const r = tarjeta.getBoundingClientRect(), falta = y - r.height / 2 - r.top;
    if (falta > 0) {
      const sube = Math.min(falta, scrollY);
      scrollTo(0, scrollY - sube);
      if (falta - sube > 0.5) lista.style.marginTop = `${(parseFloat(getComputedStyle(lista).marginTop) || 0) + falta - sube}px`;
    } else if (falta < 0) scrollTo(0, scrollY - falta);
    const sy = scrollY, cajas = filas.map(x => x.getBoundingClientRect());
    const arriba = cajas.map(c => c.top + sy), alto = cajas.map(c => c.height);
    const aire = arriba.map((t, k) => (k + 1 < arriba.length ? arriba[k + 1] - t - alto[k] : 0));
    a = { filas, i0, tarjeta, dedo, mouse, antes, arriba, alto, aire, desde: y + sy, y, lugar: i0, orden: filas.map((_, k) => k), destino: [...arriba] };
    tarjeta.style.transform = `scale(${ESCALA})`;
    a.rodando = requestAnimationFrame(rodar);
  }

  function mover(y) {
    a.y = y;
    const dy = y + scrollY - a.desde;
    a.tarjeta.style.transform = `translateY(${dy}px) scale(${ESCALA})`;
    // Una fila de abajo sube cuando el centro de la levantada pasa su borde de arriba; una de arriba baja cuando pasa
    // su borde de abajo. Así cambia de lugar a media fila, no al cruzarla entera.
    const centro = a.arriba[a.i0] + a.alto[a.i0] / 2 + dy;
    let lugar = 0;
    a.filas.forEach((_, k) => { if (k !== a.i0 && centro > a.arriba[k] + (k < a.i0 ? a.alto[k] : 0)) lugar++; });
    if (lugar === a.lugar) return;
    a.lugar = lugar;
    const otras = a.filas.map((_, k) => k).filter(k => k !== a.i0);
    a.orden = [...otras.slice(0, lugar), a.i0, ...otras.slice(lugar)];
    let top = a.arriba[0];
    a.orden.forEach((k, pos) => { a.destino[k] = top; top += a.alto[k] + a.aire[pos]; });
    a.filas.forEach((x, k) => { if (k !== a.i0) x.style.transform = a.destino[k] === a.arriba[k] ? '' : `translateY(${a.destino[k] - a.arriba[k]}px)`; });
  }

  // Con el dedo quieto cerca del borde de arriba o de abajo, la página se desplaza sola (solo si quedan filas ocultas).
  function rodar() {
    if (!a) return;
    const arribaVisible = techo() + 40, abajoVisible = innerHeight - 96;
    let v = a.y < arribaVisible ? -Math.min(14, 2 + (arribaVisible - a.y) / 4) : a.y > abajoVisible ? Math.min(14, 2 + (a.y - abajoVisible) / 4) : 0;
    if (v < 0 && a.arriba[0] - scrollY >= techo()) v = 0;
    if (v > 0 && a.arriba.at(-1) + a.alto.at(-1) - scrollY <= abajoVisible) v = 0;
    if (v) { scrollBy(0, v); mover(a.y); }
    a.rodando = requestAnimationFrame(rodar);
  }

  function soltar() {
    const g = a; a = null;
    cancelAnimationFrame(g.rodando);
    cayendo = true;
    g.tarjeta.style.transition = `transform ${CAIDA}ms ease`;
    g.tarjeta.style.transform = `translateY(${g.destino[g.i0] - g.arriba[g.i0]}px)`;
    setTimeout(() => terminar(g, false), CAIDA);
  }

  function cancelar() {
    const g = a; a = null;
    cancelAnimationFrame(g.rodando);
    terminar(g, true);
  }

  function terminar(g, cancelado) {
    cayendo = false;
    const cambio = !cancelado && g.orden.some((k, i) => k !== i);
    const enPantalla = g.destino[g.i0] - scrollY;
    if (cambio) g.orden.forEach(k => lista.append(g.filas[k]));
    g.filas.forEach(x => { x.style.transform = ''; x.style.transition = ''; });
    g.tarjeta.classList.remove('levantada');
    raiz.classList.remove('reordenando');
    lista.style.marginTop = '';
    if (!cambio) { scrollTo(0, g.antes); return; }
    // La tarjeta completa queda donde soltaste la fila, sin esconderse bajo la cabecera ni quedar muy abajo.
    const donde = Math.min(Math.max(enPantalla, techo() + 8), innerHeight * 0.45);
    scrollTo(0, scrollY + g.tarjeta.getBoundingClientRect().top - donde);
    alGuardar(g.orden.map(k => g.filas[k].dataset.ordenId));
  }

  // Al soltar con mouse, el clic que sigue no abre la ficha ni el menú.
  const tragarClic = () => {
    const fn = e => { e.preventDefault(); e.stopImmediatePropagation(); };
    addEventListener('click', fn, { capture: true, once: true });
    setTimeout(() => removeEventListener('click', fn, { capture: true }), 400);
  };
  const alMoverMouse = e => {
    if (a?.mouse && e.pointerId === a.dedo) { e.preventDefault(); mover(e.clientY); }
    else if (espera?.mouse && e.pointerId === espera.dedo && Math.hypot(e.clientX - espera.x, e.clientY - espera.y) > HOLGURA) dejarDeEsperar();
  };
  const alSoltarMouse = e => {
    if (a?.mouse && e.pointerId === a.dedo) { tragarClic(); e.type === 'pointercancel' ? cancelar() : soltar(); }
    else if (espera?.mouse) dejarDeEsperar();
    if (!a) { removeEventListener('pointermove', alMoverMouse); removeEventListener('pointerup', alSoltarMouse); removeEventListener('pointercancel', alSoltarMouse); }
  };
  cancelarActual = () => { dejarDeEsperar(); if (a) cancelar(); };

  // Se ordena manteniendo apretada la tarjeta: su foto, su nombre o el espacio alrededor, no solo el texto (Francisco,
  // 28 de octubre de 2026: "se hace difícil mover los ejercicios"). Lo que se escribe o se toca sigue siendo lo suyo: los
  // campos, la tabla de series, el ⋯, la nota fija y los demás botones. La foto sí: un toque abre la ficha, mantenerla
  // ordena. Se escucha en la lista, así cada tarjeta entera sirve.
  const NO_SIRVE = 'input, textarea, select, a, .tabla-series, .fila-agregar, .menu-ej, .nota-fija, button:not(.ej-abrir)';
  const tarjetaDe = t => {
    const x = t?.closest?.('.ej');
    return x?.parentElement === lista && !t.closest(NO_SIRVE) ? x : null;
  };
  const delDedo = (ev, id) => [...ev.changedTouches].find(t => t.identifier === id);
  lista.addEventListener('touchstart', ev => {
    const tarjeta = tarjetaDe(ev.target);
    if (a || cayendo || ev.touches.length > 1 || !tarjeta) { dejarDeEsperar(); return; }
    const t = ev.changedTouches[0];
    esperar(tarjeta, t.clientX, t.clientY, t.identifier, false);
  }, { passive: true });
  lista.addEventListener('touchmove', ev => {
    if (a && !a.mouse) { const t = delDedo(ev, a.dedo); if (t) { ev.preventDefault(); mover(t.clientY); } return; }
    const t = espera && !espera.mouse && delDedo(ev, espera.dedo);
    if (t && Math.hypot(t.clientX - espera.x, t.clientY - espera.y) > HOLGURA) dejarDeEsperar();
  }, { passive: false });
  // Ya levantada, soltar no es un toque: ni abre la ficha ni marca nada.
  lista.addEventListener('touchend', ev => {
    if (a && !a.mouse && delDedo(ev, a.dedo)) { ev.preventDefault(); soltar(); } else dejarDeEsperar();
  }, { passive: false });
  lista.addEventListener('touchcancel', () => { if (a && !a.mouse) cancelar(); else dejarDeEsperar(); });
  lista.addEventListener('pointerdown', ev => {
    const tarjeta = tarjetaDe(ev.target);
    if (ev.pointerType === 'touch' || ev.button !== 0 || a || cayendo || !tarjeta) return;
    esperar(tarjeta, ev.clientX, ev.clientY, ev.pointerId, true);
    addEventListener('pointermove', alMoverMouse); addEventListener('pointerup', alSoltarMouse); addEventListener('pointercancel', alSoltarMouse);
  });
  lista.addEventListener('contextmenu', ev => { if (tarjetaDe(ev.target)) ev.preventDefault(); });
  lista.addEventListener('dragstart', ev => { if (tarjetaDe(ev.target)) ev.preventDefault(); });
}
