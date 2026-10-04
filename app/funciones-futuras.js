// Botones de funciones que llegarán después, puestos donde se van a usar (los datos y qué les falta están en
// nucleo/funciones-futuras.js). Al tocarlos avisan qué falta, sin fingir que funcionan ni guardar nada. Antes de
// explicarlo emiten un evento cancelable (solicitar-funcion o solicitar-conexion, como las conexiones de Más): un
// adaptador real podrá cancelarlo y abrir su autorización sin rehacer esta interfaz.
import { esc } from './comun.js';
import { icono } from './iconos.js';
import { FUNCIONES_FUTURAS, REQUISITOS, explicacion, eventoDe } from '../nucleo/funciones-futuras.js';

const idAviso = clave => `futura-${clave}`;

/**
 * El botón. forma: 'accion' (círculo con el nombre debajo, para una fila de acciones) o 'fila' (fila de una lista).
 * simbolo: nombre del ícono. El aviso va aparte (avisoFuturo) para ubicarlo bajo la fila de acciones.
 */
export function botonFuturo(clave, { forma = 'fila', simbolo = 'reloj' } = {}) {
  const f = FUNCIONES_FUTURAS[clave];
  if (!f) return '';
  const requisito = REQUISITOS[f.requiere[0]].etiqueta;
  const comun = `type="button" data-funcion-futura="${esc(clave)}" aria-expanded="false" aria-controls="${idAviso(clave)}" aria-describedby="${idAviso(clave)}-descripcion"`;
  const descripcion = `<span class="sr-only" id="${idAviso(clave)}-descripcion">${esc(`${f.descripcion} Todavía no está disponible.`)}</span>`;
  if (forma === 'accion') {
    return `<button ${comun} class="accion-ficha accion-futura">${icono(simbolo)}<span>${esc(f.nombre)}</span><small>${esc(requisito)}</small></button>${descripcion}`;
  }
  return `<button ${comun} class="fila-futura">${icono(simbolo)}<span class="fila-futura-texto"><strong>${esc(f.nombre)}</strong><small>${esc(f.descripcion)}</small><span class="chip">${esc(requisito)}</span></span></button>${descripcion}`;
}

/** El aviso que aparece al tocar el botón (se anuncia a los lectores de pantalla). */
export const avisoFuturo = clave => `<p class="aviso-futuro" id="${idAviso(clave)}" role="status" hidden></p>`;

/** Responde a los botones dentro de "raiz" (una sola vez por raíz). */
export function enlazarFuturos(raiz) {
  if (!raiz || raiz.dataset.futurosEnlazados) return;
  raiz.dataset.futurosEnlazados = '1';
  raiz.addEventListener('click', ev => {
    const boton = ev.target.closest('[data-funcion-futura]');
    if (!boton || !raiz.contains(boton)) return;
    const clave = boton.dataset.funcionFutura, e = eventoDe(clave);
    if (!boton.dispatchEvent(new CustomEvent(e.nombre, { bubbles: true, cancelable: true, detail: e.detail }))) return; // un adaptador se encarga
    const aviso = raiz.querySelector(`#${CSS.escape(idAviso(clave))}`);
    if (!aviso) return;
    aviso.hidden = !aviso.hidden;
    aviso.textContent = aviso.hidden ? '' : explicacion(clave);
    boton.setAttribute('aria-expanded', String(!aviso.hidden));
    boton.classList.toggle('activo', !aviso.hidden);
  });
}
