import { E, esc, $, mostrarMensaje } from './comun.js';
import { propuestaChatHtml, confirmarCambioChat } from './propuesta-chat.js';
import { CONFIG } from './config.js';
import * as nube from './nube.js';
const publico = CONFIG.funcionesUrl && new URL(CONFIG.funcionesUrl).protocol === 'https:';
export function conexionIAHtml() {
  return `<h3>Conectar ChatGPT o Claude</h3><p class="pequeno">ChatGPT y Claude pueden consultar tus entrenamientos y preparar cambios con las mismas herramientas del chat de Entreno. Tú confirmas los cambios en Entreno.</p>
    ${!nube.hay() ? '<p class="aviso ojo">Esta beta todavía no tiene servidor de cuentas. La conexión directa requiere activarlo.</p>' : !nube.conectado() ? '<p class="aviso ojo">Primero entra a tu cuenta en Más, Cuenta.</p>' : `<p class="pequeno suave">${publico ? 'Agrega una conexión MCP en ChatGPT o Claude usando esta dirección:' : 'El conector corre en este Mac. Para usarlo desde ChatGPT falta un servidor accesible por internet o un túnel privado configurado.'}</p>${publico ? `<p class="correo-cuenta">${esc(CONFIG.funcionesUrl + '/mcp')}</p><a class="boton" href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer">Abrir conexiones de ChatGPT</a>` : ''}<div class="fila-botones"><button class="boton" id="revisar-conexiones">Revisar conexiones y propuestas</button></div><div id="conexiones-ia-estado" role="status"></div>`}
    <button class="boton" id="abrir-coach-conexion">Conversar en Entreno</button>
    <p class="pequeno suave">Podís revocar cada conexión. Los permisos y cambios siempre se confirman en Entreno.</p>`;
}
export function enlazarConexionIA(refrescar, ir) {
  $('abrir-coach-conexion')?.addEventListener('click', () => ir?.('coach'));
  $('revisar-conexiones')?.addEventListener('click', async ev => {
    const boton = ev.currentTarget, uid = nube.usuarioId(), estado = E;
    const out = $('conexiones-ia-estado'); boton.disabled = true;
    out.textContent = 'Revisando…';
    try {
      const [g, p] = await Promise.all([nube.conexionesIA(), nube.propuestasIA()]);
      if (E !== estado || uid !== nube.usuarioId() || !out.isConnected) return;
      const grants = g.items || g.grants || (Array.isArray(g) ? g : []);
      out.innerHTML = `${grants.length ? `<p class="pequeno">Una conexión puede consultar tu plan, historial, preferencias y suplementos, y preparar cambios de entrenamiento, suplementos o bienestar. Las lesiones y el bienestar requieren además el permiso de salud. Los datos consultados pasan a esa aplicación. Tú confirmas cada cambio en Entreno.</p>${grants.map(x => `<section class="tarjeta"><p>${esc(x.client?.name || x.client_name || 'Aplicación conectada')}</p>${x.version_permiso !== 2 || !x.activa ? `<label class="casilla pequeno"><input type="checkbox" data-permiso-ia="${esc(x.client?.id || x.client_id)}"> Autorizo estas lecturas y propuestas para esta conexión.</label><button class="boton" data-actualizar-ia="${esc(x.client?.id || x.client_id)}" disabled>Actualizar permisos</button>` : '<p class="pequeno suave">Permisos actualizados.</p>'}<button class="boton" data-revocar-ia="${esc(x.client?.id || x.client_id)}">Revocar acceso</button></section>`).join('')}` : '<p>No tienes conexiones autorizadas.</p>'}
        ${(p.propuestas || []).map(x => `<section class="tarjeta"><h3>Propuesta por confirmar</h3>${propuestaChatHtml(x)}<div class="fila-botones"><button class="boton primario" data-confirmar-ia="${esc(x.id)}">Aceptar estos cambios</button><button class="boton" data-descartar-ia="${esc(x.id)}">Descartar</button></div></section>`).join('') || '<p>No hay propuestas pendientes.</p>'}`;
      out.querySelectorAll('[data-revocar-ia]').forEach(b => b.onclick = () => ejecutar(b, () => nube.revocarConexionIA(b.dataset.revocarIa), 'Acceso revocado.'));
      out.querySelectorAll('[data-permiso-ia]').forEach(c => c.onchange = () => {
        const b = [...out.querySelectorAll('[data-actualizar-ia]')].find(x => x.dataset.actualizarIa === c.dataset.permisoIa);
        if (b) b.disabled = !c.checked;
      });
      out.querySelectorAll('[data-actualizar-ia]').forEach(b => b.onclick = () => ejecutar(b, () => nube.autorizarConexionIA(b.dataset.actualizarIa), 'Permisos actualizados para esta conexión.'));
      out.querySelectorAll('[data-descartar-ia]').forEach(b => b.onclick = () => ejecutar(b, () => nube.descartarPropuestaIA(b.dataset.descartarIa), 'Propuesta descartada.'));
      out.querySelectorAll('[data-confirmar-ia]').forEach(b => b.onclick = () => ejecutar(b, () => confirmarCambioChat(b.dataset.confirmarIa), 'Propuesta confirmada.'));
      async function ejecutar(b, accion, texto) {
        b.disabled = true;
        try { const resultado = await accion(); if (resultado === false) return; if (E === estado && uid === nube.usuarioId()) { E.mensaje = E.chatPorTraer ? 'Los cambios se guardaron en tu cuenta. Sincroniza cuando tengas señal para traerlos a este teléfono.' : texto; mostrarMensaje(); boton.click(); } }
        catch (e) { if (out.isConnected) { const aviso = document.createElement('p'); aviso.setAttribute('role', 'alert'); aviso.textContent = e.message; out.prepend(aviso); } }
        finally { b.disabled = false; }
      }
    } catch { out.textContent = 'No pude consultar las conexiones. Revisa el servidor o reintenta con señal.'; }
    finally { boton.disabled = false; }
  });
  // Las propuestas aparecen al abrir Más, sin trasladar mensajes entre aplicaciones.
  $('revisar-conexiones')?.click();
}
