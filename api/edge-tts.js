// Vercel serverless — Text-to-Speech con voces neurales de Microsoft Edge.
// GRATIS, sin API key: usa el servicio online de Edge (mismas voces que el
// navegador Edge: Aria, Jenny, Guy, Emma...). Mucho más natural que
// VoiceRSS / speechSynthesis del sistema.
// Query: /api/edge-tts?text=hello&voice=en-US-AriaNeural&rate=-5
import { EdgeTTS } from "edge-tts-universal";

const DEFAULT_VOICE = process.env.EDGE_TTS_VOICE || "en-US-AriaNeural";

export default async function handler(req, res) {
  const text = req.query.text;
  if (!text) return res.status(400).json({ error: "Missing text" });
  if (String(text).length > 600) {
    return res.status(400).json({ error: "Text too long (max 600 chars)" });
  }
  const voice = String(req.query.voice || DEFAULT_VOICE);
  // rate: -10 (lento, ideal para aprender) a +10. Default -5: un poco más
  // despacio que lo nativo para que el learner alcance a distinguir palabras.
  const rawRate = Number(req.query.rate ?? -5);
  const clamped = Math.min(50, Math.max(-50, Number.isFinite(rawRate) ? rawRate : -5));
  const rate = `${clamped >= 0 ? "+" : "-"}${Math.abs(Math.round(clamped))}%`;

  try {
    const tts = new EdgeTTS(String(text), voice, { rate });
    const result = await tts.synthesize();
    const buf = Buffer.from(await result.audio.arrayBuffer());
    if (!buf.length) throw new Error("Empty audio");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=86400"); // la misma palabra no se re-sintetiza
    res.setHeader("X-TTS-Voice", voice);
    return res.status(200).send(buf);
  } catch (e) {
    console.error("Edge TTS failed:", e.message);
    return res.status(502).json({ error: e.message || "Edge TTS failed" });
  }
}
