// "Ajustar el tiempo": una rueda que se gira para elegir cuántos minutos hay hoy (como Down Dog), con la vista previa
// de cómo queda la sesión y el botón para confirmar. También "Tengo tiempo indefinido" y volver a la sesión del plan.
// Se puede abrir antes de empezar (minutos de la sesión completa) o a mitad (minutos que quedan; lo hecho no se toca).
// El cálculo está en nucleo/tiempo-sesion.js; aquí solo la rueda, la hoja y el guardado.
import { E, hoy, esc, cambiarPlan, avisar, guardar, indice } from './comun.js';
import { sesionDe } from '../nucleo/agenda.js';
import { duracionSesion, minutosCardio } from '../nucleo/motor-plan.js';
import { ajustarTiempo, hechasDelDia, filasTrasAjuste, minutosRestantes, RUEDA } from '../nucleo/tiempo-sesion.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';

const GRADOS = 330; // la rueda deja un hueco arriba para que el mínimo y el máximo no se toquen
const R_ANILLO = 92, C = 120;
const firmaDe = d => JSON.stringify({ ejercicios: d.ejercicios, cardio: d.cardio ?? null });
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

function ruedaHtml(v, planMin, pregunta) {
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
  <p class="tiempo-resumen pequeno" aria-live="polite"></p>`;
}

/** Qué cambia respecto de la sesión del plan, en pocas palabras. A mitad de la sesión cuenta solo lo que falta. */
function resumen(r, base, hechas, enCurso, delPlan = false) {
  const faltan = ejs => ejs.reduce((a, e) => a + Math.max(0, e.series - (enCurso ? hechas[e.ejercicio_id]?.trabajo || 0 : 0)), 0);
  const series = faltan(r.ejercicios), antes = faltan(base.ejercicios);
  const ejercicios = r.ejercicios.filter(e => !enCurso || e.series > (hechas[e.ejercicio_id]?.trabajo || 0)).length;
  const cardio = minutosCardio(r.cardio);
  const partes = [`${ejercicios} ejercicio${ejercicios === 1 ? '' : 's'}`, `${series} serie${series === 1 ? '' : 's'}${series !== antes ? ` (el plan trae ${antes})` : ''}`];
  if (r.cardio !== base.cardio) partes.push(cardio ? `cardio de ${cardio} min` : 'sin cardio');
  const fuera = r.quitados.length ? ` Hoy no van: ${r.quitados.map(nombre).join(', ')}.` : '';
  const inicio = delPlan ? (enCurso ? 'Lo que falta del plan: ' : 'Así viene en el plan: ') : enCurso ? 'Te quedaría: ' : '';
  return `${inicio}${partes.join(' · ')}. Unos ${r.minutos} minutos${enCurso ? ' más' : ''}.${fuera}`;
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
  const planMin = enCurso ? minutosRestantes(base, hechas, cardioHecho) : duracionSesion(base) ?? 60;
  const ahora = enCurso ? minutosRestantes(dia, hechas, cardioHecho) : duracionSesion(dia) ?? planMin;
  let v = redondear(elegido ?? ahora);
  const ajustada = E.tiempoHoy?.[f]?.firma === firmaDe(dia);
  const pregunta = enCurso ? '¿Cuánto tiempo te queda?' : '¿Cuánto tiempo tienes hoy?';
  // La rueda va de 5 en 5: en la marca del plan, la sesión queda tal como viene (86 minutos no se recortan a 85).
  const esPlan = n => n === redondear(planMin);
  const calcular = n => (esPlan(n) ? { ejercicios: structuredClone(base.ejercicios), cardio: base.cardio, minutos: planMin, quitados: [] } : ajustarTiempo(base, { minutos: n, hechas, cardioHecho }));
  const textoBoton = n => (esPlan(n) ? `Dejar la sesión del plan (unos ${planMin} min)` : `Ajustar a ${n} minutos`);

  abrirHoja({
    titulo: pregunta, volver,
    nota: enCurso ? `Lo que ya hiciste se queda. Lo que falta del plan toma unos ${planMin} minutos.` : `La sesión del plan toma unos ${planMin} minutos. Gira la rueda y te muestro cómo queda.`,
    contenido: ruedaHtml(v, planMin, pregunta),
    opciones: [
      { valor: 'aplicar', icono: icono('visto'), clase: 'confirmar', nombre: textoBoton(v) },
      { valor: 'indefinido', icono: icono('reloj'), nombre: 'Tengo tiempo indefinido' },
      ...(ajustada && !esPlan(v) ? [{ valor: 'plan', icono: icono('flecha'), nombre: `Volver a la sesión del plan (unos ${planMin} min)` }] : []),
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
    texto.textContent = resumen(calcular(v), base, hechas, enCurso, esPlan(v));
  };
  const fijar = n => { const nuevo = redondear(n); if (nuevo !== v) { v = nuevo; pintar(); } };
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
    const r = minutos === 'plan' ? calcular(redondear(planMin)) : ajustarTiempo(base, { minutos, hechas, cardioHecho });
    const nuevo = structuredClone(E.plan), d = sesionDe(nuevo, f);
    d.ejercicios = r.ejercicios; d.cardio = r.cardio;
    const mensaje = minutos === 'plan' ? 'Sesión de hoy de vuelta como venía en el plan.' : minutos == null ? 'Sesión de hoy sin límite de tiempo.' : `Sesión de hoy ajustada a ${minutos} minutos.`;
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
    guardar();
    avisar(aviso || mensaje);
    alCambiar?.();
  }
}

/** El texto del botón de Hoy: cuánto dura la sesión, o cuánto queda si ya empezó. */
export function etiquetaTiempo(dia) {
  const f = dia.fecha, hechas = hechasDelDia(E.registro?.[f]);
  const marca = E.cardioHecho?.[f];
  const enCurso = Object.values(hechas).some(h => h.empezado);
  const min = enCurso ? minutosRestantes(dia, hechas, Boolean(marca?.hecho && marca.texto === dia.cardio)) : duracionSesion(dia);
  const g = E.tiempoHoy?.[f];
  const sinLimite = g && g.firma === firmaDe(dia) && g.minutos === null;
  if (sinLimite) return 'Sin límite de tiempo';
  if (min == null) return 'Ajustar el tiempo';
  if (!enCurso) return `Unos ${min} min`;
  // A mitad de la sesión, también a qué hora terminarías a este ritmo del plan.
  const fin = new Date(Date.now() + min * 60000);
  return `Quedan unos ${min} min · terminas ${fin.getHours()}:${String(fin.getMinutes()).padStart(2, '0')}`;
}
