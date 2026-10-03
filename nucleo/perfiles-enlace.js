// Enlace privado para cargar los perfiles de prueba sin pasar un archivo a cada teléfono, tan fácil como el tablero:
// el paquete va cifrado (AES-GCM, comprimido con gzip) en la versión de prueba y la clave viaja solo dentro del
// enlace, después del "#", que el navegador nunca manda a un servidor. Sin el enlace no se puede leer.
//   https://…/app/#perfiles=<archivo>.<clave>
// El archivo cifrado es: 12 bytes del vector inicial, y después el contenido cifrado con su etiqueta.

const ARCHIVO = /^[a-f0-9]{16,64}$/, CLAVE = /^[A-Za-z0-9_-]{43}$/; // clave de 32 bytes en base64url

/** "#perfiles=<archivo>.<clave>" → { archivo, clave }, o null si el enlace no es de perfiles. */
export function leerEnlacePerfiles(hash) {
  const m = String(hash || '').match(/(?:^#|&)perfiles=([^&]+)/);
  if (!m) return null;
  const [archivo, clave] = decodeURIComponent(m[1]).split('.');
  if (!ARCHIVO.test(archivo || '') || !CLAVE.test(clave || '')) throw new Error('El enlace de los perfiles está incompleto. Cópialo entero desde el mensaje.');
  return { archivo, clave };
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
