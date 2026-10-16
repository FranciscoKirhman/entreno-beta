// Pestaña Mi plan: el ciclo en curso, la semana, los músculos prioridad (y desde cuándo cambian), los ejercicios
// favoritos y evitados, los cuidados (indicación del profesional, suplementos, notas para el entrenador) y los ajustes
// del plan. Progreso, Semana, Siguiente ciclo y el Banco de ejercicios se abren desde sus botones.
// Nada cambia el plan sin que la persona lo vea antes (AGENTS.md, regla 10): las prioridades muestran cómo queda y el
// siguiente ciclo guarda un borrador que se aplica al armar el bloque (nucleo/ciclo-siguiente.js).
import { E, R, D, C, guardar, esc, $, hoy, indice, fechaCorta, cambiarPlan, avisar, mostrarMensaje } from './comun.js';
import { macroActual, planBloqueSiguiente, armarBloqueSiguiente, lunesDesde, historialReciente, tarjetaDescarga, enlazarTemporada } from './temporada.js';
import { semanaDe, aplicarFase } from '../nucleo/ciclos.js';
import { bloqueSiguienteDisponible } from '../nucleo/bloque-siguiente.js';
import { resumenPlan } from '../nucleo/resumen-plan.js';
import { estadoDelPlan } from '../nucleo/registrado.js';
import { generarPlan, volumenSemanal, duracionSesion, NOMBRE_ZONA } from '../nucleo/motor-plan.js';
import { derivar } from '../nucleo/derivar.js';
import { sumarDias } from '../nucleo/agenda.js';
import { normalizar } from '../nucleo/catalogo.js';
import { planATexto } from '../nucleo/importar-plan.js';
import { borradorCiclo, respuestasDelCiclo, guardarEnBorrador, cambioPrioridades, anotarCambio, semanasDesde } from '../nucleo/ciclo-siguiente.js';
import { suplementosHtml, indicacionesHtml, notasEntrenadorHtml, enlazarCuidados } from './cuidados.js';
import { abrirCambiosPlan, hayCambiosPlan } from './cambios-plan.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';

const LETRA = ['L', 'M', 'Mi', 'J', 'V', 'S', 'D'];
const mayus = t => (t ? t[0].toUpperCase() + t.slice(1) : t);
const nombreZona = m => NOMBRE_ZONA[m] || m;
const listaZonas = xs => xs.length ? xs.map(nombreZona).map(mayus).join(', ') : 'ninguno';
const nombreEj = id => indice.porId.get(id)?.nombre || id;
const coma = x => String(Math.round(x * 10) / 10).replace('.', ',');
const OPCIONES = id => C.secciones.flatMap(s => s.preguntas || []).find(q => q.id === id)?.opciones || [];
const HECHA = ['hecha', 'recuperada', 'adelantada', 'hecha_sin_registro'];

// Lo que la persona va eligiendo en la pantalla de prioridades (sin guardar hasta confirmar).
let eleccion = null, desdeElegido = 'ciclo', buscarFav = '', buscarEvitar = '';

/** Lunes de la semana de f. */
const lunesDe = f => sumarDias(f, -((new Date(f + 'T12:00:00Z').getUTCDay() + 6) % 7));
/** El lunes que viene (si hoy es lunes, el de la otra semana: esta ya empezó). */
const proximoLunes = () => sumarDias(lunesDe(hoy()), 7);
const finDelPlan = () => (E.plan?.dias || []).map(d => d.fecha).sort().at(-1);
/** Cuándo parte el siguiente ciclo: el lunes después de que termina el actual. */
const inicioSiguiente = () => { const fin = finDelPlan(); return fin ? lunesDesde(sumarDias(fin, 1)) : proximoLunes(); };

