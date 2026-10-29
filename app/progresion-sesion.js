// Para la próxima: al terminar una sesión, el resumen muestra cómo quedarían las próximas veces de cada ejercicio según
// lo que se hizo hoy (nucleo/progresion.js: ajustarTrasSesion), con el antes, el después y el porqué. Como la sesión
// viva, se aplica sola a los 10 segundos salvo que se rechace, y después se puede deshacer: es la segunda excepción a
// la regla 10 de AGENTS.md, pedida por Francisco el 25 de octubre de 2026. Si se sale del resumen antes, la cuenta
// sigue; si se cierra la app, se aplica al volver a abrirla.
import { E, R, indice, guardar, cambiarPlan, esc, peso, fechaCorta, hoy, avisar } from './comun.js';
import { ajustarTrasSesion, deshacerAjustes } from '../nucleo/progresion.js';
import { historialPorSemana } from '../nucleo/semanal.js';
import { esDeTrabajoGuardada } from '../nucleo/registro.js';
import { huellaNotas } from '../nucleo/revision-semanal.js';
import { sumarDias } from '../nucleo/agenda.js';
import { SEGUNDOS_PARA_ACEPTAR } from '../nucleo/sesion-viva.js';
import { comprobaciones, punteria } from '../nucleo/comprobacion-rir.js';
import { tecnicaPendiente } from '../nucleo/tecnica-primero.js';
import * as nube from './nube.js';

const lugarDe = dia => (R().lugares || []).find(x => x.nombre === dia?.lugar) || (R().lugares || []).find(x => x.principal) || (R().lugares || [])[0];
const serieDeTrabajo = s => ({ ejercicio_id: s.ejercicio_id, carga_kg: s.carga_kg ?? null, reps: s.reps ?? null, rir: s.tipo === 'fallo' ? 0 : s.rir ?? null, rpe: s.rpe ?? null });
const trabajo = sesion => (sesion.series || []).filter(s => s.ejercicio_id && esDeTrabajoGuardada(s)).map(serieDeTrabajo);
// Para ajustar, además, qué series fueron al fallo (la puntería no las corrige) y cuál fue la de comprobación: la última
// al fallo del ejercicio cuya nota la trae (nucleo/comprobacion-rir.js).
function trabajoAjuste(sesion) {
  const comprobadas = new Set((sesion.notas || []).filter(n => n.respuestas?.comprobacion).map(n => n.ejercicio_id));
  const series = (sesion.series || []).filter(s => s.ejercicio_id && esDeTrabajoGuardada(s));
  const ultima = new Map(series.map((s, i) => [s, i]).filter(([s]) => s.tipo === 'fallo' && comprobadas.has(s.ejercicio_id)).map(([s, i]) => [s.ejercicio_id, i]));
  return series.map((s, i) => ({ ...serieDeTrabajo(s), ...(s.tipo !== 'fallo' ? {} : ultima.get(s.ejercicio_id) === i ? { comprobacion: true } : { fallo: true }) }));
}
// Si se guarda de nuevo la sesión con otras cifras, la propuesta se vuelve a calcular.
const huella = sesion => huellaNotas(JSON.stringify(trabajo(sesion)));
const restan = reg => Math.max(0, SEGUNDOS_PARA_ACEPTAR - Math.floor((Date.now() - (reg?.desde || 0)) / 1000));
// Lo que ya se aplicó con las cifras anteriores de esta sesión: la propuesta nueva se calcula sobre el plan sin eso.
const previos = reg => (reg?.estado === 'aplicado' ? reg.cambios : reg?.previos) || null;
const baseDe = reg => (previos(reg) ? deshacerAjustes(E.plan, previos(reg)) : E.plan);

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
  // Técnica primero: si la vez anterior se rompió y hoy no se anotó cómo salió, el peso no sube (nucleo/tecnica-primero.js).
  for (const id of new Set((sesion.series || []).map(s => s.ejercicio_id).filter(Boolean))) {
    const r = calidades[id] || {}, pendiente = tecnicaPendiente(id, otras, sesion.fecha);
    if (pendiente && !r.forma && !r.rango) calidades[id] = { ...r, tecnica_pendiente: pendiente };
  }
  // La puntería de sus series de comprobación, con la de hoy: a quien le queda más de lo que anota, se le corrige.
  const correccion = punteria(comprobaciones([...otras, sesion]), sesion.fecha)?.correccion || 0;
  return ajustarTrasSesion({ plan, fecha: sesion.fecha, series: trabajoAjuste(sesion), indice, lugar: lugarDe(dia), historialSemanas: historialPorSemana(otras, sesion.fecha), calidades, correccion });
}

