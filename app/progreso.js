import { calendarioHtml, enlazarCalendario } from './calendario-asistencia.js';
// Vista Progreso: la semana por músculo (series hechas contra las del plan), la constancia, el ritmo de cada ejercicio
// (que abre su ficha con gráficos e historial), cómo llegas (energía, ánimo y sueño) y cómo rindes, el historial con buscador,
// y las fotos de progreso privadas. Suplementos, indicaciones del médico y notas para el entrenador están en Mi plan
// (app/cuidados.js).
import { textoCardio } from '../nucleo/unidades.js';
import { datoCambiado, sincronizarDatosTelefono } from './datos-nube.js';
import { E, D, R, guardar, C, esc, $, fechaCorta, hoy, indice, opcionesRadio, chk, mostrarMensaje, seriesTexto, volumenTexto, peso, unidadPeso, enUnidad, aKilos, numero, IMAGENES, avisar } from './comun.js';
import { tipoParaGuardar } from '../nucleo/registro.js';
import { sesionDe, sumarDias, diaSemana } from '../nucleo/agenda.js';
import { guardarFotoLocal, listarFotosLocales, borrarFotoLocal } from './fotos-local.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { semanaPorMusculo, musculosContraFranja } from '../nucleo/volumen-semana.js';
import { resumenPeriodo, periodo } from '../nucleo/resumen-periodo.js';
import { CAMPOS_MEDIDA, nuevaMedida, agregarMedida, camposConDatos, cambioMedida } from '../nucleo/medidas.js';
import { direccionMeta } from '../nucleo/salud-apple.js';
import { NOMBRE_MUSCULO, mayuscula, imagenMusculo } from './musculos.js';
import * as nube from './nube.js';
import { esAsistido } from '../nucleo/catalogo.js';
import { bienvenidaProgreso, historialVacio } from './estados-visuales.js';
import { lineaSimple, lineaHevy, barrasDivergentes } from './grafico.js';
import { rendimientoSesiones, segunComoLlegas, textoPct } from '../nucleo/rendimiento-sesion.js';
import { sumarDias as sumar } from '../nucleo/agenda.js';
import { constanciaEntreno } from '../nucleo/constancia.js';
import { recordsPorSesion } from '../nucleo/records.js';
import { normalizar } from '../nucleo/catalogo.js';
import { ritmoDe, textoRitmo } from './progreso-ejercicio.js';
import { miniatura } from './imagenes.js';
import { icono } from './iconos.js';
import { ajuste } from './ajustes-sesion.js';
import { abrirPorId } from './historias.js';
import { comprobaciones, punteria } from '../nucleo/comprobacion-rir.js';
import { graficoSemanasHtml, tableroProgresoHtml, enlazarProgresoHevy, esfuerzoHtml, enlazarEsfuerzo, anioHtml, enlazarAnio, musculosMapaHtml, enlazarMusculosMapa, seccionProgreso, elegirSeccionProgreso, TITULO_SECCION } from './progreso-hevy.js';

const nombreEj = id => indice.porId.get(id)?.nombre || id;
let verTodo = false;
let buscar = '';
let todosEjercicios = false;
let periodoElegido = 'mes'; // 'mes', 'pasado' o 'año'
let medidaElegida = null, medidasAbierto = false;

