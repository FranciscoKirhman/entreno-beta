// Servidor MCP: deja que el ChatGPT, Claude o Gemini de cada persona lea su plan e historial, registre
// sesiones y proponga cambios. Implementa a mano lo mínimo del protocolo (JSON-RPC sobre HTTP, sin SSE):
// initialize, tools/list, tools/call y ping. La función del servidor (supabase/functions/mcp) solo
// autentica y le pasa a esto un acceso a los datos de esa persona.
//
// Nada de lo que propone la IA se guarda sin pasar por el validador.
import { aplicarCambios, ESQUEMA_CAMBIOS } from './cambios.js';
import { validarPlan } from './validador.js';
import { tieneEquipo, nivelAlcanza, cargaZonaBloqueada, articulacionesBloqueadas } from './catalogo.js';
import { moverSesion, intercambiar, marcarFaltada, opcionesParaHoy, sesionDe } from './agenda.js';
import { evaluarDia, TEXTO_RECOMENDACION } from './bienestar.js';
import { explicarEjercicio } from './explicar.js';
import { planDeCuidado } from './cuidado.js';
import { leerPlanTexto, calendarizar } from './importar-plan.js';

export const VERSIONES = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const SERVIDOR = { name: 'entreno', title: 'Entreno', version: '0.2.0' };

const texto = obj => ({ content: [{ type: 'text', text: typeof obj === 'string' ? obj : JSON.stringify(obj, null, 1) }] });

/** Ejercicios que esta persona puede hacer: equipamiento de su lugar principal, nivel y lesiones. */
export function permitidos({ indice, respuestas: r, derivados: d, hoy }) {
  const lugar = (r.lugares || []).find(l => l.principal) || (r.lugares || [])[0] || { equipamiento: [] };
  const bloqueadas = articulacionesBloqueadas(r.lesiones || [], hoy);
  return indice.ejercicios.filter(e => tieneEquipo(e, lugar.equipamiento || []) && nivelAlcanza(d.nivel, e.nivel_minimo) && !cargaZonaBloqueada(e, bloqueadas));
}

/**
 * @typedef {object} Datos  acceso a los datos de la persona autenticada (en la función: Supabase con RLS)
 * @property {() => Promise<{respuestas, derivados}>} perfil
 * @property {() => Promise<object|null>} planActivo
 * @property {(plan: object) => Promise<void>} guardarPlan
 * @property {(semanas: number) => Promise<object[]>} historial   sesiones con sus series
 * @property {(sesion: object) => Promise<string>} registrarSesion
 */
