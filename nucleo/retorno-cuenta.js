// El perfil del regreso elige la copia local que pidió el acceso. No concede acceso a una cuenta:
// Supabase sigue comprobando el código y su verificador PKCE en ese mismo navegador.
import { clavePerfilPrueba, leerPerfilesPrueba } from './perfiles-prueba.js';

export const PARAMETRO_RETORNO_CUENTA = 'perfil_cuenta';
const PARAMETROS_ACCESO = ['code', 'error', 'error_code', 'error_description', 'access_token', 'refresh_token', 'expires_in', 'expires_at', 'token_type'];
const convertir = url => new URL(url);

export function esRetornoCuenta(url) {
  const u = convertir(url), hash = new URLSearchParams(u.hash.slice(1));
  return u.searchParams.has('code') || u.searchParams.has('error') || hash.has('error');
}

/** null conserva los enlaces antiguos. Un marcador solo se lee cuando vuelve el acceso. */
export function perfilDelRetornoCuenta(url, storage) {
  const u = convertir(url), id = u.searchParams.get(PARAMETRO_RETORNO_CUENTA);
  if (!esRetornoCuenta(u) || id === null) return null;
  if (id === 'local') return { perfilId: null };
  let registrado = false;
  try {
    registrado = leerPerfilesPrueba(storage).perfiles.some(p => p.id === id);
    const copia = registrado ? JSON.parse(storage.getItem(clavePerfilPrueba(id)) || 'null') : null;
    registrado = Boolean(copia && typeof copia === 'object' && !Array.isArray(copia));
  } catch { registrado = false; /* se explica sin revelar datos de la copia */ }
  if (!registrado) throw Object.assign(new Error('Ese enlace corresponde a un perfil que no está en este teléfono. Abre Entreno, elige tu perfil y pide otro acceso. Tus datos se conservan.'), { code: 'acceso_retornado_fallido' });
  return { perfilId: id };
}

/** Solo añade un identificador ya local, nunca el correo, una clave ni datos del perfil. */
export function destinoCuenta(url, perfilId = null) {
  const u = convertir(limpiarRetornoCuenta(url));
  if (perfilId !== null && !/^[a-z][a-z0-9_]{0,31}$/.test(perfilId)) throw new Error('No pude identificar el perfil que pide el acceso.');
  u.searchParams.set(PARAMETRO_RETORNO_CUENTA, perfilId === null ? 'local' : perfilId);
  return u.href;
}

/** Conserva otros parámetros, como la autorización de una conexión externa, y retira credenciales del regreso. */
export function limpiarRetornoCuenta(url) {
  const u = convertir(url), hash = new URLSearchParams(u.hash.slice(1));
  for (const p of [...PARAMETROS_ACCESO, PARAMETRO_RETORNO_CUENTA]) u.searchParams.delete(p);
  if (PARAMETROS_ACCESO.some(p => hash.has(p))) {
    for (const p of PARAMETROS_ACCESO) hash.delete(p);
    u.hash = hash.toString();
  }
  return u.href;
}
