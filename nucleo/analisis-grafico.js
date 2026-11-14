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

/**
 * Curva suave que pasa por cada punto sin inventar picos ni valles: monótona por tramos (Fritsch y Carlson), así
 * entre dos sesiones la línea nunca sube más que la mayor ni baja más que la menor. Con dos puntos, una recta.
 * @param pts [[x, y]] ordenados por x
 * @returns el atributo d de un path de SVG ('' sin puntos)
 */
export function curvaSuave(pts) {
  const f = v => (Math.round(v * 10) / 10).toString();
  if (!pts.length) return '';
  if (pts.length === 1) return `M${f(pts[0][0])},${f(pts[0][1])}`;
  if (pts.length === 2) return `M${f(pts[0][0])},${f(pts[0][1])}L${f(pts[1][0])},${f(pts[1][1])}`;
  const n = pts.length, d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / ((pts[i + 1][0] - pts[i][0]) || 1));
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (!d[i]) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  let s = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], dx = (x1 - x0) / 3;
    s += `C${f(x0 + dx)},${f(y0 + m[i] * dx)} ${f(x1 - dx)},${f(y1 - m[i + 1] * dx)} ${f(x1)},${f(y1)}`;
  }
  return s;
}
