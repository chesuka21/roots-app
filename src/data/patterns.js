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
  return parts.join(" ").replace(/\s+/g, " ").trim();
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
export function buildDrills(tpl, count = 6) {
  const out = [];
  const pools = {
    subject: tpl.subjectPool || SLOT_POOLS.subject,
    object: tpl.objectPool || SLOT_POOLS.object,
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