// Búsqueda en el catálogo de ejercicios (contenido/ejercicios.json).
// La usan la importación desde Hevy, el motor de planes, el validador y las herramientas para la IA.

/** "Bench Press — Barbell", "bench press (barbell)" y "Bench Press (Barbell)" quedan iguales. */
export function normalizar(nombre) {
  return String(nombre || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter(Boolean).join(' ');
}

// Hevy agrega estas palabras a algunas variantes ("Chest Fly — Machine, Spa"); no cambian el ejercicio.
const MODIFICADORES = new Set(['spa', 'unilateral']);

export function crearIndice(catalogo) {
  const ejercicios = catalogo.ejercicios || catalogo;
  const porId = new Map();
  const porNombre = new Map();
  for (const e of ejercicios) {
    porId.set(e.id, e);
    for (const n of [e.nombre_hevy, e.nombre, ...(e.alias || [])]) {
      const clave = normalizar(n);
      if (porNombre.has(clave) && porNombre.get(clave).id !== e.id) {
        throw new Error(`"${n}" apunta a dos ejercicios: ${porNombre.get(clave).id} y ${e.id}`);
      }
      porNombre.set(clave, e);
    }
  }
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
