/* ---------- Diccionario local por idioma (wordbank v2) ----------
   Base de datos offline de palabras comunes: evita llamar a la IA (y gastar
   tokens/tiempo) para vocabulario habitual. Para derivar a Excel/CSV basta
   exportar este objeto. Formato por entrada (v2):
     { en, def, defEs, cat, pos, commonObjects? }
   - pos: "noun" | "verb" | "adj" | "adv" | "pron"  ← habilita el grafo tipado
   - commonObjects (verbos transitivos): objetos naturales para esa acción
   Las claves están en minúscula (el id/word normalizado coincide). */

export const WORDBANK_EN = {
  water:     { en: "water",     pos: "noun", cat: "drink", def: "the clear liquid you drink",              defEs: "el líquido claro que bebes" },
  juice:     { en: "juice",     pos: "noun", cat: "drink", def: "a drink made from fruit",                 defEs: "una bebida hecha de fruta" },
  coffee:    { en: "coffee",    pos: "noun", cat: "drink", def: "a hot drink made from roasted beans",     defEs: "una bebida caliente hecha de granos tostados" },
  tea:       { en: "tea",       pos: "noun", cat: "drink", def: "a hot drink made with leaves in water",   defEs: "una bebida caliente hecha con hojas en agua" },
  milk:      { en: "milk",      pos: "noun", cat: "drink", def: "a white drink that comes from cows",      defEs: "una bebida blanca que viene de las vacas" },
  bread:     { en: "bread",     pos: "noun", cat: "food",  def: "a baked food made from flour and water",  defEs: "una comida horneada hecha de harina y agua" },
  rice:      { en: "rice",      pos: "noun", cat: "food",  def: "small white grains you cook and eat",     defEs: "granos blancos pequeños que se cocinan y se comen" },
  fruit:     { en: "fruit",     pos: "noun", cat: "food",  def: "the sweet part of a plant you can eat",   defEs: "la parte dulce de una planta que puedes comer" },
  apple:     { en: "apple",     pos: "noun", cat: "food",  def: "a round fruit with red or green skin",    defEs: "una fruta redonda con piel roja o verde" },
  egg:       { en: "egg",       pos: "noun", cat: "food",  def: "the round object a bird lays to have babies", defEs: "objeto redondo que pone un ave para tener crías" },
  meat:      { en: "meat",      pos: "noun", cat: "food",  def: "the flesh of animals used as food",       defEs: "la carne de animales usada como comida" },
  fish:      { en: "fish",      pos: "noun", cat: "food",  def: "an animal that lives and swims in water", defEs: "un animal que vive y nada en el agua" },
  salt:      { en: "salt",      pos: "noun", cat: "food",  def: "white grains that add flavor to food",    defEs: "granos blancos que dan sabor a la comida" },
  sugar:     { en: "sugar",     pos: "noun", cat: "food",  def: "sweet white grains used to make food sweet", defEs: "granos blancos dulces para endulzar la comida" },
  breakfast: { en: "breakfast", pos: "noun", cat: "food",  def: "the first meal of the day",               defEs: "la primera comida del día" },
  lunch:     { en: "lunch",     pos: "noun", cat: "food",  def: "the meal you eat in the middle of the day", defEs: "la comida del mediodía" },
  dinner:    { en: "dinner",    pos: "noun", cat: "food",  def: "the main meal you eat in the evening",    defEs: "la comida principal de la noche" },
  kitchen:   { en: "kitchen",   pos: "noun", cat: "place", def: "a room where food is cooked",             defEs: "una habitación donde se cocina comida" },
  recipe:    { en: "recipe",    pos: "noun", cat: "food",  def: "a set of steps for making a certain food", defEs: "un conjunto de pasos para preparar cierta comida" },
  flavor:    { en: "flavor",    pos: "noun", cat: "food",  def: "how food or drink tastes",                defEs: "cómo sabe una comida o bebida" },
  hungry:    { en: "hungry",    pos: "adj",  cat: "feelings", def: "feeling like you need to eat",            defEs: "sentir que necesitas comer" },
  eat:       { en: "eat",       pos: "verb", cat: "food", def: "to put food in your mouth and swallow it", defEs: "meter comida en la boca y tragarla", commonObjects: ["breakfast","lunch","dinner","bread","rice","fruit","apple","egg","meat","fish"] },
  drink:     { en: "drink",     pos: "verb", cat: "food", def: "to take liquid into your mouth and swallow it", defEs: "tomar líquido por la boca y tragarlo", commonObjects: ["water","juice","coffee","tea","milk"] },
  cook:      { en: "cook",      pos: "verb", cat: "food", def: "to prepare food with heat",               defEs: "preparar comida con calor",           commonObjects: ["dinner","lunch","breakfast","rice","meat","fish","egg"] },

  happy:     { en: "happy",     pos: "adj", cat: "feelings", def: "feeling good or pleased",                 defEs: "sentirse bien o contento" },
  sad:       { en: "sad",       pos: "adj", cat: "feelings", def: "feeling unhappy",                         defEs: "sentirse triste" },
  excited:   { en: "excited",   pos: "adj", cat: "feelings", def: "feeling very happy about something coming soon", defEs: "muy feliz por algo que va a pasar pronto" },
  angry:     { en: "angry",     pos: "adj", cat: "feelings", def: "feeling very annoyed or mad",             defEs: "sentirse muy molesto o enojado" },
  tired:     { en: "tired",     pos: "adj", cat: "feelings", def: "feeling you need rest or sleep",          defEs: "sentir que necesitas descanso" },
  calm:      { en: "calm",      pos: "adj", cat: "feelings", def: "quiet and free of worry",                 defEs: "tranquilo y sin preocupaciones" },
  worried:   { en: "worried",   pos: "adj", cat: "feelings", def: "feeling concerned about something",       defEs: "preocupado por algo" },
  afraid:    { en: "afraid",    pos: "adj", cat: "feelings", def: "feeling scared or frightened",            defEs: "sentirse asustado" },
  proud:     { en: "proud",     pos: "adj", cat: "feelings", def: "feeling good about something you did",    defEs: "sentirse bien por algo que hiciste" },
  stress:    { en: "stress",    pos: "noun", cat: "feelings", def: "a feeling of worry or pressure",          defEs: "una sensación de preocupación o presión" },
  love:      { en: "love",      pos: "verb", cat: "feelings", def: "a very strong good feeling for someone",  defEs: "un sentimiento muy fuerte y bueno por alguien", commonObjects: ["you","her","him","them","music","my family"] },
  like:      { en: "like",      pos: "verb", cat: "feelings", def: "to enjoy something or someone",           defEs: "disfrutar algo o a alguien",         commonObjects: ["coffee","music","books","movies","my job"] },
};

