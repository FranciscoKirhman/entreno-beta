// Lo que pidió la persona y cómo quedó en el plan, para la pantalla "Tu plan" (app/plan.js). Todo sale del plan
// generado, no de lo que se quiso hacer: si algo no se pudo (un favorito sin su máquina, una zona sin tiempo),
// se dice y se explica por qué.
import { tieneEquipo, nivelAlcanza, cargaZonaBloqueada, articulacionesBloqueadas } from './catalogo.js';
import { volumenSemanal, duracionEstimada, NOMBRE_DIA, NOMBRE_ZONA } from './motor-plan.js';

export const OBJETIVOS = {
  ganar_musculo: { nombre: 'Ganar músculo', como: 'Series cerca del fallo en rangos medios de repeticiones y suficiente volumen por músculo: es lo que más hace crecer.' },
  ganar_fuerza: { nombre: 'Ser más fuerte', como: 'Los ejercicios principales van con pocas repeticiones y más peso; los accesorios, con más repeticiones para sostenerlos.' },
  bajar_grasa: { nombre: 'Bajar grasa sin perder músculo', como: 'Pesas para mantener el músculo mientras bajas, más cardio después de las pesas. La comida hace la mayor parte.' },
  recomposicion: { nombre: 'Bajar grasa y ganar músculo', como: 'Pesas con volumen para ganar músculo y cardio moderado. Funciona mejor si recién empiezas o vuelves.' },
  salud: { nombre: 'Salud general', como: 'Todo el cuerpo con los movimientos básicos, sin llegar al fallo, y algo de cardio.' },
  deporte: { nombre: 'Rendir en tu deporte', como: 'Fuerza en los movimientos grandes con reserva, para que llegues fresco a tu deporte.' },
  volver: { nombre: 'Volver a entrenar', como: 'Parte más suave que tu nivel, con más reserva, para retomar sin lesionarte. Sube semana a semana.' },
};

const lista = xs => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);
const rango = (a, b) => (a === b ? `${a}` : `${a} a ${b}`);
const MUSCULOS = ['gluteo', 'cuadriceps', 'femoral', 'aductor_abductor', 'pecho', 'espalda', 'hombro', 'biceps', 'triceps', 'core'];

/**
 * @param plan       plan generado (motor-plan.generarPlan o el del servidor)
 * @param respuestas cuestionario
 * @param derivados  derivar(respuestas)
 * @returns {{ objetivo, nivel, dias, semana, minutos, cumple, volumen, rango, progresion, bloque }}
 *   cumple: [{ tema, estado: 'si' | 'parcial' | 'no', texto }] lo pedido, punto por punto.
 */