export const HERRAMIENTAS = [
  {
    name: 'ver_resumen',
    title: 'Ver mi resumen',
    description: 'Objetivo, nivel, días, lugar, lesiones activas y el plan de esta semana de la persona en Entreno. Úsalo primero.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async run(_, { datos, hoy }) {
      const { respuestas: r, derivados: d } = await datos.perfil();
      const plan = await datos.planActivo();
      const semana = plan?.dias.filter(x => x.fecha >= hoy).slice(0, Math.min(6, d.dias_meta)) || [];
      return texto({
        objetivo: d.objetivo, nivel: d.nivel, dias_por_semana: d.dias_meta, dias_firmes: d.dias_firmes, minutos_por_sesion: d.duracion_min,
        series_por_musculo_semana: d.series_rango, repeticiones_de_reserva_minimas: d.rir_minimo,
        lesiones_activas: (r.lesiones || []).filter(l => l.activa !== false).map(l => ({ zona: l.region, tipo: l.tipo, intensidad: l.intensidad, alta: l.alta || null })),
        lugar: ((r.lugares || []).find(l => l.principal) || (r.lugares || [])[0])?.nombre || null,
        plan: plan ? { inicio: plan.inicio, semana_descarga: plan.semana_descarga, proximos_dias: semana } : null,
      });
    },
  },
  {
    name: 'ver_historial',
    title: 'Ver historial',
    description: 'Sesiones registradas en las últimas semanas, con cada serie (carga, repeticiones, RPE).',
    inputSchema: { type: 'object', properties: { semanas: { type: 'integer', minimum: 1, maximum: 12, default: 4 } } },
    annotations: { readOnlyHint: true },
    async run({ semanas = 4 }, { datos }) { return texto(await datos.historial(Math.min(12, Math.max(1, semanas)))); },
  },
  {
    name: 'buscar_ejercicios',
    title: 'Buscar ejercicios',
    description: 'Ejercicios que esta persona puede hacer con su equipamiento, su nivel y sus lesiones. Usa solo estos ids al proponer cambios.',
    inputSchema: { type: 'object', properties: { texto: { type: 'string' }, patron: { type: 'string' } } },
    annotations: { readOnlyHint: true },
    async run({ texto: q = '', patron }, ctx) {
      const { respuestas, derivados } = await ctx.datos.perfil();
      const lista = permitidos({ ...ctx, respuestas, derivados })
        .filter(e => (!patron || e.patron === patron) && (!q || `${e.id} ${e.nombre} ${e.nombre_hevy}`.toLowerCase().includes(q.toLowerCase())));
      return texto(lista.map(e => ({ id: e.id, nombre: e.nombre, patron: e.patron, musculos: e.musculos_primarios })));
    },
  },
  {
    name: 'proponer_cambios',
    title: 'Proponer cambios al plan',
    description: 'Prueba cambios al plan activo. Con aplicar=false solo los revisa; con aplicar=true los guarda si pasan todas las reglas de la app. Confírmalo con la persona antes de aplicar.',
    inputSchema: { ...ESQUEMA_CAMBIOS, properties: { ...ESQUEMA_CAMBIOS.properties, aplicar: { type: 'boolean', default: false } } },
    annotations: { destructiveHint: false, idempotentHint: false },
    async run({ cambios, aplicar = false }, ctx) {
      const { datos, indice, hoy } = ctx;
      const plan = await datos.planActivo();
      if (!plan) return { ...texto('No hay un plan activo. La persona tiene que completar el cuestionario en la app.'), isError: true };
      const { respuestas, derivados } = await datos.perfil();
      const r = aplicarCambios(plan, cambios, indice);
      const v = validarPlan(r.plan, { derivados, respuestas, indice, hoy });
      const listo = aplicar && v.ok && r.aplicados.length > 0;
      if (listo && ctx.soloProponer) ctx.propuesta = { ...r.plan, generado_por: 'ia_externa' };
      else if (listo) await datos.guardarPlan({ ...r.plan, generado_por: 'ia_externa' });
      return texto({ guardado: listo && !ctx.soloProponer, ...(listo && ctx.soloProponer ? { esperando_confirmacion: true } : {}), aplicados: r.aplicados, rechazados: r.rechazados, errores_de_validacion: v.errores, advertencias: v.advertencias });
    },
  },
  {
    name: 'registrar_sesion',
    title: 'Registrar una sesión',
    description: 'Anota una sesión hecha: fecha y, por ejercicio, cada serie con carga, repeticiones y repeticiones de reserva.',
    inputSchema: {
      type: 'object',
      properties: {
        fecha: { type: 'string', description: 'AAAA-MM-DD' },
        titulo: { type: 'string' },
        ejercicios: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ejercicio: { type: 'string', description: 'Id del catálogo (buscar_ejercicios).' },
              series: { type: 'array', items: { type: 'object', properties: { carga_kg: { type: 'number' }, reps: { type: 'integer' }, rir: { type: 'number' } }, required: ['reps'] } },
            },
            required: ['ejercicio', 'series'],
          },
        },
      },
      required: ['fecha', 'ejercicios'],
    },
    async run({ fecha, titulo, ejercicios }, { datos, indice }) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) return { ...texto('Fecha inválida: usa AAAA-MM-DD.'), isError: true };
      const desconocidos = ejercicios.map(e => e.ejercicio).filter(id => !indice.porId.has(id));
      if (desconocidos.length) return { ...texto(`No están en el catálogo: ${desconocidos.join(', ')}. Usa buscar_ejercicios.`), isError: true };
      let orden = 0;
      const series = ejercicios.flatMap(e => e.series.map(s => ({
        orden: orden++, ejercicio_id: e.ejercicio, ejercicio_nombre: indice.porId.get(e.ejercicio).nombre,
        tipo: 'efectiva', carga_kg: s.carga_kg ?? null, reps: s.reps, rir: s.rir ?? null,
      })));
      const id = await datos.registrarSesion({ sesion: { fecha, titulo: titulo || 'Sesión', origen: 'manual' }, series });
      return texto({ registrada: true, id, series: series.length });
    },
  },
];

/**
 * Valida un plan cambiado y lo guarda si pasa; si no, devuelve los errores sin guardar nada. Con ctx.soloProponer
 * (el chat del coach en la app) no guarda: deja el plan en ctx.propuesta y la persona lo confirma con un botón.
 */
