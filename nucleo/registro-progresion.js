// El historial de progresión nunca comparte el objeto de preferencias de la sesión.
export function unirProgresion(a = {}, b = {}) {
  const juntos = { ...a };
  for (const [id, reg] of Object.entries(b || {})) {
    if (!juntos[id] || Number(reg?.cuando) > Number(juntos[id]?.cuando)) juntos[id] = reg;
  }
  return juntos;
}

/** Traslada únicamente entradas con fecha de registro. No recorta ni modifica preferencias. Idempotente. */
export function migrarProgresion(estado) {
  const entradas = Object.entries(estado.ajustesSesion || {}).filter(([, v]) => v && typeof v === 'object' && Object.hasOwn(v, 'cuando'));
  if (!entradas.length) return false;
  estado.progresionSesion = unirProgresion(estado.progresionSesion, Object.fromEntries(entradas));
  estado.ajustesSesion = { ...estado.ajustesSesion };
  for (const [id] of entradas) delete estado.ajustesSesion[id];
  // Ambos documentos quedan pendientes incluso si se migra antes de entrar a la cuenta.
  estado.nubeDatos = { ...estado.nubeDatos, progresion_sesion: { pendiente: true }, ajustes_sesion: { pendiente: true } };
  return true;
}

/** Conserva las ocho decisiones más recientes y todas las propuestas que aún esperan aplicación. */
export function registrarProgresion(registros, id, dato, cuando = Date.now()) {
  let cerradas = 0;
  return Object.fromEntries(Object.entries({ ...registros, [id]: { ...dato, cuando } })
    .sort((a, b) => b[1].cuando - a[1].cuando)
    .filter(([, r]) => r.estado === 'propuesta' || cerradas++ < 8));
}
