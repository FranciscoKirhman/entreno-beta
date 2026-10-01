// Recordatorios: la sesión del día y los suplementos a su hora. Sirven para tres caminos:
// 1. avisos de la app web mientras está abierta (app/avisos.js),
// 2. alarmas en el calendario del teléfono (.ics), que suenan aunque la app esté cerrada,
// 3. más adelante, avisos enviados por el servidor (web push) con el mismo cálculo.
import { checklist } from './suplementos.js';
import { duracionEstimada } from './motor-plan.js';

export const CONFIG_AVISOS = { activos: false, entrenar: true, horaEntreno: '08:00', minutosAntes: 60, suplementos: true };

const aMin = hora => { const [h, m] = hora.split(':').map(Number); return h * 60 + m; };
const aHora = min => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** Cuándo avisar de una sesión: con hora, `minutosAntes`; sin hora, a la hora fija de la mañana. */
export function horaAvisoSesion(dia, config = CONFIG_AVISOS) {
  if (!dia.hora) return config.horaEntreno;
  return aHora(Math.max(0, aMin(dia.hora) - config.minutosAntes));
}

/**
 * Avisos de un día, con su hora 'HH:MM'. La sesión solo si hay ejercicios y todavía no se entrenó; los
 * suplementos que tienen hora y no se han tomado.
 * @returns {{id, hora, tipo: 'sesion' | 'suplemento', titulo, cuerpo}[]}
 */
export function avisosDelDia({ plan, suplementos = [], tomas = [], fecha, config = CONFIG_AVISOS, sesionHecha = false }) {
  const out = [];
  const dia = plan?.dias?.find(d => d.fecha === fecha);
  if (config.entrenar && dia?.ejercicios?.length && !sesionHecha) {
    out.push({ id: `sesion-${fecha}`, hora: horaAvisoSesion(dia, config), tipo: 'sesion', titulo: `Hoy toca ${dia.foco}`,
      cuerpo: `${dia.hora ? `A las ${dia.hora}, ` : ''}unos ${duracionEstimada(dia.ejercicios)} minutos. Abre la app para ver la sesión.` });
  }
  if (config.suplementos) {
    for (const s of checklist(suplementos, tomas, fecha)) {
      if (!s.hora || s.estado === 'tomada') continue;
      out.push({ id: `sup-${s.suplemento_id}-${s.hora}-${fecha}`, hora: s.hora, tipo: 'suplemento', titulo: `${s.nombre}${s.dosis ? ` · ${s.dosis}` : ''}`,
        cuerpo: 'Tu recordatorio de suplemento. Márcalo en Hoy cuando lo tomes.' });
    }
  }
  return out.sort((a, b) => (a.hora < b.hora ? -1 : 1));
}

/**
 * Eventos para el calendario del teléfono desde `desde`: cada sesión del plan (con su hora y duración, o de día
 * completo si no tiene hora) y cada suplemento como evento que se repite a su hora.
 */
export function eventosCalendario({ plan, suplementos = [], desde, config = CONFIG_AVISOS }) {
  const out = [];
  if (config.entrenar) {
    for (const d of (plan?.dias || []).filter(x => x.fecha >= desde && x.ejercicios?.length)) {
      const min = duracionEstimada(d.ejercicios);
      const ejercicios = d.ejercicios.map(e => `- ${e.nombre || e.ejercicio_id}: ${e.series} × ${e.reps_min}${e.reps_max !== e.reps_min ? `-${e.reps_max}` : ''}${e.unidad === 'seg' ? ' s' : ''}${e.carga_kg ? `, ${String(e.carga_kg).replace('.', ',')} kg` : ''}`).join('\n');
      out.push({
        uid: `sesion-${d.fecha}`, titulo: `Entreno: ${d.foco}`, descripcion: `Unos ${min} minutos.\n${ejercicios}\n\nSi la app movió la sesión, vuelve a agregar el calendario desde Más.`,
        ...(d.hora ? { inicio: `${d.fecha}T${d.hora}`, minutos: min, alarmaMin: -config.minutosAntes } : { inicio: d.fecha, alarmaMin: aMin(config.horaEntreno) }),
      });
    }
  }
  if (config.suplementos) {
    for (const s of suplementos.filter(x => x.activo !== false)) {
      for (const hora of s.horas || []) {
        const dias = s.dias?.length ? s.dias : null;
        out.push({ uid: `sup-${s.id}-${hora}`, titulo: `${s.nombre}${s.dosis ? ` · ${s.dosis}` : ''}`, inicio: `${desde}T${hora}`, minutos: 5, alarmaMin: 0,
          descripcion: `Recordatorio de suplemento${dias ? ` (${dias.map(d => NOMBRES[d]).join(', ')})` : ', todos los días'}.`, repetir: { dias } });
      }
    }
  }
  return out;
}
