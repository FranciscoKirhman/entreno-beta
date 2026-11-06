// El descanso elegido por ejercicio es local. Solo las mediciones por sesión viajan a la cuenta.
export const esDescansoMedido = d => d && typeof d === 'object' && !Array.isArray(d)
  && typeof d.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.fecha) && Number.isFinite(d.medidos) && d.medidos >= 0;
export function unirDescansosMedidos(a = {}, b = {}) {
  const validos = xs => Object.fromEntries(Object.entries(xs || {}).filter(([, d]) => esDescansoMedido(d)));
  return Object.fromEntries(Object.entries({ ...validos(a), ...validos(b) })
    .sort(([ia, a], [ib, b]) => b.fecha.localeCompare(a.fecha) || ia.localeCompare(ib)).slice(0, 40));
}
/** Se ejecuta al recuperar cada estado. Repetirla no cambia nada ni vuelve a marcar pendientes. */
export function migrarDescansos(estado) {
  const mezclados = estado.descansos || {};
  const medidos = Object.fromEntries(Object.entries(mezclados).filter(([, d]) => esDescansoMedido(d)));
  const movio = Object.keys(medidos).length > 0;
  estado.descansos = Object.fromEntries(Object.entries(mezclados).filter(([, d]) => typeof d === 'number' && Number.isFinite(d)));
  estado.descansosMedidos = unirDescansosMedidos(medidos, estado.descansosMedidos);
  if (movio) (estado.nubeDatos ||= {}).descansos = { pendiente: true };
  return movio;
}
