// Ficha de un ejercicio, como en Hevy: el dibujo de cómo se hace (o su máquina), los músculos que trabaja (con su
// imagen), cómo se hace y los errores comunes, tus marcas, por qué está en tu plan (con los papers que lo respaldan)
// tu progreso (gráficos, ritmo e historial, en app/progreso-ejercicio.js) y con qué se puede cambiar. Se abre desde la
// ⓘ de cada ejercicio y desde Progreso.
import { datoCambiado } from './datos-nube.js';
import { E, R, D, C, TECNICA, EVIDENCIA, indice, hoy, esc, $, fechaCorta, coma, enUnidad, unidadPeso, peso, guardar, avisar, volumenTexto } from './comun.js';
import { explicarEjercicio, enlaceVideo } from '../nucleo/explicar.js';
import { alternativas } from '../nucleo/checkin.js';
import { articulacionesBloqueadas, esAsistido } from '../nucleo/catalogo.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { tecnicaDe, marcas } from '../nucleo/ficha.js';
import { NOMBRE_MUSCULO, lista, mayuscula, imagenesMusculos } from './musculos.js';
import { dibujoEjercicio, maquinaDe, miniatura } from './imagenes.js';
import { icono } from './iconos.js';
import { abrirHoja } from './hoja.js';
import { proponer } from './cambios-ui.js';
import { sufijo } from '../nucleo/unidades.js';
import { progresoEjercicioHtml, enlazarProgresoEjercicio } from './progreso-ejercicio.js';
import { montarAnimacion } from './animacion-ui.js';
import { animacionDe } from '../nucleo/animaciones.js';
import { botonFuturo, avisoFuturo, enlazarFuturos } from './funciones-futuras.js';
import { cuerpoHtml } from './cuerpo.js';

const VOLVER = { hoy: 'Hoy', semana: 'Semana', plan: 'Tu plan', progreso: 'Progreso', banco: 'Banco de ejercicios', ejercicio: 'Atrás' };
const EQUIPO = Object.fromEntries(C.secciones.flatMap(s => s.preguntas || []).find(p => p.equipamiento)?.equipamiento || []);
const NIVEL = { principiante: 'Para todos los niveles', intermedio: 'Desde nivel intermedio', avanzado: 'Para nivel avanzado' };
const musculos = xs => lista(xs.map(m => NOMBRE_MUSCULO[m] || m));

const PESTANAS = [['resumen', 'Resumen'], ['historial', 'Historial'], ['como', 'Cómo se hace']];
let pestanaFicha = 'resumen', fichaAnterior = null; // la pestaña elegida sigue al volver a la misma ficha

/** Las series de trabajo de un ejercicio, agrupadas por día, de la más nueva a la más antigua. */
function porDia(id) {
  const dias = new Map();
  for (const x of seriesAnotadas(E.sesiones, E.registro).filter(y => y.ejercicio_id === id)) (dias.get(x.fecha) || dias.set(x.fecha, []).get(x.fecha)).push(x);
  return [...dias].sort((a, b) => b[0].localeCompare(a[0]));
}
const volumenDe = xs => xs.reduce((a, x) => a + (Number(x.carga_kg) || 0) * (Number(x.reps) || 0), 0);

