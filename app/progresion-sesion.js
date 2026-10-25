// Para la próxima: al terminar una sesión, el resumen muestra cómo quedarían las próximas veces de cada ejercicio según
// lo que se hizo hoy (nucleo/progresion.js: ajustarTrasSesion), con el antes, el después y el porqué. Nada cambia sin
// el sí de la persona (regla 10 de AGENTS.md): con un toque se aplica aquí y en la cuenta, y se puede deshacer.
import { E, R, indice, guardar, cambiarPlan, esc, peso, fechaCorta, hoy, avisar } from './comun.js';
import { ajustarTrasSesion, deshacerAjustes } from '../nucleo/progresion.js';
import { historialPorSemana } from '../nucleo/semanal.js';
import { esDeTrabajoGuardada } from '../nucleo/registro.js';
import { huellaNotas } from '../nucleo/revision-semanal.js';
import { sumarDias } from '../nucleo/agenda.js';
import * as nube from './nube.js';

const lugarDe = dia => (R().lugares || []).find(x => x.nombre === dia?.lugar) || (R().lugares || []).find(x => x.principal) || (R().lugares || [])[0];
const trabajo = sesion => (sesion.series || []).filter(s => s.ejercicio_id && esDeTrabajoGuardada(s))
  .map(s => ({ ejercicio_id: s.ejercicio_id, carga_kg: s.carga_kg ?? null, reps: s.reps ?? null, rir: s.tipo === 'fallo' ? 0 : s.rir ?? null, rpe: s.rpe ?? null }));
// Si se guarda de nuevo la sesión con otras cifras, la propuesta se vuelve a calcular.
const huella = sesion => huellaNotas(JSON.stringify(trabajo(sesion)));

/** Solo la última sesión anotada en la app, de esta semana: las viejas del historial no proponen nada. */
function corresponde(sesion) {
  if (!sesion || sesion.origen || !E.plan?.dias?.length || E.plan.libre || E.plan.bloqueado) return false;
  if (sesion.fecha < sumarDias(hoy(), -7)) return false;
  const ultima = E.sesiones.filter(s => !s.origen).reduce((m, s) => (!m || s.fecha > m.fecha || (s.fecha === m.fecha && (s.hora || '') > (m.hora || '')) ? s : m), null);
  return ultima?.id === sesion.id;
}

function calcular(sesion, plan) {
  const dia = plan.dias.find(d => d.fecha === sesion.fecha);
  const calidades = Object.fromEntries((sesion.notas || []).filter(n => n.ejercicio_id).map(n => [n.ejercicio_id, n.respuestas || {}]));
  const otras = E.sesiones.filter(s => s.id !== sesion.id);
  return ajustarTrasSesion({ plan, fecha: sesion.fecha, series: trabajo(sesion), indice, lugar: lugarDe(dia), historialSemanas: historialPorSemana(otras, sesion.fecha), calidades });
}

function registrar(id, dato) {
  const lista = Object.entries({ ...(E.ajustesSesion || {}), [id]: { ...dato, cuando: Date.now() } }).sort((a, b) => b[1].cuando - a[1].cuando).slice(0, 8);
  E.ajustesSesion = Object.fromEntries(lista);
  guardar();
}

/** Qué mostrar para la sesión: {estado: 'propuesta' | 'aplicado' | null, cambios}. */
export function ajustesDeSesion(sesion) {
  if (!corresponde(sesion)) return { estado: null, cambios: [] };
  const reg = E.ajustesSesion?.[sesion.id];
  const h = huella(sesion);
  if (reg?.huella === h && reg.estado === 'aplicado') return { estado: 'aplicado', cambios: reg.cambios };
  if (reg?.huella === h && reg.estado === 'descartado') return { estado: null, cambios: [] };
  // Guardada de nuevo con otras cifras después de aplicar: se calcula sobre el plan sin lo que se aplicó.
  const base = reg?.estado === 'aplicado' ? deshacerAjustes(E.plan, reg.cambios) : E.plan;
  const { cambios } = calcular(sesion, base);
  return { estado: cambios.length ? 'propuesta' : null, cambios };
}

