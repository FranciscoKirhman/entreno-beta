// Pestaña Entrenar, como la pestaña "Workout" de Hevy: arriba el inicio rápido y la sesión de hoy; abajo, tu plan
// como rutinas (cada sesión de la semana en una tarjeta con sus ejercicios y su botón). La sesión en sí es otra
// pantalla (app/hoy.js), sin pestañas abajo; minimizada, queda una barra sobre el menú (app/mini-sesion.js).
import { E, esc, $, fechaCorta, indice, guardar, D, ahora, mostrarMensaje } from './comun.js';
import { checklist } from '../nucleo/suplementos.js';
import { avisoCheckin } from './checkin.js';
import { avisoDescargaCorto } from './temporada.js';
import { descansoHtml } from './estados-visuales.js';
import { estadoHoy, empezarHoy } from './hoy.js';
import { proponerSesionVacia } from './sesion-libre-ui.js';
import { elegirCardio } from './cardio-ui.js';
import { proponer } from './cambios-ui.js';
import { sesionDe } from '../nucleo/agenda.js';
import { duracionSesion } from '../nucleo/motor-plan.js';
import { miniatura } from './imagenes.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';
import { abrirCambiosPlan, hayCambiosPlan } from './cambios-plan.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const nombreDia = iso => DIAS[new Date(iso + 'T12:00:00Z').getUTCDay()];
const nombreEj = e => e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || 'Ejercicio';
let planAbierto = true; // la carpeta "Tu plan" se pliega y despliega como las carpetas de Hevy

/** Lunes a domingo de la semana de f. */
function semanaDe(f) {
  const d = new Date(f + 'T12:00:00Z'), dow = (d.getUTCDay() + 6) % 7;
  const lunes = new Date(d); lunes.setUTCDate(d.getUTCDate() - dow);
  const domingo = new Date(lunes); domingo.setUTCDate(lunes.getUTCDate() + 6);
  return [lunes.toISOString().slice(0, 10), domingo.toISOString().slice(0, 10)];
}

/** Estado de un día del plan, en corto, para la tarjeta de rutina. */
function chipDia(d, s) {
  const e = s.reg.porDia.get(d.fecha);
  if (d.fecha === s.f) return s.enCurso ? '<span class="chip en-curso">En curso</span>' : s.guardada || s.hechaEnHevy ? '<span class="chip firme">Hecha ✓</span>' : '<span class="chip hoy">Hoy</span>';
  if (['hecha', 'recuperada', 'adelantada', 'hecha_sin_registro'].includes(e?.t)) return '<span class="chip firme">Hecha ✓</span>';
  if (d.fecha < s.f) return e?.t === 'reemplazada' ? '<span class="chip">Se repite</span>' : '<span class="chip">No se hizo</span>';
  return `<span class="chip">${esc(nombreDia(d.fecha))}</span>`;
}

/** Tarjeta de rutina, como Hevy: nombre, ⋯, los ejercicios en gris y el botón ancho. */
function rutinaHtml(d, s) {
  const nombres = d.ejercicios.map(nombreEj);
  const lista = nombres.length > 4 ? `${nombres.slice(0, 4).join(', ')} y ${nombres.length - 4} más` : nombres.join(', ');
  const esHoy = d.fecha === s.f;
  const hecha = /Hecha/.test(chipDia(d, s));
  const boton = esHoy ? (s.enCurso ? '<button type="button" class="boton primario" data-ir-sesion>Seguir la sesión</button>'
      : hecha ? '<button type="button" class="boton" data-ir-sesion>Ver la sesión</button>'
      : '<button type="button" class="boton primario" data-empezar-hoy>Empezar rutina</button>')
    : hecha || d.fecha < s.f ? '' : `<button type="button" class="boton primario" data-traer="${d.fecha}">Empezar rutina</button>`;
  return `<li class="rutina${esHoy ? ' es-hoy' : ''}">
    <div class="rutina-cab"><h3>${esc(d.foco)}</h3>${chipDia(d, s)}</div>
    <p class="pequeno suave rutina-ejercicios">${esc(lista || 'Sin ejercicios todavía')}</p>
    <p class="pequeno suave rutina-datos">${esc(`${fechaCorta(d.fecha)} · ~${duracionSesion(d)} min · ${d.ejercicios.length} ejercicio${d.ejercicios.length === 1 ? '' : 's'}`)}</p>
    ${boton}
  </li>`;
}

