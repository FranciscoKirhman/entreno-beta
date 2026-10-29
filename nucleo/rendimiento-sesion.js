// Rendimiento de cada sesión comparado con lo habitual de la persona, para verlo junto a la energía y el ánimo de ese
// día (Francisco, 28 de octubre de 2026: "es bueno saber que uno rinde bien a pesar de tener poca energía, o al revés").
// Por ejercicio con peso: el mejor máximo estimado del día (Epley con la reserva anotada, nucleo/motor-plan.js) contra la
// mediana de sus últimas 3 sesiones de las 8 semanas anteriores, sin las livianas (una descarga no es lo habitual). El
// de la sesión es el promedio de sus ejercicios, pesado por series de trabajo. Las series sin esfuerzo anotado cuentan
// con 2 de reserva, como en el resto de la app.
import { e1rm } from './motor-plan.js';
import { esDeTrabajoGuardada } from './registro.js';
import { sumarDias } from './agenda.js';

const VENTANA = 56, REFERENCIAS = 3;
// Más de un 30% de diferencia en semanas no es rendimiento: es otro equipo, otra variante o un dato mal anotado.
const PLAUSIBLE = 30;
const mediana = xs => { const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** Por ejercicio, cada día con su mejor máximo estimado, su carga más alta y sus series. */
function diasPorEjercicio(sesiones, asistidos) {
  const porEj = new Map();
  for (const ses of sesiones) {
    for (const s of ses.series || []) {
      if (!s.ejercicio_id || !esDeTrabajoGuardada(s) || asistidos.has(s.ejercicio_id)) continue;
      const kg = Number(s.carga_kg), reps = Number(s.reps);
      if (!(kg > 0) || !(reps > 0)) continue;
      const serie = { carga_kg: kg, reps, rir: s.tipo === 'fallo' ? 0 : s.rir ?? null, rpe: s.rpe ?? null };
      if (!porEj.has(s.ejercicio_id)) porEj.set(s.ejercicio_id, new Map());
      const dias = porEj.get(s.ejercicio_id);
      const d = dias.get(ses.fecha) || { fecha: ses.fecha, mejor: 0, tope: 0, series: 0 };
      d.mejor = Math.max(d.mejor, e1rm(serie));
      d.tope = Math.max(d.tope, kg);
      d.series += 1;
      dias.set(ses.fecha, d);
    }
  }
  return new Map([...porEj].map(([id, dias]) => [id, [...dias.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))]));
}

/**
 * @param sesiones  sesiones guardadas [{id, fecha, series: [{ejercicio_id, tipo, carga_kg, reps, rir, rpe}]}]
 * @param o.desde, o.hasta  las sesiones a medir; las anteriores sirven solo de referencia
 * @param o.asistidos  ids donde el peso es ayuda: no se miden (más ayuda no es más fuerza)
 * @returns [{fecha, pct, ejercicios, series}] pct: 4 es un 4% sobre lo habitual. Un día sin nada que comparar no aparece.
 */
export function rendimientoSesiones(sesiones = [], { desde = '', hasta = '9999-12-31', asistidos = new Set() } = {}) {
  const porFecha = new Map();
  for (const dias of diasPorEjercicio(sesiones, asistidos).values()) {
    // Lo habitual sale de los días que sirven de referencia: un dato raro tampoco cuenta para los días siguientes.
    const validos = [];
    for (const d of dias) {
      const previos = validos.filter(x => x.fecha >= sumarDias(d.fecha, -VENTANA));
      // Liviana: la carga más alta del día bajo el 90% de lo que venía usando (una descarga o un día suave a propósito).
      // No se mira el esfuerzo: en la descarga del 13 de octubre de 2026 se anotó RPE 8 y salía un 20% "peor".
      const topeHabitual = previos.length ? Math.max(...previos.map(x => x.tope)) : 0;
      if (d.tope < topeHabitual * 0.9) continue;
      const refs = previos.slice(-REFERENCIAS);
      const pct = refs.length ? (d.mejor / mediana(refs.map(x => x.mejor)) - 1) * 100 : null;
      if (pct != null && Math.abs(pct) > PLAUSIBLE) continue;
      validos.push(d);
      if (pct == null || d.fecha < desde || d.fecha > hasta) continue;
      const f = porFecha.get(d.fecha) || { fecha: d.fecha, suma: 0, series: 0, ejercicios: 0 };
      f.suma += pct * d.series; f.series += d.series; f.ejercicios += 1;
      porFecha.set(d.fecha, f);
    }
  }
  return [...porFecha.values()].sort((a, b) => (a.fecha < b.fecha ? -1 : 1))
    .map(f => ({ fecha: f.fecha, pct: Math.round((f.suma / f.series) * 10) / 10, ejercicios: f.ejercicios, series: f.series }));
}