export async function aplicarAjustes(sesion) {
  const reg = E.ajustesSesion?.[sesion.id];
  const base = reg?.estado === 'aplicado' ? deshacerAjustes(E.plan, reg.cambios) : E.plan;
  const { plan, cambios } = calcular(sesion, base);
  if (!cambios.length) return;
  const n = cambios.length;
  const aviso = await cambiarPlan(plan, `Próximas sesiones ajustadas a lo de ${fechaCorta(sesion.fecha)} (${n} ${n === 1 ? 'ejercicio' : 'ejercicios'})`, nube);
  registrar(sesion.id, { estado: 'aplicado', huella: huella(sesion), cambios });
  avisar(aviso || (n === 1 ? 'Listo: la próxima vez de ese ejercicio ya está ajustada.' : `Listo: ${n} ejercicios ajustados para las próximas sesiones.`));
}

export async function deshacerAjustesSesion(sesion) {
  const reg = E.ajustesSesion?.[sesion.id];
  if (reg?.estado !== 'aplicado') return;
  const aviso = await cambiarPlan(deshacerAjustes(E.plan, reg.cambios), `Ajuste de las próximas sesiones deshecho (${fechaCorta(sesion.fecha)})`, nube);
  registrar(sesion.id, { estado: 'descartado', huella: reg.huella });
  avisar(aviso || 'Listo: tus próximas sesiones quedaron como estaban.');
}

export function descartarAjustes(sesion) { registrar(sesion.id, { estado: 'descartado', huella: huella(sesion) }); }

const dosis = v => `${v.carga_kg != null ? `${peso(v.carga_kg)} × ` : ''}${v.reps_min === v.reps_max ? v.reps_min : `${v.reps_min} a ${v.reps_max}`}`;

/** La tarjeta "Para la próxima" del resumen ('' si no hay nada que proponer). */
export function ajustesHtml(sesion) {
  const { estado, cambios } = ajustesDeSesion(sesion);
  if (!estado) return '';
  const items = cambios.map(c => `<div class="ajuste-vivo${estado === 'aplicado' ? ' hecho' : ''}">
      <p><b>${esc(c.nombre)}</b>, desde el ${esc(fechaCorta(c.desde))}: ${esc(c.motivo)}</p>
      <p class="pequeno antes-ahora">Antes: ${esc(dosis(c.antes))} · ${estado === 'aplicado' ? 'Ahora' : 'Quedaría'}: ${esc(dosis(c.despues))}</p>
    </div>`).join('');
  return `<h3>Para la próxima</h3>
    <p class="pequeno suave">${estado === 'aplicado' ? 'Tu plan quedó ajustado con lo de hoy:' : 'Con lo que hiciste hoy, así quedarían las próximas veces de estos ejercicios:'}</p>
    ${items}
    <div class="fila-botones">${estado === 'aplicado'
    ? '<button type="button" class="boton" data-ajustes="deshacer">Deshacer</button>'
    : '<button type="button" class="boton primario" data-ajustes="aplicar">Aplicar a mi plan</button><button type="button" class="boton" data-ajustes="dejar">Dejar como está</button>'}</div>`;
}

/** Los botones de la tarjeta: aplican, dejan o deshacen y vuelven a dibujarla. */
export function enlazarAjustes(caja, sesion) {
  if (!caja) return;
  caja.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-ajustes]');
    if (!b) return;
    b.disabled = true;
    if (b.dataset.ajustes === 'aplicar') await aplicarAjustes(sesion);
    else if (b.dataset.ajustes === 'deshacer') await deshacerAjustesSesion(sesion);
    else descartarAjustes(sesion);
    const html = ajustesHtml(sesion);
    if (html) caja.innerHTML = html; else caja.remove();
  });
}
