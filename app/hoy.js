// Vista Hoy, como en Hevy: check-in de bienestar, suplementos y la sesión del día con los músculos que entrenas (con
// sus imágenes), "Ajustar hoy" (poco tiempo, cansancio, no puedo, otra opción, dolor: siempre pregunta antes de cambiar) y
// cada ejercicio con su miniatura, su ficha (cómo se hace y por qué), el menú ⋯ y la tabla de series: tipo
// (calentamiento, normal, al fallo, drop set), lo de la vez anterior, cronómetro de descanso y superseries.
import { E, guardar, R, D, C, K, indice, hoy, ahora, esc, $, fechaCorta, ctxNucleo, escala, opcionesRadio, chk, cambiarPlan, numero, coma, mostrarMensaje, avisar, unidadPeso, enUnidad, aKilos, peso, volumenTexto, seriesTexto } from './comun.js';
import { estadoDelPlan } from '../nucleo/registrado.js';
import { evaluarDia, ajustarSesion, TEXTO_RECOMENDACION } from '../nucleo/bienestar.js';
import { checklist } from '../nucleo/suplementos.js';
import { enlaceVideo } from '../nucleo/explicar.js';
import { sesionDe } from '../nucleo/agenda.js';
import { duracionSesion, incrementoPara } from '../nucleo/motor-plan.js';
import { prioridadEsfuerzo, consejoSerie } from '../nucleo/series.js';
import { TIPOS_SERIE, tipoDe, etiquetas, cuantasFilas, anterior, cifras, tipoParaGuardar } from '../nucleo/registro.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { avisoCheckin } from './checkin.js';
import { avisoDescargaCorto } from './temporada.js';
import { subirACuenta } from './cola.js';
import { iniciarDescanso, detenerDescanso } from './descanso.js';
import { actualizarPantalla } from './pantalla.js';
import { abrirHoja } from './hoja.js';
import { grupos, unir, separar, copiarSuperseries, despuesDeSerie, etiquetaSuperserie } from '../nucleo/superseries.js';
import { icono } from './iconos.js';
import { miniatura } from './imagenes.js';
import { NOMBRE_MUSCULO, lista, mayuscula, imagenesMusculos } from './musculos.js';
import { preguntar, proponer, seguir } from './cambios-ui.js';
import { aplicarOpcion } from '../nucleo/coach.js';
import { nombreAsistente } from './cuestionario.js';
import * as nube from './nube.js';


const app = () => $('app');

export function vistaHoy(ir, extra) {
  const f = hoy();
  const plan = E.plan;
  if (!plan || plan.bloqueado) return ir('inicio');
  const dia = sesionDe(plan, f);
  const b = E.bienestar[f];
  const sups = checklist(E.suplementos, E.tomas, f, ahora());
  const proxima = plan.dias.find(d => d.fecha > f);
  // Lo registrado (en la app o importado de Hevy) dice qué sesión del plan se hizo y qué quedó pendiente.
  const reg = estadoDelPlan(plan, E.sesiones, { hoy: f, marcas: E.marcasPlan || {} });
  const hechaEnHevy = Boolean(dia) && reg.hoy.de === f && Boolean(reg.porDia.get(f)?.sesion?.origen);
  app().innerHTML = `<div id="vista-hoy">
    <span class="sobretitulo">${esc(new Date(f + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }))}</span>
    <h1>Hoy</h1>
    ${D().mensaje_alerta ? `<div class="aviso ojo">${esc(D().mensaje_alerta)}</div>` : ''}
    ${avisoCheckin()}
    ${avisoDescargaCorto()}
    ${pendientesHtml(reg)}
    ${bienestarHtml(f, b, dia)}
    ${sups.length ? `<section class="tarjeta"><h3>Suplementos</h3><ul class="lista-check">${sups.map((s, i) => `<li class="${s.estado}"><button type="button" class="check" data-toma="${s.suplemento_id}" ${s.estado === 'tomada' ? 'disabled aria-pressed="true"' : 'aria-pressed="false"'} aria-label="Marcar ${esc(s.nombre)} como tomado">${s.estado === 'tomada' ? '✓' : ''}</button><span>${esc(s.nombre)}${s.dosis ? ` · ${esc(s.dosis)}` : ''}</span><span class="suave pequeno">${s.hora || ''}${s.estado === 'atrasada' ? ' · atrasado' : ''}</span></li>`).join('')}</ul></section>` : ''}
    ${registradoHoyHtml(reg, dia, f, proxima)}
    ${dia ? (hechaEnHevy ? `<details class="extra plan-hecho" id="plan-hecho"${planHechoAbierto ? ' open' : ''}><summary>La sesión del plan, por si quieres anotar algo aquí</summary>${sesionHoy(dia)}</details>` : sesionHoy(dia)) : `<section class="tarjeta"><h3>Hoy descansas</h3>${proxima ? `<p class="suave">La próxima es ${esc(proxima.foco)}, el ${esc(fechaCorta(proxima.fecha))}.</p>` : ''}<button type="button" class="boton" id="entrenar-igual">Quiero entrenar hoy igual</button></section>`}
  </div>`;
  enlazar(ir, dia);
  enlazarPendientes(ir);
  actualizarPantalla(); // al marcar la primera serie se pide la pantalla encendida; al guardar la sesión, se suelta
  mostrarMensaje();
  // Al volver de la ficha de un ejercicio, la pantalla queda en ese ejercicio.
  if (extra?.ej) requestAnimationFrame(() => document.getElementById(`ej-${extra.ej}`)?.scrollIntoView({ block: 'center' }));
}

/** Sesiones del plan de los últimos 7 días que quedaron sin registro: la app pregunta qué pasó (como el tablero). */
function pendientesHtml(reg) {
  return reg.pendientes.slice(-2).reverse().map(d => `<section class="tarjeta pendiente-plan">
    <p class="sobretitulo">Quedó sin registro · ${esc(fechaCorta(d.fecha))}</p>
    <h3>${esc(d.foco)}</h3>
    <p class="pequeno suave">No hay una sesión registrada que se le parezca. ¿Qué pasó? Si la corres, te muestro cómo queda la semana antes de cambiar nada.</p>
    <div class="fila-botones"><button type="button" class="boton primario" data-pend-correr="${d.fecha}">Correrla</button><button type="button" class="boton" data-pend-hecha="${d.fecha}">La hice</button><button type="button" class="boton" data-pend-saltar="${d.fecha}">La salto</button></div>
  </section>`).join('');
}

