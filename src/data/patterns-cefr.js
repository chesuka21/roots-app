/* ---------- Pattern Nodes — CEFR A1→C2 (Pattern-Vocabulary architecture) ----------
   Extiende el mapa mental (Graph View) con dos clases de nodo:

   1. VOCABULARY NODES (los de siempre: { id, en, def, cat, ... })
   2. PATTERN NODES  (nuevos): { id, kind: "pattern", cefr, frame, ... }

   ARISTAS PATTERN↔WORD (relaciones tipadas):
     - "patternOf" : word → pattern   (la palabra se practica DENTRO de ese patrón)
     - "uses"      : pattern → word   (el patrón ejemplifica con esa palabra)

   Vinculación automática: cada palabra que entra al mapa se vincula a los
   patrones cuyo `match` (categorías + POS) coincide, FILTRADOS por el nivel
   CEFR detectado en el onboarding. Nivel avanzado → nunca recibe patrones
   elementales (A1/A2): solo B2/C1/C2 (inversiones, condicionales mixtos,
   phrasal verbs avanzados, conectores formales, collocations).

   Unificación Patterns ↔ Practice Patterns: las plantillas del banco
   (data.patternBank) y las de Practice comparten este mismo formato de frame
   con slots ({ k, fixed }), así que SRS, drills y desbloqueo funcionan igual
   en ambos módulos.
*/

// Mapa del tier del onboarding ("beginner" | "intermediate" | "advanced") → CEFR.
// "advanced" en el quiz es ambiguo (puede ser B2 sólido o C1/C2): la app pregunta
// el sub-nivel en Ajustes; hasta ahí usamos B2 como piso seguro para avanzados.
export const TIER_TO_CEFR = { beginner: "A2", intermediate: "B1", advanced: "B2" };

export const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

export function cefrIndex(cefr) {
  const i = CEFR_ORDER.indexOf(String(cefr || "").toUpperCase());
  return i < 0 ? 1 : i; // default A2
}

/* ---------------- Banco de Pattern Nodes por nivel CEFR ----------------
   Cada nodo: id estable (pat-…), cefr, es (traducción), frame con slots,
   match: { cats: [...], pos: [...] } para la vinculación automática.
   El slot { k: "word" } se rellena con UNA palabra del mapa del usuario
   (así el repaso usa vocabulario real, no listas genéricas). */
