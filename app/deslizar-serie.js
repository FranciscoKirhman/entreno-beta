// Un gesto horizontal descubre Quitar; mover hacia arriba o abajo sigue desplazando la lista.
export function enlazarDeslizarSeries(raiz, quitar) {
  let abierta = null;
  const mostrar = (caja, valor) => {
    caja.classList.toggle('deslizada', valor);
    caja.querySelector('.serie').style.transform = '';
    const boton = caja.querySelector('[data-quitar-serie]');
    boton.hidden = !valor;
    boton.tabIndex = valor ? 0 : -1;
    abierta = valor ? caja : null;
  };
  raiz.querySelectorAll('.serie-contenedor').forEach(caja => {
    const fila = caja.querySelector('.serie');
    let gesto = null;
    fila.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      if (abierta && abierta !== caja) mostrar(abierta, false);
      gesto = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, activa: false, antes: caja.classList.contains('deslizada'), dx: 0 };
    });
    fila.addEventListener('pointermove', ev => {
      if (!gesto || ev.pointerId !== gesto.id) return;
      const dx = ev.clientX - gesto.x, dy = ev.clientY - gesto.y;
      if (!gesto.activa) {
        if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) { gesto = null; return; }
        if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy)) return;
        gesto.activa = true;
        fila.setPointerCapture(ev.pointerId);
        caja.classList.add('arrastrando');
      }
      ev.preventDefault();
      gesto.dx = dx;
      fila.style.transform = `translateX(${Math.max(-80, Math.min(0, (gesto.antes ? -80 : 0) + dx))}px)`;
      caja.querySelector('[data-quitar-serie]').hidden = false;
    });
    const terminar = (ev, cancelar = false) => {
      if (!gesto || ev.pointerId !== gesto.id) return;
      const g = gesto; gesto = null;
      caja.classList.remove('arrastrando');
      if (g.activa) {
        mostrar(caja, cancelar ? g.antes : g.antes ? g.dx < 36 : g.dx < -36);
        caja.dataset.evitarClick = 'true';
        setTimeout(() => delete caja.dataset.evitarClick, 0);
      }
    };
    fila.addEventListener('pointerup', ev => terminar(ev));
    fila.addEventListener('pointercancel', ev => terminar(ev, true));
    fila.addEventListener('click', ev => {
      if (caja.dataset.evitarClick || caja.classList.contains('deslizada')) {
        ev.preventDefault(); ev.stopImmediatePropagation();
        if (caja.classList.contains('deslizada') && !caja.dataset.evitarClick) mostrar(caja, false);
      }
    }, true);
    caja.querySelector('[data-quitar-serie]').onclick = ev => quitar(ev.currentTarget.dataset.quitarSerie, Number(ev.currentTarget.dataset.i));
  });
}
