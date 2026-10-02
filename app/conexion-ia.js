import { E, esc, $, mostrarMensaje } from './comun.js';
import { CONFIG } from './config.js';
import * as nube from './nube.js';
const publico = CONFIG.funcionesUrl && new URL(CONFIG.funcionesUrl).protocol === 'https:';
export function conexionIAHtml() {
  return `<h3>Conectar ChatGPT</h3><p class="pequeno">ChatGPT puede consultar tu plan e historial y enviarte propuestas directamente. Tú confirmas los cambios en Entreno.</p>
    ${!nube.hay() ? '<p class="aviso ojo">Esta beta todavía no tiene servidor de cuentas. La conexión directa requiere activarlo.</p>' : !nube.conectado() ? '<p class="aviso ojo">Primero entra a tu cuenta de Entreno desde arriba.</p>' : `<p class="pequeno suave">${publico ? 'Conecta Entreno en ChatGPT usando esta dirección:' : 'El conector corre en este Mac. Para usarlo desde ChatGPT falta un servidor accesible por internet o un túnel privado configurado.'}</p>${publico ? `<p class="correo-cuenta">${esc(CONFIG.funcionesUrl + '/mcp')}</p><a class="boton" href="https://chatgpt.com/plugins" target="_blank" rel="noopener noreferrer">Abrir conexiones de ChatGPT</a>` : ''}<div class="fila-botones"><button class="boton" id="revisar-conexiones">Revisar conexiones y propuestas</button></div><div id="conexiones-ia-estado" role="status"></div>`}
    <p class="pequeno suave">El coach de Entreno sigue respondiendo con reglas. Conectar ChatGPT permite usarlo desde tus conversaciones allí.</p>`;
}
export function enlazarConexionIA(refrescar) {
  $('revisar-conexiones')?.addEventListener('click', async ev => {
    const boton = ev.currentTarget, uid = nube.usuarioId(), estado = E;
    const out = $('conexiones-ia-estado'); boton.disabled = true;
    out.textContent = 'Revisando…';
    try {
      const [g, p] = await Promise.all([nube.conexionesIA(), nube.propuestasIA()]);
      if (E !== estado || uid !== nube.usuarioId() || !out.isConnected) return;
      const grants = g.items || g.grants || (Array.isArray(g) ? g : []);
      out.innerHTML = `${grants.length ? grants.map(x => `<p>${esc(x.client?.name || x.client_name || 'Aplicación conectada')} <button class="boton" data-revocar-ia="${esc(x.client?.id || x.client_id)}">Revocar acceso</button></p>`).join('') : '<p>No tienes conexiones autorizadas.</p>'}
        ${(p.propuestas || []).map(x => `<section class="tarjeta"><h3>Propuesta de tu IA</h3><p class="pequeno">${esc(x.plan.justificacion || 'Revisa las sesiones antes de decidir.')}</p><details><summary>Ver cómo quedaría</summary>${x.plan.dias.map(d => `<p class="pequeno"><strong>${esc(d.fecha)}: ${esc(d.foco)}</strong><br>${d.ejercicios.map(e => `${esc(e.nombre || e.ejercicio_id)}: ${e.series} × ${e.reps_min} a ${e.reps_max}`).join('<br>')}</p>`).join('')}</details><div class="fila-botones"><button class="boton primario" data-confirmar-ia="${esc(x.id)}">Confirmar este plan</button><button class="boton" data-descartar-ia="${esc(x.id)}">Descartar</button></div></section>`).join('') || '<p>No hay propuestas pendientes.</p>'}`;
      out.querySelectorAll('[data-revocar-ia]').forEach(b => b.onclick = () => ejecutar(b, () => nube.revocarConexionIA(b.dataset.revocarIa), 'Acceso revocado.'));
      out.querySelectorAll('[data-descartar-ia]').forEach(b => b.onclick = () => ejecutar(b, () => nube.descartarPropuestaIA(b.dataset.descartarIa), 'Propuesta descartada.'));
      out.querySelectorAll('[data-confirmar-ia]').forEach(b => b.onclick = () => ejecutar(b, async () => { await nube.confirmarPropuestaIA(b.dataset.confirmarIa); await refrescar(); }, 'Propuesta confirmada.'));
      async function ejecutar(b, accion, texto) {
        b.disabled = true;
        try { await accion(); if (E === estado && uid === nube.usuarioId()) { E.mensaje = texto; mostrarMensaje(); boton.click(); } }
        catch (e) { if (out.isConnected) { const aviso = document.createElement('p'); aviso.setAttribute('role', 'alert'); aviso.textContent = e.message; out.prepend(aviso); } }
        finally { b.disabled = false; }
      }
    } catch { out.textContent = 'No pude consultar las conexiones. Revisa el servidor o reintenta con señal.'; }
    finally { boton.disabled = false; }
  });
}