export function vistaMiPlan(ir, extra = {}) {
  const panel = extra?.panel;
  if (panel === 'prioridades') return vistaPrioridades(ir, extra);
  if (panel === 'ciclo') return vistaCiclo(ir);
  const p = E.plan;
  const repintar = () => { const y = scrollY; vistaMiPlan(ir); scrollTo(0, y); };
  $('app').innerHTML = `<div id="vista-miplan">
    <h1>Mi plan</h1>
    ${cicloHtml()}
    ${tarjetaDescarga()}
    <div class="tablero-progreso mp-tablero">
      ${[['progreso', 'grafico', 'Progreso'], ['semana', 'calendario', 'Semana'], ['ciclo', 'cambiar', 'Siguiente ciclo'], ['banco', 'pesa', 'Banco de ejercicios']]
        .map(([id, ic, t]) => `<button type="button" class="tablero-boton" data-mp-ir="${id}">${icono(ic)}<span>${t}</span>${icono('flecha', 'icono tablero-flecha')}</button>`).join('')}
    </div>
    ${p?.libre ? '' : semanaHtml()}
    ${p?.libre ? '' : prioridadesHtml()}
    ${ejerciciosHtml()}
    <h2 class="titulo-seccion">Cuidados</h2>
    ${indicacionesHtml()}
    ${suplementosHtml()}
    ${notasEntrenadorHtml()}
    ${ajustesHtml()}
  </div>`;
  const raiz = $('vista-miplan');
  raiz.querySelectorAll('[data-mp-ir]').forEach(b => b.onclick = () => {
    const v = b.dataset.mpIr;
    if (v === 'ciclo') return ir('miplan', { panel: 'ciclo' });
    if (v === 'banco') return ir('banco', { desde: 'miplan' });
    ir(v);
  });
  $('mp-semana')?.addEventListener('click', () => ir('semana'));
  $('mp-prioridades')?.addEventListener('click', () => { eleccion = null; ir('miplan', { panel: 'prioridades' }); });
  $('mp-descartar')?.addEventListener('click', () => { guardarRespuestas(guardarEnBorrador(R(), { musculos_prioridad: R().musculos_prioridad })); avisar('Quité el cambio pendiente de prioridades.'); repintar(); });
  enlazarEjercicios(repintar);
  enlazarTemporada(repintar);
  enlazarCuidados(repintar, ir);
  enlazarAjustes(ir, raiz);
  mostrarMensaje();
}

/** Ciclo en curso: fase, semana, barra y cuándo termina. */
function cicloHtml() {
  const p = E.plan;
  if (!p?.dias?.length || p.libre) return `<section class="tarjeta mp-ciclo"><h3>Sin plan por ahora</h3><p class="pequeno suave">Entrenas con sesiones libres. Puedes armar un plan con tus respuestas cuando quieras.</p><button type="button" class="boton primario" data-mp-rehacer>Armar mi plan</button></section>`;
  const m = macroActual();
  const f = hoy(), s = semanaDe(p, f), fin = finDelPlan();
  const actual = m?.bloques.find(b => b.n === m.actual);
  const pasados = p.dias.filter(d => d.fecha < f).length;
  const avance = Math.round(Math.min(1, Math.max(0, pasados / p.dias.length)) * 100);
  const descarga = p.semana_descarga ? sumarDias(p.inicio, (p.semana_descarga - 1) * 7) : null;
  const linea = !s && f < p.inicio ? `Parte el ${fechaCorta(p.inicio)}.`
    : !s ? 'Terminaste este bloque.'
      : s === p.semana_descarga ? 'Esta semana es de descarga.'
        : descarga ? `Descarga desde el ${fechaCorta(descarga)}.` : '';
  return `<section class="tarjeta mp-ciclo">
    <p class="pequeno suave">${m && actual ? `Bloque ${m.actual} de ${m.bloques.length} · ${esc(actual.nombre)}` : 'Tu bloque'}</p>
    <h3>${s ? `Semana ${s} de ${p.semanas}` : !s && f < p.inicio ? 'Por empezar' : 'Bloque terminado'}</h3>
    <div class="mp-barra" role="img" aria-label="${avance}% del bloque"><i style="width:${avance}%"></i></div>
    <p class="pequeno suave">${esc(linea)} Termina el ${esc(fechaCorta(fin))}.</p>
  </section>`;
}

/** Esta semana, de lunes a domingo, con lo hecho y lo que viene. */
function semanaHtml() {
  const p = E.plan;
  if (!p?.dias?.length) return '';
  const f = hoy();
  // Esta semana; si ya no le queda ninguna sesión por delante (o el plan parte después), la próxima, como Entrenar.
  let lunes = lunesDe(f), cual = 'Esta semana';
  if (!p.dias.some(d => d.fecha >= f && d.fecha <= sumarDias(lunes, 6) && d.ejercicios?.length)) { lunes = sumarDias(lunes, 7); cual = 'La próxima semana'; }
  const reg = estadoDelPlan(p, E.sesiones, { hoy: f, marcas: E.marcasPlan || {} });
  const celdas = LETRA.map((l, i) => {
    const fecha = sumarDias(lunes, i);
    const d = p.dias.find(x => x.fecha === fecha && x.ejercicios?.length);
    const hecha = HECHA.includes(reg.porDia.get(fecha)?.t);
    const clase = hecha ? 'hecha' : fecha === f ? 'hoy' : d ? 'toca' : '';
    const texto = d ? `${l}: ${d.foco}${hecha ? ', hecha' : fecha < f ? ', no se hizo' : ''}` : `${l}: libre`;
    return `<span class="mp-dia ${clase}" aria-label="${esc(texto)}">${l}${hecha ? ' ✓' : ''}</span>`;
  }).join('');
  const proximas = p.dias.filter(d => d.fecha >= f && d.ejercicios?.length && !HECHA.includes(reg.porDia.get(d.fecha)?.t)).slice(0, 2);
  const texto = proximas.map(d => `${d.fecha === f ? 'Hoy' : mayus(new Date(d.fecha + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'long', timeZone: 'UTC' }))}: ${d.foco}, ~${duracionSesion(d)} min`).join(' · ');
  return `<h2 class="titulo-seccion">${cual}</h2>
    <button type="button" class="tarjeta mp-semana" id="mp-semana"><span class="mp-dias">${celdas}</span>
    <span class="pequeno suave">${esc(texto || 'No te quedan sesiones esta semana.')}</span>
    <span class="pequeno mp-enlace">Mover, faltar o ver la semana ${icono('flecha', 'icono icono-chico')}</span></button>`;
}

