import { E, ctxNucleo, cambiarPlan, avisar, presc, esc, hoy, indice } from './comun.js';
import { editarSesion, siguientes } from '../nucleo/editar-sesion.js';
import { sesionDe } from '../nucleo/agenda.js';
import { unir } from '../nucleo/superseries.js';
import { abrirHoja } from './hoja.js';
import { icono } from './iconos.js';
import * as nube from './nube.js';

const contexto = () => ({ ...ctxNucleo(), registro: E.registro, sesiones: E.sesiones });
const sinGuiones = t => t.replace(/[–—]/g, ' a ');
/** Cuántas sesiones vienen con la misma plantilla que hoy: con alguna, se puede elegir "desde hoy en adelante". */
const avisosVolumen = r => [...new Set((r.advertencias || []).filter(a => a.codigo === 'volumen_alto').map(a => sinGuiones(a.mensaje)))].join(' ');
const cuantasSiguen = () => (E.plan ? siguientes(E.plan, sesionDe(E.plan, hoy())).length : 0);

/** Agregar o quitar un ejercicio: muestra cómo queda hoy y, si la sesión se repite, pregunta si es solo hoy o desde
 *  hoy en adelante. Elegir es la confirmación. */
export function proponerEdicion(accion, { volver, alCambiar }) {
  const estado = E, usuario = nube.usuarioId();
  const r = editarSesion(accion, contexto());
  if (r.error) { avisar(sinGuiones(r.error)); return; }
  const agregar = accion.tipo === 'agregar';
  const n = cuantasSiguen();
  const adelante = n ? editarSesion({ ...accion, alcance: 'adelante' }, contexto()) : null;
  const opciones = [
    { valor: 'hoy', icono: icono(agregar ? 'visto' : 'cerrar'), nombre: n ? 'Solo hoy' : agregar ? 'Confirmar y agregar' : 'Confirmar y quitar', peligro: !agregar },
    ...(adelante && !adelante.error ? [{ valor: 'adelante', icono: icono(agregar ? 'visto' : 'cerrar'), nombre: `Desde hoy en adelante (${n === 1 ? 'y la próxima sesión igual' : `y las ${n} sesiones iguales que vienen`})`, peligro: !agregar }] : []),
    { valor: 'no', icono: icono('flecha'), nombre: 'Dejar como está' },
  ];
  abrirHoja({ titulo: agregar ? 'Agregar a la sesión de hoy' : 'Quitar de la sesión de hoy', volver,
    nota: `${r.ejercicio.nombre || 'Ejercicio'}${agregar ? `: ${presc(r.ejercicio)}` : ''}. ${r.cantidad ? `Hoy quedaría con ${r.cantidad} ${r.cantidad === 1 ? 'ejercicio' : 'ejercicios'}, unos ${r.minutos} minutos.` : 'Hoy quedaría sin ejercicios.'}${r.conservar?.length ? ` ${r.conservar.length === 1 ? 'Se conserva la serie ya hecha' : `Se conservan las ${r.conservar.length} series ya hechas`} al guardar la sesión.` : ''}${avisosVolumen(r) ? ` Aviso: ${avisosVolumen(r)} Puedes agregarlo igual.` : ''}${adelante?.error ? ` Desde hoy en adelante no se puede: ${sinGuiones(adelante.error)}` : n ? '' : ' Las otras sesiones se mantienen.'}`,
    opciones,
    alElegir: async v => {
      if (v === 'no') return;
      if (E !== estado || nube.usuarioId() !== usuario) return avisar('La cuenta cambió. Vuelve a revisar el cambio.');
      // Se vuelve a calcular: otra pantalla puede haber cambiado el plan o marcado series mientras estaba abierta.
      const final = { ...accion, alcance: v };
      const actual = editarSesion(final, contexto());
      if (actual.error) return avisar(sinGuiones(actual.error));
      const esperado = v === 'adelante' ? adelante : r;
      if (JSON.stringify(actual.plan) !== JSON.stringify(esperado.plan)) return proponerEdicion(accion, { volver, alCambiar });
      if (!agregar && actual.conservar?.length) {
        const f = contexto().hoy;
        ((E.retirados ||= {})[f] ||= {})[accion.ejercicio] = { ejercicio: structuredClone(actual.ejercicio), series: actual.conservar };
      }
      const donde = v === 'adelante' ? 'de hoy en adelante' : 'de hoy';
      const aviso = await cambiarPlan(actual.plan, `Se ${agregar ? 'agregó' : 'quitó'} ${r.ejercicio.nombre || 'el ejercicio'} ${agregar ? 'a' : 'de'} la sesión ${donde}.`, nube);
      if (aviso) avisar(aviso);
      alCambiar?.();
    },
  });
}

