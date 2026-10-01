// Vista Hoy: check-in de bienestar, suplementos y la sesión del día con su registro: series con tipo (calentamiento,
// normal, al fallo, drop set, como en Hevy), lo de la vez anterior, cronómetro de descanso, superseries, el
// "¿Por qué?" de cada ejercicio y el desplegable de cómo te fue con nota para el entrenador.
import { E, guardar, R, D, C, K, EVIDENCIA, indice, hoy, ahora, esc, $, fechaCorta, presc, escala, opcionesRadio, chk, cambiarPlan, numero, coma, mostrarMensaje, avisar, unidadPeso, enUnidad, aKilos, seriesTexto, volumenTexto } from './comun.js';
import { evaluarDia, ajustarSesion, TEXTO_RECOMENDACION } from '../nucleo/bienestar.js';
import { checklist } from '../nucleo/suplementos.js';
import { explicarEjercicio } from '../nucleo/explicar.js';
import { sesionDe } from '../nucleo/agenda.js';
import { duracionEstimada, incrementoPara } from '../nucleo/motor-plan.js';
import { ESFUERZO, prioridadEsfuerzo, consejoSerie } from '../nucleo/series.js';
import { TIPOS_SERIE, tipoDe, etiquetas, cuantasFilas, anterior, cifras, tipoParaGuardar } from '../nucleo/registro.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { avisoCheckin } from './checkin.js';
import { avisoDescargaCorto } from './temporada.js';
import { subirACuenta } from './cola.js';
import { iniciarDescanso, detenerDescanso } from './descanso.js';
import { abrirHoja } from './hoja.js';
import { grupos, unir, separar, copiarSuperseries, despuesDeSerie, etiquetaSuperserie } from '../nucleo/superseries.js';
import * as nube from './nube.js';

const app = () => $('app');

export function vistaHoy(ir) {
  const f = hoy();
  const plan = E.plan;
  if (!plan || plan.bloqueado) return ir('inicio');
  const dia = sesionDe(plan, f);
  const b = E.bienestar[f];
  const sups = checklist(E.suplementos, E.tomas, f, ahora());
  const proxima = plan.dias.find(d => d.fecha > f);
  app().innerHTML = `<div id="vista-hoy">
    <h1>Hoy <span class="suave pequeno">${esc(fechaCorta(f))}</span></h1>
    ${D().mensaje_alerta ? `<div class="aviso ojo">${esc(D().mensaje_alerta)}</div>` : ''}
    ${avisoCheckin()}
    ${avisoDescargaCorto()}
    ${b ? `<div class="tarjeta fila-resumen"><span>Cómo estás: <strong class="num">${b.puntaje}</strong>/100 · ${esc(TEXTO_RECOMENDACION[b.recomendacion])}</span><button type="button" class="enlace" id="rehacer-bienestar">Cambiar</button></div>`
      : E.bienestarSaltado === f ? '<div class="tarjeta fila-resumen"><span class="suave">¿Cómo estás hoy?</span><button type="button" class="enlace" id="responder-bienestar">Responder</button></div>'
        : formularioBienestar()}
    ${sups.length ? `<section class="tarjeta"><h3>Suplementos</h3><ul class="lista-check">${sups.map((s, i) => `<li class="${s.estado}"><button type="button" class="check" data-toma="${s.suplemento_id}" ${s.estado === 'tomada' ? 'disabled aria-pressed="true"' : 'aria-pressed="false"'} aria-label="Marcar ${esc(s.nombre)} como tomado">${s.estado === 'tomada' ? '✓' : ''}</button><span>${esc(s.nombre)}${s.dosis ? ` · ${esc(s.dosis)}` : ''}</span><span class="suave pequeno">${s.hora || ''}${s.estado === 'atrasada' ? ' · atrasado' : ''}</span></li>`).join('')}</ul></section>` : ''}
    ${dia ? sesionHoy(dia) : `<section class="tarjeta"><h3>Hoy descansas</h3>${proxima ? `<p class="suave">La próxima es ${esc(proxima.foco)}, el ${esc(fechaCorta(proxima.fecha))}.</p>` : ''}<button type="button" class="boton" id="entrenar-igual">Quiero entrenar hoy igual</button></section>`}
  </div>`;
  enlazar(ir, dia);
  mostrarMensaje();
}

