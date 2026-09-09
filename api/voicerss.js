// Vercel serverless function — proxies text-to-speech requests to VoiceRSS
// so the API key never reaches the browser. Returns raw MP3 audio bytes.
export default async function handler(req, res) {
  const text = req.query.text;
  if (!text) return res.status(400).json({ error: "Missing text" });
  if (!process.env.VOICERSS_API_KEY) {
    return res.status(500).json({ error: "Server is missing VOICERSS_API_KEY" });
  }

  try {
    const url =
      `https://api.voicerss.org/?key=${process.env.VOICERSS_API_KEY}` +
      `&hl=en-us&src=${encodeURIComponent(text)}&c=MP3&f=44khz_16bit_mono`;
    const r = await fetch(url);
    const buffer = Buffer.from(await r.arrayBuffer());
    const contentType = r.headers.get("content-type") || "";

    // VoiceRSS returns plain-text "ERROR: ..." (still HTTP 200) instead of
    // audio when something's wrong (bad key, daily limit hit, etc.)
    if (!contentType.includes("audio")) {
      return res.status(502).json({ error: buffer.toString("utf-8") || "VoiceRSS returned no audio" });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    res.status(200).send(buffer);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
