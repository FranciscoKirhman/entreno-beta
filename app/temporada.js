import { ritmoHoy, minutosDe } from './ritmo.js';
import { abrirHoja } from './hoja.js';
import { cambiosDelBorrador, primeraSemanaDelBloque, compararInicioBloques } from '../nucleo/resumen-ciclo.js';
import { NOMBRE_MUSCULO } from './musculos.js';
// La temporada (macrociclo, nucleo/ciclos.js) en la vista Semana: los bloques con su fase, en qué semana vas,
// la propuesta de adelantar la descarga cuando vienes cansado y armar el bloque siguiente al terminar.
import { E, guardar, R, D, C, esc, $, hoy, indice, fechaCorta, cambiarPlan, mostrarSemana, avisar, peso } from './comun.js';
import { derivar } from '../nucleo/derivar.js';
import { borradorCiclo, respuestasDelCiclo, aplicarBorrador } from '../nucleo/ciclo-siguiente.js';
import { macroDelPlan, semanaDe, propuestaDescarga, adelantarDescarga, aplicarFase } from '../nucleo/ciclos.js';
import { generarPlan } from '../nucleo/motor-plan.js';
import { progresoNivel } from '../nucleo/nivel.js';
import { validarPlan } from '../nucleo/validador.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { sumarDias } from '../nucleo/agenda.js';
import { bloqueSiguienteDisponible, conDiasQueQuedan, lunesDesde } from '../nucleo/bloque-siguiente.js';
import * as nube from './nube.js';
import { descargaHtml } from './estados-visuales.js';
import { imagenAsistente } from './cuestionario.js';

/** Macrociclo del plan vigente; se guarda cuando cambia (plan nuevo, bloque siguiente o bloque más corto). */
export function macroActual() {
  const m = macroDelPlan(E.plan, E.macro, { nivel: D().nivel });
  if (JSON.stringify(m) !== JSON.stringify(E.macro)) { E.macro = m; guardar(); }
  return m;
}