/** Lo registrado hoy en Hevy (importado): qué sesión del plan fue, sus cifras y lo que viene. */
function registradoHoyHtml(reg, dia, f, proxima) {
  const importadas = reg.hoy.sesiones.filter(s => s.origen && s.origen !== 'ejemplo');
  if (!importadas.length) return '';
  const deDia = reg.hoy.de ? sesionDe(E.plan, reg.hoy.de) : null;
  const series = importadas.flatMap(s => s.series || []);
  const deTrabajo = x => !['calentamiento', 'drop', 'descarga'].includes(x.tipo);
  const trabajo = series.filter(deTrabajo);
  const volumen = trabajo.reduce((a, x) => a + (Number(x.carga_kg) || 0) * (Number(x.reps) || 0), 0);
  const porEj = [];
  for (const x of series) {
    const nombre = indice.porId.get(x.ejercicio_id)?.nombre || x.ejercicio_nombre || 'Ejercicio';
    let g = porEj.find(y => y.nombre === nombre);
    if (!g) porEj.push(g = { nombre, series: [] });
    g.series.push(x);
  }
  const texto = xs => {
    const conReps = xs.filter(x => deTrabajo(x) && x.reps != null);
    const minutos = Math.round(xs.reduce((a, x) => a + (Number(x.duracion_seg) || 0), 0) / 60);
    return [conReps.length ? seriesTexto(conReps) : '', minutos ? `${minutos} min` : ''].filter(Boolean).join(' · ') || 'anotado';
  };
  const nota = deDia && reg.hoy.de !== f ? `Es la del ${fechaCorta(reg.hoy.de)}${dia ? `; la de hoy, ${dia.foco}, sigue abajo` : ''}.`
    : reg.hoy.de === f && proxima ? `Después: ${proxima.foco}, el ${fechaCorta(proxima.fecha)}.` : '';
  return `<section class="tarjeta hecha-hoy">
    <p class="sobretitulo">Hoy · registrada en Hevy${importadas[0].hora ? ` a las ${esc(importadas[0].hora)}` : ''}</p>
    <h3>✓ ${esc(deDia?.foco || importadas[0].titulo || 'Entrenamiento')}</h3>
    <p class="pequeno suave">${trabajo.length} series de trabajo${volumen ? ` · volumen ${esc(volumenTexto(volumen))}` : ''}.${nota ? ` ${esc(nota)}` : ''}</p>
    <details class="extra"><summary>Ver lo que hiciste</summary><ul class="pequeno detalle-h">${porEj.map(g => {
      const cal = g.series.filter(x => x.tipo === 'calentamiento').length;
      return `<li><strong>${esc(g.nombre)}</strong>: ${esc(texto(g.series))}${cal ? ` <span class="suave">(+${cal} de calentamiento)</span>` : ''}</li>`;
    }).join('')}</ul></details>
  </section>`;
}

/** Respuestas a una sesión sin registro: la hice (sin anotarla), la salto, o correrla con vista previa. */
function enlazarPendientes(ir) {
  const marcar = (fecha, valor, aviso) => { (E.marcasPlan ||= {})[fecha] = valor; guardar(); vistaHoyMantener(ir); avisar(aviso); };
  document.querySelectorAll('[data-pend-hecha]').forEach(b => b.onclick = () => marcar(b.dataset.pendHecha, 'hecha', 'Anotado: la hiciste sin registrarla.'));
  document.querySelectorAll('[data-pend-saltar]').forEach(b => b.onclick = () => marcar(b.dataset.pendSaltar, 'saltada', 'Anotado: esa sesión se salta.'));
  document.querySelectorAll('[data-pend-correr]').forEach(b => b.onclick = () => proponer({ tipo: 'falte', fecha: b.dataset.pendCorrer },
    { titulo: 'Correr la sesión', volver: b, alCambiar: r => (r.ir === 'semana' ? ir('semana') : vistaHoyMantener(ir)) }));
}

// "¿Cómo estás hoy?": opcional y plegado desde el inicio. Cada botón guarda al tocarlo (sin "Listo"); con sueño, ánimo
// y energía respondidos se pliega solo y muestra el resumen. Un envío sin respuestas no cuenta.
const PREGUNTAS_B = [
  { campo: 'sueno_horas', texto: 'Dormí', opciones: [[5, '5 o menos'], [6, '6 h'], [7, '7 h'], [8, '8 h'], [9, '9 o más']] },
  { campo: 'animo', texto: 'Ánimo', opciones: [[1, 'Muy bajo'], [2, 'Bajo'], [3, 'Normal'], [4, 'Bien'], [5, 'Muy bien']] },
  { campo: 'cansancio', texto: 'Energía', opciones: [[5, 'Agotado'], [4, 'Cansado'], [3, 'Normal'], [2, 'Bien'], [1, 'Fresco']] },
];
const ENFERMO = [['no', 'No'], ['resfrio', 'Resfrío leve'], ['fiebre_o_cuerpo', 'Fiebre o cuerpo cortado']];
const PRINCIPALES = PREGUNTAS_B.map(p => p.campo);
const respondioAlgo = b => Boolean(b) && (PRINCIPALES.some(k => b[k] != null) || (b.enfermo && b.enfermo !== 'no'));
let bienestarAbierto = false; // sigue abierto mientras se responde, aunque la vista se vuelva a dibujar
let planHechoAbierto = false; // la sesión del plan ya hecha en Hevy, abierta para anotar algo: no se pliega en cada toque

function resumenBienestar(b) {
  const palabra = (campo, v) => PREGUNTAS_B.find(p => p.campo === campo).opciones.find(([x]) => x === v)?.[1];
  return [
    b.sueno_horas != null && `dormiste ${b.sueno_horas >= 9 ? '9 o más' : b.sueno_horas <= 5 ? '5 o menos' : b.sueno_horas} h`,
    b.animo != null && `ánimo ${palabra('animo', b.animo).toLowerCase()}`,
    b.cansancio != null && `energía ${palabra('cansancio', b.cansancio).toLowerCase()}`,
    b.enfermo && b.enfermo !== 'no' && ENFERMO.find(([v]) => v === b.enfermo)[1].toLowerCase(),
  ].filter(Boolean).join(' · ');
}

function bienestarHtml(f, b, dia) {
  const hay = respondioAlgo(b);
  const fila = p => `<div class="pregunta-b"><span class="pequeno suave">${p.texto}</span><div class="escala-b" role="group" aria-label="${p.texto}">${p.opciones.map(([v, t]) =>
    `<button type="button" data-b-campo="${p.campo}" data-b-valor="${v}" aria-pressed="${b?.[p.campo] === v}">${t}</button>`).join('')}</div></div>`;
  const aviso = hay && dia && b.recomendacion && b.recomendacion !== 'normal' && !b.aviso_visto
    ? `<div class="aviso ojo">${esc(b.motivos?.length ? `Por lo que contaste (${b.motivos.join(', ')}): ` : '')}${esc(TEXTO_RECOMENDACION[b.recomendacion])}
        <div class="fila-botones"><button type="button" class="boton primario" id="aplicar-bienestar">Ajustar la sesión</button><button type="button" class="boton" id="normal-igual">Hacerla normal igual</button></div></div>` : '';
  return `<details class="tarjeta bienestar-caja" id="bienestar-caja"${bienestarAbierto ? ' open' : ''}>
    <summary><span class="bienestar-titulo">${hay ? 'Hoy' : '¿Cómo estás hoy?'}</span><span class="pequeno suave bienestar-sub">${hay ? esc(resumenBienestar(b)) : 'Opcional · 10 segundos'}</span></summary>
    <div class="bienestar-rapido">
      ${PREGUNTAS_B.map(fila).join('')}
      <div class="pregunta-b"><span class="pequeno suave">¿Enfermo?</span><div class="escala-b tres" role="group" aria-label="¿Enfermo?">${ENFERMO.map(([v, t]) =>
        `<button type="button" data-b-campo="enfermo" data-b-valor="${v}" aria-pressed="${(b?.enfermo || 'no') === v && hay}">${t}</button>`).join('')}</div></div>
      <p class="pequeno suave">Se guarda al tocar. Ajusta la sesión de hoy si hace falta y, con el tiempo, cuándo toca descargar.</p>
    </div>
  </details>${aviso}`;
}