async function validarYGuardar(nuevo, ctx, origen) {
  const { respuestas, derivados } = await ctx.datos.perfil();
  const v = validarPlan(nuevo, { derivados, respuestas, indice: ctx.indice, hoy: ctx.hoy });
  const plan = { ...nuevo, generado_por: origen || nuevo.generado_por };
  if (v.ok && ctx.soloProponer) { ctx.propuesta = plan; return { ...v, propuesto: true }; }
  if (v.ok) await ctx.datos.guardarPlan(plan);
  return v;
}
/** Lo que se le cuenta a la IA después de un cambio: guardado, o esperando que la persona lo confirme. */
const estado = v => ({ guardado: v.ok && !v.propuesto, ...(v.propuesto ? { esperando_confirmacion: true } : {}) });

const FECHA = { type: 'string', description: 'AAAA-MM-DD' };
HERRAMIENTAS.push(
  {
    name: 'opciones_para_hoy',
    title: 'Opciones para hoy',
    description: 'Cuando la persona no quiere o no puede hacer la sesión de hoy: sesiones de esta semana que se pueden traer a hoy, descanso activo o mover la de hoy. Solo propone; para aplicar usa intercambiar_sesiones, mover_sesion o marcar_faltada.',
    inputSchema: { type: 'object', properties: { fecha: FECHA, evitar: { type: 'string', enum: ['pierna', 'torso', 'empuje', 'tiron', 'cuerpo'], description: 'Grupo que no quiere hacer.' } } },
    annotations: { readOnlyHint: true },
    async run({ fecha, evitar }, ctx) { return texto(opcionesParaHoy(await ctx.datos.planActivo(), fecha || ctx.hoy, { evitar })); },
  },
  {
    name: 'mover_sesion',
    title: 'Mover una sesión',
    description: 'Mueve una sesión a otro día libre. Si el destino ya tiene sesión, usa intercambiar_sesiones.',
    inputSchema: { type: 'object', properties: { de: FECHA, a: FECHA }, required: ['de', 'a'] },
    async run({ de, a }, ctx) {
      const { respuestas } = await ctx.datos.perfil();
      const r = moverSesion(await ctx.datos.planActivo(), de, a, { noPuedo: respuestas.dias_no_puedo || [] });
      if (!r.ok) return { ...texto(r.error), isError: true };
      const v = await validarYGuardar(r.plan, ctx);
      return texto({ ...estado(v), cambios: r.cambios, avisos: r.avisos, errores: v.errores });
    },
  },
  {
    name: 'intercambiar_sesiones',
    title: 'Intercambiar dos sesiones',
    description: 'Cambia de día dos sesiones entre sí (por ejemplo, hacer hoy la de torso y la de pierna otro día).',
    inputSchema: { type: 'object', properties: { fecha_a: FECHA, fecha_b: FECHA }, required: ['fecha_a', 'fecha_b'] },
    async run({ fecha_a, fecha_b }, ctx) {
      const r = intercambiar(await ctx.datos.planActivo(), fecha_a, fecha_b);
      if (!r.ok) return { ...texto(r.error), isError: true };
      const v = await validarYGuardar(r.plan, ctx);
      return texto({ ...estado(v), cambios: r.cambios, avisos: r.avisos, errores: v.errores });
    },
  },
  {
    name: 'marcar_faltada',
    title: 'Marcar una sesión como faltada',
    description: 'La persona faltó: reacomoda esa sesión y las que quedan de la semana en los días libres, sin juntar el mismo grupo muscular. Si no caben, se pierde primero lo opcional.',
    inputSchema: { type: 'object', properties: { fecha: FECHA }, required: ['fecha'] },
    async run({ fecha }, ctx) {
      const { respuestas } = await ctx.datos.perfil();
      const r = marcarFaltada(await ctx.datos.planActivo(), fecha, { hoy: ctx.hoy, noPuedo: respuestas.dias_no_puedo || [] });
      if (!r.ok) return { ...texto(r.error), isError: true };
      const v = await validarYGuardar(r.plan, ctx);
      return texto({ ...estado(v), cambios: r.cambios, avisos: r.avisos, errores: v.errores });
    },
  },
  {
    name: 'registrar_bienestar',
    title: 'Registrar cómo está hoy',
    description: 'Check-in diario: sueño, cansancio, ánimo, estrés, dolor. Devuelve si la sesión de hoy conviene normal, liviana, corta o descanso activo.',
    inputSchema: {
      type: 'object',
      properties: {
        fecha: FECHA, sueno_horas: { type: 'number' }, sueno_calidad: { type: 'integer', minimum: 1, maximum: 5 },
        cansancio: { type: 'integer', minimum: 1, maximum: 5, description: '5 = agotado' }, animo: { type: 'integer', minimum: 1, maximum: 5 },
        estres: { type: 'integer', minimum: 1, maximum: 5 }, dolor: { type: 'integer', minimum: 0, maximum: 10 },
        enfermo: { type: 'string', enum: ['no', 'resfrio', 'fiebre_o_cuerpo'] },
      },
    },
    async run(args, ctx) {
      const ev = evaluarDia(args);
      await ctx.datos.guardarBienestar?.({ ...args, fecha: args.fecha || ctx.hoy, puntaje: ev.puntaje, recomendacion: ev.recomendacion });
      return texto({ ...ev, que_hacer: TEXTO_RECOMENDACION[ev.recomendacion] });
    },
  },
  {
    name: 'explicar_ejercicio',
    title: 'Explicar un ejercicio',
    description: 'Por qué el plan tiene este ejercicio con estas series, repeticiones y reserva, con los papers que lo respaldan y un enlace a videos de técnica.',
    inputSchema: { type: 'object', properties: { ejercicio: { type: 'string', description: 'Id del catálogo.' }, fecha: FECHA }, required: ['ejercicio'] },
    annotations: { readOnlyHint: true },
    async run({ ejercicio, fecha }, ctx) {
      const plan = await ctx.datos.planActivo();
      const { respuestas } = await ctx.datos.perfil();
      const dia = (fecha && sesionDe(plan, fecha)) || plan?.dias.find(d => d.ejercicios.some(e => e.ejercicio_id === ejercicio));
      const e = dia?.ejercicios.find(x => x.ejercicio_id === ejercicio);
      if (!e) return { ...texto('Ese ejercicio no está en el plan.'), isError: true };
      return texto(explicarEjercicio({ e, dia, plan, respuestas, indice: ctx.indice, evidencia: ctx.evidencia }));
    },
  },
  {
    name: 'importar_plan_texto',
    title: 'Importar un plan escrito',
    description: 'Transforma un plan escrito (días y ejercicios con series×repeticiones) en sesiones agendadas. Con aplicar=false muestra lo que entendió y lo que no reconoció; con aplicar=true lo guarda si todo se reconoció.',
    inputSchema: { type: 'object', properties: { texto: { type: 'string' }, inicio: FECHA, semanas: { type: 'integer', minimum: 1, maximum: 12 }, aplicar: { type: 'boolean' } }, required: ['texto'] },
    async run({ texto: t, inicio, semanas = 4, aplicar = false }, ctx) {
      const imp = leerPlanTexto(t, ctx.indice);
      const lunes = inicio || (() => { const d = new Date(ctx.hoy + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7)); return d.toISOString().slice(0, 10); })();
      const plan = calendarizar(imp, { inicio: lunes, semanas, indice: ctx.indice });
      if (!aplicar || imp.revisar.length) return texto({ guardado: false, dias: imp.dias.map(d => ({ titulo: d.titulo, ejercicios: d.ejercicios.map(e => e.ejercicio_id || `¿${e.nombre}?`) })), por_revisar: imp.revisar });
      const v = await validarYGuardar(plan, ctx, 'importado');
      return texto({ ...estado(v), errores: v.errores, advertencias: v.advertencias });
    },
  },
  {
    name: 'plan_de_cuidado',
    title: 'Orientación ante una molestia',
    description: 'Ejercicios de cuidado por fases para una zona con molestia. Siempre incluye el aviso de que no reemplaza una evaluación profesional; si hay señales de alarma o dolor de 7 o más, deriva. Requiere que la persona haya aceptado el consentimiento de cuidado en la app.',
    inputSchema: { type: 'object', properties: { zona: { type: 'string', enum: ['hombro', 'codo', 'muneca', 'lumbar', 'cadera', 'rodilla', 'tobillo', 'cuello'] }, intensidad: { type: 'integer', minimum: 0, maximum: 10 }, dias: { type: 'integer' }, senales: { type: 'array', items: { type: 'string' } } }, required: ['zona'] },
    annotations: { readOnlyHint: true },
    async run(args, ctx) {
      const consentimientos = (await ctx.datos.consentimientos?.()) || {};
      const indicaciones = (await ctx.datos.indicaciones?.()) || [];
      const indicacion = indicaciones.find(i => i.activa !== false && (!i.fecha || i.fecha <= ctx.hoy) && (!i.hasta || i.hasta >= ctx.hoy) && (i.zona === args.zona || i.restricciones?.zonas?.includes(args.zona)));
      return texto(planDeCuidado({ ...args, indicacion, consentimiento: consentimientos.cuidado_lesiones === true }));
    },
  },
);

