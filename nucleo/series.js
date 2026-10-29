// Cada serie: esfuerzo (RPE o RIR), fallo, qué priorizar si no salen las repeticiones o la reserva sale
// distinta, y un consejo para la serie siguiente. Ver contenido/evidencia/00-principios.md, sección 4.

/** Opciones de esfuerzo: una sola lista con las dos escalas (RPE = 10 − RIR), como en Hevy. */
export const ESFUERZO = [
  { rpe: 10, rir: 0, etiqueta: 'Fallo · RPE 10 · RIR 0' },
  { rpe: 9.5, rir: 0.5, etiqueta: 'RPE 9,5 · quizás 1 más' },
  { rpe: 9, rir: 1, etiqueta: 'RPE 9 · RIR 1' },
  { rpe: 8.5, rir: 1.5, etiqueta: 'RPE 8,5 · RIR 1 a 2' },
  { rpe: 8, rir: 2, etiqueta: 'RPE 8 · RIR 2' },
  { rpe: 7.5, rir: 2.5, etiqueta: 'RPE 7,5 · RIR 2 a 3' },
  { rpe: 7, rir: 3, etiqueta: 'RPE 7 · RIR 3' },
  { rpe: 6, rir: 4, etiqueta: 'RPE 6 o menos · RIR 4+' },
];

/** Reserva de una serie anotada: RIR directo, o 10 − RPE; con fallo, 0. */
export function reservaDe(s) {
  if (s.fallo) return 0;
  if (s.rir != null && s.rir !== '') return Number(s.rir);
  if (s.rpe != null && s.rpe !== '') return 10 - Number(s.rpe);
  return null;
}

/**
 * Qué priorizar cuando las repeticiones y la reserva no calzan.
 * - Reserva (RIR): en los ejercicios grandes, para principiantes, con alerta médica o con una molestia en la zona.
 *   Es más seguro y la técnica no se rompe; llegar al fallo no da más músculo.
 * - Repeticiones: en los aislados de quien ya entrena, donde acercarse más al fallo tiene poco riesgo.
 */
export function prioridadEsfuerzo(e, ej, d = {}, zonasConMolestia = []) {
  const grande = ej?.tipo === 'compuesto';
  const cuidado = d.nivel === 'principiante' || (d.rir_minimo ?? 0) >= 3 || (ej?.carga_articular || []).some(a => zonasConMolestia.includes(a));
  if (grande || cuidado || e.unidad === 'seg' || e.unidad === 'm') {
    return { prioriza: 'rir', texto: `Prioriza la reserva: deja ${e.rir} repeticiones sin hacer. Si con ${e.rir} en reserva no llegas a ${e.reps_min}, para ahí y no fuerces; es mejor una repetición menos que llegar al fallo.` };
  }
  return { prioriza: 'reps', texto: `Prioriza las repeticiones: completa ${e.reps_min} a ${e.reps_max} aunque te quede menos reserva. En la última serie puedes llegar cerca del fallo.` };
}

/**
 * Consejo para la serie siguiente según cómo salió esta.
 * @param e  prescripción del ejercicio
 * @param s  serie hecha { kg, reps, rir?, rpe?, fallo? }
 * @param incremento kg que se pueden sumar o restar (null en peso corporal)
 * @param o.previas  series de trabajo ya hechas hoy en este ejercicio, antes de esta (para ver si va bajando)
 * @param o.quedan   series de trabajo que faltan; con 0 no se habla de "la siguiente". Sin contexto (null), como antes.
 * @param o.lastre   el ejercicio de peso corporal tiene versión con lastre (dominadas, fondos): con eso se le suma peso
 * @param o.correccion lo que suele quedarle de más según su serie de comprobación (nucleo/comprobacion-rir.js): se suma a
 *                   la reserva anotada, salvo al fallo
 * @param o.tecnica  'tecnica' o 'rango' si el ejercicio va con la técnica primero (nucleo/tecnica-primero.js): aunque
 *                   sobre, el peso no sube hoy
 * @returns {{tipo, texto, kg?}} kg: el peso sugerido para la serie siguiente, que la app deja en gris
 */