// ── Filas de cada ejercicio ─────────────────────────────────────────────────
const idDe = (e, k) => e.ejercicio_id || `i${k}`;
const deTrabajo = t => t === 'normal' || t === 'fallo';
const filasGuardadas = (f, id) => E.filas?.[f]?.[id] ?? null;
/** Las filas de un ejercicio hoy, sin huecos: las que dejó la persona o, si no tocó nada, las del plan. */
function filasDe(f, e, k) {
  const lista = E.registro[f]?.[idDe(e, k)] || [];
  return Array.from({ length: cuantasFilas(e, lista, filasGuardadas(f, idDe(e, k))) }, (_, i) => lista[i] || {});
}
/** Deja la lista del registro con una fila real por cada fila que se ve (para cambiar tipos, agregar o quitar). */
function materializar(f, e, k) {
  const id = idDe(e, k);
  const lista = ((E.registro[f] ||= {})[id] ||= []);
  const n = cuantasFilas(e, lista, filasGuardadas(f, id));
  lista.length = Math.max(lista.length, n);
  for (let j = 0; j < n; j++) lista[j] ||= {};
  lista.length = n;
  return { lista, n };
}
const fijarFilas = (f, id, n) => { ((E.filas ||= {})[f] ||= {})[id] = n; };
const descansoDe = (e, k) => E.descansos?.[idDe(e, k)] ?? e.descanso_seg ?? 90;
/** Descanso de la vuelta de una superserie: el que eligió en el último ejercicio o, si no, el más largo del plan. */
const descansoVuelta = (ejs, g) => { const u = ejs[g.miembros.at(-1)]; return E.descansos?.[idDe(u, g.miembros.at(-1))] ?? Math.max(...g.miembros.map(m => ejs[m].descanso_seg ?? 90)); };
const nombreDe = e => e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || '';
const mmss = seg => (seg ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}` : 'sin descanso');
const DESCANSOS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

// Paneles abiertos ("Cómo te fue"): siguen abiertos aunque la vista se vuelva a dibujar.
const abiertos = new Set();

/** RIR de una serie: un menú desplegable del teléfono, con cada opción dicha en simple. Encima se ve el número elegido
 *  o, en gris, la reserva que pide el plan (el menú queda transparente sobre la caja). */
const OPCIONES_RIR = [[0, '0: al fallo, no salía otra'], [1, '1: salía 1 más'], [2, '2: salían 2 más'], [3, '3: salían 3 más'], [4, '4: salían 4 más'], [5, '5: salían 5 o más']];
function cajaRir(id, i, rir, delPlan, etiqueta) {
  return `<label class="caja-rir"><span class="rir-valor${rir == null ? ' gris' : ''}" aria-hidden="true">${esc(rir ?? delPlan ?? '')}</span>
    <select data-ej="${id}" data-i="${i}" data-c="rir" aria-label="RIR, serie ${etiqueta}: cuántas repeticiones te quedaban">
      <option value=""${rir == null ? ' selected' : ''}>Sin anotar${delPlan != null ? ` (el plan pide ${delPlan})` : ''}</option>
      ${OPCIONES_RIR.map(([v, t]) => `<option value="${v}"${rir === v ? ' selected' : ''}>${t}</option>`).join('')}
    </select></label>`;
}

/** Series hechas y totales de la sesión, y sus cifras. */
function avance(dia) {
  const filas = dia.ejercicios.flatMap((e, k) => filasDe(dia.fecha, e, k));
  return { hechas: filas.filter(x => x.hecho).length, total: filas.length, cifras: cifras(filas) };
}
const avanceHtml = ({ hechas, total, cifras: c }) => `<div class="avance" id="avance" aria-live="polite">
  <div class="fila-avance"><span class="pequeno"><strong class="num">${hechas}</strong> de ${total} series${hechas && hechas === total ? ' · ¡completa!' : ''}</span><div class="medidor" aria-hidden="true"><i style="width:${total ? Math.round((hechas / total) * 100) : 0}%"></i></div></div>
  ${hechas ? `<p class="cifras pequeno suave">${c.minutos ? `${c.minutos} min · ` : ''}${c.series} de trabajo · volumen ${esc(volumenTexto(c.volumen))}</p>` : ''}
