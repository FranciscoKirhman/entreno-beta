// Lee un calendario en formato iCalendar (.ics) y devuelve los bloques ocupados.
// Google Calendar lo entrega en Configuración → tu calendario → "Dirección secreta en formato iCal", o
// exportando. Es la forma gratis de usar el calendario sin pedir permisos de Google (eso queda para después).
//
// Soporta lo que usa Google: DTSTART/DTEND con hora local (TZID), en UTC (Z) o de día completo, y eventos que
// se repiten cada día o cada semana (RRULE con FREQ, INTERVAL, BYDAY, UNTIL y COUNT), con EXDATE.

const ZONA = 'America/Santiago';

function desplegar(texto) {
  return texto.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

/** '20261005T183000', '20261005T213000Z' o '20261005' → hora local 'AAAA-MM-DDTHH:MM' (Chile). */
export function fechaIcs(valor, esUtc) {
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, a, mes, d, h = '00', mi = '00', , z] = m;
  if (z || esUtc) {
    return new Date(Date.UTC(+a, +mes - 1, +d, +h, +mi)).toLocaleString('sv-SE', { timeZone: ZONA }).replace(' ', 'T').slice(0, 16);
  }
  return `${a}-${mes}-${d}T${h}:${mi}`;
}

const DIAS_ICS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const sumarMin = (local, min) => {
  const t = Date.UTC(+local.slice(0, 4), +local.slice(5, 7) - 1, +local.slice(8, 10), +local.slice(11, 13), +local.slice(14, 16)) + min * 6e4;
  return new Date(t).toISOString().slice(0, 16);
};
const diffMin = (a, b) => (Date.parse(b + ':00Z') - Date.parse(a + ':00Z')) / 6e4;

/** Eventos del .ics, con sus repeticiones desplegadas dentro de [desde, hasta] (fechas AAAA-MM-DD). */
export function leerIcs(texto, { desde, hasta }) {
  const lineas = desplegar(texto);
  const eventos = [];
  let ev = null;
  for (const l of lineas) {
    if (l === 'BEGIN:VEVENT') { ev = { exdate: [] }; continue; }
    if (l === 'END:VEVENT') { if (ev?.inicio) eventos.push(ev); ev = null; continue; }
    if (!ev) continue;
    const i = l.indexOf(':');
    if (i < 0) continue;
    const [nombre, ...params] = l.slice(0, i).split(';');
    const valor = l.slice(i + 1);
    const diaCompleto = params.includes('VALUE=DATE');
    if (nombre === 'DTSTART') { ev.inicio = fechaIcs(valor); ev.diaCompleto = diaCompleto; }
    else if (nombre === 'DTEND') ev.fin = fechaIcs(valor);
    else if (nombre === 'SUMMARY') ev.titulo = valor;
    else if (nombre === 'RRULE') ev.rrule = Object.fromEntries(valor.split(';').map(p => p.split('=')));
    else if (nombre === 'EXDATE') ev.exdate.push(...valor.split(',').map(v => fechaIcs(v)));
    else if (nombre === 'TRANSP') ev.libre = valor === 'TRANSPARENT';
  }
  const out = [];
  const enRango = ini => ini.slice(0, 10) >= desde && ini.slice(0, 10) <= hasta;
  for (const e of eventos) {
    if (e.libre) continue; // "disponible" en Google: no bloquea
    if (!e.fin) e.fin = e.diaCompleto ? sumarMin(e.inicio, 1440) : e.inicio;
    const dur = diffMin(e.inicio, e.fin);
    const agregar = ini => { if (!e.exdate.includes(ini) && enRango(ini)) out.push({ inicio: ini, fin: sumarMin(ini, dur), titulo: e.titulo || '' }); };
    if (!e.rrule) { agregar(e.inicio); continue; }
    const r = e.rrule;
    const intervalo = Number(r.INTERVAL || 1);
    const hastaRegla = r.UNTIL ? fechaIcs(r.UNTIL) : null;
    let quedan = r.COUNT ? Number(r.COUNT) : Infinity;
    const dias = r.BYDAY ? r.BYDAY.split(',').map(d => DIAS_ICS[d.slice(-2)]) : null;
    for (let k = 0; k < 2000 && quedan > 0; k++) {
      let candidatas;
      if (r.FREQ === 'DAILY') candidatas = [sumarMin(e.inicio, k * intervalo * 1440)];
      else if (r.FREQ === 'WEEKLY') {
        const base = sumarMin(e.inicio, k * intervalo * 7 * 1440);
        const dow = new Date(base.slice(0, 10) + 'T12:00:00Z').getUTCDay();
        candidatas = (dias || [dow]).map(d => sumarMin(base, ((d - dow + 7) % 7) * 1440)).sort();
      } else { agregar(e.inicio); break; }
      let fuera = false;
      for (const c of candidatas) {
        if (c < e.inicio) continue;
        if ((hastaRegla && c > hastaRegla) || c.slice(0, 10) > hasta) { fuera = true; break; }
        if (quedan-- <= 0) { fuera = true; break; }
        agregar(c);
      }
      if (fuera) break;
    }
  }
  return out.sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
}