export const PATTERN_NODES = [
  /* ── A1: Fundacionales ── */
  { id: "pat-svo", cefr: "A1", es: "[Sujeto] + [verbo] + [objeto]", label: "[Subject] + [verb] + [object]",
    frame: [{ k: "subject" }, { k: "verb" }, { k: "word" }],
    match: { cats: ["food", "drink", "home", "school", "work", "nature", "feelings"], pos: ["verb", "noun"] } },
  { id: "pat-sv", cefr: "A1", es: "[Sujeto] + [verbo]", label: "[Subject] + [verb]",
    frame: [{ k: "subject" }, { k: "verb" }],
    match: { cats: ["food", "drink", "feelings", "nature"], pos: ["verb"] } },

  /* ── A2: rutinas y tiempo/lugar ── */
  { id: "pat-time", cefr: "A2", es: "[S+V+O] + [tiempo]", label: "[Subject] + [verb] + [object] + [time]",
    frame: [{ k: "subject" }, { k: "verb" }, { k: "word" }, { k: "time" }],
    match: { cats: ["food", "drink", "work", "school", "daily"], pos: ["verb"] } },
  { id: "pat-place", cefr: "A2", es: "[Sujeto] + [verbo] + [lugar]", label: "[Subject] + [verb] + [place]",
    frame: [{ k: "subject" }, { k: "verb" }, { k: "place" }],
    match: { cats: ["home", "school", "work", "travel"], pos: ["verb"] } },
  { id: "pat-likeing", cefr: "A2", es: "A [alguien] le gusta [verbo-ing]", label: "[Subject] + like(s) + [verb-ing]",
    frame: [{ k: "subject" }, { k: "verb", fixed: "like" }, { k: "word" }],
    match: { cats: ["feelings", "food", "music", "games", "sports"], pos: ["verb", "noun"] } },
  { id: "pat-goingto", cefr: "A2", es: "Voy a [verbo] [objeto]", label: "[Subject] + am/is/are going to + [verb]",
    frame: [{ k: "subject" }, { k: "be" }, { k: "verb" }, { k: "word" }],
    match: { cats: ["travel", "work", "school", "daily"], pos: ["verb", "noun"] } },

  /* ── B1: pasado, comparaciones, propósitos ── */
  { id: "pat-pastexp", cefr: "B1", es: "Experiencia con presente perfecto", label: "[Subject] + have/has + [past participle] + [object/time]",
    frame: [{ k: "subject" }, { k: "have" }, { k: "verb" }, { k: "word" }],
    match: { cats: ["work", "school", "travel", "health", "daily"], pos: ["verb"] } },
  { id: "pat-because", cefr: "B1", es: "[Oración] porque/conectores + [razón]", label: "[Clause] + because/since/as + [reason]",
    frame: [{ k: "subject" }, { k: "verb" }, { k: "word" }, { k: "because" }, { k: "object" }],
    match: { cats: ["feelings", "opinions", "work", "school"], pos: ["adj", "verb", "noun"] } },
  { id: "pat-comparative", cefr: "B1", es: "Comparativos y superlativos", label: "[Subject] + is + [comparative] than [object]",
    frame: [{ k: "subject" }, { k: "be" }, { k: "word" }, { k: "than" }, { k: "object" }],
    match: { cats: ["feelings", "opinions", "nature", "work"], pos: ["adj"] } },
  { id: "pat-wantto", cefr: "B1", es: "Quiero [verbo] para [propósito]", label: "[Subject] + want(s) to + [verb] + [object]",
    frame: [{ k: "subject" }, { k: "verb", fixed: "want" }, { k: "verb" }, { k: "word" }],
    match: { cats: ["work", "school", "travel", "goals", "opinions"], pos: ["verb", "noun"] } },

  /* ── B2: condicionales, pasiva, phrasal verbs, conectores ── */
  { id: "pat-cond2", cefr: "B2", es: "Condicional tipo 2 (hipotético)", label: "If [Subject] + [past], [Subject] + would + [verb]",
    frame: [{ k: "if" }, { k: "subject" }, { k: "verb" }, { k: "word" }, { k: "would" }, { k: "verb" }],
    match: { cats: ["opinions", "work", "school", "goals", "feelings"], pos: ["verb", "noun"] } },
  { id: "pat-condmix", cefr: "B2", es: "Condicional mixto (pasado→presente)", label: "If [Subject] + had + [past participle], [Subject] + would + [verb] + [now]",
    frame: [{ k: "if" }, { k: "subject" }, { k: "have" }, { k: "verb" }, { k: "word" }, { k: "would" }, { k: "verb" }],
    match: { cats: ["opinions", "work", "school", "goals"], pos: ["verb", "noun"] } },
  { id: "pat-passive", cefr: "B2", es: "Voz pasiva", label: "[Object] + is/are + [past participle] + by [Subject]",
    frame: [{ k: "subject" }, { k: "be" }, { k: "verb" }, { k: "by" }, { k: "subject" }],
    match: { cats: ["work", "school", "tech", "news"], pos: ["verb"] } },
  { id: "pat-phrasal", cefr: "B2", es: "Phrasal verbs (B2+)", label: "[Subject] + [phrasal verb] + [object]",
    frame: [{ k: "subject" }, { k: "verb" }, { k: "particle" }, { k: "word" }],
    match: { cats: ["work", "school", "daily", "tech", "opinions"], pos: ["verb", "noun"] } },
  { id: "pat-formalconn", cefr: "B2", es: "Conectores formales", label: "[Clause] + however/therefore/although + [Clause]",
    frame: [{ k: "subject" }, { k: "verb" }, { k: "word" }, { k: "connector" }, { k: "object" }],
    match: { cats: ["opinions", "work", "school", "news"], pos: ["verb", "adj", "noun"] } },

  /* ── C1/C2: inversiones, collocations, estilo avanzado ── */
  { id: "pat-inversion", cefr: "C1", es: "Inversión (énfasis formal)", label: "Rarely/Never + [aux inversion] — formal emphasis",
    frame: [{ k: "adv-rare" }, { k: "have" }, { k: "subject" }, { k: "verb" }, { k: "word" }],
    match: { cats: ["opinions", "work", "school", "news"], pos: ["verb", "noun"] } },
  { id: "pat-collocation", cefr: "C1", es: "Collocations complejas", label: "[Verb collocation] + [object] + [adverb]",
    frame: [{ k: "subject" }, { k: "verb" }, { k: "word" }, { k: "adverb" }],
    match: { cats: ["opinions", "work", "school", "money"], pos: ["verb", "noun", "adj"] } },
  { id: "pat-wishpast", cefr: "C1", es: "I wish + pasado perfecto (arrepentimiento)", label: "I wish + [Subject] + had + [past participle]",
    frame: [{ k: "verb", fixed: "I wish" }, { k: "subject" }, { k: "have" }, { k: "verb" }, { k: "word" }],
    match: { cats: ["feelings", "opinions", "relationships"], pos: ["verb", "noun"] } },
  { id: "pat-cleft", cefr: "C2", es: "Cleft sentence (What... is...)", label: "What [Subject] + [verb] + is + [object] — énfasis",
    frame: [{ k: "verb", fixed: "What" }, { k: "subject" }, { k: "verb" }, { k: "be" }, { k: "word" }],
    match: { cats: ["opinions", "work", "school"], pos: ["verb", "noun"] } },
];

