// La pareja se lee de un archivo privado elegido en este teléfono. Aquí no hay perfiles ni datos personales.
import { CONFIG } from './config.js';
import { E, guardar, indice, esc, hoy } from './comun.js';
import { detenerDescanso } from './descanso.js';
import { revisionImportacionHtml, nombreCampoImportacion } from './tablero-original.js';
import {
  clavePerfilPrueba, leerPerfilesPrueba, perfilPruebaActivo, validarPaquetePerfilesPrueba,
  instalarPerfilesPrueba, seleccionarPerfilPrueba,
} from '../nucleo/perfiles-prueba.js';

let paqueteRevisado = null;
let lectura = 0;
const idsCatalogo = () => new Set([...indice.porId.values()].filter(e => !e.propio).map(e => e.id));
const fecha = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '')
  ? new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'sin fecha';
const texto = x => String(x ?? '').replace(/\p{Extended_Pictographic}\uFE0F?\s*/gu, '')
  .replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 a $2').replace(/\s+[–—-]\s+/g, ': ').replace(/[–—]/g, ',').trim();
const seguro = x => esc(texto(x));

function avisar(textoAviso, error = false) {
  const el = document.getElementById('estado-perfiles-prueba');
  if (!el) return;
  el.textContent = texto(textoAviso);
  el.className = error ? 'aviso alerta pequeno' : 'pequeno suave';
  el.setAttribute('role', error ? 'alert' : 'status');
}

function guardarAntesDeCambiar() {
  detenerDescanso();
  if (guardar()) return true;
  avisar('No pude guardar este perfil. Respalda sus cambios antes de elegir otro.', true);
  return false;
}

function elegir(id) {
  try {
    if (!guardarAntesDeCambiar()) return;
    seleccionarPerfilPrueba(localStorage, id);
    location.reload();
  } catch (e) { avisar(e.message || 'No pude cambiar de perfil. Tus datos se conservan.', true); }
}

function respaldarPareja() {
  try {
    if (!guardarAntesDeCambiar()) return;
    const registro = leerPerfilesPrueba(localStorage);
    const creado = new Date().toISOString();
    const paquete = { app: 'entreno-perfiles-prueba', version: 1, creado, perfiles: registro.perfiles.map(p => ({
      ...p, respaldo: { app: 'entreno', version: 2, creado,
        estado: JSON.parse(localStorage.getItem(clavePerfilPrueba(p.id)) || 'null'), fotos: [] },
    })) };
    validarPaquetePerfilesPrueba(paquete, idsCatalogo());
    const url = URL.createObjectURL(new Blob([JSON.stringify(paquete, null, 2)], { type: 'application/json' }));
    const enlace = document.createElement('a');
    enlace.href = url; enlace.download = `entreno-perfiles-privados-${hoy()}.json`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    avisar('Descargué las dos copias locales sin fotos. El archivo contiene datos privados: guárdalo en un lugar personal.');
  } catch (e) { avisar(e.message || 'No pude preparar el respaldo. Los perfiles siguen guardados.', true); }
}

function vistaPrevia(paquete) {
  return paquete.perfiles.map(p => {
    const estado = p.respaldo.estado;
    const dias = (estado.plan?.dias || []).map(d => d.fecha).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    const sesiones = Array.isArray(estado.sesiones) ? estado.sesiones.length : 0;
    const pendientes = Array.isArray(estado.importacionTablero?.pendientes) ? estado.importacionTablero.pendientes : [];
    const futuros = (estado.plan?.dias || []).filter(d => d.fecha >= hoy() && d.ejercicios?.length).length;
    return `<section class="perfil-prueba-previa"><h3>${seguro(p.nombre)}</h3>
      <p class="pequeno">${sesiones} ${sesiones === 1 ? 'sesión guardada' : 'sesiones guardadas'} · ${futuros} ${futuros === 1 ? 'entrenamiento desde hoy' : 'entrenamientos desde hoy'}.</p>
      <p class="pequeno">${dias.length ? `Calendario del ${esc(fecha(dias[0]))} al ${esc(fecha(dias.at(-1)))}.` : 'Este perfil todavía no tiene calendario.'}</p>
      ${estado.tableroOrigen?.datos ? '<p class="pequeno">Incluye la copia del tablero original para consultarla.</p>' : ''}
      <details class="extra"><summary>${pendientes.length ? `${pendientes.length} ${pendientes.length === 1 ? 'dato pendiente' : 'datos pendientes'}` : 'Datos pendientes'}</summary>
        ${pendientes.length ? `<ul class="lista-simple pequeno">${pendientes.map(x => `<li>${seguro(nombreCampoImportacion(x.campo))}${x.motivo ? `: ${seguro(x.motivo)}` : ''}</li>`).join('')}</ul>` : '<p class="pequeno suave">El archivo no indica datos pendientes. Eso no reemplaza la revisión del perfil.</p>'}</details>
      </section>`;
  }).join('');
}

