// Poses abiertas guardadas en la app. Solo variantes comprobadas, sin equivalencias aproximadas.
const CATALOGO = Object.freeze({"sentadilla_corporal": "bodyweight-squat", "sentadilla_goblet": "goblet-squat", "press_banca_barra": "bench-press", "puente_gluteo": "glute-bridge", "curl_mancuernas": "bicep-curl"});
export const secuenciaGratisDe = id => CATALOGO[id] || null;
export function secuenciaGratisHtml(id) {
  const slug = secuenciaGratisDe(id);
  if (!slug) return '';
  return `<section class="secuencia-gratis" aria-label="Posiciones del ejercicio">
    <style>
      .secuencia-gratis{margin:12px 0;border-radius:20px;overflow:hidden;background:#253a43;color:#fff;padding:16px;box-sizing:border-box;max-width:100%}
      .secuencia-poses{position:relative;width:100%;aspect-ratio:1;max-height:330px;margin:auto}
      .secuencia-poses img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}
      .secuencia-poses img+img{visibility:hidden}
      .secuencia-gratis.reproduciendo img:first-child{animation:pose-inicial 3.2s steps(1,end) infinite}
      .secuencia-gratis.reproduciendo img+img{animation:pose-final 3.2s steps(1,end) infinite}
      @keyframes pose-inicial{0%,100%{visibility:visible}50%{visibility:hidden}}
      @keyframes pose-final{0%,100%{visibility:hidden}50%{visibility:visible}}
      .secuencia-gratis button{min-height:44px;white-space:normal}
      .secuencia-gratis p{font-size:13px;line-height:1.5;margin:10px 0 0}
      .secuencia-gratis a{color:#c9edff;text-decoration:underline}
      @media(prefers-reduced-motion:reduce){.secuencia-gratis.reproduciendo img{animation:none}}
    </style>
    <div class="secuencia-poses"><img src="img/secuencias/${slug}/frame-3.svg" width="512" height="512" alt="Una posición del ejercicio"><img src="img/secuencias/${slug}/frame-1.svg" width="512" height="512" alt="Otra posición del ejercicio" aria-hidden="true"></div>
    <button type="button" class="boton" data-reproducir-poses aria-pressed="false">Ver secuencia de posiciones</button>
    <p>Dos poses de referencia. La secuencia no indica la velocidad del ejercicio.</p>
    <details><summary>Créditos de las ilustraciones</summary><p><a href="https://github.com/bryllim/workout-guide" target="_blank" rel="noopener">Workout Guide, Bryl Lim</a>, basado en Everkinetic. <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY SA 4.0</a>. Poses sin modificar. <a href="img/secuencias/procedencia.json">Procedencia</a>.</p></details>
  </section>`;
}
export function enlazarSecuenciaGratis(raiz) {
  const boton = raiz?.querySelector('[data-reproducir-poses]');
  if (!boton) return;
  const tarjeta = boton.closest('.secuencia-gratis');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    tarjeta.querySelector('.secuencia-poses').style.cssText = 'display:flex;aspect-ratio:auto;max-height:none';
    tarjeta.querySelectorAll('img').forEach(img => { img.style.cssText = 'position:static;width:50%;height:auto;visibility:visible'; img.removeAttribute('aria-hidden'); });
    boton.hidden = true;
    return;
  }
  boton.onclick = () => {
    const activo = tarjeta.classList.toggle('reproduciendo');
    boton.setAttribute('aria-pressed', String(activo));
    boton.textContent = activo ? 'Pausar secuencia' : 'Ver secuencia de posiciones';
  };
}
