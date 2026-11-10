// Que un teléfono con una copia vieja no pise el plan de la cuenta.
// Antes, guardar-plan aceptaba cualquier plan válido: si el plan cambiaba en la cuenta (una propuesta aceptada, otro
// teléfono, una corrección) y este teléfono cambiaba el suyo antes de sincronizar, lo subía y borraba lo nuevo. Pasó el 9
// de noviembre de 2026: una sesión armada a mano volvió a 12 series tres minutos después de sincronizar.
// Ahora el teléfono manda la base: el id del plan de la cuenta del que partió su cambio. Si en la cuenta hay otro plan
// activo, el servidor no guarda y avisa; el teléfono toma el de la cuenta y deja el suyo en Cambios del plan, donde se
// recupera con un toque. Nada se descarta en silencio.

/**
 * El id del plan de la cuenta del que partió el cambio que se va a subir. undefined si el teléfono no lo sabe (un plan
 * que nunca estuvo en la cuenta, o una copia anterior a este control): ahí no se manda base y el servidor guarda como
 * antes, para no inventar un conflicto.
 */
export function baseParaGuardar(E) {
  return E?.planBase || E?.planPendiente?.id || E?.plan?.id || undefined;
}

/**
 * ¿Hay que rechazar el guardado? Solo si el teléfono mandó una base y en la cuenta hay un plan activo distinto.
 * @param cuerpo    lo que mandó la app ({ plan, base? })
 * @param idActivo  id del plan activo de la cuenta, o null
 */
export function hayConflicto(cuerpo, idActivo) {
  if (!cuerpo || !('base' in cuerpo) || cuerpo.base == null) return false;
  return Boolean(idActivo) && String(cuerpo.base) !== String(idActivo);
}

export const MENSAJE_CONFLICTO = 'Tu plan cambió en tu cuenta desde otro dispositivo o por un cambio que aceptaste. Dejé el de la cuenta. Lo que cambiaste en este teléfono quedó en Mi plan, Ajustes del plan, Cambios del plan, por si quieres recuperarlo.';

/**
 * Resuelve el conflicto en el teléfono: el plan local pasa a la lista de cambios que se pueden deshacer (las últimas
 * tres) y deja de estar pendiente. El plan de la cuenta lo trae después la sincronización normal.
 * @returns {boolean} true si guardó una copia (false si el plan local no tenía nada que conservar)
 */
export function conservarPlanLocal(E, cuando = new Date().toISOString()) {
  const local = E.planPendiente || E.plan;
  delete E.planPendiente; delete E.planRechazado; delete E.planBase;
  if (!local?.dias?.length) return false;
  E.cambiosPlan = [{ cuando, mensaje: 'Lo que cambiaste en este teléfono antes de sincronizar', plan: structuredClone(local) }, ...(E.cambiosPlan || [])].slice(0, 3);
  return true;
}
