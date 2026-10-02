// Cuestionario. Dos formas de responderlo:
//  · Rápido (al empezar): una pregunta por pantalla, con tarjetas de colores y avance solo al tocar. Solo el
//    objetivo, el nivel, ser mayor de edad y aceptar los términos son obligatorios; lo demás se puede saltar.
//    Lo básico que más cambia el plan va acá: días, tiempo, máquinas del lugar, zonas a priorizar, favoritos y salud.
//  · Perfil (Más → Completar mi perfil): cada sección completa del cuestionario, para agregar lo adicional cuando
//    se quiera. Nada es obligatorio; al cambiar algo, se ofrece aplicarlo al plan.
import { C, E, guardar, R, esc, $, hoy, indice, numero, coma, chk } from './comun.js';
import { derivar, nivelDeclarado } from '../nucleo/derivar.js';
import { tieneEquipo, nivelAlcanza } from '../nucleo/catalogo.js';

const pregunta = id => C.secciones.flatMap(s => s.preguntas).find(p => p.id === id);
const PRESETS = () => pregunta('lugares').presets;

// ── Rápido ──────────────────────────────────────────────────────────────────
export const OBJETIVO_VISTA = {
  ganar_musculo: { icono: '💪', corto: 'Ganar músculo', sub: 'Más masa muscular' },
  ganar_fuerza: { icono: '🏋️', corto: 'Ser más fuerte', sub: 'Levantar más peso' },
  bajar_grasa: { icono: '🔥', corto: 'Bajar grasa', sub: 'Sin perder músculo' },
  recomposicion: { icono: '⚖️', corto: 'Las dos', sub: 'Bajar grasa y ganar músculo' },
  salud: { icono: '❤️', corto: 'Salud', sub: 'Sentirme mejor' },
  deporte: { icono: '⚽', corto: 'Mi deporte', sub: 'Rendir mejor' },
  volver: { icono: '🔄', corto: 'Volver', sub: 'Después de una pausa' },
};
/** Dibujo del objetivo (app/img/objetivos, hecho con ChatGPT desde docs/09-banco-de-imagenes.md). Es decorativo: el texto va al lado. */
export const imagenObjetivo = (id, clase = 'ilustracion') => `<img class="${clase}" src="img/objetivos/${id}.webp" alt="" width="256" height="256" decoding="async">`;
export const NIVEL_VISTA = {
  principiante: { icono: '🌱', nombre: 'Principiante' },
  intermedio: { icono: '🌿', nombre: 'Intermedio' },
  avanzado: { icono: '🌳', nombre: 'Avanzado' },
};
const NIVEL_DE_TIEMPO = { nunca: 'principiante', menos_6m: 'principiante', '6_24m': 'intermedio', '2_5a': null, mas_5a: null };
const PAUSAS = [[2, '1 a 3 meses'], [4, '3 a 6 meses'], [9, '6 meses a 1 año'], [18, 'Más de un año']];
const DIAS = [[1, 'L', 'lunes'], [2, 'M', 'martes'], [3, 'M', 'miércoles'], [4, 'J', 'jueves'], [5, 'V', 'viernes'], [6, 'S', 'sábado'], [0, 'D', 'domingo']];

const PASOS = ['objetivo', 'nivel', 'semana', 'lugar', 'musculos', 'favoritos', 'sobre_ti', 'salud', 'final'];
/** Lo obligatorio de cada paso (los que no están, se pueden saltar). */
const LISTO = {
  objetivo: r => !!r.objetivo_principal,
  nivel: r => !!r.tiempo_entrenando,
  sobre_ti: r => r.mayor_18 === true,
  final: r => r.terminos === true && r.privacidad === true,
};
const pasoActual = () => Math.max(0, Math.min(PASOS.length - 1, E.paso || 0));
const lugarPrincipal = () => (R().lugares || [])[0] || null;

function pasoObjetivo(r) {
  const ops = pregunta('objetivo_principal').opciones;
  const v = r.objetivo_principal;
  let extra = '';
  if (v === 'recomposicion') {
    const p = pregunta('prioridad_recomposicion');
    extra = `<div class="seguir"><p class="enunciado">${esc(p.texto)}</p>${chips('prioridad_recomposicion', p.opciones, r.prioridad_recomposicion)}</div>`;
  } else if (v === 'deporte') {
    extra = `<div class="seguir"><label class="enunciado" for="deporte">${esc(pregunta('deporte_cual').texto)}</label><input type="text" id="deporte" data-texto="deporte_cual" value="${esc(r.deporte_cual)}" placeholder="Ej: fútbol, los sábados" autocomplete="off"></div>`;
  } else if (v === 'volver') {
    extra = `<div class="seguir"><p class="enunciado">${esc(pregunta('pausa_meses').texto)}</p>${chips('pausa_meses', PAUSAS, r.pausa_meses, true)}</div>`;
  }
  return {
    titulo: '¿Qué quieres lograr?', sub: 'Elige lo principal. Lo puedes cambiar cuando quieras.',
    html: `<div class="grid-opciones">${ops.map(([o]) => {
      const x = OBJETIVO_VISTA[o];
      return `<button type="button" class="tarjeta-opcion obj-${o}" data-set="objetivo_principal" data-v="${o}" aria-pressed="${v === o}">${imagenObjetivo(o)}<strong>${esc(x.corto)}</strong><span class="pequeno">${esc(x.sub)}</span></button>`;
    }).join('')}</div>${extra}`,
  };
}

