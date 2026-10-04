// Vista Hoy, como en Hevy: check-in de bienestar, suplementos y la sesión del día con los músculos que entrenas (con
// sus imágenes), "Ajustar hoy" (poco tiempo, cansancio, no puedo, otra opción, dolor: siempre pregunta antes de cambiar) y
// cada ejercicio con su miniatura, su ficha (cómo se hace y por qué), el menú ⋯ y la tabla de series: tipo
// (calentamiento, normal, al fallo, drop set), lo de la vez anterior, cronómetro de descanso y superseries.
import { datoCambiado, cicloCambiado } from './datos-nube.js';
import { E, guardar, R, D, C, K, indice, hoy, ahora, esc, $, fechaCorta, ctxNucleo, escala, opcionesRadio, chk, cambiarPlan, numero, coma, mostrarMensaje, avisar, unidadPeso, enUnidad, aKilos, peso, volumenTexto, seriesTexto } from './comun.js';
import { estadoDelPlan } from '../nucleo/registrado.js';
import { sesionesPorRevisar } from '../nucleo/sin-registro.js';
import { recordsDeSerie } from '../nucleo/records.js';
import { esAsistido, conLastre, sinCargaExterna } from '../nucleo/catalogo.js';
import { sufijo, porReps, camposGuardados } from '../nucleo/unidades.js';
import { evaluarDia, ajustarSesion, TEXTO_RECOMENDACION } from '../nucleo/bienestar.js';
import { cicloActivo, estadoCiclo, registrarInicio, NOMBRE_FASE, SINTOMAS } from '../nucleo/ciclo-menstrual.js';
import { discosPorLado, discosDisponibles, BARRAS_KG, BARRAS_LB } from '../nucleo/discos.js';
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
import { iniciarDescanso, detenerDescanso, iniciarTramos } from './descanso.js';
import { tramosDePaso, tramosDeCardio, seriesDeCalentamiento } from '../nucleo/calentamiento.js';
import { calentamientoDeSesion, minutosCalentamiento, partePaso, aproximacionesDelPlan, conAproximaciones } from '../nucleo/calentamiento-sesion.js';
import { articulacionesBloqueadas } from '../nucleo/catalogo.js';
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
import { descansoHtml, sesionCompletaHtml } from './estados-visuales.js';
import { srcArticulacion } from './articulaciones.js';
import { repintarConservando, celebrar, sinMovimiento } from './movimiento.js';
import { mostrarMedalla } from './medalla.js';
import { montarAnimaciones } from './animacion-ui.js';
import { animacionDePaso } from '../nucleo/animaciones.js';
import { modoEsfuerzo, escalaDe, aRpe, deRpe, rpeDeSerie, textoEsfuerzo, significado } from '../nucleo/esfuerzo.js';
import { proponerEdicion, ordenarSesion } from './editar-sesion-ui.js';
import { serieCompleta } from '../nucleo/serie-completa.js';
import { proponerSesionVacia } from './sesion-libre-ui.js';
import { ilustracionesCalentamiento } from '../nucleo/imagenes-calentamiento.js';
import { IMAGENES } from './comun.js';
import { elegirCardio } from './cardio-ui.js';
import { CARDIOS, registroCardio } from '../nucleo/cardio.js';
import { hayImagen, srcMiniatura } from './imagenes.js';


const app = () => $('app');

export function vistaHoy(ir, extra) {
  const f = hoy();
  const plan = E.plan;
  if (!plan || plan.bloqueado) return ir('inicio');
  const dia = sesionDe(plan, f);
  if (dia) ponerAproximaciones(dia, f);
  const b = E.bienestar[f];
  const sups = checklist(E.suplementos, E.tomas, f, ahora());
  const proxima = plan.dias.find(d => d.fecha > f);
  // Lo registrado (en la app o importado de Hevy) dice qué sesión del plan se hizo y qué quedó pendiente.
  const reg = estadoDelPlan(plan, E.sesiones, { hoy: f, marcas: E.marcasPlan || {} });
  const hechaEnHevy = Boolean(dia) && !dia.libre && dia.foco !== 'Sesión libre' && reg.hoy.de === f && Boolean(reg.porDia.get(f)?.sesion?.origen);
  app().innerHTML = `<div id="vista-hoy">
    <span class="sobretitulo">${esc(new Date(f + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }))}</span>
    <h1>${dia && !hechaEnHevy ? esc(dia.foco) : 'Hoy'}</h1>
    ${dia ? (hechaEnHevy ? `${registradoHoyHtml(reg, dia, f, proxima)}<details class="extra plan-hecho" id="plan-hecho"${planHechoAbierto ? ' open' : ''}><summary>La sesión del plan, por si quieres anotar algo aquí</summary>${sesionHoy(dia)}</details>` : sesionHoy(dia)) : descansoHtml(proxima)}
    <div class="banco-acceso"><button type="button" class="boton" id="sesion-vacia-hoy">Empezar sesión vacía</button><button type="button" class="boton" id="agregar-ejercicio-hoy">Agregar ejercicio desde el banco</button><button type="button" class="boton" data-elegir-cardio>Elegir cardio</button></div>
    ${!hechaEnHevy ? registradoHoyHtml(reg, dia, f, proxima) : ''}
    <div class="despues-de-entrenar">
      ${bienestarHtml(f, b, dia)}
      ${D().mensaje_alerta ? `<div class="aviso ojo">${esc(D().mensaje_alerta)}</div>` : ''}
      ${avisoCheckin()}
      ${avisoDescargaCorto()}
      ${avisoSinRegistro(f)}
      ${sups.length ? `<section class="tarjeta"><h3>Suplementos</h3><ul class="lista-check">${sups.map(s => `<li class="${s.estado}"><button type="button" class="check" data-toma="${s.suplemento_id}" ${s.estado === 'tomada' ? 'disabled aria-pressed="true"' : 'aria-pressed="false"'} aria-label="Marcar ${esc(s.nombre)} como tomado">${s.estado === 'tomada' ? '✓' : ''}</button><span>${esc(s.nombre)}${s.dosis ? ` · ${esc(s.dosis)}` : ''}</span><span class="suave pequeno">${s.hora || ''}${s.estado === 'atrasada' ? ' · atrasado' : ''}</span></li>`).join('')}</ul></section>` : ''}
    </div>
  </div>`;
  enlazar(ir, dia);
  montarAnimaciones(app(), caja => animacionDePaso({ name: caja.dataset.pasoNombre, clave: caja.dataset.pasoClave, agregar_id: caja.dataset.pasoEj }));
  document.getElementById('abrir-revision')?.addEventListener('click', () => ir('coach', { revisar: true }));
  actualizarPantalla(); // al marcar la primera serie se pide la pantalla encendida; al guardar la sesión, se suelta
  mostrarMensaje();
  // Al volver de la ficha de un ejercicio, la pantalla queda en ese ejercicio.
  if (extra?.ej) requestAnimationFrame(() => document.getElementById(`ej-${extra.ej}`)?.scrollIntoView({ block: 'center' }));
  celebrarSiSeCompleto(f);
}

/** Con la sesión empezada, al llegar a Hoy la pantalla queda en el ejercicio que se está haciendo: el de la serie que
 *  sigue a la última marcada. Sin series marcadas, Hoy parte arriba. */
export function irAlEjercicioEnCurso() {
  const checks = [...document.querySelectorAll('#vista-hoy .ej [data-hecho]')];
  const ultima = checks.findLastIndex(c => c.getAttribute('aria-pressed') === 'true');
  if (ultima < 0) return;
  const sigue = checks.slice(ultima + 1).find(c => c.getAttribute('aria-pressed') !== 'true') || checks.find(c => c.getAttribute('aria-pressed') !== 'true');
  sigue?.closest('.ej')?.scrollIntoView({ block: 'start' });
}

/** La serie recién marcada: el visto se dibuja, la fila toma su color y la barra de avance crece desde donde estaba.
 *  Solo esa serie y una vez: el próximo repintado ya no trae la clase. */
function serieRecienMarcada(id, i, anchoAntes) {
  const check = document.querySelector(`#vista-hoy [data-hecho="${CSS.escape(id)}"][data-i="${i}"]`);
  check?.classList.add('recien');
  check?.closest('.serie')?.classList.add('recien');
  const barra = document.querySelector('#avance .medidor i');
  if (barra && !sinMovimiento() && barra.style.width !== anchoAntes) barra.animate([{ width: anchoAntes }, { width: barra.style.width }], { duration: 280, easing: 'cubic-bezier(.2,.7,.3,1)' });
}

// La sesión completa se celebra una sola vez: al pasar de series pendientes a todas hechas en esta misma pantalla.
// Abrir la app con la sesión ya completa, repintar, volver de una ficha o guardar de nuevo no la repiten.
let completaAntes = null;
const celebradas = new Set();
function celebrarSiSeCompleto(f) {
  const tarjeta = document.querySelector('#vista-hoy .sesion-completa');
  const ahora = { fecha: f, completa: Boolean(tarjeta) };
  const recien = ahora.completa && completaAntes?.fecha === f && !completaAntes.completa && !celebradas.has(f);
  completaAntes = ahora;
  if (!recien) return;
  celebradas.add(f);
  celebrar(tarjeta, tarjeta.querySelector('.estado-personaje'));
  // La tarjeta aparece sobre "Terminar sesión": si el botón queda fuera de la pantalla, se acerca hasta verlo.
  requestAnimationFrame(() => {
    const b = document.getElementById('terminar')?.getBoundingClientRect();
    if (b && b.bottom > innerHeight - 90) document.getElementById('terminar').scrollIntoView({ block: 'center', behavior: sinMovimiento() ? 'auto' : 'smooth' });
  });
}

