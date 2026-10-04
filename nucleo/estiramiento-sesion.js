// Estiramiento de cierre según los ejercicios de la sesión, para las sesiones que no lo traen (las armadas desde cero y
// las del motor del plan). Es opcional y corto: estirar después de entrenar ayuda a mantener la movilidad, pero no evita
// el dolor muscular de los días siguientes (Herbert, de Noronha y Kamper, Cochrane 2011). Cada paso dura 30 s por lado,
// dentro de los 10 a 30 s que recomienda el ACSM para mantener un estiramiento. Los nombres coinciden con las
// animaciones de nucleo/animaciones.js y con los cronómetros de nucleo/calentamiento.js.
import { zonasDeSesion } from './calentamiento-sesion.js';

const PASOS = [
  { clave: 'est:pectoral', name: 'Pectoral en el marco de la puerta, 30 s por lado', zona: 'torso', patrones: ['empuje_horizontal', 'pecho_aislado', 'empuje_vertical'], articulaciones: ['hombro'],
    how: 'Apoya el antebrazo en el marco con el codo a la altura del hombro. Avanza el cuerpo hasta sentir el pecho, sin dolor.' },
  { clave: 'est:biceps', name: 'Bíceps y antebrazo en la pared, 30 s por lado', zona: 'torso', patrones: ['tiron_horizontal', 'tiron_vertical', 'biceps'], articulaciones: ['hombro', 'codo', 'muneca'],
    how: 'Apoya la palma en la pared detrás de ti, con el brazo estirado. Gira el pecho hacia el otro lado hasta sentir el brazo.' },
  { clave: 'est:triceps', name: 'Tríceps sobre la cabeza, 30 s por lado', zona: 'torso', patrones: ['empuje_vertical', 'empuje_horizontal', 'triceps'], articulaciones: ['hombro', 'codo'],
    how: 'Lleva una mano detrás de la nuca y, con la otra, empuja suave el codo hacia atrás.' },
  { clave: 'est:cuadriceps', name: 'Cuádriceps de pie, 30 s por lado', zona: 'pierna', patrones: ['sentadilla', 'unilateral_pierna', 'extension_rodilla'], articulaciones: ['rodilla'],
    how: 'Toma el tobillo y lleva el talón hacia el glúteo, con las rodillas juntas. Apóyate en algo si pierdes el equilibrio.' },
  { clave: 'est:isquiotibiales', name: 'Isquiotibiales acostado con banda o toalla, 30 s por lado', zona: 'pierna', patrones: ['bisagra', 'flexion_rodilla'], articulaciones: ['cadera'],
    how: 'Boca arriba, pasa una banda o una toalla por la planta y sube la pierna estirada hasta sentir la parte de atrás del muslo.' },
  { clave: 'est:gluteo', name: 'Glúteo en figura 4 acostado, 30 s por lado', zona: 'pierna', patrones: ['extension_cadera', 'sentadilla', 'bisagra', 'abduccion'], articulaciones: ['cadera', 'rodilla'],
    how: 'Boca arriba, cruza un tobillo sobre la rodilla contraria y lleva las dos piernas hacia el pecho.' },
  { clave: 'est:flexor', name: 'Flexor de cadera en estocada, 30 s por lado', zona: 'pierna', patrones: ['sentadilla', 'unilateral_pierna', 'extension_cadera'], articulaciones: ['rodilla', 'cadera', 'lumbar'],
    how: 'Rodilla de atrás en el suelo, sobre algo blando. Aprieta el glúteo y avanza la cadera sin arquear la espalda.' },
  { clave: 'est:pantorrilla', name: 'Pantorrilla en la pared, 30 s por lado', zona: 'pierna', patrones: ['pantorrilla', 'unilateral_pierna'], articulaciones: ['tobillo'],
    how: 'Manos en la pared, la pierna de atrás estirada y el talón en el suelo. Inclínate hacia la pared.' },
  { clave: 'est:aductores', name: 'Aductores en mariposa, 30 s', zona: 'pierna', patrones: ['aduccion'], articulaciones: ['cadera', 'rodilla'],
    how: 'Sentado, junta las plantas de los pies. Inclina el tronco adelante con la espalda larga.' },
];
export const MAXIMO_PASOS = 5;

/**
 * Pasos de estiramiento para los ejercicios de hoy: solo de las zonas que la sesión trabaja de verdad (zonasDeSesion),
 * los que corresponden a sus movimientos, sin cargar una articulación bloqueada, y como mucho MAXIMO_PASOS (el orden de
 * PASOS reparte torso y piernas). [] si la sesión no trabaja torso ni piernas.
 */
export function estiramientoDeSesion({ dia, porId, bloqueadas = new Set() }) {
  const ejercicios = (dia?.ejercicios || []).map(e => ({ e, ej: porId.get(e.ejercicio_id) })).filter(x => x.ej && x.ej.tipo !== 'cardio');
  const zonas = zonasDeSesion(ejercicios);
  const patrones = new Set(ejercicios.map(x => x.ej.patron));
  const sirve = p => zonas[p.zona] && p.patrones.some(x => patrones.has(x)) && !p.articulaciones.some(z => bloqueadas.has(z));
  const elegidos = PASOS.filter(sirve);
  // Con torso y piernas, se alternan para que ninguna zona se quede sin pasos al cortar en MAXIMO_PASOS.
  const torso = elegidos.filter(p => p.zona === 'torso'), pierna = elegidos.filter(p => p.zona === 'pierna');
  const mezcla = [];
  for (let i = 0; mezcla.length < elegidos.length; i++) { if (torso[i]) mezcla.push(torso[i]); if (pierna[i]) mezcla.push(pierna[i]); }
  return mezcla.slice(0, MAXIMO_PASOS).map(({ clave, name, how }) => ({ clave, name, how, seg_estimados: 65, origen: 'estiramiento-v1' }));
}
