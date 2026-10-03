// Calculadora de discos, como la de Hevy: cuánto poner a cada lado de la barra para un peso, según el peso de la barra
// y los discos que hay. Se cargan primero los más pesados (así se usan menos discos). Si con esos discos no se llega
// justo, dice a cuánto se llega y cuánto falta.

export const DISCOS_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];
export const DISCOS_LB = [45, 35, 25, 10, 5, 2.5];
export const BARRAS_KG = [20, 15, 12.5, 10];
export const BARRAS_LB = [45, 35, 25];
const r2 = x => Math.round(x * 100) / 100;

/** Los discos del gimnasio: los estándar desde el más chico que hay (cuestionario: incremento_minimo_kg). */
export function discosDisponibles(minimo, unidad = 'kg') {
  if (unidad === 'lb') return DISCOS_LB;
  const m = Number(minimo) || 1.25;
  return DISCOS_KG.filter(d => d >= m - 1e-9);
}

/**
 * @param total peso total en la barra (en la unidad de los discos)
 * @returns {{barra, porLado: [{peso, n}], lograble, falta} | null}
 *   falta: lo que no se alcanza a armar (0 si sale justo); negativo si el peso es menor que la barra sola.
 */
export function discosPorLado(total, { barra = 20, discos = DISCOS_KG } = {}) {
  if (!(Number(total) > 0)) return null;
  if (total < barra) return { barra, porLado: [], lograble: barra, falta: r2(total - barra) };
  let resto = (total - barra) / 2;
  const porLado = [];
  for (const d of [...discos].sort((a, b) => b - a)) {
    const n = Math.floor((resto + 1e-9) / d);
    if (n) { porLado.push({ peso: d, n }); resto -= n * d; }
  }
  const lograble = r2(barra + 2 * porLado.reduce((a, x) => a + x.peso * x.n, 0));
  return { barra, porLado, lograble, falta: r2(total - lograble) };
}
