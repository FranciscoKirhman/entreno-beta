// Una sesión conserva su fecha al cruzar medianoche, hasta que se guarda.
// El estado recibido corresponde al perfil abierto: no se consulta otro perfil ni almacenamiento.
export function fechaSesionActiva(estado, fechaHoy) {
  const guardadas = new Set((estado.sesiones || []).filter(s => !s.origen).map(s => s.fecha));
  const fechas = (estado.plan?.dias || []).map(d => d.fecha)
    .filter(f => f <= fechaHoy && !guardadas.has(f))
    .sort().reverse();
  for (const fecha of fechas) {
    const inicio = estado.inicioSesion?.[fecha];
    const empezada = Number.isFinite(inicio) && inicio > 0;
    const marcada = Object.values(estado.registro?.[fecha] || {})
      .some(filas => Array.isArray(filas) && filas.some(s => s?.hecho));
    if (empezada || marcada) return fecha;
  }
  return fechaHoy;
}
