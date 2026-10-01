// Registro de series del día, como en Hevy: tipo de cada serie (calentamiento, normal, al fallo, drop set), su
// numeración, cuántas filas tiene cada ejercicio, lo que se hizo la vez anterior y las cifras de la sesión.
// Lo usa la vista Hoy; el check-in semanal y el historial usan esDeTrabajo para no contar lo que no corresponde.

export const TIPOS_SERIE = {
  calentamiento: {
    letra: 'C', nombre: 'Calentamiento',
    ayuda: 'Series livianas antes de las de trabajo, para preparar el movimiento y las articulaciones. No cuentan para subir la carga ni para el volumen.',
  },
  normal: {
    letra: null, nombre: 'Normal',
    ayuda: 'Serie de trabajo con el peso y la reserva que pide el plan. Se numeran solas (1, 2, 3…) y son las que la app usa para decidir cuánto subir.',
  },
  fallo: {
    letra: 'F', nombre: 'Al fallo',
    ayuda: 'Serie hasta que no sale otra repetición con buena técnica (sin reserva, RPE 10). Úsala con moderación: en los ejercicios grandes no da más resultado y cansa más.',
  },
  drop: {
    letra: 'D', nombre: 'Drop set',
    ayuda: 'Justo después de una serie bajas el peso (un 20 a 30%) y sigues sin descansar. Suma volumen en poco tiempo, sobre todo en ejercicios aislados. No cuenta para subir la carga.',
  },
};

/** Tipo de una serie anotada. Las anotadas antes de que existieran los tipos usan la marca de fallo. */
export const tipoDe = s => (s?.tipo && TIPOS_SERIE[s.tipo] ? s.tipo : s?.fallo ? 'fallo' : 'normal');

/** Si cuenta para progresar y para el volumen: las normales y al fallo (no el calentamiento ni el drop set). */
export const esDeTrabajo = s => !['calentamiento', 'drop'].includes(tipoDe(s));

/** Lo mismo para una serie guardada (tabla series, o importada de Hevy), que trae tipo 'efectiva', 'fallo'… */
export const esDeTrabajoGuardada = s => !['calentamiento', 'drop', 'descarga'].includes(s?.tipo);

/** Tipo con el que se guarda en la tabla series. */
export const tipoParaGuardar = s => ({ calentamiento: 'calentamiento', drop: 'drop', fallo: 'fallo' }[tipoDe(s)] || 'efectiva');

/** Etiqueta de cada fila: C, F, D, o el número de las normales (1, 2, 3…), como en Hevy. */
export function etiquetas(filas) {
  let n = 0;
  return filas.map(s => { const t = tipoDe(s); return t === 'normal' ? String(++n) : TIPOS_SERIE[t].letra; });
}

/** Cuántas filas tiene un ejercicio hoy: las que dejó la persona al agregar o quitar, o las del plan. */
export const cuantasFilas = (e, lista = [], guardadas = null) => guardadas ?? Math.max(e.series, lista.length);

/**
 * Lo que hizo la última vez en un ejercicio, antes de `fecha`: sus series de trabajo, en orden.
 * @param series series anotadas de cualquier día [{fecha, ejercicio_id, carga_kg, reps, rpe}] (semanal.seriesAnotadas)
 * @returns {{fecha, series}} o null
 */
export function anterior(series, ejercicioId, fecha) {
  const previas = series.filter(s => s.ejercicio_id === ejercicioId && s.fecha < fecha);
  if (!previas.length) return null;
  const ultima = previas.reduce((a, s) => (s.fecha > a ? s.fecha : a), '');
  return { fecha: ultima, series: previas.filter(s => s.fecha === ultima) };
}

/**
 * Cifras de la sesión en curso: series de trabajo hechas, volumen (kilos × repeticiones) y minutos desde la
 * primera serie marcada.
 * @param filas todas las filas del día [{kg, reps, hecho, tipo, t}]
 */
export function cifras(filas, ahoraMs = Date.now()) {
  const hechas = filas.filter(s => s?.hecho);
  const trabajo = hechas.filter(esDeTrabajo);
  const volumen = hechas.filter(s => tipoDe(s) !== 'calentamiento').reduce((a, s) => a + (Number(s.kg) || 0) * (Number(s.reps) || 0), 0);
  const inicio = Math.min(...hechas.map(s => s.t).filter(Boolean));
  return { series: trabajo.length, volumen: Math.round(volumen), minutos: Number.isFinite(inicio) ? Math.max(0, Math.round((ahoraMs - inicio) / 6e4)) : null };
}
