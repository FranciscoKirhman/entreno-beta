import { datoCambiado } from './datos-nube.js';
import { C, E, indice, esc, $, ctxNucleo, guardar, avisar } from './comun.js';
import { crearPropio, TIPOS_PROPIO } from '../nucleo/propios.js';
import { buscarEjercicios, motivoNoAgregar } from '../nucleo/editar-sesion.js';
import { miniatura } from './imagenes.js';
import { NOMBRE_MUSCULO, mayuscula } from './musculos.js';
import { icono } from './iconos.js';
import { proponerEdicion } from './editar-sesion-ui.js';
import { elegirCardio } from './cardio-ui.js';

let texto = '', musculo = '', equipo = '', ultimoDesde = 'mas', soloFuera = true, creando = false;
const EQUIPO = Object.fromEntries(C.secciones.flatMap(s => s.preguntas || []).find(p => p.equipamiento)?.equipamiento || []);
export function vistaBanco(ir, { desde = ultimoDesde } = {}) {
  ultimoDesde = desde;
  const opciones = (xs, nombres, valor) => xs.map(x => `<option value="${esc(x)}"${x === valor ? ' selected' : ''}>${esc(nombres[x] || mayuscula(x.replaceAll('_', ' ')))}</option>`).join('');
  const musculos = [...new Set(indice.ejercicios.flatMap(e => [...e.musculos_primarios, ...e.musculos_secundarios]))].sort();
  const equipos = [...new Set(indice.ejercicios.flatMap(e => e.equipamiento))].sort();
  $('app').innerHTML = `<div id="vista-banco">
    <button type="button" class="volver" id="banco-volver">${icono('flecha', 'icono flecha-atras')} ${desde === 'hoy' ? 'Hoy' : 'Más'}</button>
    <h1>Banco de ejercicios</h1>
    <p class="pequeno suave">${indice.ejercicios.filter(e => !e.propio).length} ejercicios con imágenes y técnica${E.ejerciciosPropios?.length ? `, más ${E.ejerciciosPropios.length} ${E.ejerciciosPropios.length === 1 ? 'creado' : 'creados'} por ti` : ''}. Puedes sumar uno a hoy, aunque hoy descanses.</p>
    <button type="button" class="boton" id="banco-cardio">Banco de cardio, 9 actividades con imágenes</button>
    <section class="tarjeta banco-busqueda">
      <label for="banco-buscar" class="pequeno">Buscar por nombre, músculo o equipo</label>
      <input type="search" id="banco-buscar" placeholder="Ejemplo: sentadilla, pecho, mancuerna" value="${esc(texto)}" autocomplete="off">
      <label class="pequeno"><input type="checkbox" id="banco-fuera"${soloFuera ? ' checked' : ''}> Solo ejercicios que no están en la sesión de hoy</label>
      <div class="dos-col"><label class="pequeno">Músculo<select id="banco-musculo"><option value="">Todos</option>${opciones(musculos, NOMBRE_MUSCULO, musculo)}</select></label>
        <label class="pequeno">Equipo<select id="banco-equipo"><option value="">Todos</option>${opciones(equipos, EQUIPO, equipo)}</select></label></div>
    </section>
    <details class="tarjeta crear-propio" id="crear-propio"${creando ? ' open' : ''}><summary>¿No está? Crea tu ejercicio</summary>
      <form id="form-propio" class="campos-propio">
        <label class="pequeno">Nombre <input type="text" id="propio-nombre" maxlength="60" placeholder="Remo en máquina Hammer" required></label>
        <label class="pequeno">Tipo <select id="propio-clase">${Object.entries(TIPOS_PROPIO).map(([k, t]) => `<option value="${k}">${esc(t.nombre)}</option>`).join('')}</select></label>
        <fieldset><legend class="pequeno">Músculos que trabaja (hasta 3)</legend><div class="chips">${musculos.map(m => `<label><input type="checkbox" class="propio-musculo" value="${esc(m)}">${esc(mayuscula(NOMBRE_MUSCULO[m] || m.replaceAll('_', ' ')))}</label>`).join('')}</div></fieldset>
        <fieldset><legend class="pequeno">Equipo (si no marcas nada, es sin equipo)</legend><div class="chips">${equipos.map(q => `<label><input type="checkbox" class="propio-equipo" value="${esc(q)}">${esc(EQUIPO[q] || q.replaceAll('_', ' '))}</label>`).join('')}</div></fieldset>
        <button type="submit" class="boton primario">Crear ejercicio</button>
        <p class="pequeno suave">Queda en este teléfono, en tu respaldo y, si entraste, en tu cuenta. Sin imagen ni técnica: es tuyo. Se puede agregar a una sesión como cualquier otro.</p>
      </form>
    </details>
    <p id="banco-cantidad" class="pequeno suave" role="status" aria-live="polite"></p>
    <ul id="banco-lista" class="banco-lista"></ul>
  </div>`;
  const pintar = () => {
    const enHoy = new Set(ctxNucleo().plan?.dias.find(d => d.fecha === ctxNucleo().hoy)?.ejercicios.map(e => e.ejercicio_id) || []);
    const xs = buscarEjercicios(indice, { texto, musculo, equipo, nombresMusculos: NOMBRE_MUSCULO, nombresEquipos: EQUIPO }).filter(e => !soloFuera || !enHoy.has(e.id));
    $('banco-cantidad').textContent = `${xs.length} ${xs.length === 1 ? 'ejercicio encontrado' : 'ejercicios encontrados'}`;
    $('banco-lista').innerHTML = xs.length ? xs.map(e => {
      const motivo = motivoNoAgregar(e, ctxNucleo());
      return `<li class="tarjeta banco-ejercicio"><div class="banco-fila"><button type="button" class="banco-ficha" data-banco-ver="${e.id}" aria-label="Ver ficha de ${esc(e.nombre)}">${miniatura(e.id)}<span><strong>${esc(e.nombre)}</strong>${e.propio ? ' <span class="chip">Tuyo</span>' : ''}<span class="pequeno suave">${esc(e.musculos_primarios.map(m => NOMBRE_MUSCULO[m] || m).join(', '))}</span></span></button>
        <button type="button" class="boton banco-agregar" data-banco-agregar="${e.id}" aria-label="Agregar ${esc(e.nombre)} a hoy"${motivo ? ' disabled' : ''}>Agregar</button></div>
        <p class="pequeno suave">${esc(motivo || e.equipamiento.map(q => EQUIPO[q] || q.replaceAll('_', ' ')).join(', ') || 'Peso del cuerpo')}</p></li>`;
    }).join('') : '<li class="tarjeta"><p>No encontré ejercicios con esos filtros. Prueba otra palabra o elige Todos.</p></li>';
  };
  $('banco-volver').onclick = () => ir(desde);
  $('crear-propio').addEventListener('toggle', ev => { creando = ev.target.open; });
  document.querySelectorAll('.propio-musculo').forEach(c => c.onchange = () => {
    if (document.querySelectorAll('.propio-musculo:checked').length > 3) { c.checked = false; avisar('Elige hasta 3 músculos.'); }
  });
  $('form-propio').onsubmit = ev => {
    ev.preventDefault();
    const r = crearPropio({ nombre: $('propio-nombre').value, clase: $('propio-clase').value,
      musculos: [...document.querySelectorAll('.propio-musculo:checked')].map(c => c.value),
      equipamiento: [...document.querySelectorAll('.propio-equipo:checked')].map(c => c.value) }, indice);
    if (r.error) return avisar(r.error);
    (E.ejerciciosPropios ||= []).push(r.ejercicio);
    texto = r.ejercicio.nombre; musculo = ''; equipo = ''; creando = false;
    datoCambiado('ejercicios_propios');
    vistaBanco(ir, { desde });
    avisar(`Creaste "${r.ejercicio.nombre}". Agrégalo a hoy desde la lista.`);
  };
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