function pasoNivel(r) {
  const p = pregunta('tiempo_entrenando');
  const v = r.tiempo_entrenando;
  const conConstancia = v === '2_5a' || v === 'mas_5a';
  const niv = v ? nivelDeclarado(r) : null;
  return {
    titulo: 'Tu nivel', sub: '¿Cuánto tiempo llevas entrenando con pesas? Es lo que más cambia el plan.',
    html: `<div class="lista-opciones">${p.opciones.map(([o, t]) => {
      const n = NIVEL_DE_TIEMPO[o];
      return `<button type="button" class="fila-opcion" data-set="tiempo_entrenando" data-v="${o}" aria-pressed="${v === o}"><span>${esc(t)}</span><span class="nivel-chip ${n || 'mixto'}">${n ? `${NIVEL_VISTA[n].icono} ${NIVEL_VISTA[n].nombre}` : '🌿 o 🌳'}</span></button>`;
    }).join('')}</div>
    ${conConstancia ? `<div class="seguir"><p class="enunciado">${esc(pregunta('constancia').texto)}</p>${chips('constancia', pregunta('constancia').opciones, r.constancia)}</div>` : ''}
    ${niv ? `<div class="resultado-nivel nivel-${niv}"><span class="emoji" aria-hidden="true">${NIVEL_VISTA[niv].icono}</span><div><strong>Partes como ${NIVEL_VISTA[niv].nombre.toLowerCase()}</strong><p class="pequeno">Tu nivel sube solo a medida que entrenas con la app.</p></div></div>` : '<p class="pequeno suave">🌱 → 🌿 → 🌳 Tu nivel sube solo a medida que entrenas con la app.</p>'}`,
  };
}

function pasoSemana(r) {
  const dur = pregunta('duracion_min').opciones;
  const no = r.dias_no_puedo || [];
  return {
    titulo: 'Tu semana', sub: 'Si no eliges, partimos con 3 días de 60 minutos.',
    html: `<p class="enunciado">¿Cuántos días quieres entrenar?</p>
    <div class="numeros">${[2, 3, 4, 5, 6].map(n => `<button type="button" class="numero-opcion" data-set="dias_meta" data-v="${n}" data-num aria-pressed="${Number(r.dias_meta) === n}">${n}</button>`).join('')}</div>
    <p class="enunciado">¿Cuánto dura cada sesión?</p>
    <div class="chips-botones">${dur.map(([o, t]) => `<button type="button" class="chip-opcion" data-set="duracion_min" data-v="${o}" aria-pressed="${String(r.duracion_min) === o}">⏱️ ${esc(t)}</button>`).join('')}</div>
    <p class="enunciado">¿Qué días casi nunca puedes? <span class="suave pequeno">(opcional)</span></p>
    <div class="dias-semana">${DIAS.map(([n, l, nombre]) => `<button type="button" class="dia-opcion" data-dia="${n}" aria-pressed="${no.includes(n)}" aria-label="${nombre}">${l}</button>`).join('')}</div>`,
  };
}

function pasoLugar(r) {
  const l = lugarPrincipal();
  const p = pregunta('lugares');
  return {
    titulo: '¿Dónde entrenas?', sub: 'El plan usa solo las máquinas que marques.',
    html: `<div class="grid-opciones">${PRESETS().map(x => `<button type="button" class="tarjeta-opcion lugar" data-preset="${x.id}" aria-pressed="${l?.preset === x.id}"><span class="emoji" aria-hidden="true">${x.icono}</span><strong>${esc(x.nombre)}</strong><span class="pequeno">${esc(x.ayuda)}</span></button>`).join('')}</div>
    ${l ? `<div class="seguir"><p class="enunciado">Máquinas y equipos de ${esc(l.nombre)}</p><p class="pequeno suave">Marca lo que hay y quita lo que no. Es vital: el plan no te va a pedir una máquina que no tienes.</p>
      <div class="chips-botones">${p.equipamiento.map(([eq, n]) => `<button type="button" class="chip-opcion" data-eq="${eq}" aria-pressed="${l.equipamiento.includes(eq)}">${esc(n)}</button>`).join('')}</div>
      <p class="pequeno suave">${l.equipamiento.length ? `${l.equipamiento.length} marcadas.` : 'Sin máquinas: el plan va con tu peso corporal.'}</p></div>` : ''}`,
  };
}

function pasoMusculos(r) {
  const v = r.musculos_prioridad || [];
  return {
    titulo: '¿Qué quieres priorizar?', sub: 'Esas zonas reciben más series que el resto. Elige hasta 3: con más, cada una recibe menos.',
    html: `<div class="chips-botones grandes">${C.zonas.musculos.map(([m, t]) => `<button type="button" class="chip-opcion" data-toggle="musculos_prioridad" data-v="${m}" aria-pressed="${v.includes(m)}">${esc(t)}</button>`).join('')}</div>
    ${v.length > 3 ? '<p class="aviso ojo pequeno">Marcaste más de 3: igual se puede, pero cada una crece menos.</p>' : ''}`,
  };
}