function formularioBienestar() {
  const fila = (etiqueta, campo) => `<div class="fila-b"><span class="pequeno">${etiqueta}</span><div>${campo}</div></div>`;
  return `<form class="tarjeta" id="bienestar">
    <div class="cab-tarjeta"><h3>¿Cómo estás hoy?</h3><button type="button" class="enlace pequeno" id="saltar-bienestar">Hoy no</button></div>
    <p class="suave pequeno">20 segundos. Ajusta la sesión de hoy y, con el tiempo, cuándo toca descargar.</p>
    <div class="bienestar">
      ${fila('Dormí', '<label class="horas"><input type="text" id="b-sueno" inputmode="decimal" autocomplete="off" placeholder="7" aria-label="Horas de sueño"> horas</label>')}
      ${fila('Sueño', escala('b-calidad', 1, 5, null, ['Muy malo', 'Muy bueno']))}
      ${fila('Cansancio', escala('b-cansancio', 1, 5, null, ['Fresco', 'Agotado']))}
      ${fila('Ánimo', escala('b-animo', 1, 5, null, ['Bajo', 'Muy bueno']))}
      ${fila('¿Enfermo?', opcionesRadio('b-enfermo', [['no', 'No'], ['resfrio', 'Resfrío leve'], ['fiebre_o_cuerpo', 'Fiebre o cuerpo cortado']], 'no'))}
    </div>
    <div class="fila-botones"><button type="submit" class="boton primario">Listo</button></div>
  </form>`;
}