export function consejoSerie(e, s, incremento = null, o = {}) {
  const { correccion = 0, tecnica = null, quedan = null } = o;
  const corregir = x => (correccion > 0 && !x.fallo && reservaDe(x) != null ? { ...x, rir: reservaDe(x) + correccion, rpe: null } : x);
  let c = consejoConContexto(e, corregir(s), incremento, { ...o, previas: (o.previas || []).map(corregir) });
  // Si la corrección cambió el consejo a subir, se dice por qué: lo anotado decía otra cosa.
  if (c && correccion > 0 && c.tipo === 'subir' && consejoConContexto(e, s, incremento, o)?.tipo !== 'subir') {
    c = { ...c, texto: `Según tu serie de comprobación, te quedan unas ${correccion} más de las que anotas. ${c.texto}` };
  }
  if (!c || !tecnica || c.tipo !== 'subir' || quedan == null) return c;
  return quedan === 0
    ? { tipo: 'mantener', texto: `Listo con este ejercicio. Te sobró: si ${tecnica === 'rango' ? 'el rango salió completo' : 'salió limpia'}, márcalo en la tarjeta y la próxima vez sube.` }
    : { tipo: 'mantener', texto: 'Te sobró, pero hoy va la técnica primero: mismo peso. Si sale limpia, haz una repetición más o baja en 3 segundos.' };
}

