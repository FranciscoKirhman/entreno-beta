// La hoja ＋ del Coach, como la de iMessage: herramientas a un toque en vez de escribir. "Para hoy" usa las reglas
// del entrenador en el teléfono (app/cambios-ui.js), así funciona sin señal; "Tu plan" abre el chat con la IA ya
// encaminado; las calculadoras (nucleo/calculadoras.js y nucleo/calentamiento.js) son locales; "Traer datos" usa el adjunto del chat.
import { E, R, guardar, hoy, avisar, unidadPeso, coma } from './comun.js';
import { abrirHoja } from './hoja.js';
import { accionHoy } from './cambios-ui.js';
import { icono } from './iconos.js';
import { sesionDe } from '../nucleo/agenda.js';
import { discosPorLado, discosDisponibles, BARRAS_KG, BARRAS_LB } from '../nucleo/discos.js';
import { maximoEstimado, cargasPorPorcentaje } from '../nucleo/calculadoras.js';
import { seriesDeCalentamiento } from '../nucleo/calentamiento.js';
import { ajuste } from './ajustes-sesion.js';

const n = x => coma(Math.round(x * 100) / 100);
const hayPlan = () => Array.isArray(E.plan?.dias) && !E.plan.bloqueado;

/**
 * @param o.alCambiar   (r) => void cuando una herramienta de hoy cambió el plan
 * @param o.alDolor     (texto) => void para "me duele el hombro 4/10"
 * @param o.planChat    ('afinar' | 'explicar') => void
 * @param o.adjuntar    () => void abre el selector de archivo del chat
 * @param o.pegarPlan   () => void deja el campo listo para pegar un plan
 * @param o.ir          navegación de la app
 * @param o.volver      foco a devolver al cerrar
 */
export function abrirHerramientas(o) {
  const conPlan = hayPlan(), conHoy = conPlan && Boolean(sesionDe(E.plan, hoy()));
  const grupo = (titulo, items) => `<section class="grupo-herramientas"><h4>${titulo}</h4><div class="rejilla-herramientas">${items.map(([valor, ic, nombre, tono, apagada]) =>
    `<button type="button" class="herramienta${apagada ? ' apagada' : ''}" data-elegir="${valor}"><span class="ic-herramienta ${tono}">${icono(ic)}</span><span>${nombre}</span></button>`).join('')}</div></section>`;
  abrirHoja({
    titulo: 'Herramientas', volver: o.volver,
    contenido: `<div class="herramientas-coach">
      ${conHoy ? grupo('Para hoy', [['tiempo', 'reloj', 'Poco tiempo', 'naranja'], ['maquina', 'cambiar', 'Cambiar ejercicio', 'naranja'], ['cansado', 'luna', 'Estoy cansado', 'naranja'], ['dolor', 'curita', 'Me duele algo', 'naranja']]) : ''}
      ${conPlan ? grupo('Tu plan', [['mover', 'calendario', 'Mover o faltar', 'azul'], ['afinar', 'ajustes', 'Afinar mi plan', 'azul'], ['explicar', 'libro', 'Explícame mi plan', 'azul'], ['checkin', 'visto', 'Check in semanal', 'azul']]) : ''}
      ${grupo('Calculadoras', [['discos', 'pesa', 'Discos', 'verde'], ['rm', 'medidor', '1RM y cargas', 'verde'], ['calentar', 'fuego', 'Series de calentamiento', 'verde']])}
      ${grupo('Traer datos', [['importar', 'bajar', 'Importar de Hevy', 'morado'], ['pegar', 'lapiz', 'Pegar un plan', 'morado'], ['foto', 'camara', 'Foto o PDF (pronto)', 'morado', true]])}
    </div>`,
    opciones: [],
    alElegir: v => elegir(v, o),
  });
}

