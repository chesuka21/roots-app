// Vercel serverless function — proxies AI requests to Google Gemini (free
// tier) so the API key never reaches the browser. The route is still called
// /api/claude to match what the app already calls, but it now talks to
// Gemini underneath — the response is reshaped into the same {content:[...]}
// format the client expects, so no other files needed to change.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not set in this environment");
    return res.status(500).json({ error: { message: "Server is missing GEMINI_API_KEY" } });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      }
    );
    const data = await r.json();

    if (!r.ok) {
      console.error("Gemini API error", r.status, JSON.stringify(data));
      return res.status(r.status).json(data);
    }

    const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("");
    res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) {
    console.error("Gemini proxy crashed:", e);
    res.status(500).json({ error: { message: String(e) } });
  }
}