/** Procesa un mensaje JSON-RPC. Devuelve la respuesta, o null si era una notificación. */
export async function procesarMensaje(msg, ctx) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Solicitud inválida' } };
  const disponibles = HERRAMIENTAS.filter(h => !ctx.herramientasPermitidas || ctx.herramientasPermitidas.includes(h.name));
  const responder = result => ({ jsonrpc: '2.0', id: msg.id, result });
  const fallar = (code, message) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
  if (msg?.jsonrpc !== '2.0' || typeof msg.method !== 'string') return fallar(-32600, 'Solicitud inválida');
  if (msg.id === undefined) return null; // notificación (notifications/initialized, etc.)
  switch (msg.method) {
    case 'initialize': {
      const pedida = msg.params?.protocolVersion;
      return responder({
        protocolVersion: VERSIONES.includes(pedida) ? pedida : VERSIONES[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVIDOR,
        instructions: 'Entreno guarda el plan de gimnasio y el historial de la persona. Lee primero ver_resumen. Para cambiar el plan usa proponer_cambios con aplicar=false y explica el resultado. En la conexión directa, aplicar=true envía una propuesta a Entreno: la persona tiene que confirmarla dentro de la app. La app rechaza lo que no cumple sus reglas de seguridad.',
      });
    }
    case 'ping': return responder({});
    case 'tools/list':
      return responder({ tools: disponibles.map(({ run, ...h }) => ({ ...h, ...(ctx.soloProponer && !h.annotations?.readOnlyHint ? { description: h.description + ' En esta conexión solo envía una propuesta pendiente. La persona la confirma en Entreno.' } : {}), annotations: { destructiveHint: !h.annotations?.readOnlyHint, openWorldHint: false, ...h.annotations } })) });
    case 'tools/call': {
      const h = disponibles.find(x => x.name === msg.params?.name);
      if (!h) return fallar(-32602, `Herramienta desconocida: ${msg.params?.name}`);
      try {
        const args = msg.params?.arguments ?? {};
        const error = validarArgumentos(args, h.inputSchema);
        if (error) return responder({ ...texto(error), isError: true });
        return responder(await h.run(args, ctx));
      } catch (e) {
        return responder({ ...texto(`Error: ${e.message}`), isError: true });
      }
    }
    default: return fallar(-32601, `Método no soportado: ${msg.method}`);
  }
}

