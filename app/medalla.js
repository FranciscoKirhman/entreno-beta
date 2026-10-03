// Medalla de récord: al marcar una serie que es récord aparece la medalla de ese tipo sobre el menú, con el texto del
// récord. Entra subiendo, da un salto corto y se va sola a los 2,5 s o al tocarla. No tapa la tabla de series.
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
  el.innerHTML = `${IMAGENES.has(src) ? `<img class="medalla-img" src="${src}" alt="" width="64" height="64" decoding="async">` : ''}
    <div class="medalla-texto"><strong>¡Récord!</strong><span>${esc(nombre)}: ${esc(records.map(x => textoRecord(x, { corto: true })).join(', '))}.</span></div>`;
  el.onclick = () => quitar(el);
  document.body.append(el);
  requestAnimationFrame(() => {
    el.classList.add('visible');
    if (!sinMovimiento()) el.querySelector('.medalla-img')?.animate(
      [{ translate: '0 0' }, { translate: '0 -12px', offset: 0.35 }, { translate: '0 0', offset: 0.7 }, { translate: '0 -4px', offset: 0.85 }, { translate: '0 0' }],
      { duration: 600, delay: 120, easing: 'cubic-bezier(.2,.7,.3,1)' });
  });
  navigator.vibrate?.(15);
  cierre = setTimeout(() => quitar(el), 2600);
}
