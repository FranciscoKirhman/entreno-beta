// Check-in: señales de alarma y respuestas rápidas del check-in inmediato (contenido/checkin.json).
// Las respuestas rápidas son reglas: funcionan en los dos planes y no gastan IA.
import { nivelAlcanza, tieneEquipo, cargaZonaBloqueada } from './catalogo.js';
import { duracionEstimada } from './motor-plan.js';

/**
 * Señales de alarma en las respuestas de un check-in.
 * @param r { senales: ['dolor_pecho', ...], dolores: [{region, intensidad, senales: [], tendencia}] }
 * @param tendenciaAnterior { [region]: 'peor' | ... } del check-in de la semana pasada
 */
export function detectarBanderas(r, checkin, tendenciaAnterior = {}) {
  const lista = checkin.banderas_rojas.lista;
  const por = id => lista.find(b => b.id === id);
  const out = [];
  for (const id of r.senales || []) if (por(id)) out.push({ ...por(id), zona: null });
  for (const d of r.dolores || []) {
    const s = d.senales || [];
    if (s.includes('hormigueo')) out.push({ ...por('hormigueo'), zona: d.region });
    if (s.includes('chasquido')) out.push({ ...por('lesion_aguda'), zona: d.region });
    if ((d.intensidad ?? 0) >= 7) out.push({ ...por('dolor_alto'), zona: d.region });
    if (d.tendencia === 'peor' && tendenciaAnterior[d.region] === 'peor') out.push({ ...por('dolor_empeora'), zona: d.region });
  }
  const unicas = new Map(out.map(b => [`${b.id}|${b.zona}`, b]));
  return [...unicas.values()];
}

/** Recorta la sesión a los minutos disponibles. Primero saca lo de menor prioridad hasta dejar 3 ejercicios,
 *  después baja a 2 series y acorta descansos, y recién ahí saca más. Con menos de 20 minutos, solo lo principal. */
export function recortarSesion(ejercicios, minutos) {
  let lista = [...ejercicios].sort((a, b) => a.orden - b.orden).map(e => ({ ...e }));
  if (minutos < 20) return lista.filter(e => e.prioridad === 1).slice(0, 2).map(e => ({ ...e, series: Math.min(e.series, 2) }));
  const sobra = () => duracionEstimada(lista) > minutos;
  const menosImportante = () => [...lista].sort((a, b) => b.prioridad - a.prioridad || b.orden - a.orden)[0];
  while (sobra() && lista.length > 3) { const f = menosImportante(); lista = lista.filter(e => e !== f); }
  for (const e of [...lista].sort((a, b) => b.prioridad - a.prioridad)) { if (!sobra()) break; if (e.series > 2) e.series = 2; }
  for (const e of lista) { if (!sobra()) break; e.descanso_seg = Math.min(e.descanso_seg, 90); }
  while (sobra() && lista.length > 1) { const f = menosImportante(); lista = lista.filter(e => e !== f); }
  return lista;
}

/** Hasta 3 alternativas del mismo patrón que se pueden hacer con ese equipamiento y sin cargar zonas bloqueadas. */
export function alternativas(ejercicioId, { indice, equipamiento, bloqueadas = new Set(), nivel = 'avanzado', excluir = [] }) {
  const base = indice.porId.get(ejercicioId);
  if (!base) return [];
  return indice.ejercicios
    .filter(e => e.patron === base.patron && e.id !== base.id && !e.propio && !excluir.includes(e.id)
      && tieneEquipo(e, equipamiento) && !cargaZonaBloqueada(e, bloqueadas) && nivelAlcanza(nivel, e.nivel_minimo))
    .sort((a, b) => a.preferencia - b.preferencia
      || b.musculos_primarios.filter(m => base.musculos_primarios.includes(m)).length - a.musculos_primarios.filter(m => base.musculos_primarios.includes(m)).length)
    .slice(0, 3);
}

/** Versión liviana: mismas series con 2 repeticiones más de reserva. */
export const versionLiviana = ejercicios => ejercicios.map(e => ({ ...e, rir: Math.min(5, e.rir + 2) }));

/** Versión corta: solo lo de prioridad 1. */
export const versionCorta = ejercicios => ejercicios.filter(e => e.prioridad === 1);

/** Qué hacer hoy con un dolor, según contenido/evidencia/06-dolor-y-lesiones.md. */
export function accionDolor({ intensidad, senales = [] }) {
  if (senales.some(s => ['hormigueo', 'chasquido'].includes(s)) || intensidad >= 7) return 'pausar_zona';
  if (intensidad >= 4) return 'reemplazar';
  if (intensidad >= 1) return 'variante_y_menos_carga';
  return 'seguir';
}
