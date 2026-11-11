import { datoCambiado } from './datos-nube.js';
import { E, guardar, esc, hoy, avisar } from './comun.js';
import { calendarioAsistencia, cambiarAsistencia } from '../nucleo/calendario-asistencia.js';
import { sePuedeArrastrar } from '../nucleo/arrastre-semana.js';
let mes = null;
let elegida = null;
const fechaLarga = f => new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${f}T12:00:00Z`));
const tituloMes = m => new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${m}-01T12:00:00Z`)).replace(/^./, c => c.toUpperCase());
/** arrastrable: en Mover o faltar, una sesión por hacer se puede mantener apretada y soltar en otro día. */
export function calendarioHtml({ arrastrable = false } = {}) {
  mes ||= hoy().slice(0, 7);
  const c = calendarioAsistencia(E.plan, E.sesiones, { hoy: hoy(), mes, marcas: E.marcasPlan || {} });
  const seleccionado = c.dias.find(x => x.fecha === elegida);
  return `<section class="cal-asistencia" aria-labelledby="cal-titulo">
    <div class="cal-cab"><button type="button" class="boton-icono" data-cal-mes="-1" aria-label="Mes anterior">‹</button><h2 id="cal-titulo">${esc(tituloMes(mes))}</h2><button type="button" class="boton-icono" data-cal-mes="1" aria-label="Mes siguiente">›</button></div>
    <p class="pequeno suave">Toca un día naranjo para avisar que no irás.${arrastrable ? ' Mantenlo apretado y arrástralo para cambiarlo de día.' : ''} Los días rojos necesitan tu confirmación.</p>
    <div class="cal-grid" role="group" aria-label="Calendario de asistencia">
      ${['L', 'M', 'Mi', 'J', 'V', 'S', 'D'].map(d => `<span class="cal-letra" aria-hidden="true">${d}</span>`).join('')}
      ${Array.from({ length: c.espacios }, () => '<span aria-hidden="true"></span>').join('')}
      ${c.dias.map(x => `<button type="button" class="cal-dia cal-${x.color}${x.fecha === elegida ? ' seleccionada' : ''}" data-cal-fecha="${x.fecha}"${arrastrable && sePuedeArrastrar(x, hoy()) ? ` data-cal-arrastrable="${esc(x.dia.foco || 'Sesión')}"` : ''} aria-pressed="${x.fecha === elegida}"${x.fecha === hoy() ? ' aria-current="date"' : ''} aria-label="${esc(`${fechaLarga(x.fecha)}: ${x.etiqueta}${x.dia ? `. ${x.dia.foco}` : ''}`)}"><span>${Number(x.fecha.slice(8))}</span><small aria-hidden="true">${x.color === 'verde' ? '✓' : x.color === 'rojo' ? '?' : x.color === 'naranjo' ? '●' : x.color === 'azul' ? 'Hoy' : x.etiqueta === 'Falta confirmada' ? '×' : ''}</small></button>`).join('')}
    </div>
    <div class="cal-leyenda"><span><i class="cal-naranjo"></i>Voy a ir</span><span><i class="cal-azul"></i>Hoy</span><span><i class="cal-rojo"></i>Por confirmar</span><span><i class="cal-verde"></i>Confirmado</span></div>
    ${seleccionado ? detalle(seleccionado) : '<p class="pequeno suave">Elige un día para ver o confirmar tu asistencia.</p>'}
    <p class="pequeno suave">Tu confirmación se guarda en este teléfono y en tu cuenta. Avisar una falta no mueve ni borra entrenamientos. Verde confirma asistencia, no todas las series.</p>
  </section>`;
}
function detalle(x) {
  const futuro = x.fecha >= hoy();
  const boton = (a, texto) => `<button type="button" class="boton${a === 'hice' ? ' primario' : ''}" data-cal-accion="${a}" data-cal-dia="${x.fecha}">${texto}</button>`;
  return `<div class="cal-detalle" aria-live="polite"><strong>${esc(fechaLarga(x.fecha))}</strong><p>${esc(x.dia?.foco || x.registrado?.sesion?.titulo || 'Sin entrenamiento planificado')}</p><p class="pequeno">${esc(x.etiqueta)}${x.registrado?.el ? `. Registrado el ${esc(fechaLarga(x.registrado.el))}` : ''}</p>
    ${x.registrado?.sesion ? `<p class="pequeno">${x.registrado.sesion.series?.filter(s=>s.tipo!=='calentamiento').length || 0} series registradas${x.registrado.sesion.duracion_min ? ` · ${x.registrado.sesion.duracion_min} min` : ''}</p><ul class="pequeno">${[...new Set((x.registrado.sesion.series||[]).map(s=>s.ejercicio_nombre||s.ejercicio_id).filter(Boolean))].map(n=>`<li>${esc(n)}</li>`).join('')}</ul>` : ''}
    ${x.confirmado ? `<p class="pequeno suave">${x.registrado?.t === 'hecha_sin_registro' ? 'Confirmaste que entrenaste, sin inventar series.' : 'Las series registradas se conservan.'}</p>${x.registrado?.t === 'hecha_sin_registro' ? boton('pendiente', 'Corregir mi confirmación') : ''}` : !x.dia ? '' : `<div class="cal-acciones">${futuro ? boton(x.color === 'gris' ? 'voy' : 'no_voy', x.color === 'gris' ? 'Sí voy a ir' : 'No voy a ir') : x.color === 'gris' ? boton('hice', 'Sí entrené') + boton('pendiente', 'Volver a revisar') : boton('hice', 'Sí entrené') + boton('falte', 'Falté') + boton('pendiente', 'Revisar después')}</div>`}
  </div>`;
}
/**
 * El arrastre: 0,4 s apretado casi sin moverse levanta la sesión (una etiqueta con su nombre sigue al dedo), el día
 * bajo el dedo se marca y al soltar se llama alSoltar(de, a, celda). No cambia nada por sí solo. En el iPhone se sigue
 * con touch* (pointer* se cancela cuando Safari desplaza); el touchmove no pasivo solo frena la página ya levantada.
 */
