// La temporada (macrociclo, nucleo/ciclos.js) en la vista Semana: los bloques con su fase, en qué semana vas,
// la propuesta de adelantar la descarga cuando vienes cansado y armar el bloque siguiente al terminar.
import { E, guardar, R, D, esc, $, hoy, indice, fechaCorta, cambiarPlan, mostrarSemana } from './comun.js';
import { macroDelPlan, semanaDe, propuestaDescarga, adelantarDescarga, aplicarFase } from '../nucleo/ciclos.js';
import { generarPlan } from '../nucleo/motor-plan.js';
import { progresoNivel } from '../nucleo/nivel.js';
import { validarPlan } from '../nucleo/validador.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { sumarDias } from '../nucleo/agenda.js';
import * as nube from './nube.js';
import { descargaHtml } from './estados-visuales.js';
import { imagenAsistente } from './cuestionario.js';

/** Macrociclo del plan vigente; se guarda cuando cambia (plan nuevo, bloque siguiente o bloque más corto). */
export function macroActual() {
  const m = macroDelPlan(E.plan, E.macro, { nivel: D().nivel });
  if (JSON.stringify(m) !== JSON.stringify(E.macro)) { E.macro = m; guardar(); }
  return m;
}

/** Días en que se entrenó: series marcadas en Hoy y sesiones guardadas o importadas. Para el nivel (nucleo/nivel.js). */
export const fechasEntrenadas = () => [...new Set([
  ...Object.entries(E.registro || {}).filter(([, ejs]) => Object.values(ejs || {}).some(l => (l || []).some(x => x?.hecho))).map(([f]) => f),
  ...(E.sesiones || []).map(x => x.fecha).filter(Boolean),
])];

/** Historial para el motor: lo anotado en las últimas 8 semanas. */
export const historialReciente = () => seriesAnotadas(E.sesiones, E.registro, sumarDias(hoy(), -56));

const bienestarRegistros = () => Object.entries(E.bienestar || {}).filter(([, b]) => b?.puntaje != null).map(([fecha, b]) => ({ fecha, puntaje: b.puntaje }));
const claveNo = p => `${E.plan.inicio}|${p.actual}`;

/** Propuesta de adelantar la descarga, si corresponde y no se descartó esta semana. */
function propuesta() {
  const p = E.plan?.dias?.length ? propuestaDescarga(E.plan, hoy(), bienestarRegistros()) : null;
  return p && !E.descargaNo?.[claveNo(p)] ? p : null;
}

/** Aviso corto para Hoy. */
export function avisoDescargaCorto() {
  return propuesta() ? `<div class="aviso ojo estado-ilustrado aviso-descarga">
    ${imagenAsistente('descanso', 'estado-personaje')}
    <div class="estado-texto"><p>Vienes con poca energía: te propongo adelantar la descarga.</p><button type="button" class="enlace" data-ir-semana>Verlo</button></div>
  </div>` : '';
}

/** Tarjeta para confirmar la descarga adelantada (Semana). */
export function tarjetaDescarga() {
  const p = propuesta();
  if (!p) return '';
  return `<section class="tarjeta destacada" id="propuesta-descarga">${descargaHtml({ titulo: '¿Adelantamos la descarga?', texto: p.motivo })}
    <p class="pequeno">La semana ${p.semana} (desde el ${esc(fechaCorta(p.desde))}) pasa a ser de descarga: mismos ejercicios, la mitad de las series y más reserva. El bloque termina ahí, se quita la semana ${p.quita} y el bloque siguiente parte una semana antes.</p>
    <div class="fila-botones"><button type="button" class="boton" id="descarga-no">Ahora no</button><button type="button" class="boton primario" id="descarga-si">Adelantar la descarga</button></div></section>`;
}