async function revisarArchivo(ev) {
  const turno = ++lectura;
  paqueteRevisado = null;
  const panel = document.getElementById('previa-perfiles-prueba');
  if (panel) { panel.hidden = true; panel.innerHTML = ''; }
  const archivo = ev.target.files?.[0];
  if (!archivo) return;
  avisar('Estoy revisando los dos perfiles completos.');
  try {
    if (leerPerfilesPrueba(localStorage).perfiles.length) throw new Error('Ya hay dos perfiles guardados. Respáldalos antes de preparar otro teléfono; aquí no los reemplazo.');
    if (archivo.size > 30 * 1024 * 1024) throw new Error('El archivo es demasiado grande. Usa el paquete de dos perfiles sin fotos.');
    const paquete = JSON.parse(await archivo.text());
    if (turno !== lectura || document.getElementById('previa-perfiles-prueba') !== panel) return;
    validarPaquetePerfilesPrueba(paquete, idsCatalogo());
    for (const p of paquete.perfiles) {
      if (localStorage.getItem(clavePerfilPrueba(p.id)) !== null) throw new Error('Uno de los perfiles ya tiene datos guardados. Respáldalos antes de continuar; aquí no los reemplazo.');
    }
    paqueteRevisado = paquete;
    if (!panel) return;
    panel.innerHTML = `${vistaPrevia(paquete)}<p class="pequeno">Revisa estos datos antes de cargar. Cada perfil tendrá su propio plan, historial y registros en este teléfono.</p>
      <button type="button" class="boton primario" id="confirmar-perfiles-prueba">Cargar estos dos perfiles</button>`;
    panel.hidden = false;
    document.getElementById('confirmar-perfiles-prueba').onclick = () => {
      try {
        const revisado = paqueteRevisado;
        if (!revisado) throw new Error('Vuelve a elegir el archivo para revisarlo.');
        validarPaquetePerfilesPrueba(revisado, idsCatalogo());
        if (!guardarAntesDeCambiar()) return;
        instalarPerfilesPrueba(revisado, localStorage, idsCatalogo());
        paqueteRevisado = null;
        // Si la elección falla, la pareja instalada queda accesible y no se intenta reemplazarla.
        pintarPerfilesPrueba();
        seleccionarPerfilPrueba(localStorage, revisado.perfiles[0].id);
        location.reload();
      } catch (e) { avisar(e.message || 'No pude cargar los perfiles. Conserva el archivo privado.', true); }
    };
    avisar('Archivo revisado. Todavía no he cargado sus perfiles.');
  } catch (e) { if (turno === lectura) avisar(e.message || 'No pude leer ese archivo. Tus perfiles actuales se conservan.', true); }
}

/** Rellena el elemento permanente que agrega app.js, independiente de la pantalla actual. */
export function pintarPerfilesPrueba() {
  const el = document.getElementById('perfiles-prueba');
  if (!el) return;
  lectura++;
  paqueteRevisado = null;
  if (!CONFIG.modoPrueba) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  try {
    const registro = leerPerfilesPrueba(localStorage);
    const activo = perfilPruebaActivo(localStorage);
    if (registro.perfiles.length === 2) {
      el.innerHTML = `<div class="perfiles-prueba-selector"><span class="pequeno suave">Perfil en este teléfono</span>
        <div class="perfiles-prueba-botones" role="group" aria-label="Elegir perfil de prueba">${registro.perfiles.map(p => `<button type="button" class="boton" data-perfil-prueba="${esc(p.id)}" aria-pressed="${activo?.id === p.id}">${seguro(p.nombre)}</button>`).join('')}</div>
        <button type="button" class="enlace pequeno" id="salir-perfil-prueba" aria-pressed="${activo === null}">Volver al perfil normal</button>
        <p class="pequeno suave">${activo ? `Estás usando ${seguro(activo.nombre)}. Sus cambios quedan en su propio perfil local.` : 'Estás usando el perfil normal. Los dos perfiles de prueba siguen guardados.'}</p>
        ${activo ? revisionImportacionHtml(E) : ''}
        <details class="extra"><summary>Respaldar los dos perfiles</summary><p class="pequeno">Descarga las dos copias locales. Las fotos y los datos de una cuenta se respaldan desde ese perfil.</p><button type="button" class="boton" id="respaldar-perfiles-prueba">Descargar respaldo privado</button></details>
        <p id="estado-perfiles-prueba" class="pequeno suave" role="status" aria-live="polite"></p></div>`;
      el.querySelectorAll('[data-perfil-prueba]').forEach(b => { b.onclick = () => elegir(b.dataset.perfilPrueba); });
      document.getElementById('salir-perfil-prueba').onclick = () => elegir(null);
      document.getElementById('respaldar-perfiles-prueba').onclick = respaldarPareja;
      return;
    }
    el.innerHTML = `<details class="perfiles-prueba-importar"><summary>Cargar los dos perfiles de prueba</summary>
      <p class="pequeno">Elige el archivo privado que contiene los dos perfiles. Se lee y se guarda en este teléfono; cargarlo no envía sus datos a una cuenta. Los nombres aparecen solo después de elegir el archivo.</p>
      <label class="pequeno">Archivo privado <input type="file" id="importar-perfiles-prueba" accept="application/json,.json"></label>
      <p id="estado-perfiles-prueba" class="pequeno suave" role="status" aria-live="polite"></p>
      <div id="previa-perfiles-prueba" class="perfiles-prueba-previa" hidden></div></details>`;
    document.getElementById('importar-perfiles-prueba').onchange = revisarArchivo;
  } catch (e) {
    el.innerHTML = `<p class="aviso alerta pequeno" role="alert">${seguro(e.message || 'No pude leer los perfiles. Respalda este teléfono antes de continuar.')}</p>`;
  }
}
