// Vercel serverless function — proxies image search to Unsplash (free,
// attribution appreciated but not required for this kind of personal use)
// so the Unsplash key stays server-side.
//
// FILTROS ANTI-TEXTO/ABSTRACCIÓN (fix "borrow → fotos motivacionales"):
// - orientation=landscape (fotos reales, no gráficos tipográficos)
// - content_filter=high
// - la query se limpia de términos que atraen gráficos con texto
//   (quote, wallpaper, typography, motivational...) y se refuerza con "photo"
export default async function handler(req, res) {
  const q = req.query.q;
  const word = req.query.word || "";
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {
    // Limpiar términos que atraen gráficos con texto/tipografía
    const BAD_TERMS = /quote|quotes|wallpaper|typography|font|text|motivational|inspirational|poster|banner|logo/gi;
    const cleanQuery = q.replace(BAD_TERMS, "").replace(/\s+/g, " ").trim();
    // Escena visual (IA) + palabra para reforzar el sentido + refuerzo "photo"
    const queryWithCat = word ? `${cleanQuery} ${word}`.trim() : cleanQuery;
    const finalQuery = `${queryWithCat} photo`.trim();
    const r = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(finalQuery)}&per_page=8&content_filter=high&orientation=landscape&order_by=relevant`,
      { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
    );
    const data = await r.json();
    // tomar SOLO urls pequeñas y confiables, máximo 4 (límite UI)
    const images = (data.results || []).slice(0, 4).map((p) => p.urls.small);
    res.status(200).json({ images });
  } catch (e) {
    res.status(500).json({ images: [] });
  }
}
