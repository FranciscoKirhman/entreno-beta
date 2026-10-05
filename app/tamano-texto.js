// Safari usa el tamaño de lectura elegido en el iPhone. El resto de navegadores conserva la base de 17 px.
export function aplicarTamanoTexto() {
  const vista = document.getElementById('vista-hoy');
  if (!vista || !CSS.supports('font', '-apple-system-body')) return;
  const medida = document.createElement('span');
  medida.setAttribute('aria-hidden', 'true');
  medida.style.cssText = 'position:absolute;visibility:hidden;font:-apple-system-body';
  document.body.append(medida);
  const px = parseFloat(getComputedStyle(medida).fontSize);
  medida.remove();
  if (px > 0) vista.style.setProperty('--hoy-base', `${px}px`);
}
window.addEventListener('resize', aplicarTamanoTexto);