function consejoConContexto(e, s, incremento = null, { asistido = false, lastre = false, previas = [], quedan = null } = {}) {
  const c = consejoSolo(e, s, incremento, { asistido, lastre });
  if (!c || quedan == null) return c;
  const r = reservaDe(s), reps = Number(s.reps), kg = Number(s.kg);
  const pasada = pasoDe(r, e.rir);
  if (quedan === 0) {
    const misma = corporalDe(s, incremento, asistido) ? 'la próxima vez apunta a lo mismo.' : `la próxima vez parte con la misma ${asistido ? 'ayuda' : 'carga'}.`;
    const cierre = c.tipo === 'bien' ? 'Justo lo pedido.' : c.tipo === 'subir' ? `Te sobró: ${proximaVez(s, incremento, { asistido, lastre })}`
      : pasada || s.fallo ? `Terminaste más cerca del fallo que lo pedido: ${misma}` : `Quedaste bajo el rango: ${misma}`;
    return { tipo: c.tipo, texto: `Listo con este ejercicio. ${cierre}` };
  }
  // Rango objetivo de la serie siguiente: desde `desde` hasta 2 más, sin salir del rango del plan. En gris va el mínimo.
  const rango = desde => {
    const lo = Math.max(e.reps_min || 1, Math.min(desde, e.reps_max || desde));
    const hi = Math.max(lo, Math.min(lo + 2, e.reps_max || lo + 2));
    return { reps: lo, rango: [lo, hi], texto: lo === hi ? `${lo}` : `${lo} a ${hi}` };
  };
  if (asistido || !(kg > 0) || !incremento) {
    // Sin peso que sugerir (peso corporal o asistido), igual se dice cuántas repeticiones buscar.
    if (!pasada && c.tipo !== 'bajar') return c;
    const o = rango(reps - 1);
    return { ...c, texto: `${c.texto} Apunta a ${o.texto} repeticiones.`, reps: o.reps, rango: o.rango };
  }
  const n = x => String(Math.round(x * 100) / 100).replace('.', ',');
  const ultima = previas.at(-1);
  const otraVez = ultima && pasoDe(reservaDe(ultima), e.rir);
  const cayeron = ultima && Number(ultima.reps) > reps;
  // Con el mismo peso, perder 3 repeticiones o más (o un 20%) de una serie a otra ya dice que la carga quedó alta,
  // aunque la serie caiga dentro del rango: 35 × 15 y después 35 × 10 no es "justo lo pedido".
  const perdidas = ultima && Number(ultima.kg) === kg ? Number(ultima.reps) - reps : 0;
  const caidaFuerte = perdidas >= Math.max(3, Math.ceil(0.2 * Number(ultima?.reps || 0)));
  // Las mismas repeticiones que la anterior con el mismo peso, dentro del rango y sin fallo: con 1 de reserva o menos de
  // verdad, lo normal es que la serie siguiente baje. Lo que no calza es la reserva anotada, no el peso, así que no se
  // baja (Francisco, 28 de octubre de 2026: con 10, 10 y 10 "a RIR 1" la app bajaba a quien levantaba de menos).
  const planas = Boolean(ultima) && Number(ultima.kg) === kg && reps >= Number(ultima.reps) && reps >= (e.reps_min || 0) && !s.fallo;
  if (planas && (otraVez || c.tipo === 'bajar') && !caidaFuerte) {
    const o = rango(reps);
    return { tipo: 'mantener', texto: `Te salieron ${reps}, igual que la anterior: con ${r ?? 0} de reserva de verdad, lo normal es que esta baje. Mantén ${n(kg)} kg; puede que te quede más de lo que anotas.`, reps: o.reps, rango: o.rango };
  }
  // Más duro de lo pedido dos veces, o con las repeticiones cayendo: se baja un 5% (al menos un escalón), que es lo que
  // pierde la fuerza entre series cuando se va cerca del fallo. El peso queda en gris en la serie siguiente.
  if (c.tipo === 'bajar' || (pasada && (otraVez || cayeron)) || caidaFuerte) {
    // Con la fórmula de Epley, el peso con el que esta serie habría salido en el rango pedido (repeticiones mínimas más
    // la reserva): 75 × 6 al fallo pidiendo 10 a 12 con 1 en reserva da unos 65, no 72,5. Se usa lo que baje más entre
    // eso y el 5%, siempre al menos un escalón.
    const hechas = reps + (r ?? 0), pedidas = (e.reps_min || reps) + (e.rir ?? 0);
    const porEpley = kg * (1 + hechas / 30) / (1 + pedidas / 30);
    const objetivo = Math.min(kg - Math.max(incremento, kg * 0.05), porEpley);
    const nuevo = Math.max(incremento, Math.floor(objetivo / incremento + 1e-9) * incremento);
    const por = c.tipo === 'bajar' ? c.texto.replace(/:.*$|\. En la siguiente.*$/, '')
      : caidaFuerte ? `Bajaste de ${ultima.reps} a ${reps} repeticiones con el mismo peso`
      : otraVez ? `Dos series seguidas más cerca del fallo que lo pedido (${e.rir} en reserva)` : `Bajaron las repeticiones y quedaste más cerca del fallo que lo pedido (${e.rir} en reserva)`;
    // Las repeticiones en gris también siguen: con menos peso, apuntar a lo que salió (dentro del rango), no al tope.
    const o = rango(reps);
    return { tipo: 'bajar', texto: `${por}. La siguiente con ${n(nuevo)} kg para ${o.texto} repeticiones: te lo dejé en gris.`, kg: nuevo, reps: o.reps, rango: o.rango };
  }
  if (c.tipo === 'subir') {
    // Con un escalón más se pierden un par de repeticiones. Se dice el peso, no "un escalón", como cuando baja.
    const o = rango(reps - 2);
    return { ...c, texto: `${c.texto.replace(/:.*$/, '')}. La siguiente con ${n(kg + incremento)} kg para ${o.texto} repeticiones: te lo dejé en gris.`, kg: kg + incremento, reps: o.reps, rango: o.rango };
  }
  // Más cerca del fallo pero con el peso bien: con el cansancio sale una menos, así que se apunta a eso, no al tope.
  if (pasada) {
    const o = rango(reps - 1);
    return { ...c, texto: `${c.texto} Apunta a ${o.texto} repeticiones.`, reps: o.reps, rango: o.rango };
  }
  return c;
}