/** Días en que se entrenó: series marcadas en Entrenar y sesiones guardadas o importadas. Para el nivel (nucleo/nivel.js). */
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
  // El bloque siguiente se arma desde la última semana del actual: así el mes que viene queda planificado antes.
  const disp = bloqueSiguienteDisponible(p, f), listo = Boolean(disp);
  const parte = disp ? lunesDesde(disp.desde) : null;
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
    ${listo ? `<p class="pequeno">${sig ? `Sigue el bloque ${sig.n}, ${esc(sig.nombre.toLowerCase())}.` : 'Terminaste la temporada: puedes empezar otra.'} Parte el ${esc(fechaCorta(parte))} con los pesos que anotaste${disp.quedan ? '; lo que te queda de este bloque no cambia' : ''}.</p>
      <div class="fila-botones"><button type="button" class="boton primario" id="bloque-siguiente">${sig ? `Armar el bloque ${sig.n}` : 'Empezar una temporada nueva'}</button></div>`
      : sig && s === p.semana_descarga ? `<p class="pequeno suave">En la última semana del bloque (desde el ${esc(fechaCorta(sumarDias(ultimo, -6)))}) armas el bloque ${sig.n}.</p>` : ''}
  </section>`;
}

/** El lunes en que parte un plan armado desde ese día (como nucleo/motor-plan.js). */
export { lunesDesde };

/** Aviso para Entrenar en la última semana del bloque: armar el siguiente para tener el mes planificado. */
export function avisoBloqueSiguiente() {
  const disp = E.plan?.dias?.length ? bloqueSiguienteDisponible(E.plan, hoy()) : null;
  if (!disp) return '';
  const termino = disp.fin < hoy();
  return `<section class="tarjeta destacada aviso-bloque"><h3>${termino ? 'Tu plan terminó' : `Tu plan termina el ${esc(fechaCorta(disp.fin))}`}</h3>
    <p class="pequeno">Arma el bloque siguiente para tener el mes planificado: parte el ${esc(fechaCorta(lunesDesde(disp.desde)))} con los pesos que anotaste${disp.quedan ? ' y lo que te queda de este bloque no cambia' : ''}.</p>
    <div class="fila-botones"><button type="button" class="boton primario" data-bloque-siguiente>Armar el bloque siguiente</button></div></section>`;
}

/**
 * El bloque siguiente sin guardarlo (para la vista previa de Mi plan). Usa el perfil con el borrador del siguiente
 * ciclo encima (nucleo/ciclo-siguiente.js). `forzar`: armarlo aunque falte más de una semana para que termine el
 * actual; parte el lunes que viene y lo que queda del actual hasta ese día no cambia.
 * @returns {{ plan, sig, nv, anteriores, respuestas, derivados } | { bloqueado: true, mensaje } | null}
 */
export function planBloqueSiguiente({ forzar = false, cambios = null } = {}) {
  const disp = bloqueSiguienteDisponible(E.plan, hoy()) || (forzar && E.plan?.dias?.length && !E.plan.libre && !E.plan.bloqueado ? { desde: hoy() } : null);
  if (!disp) return null;
  const m = macroDelPlan(E.plan, E.macro, { nivel: D().nivel });
  const sig = m?.bloques.find(b => b.n === m.actual + 1);
  // El nivel sube entre bloques, con lo que se entrenó.
  const nv = progresoNivel({ respuestas: R(), fechas: fechasEntrenadas(), hoy: hoy() });
  const respuestas = { ...respuestasDelCiclo(R()), ...(cambios || {}), ...(nv.sube ? { nivel_ganado: nv.alcanzado } : {}) };
  const derivados = derivar(respuestas, C, hoy());
  const ctx = { derivados, respuestas, indice, hoy: disp.desde };
  // Si a la persona le gusta variar, el bloque nuevo cambia algunos ejercicios del que termina.
  const anteriores = new Set((E.plan?.dias || []).flatMap(d => d.ejercicios.map(e => e.ejercicio_id)));
  const base = generarPlan({ ...ctx, ritmo: ritmoHoy(), historial: historialReciente(), anteriores });
  if (base.bloqueado) return { bloqueado: true, mensaje: base.mensaje };
  let plan = sig ? aplicarFase(base, sig, { minutos: derivados.duracion_min, ritmo: ritmoHoy() }) : base;
  if (sig && !validarPlan(plan, ctx).ok) plan = { ...base, bloque: sig.n }; // si la fase no cabe en tus reglas, el plan base
  // Lo que queda del bloque actual solo sale si cae en un día recién marcado en este cambio: si ya estaba marcado y la
  // sesión sigue ahí, es porque la persona entrena ese día (como en el chat, nucleo/agente-chat.js).
  plan = conDiasQueQuedan(E.plan, plan, hoy(), { respuestas, derivados, indice, noPuedoAntes: R().dias_no_puedo || [] });
  return { plan, sig, nv, anteriores, respuestas, derivados };
}

/** Aplica exactamente la propuesta que se acaba de confirmar. */
async function armarBloqueSiguiente(r) {
  if (E.chatPorTraer) { avisar('Sincroniza los cambios del chat antes de modificar el plan.'); return false; }
  const original = E;
  const { plan, sig, nv, anteriores } = r;
  // Lo elegido para el siguiente ciclo pasa al perfil (y a la cuenta) junto con el bloque nuevo.
  const tenia = Boolean(borradorCiclo(R()));
  E.respuestas = aplicarBorrador(R(), hoy());
  if (nv.sube) R().nivel_ganado = nv.alcanzado;
  mostrarSemana(1);
  const subio = nv.sube ? ` Subiste a nivel ${nv.alcanzado}: el plan sube un poco el volumen.` : '';
  const nuevos = new Set(plan.dias.flatMap(d => d.ejercicios.map(e => e.ejercicio_id)).filter(id => !anteriores.has(id))).size;
  const variedad = nuevos && ['variar', 'algunos'].includes(R().rotacion) ? ` Como te gusta variar, ${nuevos === 1 ? 'cambió 1 ejercicio' : `cambiaron ${nuevos} ejercicios`}.` : '';
  const fin = plan.dias.map(d => d.fecha).sort().at(-1);
  await cambiarPlan(plan, (sig ? `Bloque ${sig.n} armado: ${sig.nombre.toLowerCase()}. Parte el ${fechaCorta(plan.inicio)} y llega hasta el ${fechaCorta(fin)}, con los pesos que anotaste.` : `Temporada nueva: parte el ${fechaCorta(plan.inicio)} y llega hasta el ${fechaCorta(fin)}.`) + subio + variedad, nube);
  if (E !== original || E.plan !== plan) return false;
  if (tenia && nube.conectado()) nube.guardarCuestionario(structuredClone(R())).catch(() => {});
  return true;
}


const CAMPO_CICLO = { musculos_prioridad: 'Músculos prioridad', dias_meta: 'Días por semana', duracion_min: 'Minutos por sesión', rotacion: 'Ejercicios' };
const valorCiclo = (campo, valor) => campo === 'musculos_prioridad' ? (valor || []).map(m => NOMBRE_MUSCULO[m] || m).join(', ') || 'Sin prioridad'
  : campo === 'rotacion' ? ({ mismos: 'Mantener', algunos: 'Rotar', variar: 'Variar' }[valor] || 'Rotar') : String(valor ?? 'Sin elegir');
const preferenciaEjercicio = valor => ({ favorito: 'Favorito', evitar: 'Evitado', sin_preferencia: 'Sin preferencia' }[valor]);

/** Resumen compartido por la edición del borrador y su confirmación. Quitar usa los guardados existentes. */
export function resumenCambiosCicloHtml(respuestas, { quitar = false } = {}) {
  const cambios = cambiosDelBorrador(respuestas);
  if (!cambios.length) return '<p class="pequeno suave">No tienes cambios pendientes en tus preferencias.</p>';
  return `<ul class="lista-simple ciclo-cambios">${cambios.map(c => {
    const nombre = c.id ? indice.porId.get(c.id)?.nombre || c.id : CAMPO_CICLO[c.campo];
    const valor = v => c.id ? preferenciaEjercicio(v) : valorCiclo(c.campo, v);
    return `<li><div><strong>${esc(nombre)}</strong> <span class="chip hoy">Cambia</span><p class="pequeno">Ahora: ${esc(valor(c.antes))}<br>Siguiente: ${esc(valor(c.despues))}</p></div>${quitar ? `<button type="button" class="enlace" ${c.id ? `data-ciclo-quitar-ejercicio="${esc(c.id)}"` : `data-ciclo-quitar-campo="${c.campo}"`} aria-label="Quitar el cambio de ${esc(nombre)}">Quitar</button>` : ''}</li>`;
  }).join('')}</ul>`;
}

const firmaCiclo = () => JSON.stringify([E.plan, R(), E.registro, E.sesiones, E.inicioSesion, E.descansosMedidos, E.macro, hoy()]);
const dosisCiclo = e => `${e.series} series de ${e.reps_min} a ${e.reps_max}${e.unidad === 's' ? ' s' : ' reps'}${e.carga_kg != null ? `, ${peso(e.carga_kg)}` : ''}, ${e.rir} en reserva, ${e.descanso_seg} s de descanso`;
const semanaCicloHtml = plan => primeraSemanaDelBloque(plan).map(d => `<p class="pequeno"><strong>${esc(d.foco)} · ${esc(fechaCorta(d.fecha))} · ~${minutosDe(d)} min</strong></p><ul class="pequeno">${(d.ejercicios || []).map(e => `<li>${esc(e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || 'Ejercicio')}: ${esc(dosisCiclo(e))}</li>`).join('')}</ul>`).join('');

/** Todas las entradas muestran la misma propuesta y avisos. Cancelar no modifica el plan ni el borrador. */
export function confirmarBloqueSiguiente({ forzar = false, volver = null, alConfirmar = () => {} } = {}) {
  const original = E, r = planBloqueSiguiente({ forzar });
  if (!r) { avisar('Todavía no está disponible el siguiente bloque.'); return; }
  const validacion = r.bloqueado ? null : validarPlan(r.plan, { respuestas: r.respuestas, derivados: r.derivados, indice, hoy: hoy() });
  const bloqueado = r.bloqueado || !validacion.ok;
  const avisos = r.bloqueado ? [r.mensaje] : [...validacion.errores, ...validacion.advertencias].map(a => a.mensaje);
  const firma = firmaCiclo();
  let consumida = false;
  const comparacion = compararInicioBloques(E.plan, r.plan);
  const nombres = ids => ids.map(id => indice.porId.get(id)?.nombre || id).join(', ');
  abrirHoja({ titulo: 'Así quedaría el siguiente ciclo', volver,
    nota: bloqueado ? 'Revisa estos avisos antes de armar el bloque.' : `${forzar ? 'El siguiente bloque se adelanta. ' : ''}Parte el ${fechaCorta(r.plan.inicio)}. Lo registrado no cambia. Confirma solo si quieres aplicar esta propuesta.`,
    contenido: `${avisos.length ? `<div class="aviso ojo"><ul>${[...new Set(avisos)].map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}${bloqueado ? '' : `
      <p class="pequeno"><strong>Primera semana de cada bloque</strong><br>Ahora: ${comparacion.antes.sesiones} sesiones, ${comparacion.antes.series} series.<br>Siguiente: ${comparacion.despues.sesiones} sesiones, ${comparacion.despues.series} series.</p>
      ${comparacion.entran.length ? `<p class="pequeno">Entran: ${esc(nombres(comparacion.entran))}.</p>` : ''}
      ${comparacion.salen.length ? `<p class="pequeno">Salen: ${esc(nombres(comparacion.salen))}.</p>` : ''}
      <h4>Preferencias</h4>${resumenCambiosCicloHtml(R())}
      ${r.nv.sube ? `<p class="aviso">Subes a nivel ${esc(r.nv.alcanzado)}; el volumen puede aumentar.</p>` : ''}
      <p class="pequeno">${esc(r.sig?.enfoque || 'Empieza una temporada nueva con las cargas de tus registros.')}</p>
      <details><summary>Comparar ejercicios, series y descansos</summary><h4>Ahora</h4>${semanaCicloHtml(E.plan)}<h4>Siguiente</h4>${semanaCicloHtml(r.plan)}</details>
      <p class="pequeno">El bloque llega hasta el ${esc(fechaCorta(r.plan.dias.map(d => d.fecha).sort().at(-1)))}.</p>`}`,
    opciones: [...(bloqueado ? [] : [{ valor: 'si', nombre: 'Confirmar y armar el bloque' }]), { valor: 'no', nombre: 'Volver sin cambiar' }],
    alElegir: async valor => {
      if (valor !== 'si' || consumida || bloqueado) return;
      consumida = true;
      if (E !== original || firma !== firmaCiclo()) { avisar('Tus datos cambiaron. Abre de nuevo la propuesta antes de confirmar.'); return; }
      if (await armarBloqueSiguiente(r)) alConfirmar();
    },
  });
}

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
  $('bloque-siguiente')?.addEventListener('click', ev => confirmarBloqueSiguiente({ volver: ev.currentTarget, alConfirmar: volver }));
}