const ORDEN_TIPO = { compuesto: 0, aislamiento: 1, core: 2, cardio: 3 };
/** Sugerencias de favoritos: lo más común que se puede hacer en ese lugar y nivel, un ejercicio por movimiento. */
function sugerencias(r) {
  const equipo = lugarPrincipal()?.equipamiento || [];
  const niv = nivelDeclarado(r);
  const vistos = new Set();
  return indice.ejercicios.filter(e => e.tipo !== 'movilidad' && tieneEquipo(e, equipo) && nivelAlcanza(niv, e.nivel_minimo))
    .sort((a, b) => (ORDEN_TIPO[a.tipo] ?? 4) - (ORDEN_TIPO[b.tipo] ?? 4) || a.preferencia - b.preferencia || a.nombre.localeCompare(b.nombre))
    .filter(e => (vistos.has(e.patron) ? false : vistos.add(e.patron)))
    .slice(0, 14);
}

function pasoFavoritos(r) {
  const v = r.favoritos || [];
  const sug = sugerencias(r).filter(e => !v.includes(e.id));
  return {
    titulo: 'Tus favoritos', sub: 'Los ejercicios que te gustan van a estar siempre en tu plan, si tu lugar tiene con qué hacerlos.',
    html: `${v.length ? `<div class="chips-botones elegidos">${v.map(id => `<button type="button" class="chip-opcion" data-fav="${id}" aria-pressed="true" aria-label="Quitar ${esc(indice.porId.get(id)?.nombre)}">⭐ ${esc(indice.porId.get(id)?.nombre)} <span aria-hidden="true">✕</span></button>`).join('')}</div>` : ''}
    <input type="search" data-buscar-fav placeholder="Busca: sentadilla, banca, hip thrust…" autocomplete="off" aria-label="Buscar un ejercicio">
    <div class="chips-botones" id="res-fav"></div>
    <p class="enunciado">Sugerencias para tu lugar</p>
    <div class="chips-botones">${sug.map(e => `<button type="button" class="chip-opcion" data-fav="${e.id}" aria-pressed="false">${esc(e.nombre)}</button>`).join('')}</div>`,
  };
}

function pasoSobreTi(r) {
  const sexo = pregunta('sexo');
  return {
    titulo: 'Sobre ti', sub: 'Solo es obligatorio confirmar tu edad.',
    html: `<label class="casilla-grande${r.mayor_18 ? ' marcada' : ''}"><input type="checkbox" data-check="mayor_18"${chk(r.mayor_18 === true)}><span>Tengo 18 años o más</span></label>
    <label class="enunciado" for="apodo">¿Cómo te llamamos? <span class="suave pequeno">(opcional)</span></label>
    <input type="text" id="apodo" data-texto="apodo" value="${esc(r.apodo)}" autocomplete="nickname" placeholder="Tu nombre o apodo">
    <p class="enunciado">${esc(sexo.texto)} <span class="suave pequeno">(opcional)</span></p>
    ${chips('sexo', sexo.opciones, r.sexo)}
    <p class="pequeno suave">${esc(sexo.por_que || '')}</p>`,
  };
}

function pasoSalud(r) {
  const cons = pregunta('consentimiento_salud');
  const tam = pregunta('tamizaje');
  const t = r.tamizaje || {};
  const conSalud = r.consentimiento_salud === true;
  const embarazo = pregunta('embarazo');
  const lesiones = r.lesiones || [];
  const zonas = C.zonas.articulaciones;
  return {
    titulo: 'Tu salud', sub: 'Para cuidarte: con esto el plan evita lo que te puede hacer daño.',
    html: `<div class="aviso ojo pequeno">${esc(cons.texto)} ${esc(cons.por_que)}</div>
    <div class="numeros dos"><button type="button" class="numero-opcion texto" data-set="consentimiento_salud" data-v="true" data-bool aria-pressed="${conSalud}">Sí, acepto</button><button type="button" class="numero-opcion texto" data-set="consentimiento_salud" data-v="false" data-bool aria-pressed="${r.consentimiento_salud === false}">Prefiero no</button></div>
    ${r.consentimiento_salud === false ? `<p class="pequeno suave">${esc(cons.si_no_acepta)}</p>` : ''}
    ${conSalud ? `<p class="enunciado">¿Te pasa alguna de estas?</p><p class="pequeno suave">Marca las que te pasen. Si no marcas ninguna, entendemos que no.</p>
      <div class="lista-opciones">${tam.filas.map(([f, txt]) => `<button type="button" class="fila-opcion casilla-fila" data-tamizaje="${f}" aria-pressed="${t[f] === true}"><span>${esc(txt)}</span></button>`).join('')}</div>
      ${['femenino', 'otro', 'no_dice'].includes(r.sexo) ? `<p class="enunciado">${esc(embarazo.texto)}</p>${chips('embarazo', embarazo.opciones, r.embarazo)}` : ''}
      <p class="enunciado">¿Tienes alguna lesión o molestia ahora?</p>
      <div class="chips-botones">${zonas.map(([z, n]) => `<button type="button" class="chip-opcion" data-zona="${z}" aria-pressed="${lesiones.some(l => l.region === z)}">${esc(n)}</button>`).join('')}</div>
      ${lesiones.map(l => `<div class="lesion"><strong>${esc(zonas.find(z => z[0] === l.region)?.[1] || l.region)}</strong>
        <div class="segmentos" role="group" aria-label="Tipo">${[['molestia', 'Molestia'], ['lesion', 'Lesión']].map(([v, n]) => `<button type="button" data-lesion-tipo="${v}" data-region="${l.region}" aria-pressed="${(l.tipo || 'molestia') === v}">${n}</button>`).join('')}</div>
        <p class="pequeno suave">¿Cuánto duele hoy? 0 es nada, 10 es el peor dolor.</p>
        <div class="escala">${Array.from({ length: 11 }, (_, i) => `<button type="button" class="paso-escala" data-lesion-int="${i}" data-region="${l.region}" aria-pressed="${l.intensidad === i}">${i}</button>`).join('')}</div>
      </div>`).join('')}` : ''}`,
  };
}

