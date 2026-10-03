// Foto ilustrada del perfil, guardada en su propio ámbito local junto al resto del estado.
import { E, IMAGENES, esc } from './comun.js';
import { icono } from './iconos.js';

export const AVATARES_VISTA = [
  ['av01', 'Rulos'], ['av02', 'Barba corta'], ['av03', 'Pelo corto y lentes'], ['av04', 'Bigote'],
  ['av05', 'Pelo tomado'], ['av06', 'Barba'], ['av07', 'Pelo violeta'], ['av08', 'Pelo ondulado'],
  ['av09', 'Trenzas'], ['av10', 'Pañuelo'], ['av11', 'Lentes'], ['av12', 'Moño'],
  ['av13', 'Mancuerna'], ['av14', 'Zapatilla'], ['av15', 'Montaña'], ['av16', 'Pesa rusa'],
];
const disponibles = () => AVATARES_VISTA.filter(([id]) => IMAGENES.has(`img/avatares/${id}.webp`));
export const avatarValido = id => id === '' || disponibles().some(([v]) => id === v);
export const avatarActual = () => avatarValido(E.avatar) ? E.avatar : '';
export const nombreAvatar = () => AVATARES_VISTA.find(([id]) => id === avatarActual())?.[1] || 'Sin foto';

/** El símbolo de persona queda detrás de la foto y sirve de respaldo si no carga. */
export function imagenAvatar(id = avatarActual()) {
  const src = `img/avatares/${id}.webp`;
  return `<span class="avatar-retrato" aria-hidden="true">${icono('persona')}${IMAGENES.has(src) ? `<img class="avatar-foto" src="${src}" alt="" width="160" height="160" decoding="async" data-imagen-perfil>` : ''}</span>`;
}

export function elegirAvatares() {
  const opciones = disponibles();
  const actual = avatarActual();
  return `<div class="foto-perfil-actual">${imagenAvatar(actual)}<div><strong>${esc(nombreAvatar())}</strong><p class="pequeno suave">Esta foto queda en el perfil de este teléfono.</p></div></div>
    <details class="selector-avatar"><summary>Elegir foto de perfil</summary>
      <p class="pequeno suave">Elige un dibujo para representarte. Lo puedes cambiar cuando quieras.</p>
      ${opciones.length ? `<div class="grid-avatares" role="group" aria-label="Fotos de perfil">${opciones.map(([id, nombre]) => `<button type="button" class="tarjeta-avatar" data-avatar="${id}" aria-pressed="${actual === id}">${imagenAvatar(id)}<span>${esc(nombre)}</span></button>`).join('')}</div>` : '<p class="pequeno suave">Los dibujos no están disponibles. Puedes elegir uno cuando vuelvan a cargar.</p>'}
      <button type="button" class="boton avatar-sin-foto" data-avatar="" aria-pressed="${actual === ''}">Sin foto</button>
    </details>`;
}

/** Mantiene abierto el selector y devuelve el foco después de actualizar la foto. */
export function restaurarSelectorAvatar(raiz, id) {
  const selector = raiz.querySelector('.selector-avatar');
  if (!selector) return;
  selector.open = true;
  const elegido = selector.querySelector(`[data-avatar="${id}"]`) || selector.querySelector('summary');
  elegido?.focus({ preventScroll: true });
}
