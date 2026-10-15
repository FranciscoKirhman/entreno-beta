// Arreglos al historial que vino de Hevy, aplicados al abrir (app/comun.js). No borran nada y se pueden repetir:
// 1. Una serie sin ejercicio del catálogo se vuelve a reconocer por su nombre de Hevy (el catálogo crece, por ejemplo
//    "Pendlay Row (Barbell)" → remo_pendlay, que no existía al importar).
// 2. "Bulgarian Split Squat" sin implemento no viene de Hevy: lo dejó la migración desde el tablero original, que
//    quitaba "(Dumbbell)". En Hevy se llama "Bulgarian Split Squat (Dumbbell)" (revisado contra las exportaciones el
//    15 de octubre de 2026), así que vuelve a ese nombre y a bulgara_mancuernas: su progreso no queda partido en dos.
import { buscar } from './catalogo.js';

const BULGARA_SIN_IMPLEMENTO = 'Bulgarian Split Squat';

/** Corrige las series en el lugar. @returns cuántas series cambió */
export function corregirHistorial(sesiones, indice) {
  let cambios = 0;
  for (const s of Array.isArray(sesiones) ? sesiones : []) {
    if (!String(s?.origen || '').startsWith('hevy')) continue;
    for (const x of Array.isArray(s.series) ? s.series : []) {
      if (x.ejercicio_nombre === BULGARA_SIN_IMPLEMENTO && x.ejercicio_id === 'bulgara') {
        x.ejercicio_id = 'bulgara_mancuernas'; x.ejercicio_nombre = `${BULGARA_SIN_IMPLEMENTO} (Dumbbell)`; cambios++;
      } else if (!x.ejercicio_id && x.ejercicio_nombre) {
        const e = buscar(indice, x.ejercicio_nombre);
        if (e) { x.ejercicio_id = e.id; cambios++; }
      }
    }
  }
  return cambios;
}
