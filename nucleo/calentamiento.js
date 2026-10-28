// Calentamiento y cronómetros por tramos, como en el tablero, y series de calentamiento con su peso, como la
// calculadora de Hevy. Funciones puras: la pantalla Hoy las usa para dibujar y para el cronómetro.
import { esAsistido, conLastre, sinCargaExterna } from './catalogo.js';

/** Tramos de un paso que va por tiempo ("5 minutos", "5 a 6 min", "30 s por lado", "3 × 45 s"); [] si va por
 *  repeticiones ("2 × 15", "10 por lado"). Solo se mira el nombre del paso: la explicación puede nombrar otros tiempos. */
export const CAMBIO_DE_LADO_SEG = 5;

/** Un paso por lado: el primer lado, unos segundos para cambiar de postura y el segundo lado. */
const porLados = (etiqueta, seg) => [
  { seg, texto: `${etiqueta} · primer lado` },
  { seg: CAMBIO_DE_LADO_SEG, texto: 'Cambia de lado', cambio: true },
  { seg, texto: `${etiqueta} · segundo lado` },
];

/** segEstimados: lo que dura el paso completo. Con repeticiones por lado ("8 por lado") se reparte entre los lados. */
export function tramosDePaso(nombre, segEstimados = null) {
  const t = String(nombre || '').toLowerCase();
  const etiqueta = String(nombre).split(',')[0].trim();
  const m = t.match(/(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)(?:\s*(?:a|-)\s*\d+(?:[.,]\d+)?)?\s*(minutos?|min|segundos?|seg|s)(?![a-zñáéíóú])/);
  if (!m || /\bpausa\b/.test(t.slice(0, m.index))) {
    return /por lado/.test(t) && segEstimados > 0 ? porLados(etiqueta, Math.max(10, Math.round((segEstimados - CAMBIO_DE_LADO_SEG) / 10) * 5)) : [];
  }
  const valor = Number(m[2].replace(',', '.'));
  const seg = Math.round(/^m/.test(m[3]) ? valor * 60 : valor);
  if (!seg) return [];
  if (/por lado/.test(t)) return porLados(etiqueta, seg);
  const veces = m[1] ? Number(m[1]) : 1;
  return Array.from({ length: veces }, (_, i) => ({ seg, texto: veces > 1 ? `${etiqueta} · ${i + 1} de ${veces}` : etiqueta }));
}

/** Tramos del cardio: intervalos ("6 × 1 minuto fuerte y 1 minuto suave"), tramos por intensidad ("2 minutos a RPE 3
 *  · 8 minutos a RPE 5") o un tiempo ("Escaleras 15 a 20 minutos": el mínimo). [] si no dice cuánto dura. */
export function tramosDeCardio(texto) {
  const t = String(texto || '');
  const iv = t.match(/(\d+)\s*[x×]\s*(\d+)\s*minutos?\s+fuerte\s+y\s+(\d+)\s*minutos?\s+suave/i);
  if (iv) return Array.from({ length: Number(iv[1]) }, (_, i) => [
    { seg: Number(iv[2]) * 60, texto: `Fuerte · ${i + 1} de ${iv[1]}` },
    { seg: Number(iv[3]) * 60, texto: `Suave · ${i + 1} de ${iv[1]}` },
  ]).flat();
  const partes = [...t.matchAll(/(\d+)\s*(?:minutos?|min)\s+a\s+RPE\s+(\d+(?:\s*a\s*\d+)?)/gi)];
  if (partes.length > 1) return partes.map(p => ({ seg: Number(p[1]) * 60, texto: `Cardio · RPE ${p[2]}`, rpe: p[2] }));
  const uno = t.match(/(\d+)(?:\s*a\s*\d+)?\s*(?:minutos?|min)\b/i);
  return uno ? [{ seg: Number(uno[1]) * 60, texto: 'Cardio' }] : [];
}

/**
 * Series de calentamiento antes de las de trabajo, con su peso: la mitad y tres cuartos del peso de trabajo, y con
 * cargas altas (60 kg o más) una tercera al 85%. Se redondea a lo que permite el equipo (con barra, nunca menos que la
 * barra sola). Sin peso de trabajo conocido, una serie de calentamiento vacía.
 * @param kgTrabajo   peso de la primera serie de trabajo (escrito hoy, del plan o de la vez anterior)
 * @param incremento  lo mínimo que se puede subir con ese equipo (motor-plan.incrementoPara)
 * @param barra       peso de la barra sola, si el ejercicio usa barra
 * @param modo        'corporal' o 'asistido' (modoCalentamiento): sin una carga que subir de a poco, calentamientoCorporal
 * @param repsMin     repeticiones mínimas de las series de trabajo (las usa el modo corporal)
 */
