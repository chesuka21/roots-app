/* ---------- Dynamic Pattern Review — Slot-and-Filler (Substitution Drills) ----------
   Modelo de datos:
   Una PLANTILLA es una lista ordenada de SLOTS. Cada slot tiene un tipo y las
   opciones (fillers) que pueden ocuparlo. El sistema genera combinaciones
   dinámicas cambiando UN slot a la vez (drill) — la gramática no se rompe
   porque cada plantilla define exactamente qué tipos de slot admite.
   Ej: { frame: ["subject", "drink", "object"] } + subject∈{I,They,She} +
   object∈{water,coffee,milk} → "I drink water", "They drink coffee"…

   Persistencia (draft v1.0, evolutivo): dentro del objeto `data` de
   localStorage bajo `data.patternBank`. Cada plantilla guarda:
   - id, name, es (traducción del marco)
   - frame: array de slots — un elemento puede ser:
       { k: "subject" }            → elige de subjectPool
       { k: "verb", fixed: "drink" } → palabra fija (no cambia)
       { k: "object" }             → elige de objectPool
       { k: "time" }, { k: "place" }, { k: "literal", text: "in the" }
   - level: 1=Fundacional, 2=SVO Básico, 3=Tiempo/Lugar, 4=Avanzados
   - subjectPool / objectPool / timePool / placePool: opciones del slot
   Los patrones creados por el usuario usan la misma forma (slots libres).

   SRS: mismo SM-2 del resto de la app (patternSrs[id] = {interval, ease, reps, due}).
*/

export const PATTERN_LEVELS = [
  { id: 1, name: "Fundacionales", es: "2 elementos: [Subject] + [Action]" },
  { id: 2, name: "SVO Básicos", es: "3 elementos: [Subject] + [Verb] + [Object]" },
  { id: 3, name: "Tiempo y Lugar", es: "4+ elementos: + [Time/Place]" },
  { id: 4, name: "Avanzados", es: "Condicionales y estructuras complejas" },
];

// Pools de slots compartidas (offline, 0 tokens). El usuario añade las suyas.
export const SLOT_POOLS = {
  subject: ["I", "You", "He", "She", "We", "They", "My mom", "The dog", "The kids"],
  object: ["water", "coffee", "tea", "milk", "soccer", "music", "books", "a movie", "the guitar", "breakfast"],
  time: ["every day", "in the morning", "at night", "on weekends", "right now", "yesterday"],
  place: ["at home", "at school", "in the kitchen", "in the park", "at work", "here"],
};

/* ---------- Restricciones semánticas (Semantic Constraints / Tags) ----------
   Un slot puede declarar qué categorías semánticas acepta: { k: "object",
   tag: "beverage" }. Un filler solo entra si SU nodo en el mapa tiene esa
   categoría (o un alias) — así "drink + ____" nunca produce "I drink math".
   Tags = categorías del mapa (cat) + alias en minúscula; matching tolerante. */
export const SEMANTIC_TAG_ALIASES = {
  beverage: ["drink", "beverage", "liquid", "juice"],
  food: ["food", "meal", "fruit", "meat"],
  animal: ["animal", "pet", "wildlife"],
  person: ["people", "person", "human", "family", "relationship"],
  place: ["place", "home", "travel", "transport", "school", "work"],
  time: ["time", "daily"],
  feeling: ["feelings", "emotion", "emotion", "opinion"],
  music: ["music", "song", "art"],
  tech: ["tech", "tech_tools", "technology", "money"],
  nature: ["nature", "space"],
  action: ["actions", "verb"],
};

function normalizeTag(t) {
  return String(t || "").toLowerCase().replace(/[^a-z_]/g, "");
}

