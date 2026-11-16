// Medalla de récord: al marcar una serie que es récord aparece la medalla de ese tipo sobre el menú, con el texto del
// récord, en una píldora arriba (como Hevy). Entra bajando, da un salto corto y se va sola a los 2 s o al tocarla.
import { esc, IMAGENES } from './comun.js';
import { srcInsignia, textoRecord } from './resumen.js';
import { sinMovimiento } from './movimiento.js';

let cierre = null;

function quitar(el) {
  clearTimeout(cierre);
  if (!el?.isConnected) return;
  el.classList.remove('visible');
  setTimeout(() => el.remove(), sinMovimiento() ? 0 : 220);
}

/** records: los de la serie recién marcada (recordsDeSerie); nombre: el del ejercicio. */
export function mostrarMedalla(records, nombre) {
  if (!records?.length) return;
  quitar(document.getElementById('medalla-record'));
  const src = srcInsignia(records[0].tipo);
  const el = document.createElement('div');
  el.id = 'medalla-record';
  el.className = 'medalla-record';
  el.setAttribute('role', 'status');
  // Como Hevy: una píldora chica arriba, bajo la cabecera, que no tapa las series. El detalle queda en el resumen.
  el.innerHTML = `${IMAGENES.has(src) ? `<img class="medalla-img" src="${src}" alt="" width="28" height="28" decoding="async">` : ''}
    <div class="medalla-texto"><strong>Récord</strong><span>${esc(nombre)}: ${esc(textoRecord(records[0], { corto: true }))}${records.length > 1 ? ` y ${records.length - 1} más` : ''}</span></div>`;
  el.onclick = () => quitar(el);
  document.body.append(el);
  requestAnimationFrame(() => {
    el.classList.add('visible');
    if (!sinMovimiento()) el.querySelector('.medalla-img')?.animate(
      // Llega en arco desde la izquierda, girando, se pasa un poco y se asienta.
      [{ translate: '-22px 8px', rotate: '-26deg', scale: '.7' }, { translate: '-7px -12px', rotate: '-8deg', scale: '1.12', offset: 0.42 }, { translate: '0 0', rotate: '3deg', scale: '1', offset: 0.72 }, { translate: '0 -3px', rotate: '0deg', offset: 0.86 }, { translate: '0 0', rotate: '0deg' }],
      { duration: 560, delay: 60, easing: 'cubic-bezier(.2,.7,.3,1)' });
  });
  navigator.vibrate?.(15);
  cierre = setTimeout(() => quitar(el), 2200);
}