</div>`;

function sesionHoy(dia) {
  const f = dia.fecha;
  const notas = E.notas[f] || {};
  const todas = seriesAnotadas(E.sesiones, E.registro);
  const ejs = dia.ejercicios.map(e => indice.porId.get(e.ejercicio_id)).filter(Boolean);
  const prim = [...new Set(ejs.flatMap(ej => ej.musculos_primarios))];
  const sec = [...new Set(ejs.flatMap(ej => ej.musculos_secundarios))].filter(m => !prim.includes(m));
  const eligePeso = dia.ejercicios.some(e => /^Elige un peso/.test(e.nota || ''));
  return `<section class="tarjeta sesion-cab">
    <div class="fila-titulo"><div><h2>${esc(dia.foco)}</h2><p class="suave pequeno">${dia.hora ? `${esc(dia.hora)} · ` : ''}~${duracionSesion(dia)} min · ${dia.ejercicios.length} ejercicio${dia.ejercicios.length === 1 ? '' : 's'}</p></div>
      <button type="button" class="boton chico" id="ajustar-hoy">${icono('ajustes')} Ajustar hoy</button></div>
    ${dia.ejercicios.length ? avanceHtml(avance(dia)) : '<p>Hoy, descanso activo: 20 a 30 minutos de caminata o bicicleta suave y movilidad.</p>'}
    ${prim.length ? `<div class="hoy-entrenas">${imagenesMusculos(prim.slice(0, 4))}<div><p class="sobretitulo">Hoy entrenas</p><p class="musculos-hoy">${esc(mayuscula(lista(prim.map(m => NOMBRE_MUSCULO[m] || m))))}</p>${sec.length ? `<p class="pequeno suave">Y un poco de ${esc(lista(sec.map(m => (NOMBRE_MUSCULO[m] || m).toLowerCase())))}</p>` : ''}</div></div>` : ''}
    <p class="suave pequeno">${esc(dia.racional || '')}</p>
    ${eligePeso ? '<p class="nota-sesion pequeno">Donde no hay peso, elige uno con el que te sobren las repeticiones de reserva (RIR) en la última serie. Lo anotas y la app ajusta desde ahí.</p>' : ''}
    <details class="extra"><summary>Calentamiento</summary><ul class="pequeno">${(dia.calentamiento || []).map(c => `<li><strong>${esc(c.name)}</strong>. ${esc(c.how)}</li>`).join('')}</ul></details>
  </section>
  <ol class="ejercicios-hoy">${dia.ejercicios.map((e, k) => ejercicioHoy(e, k, f, e.ejercicio_id ? anterior(todas, e.ejercicio_id, f) : null, notas[idDe(e, k)] || {}, dia)).join('')}</ol>
  ${dia.cardio ? `<section class="tarjeta"><h3>Cardio</h3><p class="pequeno">${esc(dia.cardio)}</p></section>` : ''}
  <div class="fila-botones"><button type="button" class="boton primario grande" id="terminar">${E.sesiones.some(s => s.fecha === f && !s.origen) ? 'Guardar de nuevo' : 'Terminar sesión'}</button></div>`;
}

function ejercicioHoy(e, k, f, previas, nota, dia) {
  const id = idDe(e, k);
  const g = grupos(dia.ejercicios)[k];
  const ej = indice.porId.get(e.ejercicio_id);
  const filas = filasDe(f, e, k);
  const etiq = etiquetas(filas);
  const u = unidadPeso();
  const seg = e.unidad === 'seg';
  let iTrabajo = 0; // posición entre las series de trabajo, para mostrar lo de la vez anterior
  let kgHoy = null; // el último peso escrito hoy en una serie de trabajo: pasa a ser el gris de las siguientes
  const filasHtml = filas.map((r, i) => {
    const t = tipoDe(r);
    const trabajo = deTrabajo(t);
    const prev = trabajo ? previas?.series[iTrabajo++] : null;
    // En gris va lo que se guarda si marcas sin escribir: lo que ya levantaste hoy, el plan o la vez anterior.
    const kgGris = trabajo ? (kgHoy ?? e.carga_kg ?? prev?.carga_kg ?? null) : null;
    if (trabajo && r.kg != null) kgHoy = r.kg;
    const repsGris = seg ? e.reps_min : trabajo ? e.reps_max : null;
    const rir = r.rir ?? (r.rpe != null ? Math.max(0, 10 - r.rpe) : null);
    const antes = prev ? (seg ? `${prev.reps ?? ''} s` : `${prev.carga_kg != null ? `${coma(enUnidad(prev.carga_kg))} × ` : ''}${prev.reps ?? ''}`) : '';
    return `<div class="serie tipo-${t}${r.hecho ? ' hecha' : ''}${seg ? ' seg' : ''}">
      <button type="button" class="tipo-serie" data-tipo-serie="${id}" data-i="${i}" aria-label="Serie ${etiq[i]}, ${TIPOS_SERIE[t].nombre.toLowerCase()}. Cambiar el tipo">${etiq[i]}</button>
      <span class="antes num">${esc(antes)}</span>
      ${seg ? '' : `<input type="text" inputmode="decimal" autocomplete="off" data-ej="${id}" data-i="${i}" data-c="kg" value="${esc(coma(enUnidad(r.kg)))}" placeholder="${esc(coma(enUnidad(kgGris)))}" aria-label="${u === 'lb' ? 'Libras' : 'Kilos'}, serie ${etiq[i]}">`}
      <input type="text" inputmode="numeric" autocomplete="off" data-ej="${id}" data-i="${i}" data-c="reps" value="${esc(r.reps ?? '')}" placeholder="${esc(repsGris ?? '')}" aria-label="${seg ? 'Segundos' : 'Repeticiones'}, serie ${etiq[i]}">
      ${seg ? '' : trabajo ? cajaRir(id, i, rir, e.rir, etiq[i]) : '<span aria-hidden="true"></span>'}
      <button type="button" class="check" data-hecho="${id}" data-i="${i}" aria-pressed="${Boolean(r.hecho)}" aria-label="Serie ${etiq[i]} hecha">${r.hecho ? '✓' : ''}</button>
      ${r.consejo && trabajo ? `<p class="consejo ${r.consejo.tipo}">${esc(r.consejo.texto)}</p>` : ''}</div>`;
  }).join('');
  const preguntas = K.por_ejercicio.preguntas.filter(p => !p.mostrar_si || Object.entries(p.mostrar_si).every(([q, vals]) => vals.includes(nota[q])));
  // En una superserie, el descanso va al terminar la vuelta (se elige en el último ejercicio).
  const desc = g ? descansoVuelta(dia.ejercicios, g) : descansoDe(e, k);
  const descTexto = g && g.pos < g.total ? 'sin descanso, sigue la superserie' : `descanso ${mmss(desc)}`;
  const nombre = e.nombre || ej?.nombre || id;
  return `<li class="ej tarjeta${g ? ` en-superserie ss-${g.letra}${g.pos === 1 ? ' ss-inicio' : ''}` : ''}" id="ej-${id}">
    ${g?.pos === 1 ? `<p class="titulo-ss">Superserie ${g.letra} · sin descanso entre estos ${g.total}, descansas al terminar la vuelta</p>` : ''}
    <div class="ej-cab">
      ${ej ? `<button type="button" class="ej-abrir" data-ficha="${e.ejercicio_id}" aria-label="${esc(nombre)}: cómo se hace y por qué">${miniatura(e.ejercicio_id)}</button>` : `<span class="miniatura vacia"></span>`}
      <div class="ej-textos"><span class="nombre">${g ? `<span class="chip-ss">${etiquetaSuperserie(g)}</span>` : ''}${esc(nombre)}</span>
        <span class="ej-sub num">${esc(`${e.series} × ${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${seg ? ' s' : ''} · RIR ${e.rir}${e.carga_kg ? ` · ${peso(e.carga_kg)}` : ''} · ${descTexto}`)}</span>
        ${ej ? '' : '<span class="chip">Indicado por tu profesional</span>'}</div>
      ${ej ? `<button type="button" class="boton-icono" data-ficha="${e.ejercicio_id}" aria-label="Cómo se hace y por qué">${icono('info')}</button>` : ''}
      <button type="button" class="boton-icono" data-mas="${id}" aria-label="Más opciones de ${esc(nombre)}">${icono('puntos')}</button>
    </div>
    ${e.nota && !/^Elige un peso/.test(e.nota) ? `<p class="pequeno suave">${esc(e.nota)}</p>` : ''}
    <textarea class="nota-ej" rows="1" data-nota="${id}" data-p="nota" data-visible placeholder="Nota para tu entrenador" aria-label="Nota para tu entrenador sobre ${esc(nombre)}">${esc(nota.nota || '')}</textarea>
    <div class="tabla-series${seg ? ' seg' : ''}">
      <div class="cab-series"><span aria-hidden="true">Serie</span><span aria-hidden="true">Anterior</span>${seg ? '' : `<span aria-hidden="true">${u}</span>`}<span aria-hidden="true">${seg ? 'Seg' : 'Reps'}</span>${seg ? '' : '<button type="button" class="cab-rir" data-ayuda-rir aria-label="Qué es el RIR">RIR</button>'}<span aria-hidden="true">${icono('visto', 'icono icono-chico')}</span></div>
      ${filasHtml}
    </div>
    <button type="button" class="boton agregar-serie" data-agregar="${id}">+ Agregar serie</button>
    <details class="extra" data-panel="nota-${id}"${Object.keys(nota).some(k => !['nota', 'para_entrenador'].includes(k)) || abiertos.has(`nota-${id}`) ? ' open' : ''}><summary>Cómo te fue</summary>
      <div class="preguntas-ej">
        ${preguntas.map(p => `<div><span class="pequeno">${esc(p.texto)}</span>${p.tipo === 'escala'
          ? escala(`n-${id}-${p.id}`, p.min, p.max, nota[p.id], p.extremos, `data-nota="${id}" data-p="${p.id}" data-num`)
          : opcionesRadio(`n-${id}-${p.id}`, p.zonas ? [] : p.opciones, nota[p.id], `data-nota="${id}" data-p="${p.id}"`)}${p.zonas ? `<select data-nota="${id}" data-p="${p.id}"><option value="">Elige</option>${C.zonas[p.zonas].map(([z, t]) => `<option value="${z}"${nota[p.id] === z ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}</div>`).join('')}
        <label class="pequeno"><input type="checkbox" data-nota="${id}" data-p="para_entrenador"${chk(nota.para_entrenador)}> Que la vea mi entrenador</label>
      </div>
    </details>
  </li>`;
}

function enlazar(ir, dia) {
  const f = hoy();
  $('bienestar-caja')?.addEventListener('toggle', ev => { bienestarAbierto = ev.target.open; });
  $('plan-hecho')?.addEventListener('toggle', ev => { planHechoAbierto = ev.target.open; });
  document.querySelectorAll('[data-b-campo]').forEach(boton => boton.onclick = async () => {
    const campo = boton.dataset.bCampo;
    const valor = campo === 'enfermo' ? boton.dataset.bValor : Number(boton.dataset.bValor);
    const antes = E.bienestar[f] || {};
    const datos = { sueno_horas: null, sueno_calidad: null, cansancio: null, animo: null, enfermo: 'no', ...antes, [campo]: antes[campo] === valor && campo !== 'enfermo' ? null : valor };
    const r = evaluarDia(datos);
    const { aviso_visto, motivos, puntaje, recomendacion, enCuenta, ...limpio } = datos;
    E.bienestar[f] = { ...limpio, puntaje: r.puntaje, recomendacion: r.recomendacion, motivos: r.motivos };
    if (!respondioAlgo(E.bienestar[f])) delete E.bienestar[f];
    // Con sueño, ánimo y energía respondidos, la tarjeta se pliega sola.
    bienestarAbierto = !PRINCIPALES.every(k => E.bienestar[f]?.[k] != null);
    guardar();
    vistaHoyMantener(ir);
    if (nube.conectado() && E.bienestar[f]) {
      const { motivos: m, ...subir } = E.bienestar[f];
      subirACuenta('bienestar', f, subir).catch(() => {});
    }
  });
  $('aplicar-bienestar')?.addEventListener('click', async () => {
    const b = E.bienestar[f];
    b.aviso_visto = true;
    const nuevo = structuredClone(E.plan);
    sesionDe(nuevo, f).ejercicios = ajustarSesion(sesionDe(nuevo, f).ejercicios, b.recomendacion).map((e, i) => ({ ...e, orden: i }));
    await cambiarPlan(nuevo, `Sesión de hoy ajustada: ${TEXTO_RECOMENDACION[b.recomendacion]}`, nube);
    vistaHoy(ir);
  });
  $('normal-igual')?.addEventListener('click', () => { E.bienestar[f].aviso_visto = true; guardar(); vistaHoyMantener(ir); });
  document.querySelectorAll('[data-toma]').forEach(b => b.onclick = () => {
    E.tomas.push({ suplemento_id: b.dataset.toma, fecha: f, hora: ahora().slice(11) });
    guardar();
    if (nube.conectado()) nube.registrarToma(b.dataset.toma, f, ahora().slice(11)).catch(() => {});
    vistaHoy(ir);
  });
  document.querySelectorAll('[data-ir-checkin]').forEach(b => b.onclick = () => ir('checkin', b.dataset.irCheckin));
  document.querySelectorAll('[data-ir-semana]').forEach(b => b.onclick = () => ir('semana'));
  $('entrenar-igual')?.addEventListener('click', () => ir('coach', 'Hoy no tenía sesión pero quiero entrenar, ¿qué otra opción tienes?'));
  if (!dia) return;

  const raiz = $('vista-hoy');
  const repintar = () => vistaHoyMantener(ir);
  const ejercicioDe = id => { const k = dia.ejercicios.findIndex((x, j) => idDe(x, j) === id); return { e: dia.ejercicios[k], k }; };
  const lugar = (R().lugares || [])[0];
  /** Consejo para la serie siguiente (nucleo/series.js), según reps, esfuerzo y fallo. Solo en las de trabajo. */
  const consejo = (e, r) => {
    const ej = indice.porId.get(e.ejercicio_id);
    return deTrabajo(tipoDe(r)) ? consejoSerie(e, { ...r, fallo: tipoDe(r) === 'fallo' }, ej ? incrementoPara(ej, lugar) : null) : null;
  };

  // Escribir kilos (o libras) y repeticiones: se guarda en kilos, sin volver a dibujar.
  raiz.addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset.ej && ['kg', 'reps', 'rir'].includes(t.dataset.c)) {
      const { e, k } = ejercicioDe(t.dataset.ej);
      const { lista } = materializar(f, e, k);
      const v = numero(t.value);
      const r = { ...lista[t.dataset.i] };
      if (t.dataset.c === 'rir') {
        // La reserva se escribe como RIR (0 a 5) y se guarda también como RPE, que usa el resto de la app.
        const rir = v == null ? null : Math.max(0, Math.min(5, Math.round(v)));
        r.rir = rir; r.rpe = rir == null ? null : 10 - rir;
        if (r.hecho) r.consejo = consejo(e, r);
      } else r[t.dataset.c] = t.dataset.c === 'kg' ? aKilos(v) : v;
      lista[t.dataset.i] = r;
      guardar();
    } else if (t.dataset.nota && t.tagName === 'TEXTAREA') {
      if (t.dataset.visible !== undefined) {
        t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`;
        const n = (E.notas[f] ||= {})[t.dataset.nota] ||= {};
        if (n.para_entrenador === undefined && t.value.trim()) n.para_entrenador = true; // es una nota para el entrenador
      }
      guardarNota(t.dataset.nota, 'nota', t.value);
    }
  });
  // Al terminar de escribir el RIR de una serie hecha, se actualiza el consejo para la siguiente.
  raiz.addEventListener('change', ev => { if (ev.target.dataset.c === 'rir') repintar(); }); // el menú del RIR ya guardó con 'input'
  raiz.querySelectorAll('textarea.nota-ej').forEach(t => { if (t.value) { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; } });
  $('vista-hoy').querySelectorAll('[data-ayuda-rir]').forEach(b => b.onclick = () => abrirHoja({
    titulo: 'RIR: repeticiones en reserva', volver: b,
    nota: 'Cuántas repeticiones más te salían con buena técnica. 0 es al fallo, 2 es que te quedaban 2. En gris está la reserva que pide el plan; escribe la real.',
    opciones: [{ valor: 'ok', icono: icono('visto'), clase: 'confirmar', nombre: 'Entendido' }], alElegir: () => {},
  }));

  // Tocar el número de la serie: elegir el tipo (como en Hevy), con una explicación detrás de cada "?".
  raiz.querySelectorAll('[data-tipo-serie]').forEach(b => b.onclick = () => {
    const { e, k } = ejercicioDe(b.dataset.tipoSerie);
    const i = Number(b.dataset.i);
    abrirHoja({
      titulo: 'Tipo de serie', volver: b,
      opciones: [
        ...Object.entries(TIPOS_SERIE).map(([valor, x]) => ({ valor, letra: x.letra || '1', clase: `tipo-${valor}`, nombre: x.nombre, ayuda: x.ayuda })),
        ...(e.ejercicio_id ? [{ valor: 'superserie', letra: 'S', clase: 'tipo-superserie', nombre: grupos(dia.ejercicios)[k] ? `Superserie ${grupos(dia.ejercicios)[k].letra}` : 'Superserie',
          ayuda: 'Une este ejercicio con otro, sin descanso entre ellos: descansas al terminar la vuelta. Se aplica al ejercicio completo.' }] : []),
        { valor: 'quitar', letra: '✕', clase: 'quitar', nombre: 'Quitar la serie', peligro: true },
      ],
      alElegir: t => {
        if (t === 'superserie') { superserie(idDe(e, k), b); return; }
        const { lista, n } = materializar(f, e, k);
        if (t === 'quitar') { lista.splice(i, 1); fijarFilas(f, idDe(e, k), n - 1); }
        else {
          const r = { ...lista[i], tipo: t };
          delete r.fallo;
          if (t === 'fallo') { r.rpe = 10; r.rir = 0; }
          else if (r.rpe === 10) { r.rpe = null; r.rir = null; }
          if (!deTrabajo(t)) { delete r.rpe; delete r.rir; delete r.consejo; }
          if (r.hecho) r.consejo = consejo(e, r);
          lista[i] = r;
        }
        guardar(); repintar();
      },
    });
  });

  // Superserie: unir este ejercicio con otro del día (o sacarlo). Se repite en este mismo día de las semanas siguientes.
  const superserie = (id, b) => {
    const { e, k } = ejercicioDe(id);
    const g = grupos(dia.ejercicios);
    const otros = dia.ejercicios.map((x, j) => ({ x, j })).filter(({ x, j }) => j !== k && x.ejercicio_id && !(g[k] && g[j]?.letra === g[k].letra));
    abrirHoja({
      titulo: g[k] ? `Superserie ${g[k].letra}` : 'Hacer superserie',
      nota: 'Dos o más ejercicios seguidos, sin descanso entre ellos: descansas al terminar la vuelta. Ahorra tiempo y va mejor con ejercicios que no usan los mismos músculos, como bíceps con tríceps o pecho con espalda.',
      volver: b,
      opciones: [
        ...otros.map(({ x, j }) => ({ valor: String(j), letra: g[j] ? etiquetaSuperserie(g[j]) : '+', nombre: `${g[k] ? 'Sumar' : 'Con'} ${nombreDe(x)}` })),
        ...(g[k] ? [{ valor: 'separar', letra: '✕', clase: 'quitar', nombre: 'Sacar de la superserie', peligro: true }] : []),
      ],
      alElegir: async v => {
        const nuevo = structuredClone(E.plan);
        const d = sesionDe(nuevo, f);
        d.ejercicios = v === 'separar' ? separar(d.ejercicios, k) : unir(d.ejercicios, k, Number(v));
        const futuros = nuevo.dias.filter(x => x.plantilla && x.plantilla === d.plantilla && x.fecha > f);
        for (const x of futuros) x.ejercicios = copiarSuperseries(d.ejercicios, x.ejercicios);
        const otro = v === 'separar' ? null : nombreDe(dia.ejercicios[Number(v)]);
        await cambiarPlan(nuevo, v === 'separar' ? `${nombreDe(e)} salió de la superserie.` : `Superserie: ${nombreDe(e)} con ${otro}${futuros.length ? ', también en las próximas semanas' : ''}.`, nube);
        repintar();
      },
    });
  };

  // Agregar una serie al final, o un calentamiento al principio.
  const agregarFila = (id, calentar) => {
    const { e, k } = ejercicioDe(id);
    const { lista, n } = materializar(f, e, k);
    if (calentar) lista.unshift({ tipo: 'calentamiento' }); else lista.push({});
    fijarFilas(f, idDe(e, k), n + 1);
    guardar(); repintar();
  };
  raiz.querySelectorAll('[data-agregar]').forEach(b => b.onclick = () => agregarFila(b.dataset.agregar, false));

  // Marcar una serie: si no escribió nada, toma lo de la serie anterior de hoy, lo de la vez anterior o lo del plan.
  raiz.querySelectorAll('[data-hecho]').forEach(b => b.onclick = () => {
    const { e, k } = ejercicioDe(b.dataset.hecho);
    const i = Number(b.dataset.i);
    const { lista, n } = materializar(f, e, k);
    const r = { ...lista[i] };
    const t = tipoDe(r);
    if (!r.hecho && deTrabajo(t)) {
      const posicion = lista.slice(0, i).filter(x => deTrabajo(tipoDe(x))).length;
      const prev = e.ejercicio_id ? anterior(seriesAnotadas(E.sesiones, E.registro), e.ejercicio_id, f)?.series[posicion] : null;
      const hoyAntes = [...lista.slice(0, i)].reverse().find(x => deTrabajo(tipoDe(x)) && x.kg != null);
      if (r.kg == null && e.unidad !== 'seg') r.kg = hoyAntes?.kg ?? e.carga_kg ?? prev?.carga_kg ?? null;
      if (r.reps == null) r.reps = (e.unidad === 'seg' ? e.reps_min : e.reps_max) ?? prev?.reps ?? null;
    }
    if (!r.hecho) r.t ||= Date.now();
    r.hecho = !r.hecho;
    r.consejo = r.hecho ? consejo(e, r) : null;
    lista[i] = r;
    guardar();
    // Descanso hasta la serie siguiente (sin descanso antes de un drop set); con la última de la sesión, guardarla.
    const a = avance(dia);
    if (r.hecho && a.hechas === a.total) { detenerDescanso(); avisar('¡Sesión completa! Toca "Terminar sesión" para guardarla.'); }
    else if (r.hecho) {
      const quedan = lista.slice(0, n).filter(x => !x.hecho).length;
      const seg = t === 'calentamiento' ? Math.min(60, descansoDe(e, k)) : descansoDe(e, k);
      const g = grupos(dia.ejercicios);
      if (i + 1 < n && tipoDe(lista[i + 1]) === 'drop') detenerDescanso();
      else if (g[k] && t !== 'calentamiento') {
        // Superserie: sin descanso hasta el último ejercicio de la vuelta; ahí, el descanso de la vuelta.
        const pendientes = dia.ejercicios.map((x, j) => filasDe(f, x, j).filter(y => !y.hecho).length);
        const sig = despuesDeSerie(dia.ejercicios, k, pendientes);
        const quien = j => `${etiquetaSuperserie(g[j])} ${nombreDe(dia.ejercicios[j])}`;
        const vuelta = descansoVuelta(dia.ejercicios, g[k]);
        if (!sig.descansar) { detenerDescanso(); avisar(`Superserie: sigue con ${quien(sig.siguiente)}, sin descanso.`); }
        else if (vuelta) {
          document.getElementById('aviso-flotante')?.classList.remove('visible');
          iniciarDescanso(vuelta, sig.siguiente != null ? `Descanso · vuelve a ${etiquetaSuperserie(g[sig.siguiente])}` : 'Descanso · sigue otro ejercicio');
        }
      } else if (seg) iniciarDescanso(seg, quedan ? `Descanso · falta${quedan === 1 ? '' : 'n'} ${quedan} serie${quedan === 1 ? '' : 's'}` : 'Descanso · sigue otro ejercicio');
    } else detenerDescanso();
    repintar();
  });

  raiz.addEventListener('change', ev => {
    const t = ev.target;
    if (!t.dataset.nota || t.tagName === 'TEXTAREA') return;
    const v = t.type === 'checkbox' ? t.checked : t.dataset.num !== undefined ? Number(t.value) : t.value;
    guardarNota(t.dataset.nota, t.dataset.p, v);
    if (t.dataset.p === 'molestia') repintar();
  });
  function guardarNota(id, p, v) { ((E.notas[f] ||= {})[id] ||= {})[p] = v; guardar(); }
  raiz.querySelectorAll('details[data-panel]').forEach(d => d.addEventListener('toggle', () => { d.open ? abiertos.add(d.dataset.panel) : abiertos.delete(d.dataset.panel); }));

  // Ficha del ejercicio: cómo se hace, qué trabaja, tus marcas, por qué está en tu plan y alternativas.
  raiz.querySelectorAll('[data-ficha]').forEach(b => b.onclick = () => ir('ejercicio', { id: b.dataset.ficha, desde: 'hoy' }));

  // Menú ⋯ de cada ejercicio.
  raiz.querySelectorAll('[data-mas]').forEach(b => b.onclick = () => {
    const id = b.dataset.mas;
    const { e, k } = ejercicioDe(id);
    const ej = indice.porId.get(e.ejercicio_id);
    const g = grupos(dia.ejercicios)[k];
    // En una superserie, el descanso es el de la vuelta y se elige en el último ejercicio.
    const idDescanso = g ? idDe(dia.ejercicios[g.miembros.at(-1)], g.miembros.at(-1)) : id;
    const desc = g ? descansoVuelta(dia.ejercicios, g) : descansoDe(e, k);
    const lesiones = (R().lesiones || []).filter(l => l.activa !== false).map(l => l.region);
    abrirHoja({
      titulo: nombreDe(e), volver: b,
      opciones: [
        ...(ej ? [{ valor: 'ficha', icono: icono('libro'), nombre: 'Cómo se hace y por qué' }] : []),
        ...(ej ? [{ valor: 'cambiar', icono: icono('cambiar'), nombre: 'Cambiar este ejercicio' }] : []),
        { valor: 'calentar', icono: icono('fuego'), clase: 'tipo-calentamiento', nombre: 'Agregar serie de calentamiento' },
        { valor: 'descanso', icono: icono('reloj'), nombre: `Descanso: ${mmss(desc)}${g ? ' (al terminar la vuelta)' : ''}` },
        ...(ej ? [{ valor: 'superserie', icono: icono('cadena'), nombre: g ? `Superserie ${g.letra}` : 'Hacer superserie' }] : []),
        ...(ej && e.unidad !== 'seg' ? [{ valor: 'prioriza', icono: icono('objetivo'), nombre: 'Si no me salen las repeticiones' }] : []),
        ...(ej ? [{ valor: 'video', icono: icono('video'), nombre: 'Ver videos de técnica' }] : []),
        { valor: 'preguntar', icono: icono('chat'), nombre: `Preguntar a ${nombreAsistente()}` },
        ...(ej ? [{ valor: 'nunca', icono: icono('cerrar'), clase: 'quitar', nombre: 'No volver a hacer este ejercicio', peligro: true }] : []),
      ],
      alElegir: v => {
        if (v === 'ficha') ir('ejercicio', { id: e.ejercicio_id, desde: 'hoy' });
        else if (v === 'cambiar') proponer({ tipo: 'elegir_alternativa', fecha: f, ejercicio: e.ejercicio_id }, { titulo: `Cambiar ${nombreDe(e)}`, volver: b, alCambiar: repintar });
        else if (v === 'calentar') agregarFila(id, true);
        else if (v === 'superserie') superserie(id, b);
        else if (v === 'prioriza') abrirHoja({ titulo: 'Si no te salen las repeticiones', nota: prioridadEsfuerzo(e, ej, D(), lesiones).texto, volver: b, opciones: [{ valor: 'ok', icono: icono('visto'), clase: 'confirmar', nombre: 'Entendido' }], alElegir: () => {} });
        else if (v === 'video') window.open(enlaceVideo(ej), '_blank', 'noopener');
        else if (v === 'preguntar') ir('coach', { ejercicio: e.ejercicio_id, nombre: nombreDe(e) });
        else if (v === 'nunca') noVolver(e, b);
        else if (v === 'descanso') abrirHoja({
          titulo: g ? `Descanso de la superserie ${g.letra}` : 'Descanso entre series', volver: b,
          nota: g ? 'Se descansa al terminar la vuelta, no entre los ejercicios de la superserie.' : 'El cronómetro parte solo al marcar una serie.',
          opciones: DESCANSOS.map(x => ({ valor: String(x), icono: x === desc ? icono('visto') : '', clase: 'confirmar', nombre: x ? mmss(x) : 'Sin descanso' })),
          alElegir: x => { (E.descansos ||= {})[idDescanso] = Number(x); guardar(); repintar(); },
        });
      },
    });
  });

  // No volver a hacer un ejercicio: queda en "prohibidos" (los planes nuevos no lo usan) y se cambia desde hoy en
  // adelante por el que elija la persona. Elegir el reemplazo es la confirmación del cambio.
  const noVolver = (e, b) => {
    const nombre = nombreDe(e);
    abrirHoja({
      titulo: `¿No volver a hacer ${nombre}?`, volver: b,
      nota: 'Lo cambio por otro parecido desde hoy en adelante y no vuelve a aparecer en tus planes nuevos. Puedes volver a permitirlo en Más, Completar mi perfil.',
      opciones: [{ valor: 'si', icono: icono('cerrar'), clase: 'quitar', nombre: 'Sí, no volver a hacerlo', peligro: true }, { valor: 'no', icono: icono('flecha'), nombre: 'No, dejarlo' }],
      alElegir: v => {
        if (v !== 'si') return;
        // Queda fuera de los planes nuevos recién cuando se confirma el reemplazo (o si no hay con qué reemplazarlo).
        const prohibir = () => {
          const r = R();
          r.prohibidos = [...new Set([...(r.prohibidos || []), e.ejercicio_id])];
          guardar();
          if (nube.conectado()) nube.guardarCuestionario(r).catch(() => {});
        };
        const alt = aplicarOpcion({ tipo: 'elegir_alternativa', fecha: f, ejercicio: e.ejercicio_id }, ctxNucleo());
        if (!alt.opciones?.length) { prohibir(); avisar(`${nombre} no vuelve a aparecer en tus planes nuevos. ${alt.texto}`); return; }
        seguir({ texto: `Desde hoy en adelante, en vez de ${nombre}:`, opciones: alt.opciones.map(o => ({ etiqueta: o.etiqueta, accion: { tipo: 'confirmar', accion: { ...o.accion, alcance: 'adelante' } } })) },
          { titulo: `En vez de ${nombre}`, volver: b, alCambiar: () => { prohibir(); repintar(); } });
      },
    });
  };

  // Ajustar hoy: lo mismo que contarle al entrenador, con la vista previa y la confirmación en hojas.
  $('ajustar-hoy').onclick = () => {
    const b = $('ajustar-hoy');
    const min = duracionSesion(dia);
    const listo = r => (r.ir === 'semana' ? ir('semana') : repintar());
    const o = { titulo: 'Ajustar hoy', volver: b, alCambiar: listo };
    abrirHoja({
      titulo: 'Ajustar hoy', volver: b,
      nota: 'Te muestro cómo quedaría y te pregunto antes de cambiar algo.',
      opciones: [
        { valor: 'tiempo', icono: icono('reloj'), nombre: 'Tengo poco tiempo' },
        { valor: 'cansado', icono: icono('luna'), nombre: 'Dormí mal o estoy cansado' },
        { valor: 'maquina', icono: icono('cambiar'), nombre: 'Una máquina está ocupada' },
        { valor: 'otra', icono: icono('calendario'), nombre: 'Prefiero entrenar otra cosa' },
        { valor: 'falte', icono: icono('flecha'), nombre: 'Hoy no puedo, moverla' },
        { valor: 'dolor', icono: icono('curita'), clase: 'tipo-fallo', nombre: 'Me duele algo' },
        { valor: 'chat', icono: icono('chat'), nombre: `Hablar con ${nombreAsistente()}` },
      ],
      alElegir: v => {
        if (v === 'tiempo') abrirHoja({
          titulo: '¿Cuánto tiempo tienes?', volver: b, nota: `La sesión completa toma unos ${min} minutos.`,
          opciones: [20, 30, 40, 45, 60].filter(x => x < min).map(x => ({ valor: String(x), icono: icono('reloj'), nombre: `${x} minutos` })),
          alElegir: x => preguntar(`solo tengo ${x} minutos`, o),
        });
        else if (v === 'cansado') preguntar('dormí mal y estoy cansado', o);
        else if (v === 'maquina') preguntar('la máquina está ocupada', { ...o, titulo: '¿Qué máquina está ocupada?' });
        else if (v === 'otra') preguntar('hoy no quiero hacer esto, ¿qué otra opción tienes?', { ...o, titulo: 'Otra opción para hoy' });
        else if (v === 'falte') proponer({ tipo: 'falte', fecha: f }, o);
        else if (v === 'chat') ir('coach');
        else if (v === 'dolor') abrirHoja({
          titulo: '¿Dónde te duele?', volver: b, nota: `Te llevo con ${nombreAsistente()} para ver qué hacer hoy.`,
          opciones: C.zonas.articulaciones.map(([z, t]) => ({ valor: z, icono: icono('curita'), clase: 'tipo-fallo', nombre: t })),
          alElegir: z => ir('coach', `me duele ${z === 'lumbar' ? 'la zona lumbar' : `${['muneca', 'cadera', 'rodilla'].includes(z) ? 'la' : 'el'} ${C.zonas.articulaciones.find(x => x[0] === z)[1].toLowerCase()}`}`),
        });
      },
    });
  };

  // Terminar sesión: queda en el historial local y, con cuenta, en el servidor.
  $('terminar').onclick = async () => {
    const series = [], notas = [];
    let orden = 0;
    dia.ejercicios.forEach((e, k) => {
      const id = idDe(e, k);
      for (const r of filasDe(f, e, k).filter(x => x.hecho)) {
        const tipo = tipoParaGuardar(r);
        series.push({ orden: orden++, ejercicio_id: e.ejercicio_id, ejercicio_nombre: e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || id, tipo,
          carga_kg: e.unidad === 'seg' ? null : r.kg ?? null, reps: e.unidad === 'seg' ? null : r.reps ?? null, duracion_seg: e.unidad === 'seg' ? r.reps ?? null : null,
          rpe: r.rpe ?? null, rir: tipo === 'fallo' ? 0 : r.rpe != null ? 10 - r.rpe : null });
      }
      const n = (E.notas[f] || {})[id];
      if (n && Object.keys(n).length) {
        const { nota, para_entrenador, ...respuestas } = n;
        notas.push({ fecha: f, ejercicio_id: e.ejercicio_id, respuestas, nota: nota || null, para_entrenador: Boolean(para_entrenador) });
      }
    });
    if (!series.length) { avisar('Marca al menos una serie como hecha.'); return; }
    // El id es del teléfono y se mantiene al guardar de nuevo: así la cuenta la reemplaza en vez de duplicarla.
    // Las sesiones importadas (Hevy) de ese día no se tocan.
    const id = E.sesiones.find(s => s.fecha === f && !s.origen)?.id || crypto.randomUUID();
    E.sesiones = E.sesiones.filter(s => !(s.fecha === f && !s.origen));
    const hora = ahora().slice(11);
    E.sesiones.push({ id, fecha: f, hora, titulo: dia.foco, series, notas });
    E.mensaje = `Sesión guardada: ${series.length} serie${series.length === 1 ? '' : 's'}.`;
    detenerDescanso();
    guardar();
    if (nube.conectado()) {
      const subio = await subirACuenta('sesion', id, { fecha: f, hora, titulo: dia.foco, series, notas });
      E.mensaje += subio ? ' También quedó en tu cuenta.' : ' Todavía no se pudo subir a tu cuenta: queda en este teléfono y se sube sola cuando vuelva la señal.';
      guardar();
    }
    repintar();
  };
}

/** Vuelve a dibujar Hoy sin mover la pantalla. */
function vistaHoyMantener(ir) {
  const y = window.scrollY;
  vistaHoy(ir);
  window.scrollTo(0, y);
}
