import { E, guardar } from './comun.js';
import * as nube from './nube.js';

// Una revisión de recuperación se aplica antes de subir cualquier pendiente antiguo.
// Solo se reemplaza la copia activa después de completar todas las lecturas.
export async function recuperarCuentaPrincipal() {
  const estado = E, usuario = nube.usuarioId(), firma = JSON.stringify(E);
  const comprobar = () => { if (E !== estado || nube.usuarioId() !== usuario) throw new Error('La cuenta cambió durante la recuperación.'); };
  const filas = await nube.cargarDatosTelefono(); comprobar();
  const control = filas.find(f => f.clave === 'recuperacion_cuenta')?.valor;
  if (!control?.revision || E.revisionCuentaPrincipal === control.revision) return false;
  const [respuestas, plan, sesiones, bienestar, indicaciones, preferencias, suplementos, tomas, consentimientos] = await Promise.all([
    nube.cargarRespuestas(), nube.cargarPlan(), nube.cargarSesiones(), nube.cargarBienestar(),
    nube.cargarIndicaciones(), nube.cargarPreferencias(), nube.cargarSuplementos(), nube.cargarTomas(), nube.cargarConsentimientos(),
  ]); comprobar();
  if (JSON.stringify(E) !== firma) throw new Error('Tus datos cambiaron mientras se recuperaba la cuenta. Reintenta la sincronización.');
  if (!respuestas || !plan || !sesiones.length) throw new Error('La cuenta no tiene un plan e historial completos para recuperar.');
  // Conservar la copia antigua por separado; nunca enviarla automáticamente a la cuenta.
  localStorage.setItem(`entreno-anterior-${usuario}-${control.revision}`, JSON.stringify(E));
  Object.assign(E, { respuestas: { ...respuestas, unidad: preferencias.unidad }, plan, sesiones, bienestar, indicaciones,
    suplementos, tomas, consentimientos, asistente: preferencias.asistente, pendientes: [], nubeDatos: {}, registro: {},
    pasos: {}, pasosClaves: {}, pasosMedidas: {}, pasosOmitidos: {}, cardioHecho: {}, marcasPlan: {},
    ejerciciosPropios: [], medidas: [], notasFijas: {}, revisionCuentaPrincipal: control.revision });
  for (const [clave, campo] of Object.entries({ ejercicios_propios: 'ejerciciosPropios', medidas_cuerpo: 'medidas', notas_fijas: 'notasFijas', calendario_asistencia: 'marcasPlan' })) {
    const fila = filas.find(f => f.clave === clave); if (fila) E[campo] = fila.valor;
  }
  for (const campo of ['planPendiente', 'preferenciasPendientes', 'firmaPlan', 'chatPorTraer', 'elegido']) delete E[campo];
  guardar();
  return true;
}
