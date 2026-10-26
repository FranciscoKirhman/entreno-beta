import { datoCambiado } from './datos-nube.js';
import { C, E, indice, esc, $, ctxNucleo, guardar, avisar, cambiarPlan, IMAGENES, asegurarExtras, EXTRAS } from './comun.js';
import * as nube from './nube.js';
import { aplicarOpcion, calcularCambio } from '../nucleo/coach.js';
import { paraReemplazar, musculosEnComun } from '../nucleo/reemplazar.js';
import { abrirHoja, cerrarHoja } from './hoja.js';
import { crearPropio, TIPOS_PROPIO } from '../nucleo/propios.js';
import { buscarEjercicios, motivoNoAgregar } from '../nucleo/editar-sesion.js';
import { miniatura } from './imagenes.js';
import { NOMBRE_MUSCULO, mayuscula, nombresMusculos } from './musculos.js';
import { icono } from './iconos.js';
import { proponerEdicion, agregarVarios } from './editar-sesion-ui.js';
import { elegirCardio } from './cardio-ui.js';
import { pintarRecomendaciones } from './recomendaciones-ui.js';
import { agregarARutina } from './rutinas.js';

let despuesDe = null;
// Reemplazar desde la sesión ({ id, fecha }): el banco elige uno y destaca los que trabajan los mismos músculos.
let reemplazo = null;
let texto = '', musculo = '', equipo = '', ultimoDesde = 'miplan', soloFuera = true, conAmpliado = true;
// Desde la sesión, como el "Agregar ejercicio" de Hevy: se eligen varios y se agregan juntos (o como superserie).
const elegidos = new Set();
/** Los ejercicios hechos hace poco, del más reciente al más antiguo (para la sección Recientes). */
const recientes = () => [...new Set([...E.sesiones].sort((a, b) => b.fecha.localeCompare(a.fecha)).flatMap(x => (x.series || []).map(y => y.ejercicio_id)))].filter(id => indice.porId.get(id)).slice(0, 8);
const EQUIPO = Object.fromEntries(C.secciones.flatMap(s => s.preguntas || []).find(p => p.equipamiento)?.equipamiento || []);
export function vistaBanco(ir, entrada = {}) {
  const { desde = ultimoDesde, despues = despuesDe } = entrada;
  // Entrar desde un botón (Agregar ejercicio, Agregar ejercicio aquí, Mi plan, una rutina) dice dónde va lo agregado y
  // parte sin la búsqueda de la vez anterior. Volver de una ficha o cambiar un filtro conserva las dos cosas: antes, el
  // "aquí" de una vez anterior se quedaba y "Agregar ejercicio" metía el ejercicio en medio, no al final.
  if ('despues' in entrada) { texto = ''; reemplazo = entrada.reemplazar || null; if (reemplazo) elegidos.clear(); }
  despuesDe = despues;
  if (desde !== ultimoDesde) elegidos.clear();
  ultimoDesde = desde;
  const sesion = desde === 'hoy' || desde === 'rutina'; // elegir varios: para la sesión o para una rutina
  document.body.classList.toggle('en-sesion', sesion); // encima de la sesión, sin pestañas
  const base = sesion && reemplazo ? indice.porId.get(reemplazo.id) : null;
  if (!base) reemplazo = null;
  const opciones = (xs, nombres, valor) => xs.map(x => `<option value="${esc(x)}"${x === valor ? ' selected' : ''}>${esc(nombres[x] || mayuscula(x.replaceAll('_', ' ')))}</option>`).join('');
  const musculos = [...new Set(indice.ejercicios.flatMap(e => [...e.musculos_primarios, ...e.musculos_secundarios]))].sort();
  const equipos = [...new Set(indice.ejercicios.flatMap(e => e.equipamiento))].sort();
  const propios = E.ejerciciosPropios?.length || 0, conTecnica = indice.ejercicios.filter(e => !e.propio && !e.extra).length;
  // Como en la app de Apple: título, buscador, filtros en píldoras, accesos en una lista agrupada y el banco en filas
  // ordenadas por letra, cada una con su miniatura y un + para sumarla a hoy (con vista previa antes de cambiar).
  $('app').innerHTML = `<div id="vista-banco"${base ? ' class="reemplazando"' : ''}>
    ${base ? `<div class="banco-cab-sesion"><button type="button" class="enlace" id="banco-volver" data-vuelve-a="${desde}">Cancelar</button><h1>Reemplazar</h1><span class="enlace banco-cab-espacio" aria-hidden="true">Cancelar</span></div>
    <p class="banco-reemplazo-de">En vez de <strong>${esc(base.nombre)}</strong>. Arriba, lo que trabaja ${esc(nombresMusculos(base.musculos_primarios))}.</p>`
      : sesion ? `<div class="banco-cab-sesion"><button type="button" class="enlace" id="banco-volver" data-vuelve-a="${desde}">Cancelar</button><h1>Agregar ejercicio</h1><button type="button" class="enlace" id="banco-crear">Crear</button></div>`
      : `<button type="button" class="volver" id="banco-volver" data-vuelve-a="${esc(desde)}">${icono('flecha', 'icono flecha-atras')} ${desde === 'miplan' ? 'Mi plan' : 'Perfil'}</button>
    <h1>Banco de ejercicios</h1>
    <p class="banco-resumen suave">${conTecnica} con técnica${propios ? ` y ${propios} ${propios === 1 ? 'creado' : 'creados'} por ti` : ''}. Toca uno para ver cómo se hace; con + lo sumas a hoy, aunque hoy descanses.</p>`}
    <div class="banco-buscador" role="search">
      ${icono('buscar', 'icono banco-lupa')}
      <label for="banco-buscar" class="sr-only">Buscar por nombre, músculo o equipo</label>
      <input type="search" id="banco-buscar" placeholder="Nombre, músculo o equipo" value="${esc(texto)}" autocomplete="off" enterkeyhint="search">
    </div>
    <div class="banco-filtros" role="group" aria-label="Filtros del banco">
      <button type="button" class="banco-filtro${equipo ? ' activo' : ''}" data-filtro="equipo" aria-haspopup="dialog">${esc(equipo ? EQUIPO[equipo] || mayuscula(equipo.replaceAll('_', ' ')) : 'Todo el equipo')}</button>
      <button type="button" class="banco-filtro${musculo ? ' activo' : ''}" data-filtro="musculo" aria-haspopup="dialog">${esc(musculo ? mayuscula(NOMBRE_MUSCULO[musculo] || musculo) : 'Todos los músculos')}</button>
      <label class="banco-filtro banco-filtro-casilla banco-filtro-fuera${soloFuera ? ' activo' : ''}"><input type="checkbox" id="banco-fuera"${soloFuera ? ' checked' : ''}> Solo los que no están hoy</label>
      <label class="banco-filtro banco-filtro-casilla${conAmpliado ? ' activo' : ''}"><input type="checkbox" id="banco-ampliado"${conAmpliado ? ' checked' : ''}> Incluir el banco ampliado (sin revisión)</label>
    </div>
    <div class="banco-accesos">
      <button type="button" class="banco-acceso-fila" id="banco-cardio">${icono('pulso')}<span><strong>Cardio</strong><small>9 actividades con imágenes</small></span>${icono('flecha', 'icono banco-chevron')}</button>
      <button type="button" class="banco-acceso-fila" id="crear-propio">${icono('mas')}<span><strong>Crear tu ejercicio</strong><small>Si no está en el banco</small></span>${icono('flecha', 'icono banco-chevron')}</button>
    </div>
    <section class="banco-recomendaciones" id="banco-recomendaciones" aria-label="Recomendaciones de ejercicios"></section>
    <div id="banco-recientes"></div>
    <section id="banco-mismos" class="banco-mismos" aria-label="Ejercicios que trabajan los mismos músculos" hidden></section>
    <h2 class="banco-titulo-lista" id="banco-titulo-todos">Todos los ejercicios</h2>
    <p id="banco-cantidad" class="banco-cantidad suave" role="status" aria-live="polite"></p>
    <div id="banco-lista" class="banco-indice"></div>
    ${sesion ? '<div class="banco-elegidos" id="banco-elegidos" hidden></div>' : ''}
  </div>`;
  const letra = e => e.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
  const fila = (e, ctx) => {
    const motivo = motivoNoAgregar(e, ctx);
    const detalle = [e.musculos_primarios.map(m => mayuscula(NOMBRE_MUSCULO[m] || m)).slice(0, 2).join(', '), e.equipamiento.map(q => EQUIPO[q] || q.replaceAll('_', ' ')).slice(0, 2).join(', ') || 'Peso del cuerpo'].filter(Boolean).join(' · ');
    // Al reemplazar, los que comparten un músculo principal lo dicen en color: "Mismo músculo: cuádriceps y glúteo".
    const comunes = base ? musculosEnComun(base, e) : [];
    const mismo = comunes.length ? `<small class="banco-mismo-musculo">Mismo músculo: ${esc(nombresMusculos(comunes))}</small>` : '';
    const texto = `${miniatura(e.id).replace('<img ', '<img loading="lazy" ')}<span class="banco-item-texto"><strong>${esc(e.nombre)}${e.propio ? ' <span class="chip">Tuyo</span>' : e.extra ? ' <span class="chip chip-sin-revision">Sin revisión</span>' : ''}</strong>${mismo}<small>${esc(detalle)}</small>${motivo ? `<small class="banco-motivo">${esc(motivo)}</small>` : ''}</span>`;
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
    // Un solo contexto por dibujo: armarlo en cada fila (unas 1.300 con el banco ampliado) tomaba unos 250 ms al abrir
    // el banco y en cada letra escrita (medido en el simulador el 25 de octubre).
    const ctx = ctxNucleo();
    const enHoy = new Set(ctx.plan?.dias.find(d => d.fecha === ctx.hoy)?.ejercicios.map(e => e.ejercicio_id) || []);
    // Al reemplazar, lo que ya está hoy nunca se ofrece (quedaría repetido).
    let xs = buscarEjercicios(indice, { texto, musculo, equipo, nombresMusculos: NOMBRE_MUSCULO, nombresEquipos: EQUIPO }).filter(e => (!(soloFuera || base) || !enHoy.has(e.id)) && (conAmpliado || !e.extra));
    // Mientras escribes, los resultados van justo bajo el buscador, como Hevy: sin los accesos ni las recomendaciones,
    // que los dejaban unos 900 px más abajo, detrás del teclado.
    const buscando = Boolean(texto.trim());
    $('vista-banco').classList.toggle('buscando', buscando);
    if (!buscando && !base) pintarRecomendaciones(xs, ir, despuesDe);
    // Reemplazar: arriba "Trabajan lo mismo" (las alternativas de siempre, después el mismo patrón y más músculos en
    // común); sin buscar, los 12 primeros y abajo todo el banco por letra. Buscando, todos los que calzan arriba y el
    // resto debajo, en "Otros ejercicios". Solo se ofrecen los que se miden igual (nucleo/reemplazar.js).
    if (base) {
      const motivos = new Map(), disponible = e => { if (!motivos.has(e.id)) motivos.set(e.id, motivoNoAgregar(e, ctx)); return !motivos.get(e.id); };
      const sugeridos = (aplicarOpcion({ tipo: 'elegir_alternativa', fecha: reemplazo.fecha, ejercicio: base.id }, ctx).opciones || []).map(o => o.accion?.a).filter(Boolean);
      const { mismos, otros } = paraReemplazar(base, xs, { sugeridos, disponible });
      const arriba = buscando ? mismos : mismos.slice(0, 12);
      $('banco-mismos').hidden = !arriba.length;
      $('banco-mismos').innerHTML = arriba.length ? `<h2 class="banco-mismos-titulo">Trabajan lo mismo</h2><ul class="banco-grupo">${arriba.map(x => fila(x.ejercicio, ctx)).join('')}</ul>` : '';
      $('banco-titulo-todos').textContent = buscando ? 'Otros ejercicios' : 'Todos los ejercicios';
      xs = buscando ? otros : [...mismos.map(x => x.ejercicio), ...otros].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      $('banco-titulo-todos').hidden = !xs.length;
    }
    // Recientes, como Hevy: lo último que hiciste, arriba de la lista completa (sin buscar ni filtrar).
    const rec = !texto && !musculo && !equipo ? recientes().filter(id => xs.some(e => e.id === id)).map(id => indice.porId.get(id)) : [];
    $('banco-recientes').innerHTML = rec.length ? `<h2 class="banco-titulo-lista">Recientes</h2><ul class="banco-grupo banco-lista-recientes">${rec.map(e => fila(e, ctx)).join('')}</ul>` : '';
    pintarElegidos();
    $('banco-cantidad').textContent = `${xs.length} ${xs.length === 1 ? 'ejercicio' : 'ejercicios'}`;
    document.querySelectorAll('#vista-banco .banco-filtro-casilla').forEach(l => l.classList.toggle('activo', Boolean(l.querySelector('input:checked'))));
    if (!xs.length) { $('banco-lista').innerHTML = base && !$('banco-mismos').hidden ? '' : '<p class="banco-vacio">No encontré ejercicios con esos filtros. Prueba otra palabra o elige Todos.</p>'; return; }
    const grupos = new Map();
    for (const e of xs) { const l = letra(e); if (!grupos.has(l)) grupos.set(l, []); grupos.get(l).push(e); }
    // En cada letra, primero los revisados; después los del banco ampliado (sin revisión).
    for (const es of grupos.values()) es.sort((a, b) => Number(Boolean(a.extra)) - Number(Boolean(b.extra)));
    // Cada letra lleva su alto aproximado: fuera de la pantalla no se diagrama (content-visibility en banco.css).
    $('banco-lista').innerHTML = [...grupos].map(([l, es]) => `<section class="banco-letra" aria-label="${esc(l)}" style="contain-intrinsic-size:auto ${es.length * 72 + 34}px"><h3 aria-hidden="true">${esc(l)}</h3><ul class="banco-grupo">${es.map(e => fila(e, ctx)).join('')}</ul></section>`).join('');
  };
  // La barra de abajo con lo elegido: "Agregar N ejercicios" y, con dos o más, "Como superserie".
  function pintarElegidos() {
    const barra = $('banco-elegidos');
    if (!barra) return;
    barra.hidden = !elegidos.size;
    barra.classList.toggle('reemplazo', Boolean(base));
    if (base) { barra.innerHTML = elegidos.size ? barraReemplazo([...elegidos][0]) : ''; return; }
    barra.innerHTML = elegidos.size ? `${elegidos.size > 1 && desde === 'hoy' ? '<button type="button" class="boton" data-agregar-elegidos="superserie">Como superserie</button>' : ''}<button type="button" class="boton primario" data-agregar-elegidos="juntos">Agregar ${elegidos.size === 1 ? '1 ejercicio' : `${elegidos.size} ejercicios`}</button>` : '';
  }
  // Reemplazar: cómo quedaría (las mismas series y repeticiones, el peso de tu historial y las series ya hechas, que se
  // guardan) y el alcance en los dos botones. Tocar uno es la confirmación (AGENTS.md, regla 10).
  function barraReemplazo(id) {
    const accion = { tipo: 'reemplazar_hoy', fecha: reemplazo.fecha, de: base.id, a: id, alcance: 'hoy' };
    const r = calcularCambio(accion, ctxNucleo());
    const hechas = (E.registro[reemplazo.fecha]?.[base.id] || []).filter(x => x?.hecho).length;
    const guardadas = hechas ? ` ${hechas === 1 ? 'La serie que ya hiciste se guarda' : `Las ${hechas} series que ya hiciste se guardan`}.` : '';
    const siguen = E.plan?.dias.some(d => d.fecha > reemplazo.fecha && d.ejercicios.some(e => e.ejercicio_id === base.id));
    return `<p class="banco-reemplazo-nota">${esc(r.error || r.propone)}${esc(guardadas)}</p>
      ${r.error ? '' : `<button type="button" class="boton primario" data-reemplazar="hoy">Solo hoy</button>${siguen ? '<button type="button" class="boton" data-reemplazar="adelante">Hoy y las que vienen</button>' : ''}`}`;
  }
  $('banco-elegidos')?.addEventListener('click', async ev => {
    const cambio = ev.target.closest('[data-reemplazar]');
    if (cambio && base) {
      const a = [...elegidos][0];
      cambio.disabled = true;
      const r = aplicarOpcion({ tipo: 'confirmar', accion: { tipo: 'reemplazar_hoy', fecha: reemplazo.fecha, de: base.id, a, alcance: cambio.dataset.reemplazar } }, ctxNucleo());
      if (!r.plan) { avisar(r.texto); cambio.disabled = false; return; }
      const aviso = await cambiarPlan(r.plan, r.texto, nube);
      if (aviso) avisar(aviso);
      elegidos.clear(); reemplazo = null;
      ir('hoy', { sesion: true, ej: a });
      return;
    }
    const b = ev.target.closest('[data-agregar-elegidos]');
    if (!b) return;
    b.disabled = true;
    const ids = [...elegidos];
    if (desde === 'rutina') { agregarARutina(ids); elegidos.clear(); ir('rutina'); return; }
    const agregados = await agregarVarios(ids, { superserie: b.dataset.agregarElegidos === 'superserie', despues: despuesDe });
    if (!agregados?.length) { b.disabled = false; return; }
    elegidos.clear();
    ir('hoy', { sesion: true, ej: agregados[0] });
  });
  $('banco-crear')?.addEventListener('click', ev => abrirCrear(ev.currentTarget));
  $('vista-banco').addEventListener('click', ev => {
    const b = ev.target.closest('[data-banco-elegir]');
    if (!b || b.disabled) return;
    const id = b.dataset.bancoElegir;
    // Al reemplazar se elige uno solo: tocar otro cambia la elección.
    const marcar = sel => document.querySelectorAll(sel).forEach(x => { const si = elegidos.has(x.dataset.bancoElegir); x.setAttribute('aria-pressed', String(si)); x.closest('.banco-item')?.classList.toggle('elegido', si); });
    if (base) { const ya = elegidos.has(id); elegidos.clear(); if (!ya) elegidos.add(id); marcar('#vista-banco .banco-item.elegido [data-banco-elegir]'); }
    else elegidos.has(id) ? elegidos.delete(id) : elegidos.add(id);
    marcar(`#vista-banco [data-banco-elegir="${CSS.escape(id)}"]`);
    pintarElegidos();
  });
  $('vista-banco').addEventListener('click', ev => {
    const ver = ev.target.closest(':is(#banco-recientes, #banco-mismos) [data-banco-ver]');
    if (ver) return ir('ejercicio', { id: ver.dataset.bancoVer, desde: 'banco' });
    const agregar = ev.target.closest('#banco-recientes [data-banco-agregar]');
    if (agregar && !agregar.disabled) proponerEdicion({ tipo: 'agregar', ejercicio: agregar.dataset.bancoAgregar }, { volver: agregar, alCambiar: () => ir('hoy', { sesion: true }) });
  });
  $('banco-volver').onclick = () => { elegidos.clear(); reemplazo = null; ir(desde, desde === 'hoy' ? { sesion: true } : undefined); };
  // Crear ejercicio, como la pantalla de Hevy: nombre y filas para el equipo, el músculo principal, otros músculos y el
  // tipo; cada fila abre su lista. Lo elegido se conserva mientras se va y vuelve de cada lista.
  const borrador = { nombre: '', equipo: [], principal: '', otros: [], clase: 'peso' };
  const nombreEq = q => EQUIPO[q] || mayuscula(q.replaceAll('_', ' ')), nombreMu = m => mayuscula(NOMBRE_MUSCULO[m] || m.replaceAll('_', ' '));
  const filaCrear = (id, titulo, valor, opcional) => `<button type="button" class="crear-fila" data-crear="${id}"><span><strong>${titulo}</strong><small class="${valor ? '' : 'crear-elegir'}">${esc(valor || 'Elegir')}${!valor && opcional ? ' (opcional)' : ''}</small></span>${icono('flecha', 'icono crear-flecha')}</button>`;
  function abrirCrear(volver) {
    abrirHoja({
      titulo: 'Crear ejercicio', volver,
      contenido: `<div class="crear-ejercicio">
        <input type="text" id="crear-nombre" class="crear-nombre" maxlength="60" placeholder="Nombre del ejercicio" value="${esc(borrador.nombre)}" aria-label="Nombre del ejercicio">
        ${filaCrear('equipo', 'Equipo', borrador.equipo.map(nombreEq).join(', ') || (borrador.equipo.length === 0 && borrador.tocoEquipo ? 'Sin equipo' : ''))}
        ${filaCrear('principal', 'Músculo principal', borrador.principal ? nombreMu(borrador.principal) : '')}
        ${filaCrear('otros', 'Otros músculos', borrador.otros.map(nombreMu).join(', '), true)}
        ${filaCrear('clase', 'Tipo de ejercicio', TIPOS_PROPIO[borrador.clase].nombre)}
        <p class="pequeno suave">Queda en este teléfono, en tu respaldo y, si entraste, en tu cuenta. Sin imagen ni técnica: es tuyo.</p>
      </div>`,
      opciones: [{ valor: 'guardar', icono: icono('visto'), clase: 'confirmar', nombre: 'Guardar' }],
      alElegir: () => {
        if (!borrador.principal) { avisar('Elige el músculo principal: así cuenta en tu semana y en Progreso.'); abrirCrear(volver); return; }
        const r = crearPropio({ nombre: borrador.nombre, clase: borrador.clase, musculos: [borrador.principal, ...borrador.otros.filter(m => m !== borrador.principal)].slice(0, 3), equipamiento: borrador.equipo }, indice);
        if (r.error) { avisar(r.error); abrirCrear(volver); return; }
        (E.ejerciciosPropios ||= []).push(r.ejercicio);
        texto = r.ejercicio.nombre; musculo = ''; equipo = '';
        Object.assign(borrador, { nombre: '', equipo: [], principal: '', otros: [], clase: 'peso', tocoEquipo: false });
        datoCambiado('ejercicios_propios');
        vistaBanco(ir, { desde });
        avisar(`Creaste "${r.ejercicio.nombre}". ${desde === 'hoy' ? 'Tócalo para elegirlo y agregarlo.' : 'Agrégalo a hoy desde la lista.'}`);
      },
    });
    const hoja = $('hoja');
    $('crear-nombre').oninput = ev => { borrador.nombre = ev.target.value; };
    if (!borrador.nombre) requestAnimationFrame(() => $('crear-nombre')?.focus());
    hoja.querySelectorAll('[data-crear]').forEach(b => b.onclick = () => {
      const que = b.dataset.crear;
      if (que === 'principal') abrirHoja({ titulo: 'Músculo principal', volver, opciones: musculos.map(m => ({ valor: m, icono: m === borrador.principal ? icono('visto') : '', clase: 'confirmar', nombre: nombreMu(m) })), alElegir: m => { borrador.principal = m; borrador.otros = borrador.otros.filter(x => x !== m); abrirCrear(volver); } });
      else if (que === 'clase') abrirHoja({ titulo: 'Tipo de ejercicio', volver, opciones: Object.entries(TIPOS_PROPIO).map(([k, t]) => ({ valor: k, icono: k === borrador.clase ? icono('visto') : '', clase: 'confirmar', nombre: t.nombre })), alElegir: k => { borrador.clase = k; abrirCrear(volver); } });
      else elegirVarios(que === 'equipo' ? 'Equipo' : 'Otros músculos', que === 'equipo' ? equipos.map(q => [q, nombreEq(q)]) : musculos.filter(m => m !== borrador.principal).map(m => [m, nombreMu(m)]),
        que === 'equipo' ? borrador.equipo : borrador.otros, que === 'otros' ? 2 : 0, xs => { if (que === 'equipo') { borrador.equipo = xs; borrador.tocoEquipo = true; } else borrador.otros = xs; abrirCrear(volver); }, volver);
    });
  }
  /** Una lista para marcar varios (con tope), y Listo. */
  function elegirVarios(titulo, items, actuales, tope, alListo, volver) {
    const sel = new Set(actuales);
    abrirHoja({ titulo, volver, nota: tope ? `Hasta ${tope}.` : 'Si no marcas nada, es sin equipo.',
      contenido: `<div class="elegir-varios">${items.map(([v, t]) => `<label class="ajuste-sesion"><span class="ajuste-cab"><strong>${esc(t)}</strong><input type="checkbox" class="interruptor" value="${esc(v)}"${sel.has(v) ? ' checked' : ''}></span></label>`).join('')}</div>`,
      opciones: [{ valor: 'listo', icono: icono('visto'), clase: 'confirmar', nombre: 'Listo' }],
      alElegir: () => alListo([...sel]) });
    $('hoja').querySelectorAll('.elegir-varios input').forEach(c => c.onchange = () => {
      if (c.checked && tope && sel.size >= tope) { c.checked = false; avisar(`Elige hasta ${tope}.`); return; }
      c.checked ? sel.add(c.value) : sel.delete(c.value);
    });
  }
  $('crear-propio').onclick = ev => abrirCrear(ev.currentTarget);
  $('banco-cardio').onclick = () => elegirCardio({ volver: $('banco-cardio'), alCambiar: () => ir('hoy') });
  $('banco-buscar').oninput = ev => { texto = ev.target.value; pintar(); };
  $('banco-fuera').onchange = ev => { soloFuera = ev.target.checked; pintar(); };
  $('banco-ampliado').onchange = ev => { conAmpliado = ev.target.checked; pintar(); };
  // Filtros como la hoja de Hevy: una cuadrícula con su imagen, "Limpiar filtros" y "Mostrar N resultados". Solo
  // aparecen las opciones que tienen resultados con lo demás elegido (como el filtro de equipo de OpenGym).
  const contar = (m, q) => buscarEjercicios(indice, { texto, musculo: m, equipo: q, nombresMusculos: NOMBRE_MUSCULO, nombresEquipos: EQUIPO }).length;
  document.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => {
    const tipo = b.dataset.filtro;
    let elegido = tipo === 'equipo' ? equipo : musculo;
    const lista = (tipo === 'equipo' ? equipos : musculos).filter(v => (tipo === 'equipo' ? contar(musculo, v) : contar(v, equipo)) > 0);
    const imagen = v => { const src = tipo === 'equipo' ? `img/equipos/${v}.webp` : `img/musculos/${v}.webp`; return IMAGENES.has(src) ? `<img src="${src}" alt="" width="48" height="48" loading="lazy">` : `<span class="filtro-letra">${esc((tipo === 'equipo' ? EQUIPO[v] || v : NOMBRE_MUSCULO[v] || v).charAt(0).toUpperCase())}</span>`; };
    const nombre = v => mayuscula(tipo === 'equipo' ? EQUIPO[v] || v.replaceAll('_', ' ') : NOMBRE_MUSCULO[v] || v);
    const total = () => (tipo === 'equipo' ? contar(musculo, elegido) : contar(elegido, equipo));
    abrirHoja({
      titulo: tipo === 'equipo' ? 'Equipo' : 'Músculos', volver: b,
      contenido: `<div class="filtro-cuadricula" role="radiogroup" aria-label="${tipo === 'equipo' ? 'Equipo' : 'Músculos'}">${lista.map(v => `<button type="button" role="radio" class="filtro-opcion" data-valor="${esc(v)}" aria-checked="${v === elegido}">${imagen(v)}<span>${esc(nombre(v))}</span></button>`).join('')}</div>
        <div class="filtro-pie"><button type="button" class="boton" data-filtro-limpiar>Limpiar filtros</button><button type="button" class="boton primario" data-filtro-mostrar>Mostrar ${total()} resultados</button></div>`,
      opciones: [], alElegir: () => {},
    });
    const hoja = $('hoja');
    const mostrar = hoja.querySelector('[data-filtro-mostrar]');
    hoja.querySelectorAll('.filtro-opcion').forEach(o => o.onclick = () => {
      elegido = elegido === o.dataset.valor ? '' : o.dataset.valor;
      hoja.querySelectorAll('.filtro-opcion').forEach(x => x.setAttribute('aria-checked', String(x.dataset.valor === elegido)));
      mostrar.textContent = `Mostrar ${total()} resultados`;
    });
    const aplicar = () => { if (tipo === 'equipo') equipo = elegido; else musculo = elegido; cerrarHoja(); vistaBanco(ir, { desde }); };
    mostrar.onclick = aplicar;
    hoja.querySelector('[data-filtro-limpiar]').onclick = () => { elegido = ''; musculo = ''; equipo = ''; cerrarHoja(); vistaBanco(ir, { desde }); };
  });
  $('banco-lista').onclick = ev => {
    const ver = ev.target.closest('[data-banco-ver]');
    if (ver) return ir('ejercicio', { id: ver.dataset.bancoVer, desde: 'banco' });
    const agregar = ev.target.closest('[data-banco-agregar]');
    if (agregar && !agregar.disabled) proponerEdicion({ tipo: 'agregar', ejercicio: agregar.dataset.bancoAgregar, despues: despuesDe }, { volver: agregar, alCambiar: () => ir('hoy') });
  };
  pintar();
  // El banco ampliado llega aparte (app/comun.js): cuando esté, se vuelve a dibujar la lista.
  if (!EXTRAS.length) asegurarExtras().then(() => { if ($('vista-banco')?.isConnected) pintar(); });
}
