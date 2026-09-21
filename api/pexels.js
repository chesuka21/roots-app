// Vercel serverless function — proxies image search to Unsplash (free,
// attribution appreciated but not required for this kind of personal use)
// so the Unsplash key stays server-side.
export default async function handler(req, res) {
  const q = req.query.q;
  const word = req.query.word || "";
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {
    // per_page 8 (4 extra para tener margen de descarte), orden y ajuste
    // con categoría en query para que no traiga resultados de otros temas
    const queryWithCat = word ? `${word} ${q}` : q;
    const r = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(queryWithCat)}&per_page=8&content_filter=high&orientation=squarish&order_by=relevant`,
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
