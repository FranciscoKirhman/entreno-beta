// Hoja que sube desde abajo con opciones, como el "tipo de serie" de Hevy. Cada opción puede traer un botón "?" que
// despliega su explicación sin elegirla. Se cierra tocando afuera, con Escape o al elegir.
import { esc } from './comun.js';

let alCerrar = null;

export function cerrarHoja() {
  document.getElementById('hoja')?.remove();
  document.removeEventListener('keydown', teclaEscape);
  const f = alCerrar; alCerrar = null;
  f?.();
}
const teclaEscape = ev => { if (ev.key === 'Escape') cerrarHoja(); };

/**
 * @param titulo   texto de arriba
 * @param nota     explicación corta bajo el título (opcional)
 * @param opciones [{ valor, letra, imagen o icono (svg de iconos.js), clase, nombre, ayuda?, peligro? }]
 * @param alElegir (valor) => void
 * @param volver   foco a devolver al cerrar
 */
export function abrirHoja({ titulo, nota = '', opciones, alElegir, volver = null }) {
  cerrarHoja();
  const fondo = document.createElement('div');
  fondo.id = 'hoja';
  fondo.className = 'hoja-fondo';
  fondo.innerHTML = `<div class="hoja" role="dialog" aria-modal="true" aria-labelledby="hoja-titulo">
    <div class="asa" aria-hidden="true"></div>
    <h3 id="hoja-titulo">${esc(titulo)}</h3>
    ${nota ? `<p class="nota-hoja pequeno${nota.length > 90 ? ' larga' : ' suave'}">${esc(nota)}</p>` : ''}
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
    if (ev.target === fondo) return cerrarHoja();
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
