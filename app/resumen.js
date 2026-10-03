// Resumen de una sesión, como el de Hevy al guardar: se abre solo al terminar y desde el historial. Cuánto levantaste,
// los récords, qué salió bien y qué salió mal (contra el plan del día y la vez anterior), cada ejercicio y compartir.
import { E, esc, $, indice, hoy, fechaCorta, peso, volumenTexto, seriesTexto, avisar, IMAGENES } from './comun.js';
import { resumenSesion } from '../nucleo/resumen-sesion.js';
import { sesionDe } from '../nucleo/agenda.js';
import { estadoDelPlan } from '../nucleo/registrado.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import { dice } from './cuestionario.js';
import { esAsistido } from '../nucleo/catalogo.js';
import { imagenSesion } from './imagen-sesion.js';
import { cuentaNuevaHtml, enlazarCuentaNueva } from './cuenta-ui.js';

const nombreEj = (id, respaldo) => indice.porId.get(id)?.nombre || respaldo || 'Ejercicio';
// Insignia de cada récord (hoja RS01 del banco de imágenes). Mientras no esté cortada, se muestra la etiqueta "Récord".
const INSIGNIA = { peso: 'peso', e1rm: 'e1rm', volumen: 'volumen', reps_con_peso: 'repeticiones', reps: 'repeticiones', duracion: 'tiempo', menos_ayuda: 'peso', reps_con_ayuda: 'repeticiones' };
const insignia = tipo => { const src = `img/resumen/${INSIGNIA[tipo] || 'completa'}.webp`; return IMAGENES.has(src) ? `<img class="insignia" src="${src}" alt="" width="40" height="40" decoding="async">` : '<span class="chip-record">Récord</span>'; };
/** 45 → "45 segundos"; 1200 → "20 minutos"; 90 → "1:30 minutos". */
const tiempo = seg => (seg < 60 ? `${seg} segundos` : seg % 60 ? `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, '0')} minutos` : `${seg / 60} minutos`);

/** Un récord dicho en simple. corto: para el aviso al marcar la serie. */
export function textoRecord(r, { corto = false } = {}) {
  switch (r.tipo) {
    case 'peso': return corto ? `más peso que nunca (${peso(r.valor)})` : `más peso que nunca: ${peso(r.valor)} (antes ${peso(r.antes)})`;
    case 'e1rm': return corto ? `mejor máximo estimado (${peso(r.valor)})` : `tu mejor máximo estimado: ${peso(r.valor)}`;
    case 'volumen': return corto ? 'tu serie con más volumen' : `tu serie con más volumen: ${volumenTexto(r.valor)} entre peso y repeticiones`;
    case 'reps_con_peso': return `${r.valor} repeticiones con ${peso(r.kg)}, más que nunca`;
    case 'reps': return `${r.valor} repeticiones, más que nunca`;
    case 'duracion': return `${tiempo(r.valor)}, tu mejor tiempo`;
    case 'menos_ayuda': return corto ? `menos ayuda que nunca (${peso(r.valor)})` : `menos ayuda que nunca: ${peso(r.valor)} (antes ${peso(r.antes)})`;
    case 'reps_con_ayuda': return `${r.valor} repeticiones con ${peso(r.kg)} de ayuda, más que nunca`;
    default: return 'récord';
  }
}

function textoBien(b) {
  const nombre = nombreEj(b.ejercicio_id);
  if (b.tipo === 'record') return `${nombre}: ${textoRecord(b.record)}.`;
  if (b.tipo === 'rango_completo') return `${nombre}: completaste el rango (${b.reps_max} en todas las series). La próxima vez toca subir un poco el peso.`;
  if (b.tipo === 'mejor_que_antes') return `${nombre}: más volumen que la vez anterior (${volumenTexto(b.volumen)} contra ${volumenTexto(b.antes)}).`;
  return nombre;
}
function textoMal(m) {
  const nombre = nombreEj(m.ejercicio_id, m.nombre);
  if (m.tipo === 'no_hecho') return `${nombre}: no lo hiciste.`;
  if (m.tipo === 'menos_series') return `${nombre}: ${m.hechas} de ${m.plan} series.`;
  if (m.tipo === 'bajo_rango') return `${nombre}: una serie quedó en ${m.reps} repeticiones; ${m.reps_min === m.reps_max ? `el plan pedía ${m.reps_min}` : `el rango era ${m.reps_min} a ${m.reps_max}`}.`;
  if (m.tipo === 'fallo_no_pedido') return `${nombre}: llegaste al fallo y el plan pedía dejar ${m.rir} en reserva.`;
  if (m.tipo === 'menos_que_antes') return `${nombre}: menos volumen que la vez anterior (${volumenTexto(m.volumen)} contra ${volumenTexto(m.antes)}).`;
  return nombre;
}