function registrar(id, dato) {
  const lista = Object.entries({ ...(E.ajustesSesion || {}), [id]: { ...dato, cuando: Date.now() } }).sort((a, b) => b[1].cuando - a[1].cuando).slice(0, 8);
  E.ajustesSesion = Object.fromEntries(lista);
  guardar();
}

/** Qué mostrar para la sesión: {estado: 'propuesta' | 'aplicado' | null, cambios, restan}. La cuenta de 10 segundos
 *  parte la primera vez que se muestra la propuesta. */
export function ajustesDeSesion(sesion) {
  if (!corresponde(sesion)) return { estado: null, cambios: [] };
  const reg = E.ajustesSesion?.[sesion.id];
  const h = huella(sesion);
  if (reg?.huella === h && reg.estado === 'aplicado') return { estado: 'aplicado', cambios: reg.cambios };
  if (reg?.huella === h && reg.estado === 'descartado') return { estado: null, cambios: [] };
  const { cambios } = calcular(sesion, baseDe(reg));
  if (!cambios.length) return { estado: null, cambios: [] };
  if (!(reg?.estado === 'propuesta' && reg.huella === h)) registrar(sesion.id, { estado: 'propuesta', huella: h, desde: Date.now(), previos: previos(reg) });
  return { estado: 'propuesta', cambios, restan: restan(E.ajustesSesion[sesion.id]) };
}

export async function aplicarAjustes(sesion) {
  const reg = E.ajustesSesion?.[sesion.id];
  const { plan, cambios } = calcular(sesion, baseDe(reg));
  if (!cambios.length) { registrar(sesion.id, { estado: 'descartado', huella: huella(sesion) }); return; }
  const n = cambios.length;
  registrar(sesion.id, { estado: 'aplicado', huella: huella(sesion), cambios });
  const aviso = await cambiarPlan(plan, `Próximas sesiones ajustadas a lo de ${fechaCorta(sesion.fecha)} (${n} ${n === 1 ? 'ejercicio' : 'ejercicios'})`, nube);
  avisar(aviso || (n === 1 ? 'Listo: la próxima vez de ese ejercicio ya está ajustada.' : `Listo: ${n} ejercicios ajustados para las próximas sesiones.`));
}

export async function deshacerAjustesSesion(sesion) {
  const reg = E.ajustesSesion?.[sesion.id];
  if (reg?.estado !== 'aplicado') return;
  registrar(sesion.id, { estado: 'descartado', huella: reg.huella });
  const aviso = await cambiarPlan(deshacerAjustes(E.plan, reg.cambios), `Ajuste de las próximas sesiones deshecho (${fechaCorta(sesion.fecha)})`, nube);
  avisar(aviso || 'Listo: tus próximas sesiones quedaron como estaban.');
}

export function descartarAjustes(sesion) { registrar(sesion.id, { estado: 'descartado', huella: huella(sesion) }); }

/** Lo que quedó en cuenta regresiva y ya cumplió los 10 segundos (por ejemplo, si se cerró la app): se aplica. */
export async function aplicarPendientes() {
  for (const [id, reg] of Object.entries(E.ajustesSesion || {})) {
    const sesion = E.sesiones.find(s => s.id === id);
    if (reg.estado !== 'propuesta' || restan(reg) > 0 || !sesion || !corresponde(sesion) || reg.huella !== huella(sesion)) continue;
    await aplicarAjustes(sesion);
  }
}