/** Músculos prioridad con sus series de la semana contra la franja de tu nivel, y el cambio pendiente si hay. */
function prioridadesHtml() {
  const p = E.plan;
  if (!p?.dias?.length) return '';
  const d = D();
  const s = resumenPlan({ plan: p, respuestas: R(), derivados: d, indice, hoy: hoy() });
  const [lo, hi] = s.rango;
  const prio = s.volumen.filter(v => v.prioridad);
  const pendiente = borradorCiclo(R())?.musculos_prioridad;
  const historial = R().historial_prioridades || [];
  return `<h2 class="titulo-seccion">Músculos prioridad</h2>
  <section class="tarjeta mp-prioridades">
    ${prio.length ? `<ul class="lista-simple">${prio.map(v => `<li><span>${esc(mayus(v.nombre))}</span><span class="pequeno suave">${coma(v.series)} series a la semana · franja ${lo} a ${hi}</span></li>`).join('')}</ul>`
      : '<p class="pequeno suave">Sin músculos prioridad: todos reciben un volumen parejo.</p>'}
    ${pendiente ? `<div class="aviso ojo pequeno">Desde el siguiente ciclo (${esc(fechaCorta(inicioSiguiente()))}): ${esc(listaZonas(pendiente))}. <button type="button" class="enlace" id="mp-descartar">Descartar</button></div>` : ''}
    <button type="button" class="boton" id="mp-prioridades">Cambiar prioridades</button>
    ${historial.length ? `<details class="extra"><summary>Cambios anteriores (${historial.length})</summary><ul class="pequeno lista-simple">${historial.map(h => `<li><span>${esc(fechaCorta(h.fecha))}: ${esc(listaZonas(h.antes))} pasó a ${esc(listaZonas(h.despues))}${h.desde === 'semana' ? ' (a mitad de ciclo)' : ''}</span></li>`).join('')}</ul></details>` : ''}
  </section>`;
}

/** Favoritos y evitados, con buscador para sumar. Cuentan al armar un plan o un bloque nuevo. */
function ejerciciosHtml() {
  const r = R();
  const fav = r.favoritos || [], evit = r.prohibidos || [];
  const buscador = (id, valor, lista, accion) => `<label class="pequeno sr-only" for="${id}">Buscar ejercicio</label><input type="search" id="${id}" class="mp-buscar" placeholder="Buscar un ejercicio" value="${esc(valor || '')}" autocomplete="off">
      <ul class="lista-simple mp-resultados" id="${id}-res">${resultadosHtml(valor, lista, accion)}</ul>`;
  return `<h2 class="titulo-seccion">Ejercicios</h2>
  <section class="tarjeta mp-ejercicios">
    <h3>Favoritos</h3>
    <p class="pequeno suave">Siempre en tu plan, si tu lugar tiene con qué hacerlos.</p>
    <div class="chips">${fav.map(id => `<span class="chip firme">${esc(nombreEj(id))} <button type="button" class="enlace mp-quitar" data-quitar-fav="${esc(id)}" aria-label="Quitar ${esc(nombreEj(id))} de favoritos">${icono('cerrar', 'icono icono-chico')}</button></span>`).join('') || '<span class="pequeno suave">Todavía no eliges favoritos.</span>'}</div>
    <details class="extra"${buscarFav ? ' open' : ''}><summary>Agregar un favorito</summary>${buscador('mp-buscar-fav', buscarFav, fav, 'agregar-fav')}</details>
    <h3>Evitados</h3>
    <p class="pequeno suave">No aparecen en tus planes nuevos. Se suman también desde una sesión, con "No volver a hacer este ejercicio".</p>
    <ul class="lista-simple">${evit.map(id => `<li><span>${esc(nombreEj(id))}</span><button type="button" class="enlace" data-permitir="${esc(id)}">Volver a permitir</button></li>`).join('') || '<li class="pequeno suave">Ninguno.</li>'}</ul>
    <details class="extra"${buscarEvitar ? ' open' : ''}><summary>Evitar otro ejercicio</summary>${buscador('mp-buscar-evitar', buscarEvitar, evit, 'agregar-evitar')}</details>
    <p class="pequeno suave">Estos cambios cuentan desde tu siguiente ciclo o al rehacer el plan. Para cambiar uno desde hoy, usa el menú ⋯ del ejercicio en la sesión.</p>
  </section>`;
}

