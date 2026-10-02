// Pantalla independiente: no carga ni transfiere el perfil local del teléfono.
import * as nube from './nube.js';
const root = document.getElementById('autorizacion');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const id = new URL(location.href).searchParams.get('authorization_id');
const mensaje = t => { root.innerHTML = `<h1>Conectar Entreno</h1><section class="tarjeta"><p role="status">${esc(t)}</p><a href="./">Volver a Entreno</a></section>`; };
function volver(url) {
  const u = new URL(url);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname))) throw new Error('El destino de la conexión no es seguro.');
  location.assign(u.href);
}
async function mostrar() {
  if (!id) return mensaje('Inicia la conexión desde ChatGPT. Esta página se abre cuando necesitas autorizarlo.');
  if (!nube.hay()) return mensaje('Esta versión no tiene servidor de cuentas configurado. La conexión directa todavía no está disponible aquí.');
  if (!nube.conectado()) {
    root.innerHTML = `<h1>Conectar Entreno</h1><section class="tarjeta"><h3>Entra a tu cuenta</h3><p>Usa el correo de tu cuenta de Entreno. Tus datos locales no se comparten.</p><form id="entrada"><label>Correo <input id="email" type="email" autocomplete="email" required></label><button class="boton primario">Recibir código</button></form><div id="codigo"></div><p id="error" role="status"></p></section>`;
    document.getElementById('entrada').onsubmit = async e => {
      e.preventDefault(); const email = document.getElementById('email').value.trim();
      const boton = e.currentTarget.querySelector('button'); boton.disabled = true;
      try {
        await nube.pedirCodigo(email, location.origin + location.pathname + location.search);
        document.getElementById('codigo').innerHTML = `<form id="verificar"><label>Código del correo <input id="otp" inputmode="numeric" autocomplete="one-time-code" required></label><button class="boton primario">Entrar</button></form>`;
        document.getElementById('verificar').onsubmit = async ev => {
          ev.preventDefault(); const b = ev.currentTarget.querySelector('button'); b.disabled = true;
          try { await nube.verificarCodigo(email, document.getElementById('otp').value); await mostrar(); }
          catch { document.getElementById('error').textContent = 'No pude verificar ese código. Revisa el correo o pide otro.'; b.disabled = false; }
        };
      } catch { document.getElementById('error').textContent = 'No pude enviar el código. Reintenta cuando tengas señal.'; }
      finally { boton.disabled = false; }
    };
    return;
  }
  try {
    const d = await nube.detallesAutorizacion(id);
    if (!d.authorization_id && d.redirect_url) return volver(d.redirect_url);
    const cliente = d.client?.name || d.client?.client_name || 'Aplicación externa';
    const clientId = d.client?.id || d.client?.client_id;
    if (!clientId) throw new Error('No pude identificar la aplicación.');
    root.innerHTML = `<h1>Conectar Entreno</h1><section class="tarjeta"><h3>${esc(cliente)}</h3><p class="pequeno correo-cuenta">Sitio: ${esc(d.client?.uri || 'No informado')}<br>Vuelve a: ${esc(d.redirect_uri)}</p><p>Solicita acceso a la cuenta <strong class="correo-cuenta">${esc(nube.correo())}</strong>.</p><p>Podrá consultar tu objetivo, nivel, equipo, lesiones declaradas, plan e historial, y dejar propuestas de cambios. Tú las revisas y confirmas en Entreno.</p><p class="pequeno suave">Las herramientas no comparten fotos, nombre ni fecha de nacimiento. Lo consultado pasa a la aplicación que conectas y puede quedar en sus conversaciones. Puedes revocar el acceso en Más.</p><p class="pequeno suave">Permisos solicitados: ${esc(d.scope || 'Acceso a Entreno')}.</p><label class="casilla pequeno"><input type="checkbox" id="acepto-ia"> Autorizo compartir estos datos, incluidas mis lesiones declaradas, con esta aplicación.</label><div class="fila-botones"><button class="boton primario" id="permitir" disabled>Autorizar conexión</button><button class="boton" id="negar">No autorizar</button></div><p id="error" role="status"></p></section>`;
    document.getElementById('acepto-ia').onchange = ev => { document.getElementById('permitir').disabled = !ev.target.checked; };
    const resolver = async aceptar => {
      const uid = nube.usuarioId();
      document.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        if (aceptar) await nube.autorizarConexionIA(clientId);
        if (nube.usuarioId() !== uid) throw new Error('La cuenta cambió. Vuelve a iniciar la conexión.');
        const r = aceptar ? await nube.aprobarAutorizacion(id) : await nube.negarAutorizacion(id);
        volver(r.redirect_url);
      } catch (e) {
        document.getElementById('error').textContent = e.message || 'No pude completar la conexión.';
        document.getElementById('negar').disabled = false;
        document.getElementById('permitir').disabled = !document.getElementById('acepto-ia').checked;
      }
    };
    document.getElementById('permitir').onclick = () => resolver(true);
    document.getElementById('negar').onclick = () => resolver(false);
  } catch { mensaje('La solicitud venció o no es válida. Vuelve a iniciar la conexión desde ChatGPT.'); }
}
await nube.iniciar();
await mostrar();
