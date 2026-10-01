// Agenda viva: mover, reagendar e intercambiar sesiones del plan. Lo usan el chat de la app, la IA de la
// persona (conector MCP) y la demo. Todas las funciones devuelven un plan nuevo y la lista de cambios; nunca
// modifican el plan que reciben.
//
// Regla de fondo (contenido/evidencia/00-principios.md): no juntar dos sesiones pesadas del mismo grupo en días
// seguidos, y si no cabe todo, se pierde primero lo opcional.

const DIA_MS = 864e5;
const NOMBRES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const sumarDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * DIA_MS).toISOString().slice(0, 10);
export const diaSemana = iso => new Date(iso + 'T12:00:00Z').getUTCDay();
export const nombreDia = iso => NOMBRES[diaSemana(iso)];
const lunesDe = iso => sumarDias(iso, -((diaSemana(iso) + 6) % 7));

/** Grupo muscular de un día del plan, para no repetirlo en días seguidos. */
export function familia(plantilla = '') {
  if (plantilla.startsWith('pierna')) return 'pierna';
  if (plantilla.startsWith('torso')) return 'torso';
  if (plantilla.startsWith('empuje')) return 'empuje';
  if (plantilla.startsWith('tiron')) return 'tiron';
  if (plantilla.startsWith('cuerpo')) return 'cuerpo';
  return plantilla || 'otro';
}
// Qué grupos chocan entre sí en días seguidos (cuerpo completo choca con todo).
const chocan = (a, b) => a === b || a === 'cuerpo' || b === 'cuerpo';

export const sesionDe = (plan, fecha) => plan.dias.find(d => d.fecha === fecha) || null;
const copiar = plan => structuredClone(plan);
const ordenar = plan => { plan.dias.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)); return plan; };

/** Avisos si una fecha queda pegada a otra sesión del mismo grupo. */
export function conflictos(plan, fecha, plantilla, ignorar = null) {
  const f = familia(plantilla);
  return [-1, 1].map(d => sumarDias(fecha, d))
    .map(v => plan.dias.find(x => x.fecha === v && x !== ignorar))
    .filter(x => x && chocan(familia(x.plantilla), f))
    .map(x => `Queda pegado a ${x.foco} del ${nombreDia(x.fecha)} ${x.fecha.slice(8)}.`);
}

/** Mueve una sesión a otra fecha. Si la fecha ya tiene sesión, no la mueve (usar intercambiar). */
export function moverSesion(plan, de, a, { noPuedo = [] } = {}) {
  const nuevo = copiar(plan);
  const s = sesionDe(nuevo, de);
  if (!s) return { ok: false, plan, error: `No hay sesión el ${de}.` };
  if (sesionDe(nuevo, a)) return { ok: false, plan, error: `Ya hay una sesión el ${nombreDia(a)} ${a.slice(8)}. Puedo intercambiarlas.` };
  const avisos = conflictos(nuevo, a, s.plantilla, s);
  if (noPuedo.includes(diaSemana(a))) avisos.push(`Marcaste que los ${nombreDia(a)} casi nunca puedes.`);
  s.fecha = a;
  s.semana = s.semana; // la semana del bloque no cambia aunque se mueva de día
  return { ok: true, plan: ordenar(nuevo), cambios: [{ tipo: 'mover', de, a, foco: s.foco }], avisos };
}

/** Intercambia dos sesiones de fecha ("hoy hago torso y las piernas otro día"). */
export function intercambiar(plan, fechaA, fechaB) {
  const nuevo = copiar(plan);
  const a = sesionDe(nuevo, fechaA), b = sesionDe(nuevo, fechaB);
  if (!a || !b) return { ok: false, plan, error: 'Una de las dos fechas no tiene sesión.' };
  a.fecha = fechaB; b.fecha = fechaA;
  const avisos = [...conflictos(nuevo, fechaA, b.plantilla, b), ...conflictos(nuevo, fechaB, a.plantilla, a)];
  return { ok: true, plan: ordenar(nuevo), cambios: [{ tipo: 'intercambiar', fechas: [fechaA, fechaB], focos: [b.foco, a.foco] }], avisos };
}

/** Días libres para entrenar entre dos fechas (inclusive): sin sesión, no bloqueados y no ocupados. */
function libres(plan, desde, hasta, noPuedo, ocupadas = new Set()) {
  const out = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    if (!noPuedo.includes(diaSemana(f)) && !sesionDe(plan, f) && !ocupadas.has(f)) out.push(f);
  }
  return out;
}