const dosis = v => `${v.carga_kg != null ? `${peso(v.carga_kg)} × ` : ''}${v.reps_min === v.reps_max ? v.reps_min : `${v.reps_min} a ${v.reps_max}`}`;

/** La tarjeta "Para la próxima" del resumen ('' si no hay nada que mostrar). */
export function ajustesHtml(sesion) {
  const { estado, cambios, restan: n } = ajustesDeSesion(sesion);
  if (!estado) return '';
  const hecho = estado === 'aplicado';
  const items = cambios.map(c => `<div class="ajuste-vivo${hecho ? ' hecho' : ' pendiente'}">
      <p><b>${esc(c.nombre)}</b>, desde el ${esc(fechaCorta(c.desde))}: ${esc(c.motivo)}</p>
      <p class="pequeno antes-ahora">Antes: ${esc(dosis(c.antes))} · ${hecho ? 'Ahora' : 'Quedaría'}: ${esc(dosis(c.despues))}</p>
    </div>`).join('');
  return `<h3>Para la próxima</h3>
    <p class="pequeno suave">${hecho ? 'Tu plan quedó ajustado con lo de hoy:' : 'Con lo que hiciste hoy, así quedan las próximas veces de estos ejercicios. Se aplica solo en unos segundos; si no te convence, recházalo.'}</p>
    ${items}
    ${hecho
    ? '<div class="fila-botones"><button type="button" class="boton" data-ajustes="deshacer">Deshacer</button></div>'
    : `<div class="fila-propuesta"><button type="button" class="boton chico primario" data-ajustes="aplicar"><span>Aplicar (<span data-ajustes-cuenta>${n}</span>)</span></button><button type="button" class="boton chico" data-ajustes="dejar">Rechazar</button></div>`}`;
}

// Un reloj por sesión: abrir otro resumen no cancela la cuenta que quedó corriendo.
const relojes = new Map();
const parar = id => { const r = relojes.get(id); if (r) { clearTimeout(r.aplicar); clearInterval(r.cuenta); relojes.delete(id); } };

/** Los botones de la tarjeta y su cuenta regresiva: a los 10 segundos se aplica, aunque ya no esté a la vista. */
export function enlazarAjustes(caja, sesion) {
  if (!caja) return;
  const id = sesion.id;
  parar(id);
  const repintar = () => { if (!caja.isConnected) return; const html = ajustesHtml(sesion); if (html) caja.innerHTML = html; else caja.remove(); };
  const aplicar = async () => {
    parar(id);
    const r = E.ajustesSesion?.[id];
    if (r?.estado === 'propuesta' && r.huella === huella(sesion)) await aplicarAjustes(sesion);
    repintar();
  };
  caja.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-ajustes]');
    if (!b) return;
    b.disabled = true;
    if (b.dataset.ajustes === 'aplicar') return aplicar();
    parar(id);
    if (b.dataset.ajustes === 'deshacer') await deshacerAjustesSesion(sesion);
    else descartarAjustes(sesion);
    repintar();
  });
  const reg = E.ajustesSesion?.[id];
  if (reg?.estado !== 'propuesta' || !caja.querySelector('[data-ajustes="aplicar"]')) return;
  if (restan(reg) <= 0) { aplicar(); return; }
  relojes.set(id, {
    aplicar: setTimeout(aplicar, restan(reg) * 1000 + 50),
    cuenta: setInterval(() => {
      const el = caja.isConnected && caja.querySelector('[data-ajustes-cuenta]');
      if (el) el.textContent = restan(E.ajustesSesion?.[id]);
    }, 1000),
  });
}

// Al abrir la app: lo que quedó en cuenta regresiva cuando se cerró. Espera un poco a que la cuenta traiga el plan.
const alAbrir = setTimeout(() => { aplicarPendientes().catch(() => {}); }, 4000);
alAbrir?.unref?.();
