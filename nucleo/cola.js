// Cola de lo que tiene que subir a la cuenta (sesiones, indicaciones médicas). Sin señal o con el servidor
// caído, lo anotado queda en el teléfono y se reintenta solo: al abrir la app, al volver la señal y después de
// una espera que va creciendo. Cada elemento se sube con su mismo id, así reintentar nunca duplica.
//
// Un elemento: { tipo, clave, datos, intentos, proximo (ms), error }

export const MAX_INTENTOS = 8;

/** Espera después del intento n: 1, 2, 4, 8… minutos, hasta 1 hora. */
export const espera = intentos => Math.min(60, 2 ** Math.max(0, intentos - 1)) * 6e4;

const igual = (a, b) => a.tipo === b.tipo && a.clave === b.clave;

/** Agrega o reemplaza: si ya estaba (mismo tipo y clave), vale lo último que se anotó. */
export function encolar(cola, { tipo, clave, datos }, ahora = Date.now()) {
  const nuevo = { tipo, clave, datos, intentos: 0, proximo: ahora, error: null };
  return [...cola.filter(x => !igual(x, nuevo)), nuevo];
}

/** Lo que toca intentar ahora. `forzar` (volvió la señal o la persona tocó "Reintentar"): todo. */
export const pendientesAhora = (cola, ahora = Date.now(), forzar = false) =>
  cola.filter(x => forzar || (x.intentos < MAX_INTENTOS && x.proximo <= ahora));

/** Los que se dejaron de reintentar solos (esperan a que la persona toque "Reintentar"). */
export const detenidos = cola => cola.filter(x => x.intentos >= MAX_INTENTOS);

/** Cuándo hay que volver a intentar (ms) o null. */
export function proximoIntento(cola) {
  const t = cola.filter(x => x.intentos < MAX_INTENTOS).map(x => x.proximo);
  return t.length ? Math.min(...t) : null;
}

/**
 * Sube lo que toca, en orden. Si un error es de red (error.sinRed), para ahí: lo demás tampoco va a pasar.
 * @param subir async (elemento) => void; lanza un error si no se pudo
 * @returns {{cola, subidos, fallidos}}
 */
export async function procesarCola(cola, subir, { ahora = Date.now(), forzar = false } = {}) {
  let resto = [...cola];
  const subidos = [], fallidos = [];
  for (const x of pendientesAhora(cola, ahora, forzar)) {
    try {
      await subir(x);
      resto = resto.filter(y => y !== x);
      subidos.push(x);
    } catch (e) {
      const intentos = x.intentos + 1;
      const nuevo = { ...x, intentos, proximo: ahora + espera(intentos), error: String(e?.message || e) };
      resto = resto.map(y => (y === x ? nuevo : y));
      fallidos.push(nuevo);
      if (e?.sinRed) break;
    }
  }
  return { cola: resto, subidos, fallidos };
}

/**
 * Junta el resultado de procesar con lo que se anotó mientras tanto: lo nuevo manda sobre lo que se estaba
 * subiendo con la misma clave (por ejemplo, "Guardar de nuevo" una sesión mientras subía la versión anterior).
 * @param antes  la cola que se mandó a procesar
 * @param actual la cola como está ahora
 */
export function juntarCola(resultado, antes, actual) {
  const nuevos = actual.filter(x => !antes.includes(x));
  return [...resultado.filter(x => !nuevos.some(n => igual(n, x))), ...nuevos];
}