/** Sesiones de los últimos 7 días sin registro: un aviso corto que abre la revisión en el Coach (ahí se responde). */
function avisoSinRegistro(f) {
  const n = sesionesPorRevisar(E.plan, E.sesiones, { hoy: f, marcas: E.marcasPlan || {}, despues: E.revisarDespues || {} }).length;
  if (!n) return '';
  return `<button type="button" class="aviso-revision" id="abrir-revision">${icono('calendario')}<span><strong>${n === 1 ? 'Una sesión sin registro' : `${n} sesiones sin registro`}</strong><small>¿La${n === 1 ? '' : 's'} hiciste? Revisar en el Coach</small></span>${icono('flecha', 'icono aviso-revision-flecha')}</button>`;
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

// "¿Cómo estás hoy?": opcional y plegado desde el inicio. Cada botón guarda al tocarlo (sin "Listo"); con sueño, ánimo
// y energía respondidos se pliega solo y muestra el resumen. Un envío sin respuestas no cuenta.
const PREGUNTAS_B = [
  { campo: 'sueno_horas', texto: 'Dormí', opciones: [[5, '5 o menos'], [6, '6 h'], [7, '7 h'], [8, '8 h'], [9, '9 o más']] },
  { campo: 'animo', texto: 'Ánimo', opciones: [[1, 'Muy bajo'], [2, 'Bajo'], [3, 'Normal'], [4, 'Bien'], [5, 'Muy bien']] },
  { campo: 'cansancio', texto: 'Energía', opciones: [[5, 'Agotado'], [4, 'Cansado'], [3, 'Normal'], [2, 'Bien'], [1, 'Fresco']] },
];
const ENFERMO = [['no', 'No'], ['resfrio', 'Resfrío leve'], ['fiebre_o_cuerpo', 'Fiebre o cuerpo cortado']];
const PRINCIPALES = PREGUNTAS_B.map(p => p.campo);
const respondioAlgo = b => Boolean(b) && (PRINCIPALES.some(k => b[k] != null) || (b.enfermo && b.enfermo !== 'no') || Boolean(b.sintomas_ciclo?.length));
let cicloPreguntado = null; // en un día difícil del ciclo, "¿Cómo estás hoy?" se abre sola una vez
let bienestarAbierto = false; // sigue abierto mientras se responde, aunque la vista se vuelva a dibujar
let planHechoAbierto = false; // la sesión del plan ya hecha en Hevy, abierta para anotar algo: no se pliega en cada toque

function resumenBienestar(b) {
  const palabra = (campo, v) => PREGUNTAS_B.find(p => p.campo === campo).opciones.find(([x]) => x === v)?.[1];
  return [
    b.sueno_horas != null && `dormiste ${b.sueno_horas >= 9 ? '9 o más' : b.sueno_horas <= 5 ? '5 o menos' : b.sueno_horas} h`,
    b.animo != null && `ánimo ${palabra('animo', b.animo).toLowerCase()}`,
    b.cansancio != null && `energía ${palabra('cansancio', b.cansancio).toLowerCase()}`,
    b.enfermo && b.enfermo !== 'no' && ENFERMO.find(([v]) => v === b.enfermo)[1].toLowerCase(),
    b.sintomas_ciclo?.length && SINTOMAS.filter(([v]) => b.sintomas_ciclo.includes(v)).map(([, t]) => t.toLowerCase()).join(', '),
  ].filter(Boolean).join(' · ');
}

/** El ciclo dentro de "¿Cómo estás hoy?": en qué día va, "Me llegó" y los síntomas. Solo si se activó. */
function cicloHtml(f, b, dia) {
  const r = R();
  if (!cicloActivo(r)) return '';
  const c = estadoCiclo(r, f);
  const texto = !c ? 'Marca cuándo empezó tu última regla y te digo en qué día vas.'
    : c.hormonal ? 'Con anticonceptivo hormonal no hay fases: si tienes síntomas, márcalos abajo.'
    : `Día ${c.dia}${c.predice ? ` de unos ${c.largo}` : ''}${c.fase ? `, ${NOMBRE_FASE[c.fase]}` : ''}.${c.proxima ? (c.atraso ? ` La regla venía hace ${c.atraso} ${c.atraso === 1 ? 'día' : 'días'}, según lo estimado: si llegó, márcalo.` : ` Próxima regla cerca del ${fechaCorta(c.proxima)}.`) : ''}${c.dificil ? ` Marcaste estos días como difíciles${dia ? ': si hoy te cuesta, márcalo arriba o en los síntomas y te ofrezco la sesión liviana' : ''}.` : ''}`;
  return `<div class="pregunta-b ciclo-b"><span class="pequeno suave">Ciclo</span>
      <p class="pequeno">${esc(texto)}</p>
      <div class="fila-ciclo"><button type="button" class="boton" id="ciclo-hoy">Me llegó hoy</button><label class="pequeno">Otro día <input type="date" id="ciclo-otro" max="${f}" aria-label="Día en que empezó la regla"></label></div>
    </div>
    <div class="pregunta-b"><span class="pequeno suave">Síntomas del ciclo</span><div class="escala-b dos" role="group" aria-label="Síntomas del ciclo">${SINTOMAS.map(([v, t]) =>
      `<button type="button" data-b-sintoma="${v}" aria-pressed="${Boolean(b?.sintomas_ciclo?.includes(v))}">${t}</button>`).join('')}</div></div>
    <p class="pequeno suave">La evidencia no muestra que el ciclo cambie la fuerza en promedio: guíate por cómo te sientes. Lo que marcas aquí queda en este teléfono y, si entraste, en tu cuenta (privado).</p>`;
}

function bienestarHtml(f, b, dia) {
  const hay = respondioAlgo(b);
  if (dia && !hay && cicloPreguntado !== f && estadoCiclo(R(), f)?.dificil) { bienestarAbierto = true; cicloPreguntado = f; }
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
      ${cicloHtml(f, b, dia)}
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
const lugarDe = dia => (R().lugares || []).find(x => x.nombre === dia?.lugar) || (R().lugares || []).find(x => x.principal) || (R().lugares || [])[0];
const deTrabajoFila = x => ['normal', 'fallo'].includes(tipoDe(x));
/**
 * Las series de calentamiento de un ejercicio, como en el tablero: las que indica el plan o, si no, las que calcula la
 * app desde el peso de trabajo (lo escrito hoy, el plan o la vez anterior). Se calculan cada vez, así siguen al peso.
 */
function aproximacionesHoy(dia, e, lista, f) {
  const plan = aproximacionesDelPlan(dia, e);
  if (plan.length) return plan;
  const ej = indice.porId.get(e.ejercicio_id);
  const prev = e.ejercicio_id ? anterior(seriesAnotadas(E.sesiones, E.registro), e.ejercicio_id, f)?.series[0] : null;
  const kgTrabajo = (lista || []).find(x => deTrabajoFila(x) && x.kg != null)?.kg ?? e.carga_kg ?? prev?.carga_kg ?? null;
  return seriesDeCalentamiento(kgTrabajo, { incremento: (ej && incrementoPara(ej, lugarDe(dia))) || 2.5, barra: ej?.equipamiento.includes('barra_rack') ? 20 : 0 });
}
/**
 * Pone las series de calentamiento al comienzo de los ejercicios que las llevan (una vez por día y ejercicio: si la
 * persona las quita, no vuelven). Son filas C con su peso y repeticiones en gris; mientras nadie las toque, su cantidad
 * sigue a las que calcula la app (por ejemplo, al escribir el peso de trabajo).
 */
function ponerAproximaciones(dia, f) {
  const ids = conAproximaciones({ dia, porId: indice.porId, bloqueadas: articulacionesBloqueadas(R().lesiones, f) });
  let cambio = false;
  dia.ejercicios.forEach((e, k) => {
    if (!ids.has(e.ejercicio_id)) return;
    const id = idDe(e, k), puestas = ((E.aproxPuestas ||= {})[f] ||= {});
    const lista = E.registro[f]?.[id];
    if (!puestas[id]) {
      if ((lista || []).some(x => tipoDe(x) === 'calentamiento')) { puestas[id] = true; cambio = true; return; }
      const { lista: l, n } = materializar(f, e, k);
      const aprox = aproximacionesHoy(dia, e, l, f);
      l.splice(0, 0, ...aprox.map((_, j) => ({ tipo: 'calentamiento', aprox: j })));
      fijarFilas(f, id, n + aprox.length);
      puestas[id] = true; cambio = true;
      return;
    }
    // Sin tocar todavía: la cantidad sigue a la que calcula la app.
    const auto = (lista || []).filter(x => x?.aprox != null);
    if (!auto.length || auto.some(x => x.hecho || x.kg != null || x.reps != null)) return;
    const aprox = aproximacionesHoy(dia, e, lista, f);
    if (aprox.length === auto.length) return;
    const { lista: l, n } = materializar(f, e, k);
    const desde = l.findIndex(x => x?.aprox != null);
    l.splice(desde, auto.length, ...aprox.map((_, j) => ({ tipo: 'calentamiento', aprox: j })));
    fijarFilas(f, id, n - auto.length + aprox.length);
    cambio = true;
  });
  if (cambio) guardar();
}
const descansoDe = (e, k) => E.descansos?.[idDe(e, k)] ?? e.descanso_seg ?? 90;
/** Descanso de la vuelta de una superserie: el que eligió en el último ejercicio o, si no, el más largo del plan. */
const descansoVuelta = (ejs, g) => { const u = ejs[g.miembros.at(-1)]; return E.descansos?.[idDe(u, g.miembros.at(-1))] ?? Math.max(...g.miembros.map(m => ejs[m].descanso_seg ?? 90)); };
const nombreDe = e => e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || '';
const mmss = seg => (seg ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}` : 'sin descanso');
const DESCANSOS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

// Paneles abiertos ("Cómo te fue"): siguen abiertos aunque la vista se vuelva a dibujar.
const abiertos = new Set();

// Calentamiento y estiramiento como en el tablero: cada paso se marca y, si va por tiempo, trae su cronómetro.
// El calentamiento está siempre, como el cardio, en una tarjeta que se pliega: empieza abierto y se pliega al
// completarlo o al empezar las series; el estiramiento se abre al terminar las series.
const pasosAbiertos = { cal: null, est: null }; // null: automático; true o false: lo eligió la persona
const reloj = seg => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}`;
function pasosHtml(pasos, tipo, f, titulo, dia, intro = '') {
  if (!pasos?.length) return '';
  const anteriores = E.pasos?.[f]?.[tipo] || [];
  const claves = E.pasosClaves?.[f]?.[tipo] || {};
  const hechos = pasos.map((p, i) => p.clave ? claves[p.clave] ?? (p.indiceAnterior != null && Boolean(anteriores[p.indiceAnterior])) : Boolean(anteriores[i]));
  const n = hechos.filter(Boolean).length;
  const completo = n === pasos.length;
  const a = avance(dia);
  const automatico = tipo === 'cal' ? !completo && !a.hechas : !completo && a.total > 0 && a.hechas === a.total;
  const abierto = pasosAbiertos[tipo] ?? automatico;
  const minutos = tipo === 'cal' ? ` · ~${minutosCalentamiento(pasos)} min` : '';
  return `<details class="extra pasos" data-pasos="${tipo}"${abierto ? ' open' : ''}><summary>${esc(titulo)} <span class="pequeno suave">${completo ? 'hecho ✓' : n ? `${n} de ${pasos.length}` : `${pasos.length} pasos${minutos}`}</span></summary>${intro}
    <ol class="lista-pasos">${pasos.map((p, i) => {
      const parte = partePaso(p.name);
      const tramos = tramosDePaso(p.name, p.seg_estimados); // por lado: primer lado, cambio de postura y segundo lado
      const zona = ['codo', 'hombro', 'rodilla', 'cadera', 'tobillo', 'lumbar', 'muneca', 'cuello'].find(z => p.name.toLowerCase().includes(z));
      const imagen = p.imagen || (zona ? `img/articulaciones/${zona}.webp` : /cardio|bicicleta|caminata/i.test(p.name) ? 'img/ejercicios/mini/caminata.webp' : null);
      const animado = Boolean(animacionDePaso(p)); // con animación, la animación reemplaza las ilustraciones quietas
      const ilustraciones = tipo === 'cal' && !animado ? ilustracionesCalentamiento(p, IMAGENES) : [];
      const total = tramos.reduce((x, t) => x + t.seg, 0);
      return `<li class="paso${hechos[i] ? ' hecho' : ''}">
        <button type="button" class="check" data-paso="${tipo}" data-i="${i}"${p.clave ? ` data-clave="${esc(p.clave)}"` : ''} aria-pressed="${Boolean(hechos[i])}" aria-label="${esc(p.name)}: hecho">${hechos[i] ? '✓' : ''}</button>
        ${tipo !== 'cal' && !animado && imagen && hayImagen(imagen) ? `<img class="paso-imagen" src="${imagen}" alt="" width="56" height="56">` : ''}<div class="paso-texto">${p.fase ? `<span class="paso-fase">${esc(p.fase)}</span>` : ''}<strong>${esc(parte.nombre)}</strong>${parte.dosis ? `<span class="paso-dosis">${esc(parte.dosis)}</span>` : ''}</div>
        ${animado ? `<div class="paso-animacion" data-animar="${esc(parte.nombre)}" data-paso-nombre="${esc(p.name)}" data-paso-clave="${esc(p.clave || '')}" data-paso-ej="${esc(p.agregar_id || '')}"></div>` : ''}
        ${ilustraciones.map(x => `<figure class="paso-ilustracion${x.tipo === 'referencia' ? ' referencia' : ''}"><img src="${esc(x.src)}" alt="${esc(x.alt)}" width="768" height="512" loading="lazy" decoding="async">${x.tipo === 'referencia' ? '<figcaption>Equipo o zona de referencia</figcaption>' : ''}</figure>`).join('')}
        ${p.how ? `<p class="paso-instruccion pequeno suave">${esc(p.how)}</p>` : ''}
        ${p.por_que ? `<p class="paso-motivo pequeno">${esc(p.por_que)}</p>` : ''}
        ${p.series?.length ? `<div class="aproximaciones">${p.series.map(x => x.kg != null ? `<span>${esc(peso(x.kg))} × ${x.reps}</span>` : '<span>Carga liviana por elegir</span>').join('')}</div>` : ''}
        ${p.agregar_id ? `<button type="button" class="boton chico" data-preparar="${esc(p.agregar_id)}">${filasDe(f, dia.ejercicios.find(e => e.ejercicio_id === p.agregar_id), dia.ejercicios.findIndex(e => e.ejercicio_id === p.agregar_id)).some(x => tipoDe(x) === 'calentamiento') ? 'Ver series de aproximación' : 'Agregar a la tabla'}</button>` : ''}
        ${tramos.length ? `<button type="button" class="boton chico reloj-paso" data-tramos="${esc(JSON.stringify(tramos))}" aria-label="Cronómetro de ${esc(reloj(total))}">▶ ${reloj(total)}</button>` : ''}
      </li>`;
    }).join('')}</ol>
  </details>`;
}

/** Calentamiento: siempre presente y plegable, armado con los ejercicios de hoy (nucleo/calentamiento-sesion.js). */
function calentamientoHtml(todos, f, dia) {
  // Las series de aproximación van en la tabla de cada ejercicio (filas C), como en el tablero: aquí no se repiten.
  const pasos = todos.filter(p => !p.agregar_id && !/aproximaci/i.test(p.name));
  const enEjercicios = todos.length !== pasos.length || dia.ejercicios.some((e, k) => filasDe(f, e, k).some(x => x?.aprox != null));
  if (!pasos.length) {
    const texto = dia.ejercicios.length ? 'Hoy es solo cardio: parte los primeros 5 minutos suave, a un ritmo que te deje hablar.' : 'Agrega ejercicios y el calentamiento se arma solo con lo que vas a entrenar.';
    return `<section class="tarjeta calentamiento-directo calentamiento-vacio" id="calentamiento-hoy"><h3>Calentamiento</h3><p class="pequeno suave">${texto}</p></section>`;
  }
  const intro = `<p class="calentamiento-nota pequeno suave">Para ${esc(dia.foco)}: subir temperatura, movilidad y activación de lo que vas a entrenar.${enEjercicios ? ' Las series de calentamiento con peso están en cada ejercicio, en las filas C.' : ''} Termina con energía para las series de trabajo.</p>`;
  return `<section class="tarjeta calentamiento-directo" id="calentamiento-hoy">${pasosHtml(pasos, 'cal', f, 'Calentamiento', dia, intro)}</section>`;
}

/** Cardio: el texto del plan, su cronómetro y, si va por tramos de intensidad, una barra con cada tramo. */
function cardioHtml(texto) {
  if (!texto) return '';
  const tramos = tramosDeCardio(texto);
  const total = tramos.reduce((x, t) => x + t.seg, 0);
  const porRpe = tramos.length > 1 && tramos.every(t => t.rpe);
  const imagen = [...CARDIOS].sort((a, b) => b.nombre.length - a.nombre.length).find(c => texto.toLowerCase().startsWith(c.nombre.toLowerCase().replace(/ estática| al aire libre/g, '')))?.imagen;
  return `<section class="tarjeta cardio">
    <div class="cab-tarjeta"><h3>Cardio</h3><button type="button" class="boton chico" data-elegir-cardio>Cambiar</button>${total ? `<button type="button" class="boton chico reloj-paso" data-tramos="${esc(JSON.stringify(tramos))}" data-final="¡Cardio listo!">▶ ${reloj(total)}</button>` : ''}</div>
    ${imagen && hayImagen(imagen) ? `<img class="cardio-imagen" src="${imagen}" alt="" width="96" height="96">` : ''}<p class="pequeno">${esc(texto)}</p>
    <button type="button" class="boton chico" id="cardio-hecho" aria-pressed="${Boolean(E.cardioHecho?.[hoy()]?.hecho && E.cardioHecho[hoy()].texto === texto)}">${E.cardioHecho?.[hoy()]?.hecho && E.cardioHecho[hoy()].texto === texto ? 'Cardio hecho ✓' : 'Marcar cardio como hecho'}</button>
    ${E.cardioHecho?.[hoy()]?.hecho && E.cardioHecho[hoy()].texto === texto ? `<div class="fila-cardio"><label class="pequeno">Minutos <input type="text" inputmode="numeric" id="cardio-min" value="${esc(E.cardioHecho[hoy()].minutos ?? '')}" placeholder="${total ? Math.round(total / 60) : ''}" aria-label="Minutos de cardio (opcional)"></label><label class="pequeno">Distancia <input type="text" inputmode="decimal" id="cardio-km" value="${esc(coma(E.cardioHecho[hoy()].distancia_km ?? ''))}" placeholder="km" aria-label="Distancia en kilómetros (opcional)"> km</label></div>` : ''}
    ${porRpe ? `<div class="tramos-cardio" aria-hidden="true">${tramos.map(t => `<i style="flex:${t.seg}"><b>${Math.round(t.seg / 60)}′</b><span>RPE ${esc(t.rpe)}</span></i>`).join('')}</div>` : ''}
  </section>`;
}

/** Esfuerzo de una serie (RPE por defecto, o RIR): la caja muestra el valor anotado o, en gris, el que pide el plan.
 *  Al tocarla se abre la hoja para elegirlo, como en Hevy (abrirEsfuerzo). */
function cajaEsfuerzo(id, i, r, e, etiqueta) {
  const modo = modoEsfuerzo(R()), rpe = rpeDeSerie(r);
  const valor = deRpe(rpe, modo), delPlan = e.rir != null ? deRpe(10 - e.rir, modo) : null;
  const sigla = modo === 'rir' ? 'RIR' : 'RPE';
  return `<button type="button" class="caja-rir caja-esfuerzo" data-esfuerzo="${id}" data-i="${i}" aria-haspopup="dialog" aria-label="${esc(`${sigla} de la serie ${etiqueta}: ${valor != null ? textoEsfuerzo(valor, modo) : `sin anotar${delPlan != null ? `, el plan pide ${textoEsfuerzo(delPlan, modo)}` : ''}`}. Cambiar`)}"><span class="rir-valor${valor == null ? ' gris' : ''}" aria-hidden="true">${esc(textoEsfuerzo(valor ?? delPlan, modo))}</span></button>`;
}

/** Series hechas y totales de la sesión, y sus cifras. */
function avance(dia) {
  // La ayuda de la máquina (asistidos) no es peso levantado: cuenta la serie, pero no suma al volumen.
  const filas = dia.ejercicios.flatMap((e, k) => filasDe(dia.fecha, e, k).map(x => (esAsistido(indice.porId.get(e.ejercicio_id)) ? { ...x, kg: null } : x)));
  // Las de calentamiento cuentan solo si se hicieron: saltarlas no deja la sesión incompleta.
  const cuentan = filas.filter(x => x.hecho || tipoDe(x) !== 'calentamiento');
  return { hechas: cuentan.filter(x => x.hecho).length, total: cuentan.length, cifras: cifras(filas) };
}
const avanceHtml = ({ hechas, total, cifras: c }) => `<div class="avance" id="avance" aria-live="polite">
  <div class="fila-avance"><span class="pequeno"><strong class="num">${hechas}</strong> de ${total} series${hechas && hechas === total ? ' · ¡completa!' : ''}</span><div class="medidor" aria-hidden="true"><i style="width:${total ? Math.round((hechas / total) * 100) : 0}%"></i></div></div>
  ${hechas ? `<p class="cifras pequeno suave">${c.minutos ? `${c.minutos} min · ` : ''}${c.series} de trabajo · volumen ${esc(volumenTexto(c.volumen))}</p>` : ''}
</div>`;

function sesionHoy(dia) {
  const f = dia.fecha;
  const notas = E.notas[f] || {};
  const progreso = avance(dia), guardada = E.sesiones.some(s => s.fecha === f && !s.origen);
  const todas = seriesAnotadas(E.sesiones, E.registro);
  const ejs = dia.ejercicios.map(e => indice.porId.get(e.ejercicio_id)).filter(Boolean);
  const prim = [...new Set(ejs.flatMap(ej => ej.musculos_primarios))];
  const sec = [...new Set(ejs.flatMap(ej => ej.musculos_secundarios))].filter(m => !prim.includes(m));
  const eligePeso = dia.ejercicios.some(e => /^Elige un peso/.test(e.nota || ''));
  const lugar = (R().lugares || []).find(x => x.nombre === dia.lugar) || (R().lugares || []).find(x => x.principal) || (R().lugares || [])[0];
  const cargas = Object.fromEntries(dia.ejercicios.map((e, k) => [e.ejercicio_id, filasDe(f, e, k).find(x => deTrabajo(tipoDe(x)) && x.kg != null)?.kg ?? e.carga_kg ?? anterior(todas, e.ejercicio_id, f)?.series[0]?.carga_kg]));
  const opcionesCarga = Object.fromEntries(ejs.map(ej => [ej.id, { incremento: incrementoPara(ej, lugar) || 2.5, barra: ej.equipamiento.includes('barra_rack') ? 20 : 0 }]));
  const calentamiento = calentamientoDeSesion({ dia, porId: indice.porId, equipo: lugar?.equipamiento || [], bloqueadas: articulacionesBloqueadas(R().lesiones, f), cargas, opcionesCarga });
  return `<section class="sesion-cab compacta" aria-label="Sesión de hoy">
    <div class="sesion-controles">
      ${dia.ejercicios.length ? avanceHtml(progreso) : '<p class="pequeno suave">Sesión vacía. Abre Ejercicios para elegir desde el banco o ver recomendaciones para ti.</p>'}
      <button type="button" class="boton chico" id="ajustar-hoy">${icono('ajustes')} Ajustar hoy</button>
      <button type="button" class="boton-icono" id="ver-detalles-sesion" aria-label="Detalles de la sesión">${icono('info')}</button>
    </div>
  </section>
  <div class="accesos-entreno">
    <button type="button" class="boton chico" id="banco-hoy-arriba">${icono('mas')} Ejercicios</button>
    <button type="button" class="boton chico" data-elegir-cardio>Cardio</button>
    ${dia.ejercicios.length ? '<button type="button" class="boton chico" id="sesion-vacia-arriba">Empezar vacía</button>' : ''}
  </div>
  ${calentamientoHtml(calentamiento, f, dia)}
  <ol class="ejercicios-hoy">${dia.ejercicios.map((e, k) => ejercicioHoy(e, k, f, e.ejercicio_id ? anterior(todas, e.ejercicio_id, f) : null, notas[idDe(e, k)] || {}, dia)).join('')}</ol>
  ${cardioHtml(dia.cardio)}
  ${progreso.total && progreso.hechas === progreso.total ? sesionCompletaHtml({ guardada }) : ''}
  <div class="fila-botones"><button type="button" class="boton primario grande" id="terminar">${guardada ? 'Guardar de nuevo' : 'Terminar sesión'}</button></div>
  <details class="tarjeta detalles-sesion" id="detalles-sesion">
    <summary>Detalles de la sesión</summary>
    <p class="suave pequeno">${dia.hora ? `${esc(dia.hora)} · ` : ''}~${duracionSesion({ ...dia, calentamiento })} min · ${dia.ejercicios.length} ejercicio${dia.ejercicios.length === 1 ? '' : 's'}</p>
    ${prim.length ? `<div class="hoy-entrenas">${imagenesMusculos(prim.slice(0, 4))}<div><p class="sobretitulo">Hoy entrenas</p><p class="musculos-hoy">${esc(mayuscula(lista(prim.map(m => NOMBRE_MUSCULO[m] || m))))}</p>${sec.length ? `<p class="pequeno suave">Y un poco de ${esc(lista(sec.map(m => (NOMBRE_MUSCULO[m] || m).toLowerCase())))}</p>` : ''}</div></div>` : ''}
    <p class="suave pequeno">${esc(dia.racional || '')}</p>
    ${eligePeso ? '<p class="nota-sesion pequeno">Donde no hay peso, elige uno con el que te sobren las repeticiones de reserva (RIR) en la última serie. Lo anotas y la app ajusta desde ahí.</p>' : ''}
    ${dia.estiramiento?.length ? pasosHtml(dia.estiramiento, 'est', f, 'Estiramiento de cierre (opcional)', dia) : ''}
  </details>`;
}

function ejercicioHoy(e, k, f, previas, nota, dia) {
  const id = idDe(e, k);
  const aprox = filasDe(f, e, k).some(x => x?.aprox != null) ? aproximacionesHoy(dia, e, E.registro[f]?.[id], f) : [];
  const g = grupos(dia.ejercicios)[k];
  const ej = indice.porId.get(e.ejercicio_id);
  const filas = filasDe(f, e, k);
  const etiq = etiquetas(filas);
  const u = unidadPeso();
  const seg = e.unidad === 'seg';
  const dist = e.unidad === 'm'; // peso y distancia, como la caminata del granjero
  // Qué es el peso anotado: la ayuda de la máquina (asistidos) o lo que se agrega al cuerpo (lastre).
  const ejCat = indice.porId.get(e.ejercicio_id);
  const queEs = esAsistido(ejCat) ? 'ayuda' : conLastre(ejCat) ? 'lastre' : '';
  let iTrabajo = 0; // posición entre las series de trabajo, para mostrar lo de la vez anterior
  let kgHoy = null; // el último peso escrito hoy en una serie de trabajo: pasa a ser el gris de las siguientes
  const filasHtml = filas.map((r, i) => {
    const t = tipoDe(r);
    const trabajo = deTrabajo(t);
    const prev = trabajo ? previas?.series[iTrabajo++] : null;
    // En gris va lo que se guarda si marcas sin escribir: lo que ya levantaste hoy, el plan o la vez anterior.
    // Las de calentamiento puestas por la app traen su peso y repeticiones en gris (aproximacionesHoy).
    const sug = r.aprox != null ? aprox[r.aprox] : null;
    const kgGris = trabajo ? (kgHoy ?? e.carga_kg ?? prev?.carga_kg ?? null) : sug?.kg ?? null;
    if (trabajo && r.kg != null) kgHoy = r.kg;
    const repsGris = seg ? e.reps_min : trabajo || dist ? e.reps_max : sug?.reps ?? null;
    const antes = prev ? (seg ? ((prev.duracion_seg ?? prev.reps) != null ? `${prev.duracion_seg ?? prev.reps} s` : '')
      : dist ? `${prev.carga_kg != null ? `${coma(enUnidad(prev.carga_kg))} × ` : ''}${prev.distancia_m != null ? `${prev.distancia_m} m` : ''}`
      : `${prev.carga_kg != null ? `${coma(enUnidad(prev.carga_kg))} × ` : ''}${prev.reps ?? ''}`) : '';
    return `<div class="serie tipo-${t}${r.hecho ? ' hecha' : ''}${seg ? ' seg' : dist ? ' dist' : ''}">
      <button type="button" class="tipo-serie" data-tipo-serie="${id}" data-i="${i}" aria-label="Serie ${etiq[i]}, ${TIPOS_SERIE[t].nombre.toLowerCase()}. Cambiar el tipo">${etiq[i]}</button>
      <span class="antes num">${esc(antes)}</span>
      ${seg ? '' : `<input type="text" inputmode="decimal" autocomplete="off" data-ej="${id}" data-i="${i}" data-c="kg" value="${esc(coma(enUnidad(r.kg)))}" placeholder="${esc(coma(enUnidad(kgGris)))}" aria-label="${u === 'lb' ? 'Libras' : 'Kilos'}${queEs ? ` de ${queEs}` : ''}, serie ${etiq[i]}">`}
      <input type="text" inputmode="numeric" autocomplete="off" data-ej="${id}" data-i="${i}" data-c="reps" value="${esc(r.reps ?? '')}" placeholder="${esc(repsGris ?? '')}" aria-label="${seg ? 'Segundos' : dist ? 'Metros' : 'Repeticiones'}, serie ${etiq[i]}">
      ${seg ? (r.hecho ? '<span aria-hidden="true"></span>' : `<button type="button" class="crono-serie" data-crono="${id}" data-i="${i}" aria-label="Contar los segundos de la serie ${etiq[i]}">${icono('reloj', 'icono')}</button>`) : dist ? '' : trabajo ? cajaEsfuerzo(id, i, r, e, etiq[i]) : '<span aria-hidden="true"></span>'}
      <button type="button" class="check" data-hecho="${id}" data-i="${i}" aria-pressed="${Boolean(r.hecho)}" aria-label="Serie ${etiq[i]} hecha">${r.hecho ? icono('visto', 'visto-serie') : ''}</button>
      ${(r.consejo || r.record?.length) && trabajo ? `<p class="consejo ${r.consejo?.tipo || 'bien'}">${r.record?.length ? '<span class="chip-record">Récord</span> ' : ''}${esc(r.consejo?.texto || '')}</p>` : ''}</div>`;
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
        <span class="ej-sub num">${esc(`${e.series} × ${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${sufijo(e)}${dist ? '' : ` · RIR ${e.rir}`}${e.carga_kg ? ` · ${peso(e.carga_kg)}${queEs ? ` de ${queEs}` : ''}` : ''} · ${descTexto}`)}</span>
        ${ej ? '' : '<span class="chip">Indicado por tu profesional</span>'}
        ${ej && E.notasFijas?.[e.ejercicio_id] ? `<button type="button" class="nota-fija" data-nota-fija="${id}" aria-label="Nota fija: ${esc(E.notasFijas[e.ejercicio_id])}. Editar">${icono('lapiz', 'icono icono-chico')}<span>${esc(E.notasFijas[e.ejercicio_id])}</span></button>` : ''}</div>
      ${ej ? `<button type="button" class="boton-icono" data-ficha="${e.ejercicio_id}" aria-label="Cómo se hace y por qué">${icono('info')}</button>` : ''}
      <button type="button" class="boton-icono" data-mas="${id}" aria-label="Más opciones de ${esc(nombre)}">${icono('puntos')}</button>
    </div>
    <div class="tabla-series${seg ? ' seg' : dist ? ' dist' : ''}">
      <div class="cab-series"><span aria-hidden="true">Serie</span><span aria-hidden="true">Anterior</span>${seg ? '' : `<span aria-hidden="true">${queEs || u}</span>`}<span aria-hidden="true">${seg ? 'Seg' : dist ? 'Metros' : 'Reps'}</span>${seg ? '<span aria-hidden="true"></span>' : dist ? '' : `<button type="button" class="cab-rir" data-ayuda-rir aria-label="Qué es el ${modoEsfuerzo(R()) === 'rir' ? 'RIR' : 'RPE'}">${modoEsfuerzo(R()) === 'rir' ? 'RIR' : 'RPE'}</button>`}<span aria-hidden="true">${icono('visto', 'icono icono-chico')}</span></div>
      ${filasHtml}
    </div>
    <div class="fila-agregar"><button type="button" class="boton agregar-serie" data-agregar="${id}">+ Serie</button>${seg ? '' : `<button type="button" class="boton agregar-serie" data-calentar="${id}">+ Calentamiento</button>`}</div>
    <div class="ejercicio-editar"><button type="button" class="enlace" data-quitar-ej="${id}">Quitar ejercicio de hoy</button></div>
    <details class="extra" data-panel="nota-${id}"${Object.keys(nota).some(k => !['nota', 'para_entrenador'].includes(k)) || abiertos.has(`nota-${id}`) ? ' open' : ''}><summary>Cómo te fue</summary>
    ${e.nota && !/^Elige un peso/.test(e.nota) ? `<p class="pequeno suave">${esc(e.nota)}</p>` : ''}
    <textarea class="nota-ej" rows="1" data-nota="${id}" data-p="nota" data-visible placeholder="Nota para tu entrenador" aria-label="Nota para tu entrenador sobre ${esc(nombre)}">${esc(nota.nota || '')}</textarea>
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
    guardarBienestarDia(datos);
  });
  // Síntomas del ciclo: se marcan y desmarcan; cuentan para ofrecer la sesión liviana.
  document.querySelectorAll('[data-b-sintoma]').forEach(boton => boton.onclick = () => {
    const antes = E.bienestar[f] || {}, v = boton.dataset.bSintoma;
    const sintomas = (antes.sintomas_ciclo || []).includes(v) ? antes.sintomas_ciclo.filter(x => x !== v) : [...(antes.sintomas_ciclo || []), v];
    guardarBienestarDia({ sueno_horas: null, sueno_calidad: null, cansancio: null, animo: null, enfermo: 'no', ...antes, sintomas_ciclo: sintomas }, { mantenerAbierto: true });
  });
  const marcarRegla = fecha => {
    const r = registrarInicio(R(), fecha, f);
    if (r.error) return avisar(r.error);
    Object.assign(R(), r.respuestas);
    bienestarAbierto = true;
    E.mensaje = fecha === f ? 'Anotado: te llegó hoy. Recalculé tu ciclo.' : `Anotado: te llegó el ${fechaCorta(fecha)}. Recalculé tu ciclo.`;
    guardar();
    cicloCambiado();
    vistaHoyMantener(ir);
  };
  $('ciclo-hoy')?.addEventListener('click', () => marcarRegla(f));
  $('ciclo-otro')?.addEventListener('change', ev => ev.target.value && marcarRegla(ev.target.value));
  function guardarBienestarDia(datos, { mantenerAbierto = false } = {}) {
    const r = evaluarDia({ ...datos, dia_dificil_ciclo: Boolean(estadoCiclo(R(), f)?.dificil) });
    const { aviso_visto, motivos, puntaje, recomendacion, enCuenta, ...limpio } = datos;
    E.bienestar[f] = { ...limpio, puntaje: r.puntaje, recomendacion: r.recomendacion, motivos: r.motivos };
    if (!datos.sintomas_ciclo?.length) delete E.bienestar[f]?.sintomas_ciclo;
    if (!respondioAlgo(E.bienestar[f])) delete E.bienestar[f];
    // Con sueño, ánimo y energía respondidos, la tarjeta se pliega sola.
    bienestarAbierto = mantenerAbierto || !PRINCIPALES.every(k => E.bienestar[f]?.[k] != null);
    guardar();
    vistaHoyMantener(ir);
    if (nube.conectado() && E.bienestar[f]) {
      const { motivos: m, ...subir } = E.bienestar[f];
      subirACuenta('bienestar', f, subir).catch(() => {});
    }
  }
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
  const empezarVacia = volver => proponerSesionVacia({ volver, alCambiar: () => { pasosAbiertos.cal = null; ir('hoy'); } });
  $('sesion-vacia-hoy')?.addEventListener('click', ev => empezarVacia(ev.currentTarget));
  $('sesion-vacia-arriba')?.addEventListener('click', ev => empezarVacia(ev.currentTarget));
  $('agregar-ejercicio-hoy')?.addEventListener('click', () => ir('banco', { desde: 'hoy' }));
  document.querySelectorAll('[data-elegir-cardio]').forEach(b => b.onclick = () => elegirCardio({ volver: b, alCambiar: () => vistaHoy(ir) }));
  if (!dia) return;
  $('banco-hoy-arriba').onclick = () => ir('banco', { desde: 'hoy' });
  document.querySelectorAll('[data-quitar-ej]').forEach(b => b.onclick = () => proponerEdicion({ tipo: 'quitar', ejercicio: b.dataset.quitarEj }, { volver: b, alCambiar: () => vistaHoyMantener(ir) }));

  $('ver-detalles-sesion')?.addEventListener('click', () => {
    const detalles = $('detalles-sesion');
    detalles.open = true;
    detalles.scrollIntoView({ block: 'start' });
  });
  const raiz = $('vista-hoy');
  const repintar = () => vistaHoyMantener(ir);
  $('cardio-hecho')?.addEventListener('click', () => {
    const antes = E.cardioHecho?.[f];
    (E.cardioHecho ||= {})[f] = { texto: dia.cardio, hecho: !(antes?.texto === dia.cardio && antes.hecho) };
    guardar(); repintar();
  });
  // Opcional, como el cardio por distancia y tiempo de Hevy: los minutos reales y los kilómetros.
  $('cardio-min')?.addEventListener('input', ev => { E.cardioHecho[f].minutos = numero(ev.target.value); guardar(); });
  $('cardio-km')?.addEventListener('input', ev => { E.cardioHecho[f].distancia_km = numero(ev.target.value); guardar(); });
  const ejercicioDe = id => { const k = dia.ejercicios.findIndex((x, j) => idDe(x, j) === id); return { e: dia.ejercicios[k], k }; };
  const lugar = (R().lugares || [])[0];
  /** Consejo para la serie siguiente (nucleo/series.js), según reps, esfuerzo y fallo. Solo en las de trabajo. */
  const consejo = (e, r) => {
    const ej = indice.porId.get(e.ejercicio_id);
    return deTrabajo(tipoDe(r)) ? consejoSerie(e, { ...r, fallo: tipoDe(r) === 'fallo' }, ej ? incrementoPara(ej, lugar) : null, { asistido: esAsistido(ej) }) : null;
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
        const rir = v == null ? null : Math.max(0, Math.min(5, Math.round(v * 2) / 2)); // pasos de medio
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
  const completarAlSalir = ev => {
    const t = ev.target;
    if (ev.type === 'focusout' && t.dataset.c === 'rir') return;
    if (!t.dataset.ej || !['kg', 'reps', 'rir'].includes(t.dataset.c)) return;
    const { e, k } = ejercicioDe(t.dataset.ej), { lista } = materializar(f, e, k);
    const i = Number(t.dataset.i), r = lista[i];
    // Peso corporal sin peso en gris (ni del plan, ni de hoy, ni de la vez anterior): se marca sin escribir kilos.
    const sinCarga = sinCargaExterna(indice.porId.get(e.ejercicio_id)) && sugerencia(e, lista, i).kg == null;
    if (!r.hecho && serieCompleta(r, e, { sinCarga })) marcarSerie(t.dataset.ej, i);
    else if (t.dataset.c === 'rir') repintar();
  };
  raiz.addEventListener('change', completarAlSalir);
  raiz.addEventListener('focusout', completarAlSalir);
  raiz.querySelectorAll('textarea.nota-ej').forEach(t => { if (t.value) { t.style.height = 'auto'; t.style.height = `${t.scrollHeight}px`; } });
  $('vista-hoy').querySelectorAll('[data-ayuda-rir]').forEach(b => b.onclick = () => abrirHoja({
    titulo: modoEsfuerzo(R()) === 'rir' ? 'RIR: repeticiones en reserva' : 'RPE: esfuerzo de la serie', volver: b,
    nota: modoEsfuerzo(R()) === 'rir'
      ? 'Cuántas repeticiones más te salían con buena técnica. 0 es al fallo, 2 es que te quedaban 2. En gris está la reserva que pide el plan; anota la real. Puedes cambiar a RPE en Más, Unidades.'
      : 'Qué tan duro fue, de 6 a 10. 10 es al fallo; 9 es que salía 1 más; 8,5 es que quizás salían 2 más. En gris está lo que pide el plan; anota lo real. Puedes cambiar a RIR en Más, Unidades.',
    opciones: [{ valor: 'ok', icono: icono('visto'), clase: 'confirmar', nombre: 'Entendido' }], alElegir: () => {},
  }));

  // El esfuerzo de una serie, como en Hevy: número grande, qué significa y la escala; cada toque se guarda al tiro.
  raiz.querySelectorAll('[data-esfuerzo]').forEach(b => b.onclick = () => abrirEsfuerzo(b.dataset.esfuerzo, Number(b.dataset.i), b));
  function abrirEsfuerzo(id, i, volver) {
    const { e, k } = ejercicioDe(id), modo = modoEsfuerzo(R());
    const { lista } = materializar(f, e, k), r = lista[i] || {};
    const sigla = modo === 'rir' ? 'RIR' : 'RPE', etiq = etiquetas(filasDe(f, e, k))[i];
    const kgVer = r.kg ?? sugerencia(e, lista, i).kg, repsVer = r.reps ?? e.reps_max;
    let elegido = deRpe(rpeDeSerie(r), modo);
    const delPlan = e.rir != null ? deRpe(10 - e.rir, modo) : null;
    const grande = v => { const sig = significado(aRpe(v ?? delPlan, modo)); return `<strong class="esfuerzo-numero${v == null ? ' gris' : ''}" id="esfuerzo-numero">${esc(textoEsfuerzo(v ?? delPlan, modo) || '·')}</strong>
      <span class="esfuerzo-titulo">${esc(v == null ? (delPlan != null ? 'Lo que pide el plan' : 'Elige un valor') : sig?.titulo || '')}</span>
      <span class="esfuerzo-detalle">${esc(sig?.detalle || '')}</span>`; };
    abrirHoja({
      titulo: `Esfuerzo de la serie (${sigla})`, volver,
      contenido: `<div class="esfuerzo-hoja">
        <p class="esfuerzo-sub">${esc(`Serie ${etiq}: ${kgVer != null ? `${coma(enUnidad(kgVer))} ${unidadPeso()}` : 'sin peso'}${repsVer != null ? ` × ${repsVer} reps` : ''}`)}</p>
        <div class="esfuerzo-grande" id="esfuerzo-grande" aria-live="polite">${grande(elegido)}</div>
        <div class="esfuerzo-escala" role="radiogroup" aria-label="${sigla}">${escalaDe(modo).map(v => `<button type="button" role="radio" data-valor="${v}" aria-checked="${v === elegido}" tabindex="${v === elegido || (elegido == null && v === (delPlan ?? escalaDe(modo)[4])) ? 0 : -1}">${esc(textoEsfuerzo(v, modo))}</button>`).join('')}</div>
        <button type="button" class="boton primario grande esfuerzo-listo" data-elegir="listo">Listo ${icono('visto', 'icono')}</button>
        ${elegido != null ? '<button type="button" class="enlace esfuerzo-quitar" data-elegir="quitar">Quitar el esfuerzo de esta serie</button>' : ''}
      </div>`,
      opciones: [],
      alElegir: v => {
        if (v === 'quitar') guardarEsfuerzo(id, i, null);
        // Al cerrar, si la serie quedó completa (peso, repeticiones y esfuerzo), se marca como hecha.
        const { e: e2, k: k2 } = ejercicioDe(id), fila = materializar(f, e2, k2).lista[i];
        const sinCarga = sinCargaExterna(indice.porId.get(e2.ejercicio_id)) && sugerencia(e2, materializar(f, e2, k2).lista, i).kg == null;
        if (v === 'listo' && fila && !fila.hecho && serieCompleta(fila, e2, { sinCarga })) marcarSerie(id, i);
        else repintar();
      },
    });
    const hoja = document.querySelector('#hoja .esfuerzo-hoja');
    if (!hoja) return;
    const elegir = boton => {
      elegido = Number(boton.dataset.valor);
      guardarEsfuerzo(id, i, aRpe(elegido, modo));
      hoja.querySelectorAll('[role="radio"]').forEach(x => { const si = x === boton; x.setAttribute('aria-checked', String(si)); x.tabIndex = si ? 0 : -1; });
      $('esfuerzo-grande').innerHTML = grande(elegido);
    };
    hoja.addEventListener('click', ev => { const x = ev.target.closest('[role="radio"]'); if (x) elegir(x); });
    hoja.addEventListener('keydown', ev => {
      const x = ev.target.closest('[role="radio"]');
      if (!x || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
      const todos = [...hoja.querySelectorAll('[role="radio"]')], j = todos.indexOf(x) + (ev.key === 'ArrowRight' ? 1 : -1);
      if (todos[j]) { ev.preventDefault(); todos[j].focus(); elegir(todos[j]); }
    });
    requestAnimationFrame(() => hoja.querySelector('[role="radio"][tabindex="0"]')?.focus());
  }
  /** Guarda el esfuerzo de una serie en RPE y en RIR (rir = 10 − rpe), y su consejo si ya está hecha. */
  function guardarEsfuerzo(id, i, rpe) {
    const { e, k } = ejercicioDe(id), { lista } = materializar(f, e, k);
    const r = { ...lista[i], rpe, rir: rpe == null ? null : Math.round((10 - rpe) * 2) / 2 };
    if (r.hecho) r.consejo = consejo(e, r);
    lista[i] = r;
    guardar();
  }

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
    let nuevas = [{}];
    if (calentar) {
      // Como la calculadora de Hevy: series livianas según el peso de trabajo, con su peso y repeticiones en gris
      // (se toman al marcar), igual que las que pone la app.
      const calculadas = aproximacionesHoy(dia, e, lista, f);
      nuevas = calculadas.map((x, j) => ({ tipo: 'calentamiento', aprox: j, _s: x }));
      const yaHay = lista.filter(x => tipoDe(x) === 'calentamiento').length;
      lista.splice(yaHay, 0, ...nuevas.map(({ _s, ...x }) => x));
    } else lista.push({});
    fijarFilas(f, idDe(e, k), n + nuevas.length);
    guardar(); repintar();
    if (calentar) avisar(nuevas.length > 1 || nuevas[0]._s?.kg ? `${nuevas.length} ${nuevas.length === 1 ? 'serie' : 'series'} de calentamiento agregadas: ${nuevas.map(x => `${coma(enUnidad(x._s?.kg))} × ${x._s?.reps}`).join(', ')}.` : 'Serie de calentamiento agregada: escribe el peso.');
  };
  raiz.querySelectorAll('[data-agregar]').forEach(b => b.onclick = () => agregarFila(b.dataset.agregar, false));
  raiz.querySelectorAll('[data-calentar]').forEach(b => b.onclick = () => agregarFila(b.dataset.calentar, true));
  raiz.querySelectorAll('[data-preparar]').forEach(b => b.onclick = () => {
    const id = b.dataset.preparar;
    const { e, k } = ejercicioDe(id);
    if (!filasDe(f, e, k).some(x => tipoDe(x) === 'calentamiento')) agregarFila(id, true);
    else repintar();
    raiz.querySelector(`[data-ej="${id}"][data-c="kg"]`)?.focus();
  });

  // Pasos del calentamiento y del estiramiento: marcar, abrir o cerrar y su cronómetro.
  raiz.querySelectorAll('[data-paso]').forEach(b => b.onclick = () => {
    const valor = b.getAttribute('aria-pressed') !== 'true';
    if (b.dataset.clave) (((E.pasosClaves ||= {})[f] ||= {})[b.dataset.paso] ||= {})[b.dataset.clave] = valor;
    else (((E.pasos ||= {})[f] ||= {})[b.dataset.paso] ||= [])[Number(b.dataset.i)] = valor;
    const completo = [...raiz.querySelectorAll(`[data-paso="${b.dataset.paso}"]`)].every(x => x === b ? valor : x.getAttribute('aria-pressed') === 'true');
    if (completo) pasosAbiertos[b.dataset.paso] = false; // completo: se pliega
    guardar(); repintar();
  });
  raiz.querySelectorAll('details[data-pasos]').forEach(d => d.addEventListener('toggle', () => { pasosAbiertos[d.dataset.pasos] = d.open; }));
  raiz.querySelectorAll('.reloj-paso').forEach(b => b.onclick = () => iniciarTramos(JSON.parse(b.dataset.tramos), b.dataset.final || '¡Listo!'));
  // Series por tiempo, como en Hevy: cuenta hacia atrás desde lo escrito o lo del plan y, al terminar (o al tocar
  // Listo antes), anota los segundos hechos y marca la serie, que parte el descanso.
  raiz.querySelectorAll('[data-crono]').forEach(b => b.onclick = () => {
    const id = b.dataset.crono, i = Number(b.dataset.i);
    const { e, k } = ejercicioDe(id), { lista } = materializar(f, e, k);
    const meta = Number(lista[i]?.reps) > 0 ? Number(lista[i].reps) : e.reps_min;
    const estado = E; // si cambia la cuenta o el día mientras corre, no se anota en otro lado
    iniciarTramos([{ seg: meta, texto: `${e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || 'Serie'}, serie ${i + 1}` }], '¡Listo!', { alTerminar: segundos => {
      if (segundos < 3) return; // un toque por error no anota nada
      if (E !== estado || f !== hoy()) return;
      const { lista: actual } = materializar(f, e, k);
      actual[i] = { ...actual[i], reps: segundos };
      guardar();
      if (!actual[i].hecho) marcarSerie(id, i); else repintar();
    } });
  });

  // Marcar una serie: si no escribió nada, toma lo de la serie anterior de hoy, lo de la vez anterior o lo del plan.
  // Lo que se guarda al marcar sin escribir (lo que está en gris): el peso escrito antes hoy, el del plan o el de la
  // vez anterior en esa misma serie.
  function sugerencia(e, lista, i) {
    const posicion = lista.slice(0, i).filter(x => deTrabajo(tipoDe(x))).length;
    const prev = e.ejercicio_id ? anterior(seriesAnotadas(E.sesiones, E.registro), e.ejercicio_id, f)?.series[posicion] : null;
    const hoyAntes = [...lista.slice(0, i)].reverse().find(x => deTrabajo(tipoDe(x)) && x.kg != null);
    return { kg: hoyAntes?.kg ?? e.carga_kg ?? prev?.carga_kg ?? null, prev };
  }
  function marcarSerie(id, i) {
    const { e, k } = ejercicioDe(id);
    const { lista, n } = materializar(f, e, k);
    const r = { ...lista[i] };
    const t = tipoDe(r);
    if (!r.hecho && deTrabajo(t)) {
      const { kg, prev } = sugerencia(e, lista, i);
      if (r.kg == null && e.unidad !== 'seg') r.kg = kg;
      if (r.reps == null) r.reps = (e.unidad === 'seg' ? e.reps_min : e.reps_max) ?? prev?.reps ?? null;
    } else if (!r.hecho && r.aprox != null) {
      // Una serie de calentamiento sin escribir se marca con el peso y las repeticiones que estaban en gris.
      const s = aproximacionesHoy(dia, e, lista, f)[r.aprox];
      if (r.kg == null && s?.kg != null) r.kg = s.kg;
      if (r.reps == null && s?.reps != null) r.reps = s.reps;
    }
    if (!r.hecho) r.t ||= Date.now();
    r.hecho = !r.hecho;
    r.consejo = r.hecho ? consejo(e, r) : null;
    // Récord, como en Hevy: contra todo lo anterior de ese ejercicio y las series previas de hoy.
    let recs = [];
    if (r.hecho && deTrabajo(t) && e.ejercicio_id) {
      const comoSerie = x => ({ ...camposGuardados(e, x), rir: x.rir ?? (x.rpe != null ? 10 - x.rpe : null) });
      // Lo anterior incluye otra sesión de hoy ya guardada (por ejemplo, una de Hevy en la mañana).
      const previas = [...seriesAnotadas(E.sesiones, {}).filter(x => x.ejercicio_id === e.ejercicio_id && x.fecha <= f),
        ...lista.slice(0, i).filter(x => x?.hecho && deTrabajo(tipoDe(x))).map(comoSerie)];
      recs = recordsDeSerie(previas, comoSerie(r), { asistido: esAsistido(indice.porId.get(e.ejercicio_id)) });
    }
    r.record = recs.length ? recs.map(x => x.tipo) : undefined;
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
    const anchoAntes = document.querySelector('#avance .medidor i')?.style.width || '0%';
    repintar();
    if (r.hecho) serieRecienMarcada(id, i, anchoAntes);
    if (recs.length) mostrarMedalla(recs, nombreDe(e));
  }
  raiz.querySelectorAll('[data-hecho]').forEach(b => b.onclick = () => marcarSerie(b.dataset.hecho, Number(b.dataset.i)));

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
        { valor: 'calentar', icono: icono('fuego'), clase: 'tipo-calentamiento', nombre: 'Agregar series de calentamiento' },
        ...(ej && ej.equipamiento.some(q => q === 'barra_rack' || q === 'smith') ? [{ valor: 'discos', icono: icono('pesa'), nombre: 'Calculadora de discos' }] : []),
        ...(ej ? [{ valor: 'nota-fija', icono: icono('lapiz'), nombre: E.notasFijas?.[e.ejercicio_id] ? 'Editar la nota fija' : 'Nota fija (aparece siempre)' }] : []),
        { valor: 'descanso', icono: icono('reloj'), nombre: `Descanso: ${mmss(desc)}${g ? ' (al terminar la vuelta)' : ''}` },
        ...(ej ? [{ valor: 'superserie', icono: icono('cadena'), nombre: g ? `Superserie ${g.letra}` : 'Hacer superserie' }] : []),
        ...(ej && porReps(e) ? [{ valor: 'prioriza', icono: icono('objetivo'), nombre: 'Si no me salen las repeticiones' }] : []),
        ...(ej ? [{ valor: 'video', icono: icono('video'), nombre: 'Ver videos de técnica' }] : []),
        ...(dia.ejercicios.length > 1 ? [{ valor: 'ordenar', icono: icono('ajustes'), nombre: 'Ordenar los ejercicios de hoy' }] : []),
        { valor: 'quitar-hoy', icono: icono('cerrar'), nombre: 'Quitar de esta sesión', peligro: true },
        { valor: 'preguntar', icono: icono('chat'), nombre: `Preguntar a ${nombreAsistente()}` },
        ...(ej ? [{ valor: 'nunca', icono: icono('cerrar'), clase: 'quitar', nombre: 'No volver a hacer este ejercicio', peligro: true }] : []),
      ],
      alElegir: v => {
        if (v === 'ficha') ir('ejercicio', { id: e.ejercicio_id, desde: 'hoy' });
        else if (v === 'cambiar') proponer({ tipo: 'elegir_alternativa', fecha: f, ejercicio: e.ejercicio_id }, { titulo: `Cambiar ${nombreDe(e)}`, volver: b, alCambiar: repintar });
        else if (v === 'calentar') agregarFila(id, true);
        else if (v === 'discos') calculadoraDiscos(e, k, b);
        else if (v === 'nota-fija') editarNotaFija(e, b);
        else if (v === 'superserie') superserie(id, b);
        else if (v === 'prioriza') abrirHoja({ titulo: 'Si no te salen las repeticiones', nota: prioridadEsfuerzo(e, ej, D(), lesiones).texto, volver: b, opciones: [{ valor: 'ok', icono: icono('visto'), clase: 'confirmar', nombre: 'Entendido' }], alElegir: () => {} });
        else if (v === 'video') window.open(enlaceVideo(ej), '_blank', 'noopener');
        else if (v === 'preguntar') ir('coach', { ejercicio: e.ejercicio_id, nombre: nombreDe(e) });
        else if (v === 'ordenar') ordenarSesion({ volver: b, alCambiar: repintar });
        else if (v === 'quitar-hoy') proponerEdicion({ tipo: 'quitar', ejercicio: id }, { volver: b, alCambiar: repintar });
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

  // Nota fija, como Hevy: aparece cada vez que haces ese ejercicio (la altura del asiento, el agarre). Es del
  // ejercicio, no del día; la nota para el entrenador sigue siendo de cada sesión.
  function editarNotaFija(e, volver) {
    const actual = E.notasFijas?.[e.ejercicio_id] || '';
    let texto = actual;
    abrirHoja({
      titulo: `Nota fija: ${nombreDe(e)}`, volver,
      nota: 'Aparece cada vez que haces este ejercicio. Por ejemplo, la altura del asiento o el agarre.',
      contenido: `<textarea id="texto-nota-fija" class="campo-nota-fija" rows="3" maxlength="200" aria-label="Nota fija" placeholder="Asiento en 4, agarre ancho">${esc(actual)}</textarea>`,
      opciones: [{ valor: 'guardar', icono: icono('visto'), clase: 'confirmar', nombre: 'Guardar' },
        ...(actual ? [{ valor: 'borrar', icono: icono('cerrar'), nombre: 'Borrar la nota', peligro: true }] : [])],
      alElegir: v => {
        const t = v === 'borrar' ? '' : texto.trim();
        E.notasFijas ||= {};
        if (t) E.notasFijas[e.ejercicio_id] = t; else delete E.notasFijas[e.ejercicio_id];
        datoCambiado('notas_fijas'); repintar();
      },
    });
    const campo = $('texto-nota-fija');
    campo.oninput = () => { texto = campo.value; };
    campo.focus();
  }
  raiz.querySelectorAll('[data-nota-fija]').forEach(b => b.onclick = () => editarNotaFija(ejercicioDe(b.dataset.notaFija).e, b));

  // Calculadora de discos, como Hevy: para la próxima serie sin marcar (lo escrito o lo que está en gris), cuánto va a
  // cada lado de la barra. La barra se elige y queda guardada para ese ejercicio.
  function calculadoraDiscos(e, k, volver) {
    const id = idDe(e, k), { lista } = materializar(f, e, k);
    const u = unidadPeso(), lb = u === 'lb';
    const i = lista.findIndex(x => !x?.hecho);
    const kg = i < 0 ? null : lista[i].kg ?? (deTrabajo(tipoDe(lista[i])) ? sugerencia(e, lista, i).kg : null);
    const barras = lb ? BARRAS_LB : BARRAS_KG;
    const barra = (E.barras || {})[e.ejercicio_id] ?? barras[0];
    const total = kg == null ? null : enUnidad(kg);
    const r = total == null ? null : discosPorLado(total, { barra, discos: discosDisponibles(lugar?.incremento_minimo_kg, u) });
    const n = x => coma(Math.round(x * 100) / 100);
    const lado = r?.porLado.flatMap(x => Array.from({ length: x.n }, () => x.peso)) || [];
    const dibujo = r && !r.porLado.length ? '' : `<div class="barra-discos" aria-hidden="true"><span class="manga"></span><span class="tope"></span>${lado.map(p => `<span class="disco d${String(p).replace('.', '_')}" style="--alto:${Math.round(34 + 66 * Math.min(1, p / (lb ? 45 : 25)))}%"></span>`).join('')}</div>`;
    const texto = !r ? 'Escribe el peso de la serie y vuelve a abrir la calculadora.'
      : r.falta < 0 ? `Es menos que la barra sola (${n(barra)} ${u}).`
      : !r.porLado.length ? `Solo la barra de ${n(barra)} ${u}.`
      : `A cada lado: ${r.porLado.map(x => `${x.n > 1 ? `${x.n} × ` : ''}${n(x.peso)}`).join(' + ')} ${u}, con la barra de ${n(barra)} ${u}.${r.falta > 0 ? ` Con tus discos llegas a ${n(r.lograble)} ${u}: faltan ${n(r.falta)}.` : ''}`;
    abrirHoja({
      titulo: r ? `Discos para ${n(total)} ${u}` : 'Calculadora de discos', volver,
      contenido: `${dibujo}<p class="pequeno texto-discos">${esc(texto)}</p>`,
      opciones: [...barras.map(x => ({ valor: String(x), icono: x === barra ? icono('visto') : '', clase: 'confirmar', nombre: `Barra de ${n(x)} ${u}` })),
        { valor: 'listo', icono: icono('flecha'), nombre: 'Listo' }],
      alElegir: v => { if (v === 'listo') return; (E.barras ||= {})[e.ejercicio_id] = Number(v); guardar(); calculadoraDiscos(e, k, volver); },
    });
  }

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
          opciones: C.zonas.articulaciones.map(([z, t]) => ({ valor: z, imagen: srcArticulacion(z), icono: icono('curita'), clase: 'tipo-fallo', nombre: t })),
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
          ...camposGuardados(e, r),
          rpe: r.rpe ?? null, rir: tipo === 'fallo' ? 0 : r.rpe != null ? 10 - r.rpe : null });
      }
      const n = (E.notas[f] || {})[id];
      if (n && Object.keys(n).length) {
        const { nota, para_entrenador, ...respuestas } = n;
        notas.push({ fecha: f, ejercicio_id: e.ejercicio_id, respuestas, nota: nota || null, para_entrenador: Boolean(para_entrenador) });
      }
    });
    for (const [id, retirado] of Object.entries(E.retirados?.[f] || {})) {
      if (dia.ejercicios.some(e => e.ejercicio_id === id)) continue;
      series.push(...retirado.series.map(s => ({ ...s, orden: orden++ })));
      const n = E.notas[f]?.[id];
      if (n) { const { nota, para_entrenador, ...respuestas } = n; notas.push({ fecha: f, ejercicio_id: id, respuestas, nota: nota || null, para_entrenador: Boolean(para_entrenador) }); }
    }
    const cardio = registroCardio(dia.cardio, E.cardioHecho?.[f]);
    if (cardio) series.push({ ...cardio, orden: orden++ });
    if (!series.length) { avisar('Marca al menos una serie como hecha.'); return; }
    // El id es del teléfono y se mantiene al guardar de nuevo: así la cuenta la reemplaza en vez de duplicarla.
    // Las sesiones importadas (Hevy) de ese día no se tocan.
    const id = E.sesiones.find(s => s.fecha === f && !s.origen)?.id || crypto.randomUUID();
    E.sesiones = E.sesiones.filter(s => !(s.fecha === f && !s.origen));
    const hora = ahora().slice(11);
    const minutos = avance(dia).cifras.minutos ?? (cardio ? Math.round(cardio.duracion_seg / 60) : null);
    E.sesiones.push({ id, fecha: f, hora, titulo: dia.foco, duracion_min: minutos, series, notas });
    E.mensaje = `Sesión guardada: ${series.length} serie${series.length === 1 ? '' : 's'}.`;
    detenerDescanso();
    guardar();
    if (nube.conectado()) {
      const subio = await subirACuenta('sesion', id, { fecha: f, hora, titulo: dia.foco, duracion_min: minutos, series, notas });
      E.mensaje += subio ? ' También quedó en tu cuenta.' : ' Todavía no se pudo subir a tu cuenta: queda en este teléfono y se sube sola cuando vuelva la señal.';
      guardar();
    }
    // Como Hevy: al guardar se abre el resumen (récords, cuánto levantaste, qué salió bien y qué salió mal).
    ir('resumen', { id });
  };
}

/** Vuelve a dibujar Hoy sin mover la pantalla ni perder el campo o el botón donde estaba el foco. */
function vistaHoyMantener(ir) {
  repintarConservando(() => vistaHoy(ir));
}
