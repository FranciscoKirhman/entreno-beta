// El texto que escribe la IA, sin guiones (regla 1 de AGENTS.md). El prompt ya los prohíbe, pero nada los quitaba si el
// modelo los escribía igual. Entre números es un rango ("6 a 10"); entre palabras, una coma. La marca de una lista al
// comienzo de la línea ("- ") y los guiones dentro de una palabra ("check-in") se dejan.
const enLinea = t => t
  .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 a $2')
  .replace(/(\d) - (\d)/g, '$1 a $2')
  .replace(/\s*[–—]\s*|\s-\s/g, ', ')
  .replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/([:;.!?¿¡]),\s*/g, '$1 ').replace(/,\s*$/, '');

/** @param {string} texto */
export function sinGuiones(texto) {
  return String(texto ?? '').split('\n').map(l => {
    const m = l.match(/^(\s*(?:[-•*]|\d+[.)])\s+)(.*)$/);
    return m ? m[1] + enLinea(m[2]).replace(/^,\s*/, '') : enLinea(l).replace(/^,\s*/, '');
  }).join('\n');
}
