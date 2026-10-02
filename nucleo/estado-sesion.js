/** Una serie anotada es progreso parcial; solo guardar la sesión la termina. */
export function estadoSesion(fecha, sesiones = [], registro = {}) {
  if (sesiones.some(s => s.fecha === fecha && !s.origen && s.finalizada !== false)) return 'terminada';
  if (Object.values(registro[fecha] || {}).some(l => Array.isArray(l) && l.some(x => x?.hecho))) return 'en_curso';
  return 'pendiente';
}
export function resumenSemana(dias, semana) {
  const sesiones = dias.filter(d => d.semana === semana);
  return { sesiones: sesiones.length, dias: [...new Set(sesiones.map(d => new Date(d.fecha + 'T12:00:00Z').getUTCDay()))] };
}