/**
 * "Falté el martes": la sesión perdida y las que quedan de la semana se reacomodan en los días libres que
 * quedan, sin juntar el mismo grupo. Si no caben, se pierde primero lo opcional y después la de menor prioridad.
 */
export function marcarFaltada(plan, fecha, { hoy, noPuedo = [] }) {
  const s = sesionDe(plan, fecha);
  if (!s) return { ok: false, plan, error: `No hay sesión el ${fecha}.` };
  const nuevo = copiar(plan);
  const domingo = sumarDias(lunesDe(fecha), 6);
  const desde = sumarDias(hoy > fecha ? hoy : fecha, hoy > fecha ? 0 : 1);
  // Sesiones por reacomodar: la perdida + las que quedan desde mañana hasta el domingo.
  const pendientes = nuevo.dias.filter(d => d.fecha === fecha || (d.fecha >= desde && d.fecha <= domingo));
  const resto = nuevo.dias.filter(d => !pendientes.includes(d));
  const base = { ...nuevo, dias: resto };
  const dias = libres(base, desde, domingo, noPuedo);
  // Si sobran sesiones, salen las opcionales y luego las de menos días firmes.
  let lista = [...pendientes].sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  const perdidas = [];
  while (lista.length > dias.length) {
    const fuera = lista.find(d => !d.firme) || lista.at(-1);
    perdidas.push(fuera);
    lista = lista.filter(d => d !== fuera);
  }
  // Asignación en orden, saltando un día si quedaría pegado al mismo grupo y hay margen.
  const asignadas = [];
  let i = 0;
  for (const d of lista) {
    const restantes = lista.length - asignadas.length;
    let j = i;
    while (j < dias.length - (restantes - 1)) {
      const prueba = { ...base, dias: [...resto, ...asignadas] };
      if (!conflictos(prueba, dias[j], d.plantilla).length || j === dias.length - restantes) break;
      j++;
    }
    const de = d.fecha;
    d.fecha = dias[j];
    asignadas.push(d);
    i = j + 1;
    if (de !== d.fecha) d._movida = de;
  }
  const final = ordenar({ ...nuevo, dias: [...resto, ...asignadas] });
  const cambios = asignadas.filter(d => d._movida).map(d => ({ tipo: 'mover', de: d._movida, a: d.fecha, foco: d.foco }));
  for (const d of final.dias) delete d._movida;
  const avisos = perdidas.map(d => `No cabe ${d.foco} esta semana${d.firme ? '' : ' (era opcional)'}; se retoma en la próxima.`);
  return { ok: true, plan: final, cambios, avisos, perdidas: perdidas.map(d => ({ fecha: d.fecha, foco: d.foco })) };
}

/**
 * "Hoy no quiero hacer piernas, ¿qué otra opción tienes?": sesiones de esta semana de otro grupo que se
 * pueden traer a hoy (intercambiando), más dos alternativas que siempre existen.
 */
export function opcionesParaHoy(plan, hoy, { evitar = null } = {}) {
  const actual = sesionDe(plan, hoy);
  // Las de esta semana; si no queda ninguna (por ejemplo, el plan empieza el lunes), las de los próximos 7 días.
  const finSemana = sumarDias(lunesDe(hoy), 6);
  const fin = plan.dias.some(d => d.fecha > hoy && d.fecha <= finSemana) ? finSemana : sumarDias(hoy, 7);
  const candidatas = plan.dias.filter(d => d.fecha > hoy && d.fecha <= fin && d !== actual
    && (!evitar || familia(d.plantilla) !== evitar) && (!actual || familia(d.plantilla) !== familia(actual.plantilla)));
  const opciones = candidatas.map(d => {
    const r = actual ? intercambiar(plan, hoy, d.fecha) : moverSesion(plan, d.fecha, hoy);
    return { tipo: actual ? 'intercambiar' : 'traer', fecha: d.fecha, foco: d.foco, avisos: r.avisos || [], ok: r.ok };
  }).filter(o => o.ok).sort((a, b) => a.avisos.length - b.avisos.length).slice(0, 3);
  opciones.push({ tipo: 'descanso_activo', foco: 'Descanso activo: 20 a 30 minutos de caminata o bicicleta suave y movilidad', avisos: [] });
  if (actual) opciones.push({ tipo: 'mover', foco: `Mover ${actual.foco} al próximo día libre`, avisos: [] });
  return { hoy: actual ? { fecha: hoy, foco: actual.foco } : null, opciones };
}

