// Del cuestionario respondido al punto de partida del plan: nivel, alertas médicas, rango de series,
// repeticiones de reserva y límites. Implementa contenido/cuestionario.json → reglas.
// El resultado se guarda en cuestionarios.derivados y el motor y el validador lo usan como restricción.

const SENALES_BLOQUEO = ['dolor_pecho', 'mareo', 'supervision'];
const SENALES_AVISO = ['corazon', 'cronica', 'medicamentos', 'osteoarticular'];

export function edad(fechaNacimiento, hoy) {
  const [a, m, d] = fechaNacimiento.split('-').map(Number);
  const [ha, hm, hd] = hoy.split('-').map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

export const NIVELES = ['principiante', 'intermedio', 'avanzado'];

/** Nivel según lo que contestó: cuánto tiempo lleva entrenando y con qué constancia. */
export function nivelDeclarado(r) {
  const t = r.tiempo_entrenando, c = r.constancia;
  if (!t || t === 'nunca' || t === 'menos_6m') return 'principiante';
  if (t === '6_24m') return 'intermedio';
  return ['3_4', '5_mas'].includes(c) ? 'avanzado' : 'intermedio';
}

/** Nivel vigente: el declarado, o el que ganó entrenando con la app (nucleo/nivel.js), si es mayor. */
export function nivel(r) {
  const base = nivelDeclarado(r);
  return NIVELES.indexOf(r.nivel_ganado) > NIVELES.indexOf(base) ? r.nivel_ganado : base;
}

/**
 * @param r respuestas del cuestionario (ids de cuestionario.json)
 * @param cuestionario contenido/cuestionario.json
 * @param hoy 'AAAA-MM-DD'
 */
export function derivar(r, cuestionario, hoy) {
  const pp = cuestionario.reglas.punto_de_partida;
  const errores = [];
  const anios = r.fecha_nacimiento ? edad(r.fecha_nacimiento, hoy) : null;
  // La fecha es opcional: alcanza con confirmar que es mayor de edad (cuestionario rápido).
  if (anios != null && anios < 18) errores.push('Por ahora la app es solo para mayores de 18 años.');
  else if (anios == null && r.mayor_18 !== true) errores.push('Falta confirmar que tienes 18 años o más.');

  const niv = nivel(r);
  const conSalud = r.consentimiento_salud === true;
  const tam = conSalud ? (r.tamizaje || {}) : {};
  const embarazo = conSalud && ['embarazo', 'posparto'].includes(r.embarazo);

  let alerta = 'ninguna', rirMinimo = 0, semanasConservadoras = 0, mensaje = null;
  if (SENALES_BLOQUEO.some(k => tam[k]) || embarazo) {
    alerta = r.autorizacion_medica ? 'autorizado' : 'bloqueo';
    mensaje = cuestionario.reglas.alerta_medica[0].mensaje;
    rirMinimo = 3; semanasConservadoras = 2;
  } else if (SENALES_AVISO.some(k => tam[k])) {
    alerta = 'aviso';
    mensaje = cuestionario.reglas.alerta_medica[1].mensaje;
    rirMinimo = 3; semanasConservadoras = 2;
  } else if (!conSalud) {
    alerta = 'sin_datos_salud';
    rirMinimo = 3;
  }

  // Recuperación: con poco sueño, mucho estrés o turnos se parte en el extremo bajo del rango.
  const conservador = ['menos_5', '5_6'].includes(r.sueno_horas) || (r.estres ?? 0) >= 4 || r.turnos === true
    || (anios != null && anios >= 65) || alerta !== 'ninguna' || r.objetivo_principal === 'volver';
  const [lo, hi] = pp.series_por_musculo_semana[niv];
  const seriesRango = conservador ? [lo, Math.round((lo + hi) / 2)] : [lo, hi];

  const rirObj = pp.rir_objetivo[niv];
  const rir = typeof rirObj === 'number' ? { compuestos: rirObj, aislamiento: rirObj } : rirObj;

  const diasMeta = Math.max(2, Math.min(7, Number(r.dias_meta) || 3));
  const diasFirmes = Math.max(1, Math.min(diasMeta, Number(r.dias_firmes) || diasMeta));
  const duracion = Number(r.duracion_min) || 60;

  return {
    errores,
    edad: anios,
    nivel: niv,
    objetivo: r.objetivo_principal || 'salud',
    prioridad_recomposicion: r.prioridad_recomposicion || null,
    alerta, mensaje_alerta: mensaje,
    rir_minimo: rirMinimo, semanas_conservadoras: semanasConservadoras,
    conservador,
    series_rango: seriesRango,
    rir_objetivo: { compuestos: Math.max(rir.compuestos, rirMinimo), aislamiento: Math.max(rir.aislamiento, rirMinimo) },
    frecuencia_minima: pp.frecuencia_minima_por_musculo,
    dias_meta: diasMeta, dias_firmes: diasFirmes,
    duracion_min: duracion,
    ejercicios_por_sesion: pp.ejercicios_por_sesion[String(duracion)] || 6,
    estructura: r.estructura || 'fija',
    musculos_prioridad: r.musculos_prioridad || [],
    mayor_65: anios != null && anios >= 65,
    ciclo: conSalud && r.seguimiento_ciclo === true,
    usa_ia: r.ia_transferencia === true,
  };
}
