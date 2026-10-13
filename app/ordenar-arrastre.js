let modoOrden = false;
// Mantener apretado el nombre (0,45 s sin moverse) entra al orden compacto. Arrastrar conserva las series por id.
// En el iPhone, mantener apretado un texto lo selecciona y cancela el gesto: la cabecera no se puede seleccionar
// (estilo-hevy.css) y, ya activado, el movimiento no desplaza la página (touchmove sin acción por defecto).
// Antes de activarse, desplazar la página o soltar cancela la espera.
export function enlazarOrdenArrastre(raiz, alGuardar) {
  const lista = raiz.querySelector('ul.lista-ej, ul.ejercicios-hoy, ul.ejercicios') || raiz.querySelector('.ej')?.parentElement;
  if (!lista) return;
  const cerrar = document.createElement('button'); cerrar.type = 'button'; cerrar.className = 'boton'; cerrar.textContent = 'Terminar de ordenar'; cerrar.hidden = !modoOrden; lista.before(cerrar);
  if (modoOrden) lista.classList.add('orden-compacto');
  cerrar.onclick = () => { modoOrden = false; lista.classList.remove('orden-compacto'); cerrar.hidden = true; };
  let reloj = null, activa = null, puntero = null, inicioY = 0, suprimir = false, ordenAntes = [];
  const esperar = () => { clearTimeout(reloj); reloj = null; };
  const terminar = async cancelar => {
    esperar();
    if (!activa) return;
    const cab = activa.querySelector('.ej-textos');
    try { if (puntero != null) cab?.releasePointerCapture(puntero); } catch { /* ya liberado */ }
    const orden = [...lista.querySelectorAll(':scope > .ej')].map(e => e.dataset.ordenId);
    activa.classList.remove('arrastrada'); activa = null; puntero = null;
    if (cancelar) { ordenAntes.forEach(id => { const x = [...lista.children].find(e => e.dataset.ordenId === id); if (x) lista.append(x); }); return; }
    if (orden.join('|') !== ordenAntes.join('|')) await alGuardar(orden);
  };
  const mover = y => {
    const otras = [...lista.querySelectorAll(':scope > .ej')].filter(x => x !== activa);
    const siguiente = otras.find(x => y < x.getBoundingClientRect().top + x.getBoundingClientRect().height / 2);
    if (siguiente) { if (activa.nextElementSibling !== siguiente) lista.insertBefore(activa, siguiente); } else if (lista.lastElementChild !== activa) lista.append(activa);
    if (y < 100) window.scrollBy(0, -12); else if (y > innerHeight - 110) window.scrollBy(0, 12);
  };
  raiz.addEventListener('click', e => { if (suprimir) { e.preventDefault(); e.stopImmediatePropagation(); suprimir = false; } }, true);
  lista.querySelectorAll('.ej').forEach(card => {
    const cab = card.querySelector('.ej-textos'); if (!cab) return;
    const activar = id => {
      reloj = null; modoOrden = true; cerrar.hidden = false; activa = card; puntero = id; suprimir = true;
      lista.classList.add('orden-compacto'); card.classList.add('arrastrada');
      try { cab.setPointerCapture(id); } catch { /* el puntero ya se soltó */ }
      navigator.vibrate?.(10);
    };
    cab.addEventListener('contextmenu', e => e.preventDefault());
    cab.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button')) return;
      inicioY = e.clientY; ordenAntes = [...lista.querySelectorAll(':scope > .ej')].map(x => x.dataset.ordenId);
      esperar();
      if (modoOrden) activar(e.pointerId); else reloj = setTimeout(() => activar(e.pointerId), 450);
    });
    cab.addEventListener('pointermove', e => {
      if (!activa) { if (reloj && Math.abs(e.clientY - inicioY) > 8) esperar(); return; }
      e.preventDefault();
      mover(e.clientY);
    });
    // Ya activado, el dedo mueve el ejercicio y no la página.
    cab.addEventListener('touchmove', e => { if (activa === card) e.preventDefault(); }, { passive: false });
    cab.addEventListener('pointerup', () => (activa ? terminar(false) : esperar()));
    cab.addEventListener('pointercancel', () => (activa ? terminar(true) : esperar()));
    cab.addEventListener('lostpointercapture', () => { if (activa === card) terminar(false); });
  });
}