/** Ordenar los ejercicios de hoy, como en Hevy: se suben o bajan en la lista y se guarda solo hoy o desde hoy en
 *  adelante. Si una superserie queda separada, se hace como series normales. */
export function ordenarSesion({ volver, alCambiar }) {
  const dia = E.plan && sesionDe(E.plan, hoy());
  if (!dia || dia.ejercicios.length < 2) return avisar('Hoy hay menos de dos ejercicios para ordenar.');
  const estado = E;
  let orden = dia.ejercicios.map((e, i) => ({ id: e.ejercicio_id || `i${i}`, nombre: e.nombre || 'Ejercicio', ss: e.superserie }));
  const n = cuantasSiguen();
  // El asa no arrastra la hoja (data-sin-arrastre, app/hoja.js): antes, arrastrarla hacia abajo movía la hoja entera con
  // el dedo, así que nunca cambiaba el orden, y la hoja quedaba corrida al soltar.
  const lista = () => orden.map((x, i) => `<li data-i="${i}"><span class="asa-orden" data-sin-arrastre aria-hidden="true">${icono('ajustes', 'icono')}</span><span class="num suave">${i + 1}</span><span class="nombre-orden">${esc(x.nombre)}${x.ss ? ` <span class="chip">${esc(x.ss)}</span>` : ''}</span>
    <button type="button" class="boton-icono" data-subir="${i}" aria-label="Subir ${esc(x.nombre)}"${i === 0 ? ' disabled' : ''}>${icono('flecha', 'icono flecha-arriba')}</button>
    <button type="button" class="boton-icono" data-bajar="${i}" aria-label="Bajar ${esc(x.nombre)}"${i === orden.length - 1 ? ' disabled' : ''}>${icono('flecha', 'icono flecha-abajo')}</button></li>`).join('');
  abrirHoja({
    titulo: 'Ordenar los ejercicios de hoy', volver,
    nota: 'Sube o baja cada ejercicio. Si separas una superserie, se hace como series normales.',
    contenido: `<ol class="lista-orden" id="lista-orden">${lista()}</ol>`,
    opciones: [{ valor: 'hoy', icono: icono('visto'), clase: 'confirmar', nombre: n ? 'Guardar solo hoy' : 'Guardar el orden' },
      ...(n ? [{ valor: 'adelante', icono: icono('visto'), clase: 'confirmar', nombre: `Guardar desde hoy en adelante (${n === 1 ? 'y la próxima sesión igual' : `y las ${n} sesiones iguales que vienen`})` }] : []),
      { valor: 'no', icono: icono('flecha'), nombre: 'Dejar como está' }],
    alElegir: async v => {
      if (v === 'no' || E !== estado) return;
      const r = editarSesion({ tipo: 'ordenar', orden: orden.map(x => x.id), alcance: v }, contexto());
      if (r.error) return avisar(sinGuiones(r.error));
      const aviso = await cambiarPlan(r.plan, `Orden guardado${v === 'adelante' ? ' de hoy en adelante' : ' para hoy'}.`, nube);
      if (aviso) avisar(aviso);
      alCambiar?.();
    },
  });
  const ol = document.getElementById('lista-orden');
  ol.addEventListener('click', ev => {
    const b = ev.target.closest('[data-subir],[data-bajar]');
    if (!b) return;
    const i = Number(b.dataset.subir ?? b.dataset.bajar), j = b.dataset.subir != null ? i - 1 : i + 1;
    if (j < 0 || j >= orden.length) return;
    [orden[i], orden[j]] = [orden[j], orden[i]];
    ol.innerHTML = lista();
    ol.querySelector(`[data-${b.dataset.subir != null ? 'subir' : 'bajar'}="${j}"]`)?.focus();
  });
  // Arrastrar desde el asa, como Hevy: la fila sigue al dedo y al soltar queda el orden nuevo.
  arrastrable(ol, indices => { orden = indices.map(i => orden[i]); ol.innerHTML = lista(); });
}