function pasoFinal(r) {
  const ids = ['terminos', 'privacidad', 'ia_transferencia'];
  return {
    titulo: 'Último paso', sub: 'Los dos primeros son obligatorios.',
    html: ids.map(id => { const p = pregunta(id); return `<label class="casilla-grande${r[id] ? ' marcada' : ''}"><input type="checkbox" data-check="${id}"${chk(r[id] === true)}><span>${esc(p.texto)}</span></label>`; }).join(''),
  };
}

const PINTAR = { objetivo: pasoObjetivo, nivel: pasoNivel, semana: pasoSemana, lugar: pasoLugar, musculos: pasoMusculos, favoritos: pasoFavoritos, sobre_ti: pasoSobreTi, salud: pasoSalud, final: pasoFinal };

function chips(id, opciones, v, num = false) {
  return `<div class="chips-botones">${opciones.map(([o, t]) => `<button type="button" class="chip-opcion" data-set="${id}" data-v="${esc(o)}"${num ? ' data-num' : ''} aria-pressed="${String(v) === String(o)}">${esc(t)}</button>`).join('')}</div>`;
}

/** El cuestionario rápido. `armarPlan` se llama al terminar. */
export function vistaRapido(ir, armarPlan) {
  const i = pasoActual();
  const id = PASOS[i];
  const r = R();
  const { titulo, sub, html } = PINTAR[id](r);
  const obligatorio = !!LISTO[id];
  const listo = !obligatorio || LISTO[id](r);
  const ultimo = i === PASOS.length - 1;
  $('app').innerHTML = `<div class="rapido" id="rapido" data-paso="${id}">
    <div class="cab-rapido">
      <button type="button" class="atras-rapido" data-atras aria-label="Atrás"${i === 0 ? ' hidden' : ''}>‹</button>
      <div class="pasos-rapido" role="progressbar" aria-valuemin="1" aria-valuemax="${PASOS.length}" aria-valuenow="${i + 1}" aria-label="Paso ${i + 1} de ${PASOS.length}">${PASOS.map((_, j) => `<i class="${j < i ? 'hecho' : j === i ? 'actual' : ''}"></i>`).join('')}</div>
      ${obligatorio || ultimo ? '' : '<button type="button" class="enlace saltar" data-saltar>Saltar</button>'}
    </div>
    <p class="suave pequeno paso-n">Paso ${i + 1} de ${PASOS.length}${obligatorio ? ' · obligatorio' : ''}</p>
    <h1>${esc(titulo)}</h1>
    <p class="sub-rapido">${esc(sub)}</p>
    ${html}
    <div class="pie-rapido"><button type="button" class="boton primario grande" data-siguiente${listo ? '' : ' disabled'}>${ultimo ? 'Armar mi plan ✨' : 'Siguiente'}</button></div>
  </div>`;
  enlazarRapido(ir, armarPlan);
}

const SIGUE_OBJETIVO = ['recomposicion', 'deporte', 'volver'];

