// Vercel serverless — genera un ejercicio dinámico a partir del grafo tipado.
// POST { patternId } → { text, words: {agent,verb,object} }
import { buildSeedGraph, indexGraph } from "../src/lib/graph.js";
import { fillPattern } from "../src/lib/generator.js";

// Cache interno: una sola construcción por instancia lambda
let _g = null;
function getGraph() {
  if (!_g) _g = indexGraph(buildSeedGraph());
  return _g;
}

// Catálogo de patrones iniciales (evolutivo; se expande en App.jsx a futuro)
const PATTERNS = {
  svo_basic: {
    id: "svo_basic",
    frame: [
      { slot: "agent", pos: ["pron", "noun"], role: "agent" },
      { slot: "verb",  pos: ["verb"],  role: "verb" },
      { slot: "object", pos: ["noun"], role: "object" },
    ],
  },
  svo_time: {
    id: "svo_time",
    frame: [
      { slot: "agent", pos: ["pron", "noun"], role: "agent" },
      { slot: "verb",  pos: ["verb"],  role: "verb" },
      { slot: "object", pos: ["noun"], role: "object" },
      { slot: "time",  pos: ["noun"], role: "time" },
    ],
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { patternId } = req.body || {};
  const pattern = PATTERNS[patternId || "svo_basic"];
  if (!pattern) return res.status(404).json({ error: `Pattern not found: ${patternId}` });

  const g = getGraph();
  // hasta 5 intentos por si el grafo hace una combinación rara
  for (let i = 0; i < 5; i++) {
    const r = fillPattern(pattern, g);
    if (r) {
      return res.status(200).json({ exercise: r.text, words: r.picks });
    }
  }
  return res.status(404).json({ error: "No valid exercise possible with current graph" });
}
