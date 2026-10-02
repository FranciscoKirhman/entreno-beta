import { articulacionesBloqueadas, cargaZonaBloqueada, tieneEquipo } from './catalogo.js';
import { duracionSesion } from './motor-plan.js';
import { validarPlan } from './validador.js';
import { tramosDeCardio } from './calentamiento.js';

// Usa las ilustraciones existentes del ejercicio o del equipo correspondiente.
export const CARDIOS = [
  { id: 'caminata', nombre: 'Caminata', equipamiento: [], carga_articular: ['cadera', 'rodilla', 'tobillo'], imagen: 'img/ejercicios/mini/caminata.webp' },
  { id: 'caminata_inclinada', nombre: 'Caminata inclinada', equipamiento: ['trotadora'], carga_articular: ['cadera', 'rodilla', 'tobillo'], imagen: 'img/ejercicios/mini/caminata_inclinada.webp' },
  { id: 'trotadora', nombre: 'Trotadora', equipamiento: ['trotadora'], carga_articular: ['cadera', 'rodilla', 'tobillo'], imagen: 'img/ejercicios/mini/trotadora.webp' },
  { id: 'trote', nombre: 'Trote al aire libre', equipamiento: [], carga_articular: ['cadera', 'rodilla', 'tobillo'], imagen: 'img/ejercicios/mini/trote.webp' },
  { id: 'bicicleta', nombre: 'Bicicleta estática', equipamiento: ['bicicleta'], carga_articular: ['cadera', 'rodilla'], imagen: 'img/equipos/bicicleta.webp' },
  { id: 'remoergometro', nombre: 'Remo ergómetro', equipamiento: ['remoergometro'], carga_articular: ['lumbar', 'hombro', 'codo', 'rodilla'], imagen: 'img/equipos/remoergometro.webp' },
  { id: 'escaladora', nombre: 'Escaladora', equipamiento: ['escaladora'], carga_articular: ['cadera', 'rodilla', 'tobillo'], imagen: 'img/ejercicios/mini/escaladora.webp' },
  { id: 'saltos_tijera', nombre: 'Saltos de tijera', equipamiento: [], carga_articular: ['hombro', 'rodilla', 'tobillo'], imagen: 'img/ejercicios/mini/saltos_tijera.webp' },
  { id: 'patinador', nombre: 'Saltos de patinador', equipamiento: [], carga_articular: ['cadera', 'rodilla', 'tobillo'], imagen: 'img/ejercicios/mini/patinador.webp' },
];

export function cardioDeTexto(texto) {
  return [...CARDIOS].sort((a, b) => b.nombre.length - a.nombre.length).find(c => String(texto || '').toLowerCase().startsWith(c.nombre.toLowerCase().replace(/ estática| al aire libre/g, ''))) || null;
}
export function registroCardio(texto, marca) {
  if (!texto || !marca?.hecho || marca.texto !== texto) return null;
  const seg = tramosDeCardio(texto).reduce((n, t) => n + t.seg, 0);
  if (!seg) return null;
  const c = cardioDeTexto(texto);
  return { ejercicio_id: ['bicicleta', 'remoergometro'].includes(c?.id) ? null : c?.id || null,
    ejercicio_nombre: c?.nombre || 'Cardio', tipo: 'efectiva', carga_kg: null, reps: null, duracion_seg: seg, rir: null, rpe: null };
}

export function motivoNoCardio(cardio, ctx) {
  if (!ctx.plan?.dias?.length || ctx.plan.bloqueado) return 'Primero arma tu plan.';
  if (!cardio) return 'Esa opción no está en el banco.';
  const dia = ctx.plan.dias.find(d => d.fecha === ctx.hoy);
  const lugar = ctx.respuestas.lugares?.find(l => l.nombre === dia?.lugar) || ctx.respuestas.lugares?.find(l => l.principal) || ctx.respuestas.lugares?.[0];
  if (!tieneEquipo(cardio, lugar?.equipamiento || [])) return 'No tienes este equipo en el lugar de hoy.';
  const zonas = articulacionesBloqueadas(ctx.respuestas.lesiones || [], ctx.hoy);
  for (const i of ctx.indicaciones || []) if (!i.hasta || i.hasta >= ctx.hoy) for (const z of i.restricciones?.zonas || []) zonas.add(z);
  if (cargaZonaBloqueada(cardio, zonas)) return 'Carga una zona que tienes restringida.';
  if (ctx.respuestas.prohibidos?.includes(cardio.id)) return 'Lo excluiste en tu perfil.';
  return null;
}

export function editarCardio({ id, minutos, ritmo = 'suave' }, ctx) {
  if (!ctx.plan?.dias?.length || ctx.plan.bloqueado) return { error: 'Primero arma tu plan.' };
  const cardio = CARDIOS.find(c => c.id === id);
  if (id !== null) {
    const motivo = motivoNoCardio(cardio, ctx);
    if (motivo) return { error: motivo };
    if (!Number.isInteger(minutos) || minutos < 1 || minutos > 60) return { error: 'Elige entre 1 y 60 minutos.' };
    if (!['suave', 'moderado'].includes(ritmo)) return { error: 'Elige un ritmo suave o moderado.' };
  }
  const plan = structuredClone(ctx.plan);
  let dia = plan.dias.find(d => d.fecha === ctx.hoy);
  if (!dia && id === null) return { error: 'Hoy no hay cardio para quitar.' };
  if (!dia) {
    dia = { fecha: ctx.hoy, semana: Math.max(1, Math.floor((Date.parse(ctx.hoy) - Date.parse(plan.inicio)) / 604800000) + 1),
      foco: 'Cardio', lugar: ctx.respuestas.lugares?.find(l => l.principal)?.nombre || ctx.respuestas.lugares?.[0]?.nombre,
      ejercicios: [], calentamiento: [], estiramiento: [], racional: 'Cardio elegido por ti para hoy.' };
    plan.dias.push(dia); plan.dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
  }
  dia.cardio = id === null ? null : `${cardio.nombre} ${minutos} minutos a ritmo ${ritmo}.`;
  const revision = validarPlan(plan, ctx);
  if (!revision.ok) return { error: revision.errores.map(e => e.mensaje).join(' ') };
  return { plan, texto: dia.cardio, minutosSesion: duracionSesion(dia) };
}