/** Las series de un ejercicio en palabras: peso y repeticiones, o el tiempo si van por tiempo. */
function textoSeries(xs) {
  const conReps = xs.filter(x => x.reps != null);
  if (conReps.length) return seriesTexto(conReps);
  // Peso y distancia (caminata del granjero) o cardio con distancia: "24 kg × 30 m".
  const conDistancia = xs.filter(x => x.distancia_m != null);
  if (conDistancia.length) return conDistancia.map(x => `${x.carga_kg ? `${peso(x.carga_kg)} × ` : ''}${x.distancia_m >= 1000 ? `${String(Math.round(x.distancia_m / 100) / 10).replace('.', ',')} km` : `${x.distancia_m} m`}`).join(', ');
  const seg = xs.reduce((a, x) => a + (Number(x.duracion_seg) || 0), 0);
  return seg ? tiempo(seg) : `${xs.length} ${xs.length === 1 ? 'serie' : 'series'}`;
}

/** La sesión en texto para pegarla en ChatGPT, Claude o Gemini. Sin nombre, correo, peso corporal ni datos de salud. */
function textoParaIA({ sesion, r, dia, foco }) {
  const presc = e => `${e.series} × ${e.reps_min}${e.reps_max !== e.reps_min ? ` a ${e.reps_max}` : ''}${e.unidad === 'seg' ? ' s' : e.unidad === 'm' ? ' m' : ''}${e.unidad === 'm' ? '' : `, ${e.rir} en reserva`}${e.carga_kg ? `, ${peso(e.carga_kg)}` : ''}`;
  return [
    'Te paso una sesión de gimnasio que registré en la app Entreno. Dime en simple qué salió bien, qué ajustarías para la próxima y por qué. Responde en español.',
    '',
    `Sesión: ${foco}, ${fechaCorta(sesion.fecha)}${r.minutos ? `, ${r.minutos} minutos` : ''}.`,
    ...r.porEjercicio.map(g => {
      const e = dia?.ejercicios.find(x => x.ejercicio_id === g.ejercicio_id);
      return `- ${nombreEj(g.ejercicio_id, g.nombre)}: ${textoSeries(g.series)}${e ? ` (el plan pedía ${presc(e)})` : ''}${g.anterior.length ? `; la vez anterior: ${textoSeries(g.anterior)}` : ''}`;
    }),
    ...(r.records.length ? ['', 'Récords:', ...r.records.map(x => `- ${nombreEj(x.ejercicio_id)}: ${textoRecord(x)}`)] : []),
    ...(r.mal.length ? ['', 'Lo que no salió como el plan:', ...r.mal.map(m => `- ${textoMal(m)}`)] : []),
    '',
    'Las cargas van en la unidad que uso; "en reserva" son las repeticiones que me quedaban (RIR).',
  ].join('\n');
}

/** Las series de trabajo anteriores a la sesión: las de días anteriores y las de otra sesión más temprano ese día
 *  (por ejemplo, una de Hevy en la mañana y otra en la app en la tarde). */
function historialAntes(sesion) {
  const otras = E.sesiones.filter(s => s !== sesion && (s.fecha < sesion.fecha || (s.fecha === sesion.fecha && (s.hora || '') < (sesion.hora || '99:99'))));
  return seriesAnotadas(otras, {});
}