function enlazarRapido(ir, armarPlan) {
  const raiz = $('rapido');
  const r = R();
  const repintar = () => { const y = window.scrollY; vistaRapido(ir, armarPlan); window.scrollTo(0, y); };
  const avanzar = () => {
    const id = PASOS[pasoActual()];
    if (LISTO[id] && !LISTO[id](R())) return;
    if (id === 'salud' && R().consentimiento_salud === true) {
      // Lo que no marcó del tamizaje es un "no".
      R().tamizaje = Object.fromEntries(pregunta('tamizaje').filas.map(([f]) => [f, R().tamizaje?.[f] === true]));
    }
    if (pasoActual() === PASOS.length - 1) { R().respondido_el ||= hoy(); guardar(); return armarPlan(); }
    E.paso = pasoActual() + 1; guardar(); vistaRapido(ir, armarPlan); window.scrollTo(0, 0);
  };
  raiz.addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.atras !== undefined) { E.paso = Math.max(0, pasoActual() - 1); guardar(); vistaRapido(ir, armarPlan); window.scrollTo(0, 0); return; }
    if (d.saltar !== undefined || d.siguiente !== undefined) return avanzar();
    if (d.set) {
      const v = d.bool !== undefined ? d.v === 'true' : d.num !== undefined ? Number(d.v) : d.v;
      r[d.set] = r[d.set] === v && d.set !== 'objetivo_principal' && d.set !== 'tiempo_entrenando' ? undefined : v;
      if (d.set === 'tiempo_entrenando' && !['2_5a', 'mas_5a'].includes(v)) delete r.constancia;
      guardar();
      // Avance solo: el objetivo y el nivel, si no tienen una pregunta que sigue.
      const auto = (d.set === 'objetivo_principal' && !SIGUE_OBJETIVO.includes(v)) || (d.set === 'tiempo_entrenando' && NIVEL_DE_TIEMPO[v])
        || (d.set === 'constancia') || (d.set === 'prioridad_recomposicion') || (d.set === 'pausa_meses');
      repintar();
      if (auto) setTimeout(avanzar, 260);
      return;
    }
    if (d.toggle) {
      const s = new Set(r[d.toggle] || []);
      s.has(d.v) ? s.delete(d.v) : s.add(d.v);
      r[d.toggle] = [...s]; guardar(); return repintar();
    }
    if (d.dia !== undefined) {
      const s = new Set(r.dias_no_puedo || []); const n = Number(d.dia);
      s.has(n) ? s.delete(n) : s.add(n);
      r.dias_no_puedo = [...s]; guardar(); return repintar();
    }
    if (d.preset) {
      const x = PRESETS().find(p => p.id === d.preset);
      r.lugares = [{ nombre: x.nombre, tipo: x.tipo, equipamiento: [...x.equipamiento], principal: true, preset: x.id }, ...(r.lugares || []).slice(1)];
      guardar(); return repintar();
    }
    if (d.eq) {
      const l = { ...lugarPrincipal() };
      const s = new Set(l.equipamiento); s.has(d.eq) ? s.delete(d.eq) : s.add(d.eq);
      l.equipamiento = [...s];
      r.lugares = [l, ...r.lugares.slice(1)]; guardar(); return repintar();
    }
    if (d.fav) {
      const s = new Set(r.favoritos || []); s.has(d.fav) ? s.delete(d.fav) : s.add(d.fav);
      r.favoritos = [...s]; guardar(); return repintar();
    }
    if (d.tamizaje) { r.tamizaje = { ...(r.tamizaje || {}), [d.tamizaje]: r.tamizaje?.[d.tamizaje] !== true }; guardar(); return repintar(); }
    if (d.zona) {
      const lista = r.lesiones || [];
      r.lesiones = lista.some(l => l.region === d.zona) ? lista.filter(l => l.region !== d.zona) : [...lista, { region: d.zona, tipo: 'molestia', activa: true }];
      guardar(); return repintar();
    }
    if (d.lesionTipo) { r.lesiones = r.lesiones.map(l => (l.region === d.region ? { ...l, tipo: d.lesionTipo } : l)); guardar(); return repintar(); }
    if (d.lesionInt !== undefined) { r.lesiones = r.lesiones.map(l => (l.region === d.region ? { ...l, intensidad: Number(d.lesionInt) } : l)); guardar(); return repintar(); }
  });
  raiz.addEventListener('change', ev => {
    const c = ev.target.dataset.check;
    if (!c) return;
    r[c] = ev.target.checked; guardar(); repintar();
  });
  raiz.addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.texto) { r[el.dataset.texto] = el.value; guardar(); }
    if (el.dataset.buscarFav !== undefined) {
      const n = el.value.trim().toLowerCase();
      const v = r.favoritos || [];
      $('res-fav').innerHTML = n.length < 2 ? '' : indice.ejercicios.filter(e => !v.includes(e.id) && `${e.nombre} ${e.nombre_hevy || ''}`.toLowerCase().includes(n)).slice(0, 8)
        .map(e => `<button type="button" class="chip-opcion" data-fav="${e.id}" aria-pressed="false">${esc(e.nombre)}</button>`).join('') || '<span class="suave pequeno">Sin resultados</span>';
    }
  });
}

// ── Perfil: las secciones completas, para agregar lo adicional ─────────────
export const SECCION_ICONO = {
  sobre_ti: '🙂', objetivo: '🎯', experiencia: '📈', tiempo: '📅', lugar: '🏋️', salud: '🩺', ciclo: '🌙',
  recuperacion: '😴', cardio: '🏃', preferencias: '⭐', seguimiento: '📝', consentimientos: '✅',
};

function cumple(cond) {
  if (!cond) return true;
  return Object.entries(cond).every(([id, valores]) => {
    const v = R()[id];
    if (valores.includes('alguna')) return Array.isArray(v) && v.length > 0;
    if (Array.isArray(v)) return v.some(x => valores.includes(x));
    return valores.includes(v);
  });
}
const seccionesVisibles = () => C.secciones.filter(s => cumple(s.mostrar_si));
const preguntasVisibles = s => s.preguntas.filter(p => cumple(p.mostrar_si));
const respondida = v => !(v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length));
/** Firma de las respuestas, para saber si cambiaron desde que se armó el plan. */
export const firmaRespuestas = () => JSON.stringify(R());

export function vistaPerfil(ir, armarPlan) {
  const secs = seccionesVisibles();
  const cambio = E.plan && E.firmaPlan && E.firmaPlan !== firmaRespuestas();
  const total = secs.reduce((a, s) => a + preguntasVisibles(s).length, 0);
  const hechas = secs.reduce((a, s) => a + preguntasVisibles(s).filter(p => respondida(R()[p.id])).length, 0);
  $('app').innerHTML = `<div id="vista-perfil">
    <h1>Tu perfil</h1>
    <p class="suave">Mientras más sepa de ti, mejor se ajusta el plan. Nada de esto es obligatorio: completa lo que quieras, cuando quieras.</p>
    <div class="avance-perfil"><div class="medidor"><i style="width:${Math.round((hechas / (total || 1)) * 100)}%"></i></div><span class="pequeno num">${hechas} de ${total}</span></div>
    ${cambio ? '<section class="tarjeta destacada"><h3>Cambiaste respuestas</h3><p class="pequeno">Tu plan todavía usa las de antes. Al aplicarlas se rehace desde el próximo lunes, con los pesos que ya anotaste.</p><div class="fila-botones"><button type="button" class="boton primario" id="aplicar">Aplicar a mi plan</button></div></section>' : ''}
    <ul class="secciones-perfil">${secs.map(s => {
      const ps = preguntasVisibles(s);
      const n = ps.filter(p => respondida(R()[p.id])).length;
      return `<li><button type="button" data-seccion="${s.id}"><span class="emoji" aria-hidden="true">${SECCION_ICONO[s.id] || '•'}</span><span class="texto"><strong>${esc(s.titulo)}</strong><span class="pequeno suave">${n === ps.length ? 'Completa ✓' : `${n} de ${ps.length}`}</span></span><span class="flecha" aria-hidden="true">›</span></button></li>`;
    }).join('')}</ul>
    ${E.plan ? '' : '<div class="fila-botones"><button type="button" class="boton primario" id="aplicar">Armar mi plan</button></div>'}
  </div>`;
  document.querySelectorAll('[data-seccion]').forEach(b => b.onclick = () => { E.seccionPerfil = b.dataset.seccion; guardar(); ir('seccion'); });
  $('aplicar')?.addEventListener('click', () => armarPlan());
}

