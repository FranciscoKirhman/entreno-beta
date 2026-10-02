// Cuidado cuando algo duele: ejercicios de cuidado y un plan de mejora conservador por fases, más la forma de
// incorporar una indicación médica o kinesiológica al plan.
//
// Límites (contenido/evidencia/06-dolor-y-lesiones.md y docs/03-legal-chile.md):
// - No diagnostica ni trata: orienta, siempre recomienda evaluación profesional y pide consentimiento explícito.
// - Si hay una señal de alarma o el dolor es de 7 o más, no entrega ejercicios: deriva.
// - Si existe una indicación profesional, manda la indicación por sobre estas sugerencias.

export const AVISO = 'Estos ejercicios son orientación general: no son un diagnóstico ni un tratamiento, y no reemplazan una evaluación médica o kinesiológica. Te recomendamos consultar. Si un profesional te dio indicaciones, sigue esas y súbelas a la app para que tu plan las respete.';

export const CONSENTIMIENTO = 'Entiendo que los ejercicios de cuidado son orientación general y no un diagnóstico ni un tratamiento, que debo consultar a un médico o kinesiólogo, y que si un profesional me da indicaciones, esas mandan por sobre las sugerencias de la app.';

// Dosis en series × repeticiones o segundos. "fase" 1 = calmar, 2 = recuperar.
const E = (nombre, dosis, como, fase, ejercicio_id = null) => ({ nombre, dosis, como, fase, ejercicio_id });
export const EJERCICIOS = {
  hombro: [
    E('Isométrico de rotación externa contra la pared', '5 × 30 s', 'Codo pegado al cuerpo y a 90°. Empuja el dorso de la mano contra la pared con una fuerza cómoda.', 1),
    E('Deslizamiento de brazos en la pared', '2 × 10', 'Antebrazos apoyados en la pared; súbelos lento sin encoger los hombros.', 1),
    E('Rotación externa con banda', '3 × 15', 'Codo pegado y a 90°. Gira el antebrazo hacia afuera lento, 3 segundos de vuelta.', 2),
    E('Remo con banda juntando escápulas', '3 × 12', 'Tira de la banda llevando los codos atrás y junta las escápulas un segundo.', 2, 'remo_banda'),
  ],
  codo: [
    E('Isométrico de extensión de muñeca', '5 × 30 s', 'Antebrazo apoyado en la mesa, palma hacia abajo. Empuja el dorso de la mano contra tu otra mano sin moverla.', 1),
    E('Apretar una toalla o pelota', '3 × 20 s', 'Fuerza moderada, sin dolor mayor a 3 de 10.', 1),
    E('Extensión de muñeca lenta con 1 a 2 kg', '3 × 15', 'Sube con ayuda de la otra mano y baja solo en 3 segundos.', 2),
    E('Pronación y supinación con mancuerna liviana', '2 × 12', 'Codo en 90° pegado al cuerpo; gira la palma hacia arriba y hacia abajo, lento.', 2),
  ],
  rodilla: [
    E('Sentadilla isométrica contra la pared', '5 × 30 s', 'Espalda en la pared y rodillas en un ángulo que no duela más de 3 de 10.', 1),
    E('Extensión terminal de rodilla con banda', '3 × 15', 'Banda detrás de la rodilla. Estira la pierna del todo apretando el cuádriceps.', 1),
    E('Bajada lenta de un escalón bajo', '3 × 8 por lado', 'Baja en 3 segundos tocando el suelo con el talón de la otra pierna.', 2),
    E('Puente de glúteo', '3 × 12', 'Sube la cadera apretando glúteos, sin arquear la espalda.', 2, 'puente_gluteo'),
  ],
  lumbar: [
    E('Caminata', '20 a 30 min', 'A ritmo cómodo. Moverse suele aliviar más que el reposo.', 1, 'caminata'),
    E('Dead bug', '3 × 8 por lado', 'Espalda baja apoyada en el suelo durante todo el movimiento.', 1, 'dead_bug'),
    E('Bird dog', '3 × 8 por lado', 'En cuatro apoyos, estira brazo y pierna contrarios sin arquear.', 2, 'bird_dog'),
    E('Puente de glúteo', '3 × 12', 'Sube la cadera apretando glúteos.', 2, 'puente_gluteo'),
  ],
  muneca: [
    E('Isométricos de flexión y extensión de muñeca', '3 × 30 s cada uno', 'Empuja contra la otra mano sin moverla, con fuerza cómoda.', 1),
    E('Círculos de muñeca', '2 × 10 por lado', 'Lentos y amplios, sin dolor.', 1),
    E('Apoyo progresivo en cuatro apoyos', '3 × 20 s', 'Lleva el peso hacia las manos de a poco, hasta donde no duela.', 2),
  ],
  tobillo: [
    E('Equilibrio en un pie', '3 × 30 s por lado', 'Cerca de una pared para apoyarte si hace falta.', 1),
    E('Movilidad de tobillo contra la pared', '2 × 10 por lado', 'Lleva la rodilla a la pared sin despegar el talón.', 1),
    E('Elevación de talones lenta', '3 × 15', 'Sube en 1 segundo y baja en 3.', 2, 'pantorrilla_de_pie'),
  ],
  cadera: [
    E('Puente de glúteo', '3 × 12', 'Sube la cadera apretando glúteos.', 1, 'puente_gluteo'),
    E('Almeja con banda', '3 × 15 por lado', 'De lado, rodillas dobladas; abre la rodilla de arriba sin girar la pelvis.', 1),
    E('90/90 de cadera', '2 × 6 cambios por lado', 'Sentado, gira las rodillas de un lado al otro sin usar las manos.', 2),
  ],
  cuello: [
    E('Retracción cervical (doble mentón)', '2 × 10', 'Lleva la cabeza hacia atrás sin inclinarla, como haciendo doble mentón.', 1),
    E('Isométricos suaves de cuello', '3 × 10 s por dirección', 'Mano en la frente, nuca y costados; empuja suave sin mover la cabeza.', 2),
  ],
};

