// Recordatorios de entrenar y de suplementos (nucleo/recordatorios.js).
// Sin servidor, una app web no puede despertar el teléfono a una hora: los avisos salen mientras la app está
// abierta (en Android, también un rato después de cerrarla). En iPhone, además, solo con la app instalada en la
// pantalla de inicio. Para que suenen siempre se ofrece agregarlos al calendario del teléfono (.ics).
import { E, guardar, hoy, ahora, esc } from './comun.js';
import { avisosDelDia, eventosCalendario, CONFIG_AVISOS } from '../nucleo/recordatorios.js';
import { escribirIcs } from '../nucleo/ics.js';

export const configAvisos = () => ({ ...CONFIG_AVISOS, ...(E.avisos || {}) });
export function cambiarAvisos(cambios) { E.avisos = { ...configAvisos(), ...cambios }; guardar(); programarAvisos(); }

export function soporte() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const hay = 'Notification' in window;
  return { ios, instalada, hay, permiso: hay ? Notification.permission : 'no' };
}

/** Pide permiso (tiene que ser al tocar un botón) y deja los avisos activos si lo dan. */
export async function activarAvisos() {
  if (!('Notification' in window)) return 'no';
  const permiso = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permiso === 'granted') cambiarAvisos({ activos: true });
  return permiso;
}

export async function notificar(titulo, cuerpo, tag) {
  const opciones = { body: cuerpo, tag, icon: 'iconos/icono-192.png', badge: 'iconos/icono-192.png' };
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
  if (reg) return reg.showNotification(titulo, opciones); // iPhone y Android solo muestran avisos así
  return new Notification(titulo, opciones);
}

const sesionHecha = f => E.sesiones.some(s => s.fecha === f) || Object.values(E.registro[f] || {}).some(l => (l || []).some(x => x?.hecho));
const delDia = f => avisosDelDia({ plan: E.plan, suplementos: E.suplementos, tomas: E.tomas, fecha: f, config: configAvisos(), sesionHecha: sesionHecha(f) });
const aMin = hhmm => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

let relojes = [];
/** Programa los avisos que quedan hoy. Se vuelve a llamar al abrir la app, al cambiar de vista y a medianoche. */
export function programarAvisos() {
  relojes.forEach(clearTimeout);
  relojes = [];
  if (!configAvisos().activos || soporte().permiso !== 'granted' || !E.plan?.dias) return;
  const f = hoy(), segundos = new Date().getSeconds();
  const ya = aMin(ahora().slice(11, 16));
  for (const a of delDia(f)) {
    const ms = (aMin(a.hora) - ya) * 6e4 - segundos * 1000;
    if (ms < 0) continue; // lo atrasado se ve en Hoy
    relojes.push(setTimeout(() => {
      // Justo antes de avisar se revisa de nuevo: si ya entrenó o ya lo tomó, no se avisa.
      const sigue = hoy() === f && delDia(f).find(x => x.id === a.id);
      if (sigue) notificar(sigue.titulo, sigue.cuerpo, sigue.id).catch(e => console.warn('Aviso no mostrado', e));
    }, ms));
  }
  relojes.push(setTimeout(programarAvisos, ((24 * 60 - ya) * 60 - segundos + 30) * 1000));
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') programarAvisos(); });

/** Archivo .ics con las sesiones que quedan del plan y los suplementos, como enlace para agregar al calendario. */
export function enlaceCalendario() {
  const ics = escribirIcs(eventosCalendario({ plan: E.plan, suplementos: E.suplementos, desde: hoy(), config: configAvisos() }), { nombre: 'Entreno' });
  // En iPhone, abrir el archivo (sin "download") muestra directo "Agregar al calendario".
  const href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  return `<a class="boton" href="${esc(href)}"${soporte().ios ? '' : ' download="entreno-recordatorios.ics"'}>Agregar a mi calendario</a>`;
}