/** Ordenar arrastrando las filas de una lista por su asa (.asa-orden). alSoltar recibe los índices en el orden nuevo. */
export function arrastrable(ol, alSoltar) {
  let fila = null;
  ol.addEventListener('pointerdown', ev => {
    const asa = ev.target.closest('.asa-orden');
    if (!asa) return;
    fila = asa.closest('li');
    fila.classList.add('arrastrando');
    asa.setPointerCapture?.(ev.pointerId);
    ev.preventDefault();
  });
  ol.addEventListener('pointermove', ev => {
    if (!fila) return;
    const otra = [...ol.children].find(li => li !== fila && (() => { const r = li.getBoundingClientRect(); return ev.clientY > r.top && ev.clientY < r.bottom; })());
    if (!otra) return;
    const r = otra.getBoundingClientRect();
    ol.insertBefore(fila, ev.clientY < r.top + r.height / 2 ? otra : otra.nextSibling);
  });
  const soltar = () => {
    if (!fila) return;
    fila.classList.remove('arrastrando'); fila = null;
    alSoltar([...ol.children].map(li => Number(li.dataset.i)));
  };
  ol.addEventListener('pointerup', soltar);
  ol.addEventListener('pointercancel', soltar);
}

/** Agregar varios ejercicios a hoy de una vez, como "Agregar 3 ejercicios" de Hevy (solo hoy). Con superserie, quedan
 *  unidos en una. Elegirlos y tocar el botón es la confirmación; el plan de las otras fechas no cambia. */
export async function agregarVarios(ids, { superserie = false, alCambiar, despues = null } = {}) {
  const ctx = contexto();
  let plan = null;
  const nombres = [];
  let advertencias = [];
  for (const id of ids) {
    const r = editarSesion({ tipo: 'agregar', ejercicio: id, despues, alcance: 'hoy' }, plan ? { ...ctx, plan } : ctx);
    if (r.error) { avisar(`No agregué ${indice.porId.get(id)?.nombre || 'un ejercicio'}: ${sinGuiones(r.error).replace(/^\d{4}-\d{2}-\d{2}: /, '')}`); continue; }
    plan = r.plan; despues = id; nombres.push(r.ejercicio.nombre);
    advertencias = r.advertencias || []; // las de la última suma ya cuentan todo lo agregado
  }
  if (!plan) return null;
  const agregados = ids.filter(id => sesionDe(plan, ctx.hoy)?.ejercicios.some(e => e.ejercicio_id === id));
  if (superserie && agregados.length > 1) {
    const d = sesionDe(plan, ctx.hoy);
    let ejs = d.ejercicios;
    for (const id of agregados.slice(1)) ejs = unir(ejs, ejs.findIndex(e => e.ejercicio_id === agregados[0]), ejs.findIndex(e => e.ejercicio_id === id));
    d.ejercicios = ejs.map((e, i) => ({ ...e, orden: i }));
  }
  const lista = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
  const aviso = await cambiarPlan(plan, `Agregado${nombres.length === 1 ? '' : 's'} a hoy${superserie && agregados.length > 1 ? ', en superserie' : ''}: ${lista}.`, nube);
  const volumen = avisosVolumen({ advertencias });
  if (aviso || volumen) avisar([aviso, volumen && `Agregado. Aviso de volumen: ${volumen}`].filter(Boolean).join(' '));
  alCambiar?.(agregados);
  return agregados;
}