/**
 * Reparte las sesiones en las horas libres del calendario (eventos de Google Calendar importados como ICS).
 * @param ocupados [{inicio: ISO, fin: ISO}] en hora local (sin zona) o con zona
 * @param o.ventana  ['HH:MM', 'HH:MM'] horario en que la persona puede entrenar
 * @param o.minutos  duración de la sesión más el traslado
 */
export function reagendarConCalendario(plan, ocupados, { desde, hasta, noPuedo = [], ventana = ['06:30', '21:30'], minutos = 90, preferida = null }) {
  const nuevo = copiar(plan);
  const aMin = hhmm => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);
  const local = iso => (iso.length <= 16 ? iso : new Date(iso).toLocaleString('sv-SE', { timeZone: 'America/Santiago' }).replace(' ', 'T').slice(0, 16));
  const ocupadoEn = f => ocupados.map(e => ({ i: local(e.inicio), f: local(e.fin) }))
    .filter(e => e.i.slice(0, 10) <= f && e.f.slice(0, 10) >= f)
    .map(e => [e.i.slice(0, 10) < f ? 0 : aMin(e.i.slice(11, 16)), e.f.slice(0, 10) > f ? 1440 : aMin(e.f.slice(11, 16))]);
  // Primer hueco del día de largo `minutos` dentro de la ventana, el más cercano a la hora preferida.
  const hueco = f => {
    const bloques = ocupadoEn(f).sort((a, b) => a[0] - b[0]);
    const [v0, v1] = ventana.map(aMin);
    const huecos = [];
    let t = v0;
    for (const [b0, b1] of bloques) { if (b0 - t >= minutos) huecos.push(t); t = Math.max(t, b1); }
    if (v1 - t >= minutos) huecos.push(t);
    const valido = huecos.filter(h => h + minutos <= v1);
    if (!valido.length) return null;
    const p = preferida ? aMin(preferida) : v0;
    const h = valido.map(h0 => Math.min(Math.max(h0, p), v1 - minutos)).filter(h0 => !bloques.some(([b0, b1]) => h0 < b1 && h0 + minutos > b0))
      .sort((a, b) => Math.abs(a - p) - Math.abs(b - p))[0] ?? valido[0];
    return `${String(Math.floor(h / 60)).padStart(2, '0')}:${String(h % 60).padStart(2, '0')}`;
  };
  const cambios = [], avisos = [];
  const usadas = new Set(nuevo.dias.filter(d => d.fecha < desde || d.fecha > hasta).map(d => d.fecha));
  for (const d of nuevo.dias.filter(x => x.fecha >= desde && x.fecha <= hasta).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))) {
    let h = !noPuedo.includes(diaSemana(d.fecha)) ? hueco(d.fecha) : null;
    if (h && !usadas.has(d.fecha)) { d.hora = h; usadas.add(d.fecha); continue; }
    // Buscar el día más cercano (±3) en la misma semana con hueco, sin otra sesión y sin chocar.
    const lunes = lunesDe(d.fecha), domingo = sumarDias(lunes, 6);
    const cand = [1, -1, 2, -2, 3, -3].map(n => sumarDias(d.fecha, n))
      .filter(f => f >= lunes && f <= domingo && f >= desde && f <= hasta && !usadas.has(f) && !noPuedo.includes(diaSemana(f))
        && !nuevo.dias.some(x => x !== d && x.fecha === f));
    const elegido = cand.find(f => hueco(f) && !conflictos({ ...nuevo, dias: nuevo.dias.filter(x => x !== d) }, f, d.plantilla).length)
      || cand.find(f => hueco(f));
    if (elegido) {
      cambios.push({ tipo: 'mover', de: d.fecha, a: elegido, foco: d.foco, hora: hueco(elegido) });
      d.fecha = elegido; d.hora = hueco(elegido); usadas.add(elegido);
    } else {
      avisos.push(`No encontré un hueco de ${minutos} minutos para ${d.foco} cerca del ${d.fecha}.`);
      usadas.add(d.fecha);
    }
  }
  return { ok: true, plan: ordenar(nuevo), cambios, avisos };
}
