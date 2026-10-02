// Calentamiento y cronómetros por tramos, como en el tablero, y series de calentamiento con su peso, como la
// calculadora de Hevy. Funciones puras: la pantalla Hoy las usa para dibujar y para el cronómetro.

/** Tramos de un paso que va por tiempo ("5 minutos", "5 a 6 min", "30 s por lado", "3 × 45 s"); [] si va por
 *  repeticiones ("2 × 15", "10 por lado"). Solo se mira el nombre del paso: la explicación puede nombrar otros tiempos. */
export function tramosDePaso(nombre) {
  const t = String(nombre || '').toLowerCase();
  const m = t.match(/(?:(\d+)\s*[x×]\s*)?(\d+(?:[.,]\d+)?)(?:\s*a\s*\d+(?:[.,]\d+)?)?\s*(minutos?|min|segundos?|seg|s)(?![a-zñáéíóú])/);
  if (!m) return [];
  const valor = Number(m[2].replace(',', '.'));
  const seg = Math.round(/^m/.test(m[3]) ? valor * 60 : valor);
  if (!seg) return [];
  const etiqueta = String(nombre).split(',')[0].trim();
  if (/por lado/.test(t)) return [1, 2].map(i => ({ seg, texto: `${etiqueta} · lado ${i}` }));
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
 */
export function seriesDeCalentamiento(kgTrabajo, { incremento = 2.5, barra = 0 } = {}) {
  if (!(kgTrabajo > 0)) return [{ tipo: 'calentamiento' }];
  const pasos = kgTrabajo >= 60 ? [[0.5, 8], [0.75, 5], [0.85, 2]] : [[0.5, 10], [0.75, 5]];
  const redondo = x => Math.max(barra, Math.round(x / incremento) * incremento);
  const out = [];
  for (const [p, reps] of pasos) {
    const kg = Math.round(redondo(kgTrabajo * p) * 100) / 100;
    if (kg > 0 && kg < kgTrabajo && kg !== out.at(-1)?.kg) out.push({ tipo: 'calentamiento', kg, reps });
  }
  return out.length ? out : [{ tipo: 'calentamiento' }];
}
