// Consulta de la copia privada del tablero. Nunca cambia el plan ni marca series como hechas.
import { E, esc, hoy } from './comun.js';

let semanaElegida = null, diaElegido = null, copiaElegida = null;
const lista = x => Array.isArray(x) ? x : [];
const objetos = x => lista(x).filter(y => y && typeof y === 'object' && !Array.isArray(y));
const fechaValida = x => /^\d{4}-\d{2}-\d{2}$/.test(x || '') && Number.isFinite(Date.parse(x + 'T12:00:00Z'));
const texto = x => String(x ?? '').replace(/\p{Extended_Pictographic}\uFE0F?\s*/gu, '')
  .replace(/\*\*/g, '').replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 a $2')
  .replace(/\s+[–—-]\s+/g, ': ').replace(/[–—]/g, ',').trim();
const seguro = x => esc(texto(x));
const celda = x => seguro(x == null || x === '' || /^[–—-]$/.test(String(x).trim()) ? 'sin dato' : x);
const parrafo = x => texto(x) ? `<p class="pequeno tablero-texto">${seguro(x).replace(/\n/g, '<br>')}</p>` : '';
const fecha = iso => fechaValida(iso)
  ? new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'sin fecha';
const sumar = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const lunes = iso => sumar(iso, -((new Date(iso + 'T12:00:00Z').getUTCDay() + 6) % 7));

const CAMPOS_IMPORTADOS = {
  duracion_min: 'Duración de cada entrenamiento', dias_no_puedo_franjas: 'Horarios disponibles', favoritos: 'Ejercicios favoritos',
  tiempo_entrenando: 'Tiempo que llevas entrenando', constancia: 'Constancia', mayor_18: 'Edad', consentimiento_salud: 'Permiso para usar datos de salud',
  'lugares.equipamiento': 'Equipo del gimnasio', 'historial.tipo_serie': 'Tipos de las series históricas',
  'historial.rir': 'Esfuerzo de las series históricas', 'historial.catalogo': 'Ejercicios del historial', 'plan.revision': 'Revisión del plan',
};
export const nombreCampoImportacion = campo => CAMPOS_IMPORTADOS[campo] || campo || 'Dato';

/** Se puede consultar después de importar, incluso desde el selector permanente del perfil. */
export function revisionImportacionHtml(estado) {
  const revision = estado.importacionTablero;
  if (!revision) return '';
  const pendientes = objetos(revision.pendientes);
  const errores = objetos(revision.revisionPlan?.errores);
  const advertencias = objetos(revision.revisionPlan?.advertencias);
  const mensajes = (xs, titulo) => xs.length ? `<details class="extra"><summary>${titulo} (${xs.length})</summary><ul class="lista-simple pequeno">${xs.map(x => `<li>${seguro(x.mensaje || x.codigo || 'Dato por revisar')}</li>`).join('')}</ul></details>` : '';
  return `<details class="tablero-revision"><summary>Datos pendientes y revisión del perfil (${pendientes.length})</summary>
    <p class="pequeno">La copia original se conserva. Confirma tu perfil y el equipo disponible antes de generar un bloque nuevo. Los avisos comparan el programa con la información del perfil; un dato que falta no demuestra una limitación real.</p>
    ${revision.calidadHistorial ? `<p class="pequeno">Origen del historial: ${seguro(({ tipos_desde_hevy: 'respaldo de Hevy con sus tipos de serie', tipo_de_serie_no_disponible: 'tablero sin los tipos originales de serie' })[revision.calidadHistorial] || revision.calidadHistorial)}.</p>` : ''}
    ${pendientes.length ? `<ul class="lista-simple pequeno">${pendientes.map(x => `<li><strong>${seguro(nombreCampoImportacion(x.campo))}</strong>${x.motivo ? `: ${seguro(x.motivo)}` : ''}</li>`).join('')}</ul>` : '<p class="pequeno suave">El archivo no indica datos pendientes. Puedes revisar tu perfil antes de preparar el próximo bloque.</p>'}
    ${mensajes(errores, 'Puntos que necesitan revisión')}${mensajes(advertencias, 'Advertencias del programa')}
    </details>`;
}

