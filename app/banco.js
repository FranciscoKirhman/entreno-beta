import { datoCambiado } from './datos-nube.js';
import { C, E, indice, esc, $, ctxNucleo, guardar, avisar } from './comun.js';
import { crearPropio, TIPOS_PROPIO } from '../nucleo/propios.js';
import { buscarEjercicios, motivoNoAgregar } from '../nucleo/editar-sesion.js';
import { miniatura } from './imagenes.js';
import { NOMBRE_MUSCULO, mayuscula } from './musculos.js';
import { icono } from './iconos.js';
import { proponerEdicion, agregarVarios } from './editar-sesion-ui.js';
import { elegirCardio } from './cardio-ui.js';
import { pintarRecomendaciones } from './recomendaciones-ui.js';

let despuesDe = null;
let texto = '', musculo = '', equipo = '', ultimoDesde = 'mas', soloFuera = true, creando = false;
// Desde la sesión, como el "Agregar ejercicio" de Hevy: se eligen varios y se agregan juntos (o como superserie).
const elegidos = new Set();
/** Los ejercicios hechos hace poco, del más reciente al más antiguo (para la sección Recientes). */
const recientes = () => [...new Set([...E.sesiones].sort((a, b) => b.fecha.localeCompare(a.fecha)).flatMap(x => (x.series || []).map(y => y.ejercicio_id)))].filter(id => indice.porId.get(id)).slice(0, 8);
const EQUIPO = Object.fromEntries(C.secciones.flatMap(s => s.preguntas || []).find(p => p.equipamiento)?.equipamiento || []);
export function vistaBanco(ir, { desde = ultimoDesde, despues = despuesDe } = {}) {
  despuesDe = despues;
  if (desde !== ultimoDesde) elegidos.clear();
  ultimoDesde = desde;
  const sesion = desde === 'hoy';
  document.body.classList.toggle('en-sesion', sesion); // encima de la sesión, sin pestañas
  const opciones = (xs, nombres, valor) => xs.map(x => `<option value="${esc(x)}"${x === valor ? ' selected' : ''}>${esc(nombres[x] || mayuscula(x.replaceAll('_', ' ')))}</option>`).join('');
  const musculos = [...new Set(indice.ejercicios.flatMap(e => [...e.musculos_primarios, ...e.musculos_secundarios]))].sort();
  const equipos = [...new Set(indice.ejercicios.flatMap(e => e.equipamiento))].sort();
  const propios = E.ejerciciosPropios?.length || 0, conTecnica = indice.ejercicios.filter(e => !e.propio && !e.extra).length;
  // Como en la app de Apple: título, buscador, filtros en píldoras, accesos en una lista agrupada y el banco en filas
  // ordenadas por letra, cada una con su miniatura y un + para sumarla a hoy (con vista previa antes de cambiar).
  $('app').innerHTML = `<div id="vista-banco">
    ${sesion ? `<div class="banco-cab-sesion"><button type="button" class="enlace" id="banco-volver" data-vuelve-a="hoy">Cancelar</button><h1>Agregar ejercicio</h1><button type="button" class="enlace" id="banco-crear">Crear</button></div>`
      : `<button type="button" class="volver" id="banco-volver" data-vuelve-a="${esc(desde)}">${icono('flecha', 'icono flecha-atras')} Perfil</button>
    <h1>Banco de ejercicios</h1>
    <p class="banco-resumen suave">${conTecnica} con técnica${propios ? ` y ${propios} ${propios === 1 ? 'creado' : 'creados'} por ti` : ''}. Toca uno para ver cómo se hace; con + lo sumas a hoy, aunque hoy descanses.</p>`}
    <div class="banco-buscador" role="search">
      ${icono('buscar', 'icono banco-lupa')}
      <label for="banco-buscar" class="sr-only">Buscar por nombre, músculo o equipo</label>
      <input type="search" id="banco-buscar" placeholder="Nombre, músculo o equipo" value="${esc(texto)}" autocomplete="off" enterkeyhint="search">
    </div>
    <div class="banco-filtros" role="group" aria-label="Filtros del banco">
      <label class="banco-filtro${equipo ? ' activo' : ''}"><span class="sr-only">Equipo</span><select id="banco-equipo"><option value="">Todo el equipo</option>${opciones(equipos, EQUIPO, equipo)}</select></label>
      <label class="banco-filtro${musculo ? ' activo' : ''}"><span class="sr-only">Músculo</span><select id="banco-musculo"><option value="">Todos los músculos</option>${opciones(musculos, NOMBRE_MUSCULO, musculo)}</select></label>
      <label class="banco-filtro banco-filtro-casilla${soloFuera ? ' activo' : ''}"><input type="checkbox" id="banco-fuera"${soloFuera ? ' checked' : ''}> Solo los que no están hoy</label>
    </div>
    <div class="banco-accesos">
      <button type="button" class="banco-acceso-fila" id="banco-cardio">${icono('pulso')}<span><strong>Cardio</strong><small>9 actividades con imágenes</small></span>${icono('flecha', 'icono banco-chevron')}</button>
      <details class="crear-propio" id="crear-propio"${creando ? ' open' : ''}><summary class="banco-acceso-fila">${icono('mas')}<span><strong>Crear tu ejercicio</strong><small>Si no está en el banco</small></span>${icono('flecha', 'icono banco-chevron')}</summary>
      <form id="form-propio" class="campos-propio">
        <label class="pequeno">Nombre <input type="text" id="propio-nombre" maxlength="60" placeholder="Remo en máquina Hammer" required></label>
        <label class="pequeno">Tipo <select id="propio-clase">${Object.entries(TIPOS_PROPIO).map(([k, t]) => `<option value="${k}">${esc(t.nombre)}</option>`).join('')}</select></label>
        <fieldset id="propio-musculos" aria-describedby="propio-musculos-nota"><legend class="pequeno">Músculos que trabaja <strong>(obligatorio, elige 1 a 3)</strong></legend><p class="pequeno suave" id="propio-musculos-nota">Así cuenta en tu semana por músculo y en Progreso.</p><div class="chips">${musculos.map(m => `<label><input type="checkbox" class="propio-musculo" value="${esc(m)}">${esc(mayuscula(NOMBRE_MUSCULO[m] || m.replaceAll('_', ' ')))}</label>`).join('')}</div></fieldset>
        <fieldset><legend class="pequeno">Equipo (si no marcas nada, es sin equipo)</legend><div class="chips">${equipos.map(q => `<label><input type="checkbox" class="propio-equipo" value="${esc(q)}">${esc(EQUIPO[q] || q.replaceAll('_', ' '))}</label>`).join('')}</div></fieldset>
        <button type="submit" class="boton primario">Crear ejercicio</button>
        <p class="pequeno suave">Queda en este teléfono, en tu respaldo y, si entraste, en tu cuenta. Sin imagen ni técnica: es tuyo. Se puede agregar a una sesión como cualquier otro.</p>
      </form>
      </details>
    </div>
    <section class="banco-recomendaciones" id="banco-recomendaciones" aria-label="Recomendaciones de ejercicios"></section>
    <div id="banco-recientes"></div>
    <h2 class="banco-titulo-lista">Todos los ejercicios</h2>
    <p id="banco-cantidad" class="banco-cantidad suave" role="status" aria-live="polite"></p>
    <div id="banco-lista" class="banco-indice"></div>
    ${sesion ? '<div class="banco-elegidos" id="banco-elegidos" hidden></div>' : ''}
  </div>`;
  const letra = e => e.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
  const fila = e => {
    const motivo = motivoNoAgregar(e, ctxNucleo());
    const detalle = [e.musculos_primarios.map(m => mayuscula(NOMBRE_MUSCULO[m] || m)).slice(0, 2).join(', '), e.equipamiento.map(q => EQUIPO[q] || q.replaceAll('_', ' ')).slice(0, 2).join(', ') || 'Peso del cuerpo'].filter(Boolean).join(' · ');
    const texto = `${miniatura(e.id).replace('<img ', '<img loading="lazy" ')}<span class="banco-item-texto"><strong>${esc(e.nombre)}${e.propio ? ' <span class="chip">Tuyo</span>' : e.extra ? ' <span class="chip chip-sin-revision">Sin revisión</span>' : ''}</strong><small>${esc(detalle)}</small>${motivo ? `<small class="banco-motivo">${esc(motivo)}</small>` : ''}</span>`;
    // En la sesión, tocar la fila la elige (como Hevy) y la ficha queda en el botón de información.
    if (sesion) return `<li class="banco-item${elegidos.has(e.id) ? ' elegido' : ''}">
      <button type="button" class="banco-item-ficha" data-banco-elegir="${e.id}" aria-pressed="${elegidos.has(e.id)}"${motivo ? ' disabled' : ''} aria-label="${esc(motivo ? `${e.nombre}: ${motivo}` : `Elegir ${e.nombre}`)}">${texto}</button>
      <button type="button" class="banco-item-agregar banco-item-info" data-banco-ver="${e.id}" aria-label="Ver ficha de ${esc(e.nombre)}">${icono('info')}</button>
    </li>`;
    return `<li class="banco-item">
      <button type="button" class="banco-item-ficha" data-banco-ver="${e.id}" aria-label="Ver ficha de ${esc(e.nombre)}">${texto}</button>
      <button type="button" class="banco-item-agregar" data-banco-agregar="${e.id}" aria-label="${esc(motivo ? `No se puede agregar ${e.nombre}: ${motivo}` : `Agregar ${e.nombre} a hoy`)}"${motivo ? ' disabled' : ''}>${icono('mas')}</button>
    </li>`;
  };
  const pintar = () => {
    const enHoy = new Set(ctxNucleo().plan?.dias.find(d => d.fecha === ctxNucleo().hoy)?.ejercicios.map(e => e.ejercicio_id) || []);
    const xs = buscarEjercicios(indice, { texto, musculo, equipo, nombresMusculos: NOMBRE_MUSCULO, nombresEquipos: EQUIPO }).filter(e => !soloFuera || !enHoy.has(e.id));
    pintarRecomendaciones(xs, ir);
    // Recientes, como Hevy: lo último que hiciste, arriba de la lista completa (sin buscar ni filtrar).
    const rec = !texto && !musculo && !equipo ? recientes().filter(id => xs.some(e => e.id === id)).map(id => indice.porId.get(id)) : [];
    $('banco-recientes').innerHTML = rec.length ? `<h2 class="banco-titulo-lista">Recientes</h2><ul class="banco-grupo banco-lista-recientes">${rec.map(fila).join('')}</ul>` : '';
    pintarElegidos();
    $('banco-cantidad').textContent = `${xs.length} ${xs.length === 1 ? 'ejercicio' : 'ejercicios'}`;
    document.querySelectorAll('#vista-banco .banco-filtro').forEach(l => l.classList.toggle('activo', Boolean(l.querySelector('select')?.value || l.querySelector('input:checked'))));
    if (!xs.length) { $('banco-lista').innerHTML = '<p class="banco-vacio">No encontré ejercicios con esos filtros. Prueba otra palabra o elige Todos.</p>'; return; }
    const grupos = new Map();
    for (const e of xs) { const l = letra(e); if (!grupos.has(l)) grupos.set(l, []); grupos.get(l).push(e); }
    $('banco-lista').innerHTML = [...grupos].map(([l, es]) => `<section class="banco-letra" aria-label="${esc(l)}"><h3 aria-hidden="true">${esc(l)}</h3><ul class="banco-grupo">${es.map(fila).join('')}</ul></section>`).join('');
  };
  // La barra de abajo con lo elegido: "Agregar N ejercicios" y, con dos o más, "Como superserie".
  function pintarElegidos() {
    const barra = $('banco-elegidos');
    if (!barra) return;
    barra.hidden = !elegidos.size;
    barra.innerHTML = elegidos.size ? `${elegidos.size > 1 ? '<button type="button" class="boton" data-agregar-elegidos="superserie">Como superserie</button>' : ''}<button type="button" class="boton primario" data-agregar-elegidos="juntos">Agregar ${elegidos.size === 1 ? '1 ejercicio' : `${elegidos.size} ejercicios`}</button>` : '';
  }
  $('banco-elegidos')?.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-agregar-elegidos]');
    if (!b) return;
    b.disabled = true;
    const ids = [...elegidos];
    const agregados = await agregarVarios(ids, { superserie: b.dataset.agregarElegidos === 'superserie', despues: despuesDe });
    if (!agregados?.length) { b.disabled = false; return; }
    elegidos.clear();
    ir('hoy', { sesion: true, ej: agregados[0] });
  });
  $('banco-crear')?.addEventListener('click', () => { const d = $('crear-propio'); d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); $('propio-nombre').focus({ preventScroll: true }); });
  $('vista-banco').addEventListener('click', ev => {
    const b = ev.target.closest('[data-banco-elegir]');
    if (!b || b.disabled) return;
    const id = b.dataset.bancoElegir;
    elegidos.has(id) ? elegidos.delete(id) : elegidos.add(id);
    document.querySelectorAll(`#vista-banco [data-banco-elegir="${CSS.escape(id)}"]`).forEach(x => { x.setAttribute('aria-pressed', String(elegidos.has(id))); x.closest('.banco-item')?.classList.toggle('elegido', elegidos.has(id)); });
    pintarElegidos();
  });
  $('vista-banco').addEventListener('click', ev => {
    const ver = ev.target.closest('#banco-recientes [data-banco-ver]');
    if (ver) return ir('ejercicio', { id: ver.dataset.bancoVer, desde: 'banco' });
    const agregar = ev.target.closest('#banco-recientes [data-banco-agregar]');
    if (agregar && !agregar.disabled) proponerEdicion({ tipo: 'agregar', ejercicio: agregar.dataset.bancoAgregar }, { volver: agregar, alCambiar: () => ir('hoy', { sesion: true }) });
  });
  $('banco-volver').onclick = () => { elegidos.clear(); ir(desde, desde === 'hoy' ? { sesion: true } : undefined); };
  $('crear-propio').addEventListener('toggle', ev => { creando = ev.target.open; });
  document.querySelectorAll('.propio-musculo').forEach(c => c.onchange = () => {
    if (document.querySelectorAll('.propio-musculo:checked').length > 3) { c.checked = false; avisar('Elige hasta 3 músculos.'); }
  });
  $('form-propio').onsubmit = ev => {
    ev.preventDefault();
    // Sin músculos no se puede crear: el ejercicio tiene que contar en la semana y en Progreso.
    if (!document.querySelector('.propio-musculo:checked')) {
      avisar('Elige al menos un músculo que trabaje el ejercicio.');
      document.querySelector('.propio-musculo')?.focus();
      return;
    }
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
    if (agregar && !agregar.disabled) proponerEdicion({ tipo: 'agregar', ejercicio: agregar.dataset.bancoAgregar, despues: despuesDe }, { volver: agregar, alCambiar: () => ir('hoy') });
  };
  pintar();
}
