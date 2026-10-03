// "Tu plan": la pantalla que aparece al armar el plan (y desde Semana o Más). Muestra, con colores y sin jerga,
// qué se armó y por qué: el objetivo y el nivel, la semana, lo que pediste punto por punto y cómo quedó, las
// series por músculo, cómo vas a progresar, el bloque con su descarga y cuánto te falta para subir de nivel.
// El objetivo se puede cambiar desde acá; lo demás, en el perfil.
import { sufijo } from '../nucleo/unidades.js';
import { E, guardar, R, D, esc, $, hoy, indice, C, mostrarMensaje } from './comun.js';
import { resumenPlan } from '../nucleo/resumen-plan.js';
import { progresoNivel } from '../nucleo/nivel.js';
import { OBJETIVO_VISTA, NIVEL_VISTA, imagenObjetivo, dice } from './cuestionario.js';
import { fechasEntrenadas } from './temporada.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import { miniatura } from './imagenes.js';
import { cuentaNuevaHtml, enlazarCuentaNueva } from './cuenta-ui.js';
import { grupos, etiquetaSuperserie } from '../nucleo/superseries.js';

const LETRA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const ESTADO = { si: ['✓', 'Cumple'], parcial: ['~', 'En parte'], no: ['✕', 'No se pudo'] };
const CORTO = { cuerpo: 'Todo', torso: 'Torso', pierna: 'Pierna', empuje: 'Empuje', tiron: 'Tirón' };
const corto = x => CORTO[String(x.plantilla || '').split('_')[0]] || String(x.foco || '').split(/[:,(]/)[0].trim();
const mayus = t => (t ? t[0].toUpperCase() + t.slice(1) : t);

export function vistaPlan(ir, { armarPlan, nuevo = false } = {}) {
  const p = E.plan;
  if (!p || p.bloqueado) return ir('inicio');
  const d = D();
  const s = resumenPlan({ plan: p, respuestas: R(), derivados: d, indice, hoy: hoy() });
  const nv = progresoNivel({ respuestas: R(), fechas: fechasEntrenadas(), hoy: hoy() });
  const o = OBJETIVO_VISTA[s.objetivo.id] || OBJETIVO_VISTA.salud;
  const n = NIVEL_VISTA[s.nivel];
  const [lo, hi] = s.rango;
  const maxVol = Math.max(hi + 4, ...s.volumen.map(v => v.series));
  const favoritos = new Set(R().favoritos || []);
  const prioridad = new Set(d.musculos_prioridad);
  const trabajaPrioridad = id => (indice.porId.get(id)?.musculos_primarios || []).some(m => prioridad.has(m));
  const pct = x => `${Math.round((x / maxVol) * 100)}%`;
  const semanasBloque = Array.from({ length: s.bloque.semanas }, (_, i) => i + 1);

  $('app').innerHTML = `<div id="vista-plan" class="obj-${s.objetivo.id}">
    <section class="heroe">
      ${imagenObjetivo(s.objetivo.id, 'ilustracion-heroe')}
      <p class="antetitulo">${nuevo ? 'Tu plan está listo' : 'Tu plan'}</p>
      <h1>${esc(s.objetivo.nombre)}</h1>
      <div class="chips-heroe">
        <span class="nivel-chip ${s.nivel}">${n.nombre}</span>
        <span class="chip-heroe">${s.dias.length} días</span>
        <span class="chip-heroe">~${s.minutos.largo} min</span>
        <span class="chip-heroe">${s.bloque.semanas} semanas</span>
      </div>
      <button type="button" class="enlace" id="cambiar-objetivo">Cambiar objetivo</button>
    </section>

    ${dice(nuevo ? 'celebra' : 'explica', nuevo ? '¡Listo! Lo armé con lo que me contaste. Abajo ves, punto por punto, cómo quedó lo que pediste.' : 'Este es tu plan. Abajo ves, punto por punto, cómo quedó lo que pediste.')}

    <h2>Tu semana</h2>
    <div class="tira-semana" role="list">${s.semana.map((x, i) => x
      ? `<div class="dia-tira entrena" role="listitem" aria-label="${esc(x.nombre_dia)}: ${esc(x.foco)}, ${x.minutos} minutos"><b>${LETRA[i]}</b><span>${esc(corto(x))}</span><small class="num">${x.minutos}′</small></div>`
      : `<div class="dia-tira" role="listitem" aria-label="Descanso"><b>${LETRA[i]}</b><span>Libre</span></div>`).join('')}</div>

    <h2>Lo que pediste</h2>
    <ul class="cumple">${s.cumple.map(c => `<li class="${c.estado}"><span class="marca-cumple" aria-label="${ESTADO[c.estado][1]}">${ESTADO[c.estado][0]}</span><div><strong>${esc(c.tema)}</strong><p>${esc(c.texto)}</p></div></li>`).join('')}</ul>

    <h2>Cada día</h2>
    ${s.dias.map(x => `<details class="tarjeta dia-plan"><summary><span class="dia-nombre">${esc(mayus(x.nombre_dia))}</span><span class="dia-foco">${esc(x.foco)}</span><span class="chip num">~${x.minutos} min</span></summary>
      <ul class="ejercicios-plan">${x.ejercicios.map((e, k, todos) => { const g = grupos(todos)[k]; return `<li class="con-mini${g ? ` en-superserie ss-${g.letra}` : ''}"><span class="ej-semana">${miniatura(e.id, 'miniatura chica')}<span class="nombre">${g ? `<span class="chip-ss">${etiquetaSuperserie(g)}</span>` : ''}${favoritos.has(e.id) ? `<span title="Favorito" aria-label="Favorito">${icono('estrella', 'icono-estrella')}</span> ` : ''}${esc(e.nombre)}${trabajaPrioridad(e.id) ? ' <span class="punto-prioridad" title="Trabaja una zona prioritaria" aria-label="Zona prioritaria"></span>' : ''}</span></span><span class="num">${e.series} × ${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${sufijo(e)}</span></li>`; }).join('')}</ul>
      ${x.cardio ? `<p class="pequeno suave">Cardio: ${esc(x.cardio)}</p>` : ''}
      ${x.firme ? '' : '<p class="pequeno suave">Día opcional: si no alcanzas, no se pierde nada importante.</p>'}
    </details>`).join('')}
    <p class="pequeno suave leyenda">${icono('estrella', 'icono-estrella')} favorito · <span class="punto-prioridad"></span> zona prioritaria · series × repeticiones</p>

    <h2>Series por músculo</h2>
    <p class="pequeno suave">A la semana. La franja es lo recomendado para tu nivel (${lo} a ${hi}); las zonas prioritarias pueden pasarse un poco.</p>
    <ul class="barras-musculo">${s.volumen.map(v => `<li class="${v.prioridad ? 'prioridad' : ''}">
      <span class="nombre-musculo">${esc(mayus(v.nombre))}${v.prioridad ? ' <span class="chip-prioridad">Prioridad</span>' : ''}</span>
      <span class="pista"><span class="franja" style="left:${pct(lo)};width:calc(${pct(hi)} - ${pct(lo)})"></span><i style="width:${pct(v.series)}"></i></span>
      <span class="num">${String(v.series).replace('.', ',')}</span></li>`).join('')}</ul>

    <h2>Cómo vas a progresar</h2>
    <section class="tarjeta">
      <p>${esc(s.progresion)}</p>
      <div class="bloque-visual" aria-label="Bloque de ${s.bloque.semanas} semanas${s.bloque.descarga ? `; la semana ${s.bloque.descarga} es de descarga` : ''}">
        ${semanasBloque.map(w => { const desc = w === s.bloque.descarga; return `<div class="${desc ? 'descarga' : ''}"><i style="height:${desc ? 38 : 52 + w * 14}%"></i><span>${desc ? 'Descarga' : `Semana ${w}`}</span></div>`; }).join('')}
      </div>
      <p class="pequeno suave">${s.bloque.suaves ? `Las primeras ${s.bloque.suaves} semanas van más suaves. ` : ''}${s.bloque.descarga ? `La semana ${s.bloque.descarga} baja a la mitad de las series para que el cuerpo se recupere y llegues fresco al bloque siguiente.` : ''}</p>
    </section>

    <h2>Tu nivel</h2>
    <section class="tarjeta nivel-tarjeta nivel-${nv.nivel}">
      <div class="fila-nivel">${['principiante', 'intermedio', 'avanzado'].map(k => `<span class="paso-nivel${k === nv.nivel ? ' actual' : ''}${['principiante', 'intermedio', 'avanzado'].indexOf(k) < ['principiante', 'intermedio', 'avanzado'].indexOf(nv.nivel) ? ' pasado' : ''}"><img src="img/niveles/${k}.webp" alt="" width="256" height="256" decoding="async"><small>${NIVEL_VISTA[k].nombre}</small></span>`).join('<i aria-hidden="true"></i>')}</div>
      <p class="pequeno">${nv.sube ? `Con lo que has entrenado ya corresponde ${NIVEL_VISTA[nv.alcanzado].nombre.toLowerCase()}: se aplica al armar tu próximo bloque.` : esc(nv.falta || 'Estás en el nivel más alto. El plan sigue ajustando cargas y volumen con lo que anotas.')}</p>
    </section>

    ${nuevo ? cuentaNuevaHtml({ titulo: 'Guarda tu plan en una cuenta', texto: 'Así no lo pierdes si cambias de teléfono, y tus sesiones quedan respaldadas. Puedes hacerlo ahora o después en Más.' }) : ''}
    <div class="pie-plan">
      <button type="button" class="boton primario grande" id="empezar-plan">${nuevo ? 'Empezar' : 'Ir a Hoy'}</button>
      <button type="button" class="boton" id="a-perfil">Completar mi perfil</button>
    </div>
  </div>`;

  $('empezar-plan').onclick = () => ir('hoy');
  enlazarCuentaNueva(ir);
  $('a-perfil').onclick = () => ir('perfil');
  $('cambiar-objetivo').onclick = ev => abrirHoja({
    titulo: '¿Qué quieres lograr?',
    volver: ev.currentTarget,
    opciones: C.secciones.flatMap(x => x.preguntas).find(q => q.id === 'objetivo_principal').opciones.map(([v, t]) => ({
      valor: v, imagen: `img/objetivos/${v}.webp`, nombre: t + (v === s.objetivo.id ? ' (actual)' : ''),
    })),
    alElegir: async v => {
      if (v === R().objetivo_principal) return;
      R().objetivo_principal = v;
      guardar();
      await armarPlan({ mensaje: `Plan rehecho para ${OBJETIVO_VISTA[v].corto.toLowerCase()}, desde el próximo lunes.` });
    },
  });
  mostrarMensaje();
}
