import { E, guardar, esc, hoy, avisar } from './comun.js';
import { calendarioAsistencia, cambiarAsistencia } from '../nucleo/calendario-asistencia.js';
let mes = null;
let elegida = null;
const fechaLarga = f => new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${f}T12:00:00Z`));
const tituloMes = m => new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T12:00:00Z`));
export function calendarioHtml() {
  mes ||= hoy().slice(0, 7);
  const c = calendarioAsistencia(E.plan, E.sesiones, { hoy: hoy(), mes, marcas: E.marcasPlan || {} });
  const seleccionado = c.dias.find(x => x.fecha === elegida);
  return `<section class="cal-asistencia" aria-labelledby="cal-titulo">
    <div class="cal-cab"><button type="button" class="boton-icono" data-cal-mes="-1" aria-label="Mes anterior">‹</button><h2 id="cal-titulo">${esc(tituloMes(mes))}</h2><button type="button" class="boton-icono" data-cal-mes="1" aria-label="Mes siguiente">›</button></div>
    <p class="pequeno suave">Toca un día naranjo para avisar que no irás. Los días rojos necesitan tu confirmación.</p>
    <div class="cal-grid" role="group" aria-label="Calendario de asistencia">
      ${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(d => `<span class="cal-letra" aria-hidden="true">${d}</span>`).join('')}
      ${Array.from({ length: c.espacios }, () => '<span aria-hidden="true"></span>').join('')}
      ${c.dias.map(x => `<button type="button" class="cal-dia cal-${x.color}${x.fecha === elegida ? ' seleccionada' : ''}" data-cal-fecha="${x.fecha}" aria-pressed="${x.fecha === elegida}"${x.fecha === hoy() ? ' aria-current="date"' : ''} aria-label="${esc(`${fechaLarga(x.fecha)}: ${x.etiqueta}${x.dia ? `. ${x.dia.foco}` : ''}`)}"><span>${Number(x.fecha.slice(8))}</span><small aria-hidden="true">${x.color === 'verde' ? '✓' : x.color === 'rojo' ? '?' : x.color === 'naranjo' ? '●' : x.color === 'azul' ? 'Hoy' : x.etiqueta === 'Falta confirmada' ? '×' : ''}</small></button>`).join('')}
    </div>
    <div class="cal-leyenda"><span><i class="cal-naranjo"></i>Voy a ir</span><span><i class="cal-azul"></i>Hoy</span><span><i class="cal-rojo"></i>Por confirmar</span><span><i class="cal-verde"></i>Confirmado</span></div>
    ${seleccionado ? detalle(seleccionado) : '<p class="pequeno suave">Elegí un día para ver o confirmar tu asistencia.</p>'}
    <p class="pequeno suave">Tu confirmación se guarda en este dispositivo. Avisar una falta no mueve ni borra entrenamientos. Verde confirma asistencia, no todas las series.</p>
  </section>`;
}
function detalle(x) {
  const futuro = x.fecha >= hoy();
  const boton = (a, texto) => `<button type="button" class="boton${a === 'hice' ? ' primario' : ''}" data-cal-accion="${a}" data-cal-dia="${x.fecha}">${texto}</button>`;
  return `<div class="cal-detalle" aria-live="polite"><strong>${esc(fechaLarga(x.fecha))}</strong><p>${esc(x.dia?.foco || x.registrado?.sesion?.titulo || 'Sin entrenamiento planificado')}</p><p class="pequeno">${esc(x.etiqueta)}${x.registrado?.el ? `. Registrado el ${esc(fechaLarga(x.registrado.el))}` : ''}</p>
    ${x.confirmado ? `<p class="pequeno suave">${x.registrado?.t === 'hecha_sin_registro' ? 'Confirmaste que entrenaste, sin inventar series.' : 'Las series registradas se conservan.'}</p>${x.registrado?.t === 'hecha_sin_registro' ? boton('pendiente', 'Corregir mi confirmación') : ''}` : !x.dia ? '' : `<div class="cal-acciones">${futuro ? boton(x.color === 'gris' ? 'voy' : 'no_voy', x.color === 'gris' ? 'Sí voy a ir' : 'No voy a ir') : x.color === 'gris' ? boton('hice', 'Sí entrené') + boton('pendiente', 'Volver a revisar') : boton('hice', 'Sí entrené') + boton('falte', 'Falté') + boton('pendiente', 'Revisar después')}</div>`}
  </div>`;
}
export function enlazarCalendario(repintar) {
  document.querySelectorAll('[data-cal-mes]').forEach(b => b.onclick = () => { const f = new Date(`${mes}-01T12:00:00Z`); f.setUTCMonth(f.getUTCMonth() + Number(b.dataset.calMes)); mes = f.toISOString().slice(0, 7); elegida = null; repintar(); });
  document.querySelectorAll('[data-cal-fecha]').forEach(b => b.onclick = () => { elegida = b.dataset.calFecha; repintar(); document.querySelector(`[data-cal-fecha="${elegida}"]`)?.focus(); });
  document.querySelectorAll('[data-cal-accion]').forEach(b => b.onclick = () => {
    const fecha = b.dataset.calDia;
    const c = calendarioAsistencia(E.plan, E.sesiones, { hoy: hoy(), mes: fecha.slice(0, 7), marcas: E.marcasPlan || {} });
    const x = c.dias.find(d => d.fecha === fecha);
    const r = cambiarAsistencia(E.marcasPlan || {}, fecha, b.dataset.calAccion, { hoy: hoy(), confirmado: x?.confirmado && x.registrado?.t !== 'hecha_sin_registro', tienePlan: Boolean(x?.dia) });
    if (r.error) return avisar(r.error);
    E.marcasPlan = r.marcas; guardar(); repintar();
    document.querySelector(`[data-cal-fecha="${fecha}"]`)?.focus();
  });
}
