// Esfuerzo de cada serie, como en Hevy: se anota en RPE (por defecto) o en RIR, según la preferencia de la persona
// (Más, Unidades). Se guardan los dos (rpe y rir = 10 − rpe), así el resto de la app no cambia. Con medios puntos:
// RPE 8,5 es "quizás salían 2 más".

/** La escala de RPE de Hevy: de 6 (o menos) a 10, con medios desde 7. */
export const ESCALA_RPE = [6, 7, 7.5, 8, 8.5, 9, 9.5, 10];
// Qué significa cada valor: [cómo se sintió, cuántas repeticiones quedaban].
const SIGNIFICADO = {
  10: ['Esfuerzo máximo', 'No salía ninguna repetición más'], 9.5: ['Casi al máximo', 'Quizás salía 1 más'], 9: ['Muy difícil', 'Salía 1 más'],
  8.5: ['Muy difícil', 'Quizás salían 2 más'], 8: ['Difícil', 'Salían 2 más'], 7.5: ['Difícil', 'Quizás salían 3 más'],
  7: ['Moderado', 'Salían 3 más'], 6: ['Liviano', 'Salían 4 o más'],
};

/** La preferencia: 'rpe' salvo que la persona elija 'rir'. */
export const modoEsfuerzo = respuestas => (respuestas?.escala_esfuerzo === 'rir' ? 'rir' : 'rpe');
/** Los valores que se eligen, de más fácil a más difícil (en RIR: 4 o más, 3, 2,5… 0). */
export const escalaDe = modo => (modo === 'rir' ? ESCALA_RPE.map(r => 10 - r) : ESCALA_RPE);
/** Pasa un valor de la escala elegida a RPE y al revés. */
export const aRpe = (valor, modo) => (valor == null ? null : modo === 'rir' ? 10 - valor : valor);
export const deRpe = (rpe, modo) => (rpe == null ? null : modo === 'rir' ? 10 - rpe : rpe);
/** El RPE de una serie anotada (de su RPE o de su RIR). */
export const rpeDeSerie = s => (s?.rpe != null ? Number(s.rpe) : s?.rir != null ? 10 - Number(s.rir) : null);
/** Cómo se escribe: con coma, y "4+" para RIR 4 (4 o más). */
export function textoEsfuerzo(valor, modo) {
  if (valor == null || !Number.isFinite(Number(valor))) return '';
  if (modo === 'rir' && Number(valor) === 4) return '4+';
  return String(valor).replace('.', ',');
}
/** Qué significa un RPE: el valor de la escala más cercano (bajo 6 cuenta como 6). */
export function significado(rpe) {
  if (rpe == null) return null;
  const cercano = ESCALA_RPE.reduce((a, b) => (Math.abs(b - rpe) < Math.abs(a - rpe) ? b : a));
  const [titulo, detalle] = SIGNIFICADO[cercano];
  return { titulo, detalle };
}
