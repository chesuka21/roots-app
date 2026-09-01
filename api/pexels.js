// Vercel serverless function — proxies image search to Unsplash (free,
// attribution appreciated but not required for this kind of personal use)
// so the Unsplash key stays server-side.
export default async function handler(req, res) {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing query" });

  try {
    const r = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=4&content_filter=high&orientation=squarish`,
      { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }
    );
    const data = await r.json();
    const images = (data.results || []).map((p) => p.urls.small);
    res.status(200).json({ images });
  } catch (e) {
    res.status(500).json({ images: [] });
  }
}