/** Tarjeta de la temporada: bloques, semana actual y, al terminar, el bloque siguiente. */
export function tarjetaTemporada() {
  const m = macroActual();
  if (!m) return '';
  const p = E.plan, f = hoy();
  const s = semanaDe(p, f);
  const ultimo = p.dias.map(d => d.fecha).sort().at(-1);
  const actual = m.bloques.find(b => b.n === m.actual);
  const sig = m.bloques.find(b => b.n === m.actual + 1);
  const celdas = b => Array.from({ length: b.semanas }, (_, i) => {
    const w = i + 1;
    const estado = b.n < m.actual || (b.n === m.actual && (s ? w < s : f > ultimo)) ? 'pasada' : b.n === m.actual && w === s ? 'hoy' : '';
    return `<i class="${[estado, w === b.semana_descarga ? 'descarga' : ''].filter(Boolean).join(' ')}"></i>`;
  }).join('');
  const donde = !s && f < p.inicio ? `Tu plan parte el ${fechaCorta(p.inicio)}.`
    : !s ? 'Terminaste este bloque.'
      : s === p.semana_descarga ? `Vas en la semana ${s} de ${p.semanas}: es la descarga.`
        : `Vas en la semana ${s} de ${p.semanas}; la descarga es la semana ${p.semana_descarga}, desde el ${fechaCorta(sumarDias(p.inicio, (p.semana_descarga - 1) * 7))}.`;
  const listo = f >= ultimo; // el bloque siguiente se arma desde la última sesión de la descarga
  return `<section class="tarjeta" id="temporada">
    ${s === p.semana_descarga ? descargaHtml({ texto: 'Menos series y más reserva para recuperar energía antes del siguiente bloque.' }) : '<h3>Tu temporada</h3>'}
    <div class="macro" role="img" aria-label="Bloque ${m.actual} de ${m.bloques.length}${s ? `, semana ${s} de ${p.semanas}` : ''}">
      ${m.bloques.map(b => `<div class="bloque${b.n === m.actual ? ' actual' : ''}" style="flex:${b.semanas}"><div class="celdas">${celdas(b)}</div><span>${esc(b.nombre)}</span></div>`).join('')}
    </div>
    <p class="pequeno"><strong>Bloque ${m.actual} de ${m.bloques.length} · ${esc(actual.nombre)}.</strong> ${esc(actual.enfoque)} ${esc(donde)}</p>
    <details class="extra"><summary>Qué viene y por qué</summary>
      <ol class="pequeno bloques">${m.bloques.map(b => `<li${b.n === m.actual ? ' class="actual"' : ''}><strong>${esc(b.nombre)}</strong>, ${esc(fechaCorta(b.inicio))} al ${esc(fechaCorta(b.fin))} (${b.semanas} semanas). ${esc(b.enfoque)}</li>`).join('')}</ol>
      <p class="pequeno suave">Cada bloque termina con una semana de descarga (las marcas con borde). Si vienes cansado, la app te propone adelantarla.</p>
    </details>
    ${listo ? `<p class="pequeno">${sig ? `Sigue el bloque ${sig.n}, ${esc(sig.nombre.toLowerCase())}.` : 'Terminaste la temporada: puedes empezar otra.'} Parte el ${esc(fechaCorta(lunesSiguiente()))} con los pesos que anotaste.</p>
      <div class="fila-botones"><button type="button" class="boton primario" id="bloque-siguiente">${sig ? `Armar el bloque ${sig.n}` : 'Empezar una temporada nueva'}</button></div>`
      : sig && s === p.semana_descarga ? `<p class="pequeno suave">Después de tu última sesión (${esc(fechaCorta(ultimo))}) armas el bloque ${sig.n}.</p>` : ''}
  </section>`;
}

const lunesSiguiente = () => { const f = hoy(), d = new Date(f + 'T12:00:00Z').getUTCDay(); return sumarDias(f, (8 - d) % 7); };

/** Botones de las tarjetas. `volver` repinta la vista. */
export function enlazarTemporada(volver) {
  $('descarga-no')?.addEventListener('click', () => {
    const p = propuestaDescarga(E.plan, hoy(), bienestarRegistros());
    if (p) E.descargaNo = { ...(E.descargaNo || {}), [claveNo(p)]: true };
    guardar(); volver();
  });
  $('descarga-si')?.addEventListener('click', async () => {
    const p = propuestaDescarga(E.plan, hoy(), bienestarRegistros());
    if (!p) return volver();
    await cambiarPlan(adelantarDescarga(E.plan, p.semana), `Descarga adelantada: la semana ${p.semana} es de descarga y el bloque termina el ${fechaCorta(sumarDias(p.desde, 6))}.`, nube);
    mostrarSemana(p.semana); guardar(); volver();
  });
  $('bloque-siguiente')?.addEventListener('click', async () => {
    const m = macroActual();
    const sig = m?.bloques.find(b => b.n === m.actual + 1);
    // El nivel sube entre bloques, con lo que se entrenó.
    const nv = progresoNivel({ respuestas: R(), fechas: fechasEntrenadas(), hoy: hoy() });
    if (nv.sube) R().nivel_ganado = nv.alcanzado;
    const ctx = { derivados: D(), respuestas: R(), indice, hoy: hoy() };
    // Si a la persona le gusta variar, el bloque nuevo cambia algunos ejercicios del que termina.
    const anteriores = new Set((E.plan?.dias || []).flatMap(d => d.ejercicios.map(e => e.ejercicio_id)));
    const base = generarPlan({ ...ctx, historial: historialReciente(), anteriores });
    if (base.bloqueado) { E.mensaje = base.mensaje; guardar(); return volver(); }
    let plan = sig ? aplicarFase(base, sig, { minutos: ctx.derivados.duracion_min }) : base;
    if (sig && !validarPlan(plan, ctx).ok) plan = { ...base, bloque: sig.n }; // si la fase no cabe en tus reglas, el plan base
    mostrarSemana(1);
    const subio = nv.sube ? ` Subiste a nivel ${nv.alcanzado}: el plan sube un poco el volumen.` : '';
    const nuevos = new Set(plan.dias.flatMap(d => d.ejercicios.map(e => e.ejercicio_id)).filter(id => !anteriores.has(id))).size;
    const variedad = nuevos && ['variar', 'algunos'].includes(R().rotacion) ? ` Como te gusta variar, ${nuevos === 1 ? 'cambió 1 ejercicio' : `cambiaron ${nuevos} ejercicios`}.` : '';
    await cambiarPlan(plan, (sig ? `Bloque ${sig.n} armado: ${sig.nombre.toLowerCase()}. Parte el ${fechaCorta(plan.inicio)} con los pesos que anotaste.` : `Temporada nueva: parte el ${fechaCorta(plan.inicio)}.`) + subio + variedad, nube);
    volver();
  });
}
