// Alargar el bloque una semana según la recuperación (T36). Antes de la semana de descarga, si la semana fue completa,
// con buena energía, buen sueño, poco estrés, sin señales de alarma y las cargas siguen subiendo, el check-in ofrece
// una semana más de trabajo y deja la descarga para la siguiente. Los criterios se muestran tal cual; nada cambia
// hasta que la persona confirma (regla 10).
import { sumarDias } from './agenda.js';

// Cada 4 a 6 semanas de trabajo, una descarga (contenido/checkin.json, regla descarga_planificada).
export const MAX_SEMANAS_TRABAJO = 6;
const MAX_SEMANAS_PLAN = 12; // la tabla planes acepta de 1 a 12

/**
 * Los criterios, cada uno con su resultado, y si se ofrece alargar.
 * @param p el resultado de proponerCheckin (semana, descarga, dias, banderas, items)
 * @param respuestas lo que contestó la persona en el check-in: energia (1 a 5), sueno ('mal'|'regular'|'bien'), estres (1 a 5)
 */
export function criteriosAlargar(plan, p, respuestas = {}) {
  if (!p?.descarga || !plan?.semana_descarga) return { aplica: false, ofrecer: false, criterios: [] };
  const firmes = p.dias.filter(d => d.firme), hechas = firmes.filter(d => d.series);
  const conRegistro = p.items.filter(i => i.hechas?.length);
  const suben = conRegistro.filter(i => i.tipo === 'subir').length, bajan = conRegistro.filter(i => i.tipo === 'bajar').length;
  const criterios = [
    { id: 'adherencia', texto: `Hiciste todas las sesiones firmes (${hechas.length} de ${firmes.length})`, ok: firmes.length > 0 && hechas.length === firmes.length },
    { id: 'rendimiento', texto: `Las cargas siguen subiendo (${suben} de ${conRegistro.length} ejercicios) y ninguna baja`, ok: conRegistro.length > 0 && suben * 2 >= conRegistro.length && bajan === 0 },
    { id: 'energia', texto: 'Energía de 4 o 5', ok: Number(respuestas.energia) >= 4 },
    { id: 'sueno', texto: 'Dormiste bien', ok: respuestas.sueno === 'bien' },
    { id: 'estres', texto: 'Estrés de 3 o menos', ok: respuestas.estres != null && Number(respuestas.estres) <= 3 },
    { id: 'banderas', texto: 'Sin dolores ni señales de alarma', ok: !p.banderas?.length },
    { id: 'largo', texto: `El bloque queda en ${MAX_SEMANAS_TRABAJO} semanas de trabajo o menos`, ok: plan.semana_descarga <= MAX_SEMANAS_TRABAJO && plan.semanas < MAX_SEMANAS_PLAN },
  ];
  return { aplica: true, ofrecer: criterios.every(c => c.ok), criterios };
}

/**
 * Una semana más de trabajo antes de la descarga: la semana revisada se repite una semana después (mismos días,
 * ejercicios y cargas; el check-in después propone cuánto sube) y la descarga y lo que sigue se corren 7 días.
 */
export function alargarBloque(plan, semana) {
  const desc = plan.semana_descarga;
  if (!desc || semana + 1 !== desc) return null;
  const copia = structuredClone(plan);
  for (const d of copia.dias) if (d.semana >= desc) { d.semana += 1; d.fecha = sumarDias(d.fecha, 7); }
  const nueva = structuredClone(plan.dias.filter(d => d.semana === semana)).map(d => ({ ...d, semana: desc, fecha: sumarDias(d.fecha, 7) }));
  copia.dias = [...copia.dias, ...nueva].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  copia.semana_descarga = desc + 1;
  copia.semanas = (plan.semanas || 0) + 1;
  return copia;
}