/** "+4%" o "−3%", con el signo menos de verdad, como el resto de Progreso. */
export const textoPct = p => `${p > 0.5 ? '+' : p < -0.5 ? '−' : ''}${Math.round(Math.abs(p))}%`;

const MEDIDAS = {
  energia: { campo: 'cansancio', baja: v => v >= 4, alta: v => v <= 2, poca: 'poca energía', buena: 'buena energía' },
  animo: { campo: 'animo', baja: v => v <= 2, alta: v => v >= 4, poca: 'el ánimo bajo', buena: 'buen ánimo' },
};

/**
 * Cómo rindes según cómo llegas: las sesiones con poca y con buena energía (o ánimo), con lo que respondiste en "¿Cómo
 * estás hoy?" ese día. Con menos de 3 sesiones en un grupo no se dice nada de él: serían casualidades.
 * @returns {{baja: {n, pct} | null, alta: {n, pct} | null, texto: string | null}}
 */
export function segunComoLlegas(rendimientos, bienestar = {}, medida = 'energia') {
  const m = MEDIDAS[medida];
  const grupo = ok => {
    const xs = rendimientos.filter(r => bienestar[r.fecha]?.[m.campo] != null && ok(Number(bienestar[r.fecha][m.campo])));
    return xs.length >= 3 ? { n: xs.length, pct: xs.reduce((a, r) => a + r.pct, 0) / xs.length } : null;
  };
  const baja = grupo(m.baja), alta = grupo(m.alta);
  if (!baja) return { baja, alta, texto: null };
  const de = g => `${textoPct(g.pct)} (${g.n} sesiones)`;
  // Con los dos grupos, lo que importa es la diferencia entre ellos; con uno solo, contra lo habitual.
  if (alta) {
    const dif = alta.pct - baja.pct, ambos = `Con ${m.poca} rendiste ${de(baja)} y con ${m.buena}, ${de(alta)}`;
    const texto = dif < -2 ? `Con ${m.poca} rendiste ${de(baja)}, más que con ${m.buena} (${de(alta)}): cómo despiertas no decide tu sesión.`
      : dif <= 2 ? `${ambos}: casi lo mismo. Vale la pena ir aunque no llegues al cien.`
        : dif <= 5 ? `${ambos}: un poco menos, pero igual sumas.`
          : `${ambos}: esos días conviene la sesión liviana de "Ajustar hoy".`;
    return { baja, alta, texto };
  }
  const texto = baja.pct >= 2 ? `Con ${m.poca} rendiste más que lo habitual, ${de(baja)}: vale la pena ir aunque no llegues al cien.`
    : baja.pct >= -1 ? `Con ${m.poca} rendiste como siempre, ${de(baja)}: vale la pena ir aunque no llegues al cien.`
      : baja.pct >= -4 ? `Con ${m.poca} rendiste un poco menos que lo habitual, ${de(baja)}.`
        : `Con ${m.poca} rindes menos, ${de(baja)}: esos días conviene la sesión liviana de "Ajustar hoy".`;
  return { baja, alta, texto };
}