/** Esquemas de la calculadora de calentamiento (como la de Hevy): [porcentaje del peso de trabajo, repeticiones]. */
export const ESQUEMAS_CALENTAMIENTO = {
  auto: null, // el de siempre: 2 o 3 series según el peso
  corto: [[0.5, 10], [0.75, 5]],
  largo: [[0.4, 10], [0.6, 6], [0.8, 3], [0.9, 1]],
  uno: [[0.6, 8]],
};
export function seriesDeCalentamiento(kgTrabajo, { incremento = 2.5, barra = 0, esquema = 'auto', modo = null, repsMin = null } = {}) {
  if (modo) return calentamientoCorporal(kgTrabajo, { modo, repsMin, incremento });
  if (!(kgTrabajo > 0)) return [{ tipo: 'calentamiento' }];
  const pasos = ESQUEMAS_CALENTAMIENTO[esquema] || (kgTrabajo >= 60 ? [[0.5, 8], [0.75, 5], [0.85, 2]] : [[0.5, 10], [0.75, 5]]);
  const redondo = x => Math.max(barra, Math.round(x / incremento) * incremento);
  const out = [];
  for (const [p, reps] of pasos) {
    const kg = Math.round(redondo(kgTrabajo * p) * 100) / 100;
    if (kg > 0 && kg < kgTrabajo && kg !== out.at(-1)?.kg) out.push({ tipo: 'calentamiento', kg, reps });
  }
  return out.length ? out : [{ tipo: 'calentamiento' }];
}

/** Cómo se calienta un ejercicio: con su peso (null), con el cuerpo ('corporal', también con lastre) o con la ayuda de
 *  la máquina ('asistido'). */
export const modoCalentamiento = ej => (esAsistido(ej) ? 'asistido' : conLastre(ej) || sinCargaExterna(ej) ? 'corporal' : null);

/**
 * Calentamiento con el cuerpo (dominadas, fondos), donde "la mitad del peso" no existe: una serie con la mitad de las
 * repeticiones mínimas, lejos del fallo (para 8 a 12 dominadas, 4 fáciles). Con lastre, después otra con la mitad del
 * lastre. En los asistidos el peso es ayuda: va con más ayuda que la de trabajo, porque menos ayuda es más difícil.
 * Antes salía una fila C vacía, sin peso ni repeticiones (Francisco, 28 de octubre de 2026: "poco claro").
 */
export function calentamientoCorporal(kgTrabajo, { modo = 'corporal', repsMin = null, incremento = 2.5 } = {}) {
  const reps = Math.max(2, Math.min(6, Math.round((Number(repsMin) || 8) / 2)));
  const redondo = x => Math.round(Math.round(x / incremento) * incremento * 100) / 100;
  if (modo === 'asistido') return [{ tipo: 'calentamiento', ...(kgTrabajo > 0 ? { kg: redondo(kgTrabajo + Math.max(incremento, kgTrabajo / 2)) } : {}), reps }];
  const out = [{ tipo: 'calentamiento', reps }];
  const mitad = kgTrabajo > 0 ? redondo(kgTrabajo / 2) : 0;
  if (mitad > 0 && mitad < kgTrabajo) out.push({ tipo: 'calentamiento', kg: mitad, reps: Math.max(2, Math.round(reps / 2)) });
  return out;
}

/** Cómo se hace la serie de calentamiento con el cuerpo, en palabras: "4 repeticiones fáciles, lejos del fallo". */
export function textoCalentamientoCorporal(series, modo) {
  const [a, b] = series, kg = x => `${String(x).replace('.', ',')} kg`;
  const primera = modo === 'asistido'
    ? `${a.reps} repeticiones fáciles con más ayuda que en tus series de trabajo${a.kg ? ` (${kg(a.kg)})` : ''}: menos ayuda es más difícil`
    : `${a.reps} repeticiones fáciles, sin lastre y lejos del fallo`;
  return `${primera}${b ? `; después ${b.reps} con ${kg(b.kg)} de lastre` : ''}. Descansa 1 a 2 minutos antes de la primera serie de trabajo. No cuenta${b ? 'n' : ''} como trabajo.`;
}

/**
 * Descanso después de una serie de calentamiento: variable, como se calienta de verdad. Entre calentamientos livianos,
 * corto y creciente (30 s, 45 s, 1 min); después del último, más largo porque sigue la primera serie de trabajo
 * (60 % del descanso del ejercicio, entre 1 y 2 min). Con el descanso apagado, 0.
 * @param j posición del calentamiento (0 el primero), n cuántos hay, trabajo el descanso de las series de trabajo
 */
export function descansoCalentamiento(j, n, trabajo) {
  if (!trabajo) return 0;
  if (j < n - 1) return Math.min(60, 30 + 15 * j);
  return Math.max(60, Math.min(120, Math.round((trabajo * 0.6) / 15) * 15));
}
/** "30 s a 1 min 30 s": lo que dura el descanso de los calentamientos de un ejercicio, para mostrarlo. */
export const rangoDescansoCalentamiento = (n, trabajo) => {
  const xs = Array.from({ length: n }, (_, j) => descansoCalentamiento(j, n, trabajo));
  return xs.length ? [Math.min(...xs), Math.max(...xs)] : null;
};