/** La sesión de hoy, grande: sus ejercicios con miniatura y Empezar (o Seguir). */
function hoyHtml(s) {
  const d = s.dia;
  if (!d) return descansoHtml(s.proxima);
  if (s.hechaEnHevy) return `${s.registradoHtml}<button type="button" class="boton" data-ir-sesion>Ver la sesión del plan</button>`;
  const a = s.avance;
  const estado = s.enCurso ? `En curso · ${a.hechas} de ${a.total} series` : s.guardada ? 'Guardada hoy' : `~${duracionSesion(d)} min · ${d.ejercicios.length} ejercicio${d.ejercicios.length === 1 ? '' : 's'}`;
  return `<section class="tarjeta hoy-entrenar">
    <button type="button" class="hoy-entrenar-abrir" data-ir-sesion aria-label="${esc(`Ver la sesión de hoy: ${d.foco}`)}">
      <span class="sobretitulo">Hoy</span>
      <span class="hoy-entrenar-titulo">${esc(d.foco)}</span>
      <span class="pequeno suave">${esc(estado)}</span>
    </button>
    <ul class="hoy-entrenar-lista">${d.ejercicios.slice(0, 5).map(e => `<li>${e.ejercicio_id ? miniatura(e.ejercicio_id) : '<span class="miniatura vacia"></span>'}<span><strong>${esc(nombreEj(e))}</strong><small>${esc(`${e.series} serie${e.series === 1 ? '' : 's'}`)}</small></span></li>`).join('')}
      ${d.ejercicios.length > 5 ? `<li class="hoy-entrenar-mas pequeno suave">y ${d.ejercicios.length - 5} más</li>` : ''}</ul>
    ${s.enCurso ? '<button type="button" class="boton primario grande" data-ir-sesion>Seguir la sesión</button>'
      : s.guardada ? '<button type="button" class="boton grande" data-ir-sesion>Ver la sesión</button>'
      : '<button type="button" class="boton primario grande" data-empezar-hoy>Empezar entrenamiento</button><button type="button" class="enlace" data-ir-sesion>Ver la sesión antes de empezar</button>'}
  </section>`;
}

