/* ---------- Edge Engine — conexiones automáticas y evolutivas del mapa ----------
   Sistema de 3 niveles basado en el progreso SRS de cada palabra:

   1. AUTO-LINKING al insertar: una palabra nueva se compara contra el mapa
      (heurística local: misma categoría, co-ocurrencia en oraciones, banco de
      afinidad) y recibe 1-3 aristas hacia los nodos más afines SIN intervención
      del usuario. Si hay <2 candidatos locales, la IA (Gemini) propone el resto.

   2. SRS MATURITY LINKS: la evolución de las aristas depende de los repasos:
      - FASE INICIAL  (1-3 repasos):  mantiene solo 1-2 conexiones principales.
      - FASE INTERMEDIA (4-7):        añade conexiones secundarias/abstractas con
                                      palabras YA DOMINADAS por el usuario.
      - FASE AVANZADA (8+):           el nodo se consolida como HUB: aristas más
                                      gruesas + puentes a otros clusters temáticos.

   3. RE-EVALUACIÓN en sesión SRS: recalculateEdgesFor() se ejecuta al terminar
      una ronda de Review y modifica las aristas de las palabras repasadas.
      La sync a Supabase sale gratis: syncAllToCloud sube `edges` completo. */

import { WORDBANK_EN } from "../data/wordbank.js";

/* ── Heurística de afinidad local (0 tokens, instantánea) ──
   Devuelve un score 0-3 entre dos nodos: mismo tema (2), y +1 si comparten
   palabras en sus definiciones/ejemplos (co-ocurrencia léxica). */
