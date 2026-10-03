// Hevy entra solo (nucleo/hevy-api.js): la clave de la API vive solo en este navegador, fuera de los datos de la app,
// así no viaja en los respaldos ni a la cuenta. Al abrir la app (cada 30 minutos como mucho) se traen los
// entrenamientos nuevos.
import { E, guardar, indice, avisar, modoEjemplo } from './comun.js';
import { traerDeHevy } from '../nucleo/hevy-api.js';

const CLAVE = 'entreno-hevy-clave', ULTIMA = 'entreno-hevy-ultima';
const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
const escribir = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
export const claveHevy = () => leer(CLAVE);
export const ultimaHevy = () => leer(ULTIMA);
export function guardarClaveHevy(clave) { escribir(CLAVE, clave?.trim() || null); if (!clave) escribir(ULTIMA, null); }

/** Trae lo nuevo de Hevy. @returns {{nuevas, sinCatalogo}} o lanza un error con un texto para la persona. */
export async function sincronizarHevy() {
  const clave = claveHevy();
  if (!clave) throw new Error('Primero guarda tu clave de Hevy.');
  const estado = E;
  const r = await traerDeHevy(clave, E.sesiones, indice);
  if (E !== estado) return { nuevas: [], sinCatalogo: [] }; // cambió la cuenta mientras se traía
  if (r.nuevas.length) {
    E.sesiones.push(...r.nuevas);
    E.sesiones.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
    guardar();
  }
  escribir(ULTIMA, new Date().toISOString());
  return r;
}

/** Al abrir: en silencio, salvo que lleguen sesiones nuevas. */
export async function hevyAlAbrir(alLlegar) {
  if (modoEjemplo || !claveHevy() || !navigator.onLine) return;
  const ultima = Date.parse(ultimaHevy() || 0);
  if (Date.now() - ultima < 30 * 60e3) return;
  try {
    const r = await sincronizarHevy();
    if (r.nuevas.length) { avisar(`Llegaron ${r.nuevas.length === 1 ? '1 sesión' : `${r.nuevas.length} sesiones`} de Hevy.`); alLlegar?.(); }
  } catch { /* se reintenta la próxima vez; en Más se ve el error */ }
}