/** Hasta 6 ejercicios del banco que contienen lo escrito y no están ya en la lista. */
function resultadosHtml(valor, lista, accion) {
  const t = normalizar(valor || '');
  const res = t.length < 2 ? [] : indice.ejercicios.filter(e => !lista.includes(e.id) && normalizar(e.nombre).includes(t)).slice(0, 6);
  return res.map(e => `<li><span>${esc(e.nombre)}</span><button type="button" class="enlace" data-${accion}="${esc(e.id)}">Agregar</button></li>`).join('')
    || (t.length >= 2 ? '<li class="pequeno suave">No encontré ese ejercicio.</li>' : '');
}

function guardarRespuestas(nuevas) {
  E.respuestas = nuevas; guardar();
  if (nube.conectado()) nube.guardarCuestionario(structuredClone(R())).catch(() => {});
}

function enlazarEjercicios(repintar) {
  const cambiar = (campo, fn, aviso) => { guardarRespuestas({ ...R(), [campo]: fn(R()[campo] || []) }); avisar(aviso); repintar(); };
  const enlazarAgregar = () => {
  document.querySelectorAll('[data-agregar-fav]').forEach(b => b.onclick = () => {
    const id = b.dataset.agregarFav; buscarFav = '';
    // Un favorito no puede estar evitado a la vez.
    guardarRespuestas({ ...R(), prohibidos: (R().prohibidos || []).filter(x => x !== id) });
    cambiar('favoritos', xs => [...new Set([...xs, id])], `${nombreEj(id)} quedó en favoritos.`);
  });
  document.querySelectorAll('[data-agregar-evitar]').forEach(b => b.onclick = () => {
    const id = b.dataset.agregarEvitar; buscarEvitar = '';
    guardarRespuestas({ ...R(), favoritos: (R().favoritos || []).filter(x => x !== id) });
    cambiar('prohibidos', xs => [...new Set([...xs, id])], `${nombreEj(id)} no aparece en tus planes nuevos.`);
  });
  };
  enlazarAgregar();
  document.querySelectorAll('[data-quitar-fav]').forEach(b => b.onclick = () => cambiar('favoritos', xs => xs.filter(x => x !== b.dataset.quitarFav), `${nombreEj(b.dataset.quitarFav)} ya no es favorito.`));
  document.querySelectorAll('[data-permitir]').forEach(b => b.onclick = () => cambiar('prohibidos', xs => xs.filter(x => x !== b.dataset.permitir), `${nombreEj(b.dataset.permitir)} puede volver a tus planes.`));
  // El buscador repinta solo sus resultados, para no perder el teclado.
  $('mp-buscar-fav')?.addEventListener('input', ev => { buscarFav = ev.target.value; $('mp-buscar-fav-res').innerHTML = resultadosHtml(buscarFav, R().favoritos || [], 'agregar-fav'); enlazarAgregar(); });
  $('mp-buscar-evitar')?.addEventListener('input', ev => { buscarEvitar = ev.target.value; $('mp-buscar-evitar-res').innerHTML = resultadosHtml(buscarEvitar, R().prohibidos || [], 'agregar-evitar'); enlazarAgregar(); });
}

function ajustesHtml() {
  const fila = (id, ic, texto, sub = '') => `<button type="button" class="mp-fila" data-mp-ajuste="${id}">${icono(ic)}<span class="mp-texto"><span>${texto}</span>${sub ? `<small>${sub}</small>` : ''}</span>${icono('flecha', 'icono mp-flecha')}</button>`;
  const d = D();
  const conPlan = E.plan?.dias?.length && !E.plan.bloqueado && !E.plan.libre;
  return `<h2 class="titulo-seccion">Ajustes del plan</h2>
  <div class="mp-lista">
    ${fila('objetivo', 'objetivo', 'Objetivo')}
    ${fila('tiempo', 'reloj', 'Días y minutos', esc(`${d.dias_meta} días · ${d.duracion_min} min`))}
    ${fila('lugar', 'casa', 'Lugar y equipo')}
    ${conPlan ? fila('explicado', 'libro', 'Ver mi plan explicado') : ''}
    ${conPlan ? fila('coach', 'chat', 'Revisar mi plan con el Coach') : ''}
    ${hayCambiosPlan() ? fila('deshacer', 'cambiar', 'Deshacer un cambio del plan') : ''}
    ${conPlan ? fila('compartir', 'enviar', 'Compartir mi plan') : ''}
    ${fila('importar', 'bajar', 'Importar un plan que ya tengo')}
    ${fila('rehacer', 'cambiar', 'Rehacer el plan con mis respuestas', 'Parte el próximo lunes; lo registrado no cambia')}
  </div>
  <div id="mp-compartido"></div>`;
}