function affinityScore(a, b) {
  if (!a || !b || a.id === b.id) return 0;
  let score = 0;
  if (a.cat && a.cat === b.cat && a.cat !== "custom") score += 2;
  // co-ocurrencia: palabras significativas compartidas entre def/ejemplos
  const wordsOf = (n) => {
    const txt = `${n.def || ""} ${n.standalone || ""} ${(n.userExamples || []).join(" ")} ${(n.sentenceFrames || []).map((f) => f.frame || "").join(" ")}`.toLowerCase();
    return new Set(txt.split(/[^a-z']+/).filter((w) => w.length >= 4));
  };
  const wa = wordsOf(a), wb = wordsOf(b);
  let overlap = 0;
  for (const w of wa) if (wb.has(w)) overlap++;
  score += Math.min(1, overlap * 0.5); // hasta +1
  // mismas categorías hermanas del banco local (food↔drink, etc. no — mismo cat ya cuenta)
  return score;
}

/* Candidatos locales ordenados por afinidad, excluyendo ya conectados. */
export function localCandidates(node, nodes, edges, limit = 5) {
  const connected = new Set(
    edges
      .filter((e) => e.source === node.id || e.target === node.id)
      .map((e) => (e.source === node.id ? e.target : e.source))
  );
  return Object.values(nodes)
    .filter((n) => n && n.id !== node.id && n.kind !== "pattern" && !connected.has(n.id))
    .map((n) => ({ node: n, score: affinityScore(node, n) }))
    .filter((x) => x.score >= 1.5) // solo afinidad real (misma categoría o overlap)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.node);
}

/* Crea la arista si no existe (evita duplicados en cualquier dirección). */
function addEdge(edges, source, target, sentence = "", rel = "related") {
  const key = (s, t) => `${s}|${t}`;
  const exists = edges.some((e) => key(e.source, e.target) === key(source, target) || key(e.source, e.target) === key(target, source));
  if (exists) return null;
  return { source, target, sentence, rel };
}

/* ── FASE del nodo según repasos SRS ── */
export function maturityPhase(srsCard) {
  const reps = srsCard?.reps || 0;
  if (reps >= 8) return "advanced";   // 8+  → hub
  if (reps >= 4) return "intermediate"; // 4-7 → secundarias
  return "initial";                   // 0-3 → principales
}

/* Grosor visual de la arista según fase del nodo de origen (hub = gruesa). */
export function edgeWidth(srsCard) {
  const phase = maturityPhase(srsCard);
  return phase === "advanced" ? 3 : phase === "intermediate" ? 2 : 1.2;
}

/* ── 1. AUTO-LINKING: aristas automáticas al insertar una palabra ──
   Devuelve aristas nuevas (0-3) hacia los nodos más afines del mapa.
   Es síncrono y local: 0 tokens. El usuario puede borrarlas luego. */
export function autoLinkNewWord(node, nodes, edges, maxLinks = 3) {
  const candidates = localCandidates(node, nodes, edges, maxLinks);
  const out = [];
  for (const c of candidates) {
    if (out.length >= maxLinks) break;
    // preferir conectar hacia nodos YA APRENDIDOS (red que crece desde lo conocido)
    const e = addEdge(edges.concat(out), node.id, c.id, "", "auto");
    if (e) out.push(e);
  }
  return out;
}

/* ── 2/3. EVOLUCIÓN: recalculateEdgesFor tras un repaso exitoso ──
   Revisa la fase SRS de `nodeId` y ajusta sus aristas:
   - intermediate: añade hasta 2 conexiones secundarias con palabras dominadas
     (reps >= 4 en su propio SRS) — puentes abstractos, no solo misma categoría.
   - advanced: añade 1-2 puentes a OTROS clusters (categorías distintas) y marca
     la arista como hub (width 3).
   Devuelve { edges: edgesNuevas, added: n } — el caller las integra con setData. */
export function recalculateEdgesFor(nodeId, data, maxAdd = 2) {
  const nodes = data.nodes || {};
  const node = nodes[nodeId];
  if (!node) return { added: [], width: 1.2 };
  const card = data.srs?.[nodeId];
  const phase = maturityPhase(card);
  const width = edgeWidth(card);
  if (phase === "initial") return { added: [], width }; // sin evolución aún

  const edges = data.edges || [];
  const added = [];
  const learned = new Set(data.learned || []);
  const connected = new Set(
    edges.filter((e) => e.source === nodeId || e.target === nodeId).map((e) => (e.source === nodeId ? e.target : e.source))
  );
  const pool = Object.values(nodes).filter(
    (n) => n && n.id !== nodeId && n.kind !== "pattern" && learned.has(n.id) && !connected.has(n.id)
  );

  if (phase === "intermediate") {
    // secundarias: afinidad media (>=1) con palabras dominadas, máx 2
    const cands = pool
      .map((n) => ({ n, s: affinityScore(node, n) }))
      .filter((x) => x.s >= 1)
      .sort((a, b) => b.s - a.s)
      .slice(0, maxAdd);
    for (const { n } of cands) {
      const e = addEdge(edges.concat(added), nodeId, n.id, "", "maturity");
      if (e) added.push(e);
    }
  } else {
    // advanced (hub): puentes a categorías DISTINTAS de la del nodo (clusters nuevos)
    const ownCats = new Set([node.cat]);
    const bridges = pool
      .filter((n) => n.cat && !ownCats.has(n.cat))
      .map((n) => ({ n, s: affinityScore(node, n) + (n.cat ? 0.5 : 0) })) // bonus por cambiar de cluster
      .sort((a, b) => b.s - a.s)
      .slice(0, maxAdd);
    for (const { n } of bridges) {
      const e = addEdge(edges.concat(added), nodeId, n.id, "", "hub");
      if (e) added.push(e);
    }
    // si no hay clusters distintos, conecta con lo mejor disponible
    if (!added.length) {
      const fallback = pool.sort((a, b) => affinityScore(node, b) - affinityScore(node, a))[0];
      if (fallback) {
        const e = addEdge(edges, nodeId, fallback.id, "", "hub");
        if (e) added.push(e);
      }
    }
  }
  return { added, width };
}

/* ── IA opcional: conexiones semánticas cuando la heurística local no alcanza ──
   Pide a Gemini 1-3 palabras afines del mapa para la palabra nueva. Se usa solo
   si autoLinkNewWord produjo <2 aristas y el mapa tiene candidatos. */
export async function aiSuggestConnections(word, existingWords) {
  const { callClaudeJson } = await import("./ai.js");
  const wordList = existingWords.map((w) => w.en).join(", ");
  if (!wordList) return [];
  const prompt = `For the English word "${word}", pick 1-3 words FROM THIS EXISTING LIST that are the most naturally related in meaning or everyday use: ${wordList}
Return ONLY valid JSON: {"links":[{"word":"<exact word from the list>","sentence":"<short natural English sentence using both>"}]}
Rules: spell words exactly as in the list. Keep sentences short. Never use double quotes inside a value — use single quotes.`;
  try {
    const res = await callClaudeJson(prompt, 250);
    return res.links || [];
  } catch (e) {
    return []; // IA caída/quota — el auto-linking local ya dejó aristas
  }
}
