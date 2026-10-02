// Mapa del cuerpo, de frente y de espalda, dibujado en código: se pueden marcar varios músculos a la vez y con más o
// menos intensidad (lo principal fuerte, lo secundario suave, o las series de la semana). Se ve igual en claro y oscuro.
import { NOMBRE_ZONA } from '../nucleo/motor-plan.js';

/** Nombre de cada músculo para leer ("glúteo", "zona lumbar"), y una lista con "y" al final. */
export const NOMBRE_MUSCULO = { ...NOMBRE_ZONA, erectores: 'zona lumbar', pantorrilla: 'pantorrilla', trapecio: 'trapecio', antebrazo: 'antebrazo' };
export const lista = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);

// Zonas: [músculo, figura ('f' frente, 'b' espalda), forma SVG]. Las dos mitades del cuerpo van por separado.
const ZONAS = [];
const espejo = (m, fig, forma) => { ZONAS.push([m, fig, forma(1)], [m, fig, forma(-1)]); };
const elipse = (cx, cy, rx, ry) => s => `<ellipse cx="${60 + s * (cx - 60)}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
const camino = puntos => s => `<path d="${puntos.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, x, y) => `${60 + s * (Number(x) - 60)},${y}`)}"/>`;

// Lo que no es músculo (silueta del tronco, cabeza, manos, rodillas, pies) se dibuja igual en las dos vistas. La
// silueta va primero, detrás de todo, para que los músculos se vean unidos en un cuerpo.
for (const fig of ['f', 'b']) {
  ZONAS.push([null, fig, '<path class="silueta" d="M44,39 C38,42 37,50 41,58 L44,96 L45,113 L75,113 L76,96 L79,58 C83,50 82,42 76,39 L64,34 L56,34 Z"/>']);
  ZONAS.push([null, fig, '<ellipse cx="60" cy="18" rx="10" ry="12"/>'], [null, fig, '<path d="M55,29 h10 v7 h-10z"/>']);
  espejo(null, fig, elipse(30, 105, 4, 4.5));
  espejo(null, fig, elipse(49.5, 160, 4.5, 4.5));
  espejo(null, fig, elipse(49.5, 206, 6, 3.5));
  espejo('antebrazo', fig, elipse(31, 89, 4.5, 11));
}
// Frente
espejo('trapecio', 'f', camino('M56,35 L45,40 L47,44 L57,40 Z'));
espejo('hombro', 'f', elipse(38, 48, 8, 9));
espejo('pecho', 'f', camino('M59,42 C51,41 44,44 44,51 C44,58 51,62 59,61 Z'));
espejo('biceps', 'f', elipse(34, 66, 5.5, 10));
ZONAS.push(['core', 'f', '<rect x="52" y="63" width="16" height="34" rx="5"/>']);
espejo('core', 'f', camino('M50,63 L45,66 L46,92 L50,97 Z'));
ZONAS.push([null, 'f', '<path d="M46,99 L74,99 L70,112 L50,112 Z"/>']);
espejo('cuadriceps', 'f', elipse(49, 135, 8, 21));
espejo('aductor_abductor', 'f', elipse(57, 124, 3.5, 12));
espejo('pantorrilla', 'f', elipse(49.5, 185, 5.5, 16));
// Espalda
ZONAS.push(['trapecio', 'b', '<path d="M60,31 L46,41 L60,58 L74,41 Z"/>']);
espejo('hombro', 'b', elipse(38, 48, 8, 9));
espejo('espalda', 'b', camino('M57,58 L45,52 C43,64 46,78 54,86 L57,83 Z'));
espejo('triceps', 'b', elipse(34, 66, 5.5, 10));
ZONAS.push(['erectores', 'b', '<rect x="55" y="84" width="10" height="16" rx="3"/>']);
espejo('aductor_abductor', 'b', elipse(44.5, 104, 4, 7));
espejo('gluteo', 'b', elipse(52, 110, 8, 9));
espejo('femoral', 'b', elipse(50, 138, 7.5, 19));
espejo('pantorrilla', 'b', elipse(50, 182, 6.5, 15));

/**
 * @param primarios   músculos que más trabaja (color fuerte)
 * @param secundarios músculos que ayudan (color suave)
 * @param intensidad  { músculo: 0 a 1 } para pintar por cantidad (por ejemplo, series de la semana)
 * @param vistas      'ambas', 'f' o 'b'
 */
export function mapaCuerpo({ primarios = [], secundarios = [], intensidad = null, vistas = 'ambas', titulo = '' } = {}) {
  const figs = vistas === 'ambas' ? ['f', 'b'] : [vistas];
  const nivel = m => {
    if (!m) return 'base';
    if (intensidad) { const v = intensidad[m] || 0; return v <= 0 ? 'base' : `i${Math.min(4, Math.max(1, Math.ceil(v * 4)))}`; }
    return primarios.includes(m) ? 'p' : secundarios.includes(m) ? 's' : 'base';
  };
  const grupos = figs.map((fig, i) => `<g transform="translate(${i * 125} 0)">${ZONAS.filter(z => z[1] === fig).map(([m, , forma]) => forma.replace(/^<(\w+)/, `<$1 class="z ${nivel(m)}"${m ? ` data-m="${m}"` : ''}`)).join('')}</g>`).join('');
  return `<svg class="mapa-cuerpo" viewBox="0 0 ${figs.length * 125 - 5} 214" role="img" aria-label="${titulo || 'Músculos marcados en el cuerpo'}">${grupos}</svg>`;
}

/** Qué vista conviene para una miniatura: la de espalda si lo principal está atrás. */
export const vistaPrincipal = primarios => (primarios.some(m => ['espalda', 'gluteo', 'femoral', 'triceps', 'erectores'].includes(m)) ? 'b' : 'f');
