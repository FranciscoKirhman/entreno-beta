import { E, ctxNucleo, esc, $, presc, fechaCorta } from './comun.js';
import { recomendarEjercicios } from '../nucleo/recomendar-ejercicios.js';
import { miniatura } from './imagenes.js';
import { NOMBRE_MUSCULO } from './musculos.js';
import { proponerEdicion } from './editar-sesion-ui.js';

export function pintarRecomendaciones(candidatos, ir) {
  const caja = $('banco-recomendaciones');
  const ctx = { ...ctxNucleo(), sesiones: E.sesiones, registro: E.registro };
  const xs = recomendarEjercicios(ctx, { candidatos });
  const titulo = ctx.plan?.dias.find(d => d.fecha === ctx.hoy)?.foco;
  caja.innerHTML = `<h2>Recomendados para hoy</h2><p class="pequeno suave">${titulo && titulo !== 'Sesión libre' ? `Para complementar ${esc(titulo)}. ` : 'Para armar tu sesión. '}Consideran tu objetivo, prioridades, equipo, nivel e historial disponible. Tú eliges qué agregar.</p>
    ${xs.length ? `<ul class="banco-lista">${xs.map(({ ejercicio: e, razones, prescripcion: p, minutos }) => `<li class="tarjeta banco-ejercicio recomendacion-ejercicio"><div class="banco-fila"><button type="button" class="banco-ficha" data-recom-ver="${esc(e.id)}" aria-label="Ver ficha de ${esc(e.nombre)}">${miniatura(e.id)}<span><strong>${esc(e.nombre)}</strong><span class="pequeno suave">${esc(presc(p))}</span></span></button><button type="button" class="boton banco-agregar" data-recom-agregar="${esc(e.id)}" aria-label="Agregar recomendado: ${esc(e.nombre)}">Agregar</button></div>
    <p class="pequeno">${razones.map(r => esc(r.tipo === 'historial' ? `Lo entrenaste en ${r.dias} ${r.dias === 1 ? 'día' : 'días'}. Última vez: ${fechaCorta(r.ultima)}.` : r.texto) + (r.musculos?.length ? ` (${esc(r.musculos.map(m => NOMBRE_MUSCULO[m] || m).join(', '))})` : '')).join(' ')}</p><p class="pequeno suave">Con este ejercicio, la sesión quedaría en unos ${minutos} min. Revisa la propuesta antes de agregar.</p></li>`).join('')}</ul>` : '<p class="pequeno suave">No hay recomendaciones que se puedan agregar con estos filtros y los límites actuales de tu sesión. Puedes explorar el banco o ajustar los filtros.</p>'}`;
  caja.onclick = ev => {
    const ver = ev.target.closest('[data-recom-ver]');
    if (ver) return ir('ejercicio', { id: ver.dataset.recomVer, desde: 'banco' });
    const agregar = ev.target.closest('[data-recom-agregar]');
    if (agregar) proponerEdicion({ tipo: 'agregar', ejercicio: agregar.dataset.recomAgregar }, { volver: agregar, alCambiar: () => ir('hoy') });
  };
}
