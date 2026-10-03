import { motivoNoAgregar, editarSesion } from './editar-sesion.js';
import { esDeTrabajoGuardada } from './registro.js';

const TORSO = new Set(['pecho', 'espalda', 'hombro', 'biceps', 'triceps']);
const PIERNA = new Set(['cuadriceps', 'femoral', 'gluteo', 'aductor_abductor', 'pantorrilla']);
const COMPLEMENTOS = { empuje_horizontal: 'tiron_horizontal', tiron_horizontal: 'empuje_horizontal', empuje_vertical: 'tiron_vertical', tiron_vertical: 'empuje_vertical', sentadilla: 'bisagra', bisagra: 'sentadilla' };
const OBJETIVOS = { ganar_musculo: 'ganar músculo', ganar_fuerza: 'ganar fuerza', salud: 'mejorar tu condición física', bajar_grasa: 'bajar grasa', recomposicion: 'tu recomposición', volver: 'retomar el entrenamiento', deporte: 'tu deporte' };

export function recomendarEjercicios(ctx, { candidatos = ctx.indice.ejercicios, limite = 3 } = {}) {
  const { indice, hoy, derivados: d, respuestas: r, sesiones = [] } = ctx;
  if (!ctx.plan?.dias?.length || ctx.plan.bloqueado || d.alerta === 'bloqueo') return [];
  const dia = ctx.plan.dias.find(x => x.fecha === hoy);
  const actuales = (dia?.ejercicios || []).map(e => ({ ...e, catalogo: indice.porId.get(e.ejercicio_id) })).filter(e => e.catalogo);
  const musculos = new Set(actuales.flatMap(e => e.catalogo.musculos_primarios));
  const patrones = new Set(actuales.map(e => e.catalogo.patron));
  const faltantes = new Set([...patrones].map(p => COMPLEMENTOS[p]).filter(p => p && !patrones.has(p)));
  const prioridades = new Set(d.musculos_prioridad || []);
  const favoritos = new Set(r.favoritos || []);
  const desde = new Date(Date.parse(hoy + 'T12:00:00Z') - 90 * 864e5).toISOString().slice(0, 10);
  const historial = sesiones.filter(s => s.fecha >= desde && s.fecha <= hoy).flatMap(s => (s.series || []).filter(x => esDeTrabajoGuardada(x) && (Number(x.reps) > 0 || Number(x.duracion_seg) > 0)).map(x => ({ ...x, fecha: s.fecha })));
  const puntuados = candidatos.filter(e => e.tipo !== 'cardio' && e.tipo !== 'movilidad' && !motivoNoAgregar(e, ctx)).map(e => {
    const razones = [];
    let puntos = 10 - Math.min(10, Number(e.preferencia) || 0);
    if (!actuales.length && e.tipo === 'compuesto') puntos += 12;
    const comparte = e.musculos_primarios.filter(m => musculos.has(m));
    const prioritarios = e.musculos_primarios.filter(m => prioridades.has(m));
    if (faltantes.has(e.patron)) { puntos += 30; razones.push({ tipo: 'complemento', texto: 'Complementa un movimiento que falta en esta sesión.' }); }
    if (comparte.length) { puntos += 16; razones.push({ tipo: 'sesion', musculos: comparte, texto: 'Trabaja músculos de la sesión que estás armando.' }); }
    const grupo = [...musculos].some(m => TORSO.has(m)) && ![...musculos].some(m => PIERNA.has(m)) ? TORSO : [...musculos].some(m => PIERNA.has(m)) && ![...musculos].some(m => TORSO.has(m)) ? PIERNA : null;
    if (grupo && !e.musculos_primarios.some(m => grupo.has(m))) puntos -= 20;
    if (patrones.has(e.patron)) puntos -= 10;
    if (prioritarios.length) { puntos += 22; razones.push({ tipo: 'prioridad', musculos: prioritarios, texto: 'Coincide con los músculos que priorizaste en tu perfil.' }); }
    if (favoritos.has(e.id)) { puntos += 12; razones.push({ tipo: 'favorito', texto: 'Lo marcaste como favorito.' }); }
    const uso = historial.filter(x => x.ejercicio_id === e.id);
    const fechas = [...new Set(uso.map(x => x.fecha))].sort();
    if (fechas.length) {
      puntos += r.rotacion === 'variar' ? 2 : Math.min(10, fechas.length * 2);
      razones.push({ tipo: 'historial', texto: `Lo registraste en ${fechas.length} ${fechas.length === 1 ? 'día' : 'días'}; la última vez fue el ${fechas.at(-1)}.`, ultima: fechas.at(-1), dias: fechas.length });
    }
    const seriesHoy = actuales.filter(x => x.catalogo.musculos_primarios.some(m => e.musculos_primarios.includes(m))).reduce((s, x) => s + x.series, 0);
    puntos -= Math.max(0, seriesHoy - 5) * 4;
    if (d.objetivo === 'ganar_fuerza' && e.tipo === 'compuesto') puntos += 12;
    if (!razones.length) razones.push({ tipo: 'perfil', texto: `Una opción compatible con tu nivel y equipo para ${OBJETIVOS[d.objetivo] || 'tu objetivo'}.` });
    return { ejercicio: e, puntos, razones };
  }).sort((a, b) => b.puntos - a.puntos || a.ejercicio.id.localeCompare(b.ejercicio.id));
  const salida = [], elegidos = new Set(), movimientos = new Set();
  const agregar = candidato => {
    const propuesta = editarSesion({ tipo: 'agregar', ejercicio: candidato.ejercicio.id }, ctx);
    if (propuesta.error) return; // No se recomienda algo que exceda tiempo, volumen o restricciones.
    salida.push({ ...candidato, prescripcion: propuesta.ejercicio, minutos: propuesta.minutos });
    elegidos.add(candidato.ejercicio.id); movimientos.add(candidato.ejercicio.patron);
  };
  for (const candidato of puntuados) {
    if (!movimientos.has(candidato.ejercicio.patron)) agregar(candidato);
    if (salida.length >= limite) return salida;
  }
  // Si el filtro pidió un único movimiento, también se ofrecen variantes compatibles.
  for (const candidato of puntuados) {
    if (!elegidos.has(candidato.ejercicio.id)) agregar(candidato);
    if (salida.length >= limite) break;
  }
  return salida;
}