/* Búsqueda local normalizada: devuelve la entrada o null. */
export function lookupLocalWord(word) {
  if (!word) return null;
  const key = String(word).trim().toLowerCase();
  const hit = WORDBANK_EN[key];
  return hit && hit.en ? hit : null;
}

/* ---------- Conjugación verbal (tiempos del verbo) ----------
   Al guardar/inspeccionar un verbo se almacenan sus formas: past,
   past_participle, gerund, present_3rd. Los IRREGULARES van en tabla
   exacta; el resto sigue reglas de -ed/-ing/-s. Sin IA para el local. */
const IRREGULAR_VERBS = {
  be: { past: "was/were", past_participle: "been", gerund: "being", present_3rd: "is" },
  do: { past: "did", past_participle: "done", gerund: "doing", present_3rd: "does" },
  go: { past: "went", past_participle: "gone", gerund: "going", present_3rd: "goes" },
  have: { past: "had", past_participle: "had", gerund: "having", present_3rd: "has" },
  say: { past: "said", past_participle: "said", gerund: "saying", present_3rd: "says" },
  get: { past: "got", past_participle: "gotten", gerund: "getting", present_3rd: "gets" },
  make: { past: "made", past_participle: "made", gerund: "making", present_3rd: "makes" },
  know: { past: "knew", past_participle: "known", gerund: "knowing", present_3rd: "knows" },
  take: { past: "took", past_participle: "taken", gerund: "taking", present_3rd: "takes" },
  see: { past: "saw", past_participle: "seen", gerund: "seeing", present_3rd: "sees" },
  come: { past: "came", past_participle: "come", gerund: "coming", present_3rd: "comes" },
  think: { past: "thought", past_participle: "thought", gerund: "thinking", present_3rd: "thinks" },
  look: { past: "looked", past_participle: "looked", gerund: "looking", present_3rd: "looks" },
  want: { past: "wanted", past_participle: "wanted", gerund: "wanting", present_3rd: "wants" },
  give: { past: "gave", past_participle: "given", gerund: "giving", present_3rd: "gives" },
  find: { past: "found", past_participle: "found", gerund: "finding", present_3rd: "finds" },
  tell: { past: "told", past_participle: "told", gerund: "telling", present_3rd: "tells" },
  become: { past: "became", past_participle: "become", gerund: "becoming", present_3rd: "becomes" },
  leave: { past: "left", past_participle: "left", gerund: "leaving", present_3rd: "leaves" },
  put: { past: "put", past_participle: "put", gerund: "putting", present_3rd: "puts" },
  bring: { past: "brought", past_participle: "brought", gerund: "bringing", present_3rd: "brings" },
  begin: { past: "began", past_participle: "begun", gerund: "beginning", present_3rd: "begins" },
  write: { past: "wrote", past_participle: "written", gerund: "writing", present_3rd: "writes" },
  sit: { past: "sat", past_participle: "sat", gerund: "sitting", present_3rd: "sits" },
  stand: { past: "stood", past_participle: "stood", gerund: "standing", present_3rd: "stands" },
  lose: { past: "lost", past_participle: "lost", gerund: "losing", present_3rd: "loses" },
  buy: { past: "bought", past_participle: "bought", gerund: "buying", present_3rd: "buys" },
  sell: { past: "sold", past_participle: "sold", gerund: "selling", present_3rd: "sells" },
  eat: { past: "ate", past_participle: "eaten", gerund: "eating", present_3rd: "eats" },
  drink: { past: "drank", past_participle: "drunk", gerund: "drinking", present_3rd: "drinks" },
  sleep: { past: "slept", past_participle: "slept", gerund: "sleeping", present_3rd: "sleeps" },
  drive: { past: "drove", past_participle: "driven", gerund: "driving", present_3rd: "drives" },
  read: { past: "read", past_participle: "read", gerund: "reading", present_3rd: "reads" },
  speak: { past: "spoke", past_participle: "spoken", gerund: "speaking", present_3rd: "speaks" },
  fly: { past: "flew", past_participle: "flown", gerund: "flying", present_3rd: "flies" },
  grow: { past: "grew", past_participle: "grown", gerund: "growing", present_3rd: "grows" },
  draw: { past: "drew", past_participle: "drawn", gerund: "drawing", present_3rd: "draws" },
  run: { past: "ran", past_participle: "run", gerund: "running", present_3rd: "runs" },
  sing: { past: "sang", past_participle: "sung", gerund: "singing", present_3rd: "sings" },
  swim: { past: "swam", past_participle: "swum", gerund: "swimming", present_3rd: "swims" },
  teach: { past: "taught", past_participle: "taught", gerund: "teaching", present_3rd: "teaches" },
  catch: { past: "caught", past_participle: "caught", gerund: "catching", present_3rd: "catches" },
  fall: { past: "fell", past_participle: "fallen", gerund: "falling", present_3rd: "falls" },
  wear: { past: "wore", past_participle: "worn", gerund: "wearing", present_3rd: "wears" },
  choose: { past: "chose", past_participle: "chosen", gerund: "choosing", present_3rd: "chooses" },
  forget: { past: "forgot", past_participle: "forgotten", gerund: "forgetting", present_3rd: "forgets" },
  forgive: { past: "forgave", past_participle: "forgiven", gerund: "forgiving", present_3rd: "forgives" },
  cut: { past: "cut", past_participle: "cut", gerund: "cutting", present_3rd: "cuts" },
  shut: { past: "shut", past_participle: "shut", gerund: "shutting", present_3rd: "shuts" },
  hit: { past: "hit", past_participle: "hit", gerund: "hitting", present_3rd: "hits" },
  spin: { past: "spun", past_participle: "spun", gerund: "spinning", present_3rd: "spins" },
  win: { past: "won", past_participle: "won", gerund: "winning", present_3rd: "wins" },
  throw: { past: "threw", past_participle: "thrown", gerund: "throwing", present_3rd: "throws" },
  feel: { past: "felt", past_participle: "felt", gerund: "feeling", present_3rd: "feels" },
  keep: { past: "kept", past_participle: "kept", gerund: "keeping", present_3rd: "keeps" },
  meet: { past: "met", past_participle: "met", gerund: "meeting", present_3rd: "meets" },
  pay: { past: "paid", past_participle: "paid", gerund: "paying", present_3rd: "pays" },
  send: { past: "sent", past_participle: "sent", gerund: "sending", present_3rd: "sends" },
  spend: { past: "spent", past_participle: "spent", gerund: "spending", present_3rd: "spends" },
  build: { past: "built", past_participle: "built", gerund: "building", present_3rd: "builds" },
  learn: { past: "learned/learnt", past_participle: "learned/learnt", gerund: "learning", present_3rd: "learns" },
  mean: { past: "meant", past_participle: "meant", gerund: "meaning", present_3rd: "means" },
  hear: { past: "heard", past_participle: "heard", gerund: "hearing", present_3rd: "hears" },
  leave_early: null, // placeholder para evitar claves duplicadas
  try: { past: "tried", past_participle: "tried", gerund: "trying", present_3rd: "tries" },
  carry: { past: "carried", past_participle: "carried", gerund: "carrying", present_3rd: "carries" },
  marry: { past: "married", past_participle: "married", gerund: "marrying", present_3rd: "marries" },
  play: { past: "played", past_participle: "played", gerund: "playing", present_3rd: "plays" },
  show: { past: "showed", past_participle: "shown", gerund: "showing", present_3rd: "shows" },
};

