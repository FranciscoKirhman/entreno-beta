// Check-in semanal: cómo te fue en cada ejercicio y cuánto sube, se mantiene o baja la carga de la semana
// siguiente (nucleo/semanal.js). Nada cambia hasta que la persona confirma.
import { E, guardar, R, K, esc, $, hoy, indice, fechaCorta, cambiarPlan, peso, seriesTexto, mostrarSemana } from './comun.js';
import { semanaParaCheckin, proponerCheckin, aplicarCheckin } from '../nucleo/semanal.js';
import * as nube from './nube.js';

const kg = peso;
const claveDe = semana => `${E.plan.inicio}|${semana}`;

/** Fechas con al menos una serie anotada (terminada o marcada como hecha). */
function entrenadas() {
  const f = new Set(E.sesiones.map(s => s.fecha));
  for (const [fecha, porEj] of Object.entries(E.registro)) if (Object.values(porEj).some(l => (l || []).some(x => x?.hecho))) f.add(fecha);
  return f;
}

/** Qué semana toca revisar ahora (o null). La usan Hoy y Semana para mostrar el aviso. */
export function estadoCheckin() {
  if (!E.plan?.dias?.length) return null;
  const hechos = {};
  for (const k of Object.keys(E.checkins || {})) if (k.startsWith(`${E.plan.inicio}|`)) hechos[k.split('|')[1]] = true;
  return semanaParaCheckin(E.plan, hoy(), { hechos, entrenadas: entrenadas() });
}

/** Tarjeta corta para Hoy y Semana. `siempre`: también cuando todavía no toca (se puede adelantar) o ya se hizo. */
export function avisoCheckin(siempre = false) {
  const s = estadoCheckin();
  if (!s || (!siempre && (s.hecho || !s.toca))) return '';
  if (s.hecho) return `<section class="tarjeta fila-resumen"><span class="pequeno">✓ Check-in de la semana ${s.semana} hecho.</span><button type="button" class="enlace" data-ir-checkin="${s.semana}">Revisarlo</button></section>`;
  const texto = s.atrasado ? `Te faltó revisar la semana ${s.semana}. Hazlo antes de tu primera sesión de esta semana: así la carga parte bien.`
    : s.toca ? 'Revisa cómo te fue en cada ejercicio y confirma cuánto sube la próxima semana. Toma un minuto.'
      : `Se abre después de tu última sesión de la semana (${fechaCorta(s.ultima)}). Si quieres, puedes adelantarlo.`;
  return `<section class="tarjeta${s.toca ? ' destacada' : ''}"><h3>Check-in de la semana ${s.semana}</h3><p class="pequeno">${esc(texto)}</p>
    <div class="fila-botones"><button type="button" class="boton${s.toca ? ' primario' : ''}" data-ir-checkin="${s.semana}">${s.toca ? 'Hacer el check-in' : 'Adelantarlo'}</button></div></section>`;
}

const entradaPara = semana => ({ plan: E.plan, semana, sesiones: E.sesiones, registro: E.registro, notas: E.notas, indice, lugar: (R().lugares || [])[0], checkin: K });

function propuestaTexto(it) {
  const rango = `${it.reps_min} a ${it.reps_max} reps`;
  switch (it.accion) {
    case 'subir_carga': return `Sube a ${kg(it.carga_kg)}${it.reps_max !== it.antes.reps_max ? ` · ${rango}` : ''}`;
    case 'bajar_carga': return `Baja a ${kg(it.carga_kg)}`;
    case 'subir_reps': return it.carga_kg ? `${kg(it.carga_kg)} · hasta ${it.reps_max} reps` : `Sube a ${rango}`;
    case 'subir_reps_dentro': return `${it.carga_kg ? kg(it.carga_kg) : 'Mismo peso'} · 1 repetición más`;
    default: return it.carga_kg ? `Se mantiene en ${kg(it.carga_kg)}` : 'Se mantiene';
  }
}

/** "50 kg × 12, 12, 11 · llegaste al fallo" */
const hechasTexto = hechas => seriesTexto(hechas) + (hechas.some(s => s.rir === 0) ? ' · llegaste al fallo' : '');

const ETIQUETA = { subir: 'Sube', mantener: 'Mantiene', bajar: 'Baja' };