function musculosHtml(xs) {
  xs = objetos(xs);
  if (!xs.length) return '';
  const estadoOriginal = { critical: 'déficit agudo', warning: 'déficit leve o crónico', good: 'en banda' };
  return `<details class="tarjeta tablero-musculos"><summary>Series por músculo del tablero (${xs.length})</summary>
    <p class="pequeno suave">Son los cálculos que traía la copia, con su ventana reciente y su promedio histórico. Para ver lo que cambia con tus registros nuevos, abre Progreso.</p>
    <div class="tabla-tablero"><table class="tablero-consulta"><caption class="pequeno">Series por semana en la copia original</caption>
      <thead><tr><th scope="col">Músculo</th><th scope="col">Reciente</th><th scope="col">Histórico</th><th scope="col">Banda original</th></tr></thead>
      <tbody>${xs.map(m => `<tr><th scope="row">${seguro(m.name)}</th><td>${celda(m.recent)}</td><td>${celda(m.hist)}</td><td>${celda(m.lo)} a ${celda(m.hi)}</td></tr>`).join('')}</tbody></table></div>
    ${xs.map(m => `<details class="extra"><summary>${seguro(m.name)}: detalle original</summary>
      <p class="pequeno">Estado original: ${seguro(estadoOriginal[m.tier] || m.tier || 'sin dato')}. ${m.trend != null ? `Cambio reciente registrado: ${celda(m.trend)} series por semana.` : ''}</p>
      ${parrafo(m.note)}${m.ex ? `<p class="pequeno">Ejercicios indicados: ${seguro(m.ex)}.</p>` : ''}</details>`).join('')}</details>`;
}

