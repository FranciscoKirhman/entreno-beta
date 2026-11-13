// Los ejercicios que nombra un texto del coach (su respuesta a una nota, el comentario de la sesión, el chat), para
// mostrar su imagen debajo: "cámbialo por remo sentado en máquina" se entiende antes con el dibujo al lado.
// Solo nombres completos del catálogo (nombre, nombre de Hevy y alias), sin adivinar: "el remo" a secas no cuenta.
import { normalizar } from './catalogo.js';

// Un nombre de una sola palabra ("remo", "dominadas") no dice cuál variante es: mostraría una imagen que no corresponde.
const sirve = clave => clave.includes(' ');

/**
 * @param texto  lo que escribió el coach (puede traer **negritas**)
 * @param indice el índice del catálogo (nucleo/catalogo.js, crearIndice)
 * @returns {string[]} ids de los ejercicios nombrados, en el orden en que aparecen, sin repetir (a lo más `max`)
 */
export function ejerciciosMencionados(texto, indice, { max = 4 } = {}) {
  const t = ` ${normalizar(texto)} `;
  if (t.length < 6 || !indice?.porNombre) return [];
  // Primero los nombres largos: "curl de biceps con mancuernas" gana a "curl de biceps".
  const claves = (indice.clavesPorLargo ||= [...indice.porNombre.keys()].filter(sirve).sort((a, b) => b.length - a.length));
  const tomado = new Uint8Array(t.length), vistos = [];
  for (const clave of claves) {
    const aguja = ` ${clave} `;
    for (let i = t.indexOf(aguja); i >= 0; i = t.indexOf(aguja, i + 1)) {
      const desde = i + 1, hasta = i + aguja.length - 1;
      if (tomado.subarray(desde, hasta).some(Boolean)) continue;
      tomado.fill(1, desde, hasta);
      vistos.push({ pos: desde, id: indice.porNombre.get(clave).id });
    }
  }
  const ids = [];
  for (const v of vistos.sort((a, b) => a.pos - b.pos)) if (!ids.includes(v.id)) ids.push(v.id);
  return ids.slice(0, max);
}
