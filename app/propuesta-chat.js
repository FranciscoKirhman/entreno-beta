import { E, guardar, esc, ambitoDatos } from './comun.js';
import * as nube from './nube.js';
import { conPropios, idsPropios } from '../nucleo/propios.js';
import { unirSesiones } from '../nucleo/sincronizacion.js';
import { firmaPerfil } from '../nucleo/firma-perfil.js';

const ETIQUETAS = { objetivo_principal: 'Objetivo', tiempo_entrenando: 'Experiencia', dias_meta: 'Días por semana', dias_firmes: 'Días seguros', duracion_min: 'Minutos por sesión', dias_no_puedo: 'Días que no podís', musculos_prioridad: 'Prioridades', rotacion: 'Variedad' };
export function propuestaChatHtml(p) {
  const estado = ({ aplicada: 'Cambios aceptados', descartada: 'Propuesta descartada', por_comprobar: 'Confirmación por comprobar', no_disponible: 'Propuesta no disponible' })[p.estado] || 'Por confirmar';
  const paquete = p.paquete || { plan: p.plan };
  const plan = paquete.plan;
  const filas = (paquete.sesiones || []).map(x => `<li><strong>${esc(x.sesion.fecha || new Date(x.sesion.inicio).toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }))}: ${esc(x.sesion.titulo)}</strong>${x.sesion.comentario ? `<p>${esc(x.sesion.comentario)}</p>` : ''}<ul>${x.series.map(s => `<li>${esc(s.ejercicio_nombre)}: ${detalleSerie(s)}${s.ejercicio_id ? '' : ' (conservado por nombre)'}</li>`).join('')}</ul></li>`).join('');
  return `<div class="propuesta-chat"><p><strong>${estado}</strong></p><ul>${(p.resumen || ['Revisa el plan antes de decidir.']).map(t => `<li>${esc(t)}</li>`).join('')}</ul><details><summary>Ver los cambios completos</summary>
    ${paquete.respuestas ? `<dl>${Object.entries(ETIQUETAS).filter(([k]) => paquete.respuestas[k] !== undefined).map(([k, label]) => `<dt>${label}</dt><dd>${esc(Array.isArray(paquete.respuestas[k]) ? paquete.respuestas[k].join(', ') : paquete.respuestas[k])}</dd>`).join('')}</dl>` : ''}
    ${plan ? plan.dias.map(d => `<p><strong>${esc(d.fecha)}${d.hora ? ', ' + esc(d.hora).slice(0, 5) : ''}: ${esc(d.foco)}</strong><br>${d.ejercicios.map(e => `${esc(e.nombre || e.ejercicio_id)}: ${esc(e.series)} series de ${esc(e.reps_min)} a ${esc(e.reps_max)} ${esc(e.unidad || 'reps')}, RIR ${esc(e.rir)}, ${e.carga_kg == null ? 'peso por elegir' : esc(e.carga_kg) + ' kg'}, descanso ${esc(e.descanso_seg)} s`).join('<br>')}</p>`).join('') : ''}
    ${filas ? `<ul>${filas}</ul>` : ''}
    ${(paquete.suplementos || []).map(s => `<p>${esc(s.nombre)}: ${esc(s.dosis || 'sin dosis anotada')}, ${esc(s.horas.join(', ') || 'sin horario')}, días ${esc(s.dias.length ? s.dias.join(', ') : 'todos')}, ${s.activo ? 'activo' : 'pausado'}</p>`).join('')}
    ${(paquete.tomas || []).map(t => `<p>Toma: ${esc(t.suplemento_nombre || 'Suplemento anotado')}, ${esc(t.fecha)} ${esc(t.hora || '')}</p>`).join('')}
    ${(paquete.bienestar || []).map(b => `<p>${esc(b.fecha)}: ${Object.entries(b).filter(([k]) => !['fecha', 'puntaje', 'recomendacion'].includes(k)).map(([k, v]) => `${esc(k.replaceAll('_', ' '))}: ${esc(v)}`).join(', ')}</p>`).join('')}
    </details></div>`;
}

/** Trae lo que el servidor confirmó, sin subir copias antiguas del teléfono. */
export async function confirmarCambioChat(id) {
  const estado = E, usuario = nube.usuarioId();
  const vigente = () => E === estado && usuario === nube.usuarioId() && ambitoDatos === usuario;
  if (!vigente()) return false;
  if (E.chatPorTraer) throw new Error('Sincroniza los cambios aceptados en tu cuenta antes de aceptar otra propuesta.');
  if (E.planPendiente || E.pendientes?.length) throw new Error('Sincroniza lo pendiente en tu cuenta antes de aceptar esta propuesta.');
  const campos = ['plan', 'respuestas', 'sesiones', 'bienestar', 'suplementos', 'tomas'];
  const firmas = Object.fromEntries(campos.map(k => [k, JSON.stringify(E[k])]));
  // También protege una confirmación cuyo recibo se pierde: no se suben copias
  // antiguas mientras no se compruebe qué pasó en la cuenta.
  E.chatPorTraer = { id, firmas, confirmado: false };
  if (guardar() === false) { delete E.chatPorTraer; throw new Error('Recupera el guardado de este teléfono antes de aceptar cambios en tu cuenta.'); }
  try { await nube.confirmarPropuestaIA(id); }
  catch (error) {
    if (!vigente()) return false;
    let recibo;
    try { recibo = await nube.estadoPropuestaIA(id); }
    catch { throw new Error('No pude comprobar si estos cambios se guardaron. Sincroniza tu cuenta antes de reintentar.'); }
    if (!vigente()) return false;
    if (recibo.propuesta?.estado !== 'aplicada') {
      const rechazoDefinitivo = [400, 401, 403, 404, 409, 422].includes(error.status);
      if (recibo.propuesta?.estado === 'pendiente' && !rechazoDefinitivo) throw new Error('La confirmación sigue pendiente de comprobar. Sincroniza más tarde o descarta esta propuesta antes de reintentar.');
      delete E.chatPorTraer; guardar(); throw error;
    }
  }
  if (!vigente()) return false;
  E.chatPorTraer.confirmado = true;
  guardar();
  try { return await actualizarChatConfirmado(); }
  catch {
    if (!vigente()) return false;
    E.mensaje = 'Los cambios se guardaron en tu cuenta. Falta traerlos a este teléfono. Sincroniza cuando tengas señal.';
    guardar(); return true;
  }
}