export const FASES = [
  { n: 1, nombre: 'Calmar', semanas: '1 y 2', frecuencia: 'Todos los días o día por medio', regla: 'Isométricos y movilidad. Durante el ejercicio, el dolor no pasa de 3 sobre 10.' },
  { n: 2, nombre: 'Recuperar', semanas: '3 y 4', frecuencia: '3 veces por semana', regla: 'Ejercicios lentos con poca carga. Se avanza si el dolor de la mañana siguiente no empeora.' },
  { n: 3, nombre: 'Volver a cargar', semanas: 'desde la 5', frecuencia: 'Dentro del plan normal', regla: 'Vuelve el ejercicio original con la mitad de las series y 3 repeticiones de reserva; sube si no empeora al día siguiente.' },
];

/**
 * @param p.zona 'hombro' | 'codo' | ... (articulaciones del cuestionario)
 * @param p.intensidad 0 a 10
 * @param p.dias dias desde que empezó (para elegir la fase)
 * @param p.senales ['hormigueo', 'chasquido', ...] señales de alarma
 * @param p.consentimiento true si aceptó CONSENTIMIENTO
 * @param p.empeoro true si el dolor empeoró respecto de la semana anterior
 * @param p.indicacion indicación profesional vigente para esa zona, si existe
 */