export function vistaResumen(ir, { id, desde = null } = {}) {
  const sesion = E.sesiones.find(s => s.id === id) || E.sesiones.filter(s => !s.origen).at(-1);
  if (!sesion) return ir('hoy');
  // El día del plan con que se compara: el de su fecha si se anotó en la app; si vino de Hevy, el que más se le
  // parece (nucleo/registrado.js), que puede ser de otro día si se recuperó o se adelantó.
  let dia = null;
  if (E.plan) {
    if (!sesion.origen) dia = sesionDe(E.plan, sesion.fecha);
    else {
      const reg = estadoDelPlan(E.plan, E.sesiones, { hoy: hoy(), marcas: E.marcasPlan || {} });
      const fecha = [...reg.porDia].find(([, e]) => e.sesion === sesion)?.[0];
      dia = fecha ? sesionDe(E.plan, fecha) : null;
    }
  }
  const asistidos = new Set((sesion.series || []).map(s => s.ejercicio_id).filter(x => esAsistido(indice.porId.get(x))));
  const r = resumenSesion({ sesion, dia, historial: historialAntes(sesion), asistidos });
  const foco = dia?.foco || sesion.titulo || 'Entrenamiento';
  const n = r.records.length;
  const cifra = (valor, texto) => `<div class="cifra"><strong class="num">${valor}</strong><span class="pequeno suave">${texto}</span></div>`;
  $('app').innerHTML = `<div id="vista-resumen">
    <span class="sobretitulo">${esc(fechaCorta(sesion.fecha))}${sesion.hora ? ` · ${esc(sesion.hora)}` : ''}${sesion.origen === 'hevy' ? ' · Hevy' : ''}</span>
    <h1>${esc(foco)}</h1>
    ${dice('celebra', n ? `¡${n} ${n === 1 ? 'récord' : 'récords'} hoy! Mira abajo cuáles.` : r.mal.length ? '¡Sesión terminada! Abajo ves qué salió bien y qué cuidar la próxima.' : dia ? '¡Sesión terminada! Hiciste lo que pedía el plan.' : '¡Sesión registrada! Abajo está cada ejercicio.')}
    ${dia && !r.mal.length && IMAGENES.has('img/resumen/completa.webp') ? '<img class="medalla-completa" src="img/resumen/completa.webp" alt="Sesión completa" width="64" height="64" decoding="async">' : ''}
    <div class="cifras-resumen">
      ${cifra(r.minutos == null ? 'sin dato' : r.minutos < 1 ? 'menos de 1' : `${r.minutos}`, 'minutos')}
      ${cifra(esc(volumenTexto(r.volumen)), 'levantados en total')}
      ${cifra(r.seriesTrabajo, 'series de trabajo')}
      ${cifra(r.ejercicios, r.ejercicios === 1 ? 'ejercicio' : 'ejercicios')}
    </div>
    ${n ? `<section class="tarjeta"><h3>Récords</h3><ul class="lista-resumen record">${r.records.map(x => `<li>${insignia(x.tipo)} ${esc(nombreEj(x.ejercicio_id))}: ${esc(textoRecord(x))}</li>`).join('')}</ul></section>` : ''}
    <section class="tarjeta"><h3>Qué salió bien</h3>${r.bien.filter(b => b.tipo !== 'record').length || n
      ? `<ul class="lista-resumen bien">${r.bien.filter(b => b.tipo !== 'record').map(b => `<li>${esc(textoBien(b))}</li>`).join('') || '<li>Los récords de arriba.</li>'}</ul>`
      : '<p class="pequeno suave">Sesión registrada. Cuando repitas estos ejercicios, aquí vas a ver tus récords y lo que mejoraste.</p>'}</section>
    <section class="tarjeta"><h3>Qué salió mal</h3>${r.mal.length
      ? `<ul class="lista-resumen mal">${r.mal.map(m => `<li>${esc(textoMal(m))}</li>`).join('')}</ul>`
      : `<p class="pequeno suave">${dia ? 'Nada que corregir: hiciste lo que pedía el plan.' : 'Nada que corregir comparado con la vez anterior. Esta sesión no corresponde a un día de tu plan.'}</p>`}</section>
    <section class="tarjeta"><h3>Cada ejercicio</h3><ul class="pequeno detalle-h">${r.porEjercicio.map(g => `<li><strong>${esc(nombreEj(g.ejercicio_id, g.nombre))}</strong>: ${esc(textoSeries(g.series))}${g.anterior.length ? `<br><span class="suave">La vez anterior: ${esc(textoSeries(g.anterior))}</span>` : ''}</li>`).join('')}</ul></section>
    <details class="extra" id="resumen-ia"><summary>Preguntarle a tu IA por esta sesión</summary>
      <p class="pequeno">Copia la sesión (ejercicios, series, lo que pedía el plan y los récords; sin tu nombre ni datos de salud) y pégala en ChatGPT, Claude o Gemini para que te diga qué ajustar.</p>
      <div class="fila-botones"><button type="button" class="boton" id="copiar-ia">Copiar para mi IA</button></div>
      <p class="pequeno" id="copiado-ia" role="status"></p>
      <div class="fila-botones enlaces-ia"><a class="boton" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Abrir ChatGPT</a><a class="boton" href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">Abrir Claude</a><a class="boton" href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer">Abrir Gemini</a></div>
    </details>
    <div class="fila-botones"><button type="button" class="boton" id="compartir-resumen">Compartir</button><button type="button" class="boton" id="imagen-resumen">Imagen para compartir</button></div>
    <div id="imagen-compartir"></div>
    ${desde ? '' : cuentaNuevaHtml({ titulo: 'Guarda tus sesiones en una cuenta', texto: 'Así no las pierdes si cambias de teléfono. Puedes hacerlo ahora o después en Más.' })}
    <div class="fila-botones"><button type="button" class="boton primario" id="volver-hoy">Listo</button></div>
  </div>`;
  $('volver-hoy').onclick = () => ir('hoy');
  enlazarCuentaNueva(ir);
  // Imagen para historias, como Hevy: sin peso corporal ni fotos. Si el teléfono deja compartir archivos, abre su menú;
  // si no, se muestra para guardarla.
  $('imagen-resumen').onclick = async ev => {
    const b = ev.currentTarget; b.disabled = true;
    try {
      const mejor = xs => {
        const conPeso = xs.filter(x => Number(x.carga_kg) > 0);
        if (conPeso.length) { const m = conPeso.reduce((a, x) => (Number(x.carga_kg) * 100 + (Number(x.reps) || 0) > Number(a.carga_kg) * 100 + (Number(a.reps) || 0) ? x : a)); return `${peso(m.carga_kg)} × ${m.reps ?? (m.distancia_m != null ? `${m.distancia_m} m` : '')}`; }
        return textoSeries(xs);
      };
      const blob = await imagenSesion({
        titulo: foco, fecha: fechaCorta(sesion.fecha),
        cifras: [[r.minutos ?? '·', 'minutos'], [volumenTexto(r.volumen), 'levantados'], [r.seriesTrabajo, 'series']],
        ejercicios: r.porEjercicio.map(g => [nombreEj(g.ejercicio_id, g.nombre), mejor(g.series)]),
        records: r.records.map(x => `${nombreEj(x.ejercicio_id)}: ${textoRecord(x, { corto: true })}`),
      });
      const archivo = new File([blob], `entreno-${sesion.fecha}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [archivo] })) { try { await navigator.share({ files: [archivo], title: foco }); } catch { /* cerró el menú */ } return; }
      const url = URL.createObjectURL(blob);
      $('imagen-compartir').innerHTML = `<img class="imagen-sesion" src="${url}" alt="Imagen de la sesión para compartir" width="270" height="480"><div class="fila-botones"><a class="boton" href="${url}" download="${archivo.name}">Guardar la imagen</a></div>`;
    } catch (e) { avisar(e.message || 'No pude armar la imagen.'); }
    finally { b.disabled = false; }
  };
  // Como el botón de Hevy para ChatGPT y Claude: el texto se copia y la persona lo pega en su IA (la app no lo envía).
  $('copiar-ia').onclick = async () => {
    const texto = textoParaIA({ sesion, r, dia, foco });
    try { await navigator.clipboard.writeText(texto); $('copiado-ia').textContent = 'Copiado. Abre tu IA y pégalo.'; }
    catch {
      try { if (navigator.share) { await navigator.share({ title: foco, text: texto }); return; } } catch { return; }
      $('copiado-ia').textContent = 'No pude copiar: usa Compartir.';
    }
  };
  $('compartir-resumen').onclick = async () => {
    // Sin peso corporal ni fotos: solo lo de la sesión.
    const texto = [`${foco}, ${fechaCorta(sesion.fecha)}.`, `${r.minutos ? `${r.minutos} minutos, ` : ''}${volumenTexto(r.volumen)} levantados, ${r.seriesTrabajo} series de trabajo.`,
      ...r.records.map(x => `Récord en ${nombreEj(x.ejercicio_id)}: ${textoRecord(x)}.`)].join('\n');
    try {
      if (navigator.share) await navigator.share({ title: foco, text: texto });
      else { await navigator.clipboard.writeText(texto); avisar('Copié el resumen: pégalo donde quieras.'); }
    } catch { /* la persona cerró el menú de compartir */ }
  };
}