/** Maneja una petición HTTP de MCP (Streamable HTTP, respuestas JSON sin SSE). */
export async function manejarHttp(req, ctx) {
  if (req.method === 'GET') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  if (req.method === 'DELETE') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  let cuerpo;
  try { cuerpo = await req.json(); } catch { return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON inválido' } }, { status: 400 }); }
  if (Array.isArray(cuerpo)) return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Envía una solicitud por vez.' } }, { status: 400 });
  const lote = [cuerpo];
  const respuestas = (await Promise.all(lote.map(m => procesarMensaje(m, ctx)))).filter(Boolean);
  if (!respuestas.length) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(cuerpo) ? respuestas : respuestas[0]);
}

/** Comprueba el esquema de cada herramienta antes de acceder a datos o ejecutar una acción. */
export function validarArgumentos(v, s, ruta = 'argumentos') {
  const tipo = s.type;
  if (tipo === 'object') {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return `${ruta}: debe ser un objeto.`;
    for (const k of s.required || []) if (!(k in v)) return `${ruta}: falta ${k}.`;
    for (const [k, dato] of Object.entries(v)) {
      if (!s.properties?.[k]) return `${ruta}: no se reconoce ${k}.`;
      const e = validarArgumentos(dato, s.properties[k], `${ruta}.${k}`); if (e) return e;
    }
  } else if (tipo === 'array') {
    if (!Array.isArray(v) || v.length > 200) return `${ruta}: debe ser una lista de hasta 200 elementos.`;
    for (const x of v) { const e = validarArgumentos(x, s.items, ruta); if (e) return e; }
  } else {
    if (tipo === 'integer' ? !Number.isInteger(v) : typeof v !== tipo) return `${ruta}: tipo inválido.`;
    if (typeof v === 'number' && (!Number.isFinite(v) || v < (s.minimum ?? -Infinity) || v > (s.maximum ?? Infinity))) return `${ruta}: fuera del rango permitido.`;
    if (typeof v === 'string' && v.length > 30000) return `${ruta}: texto demasiado largo.`;
  }
  if (s.enum && !s.enum.includes(v)) return `${ruta}: valor no permitido.`;
  return null;
}