/* ---------------- Adaptación dinámica por nivel de onboarding ---------------- */

// Patrones VISIBLES para un nivel CEFR: regla de techo — un nivel ve su propio
// CEFR y los niveles inferiores ya dominados (1 grado por debajo). Los
// elementales (A1) jamás se le inyectan a un avanzado (B2/C1/C2).
export function patternsForCefr(userCefr) {
  const max = cefrIndex(userCefr);
  const min = Math.max(0, max - 1); // techo: propio + 1 abajo
  return PATTERN_NODES.filter((p) => {
    const i = cefrIndex(p.cefr);
    return i <= max && i >= min;
  });
}

// ¿Es un nivel avanzado (B2/C1/C2)? Decide si se evitan patrones elementales.
export function isAdvancedCefr(cefr) {
  return cefrIndex(cefr) >= cefrIndex("B2");
}

// Vinculación palabra → patterns: patrones relevantes según categorías/POS
// de la palabra, limitados al techo del nivel del usuario.
export function patternsForWord(word, userCefr, maxCount = 3) {
  const visible = patternsForCefr(userCefr);
  const cats = new Set([String(word.cat || "").toLowerCase()]);
  const pos = new Set([String(word.pos || "noun").toLowerCase()]);
  const scored = [];
  for (const p of visible) {
    let score = 0;
    for (const c of p.match.cats) if (cats.has(String(c).toLowerCase())) score += 2;
    for (const t of p.match.pos) if (pos.has(String(t).toLowerCase())) score += 1;
    if (score > 0) scored.push({ pattern: p, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCount).map((s) => s.pattern);
}

// Vincular una palabra del mapa a sus patterns: crea aristas "patternOf"
// (word→pattern) en el grafo y devuelve las aristas nuevas.
export function linkWordToPatterns(word, userCefr, maxCount = 3) {
  const pats = patternsForWord(word, userCefr, maxCount);
  return pats.map((p) => ({ source: word.id, target: p.id, rel: "patternOf", kind: "pattern-link" }));
}

// Insertar los PATTERN NODES en el mapa de nodos (idempotente).
export function ensurePatternNodes(nodes) {
  const next = { ...nodes };
  for (const p of PATTERN_NODES) {
    if (!next[p.id]) {
      next[p.id] = {
        id: p.id,
        kind: "pattern",
        en: p.label,
        def: `Estructura ${p.cefr}: ${p.es}`,
        defEs: p.es,
        cat: "pattern",
        cefr: p.cefr,
        frame: p.frame,
        pos: "pattern",
      };
    }
  }
  return next;
}

/* ---------------- Unificación con Practice Patterns ----------------
   Las plantillas del banco (data.patternBank, formato slots) se registran en
   patternSrs igual que en Practice; aquí convertimos su nivel numérico (1-4)
   al CEFR equivalente para que la práctica respete el nivel del usuario. */
export const SLOT_LEVEL_TO_CEFR = { 1: "A1", 2: "A2", 3: "B1", 4: "B2" };

// ¿Puede el usuario practicar esta plantilla según su CEFR? (techo: propio + 1)
export function templateAllowedForCefr(tpl, userCefr) {
  const tplCefr = tpl.cefr || SLOT_LEVEL_TO_CEFR[tpl.level] || "A2";
  return cefrIndex(tplCefr) <= cefrIndex(userCefr) + 1;
}