export function resumenPlan({ plan, respuestas: r, derivados: d, indice, hoy }) {
  const porId = indice.porId;
  const sem1 = plan.dias.filter(x => x.semana === 1);
  const diaSem = f => new Date(f + 'T12:00:00Z').getUTCDay();
  const dias = sem1.map(x => ({
    fecha: x.fecha, dia_semana: diaSem(x.fecha), nombre_dia: NOMBRE_DIA[diaSem(x.fecha)], plantilla: x.plantilla, foco: x.foco,
    firme: x.firme, minutos: duracionEstimada(x.ejercicios), cardio: x.cardio || null,
    ejercicios: x.ejercicios.map(e => ({ id: e.ejercicio_id, nombre: e.nombre, series: e.series, reps_min: e.reps_min, reps_max: e.reps_max, unidad: e.unidad, rir: e.rir, prioridad: e.prioridad, ...(e.superserie ? { superserie: e.superserie } : {}) })),
  }));
  // Semana de lunes a domingo: el día de entrenamiento o null (descanso).
  const semana = [1, 2, 3, 4, 5, 6, 0].map(n => dias.find(x => x.dia_semana === n) || null);
  const minutos = dias.map(x => x.minutos);
  const lugar = (r.lugares || []).find(l => l.principal) || (r.lugares || [])[0] || { nombre: 'Casa', equipamiento: [] };
  const equipo = lugar.equipamiento || [];
  const todos = sem1.flatMap(x => x.ejercicios.map(e => ({ x, e, ej: porId.get(e.ejercicio_id) })));
  const cumple = [];

  // Objetivo: el rango de repeticiones y la reserva que quedaron.
  const obj = OBJETIVOS[d.objetivo] || OBJETIVOS.salud;
  const conReps = todos.filter(t => t.e.unidad !== 'seg');
  const principales = conReps.filter(t => t.e.prioridad === 1);
  const base = principales.length ? principales : conReps;
  const repsTxt = base.length ? `${rango(Math.min(...base.map(t => t.e.reps_min)), Math.max(...base.map(t => t.e.reps_max)))} repeticiones` : null;
  const rirs = todos.map(t => t.e.rir);
  const rirTxt = rirs.length ? `${rango(Math.min(...rirs), Math.max(...rirs))} de reserva` : null;
  cumple.push({ tema: 'Objetivo', estado: 'si', texto: `${obj.nombre}. ${repsTxt ? `Lo principal, en ${repsTxt}${rirTxt ? ` con ${rirTxt}` : ''}. ` : ''}${obj.como}` });

  // Días y días que no puede.
  const noPuedo = r.dias_no_puedo || [];
  const enNoPuedo = dias.filter(x => noPuedo.includes(x.dia_semana));
  const nombresDias = lista(dias.map(x => x.nombre_dia));
  cumple.push({
    tema: 'Días',
    estado: dias.length === Math.min(6, d.dias_meta) && !enNoPuedo.length ? 'si' : 'parcial',
    texto: `${dias.length} días: ${nombresDias}.${r.dias_meta ? '' : ' No elegiste cuántos: partimos con 3.'}${noPuedo.length ? enNoPuedo.length ? ` ${lista(enNoPuedo.map(x => x.nombre_dia))} cae en un día que marcaste: no había otro libre.` : ` Ninguno ${noPuedo.length === 1 ? 'el' : 'los'} ${lista(noPuedo.map(n => NOMBRE_DIA[n]))}, como pediste.` : ''}${d.dias_meta > 6 ? ' Un día a la semana queda de descanso.' : ''}${d.dias_firmes < dias.length ? ` Los primeros ${d.dias_firmes} son los importantes; el resto, si alcanzas.` : ''}`,
  });

  // Tiempo.
  const largo = Math.max(0, ...minutos), corto = Math.min(...minutos);
  cumple.push({
    tema: 'Tiempo',
    estado: largo <= d.duracion_min * 1.15 ? 'si' : 'parcial',
    texto: `Sesiones de ${rango(corto, largo)} minutos, con calentamiento; ${r.duracion_min ? `pediste ${d.duracion_min}` : `no elegiste: partimos con ${d.duracion_min}`}.${largo > d.duracion_min ? ' Si un día te falta tiempo, salta lo último: lo principal va primero.' : ''}${d.duracion_min <= 30 ? ' Con 30 minutos entra lo principal: si un día tienes más, suma series.' : ''}`,
  });

  // Lugar y máquinas.
  const fuera = todos.filter(t => !tieneEquipo(t.ej, equipo));
  cumple.push({
    tema: 'Máquinas',
    estado: fuera.length ? 'no' : lugar.supuesto ? 'parcial' : 'si',
    texto: lugar.supuesto ? `No elegiste tu lugar: supuse ${String(lugar.nombre || 'un gimnasio completo').toLowerCase()}. Si te falta alguna máquina, márcalo en tu perfil y el plan se ajusta.`
      : fuera.length
      ? `${lista([...new Set(fuera.map(t => t.ej.nombre))])} necesita algo que no marcaste en ${lugar.nombre || 'tu lugar'}.`
      : equipo.length ? `Todo se hace con lo que marcaste en ${lugar.nombre || 'tu lugar'} (${equipo.length} máquina${equipo.length === 1 ? '' : 's'} o equipo${equipo.length === 1 ? '' : 's'}).` : `Todo se hace con tu peso corporal, en ${lugar.nombre || 'casa'}.`,
  });

  // Favoritos: dónde quedaron o por qué no.
  const bloqueadas = articulacionesBloqueadas(r.lesiones || [], hoy);
  for (const id of r.favoritos || []) {
    const ej = porId.get(id);
    if (!ej) continue;
    const enDias = dias.filter(x => x.ejercicios.some(e => e.id === id)).map(x => x.nombre_dia);
    const enCardio = ej.tipo === 'cardio' && dias.filter(x => (x.cardio || '').includes(ej.nombre)).map(x => x.nombre_dia);
    let estado = 'si', texto;
    if (enDias.length) texto = `${ej.nombre}: ${lista(enDias)}.`;
    else if (enCardio?.length) texto = `${ej.nombre}: después de las pesas, ${lista(enCardio)}.`;
    else {
      estado = 'no';
      const motivo = !tieneEquipo(ej, equipo) ? `necesita algo que no marcaste en ${lugar.nombre || 'tu lugar'}`
        : !nivelAlcanza(d.nivel, ej.nivel_minimo) ? `es para nivel ${ej.nivel_minimo}; entra cuando subas`
          : cargaZonaBloqueada(ej, bloqueadas) ? `carga ${lista([...bloqueadas].filter(z => cargaZonaBloqueada(ej, new Set([z]))).map(z => NOMBRE_ZONA[z] || z))}, que está lesionada`
            : (r.prohibidos || []).includes(id) ? 'también lo marcaste para no ver nunca'
              : `no cupo en sesiones de ${d.duracion_min} minutos`;
      texto = `${ej.nombre}: no entra porque ${motivo}.`;
    }
    cumple.push({ tema: 'Favorito', estado, texto });
  }

  // Volumen por músculo y zonas prioritarias.
  const vol = volumenSemanal(plan.dias, porId, 1);
  const prioridad = d.musculos_prioridad || [];
  const volumen = MUSCULOS.filter(m => vol[m] || prioridad.includes(m))
    .map(m => ({ musculo: m, nombre: NOMBRE_ZONA[m] || m, series: vol[m] || 0, prioridad: prioridad.includes(m) }))
    .sort((a, b) => b.prioridad - a.prioridad || b.series - a.series);
  const resto = volumen.filter(v => !v.prioridad && v.musculo !== 'core' && v.series);
  const promedio = resto.length ? resto.reduce((a, v) => a + v.series, 0) / resto.length : 0;
  for (const v of volumen.filter(x => x.prioridad)) {
    const bien = v.series + 0.5 >= promedio * 0.9;
    cumple.push({
      tema: 'Prioridad',
      estado: bien ? 'si' : v.series ? 'parcial' : 'no',
      texto: `${v.nombre[0].toUpperCase()}${v.nombre.slice(1)}: ${String(v.series).replace('.', ',')} series a la semana${promedio ? `; el resto, ${String(Math.round(promedio * 10) / 10).replace('.', ',')} en promedio` : ''}.${bien ? '' : ` No alcanzó más con ${d.duracion_min} minutos y tus favoritos; con más tiempo o días, sube.`}`,
    });
  }

  // Lesiones y salud.
  for (const l of (r.lesiones || []).filter(x => x.activa !== false)) {
    const zona = NOMBRE_ZONA[l.region] || l.region;
    cumple.push({
      tema: 'Cuidado',
      estado: 'si',
      texto: bloqueadas.has(l.region)
        ? `${zona[0].toUpperCase()}${zona.slice(1)}: ningún ejercicio la carga mientras dure ${l.tipo === 'lesion' ? 'la lesión' : 'la molestia'}.`
        : `${zona[0].toUpperCase()}${zona.slice(1)}: molestia leve; se calienta antes y, si duele, el coach te da una alternativa.`,
    });
  }
  if (d.alerta === 'sin_datos_salud') cumple.push({ tema: 'Salud', estado: 'parcial', texto: 'No respondiste las preguntas de salud: el plan deja 3 repeticiones de reserva por seguridad. Puedes completarlas en tu perfil.' });
  else if (d.alerta === 'aviso' || d.alerta === 'autorizado') cumple.push({ tema: 'Salud', estado: 'si', texto: 'Por lo que contestaste en salud, las dos primeras semanas van más suaves. Consulta a tu médico antes de empezar.' });

  return {
    objetivo: { id: d.objetivo, ...obj },
    nivel: d.nivel,
    dias, semana, minutos: { pedidos: d.duracion_min, corto, largo },
    lugar: lugar.nombre || null,
    cumple,
    volumen, rango: d.series_rango, promedio,
    progresion: 'Cada ejercicio tiene un rango de repeticiones. Cuando haces todas las series en el número más alto, dejando la reserva que pide el plan, la semana siguiente subes el peso un poco. Si no llegas al mínimo, se mantiene o baja. Lo decides tú en el check-in semanal.',
    bloque: { semanas: plan.semanas || 4, descarga: plan.semana_descarga || null, suaves: d.semanas_conservadoras || 0 },
  };
}
