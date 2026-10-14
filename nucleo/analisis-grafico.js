// Lo que el gráfico de un ejercicio dice además de la línea (más que Hevy): el mejor punto del período (récord), la
// tendencia (recta de mínimos cuadrados, para que una sesión rara no la cambie) y cuánto cambió cada punto contra la
// sesión anterior y contra el inicio del período. Funciona con cualquier medida; `mejorBaja` para la ayuda de los
// asistidos, donde bajar es progresar.

const dias = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

/**
 * @param puntos [{fecha, valor}] de la más antigua a la más nueva
 * @returns {{mejor, tendencia: {desde, hasta, porSemana} | null, cambios: [{anterior, inicio}]}}
 *   mejor: índice del récord del período (el primero si empatan); tendencia: valor de la recta en el primer y el
 *   último día, con 3 o más puntos en al menos 14 días; cambios[i]: diferencia con el punto anterior y con el primero.
 */
export function analisisSerie(puntos, { mejorBaja = false } = {}) {
  if (!puntos.length) return { mejor: -1, tendencia: null, cambios: [] };
  let mejor = 0;
  puntos.forEach((p, i) => { if (mejorBaja ? p.valor < puntos[mejor].valor : p.valor > puntos[mejor].valor) mejor = i; });
  const cambios = puntos.map((p, i) => ({ anterior: i ? p.valor - puntos[i - 1].valor : null, inicio: i ? p.valor - puntos[0].valor : null }));
  let tendencia = null;
  const largo = dias(puntos[0].fecha, puntos.at(-1).fecha);
  if (puntos.length >= 3 && largo >= 14) {
    const xs = puntos.map(p => dias(puntos[0].fecha, p.fecha)), ys = puntos.map(p => p.valor);
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0);
    const m = sxx ? xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx : 0;
    const b = my - m * mx;
    tendencia = { desde: b, hasta: b + m * largo, porSemana: m * 7 };
  }
  return { mejor, tendencia, cambios };
}
