// Ajustar con tu IA copiando y pegando: sirve con ChatGPT, Claude o Gemini, sin cuenta ni servidor. La app revisa la
// respuesta con las mismas reglas y muestra cómo quedaría antes de cambiar el plan (la conexión directa con ChatGPT,
// que exige cuenta, está en app/conexion-ia.js).
import { E, guardar, R, D, esc, $, indice, hoy, cambiarPlan } from './comun.js';
import { aplicarCambios, promptParaIA, leerRespuestaIA, describirCambio } from '../nucleo/cambios.js';
import { validarCambio } from '../nucleo/validador.js';
import { permitidos } from '../nucleo/mcp.js';
import { seriesAnotadas } from '../nucleo/semanal.js';
import * as nube from './nube.js';

const hayPlan = () => E.plan?.dias?.length && !E.plan.bloqueado;
const sinGuiones = t => String(t).replace(/\s*[–—]\s*/g, ' a ');

export function iaCopiarHtml() {
  return `<h3>Ajustar con tu IA</h3>
    <p class="pequeno">Con ChatGPT, Claude o Gemini, sin cuenta. Copia el texto, pégalo en tu IA y trae de vuelta su respuesta. La app la revisa con sus reglas y te muestra cómo quedaría antes de cambiar tu plan.</p>
    ${hayPlan() ? `<textarea id="pedido" placeholder="Ej: quiero más glúteo, el martes solo tengo 40 minutos" aria-label="Qué quieres cambiar">${esc(E.pedido || '')}</textarea>
    <div class="fila-botones"><button type="button" class="boton" id="copiar">Copiar texto para mi IA</button></div>
    <div id="prompt-caja"></div>
    <textarea id="respuesta" placeholder="Pega aquí la respuesta completa de tu IA" aria-label="Respuesta de tu IA"></textarea>
    <div class="fila-botones"><button type="button" class="boton" id="revisar">Revisar cambios</button></div>
    <div id="resultado-ia" role="status"></div>` : '<p class="aviso ojo">Primero arma tu plan.</p>'}`;
}

export function enlazarIACopiar(ir) {
  if (!$('copiar')) return;
  $('pedido').oninput = e => { E.pedido = e.target.value; guardar(); };
  $('copiar').onclick = async () => {
    const d = D();
    const historial = seriesAnotadas(E.sesiones, E.registro).filter(s => s.reps != null);
    const texto = promptParaIA({ derivados: d, plan: E.plan, permitidos: permitidos({ indice, respuestas: R(), derivados: d, hoy: hoy() }), historial, pedido: E.pedido || '' });
    $('prompt-caja').innerHTML = `<pre class="prompt" id="prompt-texto">${esc(texto)}</pre><p class="pequeno" id="copiado"></p>`;
    try { await navigator.clipboard.writeText(texto); $('copiado').textContent = 'Copiado. Pégalo en tu IA.'; }
    catch { const sel = getSelection(), rango = document.createRange(); rango.selectNodeContents($('prompt-texto')); sel.removeAllRanges(); sel.addRange(rango); $('copiado').textContent = 'Texto seleccionado: cópialo con Copiar.'; }
  };
  $('revisar').onclick = () => {
    const out = $('resultado-ia');
    const leido = leerRespuestaIA($('respuesta').value);
    if (!leido.ok) { out.innerHTML = `<div class="aviso alerta">${esc(leido.error)}</div>`; return; }
    const antes = E.plan;
    const c = aplicarCambios(antes, leido.cambios, indice);
    // Un error que tu plan ya traía no bloquea: solo los que agrega tu IA.
    const v = validarCambio(antes, c.plan, { derivados: D(), respuestas: R(), indice, hoy: hoy() });
    const lista = xs => `<ul>${xs.map(x => `<li>${esc(sinGuiones(x))}</li>`).join('')}</ul>`;
    out.innerHTML = `${c.aplicados.length ? `<div class="aviso bien"><strong>Así quedaría tu plan:</strong>${lista(c.aplicados.map(x => describirCambio(x, antes, indice)))}</div>` : '<div class="aviso ojo">La respuesta no trae cambios que se puedan aplicar a tu plan.</div>'}
      ${c.rechazados.length ? `<div class="aviso ojo"><strong>Descartados:</strong>${lista(c.rechazados.map(x => x.motivo))}</div>` : ''}
      ${v.errores.length ? `<div class="aviso alerta"><strong>No pasa las reglas de la app, así que no se aplica:</strong>${lista(v.errores.map(x => x.mensaje))}<p class="pequeno">Pídele a tu IA que lo corrija y vuelve a pegar su respuesta.</p></div>` : ''}
      ${v.ok && c.aplicados.length ? '<div class="fila-botones"><button type="button" class="boton primario" id="aplicar-ia">Aplicar a mi plan</button><button type="button" class="boton" id="no-aplicar-ia">Dejar como está</button></div>' : ''}`;
    $('no-aplicar-ia')?.addEventListener('click', () => { out.innerHTML = '<p class="pequeno suave">No cambié nada.</p>'; });
    $('aplicar-ia')?.addEventListener('click', async () => {
      // Si el plan cambió mientras revisabas (otra pantalla o la cuenta), se vuelve a revisar.
      if (E.plan !== antes) { out.innerHTML = '<div class="aviso ojo">Tu plan cambió mientras revisabas. Toca "Revisar cambios" de nuevo.</div>'; return; }
      await cambiarPlan({ ...c.plan, generado_por: 'ia_externa' }, `${c.aplicados.length === 1 ? 'Apliqué 1 cambio' : `Apliqué ${c.aplicados.length} cambios`} de tu IA.`, nube);
      ir('semana');
    });
  };
}
