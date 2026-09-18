/* ---------- Grafo tipado de vocabulario ----------
   Las palabras son nodos con `pos`. Los VERBOS son puentes: cada verbo define
   sus aristas a objetos ("drink"→"water") y a agentes sujetos ("drink"→"I").
   El usuario expande el grafo con su uso real (más abajo).

   Relaciones (tipadas):
     - "object"  : el verbo es ejecutado sobre el sustantivo (drink→water)
     - "agent"   : quien ejecuta el verbo (I→drink)
     - "category": fallback suave palabra→su categoría (water→drink cat)
     - "user"    : arista creada por el usuario al practicar (weight sube) */

import { WORDBANK_EN, COMMON_AGENTS } from "../data/wordbank.js";

// Construye el grafo base (offline, 0 tokens) a partir del wordbank.
// Cada verbo genera aristas: verb→object (weight 0.9), agent→verb (weight 0.8).
// Y una arista suave word→su-categoria para exploración por tema.
export function buildSeedGraph() {
  const nodes = {}; // id -> word
  const edges = []; // {src, rel, dst, weight}

  // nodos (palabras del wordbank)
  Object.values(WORDBANK_EN).forEach((w) => {
    if (!w?.en) return;
    nodes[w.en] = { id: w.en, pos: w.pos || "noun", cat: w.cat, def: w.def, defEs: w.defEs, text: w.en };
  });

  // agentes comunes como nodos (pronombres => pron; sustantivos animados => noun)
  COMMON_AGENTS.forEach((a) => {
    const key = a.toLowerCase();
    const isPron = /^(i|you|he|she|we|they)$/.test(key);
    const cat = /baby|mom|dad|dog|cat|bird/.test(key) ? (/dog|cat|bird/.test(key) ? "animal" : "human") : "grammar";
    nodes[key] = { id: key, pos: isPron ? "pron" : "noun", cat, text: a };
  });

  // aristas desde verbos
  Object.values(WORDBANK_EN).forEach((w) => {
    if (w?.pos !== "verb") return;
    const verbId = w.en;
    (w.commonObjects || []).forEach((obj) => {
      const objKey = obj.toLowerCase();
      if (!nodes[objKey]) nodes[objKey] = { id: objKey, pos: "noun", cat: "mixed", text: obj };
      edges.push({ src: verbId, rel: "object", dst: objKey, weight: 0.9 });
      // el objeto a su vez es "de la categoría" del verbo (para navegar)
      edges.push({ src: objKey, rel: "category", dst: w.cat, weight: 0.4 });
    });
    // agentes típicos que ejecutan el verbo (COMMON_AGENTS)
    COMMON_AGENTS.forEach((a) => {
      const key = a.toLowerCase();
      edges.push({ src: key, rel: "agent", dst: verbId, weight: 0.8 });
    });
  });

  return { nodes, edges };
}

// Indexa para consultas rápidas O(1)
export function indexGraph(g) {
  const outEdges = new Map(); // src -> edges[]
  const inEdges = new Map();  // dst -> edges[]
  for (const e of g.edges) {
    if (!outEdges.has(e.src)) outEdges.set(e.src, []);
    outEdges.get(e.src).push(e);
    if (!inEdges.has(e.dst)) inEdges.set(e.dst, []);
    inEdges.get(e.dst).push(e);
  }
  return { ...g, outEdges, inEdges };
}

// ---- consultas que usa el generador ----
// objetos válidos de un verbo
export function objectsOf(graph, verbId) {
  return (graph.outEdges.get(verbId) || [])
    .filter((e) => e.rel === "object")
    .map((e) => e.dst);
}
// agentes válidos de un verbo
export function agentsOf(graph, verbId) {
  return (graph.inEdges.get(verbId) || [])
    .filter((e) => e.rel === "agent")
    .map((e) => e.src);
}
// palabras por POS (filtra nodos)
export function byPos(graph, pos) {
  return Object.values(graph.nodes).filter((n) => n.pos === pos).map((n) => n.id);
}

// ---- extendible por el usuario ----
// Cuando el usuario practica y escribe "I eat rice", registramos la arista
// eat→rice con weight mayor. Persistir en localStorage bajo roots-graph-v1.
export function link(graph, src, rel, dst, weight = 0.6) {
  const e = { src, rel, dst, weight };
  graph.edges.push(e);
  if (!graph.outEdges.has(src)) graph.outEdges.set(src, []);
  graph.outEdges.get(src).push(e);
  if (!graph.inEdges.has(dst)) graph.inEdges.set(dst, []);
  graph.inEdges.get(dst).push(e);
  return graph;
}
