import { edad } from './derivar.js';

// Campos de Salud y seguridad del cuestionario, más la autorización indicada por la persona.
const CAMPOS_SALUD = ['tamizaje', 'embarazo', 'lesiones', 'evaluacion_profesional', 'autorizacion_medica'];
const contiene = v => v != null && v !== '' && (Array.isArray(v) ? v.length > 0 : typeof v === 'object' ? Object.keys(v).length > 0 : true);
export const tieneSaludCuestionario = respuestas => CAMPOS_SALUD.some(k => contiene(respuestas?.[k]));

export function exigirPermisoSaludCuestionario(respuestas) {
  if (tieneSaludCuestionario(respuestas) && respuestas.consentimiento_salud !== true) {
    throw new Error('Revisa Salud y seguridad en Completar mi perfil antes de enviar tus respuestas de salud. Tus datos se conservan en este teléfono.');
  }
}

/** No concede permisos ni modifica respuestas, plan o registros. La IA es opcional para sincronizar. */
export function revisarTrasladoCuenta(estado, hoy) {
  const r = estado?.respuestas || {}, faltan = [];
  const fecha = r.fecha_nacimiento;
  const fechaValida = typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    && Number.isFinite(Date.parse(fecha + 'T12:00:00Z')) && new Date(fecha + 'T12:00:00Z').toISOString().slice(0, 10) === fecha;
  const adulto = fecha ? fechaValida && edad(fecha, hoy) >= 18 : r.mayor_18 === true;
  if (!adulto) faltan.push('mayor_18');
  if (r.terminos !== true) faltan.push('terminos');
  if (r.privacidad !== true) faltan.push('privacidad');
  const haySalud = tieneSaludCuestionario(r) || ['bienestar', 'indicaciones', 'medidas'].some(k => contiene(estado?.[k]));
  if (haySalud && r.consentimiento_salud !== true) faltan.push('consentimiento_salud');
  const nombres = { mayor_18: 'tu mayoría de edad', terminos: 'los términos de uso', privacidad: 'la política de privacidad', consentimiento_salud: 'el permiso de datos de salud' };
  return { ok: faltan.length === 0, faltan, mensaje: faltan.length
    ? `Antes del traslado, revisa ${faltan.map(k => nombres[k]).join(', ')} en Completar mi perfil. Tu plan y tus sesiones se conservan.` : '' };
}
