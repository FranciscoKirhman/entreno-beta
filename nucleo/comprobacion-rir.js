// Serie de comprobación de la reserva (RIR), fase 2 del plan del 28 de octubre de 2026. Cada 2 semanas o más, en un
// ejercicio seguro de la sesión (máquina, polea o mancuernas, mejor aislado; nunca uno que cargue una zona con molestia
// ni uno con la técnica pendiente), la última serie va hasta que la repetición siguiente ya no sale con buena técnica.
// Antes, la persona dice cuántas cree que salen: la diferencia es su puntería de RIR. Se acierta mejor cerca del fallo y
// con práctica, y se subestima más con muchas repeticiones (Zourdos 2016, Helms 2016, Halperin 2022): por eso va en
// ejercicios de 5 a 15. A quien suele quedarle bastante más de lo que anota, "Para la próxima" le corrige la reserva y
// sube con saltos más grandes (nucleo/progresion.js), y el consejo de cada serie también (nucleo/series.js).
// Se guarda en la nota del ejercicio (respuestas.comprobacion), que ya va a la cuenta con la sesión.
import { sumarDias } from './agenda.js';
import { esAsistido } from './catalogo.js';

const CADA = 14, VIGENCIA = 84;
// Equipos con los que llegar al fallo técnico no tiene riesgo: en los aislados, también mancuernas y barra Z (el banco
// solo acompaña: fondos en banco es peso corporal). Las máquinas y poleas van primero, porque guían el movimiento.
const AISLADO = new Set(['maquinas', 'poleas', 'mancuernas', 'barra_ez', 'banco_predicador', 'extension_cuadriceps', 'curl_femoral', 'abductora', 'kickback_maquina', 'hip_thrust_maquina']);
const COMPUESTO = new Set(['maquinas', 'poleas', 'jalon']);
const LIBRE = new Set(['mancuernas', 'barra_ez']);
const mediana = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Las comprobaciones guardadas, de la más antigua a la más nueva: {fecha, ejercicio_id, kg, predichas, reales, diferencia}. */
export function comprobaciones(sesiones = []) {
  const out = [];
  for (const s of sesiones) {
    for (const n of s.notas || []) {
      const c = n.respuestas?.comprobacion;
      if (!(Number(c?.predichas) > 0) || !(Number(c?.reales) > 0)) continue;
      out.push({ fecha: s.fecha, ejercicio_id: n.ejercicio_id, kg: c.kg ?? null, predichas: Number(c.predichas), reales: Number(c.reales), diferencia: Number(c.reales) - Number(c.predichas) });
    }
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
}

/**
 * La puntería: la diferencia típica entre lo que salió y lo que creía (mediana de las últimas 3, de 12 semanas). Positiva:
 * le quedaba más de lo que creía. correccion: cuánto sumarle a la reserva anotada, solo si suele quedarle 3 o más, con
 * una menos de lo medido para no pasarse y hasta 4. A quien llega antes de lo que cree no se le corrige hacia abajo: se
 * le dice que deje una más.
 */
export function punteria(lista = [], hoy) {
  const recientes = lista.filter(c => c.fecha <= hoy && c.fecha >= sumarDias(hoy, -VIGENCIA)).slice(-3);
  if (!recientes.length) return null;
  const diferencia = mediana(recientes.map(c => c.diferencia));
  return { n: recientes.length, diferencia, correccion: diferencia >= 3 ? Math.min(4, Math.floor(diferencia) - 1) : 0, ultima: recientes.at(-1) };
}

/** El ejercicio sirve para ir hasta el fallo técnico sin riesgo: aislado con máquina, polea o mancuernas (o compuesto en
 *  máquina o polea), con carga, de 5 a 15 repeticiones. Nunca sentadilla, peso muerto ni press con barra. */
export function seguroParaComprobar(e, ej) {
  if (!ej || ej.propio || ej.extra || esAsistido(ej) || ['seg', 'm'].includes(e?.unidad)) return false;
  if (!(Number(e.reps_min) >= 5) || !(Number(e.reps_max) <= 15)) return false;
  const equipo = (ej.equipamiento || []).filter(x => x !== 'banco'), sirve = ej.tipo === 'aislamiento' ? AISLADO : COMPUESTO;
  return equipo.length > 0 && equipo.every(x => sirve.has(x));
}

/**
 * Si hoy toca y en qué ejercicio: cada 2 semanas o más, si en las últimas 4 anotó el esfuerzo (sin RIR ni RPE no hay nada
 * que corregir), fuera de la descarga y si no dijo "Hoy no" en los últimos 3 días. Mejor un aislado y, entre ellos, el que
 * va más al final, en máquina o polea antes que con peso libre: llegar al fallo ahí no le quita nada al resto de la sesión.
 * @param o.zonas     articulaciones con molestia o dolor reciente: lo que las carga no va al fallo
 * @param o.pendiente ejercicio_id → motivo de técnica pendiente (nucleo/tecnica-primero.js) o null
 * @param o.saltada   fecha del último "Hoy no"
 * @returns {{ejercicio_id, nombre, ultima}} ultima: la comprobación anterior, para recordarla
 */
export function comprobacionHoy({ dia, sesiones = [], hoy, indice, plan = null, zonas = [], pendiente = () => null, saltada = null }) {
  if (!dia?.ejercicios?.length || (dia.semana != null && dia.semana === plan?.semana_descarga)) return null;
  const ultima = comprobaciones(sesiones).at(-1) || null;
  if (ultima && ultima.fecha > sumarDias(hoy, -CADA)) return null;
  if (saltada && saltada >= sumarDias(hoy, -3)) return null;
  const conEsfuerzo = sesiones.some(s => s.fecha >= sumarDias(hoy, -28) && s.fecha <= hoy && (s.series || []).some(x => x.rir != null || x.rpe != null));
  if (!conEsfuerzo) return null;
  const candidatos = dia.ejercicios.map((e, k) => ({ e, k, ej: indice.porId.get(e.ejercicio_id) }))
    .filter(({ e, ej }) => seguroParaComprobar(e, ej) && !(ej.carga_articular || []).some(z => zonas.includes(z)) && !pendiente(e.ejercicio_id))
    .sort((a, b) => (a.ej.tipo === 'aislamiento' ? 0 : 1) - (b.ej.tipo === 'aislamiento' ? 0 : 1)
      || a.ej.equipamiento.some(x => LIBRE.has(x)) - b.ej.equipamiento.some(x => LIBRE.has(x)) || b.k - a.k);
  const c = candidatos[0];
  return c ? { ejercicio_id: c.e.ejercicio_id, nombre: c.e.nombre || c.ej.nombre, ultima } : null;
}

/** Lo que se dice al anotar la serie de comprobación. */
export function textoComprobacion(predichas, reales) {
  const d = reales - predichas, base = `Creíste que salían ${predichas} y salieron ${reales}`;
  if (d >= 3) return `${base}: te quedaban ${d} más de lo que creías. Es común: lejos del fallo cuesta saber cuánto queda. Cuando anotes 1 o 2 de reserva, probablemente te queden más; la app lo toma en cuenta para subir el peso.`;
  if (d >= 1) return `${base}: buena puntería, ${d === 1 ? 'una' : d} más de lo que creías. Tu reserva anotada es confiable.`;
  if (d === 0) return `${base}: puntería exacta. Tu reserva anotada es confiable.`;
  return `${base}: llegaste antes de lo que creías. Cuando el plan pida 2 de reserva, deja una más por si acaso.`;
}