/** Más cerca del fallo que lo pedido. Con 1 de reserva o menos, medio punto ya cuenta: RPE 9,5 pidiendo RIR 1 no es
 *  "justo lo pedido" (Francisco, 21 de octubre de 2026). Con más reserva pedida, medio punto es ruido de la escala. */
const pasoDe = (r, rir) => r != null && (r < rir - 0.5 || (rir <= 1 && r <= rir - 0.5));

const kgTexto = x => `${String(Math.round(x * 100) / 100).replace('.', ',')} kg`;
/** Sin peso anotado ni escalón de equipo (dominadas, fondos): no hay kilos que subir o bajar en la serie siguiente. */
const corporalDe = (s, incremento, asistido) => !asistido && !(Number(s.kg) > 0) && !incremento;
const MAS_LENTA = 'hazla más lenta: 3 segundos al bajar y 1 de pausa en la parte más difícil';
const CON_LASTRE = 'agrega 2,5 kg con cinturón o un disco';

/**
 * Qué cambiar en la serie siguiente, en concreto: el peso al que ir y no "un escalón" (Francisco, 28 de octubre de 2026:
 * "sube un escalón es muy genérico"). En los asistidos el peso es ayuda: costar más es bajarla. Sin peso que tocar,
 * menos es null y el texto pide parar antes.
 */
function cambioDe(s, incremento, asistido) {
  const kg = Number(s.kg) > 0 ? Number(s.kg) : null, paso = incremento || (kg ? 2.5 : null);
  if (asistido) return {
    mas: kg && paso ? (kg - paso > 0 ? `baja la ayuda a ${kgTexto(kg - paso)}` : 'hazla sin ayuda') : paso ? `baja la ayuda ${kgTexto(paso)}` : 'baja la ayuda',
    menos: kg && paso ? `sube la ayuda a ${kgTexto(kg + paso)}` : paso ? `sube la ayuda ${kgTexto(paso)}` : 'sube la ayuda',
  };
  if (!kg) return { mas: `súbele ${kgTexto(paso)}`, menos: `bájale ${kgTexto(paso)}` };
  return { mas: `sube a ${kgTexto(kg + paso)}`, menos: kg - paso > 0 ? `baja a ${kgTexto(kg - paso)}` : null };
}

/** "Te sobró: …" al terminar el ejercicio: con qué partir la próxima vez. */
function proximaVez(s, incremento, { asistido, lastre }) {
  const kg = Number(s.kg) > 0 ? Number(s.kg) : null, paso = incremento || (kg ? 2.5 : null);
  if (corporalDe(s, incremento, asistido)) return lastre ? `la próxima vez ${CON_LASTRE}.` : 'la próxima vez hazla más lenta o con más repeticiones.';
  if (!kg || !paso) return 'la próxima vez puede costar un poco más.';
  if (asistido) return kg - paso > 0 ? `la próxima vez puede ir con ${kgTexto(kg - paso)} de ayuda.` : 'la próxima vez prueba sin ayuda.';
  return `la próxima vez puede ir con ${kgTexto(kg + paso)}.`;
}

