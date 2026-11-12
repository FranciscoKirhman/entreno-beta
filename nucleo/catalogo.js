// Búsqueda en el catálogo de ejercicios (contenido/ejercicios.json).
// La usan la importación desde Hevy, el motor de planes, el validador y las herramientas para la IA.
import { anotarCardio } from './modelo-tiempo.js';

/** "Bench Press — Barbell", "bench press (barbell)" y "Bench Press (Barbell)" quedan iguales. */
export function normalizar(nombre) {
  return String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(Boolean).join(' ');
}

// Hevy agrega estas palabras a algunas variantes ("Chest Fly — Machine, Spa"); no cambian el ejercicio.
const MODIFICADORES = new Set(['spa']);

export function crearIndice(catalogo) {
  const ejercicios = catalogo.ejercicios || catalogo;
  const porId = new Map();
  const porNombre = new Map();
  for (const e of ejercicios) {
    porId.set(e.id, e);
    for (const n of [e.nombre_hevy, e.nombre, ...(e.alias || [])].filter(Boolean)) { // sin nombre de Hevy (banco ampliado), se salta
      const clave = normalizar(n);
      if (porNombre.has(clave) && porNombre.get(clave).id !== e.id) {
        throw new Error(`"${n}" apunta a dos ejercicios: ${porNombre.get(clave).id} y ${e.id}`);
      }
      porNombre.set(clave, e);
    }
  }
  anotarCardio(ejercicios.filter(e => e.tipo === 'cardio').map(e => e.id)); // para el modelo de tiempo
  return { ejercicios, porId, porNombre };
}

/** Ejercicio del catálogo para un nombre de Hevy o de la app; null si no se reconoce. */
export function buscar(indice, nombre) {
  const n = normalizar(nombre);
  if (indice.porNombre.has(n)) return indice.porNombre.get(n);
  const sinModificadores = n.split(' ').filter(t => !MODIFICADORES.has(t)).join(' ');
  return indice.porNombre.get(sinModificadores) || null;
}

const NIVELES = ['principiante', 'intermedio', 'avanzado'];
/** En los asistidos el peso anotado es la ayuda de la máquina: progresar es bajarla y no cuenta como carga levantada. */
export const esAsistido = ej => ej?.asistido === true;
/** Con lastre, el peso anotado es lo que se agrega al cuerpo (la dirección es la de siempre). */
export const conLastre = ej => ej?.lastre === true;
// Equipo que no carga peso: con solo esto, el ejercicio es de peso corporal (o de lastre, si se agrega).
const SIN_CARGA = new Set(['banco', 'barra_dominadas', 'paralelas', 'bandas', 'escaladora', 'trotadora', 'rueda_abdominal', 'banco_predicador']);
/** De peso corporal: sin equipo que cargue peso ni ayuda de máquina. Ahí los kilos son opcionales. */
export const sinCargaExterna = ej => Boolean(ej) && !esAsistido(ej) && ej.equipamiento.every(q => SIN_CARGA.has(q));

/** El lastre sube de a 2,5 kg: un disco chico, una mancuerna liviana. */
export const PASO_LASTRE = 2.5;
// Ejercicios de peso corporal a los que se les suele sumar peso, y cómo. Los demás (asistidos, con bandas, casi todo el
// core, los isométricos) siguen con más repeticiones, más lentas o con pausa. Francisco, 5 de noviembre de 2026: "me ha
// ido bien en este ejercicio pero no me recomienda más peso" (dominadas escapulares de 15 y 20 repeticiones con reserva).
const COMO_LASTRE = {
  dominadas: 'con cinturón o una mancuerna entre los pies',
  dominadas_supinas: 'con cinturón o una mancuerna entre los pies',
  dominadas_escapulares: 'con cinturón o una mancuerna entre los pies',
  fondos: 'con cinturón o una mancuerna entre los pies',
  fondos_triceps: 'con cinturón o una mancuerna entre los pies',
  fondos_banco: 'con un disco sobre los muslos',
  flexiones: 'con un disco sobre la espalda',
  bulgara: 'con una mancuerna en cada mano',
  step_up: 'con una mancuerna en cada mano',
  zancadas_corporal: 'con una mancuerna en cada mano',
  sentadilla_corporal: 'con una mancuerna junto al pecho',
  puente_gluteo: 'con un disco o una mancuerna sobre la cadera',
  pantorrilla_de_pie: 'con una mancuerna en la mano',
  crunch: 'con un disco sobre el pecho',
};
/**
 * Cómo sumarle peso a un ejercicio de peso corporal ("con cinturón o una mancuerna entre los pies"), o null si no se
 * suele hacer. Las versiones con lastre del catálogo ya anotan su peso como carga, así que tampoco.
 */
export const comoLastre = ej => (ej && !esAsistido(ej) && !conLastre(ej) && sinCargaExterna(ej) ? COMO_LASTRE[ej.id] ?? null : null);
export const nivelAlcanza = (nivel, minimo) => NIVELES.indexOf(nivel) >= NIVELES.indexOf(minimo);

/** El ejercicio se puede hacer con este equipamiento (lista de ids de cuestionario.json). */
export const tieneEquipo = (ejercicio, equipamiento) =>
  ejercicio.equipamiento.every(eq => equipamiento.includes(eq));

/** Articulaciones que no se pueden cargar hoy, según las lesiones registradas. */
export function articulacionesBloqueadas(lesiones = [], hoy) {
  const fuera = new Set();
  for (const l of lesiones) {
    if (l.activa === false) continue;
    const conAltaPendiente = l.tipo === 'lesion' && (!l.alta || l.alta > hoy);
    const fuerte = (l.intensidad ?? 0) >= 4;
    if (conAltaPendiente || fuerte) fuera.add(l.region);
  }
  return fuera;
}

export const cargaZonaBloqueada = (ejercicio, bloqueadas) =>
  ejercicio.carga_articular.some(a => bloqueadas.has(a));
