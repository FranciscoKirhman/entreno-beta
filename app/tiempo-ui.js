// "Ajustar el tiempo": una rueda que se gira para elegir cuántos minutos hay hoy (como Down Dog), con la vista previa
// de cómo queda la sesión y el botón para confirmar. También "Tengo tiempo indefinido" y volver a la sesión del plan.
// Se puede abrir antes de empezar (minutos de la sesión completa) o a mitad. A mitad, la rueda muestra el tiempo total
// (lo que llevas más lo que queda), con un botón para verlo como tiempo restante: con lo que queda, la gente ponía su
// tiempo total y la sesión crecía de más (Francisco, 9 de noviembre de 2026). Lo hecho no se toca.
// El cálculo está en nucleo/tiempo-sesion.js; aquí solo la rueda, la hoja y el guardado.
import { E, hoy, esc, cambiarPlan, avisar, guardar, indice } from './comun.js';
import { sesionDe } from '../nucleo/agenda.js';
import { duracionSesion, minutosCardio } from '../nucleo/motor-plan.js';
import { ajustarTiempo, hechasDelDia, filasTrasAjuste, minutosRestantes, duracionReal, RUEDA } from '../nucleo/tiempo-sesion.js';
import { factorRitmo, textoRitmo, accesoriosHoy, topeSeriesHoy } from './ritmo.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';
import { msActivos } from '../nucleo/duracion-sesion.js';

/** Minutos que lleva la sesión de hoy (sin las pausas), o 0 si no empezó. */
const llevaHoy = f => { const inicio = E.inicioSesion?.[f]; return inicio ? Math.max(0, Math.round(msActivos({ inicio, pausa: E.pausas?.[f] || null, ahora: Date.now() }) / 60000)) : 0; };

const GRADOS = 330; // la rueda deja un hueco arriba para que el mínimo y el máximo no se toquen
const R_ANILLO = 92, C = 120;
export const firmaDe = d => JSON.stringify({ ejercicios: d.ejercicios, cardio: d.cardio ?? null });
const redondear = n => Math.min(RUEDA.max, Math.max(RUEDA.min, Math.round(n / RUEDA.paso) * RUEDA.paso));
const nombre = id => indice.porId.get(id)?.nombre || id;

/** La sesión del plan sin ajustar: la guardada al primer ajuste de hoy, mientras nadie haya cambiado el día de otra forma. */
function baseDe(f, dia) {
  const g = E.tiempoHoy?.[f];
  if (g && g.firma === firmaDe(dia)) return g;
  return { base: { ejercicios: structuredClone(dia.ejercicios), cardio: dia.cardio ?? null, calentamiento: dia.calentamiento }, minutos: undefined };
}

const punto = grados => {
  const a = (grados - 90 + (360 - GRADOS) / 2) * Math.PI / 180;
  return [C + R_ANILLO * Math.cos(a), C + R_ANILLO * Math.sin(a)];
};
const gradosDe = v => ((v - RUEDA.min) / (RUEDA.max - RUEDA.min)) * GRADOS;
function arco(desde, hasta) {
  const [x1, y1] = punto(desde), [x2, y2] = punto(hasta);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R_ANILLO} ${R_ANILLO} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function ruedaHtml(v, planMin, pregunta, cambio = '') {
  const [mx, my] = punto(gradosDe(redondear(planMin)));
  return `<div class="tiempo-rueda" data-sin-arrastre>
    <button type="button" class="boton-icono tiempo-menos" data-paso="-1" aria-label="Cinco minutos menos">−</button>
    <svg viewBox="0 0 240 240" class="rueda" aria-hidden="true">
      <path class="rueda-pista" d="${arco(0, GRADOS)}"/>
      <path class="rueda-valor" d="${arco(0, Math.max(0.01, gradosDe(v)))}"/>
      <circle class="rueda-plan" cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="4"/>
      <circle class="rueda-perilla" cx="${punto(gradosDe(v))[0].toFixed(1)}" cy="${punto(gradosDe(v))[1].toFixed(1)}" r="14"/>
    </svg>
    <div class="rueda-centro" role="slider" tabindex="0" aria-label="${esc(pregunta)}" aria-valuemin="${RUEDA.min}" aria-valuemax="${RUEDA.max}" aria-valuenow="${v}" aria-valuetext="${v} minutos">
      <strong class="num">${v}</strong><span>minutos</span>
    </div>
    <button type="button" class="boton-icono tiempo-mas" data-paso="1" aria-label="Cinco minutos más">+</button>
  </div>
  ${cambio}
  <p class="tiempo-resumen pequeno" aria-live="polite"></p>`;
}

