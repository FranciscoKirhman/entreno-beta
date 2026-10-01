// Cambios a un plan pedidos desde afuera: la IA de la persona (ChatGPT, Claude o Gemini, por conector
// o copiando y pegando) o el coach Pro. Siempre se aplican sobre una copia y después pasa el validador.

export const TIPOS = ['reemplazar_ejercicio', 'cambiar_prescripcion', 'agregar_ejercicio', 'quitar_ejercicio', 'mover_dia'];

// Esquema JSON de un cambio: lo usan el conector MCP y las instrucciones para copiar y pegar.
export const ESQUEMA_CAMBIOS = {
  type: 'object',
  properties: {
    cambios: {
      type: 'array',
      description: 'Lista de cambios al plan, en orden.',
      items: {
        type: 'object',
        properties: {
          tipo: { type: 'string', enum: TIPOS },
          dia: { type: 'string', description: 'Plantilla del día (ej. "torso_a"), que cambia todas las semanas, o una fecha AAAA-MM-DD, que cambia solo ese día.' },
          de: { type: 'string', description: 'reemplazar_ejercicio: id del ejercicio actual. mover_dia: fecha actual.' },
          a: { type: 'string', description: 'reemplazar_ejercicio: id del ejercicio nuevo. mover_dia: fecha nueva.' },
          ejercicio: { type: 'string', description: 'Id del ejercicio (cambiar_prescripcion, agregar_ejercicio, quitar_ejercicio).' },
          series: { type: 'integer', minimum: 1, maximum: 10 },
          reps_min: { type: 'integer', minimum: 1 },
          reps_max: { type: 'integer', minimum: 1 },
          rir: { type: 'integer', minimum: 0, maximum: 5, description: 'Repeticiones de reserva.' },
          carga_kg: { type: 'number', minimum: 0 },
          prioridad: { type: 'integer', minimum: 1, maximum: 4, description: '1 = principal. Si falta tiempo se salta primero el 4.' },
          motivo: { type: 'string', description: 'Por qué, en una frase. Se le muestra a la persona.' },
        },
        required: ['tipo', 'motivo'],
      },
    },
  },
  required: ['cambios'],
};

const esFecha = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

function diasDe(plan, dia) {
  if (esFecha(dia)) return plan.dias.filter(x => x.fecha === dia);
  return plan.dias.filter(x => x.plantilla === dia);
}

/**
 * @returns {{plan, aplicados: object[], rechazados: {cambio, motivo}[]}}
 */
export function aplicarCambios(plan, cambios, indice) {
  const nuevo = structuredClone(plan);
  const aplicados = [], rechazados = [];
  const rechazar = (c, motivo) => rechazados.push({ cambio: c, motivo });
  for (const c of cambios || []) {
    if (!TIPOS.includes(c?.tipo)) { rechazar(c, `Tipo de cambio desconocido: ${c?.tipo}.`); continue; }
    if (c.tipo === 'mover_dia') {
      const d = nuevo.dias.find(x => x.fecha === c.de);
      if (!d || !esFecha(c.a)) { rechazar(c, 'Fecha de origen o destino inválida.'); continue; }
      if (nuevo.dias.some(x => x.fecha === c.a)) { rechazar(c, `Ya hay un entrenamiento el ${c.a}.`); continue; }
      d.fecha = c.a;
      nuevo.dias.sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
      aplicados.push(c);
      continue;
    }
    const dias = diasDe(nuevo, c.dia);
    if (!dias.length) { rechazar(c, `No hay días que calcen con "${c.dia}".`); continue; }
    const idNuevo = c.tipo === 'reemplazar_ejercicio' ? c.a : c.ejercicio;
    if (c.tipo !== 'quitar_ejercicio' && !indice.porId.has(idNuevo)) { rechazar(c, `"${idNuevo}" no está en el catálogo.`); continue; }
    let tocados = 0;
    for (const d of dias) {
      const descarga = d.semana === nuevo.semana_descarga;
      const ajustarSeries = n => (descarga ? Math.max(1, Math.ceil(n / 2)) : n);
      if (c.tipo === 'agregar_ejercicio') {
        if (d.ejercicios.some(e => e.ejercicio_id === c.ejercicio)) continue;
        d.ejercicios.push({
          ejercicio_id: c.ejercicio, nombre: indice.porId.get(c.ejercicio).nombre, orden: d.ejercicios.length,
          prioridad: c.prioridad ?? 3, series: ajustarSeries(c.series ?? 3), reps_min: c.reps_min ?? 8, reps_max: c.reps_max ?? 12,
          unidad: 'reps', rir: Math.min(5, (c.rir ?? 2) + (descarga ? 2 : 0)), descanso_seg: 90, carga_kg: c.carga_kg ?? null, nota: c.motivo,
        });
        tocados++;
        continue;
      }
      const objetivo = c.tipo === 'reemplazar_ejercicio' ? c.de : c.ejercicio;
      const e = d.ejercicios.find(x => x.ejercicio_id === objetivo);
      if (!e) continue;
      if (c.tipo === 'quitar_ejercicio') d.ejercicios = d.ejercicios.filter(x => x !== e);
      else if (c.tipo === 'reemplazar_ejercicio') Object.assign(e, { ejercicio_id: c.a, nombre: indice.porId.get(c.a).nombre, carga_kg: null, nota: c.motivo });
      else {
        for (const k of ['reps_min', 'reps_max', 'carga_kg', 'prioridad']) if (c[k] !== undefined) e[k] = c[k];
        if (c.series !== undefined) e.series = ajustarSeries(c.series);
        if (c.rir !== undefined) e.rir = Math.min(5, c.rir + (descarga ? 2 : 0));
      }
      d.ejercicios.forEach((x, i) => { x.orden = i; });
      tocados++;
    }
    if (tocados) aplicados.push(c);
    else rechazar(c, `Ningún día de "${c.dia}" tiene ese ejercicio.`);
  }
  return { plan: nuevo, aplicados, rechazados };
}

