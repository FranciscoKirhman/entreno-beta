// Copia de seguridad del estado: la regla para decidir cuál usar al abrir la app. La copia vive aparte del
// almacenamiento principal (app/copia-entreno.js la guarda en IndexedDB) y lleva la hora en que se guardó.

/**
 * La copia se usa solo si es más reciente que lo que había en el almacenamiento principal al abrir: así se recupera lo
 * escrito si el teléfono borró ese almacenamiento o si una escritura falló, pero nunca se deshace un borrado hecho a
 * propósito (ese borrado también se guarda, con una hora más reciente).
 * @param guardadoAlAbrir hora (ms) del estado principal al abrir; 0 si estaba vacío o no se pudo leer
 * @param copia {guardadoEn, texto} o null
 * @returns el estado de la copia (objeto) o null si no corresponde usarla
 */
export function estadoDeCopia(guardadoAlAbrir, copia) {
  if (!copia?.texto || !Number.isFinite(copia.guardadoEn) || !(copia.guardadoEn > (guardadoAlAbrir || 0))) return null;
  try {
    const estado = JSON.parse(copia.texto);
    return estado && typeof estado === 'object' && !Array.isArray(estado) ? estado : null;
  } catch { return null; }
}

/** Lo que tiene un estado para contarle a la persona qué se recuperó. */
export function resumenRecuperado(estado) {
  const dias = Object.values(estado?.registro || {});
  const series = dias.reduce((n, d) => n + Object.values(d || {}).reduce((m, lista) => m + (Array.isArray(lista) ? lista.filter(s => s && (s.kg != null || s.reps != null || s.hecho)).length : 0), 0), 0);
  return { series, sesiones: (estado?.sesiones || []).length };
}
