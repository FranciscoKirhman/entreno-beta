// Entrenar sin plan: quien todavía no quiere el cuestionario parte con una sesión vacía y elige sus ejercicios
// desde el banco. Es un plan "libre", sin prescripción, que suma un día vacío cada vez que entrena así. El
// cuestionario lo reemplaza por un plan de verdad cuando la persona quiera.

const sumar = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export function diaLibre(fecha, lugar) {
  return { fecha, semana: 1, foco: 'Sesión libre', lugar, libre: true, ejercicios: [], calentamiento: [], estiramiento: [], cardio: null,
    racional: 'Sesión armada por ti desde cero.' };
}

/** El plan libre con la sesión de hoy. Si ya había uno, conserva su última semana (y hoy, si ya lo armó). */
export function planLibre(anterior, { hoy, lugar = 'Gimnasio' }) {
  const dias = anterior?.libre && Array.isArray(anterior.dias) ? anterior.dias.filter(d => d.fecha >= sumar(hoy, -6) && d.fecha <= hoy) : [];
  if (!dias.some(d => d.fecha === hoy)) dias.push(diaLibre(hoy, lugar));
  dias.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return { libre: true, inicio: dias[0].fecha, semanas: 2, dias };
}

/** Qué ofrecer al abrir la app: null si no corresponde elegir (sin plan, ya eligió o ya empezó a entrenar hoy). */
export function eleccionDeHoy({ plan, hoy, registro = {}, sesiones = [], elegido = null }) {
  if (!plan?.dias || plan.bloqueado || elegido === hoy) return null;
  const empezo = Object.values(registro[hoy] || {}).some(series => Array.isArray(series) && series.some(s => s?.hecho));
  if (empezo || sesiones.some(s => s.fecha === hoy && s.origen !== 'ejemplo')) return null;
  const dia = plan.dias.find(d => d.fecha === hoy) || null;
  if (plan.libre) return { libre: true, dia };
  const proxima = plan.dias.find(d => d.fecha > hoy && d.ejercicios?.length) || null;
  return { libre: false, dia: dia?.ejercicios?.length && !dia.libre ? dia : null, proxima };
}