let armarPlanFn = null;
/** app.js entrega cómo rehacer el plan (con el cuestionario y el servidor). */
export function configurarMiPlan({ armarPlan }) { armarPlanFn = armarPlan; }

function enlazarAjustes(ir, raiz) {
  const aSeccion = id => { E.seccionPerfil = id; E.seccionDesde = 'miplan'; guardar(); ir('seccion'); };
  raiz.querySelectorAll('[data-mp-rehacer]').forEach(b => b.onclick = () => armarPlanFn?.());
  raiz.querySelectorAll('[data-mp-ajuste]').forEach(b => b.onclick = async () => {
    const v = b.dataset.mpAjuste;
    if (['objetivo', 'tiempo', 'lugar'].includes(v)) return aSeccion(v);
    if (v === 'explicado') return ir('plan');
    if (v === 'coach') return ir('coach', { plan: 'afinar' });
    if (v === 'deshacer') return abrirCambiosPlan(b, { alCambiar: () => vistaMiPlan(ir) });
    if (v === 'importar') return ir('mas', { panel: 'importar' });
    if (v === 'rehacer') return abrirHoja({
      titulo: '¿Rehago el plan?', volver: b,
      nota: 'Se arma de nuevo con tus respuestas y parte el próximo lunes. Lo que ya registraste no cambia, y puedes deshacerlo.',
      opciones: [{ valor: 'si', icono: icono('visto'), clase: 'confirmar', nombre: 'Sí, rehacerlo' }, { valor: 'no', icono: icono('cerrar'), nombre: 'No, dejarlo' }],
      alElegir: x => { if (x === 'si') armarPlanFn?.(); },
    });
    if (v === 'compartir') {
      // Compartir el plan como texto (como las rutinas de Hevy): la otra persona lo pega en "Importar un plan".
      const texto = planATexto(E.plan, { semana: semanaDe(E.plan, hoy()) || 1 });
      try { if (navigator.share) { await navigator.share({ title: 'Mi plan de Entreno', text: texto }); return; } } catch { return; }
      $('mp-compartido').innerHTML = `<pre class="prompt">${esc(texto)}</pre><p class="pequeno" id="mp-copiado"></p>`;
      try { await navigator.clipboard.writeText(texto); $('mp-copiado').textContent = 'Copiado. Quien lo reciba lo pega en Perfil, Ajustes, Importar un plan.'; }
      catch { $('mp-copiado').textContent = 'Selecciona el texto y cópialo.'; }
    }
  });
}

// ── Cambiar prioridades ──────────────────────────────────────────────────────────────────────────────────────────

/** Plan actual con las prioridades nuevas desde el lunes que viene (lo de antes queda igual). */
function planDesdeSemana(musculos) {
  const lunes = proximoLunes();
  const respuestas = { ...R(), musculos_prioridad: musculos };
  const derivados = derivar(respuestas, C, hoy());
  let nuevo = generarPlan({ derivados, respuestas, indice, hoy: lunes, historial: historialReciente() });
  if (nuevo.bloqueado) return { bloqueado: true, mensaje: nuevo.mensaje };
  const m = macroActual(), actual = m?.bloques.find(b => b.n === m.actual);
  if (actual) nuevo = aplicarFase(nuevo, actual, { minutos: derivados.duracion_min });
  return { ...semanasDesde(E.plan, nuevo, lunes), lunes };
}

/** Series a la semana por músculo de un plan, en una semana dada. */
const volumen = (plan, semana) => volumenSemanal(plan.dias, indice.porId, semana);

