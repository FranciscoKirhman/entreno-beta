// Hoja que sube desde abajo con opciones, como el "tipo de serie" de Hevy. Cada opción puede traer un botón "?" que
// despliega su explicación sin elegirla. Se cierra tocando afuera, con Escape o al elegir.
import { esc } from './comun.js';
import { sinMovimiento } from './movimiento.js';

let alCerrar = null;

/** Cierra la hoja abierta. Baja antes de retirarse; mientras baja ya no es "la hoja" (sin id) y no recibe toques,
 *  así una opción no se confirma dos veces y lo elegido se aplica de inmediato, sin esperar la animación. */
export function cerrarHoja() {
  const fondo = document.getElementById('hoja');
  document.removeEventListener('keydown', teclaEscape);
  const f = alCerrar; alCerrar = null;
  if (fondo) {
    fondo.removeAttribute('id');
    fondo.inert = true;
    fondo.classList.add('cerrando');
    fondo.classList.remove('abierta');
    if (sinMovimiento()) fondo.remove(); else setTimeout(() => fondo.remove(), 240);
  }
  f?.();
}
const teclaEscape = ev => { if (ev.key === 'Escape') cerrarHoja(); };

/**
 * @param titulo   texto de arriba
 * @param nota     explicación corta bajo el título (opcional)
 * @param notaOculta la explicación queda detrás de un "?" junto al título
 * @param contenido HTML ya escapado que va entre la nota y las opciones (por ejemplo, el dibujo de los discos)
 * @param opciones [{ valor, letra, imagen o icono (svg de iconos.js), clase, nombre, ayuda?, peligro? }]
 * @param alElegir (valor) => void
 * @param volver   foco a devolver al cerrar
 */
export function abrirHoja({ titulo, nota = '', notaOculta = false, contenido = '', opciones, alElegir, volver = null }) {
  cerrarHoja();
  const fondo = document.createElement('div');
  fondo.id = 'hoja';
  fondo.className = 'hoja-fondo';
  fondo.innerHTML = `<div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-titulo">
    <div class="asa" aria-hidden="true"></div>
    <h3 id="hoja-titulo">${esc(titulo)}${nota && notaOculta ? ' <button type="button" class="ayuda ayuda-titulo" data-ayuda-titulo aria-expanded="false" aria-label="¿Qué es?">?</button>' : ''}</h3>
    ${nota ? `<p class="nota-hoja pequeno${nota.length > 90 && !notaOculta ? ' larga' : ' suave'}"${notaOculta ? ' hidden' : ''}>${esc(nota)}</p>` : ''}
    ${contenido}
    <ul class="opciones-hoja">${opciones.map(o => `<li>
      <div class="opcion-hoja">
        <button type="button" class="elegir${o.peligro ? ' peligro' : ''}" data-elegir="${esc(o.valor)}">${o.imagen ? `<img class="imagen-opcion" src="${esc(o.imagen)}" alt="" width="64" height="64">` : o.icono ? `<span class="letra icono-hoja ${esc(o.clase || '')}">${o.icono}</span>` : `<span class="letra ${esc(o.clase || '')}">${esc(o.letra)}</span>`}${esc(o.nombre)}</button>
        ${o.ayuda ? `<button type="button" class="ayuda" data-ayuda="${esc(o.valor)}" aria-expanded="false" aria-label="¿Qué es ${esc(o.nombre.toLowerCase())}?">?</button>` : ''}
      </div>
      ${o.ayuda ? `<p class="explicacion pequeno" data-explica="${esc(o.valor)}" hidden>${esc(o.ayuda)}</p>` : ''}
    </li>`).join('')}</ul>
  </div>`;
  document.body.append(fondo);
  alCerrar = volver ? () => volver.focus?.() : null;
  fondo.addEventListener('click', ev => {
    if (fondo.classList.contains('cerrando')) return; // ya se eligió: un segundo toque no confirma de nuevo
    if (ev.target === fondo) return cerrarHoja();
    const ayudaTitulo = ev.target.closest('[data-ayuda-titulo]');
    if (ayudaTitulo) {
      const p = fondo.querySelector('.nota-hoja');
      p.hidden = !p.hidden;
      ayudaTitulo.setAttribute('aria-expanded', String(!p.hidden));
      return;
    }
    const ayuda = ev.target.closest('[data-ayuda]');
    if (ayuda) {
      const p = fondo.querySelector(`[data-explica="${CSS.escape(ayuda.dataset.ayuda)}"]`);
      p.hidden = !p.hidden;
      ayuda.setAttribute('aria-expanded', String(!p.hidden));
      return;
    }
    const elegir = ev.target.closest('[data-elegir]');
    if (elegir) { const v = elegir.dataset.elegir; alCerrar = null; cerrarHoja(); alElegir(v); }
  });
  document.addEventListener('keydown', teclaEscape);
  requestAnimationFrame(() => { fondo.classList.add('abierta'); fondo.querySelector('.elegir')?.focus(); });
}