// ── Una sección del perfil, con todas sus preguntas ───────────────────────
function campo(p) {
  const v = R()[p.id];
  const id = `p-${p.id}`;
  switch (p.tipo) {
    case 'texto': return `<input type="text" id="${id}" data-p="${p.id}" value="${esc(v)}" autocomplete="off">`;
    case 'texto_largo': return `<textarea id="${id}" data-p="${p.id}">${esc(v)}</textarea>`;
    case 'numero': return `<input type="text" id="${id}" data-p="${p.id}" data-num value="${esc(coma(v))}" inputmode="decimal" autocomplete="off"> <span class="suave pequeno">${esc(p.unidad || '')}</span>`;
    case 'fecha': return `<input type="date" id="${id}" data-p="${p.id}" value="${esc(v)}">`;
    case 'una': return `<div class="opciones" role="radiogroup">${p.opciones.map(([val, t]) => `<label><input type="radio" name="${p.id}" data-p="${p.id}" value="${esc(val)}"${chk(v === val)}>${esc(t)}</label>`).join('')}</div>`;
    case 'varias': return `<div class="chips">${p.opciones.map(([val, t]) => `<label><input type="checkbox" data-p="${p.id}" data-varias value="${esc(val)}"${chk((v || []).includes(val))}>${esc(t)}</label>`).join('')}</div>`;
    case 'si_no': return `<div class="opciones">${[[true, 'Sí'], [false, 'No']].map(([val, t]) => `<label><input type="radio" name="${p.id}" data-p="${p.id}" data-bool value="${val}"${chk(v === val)}>${t}</label>`).join('')}</div>`;
    case 'consentimiento': return `<div class="opciones"><label><input type="checkbox" data-p="${p.id}" data-consent${chk(v === true)}>${esc(p.texto)}</label></div>`;
    case 'escala': return escalaQ(p.id, p.min, p.max, v, p.extremos, `data-p="${p.id}"`);
    case 'dias': {
      const max1 = p.maximo === 1;
      return `<div class="escala">${DIAS.map(([d, t, nombre]) => `<label title="${nombre}"><input type="${max1 ? 'radio' : 'checkbox'}" name="${p.id}" data-p="${p.id}" data-dias${max1 ? ' data-uno' : ''} value="${d}"${chk(max1 ? v === d : (v || []).includes(d))}>${t}</label>`).join('')}</div>`;
    }
    case 'matriz': case 'matriz_si_no': {
      const ops = p.tipo === 'matriz' ? p.opciones : [[true, 'Sí'], [false, 'No']];
      return `<div class="matriz">${p.filas.map(([f, t]) => `<div class="fila"><span class="pequeno">${esc(t)}</span><div class="escala">${ops.map(([val, tt]) => `<label><input type="radio" name="${p.id}.${f}" data-p="${p.id}" data-fila="${f}"${p.tipo === 'matriz_si_no' ? ' data-bool' : ''} value="${val}"${chk((v || {})[f] === val)}>${esc(tt)}</label>`).join('')}</div></div>`).join('')}</div>`;
    }
    case 'mapa_corporal': return mapa(p, v);
    case 'ejercicios': return ejercicios(p, v);
    case 'lugares': return lugares(p, v);
    default: return `<p class="suave">Tipo ${esc(p.tipo)} sin interfaz todavía.</p>`;
  }
}

function escalaQ(nombre, min, max, v, extremos, attrs) {
  let s = '<div class="escala">';
  for (let i = min; i <= max; i++) s += `<label><input type="radio" name="${nombre}" ${attrs} data-num value="${i}"${chk(v === i)}>${i}</label>`;
  return s + `</div>${extremos ? `<div class="extremos"><span>${esc(extremos[0])}</span><span>${esc(extremos[1])}</span></div>` : ''}`;
}

