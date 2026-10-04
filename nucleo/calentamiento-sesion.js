// Preparación por movimientos. Contenido general adaptado del tablero anterior, sin sus datos personales.
// Los pasos propios de un plan importado se conservan; solo se reemplaza el antiguo esquema genérico.
import { seriesDeCalentamiento, tramosDePaso } from './calentamiento.js';

export function aproximacionesDelPlan(dia, ejercicio) {
  return ejercicio.aproximaciones?.length ? ejercicio.aproximaciones : (dia.calentamiento || []).find(p => p.aproximaciones?.[ejercicio.ejercicio_id])?.aproximaciones[ejercicio.ejercicio_id] || [];
}

export function partePaso(nombre) {
  const m = String(nombre || '').match(/^(.+?),\s*(.+)$/);
  return m ? { nombre: m[1], dosis: m[2] } : { nombre: nombre || '', dosis: '' };
}

/**
 * Ejercicios de la sesión que llevan series de calentamiento en su propia tabla (filas C), como en el tablero: los que
 * traen aproximaciones indicadas en el plan y los dos primeros compuestos (o el primero, si no hay compuestos), salvo
 * los que cargan una zona bloqueada.
 */
export function conAproximaciones({ dia, porId, bloqueadas = new Set() }) {
  const ejercicios = (dia.ejercicios || []).map(e => ({ e, ej: porId.get(e.ejercicio_id) })).filter(x => x.ej && x.ej.tipo !== 'cardio' && !(x.ej.carga_articular || []).some(z => bloqueadas.has(z)));
  const indicadas = ejercicios.filter(x => aproximacionesDelPlan(dia, x.e).length);
  const principales = ejercicios.filter(x => x.ej.tipo === 'compuesto' && x.e.unidad !== 'seg').slice(0, 2);
  const elegidos = indicadas.length ? indicadas : principales.length ? principales : ejercicios.filter(x => x.e.unidad !== 'seg').slice(0, 1);
  return new Set(elegidos.map(x => x.e.ejercicio_id));
}

export function minutosCalentamiento(pasos) {
  if (!pasos?.length) return 0;
  return Math.ceil(pasos.reduce((s, p) => s + (p.seg_estimados ?? (tramosDePaso(p.name).reduce((a, t) => a + t.seg, 0) || (/aproximaci/i.test(p.name) ? 180 : 60))), 0) / 60);
}

const TORSO = new Set(['empuje_horizontal', 'empuje_vertical', 'tiron_horizontal', 'tiron_vertical', 'pecho_aislado', 'hombro_posterior', 'hombro_aislado', 'biceps', 'triceps']);
const PIERNA = new Set(['sentadilla', 'bisagra', 'extension_cadera', 'unilateral_pierna', 'flexion_rodilla', 'extension_rodilla', 'abduccion', 'aduccion', 'pantorrilla']);
const generico = p => /^5 minutos de cardio suave$|^Series de aproximación del primer ejercicio$/i.test(p.name);
const clave = name => `propio:${name}`;

/**
 * Zonas que la sesión trabaja de verdad: una zona cuenta si tiene un ejercicio compuesto, dos o más ejercicios, o si es
 * la única. Así una abductora en un día de torso no arma un calentamiento de piernas.
 */
export function zonasDeSesion(ejercicios) {
  const cuenta = { torso: [], pierna: [] };
  for (const x of ejercicios) {
    if (TORSO.has(x.ej.patron)) cuenta.torso.push(x.ej);
    else if (PIERNA.has(x.ej.patron)) cuenta.pierna.push(x.ej);
  }
  const activa = xs => xs.length && (xs.some(ej => ej.tipo === 'compuesto') || xs.length >= 2 || xs.length === ejercicios.length);
  return { torso: Boolean(activa(cuenta.torso)), pierna: Boolean(activa(cuenta.pierna)), tiron: cuenta.torso.some(ej => ej.patron.startsWith('tiron')) };
}
// Zona de un paso escrito a mano (del tablero o de un plan importado), para usarlo solo los días que la trabajan.
const ZONA_PASO = [
  [/bici|caminadora|caminata|marcha|cardio|trote|el[ií]ptica/i, 'temperatura'],
  [/aproximaci/i, 'aproximacion'],
  [/cadera|bisagra|puente|tobillo|90\s*\/\s*90|abducci|aducci|sentadilla|gl[uú]teo|zancada|rodilla|femoral|cu[aá]driceps|pierna/i, 'pierna'],
  [/dorsal|colgar|jal[oó]n|dominada/i, 'tiron'],
  [/hombro|tor[aá]cica|face pull|dislocaci|rotaci[oó]n externa|pared|serrato|om[oó]plato|pecho|mu[ñn]eca|codo|jal[oó]n|remo|press/i, 'torso'],
  [/dead bug|bird dog|plancha|core|abdomen/i, 'core'],
];
export const zonaDePaso = nombre => ZONA_PASO.find(([re]) => re.test(nombre))?.[1] || 'otra';
/** Si un paso escrito a mano sirve hoy: lo general siempre; lo de torso o piernas, solo si la sesión trabaja esa zona. */
const sirveHoy = (zona, zonas) => (zona === 'torso' ? zonas.torso : zona === 'tiron' ? zonas.torso && zonas.tiron : zona === 'pierna' ? zonas.pierna : zona === 'core' ? zonas.pierna : true);
const deTorso = zona => zona === 'torso' || zona === 'tiron';
// Pasos escritos a mano que equivalen a uno que arma la app, para no repetirlos al completar.
const EQUIVALE = [[/c[ií]rculos de hombro/i, 'hombros'], [/tor[aá]cica/i, 'toracica'], [/deslizamiento en pared|wall slide/i, 'pared'], [/serrato|om[oó]platos/i, 'serrato'],
  [/face pull/i, 'face-banda'], [/tobillo/i, 'tobillo'], [/c[ií]rculos de cadera/i, 'cadera'], [/90\s*\/\s*90/i, '90-90'], [/bisagra/i, 'bisagra'], [/puente de gl[uú]teo/i, 'puente']];
