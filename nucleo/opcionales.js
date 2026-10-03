// Días opcionales ordenados por prioridad, como el tablero: si en la semana quedan sesiones opcionales por hacer,
// cuál conviene primero y por qué. Gana la que más trabaja los músculos que van bajo la franja de tu nivel en los
// últimos 12 días (los prioritarios pesan el doble); si empatan, la que viene antes.
import { musculosContraFranja } from './volumen-semana.js';

/**
 * @param dias       las sesiones opcionales pendientes (del plan)
 * @param series     las series anotadas (semanal.seriesAnotadas)
 * @param rango      series por semana de tu nivel (derivados.series_rango)
 * @param prioridad  músculos que pediste priorizar
 * @returns [{fecha, foco, puntaje, bajo: [músculo], prioritarios: [músculo]}] de la que más conviene a la que menos
 */
export function ordenarOpcionales({ dias, series, indice, hoy, rango, prioridad = [] }) {
  if (!dias.length) return [];
  const { filas } = musculosContraFranja({ series, indice, hoy, rango });
  const reciente = Object.fromEntries(filas.map(f => [f.musculo, f.reciente]));
  const [lo] = rango;
  const prio = new Set(prioridad);
  return dias.map(d => {
    const trabaja = new Map();
    for (const e of d.ejercicios || []) {
      const ej = indice.porId.get(e.ejercicio_id);
      if (!ej) continue;
      for (const m of ej.musculos_primarios) trabaja.set(m, (trabaja.get(m) || 0) + (Number(e.series) || 0));
      for (const m of ej.musculos_secundarios) trabaja.set(m, (trabaja.get(m) || 0) + (Number(e.series) || 0) / 2);
    }
    let puntaje = 0;
    const bajo = [];
    for (const [m, n] of trabaja) {
      const falta = Math.max(0, lo - (reciente[m] || 0));
      if (falta > 0 && n >= 2) bajo.push(m);
      puntaje += Math.min(n, falta) * (prio.has(m) ? 2 : 1);
    }
    return { fecha: d.fecha, foco: d.foco, puntaje: Math.round(puntaje * 10) / 10, bajo: bajo.sort((a, b) => (trabaja.get(b) || 0) - (trabaja.get(a) || 0)), prioritarios: [...trabaja.keys()].filter(m => prio.has(m)) };
  }).sort((a, b) => b.puntaje - a.puntaje || a.fecha.localeCompare(b.fecha));
}