// ── Copiar y pegar con cualquier chat de IA ─────────────────────────────────

const INICIO = '<<<ENTRENO', FIN = 'ENTRENO>>>';

const NOMBRE_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** Texto para pegar en ChatGPT, Claude o Gemini. No incluye nombre, correo ni fecha de nacimiento. */
export function promptParaIA({ derivados: d, plan, permitidos, historial = [], pedido = '' }) {
  const semana = plan.dias.filter(x => x.semana === 1);
  const lineasPlan = semana.map(x => `- ${x.plantilla} (${NOMBRE_DIA[new Date(x.fecha + 'T12:00:00Z').getUTCDay()]}${x.firme ? '' : ', opcional'}): `
    + x.ejercicios.map(e => `${e.ejercicio_id} ${e.series}×${e.reps_min}-${e.reps_max}${e.unidad === 'seg' ? 's' : ''} RIR${e.rir}${e.carga_kg ? ` ${e.carga_kg}kg` : ''}`).join('; '));
  const lineasHist = historial.slice(-12).map(h => `- ${h.fecha} ${h.ejercicio_id}: ${h.carga_kg ?? 'pc'}kg × ${h.reps}${h.rpe != null ? ` @RPE${h.rpe}` : ''}`);
  return [
    'Te paso mi plan de gimnasio de la app Entreno para que me ayudes a ajustarlo. Responde en español.',
    '',
    `Mi perfil: objetivo ${d.objetivo}, nivel ${d.nivel}, sesiones de ${d.duracion_min} minutos, entre ${d.series_rango[0]} y ${d.series_rango[1]} series por músculo a la semana, mínimo ${d.rir_minimo} repeticiones de reserva.`,
    '',
    'Mi semana tipo (id del ejercicio, series×repeticiones, repeticiones de reserva, carga):',
    ...lineasPlan,
    ...(lineasHist.length ? ['', 'Lo último que registré:', ...lineasHist] : []),
    '',
    `Solo puedes usar estos ejercicios (los demás no los puedo hacer por equipamiento o lesión): ${permitidos.map(e => e.id).join(', ')}.`,
    '',
    'Reglas que la app aplica igual: la carga sube solo cuando completo todas las series en el tope de repeticiones; la cuarta semana es de descarga; no se puede pasar el tope de series por músculo.',
    '',
    pedido ? `Lo que quiero cambiar: ${pedido}` : 'Pregúntame qué quiero cambiar antes de proponer algo.',
    '',
    `Cuando tengas la propuesta, explícamela y al final pon los cambios entre ${INICIO} y ${FIN}, en JSON con esta forma, para pegarlos en la app:`,
    `${INICIO}`,
    '{"cambios": [{"tipo": "reemplazar_ejercicio", "dia": "torso_a", "de": "id_actual", "a": "id_nuevo", "motivo": "..."}]}',
    `${FIN}`,
    `Tipos posibles: ${TIPOS.join(', ')}. "dia" es la plantilla (cambia todas las semanas) o una fecha AAAA-MM-DD. Campos: de, a, ejercicio, series, reps_min, reps_max, rir, carga_kg, prioridad, motivo.`,
  ].join('\n');
}

/** Saca los cambios del texto que respondió la IA. Acepta que vengan dentro de un bloque ```json. */
export function leerRespuestaIA(texto) {
  const i = texto.lastIndexOf(INICIO), j = texto.lastIndexOf(FIN);
  if (i < 0 || j < i) return { ok: false, error: `No encontré el bloque entre ${INICIO} y ${FIN}. Pídele a tu IA que lo agregue al final.` };
  const crudo = texto.slice(i + INICIO.length, j).replace(/```(json)?/g, '').trim();
  let datos;
  try { datos = JSON.parse(crudo); } catch { return { ok: false, error: 'El bloque no es JSON válido. Pídele a tu IA que lo corrija.' }; }
  if (!Array.isArray(datos?.cambios)) return { ok: false, error: 'El bloque no tiene una lista "cambios".' };
  return { ok: true, cambios: datos.cambios };
}