/** Récords personales, como Hevy: mayor peso, mejor máximo estimado, mejor serie y mayor volumen en una sesión. */
function recordsHtml(id, seg) {
  const dias = porDia(id), todas = dias.flatMap(([, xs]) => xs);
  if (!todas.length) return '';
  const u = unidadPeso(), kg = x => `${coma(Math.round(enUnidad(x) * 10) / 10)} ${u}`;
  const conPeso = todas.filter(x => Number(x.carga_kg) > 0 && x.reps != null);
  const filas = [];
  if (conPeso.length) {
    const pesada = conPeso.reduce((a, x) => (x.carga_kg > a.carga_kg ? x : a));
    const e1 = conPeso.map(x => ({ x, v: x.carga_kg * (1 + x.reps / 30) })).reduce((a, b) => (b.v > a.v ? b : a));
    const serie = conPeso.reduce((a, x) => (x.carga_kg * x.reps > a.carga_kg * a.reps ? x : a));
    const sesion = dias.map(([f, xs]) => ({ f, v: volumenDe(xs) })).reduce((a, b) => (b.v > a.v ? b : a));
    filas.push(['Mayor peso', kg(pesada.carga_kg)], ['Mejor máximo estimado', kg(e1.v)], ['Mejor serie', `${kg(serie.carga_kg)} × ${serie.reps}`], ['Mayor volumen en una sesión', volumenTexto(sesion.v)]);
  } else {
    const campo = seg ? 'duracion_seg' : 'reps';
    const valor = x => Number(x[campo] ?? x.reps) || 0;
    const mejor = Math.max(...todas.map(valor));
    const sesion = Math.max(...dias.map(([, xs]) => xs.reduce((a, x) => a + valor(x), 0)));
    filas.push(['Mejor serie', seg ? `${mejor} s` : `${mejor} reps`], [seg ? 'Más tiempo en una sesión' : 'Más reps en una sesión', seg ? `${sesion} s` : `${sesion} reps`]);
  }
  return `<section class="tarjeta records-ficha"><h2>${icono('trofeo', 'icono icono-records')} Récords personales</h2>
    <ul class="lista-records">${filas.map(([t, v]) => `<li><span>${t}</span><strong class="num">${esc(v)}</strong></li>`).join('')}</ul></section>`;
}

/** Calculadora de máximo (1RM), como OpenGym: con un peso y unas repeticiones estima lo que levantarías una vez
 *  (Epley, la misma fórmula del plan) y cuánto mover para cada número de repeticiones. No estima sobre 12. */
function calculadoraHtml(id) {
  const conPeso = porDia(id).flatMap(([, xs]) => xs).filter(x => Number(x.carga_kg) > 0 && x.reps > 0 && x.reps <= 12);
  const base = conPeso.length ? conPeso.reduce((a, x) => (x.carga_kg * (1 + x.reps / 30) > a.carga_kg * (1 + a.reps / 30) ? x : a)) : null;
  return `<details class="tarjeta calc-1rm" id="calc-1rm"><summary><h2>Calculadora de máximo</h2></summary>
    <p class="pequeno suave">Escribe un peso y las repeticiones que haces con él${base ? ' (parte con tu mejor serie)' : ''}. Estima tu máximo para una repetición y cuánto mover en cada rango. Sobre 12 repeticiones no estima: el error crece demasiado.</p>
    <div class="calc-campos"><label class="pequeno">Peso (${unidadPeso()}) <input type="text" inputmode="decimal" id="calc-peso" value="${base ? coma(Math.round(enUnidad(base.carga_kg) * 10) / 10) : ''}" autocomplete="off"></label>
      <label class="pequeno">Repeticiones <input type="text" inputmode="numeric" id="calc-reps" value="${base ? base.reps : ''}" autocomplete="off"></label></div>
    <div id="calc-resultado" aria-live="polite"></div>
  </details>`;
}
function pintarCalculadora() {
  const out = $('calc-resultado');
  if (!out) return;
  const peso = Number(String($('calc-peso').value).replace(',', '.')), reps = Math.round(Number($('calc-reps').value));
  if (!(peso > 0) || !(reps > 0)) { out.innerHTML = ''; return; }
  if (reps > 12) { out.innerHTML = '<p class="pequeno aviso ojo">Con más de 12 repeticiones la estimación no sirve. Prueba con una serie de 12 o menos.</p>'; return; }
  const max = reps === 1 ? peso : peso * (1 + reps / 30), u = unidadPeso(); // con 1 repetición, el peso es el máximo
  const fmt = x => `${coma(Math.round(x * 2) / 2)} ${u}`; // de medio en medio, como los discos
  out.innerHTML = `<p class="calc-max"><strong class="num">${fmt(max)}</strong> <span class="suave">tu máximo estimado</span></p>
    <ul class="lista-records calc-tabla">${[1, 2, 3, 5, 6, 8, 10, 12].map(r => `<li><span>${r} ${r === 1 ? 'repetición' : 'repeticiones'}</span><strong class="num">${fmt(r === 1 ? max : max / (1 + r / 30))}</strong></li>`).join('')}</ul>`;
}