/** Sesiones para el historial: las guardadas (de la app o importadas de Hevy) y los días con series marcadas sin terminar. */
function historial() {
  const out = E.sesiones.map(s => ({ id: s.id, fecha: s.fecha, titulo: s.titulo, origen: s.origen, comentario: s.comentario, duracion_min: s.duracion_min, hora: s.hora,
    series: (s.series || []).map(x => ({ ejercicio_id: x.ejercicio_id, nombre: x.ejercicio_nombre || nombreEj(x.ejercicio_id), carga_kg: x.carga_kg, reps: x.reps ?? x.duracion_seg, tipo: x.tipo, asistido: esAsistido(indice.porId.get(x.ejercicio_id)), distancia_m: x.distancia_m, duracion_seg: x.duracion_seg })) }));
  for (const [fecha, porEj] of Object.entries(E.registro)) {
    if (E.sesiones.some(s => s.fecha === fecha && !s.origen)) continue;
    const series = Object.entries(porEj || {}).flatMap(([id, l]) => (l || []).filter(x => x?.hecho)
      .map(x => ({ ejercicio_id: id, nombre: nombreEj(id), carga_kg: x.kg ?? null, reps: x.reps ?? null, tipo: tipoParaGuardar(x) })));
    if (series.length) out.push({ fecha, titulo: (E.plan && sesionDe(E.plan, fecha)?.foco) || 'Sesión', sinTerminar: true, series });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}
const series = n => `${n} serie${n === 1 ? '' : 's'}`;
const deTrabajo = x => !['calentamiento', 'drop', 'descarga'].includes(x.tipo);
// La ayuda de la máquina (asistidos) no es peso levantado: no suma al volumen.
const volumen = series => series.filter(x => (x.tipo !== 'calentamiento' || ajuste('calentamientoStats')) && !x.asistido).reduce((a, x) => a + (Number(x.carga_kg) || 0) * (Number(x.reps) || 0), 0);

/** Esta semana por músculo: series hechas de las que tocan, con la imagen de cada músculo cuando llega. */
function semanaHtml() {
  const r = semanaPorMusculo({ series: seriesAnotadas(E.sesiones, E.registro), plan: E.plan, indice, hoy: hoy() });
  if (!r.filas.length) return '';
  const n = x => String(Math.round(x)); // las series que ayudan cuentan media: se muestra redondeado
  const nombre = m => mayuscula(NOMBRE_MUSCULO[m] || m);
  const img = m => { const src = imagenMusculo(m); return src ? `<img class="img-musculo chica" src="${src}" alt="" width="64" height="64" decoding="async">` : ''; };
  return `<section class="tarjeta semana-cuerpo">
    <h3>Esta semana</h3>
    <p class="pequeno suave">Series hechas de las que tocan esta semana, por músculo.</p>
    <ul class="barras-semana">${r.filas.filter(f => f.planeadas >= 1 || f.hechas >= 1).map(f => `<li>${img(f.musculo)}<span class="nombre-musculo">${esc(nombre(f.musculo))}</span><span class="pista" aria-hidden="true"><i style="width:${Math.round(f.avance * 100)}%"></i></span><span class="num pequeno">${n(f.hechas)}${f.planeadas ? ` de ${n(f.planeadas)}` : ''}</span></li>`).join('')}</ul>
  </section>`;
}

/** Músculos contra lo recomendado, como el tablero: los últimos 12 días llevados a una semana, contra la franja de tu
 *  nivel, con el cambio respecto de los 12 días anteriores, tu promedio y las semanas anteriores (plegadas). */
const ESTADO = { bajo: 'Muy bajo', cerca: 'Bajo', bien: 'En la franja', alto: 'Sobre la franja' };
function franjaHtml() {
  const rango = D().series_rango;
  if (!rango) return '';
  const r = musculosContraFranja({ series: seriesAnotadas(E.sesiones, E.registro), indice, hoy: hoy(), rango });
  if (!r.filas.length) return '';
  const [lo, hi] = rango;
  const n = x => String(x).replace('.', ',');
  const prioridad = new Set(E.respuestas?.musculos_prioridad || []);
  const filas = [...r.filas].sort((a, b) => (prioridad.has(b.musculo) - prioridad.has(a.musculo)) || b.reciente - a.reciente);
  const tope = Math.max(hi + 6, ...filas.map(f => f.reciente));
  const pct = v => `${Math.min(100, Math.round(v / tope * 100))}%`;
  const nombre = m => mayuscula(NOMBRE_MUSCULO[m] || m);
  const seguido = filas.filter(f => f.seguido);
  const cambio = f => (Math.abs(f.cambio) < 0.5 ? 'igual que antes' : `${f.cambio > 0 ? 'subió' : 'bajó'} ${n(Math.abs(f.cambio))}`);
  return `<section class="tarjeta">
    <h3 id="p-estadisticas">Músculos contra lo recomendado</h3>
    <p class="pequeno suave">Series de los últimos 12 días, llevadas a una semana. La franja de tu nivel es de ${lo} a ${hi} por semana${prioridad.size ? '; tus zonas prioritarias pueden pasarse un poco' : ''}.</p>
    ${seguido.length ? `<p class="aviso ojo pequeno">${esc(seguido.map(f => nombre(f.musculo)).join(', '))} ${seguido.length === 1 ? 'lleva' : 'llevan'} más de 3 semanas bajo la franja.</p>` : ''}
    <ul class="franja-musculos">${filas.map(f => `<li>
      <span class="nombre-musculo">${esc(nombre(f.musculo))}${prioridad.has(f.musculo) ? ' <span class="chip">Prioridad</span>' : ''}</span>
      <span class="num estado-${f.estado}">${n(f.reciente)}</span>
      <span class="pista-franja" aria-hidden="true"><b style="left:${pct(lo)};width:calc(${pct(hi)} - ${pct(lo)})"></b><i class="estado-${f.estado}" style="width:${pct(f.reciente)}"></i></span>
      <span class="pequeno suave detalle-franja">${esc(`${ESTADO[f.estado]} · ${cambio(f)} · promedio ${n(f.promedio)}`)}</span></li>`).join('')}</ul>
    <details class="extra"><summary>Semanas anteriores, una por una</summary>
      <div class="tabla-semanas" style="--cols:${r.semanas.length}"><span></span>${r.semanas.map(w => `<span class="cab" title="Semana del ${esc(fechaCorta(w.lunes))}">${Number(w.lunes.slice(8, 10))}/${Number(w.lunes.slice(5, 7))}</span>`).join('')}
      ${filas.map(f => `<span class="nombre-musculo">${esc(nombre(f.musculo))}</span>${r.semanas.map(w => { const v = Math.round((w.porMusculo[f.musculo] || 0) * 10) / 10; return `<span class="num ${v >= lo ? 'estado-bien' : v >= lo / 2 ? 'estado-cerca' : 'estado-bajo'}">${n(v)}</span>`; }).join('')}`).join('')}</div>
      <p class="pequeno suave">Cada columna es una semana, desde el lunes que dice (día/mes). Lo que ayuda cuenta media serie.</p>
    </details>
  </section>`;
}

/**
 * Tu puntería de RIR (nucleo/comprobacion-rir.js): cuántas repeticiones te quedan de más, o de menos, de las que crees,
 * con tus series de comprobación. Una cifra grande con lo que significa y, debajo, cada comprobación.
 */
function punteriaHtml() {
  const lista = comprobaciones(E.sesiones || []);
  const p = punteria(lista, hoy());
  const intro = '<h3>Tu puntería de RIR</h3>';
  if (!lista.length) return `<section class="tarjeta punteria">${intro}<p class="pequeno suave">Se mide con la serie de comprobación: cada 2 semanas, Hoy te pregunta antes de la última serie de un ejercicio seguro cuántas crees que salen, y esa serie va hasta que la técnica ya no sale limpia.</p></section>`;
  const signo = d => `${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(Math.round(d))}`;
  const d = p ? Math.round(p.diferencia) : null;
  const lectura = d == null ? 'Tu última comprobación tiene más de 12 semanas: la próxima la vuelve a medir.'
    : d >= 3 ? `Te quedan unas ${d} más de las que crees. Por eso "Para la próxima" suma ${p.correccion} a la reserva que anotas y sube más rápido.`
      : d >= 1 ? `Buena puntería: te ${d === 1 ? 'queda una' : `quedan unas ${d}`} más de las que crees. Tu reserva anotada es confiable.`
        : d === 0 ? 'Puntería exacta: tu reserva anotada es confiable.'
          : 'Llegas antes de lo que crees: cuando el plan pida 2 de reserva, deja una más.';
  const fila = c => `<li><span>${esc(fechaCorta(c.fecha))} · ${esc(indice.porId.get(c.ejercicio_id)?.nombre || 'Ejercicio')}</span><span>creíste ${c.predichas}, salieron ${c.reales} <strong class="num">(${signo(c.diferencia)})</strong></span></li>`;
  return `<section class="tarjeta punteria">${intro}
    ${d == null ? '' : `<p class="punteria-cifra"><strong class="num">${signo(d)}</strong><span>${d === 0 ? 'de diferencia' : `repeticiones ${d > 0 ? 'más' : 'menos'} de las que crees`}${p.n > 1 ? `, la mediana de tus últimas ${p.n}` : ''}</span></p>`}
    <p class="pequeno">${esc(lectura)}</p>
    <ul class="lista-simple pequeno">${lista.slice(-5).reverse().map(fila).join('')}</ul>
  </section>`;
}

/** Resumen del mes o del año, como Hevy, comparado con el período anterior. */
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function resumenPeriodoHtml() {
  if (!E.sesiones.length) return '';
  const tipo = periodoElegido === 'año' ? 'año' : 'mes';
  const fecha = periodoElegido === 'pasado' ? periodo('mes', hoy()).antes.desde : hoy();
  const r = resumenPeriodo(E.sesiones, { tipo, fecha, indice, asistidos: new Set(indice.ejercicios.filter(esAsistido).map(e => e.id)) });
  const nombreP = d => (tipo === 'año' ? d.slice(0, 4) : `${MESES[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`);
  const a = r.actual, b = r.anterior;
  const n = x => String(Math.round(x * 10) / 10).replace('.', ',');
  const comparado = (x, y, u = '') => (Math.abs(x - y) < 0.05 ? 'igual que antes' : `${x > y ? '+' : '−'}${n(Math.abs(x - y))}${u} que ${tipo === 'año' ? 'el año anterior' : 'el mes anterior'}`);
  const cifra = (valor, texto, x, y, u = '') => `<div class="cifra"><strong class="num">${valor}</strong><span class="pequeno suave">${texto}</span>${x != null ? `<span class="pequeno ${x >= y ? 'sube' : 'baja'}">${esc(comparado(x, y, u))}</span>` : ''}</div>`;
  const horas = m => (m >= 60 ? `${n(m / 60)} h` : `${m} min`);
  return `<section class="tarjeta">
    <h3>Resumen</h3>
    <div class="segmentos periodo" role="group" aria-label="Período">${[['mes', 'Este mes'], ['pasado', 'Mes pasado'], ['año', 'Este año']].map(([v, t]) => `<button type="button" data-periodo-resumen="${v}" aria-pressed="${v === periodoElegido}">${t}</button>`).join('')}</div>
    <p class="pequeno suave">${esc(`${nombreP(r.periodo.desde)}, comparado con ${nombreP(r.periodo.antes.desde)}`)}</p>
    ${a.sesiones ? `<div class="cifras-resumen">
      ${cifra(a.sesiones, a.sesiones === 1 ? 'sesión' : 'sesiones', a.sesiones, b.sesiones)}
      ${cifra(a.dias, 'días entrenados', a.dias, b.dias)}
      ${cifra(a.minutos ? horas(a.minutos) : 'sin dato', 'entrenando', a.minutos ? a.minutos / 60 : null, b.minutos / 60, ' h')}
      ${cifra(a.series, 'series de trabajo', a.series, b.series)}
      ${cifra(esc(volumenTexto(a.volumen)), 'levantados', null, null)}
      ${cifra(a.records, a.records === 1 ? 'récord' : 'récords', a.records, b.records)}
    </div>
    <details class="extra"><summary>Músculos y ejercicios más hechos</summary>
      <ul class="pequeno lista-simple">${r.musculos.filter(m => m.series || m.antes).slice(0, 10).map(m => `<li><span>${esc(mayuscula(NOMBRE_MUSCULO[m.musculo] || m.musculo))}</span><span><strong class="num">${n(m.series)}</strong> series <span class="suave">(${esc(comparado(m.series, m.antes))})</span></span></li>`).join('')}</ul>
      <p class="sobretitulo">Ejercicios más hechos</p>
      <ol class="pequeno">${a.ejercicios.map(e => `<li>${esc(e.nombre)}: ${e.sesiones} ${e.sesiones === 1 ? 'sesión' : 'sesiones'}</li>`).join('')}</ol>
    </details>
    <button type="button" class="boton fila-boton" data-historia="${tipo === 'año' ? `año|${r.periodo.desde.slice(0, 4)}` : `mes|${r.periodo.desde.slice(0, 7)}`}">${icono('reproducir')} Ver como historia</button>` : `<p class="pequeno">Sin sesiones en ${esc(nombreP(r.periodo.desde))} todavía.</p>`}
  </section>`;
}

/** Medidas del cuerpo, como Hevy: peso, grasa y perímetros con su gráfico. Datos de salud: solo con permiso, en el
 *  teléfono, plegado y nunca en lo que se comparte. */
function medidasHtml() {
  const u = unidadPeso();
  const lista = E.medidas || [];
  const campo = c => CAMPOS_MEDIDA.find(x => x[0] === c);
  const unidad = c => (c === 'peso_kg' ? u : campo(c)[2]);
  const valor = (c, v) => (c === 'peso_kg' ? enUnidad(v) : v);
  const n = x => String(Math.round(x * 10) / 10).replace('.', ',');
  let cuerpo;
  if (!E.consentimientos.medidas_cuerpo) {
    cuerpo = `<p class="pequeno suave">Peso, porcentaje de grasa y perímetros (cintura, cadera, brazo, muslo y otros), con su gráfico. Son datos de salud: quedan en este teléfono, en tu respaldo y, si entraste, en tu cuenta (privado); nunca en tablas ni en lo que compartes.</p>
      <label class="pequeno casilla"><input type="checkbox" id="consentir-medidas"> Acepto guardar mis medidas como datos de salud, solo para ver mi progreso.</label>`;
  } else {
    const campos = camposConDatos(lista);
    const c = campos.includes(medidaElegida) ? medidaElegida : campos[0];
    let grafico = '';
    if (c) {
      const puntos = lista.filter(m => m[c] != null).map(m => ({ fecha: m.fecha, valor: valor(c, m[c]), texto: `${n(valor(c, m[c]))} ${unidad(c)}` }));
      // Meta de peso, como OpenGym: una línea en el gráfico y el cambio en verde si te acerca, en rojo si te aleja.
      const meta = c === 'peso_kg' && E.metaPeso ? enUnidad(E.metaPeso) : null;
      const vs = [...puntos.map(p => p.valor), ...(meta != null ? [meta] : [])], lo = Math.min(...vs), hi = Math.max(...vs), margen = Math.max(1, (hi - lo) * 0.2);
      const desde = puntos[0].fecha < sumar(hoy(), -6) ? puntos[0].fecha : sumar(hoy(), -6);
      const cambio = cambioMedida(lista, c, hoy());
      const diferencia = cambio ? valor(c, cambio.hasta) - valor(c, cambio.desde) : 0;
      const rumbo = meta != null && cambio ? direccionMeta(cambio.desde, cambio.hasta, E.metaPeso) : null;
      grafico = `${campos.length > 1 ? `<div class="chips-botones chips-medida" role="group" aria-label="Qué medida">${campos.map(x => `<button type="button" class="chip-opcion" data-medida-cuerpo="${x}" aria-pressed="${x === c}">${esc(campo(x)[1])}</button>`).join('')}</div>` : ''}
        <div class="cifra-grafico"><span>${esc(campo(c)[1])}</span><strong class="num">${esc(`${n(puntos.at(-1).valor)} ${unidad(c)}`)}${cambio ? ` <span class="pequeno ${rumbo ? `rumbo-${rumbo}` : 'suave'}">(${diferencia > 0 ? '+' : diferencia < 0 ? '−' : ''}${n(Math.abs(diferencia))} en el último mes${rumbo === 'hacia' ? ', hacia tu meta' : rumbo === 'lejos' ? ', lejos de tu meta' : ''})</span>` : ''}</strong></div>
        ${lineaHevy({ puntos, desde, hasta: hoy(), min: Math.max(0, lo - margen), max: hi + margen, marcas: [{ valor: lo, texto: n(lo) }, { valor: hi, texto: n(hi) }, ...(meta != null ? [{ valor: meta, texto: `Meta ${n(meta)}` }] : [])], titulo: `${campo(c)[1]}, ${puntos.length} ${puntos.length === 1 ? 'medición' : 'mediciones'}`, unir: 400, izquierda: 44 , cambio: d => `${d > 0 ? '+' : d < 0 ? '−' : ''}${n(Math.abs(d))} ${unidad(c)}`, ritmo: d => `${d > 0 ? '+' : d < 0 ? '−' : ''}${n(Math.abs(d))} ${unidad(c)}`, neutro: true})}
        ${c === 'peso_kg' ? `<form id="form-meta-peso" class="meta-peso"><label class="pequeno">Meta de peso (${u}) <input type="text" inputmode="decimal" id="meta-peso" value="${meta != null ? esc(n(meta)) : ''}" placeholder="Sin meta" autocomplete="off"></label><button type="submit" class="boton chico">Guardar meta</button></form>` : ''}`;
    }
    const imagen = x => { const src = `img/medidas/${x.replace(/_(kg|pct|cm)$/, '')}.webp`; return IMAGENES.has(src) ? `<img class="img-medida" src="${src}" alt="" width="40" height="40" decoding="async">` : ''; };
    cuerpo = `${grafico}
      <details class="extra"${lista.length ? '' : ' open'}><summary>Anotar medidas</summary><form id="form-medidas" class="form-medidas">
        <label class="pequeno">Fecha <input type="date" id="medida-fecha" value="${hoy()}" max="${hoy()}"></label>
        <div class="campos-medida">${CAMPOS_MEDIDA.map(([x, nom]) => `<label class="pequeno">${imagen(x)}<span>${esc(nom)} (${esc(unidad(x))})</span><input type="text" inputmode="decimal" data-medida="${x}" autocomplete="off"></label>`).join('')}</div>
        <button type="submit" class="boton">Guardar medidas</button>
        <p class="pequeno suave">Escribe solo las que mediste. Conviene medir en la mañana, en ayunas y en el mismo lugar del cuerpo cada vez.</p>
      </form></details>
      ${lista.length ? `<details class="extra"><summary>Tus mediciones (${lista.length})</summary><ul class="pequeno lista-simple">${[...lista].reverse().map(m => `<li><span>${esc(fechaCorta(m.fecha))}: ${esc(CAMPOS_MEDIDA.filter(([x]) => m[x] != null).map(([x, nom]) => `${nom.toLowerCase()} ${n(valor(x, m[x]))} ${unidad(x)}`).join(', '))}</span><button type="button" class="enlace" data-borrar-medida="${m.fecha}">Borrar</button></li>`).join('')}</ul></details>` : ''}
      <button type="button" class="enlace pequeno" id="quitar-medidas">Quitar mi permiso y borrar mis medidas</button>`;
  }
  return `<details class="tarjeta medidas-cuerpo" id="medidas-cuerpo"${medidasAbierto ? ' open' : ''}><summary><h3>Medidas del cuerpo</h3><span class="pequeno suave">Opcional</span></summary>${cuerpo}</details>`;
}

/** Constancia, como Hevy y el tablero: racha de semanas, días desde el último entrenamiento, el promedio y un
 *  calendario de las últimas 12 semanas con los días entrenados. */
function constanciaHtml() {
  const fechas = [...E.sesiones.filter(s => (s.series || []).length).map(s => s.fecha),
    ...Object.entries(E.registro).filter(([, porEj]) => Object.values(porEj || {}).some(l => (l || []).some(x => x?.hecho))).map(([f]) => f)];
  if (!fechas.length) return '';
  const c = constanciaEntreno(fechas, hoy(), { semanas: Math.max(12, Math.ceil((Date.parse(hoy()) - Date.parse([...fechas].sort()[0] || hoy())) / 604800000) + 1) });
  const cifra = (valor, texto) => `<div class="cifra"><strong class="num">${valor}</strong><span class="pequeno suave">${texto}</span></div>`;
  const desde = c.diasDesdeUltimo === 0 ? 'Hoy' : c.diasDesdeUltimo === 1 ? 'Ayer' : `${c.diasDesdeUltimo} días`;
  const LETRAS = ['L', 'M', 'Mi', 'J', 'V', 'S', 'D'];
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
  // Columnas: semanas; filas: de lunes a domingo. El mes va sobre la primera semana en que aparece.
  const meses = c.semanas.map((w, i) => { const m = Number(w.lunes.slice(5, 7)) - 1; return i === 0 || m !== Number(c.semanas[i - 1].lunes.slice(5, 7)) - 1 ? MES[m] : ''; });
  const celdas = LETRAS.map((l, d) => `<span class="cal-letra" aria-hidden="true">${l}</span>${c.semanas.map(w => { const x = w.dias[d]; return `<span class="cal-dia${x.entreno ? ' hecho' : ''}${x.futuro ? ' futuro' : ''}${x.fecha === hoy() ? ' hoy' : ''}" title="${esc(fechaCorta(x.fecha))}${x.entreno ? ': entrenaste' : ''}"></span>`; }).join('')}`).join('');
  const entrenados = c.semanas.reduce((a, w) => a + w.total, 0);
  return `<section class="tarjeta">
    <h3 id="p-calendario">Constancia</h3>
    <div class="cifras-resumen">
      ${cifra(c.racha === 1 ? '1 semana' : `${c.racha} semanas`, c.racha === 1 ? 'con entrenamiento' : 'seguidas entrenando')}
      ${cifra(desde, c.diasDesdeUltimo === 0 ? 'entrenaste' : 'desde tu último entrenamiento')}
      ${cifra(c.estaSemana === 1 ? '1 día' : `${c.estaSemana} días`, 'entrenados esta semana')}
      ${cifra(c.promedio == null ? 'sin dato' : String(c.promedio).replace('.', ','), 'días por semana, promedio')}
    </div>
    <div class="calendario-constancia" role="img" aria-label="${esc(`Últimas 12 semanas: ${entrenados} días entrenados`)}">
      <span></span>${meses.map(m => `<span class="cal-mes">${m}</span>`).join('')}
      ${celdas}
      <span></span>${c.semanas.map(w => `<span class="cal-total num">${w.total || ''}</span>`).join('')}
    </div>
    <p class="pequeno suave">Las últimas 12 semanas. Cada cuadro es un día; abajo, los días entrenados de cada semana.${c.rachaIncluyeEsta || !c.racha ? '' : ' La racha sigue si entrenas esta semana.'}</p>
  </section>`;
}

/** Tu ritmo por ejercicio: los que más hiciste en las últimas 8 semanas, con cuánto cambió su máximo estimado.
 *  Cada uno abre su ficha, con sus gráficos y su historial. */
function ejerciciosHtml() {
  const series = seriesAnotadas(E.sesiones, E.registro);
  const desde = sumar(hoy(), -55);
  const veces = new Map();
  for (const x of series) if (x.fecha >= desde && indice.porId.has(x.ejercicio_id)) (veces.get(x.ejercicio_id) || veces.set(x.ejercicio_id, new Set()).get(x.ejercicio_id)).add(x.fecha);
  // Primero los que más hiciste y, entre ellos, los ejercicios principales (compuestos).
  const principal = id => (indice.porId.get(id)?.tipo === 'compuesto' ? 0 : 1);
  const lista = [...veces.entries()].sort((a, b) => b[1].size - a[1].size || principal(a[0]) - principal(b[0]) || nombreEj(a[0]).localeCompare(nombreEj(b[0]), 'es')).map(([id, f]) => ({ id, sesiones: f.size }));
  if (!lista.length) return '';
  const fila = ({ id, sesiones }) => {
    const asistido = esAsistido(indice.porId.get(id));
    const r = ritmoDe(series, id, { asistido });
    return `<li><button type="button" class="fila-ejercicio" data-ficha="${esc(id)}">${miniatura(id)}<span><span class="nombre">${esc(nombreEj(id))}</span><span class="pequeno suave">${esc(textoRitmo(r, { asistido, corto: true }) || `${sesiones} ${sesiones === 1 ? 'sesión' : 'sesiones'}, falta para ver el ritmo`)}</span></span>${icono('flecha', 'icono chevron')}</button></li>`;
  };
  return `<section class="tarjeta">
    <h3 id="p-ejercicios">Tu ritmo por ejercicio</h3>
    <p class="pequeno suave">Cuánto cambió tu máximo estimado en las últimas 8 semanas. Toca uno para ver sus gráficos y su historial.</p>
    <ul class="lista-ejercicios">${(todosEjercicios ? lista : lista.slice(0, 5)).map(fila).join('')}</ul>
    ${lista.length > 5 ? `<button type="button" class="enlace" id="todos-ejercicios">${todosEjercicios ? 'Ver menos' : `Ver los ${lista.length}`}</button>` : ''}
  </section>`;
}

/**
 * Cómo llegas y cómo rindes, las últimas 4 semanas: el rendimiento de cada sesión contra lo habitual
 * (nucleo/rendimiento-sesion.js) y, debajo, energía, ánimo y sueño de "¿Cómo estás hoy?". Un gráfico por medida (nunca
 * dos escalas en uno), todos con las mismas fechas: el mismo día queda en la misma columna. Arriba, lo que dicen juntos:
 * si con poca energía o ánimo bajo se rinde igual o menos (Francisco, 28 de octubre de 2026).
 */
const ANIMO = ['', 'Muy bajo', 'Bajo', 'Normal', 'Bien', 'Muy bien'];
const ENERGIA = ['', 'Agotado', 'Cansado', 'Normal', 'Bien', 'Fresco']; // 6 menos el cansancio: arriba es más energía
function llegasRindesHtml() {
  const hasta = hoy(), desde = sumar(hasta, -27);
  const dias = Object.entries(E.bienestar || {}).filter(([f, b]) => f >= desde && f <= hasta && b && (b.sueno_horas != null || b.animo != null || b.cansancio != null))
    .sort(([a], [b]) => (a < b ? -1 : 1));
  const horas = h => (h >= 9 ? '9 o más horas' : h <= 5 ? '5 o menos horas' : `${h} horas`);
  const sueno = dias.filter(([, b]) => b.sueno_horas != null).map(([fecha, b]) => ({ fecha, valor: b.sueno_horas, texto: horas(b.sueno_horas) }));
  const animo = dias.filter(([, b]) => b.animo != null).map(([fecha, b]) => ({ fecha, valor: b.animo, texto: `ánimo ${ANIMO[b.animo].toLowerCase()}` }));
  const energia = dias.filter(([, b]) => b.cansancio != null).map(([fecha, b]) => ({ fecha, valor: 6 - b.cansancio, texto: `energía: ${ENERGIA[6 - b.cansancio].toLowerCase()}` }));
  const asistidos = new Set(indice.ejercicios.filter(esAsistido).map(e => e.id));
  const rinde = rendimientoSesiones(E.sesiones, { desde, hasta, asistidos });
  const rend = rinde.map(r => ({ fecha: r.fecha, valor: r.pct, texto: `${textoPct(r.pct)} contra lo habitual (${r.ejercicios} ${r.ejercicios === 1 ? 'ejercicio' : 'ejercicios'})` }));
  const cabeza = '<h3>Cómo llegas y cómo rindes</h3><p class="pequeno suave">Tu rendimiento en cada sesión contra lo habitual, y lo que respondes en "¿Cómo estás hoy?", las últimas 4 semanas. Cada día queda en la misma columna: toca una barra o un punto para verlo.</p>';
  if (rend.length + sueno.length + animo.length + energia.length < 2) return `<section class="tarjeta">${cabeza}<p class="pequeno">Todavía hay pocos días. Responde "¿Cómo estás hoy?" en Entrenar (toma 10 segundos) y aquí vas a ver si rindes igual con poca energía.</p></section>`;
  // Lo que dicen juntos: con 3 sesiones o más con poca energía (o ánimo bajo) anotada. Mira 8 semanas: 4 son pocas.
  const lectura = rendimientoSesiones(E.sesiones, { desde: sumar(hasta, -55), hasta, asistidos });
  const dichos = ['energia', 'animo'].map(m => segunComoLlegas(lectura, E.bienestar || {}, m).texto).filter(Boolean);
  // Sin lo dicho todavía: si no hay respuestas, a responder; si hay, cuántas faltan para poder decir algo.
  const pocas = dichos.length || !lectura.length ? ''
    : !energia.length && !animo.length ? '<p class="pequeno">Responde "¿Cómo estás hoy?" en Entrenar (toma 10 segundos) y aquí vas a ver si rindes igual con poca energía.</p>'
      : '<p class="pequeno">Cuando anotes poca energía en 3 sesiones, aquí te digo si rindes igual o menos esos días.</p>';
  const semana = xs => xs.filter(p => p.fecha >= sumar(hasta, -6));
  const prom = xs => (xs.length ? xs.reduce((a, p) => a + p.valor, 0) / xs.length : null);
  const [pR, pE, pA, pS] = [rend, energia, animo, sueno].map(xs => prom(semana(xs)));
  const tope = Math.min(30, Math.max(10, Math.ceil(Math.max(0, ...rend.map(p => Math.abs(p.valor))) / 5) * 5));
  const cifra = (nombre, valor) => `<div class="cifra-grafico"><span>${nombre}</span><strong class="num">${valor}</strong></div>`;
  // Una medida sin nada en las 4 semanas va en una línea, sin un gráfico vacío.
  const tira = (nombre, puntos, valor, grafico, vacio = 'sin respuestas en 4 semanas') => (puntos.length ? `${cifra(nombre, valor)}${grafico()}` : cifra(nombre, vacio));
  return `<section class="tarjeta">${cabeza}
    ${dichos.map(t => `<p class="lectura-rinde">${esc(t)}</p>`).join('')}${pocas}
    ${tira('Rendimiento', rend, pR == null ? 'sin sesiones esta semana' : `${textoPct(pR)} esta semana`, () => barrasDivergentes({ puntos: rend, desde, hasta, limite: tope, marcas: [{ valor: tope, texto: `+${tope}%` }, { valor: 0, texto: 'habitual' }, { valor: -tope, texto: `−${tope}%` }], titulo: `Rendimiento contra lo habitual, ${rend.length} sesiones`, izquierda: 50 }), 'sin sesiones para comparar')}
    ${tira('Energía', energia, pE == null ? 'sin datos esta semana' : `${ENERGIA[Math.round(pE)].toLowerCase()} en promedio esta semana`, () => lineaSimple({ puntos: energia, desde, hasta, min: 1, max: 5, marcas: [{ valor: 1, texto: 'Agotado' }, { valor: 3, texto: 'Normal' }, { valor: 5, texto: 'Fresco' }], titulo: `Energía, ${energia.length} días respondidos`, izquierda: 50 }))}
    ${tira('Ánimo', animo, pA == null ? 'sin datos esta semana' : `${ANIMO[Math.round(pA)].toLowerCase()} en promedio esta semana`, () => lineaSimple({ puntos: animo, desde, hasta, min: 1, max: 5, marcas: [{ valor: 1, texto: 'Muy bajo' }, { valor: 3, texto: 'Normal' }, { valor: 5, texto: 'Muy bien' }], titulo: `Ánimo, ${animo.length} días respondidos`, izquierda: 50 }))}
    ${tira('Sueño', sueno, pS == null ? 'sin datos esta semana' : `${pS.toFixed(1).replace('.', ',')} h promedio esta semana`, () => lineaSimple({ puntos: sueno, desde, hasta, min: 4, max: 10, marcas: [{ valor: 6, texto: '6 h' }, { valor: 8, texto: '8 h' }], titulo: `Horas de sueño, ${sueno.length} días respondidos`, izquierda: 50 }))}
    <details class="extra"><summary>Ver como tabla</summary><ul class="pequeno lista-simple">${[...new Set([...dias.map(([f]) => f), ...rinde.map(r => r.fecha)])].sort().reverse().map(f => {
      const b = E.bienestar?.[f] || {}, r = rinde.find(x => x.fecha === f);
      return `<li><span>${esc(fechaCorta(f))}</span><span>${[r && `rendimiento ${textoPct(r.pct)}`, b.cansancio != null && `energía ${ENERGIA[6 - b.cansancio].toLowerCase()}`, b.animo != null && `ánimo ${ANIMO[b.animo].toLowerCase()}`, b.sueno_horas != null && horas(b.sueno_horas)].filter(Boolean).join(' · ')}</span></li>`;
    }).join('')}</ul></details>
  </section>`;
}

const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
/** Lo que se busca en una sesión: ejercicios, título, fecha (como se ve, en número y el mes completo) y comentario. */
const textoBusqueda = s => normalizar([s.titulo, s.comentario, s.fecha, fechaCorta(s.fecha), MESES_LARGOS[Number(s.fecha.slice(5, 7)) - 1], ...s.series.map(x => x.nombre)].join(' '));
const distancia = m => (m >= 1000 ? `${String(Math.round(m / 100) / 10).replace('.', ',')} km` : `${Math.round(m)} m`);
const reloj = seg => (seg < 60 ? `${Math.round(seg)} s` : `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}`);

function historialHtml() {
  const h = historial();
  const anotar = `<div class="fila-botones"><button type="button" class="boton" id="anotar-pasado">${E.borradorPasado && !E.borradorPasado.id ? `Seguir anotando el ${esc(fechaCorta(E.borradorPasado.fecha))}` : 'Anotar un día pasado'}</button></div>`;
  if (!h.length) return historialVacio() + anotar;
  return `${anotar}
    <label class="buscador-historial"><span class="sr-only">Buscar en el historial</span><input type="search" id="buscar-historial" placeholder="Buscar ejercicio, sesión o fecha" value="${esc(buscar)}" autocomplete="off"></label>
    <div id="lista-historial">${listaHistorialHtml(h)}</div>`;
}

function listaHistorialHtml(h = historial()) {
  const records = recordsPorSesion(E.sesiones, { asistidos: new Set(indice.ejercicios.filter(esAsistido).map(e => e.id)) });
  const palabras = normalizar(buscar).split(' ').filter(Boolean);
  const encontradas = palabras.length ? h.filter(s => { const t = textoBusqueda(s); return palabras.every(p => t.includes(p)); }) : h;
  const lunes = sumarDias(hoy(), -((diaSemana(hoy()) + 6) % 7));
  const semana = h.filter(s => s.fecha >= lunes);
  const resumen = semana.length ? `Esta semana: ${semana.length} ${semana.length === 1 ? 'sesión' : 'sesiones'} · ${series(semana.reduce((a, s) => a + s.series.filter(deTrabajo).length, 0))} de trabajo · volumen ${volumenTexto(semana.reduce((a, s) => a + volumen(s.series), 0))}.` : 'Esta semana todavía no entrenas.';
  // Cardio importado de Hevy: distancia y tiempo en vez de peso y repeticiones.
  const textoSeries = xs => (xs.length && xs.every(x => textoCardio(x)) ? xs.map(textoCardio).join(', ')
    : xs.some(x => x.distancia_m || (x.duracion_seg && !x.carga_kg))
    ? xs.map(x => `${x.carga_kg ? `${peso(x.carga_kg)} × ` : ''}${[x.distancia_m && distancia(x.distancia_m), x.duracion_seg && reloj(x.duracion_seg)].filter(Boolean).join(' en ')}`).filter(Boolean).join(', ')
    : seriesTexto(xs));
  // Cada sesión como una publicación de Hevy (sin me gusta ni comentarios): título, cuándo, tiempo, volumen y
  // récords, y los ejercicios con su miniatura. Tocarla abre el resumen; las series quedan en "Ver las series".
  const item = s => {
    const porEj = [];
    for (const x of s.series) {
      let g = porEj.find(y => y.nombre === x.nombre);
      if (!g) porEj.push(g = { nombre: x.nombre, id: x.ejercicio_id, trabajo: [], calentamiento: 0 });
      if (x.tipo === 'calentamiento') g.calentamiento++; else g.trabajo.push(x);
    }
    const recs = (s.id && records.get(s.id)) || [];
    const abre = s.id && !s.sinTerminar;
    const chips = `${s.origen === 'hevy' ? ' <span class="chip">Hevy</span>' : s.origen === 'ejemplo' ? ' <span class="chip">Ejemplo</span>' : ''}${s.sinTerminar && s.fecha === hoy() ? ' <span class="chip">en curso</span>' : ''}`;
    return `<li class="publicacion">
      <${abre ? `button type="button" data-resumen="${esc(s.id)}"` : 'div'} class="publicacion-cab">
        <span class="publicacion-titulo">${esc(s.titulo || 'Sesión')}${chips}</span>
        <span class="pequeno suave">${esc(fechaCorta(s.fecha))}${s.hora ? ` · ${esc(s.hora)}` : ''}</span>
      </${abre ? 'button' : 'div'}>
      ${s.comentario ? `<p class="pequeno comentario-h">"${esc(s.comentario)}"</p>` : ''}
      <div class="publicacion-cifras">
        <span><small>Tiempo</small><strong class="num">${s.duracion_min ? `${s.duracion_min} min` : 'sin dato'}</strong></span>
        <span><small>Volumen</small><strong class="num">${esc(volumenTexto(volumen(s.series)))}</strong></span>
        <span><small>Récords</small><strong class="num">${recs.length ? `${icono('trofeo', 'icono trofeo-pub')}${recs.length}` : '0'}</strong></span>
      </div>
      <ul class="publicacion-ejercicios">${porEj.slice(0, 3).map(g => `<li>${g.id && indice.porId.get(g.id) ? miniatura(g.id).replace('<img ', '<img loading="lazy" ') : '<span class="miniatura vacia"></span>'}<span>${esc(series(g.trabajo.length))} · ${esc(g.nombre)}</span></li>`).join('')}</ul>
      ${porEj.length > 3 ? `<p class="pequeno suave publicacion-mas">y ${porEj.length - 3} ejercicio${porEj.length - 3 === 1 ? '' : 's'} más</p>` : ''}
      <details class="publicacion-series"><summary class="pequeno">Ver las series</summary>
        <ul class="pequeno detalle-h">${porEj.map(g => `<li><strong>${esc(g.nombre)}</strong>: ${esc(textoSeries(g.trabajo) || 'sin series de trabajo')}${g.calentamiento ? ` <span class="suave">(+${g.calentamiento} de calentamiento)</span>` : ''}</li>`).join('')}</ul>
        ${s.id && !s.origen && !s.sinTerminar && s.fecha < hoy() ? `<button type="button" class="enlace pequeno" data-corregir="${esc(s.id)}">Corregir esta sesión</button>` : ''}
      </details>
    </li>`;
  };
  if (palabras.length && !encontradas.length) return `<p class="pequeno suave">No encontré sesiones con "${esc(buscar)}". Prueba con un ejercicio, el nombre de la sesión o una fecha, como "sept" o "15 sept".</p>`;
  const lista = encontradas;
  return `<p class="pequeno">${esc(palabras.length ? `${lista.length} ${lista.length === 1 ? 'sesión encontrada' : 'sesiones encontradas'}.` : resumen)}</p>
    <ul class="historial publicaciones">${(verTodo ? lista : lista.slice(0, palabras.length ? 20 : 6)).map(item).join('')}</ul>
    ${lista.length > (palabras.length ? 20 : 6) ? `<button type="button" class="enlace" id="ver-todo">${verTodo ? 'Ver menos' : `Ver las ${lista.length} sesiones`}</button>` : ''}`;
}

export async function vistaProgreso(ir) {
  const sec = seccionProgreso();
  $('app').innerHTML = `<div id="vista-progreso"${sec ? ` data-en-seccion="${sec}"` : ''}>
    ${sec ? `<button type="button" class="volver" id="p-volver" data-vuelve-a="progreso">${icono('flecha', 'icono flecha-atras')} Progreso</button>`
      : `<button type="button" class="volver" id="p-a-miplan" data-vuelve-a="miplan">${icono('flecha', 'icono flecha-atras')} Mi plan</button>`}
    <h1>${sec ? TITULO_SECCION[sec] : 'Progreso'}</h1>
    ${bienvenidaProgreso()}
    ${calendarioHtml()}
    ${graficoSemanasHtml()}
    ${tableroProgresoHtml()}
    <section class="tarjeta tarjeta-entrenamientos">
      <h3>Entrenamientos</h3>
      ${historialHtml()}
    </section>
    <div data-seccion-p="estadisticas">
    ${musculosMapaHtml()}
    ${semanaHtml()}
    ${franjaHtml()}
    ${esfuerzoHtml(R().escala_esfuerzo === 'rir' ? 'rir' : 'rpe')}
    ${punteriaHtml()}
    ${resumenPeriodoHtml()}
    ${llegasRindesHtml()}
    </div>
    <div data-seccion-p="calendario">
    ${constanciaHtml()}
    ${anioHtml()}
    </div>
    <div data-seccion-p="ejercicios">
    ${ejerciciosHtml()}
    </div>
    <div data-seccion-p="medidas">
    ${medidasHtml()}

    <section class="tarjeta">
      <h3>Fotos de progreso</h3>
      <p class="pequeno suave">${nube.conectado() ? 'Se guardan en tu cuenta, en un espacio privado: solo tú las ves.' : 'Sin cuenta, quedan solo en este teléfono.'} Nunca se comparten ni aparecen en tablas de amigos.</p>
      ${E.consentimientos.fotos_progreso ? `
        <div class="dos-col"><label class="pequeno">Fecha <input type="date" id="foto-fecha" value="${hoy()}"></label>
        <label class="pequeno">Ángulo <select id="foto-angulo"><option value="frente">Frente</option><option value="perfil">Perfil</option><option value="espalda">Espalda</option><option value="otro">Otro</option></select></label></div>
        <input type="file" id="foto" accept="image/*" capture="environment">
        <div id="fotos" class="galeria"><p class="suave pequeno">Cargando…</p></div>`
      : `<label class="pequeno casilla"><input type="checkbox" id="consentir-fotos"> Acepto guardar fotos de mi cuerpo como datos personales sensibles, solo para ver mi progreso.</label>`}
    </section>
    </div>

  </div>`;
  enlazarCalendario(() => vistaProgreso(ir));
  $('p-a-miplan')?.addEventListener('click', () => ir('miplan'));
  enlazarHistorial(ir);
  enlazarProgresoHevy(() => { const y = scrollY; vistaProgreso(ir); scrollTo(0, y); }, () => { vistaProgreso(ir); scrollTo(0, 0); });
  enlazarAnio();
  $('p-volver')?.addEventListener('click', () => { elegirSeccionProgreso(null); vistaProgreso(ir); scrollTo(0, 0); });
  enlazarMusculosMapa(() => { const y = scrollY; vistaProgreso(ir); scrollTo(0, y); });
  enlazarEsfuerzo(() => { const y = scrollY; vistaProgreso(ir); scrollTo(0, y); });
  $('anotar-pasado')?.addEventListener('click', () => ir('pasado'));
  // El buscador repinta solo la lista, para no perder el teclado.
  $('buscar-historial')?.addEventListener('input', ev => { buscar = ev.target.value; verTodo = false; $('lista-historial').innerHTML = listaHistorialHtml(); enlazarHistorial(ir); });
  document.querySelectorAll('[data-ficha]').forEach(b => b.onclick = () => { ir('ejercicio', { id: b.dataset.ficha, desde: 'progreso' }); scrollTo(0, 0); });
  document.querySelectorAll('[data-periodo-resumen]').forEach(b => b.onclick = () => { periodoElegido = b.dataset.periodoResumen; const y = scrollY; vistaProgreso(ir); scrollTo(0, y); });
  document.querySelectorAll('#vista-progreso [data-historia]').forEach(b => b.onclick = () => abrirPorId(b.dataset.historia, { volver: b }));
  $('todos-ejercicios')?.addEventListener('click', () => { todosEjercicios = !todosEjercicios; const y = scrollY; vistaProgreso(ir); scrollTo(0, y); });
  // Medidas del cuerpo
  const repintarMedidas = () => { const y = scrollY; vistaProgreso(ir); scrollTo(0, y); };
  $('medidas-cuerpo')?.addEventListener('toggle', ev => { medidasAbierto = ev.target.open; });
  $('consentir-medidas')?.addEventListener('change', ev => {
    if (!ev.target.checked) return;
    E.consentimientos.medidas_cuerpo = true; guardar(); medidasAbierto = true;
    if (nube.conectado()) {
      nube.consentir('medidas_cuerpo').catch(() => {});
      // En otro teléfono: con el permiso, se bajan las medidas que ya estaban en la cuenta.
      sincronizarDatosTelefono().then(repintarMedidas).catch(() => {});
    }
    repintarMedidas();
  });
  document.querySelectorAll('[data-medida-cuerpo]').forEach(b => b.onclick = () => { medidaElegida = b.dataset.medidaCuerpo; repintarMedidas(); });
  $('form-medidas')?.addEventListener('submit', ev => {
    ev.preventDefault();
    const datos = { fecha: $('medida-fecha').value };
    document.querySelectorAll('[data-medida]').forEach(i => { const v = numero(i.value); datos[i.dataset.medida] = v == null ? null : i.dataset.medida === 'peso_kg' ? aKilos(v) : v; });
    const r = nuevaMedida(datos, hoy());
    if (r.error) return avisar(r.error);
    E.medidas = agregarMedida(E.medidas || [], r.medida);
    datoCambiado('medidas_cuerpo'); repintarMedidas(); avisar('Medidas guardadas.');
  });
  $('form-meta-peso')?.addEventListener('submit', ev => {
    ev.preventDefault();
    const v = numero($('meta-peso').value);
    if (v == null) delete E.metaPeso;
    else { const kg = aKilos(v); if (kg < 30 || kg > 300) { avisar('Escribe una meta entre 30 y 300 kg.'); return; } E.metaPeso = Math.round(kg * 10) / 10; }
    datoCambiado('meta_peso'); repintarMedidas(); avisar(E.metaPeso ? 'Meta guardada.' : 'Meta quitada.');
  });
  document.querySelectorAll('[data-borrar-medida]').forEach(b => b.onclick = () => { E.medidas = (E.medidas || []).filter(m => m.fecha !== b.dataset.borrarMedida); datoCambiado('medidas_cuerpo'); repintarMedidas(); });
  $('quitar-medidas')?.addEventListener('click', ev => {
    const b = ev.currentTarget;
    if (!b.dataset.confirmar) { b.dataset.confirmar = '1'; b.textContent = 'Toca de nuevo: se borran todas tus medidas'; return; }
    delete E.medidas; E.consentimientos.medidas_cuerpo = false; delete E.nubeDatos?.medidas_cuerpo; guardar();
    if (nube.conectado()) { nube.borrarDatoTelefono('medidas_cuerpo').catch(() => {}); nube.consentir('medidas_cuerpo', false).catch(() => {}); }
    repintarMedidas(); avisar('Quité el permiso y borré tus medidas.');
  });
  $('consentir-fotos')?.addEventListener('change', ev => {
    if (!ev.target.checked) return;
    E.consentimientos.fotos_progreso = true; guardar();
    if (nube.conectado()) nube.consentir('fotos_progreso').catch(() => {});
    vistaProgreso(ir);
  });
  if (E.consentimientos.fotos_progreso) {
    pintarFotos();
    $('foto').onchange = async ev => {
      const archivo = ev.target.files[0];
      if (!archivo) return;
      const datos = { fecha: $('foto-fecha').value || hoy(), angulo: $('foto-angulo').value, archivo };
      try { nube.conectado() ? await nube.subirFoto(datos) : await guardarFotoLocal(datos); E.mensaje = 'Foto guardada.'; }
      catch (e) { E.mensaje = `No se pudo guardar la foto: ${e.message}`; }
      guardar(); vistaProgreso(ir);
    };
  }
  mostrarMensaje();
}

function enlazarHistorial(ir) {
  document.querySelectorAll('[data-resumen]').forEach(b => b.onclick = () => ir('resumen', { id: b.dataset.resumen, desde: 'progreso' }));
  document.querySelectorAll('[data-corregir]').forEach(b => b.onclick = () => ir('pasado', { id: b.dataset.corregir }));
  $('ver-todo')?.addEventListener('click', () => { verTodo = !verTodo; const y = scrollY; $('lista-historial').innerHTML = listaHistorialHtml(); enlazarHistorial(ir); scrollTo(0, y); });
}

/** Comparar dos fotos lado a lado (como Hevy): parte con la primera y la última del ángulo con más fotos. */
let compararAbierto = false;
function compararFotos(caja, fotos) {
  document.getElementById('comparar-fotos')?.remove();
  if (fotos.length < 2) return;
  const orden = [...fotos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const angulos = orden.reduce((m, f) => m.set(f.angulo || '', (m.get(f.angulo || '') || 0) + 1), new Map());
  const angulo = [...angulos.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const delAngulo = orden.filter(f => (f.angulo || '') === angulo);
  let [a, b] = delAngulo.length >= 2 ? [delAngulo[0], delAngulo.at(-1)] : [orden[0], orden.at(-1)];
  const caja2 = document.createElement('details');
  caja2.id = 'comparar-fotos'; caja2.className = 'extra comparar-fotos'; caja2.open = compararAbierto;
  const opciones = sel => orden.map(f => `<option value="${esc(String(f.id))}"${f === sel ? ' selected' : ''}>${esc(fechaCorta(f.fecha).replace(/^\S+ /, ''))}${f.angulo ? `, ${esc(f.angulo)}` : ''}</option>`).join('');
  const pintar = () => {
    const dias = Math.round((Date.parse(b.fecha) - Date.parse(a.fecha)) / 864e5);
    caja2.innerHTML = `<summary>Comparar dos fotos</summary>
      <div class="dos-col"><label class="pequeno">Antes <select id="foto-antes">${opciones(a)}</select></label><label class="pequeno">Después <select id="foto-despues">${opciones(b)}</select></label></div>
      <div class="par-fotos"><figure><img src="${esc(a.url)}" alt="Antes: ${esc(fechaCorta(a.fecha))}"><figcaption>${esc(fechaCorta(a.fecha))}</figcaption></figure><figure><img src="${esc(b.url)}" alt="Después: ${esc(fechaCorta(b.fecha))}"><figcaption>${esc(fechaCorta(b.fecha))}</figcaption></figure></div>
      <p class="pequeno suave">${dias === 0 ? 'Son del mismo día.' : `${Math.abs(dias)} ${Math.abs(dias) === 1 ? 'día' : 'días'} entre ellas.`}${a.angulo && b.angulo && a.angulo !== b.angulo ? ' Son de ángulos distintos: compara mejor con el mismo.' : ''}</p>`;
    caja2.querySelector('#foto-antes').onchange = ev => { a = orden.find(f => String(f.id) === ev.target.value); pintar(); };
    caja2.querySelector('#foto-despues').onchange = ev => { b = orden.find(f => String(f.id) === ev.target.value); pintar(); };
  };
  pintar();
  caja2.addEventListener('toggle', () => { compararAbierto = caja2.open; });
  caja.before(caja2);
}

async function pintarFotos() {
  const caja = $('fotos');
  try {
    const fotos = nube.conectado() ? await nube.listarFotos() : await listarFotosLocales();
    if (!fotos.length) { caja.innerHTML = '<p class="suave pequeno">Todavía no hay fotos. Una por mes, con la misma luz y el mismo ángulo, sirve para comparar.</p>'; return; }
    caja.innerHTML = fotos.map(f => `<figure><img src="${esc(f.url)}" alt="Foto de progreso, ${esc(f.angulo || '')}, ${esc(fechaCorta(f.fecha))}" loading="lazy"><figcaption>${esc(fechaCorta(f.fecha))} · ${esc(f.angulo || '')} <button type="button" class="enlace" data-borrar-foto="${esc(f.id)}">Borrar</button></figcaption></figure>`).join('');
    compararFotos(caja, fotos);
    caja.querySelectorAll('[data-borrar-foto]').forEach(b => b.onclick = async () => {
      const f = fotos.find(x => String(x.id) === b.dataset.borrarFoto);
      nube.conectado() ? await nube.borrarFoto(f) : await borrarFotoLocal(f.id);
      pintarFotos();
    });
  } catch (e) { caja.innerHTML = `<p class="pequeno">No se pudieron cargar las fotos: ${esc(e.message)}</p>`; }
}