/** Qué cambia respecto de la sesión del plan, en pocas palabras. A mitad de la sesión cuenta solo lo que falta. */
function resumen(r, base, hechas, enCurso, delPlan = false, lleva = null) {
  const faltan = ejs => ejs.reduce((a, e) => a + Math.max(0, e.series - (enCurso ? hechas[e.ejercicio_id]?.trabajo || 0 : 0)), 0);
  const series = faltan(r.ejercicios), antes = faltan(base.ejercicios);
  const ejercicios = r.ejercicios.filter(e => !enCurso || e.series > (hechas[e.ejercicio_id]?.trabajo || 0)).length;
  const cardio = minutosCardio(r.cardio);
  const partes = [`${ejercicios} ejercicio${ejercicios === 1 ? '' : 's'}`, `${series} serie${series === 1 ? '' : 's'}${series !== antes ? ` (el plan trae ${antes})` : ''}`];
  if (r.cardio !== base.cardio) partes.push(cardio ? `cardio de ${cardio} min` : 'sin cardio');
  const fuera = r.quitados.length ? ` Hoy no van: ${r.quitados.map(nombre).join(', ')}.` : '';
  const juntas = r.superseries?.length ? ` En superserie: ${r.superseries.map(ids => ids.map(nombre).join(' con ')).join(', ')}.` : '';
  const suma = r.agregados?.length ? ` Suma, como opcional: ${r.agregados.map(nombre).join(', ')}.` : '';
  // Aunque se pidan tres horas, la sesión crece hasta lo razonable (series por músculo y por sesión).
  const tope = r.tope ? ' Más que esto no suma: hoy ya tiene lo que rinde, y más series serían cansancio para las próximas sesiones.' : '';
  const inicio = delPlan ? (enCurso ? 'Lo que falta del plan: ' : 'Así viene en el plan: ') : enCurso ? 'Te quedaría: ' : '';
  const minutos = enCurso && lleva != null ? `Unos ${r.minutos + lleva} minutos en total (llevas ${lleva})` : `Unos ${r.minutos} minutos${enCurso ? ' más' : ''}`;
  return `${inicio}${partes.join(' · ')}. ${minutos}.${fuera}${suma}${juntas}${tope}`;
}

/**
 * Guarda la sesión de hoy con el tiempo elegido. Elegir es decidir: un ajuste automático pendiente ya no corre, y con
 * "plan" tampoco se propone de nuevo hoy, aunque se haya elegido antes de empezar, y la nota del recorte se va.
 * @param o.minutos un número, null (sin límite) o 'plan'
 */
async function guardarTiempo({ f, r, minutos, base, mensaje, alCambiar }) {
  const nuevo = structuredClone(E.plan), d = sesionDe(nuevo, f);
  d.ejercicios = r.ejercicios; d.cardio = r.cardio;
  const aviso = await cambiarPlan(nuevo, mensaje, nube);
  if (E.plan !== nuevo) { if (aviso) avisar(aviso); return; }
  // Las filas de cada ejercicio siguen a sus series nuevas, sin borrar lo hecho ni lo escrito.
  for (const e of d.ejercicios) {
    const lista = E.registro?.[f]?.[e.ejercicio_id];
    if (!lista) continue;
    const t = filasTrasAjuste(lista, e.series);
    E.registro[f][e.ejercicio_id] = t.lista;
    if (E.filas?.[f]?.[e.ejercicio_id] != null) E.filas[f][e.ejercicio_id] = t.filas;
  }
  // Solo se guarda el día de hoy: la base de otros días ya no sirve.
  E.tiempoHoy = minutos === 'plan' ? {} : { [f]: { base, firma: firmaDe(d), minutos } };
  const id = `tiempo:${f}`;
  if (E.vivaPend?.[f]?.tipo === 'tiempo') delete E.vivaPend[f];
  if (minutos === 'plan') {
    ((E.vivaNo ||= {})[f] ||= {})[id] = true;
    if (E.vivaHecho?.[f]) delete E.vivaHecho[f][id];
  }
  guardar();
  avisar(aviso || mensaje);
  alCambiar?.();
}

