// Las capas para celebrar de cada asistente (docs/23-animaciones-claude.md, recursos del 4 de octubre): el cuerpo sin
// el brazo levantado y ese brazo aparte, de 320 × 320, con el punto de giro del hombro en píxeles. Copiado de
// app/img/asistentes/<id>/animacion/brazo.json (nucleo/asistente-capas.test.js comprueba que coincidan). En los ocho el
// brazo queda a la izquierda del hombro: girar a la derecha (grados positivos) sube el puño.
export const HOMBROS = Object.freeze({
  coach: [148, 94], entrenador: [159, 95], entrenadora: [151, 120], mancuerna: [114, 115],
  pesa: [117, 132], profe: [162, 104], quiltro: [142, 115], robot: [116, 145],
});

/** Las capas de un asistente si están en el teléfono (disponibles: las rutas de app/img/disponibles.json); si no, null. */
export function capasAsistente(id, disponibles) {
  const hombro = HOMBROS[id];
  const cuerpo = `img/asistentes/${id}/animacion/cuerpo.webp`, brazo = `img/asistentes/${id}/animacion/brazo.webp`;
  if (!hombro || !disponibles?.has?.(cuerpo) || !disponibles.has(brazo)) return null;
  const pct = v => `${Math.round((v / 320) * 10000) / 100}%`;
  return { cuerpo, brazo, origen: `${pct(hombro[0])} ${pct(hombro[1])}` };
}

/** El golpe de puño: sube, baja un poco, vuelve a subir y queda como estaba (cuadros para Web Animations, con el tiempo
 *  parejo: cada tramo lleva su propia suavidad). */
const T = 'ease-in-out';
export const GOLPE_PUNO = Object.freeze([
  { rotate: '0deg', easing: T }, { rotate: '11deg', offset: 0.3, easing: T }, { rotate: '-4deg', offset: 0.6, easing: T }, { rotate: '5deg', offset: 0.8, easing: T }, { rotate: '0deg' },
]);
