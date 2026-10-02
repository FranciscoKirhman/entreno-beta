// Qué sesión del plan se hizo y cuándo, con lo registrado (en la app o importado de Hevy). Igual que el tablero:
//  1. Las sesiones anotadas en la app son de su día. Cada sesión importada se asigna a la del plan que más se le
//     parece por ejercicios, entre una semana antes y tres días después de su fecha: así se reconoce una sesión
//     recuperada (la del lunes hecha el miércoles) o adelantada.
//  2. Solo se da por no hecho lo que se sabe: lo que pasó antes del día del último registro. Después, "sin registro".
//  3. Una sesión firme de los últimos 7 días sin registro queda pendiente, salvo que la misma sesión (el mismo foco) se
//     haya hecho después o toque hoy o mañana. La app no corre nada sola: pregunta, y para correrla usa
//     agenda.marcarFaltada con vista previa y confirmación.
//  4. Lo que responde la persona ("la hice sin anotarla", "la salto") manda sobre lo deducido.

export const ATRAS = 7, ADELANTE = 3, VIGENCIA = 7, PARECIDO = 0.4;

const sumar = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const entre = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);
const clave = s => `${s.fecha}T${s.hora || '00:00'}`;
/** "Descarga, tirón: espalda" y "Tirón: espalda" son la misma sesión para saber si una pendiente ya se repitió. */
const mismaSesion = foco => String(foco || '').replace(/^(descarga|opcional)\s*[,:]\s*/i, '').trim().toLowerCase();

/** Parte de los ejercicios del día del plan que aparece en la sesión registrada (0 a 1). */
export function parecido(dia, sesion) {
  const plan = new Set((dia.ejercicios || []).map(e => e.ejercicio_id).filter(Boolean));
  if (!plan.size) return 0;
  const hechos = new Set((sesion.series || []).map(s => s.ejercicio_id).filter(Boolean));
  let n = 0;
  for (const id of plan) if (hechos.has(id)) n++;
  return n / plan.size;
}

/**
 * @param plan     plan de la app
 * @param sesiones sesiones guardadas: de la app (sin origen) e importadas (origen 'hevy' u otro)
 * @param hoy      'AAAA-MM-DD'
 * @param marcas   lo que respondió la persona por fecha del plan: 'hecha' (sin anotar) o 'saltada'
 * @returns {{porDia: Map<string, {t, sesion?, el?, por?}>, pendientes: object[], hoy: {sesiones: object[], de: string|null}, conocido: string}}
 *   t: 'hecha' | 'recuperada' | 'adelantada' | 'hecha_sin_registro' | 'saltada' | 'por_hacer' | 'sin_datos'
 *      | 'omitida' | 'no_hecha' | 'pendiente' | 'reemplazada'
 */
export function estadoDelPlan(plan, sesiones = [], { hoy, marcas = {} } = {}) {
  const dias = (plan?.dias || []).filter(d => d.ejercicios?.length).sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  const inicio = dias[0]?.fecha || hoy;
  const regs = sesiones.filter(s => s?.fecha && s.fecha >= sumar(inicio, -ATRAS)).sort((a, b) => (clave(a) < clave(b) ? -1 : 1));
  const hecha = new Map();
  // 1. Las de la app, a su día; las importadas, a la del plan que más se parece.
  for (const s of regs.filter(x => !x.origen)) {
    const d = dias.find(x => x.fecha === s.fecha);
    if (d && !hecha.has(d.fecha)) hecha.set(d.fecha, s);
  }
  for (const s of regs.filter(x => x.origen)) {
    let mejor = null, mp = 0;
    for (const d of dias) {
      if (hecha.has(d.fecha) || d.fecha < sumar(s.fecha, -ATRAS) || d.fecha > sumar(s.fecha, ADELANTE)) continue;
      const p = parecido(d, s);
      const masCerca = mejor && Math.abs(entre(d.fecha, s.fecha)) < Math.abs(entre(mejor.fecha, s.fecha));
      if (p > mp + 1e-9 || (Math.abs(p - mp) < 1e-9 && masCerca)) { mejor = d; mp = p; }
    }
    if (mejor && mp >= PARECIDO) hecha.set(mejor.fecha, s);
  }
  // 2. Se sabe lo que se hizo hasta el día del último registro.
  const ultimo = regs.at(-1)?.fecha;
  const conocido = ultimo ? sumar(ultimo, 1) : inicio;
  const porDia = new Map();
  for (const d of dias) {
    const s = hecha.get(d.fecha), m = marcas[d.fecha];
    let e;
    if (s) e = s.fecha === d.fecha ? { t: 'hecha', sesion: s } : { t: s.fecha > d.fecha ? 'recuperada' : 'adelantada', sesion: s, el: s.fecha };
    else if (m === 'hecha') e = { t: 'hecha_sin_registro' };
    else if (m === 'saltada') e = { t: 'saltada' };
    else if (d.fecha >= hoy) e = { t: 'por_hacer' };
    else if (d.fecha >= conocido) e = { t: 'sin_datos' };
    else if (d.firme === false) e = { t: 'omitida' };
    else if (entre(d.fecha, hoy) > VIGENCIA) e = { t: 'no_hecha' };
    else e = { t: 'pendiente' };
    porDia.set(d.fecha, e);
  }
  // 3. Una pendiente deja de serlo si la misma sesión se hizo después o toca hoy o mañana.
  const pendientes = [];
  for (const d of dias) {
    if (porDia.get(d.fecha).t !== 'pendiente') continue;
    const misma = dias.find(x => x.fecha > d.fecha && mismaSesion(x.foco) === mismaSesion(d.foco) && (hecha.has(x.fecha) || x.fecha <= sumar(hoy, 1)));
    if (misma) porDia.set(d.fecha, { t: 'reemplazada', por: misma.fecha });
    else pendientes.push(d);
  }
  const deHoy = regs.filter(s => s.fecha === hoy);
  const de = [...hecha.entries()].find(([, s]) => s.fecha === hoy)?.[0] ?? null;
  return { porDia, pendientes, hoy: { sesiones: deHoy, de }, conocido };
}