// ── Filas de cada ejercicio ─────────────────────────────────────────────────
const idDe = (e, k) => e.ejercicio_id || `i${k}`;
const deTrabajo = t => t === 'normal' || t === 'fallo';
const filasGuardadas = (f, id) => E.filas?.[f]?.[id] ?? null;
/** Las filas de un ejercicio hoy, sin huecos: las que dejó la persona o, si no tocó nada, las del plan. */
function filasDe(f, e, k) {
  const lista = E.registro[f]?.[idDe(e, k)] || [];
  return Array.from({ length: cuantasFilas(e, lista, filasGuardadas(f, idDe(e, k))) }, (_, i) => lista[i] || {});
}
/** Deja la lista del registro con una fila real por cada fila que se ve (para cambiar tipos, agregar o quitar). */
function materializar(f, e, k) {
  const id = idDe(e, k);
  const lista = ((E.registro[f] ||= {})[id] ||= []);
  const n = cuantasFilas(e, lista, filasGuardadas(f, id));
  lista.length = Math.max(lista.length, n);
  for (let j = 0; j < n; j++) lista[j] ||= {};
  lista.length = n;
  return { lista, n };
}
const fijarFilas = (f, id, n) => { ((E.filas ||= {})[f] ||= {})[id] = n; };
const descansoDe = (e, k) => E.descansos?.[idDe(e, k)] ?? e.descanso_seg ?? 90;
/** Descanso de la vuelta de una superserie: el que eligió en el último ejercicio o, si no, el más largo del plan. */
const descansoVuelta = (ejs, g) => { const u = ejs[g.miembros.at(-1)]; return E.descansos?.[idDe(u, g.miembros.at(-1))] ?? Math.max(...g.miembros.map(m => ejs[m].descanso_seg ?? 90)); };
const nombreDe = e => e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || '';
const mmss = seg => (seg ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')}` : 'sin descanso');
const DESCANSOS = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

// Paneles abiertos ("¿Por qué?", "Qué priorizar", "Cómo te fue"): siguen abiertos aunque la vista se vuelva a dibujar.
const abiertos = new Set();

/** Series hechas y totales de la sesión, y sus cifras. */
function avance(dia) {
  const filas = dia.ejercicios.flatMap((e, k) => filasDe(dia.fecha, e, k));
  return { hechas: filas.filter(x => x.hecho).length, total: filas.length, cifras: cifras(filas) };
}
const avanceHtml = ({ hechas, total, cifras: c }) => `<div class="avance" id="avance" aria-live="polite">
  <div class="fila-avance"><span class="pequeno"><strong class="num">${hechas}</strong> de ${total} series${hechas && hechas === total ? ' · ¡completa!' : ''}</span><div class="medidor" aria-hidden="true"><i style="width:${total ? Math.round((hechas / total) * 100) : 0}%"></i></div></div>
  ${hechas ? `<p class="cifras pequeno suave">${c.minutos ? `${c.minutos} min · ` : ''}${c.series} de trabajo · volumen ${esc(volumenTexto(c.volumen))}</p>` : ''}
</div>`;

function sesionHoy(dia) {
  const f = dia.fecha;
  const notas = E.notas[f] || {};
  const todas = seriesAnotadas(E.sesiones, E.registro);
  return `<section class="tarjeta dia">
    <h3>${esc(dia.foco)} ${dia.hora ? `<span class="chip">${esc(dia.hora)}</span>` : ''} <span class="chip num">~${duracionEstimada(dia.ejercicios)} min</span></h3>
    ${dia.ejercicios.length ? avanceHtml(avance(dia)) : ''}
    <p class="suave pequeno">${esc(dia.racional || '')}</p>
    ${dia.ejercicios.length ? '' : '<p>Hoy, descanso activo: 20 a 30 minutos de caminata o bicicleta suave y movilidad.</p>'}
    <ol class="ejercicios-hoy">${dia.ejercicios.map((e, k) => ejercicioHoy(e, k, f, e.ejercicio_id ? anterior(todas, e.ejercicio_id, f) : null, notas[idDe(e, k)] || {}, dia)).join('')}</ol>
    ${dia.cardio ? `<p class="pequeno"><strong>Cardio:</strong> ${esc(dia.cardio)}</p>` : ''}
    <details class="extra"><summary>Calentamiento</summary><ul class="pequeno">${(dia.calentamiento || []).map(c => `<li><strong>${esc(c.name)}</strong>. ${esc(c.how)}</li>`).join('')}</ul></details>
    <div class="fila-botones">
      <button type="button" class="boton" id="problema">Tengo un problema con la sesión</button>
      <button type="button" class="boton primario" id="terminar">${E.sesiones.some(s => s.fecha === f && !s.origen) ? 'Guardar de nuevo' : 'Terminar sesión'}</button>
    </div>
  </section>`;
}

function ejercicioHoy(e, k, f, previas, nota, dia) {
  const id = idDe(e, k);
  const g = grupos(dia.ejercicios)[k];
  const ej = indice.porId.get(e.ejercicio_id);
  const filas = filasDe(f, e, k);
  const etiq = etiquetas(filas);
  const u = unidadPeso();
  let iTrabajo = 0; // posición entre las series de trabajo, para mostrar lo de la vez anterior
  const filasHtml = filas.map((r, i) => {
    const t = tipoDe(r);
    const prev = deTrabajo(t) ? previas?.series[iTrabajo++] : null;
    const kg = r.kg ?? (deTrabajo(t) ? e.carga_kg : null);
    const repsPh = prev?.reps ?? (e.unidad === 'seg' ? 'seg' : deTrabajo(t) ? `${e.reps_min}-${e.reps_max}` : 'reps');
    return `<div class="serie tipo-${t}${r.hecho ? ' hecha' : ''}${r.rpe != null ? ' con-esfuerzo' : ''}${e.unidad === 'seg' ? ' seg' : ''}">
      <button type="button" class="tipo-serie" data-tipo-serie="${id}" data-i="${i}" aria-label="Serie ${etiq[i]}, ${TIPOS_SERIE[t].nombre.toLowerCase()}. Cambiar el tipo">${etiq[i]}</button>
      ${e.unidad === 'seg' ? '' : `<input type="text" inputmode="decimal" autocomplete="off" data-ej="${id}" data-i="${i}" data-c="kg" value="${esc(coma(enUnidad(kg)))}" placeholder="${esc(prev?.carga_kg != null ? coma(enUnidad(prev.carga_kg)) : u)}" aria-label="${u === 'lb' ? 'Libras' : 'Kilos'}, serie ${etiq[i]}">`}
      <input type="text" inputmode="numeric" autocomplete="off" data-ej="${id}" data-i="${i}" data-c="reps" value="${esc(r.reps ?? '')}" placeholder="${esc(repsPh)}" aria-label="${e.unidad === 'seg' ? 'Segundos' : 'Repeticiones'}, serie ${etiq[i]}">
      <button type="button" class="check" data-hecho="${id}" data-i="${i}" aria-pressed="${Boolean(r.hecho)}" aria-label="Serie ${etiq[i]} hecha">${r.hecho ? '✓' : ''}</button>
      ${e.unidad === 'seg' || !deTrabajo(t) ? '' : `<div class="esfuerzo"><select data-ej="${id}" data-i="${i}" data-c="rpe" aria-label="Esfuerzo, serie ${etiq[i]}"><option value="">Esfuerzo (RPE · RIR)</option>${ESFUERZO.map(o => `<option value="${o.rpe}"${Number(r.rpe) === o.rpe ? ' selected' : ''}>${o.etiqueta}</option>`).join('')}</select></div>`}
      ${r.consejo && deTrabajo(t) ? `<p class="consejo ${r.consejo.tipo}">${esc(r.consejo.texto)}</p>` : ''}</div>`;
  }).join('');
  const preguntas = K.por_ejercicio.preguntas.filter(p => !p.mostrar_si || Object.entries(p.mostrar_si).every(([q, vals]) => vals.includes(nota[q])));
  // En una superserie, el descanso se elige en el último ejercicio y vale para la vuelta.
  const desc = g ? descansoVuelta(dia.ejercicios, g) : descansoDe(e, k);
  const conDescanso = !g || g.pos === g.total;
  return `<li class="ej${g ? ` en-superserie ss-${g.letra}${g.pos === 1 ? ' ss-inicio' : ''}` : ''}" id="ej-${id}">
    ${g?.pos === 1 ? `<p class="titulo-ss">Superserie ${g.letra} · sin descanso entre estos ${g.total}, descansas al terminar la vuelta</p>` : ''}
    <div class="ej-cab"><span class="nombre">${g ? `<span class="chip-ss">${etiquetaSuperserie(g)}</span>` : ''}${esc(e.nombre || ej?.nombre || id)}</span><span class="presc">${esc(presc(e))}</span></div>
    ${previas ? `<p class="anterior pequeno suave">La vez anterior (${esc(fechaCorta(previas.fecha))}): ${esc(seriesTexto(previas.series))}</p>` : ''}
    ${e.nota && !(previas && /^Elige un peso/.test(e.nota)) ? `<p class="pequeno suave">${esc(e.nota)}</p>` : ''}
    <div class="series">${filasHtml}</div>
    <div class="agregar-series"><button type="button" class="enlace" data-agregar="${id}">+ Serie</button><button type="button" class="enlace" data-calentar="${id}">+ Calentamiento</button>
      ${conDescanso ? `<label class="descanso-ej pequeno">${g ? 'Descanso de la vuelta' : 'Descanso'} <select data-descanso="${id}" aria-label="${g ? `Descanso al terminar cada vuelta de la superserie ${g.letra}` : `Descanso entre series de ${esc(e.nombre || ej?.nombre || 'este ejercicio')}`}">${[...new Set([...DESCANSOS, desc])].sort((a, b) => a - b).map(sg => `<option value="${sg}"${sg === desc ? ' selected' : ''}>${mmss(sg)}</option>`).join('')}</select></label>` : '<span class="descanso-ej pequeno">Sin descanso: sigue la superserie</span>'}</div>
    <div class="acciones-ej">
      ${e.ejercicio_id && dia.ejercicios.length > 1 ? `<button type="button" class="enlace" data-superserie="${id}">${g ? `Superserie ${g.letra}` : 'Superserie'}</button>` : ''}
      ${ej ? `<button type="button" class="enlace" data-porque="${id}" aria-expanded="${abiertos.has(`porque-${id}`)}">¿Por qué?</button>${e.unidad !== 'seg' ? `<button type="button" class="enlace" data-prioriza="${id}" aria-expanded="${abiertos.has(`prioriza-${id}`)}">Qué priorizar</button>` : ''}<a class="enlace" href="https://www.youtube.com/results?search_query=${encodeURIComponent(`${ej.nombre} técnica correcta`)}" target="_blank" rel="noopener">Video</a>` : '<span class="chip">Indicado por tu profesional</span>'}
    </div>
    ${ej && e.unidad !== 'seg' ? `<p class="prioriza pequeno" id="prioriza-${id}"${abiertos.has(`prioriza-${id}`) ? '' : ' hidden'}>${esc(prioridadEsfuerzo(e, ej, D(), (R().lesiones || []).filter(l => l.activa !== false).map(l => l.region)).texto)}</p>` : ''}
    <div id="porque-${id}"></div>
    <details class="extra" data-panel="nota-${id}"${Object.keys(nota).length || abiertos.has(`nota-${id}`) ? ' open' : ''}><summary>Cómo te fue · nota para el entrenador</summary>
      <div class="preguntas-ej">
        ${preguntas.map(p => `<div><span class="pequeno">${esc(p.texto)}</span>${p.tipo === 'escala'
          ? escala(`n-${id}-${p.id}`, p.min, p.max, nota[p.id], p.extremos, `data-nota="${id}" data-p="${p.id}" data-num`)
          : opcionesRadio(`n-${id}-${p.id}`, p.zonas ? [] : p.opciones, nota[p.id], `data-nota="${id}" data-p="${p.id}"`)}${p.zonas ? `<select data-nota="${id}" data-p="${p.id}"><option value="">—</option>${C.zonas[p.zonas].map(([z, t]) => `<option value="${z}"${nota[p.id] === z ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>` : ''}</div>`).join('')}
        <label class="pequeno">${esc(K.por_ejercicio.nota_entrenador.texto)}<textarea data-nota="${id}" data-p="nota" placeholder="${esc(K.por_ejercicio.nota_entrenador.ayuda)}">${esc(nota.nota || '')}</textarea></label>
        <label class="pequeno"><input type="checkbox" data-nota="${id}" data-p="para_entrenador"${chk(nota.para_entrenador)}> Que la vea mi entrenador</label>
      </div>
    </details>
  </li>`;
}

function enlazar(ir, dia) {
  const f = hoy();
  $('rehacer-bienestar')?.addEventListener('click', () => { delete E.bienestar[f]; guardar(); vistaHoy(ir); });
  $('saltar-bienestar')?.addEventListener('click', () => { E.bienestarSaltado = f; guardar(); vistaHoy(ir); });
  $('responder-bienestar')?.addEventListener('click', () => { E.bienestarSaltado = null; guardar(); vistaHoy(ir); });
  $('bienestar')?.addEventListener('submit', async ev => {
    ev.preventDefault();
    const val = n => document.querySelector(`input[name="${n}"]:checked`)?.value;
    const datos = {
      sueno_horas: numero($('b-sueno').value), sueno_calidad: Number(val('b-calidad')) || null,
      cansancio: Number(val('b-cansancio')) || null, animo: Number(val('b-animo')) || null, enfermo: val('b-enfermo') || 'no',
    };
    const r = evaluarDia(datos);
    E.bienestar[f] = { ...datos, puntaje: r.puntaje, recomendacion: r.recomendacion, motivos: r.motivos };
    guardar();
    if (nube.conectado()) nube.guardarBienestar(f, { ...datos, puntaje: r.puntaje, recomendacion: r.recomendacion }).catch(() => {});
    if (dia && r.recomendacion !== 'normal') {
      E.mensaje = null;
      vistaHoy(ir);
      const caja = document.createElement('div');
      caja.className = 'aviso ojo';
      caja.innerHTML = `${esc(r.motivos.length ? `Por lo que contaste (${r.motivos.join(', ')}): ` : '')}${esc(TEXTO_RECOMENDACION[r.recomendacion])}<div class="fila-botones"><button type="button" class="boton primario" id="aplicar-bienestar">Ajustar la sesión</button><button type="button" class="boton" id="normal-igual">Hacerla normal igual</button></div>`;
      $('vista-hoy').querySelector('h1').after(caja);
      $('aplicar-bienestar').onclick = async () => {
        const nuevo = structuredClone(E.plan);
        sesionDe(nuevo, f).ejercicios = ajustarSesion(sesionDe(nuevo, f).ejercicios, r.recomendacion).map((e, i) => ({ ...e, orden: i }));
        await cambiarPlan(nuevo, `Sesión de hoy ajustada: ${TEXTO_RECOMENDACION[r.recomendacion]}`, nube);
        vistaHoy(ir);
      };
      $('normal-igual').onclick = () => caja.remove();
    } else vistaHoy(ir);
  });
  document.querySelectorAll('[data-toma]').forEach(b => b.onclick = () => {
    E.tomas.push({ suplemento_id: b.dataset.toma, fecha: f, hora: ahora().slice(11) });
    guardar();
    if (nube.conectado()) nube.registrarToma(b.dataset.toma, f, ahora().slice(11)).catch(() => {});
    vistaHoy(ir);
  });
  document.querySelectorAll('[data-ir-checkin]').forEach(b => b.onclick = () => ir('checkin', b.dataset.irCheckin));
  document.querySelectorAll('[data-ir-semana]').forEach(b => b.onclick = () => ir('semana'));
  $('entrenar-igual')?.addEventListener('click', () => ir('coach', 'Hoy no tenía sesión pero quiero entrenar, ¿qué otra opción tienes?'));
  $('problema')?.addEventListener('click', () => ir('coach'));
  if (!dia) return;

  const raiz = $('vista-hoy');
  const repintar = () => vistaHoyMantener(ir);
  const ejercicioDe = id => { const k = dia.ejercicios.findIndex((x, j) => idDe(x, j) === id); return { e: dia.ejercicios[k], k }; };
  const lugar = (R().lugares || [])[0];
  /** Consejo para la serie siguiente (nucleo/series.js), según reps, esfuerzo y fallo. Solo en las de trabajo. */
  const consejo = (e, r) => {
    const ej = indice.porId.get(e.ejercicio_id);
    return deTrabajo(tipoDe(r)) ? consejoSerie(e, { ...r, fallo: tipoDe(r) === 'fallo' }, ej ? incrementoPara(ej, lugar) : null) : null;
  };

  // Escribir kilos (o libras) y repeticiones: se guarda en kilos, sin volver a dibujar.
  raiz.addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset.ej && (t.dataset.c === 'kg' || t.dataset.c === 'reps')) {
      const { e, k } = ejercicioDe(t.dataset.ej);
      const { lista } = materializar(f, e, k);
      const v = numero(t.value);
      lista[t.dataset.i] = { ...lista[t.dataset.i], [t.dataset.c]: t.dataset.c === 'kg' ? aKilos(v) : v };
      guardar();
    } else if (t.dataset.nota && t.tagName === 'TEXTAREA') guardarNota(t.dataset.nota, 'nota', t.value);
  });

  // Tocar el número de la serie: elegir el tipo (como en Hevy), con una explicación detrás de cada "?".
  raiz.querySelectorAll('[data-tipo-serie]').forEach(b => b.onclick = () => {
    const { e, k } = ejercicioDe(b.dataset.tipoSerie);
    const i = Number(b.dataset.i);
    abrirHoja({
      titulo: 'Tipo de serie', volver: b,
      opciones: [
        ...Object.entries(TIPOS_SERIE).map(([valor, x]) => ({ valor, letra: x.letra || '1', clase: `tipo-${valor}`, nombre: x.nombre, ayuda: x.ayuda })),
        { valor: 'quitar', letra: '✕', clase: 'quitar', nombre: 'Quitar la serie', peligro: true },
      ],
      alElegir: t => {
        const { lista, n } = materializar(f, e, k);
        if (t === 'quitar') { lista.splice(i, 1); fijarFilas(f, idDe(e, k), n - 1); }
        else {
          const r = { ...lista[i], tipo: t };
          delete r.fallo;
          if (t === 'fallo') r.rpe = 10;
          else if (r.rpe === 10) r.rpe = null;
          if (!deTrabajo(t)) { delete r.rpe; delete r.consejo; }
          if (r.hecho) r.consejo = consejo(e, r);
          lista[i] = r;
        }
        guardar(); repintar();
      },
    });
  });

  // Superserie: unir este ejercicio con otro del día (o sacarlo). Se repite en este mismo día de las semanas siguientes.
  raiz.querySelectorAll('[data-superserie]').forEach(b => b.onclick = () => {
    const { e, k } = ejercicioDe(b.dataset.superserie);
    const g = grupos(dia.ejercicios);
    const otros = dia.ejercicios.map((x, j) => ({ x, j })).filter(({ x, j }) => j !== k && x.ejercicio_id && !(g[k] && g[j]?.letra === g[k].letra));
    abrirHoja({
      titulo: g[k] ? `Superserie ${g[k].letra}` : 'Hacer superserie',
      nota: 'Dos o más ejercicios seguidos, sin descanso entre ellos: descansas al terminar la vuelta. Ahorra tiempo y va mejor con ejercicios que no usan los mismos músculos, como bíceps con tríceps o pecho con espalda.',
      volver: b,
      opciones: [
        ...otros.map(({ x, j }) => ({ valor: String(j), letra: g[j] ? etiquetaSuperserie(g[j]) : '+', nombre: `${g[k] ? 'Sumar' : 'Con'} ${nombreDe(x)}` })),
        ...(g[k] ? [{ valor: 'separar', letra: '✕', clase: 'quitar', nombre: 'Sacar de la superserie', peligro: true }] : []),
      ],
      alElegir: async v => {
        const nuevo = structuredClone(E.plan);
        const d = sesionDe(nuevo, f);
        d.ejercicios = v === 'separar' ? separar(d.ejercicios, k) : unir(d.ejercicios, k, Number(v));
        const futuros = nuevo.dias.filter(x => x.plantilla && x.plantilla === d.plantilla && x.fecha > f);
        for (const x of futuros) x.ejercicios = copiarSuperseries(d.ejercicios, x.ejercicios);
        const otro = v === 'separar' ? null : nombreDe(dia.ejercicios[Number(v)]);
        await cambiarPlan(nuevo, v === 'separar' ? `${nombreDe(e)} salió de la superserie.` : `Superserie: ${nombreDe(e)} con ${otro}${futuros.length ? ', también en las próximas semanas' : ''}.`, nube);
        repintar();
      },
    });
  });

  // Agregar una serie al final, o un calentamiento al principio.
  raiz.querySelectorAll('[data-agregar], [data-calentar]').forEach(b => b.onclick = () => {
    const { e, k } = ejercicioDe(b.dataset.agregar || b.dataset.calentar);
    const { lista, n } = materializar(f, e, k);
    if (b.dataset.calentar) lista.unshift({ tipo: 'calentamiento' }); else lista.push({});
    fijarFilas(f, idDe(e, k), n + 1);
    guardar(); repintar();
  });

  // Marcar una serie: si no escribió nada, toma lo de la serie anterior de hoy, lo de la vez anterior o lo del plan.
  raiz.querySelectorAll('[data-hecho]').forEach(b => b.onclick = () => {
    const { e, k } = ejercicioDe(b.dataset.hecho);
    const i = Number(b.dataset.i);
    const { lista, n } = materializar(f, e, k);
    const r = { ...lista[i] };
    const t = tipoDe(r);
    if (!r.hecho && deTrabajo(t)) {
      const posicion = lista.slice(0, i).filter(x => deTrabajo(tipoDe(x))).length;
      const prev = e.ejercicio_id ? anterior(seriesAnotadas(E.sesiones, E.registro), e.ejercicio_id, f)?.series[posicion] : null;
      const hoyAntes = [...lista.slice(0, i)].reverse().find(x => deTrabajo(tipoDe(x)) && x.kg != null);
      if (r.kg == null && e.unidad !== 'seg') r.kg = hoyAntes?.kg ?? prev?.carga_kg ?? e.carga_kg ?? null;
      if (r.reps == null) r.reps = prev?.reps ?? e.reps_max ?? null;
    }
    if (!r.hecho) r.t ||= Date.now();
    r.hecho = !r.hecho;
    r.consejo = r.hecho ? consejo(e, r) : null;
    lista[i] = r;
    guardar();
    // Descanso hasta la serie siguiente (sin descanso antes de un drop set); con la última de la sesión, guardarla.
    const a = avance(dia);
    if (r.hecho && a.hechas === a.total) { detenerDescanso(); avisar('¡Sesión completa! Toca "Terminar sesión" para guardarla.'); }
    else if (r.hecho) {
      const quedan = lista.slice(0, n).filter(x => !x.hecho).length;
      const seg = t === 'calentamiento' ? Math.min(60, descansoDe(e, k)) : descansoDe(e, k);
      const g = grupos(dia.ejercicios);
      if (i + 1 < n && tipoDe(lista[i + 1]) === 'drop') detenerDescanso();
      else if (g[k] && t !== 'calentamiento') {
        // Superserie: sin descanso hasta el último ejercicio de la vuelta; ahí, el descanso de la vuelta.
        const pendientes = dia.ejercicios.map((x, j) => filasDe(f, x, j).filter(y => !y.hecho).length);
        const sig = despuesDeSerie(dia.ejercicios, k, pendientes);
        const quien = j => `${etiquetaSuperserie(g[j])} ${nombreDe(dia.ejercicios[j])}`;
        const vuelta = descansoVuelta(dia.ejercicios, g[k]);
        if (!sig.descansar) { detenerDescanso(); avisar(`Superserie: sigue con ${quien(sig.siguiente)}, sin descanso.`); }
        else if (vuelta) {
          document.getElementById('aviso-flotante')?.classList.remove('visible');
          iniciarDescanso(vuelta, sig.siguiente != null ? `Descanso · vuelve a ${etiquetaSuperserie(g[sig.siguiente])}` : 'Descanso · sigue otro ejercicio');
        }
      } else if (seg) iniciarDescanso(seg, quedan ? `Descanso · falta${quedan === 1 ? '' : 'n'} ${quedan} serie${quedan === 1 ? '' : 's'}` : 'Descanso · sigue otro ejercicio');
    } else detenerDescanso();
    repintar();
  });

  raiz.addEventListener('change', ev => {
    const t = ev.target;
    // Esfuerzo: RPE 10 es una serie al fallo; bajar de 10 la deja normal.
    if (t.dataset.ej && t.dataset.c === 'rpe') {
      const { e, k } = ejercicioDe(t.dataset.ej);
      const { lista } = materializar(f, e, k);
      const r = { ...lista[t.dataset.i], rpe: t.value === '' ? null : Number(t.value) };
      delete r.fallo;
      if (r.rpe === 10) r.tipo = 'fallo';
      else if (tipoDe(r) === 'fallo') r.tipo = 'normal';
      if (r.hecho) r.consejo = consejo(e, r);
      lista[t.dataset.i] = r;
      guardar(); repintar();
      return;
    }
    if (t.dataset.descanso) { (E.descansos ||= {})[t.dataset.descanso] = Number(t.value); guardar(); return; }
    if (!t.dataset.nota || t.tagName === 'TEXTAREA') return;
    const v = t.type === 'checkbox' ? t.checked : t.dataset.num !== undefined ? Number(t.value) : t.value;
    guardarNota(t.dataset.nota, t.dataset.p, v);
    if (t.dataset.p === 'molestia') repintar();
  });
  function guardarNota(id, p, v) { ((E.notas[f] ||= {})[id] ||= {})[p] = v; guardar(); }
  raiz.querySelectorAll('details[data-panel]').forEach(d => d.addEventListener('toggle', () => { d.open ? abiertos.add(d.dataset.panel) : abiertos.delete(d.dataset.panel); }));

  // Qué priorizar si no salen las repeticiones o la reserva.
  raiz.querySelectorAll('[data-prioriza]').forEach(b => b.onclick = () => {
    const p = $(`prioriza-${b.dataset.prioriza}`);
    p.hidden = !p.hidden;
    p.hidden ? abiertos.delete(`prioriza-${b.dataset.prioriza}`) : abiertos.add(`prioriza-${b.dataset.prioriza}`);
    b.setAttribute('aria-expanded', String(!p.hidden));
  });

  // ¿Por qué?
  const pintarPorque = id => {
    const e = dia.ejercicios.find(x => x.ejercicio_id === id);
    const ex = explicarEjercicio({ e, dia, plan: E.plan, respuestas: R(), indice, evidencia: EVIDENCIA });
    $(`porque-${id}`).innerHTML = `<div class="panel porque">
      ${ex.motivos.map(m => `<div><strong>${esc(m.pregunta)}</strong><p>${esc(m.respuesta)}</p>${m.fuente ? `<p class="pequeno suave">Fuente: ${esc(m.fuente.documento)} → ${esc(m.fuente.seccion)}${m.refs.length ? ` [${m.refs.join(', ')}]` : ''}</p>` : ''}</div>`).join('')}
      ${ex.referencias.length ? `<details class="extra"><summary>Papers que lo respaldan (${ex.referencias.length})</summary><ol class="refs">${ex.referencias.map(r => `<li value="${r.n}">${esc(r.texto)} <span class="chip ${r.verificada ? 'verificada' : ''}">${r.verificada ? 'verificada' : 'por verificar'}</span></li>`).join('')}</ol></details>` : ''}
      <a class="enlace" href="${esc(ex.video)}" target="_blank" rel="noopener">Ver videos de técnica</a>
    </div>`;
  };
  raiz.querySelectorAll('[data-porque]').forEach(b => {
    if (abiertos.has(`porque-${b.dataset.porque}`)) pintarPorque(b.dataset.porque);
    b.onclick = () => {
      const id = b.dataset.porque, abierto = abiertos.has(`porque-${id}`);
      if (abierto) { abiertos.delete(`porque-${id}`); $(`porque-${id}`).innerHTML = ''; } else { abiertos.add(`porque-${id}`); pintarPorque(id); }
      b.setAttribute('aria-expanded', String(!abierto));
    };
  });

  // Terminar sesión: queda en el historial local y, con cuenta, en el servidor.
  $('terminar').onclick = async () => {
    const series = [], notas = [];
    let orden = 0;
    dia.ejercicios.forEach((e, k) => {
      const id = idDe(e, k);
      for (const r of filasDe(f, e, k).filter(x => x.hecho)) {
        const tipo = tipoParaGuardar(r);
        series.push({ orden: orden++, ejercicio_id: e.ejercicio_id, ejercicio_nombre: e.nombre || indice.porId.get(e.ejercicio_id)?.nombre || id, tipo,
          carga_kg: e.unidad === 'seg' ? null : r.kg ?? null, reps: e.unidad === 'seg' ? null : r.reps ?? null, duracion_seg: e.unidad === 'seg' ? r.reps ?? null : null,
          rpe: r.rpe ?? null, rir: tipo === 'fallo' ? 0 : r.rpe != null ? 10 - r.rpe : null });
      }
      const n = (E.notas[f] || {})[id];
      if (n && Object.keys(n).length) {
        const { nota, para_entrenador, ...respuestas } = n;
        notas.push({ fecha: f, ejercicio_id: e.ejercicio_id, respuestas, nota: nota || null, para_entrenador: Boolean(para_entrenador) });
      }
    });
    if (!series.length) { avisar('Marca al menos una serie como hecha.'); return; }
    // El id es del teléfono y se mantiene al guardar de nuevo: así la cuenta la reemplaza en vez de duplicarla.
    // Las sesiones importadas (Hevy) de ese día no se tocan.
    const id = E.sesiones.find(s => s.fecha === f && !s.origen)?.id || crypto.randomUUID();
    E.sesiones = E.sesiones.filter(s => !(s.fecha === f && !s.origen));
    E.sesiones.push({ id, fecha: f, titulo: dia.foco, series, notas });
    E.mensaje = `Sesión guardada: ${series.length} serie${series.length === 1 ? '' : 's'}.`;
    detenerDescanso();
    guardar();
    if (nube.conectado()) {
      const subio = await subirACuenta('sesion', id, { fecha: f, titulo: dia.foco, series, notas });
      E.mensaje += subio ? ' También quedó en tu cuenta.' : ' Todavía no se pudo subir a tu cuenta: queda en este teléfono y se sube sola cuando vuelva la señal.';
      guardar();
    }
    repintar();
  };
}

/** Vuelve a dibujar Hoy sin mover la pantalla. */
function vistaHoyMantener(ir) {
  const y = window.scrollY;
  vistaHoy(ir);
  window.scrollTo(0, y);
}