function consejoSolo(e, s, incremento = null, { asistido = false, lastre = false } = {}) {
  const reps = Number(s.reps);
  if (!reps || e.unidad === 'seg' || e.unidad === 'm') return null;
  const r = reservaDe(s);
  if (corporalDe(s, incremento, asistido)) return consejoCorporal(e, reps, r, s.fallo, lastre);
  const { mas, menos } = cambioDe(s, incremento, asistido);
  const antes = menos ? `${menos} o haz 1 a 2 repeticiones menos` : 'haz 1 a 2 repeticiones menos';
  if (s.fallo && e.rir >= 1) return { tipo: 'bajar', texto: `Llegaste al fallo y el plan pedía dejar ${e.rir}. En la siguiente serie ${antes}.` };
  if (reps < e.reps_min && r != null && r < e.rir) return { tipo: 'bajar', texto: `No llegaste a ${e.reps_min} y quedaste más cerca del fallo de lo pedido: ${menos ? `${menos} para la siguiente` : 'en la siguiente haz 1 a 2 repeticiones menos'}.` };
  if (reps < e.reps_min && (r == null || r >= e.rir)) return { tipo: 'mantener', texto: `Paraste antes del rango con reserva de sobra. Si te sentías bien, en la siguiente intenta llegar a ${e.reps_min}.` };
  if (reps > e.reps_max && (r == null || r >= e.rir)) return { tipo: 'subir', texto: `Te pasaste del rango con reserva: en la siguiente serie ${mas}.` };
  if (r != null && r > e.rir + 1.5) return { tipo: 'subir', texto: `Te sobraban más repeticiones de las pedidas: ${mas} o haz más repeticiones.` };
  if (r != null && r < e.rir - 1.5) return { tipo: 'bajar', texto: `Quedaste mucho más cerca del fallo que lo pedido (${e.rir} en reserva): ${menos ? `${menos} para la siguiente` : 'en la siguiente haz 1 a 2 repeticiones menos'}.` };
  if (pasoDe(r, e.rir)) return { tipo: 'mantener', texto: `Quedaste más cerca del fallo que lo pedido (${e.rir} en reserva). Mantén ${asistido ? 'la ayuda' : 'la carga'} y no fuerces más.` };
  return { tipo: 'bien', texto: 'Justo lo pedido. Sigue igual.' };
}

/** Con el cuerpo (dominadas, fondos, flexiones): más difícil es más lenta o, si quedó sobre el rango, con lastre; más
 *  fácil es parar antes. */
function consejoCorporal(e, reps, r, fallo, lastre) {
  const sobra = reps >= e.reps_max ? `En la siguiente serie, ${MAS_LENTA}.${lastre ? ` Si igual te sobra, la próxima sesión ${CON_LASTRE}.` : ''}`
    : `En la siguiente haz más, hasta ${e.reps_max}, o ${MAS_LENTA}.`;
  if (fallo && e.rir >= 1) return { tipo: 'bajar', texto: `Llegaste al fallo y el plan pedía dejar ${e.rir}. En la siguiente serie para 1 a 2 repeticiones antes.` };
  if (reps < e.reps_min && r != null && r < e.rir) return { tipo: 'bajar', texto: `No llegaste a ${e.reps_min} y quedaste más cerca del fallo de lo pedido. En la siguiente para con ${e.rir} en reserva, aunque salgan menos.` };
  if (reps < e.reps_min && (r == null || r >= e.rir)) return { tipo: 'mantener', texto: `Paraste antes del rango con reserva de sobra. Si te sentías bien, en la siguiente intenta llegar a ${e.reps_min}.` };
  if (reps > e.reps_max && (r == null || r >= e.rir)) return { tipo: 'subir', texto: `Te pasaste del rango con reserva. ${sobra}` };
  if (r != null && r > e.rir + 1.5) return { tipo: 'subir', texto: `Te sobraban más repeticiones de las pedidas. ${sobra}` };
  if (r != null && r < e.rir - 1.5) return { tipo: 'bajar', texto: `Quedaste mucho más cerca del fallo que lo pedido (${e.rir} en reserva). En la siguiente para 1 a 2 repeticiones antes.` };
  if (pasoDe(r, e.rir)) return { tipo: 'mantener', texto: `Quedaste más cerca del fallo que lo pedido (${e.rir} en reserva). En la siguiente para antes y no fuerces más.` };
  return { tipo: 'bien', texto: 'Justo lo pedido. Sigue igual.' };
}