/** Historial del ejercicio, como la pestaña History de Hevy: cada sesión con sus series, el peso, las repeticiones y el
 *  esfuerzo. Tocar la sesión abre su resumen. */
function historialFichaHtml(id, seg) {
  const dias = porDia(id);
  if (!dias.length) return '<p class="suave pequeno ficha-vacia">Todavía no lo anotas. Cuando lo hagas, aquí vas a ver cada sesión con sus series.</p>';
  const u = unidadPeso();
  const texto = x => (x.distancia_m != null ? `${x.carga_kg ? `${coma(enUnidad(x.carga_kg))} ${u} × ` : ''}${x.distancia_m} m`
    : seg || (x.duracion_seg != null && !x.carga_kg) ? `${x.duracion_seg ?? x.reps} s`
    : `${x.carga_kg ? `${coma(enUnidad(x.carga_kg))} ${u} × ` : ''}${x.reps ?? ''}`);
  const esf = x => (x.rpe != null ? ` @ ${coma(x.rpe)} rpe` : x.rir != null ? ` @ RIR ${coma(x.rir)}` : '');
  return `<ul class="historial-ficha">${dias.slice(0, 30).map(([f, xs]) => {
    const s = E.sesiones.find(y => y.fecha === f && (y.series || []).some(z => z.ejercicio_id === id));
    const cab = `<span class="historial-ficha-titulo">${esc(s?.titulo || 'Sesión')}</span><span class="pequeno suave">${esc(fechaCorta(f))}${s?.hora ? `, ${esc(s.hora)}` : ''}</span>`;
    return `<li>
      ${s?.id ? `<button type="button" class="historial-ficha-cab" data-resumen-ficha="${esc(s.id)}">${cab}${icono('flecha', 'icono chevron')}</button>` : `<div class="historial-ficha-cab">${cab}</div>`}
      <div class="historial-ficha-tabla"><span class="cab">Serie</span><span class="cab">Peso y repeticiones</span>
        ${xs.map((x, i) => `<span class="num">${i + 1}</span><span class="num">${esc(texto(x))}<span class="suave">${esc(esf(x))}</span></span>`).join('')}</div>
    </li>`;
  }).join('')}</ul>${dias.length > 30 ? `<p class="pequeno suave">Y ${dias.length - 30} sesiones más antiguas.</p>` : ''}`;
}


function fuentesDeVariante(fuentes = []) {
  return fuentes.filter(f => {
    try { return new URL(f.url).protocol === 'https:'; } catch { return false; }
  }).map(f => `<li><a href="${esc(f.url)}" target="_blank" rel="noopener noreferrer">${esc(f.titulo)}</a>${f.alcance ? `<p class="pequeno suave">${esc(f.alcance)}</p>` : ''}</li>`).join('');
}

