// Medidas del cuerpo, como Hevy: peso, porcentaje de grasa y perímetros, con su gráfico. Son datos de salud: solo se
// guardan con permiso, quedan en el teléfono y nunca van en tablas, resúmenes para compartir ni textos para la IA.

/** [campo, nombre, unidad, mínimo, máximo] */
export const CAMPOS_MEDIDA = [
  ['peso_kg', 'Peso', 'kg', 30, 300],
  ['grasa_pct', 'Grasa', '%', 3, 70],
  ['cintura_cm', 'Cintura', 'cm', 40, 200],
  ['cadera_cm', 'Cadera', 'cm', 50, 200],
  ['pecho_cm', 'Pecho', 'cm', 50, 200],
  ['brazo_cm', 'Brazo', 'cm', 15, 70],
  ['muslo_cm', 'Muslo', 'cm', 25, 110],
  ['pantorrilla_cm', 'Pantorrilla', 'cm', 20, 70],
  ['cuello_cm', 'Cuello', 'cm', 20, 70],
];

/**
 * Una medición nueva: solo los campos escritos y dentro de rangos posibles.
 * @returns {{medida} | {error}}
 */
export function nuevaMedida(datos, hoy) {
  const fecha = datos.fecha || hoy;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha > hoy) return { error: 'Elige una fecha de hoy hacia atrás.' };
  const medida = { fecha };
  for (const [campo, nombre, unidad, min, max] of CAMPOS_MEDIDA) {
    const v = datos[campo];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) return { error: `${nombre}: escribe un número entre ${min} y ${max} ${unidad}.` };
    medida[campo] = Math.round(n * 10) / 10;
  }
  if (Object.keys(medida).length === 1) return { error: 'Escribe al menos una medida.' };
  return { medida };
}

/** Agrega una medición: si ya había una ese día, se juntan (lo nuevo manda). Queda ordenado por fecha. */
export function agregarMedida(lista = [], m) {
  const antes = lista.find(x => x.fecha === m.fecha);
  return [...lista.filter(x => x.fecha !== m.fecha), { ...antes, ...m }].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Los campos que tienen al menos un dato, en el orden de CAMPOS_MEDIDA. */
export const camposConDatos = lista => CAMPOS_MEDIDA.filter(([c]) => lista.some(m => m[c] != null)).map(([c]) => c);

/** Cambio de un campo entre la medición más antigua y la más nueva de los últimos `dias` (o null si hay una sola). */
export function cambioMedida(lista, campo, hoy, dias = 30) {
  const desde = new Date(Date.parse(hoy + 'T12:00:00Z') - dias * 864e5).toISOString().slice(0, 10);
  const xs = lista.filter(m => m[campo] != null && m.fecha >= desde && m.fecha <= hoy);
  if (xs.length < 2) return null;
  return { desde: xs[0][campo], hasta: xs.at(-1)[campo], cambio: Math.round((xs.at(-1)[campo] - xs[0][campo]) * 10) / 10, fechaDesde: xs[0].fecha };
}