function vistaPrioridades(ir, { vista = false } = {}) {
  const actuales = respuestasDelCiclo(R()).musculos_prioridad || [];
  eleccion ||= [...actuales];
  const p = E.plan;
  const lunes = proximoLunes(), siguiente = inicioSiguiente();
  // A mitad de ciclo solo tiene sentido si al bloque le queda al menos una semana después del lunes que viene.
  const quedaSemana = p?.dias?.some(d => d.fecha >= lunes);
  if (!quedaSemana) desdeElegido = 'ciclo';
  let previa = '';
  if (vista) {
    if (desdeElegido === 'semana') {
      const r = planDesdeSemana(eleccion);
      if (r.bloqueado) previa = `<div class="aviso alerta">${esc(r.mensaje)}</div>`;
      else {
        const w = semanaDe(r.plan, lunes) || 1;
        previa = comparacionHtml(volumen(p, w), volumen(r.plan, w), `Semana ${w}, desde el ${fechaCorta(lunes)}`);
      }
    } else {
      const r = planBloqueSiguiente({ forzar: true, cambios: { musculos_prioridad: eleccion } });
      const sem = r?.plan ? Math.min(...r.plan.dias.filter(d => d.semana >= 1).map(d => d.semana)) : 1;
      previa = !r ? '' : r.bloqueado ? `<div class="aviso alerta">${esc(r.mensaje)}</div>`
        : comparacionHtml(volumen(p, semanaDe(p, hoy()) || 1), volumen(r.plan, sem), `Primera semana del siguiente ciclo`);
    }
  }
  $('app').innerHTML = `<div id="vista-miplan" class="mp-sub">
    <button type="button" class="volver" id="mp-volver" data-vuelve-a="miplan">${icono('flecha', 'icono flecha-atras')} Mi plan</button>
    <h1>Músculos prioridad</h1>
    <p class="suave">Elige hasta 3: reciben más series que el resto. Con más, cada una crece menos.</p>
    <div class="chips-botones mp-musculos" role="group" aria-label="Músculos prioridad">${C.zonas.musculos.map(([m, t]) => `<button type="button" class="chip-opcion" data-musculo="${m}" aria-pressed="${eleccion.includes(m)}">${esc(t)}</button>`).join('')}</div>
    ${eleccion.length > 3 ? '<p class="aviso ojo pequeno">Marcaste más de 3: igual se puede, pero cada una crece menos.</p>' : ''}
    <h2 class="titulo-seccion">¿Desde cuándo?</h2>
    <div class="mp-lista" role="radiogroup" aria-label="Desde cuándo">
      <button type="button" class="mp-fila" role="radio" data-desde="ciclo" aria-checked="${desdeElegido === 'ciclo'}"><span class="mp-radio"></span><span class="mp-texto"><span>Desde el siguiente ciclo</span><small>${esc(fechaCorta(siguiente))}. El bloque actual sigue igual.</small></span></button>
      ${quedaSemana ? `<button type="button" class="mp-fila" role="radio" data-desde="semana" aria-checked="${desdeElegido === 'semana'}"><span class="mp-radio"></span><span class="mp-texto"><span>Desde la próxima semana</span><small>${esc(fechaCorta(lunes))}. Cambian los ejercicios de lo que queda del bloque.</small></span></button>` : ''}
    </div>
    ${previa}
    <div class="fila-botones">${vista ? `<button type="button" class="boton primario" id="mp-confirmar">${desdeElegido === 'semana' ? `Cambiar desde el ${esc(fechaCorta(lunes))}` : 'Guardar para el siguiente ciclo'}</button>` : '<button type="button" class="boton primario" id="mp-ver">Ver cómo queda</button>'}</div>
  </div>`;
  const repintar = (ver = false) => { const y = scrollY; vistaPrioridades(ir, { vista: ver }); scrollTo(0, y); };
  $('mp-volver').onclick = () => { eleccion = null; ir('miplan'); };
  document.querySelectorAll('[data-musculo]').forEach(b => b.onclick = () => {
    const m = b.dataset.musculo;
    eleccion = eleccion.includes(m) ? eleccion.filter(x => x !== m) : [...eleccion, m];
    repintar(false);
  });
  document.querySelectorAll('[data-desde]').forEach(b => b.onclick = () => { desdeElegido = b.dataset.desde; repintar(false); });
  $('mp-ver')?.addEventListener('click', () => repintar(true));
  $('mp-confirmar')?.addEventListener('click', async ev => {
    ev.currentTarget.disabled = true;
    if (desdeElegido === 'semana') {
      const r = planDesdeSemana(eleccion);
      if (r.bloqueado) { avisar(r.mensaje); return repintar(true); }
      const antes = R().musculos_prioridad || [];
      // Lo pendiente para el siguiente ciclo deja de tener sentido: el cambio ya se aplica.
      const sinPendiente = guardarEnBorrador({ ...R(), musculos_prioridad: [...eleccion] }, { musculos_prioridad: eleccion });
      guardarRespuestas({ ...sinPendiente, historial_prioridades: anotarCambio(R().historial_prioridades, cambioPrioridades(antes, eleccion, { fecha: hoy(), desde: 'semana' })) });
      const aviso = await cambiarPlan(r.plan, `Prioridades cambiadas desde el ${fechaCorta(r.lunes)}: ${listaZonas(eleccion).toLowerCase()}.`, nube);
      if (aviso) avisar(aviso);
    } else {
      guardarRespuestas(guardarEnBorrador(R(), { musculos_prioridad: [...eleccion] }));
      avisar(`Guardado: desde el ${fechaCorta(siguiente)} la prioridad es ${listaZonas(eleccion).toLowerCase()}.`);
    }
    eleccion = null;
    ir('miplan');
  });
  mostrarMensaje();
}

