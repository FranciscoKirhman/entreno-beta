// Técnica antes que peso (fase 2 del plan del 28 de octubre de 2026): si la última vez que se hizo un ejercicio la nota
// de "Cómo te fue" dijo que se rompió la técnica o que el rango quedó parcial, la vez siguiente va con el mismo peso y un
// chequeo de técnica: los pasos de la ficha, bajar en 3 segundos y, si se puede, grabarse una serie. El peso sube recién
// cuando la persona anota que salió limpia; sin respuesta, "Para la próxima" lo mantiene (nucleo/notas.js:
// calidadPermiteSubir) y el consejo de cada serie no lo sube (nucleo/series.js).
import { sumarDias } from './agenda.js';

const VECES = 3, DIAS = 42;

/**
 * Si el ejercicio tiene la técnica pendiente antes de `fecha`: 'tecnica' (se rompió) o 'rango' (quedó parcial), o null.
 * Mira las últimas 3 veces que se hizo, en 6 semanas, y manda la más reciente con respuesta: "limpias" o "algunas se me
 * desarmaron al final", con el rango completo o casi, lo resuelve. Sin ninguna respuesta no queda nada pendiente.
 * @param sesiones sesiones guardadas [{fecha, series: [{ejercicio_id}], notas: [{ejercicio_id, respuestas}]}]
 */
export function tecnicaPendiente(ejercicioId, sesiones = [], fecha) {
  const veces = sesiones.filter(s => s.fecha < fecha && s.fecha >= sumarDias(fecha, -DIAS) && (s.series || []).some(x => x.ejercicio_id === ejercicioId))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, VECES);
  for (const s of veces) {
    const r = (s.notas || []).find(n => n.ejercicio_id === ejercicioId)?.respuestas || {};
    if (r.forma === 'rota') return 'tecnica';
    if (r.rango === 'parcial') return 'rango';
    if (r.forma || r.rango) return null;
  }
  return null;
}

/** Lo que dice Hoy en la tarjeta del ejercicio: qué pasó, qué hacer hoy, los pasos de la ficha y cómo comprobarlo. */
export function avisoTecnica(motivo, pasos = []) {
  return {
    texto: motivo === 'rango' ? 'La última vez el rango quedó parcial: hoy, mismo peso y cada repetición completa.'
      : 'La última vez se rompió la técnica: hoy, mismo peso y cada repetición limpia.',
    pasos: pasos.slice(0, 3),
    como: 'Baja en 3 segundos y para la serie cuando una repetición se vea distinta a la primera. Si puedes, grábate una serie de lado: el video queda en tu teléfono.',
    pregunta: motivo === 'rango' ? '¿Llegaste al rango completo hoy?' : '¿Salió limpia hoy?',
    // Las respuestas van a la nota del ejercicio, las mismas de "Cómo te fue".
    si: motivo === 'rango' ? { rango: 'completo' } : { forma: 'limpias' },
    no: motivo === 'rango' ? { rango: 'parcial' } : { forma: 'rota' },
  };
}
