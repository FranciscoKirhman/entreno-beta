// Los perfiles de una prueba se cargan desde un archivo privado. Este módulo solo guarda datos en el
// almacenamiento que recibe; no contiene personas, credenciales ni acceso al servidor.
import { validarRespaldo } from './respaldo.js';

export const CLAVE_PERFILES_PRUEBA = 'entreno-perfiles-prueba-v1';
export const CLAVE_ACTIVO_PRUEBA = 'entreno-perfil-prueba-activo-v1';

const objeto = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const idValido = id => typeof id === 'string' && /^[a-z][a-z0-9_]{0,31}$/.test(id);
const nombreValido = nombre => typeof nombre === 'string' && nombre.length >= 1 && nombre.length <= 40
  && nombre.trim().length > 0 && !/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(nombre);
const fechaIso = creado => typeof creado === 'string'
  && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(creado)
  && Number.isFinite(Date.parse(creado))
  && new Date(creado.slice(0, 10) + 'T12:00:00Z').toISOString().slice(0, 10) === creado.slice(0, 10);
const exigir = (condicion, mensaje) => { if (!condicion) throw new Error(mensaje + ' No cambié tus datos.'); };

export function clavePerfilPrueba(id) {
  exigir(idValido(id), 'El identificador de ese perfil no es válido.');
  return 'entreno-prueba-' + id;
}

/** También se usa en la página independiente que autoriza la conexión con la IA. */
export function claveSesionPerfilPrueba(id = null) {
  if (id === null) return 'entreno-sesion';
  exigir(idValido(id), 'El identificador de ese perfil no es válido.');
  return 'entreno-sesion-prueba-' + id;
}

function validarEtiquetas(perfiles, mensaje) {
  exigir(Array.isArray(perfiles) && perfiles.length === 2, mensaje);
  const vistos = new Set();
  for (const p of perfiles) {
    exigir(objeto(p) && idValido(p.id) && nombreValido(p.nombre), 'Hay un identificador o nombre de perfil inválido.');
    exigir(!vistos.has(p.id), 'Los dos perfiles necesitan identificadores distintos.');
    vistos.add(p.id);
  }
}

/** Revisa los dos respaldos completos antes de guardar cualquiera. Cada perfil conoce solo sus propios ejercicios. */
export function validarPaquetePerfilesPrueba(paquete, ids = null) {
  exigir(objeto(paquete) && paquete.app === 'entreno-perfiles-prueba' && paquete.version === 1,
    'Ese archivo no es un paquete de perfiles compatible con Entreno.');
  exigir(fechaIso(paquete.creado), 'El paquete tiene una fecha de creación inválida.');
  validarEtiquetas(paquete.perfiles, 'El paquete debe contener exactamente dos perfiles.');
  for (const p of paquete.perfiles) {
    exigir(objeto(p.respaldo) && p.respaldo.version === 2, 'Cada perfil necesita un respaldo completo de la versión 2.');
    exigir(Array.isArray(p.respaldo.fotos) && p.respaldo.fotos.length === 0,
      'Este paquete inicial no admite fotos. Consérvalas en su respaldo individual y restáuralas después en su perfil.');
    const permitidos = ids == null ? null : new Set([
      ...ids, ...(Array.isArray(p.respaldo.estado?.ejerciciosPropios) ? p.respaldo.estado.ejerciciosPropios.map(e => e?.id) : []),
    ]);
    validarRespaldo(p.respaldo, permitidos);
  }
  return paquete;
}

/** El registro guarda etiquetas, nunca los estados ni credenciales. La ausencia todavía no es un error. */
export function leerPerfilesPrueba(storage) {
  const texto = storage.getItem(CLAVE_PERFILES_PRUEBA);
  if (texto == null) return { creado: null, perfiles: [] };
  let registro;
  try { registro = JSON.parse(texto); }
  catch { throw new Error('No pude leer los perfiles de prueba guardados. Sus datos se conservan.'); }
  exigir(objeto(registro) && fechaIso(registro.creado), 'El registro de perfiles de prueba está dañado.');
  validarEtiquetas(registro.perfiles, 'El registro de perfiles de prueba está dañado.');
  return { creado: registro.creado, perfiles: registro.perfiles.map(({ id, nombre }) => ({ id, nombre })) };
}

export function perfilPruebaActivo(storage) {
  const id = storage.getItem(CLAVE_ACTIVO_PRUEBA);
  if (id == null) return null;
  const perfil = leerPerfilesPrueba(storage).perfiles.find(p => p.id === id);
  exigir(Boolean(perfil), 'El perfil de prueba elegido ya no está disponible.');
  return perfil;
}

function escribirVerificado(storage, cambios) {
  // Todos los valores anteriores se leen antes de hacer la primera escritura.
  const anteriores = cambios.map(([clave]) => [clave, storage.getItem(clave)]);
  const tocadas = [];
  try {
    for (const [clave, texto] of cambios) {
      tocadas.push(clave);
      if (texto == null) storage.removeItem(clave); else storage.setItem(clave, texto);
      if (storage.getItem(clave) !== texto) throw new Error('La copia guardada no coincide.');
    }
  } catch (error) {
    let recuperado = true;
    for (const clave of tocadas.reverse()) {
      const texto = anteriores.find(([k]) => k === clave)[1];
      try {
        if (texto == null) storage.removeItem(clave); else storage.setItem(clave, texto);
        if (storage.getItem(clave) !== texto) recuperado = false;
      } catch { recuperado = false; }
    }
    throw Object.assign(new Error(recuperado
      ? 'No pude guardar los perfiles de prueba. Conservé los datos anteriores.'
      : 'No pude confirmar la recuperación de los datos anteriores. Conserva tu archivo privado y respalda este teléfono antes de continuar.'),
    { cause: error, recuperado });
  }
}

/** Instala una pareja nueva sin sobrescribir perfiles existentes ni el perfil normal del teléfono. */
export function instalarPerfilesPrueba(paquete, storage, ids = null) {
  validarPaquetePerfilesPrueba(paquete, ids);
  const existente = leerPerfilesPrueba(storage);
  exigir(existente.perfiles.length === 0, 'Ya hay perfiles de prueba en este teléfono. No los reemplazo con otra pareja.');
  for (const p of paquete.perfiles) {
    exigir(storage.getItem(clavePerfilPrueba(p.id)) == null, 'Ese perfil ya tiene datos guardados en este teléfono.');
  }
  const registro = { creado: paquete.creado, perfiles: paquete.perfiles.map(({ id, nombre }) => ({ id, nombre })) };
  const cambios = paquete.perfiles.map(p => [clavePerfilPrueba(p.id), JSON.stringify(structuredClone(p.respaldo.estado))]);
  cambios.push([CLAVE_PERFILES_PRUEBA, JSON.stringify(registro)]);
  escribirVerificado(storage, cambios);
  return registro;
}

/** El llamador guarda su estado actual antes de elegir y recarga la app después. null vuelve al perfil normal. */
export function seleccionarPerfilPrueba(storage, id = null) {
  let perfil = null;
  if (id !== null) {
    perfil = leerPerfilesPrueba(storage).perfiles.find(p => p.id === id);
    exigir(Boolean(perfil), 'Ese perfil de prueba no está disponible en este teléfono.');
  }
  escribirVerificado(storage, [[CLAVE_ACTIVO_PRUEBA, id]]);
  return perfil;
}
