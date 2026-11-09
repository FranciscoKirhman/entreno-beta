import { feedHtml, enlazarFeed, modeloFeed } from './feed.js';
// Entrenar: historias, sesión de hoy y actividad reciente. Las rutinas se abren con su botón.
// La sesión sigue en app/hoy.js; minimizada, queda una barra sobre el menú (app/mini-sesion.js).
import { E, esc, $, fechaCorta, indice, guardar, D, ahora, mostrarMensaje } from './comun.js';
import { checklist } from '../nucleo/suplementos.js';
import { avisoCheckin } from './checkin.js';
import { avisoDescargaCorto, avisoBloqueSiguiente, confirmarBloqueSiguiente } from './temporada.js';
import { descansoHtml } from './estados-visuales.js';
import { estadoHoy, empezarHoy } from './hoy.js';
import { proponerSesionVacia } from './sesion-libre-ui.js';
import { elegirCardio } from './cardio-ui.js';
import { proponer, elegirSesionDeHoy, hayOtraSesionParaHoy, ultimoCambioDeHoy, deshacerCambioDeHoy } from './cambios-ui.js';
import { abrirTiempo, minutosDeBoton } from './tiempo-ui.js';
import { sufijo } from '../nucleo/unidades.js';
import { sesionDe } from '../nucleo/agenda.js';
import { minutosDe } from './ritmo.js';
import { miniatura } from './imagenes.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';
import { abrirCambiosPlan, hayCambiosPlan } from './cambios-plan.js';
import { misRutinasHtml, enlazarRutinas } from './rutinas.js';
import { recordsPorSesion } from '../nucleo/records.js';
import { esAsistido } from '../nucleo/catalogo.js';
import { volumenTexto } from './comun.js';
import { filaHistoriasHtml, abrirPorId } from './historias.js';

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const nombreDia = iso => DIAS[new Date(iso + 'T12:00:00Z').getUTCDay()];
const nombreEj = e => e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || 'Ejercicio';
let rutinasAbiertas = false;
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
    <p class="pequeno suave rutina-datos">${esc(`${fechaCorta(d.fecha)} · ~${minutosDe(d)} min · ${d.ejercicios.length} ejercicio${d.ejercicios.length === 1 ? '' : 's'}`)}</p>
    ${boton}
  </li>`;
}

const dosisDe = e => `${e.series} × ${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${sufijo(e)}${e.carga_kg != null ? ` · ${String(e.carga_kg).replace('.', ',')} kg` : ''}`;

/**
 * Lo primero que se ve al tocar Entrenar: el entrenamiento de hoy, entero, sin abrir nada. Quien entra a entrenar no lee: lo
 * espera de inmediato (Francisco, 9 de noviembre de 2026). Arriba Empezar y, a la vista, Ajustar tiempo, que costaba
 * encontrar, y Cambiar sesión, para hacer hoy otra sin pasar por el chat. Ver un ejercicio no inicia la sesión.
 */
function hoyHtml(s) {
  const d = s.dia;
  if (!d) return descansoHtml(s.proxima, { compacta: true });
  if (s.hechaEnHevy) return `${s.registradoHtml}<button type="button" class="boton" data-ir-sesion>Ver la sesión del plan</button>`;
  const a = s.avance, hay = d.ejercicios.length > 0;
  const estado = s.enCurso ? `En curso · ${a.hechas} de ${a.total} series` : s.guardada ? 'Guardada hoy' : `${d.ejercicios.length} ejercicio${d.ejercicios.length === 1 ? '' : 's'}`;
  const cambio = ultimoCambioDeHoy();
  return `<section class="tarjeta hoy-entrenar">
    <div class="hoy-entrenar-cab">
      <h2 class="hoy-entrenar-titulo">${esc(d.foco)}</h2>
      <p class="pequeno suave">${esc(estado)}</p>
    </div>
    ${cambio ? `<p class="hoy-entrenar-cambio pequeno" role="status">${esc(cambio)} <button type="button" class="enlace" id="hoy-deshacer">Deshacer</button></p>` : ''}
    ${s.enCurso ? '<button type="button" class="boton primario grande" data-ir-sesion>Seguir la sesión</button>'
      : s.guardada ? '<button type="button" class="boton grande" data-ir-sesion>Ver la sesión</button>'
      : '<button type="button" class="boton primario grande" data-empezar-hoy>Empezar</button>'}
    ${hay && !s.guardada ? `<div class="hoy-entrenar-acciones">
      <button type="button" class="boton hoy-tiempo" id="hoy-ajustar-tiempo" aria-haspopup="dialog">${icono('reloj')}<span>Ajustar tiempo</span><b class="num">${esc(minutosDeBoton(d))}</b></button>
      ${!s.enCurso && hayOtraSesionParaHoy() ? `<button type="button" class="boton hoy-cambiar" id="hoy-otra-sesion" aria-haspopup="dialog">${icono('cambiar')}<span>Cambiar sesión</span></button>` : ''}
    </div>` : ''}
    ${hay ? `<ol class="hoy-entrenar-lista">${d.ejercicios.map(e => `<li><button type="button" data-ir-sesion="${esc(e.ejercicio_id || '')}" aria-label="${esc(`Ver ${nombreEj(e)} en la sesión de hoy`)}">${e.ejercicio_id ? miniatura(e.ejercicio_id) : '<span class="miniatura vacia"></span>'}<span><strong>${esc(nombreEj(e))}</strong><small class="num">${esc(dosisDe(e))}</small></span></button></li>`).join('')}
      ${d.cardio ? `<li class="hoy-entrenar-cardio pequeno suave">${esc(d.cardio)}</li>` : ''}</ol>` : ''}
  </section>`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Al empezar un mes, la celebración del anterior, como los logros mensuales de Hevy (julio de 2026). Una vez por mes. */
function mesHtml(f) {
  const d = new Date(f.slice(0, 8) + '01T12:00:00Z'); d.setUTCDate(0);
  const mes = d.toISOString().slice(0, 7);
  if (Number(f.slice(8)) > 7 || E.mesCelebrado === mes) return '';
  const xs = E.sesiones.filter(x => x.fecha.startsWith(mes));
  if (!xs.length) return '';
  const horas = Math.round(xs.reduce((a, x) => a + (Number(x.duracion_min) || 0), 0) / 6) / 10;
  const vol = xs.flatMap(x => x.series || []).filter(x => x.tipo !== 'calentamiento' && !esAsistido(indice.porId.get(x.ejercicio_id))).reduce((a, x) => a + (Number(x.carga_kg) || 0) * (Number(x.reps) || 0), 0);
  const recs = recordsPorSesion(E.sesiones, { asistidos: new Set(indice.ejercicios.filter(esAsistido).map(e => e.id)) });
  const nRec = xs.reduce((a, x) => a + ((x.id && recs.get(x.id)) || []).length, 0);
  const cifra = (v, t) => `<span><strong class="num">${v}</strong><small>${t}</small></span>`;
  return `<section class="tarjeta mes-cerrado" aria-label="${esc(`Tu ${MESES[d.getUTCMonth()]}`)}">
    <p class="sobretitulo">¡Cerraste ${MESES[d.getUTCMonth()]}!</p>
    <div class="mes-cifras">${cifra(xs.length, xs.length === 1 ? 'sesión' : 'sesiones')}${cifra(String(horas).replace('.', ','), 'horas')}${cifra(esc(volumenTexto(vol)), 'levantados')}${cifra(nRec, nRec === 1 ? 'récord' : 'récords')}</div>
    <div class="fila-botones"><button type="button" class="boton" id="mes-ver">Ver el resumen</button><button type="button" class="boton primario" id="mes-listo">Listo</button></div>
  </section>`;
}

export function vistaEntrenar(ir) {
  const s = estadoHoy();
  const feed = modeloFeed();
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
    <h1 class="sr-only">Entrenar</h1>
    <span class="sobretitulo">${esc(fecha)}</span>
    ${hoyHtml(s)}
    ${filaHistoriasHtml()}
    <div class="entrenar-herramientas"><button type="button" class="boton" id="abrir-rutinas" aria-expanded="${rutinasAbiertas}" aria-controls="rutinas-panel">Rutinas</button><button type="button" class="boton" id="sesion-vacia">Sesión vacía</button></div>
    <div id="rutinas-panel" class="rutinas-panel" ${rutinasAbiertas ? '' : 'hidden'}><h2 class="titulo-seccion">Rutinas</h2>
    <div class="botones-rutinas">
      <button type="button" class="boton fila-boton" data-rutina-nueva>${icono('mas')} Nueva rutina</button>
    </div>
    <section class="carpeta-rutinas">
      <button type="button" class="carpeta-cab" id="carpeta-plan" aria-expanded="${planAbierto}">${icono('flecha', `icono carpeta-flecha${planAbierto ? ' abierta' : ''}`)}<span>Tu plan, ${cual} (${semana.length})</span></button>
      ${planAbierto ? `<ul class="rutinas">${semana.map(d => rutinaHtml(d, s)).join('') || '<li class="pequeno suave">Esta semana no tiene sesiones.</li>'}</ul>` : ''}
      ${hayCambiosPlan() ? `<button type="button" class="enlace deshacer-plan" id="deshacer-plan">${icono('cambiar', 'icono icono-chico')} Deshacer un cambio del plan</button>` : ''}
    </section>
    ${misRutinasHtml()}</div>
    ${D().mensaje_alerta ? `<div class="aviso ojo">${esc(D().mensaje_alerta)}</div>` : ''}
    ${avisoCheckin()}
    ${avisoBloqueSiguiente()}
    ${avisoDescargaCorto()}
    ${mesHtml(s.f)}
    ${sups.length ? `<section class="tarjeta"><h3>Suplementos</h3><ul class="lista-check">${sups.map(x => `<li class="${x.estado}"><button type="button" class="check" data-toma="${x.suplemento_id}" ${x.estado === 'tomada' ? 'disabled aria-pressed="true"' : 'aria-pressed="false"'} aria-label="Marcar ${esc(x.nombre)} como tomado">${x.estado === 'tomada' ? '✓' : ''}</button><span>${esc(x.nombre)}${x.dosis ? ` · ${esc(x.dosis)}` : ''}</span><span class="suave pequeno">${x.hora || ''}${x.estado === 'atrasada' ? ' · atrasado' : ''}</span></li>`).join('')}</ul></section>` : ''}
    ${feedHtml(feed)}
  </div>`;
  const raiz = $('vista-entrenar');
  enlazarFeed(raiz, ir, () => vistaEntrenar(ir), feed);
  $('abrir-rutinas').onclick = ev => {
    rutinasAbiertas = !rutinasAbiertas;
    $('rutinas-panel').hidden = !rutinasAbiertas;
    ev.currentTarget.setAttribute('aria-expanded', String(rutinasAbiertas));
    ev.currentTarget.focus({ preventScroll: true });
  };
  raiz.querySelectorAll('[data-ir-sesion]').forEach(b => b.onclick = () => ir('hoy', { sesion: true, ...(b.dataset.irSesion ? { ej: b.dataset.irSesion } : {}) }));
  $('hoy-ajustar-tiempo')?.addEventListener('click', ev => abrirTiempo({ volver: ev.currentTarget, alCambiar: () => vistaEntrenar(ir) }));
  $('hoy-otra-sesion')?.addEventListener('click', ev => elegirSesionDeHoy({ volver: ev.currentTarget, alCambiar: () => vistaEntrenar(ir), alVacia: () => proponerSesionVacia({ alCambiar: () => { empezarHoy(); ir('hoy', { sesion: true }); } }) }));
  $('hoy-deshacer')?.addEventListener('click', () => deshacerCambioDeHoy(() => vistaEntrenar(ir)));
  // Las historias de la semana, el mes y el año (app/historias.js): al cerrar, el anillo deja de estar nuevo.
  raiz.querySelectorAll('[data-historia]').forEach(b => b.onclick = () => abrirPorId(b.dataset.historia, { volver: b, alCerrar: () => vistaEntrenar(ir) }));
  raiz.querySelectorAll('[data-empezar-hoy]').forEach(b => b.onclick = () => { empezarHoy(); ir('hoy', { sesion: true }); });
  // Hoy sin sesión y con ganas de entrenar: elegir aquí mismo, sin pasar por el chat (antes mandaba un mensaje al coach).
  $('entrenar-igual')?.addEventListener('click', ev => elegirSesionDeHoy({ volver: ev.currentTarget, alCambiar: () => vistaEntrenar(ir), alVacia: () => proponerSesionVacia({ alCambiar: () => { empezarHoy(); ir('hoy', { sesion: true }); } }) }));
  $('sesion-vacia').onclick = ev => proponerSesionVacia({ volver: ev.currentTarget, alCambiar: () => { empezarHoy(); ir('hoy', { sesion: true }); } });
  raiz.querySelectorAll('[data-elegir-cardio]').forEach(b => b.onclick = () => elegirCardio({ volver: b, alCambiar: () => ir('hoy', { sesion: true }) }));
  const cerrarMes = () => { const d = new Date(s.f.slice(0, 8) + '01T12:00:00Z'); d.setUTCDate(0); E.mesCelebrado = d.toISOString().slice(0, 7); guardar(); };
  $('mes-listo')?.addEventListener('click', () => { cerrarMes(); vistaEntrenar(ir); });
  $('mes-ver')?.addEventListener('click', () => { cerrarMes(); ir('progreso'); });
  enlazarRutinas(ir, () => vistaEntrenar(ir));
  $('deshacer-plan')?.addEventListener('click', ev => abrirCambiosPlan(ev.currentTarget, { alCambiar: () => vistaEntrenar(ir) }));
  $('abrir-revision')?.addEventListener('click', () => ir('coach', { revisar: true }));
  raiz.querySelectorAll('[data-ir-checkin]').forEach(b => b.onclick = () => ir('checkin', b.dataset.irCheckin));
  raiz.querySelectorAll('[data-ir-semana]').forEach(b => b.onclick = () => ir('semana'));
  raiz.querySelector('[data-bloque-siguiente]')?.addEventListener('click', ev => confirmarBloqueSiguiente({ volver: ev.currentTarget, alConfirmar: () => ir('semana') }));
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