function graficoOriginal(puntos, rango, nombre) {
  const numericos = puntos.filter(p => typeof p.w === 'number' && Number.isFinite(p.w));
  if (!numericos.length) return '';
  const valores = numericos.map(p => p.w).concat(rango ? [rango.lo, rango.hi] : []);
  const bajo = Math.max(0, Math.min(...valores) - 5), alto = Math.max(...valores) + 5;
  const amplitud = Math.max(1, alto - bajo);
  const finX = rango ? 220 : 280;
  const x = i => 36 + (finX - 36) * i / Math.max(1, numericos.length - 1);
  const y = v => 120 - (v - bajo) / amplitud * 100;
  const linea = numericos.map((p, i) => `${x(i).toFixed(1)},${y(p.w).toFixed(1)}`).join(' ');
  return `<svg class="tablero-grafico" viewBox="0 0 300 150" role="img" aria-label="${esc('Historial original de ' + texto(nombre))}">
    <title>${seguro(nombre)}, pesos del tablero original</title><desc>Los puntos muestran el peso en kilos de cada sesión de la copia.${rango ? ' La banda del costado corresponde a su proyección original, sin actualizar.' : ''}</desc>
    <line x1="36" y1="120" x2="282" y2="120" stroke="var(--ink-muted)" stroke-width="1"/>
    <text x="3" y="20" fill="var(--ink-muted)" font-size="10">${esc(String(Math.round(alto)))} kg</text><text x="3" y="120" fill="var(--ink-muted)" font-size="10">${esc(String(Math.round(bajo)))} kg</text>
    <polyline points="${linea}" fill="none" stroke="var(--accent)" stroke-width="2"/>
    ${numericos.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.w).toFixed(1)}" r="3" fill="var(--accent)"><title>${seguro(p.d)}: ${celda(p.w)} kg</title></circle>`).join('')}
    <text x="36" y="143" text-anchor="start" fill="var(--ink-muted)" font-size="10">${seguro(numericos[0].d)}</text><text x="${finX}" y="143" text-anchor="end" fill="var(--ink-muted)" font-size="10">${seguro(numericos.at(-1).d)}</text>
    ${rango ? `<rect x="230" y="${y(rango.hi).toFixed(1)}" width="52" height="${Math.max(2, y(rango.lo) - y(rango.hi)).toFixed(1)}" fill="var(--accent)" fill-opacity="0.16" stroke="var(--accent)" stroke-dasharray="3 3"><title>Rango original a 18 semanas: ${celda(rango.lo)} a ${celda(rango.hi)} kg</title></rect>` : ''}</svg>`;
}

function graficosHtml(xs) {
  xs = objetos(xs);
  if (!xs.length) return '';
  return `<details class="tarjeta tablero-proyecciones"><summary>Historial y proyecciones del tablero (${xs.length})</summary>
    <p class="pequeno suave">Conserva las observaciones, explicaciones y rangos de la copia original. Estos rangos no se recalculan ni prometen un resultado futuro.</p>
    ${xs.map(c => {
      const puntos = objetos(c.data);
      const rango = typeof c.lo === 'number' && typeof c.hi === 'number' && Number.isFinite(c.lo) && Number.isFinite(c.hi) && c.lo <= c.hi ? { lo: c.lo, hi: c.hi } : null;
      return `<section class="tablero-proyeccion"><h3>${seguro(c.name)}</h3>${c.pattern ? `<p class="pequeno">Patrón original: ${seguro(c.pattern)}.</p>` : ''}
        <p class="pequeno">${puntos.length} puntos de la copia.${rango ? ` Rango que figuraba a 18 semanas: ${celda(c.lo)} a ${celda(c.hi)} kg.` : ''}</p>
        ${graficoOriginal(puntos, rango, c.name)}${parrafo(c.change)}${parrafo(c.rationale)}
        <details class="extra"><summary>Consultar los pesos originales</summary><div class="tabla-tablero"><table class="tablero-consulta"><caption class="pequeno">Observaciones de la copia</caption>
          <thead><tr><th scope="col">Sesión</th><th scope="col">Peso tope</th></tr></thead><tbody>${puntos.map(p => `<tr><th scope="row">${seguro(p.d)}</th><td>${celda(p.w)} kg</td></tr>`).join('')}</tbody></table></div></details></section>`;
    }).join('')}</details>`;
}

function pasos(titulo, xs) {
  xs = xs.filter(x => typeof x === 'string' || x && typeof x === 'object');
  if (!xs.length) return '';
  return `<section class="tablero-pasos"><h3>${titulo}</h3><ol class="lista-simple">${xs.map(x => `<li><strong>${seguro(typeof x === 'string' ? x : x.name || x.nombre || 'Paso')}</strong>${typeof x === 'object' ? parrafo(x.how || x.como) : ''}</li>`).join('')}</ol></section>`;
}

function ejercicios(xs) {
  xs = objetos(xs);
  if (!xs.length) return '<p class="pequeno suave">Este día no trae ejercicios de fuerza en la copia original.</p>';
  return xs.map((e, n) => `<section class="tarjeta tablero-ejercicio"><h3>${n + 1}. ${seguro(e.name || e.nombre || 'Ejercicio')}</h3>
    ${e.superset ? '<p class="pequeno">Superserie indicada en el tablero.</p>' : ''}
    ${e.cue ? `<details class="extra" open><summary>Indicaciones originales</summary>${parrafo(e.cue)}</details>` : ''}
    ${objetos(e.sets).length ? `<div class="tabla-tablero"><table class="tablero-series"><caption class="pequeno">Series del tablero original</caption>
      <thead><tr><th scope="col">Serie</th><th scope="col">Carga</th><th scope="col">Reps</th><th scope="col">RIR</th><th scope="col">Descanso</th></tr></thead>
      <tbody>${objetos(e.sets).map((s, i) => `<tr${/^(aprox|calent)/i.test(String(s.serie)) ? ' class="tablero-aproximacion"' : ''}>
        <th scope="row">${celda(s.serie ?? i + 1)}</th><td>${celda(s.carga)}</td><td>${celda(s.reps)}</td><td>${celda(s.rir)}</td><td>${celda(s.descanso)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="pequeno suave">Este ejercicio no trae series detalladas en la copia.</p>'}
    ${e.notes ? `<h4>Notas originales</h4>${parrafo(e.notes)}` : ''}</section>`).join('');
}

function cicloHtml(ciclo) {
  if (!ciclo || typeof ciclo !== 'object') return '';
  const bloques = objetos(ciclo.mesos || (ciclo.meso ? [ciclo.meso] : []));
  return `<details class="tarjeta tablero-ciclo"><summary>Bloques y ciclo de la copia original</summary>
    <p class="pequeno suave">Estas indicaciones son las que traía el tablero al importarlo.</p>
    ${parrafo(ciclo.badge)}${parrafo(ciclo.detail)}
    ${ciclo.fur ? `<p class="pequeno">Último inicio registrado: ${esc(fecha(ciclo.fur))}.</p>` : ''}
    ${ciclo.largo != null ? `<p class="pequeno">Duración registrada del ciclo: ${seguro(ciclo.largo)} días.</p>` : ''}
    ${ciclo.regla != null ? `<p class="pequeno">Días registrados de regla: ${seguro(ciclo.regla)}.</p>` : ''}
    ${bloques.map((m, i) => `<section class="tablero-bloque"><h3>Bloque ${i + 1}${m.inicio ? ` desde el ${esc(fecha(m.inicio))}` : ''}</h3>
      <p class="pequeno">${m.total != null ? `${seguro(m.total)} semanas` : 'Duración sin dato'}${m.deload != null ? ` · descarga en la semana ${seguro(m.deload)}` : ''}.</p>
      ${parrafo(m.nota)}${parrafo(m.detail)}</section>`).join('')}</details>`;
}

export function vistaTableroOriginal(ir) {
  const el = document.getElementById('app');
  const origen = E.tableroOrigen;
  const datos = origen?.datos;
  if (!datos || typeof datos !== 'object') {
    el.innerHTML = '<h1>Tablero original</h1><p>Este perfil no tiene una copia del tablero original cargada.</p><button type="button" class="boton" id="volver-tablero">Volver a Más</button>';
    document.getElementById('volver-tablero').onclick = () => ir('mas');
    return;
  }
  const dias = objetos(datos.WEEKDAYS).filter(d => fechaValida(d.date)).slice().sort((a, b) => a.date.localeCompare(b.date));
  const semanas = [...new Set(dias.map(d => lunes(d.date)))];
  const copia = `${origen.revision || ''}|${origen.perfil || ''}`;
  if (copiaElegida !== copia || !dias.some(d => d.date === diaElegido)) {
    copiaElegida = copia;
    diaElegido = dias.find(d => d.date === hoy())?.date || dias.find(d => d.date >= hoy())?.date || dias.at(-1)?.date || null;
    semanaElegida = diaElegido ? lunes(diaElegido) : null;
  }
  if (!semanas.includes(semanaElegida)) semanaElegida = semanas[0];
  const semana = dias.filter(d => lunes(d.date) === semanaElegida);
  if (!semana.some(d => d.date === diaElegido)) diaElegido = semana[0]?.date || null;
  const dia = semana.find(d => d.date === diaElegido);
  const nombre = E.respuestas?.apodo || datos.displayName || 'Perfil local';
  el.innerHTML = `<div id="vista-tablero-original"><span class="sobretitulo">${seguro(nombre)}</span><h1>Tu tablero original</h1>
    <p class="pequeno suave">Copia para consultar${origen.revision ? `, revisión ${seguro(origen.revision)}` : ''}. Conserva las fechas, las series y las indicaciones que venían en tu archivo. Para registrar o ajustar tu entrenamiento, usa las pantallas de Entreno.</p>
    <div class="fila-botones tablero-acciones"><button type="button" class="boton primario" data-tablero-ir="hoy">Entrenar hoy</button><button type="button" class="boton" data-tablero-ir="progreso">Ver progreso</button><button type="button" class="boton" data-tablero-ir="semana">Ver semana</button></div>
    ${revisionImportacionHtml(E)}
    ${datos.fuente ? `<details class="extra"><summary>Origen de la copia</summary>${parrafo(datos.fuente)}</details>` : ''}
    ${cicloHtml(datos.cycle)}
    ${datos.note || datos.weekNote || datos.weekTodo ? `<details class="tarjeta" open><summary>Notas del tablero</summary>${parrafo(datos.note)}${parrafo(datos.weekNote)}${parrafo(datos.weekTodo)}</details>` : ''}
    ${musculosHtml(datos.MUSCLES)}${graficosHtml(datos.CHARTS)}
    ${semanas.length ? `<section class="tarjeta tablero-calendario"><h2>Calendario original</h2>
      <label class="pequeno" for="semana-tablero-original">Semana <select id="semana-tablero-original">${semanas.map((f, i) => `<option value="${esc(f)}"${f === semanaElegida ? ' selected' : ''}>Semana ${i + 1}: ${esc(fecha(f))} al ${esc(fecha(sumar(f, 6)))}</option>`).join('')}</select></label>
      <div class="tablero-dias" role="group" aria-label="Elegir día del tablero">${semana.map(d => `<button type="button" class="boton" data-tablero-dia="${esc(d.date)}" aria-pressed="${d.date === diaElegido}"><span>${seguro(d.day || new Date(d.date + 'T12:00:00Z').toLocaleDateString('es-CL', { weekday: 'short', timeZone: 'UTC' }))}</span><span class="pequeno">${esc(fecha(d.date))}</span></button>`).join('')}</div></section>` : '<p class="aviso ojo">La copia no trae días con fecha válida.</p>'}
    ${dia ? `<article class="tablero-sesion"><span class="sobretitulo">${esc(fecha(dia.date))}</span><h2>${seguro(dia.focus || 'Día del tablero')}</h2>${dia.tag ? `<p class="pequeno">${seguro(dia.tag)}</p>` : ''}
      ${dia.rationale ? `<details class="extra" open><summary>Por qué se indicó este día</summary>${parrafo(dia.rationale)}</details>` : ''}
      ${pasos('Calentamiento original', lista(dia.warmup))}${ejercicios(lista(dia.exercises))}${pasos('Estiramiento original', lista(dia.stretch))}
      ${dia.cardio ? `<section class="tarjeta"><h3>Cardio original</h3>${parrafo(dia.cardio)}</section>` : ''}</article>` : ''}</div>`;
  el.querySelectorAll('[data-tablero-ir]').forEach(b => { b.onclick = () => ir(b.dataset.tableroIr); });
  const selector = document.getElementById('semana-tablero-original');
  if (selector) selector.onchange = () => { semanaElegida = selector.value; diaElegido = dias.find(d => lunes(d.date) === semanaElegida)?.date; vistaTableroOriginal(ir); };
  el.querySelectorAll('[data-tablero-dia]').forEach(b => { b.onclick = () => { diaElegido = b.dataset.tableroDia; vistaTableroOriginal(ir); }; });
}
