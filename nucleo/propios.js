// Ejercicios creados por la persona, como en Hevy: nombre, tipo, músculos y equipo. Se usan como cualquier otro
// (banco, Hoy, historial, récords, gráficos), pero viven en el teléfono y en el respaldo, no en el catálogo del
// servidor. Por eso, al subir a la cuenta, el plan va sin ellos y sus series van sin id (con su nombre, como lo
// importado de Hevy que no calza); al bajar se vuelven a juntar.
import { normalizar } from './catalogo.js';

export const PREFIJO = 'propio_';
export const esPropio = id => typeof id === 'string' && id.startsWith(PREFIJO);

// Qué tipo de ejercicio es: decide cómo se prescribe y se anota.
export const TIPOS_PROPIO = {
  peso: { nombre: 'Con peso', tipo: 'aislamiento', medida: 'reps' },
  principal: { nombre: 'Con peso, ejercicio principal', tipo: 'compuesto', medida: 'reps' },
  corporal: { nombre: 'Peso corporal', tipo: 'aislamiento', medida: 'reps' },
  tiempo: { nombre: 'Por tiempo (como la plancha)', tipo: 'core', medida: 'seg' },
  distancia: { nombre: 'Peso y distancia', tipo: 'aislamiento', medida: 'm' },
};

/**
 * @param datos { nombre, clase (de TIPOS_PROPIO), musculos: [ids], equipamiento: [ids] }
 * @param indice el catálogo con los propios ya cargados (para no repetir nombres)
 * @returns {{ejercicio} | {error}}
 */
export function crearPropio(datos, indice) {
  const nombre = String(datos.nombre || '').trim().replace(/\s+/g, ' ');
  if (nombre.length < 3) return { error: 'Escribe un nombre de al menos 3 letras.' };
  if (nombre.length > 60) return { error: 'El nombre puede tener hasta 60 letras.' };
  const clase = TIPOS_PROPIO[datos.clase] ? datos.clase : 'peso';
  if (!datos.musculos?.length) return { error: 'Elige al menos un músculo.' };
  const n = normalizar(nombre);
  const repetido = indice.ejercicios.find(e => [e.nombre, e.nombre_hevy, ...(e.alias || [])].some(x => x && normalizar(x) === n));
  if (repetido) return { error: `Ya existe "${repetido.nombre}". Búscalo en el banco.` };
  const base = n.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 30) || 'ejercicio';
  let id = `${PREFIJO}${base}`;
  for (let i = 2; indice.porId.has(id); i++) id = `${PREFIJO}${base}_${i}`;
  const t = TIPOS_PROPIO[clase];
  return { ejercicio: {
    id, nombre, nombre_hevy: null, alias: [], patron: clase === 'distancia' ? 'transporte' : 'propio',
    musculos_primarios: datos.musculos.slice(0, 3), musculos_secundarios: [], equipamiento: clase === 'corporal' ? [] : [...new Set(datos.equipamiento || [])],
    carga_articular: [], nivel_minimo: 'principiante', tipo: t.tipo, preferencia: 9, propio: true, clase, medida: t.medida,
  } };
}

/** El plan para subir a la cuenta: sin los ejercicios propios (el servidor solo conoce el catálogo). */
export function planSinPropios(plan) {
  if (!plan?.dias?.some(d => d.ejercicios?.some(e => esPropio(e.ejercicio_id)))) return plan;
  return { ...plan, dias: plan.dias.map(d => ({ ...d, ejercicios: d.ejercicios.filter(e => !esPropio(e.ejercicio_id)).map((e, i) => ({ ...e, orden: i })) })) };
}

/** Al bajar el plan de la cuenta, vuelve a poner los ejercicios propios del plan del teléfono en sus días. */
export function conPropios(planCuenta, planLocal) {
  if (!planCuenta?.dias || !planLocal?.dias?.length) return planCuenta;
  const propios = new Map(planLocal.dias.map(d => [d.fecha, d.ejercicios.map((e, i) => [e, i]).filter(([e]) => esPropio(e.ejercicio_id))]).filter(([, xs]) => xs.length));
  if (!propios.size) return planCuenta;
  return { ...planCuenta, dias: planCuenta.dias.map(d => {
    const xs = propios.get(d.fecha);
    if (!xs) return d;
    const ejercicios = [...d.ejercicios];
    for (const [e, i] of xs) if (!ejercicios.some(x => x.ejercicio_id === e.ejercicio_id)) ejercicios.splice(Math.min(i, ejercicios.length), 0, e);
    return { ...d, ejercicios: ejercicios.map((e, i) => ({ ...e, orden: i })) };
  }) };
}

/** Series y notas para la cuenta: las de un ejercicio propio van sin id, con su nombre. */
export const sinIdPropio = xs => (xs || []).map(x => (esPropio(x.ejercicio_id) ? { ...x, ejercicio_id: null } : x));

/** Al bajar las sesiones: las series sin id cuyo nombre es el de un ejercicio propio recuperan su id. */
export function idsPropios(sesiones, propios = []) {
  if (!propios.length) return sesiones;
  const porNombre = new Map(propios.map(p => [normalizar(p.nombre), p.id]));
  return sesiones.map(s => ({ ...s, series: (s.series || []).map(x => (!x.ejercicio_id && porNombre.has(normalizar(x.ejercicio_nombre)) ? { ...x, ejercicio_id: porNombre.get(normalizar(x.ejercicio_nombre)) } : x)) }));
}
