// Aviso del descanso con la app cerrada o la pantalla bloqueada, como Hevy: al partir el descanso, el servidor
// (supabase/functions/aviso-descanso) programa una notificación push para cuando termine. Si se salta el descanso o
// cambia su duración, se cancela. Solo en la app instalada (en iPhone, desde la pantalla de inicio) y con permiso.
import { CONFIG } from './config.js';
import { E, guardar } from './comun.js';

// Clave pública VAPID (la privada está en los secretos del servidor). Es pública por diseño.
const PUBLICA = 'BImBkrU0XSeV6XqLYN31Tj5YQ33AnmyfLzoXtwFJKkypLGzqQUW2YVxx7ouHXiZP173hWdzmqKuBi3e5Jq1hEFM';
let actual = null, reloj = null;

const base64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), c => c.charCodeAt(0));
export const avisoCerradaDisponible = () => Boolean(CONFIG.funcionesUrl && CONFIG.sinSenal && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
export const avisoCerradaActivo = () => Boolean(E.ajustesSesion?.avisoCerrada) && avisoCerradaDisponible() && Notification.permission === 'granted';

async function suscripcion(crear) {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return (await reg.pushManager.getSubscription()) || (crear ? reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64(PUBLICA) }) : null);
}

/** Activa o desactiva el aviso (hay que llamarla al tocar: pide el permiso). Devuelve un texto si no se pudo. */
export async function cambiarAvisoCerrada(activar) {
  (E.ajustesSesion ||= {}).avisoCerrada = false;
  if (!activar) { guardar(); return null; }
  if (!avisoCerradaDisponible()) { guardar(); return /iPhone|iPad/.test(navigator.userAgent) ? 'En iPhone funciona con la app instalada en la pantalla de inicio (Compartir → Agregar a pantalla de inicio).' : 'Este navegador no permite avisos con la app cerrada.'; }
  const permiso = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permiso !== 'granted') { guardar(); return 'Sin permiso para avisos. Puedes darlo en los ajustes del teléfono.'; }
  try { await suscripcion(true); } catch { guardar(); return 'No pude activar los avisos en este teléfono.'; }
  E.ajustesSesion.avisoCerrada = true; guardar();
  return null;
}

const enviar = cuerpo => fetch(`${CONFIG.funcionesUrl}/aviso-descanso`, { method: 'POST', keepalive: true,
  headers: { 'content-type': 'application/json', apikey: CONFIG.supabaseAnonKey || '' }, body: JSON.stringify(cuerpo) }).catch(() => {});

/** Programa el aviso para dentro de seg segundos (reemplaza el anterior). Se espera un poco por si se ajusta ±15. */
export function programarAvisoDescanso(seg, texto = '¡A la siguiente serie!') {
  if (!avisoCerradaActivo()) return;
  cancelarAvisoDescanso();
  clearTimeout(reloj);
  const fin = Date.now() + seg * 1000;
  reloj = setTimeout(async () => {
    const s = await suscripcion(false).catch(() => null);
    const quedan = Math.round((fin - Date.now()) / 1000);
    if (!s || quedan < 5) return;
    actual = crypto.randomUUID();
    enviar({ id: actual, suscripcion: s.toJSON(), en_seg: quedan, texto });
  }, 1500);
}

/** Cancela el aviso pendiente (saltó el descanso, lo cambió o la app está a la vista cuando termina). */
export function cancelarAvisoDescanso() {
  clearTimeout(reloj);
  if (!actual) return;
  enviar({ id: actual, cancelar: true });
  actual = null;
}