// Formas del verbo: irregular de la tabla si existe; si no, reglas regulares.
// Devuelve { present, past, past_participle, gerund, present_3rd }.
export function verbForms(verb) {
  const v = String(verb || "").trim().toLowerCase().replace(/^to /, "");
  if (!v) return null;
  if (IRREGULAR_VERBS[v]) return { present: v, ...IRREGULAR_VERBS[v] };
  // regulares: -e → -d/-ing (make → made/making); consonant+y → -ied (try → tried);
  // CVC cortos duplican (stop→stopped, plan→planned) si NO están en la tabla
  const isVowel = (c) => "aeiou".includes(c);
  let past;
  if (/(s|x|z|ch|sh)$/.test(v)) past = v + "ed";
  else if (/[^aeiou]y$/.test(v)) past = v.slice(0, -1) + "ied";
  else if (/(?:[aeiou][bdcfghjklmnpqrstvwxz])$/.test(v) && v.length <= 4 && !IRREGULAR_VERBS[v]) past = v + v.slice(-1) + "ed";
  else past = v.replace(/e$/, "") + "ed";
  const gerund = /ee$/.test(v) ? v + "ing" : v.replace(/e$/, "") + "ing";
  let present_3rd;
  if (/(s|x|z|ch|sh|o)$/.test(v)) present_3rd = v + "es";
  else if (/[^aeiou]y$/.test(v)) present_3rd = v.slice(0, -1) + "ies";
  else present_3rd = v + "s";
  return { present: v, past, past_participle: past, gerund, present_3rd };
}

/* Pronombres/sujetos comunes para los patterns (no son "palabras a aprender"
   pero sí agentes válidos). El generador los usa para el slot "agent". */
export const COMMON_AGENTS = ["I", "you", "he", "she", "we", "they", "my mom", "my dad", "the baby", "the dog"];

export function wordsByCategory(cat) {
  if (!cat) return [];
  return Object.values(WORDBANK_EN)
    .filter((w) => w && w.en && w.cat === cat)
    .map((w) => w.en);
}