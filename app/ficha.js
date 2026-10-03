// Ficha de un ejercicio, como en Hevy: el dibujo de cómo se hace (o su máquina), los músculos que trabaja (con su
// imagen), cómo se hace y los errores comunes, tus marcas, por qué está en tu plan (con los papers que lo respaldan)
// tu progreso (gráficos, ritmo e historial, en app/progreso-ejercicio.js) y con qué se puede cambiar. Se abre desde la
// ⓘ de cada ejercicio y desde Progreso.
import { E, R, D, C, TECNICA, EVIDENCIA, indice, hoy, esc, $, fechaCorta, coma, enUnidad, unidadPeso, peso, guardar, avisar } from './comun.js';
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

const VOLVER = { hoy: 'Hoy', semana: 'Semana', plan: 'Tu plan', progreso: 'Progreso', banco: 'Banco de ejercicios', ejercicio: 'Atrás' };
const EQUIPO = Object.fromEntries(C.secciones.flatMap(s => s.preguntas || []).find(p => p.equipamiento)?.equipamiento || []);
const NIVEL = { principiante: 'Para todos los niveles', intermedio: 'Desde nivel intermedio', avanzado: 'Para nivel avanzado' };
const musculos = xs => lista(xs.map(m => NOMBRE_MUSCULO[m] || m));

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
  const dibujo = dibujoEjercicio(id);
  const maq = maquinaDe(ej);
  const u = unidadPeso();
  const kg = x => `${coma(enUnidad(x))} ${u}`;
  const seg = p?.e?.unidad === 'seg';

  $('app').innerHTML = `<div id="vista-ficha">
    <button type="button" class="volver" id="volver">${icono('flecha', 'icono flecha-atras')} ${esc(VOLVER[desde] || 'Atrás')}</button>
    ${dibujo ? `<img class="ficha-dibujo" src="${dibujo}" alt="Cómo se hace: ${esc(ej.nombre)}" width="960" height="640">` : ''}
    <h1>${esc(ej.nombre)}</h1>
    <p class="ficha-sub suave">${esc(ej.propio ? ['Creado por ti', ...ej.equipamiento.map(q => EQUIPO[q]).filter(Boolean).slice(0, 2)].join(' · ') : [...ej.equipamiento.map(q => EQUIPO[q]).filter(Boolean).slice(0, 2), NIVEL[ej.nivel_minimo]].filter(Boolean).join(' · '))}</p>
    ${E.notasFijas?.[id] ? `<p class="nota-fija">${icono('lapiz', 'icono icono-chico')}<span>Tu nota fija: ${esc(E.notasFijas[id])}</span></p>` : ''}

    <section class="tarjeta ficha-musculos">
      ${imagenesMusculos(ej.musculos_primarios.slice(0, 2))}
      <div>
        <p class="sobretitulo">Trabaja</p>
        <p class="musculos-hoy">${esc(mayuscula(musculos(ej.musculos_primarios)))}</p>
        ${ej.musculos_secundarios.length ? `<p class="pequeno suave">Y en menor medida ${esc(musculos(ej.musculos_secundarios).toLowerCase())}</p>` : ''}
        ${!dibujo && maq ? `<img class="ficha-maquina" src="${maq.src}" alt="${esc(EQUIPO[maq.id] || '')}" width="96" height="96">` : ''}
      </div>
    </section>

    ${p?.esHoy ? `<section class="tarjeta fila-resumen"><span><strong>Hoy:</strong> <span class="num">${esc(`${p.e.series} × ${p.e.reps_min}${p.e.reps_max !== p.e.reps_min ? ` a ${p.e.reps_max}` : ''}${sufijo(p.e)}${p.e.unidad === 'm' ? '' : ` · RIR ${p.e.rir}`}${p.e.carga_kg ? ` · ${peso(p.e.carga_kg)}` : ''}`)}</span></span><button type="button" class="enlace" id="cambiar-hoy">Cambiar</button></section>` : ''}

    ${ej.propio ? `<section class="tarjeta"><h2>Tu ejercicio</h2><p class="pequeno">Lo creaste tú: no tiene imagen ni técnica escrita. Queda en este teléfono y en tu respaldo; en tu cuenta, sus series se guardan con su nombre.</p>
      <div class="fila-botones"><a class="boton video" href="${esc(enlaceVideo(ej))}" target="_blank" rel="noopener">${icono('video')} Ver videos de técnica</a><button type="button" class="boton" id="borrar-propio">Borrar este ejercicio</button></div></section>` : ''}
    <section class="tarjeta"${ej.propio ? ' hidden' : ''}>
      <h2>Cómo se hace</h2>
      <ol class="pasos">${t.pasos.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
      ${t.ojo.length ? `<p class="sobretitulo ojo-titulo">Ojo con</p><ul class="ojo">${t.ojo.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <a class="boton video" href="${esc(enlaceVideo(ej))}" target="_blank" rel="noopener">${icono('video')} Ver videos de técnica</a>
    </section>

    <section class="tarjeta">
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

    ${progresoEjercicioHtml(id, { asistido: esAsistido(ej) })}

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
  </div>`;

  const atras = () => (antes ? vistaFicha(ir, antes) : ir(desde, desde === 'hoy' ? { ej: id } : undefined));
  $('volver').onclick = atras;
  // Borrar un ejercicio propio: si está en el plan de hoy en adelante, primero hay que sacarlo de ahí.
  $('borrar-propio')?.addEventListener('click', ev => {
    const enPlan = E.plan?.dias?.some(d => d.fecha >= f && d.ejercicios.some(e => e.ejercicio_id === id));
    if (enPlan) return avisar('Está en tu plan de hoy en adelante: quítalo de esas sesiones antes de borrarlo.');
    abrirHoja({ titulo: `Borrar ${ej.nombre}`, volver: ev.currentTarget,
      nota: 'Lo que ya anotaste se conserva en tu historial, con su nombre.',
      opciones: [{ valor: 'si', icono: icono('cerrar'), nombre: 'Sí, borrarlo', peligro: true }, { valor: 'no', icono: icono('flecha'), nombre: 'No, dejarlo' }],
      alElegir: v => { if (v !== 'si') return; E.ejerciciosPropios = (E.ejerciciosPropios || []).filter(e => e.id !== id); E.mensaje = `Borraste "${ej.nombre}".`; guardar(); ir(desde === 'ejercicio' ? 'hoy' : desde); } });
  });
  enlazarProgresoEjercicio(id, { asistido: esAsistido(ej) });
  document.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => { vistaFicha(ir, { id: b.dataset.ver, desde, antes: { id, desde, antes } }); window.scrollTo(0, 0); });
  $('cambiar-hoy')?.addEventListener('click', ev => proponer({ tipo: 'elegir_alternativa', fecha: f, ejercicio: id }, {
    titulo: `Cambiar ${ej.nombre}`, volver: ev.currentTarget, alCambiar: () => ir('hoy'),
  }));
}