export function vistaCheckin(ir, semanaPedida) {
  if (!E.plan || E.plan.bloqueado) return ir('inicio');
  const estado = estadoCheckin();
  const semana = Number(semanaPedida) || estado?.semana;
  if (!semana || !E.plan.dias.some(d => d.semana === semana + 1)) return ir('semana');
  const p = proponerCheckin(entradaPara(semana));
  const hecho = E.checkins?.[claveDe(semana)];
  const conRegistro = p.items.filter(i => i.hechas.length || i.cambia);
  const sinRegistro = p.items.filter(i => !i.hechas.length && !i.cambia);
  const cambian = conRegistro.filter(i => i.cambia && !p.descarga);
  const porDia = [...new Set(conRegistro.map(i => i.plantilla))].map(pl => ({ foco: conRegistro.find(i => i.plantilla === pl).foco, items: conRegistro.filter(i => i.plantilla === pl) }));
  const sesionesHechas = p.dias.filter(d => d.series).length, firmes = p.dias.filter(d => d.firme);
  const fechas = E.plan.dias.filter(d => d.semana === semana).map(d => d.fecha).sort();

  $('app').innerHTML = `<div id="vista-checkin">
    <h1>Check-in semanal</h1>
    <p class="suave pequeno">Semana ${semana} · ${esc(fechaCorta(fechas[0]))} al ${esc(fechaCorta(fechas.at(-1)))}</p>
    ${p.banderas.map(b => `<div class="aviso alerta">${esc(b.mensaje)}</div>`).join('')}
    <section class="tarjeta">
      <p>Hiciste <strong class="num">${sesionesHechas}</strong> de ${p.dias.length} sesiones${firmes.length < p.dias.length ? ` (${firmes.filter(d => d.series).length} de ${firmes.length} firmes)` : ''} y anotaste <strong class="num">${p.series}</strong> series.</p>
      ${conRegistro.length && !p.descarga ? `<p class="pequeno">Para la semana ${p.siguiente}: ${['subir', 'bajar', 'mantener'].map(t => [t, conRegistro.filter(i => i.tipo === t).length]).filter(([, n]) => n).map(([t, n]) => `${n} ${t === 'subir' ? (n === 1 ? 'sube' : 'suben') : t === 'bajar' ? (n === 1 ? 'baja' : 'bajan') : (n === 1 ? 'se mantiene' : 'se mantienen')}`).join(', ')}. Desmarca lo que no quieras cambiar.</p>` : ''}
      ${hecho ? `<p class="pequeno suave">Ya lo hiciste el ${esc(fechaCorta(hecho.fecha))}. Si cambiaste algo de la semana, puedes revisarlo de nuevo.</p>` : ''}
    </section>
    ${p.descarga ? `<div class="aviso ojo">La semana ${p.siguiente} es de descarga: mismos ejercicios, la mitad de las series y más reserva. Las cargas no se cambian; lo de esta semana queda guardado para el próximo bloque.</div>` : ''}
    ${!p.series ? '<div class="aviso ojo">No anotaste series esta semana, así que las cargas se mantienen. Marca cada serie con ✓ en Hoy para que la app pueda ajustarlas.</div>' : ''}
    <form id="form-checkin">
      ${porDia.map(g => `<section class="tarjeta"><h3>${esc(g.foco)}</h3><ul class="ajustes">${g.items.map(it => {
        const marca = it.cambia && !p.descarga;
        return `<li><label class="ajuste${marca ? '' : ' fijo'}">
          ${marca ? `<input type="checkbox" name="aceptar" value="${esc(it.clave)}" checked>` : '<span class="sin-check" aria-hidden="true"></span>'}
          <span class="cuerpo">
            <span class="fila-ajuste"><span class="nombre">${esc(it.nombre)}</span><span class="chip ${it.tipo}">${ETIQUETA[it.tipo]}</span></span>
            <span class="propuesta num">${esc(propuestaTexto(it))}</span>
            ${it.hechas.length ? `<span class="pequeno suave">Hiciste ${esc(hechasTexto(it.hechas))}</span>` : ''}
            <span class="pequeno">${esc(it.motivo)}</span>
          </span></label></li>`;
      }).join('')}</ul></section>`).join('')}
      ${sinRegistro.length ? `<section class="tarjeta"><h3>Sin series anotadas</h3><p class="pequeno suave">Se mantienen: ${esc(sinRegistro.map(i => i.nombre).join(', '))}.</p></section>` : ''}
      <div class="fila-botones">
        <button type="button" class="boton" id="ahora-no">Ahora no</button>
        <button type="submit" class="boton primario" id="aplicar-checkin">${cambian.length ? `Aplicar a la semana ${p.siguiente}` : 'Listo'}</button>
      </div>
    </form>
  </div>`;

  const actualizarBoton = () => {
    const n = document.querySelectorAll('input[name="aceptar"]:checked').length;
    $('aplicar-checkin').textContent = n ? `Aplicar ${n} cambio${n === 1 ? '' : 's'}` : 'Listo, sin cambios';
  };
  if (cambian.length) actualizarBoton();
  $('form-checkin').addEventListener('change', actualizarBoton);
  $('ahora-no').onclick = () => ir('semana');
  $('form-checkin').onsubmit = async ev => {
    ev.preventDefault();
    const aceptar = [...document.querySelectorAll('input[name="aceptar"]:checked')].map(i => i.value);
    const aceptados = p.items.filter(i => aceptar.includes(i.clave));
    const cuenta = t => aceptados.filter(i => i.tipo === t).length;
    const partes = [cuenta('subir') && `${cuenta('subir')} sube${cuenta('subir') === 1 ? '' : 'n'}`, cuenta('bajar') && `${cuenta('bajar')} baja${cuenta('bajar') === 1 ? '' : 'n'}`, cuenta('mantener') && `${cuenta('mantener')} queda${cuenta('mantener') === 1 ? '' : 'n'} con el peso que anotaste`].filter(Boolean);
    const mensaje = aceptar.length ? `Semana ${p.siguiente} ajustada: ${partes.join(', ')}.` : `Check-in de la semana ${semana} listo. La semana ${p.siguiente} queda igual.`;
    E.checkins = { ...(E.checkins || {}), [claveDe(semana)]: { fecha: hoy(), aplicados: aceptar } };
    if (aceptar.length) {
      const { plan } = aplicarCheckin(entradaPara(semana), aceptar);
      await cambiarPlan(plan, mensaje, nube); // si el servidor no lo acepta, deja su aviso en E.mensaje
    } else { E.mensaje = mensaje; guardar(); }
    if (nube.conectado()) {
      nube.guardarCheckin({ semana, plan_inicio: E.plan.inicio, banderas: p.banderas.map(b => b.id), series: p.series, sesiones: sesionesHechas,
        cambios: aceptados.map(i => ({ ejercicio_id: i.ejercicio_id, plantilla: i.plantilla, accion: i.accion, regla: i.regla, carga_kg: i.carga_kg, reps_min: i.reps_min, reps_max: i.reps_max })) })
        .catch(e => console.warn('Check-in no guardado en la cuenta', e));
    }
    mostrarSemana(p.siguiente);
    guardar();
    ir('semana');
  };
}