/** Vuelve a la sesión del plan sin abrir la rueda: el botón de la nota del recorte, en Hoy. */
export function volverAlPlan({ f = hoy(), alCambiar } = {}) {
  const dia = E.plan && sesionDe(E.plan, f);
  if (!dia) return null;
  const { base } = baseDe(f, dia);
  const r = { ejercicios: structuredClone(base.ejercicios), cardio: base.cardio };
  return guardarTiempo({ f, r, minutos: 'plan', base, mensaje: 'Sesión de hoy de vuelta como venía en el plan.', alCambiar });
}

/**
 * Abre la hoja con la rueda para la sesión de hoy.
 * @param o.alCambiar () => void después de guardar
 */
export function abrirTiempo({ volver = null, alCambiar } = {}) {
  const f = hoy(), dia = E.plan && sesionDe(E.plan, f);
  if (!dia?.ejercicios?.length) { avisar('Hoy no tienes una sesión con ejercicios para ajustar.'); return; }
  const { base, minutos: elegido } = baseDe(f, dia);
  const hechas = hechasDelDia(E.registro?.[f]);
  const marca = E.cardioHecho?.[f];
  const cardioHecho = Boolean(marca?.hecho && marca.texto === dia.cardio);
  const enCurso = Object.values(hechas).some(h => h.empezado);
  // Los minutos van a tu ritmo (app/ritmo.js); con más tiempo entran accesorios, hasta el máximo razonable.
  const ritmo = factorRitmo();
  const opciones = { hechas, cardioHecho, ritmo, accesorios: accesoriosHoy({ ...dia, ejercicios: base.ejercicios }), porId: indice.porId, topeSeries: topeSeriesHoy() };
  // A mitad de la sesión, los minutos de abajo (planMin, ahora, lo que calcula ajustarTiempo) son los que quedan; la
  // rueda muestra el total salvo que se elija ver el restante.
  const planMin = enCurso ? minutosRestantes(base, hechas, cardioHecho, ritmo) : duracionReal(base, ritmo) ?? duracionSesion(base) ?? 60;
  const ahora = enCurso ? minutosRestantes(dia, hechas, cardioHecho, ritmo) : duracionReal(dia, ritmo) ?? planMin;
  const lleva = enCurso ? llevaHoy(f) : 0;
  let modo = enCurso && E.tiempoModo === 'restante' ? 'restante' : 'total';
  const total = () => enCurso && modo === 'total';
  const mostrar = restantes => (total() ? restantes + lleva : restantes);
  const aRestantes = n => (total() ? Math.max(RUEDA.min, n - lleva) : n);
  const minimo = () => (total() ? redondear(lleva + RUEDA.min) : RUEDA.min);
  // Lo elegido se guarda como total (E.tiempoHoy, igual que el tiempo del perfil que usa la sesión viva).
  let v = Math.max(minimo(), redondear(elegido != null ? (total() ? elegido : elegido - lleva) : mostrar(ahora)));
  const ajustada = E.tiempoHoy?.[f]?.firma === firmaDe(dia);
  const preguntaDe = () => (!enCurso ? '¿Cuánto tiempo tienes hoy?' : total() ? '¿Cuánto dura tu sesión en total?' : '¿Cuánto tiempo te queda?');
  const pregunta = preguntaDe();
  const enTotal = () => (total() ? ' en total' : '');
  // La rueda va de 5 en 5: en la marca del plan, la sesión queda tal como viene (86 minutos no se recortan a 85).
  const esPlan = n => n === redondear(mostrar(planMin));
  const calcular = n => (esPlan(n) ? { ejercicios: structuredClone(base.ejercicios), cardio: base.cardio, minutos: planMin, quitados: [], agregados: [] } : ajustarTiempo(base, { minutos: aRestantes(n), ...opciones }));
  // Si la sesión no crece hasta lo pedido (el tope de lo razonable), el botón dice los minutos que de verdad tendrá.
  const textoBoton = n => { if (esPlan(n)) return `Dejar la sesión del plan (unos ${mostrar(planMin)} min${enTotal()})`; const r = calcular(n); return r.tope && mostrar(r.minutos) < n - 5 ? `Ajustar: unos ${mostrar(r.minutos)} minutos${enTotal()}, lo razonable para hoy` : `Ajustar a ${n} minutos${enTotal()}`; };
  const textoCambio = () => (modo === 'total' ? `Llevas ${lleva} min · Ver tiempo restante` : 'Ver tiempo total');
  const cambio = enCurso ? `<button type="button" class="enlace tiempo-modo" data-tiempo-modo>${esc(textoCambio())}</button>` : '';

  abrirHoja({
    titulo: pregunta, volver,
    // La rueda y el resumen de abajo ya dicen cómo queda: el detalle del ritmo se abre con el "?" del título.
    notaOculta: true,
    nota: enCurso ? `Lo que ya hiciste se queda. Lo que falta del plan toma unos ${planMin} minutos${textoRitmo() ? `, ${textoRitmo()}` : ''}.`
      : `La sesión del plan toma unos ${planMin} minutos${textoRitmo() ? `, ${textoRitmo()}` : ''}. Con menos tiempo sale lo menos importante; con más, entran series y accesorios.`,
    contenido: ruedaHtml(v, mostrar(planMin), pregunta, cambio),
    opciones: [
      { valor: 'aplicar', icono: icono('visto'), clase: 'confirmar', nombre: textoBoton(v) },
      { valor: 'indefinido', icono: icono('reloj'), nombre: 'Tengo tiempo indefinido' },
      ...(ajustada && !esPlan(v) ? [{ valor: 'plan', icono: icono('flecha'), nombre: `Volver a la sesión del plan (unos ${mostrar(planMin)} min${enTotal()})` }] : []),
    ],
    alElegir: valor => aplicar(valor === 'aplicar' ? (esPlan(v) ? 'plan' : v) : valor === 'indefinido' ? null : 'plan'),
  });

  const hoja = document.querySelector('#hoja .hoja');
  const svg = hoja.querySelector('.rueda'), centro = hoja.querySelector('.rueda-centro');
  const texto = hoja.querySelector('.tiempo-resumen'), boton = hoja.querySelector('[data-elegir="aplicar"]');
  const pintar = () => {
    hoja.querySelector('.rueda-valor').setAttribute('d', arco(0, Math.max(0.01, gradosDe(v))));
    const [x, y] = punto(gradosDe(v));
    const p = hoja.querySelector('.rueda-perilla'); p.setAttribute('cx', x.toFixed(1)); p.setAttribute('cy', y.toFixed(1));
    centro.querySelector('strong').textContent = v;
    centro.setAttribute('aria-valuenow', v); centro.setAttribute('aria-valuetext', `${v} minutos`);
    boton.lastChild.textContent = textoBoton(v);
    texto.textContent = resumen(calcular(v), base, hechas, enCurso, esPlan(v), total() ? lleva : null);
  };
  const fijar = n => { const nuevo = Math.max(minimo(), redondear(n)); if (nuevo !== v) { v = nuevo; pintar(); } };
  // Total o restante: la rueda pasa al otro y se recuerda para la próxima vez.
  hoja.querySelector('[data-tiempo-modo]')?.addEventListener('click', ev => {
    v = modo === 'total' ? Math.max(RUEDA.min, redondear(v - lleva)) : redondear(v + lleva);
    modo = modo === 'total' ? 'restante' : 'total';
    E.tiempoModo = modo; guardar();
    ev.currentTarget.textContent = textoCambio();
    hoja.querySelector('#hoja-titulo').firstChild.textContent = preguntaDe();
    centro.setAttribute('aria-label', preguntaDe());
    const [px, py] = punto(gradosDe(redondear(mostrar(planMin))));
    const marca = hoja.querySelector('.rueda-plan'); marca.setAttribute('cx', px.toFixed(1)); marca.setAttribute('cy', py.toFixed(1));
    v = Math.max(minimo(), v);
    pintar();
  });
  // Girar: el ángulo del dedo alrededor del centro da los minutos. Un salto de más de media vuelta es pasar por el
  // hueco de arriba: se queda en el extremo en vez de dar la vuelta.
  const desdePuntero = (ev, salto = false) => {
    const r = svg.getBoundingClientRect();
    const x = ev.clientX - (r.left + r.width / 2), y = ev.clientY - (r.top + r.height / 2);
    let g = (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360 - (360 - GRADOS) / 2;
    g = Math.min(GRADOS, Math.max(0, g));
    const n = RUEDA.min + (g / GRADOS) * (RUEDA.max - RUEDA.min);
    if (!salto && Math.abs(n - v) > (RUEDA.max - RUEDA.min) / 2) return; // tocar el anillo sí salta directo
    fijar(n);
  };
  let girando = false;
  svg.addEventListener('pointerdown', ev => {
    girando = true;
    try { svg.setPointerCapture(ev.pointerId); } catch { /* sin captura, el giro sigue mientras el dedo esté sobre la rueda */ }
    desdePuntero(ev, true); ev.preventDefault();
  });
  svg.addEventListener('pointermove', ev => { if (girando) desdePuntero(ev); });
  const soltar = () => { girando = false; };
  svg.addEventListener('pointerup', soltar); svg.addEventListener('pointercancel', soltar);
  hoja.querySelectorAll('[data-paso]').forEach(b => b.addEventListener('click', () => fijar(v + Number(b.dataset.paso) * RUEDA.paso)));
  centro.addEventListener('keydown', ev => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 2, PageDown: -2 }[ev.key];
    if (d) { fijar(v + d * RUEDA.paso); ev.preventDefault(); }
    else if (ev.key === 'Home') { fijar(RUEDA.min); ev.preventDefault(); }
    else if (ev.key === 'End') { fijar(RUEDA.max); ev.preventDefault(); }
  });
  pintar();

  async function aplicar(minutos) {
    const r = minutos === 'plan' ? calcular(redondear(mostrar(planMin))) : ajustarTiempo(base, { minutos: minutos == null ? null : aRestantes(minutos), ...opciones });
    const mensaje = minutos === 'plan' ? 'Sesión de hoy de vuelta como venía en el plan.' : minutos == null ? `Sesión de hoy sin límite: unos ${mostrar(r.minutos)} minutos${enTotal()}, lo más que rinde hoy.`
      : r.tope && mostrar(r.minutos) < minutos - 5 ? `Sesión de hoy ajustada: unos ${mostrar(r.minutos)} minutos${enTotal()}, lo razonable para hoy.` : `Sesión de hoy ajustada a ${minutos} minutos${enTotal()}.`;
    // Se guarda el total: lo que queda más lo que ya pasó.
    const guardado = minutos === 'plan' || minutos == null ? minutos : total() ? minutos : minutos + lleva;
    await guardarTiempo({ f, r, minutos: guardado, base, mensaje, alCambiar });
  }
}

