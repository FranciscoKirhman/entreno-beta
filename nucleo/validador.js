// Revisa un plan antes de guardarlo, venga del motor de reglas, del coach Pro o de la IA de la persona.
// Si hay errores, el plan no se guarda: se reintenta o se usa el plan de reglas.
import { tieneEquipo, nivelAlcanza, articulacionesBloqueadas, cargaZonaBloqueada } from './catalogo.js';
import { incrementoPara, duracionSesion, volumenSemanal } from './motor-plan.js';
import { grupos } from './superseries.js';

const CONTADOS = ['femoral', 'gluteo', 'cuadriceps', 'aductor_abductor', 'espalda', 'pecho', 'hombro', 'biceps', 'triceps'];

/**
 * @returns {{ok: boolean, errores: {fecha?, ejercicio?, codigo, mensaje}[], advertencias: object[]}}
 */
export function validarPlan(plan, { derivados: d, respuestas: r, indice, hoy }) {
  const errores = [], advertencias = [];
  const err = (codigo, mensaje, extra = {}) => errores.push({ codigo, mensaje, ...extra });
  const adv = (codigo, mensaje, extra = {}) => advertencias.push({ codigo, mensaje, ...extra });

  if (d.alerta === 'bloqueo') err('alerta_medica', 'Hay una alerta médica sin autorización: no se puede guardar un plan.');
  if (!Array.isArray(plan.dias) || !plan.dias.length) {
    err('sin_dias', 'El plan no tiene días.');
    return { ok: false, errores, advertencias };
  }

  const lugares = r.lugares?.length ? r.lugares : [{ nombre: 'Casa', equipamiento: [] }];
  const lugarDe = nombre => lugares.find(l => l.nombre === nombre) || lugares.find(l => l.principal) || lugares[0];
  const noPuedo = new Set(r.dias_no_puedo || []);
  // Quien empieza no llega al fallo: al menos 2 de reserva, o lo que pida una alerta médica.
  const rirMinimo = Math.max(d.rir_minimo, d.nivel === 'principiante' ? 2 : 0);
  // Margen de una semana a cada lado: mover o adelantar una sesión unos días es normal; meses fuera, no.
  const dia = (f, n) => new Date(Date.parse(f + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
  const desde = dia(plan.inicio, -7);
  const fin = dia(plan.inicio, plan.semanas * 7 + 7);

  for (const dia of plan.dias) {
    const donde = { fecha: dia.fecha };
    if (dia.fecha < desde || dia.fecha >= fin) err('fecha_fuera', `${dia.fecha} está muy fuera del plan (${plan.inicio} a ${fin}).`, donde);
    if (noPuedo.has(new Date(dia.fecha + 'T12:00:00Z').getUTCDay())) adv('dia_no_disponible', `${dia.fecha} cae en un día que marcaste que no puedes.`, donde);
    const lugar = lugarDe(dia.lugar);
    const bloqueadas = articulacionesBloqueadas(r.lesiones || [], dia.fecha);
    const vistos = new Set();
    for (const e of dia.ejercicios || []) {
      const en = { ...donde, ejercicio: e.ejercicio_id };
      // Lo indicado por un profesional se respeta tal cual: no se revisa contra el catálogo ni el equipamiento.
      if (e.indicacion) continue;
      const ej = indice.porId.get(e.ejercicio_id);
      if (!ej) { err('ejercicio_desconocido', `"${e.ejercicio_id}" no está en el catálogo.`, en); continue; }
      if (vistos.has(ej.id)) err('repetido', `${ej.nombre} aparece dos veces el mismo día.`, en);
      vistos.add(ej.id);
      if (!tieneEquipo(ej, lugar.equipamiento || [])) err('sin_equipo', `${ej.nombre} necesita ${ej.equipamiento.join(', ')} y ${lugar.nombre || 'ese lugar'} no lo tiene.`, en);
      if (cargaZonaBloqueada(ej, bloqueadas)) err('zona_lesionada', `${ej.nombre} carga ${ej.carga_articular.filter(a => bloqueadas.has(a)).join(', ')}, que está lesionado.`, en);
      if (!nivelAlcanza(d.nivel, ej.nivel_minimo)) err('nivel', `${ej.nombre} es para nivel ${ej.nivel_minimo}.`, en);
      if (!Number.isInteger(e.series) || e.series < 1 || e.series > 10) err('series', `${ej.nombre}: ${e.series} series no es válido (1 a 10).`, en);
      const tope = e.unidad === 'seg' ? 180 : 30;
      if (!(e.reps_min >= 1 && e.reps_max >= e.reps_min && e.reps_max <= tope)) err('repeticiones', `${ej.nombre}: rango ${e.reps_min}–${e.reps_max} no es válido.`, en);
      if (!(e.rir >= rirMinimo && e.rir <= 5)) err('reserva', `${ej.nombre}: ${e.rir} repeticiones de reserva; el mínimo para ti es ${rirMinimo}.`, en);
      if (e.carga_kg != null) {
        const inc = incrementoPara(ej, lugar);
        if (!(e.carga_kg > 0 && e.carga_kg < 500)) err('carga', `${ej.nombre}: ${e.carga_kg} kg no es válido.`, en);
        else if (inc && Math.abs(e.carga_kg / inc - Math.round(e.carga_kg / inc)) > 1e-6
          && !(ej.equipamiento.includes('barra_rack') && (e.carga_kg - 20) % inc === 0)) {
          adv('incremento', `${ej.nombre}: ${e.carga_kg} kg no se arma con los discos de ${lugar.nombre || 'tu gimnasio'} (sube de a ${inc} kg).`, en);
        }
        const max = Number(lugar.mancuerna_max_kg);
        if (ej.equipamiento.includes('mancuernas') && max && e.carga_kg > max) err('mancuerna_max', `${ej.nombre}: ${e.carga_kg} kg y la mancuerna más pesada es de ${max} kg.`, en);
      }
    }
    // Superseries: una letra de la A a la H; si quedó suelta o separada, no se aplica (se avisa).
    const letras = (dia.ejercicios || []).map(e => e.superserie).filter(x => x != null);
    if (letras.some(l => !/^[A-H]$/.test(l))) err('superserie', `${dia.fecha}: superserie con una letra que no es de la A a la H.`, donde);
    else {
      const g = grupos(dia.ejercicios || []);
      if ((dia.ejercicios || []).some((e, i) => e.superserie && !g[i])) adv('superserie_suelta', `${dia.fecha}: una superserie quedó con un solo ejercicio o separada; se hace como serie normal.`, donde);
    }
    const minutos = duracionSesion(dia);
    if (minutos === null || minutos > d.duracion_min) err('duracion', `${dia.fecha}: la sesión dura unos ${minutos} minutos y tienes ${d.duracion_min}.`, donde);
  }

  // Volumen por músculo en una semana normal (la 1) y que la descarga baje.
  const v = volumenSemanal(plan.dias, indice.porId, 1);
  const [lo, hi] = d.series_rango;
  for (const m of CONTADOS) {
    const s = v[m] || 0;
    if (s > hi + 4) err('volumen_alto', `${m}: ${s} series a la semana; tu tope es ${hi}.`);
    else if (s > 0 && s < lo / 2) adv('volumen_bajo', `${m}: solo ${s} series a la semana.`);
  }
  if (plan.semana_descarga) {
    const total = sem => plan.dias.filter(x => x.semana === sem).reduce((a, x) => a + x.ejercicios.reduce((b, e) => b + e.series, 0), 0);
    if (total(plan.semana_descarga) >= total(1)) err('descarga', 'La semana de descarga no tiene menos series que una semana normal.');
  }
  return { ok: errores.length === 0, errores, advertencias };
}