/** Recupera un recibo o lectura pendiente antes de que la app suba datos locales. */
export async function actualizarChatConfirmado() {
  const pendiente = E.chatPorTraer;
  if (!pendiente) return true;
  const estado = E, usuario = nube.usuarioId();
  const vigente = () => E === estado && usuario === nube.usuarioId() && ambitoDatos === usuario && E.chatPorTraer === pendiente;
  if (!vigente()) return false;
  if (!pendiente.confirmado) {
    const recibo = await nube.estadoPropuestaIA(pendiente.id);
    if (!vigente()) return false;
    if (recibo.propuesta?.estado === 'pendiente') throw new Error('La confirmación sigue pendiente de comprobar. Sincroniza más tarde o descarta esa propuesta.');
    if (recibo.propuesta?.estado !== 'aplicada') { resolverMensajeChat(pendiente.id, recibo.propuesta?.estado === 'descartada' ? 'descartada' : 'no_disponible'); delete E.chatPorTraer; guardar(); return true; }
    pendiente.confirmado = true; resolverMensajeChat(pendiente.id, 'aplicada'); guardar();
  }
  const sinEdicion = k => JSON.stringify(E[k]) === pendiente.firmas[k];
  const [plan, respuestas, sesiones, bienestar, suplementos, tomas] = await Promise.all([
    nube.cargarPlan(), nube.cargarRespuestas(), nube.cargarSesiones(), nube.cargarBienestar(), nube.cargarSuplementos(), nube.cargarTomas(),
  ]);
  if (!vigente()) return false;
  const planVigente = plan && !E.planPendiente && sinEdicion('plan'), respuestasVigentes = respuestas && sinEdicion('respuestas');
  if (planVigente) E.plan = conPropios(plan, E.plan);
  if (respuestasVigentes) E.respuestas = { ...respuestas, unidad: E.respuestas?.unidad, escala_esfuerzo: E.respuestas?.escala_esfuerzo };
  if (planVigente && respuestasVigentes) E.firmaPlan = firmaPerfil(E.respuestas);
  const anteriores = k => JSON.parse(pendiente.firmas[k] || (k === 'bienestar' ? '{}' : '[]'));
  const unidas = unirSesiones(E.sesiones, idsPropios(sesiones, E.ejerciciosPropios || []), E.pendientes || []);
  E.sesiones = unirEdicionesLista(unidas, E.sesiones, anteriores('sesiones'), s => s.id).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''));
  E.bienestar = unirEdicionesMapa({ ...bienestar, ...Object.fromEntries(Object.entries(E.bienestar).filter(([, b]) => !b.enCuenta)) }, E.bienestar, anteriores('bienestar'));
  E.suplementos = unirEdicionesLista(suplementos, E.suplementos, anteriores('suplementos'), s => s.id);
  E.tomas = unirEdicionesLista(tomas, E.tomas, anteriores('tomas'), t => `${t.suplemento_id}|${t.fecha}|${String(t.hora || '').slice(0, 5)}`);
  resolverMensajeChat(pendiente.id, 'aplicada');
  delete E.chatPorTraer;
  guardar(); return true;
}

function resolverMensajeChat(id, estado) {
  for (const m of E.chat || []) if (m.propuesta?.id === id) { m.estadoPropuesta = estado; m.opciones = null; }
}

function unirEdicionesMapa(remotas, actuales, anteriores) {
  const resultado = { ...remotas };
  for (const k of Object.keys(anteriores)) if (!(k in actuales)) delete resultado[k];
  for (const [k, valor] of Object.entries(actuales)) if (!(k in anteriores) || JSON.stringify(valor) !== JSON.stringify(anteriores[k])) resultado[k] = valor;
  return resultado;
}
function unirEdicionesLista(remotas, actuales, anteriores, clave) {
  const mapa = filas => Object.fromEntries(filas.map(x => [clave(x), x]));
  return Object.values(unirEdicionesMapa(mapa(remotas), mapa(actuales), mapa(anteriores)));
}

function detalleSerie(s) {
  const valores = [s.tipo || 'efectiva'];
  if (s.carga_kg != null) valores.push(`${s.carga_kg} kg`);
  if (s.reps != null) valores.push(`${s.reps} repeticiones`);
  if (s.distancia_m != null) valores.push(`${s.distancia_m} m`);
  if (s.duracion_seg != null) valores.push(`${s.duracion_seg} s`);
  if (s.rir != null) valores.push(`RIR ${s.rir}`);
  if (s.rpe != null) valores.push(`RPE ${s.rpe}`);
  if (s.nota) valores.push(s.nota);
  return esc(valores.join(', '));
}
