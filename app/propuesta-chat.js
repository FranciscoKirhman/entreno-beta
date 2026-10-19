import { E, guardar, guardarConEspacio, estadoAlmacenamiento, esc, ambitoDatos, EXTRAS } from './comun.js';
import * as nube from './nube.js';
import { conPropios, idsPropios } from '../nucleo/propios.js';
import { unirSesiones } from '../nucleo/sincronizacion.js';
import { firmaPerfil } from '../nucleo/firma-perfil.js';

const ETIQUETAS = { objetivo_principal: 'Objetivo', tiempo_entrenando: 'Experiencia', dias_meta: 'Días por semana', dias_firmes: 'Días seguros', duracion_min: 'Minutos por sesión', dias_no_puedo: 'Días que no puedes', musculos_prioridad: 'Prioridades', rotacion: 'Variedad' };
export function propuestaChatHtml(p) {
  const estado = ({ aplicada: 'Cambios aceptados', descartada: 'Propuesta descartada', por_comprobar: 'Confirmación por comprobar', no_disponible: 'Propuesta no disponible' })[p.estado] || 'Por confirmar';
  const paquete = p.paquete || { plan: p.plan };
  const plan = paquete.plan;
  const filas = (paquete.sesiones || []).map(x => `<li><strong>${esc(x.sesion.fecha || new Date(x.sesion.inicio).toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }))}: ${esc(x.sesion.titulo)}</strong>${x.sesion.comentario ? `<p>${esc(x.sesion.comentario)}</p>` : ''}<ul>${x.series.map(s => `<li>${esc(s.ejercicio_nombre)}: ${detalleSerie(s)}${s.ejercicio_id ? '' : ' (conservado por nombre)'}</li>`).join('')}</ul></li>`).join('');
  const resumen = `<div class="propuesta-chat"><p><strong>${estado}</strong></p><ul>${(p.resumen || ['Revisa el plan antes de decidir.']).map(t => `<li>${esc(t)}</li>`).join('')}</ul>`;
  // Una propuesta resuelta o vencida ya no trae su paquete (nucleo/compactar-chat.js): queda solo el resumen.
  if (!p.paquete && !p.plan) return `${resumen}</div>`;
  return `${resumen}<details><summary>Ver los cambios completos</summary>
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
  // También protege una confirmación cuyo recibo se pierde: no se suben copias
  // antiguas mientras no se compruebe qué pasó en la cuenta. Guarda huellas, no copias: una copia de todo el historial
  // duplicaba lo guardado y el iPhone se quedaba sin espacio justo al aceptar.
  E.chatPorTraer = { id, huellas: huellasDe(E), confirmado: false };
  // Primero el guardado de siempre (sin esperas); solo si falló por espacio se libera y se reintenta.
  let guardado = guardar();
  if (!guardado) { guardado = await guardarConEspacio(); if (!vigente()) return false; }
  // Lo que vale es la cuenta: si el teléfono no tiene espacio, igual se acepta allá. No hay nada pendiente de subir
  // (revisado arriba), así que la copia vieja del teléfono no puede pisar la cuenta al volver a abrir.
  if (!guardado && !estadoAlmacenamiento().sinEspacio) {
    delete E.chatPorTraer;
    throw new Error('Falló el guardado de este teléfono, así que no acepté el cambio. Cierra y abre la app y vuelve a intentarlo.');
  }
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
  const previas = pendiente.huellas || huellasDe(firmasAntiguas(pendiente.firmas));
  const sinEdicion = k => previas[k] !== undefined && huella(E[k]) === previas[k];
  const [plan, respuestas, sesiones, bienestar, suplementos, tomas] = await Promise.all([
    nube.cargarPlan(), nube.cargarRespuestas(), nube.cargarSesiones(), nube.cargarBienestar(), nube.cargarSuplementos(), nube.cargarTomas(),
  ]);
  if (!vigente()) return false;
  const planVigente = plan && !E.planPendiente && sinEdicion('plan'), respuestasVigentes = respuestas && sinEdicion('respuestas');
  if (planVigente) E.plan = conPropios(plan, E.plan);
  if (respuestasVigentes) E.respuestas = { ...respuestas, unidad: E.respuestas?.unidad, escala_esfuerzo: E.respuestas?.escala_esfuerzo };
  if (planVigente && respuestasVigentes) E.firmaPlan = firmaPerfil(E.respuestas);
  const anteriores = k => previas[k] || {};
  const unidas = unirSesiones(E.sesiones, idsPropios(sesiones, [...(E.ejerciciosPropios || []), ...EXTRAS]), E.pendientes || []);
  E.sesiones = unirEdicionesLista(unidas, E.sesiones, anteriores('sesiones'), CLAVES.sesiones).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || ''));
  E.bienestar = unirEdicionesMapa({ ...bienestar, ...Object.fromEntries(Object.entries(E.bienestar).filter(([, b]) => !b.enCuenta)) }, E.bienestar, anteriores('bienestar'));
  E.suplementos = unirEdicionesLista(suplementos, E.suplementos, anteriores('suplementos'), CLAVES.suplementos);
  E.tomas = unirEdicionesLista(tomas, E.tomas, anteriores('tomas'), CLAVES.tomas);
  resolverMensajeChat(pendiente.id, 'aplicada');
  delete E.chatPorTraer;
  guardar(); return true;
}

// Una propuesta resuelta ya no se aplica: su paquete (el plan completo) sale del teléfono y queda el resumen.
function resolverMensajeChat(id, estado) {
  for (const m of E.chat || []) if (m.propuesta?.id === id) { m.estadoPropuesta = estado; m.opciones = null; delete m.propuesta.paquete; }
}

// Huella corta de un valor (cyrb53 sobre su JSON): para saber si algo cambió sin guardar otra copia completa.
function huella(valor) {
  const t = JSON.stringify(valor) ?? '';
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 2654435761); b = Math.imul(b ^ c, 1597334677); }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
}
const CLAVES = { sesiones: s => s.id, suplementos: s => s.id, tomas: t => `${t.suplemento_id}|${t.fecha}|${String(t.hora || '').slice(0, 5)}` };
const huellasMapa = pares => Object.fromEntries(pares.map(([k, v]) => [k, huella(v)]));
/** El plan y las preferencias se comparan enteros; las listas, fila por fila, para unir lo editado después. */
function huellasDe(d) {
  return { plan: huella(d.plan), respuestas: huella(d.respuestas), bienestar: huellasMapa(Object.entries(d.bienestar || {})),
    ...Object.fromEntries(Object.entries(CLAVES).map(([k, clave]) => [k, huellasMapa((d[k] || []).map(x => [clave(x), x]))])) };
}
/** Una confirmación guardada por una versión anterior trae copias completas en texto: se leen igual. */
function firmasAntiguas(firmas = {}) {
  const leer = (k, vacio) => { try { return firmas[k] === undefined ? vacio : JSON.parse(firmas[k]); } catch { return vacio; } };
  const d = Object.fromEntries(['bienestar', 'sesiones', 'suplementos', 'tomas'].map(k => [k, leer(k, k === 'bienestar' ? {} : [])]));
  const h = huellasDe({ ...d, plan: leer('plan', null), respuestas: leer('respuestas', null) });
  // Sin copia del plan o de las preferencias no se sabe si cambiaron: se conserva lo del teléfono.
  if (firmas.plan === undefined) delete h.plan;
  if (firmas.respuestas === undefined) delete h.respuestas;
  return h;
}

function unirEdicionesMapa(remotas, actuales, anteriores) {
  const resultado = { ...remotas };
  for (const k of Object.keys(anteriores)) if (!(k in actuales)) delete resultado[k];
  for (const [k, valor] of Object.entries(actuales)) if (!(k in anteriores) || huella(valor) !== anteriores[k]) resultado[k] = valor;
  return resultado;
}
function unirEdicionesLista(remotas, actuales, anteriores, clave) {
  const mapa = filas => Object.fromEntries(filas.map(x => [clave(x), x]));
  return Object.values(unirEdicionesMapa(mapa(remotas), mapa(actuales), anteriores));
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
