// La sesión en curso también en la cuenta (nucleo/sesion-borrador.js): mientras hay una sesión empezada, lo anotado
// sube a los pocos segundos de cada cambio (y al pasar la app al fondo); al guardarla o descartarla, la cuenta queda
// vacía. Al entrar, si este teléfono no tiene una sesión empezada y la cuenta sí (de hoy o de ayer), sigue desde ahí.
// Hasta mirar la cuenta no se sube nada: un teléfono recién abierto, sin sesión, borraría la del teléfono perdido.
// Si se abrió sin señal, se mira antes de la primera subida. Sin la migración del servidor
// (20261029100000_sesion_en_curso.sql) la cuenta rechaza la clave y no se insiste.
import { E, hoy, alGuardar, modoEjemplo, ambitoDatos } from './comun.js';
import { borradorSesion, reponerBorrador } from '../nucleo/sesion-borrador.js';
import * as nube from './nube.js';

const CLAVE = 'sesion_en_curso', ESPERA_MS = 4000;
let revisada = null;  // usuario cuya cuenta ya se miró
let sinSoporte = false;
let enCuenta = null;  // { usuario, texto }: lo último que quedó en la cuenta
let reloj = 0, cadena = Promise.resolve(); // una subida a la vez y en orden: la vieja no pisa a la nueva
/** Avisos cuando una sesión de otro teléfono se repone después de abrir (app/app.js repinta y lo cuenta). */
export const alReponerSesion = new Set();

const enLinea = () => !modoEjemplo && nube.hay() && nube.conectado() && ambitoDatos === nube.usuarioId();
// La cuenta (jsonb) devuelve las claves en otro orden: se compara con las claves ordenadas.
const ordenar = x => (Array.isArray(x) ? x.map(ordenar) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, ordenar(x[k])])) : x);
const firma = v => JSON.stringify(ordenar(v || {}));
// 23514: la restricción de claves de datos_telefono (falta la migración); el resto (sin señal) se reintenta.
const rechazada = e => e?.code === '23514' || /datos_telefono_clave_check/.test(e?.message || '');

/**
 * Mira la sesión de la cuenta y la repone si sirve (lo de este teléfono manda). Al entrar, app/app.js la llama con las
 * sesiones de la cuenta ya en el teléfono, para no revivir una que otro teléfono guardó. Devuelve si la puso.
 */
export async function revisarSesionEnCuenta() {
  if (!enLinea()) return false;
  const estado = E, usuario = nube.usuarioId();
  const fila = await nube.cargarDatoTelefono(CLAVE);
  if (E !== estado || nube.usuarioId() !== usuario) return false;
  const puesta = reponerBorrador(E, fila?.valor, hoy());
  enCuenta = { usuario, texto: firma(fila?.valor) };
  revisada = usuario;
  if (!puesta) programar();
  return puesta;
}

async function subir() {
  if (sinSoporte || !enLinea()) return;
  const estado = E, usuario = nube.usuarioId();
  if (revisada !== usuario) {
    let puesta;
    try { puesta = await revisarSesionEnCuenta(); } catch { return; } // sin señal: al próximo cambio
    if (puesta) { for (const fn of alReponerSesion) fn(); return; }
    if (revisada !== usuario || E !== estado) return;
  }
  const valor = borradorSesion(E, hoy()) || {}, texto = firma(valor);
  if (enCuenta?.usuario === usuario && enCuenta.texto === texto) return;
  try {
    await nube.guardarDatoTelefono(CLAVE, valor);
    if (nube.usuarioId() === usuario) enCuenta = { usuario, texto };
  } catch (e) { if (rechazada(e)) sinSoporte = true; }
}

/** Sube lo que haya a los pocos segundos, sin correr el plazo con cada cambio: así llega aunque se siga anotando. */
const encolar = () => { cadena = cadena.then(subir).catch(() => {}); };
function programar() {
  if (reloj || sinSoporte || !enLinea()) return;
  reloj = setTimeout(() => { reloj = 0; encolar(); }, ESPERA_MS);
}

alGuardar.add(programar);
// Al pasar al fondo (bloquear el teléfono entre series) sube lo pendiente sin esperar el plazo.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden' || !reloj) return;
  clearTimeout(reloj); reloj = 0;
  encolar();
});