// ¿El nodo (palabra del mapa) encaja con el tag semántico del slot?
export function nodeMatchesTag(node, tag) {
  if (!tag) return true; // slot sin restricción → acepta todo
  const wanted = [normalizeTag(tag), ...(SEMANTIC_TAG_ALIASES[normalizeTag(tag)] || [])];
  const nodeCats = [node?.cat, node?.tags].flat().filter(Boolean).map(normalizeTag);
  const nodePos = normalizeTag(node?.pos);
  // los verbos también encajan con el tag "action"
  if (nodePos === "verb" && (wanted.includes("action") || wanted.includes("verb"))) return true;
  return nodeCats.some((c) => wanted.includes(c));
}

// Filtra candidatos (strings) por el tag del slot, mirando sus nodos en el mapa.
export function filterByTag(candidates, slot, nodesById) {
  const tag = slot?.tag;
  if (!tag) return candidates;
  return candidates.filter((w) => nodeMatchesTag(nodesById?.[String(w).toLowerCase()] || { cat: w }, tag));
}

// ---- Scaffolds para niveles avanzados (B2/C1/C2): reemplazan el SVO infantil ----
// Claves = nivel del slot-system (4=Avanzados). Cada scaffold es una estructura
// compleja: condicionales, phrasal verbs, conectores formales, subordinadas.
// Convenciones: strings = texto fijo; { k: "object" } = slot libre (pool propia
// del scaffold). Los fillers del mapa solo entran si el slot lleva tag y encajan.
export const SLOT_SCAFFOLDS = {
  4: [
    { id: "adv-cond", es: "Si yo tuviera ____, todo sería diferente",
      frame: [{ k: "verb", fixed: "If I had" }, { k: "object" }, ", everything would be different"],
      objectPool: ["more time", "more money", "a second chance", "better luck", "more practice"], level: 4 },
    { id: "adv-mixed", es: "Condicional mixto (pasado → presente)",
      frame: [{ k: "verb", fixed: "If I had" }, { k: "object" }, "then, things would be better now"],
      objectPool: ["studied harder", "saved more", "started earlier", "listened to advice"], level: 4 },
    { id: "adv-phrasal", es: "Phrasal verb: dar con / inventar",
      frame: [{ k: "subject" }, { k: "verb", fixed: "come up with" }, { k: "object" }],
      objectPool: ["an idea", "a solution", "a plan", "a compromise", "an alternative"], level: 4 },
    { id: "adv-formal", es: "Conector formal: therefore",
      frame: [{ k: "verb", fixed: "The project is" }, { k: "object" }, ", and therefore we postponed it"],
      objectPool: ["too expensive", "too risky", "incomplete", "behind schedule"], level: 4 },
    { id: "adv-subord", es: "Subordinada concesiva: Although",
      frame: [{ k: "verb", fixed: "Although the day was" }, { k: "object" }, ", we kept practicing"],
      objectPool: ["long", "busy", "difficult", "stressful"], level: 4 },
  ],
};

// Conjugación 3ª persona (he/she/it) para no romper la gramática al sustituir
// el subject: los verbos en 3ª persona añaden -s/-es. Simple y local.
export function conjugateVerb(verb, subject) {
  const third = /^(he|she|it|my mom|the dog|the kids|this)$/i.test(String(subject).trim());
  if (!third) return verb;
  const v = String(verb).trim();
  if (/(s|x|z|ch|sh|o)$/i.test(v)) return v + "es";
  if (/[^aeiou]y$/i.test(v)) return v.slice(0, -1) + "ies";
  return v + "s";
}

// Sustituye el subject en el frame: los slots verb aplican conjugación,
// INCLUIDO el verbo fijo de la plantilla (drink → drinks con he/she).
export function fillFrame(frame, picks) {
  // picks: { subject, object, time, place } — strings elegidos por slot
  const parts = frame.map((slot) => {
    if (typeof slot === "string") return slot; // literal dentro del frame (legacy)
    const { k, fixed } = slot;
    if (k === "verb") {
      const base = fixed || picks.verb;
      if (!base) return `____`;
      return conjugateVerb(base, picks.subject);
    }
    const val = picks[k];
    if (val) return val;
    return `____`;
  });
  // puntuación pegada a la palabra anterior: "more time , everything" → "more time, everything"
  return parts.join(" ").replace(/\s+,/g, ",").replace(/\s+/g, " ").trim();
}

