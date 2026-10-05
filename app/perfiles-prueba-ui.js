// Perfiles de prueba: un botón por perfil, siempre a la vista en la versión de prueba, que entra directo a ese
// perfil. Los nombres y archivos vienen del índice publicado (app/perfiles/indice.json, nucleo/perfiles-enlace.js);
// aquí no hay perfiles ni datos personales.
import { CONFIG } from './config.js';
import { E, guardar, indice, esc, hoy } from './comun.js';
import { detenerDescanso } from './descanso.js';
import { revisionImportacionHtml, nombreCampoImportacion } from './tablero-original.js';
import {
  clavePerfilPrueba, leerPerfilesPrueba, perfilPruebaActivo, validarPaquetePerfilesPrueba,
  instalarPerfilesPrueba, seleccionarPerfilPrueba, actualizarPerfilPrueba,
} from '../nucleo/perfiles-prueba.js';
import { leerEnlacePerfiles, descifrarPaquete, leerIndicePerfiles } from '../nucleo/perfiles-enlace.js';

// Las claves de los perfiles privados que se abrieron con su enlace en este teléfono (archivo → clave), para que
// su botón entre directo la próxima vez. Quedan donde ya están sus datos.
const CLAVES_ENLACE = 'entreno-perfiles-claves-v1';

let paqueteRevisado = null;
let lectura = 0;
let publicados = null;   // el índice publicado, o null mientras no llega (o sin señal)
let pedidoIndice = null;
let ocupado = false;
const idsCatalogo = () => new Set([...indice.porId.values()].filter(e => !e.propio).map(e => e.id));
const fecha = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || '')
  ? new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'sin fecha';
const texto = x => String(x ?? '').replace(/\p{Extended_Pictographic}️?\s*/gu, '')
  .replace(/(\d)\s*[–—-]\s*(\d)/g, '$1 a $2').replace(/\s+[–—-]\s+/g, ': ').replace(/[–—]/g, ',').trim();
const seguro = x => esc(texto(x));

function avisar(textoAviso, error = false) {
  const el = document.getElementById('estado-perfiles-prueba');
  if (!el) return;
  el.textContent = texto(textoAviso);
  el.className = error ? 'aviso alerta pequeno' : 'pequeno suave';
  el.setAttribute('role', error ? 'alert' : 'status');
}

function clavesRecordadas() {
  try { const x = JSON.parse(localStorage.getItem(CLAVES_ENLACE) || '{}'); return x && typeof x === 'object' && !Array.isArray(x) ? x : {}; }
  catch { return {}; }
}
function recordarClave(archivo, clave) {
  try { localStorage.setItem(CLAVES_ENLACE, JSON.stringify({ ...clavesRecordadas(), [archivo]: clave })); }
  catch { /* sin espacio: el enlace sigue funcionando */ }
}