/** Antes y después, músculo por músculo (los que cambian primero). */
function comparacionHtml(antes, despues, titulo) {
  const musculos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].filter(m => NOMBRE_ZONA[m] && (antes[m] || despues[m]));
  const filas = musculos.map(m => ({ m, a: antes[m] || 0, d: despues[m] || 0 }))
    .sort((x, y) => Math.abs(y.d - y.a) - Math.abs(x.d - x.a) || y.d - x.d);
  return `<section class="tarjeta mp-comparacion"><h3>Cómo queda</h3><p class="pequeno suave">${esc(titulo)}. Series a la semana, ahora y después.</p>
    <ul class="lista-simple">${filas.map(({ m, a, d }) => `<li><span>${esc(mayus(nombreZona(m)))}${eleccion?.includes(m) ? ' <span class="chip-prioridad">Prioridad</span>' : ''}</span><span class="num${d > a ? ' sube' : d < a ? ' baja' : ''}">${coma(a)} → ${coma(d)}</span></li>`).join('')}</ul></section>`;
}

// ── Siguiente ciclo ──────────────────────────────────────────────────────────────────────────────────────────────

function vistaCiclo(ir) {
  const p = E.plan;
  if (!p?.dias?.length || p.libre || p.bloqueado) return ir('miplan');
  const m = macroActual();
  const sig = m?.bloques.find(b => b.n === m.actual + 1);
  const disp = bloqueSiguienteDisponible(p, hoy());
  const parte = disp ? lunesDesde(disp.desde) : inicioSiguiente();
  const r = respuestasDelCiclo(R());
  const b = borradorCiclo(R()) || {};
  const previa = planBloqueSiguiente({ forzar: true });
  const vol = previa?.plan ? volumen(previa.plan, Math.min(...previa.plan.dias.filter(d => d.semana >= 1).map(d => d.semana))) : {};
  const semana1 = previa?.plan ? previa.plan.dias.filter(d => d.semana === 1) : [];
  const seg = (campo, opciones, valor) => `<div class="segmentos mp-seg" role="group">${opciones.map(([v, t]) => `<button type="button" data-ciclo-campo="${campo}" data-v="${esc(v)}" aria-pressed="${String(valor) === String(v)}">${esc(t)}</button>`).join('')}</div>`;
  const cambio = k => (b[k] !== undefined ? ' <span class="chip hoy">Cambia</span>' : '');
  $('app').innerHTML = `<div id="vista-miplan" class="mp-sub">
    <button type="button" class="volver" id="mp-volver" data-vuelve-a="miplan">${icono('flecha', 'icono flecha-atras')} Mi plan</button>
    <h1>Siguiente ciclo</h1>
    <section class="tarjeta mp-ciclo">
      <p class="pequeno suave">${sig ? `Bloque ${sig.n} de ${m.bloques.length}` : 'Temporada nueva'} · parte el ${esc(fechaCorta(parte))}</p>
      <h3>${esc(sig?.nombre || 'Otra vuelta desde el primer bloque')}</h3>
      <p class="pequeno">${esc(sig?.enfoque || 'Terminas la temporada: la siguiente parte con tus pesos de ahora.')}</p>
    </section>
    <p class="pequeno suave">Lo que elijas acá queda guardado y se aplica cuando armes el bloque siguiente. El bloque actual no cambia.</p>
    <h2 class="titulo-seccion">Músculos prioridad${cambio('musculos_prioridad')}</h2>
    <button type="button" class="tarjeta mp-semana" id="mp-ciclo-prioridades"><span>${esc(listaZonas(r.musculos_prioridad || []))}</span><span class="pequeno mp-enlace">Cambiar ${icono('flecha', 'icono icono-chico')}</span></button>
    <h2 class="titulo-seccion">Días por semana${cambio('dias_meta')}</h2>
    ${seg('dias_meta', [2, 3, 4, 5, 6].map(n => [n, String(n)]), r.dias_meta)}
    <h2 class="titulo-seccion">Minutos por sesión${cambio('duracion_min')}</h2>
    ${seg('duracion_min', OPCIONES('duracion_min').map(([v]) => [v, v]), r.duracion_min)}
    <h2 class="titulo-seccion">Ejercicios${cambio('rotacion')}</h2>
    ${seg('rotacion', [['mismos', 'Mantener'], ['algunos', 'Rotar'], ['variar', 'Variar']], r.rotacion || 'algunos')}
    <p class="pequeno suave">${esc({ mismos: 'Repite los mismos para comparar tu progreso.', variar: 'Cambia varios ejercicios para no aburrirte.' }[r.rotacion] || 'Mantiene los principales y cambia algunos.')} Los favoritos se mantienen siempre y los evitados no vuelven.</p>
    <h2 class="titulo-seccion">Vista previa</h2>
    ${!previa ? '' : previa.bloqueado ? `<div class="aviso alerta">${esc(previa.mensaje)}</div>` : `<section class="tarjeta">
      <p class="pequeno">${semana1.length} sesiones a la semana: ${esc(semana1.map(d => `${d.foco} (~${duracionSesion(d)} min)`).join(', '))}.</p>
      <ul class="lista-simple pequeno">${Object.entries(vol).filter(([k, n]) => NOMBRE_ZONA[k] && n).sort((x, y) => y[1] - x[1]).map(([k, n]) => `<li><span>${esc(mayus(nombreZona(k)))}${(r.musculos_prioridad || []).includes(k) ? ' <span class="chip-prioridad">Prioridad</span>' : ''}</span><span class="num">${coma(n)} series</span></li>`).join('')}</ul>
      <details class="extra"><summary>Ejercicios de la primera semana</summary>${semana1.map(d => `<p class="pequeno"><strong>${esc(d.foco)}:</strong> ${esc(d.ejercicios.map(e => nombreEj(e.ejercicio_id)).join(', '))}</p>`).join('')}</details>
      <p class="pequeno suave">Los ejercicios pueden variar un poco al armarlo, según lo que anotes de aquí a esa fecha.</p>
    </section>`}
    <div class="fila-botones">
      ${disp ? `<button type="button" class="boton primario" id="mp-armar">${sig ? `Armar el bloque ${sig.n}` : 'Empezar una temporada nueva'}</button>`
        : `<button type="button" class="boton" id="mp-antes">Empezarlo antes, el ${esc(fechaCorta(proximoLunes()))}</button>`}
      ${Object.keys(b).length ? '<button type="button" class="boton" id="mp-borrador-no">Descartar los cambios</button>' : ''}
    </div>
    ${disp ? '' : `<p class="pequeno suave">Desde el ${esc(fechaCorta(sumarDias(finDelPlan(), -6)))} te aviso en Entrenar para armarlo con un toque.</p>`}
  </div>`;
  const repintar = () => { const y = scrollY; vistaCiclo(ir); scrollTo(0, y); };
  $('mp-volver').onclick = () => ir('miplan');
  $('mp-ciclo-prioridades').onclick = () => { eleccion = null; desdeElegido = 'ciclo'; ir('miplan', { panel: 'prioridades' }); };
  document.querySelectorAll('[data-ciclo-campo]').forEach(x => x.onclick = () => {
    const campo = x.dataset.cicloCampo;
    const v = campo === 'dias_meta' ? Number(x.dataset.v) : x.dataset.v;
    guardarRespuestas(guardarEnBorrador(R(), { [campo]: v }));
    repintar();
  });
  $('mp-borrador-no')?.addEventListener('click', () => { const r2 = { ...R() }; delete r2.ciclo_siguiente; guardarRespuestas(r2); avisar('Descarté los cambios del siguiente ciclo.'); repintar(); });
  $('mp-armar')?.addEventListener('click', async ev => { ev.currentTarget.disabled = true; await armarBloqueSiguiente(); ir('miplan'); });
  $('mp-antes')?.addEventListener('click', ev => abrirHoja({
    titulo: '¿Empiezo el siguiente ciclo antes?', volver: ev.currentTarget,
    nota: `El bloque actual termina este domingo y el siguiente parte el ${fechaCorta(proximoLunes())}, con lo que elegiste acá. Lo registrado no cambia y puedes deshacerlo.`,
    opciones: [{ valor: 'si', icono: icono('visto'), clase: 'confirmar', nombre: 'Sí, empezarlo el lunes' }, { valor: 'no', icono: icono('cerrar'), nombre: 'No, esperar' }],
    alElegir: async x => { if (x !== 'si') return; await armarBloqueSiguiente({ forzar: true }); ir('miplan'); },
  }));
  mostrarMensaje();
}