function enlazarArrastre(alSoltar) {
  const grid = document.querySelector('.cal-asistencia .cal-grid');
  if (!grid || !grid.querySelector('[data-cal-arrastrable]')) return;
  const ESPERA = 400, HOLGURA = 8;
  let espera = null, a = null, recienSoltado = false;
  const celdaEn = (x, y) => document.elementFromPoint(x, y)?.closest?.('[data-cal-fecha]') || null;
  const dejarDeEsperar = () => { clearTimeout(espera?.reloj); espera = null; };
  const mover = (x, y) => {
    a.fantasma.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -130%)`;
    const c = celdaEn(x, y), destino = c && grid.contains(c) && c !== a.celda && c.dataset.calFecha >= hoy() ? c : null;
    if (destino === a.destino) return;
    a.destino?.classList.remove('cal-destino');
    a.destino = destino;
    destino?.classList.add('cal-destino');
  };
  const levantar = ({ celda, x, y }) => {
    if (!celda.isConnected) return;
    const fantasma = document.createElement('div');
    fantasma.className = 'cal-fantasma'; fantasma.textContent = celda.dataset.calArrastrable; fantasma.setAttribute('aria-hidden', 'true');
    document.body.append(fantasma);
    a = { celda, fantasma, destino: null };
    celda.classList.add('cal-levantada'); grid.classList.add('cal-arrastrando');
    navigator.vibrate?.(10);
    mover(x, y);
  };
  const terminar = soltar => {
    dejarDeEsperar();
    if (!a) return;
    const { celda, destino, fantasma } = a; a = null;
    fantasma.remove(); celda.classList.remove('cal-levantada'); destino?.classList.remove('cal-destino'); grid.classList.remove('cal-arrastrando');
    // El toque que suelta no debe además abrir el detalle del día.
    recienSoltado = true; setTimeout(() => { recienSoltado = false; }, 350);
    if (soltar && destino) alSoltar(celda.dataset.calFecha, destino.dataset.calFecha, celda);
  };
  const empezar = (celda, x, y) => { dejarDeEsperar(); espera = { celda, x, y }; espera.reloj = setTimeout(() => { const e = espera; espera = null; levantar(e); }, ESPERA); };
  const lejos = (x, y) => espera && Math.hypot(x - espera.x, y - espera.y) > HOLGURA;
  grid.addEventListener('touchstart', ev => { const c = ev.target.closest('[data-cal-arrastrable]'); if (c && ev.touches.length === 1) empezar(c, ev.touches[0].clientX, ev.touches[0].clientY); else terminar(false); }, { passive: true });
  grid.addEventListener('touchmove', ev => {
    const t = ev.touches[0];
    if (a) { ev.preventDefault(); mover(t.clientX, t.clientY); } else if (lejos(t.clientX, t.clientY)) dejarDeEsperar();
  }, { passive: false });
  grid.addEventListener('touchend', ev => { if (a) ev.preventDefault(); terminar(true); });
  grid.addEventListener('touchcancel', () => terminar(false));
  grid.addEventListener('contextmenu', ev => { if (espera || a) ev.preventDefault(); });
  grid.addEventListener('click', ev => { if (recienSoltado) { ev.stopPropagation(); ev.preventDefault(); } }, true);
  // Con mouse, lo mismo por pointer*.
  grid.addEventListener('pointerdown', ev => {
    if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
    const c = ev.target.closest('[data-cal-arrastrable]'); if (!c) return;
    empezar(c, ev.clientX, ev.clientY);
    const alMover = e => { if (a) mover(e.clientX, e.clientY); else if (lejos(e.clientX, e.clientY)) dejarDeEsperar(); };
    const alSubir = () => { removeEventListener('pointermove', alMover); removeEventListener('pointerup', alSubir); terminar(true); };
    addEventListener('pointermove', alMover); addEventListener('pointerup', alSubir);
  });
}
export function enlazarCalendario(repintar, { alSoltar = null } = {}) {
  if (alSoltar) enlazarArrastre(alSoltar);
  document.querySelectorAll('[data-cal-mes]').forEach(b => b.onclick = () => { const f = new Date(`${mes}-01T12:00:00Z`); f.setUTCMonth(f.getUTCMonth() + Number(b.dataset.calMes)); mes = f.toISOString().slice(0, 7); elegida = null; repintar(); });
  document.querySelectorAll('[data-cal-fecha]').forEach(b => b.onclick = () => { elegida = b.dataset.calFecha; repintar(); document.querySelector(`[data-cal-fecha="${elegida}"]`)?.focus(); });
  document.querySelectorAll('[data-cal-accion]').forEach(b => b.onclick = () => {
    const fecha = b.dataset.calDia;
    const c = calendarioAsistencia(E.plan, E.sesiones, { hoy: hoy(), mes: fecha.slice(0, 7), marcas: E.marcasPlan || {} });
    const x = c.dias.find(d => d.fecha === fecha);
    const r = cambiarAsistencia(E.marcasPlan || {}, fecha, b.dataset.calAccion, { hoy: hoy(), confirmado: x?.confirmado && x.registrado?.t !== 'hecha_sin_registro', tienePlan: Boolean(x?.dia) });
    if (r.error) return avisar(r.error);
    E.marcasPlan = r.marcas; datoCambiado('calendario_asistencia'); repintar();
    document.querySelector(`[data-cal-fecha="${fecha}"]`)?.focus();
  });
}