export function vistaEntrenar(ir) {
  const s = estadoHoy();
  const plan = E.plan;
  // Esta semana; si ya no le queda ninguna sesión por delante (o el plan parte la próxima), la próxima.
  let [desde, hasta] = semanaDe(s.f), cual = 'esta semana';
  if (!(plan?.dias || []).some(d => d.fecha >= s.f && d.fecha <= hasta)) {
    const sig = new Date(hasta + 'T12:00:00Z'); sig.setUTCDate(sig.getUTCDate() + 1);
    [desde, hasta] = semanaDe(sig.toISOString().slice(0, 10)); cual = 'la próxima semana';
  }
  const semana = (plan?.dias || []).filter(d => d.fecha >= desde && d.fecha <= hasta);
  const sups = checklist(E.suplementos, E.tomas, s.f, ahora());
  const fecha = new Date(s.f + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  $('app').innerHTML = `<div id="vista-entrenar">
    <span class="sobretitulo">${esc(fecha)}</span>
    <h1>Entrenar</h1>
    ${hoyHtml(s)}
    <button type="button" class="boton fila-boton boton-vacia" id="sesion-vacia">${icono('mas')} Empezar sesión vacía</button>
    ${s.avisoSinRegistro}
    ${D().mensaje_alerta ? `<div class="aviso ojo">${esc(D().mensaje_alerta)}</div>` : ''}
    ${avisoCheckin()}
    ${avisoDescargaCorto()}
    <h2 class="titulo-seccion">Rutinas</h2>
    <div class="botones-rutinas">
      <button type="button" class="boton fila-boton" id="ver-plan">${icono('libro')} Tu plan</button>
      <button type="button" class="boton fila-boton" id="ver-semana">${icono('calendario')} La semana</button>
    </div>
    <section class="carpeta-rutinas">
      <button type="button" class="carpeta-cab" id="carpeta-plan" aria-expanded="${planAbierto}">${icono('flecha', `icono carpeta-flecha${planAbierto ? ' abierta' : ''}`)}<span>Tu plan, ${cual} (${semana.length})</span></button>
      ${planAbierto ? `<ul class="rutinas">${semana.map(d => rutinaHtml(d, s)).join('') || '<li class="pequeno suave">Esta semana no tiene sesiones.</li>'}</ul>` : ''}
      ${hayCambiosPlan() ? `<button type="button" class="enlace deshacer-plan" id="deshacer-plan">${icono('cambiar', 'icono icono-chico')} Deshacer un cambio del plan</button>` : ''}
    </section>
    ${sups.length ? `<section class="tarjeta"><h3>Suplementos</h3><ul class="lista-check">${sups.map(x => `<li class="${x.estado}"><button type="button" class="check" data-toma="${x.suplemento_id}" ${x.estado === 'tomada' ? 'disabled aria-pressed="true"' : 'aria-pressed="false"'} aria-label="Marcar ${esc(x.nombre)} como tomado">${x.estado === 'tomada' ? '✓' : ''}</button><span>${esc(x.nombre)}${x.dosis ? ` · ${esc(x.dosis)}` : ''}</span><span class="suave pequeno">${x.hora || ''}${x.estado === 'atrasada' ? ' · atrasado' : ''}</span></li>`).join('')}</ul></section>` : ''}
  </div>`;
  const raiz = $('vista-entrenar');
  raiz.querySelectorAll('[data-ir-sesion]').forEach(b => b.onclick = () => ir('hoy', { sesion: true }));
  raiz.querySelectorAll('[data-empezar-hoy]').forEach(b => b.onclick = () => { empezarHoy(); ir('hoy', { sesion: true }); });
  $('entrenar-igual')?.addEventListener('click', () => ir('coach', 'Hoy no tenía sesión pero quiero entrenar, ¿qué otra opción tienes?'));
  $('sesion-vacia').onclick = ev => proponerSesionVacia({ volver: ev.currentTarget, alCambiar: () => { empezarHoy(); ir('hoy', { sesion: true }); } });
  raiz.querySelectorAll('[data-elegir-cardio]').forEach(b => b.onclick = () => elegirCardio({ volver: b, alCambiar: () => ir('hoy', { sesion: true }) }));
  $('ver-semana').onclick = () => ir('semana');
  $('ver-plan').onclick = () => ir('plan');
  $('deshacer-plan')?.addEventListener('click', ev => abrirCambiosPlan(ev.currentTarget, { alCambiar: () => vistaEntrenar(ir) }));
  $('abrir-revision')?.addEventListener('click', () => ir('coach', { revisar: true }));
  raiz.querySelectorAll('[data-ir-checkin]').forEach(b => b.onclick = () => ir('checkin', b.dataset.irCheckin));
  raiz.querySelectorAll('[data-ir-semana]').forEach(b => b.onclick = () => ir('semana'));
  $('carpeta-plan').onclick = () => { planAbierto = !planAbierto; vistaEntrenar(ir); $('carpeta-plan')?.focus(); };
  // Hacer hoy otra sesión de la semana: el entrenador muestra cómo queda y pregunta (mover o intercambiar los días).
  raiz.querySelectorAll('[data-traer]').forEach(b => b.onclick = () => {
    const de = b.dataset.traer;
    const accion = sesionDe(E.plan, s.f) ? { tipo: 'intercambiar', fechas: [s.f, de] } : { tipo: 'mover', de, a: s.f };
    proponer(accion, { titulo: `Hacer hoy ${sesionDe(E.plan, de)?.foco || 'esta sesión'}`, volver: b, alCambiar: () => ir('hoy', { sesion: true }) });
  });
  raiz.querySelectorAll('[data-toma]').forEach(b => b.onclick = () => {
    E.tomas.push({ suplemento_id: b.dataset.toma, fecha: s.f, hora: ahora().slice(11) });
    guardar();
    if (nube.conectado()) nube.registrarToma(b.dataset.toma, s.f, ahora().slice(11)).catch(() => {});
    vistaEntrenar(ir);
  });
  mostrarMensaje();
}