function elegir(v, o) {
  const hoyO = { volver: o.volver, alCambiar: o.alCambiar, alDolor: o.alDolor };
  if (['tiempo', 'maquina', 'cansado', 'dolor'].includes(v)) return accionHoy(v, { ...hoyO, titulo: 'Para hoy' });
  if (v === 'mover') return abrirHoja({
    titulo: 'Mover o faltar', volver: o.volver, nota: 'Te muestro cómo quedaría la semana antes de cambiar algo.',
    opciones: [{ valor: 'falte', icono: icono('flecha'), nombre: 'Hoy no puedo, moverla' }, { valor: 'otra', icono: icono('calendario'), nombre: 'Hoy prefiero otra sesión' }],
    alElegir: x => accionHoy(x, { ...hoyO, titulo: 'Mover o faltar' }),
  });
  if (v === 'afinar' || v === 'explicar') return o.planChat(v);
  if (v === 'checkin') return o.ir('checkin');
  if (v === 'discos') return calculadoraDiscos(o.volver);
  if (v === 'rm') return calculadoraMaximo(o.volver);
  if (v === 'calentar') return calculadoraCalentamiento(o.volver);
  if (v === 'importar') return o.adjuntar();
  if (v === 'pegar') return o.pegarPlan();
  if (v === 'foto') return avisar('Todavía no lee fotos, PDF ni audio. Por ahora adjunta CSV o texto.', 'neutro');
}

// ── Calculadoras: lo último que escribiste queda para la próxima vez (E.calculadoras) ────────────────────────
const memoria = () => (E.calculadoras ||= {});
const lb = () => unidadPeso() === 'lb';
const barras = () => (lb() ? BARRAS_LB : BARRAS_KG);
const discos = () => discosDisponibles((R()?.lugares || []).find(x => x.principal)?.incremento_minimo_kg ?? (R()?.lugares || [])[0]?.incremento_minimo_kg, unidadPeso());
const paso = () => 2 * Math.min(...discos());
const barraElegida = () => (barras().includes(memoria().barra) ? memoria().barra : barras()[0]);
const campo = (id, etiqueta, valor, { min = 0, max = 999, paso: p = 'any' } = {}) =>
  `<label class="campo-calculadora" for="${id}"><span>${etiqueta}</span><input id="${id}" type="number" inputmode="decimal" min="${min}" max="${max}" step="${p}" value="${valor ?? ''}"></label>`;
const chipsBarra = () => `<div class="chips-barra" role="group" aria-label="Barra">${barras().map(b => `<button type="button" class="chip-barra" data-barra="${b}" aria-pressed="${b === barraElegida()}">Barra ${n(b)} ${unidadPeso()}</button>`).join('')}</div>`;
const leer = id => { const x = Number(String(document.getElementById(id)?.value || '').replace(',', '.')); return x > 0 ? x : null; };

