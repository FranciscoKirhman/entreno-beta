let modoOrden = false;
// Mantener apretado el nombre entra al orden compacto. Arrastrar conserva las series por id.
export function enlazarOrdenArrastre(raiz, alGuardar) {
  const lista = raiz.querySelector('ul.lista-ej, ul.ejercicios-hoy, ul.ejercicios') || raiz.querySelector('.ej')?.parentElement;
  if (!lista) return;
  const cerrar=document.createElement('button');cerrar.type='button';cerrar.className='boton';cerrar.textContent='Terminar de ordenar';cerrar.hidden=!modoOrden;lista.before(cerrar);
  if(modoOrden)lista.classList.add('orden-compacto');
  cerrar.onclick=()=>{modoOrden=false;lista.classList.remove('orden-compacto');cerrar.hidden=true;};
  let reloj, activa = null, inicioY = 0, suprimir = false, ordenAntes = [];
  const terminar = async cancelar => {
    clearTimeout(reloj);
    if (!activa) return;
    const orden = [...lista.querySelectorAll(':scope > .ej')].map(e => e.dataset.ordenId);
    activa.classList.remove('arrastrada'); activa = null;
    if (cancelar) { ordenAntes.forEach(id => { const x = [...lista.children].find(e => e.dataset.ordenId === id); if (x) lista.append(x); }); return; }
    if (orden.join('|') !== ordenAntes.join('|')) await alGuardar(orden);
  };
  raiz.addEventListener('click', e => { if (suprimir) { e.preventDefault(); e.stopImmediatePropagation(); suprimir = false; } }, true);
  lista.querySelectorAll('.ej').forEach(card => {
    const cab = card.querySelector('.ej-textos'); if (!cab) return;
    cab.style.touchAction = 'none';
    cab.addEventListener('pointerdown', e => {
      if (e.button !== 0 || e.target.closest('button')) return;
      inicioY = e.clientY; ordenAntes = [...lista.querySelectorAll(':scope > .ej')].map(x => x.dataset.ordenId);
      const activar=()=>{modoOrden=true;cerrar.hidden=false;activa=card;suprimir=true;lista.classList.add('orden-compacto');card.classList.add('arrastrada');cab.setPointerCapture(e.pointerId);window.addEventListener('pointerup',()=>terminar(false),{once:true,capture:true});};
      if(modoOrden)activar();else reloj=setTimeout(activar,450);
    });
    cab.addEventListener('pointermove', e => {
      if (!activa) { if (Math.abs(e.clientY - inicioY) > 8) clearTimeout(reloj); return; }
      e.preventDefault();
      const otras = [...lista.querySelectorAll(':scope > .ej')].filter(x => x !== activa);
      const siguiente = otras.find(x => e.clientY < x.getBoundingClientRect().top + x.getBoundingClientRect().height / 2);
      if (siguiente) lista.insertBefore(activa, siguiente); else lista.append(activa);
      cab.setPointerCapture(e.pointerId);
      if (e.clientY < 100) window.scrollBy(0, -12); else if (e.clientY > innerHeight - 110) window.scrollBy(0, 12);
    });
    cab.addEventListener('pointercancel', () => terminar(true));
  });
}
