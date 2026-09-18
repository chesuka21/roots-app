// Vercel serverless — diagnóstico de latencia IA contra casa gloriosa de las redes
export default async function handler(req, res) {
  const t0 = Date.now();
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({ model: "openai/gpt-oss-20b", messages: [{ role: "user", content: "ping" }], max_tokens: 5 }),
  });
  const elapsed = Date.now() - t0;
  res.status(200).json({ elapsed_ms: elapsed, ok: r.ok });
}