function criteriosDeVariante(t) {
  if (!t.cuando_elegir && !t.ajustes?.length && !t.registro) return '';
  const fuentes = fuentesDeVariante(t.fuentes);
  return `<section class="tarjeta">
    <h2>Cuándo elegir esta variante</h2>
    ${t.cuando_elegir ? `<p class="pequeno">${esc(t.cuando_elegir)}</p>` : ''}
    ${t.ajustes?.length ? `<h3>Antes de empezar</h3><ul class="ojo">${t.ajustes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    ${t.registro ? `<p class="pequeno">${esc(t.registro)}</p>` : ''}
    <button type="button" class="boton" id="anotar-ajustes">Anotar ajustes</button>
    ${t.limites ? `<p class="pequeno suave">${esc(t.limites)}</p>` : ''}
    ${fuentes ? `<details class="extra"><summary>Fuentes de esta comparación</summary><ul class="refs">${fuentes}</ul></details>` : ''}
  </section>`;
}

/** El ejercicio en tu plan: el de hoy o, si no, la próxima vez que toca (o la última). */
function enElPlan(id) {
  const plan = E.plan;
  if (!plan) return null;
  const f = hoy();
  const dias = plan.dias.filter(d => d.ejercicios.some(e => e.ejercicio_id === id));
  const dia = dias.find(d => d.fecha === f) || dias.find(d => d.fecha > f) || dias.at(-1);
  return dia ? { dia, e: dia.ejercicios.find(x => x.ejercicio_id === id), esHoy: dia.fecha === f } : null;
}

export function vistaFicha(ir, { id, desde = 'hoy', antes = null } = {}) {
  const ej = indice.porId.get(id);
  if (!ej) return ir(desde);
  const f = hoy();
  const t = tecnicaDe(ej, TECNICA);
  const m = marcas(seriesAnotadas(E.sesiones, E.registro), id, { asistido: esAsistido(ej) });
  const p = enElPlan(id);
  const ex = p ? explicarEjercicio({ e: p.e, dia: p.dia, plan: E.plan, respuestas: R(), derivados: D(), indice, evidencia: EVIDENCIA }) : null;
  const lugar = (R().lugares || []).find(l => l.principal) || (R().lugares || [])[0] || { equipamiento: [] };
  const alts = alternativas(id, { indice, equipamiento: lugar.equipamiento || [], bloqueadas: articulacionesBloqueadas(R().lesiones || [], f), nivel: D().nivel });
  const dibujo = dibujoEjercicio(id), anim = animacionDe(id);
  const maq = maquinaDe(ej);
  const u = unidadPeso();
  const kg = x => `${coma(enUnidad(x))} ${u}`;
  const seg = p?.e?.unidad === 'seg' || ej.unidad === 'seg';
  if (fichaAnterior !== id) { pestanaFicha = 'resumen'; fichaAnterior = id; }

  $('app').innerHTML = `<div id="vista-ficha">
    <button type="button" class="volver" id="volver"${antes ? '' : ` data-vuelve-a="${esc(desde)}"`}>${icono('flecha', 'icono flecha-atras')} ${esc(VOLVER[desde] || 'Atrás')}</button>
    <div class="ficha-pestanas" role="tablist" aria-label="Secciones de la ficha">${PESTANAS.map(([v, t]) => `<button type="button" role="tab" id="pestana-${v}" data-pestana-ficha="${v}" aria-selected="${v === pestanaFicha}" aria-controls="panel-${v}">${t}</button>`).join('')}</div>
    <div class="panel-ficha" id="panel-resumen" role="tabpanel" aria-labelledby="pestana-resumen" data-panel-ficha="resumen"${pestanaFicha === 'resumen' ? '' : ' hidden'}>
    ${anim ? '<div class="ficha-animacion" id="ficha-animacion"></div>' : dibujo ? `<img class="ficha-dibujo" src="${dibujo}" alt="Cómo se hace: ${esc(ej.nombre)}" width="960" height="640">` : ''}
    ${anim && dibujo ? `<details class="extra ficha-ilustracion"><summary>Ver la ilustración de las dos posiciones</summary><img class="ficha-dibujo" src="${dibujo}" alt="Cómo se hace: ${esc(ej.nombre)}" width="960" height="640" loading="lazy"></details>` : ''}
    <h1>${esc(ej.nombre)}</h1>
    <p class="ficha-musculos-texto suave">Principal: ${esc(mayuscula(musculos(ej.musculos_primarios)))}${ej.musculos_secundarios.length ? `<br>Secundarios: ${esc(mayuscula(musculos(ej.musculos_secundarios)))}` : ''}</p>
    <p class="ficha-sub suave">${esc(ej.propio ? ['Creado por ti', ...ej.equipamiento.map(q => EQUIPO[q]).filter(Boolean).slice(0, 2)].join(' · ') : [...ej.equipamiento.map(q => EQUIPO[q]).filter(Boolean).slice(0, 2), NIVEL[ej.nivel_minimo]].filter(Boolean).join(' · '))}</p>
    ${E.notasFijas?.[id] ? `<p class="nota-fija">${icono('lapiz', 'icono icono-chico')}<span>Tu nota fija: ${esc(E.notasFijas[id])}</span></p>` : ''}


    ${p?.esHoy ? `<section class="tarjeta fila-resumen"><span><strong>Hoy:</strong> <span class="num">${esc(`${p.e.series} × ${p.e.reps_min}${p.e.reps_max !== p.e.reps_min ? ` a ${p.e.reps_max}` : ''}${sufijo(p.e)}${p.e.unidad === 'm' ? '' : ` · RIR ${p.e.rir}`}${p.e.carga_kg ? ` · ${peso(p.e.carga_kg)}` : ''}`)}</span></span><button type="button" class="enlace" id="cambiar-hoy">Cambiar</button></section>` : ''}

    ${progresoEjercicioHtml(id, { asistido: esAsistido(ej) })}

    ${esAsistido(ej) ? '' : recordsHtml(id, seg)}
    ${esAsistido(ej) || seg ? '' : calculadoraHtml(id)}
    <section class="tarjeta"${esAsistido(ej) ? '' : ' hidden'}>
      <h2>Tus marcas</h2>
      ${m ? `<div class="marcas">
        ${m.menorAyuda ? `<div><span class="num grande">${esc(kg(m.menorAyuda.carga_kg))} <small>× ${m.menorAyuda.reps}</small></span><span class="pequeno suave">Tu menor ayuda (el número es la ayuda de la máquina: bajarla es progresar)</span></div>` : ''}
        ${m.pesada ? `<div><span class="num grande">${esc(kg(m.pesada.carga_kg))} <small>× ${m.pesada.reps}</small></span><span class="pequeno suave">Tu serie más pesada</span></div>` : ''}
        ${m.mejor ? `<div><span class="num grande">${esc(kg(m.mejor.estimado))}</span><span class="pequeno suave">Lo que levantarías 1 vez (estimado)</span></div>` : ''}
        ${!m.pesada && !m.menorAyuda && m.reps ? `<div><span class="num grande">${m.reps.reps}${seg ? ' s' : ''}</span><span class="pequeno suave">Tu mejor serie</span></div>` : ''}
      </div>
      <p class="pequeno suave">Anotado ${m.veces === 1 ? '1 vez' : `${m.veces} veces`}. La última, el ${esc(fechaCorta(m.ultima.fecha))}: <span class="num">${esc(m.ultima.series.map(s => (s.carga_kg ? `${coma(enUnidad(s.carga_kg))} × ${s.reps ?? (s.distancia_m != null ? `${s.distancia_m} m` : '')}` : `${s.reps ?? s.duracion_seg ?? ''}${seg || s.duracion_seg != null ? ' s' : ''}`)).join(', '))}</span></p>`
        : '<p class="suave pequeno">Todavía no lo anotas. Cuando lo hagas, aquí vas a ver tu serie más pesada, tu máximo estimado y cómo te fue la última vez.</p>'}
    </section>

    ${ex ? `<section class="tarjeta porque">
      <h2>Por qué está en tu plan</h2>
      <ul class="lista-porque">${ex.motivos.map(x => `<li><details><summary>${esc(x.pregunta)}</summary><p>${esc(x.respuesta)}</p>${x.fuente ? `<p class="pequeno suave">Fuente: ${esc(x.fuente.documento)}, ${esc(x.fuente.seccion)}${x.refs.length ? ` [${x.refs.join(', ')}]` : ''}</p>` : ''}</details></li>`).join('')}</ul>
      ${ex.referencias.length ? `<details class="extra"><summary>Papers que lo respaldan (${ex.referencias.length})</summary><ol class="refs">${ex.referencias.map(r => `<li value="${r.n}">${esc(r.texto)} <span class="chip ${r.verificada ? 'verificada' : ''}">${r.verificada ? 'bibliografía comprobada' : 'por verificar'}</span>${r.url ? `<p><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">Abrir fuente</a></p><p class="pequeno">${esc(r.poblacion)} ${esc(r.limites)}</p>` : ''}</li>`).join('')}</ol></details>` : ''}
    </section>` : ''}

    ${alts.length ? `<section class="tarjeta">
      <h2>Alternativas</h2>
      <p class="pequeno suave">El mismo movimiento, con lo que hay donde entrenas.</p>
      <ul class="lista-ejercicios">${alts.map(a => `<li><button type="button" class="fila-ejercicio" data-ver="${a.id}">${miniatura(a.id)}<span><span class="nombre">${esc(a.nombre)}</span><span class="pequeno suave">${esc(mayuscula(musculos(a.musculos_primarios)))}</span></span>${icono('flecha', 'icono chevron')}</button></li>`).join('')}</ul>
    </section>` : ''}
    </div>
    <div class="panel-ficha" id="panel-historial" role="tabpanel" aria-labelledby="pestana-historial" data-panel-ficha="historial"${pestanaFicha === 'historial' ? '' : ' hidden'}>
    ${historialFichaHtml(id, seg)}
    </div>
    <div class="panel-ficha" id="panel-como" role="tabpanel" aria-labelledby="pestana-como" data-panel-ficha="como"${pestanaFicha === 'como' ? '' : ' hidden'}>
    <section class="tarjeta ficha-cuerpo">${cuerpoHtml(Object.fromEntries([...ej.musculos_secundarios.map(m => [m, 0.45]), ...ej.musculos_primarios.map(m => [m, 1])]), { tamano: 'grande', etiqueta: 'Músculos que trabaja' })}<p class="pequeno suave">Más oscuro, el principal; más claro, los secundarios.</p></section>
    <section class="tarjeta ficha-musculos">
      ${imagenesMusculos(ej.musculos_primarios.slice(0, 2))}
      <div>
        <p class="sobretitulo">Trabaja</p>
        <p class="musculos-hoy">${esc(mayuscula(musculos(ej.musculos_primarios)))}</p>
        ${ej.musculos_secundarios.length ? `<p class="pequeno suave">Y en menor medida ${esc(musculos(ej.musculos_secundarios).toLowerCase())}</p>` : ''}
        ${!dibujo && maq ? `<img class="ficha-maquina" src="${maq.src}" alt="${esc(EQUIPO[maq.id] || '')}" width="96" height="96">` : ''}
      </div>
    </section>
    ${ej.propio ? `<section class="tarjeta"><h2>Tu ejercicio</h2><p class="pequeno">Lo creaste tú: no tiene imagen ni técnica escrita. Queda en este teléfono, en tu respaldo y, si entraste, en tu cuenta.</p>
      <div class="fila-botones"><a class="boton video" href="${esc(enlaceVideo(ej))}" target="_blank" rel="noopener">${icono('video')} Ver videos de técnica</a><button type="button" class="boton" id="borrar-propio">Borrar este ejercicio</button></div></section>` : ''}
    <section class="tarjeta"${ej.propio ? ' hidden' : ''}>
      <h2>Cómo se hace</h2>
      <ol class="pasos">${t.pasos.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      ${t.ojo.length ? `<p class="sobretitulo ojo-titulo">Ojo con</p><ul class="ojo">${t.ojo.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <a class="boton video" href="${esc(enlaceVideo(ej))}" target="_blank" rel="noopener">${icono('video')} Ver videos de técnica</a>
      <div class="futura-en-ficha">${botonFuturo('revisionTecnica', { simbolo: 'camara' })}${avisoFuturo('revisionTecnica')}</div>
    </section>

    ${ej.propio ? '' : criteriosDeVariante(t)}

    </div>
  </div>`;

  if (anim) montarAnimacion($('ficha-animacion'), anim, { nombre: ej.nombre });
  enlazarFuturos($('vista-ficha'));
  const atras = () => (antes ? vistaFicha(ir, antes) : ir(desde, desde === 'hoy' ? { ej: id } : undefined));
  $('volver').onclick = atras;
  $('anotar-ajustes')?.addEventListener('click', ev => {
    const actual = E.notasFijas?.[id] || '';
    let texto = actual;
    abrirHoja({
      titulo: `Ajustes: ${ej.nombre}`, volver: ev.currentTarget,
      nota: 'La nota aparece cada vez que haces este ejercicio. Queda en este teléfono, en tu respaldo y, si entraste, en tu cuenta.',
      contenido: `<label class="pequeno" for="ficha-nota-ajustes">Asiento, respaldo, agarre o inclinación</label><textarea id="ficha-nota-ajustes" class="campo-nota-fija" rows="3" maxlength="200" placeholder="Asiento en 4, respaldo a 30 grados">${esc(actual)}</textarea>`,
      opciones: [{ valor: 'guardar', icono: icono('visto'), clase: 'confirmar', nombre: 'Guardar ajustes' },
        ...(actual ? [{ valor: 'borrar', icono: icono('cerrar'), nombre: 'Borrar los ajustes', peligro: true }] : [])],
      alElegir: v => {
        const nota = v === 'borrar' ? '' : texto.trim().slice(0, 200);
        E.notasFijas ||= {};
        if (nota) E.notasFijas[id] = nota; else delete E.notasFijas[id];
        datoCambiado('notas_fijas');
        const altura = window.scrollY;
        vistaFicha(ir, { id, desde, antes });
        window.scrollTo(0, altura);
        $('anotar-ajustes')?.focus({ preventScroll: true });
        avisar(nota ? 'Ajustes guardados.' : 'Ajustes borrados.');
      },
    });
    const campo = $('ficha-nota-ajustes');
    campo.oninput = () => { texto = campo.value; };
    requestAnimationFrame(() => { if (campo.isConnected) campo.focus(); });
  });
  // Borrar un ejercicio propio: si está en el plan de hoy en adelante, primero hay que sacarlo de ahí.
  $('borrar-propio')?.addEventListener('click', ev => {
    const enPlan = E.plan?.dias?.some(d => d.fecha >= f && d.ejercicios.some(e => e.ejercicio_id === id));
    if (enPlan) return avisar('Está en tu plan de hoy en adelante: quítalo de esas sesiones antes de borrarlo.');
    abrirHoja({ titulo: `Borrar ${ej.nombre}`, volver: ev.currentTarget,
      nota: 'Lo que ya anotaste se conserva en tu historial, con su nombre.',
      opciones: [{ valor: 'si', icono: icono('cerrar'), nombre: 'Sí, borrarlo', peligro: true }, { valor: 'no', icono: icono('flecha'), nombre: 'No, dejarlo' }],
      alElegir: v => { if (v !== 'si') return; E.ejerciciosPropios = (E.ejerciciosPropios || []).filter(e => e.id !== id); E.mensaje = `Borraste "${ej.nombre}".`; datoCambiado('ejercicios_propios'); ir(desde === 'ejercicio' ? 'hoy' : desde); } });
  });
  enlazarProgresoEjercicio(id, { asistido: esAsistido(ej) });
  // Pestañas, como Hevy: Resumen, Historial y Cómo se hace. Cambiar no vuelve a dibujar la ficha.
  document.querySelectorAll('[data-pestana-ficha]').forEach(b => b.onclick = () => {
    pestanaFicha = b.dataset.pestanaFicha;
    document.querySelectorAll('[data-pestana-ficha]').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('[data-panel-ficha]').forEach(x => { x.hidden = x.dataset.panelFicha !== pestanaFicha; });
  });
  ['calc-peso', 'calc-reps'].forEach(x => $(x)?.addEventListener('input', pintarCalculadora));
  pintarCalculadora();
  document.querySelectorAll('[data-resumen-ficha]').forEach(b => b.onclick = () => ir('resumen', { id: b.dataset.resumenFicha, desde: 'progreso' }));
  document.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => { vistaFicha(ir, { id: b.dataset.ver, desde, antes: { id, desde, antes } }); window.scrollTo(0, 0); });
  $('cambiar-hoy')?.addEventListener('click', ev => proponer({ tipo: 'elegir_alternativa', fecha: f, ejercicio: id }, {
    titulo: `Cambiar ${ej.nombre}`, volver: ev.currentTarget, alCambiar: () => ir('hoy'),
  }));
}
