/* ---------- WordToken — palabra clickeable dentro de una oración ----------
   Divide cualquier oración en espacios limpios/tokens, deja marcable
   solo las palabras "de contenido" (≥2 letras alfabéticas sin dígitos).
   El CTA/sugerencia viene en props. */
export default function WordToken({ text, wordsInMap = new Set(), onAdd, styles }) {
  const tokens = String(text || "").split(/(\s+)/);
  return (
    <>
      {tokens.map((tok, i) => {
        const clean = tok.toLowerCase().replace(/[^\w''\-]/g, "");
        const clickable = clean.length >= 2 && /^[a-zA-Z''\-]+$/.test(clean) && !wordsInMap.has(clean);
        return (
          <span
            key={i}
            style={clickable ? styles.tokenClickable : styles.token}
            title={clickable ? "Add to map" : undefined}
            onClick={clickable ? (e) => { e.stopPropagation(); onAdd?.(clean); } : undefined}
          >
            {tok}
          </span>
        );
      })}
    </>
  );
}
