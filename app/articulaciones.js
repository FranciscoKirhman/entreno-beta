// Imágenes decorativas de las articulaciones. El nombre de la zona siempre se muestra por separado.
import { IMAGENES, esc } from './comun.js';

export const srcArticulacion = id => {
  const src = `img/articulaciones/${id}.webp`;
  return IMAGENES.has(src) ? src : null;
};

export function imagenArticulacion(id, clase = 'img-articulacion') {
  const src = srcArticulacion(id);
  return src ? `<img class="${esc(clase)}" src="${src}" alt="" width="160" height="160" decoding="async" data-imagen-perfil>` : '';
}

/** Conserva el nombre y la selección cuando una imagen no se puede cargar. */
export function cuidarImagenesPerfil(raiz) {
  raiz.addEventListener('error', ev => {
    if (ev.target.matches?.('img[data-imagen-perfil]')) ev.target.remove();
  }, true);
}
