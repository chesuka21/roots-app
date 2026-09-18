/* ---------- Motor de generación de oraciones ----------
   Recibe un patrón (frame con slots tipados) + el grafo, y devuelve pickings
   válidos semánticamente. Nunca produce "I drink shoes" porque el objeto
   DEBE estar conectado al verbo por una arista "object". */
import { objectsOf, agentsOf, byPos } from "./graph.js";

// peso → muestreo con sesgo a combinaciones más frecuentes
function pickWeighted(irreg, rng) {
  if (!irreg.length) return null;
  const weights = irreg.map((x) => x.w ?? 0.5);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rng() * sum;
  for (let i = 0; i < irreg.length; i++) {
    r -= weights[i];
    if (r <= 0) return irreg[i];
  }
  return irreg[irreg.length - 1];
}

// rng determinista para tests; Math.random en producción
export function fillPattern(pattern, graph, rng = Math.random) {
  const picks = {};
  const sentenceParts = [];

  for (const slot of pattern.frame) {
    const slotName = slot.slot;
    const posNeeded = slot.pos;              // ej. ["noun"] o ["verb"]
    const role = slot.role;                  // "agent" | "object" | "location"...

    // 1. candidatos por POS
    let candidates = [];
    if (posNeeded) {
      for (const p of posNeeded) candidates.push(...byPos(graph, p));
    } else {
      candidates = Object.keys(graph.nodes);
    }

    // filtro semántico adicional por slot:
    // - agent: solo pronombres o sustantivos animados (cat human/animal/nature),
    //   no "kitchen", "recipe", "salt" (inanimados raros como sujeto)
    if (role === "agent") {
      candidates = candidates.filter((c) => {
        const node = graph.nodes[c];
        if (!node) return false;
        if (node.pos === "pron") return true;                    // I, you, he...
        if (["human", "animal", "nature"].includes(node.cat)) return true; // permitir dog, baby...
        return false;
      });
    }

    // 2. filtro por aristas según el rol y lo ya elegido
    if (role === "agent" && picks.verb) {
      // quiénes ejecutan ese verbo
      const valid = new Set(agentsOf(graph, picks.verb));
      candidates = candidates.filter((c) => valid.has(c));
    } else if (role === "object" && picks.verb) {
      // objetos válidos de ese verbo
      const valid = new Set(objectsOf(graph, picks.verb));
      candidates = candidates.filter((c) => valid.has(c));
    }

    // 3. reglas semánticas del patrón (constraints explícitos)
    if (pattern.constraints) {
      for (const rule of pattern.constraints) {
        candidates = candidates.filter((c) => ruleAllows(rule, picks, c, graph));
      }
    }

    if (!candidates.length) return null; // patrón infactible con el vocab actual

    // 4. elegir con peso (objetos más frecuentes primero)
    const withW = candidates.map((c) => ({ id: c, w: weightFor(graph, picks.verb, c, role) }));
    const chosen = pickWeighted(withW, rng);
    picks[slotName] = chosen.id;

    // 5. texto: conjugamos si es verbo
    if (slotName === "verb") {
      sentenceParts.push(conjugate(graph.nodes[chosen.id].text, picks.agent));
    } else {
      sentenceParts.push(graph.nodes[chosen.id].text);
    }
  }

  return { picks, text: sentenceParts.join(" ") };
}

// peso de una arista ya existente; si no hay, 0.5 (permitir mezcla nueva)
function weightFor(graph, verbId, candId, role) {
  if (!verbId || role !== "object") return 0.5;
  const e = (graph.outEdges.get(verbId) || []).find((x) => x.rel === "object" && x.dst === candId);
  return e ? e.weight : 0.5;
}

// Conjugación 3ª persona (reusa tu lógica de patterns.js, aquí simplified)
function conjugate(verb, agent) {
  if (!agent) return verb;
  const third = /^(he|she|it|my mom|my dad|the baby|the dog)$/i.test(agent);
  if (!third) return verb;
  if (/(s|x|z|ch|sh|o)$/i.test(verb)) return verb + "es";
  if (/[^aeiou]y$/i.test(verb)) return verb.slice(0, -1) + "ies";
  return verb + "s";
}

// reglas semánticas explícitas del patrón (constraints)
function ruleAllows(rule, picks, candId, graph) {
  // formato: { if: { verb: "drink" }, then: { cat_in: ["drink","food"] } }
  const cond = rule.if || {};
  let match = true;
  for (const [k, v] of Object.entries(cond)) {
    if (k === "verb") match = match && picks.verb === v;
  }
  if (!match) return true; // no aplica
  const then = rule.then || {};
  if (then.cat_in) {
    const c = graph.nodes[candId];
    return then.cat_in.includes(c?.cat);
  }
  return true;
}