/** Para el botón Ajustar tiempo de Entrenar, en corto: "70 min" (el total, también a mitad de la sesión) o "Sin límite". */
export function minutosDeBoton(dia) {
  const t = etiquetaTiempo(dia);
  if (t === 'Sin límite de tiempo') return 'Sin límite';
  const m = t.match(/(\d+) min/);
  return m ? `${m[1]} min` : '';
}
/** El texto del botón de Hoy: cuánto dura la sesión; si ya empezó, el total y a qué hora terminas. */
export function etiquetaTiempo(dia) {
  const f = dia.fecha, hechas = hechasDelDia(E.registro?.[f]);
  const marca = E.cardioHecho?.[f];
  const enCurso = Object.values(hechas).some(h => h.empezado);
  const ritmo = factorRitmo();
  const min = enCurso ? minutosRestantes(dia, hechas, Boolean(marca?.hecho && marca.texto === dia.cardio), ritmo) : duracionReal(dia, ritmo) ?? duracionSesion(dia);
  const g = E.tiempoHoy?.[f];
  const sinLimite = g && g.firma === firmaDe(dia) && g.minutos === null;
  if (sinLimite) return 'Sin límite de tiempo';
  if (min == null) return 'Ajustar el tiempo';
  if (!enCurso) return `Unos ${min} min`;
  // A mitad de la sesión, también a qué hora terminarías a este ritmo del plan.
  const fin = new Date(Date.now() + min * 60000);
  return `Unos ${min + llevaHoy(f)} min en total · terminas ${fin.getHours()}:${String(fin.getMinutes()).padStart(2, '0')}`;
}
