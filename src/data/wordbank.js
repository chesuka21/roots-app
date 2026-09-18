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

/* Pronombres/sujetos comunes para los patterns (no son "palabras a aprender"
   pero sí agentes válidos). El generador los usa para el slot "agent". */
export const COMMON_AGENTS = ["I", "you", "he", "she", "we", "they", "my mom", "my dad", "the baby", "the dog"];

export function wordsByCategory(cat) {
  if (!cat) return [];
  return Object.values(WORDBANK_EN)
    .filter((w) => w && w.en && w.cat === cat)
    .map((w) => w.en);
}