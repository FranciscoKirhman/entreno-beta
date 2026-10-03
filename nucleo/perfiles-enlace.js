// Perfiles de prueba publicados en la versión de prueba, tan fáciles de abrir como el tablero: un botón por perfil.
// Cada perfil va en su propio archivo cifrado (AES-GCM, comprimido con gzip). El índice público
// (app/perfiles/indice.json) dice su nombre y su archivo; si además trae la clave, el perfil es público (su dueño lo
// autorizó). Si no, la clave viaja solo en un enlace privado, después del "#", que el navegador nunca manda a un
// servidor, y el teléfono la recuerda para la próxima vez. Un enlace puede traer varios perfiles, separados por comas:
//   https://…/app/#perfiles=<archivo>.<clave>,<archivo>.<clave>
// El archivo cifrado es: 12 bytes del vector inicial, y después el contenido cifrado con su etiqueta.

const ARCHIVO = /^[a-f0-9]{16,64}$/, CLAVE = /^[A-Za-z0-9_-]{43}$/; // clave de 32 bytes en base64url
const VERSION = /^[a-f0-9]{8,64}$/, ID = /^[a-z][a-z0-9_]{0,31}$/;
const CAMPOS = ['id', 'nombre', 'archivo', 'version', 'clave'];

/** Revisa el índice público y devuelve sus perfiles. Solo admite esos cinco campos: nada más se publica ahí. */
export function leerIndicePerfiles(datos) {
  const perfiles = datos && datos.app === 'entreno-perfiles-publicados' && datos.version === 1 && Array.isArray(datos.perfiles)
    && Object.keys(datos).every(k => ['app', 'version', 'perfiles'].includes(k)) ? datos.perfiles : null;
  if (!perfiles || perfiles.length > 4) throw new Error('El índice de los perfiles publicados no es válido.');
  const ids = new Set(), archivos = new Set();
  return perfiles.map(p => {
    const ok = p && typeof p === 'object' && Object.keys(p).every(k => CAMPOS.includes(k)) && ID.test(p.id || '')
      && typeof p.nombre === 'string' && p.nombre.trim() && p.nombre.length <= 40 && !/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(p.nombre)
      && ARCHIVO.test(p.archivo || '') && VERSION.test(p.version || '') && (p.clave === undefined || CLAVE.test(p.clave))
      && !ids.has(p.id) && !archivos.has(p.archivo);
    if (!ok) throw new Error('El índice de los perfiles publicados no es válido.');
    ids.add(p.id); archivos.add(p.archivo);
    return { id: p.id, nombre: p.nombre, archivo: p.archivo, version: p.version, ...(p.clave ? { clave: p.clave } : {}) };
  });
}

/** "#perfiles=<archivo>.<clave>,…" → [{ archivo, clave }, …], o null si el enlace no es de perfiles. */
export function leerEnlacePerfiles(hash) {
  const m = String(hash || '').match(/(?:^#|&)perfiles=([^&]+)/);
  if (!m) return null;
  const pares = decodeURIComponent(m[1]).split(',').map(x => x.split('.')).map(([archivo, clave]) => ({ archivo, clave }));
  if (pares.length > 4 || pares.some(p => !ARCHIVO.test(p.archivo || '') || !CLAVE.test(p.clave || ''))) throw new Error('El enlace de los perfiles está incompleto. Cópialo entero desde el mensaje.');
  return pares;
}

const deBase64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));

/** Bytes del archivo cifrado → el texto JSON del paquete. Falla si la clave no corresponde o el archivo cambió. */
export async function descifrarPaquete(bytes, clave) {
  const datos = new Uint8Array(bytes);
  if (datos.length < 29) throw new Error('El archivo de los perfiles está incompleto.');
  const llave = await crypto.subtle.importKey('raw', deBase64url(clave), 'AES-GCM', false, ['decrypt']);
  let comprimido;
  try { comprimido = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: datos.slice(0, 12) }, llave, datos.slice(12)); }
  catch { throw new Error('No pude abrir los perfiles: el enlace no corresponde a este archivo. Pide el enlace nuevo.'); }
  const flujo = new Blob([comprimido]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(flujo).text();
}
