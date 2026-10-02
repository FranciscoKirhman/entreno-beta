import { C, indice, esc, $, ctxNucleo } from './comun.js';
import { buscarEjercicios, motivoNoAgregar } from '../nucleo/editar-sesion.js';
import { miniatura } from './imagenes.js';
import { NOMBRE_MUSCULO, mayuscula } from './musculos.js';
import { icono } from './iconos.js';
import { proponerEdicion } from './editar-sesion-ui.js';
import { elegirCardio } from './cardio-ui.js';

let texto = '', musculo = '', equipo = '', ultimoDesde = 'mas', soloFuera = true;
const EQUIPO = Object.fromEntries(C.secciones.flatMap(s => s.preguntas || []).find(p => p.equipamiento)?.equipamiento || []);
export function vistaBanco(ir, { desde = ultimoDesde } = {}) {
  ultimoDesde = desde;
  const opciones = (xs, nombres, valor) => xs.map(x => `<option value="${esc(x)}"${x === valor ? ' selected' : ''}>${esc(nombres[x] || mayuscula(x.replaceAll('_', ' ')))}</option>`).join('');
  const musculos = [...new Set(indice.ejercicios.flatMap(e => [...e.musculos_primarios, ...e.musculos_secundarios]))].sort();
  const equipos = [...new Set(indice.ejercicios.flatMap(e => e.equipamiento))].sort();
  $('app').innerHTML = `<div id="vista-banco">
    <button type="button" class="volver" id="banco-volver">${icono('flecha', 'icono flecha-atras')} ${desde === 'hoy' ? 'Hoy' : 'Más'}</button>
    <h1>Banco de ejercicios</h1>
    <p class="pequeno suave">${indice.ejercicios.length} ejercicios con imágenes y técnica. Puedes sumar uno a hoy, aunque hoy descanses.</p>
    <button type="button" class="boton" id="banco-cardio">Banco de cardio, 9 actividades con imágenes</button>
    <section class="tarjeta banco-busqueda">
      <label for="banco-buscar" class="pequeno">Buscar por nombre, músculo o equipo</label>
      <input type="search" id="banco-buscar" placeholder="Ejemplo: sentadilla, pecho, mancuerna" value="${esc(texto)}" autocomplete="off">
      <label class="pequeno"><input type="checkbox" id="banco-fuera"${soloFuera ? ' checked' : ''}> Solo ejercicios que no están en la sesión de hoy</label>
      <div class="dos-col"><label class="pequeno">Músculo<select id="banco-musculo"><option value="">Todos</option>${opciones(musculos, NOMBRE_MUSCULO, musculo)}</select></label>
        <label class="pequeno">Equipo<select id="banco-equipo"><option value="">Todos</option>${opciones(equipos, EQUIPO, equipo)}</select></label></div>
    </section>
    <p id="banco-cantidad" class="pequeno suave" role="status" aria-live="polite"></p>
    <ul id="banco-lista" class="banco-lista"></ul>
  </div>`;
  const pintar = () => {
    const enHoy = new Set(ctxNucleo().plan?.dias.find(d => d.fecha === ctxNucleo().hoy)?.ejercicios.map(e => e.ejercicio_id) || []);
    const xs = buscarEjercicios(indice, { texto, musculo, equipo, nombresMusculos: NOMBRE_MUSCULO, nombresEquipos: EQUIPO }).filter(e => !soloFuera || !enHoy.has(e.id));
    $('banco-cantidad').textContent = `${xs.length} ${xs.length === 1 ? 'ejercicio encontrado' : 'ejercicios encontrados'}`;
    $('banco-lista').innerHTML = xs.length ? xs.map(e => {
      const motivo = motivoNoAgregar(e, ctxNucleo());
      return `<li class="tarjeta banco-ejercicio"><div class="banco-fila"><button type="button" class="banco-ficha" data-banco-ver="${e.id}" aria-label="Ver ficha de ${esc(e.nombre)}">${miniatura(e.id)}<span><strong>${esc(e.nombre)}</strong><span class="pequeno suave">${esc(e.musculos_primarios.map(m => NOMBRE_MUSCULO[m] || m).join(', '))}</span></span></button>
        <button type="button" class="boton banco-agregar" data-banco-agregar="${e.id}" aria-label="Agregar ${esc(e.nombre)} a hoy"${motivo ? ' disabled' : ''}>Agregar</button></div>
        <p class="pequeno suave">${esc(motivo || e.equipamiento.map(q => EQUIPO[q] || q.replaceAll('_', ' ')).join(', ') || 'Peso del cuerpo')}</p></li>`;
    }).join('') : '<li class="tarjeta"><p>No encontré ejercicios con esos filtros. Prueba otra palabra o elige Todos.</p></li>';
  };
  $('banco-volver').onclick = () => ir(desde);
  $('banco-cardio').onclick = () => elegirCardio({ volver: $('banco-cardio'), alCambiar: () => ir('hoy') });
  $('banco-buscar').oninput = ev => { texto = ev.target.value; pintar(); };
  $('banco-fuera').onchange = ev => { soloFuera = ev.target.checked; pintar(); };
  $('banco-musculo').onchange = ev => { musculo = ev.target.value; pintar(); };
  $('banco-equipo').onchange = ev => { equipo = ev.target.value; pintar(); };
  $('banco-lista').onclick = ev => {
    const ver = ev.target.closest('[data-banco-ver]');
    if (ver) return ir('ejercicio', { id: ver.dataset.bancoVer, desde: 'banco' });
    const agregar = ev.target.closest('[data-banco-agregar]');
    if (agregar && !agregar.disabled) proponerEdicion({ tipo: 'agregar', ejercicio: agregar.dataset.bancoAgregar }, { volver: agregar, alCambiar: () => ir('hoy') });
  };
  pintar();
}
