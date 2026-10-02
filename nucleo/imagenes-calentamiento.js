// Ilustración del movimiento real, tanto para los pasos propios como para planes importados.
import { normalizar } from './catalogo.js';
const RUTAS = [
  [/circulos? de hombro/, 'circulos_hombro'],
  [/toracica/, 'rotacion_toracica'],
  [/deslizamiento.*pared|wall slide/, 'deslizamiento_pared'],
  [/omoplatos.*pared|plancha.*pared|serrato/, 'empuje_omoplatos_pared'],
  [/face pull.*banda/, 'face_pull_banda'],
  [/circulos? de cadera/, 'circulos_cadera'],
  [/90 90.*cadera/, 'cadera_90_90'],
  [/tobillo.*pared/, 'tobillo_pared'],
  [/bisagra.*pared/, 'bisagra_pared'],
  [/flexion.*codo/, 'flexion_codo_liviana'],
  [/rotacion externa.*banda/, 'rotacion_externa_banda'],
  [/activacion.*dorsal.*banda/, 'dorsal_banda'],
  [/dislocaciones.*banda|paso.*banda.*cabeza/, 'paso_banda'],
  [/colgar/, 'colgar_barra'],
  [/extension terminal.*rodilla/, 'extension_rodilla_banda'],
  [/muneca/, 'movilidad_muneca'],
  [/movilidad.*cuello/, 'movilidad_cuello'],
];
export function ilustracionesCalentamiento(paso, disponibles) {
  const nombre = normalizar(paso.name);
  const movimiento = RUTAS.find(([re]) => re.test(nombre));
  const rutas = [];
  if (movimiento) rutas.push({ src: `img/calentamiento/${movimiento[1]}.webp`, alt: `Posiciones de ${String(paso.name).split(',')[0].toLowerCase()}`, tipo: 'movimiento' });
  // Los pasos que combinan dos movimientos muestran ambos, sin sustituir uno por el otro.
  if (/dead bug/.test(nombre)) rutas.push({ src: 'img/ejercicios/dead_bug.webp', alt: 'Posiciones del dead bug', tipo: 'movimiento' });
  if (/bird dog/.test(nombre)) rutas.push({ src: 'img/ejercicios/bird_dog.webp', alt: 'Posiciones del bird dog', tipo: 'movimiento' });
  if (/puente.*gluteo/.test(nombre)) rutas.push({ src: 'img/ejercicios/puente_gluteo.webp', alt: 'Posiciones del puente de glúteo', tipo: 'movimiento' });
  const exactas = rutas.filter(x => disponibles.has(x.src));
  if (exactas.length) return exactas;
  // Aproximaciones y ensayos usan el dibujo completo de su ejercicio, con las dos posiciones.
  const original = paso.imagen?.replace('/mini/', '/');
  if (original && disponibles.has(original)) return [{ src: original, alt: /\/ejercicios\//.test(original) ? `Movimiento de ${String(paso.name).split(',')[0].toLowerCase()}` : 'Referencia del equipo o la zona del paso', tipo: /\/ejercicios\//.test(original) ? 'movimiento' : 'referencia' }];
  return [];
}