// Genera combinaciones dinámicas para practicar (drills): cambia un slot a la vez.
export function generateDrills(frame, picks, count = 6) {
  const out = [];
  // 1) la combinación actual
  out.push({ picks: { ...picks }, text: fillFrame(frame, picks) });
  // Simplificación: el caller usa buildDrills(tpl) para variar por pool.
  return out;
}

// Regenera N drills variando cada slot con opciones de las pools de la plantilla.
// Slot & Filler dinámico: `mapWords` son las palabras registradas en el mapa
// mental del usuario — se usan como fillers del hueco SOLO SI encajan con la
// categoría semántica del slot (slot.tag → nodeMatchesTag vía nodesById).
// Así "drink + ____" nunca produce "I drink math": math no es Noun:Beverage.
export function buildDrills(tpl, count = 6, mapWords = [], nodesById = {}) {
  const out = [];
  const tplObjectPool = tpl.objectPool || SLOT_POOLS.object;
  const objectSlot = (tpl.frame || []).find((s) => typeof s !== "string" && s.k === "object");
  // palabras del mapa FILTRADAS por el tag del slot (si el slot lo declara),
  // luego la pool de la plantilla (siempre segura — es la del propio patrón)
  const fromMap = mapWords.length && objectSlot
    ? filterByTag(mapWords, objectSlot, nodesById).slice(0, 20)
    : [];
  const mergedObjectPool = fromMap.length
    ? [...fromMap, ...tplObjectPool].filter((w, i, a) => a.indexOf(w) === i)
    : tplObjectPool;
  const pools = {
    subject: tpl.subjectPool || SLOT_POOLS.subject,
    object: mergedObjectPool,
    time: tpl.timePool || [],
    place: tpl.placePool || [],
  };
  const basePicks = {
    subject: pools.subject[0] || "I",
    verb: null,
    object: pools.object[0] || "",
    time: pools.time[0] || "",
    place: pools.place[0] || "",
  };
  // primera combinación (los primeros de cada pool)
  out.push({ picks: { ...basePicks }, text: fillFrame(tpl.frame, basePicks) });
  // drills: para cada slot con >1 opción, sustituir con las demás
  for (const k of Object.keys(pools)) {
    const pool = pools[k];
    for (let i = 1; i < pool.length && out.length < count; i++) {
      const picks = { ...basePicks, [k]: pool[i] };
      out.push({ picks, text: fillFrame(tpl.frame, picks) });
    }
  }
  return out;
}

// Scaffolds disponibles para un nivel del slot-system: el 4 (Avanzados) usa
// las estructuras complejas de SLOT_SCAFFOLDS en vez de repetir el SVO básico.
export function scaffoldsForLevel(lvl) {
  if (lvl === 4) return SLOT_SCAFFOLDS[4] || [];
  return [];
}

// Convierte el texto "I drink ____ in the morning" del creador del usuario a
// slots: palabras fijas + slots (____ mapea al siguiente slot libre según orden).
export function parseUserFrame(text) {
  const words = String(text || "").trim().split(/\s+/);
  const freeSlotOrder = ["object", "time", "place"]; // el primer ____ suele ser el objeto
  let slotIdx = 0;
  const frame = [];
  for (const w of words) {
    if (/^_{2,}$/.test(w)) {
      const k = freeSlotOrder[Math.min(slotIdx, freeSlotOrder.length - 1)];
      frame.push({ k });
      slotIdx++;
    } else {
      frame.push({ k: "verb", fixed: w });
    }
  }
  return frame;
}

// Convierte slots de vuelta a texto con ____ (para mostrar/editar).
export function frameToText(frame) {
  return frame
    .map((s) => (typeof s === "string" ? s : s.k === "verb" && s.fixed ? s.fixed : "____"))
    .join(" ");
}