const equivalente = nombre => EQUIVALE.find(([re]) => re.test(nombre))?.[1] || null;

export function calentamientoDeSesion({ dia, porId, equipo = [], bloqueadas = new Set(), cargas = {}, opcionesCarga = {} }) {
  const actuales = (dia.calentamiento || []).map(p => typeof p === 'string' ? { name: p, how: '' } : p);
  const personalizado = actuales.length && !actuales.some(p => p.origen === 'sesion-v1') && !(actuales.length >= 2 && actuales.slice(0, 2).every(generico));
  const ejerciciosHoy = (dia.ejercicios || []).map(e => ({ e, ej: porId.get(e.ejercicio_id) })).filter(x => x.ej && x.ej.tipo !== 'cardio');
  const zonas = zonasDeSesion(ejerciciosHoy);
  if (personalizado) {
    // Los pasos escritos a mano se conservan tal cual, pero solo los que sirven para los ejercicios de hoy: un plan
    // movido o editado no puede dejar un calentamiento de piernas en un día de torso. Si una zona de hoy queda sin
    // pasos, se completa con los que arma la app para esa zona.
    const conZona = actuales.map((p, i) => ({ p, i, zona: zonaDePaso(p.name) }));
    const escritosConZona = conZona.some(x => deTorso(x.zona) || x.zona === 'pierna');
    const usados = escritosConZona ? conZona.filter(x => sirveHoy(x.zona, zonas)) : conZona;
    const pasosPropios = usados.map(({ p, i }) => propio(p, i));
    if (!escritosConZona || !ejerciciosHoy.length) return pasosPropios;
    // Se completa la zona de hoy que quedó sin pasos o a la que se le quitaron pasos que no correspondían.
    const quitado = conZona.length > usados.length;
    const completar = {
      torso: zonas.torso && (quitado || !usados.some(x => deTorso(x.zona))),
      pierna: zonas.pierna && (quitado || !usados.some(x => x.zona === 'pierna')),
    };
    if (!completar.torso && !completar.pierna) return pasosPropios;
    const yaEstan = new Set(usados.map(x => equivalente(x.p.name)).filter(Boolean));
    const generados = calentamientoDeSesion({ dia: { ...dia, calentamiento: [] }, porId, equipo, bloqueadas, cargas, opcionesCarga })
      .filter(x => x.fase !== '1 · Subir temperatura' && !String(x.clave).startsWith('aprox:') && !yaEstan.has(x.clave)
        && (completar.torso && zonaDeClave(x.clave) === 'torso' || completar.pierna && zonaDeClave(x.clave) === 'pierna'));
    const antesDeAprox = pasosPropios.findIndex(x => zonaDePaso(x.name) === 'aproximacion');
    if (antesDeAprox < 0) return [...pasosPropios, ...generados];
    return [...pasosPropios.slice(0, antesDeAprox), ...generados, ...pasosPropios.slice(antesDeAprox)];
  }
  return generado(actuales, ejerciciosHoy, zonas);

  /** Un paso escrito a mano, con su imagen y, si es el de aproximación, las cargas indicadas. */
  function propio(p, i) {
    const n = p.name.toLowerCase();
    const zona = ['hombro', 'codo', 'cadera', 'rodilla', 'tobillo', 'muneca', 'lumbar', 'cuello'].find(z => n.includes(z));
    const id = /puente/.test(n) ? 'puente_gluteo' : /dead bug/.test(n) ? 'dead_bug' : /bird dog/.test(n) ? 'bird_dog' : null;
    const imagen = id ? `img/ejercicios/mini/${id}.webp` : /banda/.test(n) ? 'img/equipos/bandas.webp' : /colgar|barra/.test(n) ? 'img/equipos/barra_dominadas.webp' : zona ? `img/articulaciones/${zona}.webp` : /torácica/.test(n) ? 'img/musculos/espalda.webp' : /bici|cardio|camin/.test(n) ? 'img/ejercicios/mini/caminata.webp' : null;
    const primero = dia.ejercicios?.[0];
    const indicadas = primero ? aproximacionesDelPlan(dia, primero) : [];
    const aproximacion = /series de aproximaci/i.test(n) && indicadas.length;
    return { ...p, clave: p.clave || clave(p.name), indiceAnterior: i, imagen: p.imagen || imagen,
      ...(aproximacion ? { imagen: `img/ejercicios/mini/${primero.ejercicio_id}.webp`, series: indicadas.map(s => ({ ...s })), agregar_id: primero.ejercicio_id } : {}) };
  }

  /** El calentamiento que arma la app para los ejercicios de hoy. */
  function generado(actuales, ejercicios, zonas) {
  if (!ejercicios.length) return [];
  const patrones = new Set(ejercicios.map(x => x.ej.patron));
  const pasos = [];
  const agregar = (id, name, how, por_que, fase, zonas, imagen, seg_estimados) => {
    if (zonas.some(z => bloqueadas.has(z))) return;
    pasos.push({ clave: id, name, how, por_que, fase, imagen, seg_estimados, origen: 'sesion-v1' });
  };
  agregar('temperatura', 'Marcha suave en el lugar, 5 minutos', 'Camina o marcha a un ritmo que te permita hablar frases completas. Si terminas sin aliento, baja el ritmo.', 'Sube la temperatura antes de mover las cargas.', '1 · Subir temperatura', ['rodilla', 'cadera', 'tobillo'], 'img/ejercicios/mini/caminata.webp', 300);
  if (pasos.length && equipo.includes('bicicleta')) {
    Object.assign(pasos[0], { name: 'Bicicleta o caminata suave, 5 minutos', imagen: 'img/equipos/bicicleta.webp' });
  }
  if (zonas.torso) {
    agregar('hombros', 'Círculos de hombro, 10 adelante y 10 atrás', 'De pie, brazos sueltos. Dibuja círculos grandes y lentos sin encoger los hombros hacia las orejas.', 'Prepara el movimiento de hombros para los ejercicios de torso.', '2 · Movilidad', ['hombro'], 'img/articulaciones/hombro.webp', 45);
    agregar('toracica', 'Movilidad torácica sentado, 8 por lado', 'Sentado, manos en la nuca. Gira el pecho sin mover la cadera. Se mueve la espalda alta, sin forzar la zona baja.', 'Ensaya el control del tronco que usarás en presses y remos.', '2 · Movilidad', ['lumbar', 'cuello', 'hombro'], 'img/musculos/espalda.webp', 60);
    if ([...patrones].some(p => p.startsWith('empuje'))) {
      agregar('pared', 'Deslizamiento en pared, 10 repeticiones', 'Apoya espalda y brazos en la pared, con codos a 90°. Sube los brazos hasta donde puedas mantener el contacto, sin arquear la espalda.', 'Prepara el recorrido de los brazos antes del press.', '3 · Activación', ['hombro', 'lumbar'], 'img/articulaciones/hombro.webp', 45);
      agregar('serrato', 'Empuje de omóplatos en pared, 15 s', 'Manos en la pared. Empuja separando los omóplatos, como si alejaras el pecho de la pared. Mantén los brazos extendidos y respira.', 'Practica el control de los omóplatos antes de empujar.', '3 · Activación', ['hombro', 'codo', 'muneca'], 'img/articulaciones/hombro.webp', 30);
    }
    const tiron = ejercicios.find(x => x.ej.patron.startsWith('tiron'));
    if (tiron && equipo.includes('bandas')) {
      agregar('face-banda', 'Face pull con banda, 15 repeticiones', 'Banda fija a la altura de la cara. Tira separando las manos y llevando los codos atrás. Hombros abajo, sin encogerlos. Usa una resistencia liviana.', 'Activa la espalda alta antes de los tirones de esta sesión.', '3 · Activación', ['hombro', 'codo', 'muneca'], 'img/equipos/bandas.webp', 60);
    } else if (tiron) {
      agregar(`ensayo:${tiron.ej.id}`, `${tiron.ej.nombre}, 12 repeticiones livianas`, 'Usa una carga fácil y haz el recorrido lento, sin balancear el tronco. Mantén los hombros lejos de las orejas. Esta serie prepara el movimiento, sin buscar el fallo.', 'Ensaya el tirón que aparece en tu sesión, usando su mismo equipo.', '3 · Activación', tiron.ej.carga_articular || [], `img/ejercicios/mini/${tiron.ej.id}.webp`, 60);
    }
  }
  if (zonas.pierna) {
    if (patrones.has('sentadilla') || patrones.has('unilateral_pierna')) {
      agregar('tobillo', 'Movilidad de tobillo contra pared, 10 por lado', 'Frente a la pared, lleva la rodilla hacia ella sin despegar el talón. Acerca el pie si no llegas y mueve la rodilla con control.', 'Prepara el apoyo del pie y el recorrido de rodilla antes de la sentadilla.', '2 · Movilidad', ['tobillo', 'rodilla'], 'img/articulaciones/tobillo.webp', 60);
    }
    agregar('cadera', 'Círculos de cadera de pie, 8 por lado', 'Apóyate en algo firme. Levanta una rodilla y dibuja círculos hacia afuera. Se mueve la cadera, sin girar la espalda.', 'Prepara el recorrido de cadera que usarás en la sesión.', '2 · Movilidad', ['cadera', 'rodilla'], 'img/articulaciones/cadera.webp', 60);
    agregar('90-90', '90/90 de cadera, 6 cambios por lado', 'Sentado en el suelo, una pierna delante y otra al costado, ambas a 90°. Cambia las rodillas al otro lado sin forzar el recorrido.', 'Practica la rotación de cadera con control.', '2 · Movilidad', ['cadera', 'rodilla'], 'img/articulaciones/cadera.webp', 60);
    if (patrones.has('bisagra')) agregar('bisagra', 'Bisagra de cadera hacia la pared, 12 repeticiones', 'De espaldas a la pared, echa la cadera atrás hasta tocarla, con las rodillas apenas dobladas y la espalda estable. Vuelve apretando el glúteo.', 'Ensaya el patrón de tu peso muerto antes de poner carga.', '3 · Activación', ['cadera', 'lumbar', 'rodilla'], 'img/articulaciones/cadera.webp', 60);
    agregar('puente', 'Puente de glúteo, 12 repeticiones con pausa', 'Boca arriba, pies al ancho de cadera. Sube hasta alinear rodillas, cadera y hombros, pausa un segundo y baja lento. Mantén las costillas abajo.', 'Activa el glúteo antes del trabajo de piernas, sin arquear la espalda.', '3 · Activación', ['cadera', 'lumbar', 'rodilla'], 'img/ejercicios/mini/puente_gluteo.webp', 60);
  }
  const extras = actuales.filter(p => !p.origen && !generico(p));
  for (const p of extras) pasos.push({ ...p, clave: clave(p.name), indiceAnterior: actuales.indexOf(p), fase: 'Preparación de tu plan' });
  const principales = ejercicios.filter(x => x.ej.tipo === 'compuesto').slice(0, 2);
  for (const { e, ej } of principales.length ? principales : ejercicios.slice(0, 1)) {
    if ((ej.carga_articular || []).some(z => bloqueadas.has(z))) continue;
    const indicadas = aproximacionesDelPlan(dia, e);
    const series = indicadas.length ? indicadas.map(s => ({ ...s })) : seriesDeCalentamiento(cargas[ej.id] ?? e.carga_kg, opcionesCarga[ej.id] || { barra: ej.equipamiento.includes('barra_rack') ? 20 : 0 });
    pasos.push({ clave: `aprox:${ej.id}`, name: `Aproximación: ${ej.nombre}`, how: 'Sube la carga de a poco y mantén varias repeticiones en reserva. Descansa 45 a 60 s entre aproximaciones y el descanso de tu ejercicio antes de la primera serie de trabajo. Si no hay un peso indicado, elige una carga fácil y regístrala.', por_que: 'Prepara este ejercicio con su propio peso. Estas series no cuentan como trabajo ni como volumen efectivo.', fase: '4 · Aproximación', imagen: `img/ejercicios/mini/${ej.id}.webp`, series, agregar_id: ej.id, seg_estimados: series.length * 75, origen: 'sesion-v1' });
  }
  // Las marcas del antiguo cardio se conservan; la antigua aproximación no marca ejercicios diferentes.
  const anterior = actuales.findIndex(p => /^5 minutos de cardio suave$/.test(p.name));
  if (anterior >= 0 && pasos[0]?.clave === 'temperatura') pasos[0].indiceAnterior = anterior;
  return pasos;
  }
}
/** Zona de un paso que arma la app (por su clave). */
const zonaDeClave = c => (['hombros', 'toracica', 'pared', 'serrato', 'face-banda'].includes(c) || String(c).startsWith('ensayo:') ? 'torso' : ['tobillo', 'cadera', '90-90', 'bisagra', 'puente'].includes(c) ? 'pierna' : 'otra');