/** El índice publicado se pide una vez por apertura; al llegar se vuelven a pintar los botones. */
function cargarIndice() {
  if (!CONFIG.modoPrueba) return Promise.resolve(null);
  pedidoIndice ||= fetch(`perfiles/indice.json?v=${Date.now()}`, { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(datos => { publicados = datos ? leerIndicePerfiles(datos) : []; pintarPerfilesPrueba(); return publicados; })
    .catch(() => { pedidoIndice = null; return null; }); // sin señal: quedan los perfiles de este teléfono
  return pedidoIndice;
}

/** Trae el archivo cifrado de un perfil y lo abre; devuelve el paquete ya revisado. */
async function traerPaquete(archivo, clave) {
  const r = await fetch(`perfiles/${archivo}.bin?v=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('No encontré ese perfil en la versión de prueba. Revisa la señal e inténtalo de nuevo.');
  const paquete = JSON.parse(await descifrarPaquete(await r.arrayBuffer(), clave));
  validarPaquetePerfilesPrueba(paquete, idsCatalogo());
  return paquete;
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

/** El botón de un perfil: si ya está en el teléfono entra; si no, lo trae (público, o con la clave de su enlace). */
async function irAPerfil(id) {
  if (ocupado) return;
  try {
    if (leerPerfilesPrueba(localStorage).perfiles.some(p => p.id === id)) return elegir(id);
    const p = (publicados || []).find(x => x.id === id);
    if (!p) return avisar('Ese perfil no está disponible ahora. Revisa la señal e inténtalo de nuevo.', true);
    const clave = p.clave || clavesRecordadas()[p.archivo];
    if (!clave) return avisar(`Los datos de ${p.nombre} son privados. Abre una vez en este teléfono el enlace que te mandaron; después este botón entra directo.`, true);
    ocupado = true;
    avisar(`Abriendo ${p.nombre}…`);
    const paquete = await traerPaquete(p.archivo, clave);
    if (paquete.perfiles.length !== 1 || paquete.perfiles[0].id !== id) throw new Error('Ese archivo no corresponde a este perfil. No cambié tus datos.');
    if (!guardarAntesDeCambiar()) return;
    instalarPerfilesPrueba(paquete, localStorage, idsCatalogo(), { [id]: p.version });
    seleccionarPerfilPrueba(localStorage, id);
    location.reload();
  } catch (e) { avisar(e.message || 'No pude abrir ese perfil. Tus datos se conservan.', true); }
  finally { ocupado = false; }
}

/** Cambia un perfil del teléfono por su versión revisada: conserva su plan y lo que se registró aquí. */
async function usarVersionRevisada(boton) {
  if (ocupado) return;
  const p = (publicados || []).find(x => x.id === boton.dataset.actualizarPerfil);
  if (!p) return;
  const clave = p.clave || clavesRecordadas()[p.archivo];
  if (!clave) return avisar(`Para traer la versión revisada de ${p.nombre}, abre de nuevo en este teléfono su enlace privado.`, true);
  if (!boton.dataset.confirmar) {
    boton.dataset.confirmar = '1';
    boton.textContent = 'Toca de nuevo para usarla';
    return;
  }
  ocupado = true;
  try {
    avisar(`Trayendo la versión revisada de ${p.nombre}…`);
    const paquete = await traerPaquete(p.archivo, clave);
    if (paquete.perfiles.length !== 1 || paquete.perfiles[0].id !== p.id) throw new Error('Ese archivo no corresponde a este perfil. No cambié tus datos.');
    if (!guardarAntesDeCambiar()) return;
    actualizarPerfilPrueba(paquete, localStorage, idsCatalogo(), p.version);
    seleccionarPerfilPrueba(localStorage, p.id);
    location.reload();
  } catch (e) { avisar(e.message || 'No pude traer la versión revisada. Tus datos se conservan.', true); }
  finally { ocupado = false; }
}

function respaldarPerfiles() {
  try {
    if (!guardarAntesDeCambiar()) return;
    const registro = leerPerfilesPrueba(localStorage);
    const creado = new Date().toISOString();
    const paquete = { app: 'entreno-perfiles-prueba', version: 1, creado, perfiles: registro.perfiles.map(({ id, nombre }) => ({
      id, nombre, respaldo: { app: 'entreno', version: 2, creado,
        estado: JSON.parse(localStorage.getItem(clavePerfilPrueba(id)) || 'null'), fotos: [] },
    })) };
    validarPaquetePerfilesPrueba(paquete, idsCatalogo());
    const url = URL.createObjectURL(new Blob([JSON.stringify(paquete, null, 2)], { type: 'application/json' }));
    const enlace = document.createElement('a');
    enlace.href = url; enlace.download = `entreno-perfiles-privados-${hoy()}.json`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    avisar('Descargué las copias locales sin fotos. El archivo contiene datos privados: guárdalo en un lugar personal.');
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
  const archivo = ev.target.files?.[0];
  if (!archivo) return;
  if (archivo.size > 30 * 1024 * 1024) return avisar('El archivo es demasiado grande. Usa un respaldo de los perfiles sin fotos.', true);
  return revisarPaquete(() => archivo.text());
}

/** Enlace privado (#perfiles=…): trae sus perfiles, los deja en el teléfono, recuerda sus claves y entra directo al
 *  primero. El enlace se borra de la barra apenas se lee. Los perfiles que ya estaban no se tocan. */
export async function abrirEnlacePerfiles() {
  let enlace;
  try { enlace = leerEnlacePerfiles(location.hash); } catch (e) { avisar(e.message, true); return; }
  if (!enlace) return;
  history.replaceState(null, '', location.pathname + location.search);
  if (!CONFIG.modoPrueba || ocupado) return;
  document.getElementById('perfiles-prueba')?.scrollIntoView?.({ block: 'start' });
  ocupado = true;
  try {
    avisar(enlace.length === 1 ? 'Abriendo el perfil del enlace…' : 'Abriendo los perfiles del enlace…');
    const paquetes = [];
    for (const { archivo, clave } of enlace) paquetes.push(await traerPaquete(archivo, clave)); // primero se revisan todos
    enlace.forEach(({ archivo, clave }) => recordarClave(archivo, clave));
    const indicePublicado = await cargarIndice() || [];
    if (!guardarAntesDeCambiar()) return;
    paquetes.forEach((paquete, i) => {
      const entrada = indicePublicado.find(p => p.archivo === enlace[i].archivo);
      const versiones = entrada && paquete.perfiles.length === 1 && paquete.perfiles[0].id === entrada.id ? { [entrada.id]: entrada.version } : {};
      const yaEstan = leerPerfilesPrueba(localStorage).perfiles.map(p => p.id);
      const nuevos = paquete.perfiles.filter(p => !yaEstan.includes(p.id));
      if (nuevos.length) instalarPerfilesPrueba({ ...paquete, perfiles: nuevos }, localStorage, idsCatalogo(), versiones);
    });
    seleccionarPerfilPrueba(localStorage, paquetes[0].perfiles[0].id);
    location.reload();
  } catch (e) { avisar(e.message || 'No pude abrir el enlace. Pide el enlace nuevo.', true); }
  finally { ocupado = false; }
}

async function revisarPaquete(leerTexto) {
  const turno = ++lectura;
  paqueteRevisado = null;
  const panel = document.getElementById('previa-perfiles-prueba');
  if (panel) { panel.hidden = true; panel.innerHTML = ''; }
  avisar('Estoy revisando los perfiles completos.');
  try {
    const paquete = JSON.parse(await leerTexto());
    if (turno !== lectura || document.getElementById('previa-perfiles-prueba') !== panel) return;
    validarPaquetePerfilesPrueba(paquete, idsCatalogo());
    const yaEstan = leerPerfilesPrueba(localStorage).perfiles.map(p => p.id);
    for (const p of paquete.perfiles) {
      if (yaEstan.includes(p.id) || localStorage.getItem(clavePerfilPrueba(p.id)) !== null) throw new Error(`${p.nombre} ya está en este teléfono. Aquí no lo reemplazo; respáldalo antes si quieres cargar otra copia.`);
    }
    paqueteRevisado = paquete;
    if (!panel) return;
    panel.innerHTML = `${vistaPrevia(paquete)}<p class="pequeno">Revisa estos datos antes de cargar. Cada perfil tendrá su propio plan, historial y registros en este teléfono.</p>
      <button type="button" class="boton primario" id="confirmar-perfiles-prueba">${paquete.perfiles.length === 1 ? 'Cargar este perfil' : 'Cargar estos perfiles'}</button>`;
    panel.hidden = false;
    document.getElementById('confirmar-perfiles-prueba').onclick = () => {
      try {
        const revisado = paqueteRevisado;
        if (!revisado) throw new Error('Vuelve a elegir el archivo para revisarlo.');
        validarPaquetePerfilesPrueba(revisado, idsCatalogo());
        if (!guardarAntesDeCambiar()) return;
        instalarPerfilesPrueba(revisado, localStorage, idsCatalogo());
        paqueteRevisado = null;
        // Si la elección falla, los perfiles instalados quedan accesibles y no se intenta reemplazarlos.
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
  if (publicados === null) cargarIndice();
  try {
    const registro = leerPerfilesPrueba(localStorage);
    const activo = perfilPruebaActivo(localStorage);
    // Primero los publicados, en su orden; después los que solo están en este teléfono.
    const lista = [
      ...(publicados || []).map(p => ({ id: p.id, nombre: p.nombre, publicado: p, local: registro.perfiles.find(x => x.id === p.id) })),
      ...registro.perfiles.filter(x => !(publicados || []).some(p => p.id === x.id)).map(x => ({ id: x.id, nombre: x.nombre, local: x })),
    ];
    const revisados = lista.filter(x => x.local && x.publicado && x.local.version !== x.publicado.version);
    el.innerHTML = `<div class="perfiles-prueba-selector"><span class="pequeno suave">Perfiles de prueba</span>
      ${lista.length ? `<div class="perfiles-prueba-botones" role="group" aria-label="Entrar a un perfil de prueba">${lista.map(p => `<button type="button" class="boton" data-perfil-prueba="${esc(p.id)}" aria-pressed="${activo?.id === p.id}">${seguro(p.nombre)}</button>`).join('')}</div>`
        : `<p class="pequeno suave">${publicados === null ? 'Buscando los perfiles publicados…' : 'Todavía no hay perfiles publicados.'}</p>`}
      ${activo ? `<button type="button" class="enlace pequeno" id="salir-perfil-prueba">Volver al perfil normal</button>` : ''}
      <p class="pequeno suave">${activo ? `Estás usando ${seguro(activo.nombre)}. Sus cambios quedan en su propio perfil en este teléfono.` : lista.length ? 'Toca un nombre para entrar a ese perfil. Tu perfil normal se conserva.' : ''}</p>
      ${revisados.map(p => `<p class="pequeno">Hay una versión revisada de ${seguro(p.nombre)}: trae su perfil y su historial revisados; su plan y lo que registró en este teléfono se conservan. <button type="button" class="enlace" data-actualizar-perfil="${esc(p.id)}">Usar la versión revisada</button></p>`).join('')}
      <p id="estado-perfiles-prueba" class="pequeno suave" role="status" aria-live="polite"></p>
      ${activo ? revisionImportacionHtml(E) : ''}
      ${registro.perfiles.length ? `<details class="extra"><summary>Respaldar los perfiles</summary><p class="pequeno">Descarga las copias de este teléfono. Las fotos y los datos de una cuenta se respaldan desde ese perfil.</p><button type="button" class="boton" id="respaldar-perfiles-prueba">Descargar respaldo privado</button></details>` : ''}
      <details class="extra perfiles-prueba-importar"><summary>Cargar desde un archivo</summary>
        <p class="pequeno">Elige un respaldo privado de perfiles. Se lee y se guarda en este teléfono; cargarlo no envía sus datos a una cuenta ni reemplaza los perfiles que ya están.</p>
        <label class="pequeno">Archivo privado <input type="file" id="importar-perfiles-prueba" accept="application/json,.json"></label>
        <div id="previa-perfiles-prueba" class="perfiles-prueba-previa" hidden></div></details></div>`;
    el.querySelectorAll('[data-perfil-prueba]').forEach(b => { b.onclick = () => irAPerfil(b.dataset.perfilPrueba); });
    el.querySelectorAll('[data-actualizar-perfil]').forEach(b => { b.onclick = () => usarVersionRevisada(b); });
    const salir = document.getElementById('salir-perfil-prueba'), respaldar = document.getElementById('respaldar-perfiles-prueba');
    if (salir) salir.onclick = () => elegir(null);
    if (respaldar) respaldar.onclick = respaldarPerfiles;
    document.getElementById('importar-perfiles-prueba').onchange = revisarArchivo;
  } catch (e) {
    el.innerHTML = `<p class="aviso alerta pequeno" role="alert">${seguro(e.message || 'No pude leer los perfiles. Respalda este teléfono antes de continuar.')}</p>`;
  }
}