export function planDeCuidado({ zona, intensidad = 0, dias = 0, senales = [], consentimiento = false, empeoro = false, indicacion = null, contextoCompleto = false }) {
  if (senales.length || intensidad >= 7) {
    return { tipo: 'derivar', aviso: AVISO, mensaje: 'Con ese nivel de dolor o con esas señales, lo indicado es una evaluación profesional antes de seguir. Te recomiendo detener los ejercicios que cargan esa zona y consultar. Tu plan todavía no ha cambiado.' };
  }
  if (!consentimiento) return { tipo: 'requiere_consentimiento', texto: CONSENTIMIENTO, aviso: AVISO };
  if (indicacion) {
    return {
      tipo: 'indicacion', aviso: AVISO,
      mensaje: `Sigues la indicación de ${indicacion.profesional || 'tu profesional'}${indicacion.fecha ? ` del ${indicacion.fecha}` : ''}. Revisa que las restricciones estén incorporadas en tu plan antes de entrenar.`,
      ejercicios: indicacion.ejercicios || [], restricciones: indicacion.restricciones || {},
    };
  }
  if (!contextoCompleto) return { tipo: 'requiere_contexto', aviso: AVISO, mensaje: 'Antes de sugerir ejercicios, cuéntame en un solo mensaje la zona, intensidad de 0 a 10, cuántos días llevas, si empeoró, si hay señales de alarma y si tienes indicaciones profesionales. Puedes escribir: Me duele el codo 3/10 hace 2 días, no empeoró, sin señales de alarma y sin indicaciones profesionales.' };
  if (empeoro || dias >= 14) return { tipo: 'derivar', aviso: AVISO, mensaje: 'Como empeoró o lleva dos semanas, consulta a un profesional antes de seguir cargando la zona. Tu plan todavía no ha cambiado.' };
  const todos = EJERCICIOS[zona];
  if (!todos) return { tipo: 'sin_ejercicios', aviso: AVISO, mensaje: 'Para esa zona no tenemos ejercicios de cuidado: consulta a un profesional.' };
  let fase = dias < 14 ? 1 : dias < 28 ? 2 : 3;
  if (empeoro && fase > 1) fase -= 1;
  const ejercicios = fase === 3 ? todos.filter(e => e.fase === 2) : todos.filter(e => e.fase <= fase);
  // Tres semanas sin resolverse, o si empeora, la recomendación de evaluar pasa a ser explícita.
  const evaluar = dias >= 21 || empeoro ? 'Lleva tres semanas o empeoró: es momento de una evaluación profesional.' : null;
  return { tipo: 'plan', aviso: AVISO, zona, fase: FASES[fase - 1], fases: FASES, ejercicios, evaluar, referencias: [24, 26, 29] };
}

/**
 * Incorpora una indicación profesional al plan: saca lo que la indicación restringe (hasta su fecha) y agrega
 * sus ejercicios al inicio de los días que correspondan según la frecuencia indicada.
 * @param indicacion { profesional, fecha, hasta, restricciones: { zonas: [], patrones: [], ejercicios: [] },
 *                     ejercicios: [{ nombre, ejercicio_id?, series, reps?, segundos?, por_semana }] }
 */
export function aplicarIndicacion(plan, indicacion, indice) {
  const nuevo = structuredClone(plan);
  const r = indicacion.restricciones || {};
  const vigente = f => (!indicacion.fecha || f >= indicacion.fecha) && (!indicacion.hasta || f <= indicacion.hasta);
  const quitados = [];
  for (const d of nuevo.dias.filter(x => vigente(x.fecha))) {
    d.ejercicios = d.ejercicios.filter(e => {
      const ej = indice.porId.get(e.ejercicio_id);
      const fuera = (r.ejercicios || []).includes(e.ejercicio_id) || (ej && (r.patrones || []).includes(ej.patron))
        || (ej && ej.carga_articular.some(a => (r.zonas || []).includes(a)));
      if (fuera) quitados.push({ fecha: d.fecha, ejercicio: e.nombre || e.ejercicio_id });
      return !fuera;
    });
  }
  // Ejercicios indicados: repartidos en la semana según cuántas veces por semana.
  const porSemana = {};
  for (const d of nuevo.dias.filter(x => vigente(x.fecha)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))) {
    (porSemana[d.semana] ||= []).push(d);
  }
  for (const dias of Object.values(porSemana)) {
    for (const ind of indicacion.ejercicios || []) {
      const veces = Math.min(dias.length, ind.por_semana || dias.length);
      const paso = dias.length / veces;
      for (let k = 0; k < veces; k++) {
        const d = dias[Math.floor(k * paso)];
        d.ejercicios.unshift({
          ejercicio_id: ind.ejercicio_id && indice.porId.has(ind.ejercicio_id) ? ind.ejercicio_id : null,
          nombre: ind.nombre, orden: -1, prioridad: 1, series: ind.series || 2,
          reps_min: ind.reps || ind.segundos || 10, reps_max: ind.reps || ind.segundos || 10, unidad: ind.segundos ? 'seg' : 'reps',
          rir: 3, descanso_seg: 60, carga_kg: null, indicacion: true,
          nota: `Indicado por ${indicacion.profesional || 'tu profesional'}${indicacion.fecha ? ` (${indicacion.fecha})` : ''}.`,
        });
        d.ejercicios.forEach((e, i) => { e.orden = i; });
      }
    }
  }
  return { plan: nuevo, quitados };
}