/** Abre una calculadora: campos arriba, resultado vivo abajo, y "Listo". `pintar` devuelve el HTML del resultado. */
function calculadora({ titulo, campos, conBarra = false, pintar, guardarCampos, volver }) {
  abrirHoja({
    titulo, volver,
    contenido: `<div class="calculadora"><div class="campos-calculadora">${campos}</div>${conBarra ? chipsBarra() : ''}<div class="resultado-calculadora" id="resultado-calculadora" aria-live="polite"></div></div>`,
    opciones: [{ valor: 'listo', icono: icono('visto'), clase: 'confirmar', nombre: 'Listo' }],
    alElegir: () => {},
  });
  const hoja = document.getElementById('hoja'), salida = document.getElementById('resultado-calculadora');
  const actualizar = () => { guardarCampos(); guardar(); salida.innerHTML = pintar(); };
  hoja.addEventListener('input', ev => { if (ev.target.matches('input')) actualizar(); });
  hoja.addEventListener('click', ev => {
    const b = ev.target.closest('[data-barra]');
    if (!b) return;
    memoria().barra = Number(b.dataset.barra);
    hoja.querySelectorAll('[data-barra]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    actualizar();
  });
  salida.innerHTML = pintar();
  requestAnimationFrame(() => hoja.querySelector('input')?.focus({ preventScroll: true }));
}

function dibujoDiscos(r) {
  const lado = r.porLado.flatMap(x => Array.from({ length: x.n }, () => x.peso));
  return lado.length ? `<div class="barra-discos" aria-hidden="true"><span class="manga"></span><span class="tope"></span>${lado.map(p => `<span class="disco d${String(p).replace('.', '_')}" style="--alto:${Math.round(34 + 66 * Math.min(1, p / (lb() ? 45 : 25)))}%"></span>`).join('')}</div>` : '';
}

function calculadoraDiscos(volver) {
  const u = unidadPeso();
  calculadora({
    titulo: 'Calculadora de discos', volver, conBarra: true,
    campos: campo('calc-total', `Peso total (${u})`, memoria().total),
    guardarCampos: () => { memoria().total = leer('calc-total'); },
    pintar: () => {
      const total = leer('calc-total'), barra = barraElegida();
      if (!total) return '<p class="pequeno suave">Escribe el peso total con la barra.</p>';
      const r = discosPorLado(total, { barra, discos: discos() });
      if (r.falta < 0) return `<p class="pequeno">Es menos que la barra sola (${n(barra)} ${u}).</p>`;
      if (!r.porLado.length) return `<p class="pequeno">Solo la barra de ${n(barra)} ${u}.</p>`;
      return `${dibujoDiscos(r)}<p class="resultado-grande">A cada lado: ${r.porLado.map(x => `${x.n > 1 ? `${x.n} × ` : ''}${n(x.peso)}`).join(' + ')} ${u}</p>${r.falta > 0 ? `<p class="pequeno suave">Con tus discos llegas a ${n(r.lograble)} ${u}: faltan ${n(r.falta)}.</p>` : ''}`;
    },
  });
}

function calculadoraMaximo(volver) {
  const u = unidadPeso(), m = memoria();
  calculadora({
    titulo: '1RM y cargas', volver,
    campos: `${campo('calc-kg', `Peso (${u})`, m.kg)}${campo('calc-reps', 'Repeticiones', m.reps, { max: 30, paso: 1 })}${campo('calc-rir', 'En reserva (RIR)', m.rir ?? 0, { max: 5, paso: 1 })}`,
    guardarCampos: () => { m.kg = leer('calc-kg'); m.reps = leer('calc-reps'); m.rir = Number(document.getElementById('calc-rir')?.value) || 0; },
    pintar: () => {
      const max = maximoEstimado(leer('calc-kg'), leer('calc-reps'), Number(document.getElementById('calc-rir')?.value) || 0);
      if (!max) return '<p class="pequeno suave">Escribe el peso y las repeticiones de una serie (hasta 30).</p>';
      return `<p class="resultado-grande">Máximo estimado: ${n(Math.round(max * 2) / 2)} ${u}</p>
        <table class="tabla-cargas"><thead><tr><th>%</th><th>Peso</th><th>Reps al fallo</th></tr></thead><tbody>${cargasPorPorcentaje(max, { paso: paso() }).map(x => `<tr><td>${x.pct}</td><td>${n(x.kg)} ${u}</td><td>${x.reps}</td></tr>`).join('')}</tbody></table>
        <p class="pequeno suave">Es una estimación (fórmula de Epley): sirve para elegir cargas, no para probar tu máximo.</p>`;
    },
  });
}

function calculadoraCalentamiento(volver) {
  const u = unidadPeso();
  calculadora({
    titulo: 'Series de calentamiento', volver, conBarra: true,
    campos: campo('calc-trabajo', `Peso de trabajo (${u})`, memoria().trabajo),
    guardarCampos: () => { memoria().trabajo = leer('calc-trabajo'); },
    pintar: () => {
      const t = leer('calc-trabajo'), barra = barraElegida();
      if (!t) return '<p class="pequeno suave">Escribe el peso de tu primera serie de trabajo.</p>';
      // El esquema elegido en Ajustes de la sesión, con la barra sola primero si queda por debajo.
      const xs = t > barra ? seriesDeCalentamiento(t, { incremento: paso(), barra, esquema: ajuste('esquemaCal') }).filter(x => x.kg != null) : [];
      if (xs.length && xs[0].kg > barra) xs.unshift({ kg: barra, reps: 10 });
      if (!xs.length) return '<p class="pequeno">Con ese peso basta con unas repeticiones suaves de la barra o del movimiento.</p>';
      return `<ol class="lista-calentamiento">${xs.map(x => `<li><strong>${n(x.kg)} ${u}</strong> × ${x.reps}</li>`).join('')}<li class="trabajo"><strong>${n(t)} ${u}</strong> series de trabajo</li></ol>
        <p class="pequeno suave">Descansa poco entre ellas (30 s a 1 min); el calentamiento no debe cansarte. El esquema se cambia en Ajustes de la sesión.</p>`;
    },
  });
}
