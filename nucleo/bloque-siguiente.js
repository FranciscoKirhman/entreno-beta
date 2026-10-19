// El bloque siguiente se arma durante la última semana del actual (no recién al terminarlo), así el mes que viene
// queda planificado antes de que se acabe el plan. Parte el lunes después de que termina el bloque, y las sesiones que
// quedan del actual se conservan (como semana 0, fuera del volumen del bloque nuevo).
import { sumarDias, diaSemana } from './agenda.js';
import { tieneEquipo, articulacionesBloqueadas, cargaZonaBloqueada } from './catalogo.js';
import { grupos } from './superseries.js';

const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

/**
 * Si ya se puede armar el bloque siguiente: desde 6 días antes del último día del plan (o después de terminado).
 * @returns {{fin, quedan, desde}|null} desde: el día que se le pasa al motor (parte el lunes desde ese día)
 */
export function bloqueSiguienteDisponible(plan, hoy) {
  if (!Array.isArray(plan?.dias) || !plan.dias.length || plan.bloqueado || plan.libre) return null;
  const fin = plan.dias.map(d => d.fecha).sort().at(-1);
  const quedan = dias(hoy, fin);
  if (quedan > 6) return null;
  return { fin, quedan: Math.max(0, quedan), desde: fin >= hoy ? sumarDias(fin, 1) : hoy };
}

/** El lunes en que parte un plan armado desde `f` (el mismo día si ya es lunes), como lo calcula el motor. */
export const lunesDesde = f => sumarDias(f, (8 - diaSemana(f)) % 7);

/**
 * Las sesiones que quedan del plan actual (desde hoy y antes de que parta el nuevo), como semana 0. Con `ctx`
 * ({ respuestas, derivados, indice }) se revisan contra lo nuevo: se descarta la sesión que cae en un día que ya no
 * puedes, y se quitan los ejercicios evitados, los que cargan una zona lesionada ese día y los que no tienen equipo en
 * el lugar; si una sesión queda vacía, se descarta. La reserva sube al mínimo nuevo si una alerta lo pide. Antes se
 * conservaban tal cual: con una lesión nueva seguía el press del viernes, y en el chat el rearme fallaba entero.
 * @param {any} [ctx]
 * @returns {{dias: any[], descartados: any[], quitados: any[]}}
 */
export function diasQueQuedan(actual, nuevo, hoy, ctx = null) {
  const previos = (actual?.dias || []).filter(d => d.fecha >= hoy && d.fecha < nuevo.inicio).map(d => ({ ...structuredClone(d), semana: 0 }));
  const descartados = [], quitados = [];
  if (!ctx?.respuestas || !ctx?.indice) return { dias: previos, descartados, quitados };
  const { respuestas: r, derivados: d, indice } = ctx;
  const noPuedo = new Set(r.dias_no_puedo || []), prohibidos = new Set(r.prohibidos || []);
  const lugares = r.lugares?.length ? r.lugares : [{ nombre: 'Casa', equipamiento: [] }];
  const rirMinimo = d ? Math.max(d.rir_minimo || 0, d.nivel === 'principiante' ? 2 : 0) : 0;
  const dias = [];
  for (const dia of previos) {
    if (noPuedo.has(diaSemana(dia.fecha))) { descartados.push({ fecha: dia.fecha, foco: dia.foco, motivo: 'cae en un día que ya no puedes' }); continue; }
    const lugar = lugares.find(l => l.nombre === dia.lugar) || lugares.find(l => l.principal) || lugares[0];
    const bloqueadas = articulacionesBloqueadas(r.lesiones || [], dia.fecha);
    const motivo = e => {
      if (e.indicacion) return null; // lo indicado por un profesional se respeta tal cual
      const ej = indice.porId.get(e.ejercicio_id);
      if (!ej) return null;
      if (prohibidos.has(ej.id)) return 'lo evitas';
      if (cargaZonaBloqueada(ej, bloqueadas)) return 'carga una zona lesionada';
      if (!tieneEquipo(ej, lugar.equipamiento || [])) return `no hay equipo en ${lugar.nombre || 'tu lugar'}`;
      return null;
    };
    const ejercicios = [];
    for (const e of dia.ejercicios || []) {
      const m = motivo(e);
      if (m) quitados.push({ fecha: dia.fecha, ejercicio_id: e.ejercicio_id, motivo: m });
      else ejercicios.push({ ...e, ...(e.rir != null && e.rir < rirMinimo ? { rir: rirMinimo } : {}) });
    }
    if ((dia.ejercicios || []).length && !ejercicios.length) { descartados.push({ fecha: dia.fecha, foco: dia.foco, motivo: 'no le quedan ejercicios' }); continue; }
    // Una superserie a la que le sacaron un ejercicio se hace como series normales.
    const g = grupos(ejercicios);
    dia.ejercicios = ejercicios.map((e, i) => { const x = { ...e, orden: i }; if (x.superserie && !g[i]) delete x.superserie; return x; });
    dias.push(dia);
  }
  return { dias, descartados, quitados };
}

/** El plan nuevo con las sesiones que quedan del actual (ver diasQueQuedan; con `ctx`, revisadas contra lo nuevo).
 *  @param {any} [ctx] */
export function conDiasQueQuedan(actual, nuevo, hoy, ctx = null) {
  const { dias } = diasQueQuedan(actual, nuevo, hoy, ctx);
  return dias.length ? { ...nuevo, dias: [...dias, ...nuevo.dias] } : nuevo;
}
