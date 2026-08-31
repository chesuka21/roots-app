// Vercel serverless function — proxies chat requests to Claude so the
// Anthropic API key never reaches the browser.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { prompt, max_tokens } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set in this environment");
    return res.status(500).json({ error: "Server is missing ANTHROPIC_API_KEY" });
  }

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-5",
        max_tokens: max_tokens || 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    if (!r.ok) {
      // logged here so it shows up in Vercel → Logs with the real reason
      console.error("Anthropic API error", r.status, JSON.stringify(data));
    }
    res.status(r.status).json(data);
  } catch (e) {
    console.error("Claude proxy crashed:", e);
    res.status(500).json({ error: "Claude request failed", detail: String(e) });
  }
}
