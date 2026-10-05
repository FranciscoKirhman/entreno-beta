// Mantiene el teclado y el lector de pantalla dentro de la pantalla abierta. El cronómetro sigue disponible.
export function protegerDialogo(dialogo) {
  if (!dialogo) return null;
  const cambiados = new Map();
  const permitidos = new Set(['descanso', 'aviso-flotante', 'hoja']);
  const proteger = () => {
    if (!dialogo.isConnected) return liberar();
    let rama = dialogo;
    while (rama.parentElement) {
      for (const vecino of rama.parentElement.children) {
        if (vecino === rama || permitidos.has(vecino.id) || cambiados.has(vecino)) continue;
        cambiados.set(vecino, vecino.inert);
        vecino.inert = true;
      }
      rama = rama.parentElement;
      if (rama === document.body) break;
    }
  };
  const teclado = ev => {
    if (ev.key !== 'Tab') return;
    const hoja = document.getElementById('hoja');
    const raices = hoja ? [hoja] : [dialogo, document.getElementById('descanso')].filter(Boolean);
    const botones = raices.flatMap(r => [...r.querySelectorAll('button, input, select, textarea, a[href], [tabindex]')])
      .filter(e => !e.disabled && e.tabIndex >= 0 && e.getClientRects().length && !e.closest('[inert]'));
    if (!botones.length) { ev.preventDefault(); return; }
    const i = botones.indexOf(document.activeElement);
    if (i < 0 || (!ev.shiftKey && i === botones.length - 1) || (ev.shiftKey && i === 0)) {
      ev.preventDefault(); (ev.shiftKey ? botones.at(-1) : botones[0]).focus();
    }
  };
  const observador = new MutationObserver(proteger);
  function liberar() {
    observador.disconnect();
    document.removeEventListener('keydown', teclado, true);
    for (const [el, anterior] of cambiados) el.inert = anterior;
    cambiados.clear();
  }
  proteger();
  observador.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('keydown', teclado, true);
  return liberar;
}