function mapa(p, v) {
  const zonas = C.zonas[p.zonas];
  const conDetalle = Array.isArray(p.por_zona);
  const elegidas = conDetalle ? (v || []).map(x => x.region) : (v || []);
  let s = `<div class="chips">${zonas.map(([z, t]) => `<label><input type="checkbox" data-p="${p.id}" data-zona value="${z}"${chk(elegidas.includes(z))}>${esc(t)}</label>`).join('')}</div>`;
  if (conDetalle) {
    for (const x of v || []) {
      const nombre = zonas.find(z => z[0] === x.region)?.[1] || x.region;
      s += `<div class="subcampos"><strong>${esc(nombre)}</strong>${p.por_zona.map(f => {
        const val = x[f.id];
        const a = `data-p="${p.id}" data-zona-campo="${f.id}" data-region="${x.region}"`;
        if (f.tipo === 'una') return `<label>${esc(f.texto)}<select ${a}><option value="">Elige</option>${f.opciones.map(([o, t]) => `<option value="${o}"${val === o ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`;
        if (f.tipo === 'escala') return `<label>${esc(f.texto)}</label>${escalaQ(`${p.id}.${x.region}.${f.id}`, f.min, f.max, val, f.extremos, a)}`;
        if (f.tipo === 'fecha') return `<label>${esc(f.texto)}<input type="date" ${a} value="${esc(val)}"></label>`;
        return `<label>${esc(f.texto)}<textarea ${a}>${esc(val)}</textarea></label>`;
      }).join('')}</div>`;
    }
  }
  return s;
}

function ejercicios(p, v) {
  const conCampos = Array.isArray(p.campos);
  const elegidos = conCampos ? (v || []) : (v || []).map(id => ({ ejercicio_id: id }));
  let s = `<input type="text" data-buscar="${p.id}" placeholder="Busca un ejercicio: sentadilla, banca, hip thrust…" autocomplete="off"><div class="chips" id="res-${p.id}"></div>`;
  if (elegidos.length) {
    s += `<div class="subcampos">${elegidos.map(x => `<div><label><input type="checkbox" checked data-p="${p.id}" data-quitar="${x.ejercicio_id}"> ${esc(indice.porId.get(x.ejercicio_id)?.nombre)}</label>${conCampos ? ` <input type="text" inputmode="decimal" data-p="${p.id}" data-ej="${x.ejercicio_id}" data-c="peso_kg" data-num placeholder="kg" value="${esc(coma(x.peso_kg))}" style="width:90px"> × <input type="text" inputmode="numeric" data-p="${p.id}" data-ej="${x.ejercicio_id}" data-c="repeticiones" data-num placeholder="reps" value="${esc(x.repeticiones)}" style="width:80px">` : ''}</div>`).join('')}</div>`;
  }
  return s;
}

function resultadosBusqueda(pid, q) {
  const caja = document.getElementById(`res-${pid}`);
  if (!caja) return;
  const n = q.trim().toLowerCase();
  if (n.length < 2) { caja.innerHTML = ''; return; }
  const lista = indice.ejercicios.filter(e => `${e.nombre} ${e.nombre_hevy}`.toLowerCase().includes(n)).slice(0, 8);
  caja.innerHTML = lista.map(e => `<label><input type="checkbox" data-p="${pid}" data-agregar="${e.id}">${esc(e.nombre)}</label>`).join('') || '<span class="suave pequeno">Sin resultados</span>';
}

const LUGAR_VACIO = () => { const x = PRESETS()[0]; return { nombre: x.nombre, tipo: x.tipo, equipamiento: [...x.equipamiento], principal: true, preset: x.id }; };

function lugares(p, v) {
  const lista = v?.length ? v : [LUGAR_VACIO()];
  return lista.map((l, i) => `<div class="tarjeta">
    <label class="pequeno">Nombre <input type="text" data-p="${p.id}" data-lugar="${i}" data-c="nombre" value="${esc(l.nombre)}"></label>
    <label class="pequeno">Tipo <select data-p="${p.id}" data-lugar="${i}" data-c="tipo">${p.tipo_lugar.map(([t, n]) => `<option value="${t}"${l.tipo === t ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
    <p class="pequeno suave">Equipamiento</p>
    <div class="chips">${p.equipamiento.map(([eq, n]) => `<label><input type="checkbox" data-p="${p.id}" data-lugar="${i}" data-eq value="${eq}"${chk(l.equipamiento.includes(eq))}>${esc(n)}</label>`).join('')}</div>
    ${p.por_lugar.filter(f => l.equipamiento.includes(f.mostrar_si_equipo)).map(f => f.tipo === 'una'
      ? `<label class="pequeno">${esc(f.texto)} <select data-p="${p.id}" data-lugar="${i}" data-c="${f.id}" data-num>${f.opciones.map(([o, t]) => `<option value="${o}"${String(l[f.id]) === o ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>`
      : `<label class="pequeno">${esc(f.texto)} <input type="text" inputmode="decimal" data-p="${p.id}" data-lugar="${i}" data-c="${f.id}" data-num value="${esc(coma(l[f.id]))}"></label>`).join('')}
  </div>`).join('') + `<button type="button" class="boton" data-otro-lugar="${p.id}">Agregar otro lugar</button>`;
}

function alCambiar(ev, estructural, repintar) {
  const el = ev.target;
  const pid = el.dataset.p;
  if (!pid) return;
  const r = R();
  const valor = el.dataset.bool !== undefined ? el.value === 'true' : el.dataset.num !== undefined ? numero(el.value) : el.value;
  let reestructura = false;
  if (el.dataset.consent !== undefined) { r[pid] = el.checked; reestructura = true; }
  else if (el.dataset.varias !== undefined) { const s = new Set(r[pid] || []); el.checked ? s.add(el.value) : s.delete(el.value); r[pid] = [...s]; reestructura = true; }
  else if (el.dataset.dias !== undefined) {
    if (el.dataset.uno !== undefined) r[pid] = Number(el.value);
    else { const s = new Set(r[pid] || []); el.checked ? s.add(Number(el.value)) : s.delete(Number(el.value)); r[pid] = [...s]; }
  } else if (el.dataset.fila) { r[pid] = { ...(r[pid] || {}), [el.dataset.fila]: valor }; }
  else if (el.dataset.zona !== undefined) {
    const p = pregunta(pid);
    if (Array.isArray(p.por_zona)) {
      const lista = (r[pid] || []).filter(x => x.region !== el.value);
      r[pid] = el.checked ? [...lista, { region: el.value, activa: true }] : lista;
    } else { const s = new Set(r[pid] || []); el.checked ? s.add(el.value) : s.delete(el.value); r[pid] = [...s]; }
    reestructura = true;
  } else if (el.dataset.zonaCampo) {
    r[pid] = (r[pid] || []).map(x => (x.region === el.dataset.region ? { ...x, [el.dataset.zonaCampo]: valor } : x));
  } else if (el.dataset.agregar) {
    const p = pregunta(pid);
    const lista = r[pid] || [];
    if (Array.isArray(p.campos)) { if (!lista.some(x => x.ejercicio_id === el.dataset.agregar)) r[pid] = [...lista, { ejercicio_id: el.dataset.agregar }]; }
    else if (!lista.includes(el.dataset.agregar)) r[pid] = [...lista, el.dataset.agregar];
    reestructura = true;
  } else if (el.dataset.quitar) {
    r[pid] = (r[pid] || []).filter(x => (x.ejercicio_id || x) !== el.dataset.quitar);
    reestructura = true;
  } else if (el.dataset.ej) {
    r[pid] = (r[pid] || []).map(x => (x.ejercicio_id === el.dataset.ej ? { ...x, [el.dataset.c]: valor } : x));
  } else if (el.dataset.lugar !== undefined) {
    const i = Number(el.dataset.lugar);
    const lista = r[pid]?.length ? r[pid] : [LUGAR_VACIO()];
    const l = { ...lista[i] };
    if (el.dataset.eq !== undefined) { const s = new Set(l.equipamiento); el.checked ? s.add(el.value) : s.delete(el.value); l.equipamiento = [...s]; reestructura = true; }
    else l[el.dataset.c] = valor;
    r[pid] = lista.map((x, j) => (j === i ? l : x));
  } else {
    r[pid] = valor;
    reestructura = el.type === 'radio';
  }
  guardar();
  if (estructural && reestructura) repintar();
}

/** Errores que sí se revisan en el perfil (aunque nada sea obligatorio). */
function validarSeccion(ps) {
  let ok = true;
  for (const p of ps) {
    const v = R()[p.id];
    let msg = '';
    if (p.id === 'fecha_nacimiento' && v && derivar({ fecha_nacimiento: v }, C, hoy()).edad < 18) msg = p.valida.mensaje_si_no;
    if (p.id === 'dias_firmes' && v > (R().dias_meta || 7)) msg = 'No pueden ser más que los días que quieres entrenar.';
    const el = document.getElementById(`err-${p.id}`);
    if (el) el.textContent = msg;
    if (msg && ok) document.getElementById(`q-${p.id}`)?.scrollIntoView({ block: 'center' });
    if (msg) ok = false;
  }
  return ok;
}

export function vistaSeccion(ir) {
  const s = seccionesVisibles().find(x => x.id === E.seccionPerfil) || seccionesVisibles()[0];
  const ps = preguntasVisibles(s);
  const repintar = () => { const y = window.scrollY; vistaSeccion(ir); window.scrollTo(0, y); };
  $('app').innerHTML = `<div id="vista-seccion">
    <button type="button" class="enlace" id="a-perfil">‹ Tu perfil</button>
    <h1><span aria-hidden="true">${SECCION_ICONO[s.id] || ''}</span> ${esc(s.titulo)}</h1>
    ${s.intro ? `<div class="aviso ${s.sensible ? 'ojo' : ''}">${esc(s.intro)}</div>` : ''}
    <form id="seccion" novalidate>
      ${ps.map(p => `<div class="pregunta" id="q-${p.id}">
        ${p.tipo === 'consentimiento' ? '' : `<div class="enunciado">${esc(p.texto)}</div>`}
        ${p.ayuda ? `<p class="ayuda">${esc(p.ayuda)}</p>` : ''}
        ${campo(p)}
        ${p.por_que ? `<details class="extra"><summary>¿Por qué preguntamos esto?</summary><p class="por-que">${esc(p.por_que)}</p></details>` : ''}
        <div class="error" id="err-${p.id}"></div>
      </div>`).join('')}
      <div class="fila-botones"><button type="submit" class="boton primario">Listo</button></div>
    </form>
  </div>`;
  const f = $('seccion');
  f.addEventListener('input', e => { if (e.target.dataset.buscar) resultadosBusqueda(e.target.dataset.buscar, e.target.value); else if (['text', 'number', 'date', 'textarea'].includes(e.target.type) || e.target.tagName === 'TEXTAREA') alCambiar(e, false, repintar); });
  f.addEventListener('change', e => { if (!e.target.dataset.buscar) alCambiar(e, true, repintar); });
  f.addEventListener('click', e => {
    const b = e.target.closest('[data-otro-lugar]');
    if (!b) return;
    const pid = b.dataset.otroLugar;
    const lista = R()[pid]?.length ? R()[pid] : [LUGAR_VACIO()];
    R()[pid] = [...lista, { nombre: `Lugar ${lista.length + 1}`, tipo: 'gimnasio_basico', equipamiento: [] }];
    guardar(); repintar();
  });
  f.addEventListener('submit', e => { e.preventDefault(); if (validarSeccion(ps)) ir('perfil'); });
  $('a-perfil').onclick = () => ir('perfil');
}