// Nivel auto-detectado para una plantilla (por nº de slots y estructura).
export function autoLevel(tpl) {
  if (tpl.level) return tpl.level;
  const n = (tpl.frame || []).filter((s) => typeof s !== "string").length;
  const text = frameToText(tpl.frame || []).toLowerCase();
  if (/^if | would | will | wish|used to/.test(text)) return 4;
  if (n >= 4) return 3;
  if (n === 3) return 2;
  return 1;
}

/* ---------- Plantillas semilla (formato slots) ----------
   Cuatro niveles del spec: Fundacionales (2 slots), SVO Básicos (3),
   Tiempo/Lugar (4+), Avanzados (condicionales). 100% local, 0 tokens. */
export const SEED_PATTERNS = [
  // Nivel 1 — Fundacionales: [Subject] + [Action]
  { id: "f1", es: "Yo corro", frame: [{ k: "subject" }, { k: "verb", fixed: "run" }], level: 1 },
  { id: "f2", es: "Los perros ladran", frame: [{ k: "subject" }, { k: "verb", fixed: "bark" }], level: 1 },
  { id: "f3", es: "Ella canta", frame: [{ k: "subject" }, { k: "verb", fixed: "sing" }], level: 1 },
  { id: "f4", es: "Ellos duermen", frame: [{ k: "subject" }, { k: "verb", fixed: "sleep" }], level: 1 },
  // Nivel 2 — SVO Básicos: [Subject] + [Verb] + [Object]
  { id: "s1", es: "Yo tomo café", frame: [{ k: "subject" }, { k: "verb", fixed: "drink" }, { k: "object" }], level: 2 },
  { id: "s2", es: "Yo como pan", frame: [{ k: "subject" }, { k: "verb", fixed: "eat" }, { k: "object" }], level: 2 },
  { id: "s3", es: "Ella lee libros", frame: [{ k: "subject" }, { k: "verb", fixed: "read" }, { k: "object" }], level: 2 },
  { id: "s4", es: "Nosotros vemos películas", frame: [{ k: "subject" }, { k: "verb", fixed: "watch" }, { k: "object" }], level: 2 },
  { id: "s5", es: "A ella le gusta la música", frame: [{ k: "subject" }, { k: "verb", fixed: "like" }, { k: "object" }], level: 2 },
  // Nivel 3 — Tiempo y Lugar: + [Time/Place]
  { id: "t1", es: "Yo tomo café en la mañana", frame: [{ k: "subject" }, { k: "verb", fixed: "drink" }, { k: "object" }, { k: "time" }], level: 3 },
  { id: "t2", es: "Ella estudia en la biblioteca", frame: [{ k: "subject" }, { k: "verb", fixed: "study" }, { k: "time" }], level: 3 },
  { id: "t3", es: "Ellos juegan en el parque", frame: [{ k: "subject" }, { k: "verb", fixed: "play" }, { k: "place" }], level: 3 },
  { id: "t4", es: "Nosotros cenamos en casa", frame: [{ k: "subject" }, { k: "verb", fixed: "have" }, { k: "object" }, { k: "place" }], level: 3 },
  // Nivel 4 — Avanzados: condicionales y complejos
  { id: "a1", es: "Si yo estudio, aprobaré", frame: [{ k: "subject" }, { k: "verb", fixed: "if" }], level: 4 },
  { id: "a2", es: "Ojalá tuviera tiempo", frame: [{ k: "verb", fixed: "I wish I had" }, { k: "object" }], level: 4 },
  { id: "a3", es: "He estado trabajando aquí", frame: [{ k: "verb", fixed: "I have been" }, { k: "object" }], level: 4 },
  { id: "a4", es: "Yo solía correr", frame: [{ k: "verb", fixed: "I used to" }, { k: "verb", fixed: "run" }], level: 4 },
];