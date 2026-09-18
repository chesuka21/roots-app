/* ---------- Diccionario local por idioma ----------
   Base de datos offline de palabras comunes: evita llamar a la IA (y gastar
   tokens/tiempo) para vocabulario habitual. Para derivar a Excel/CSV basta
   exportar este objeto. Formato por entrada: { en, def, defEs, cat }.
   Las claves están en minúscula (el id/word normalizado coincide). */

export const WORDBANK_EN = {
  water:     { en: "water",     def: "the clear liquid you drink",              defEs: "el líquido claro que bebes",          cat: "food" },
  juice:     { en: "juice",     def: "a drink made from fruit",                 defEs: "una bebida hecha de fruta",            cat: "food" },
  coffee:    { en: "coffee",    def: "a hot drink made from roasted beans",     defEs: "una bebida caliente hecha de granos tostados", cat: "food" },
  tea:       { en: "tea",       def: "a hot drink made with leaves in water",   defEs: "una bebida caliente hecha con hojas en agua", cat: "food" },
  milk:      { en: "milk",      def: "a white drink that comes from cows",      defEs: "una bebida blanca que viene de las vacas", cat: "food" },
  bread:     { en: "bread",     def: "a baked food made from flour and water",  defEs: "una comida horneada hecha de harina y agua", cat: "food" },
  rice:      { en: "rice",      def: "small white grains you cook and eat",     defEs: "granos blancos pequeños que se cocinan y se comen", cat: "food" },
  fruit:     { en: "fruit",     def: "the sweet part of a plant you can eat",   defEs: "la parte dulce de una planta que puedes comer", cat: "food" },
  apple:     { en: "apple",     def: "a round fruit with red or green skin",    defEs: "una fruta redonda con piel roja o verde", cat: "food" },
  egg:       { en: "egg",       def: "the round object a bird lays to have babies", defEs: "objeto redondo que pone un ave para tener crías", cat: "food" },
  meat:      { en: "meat",      def: "the flesh of animals used as food",       defEs: "la carne de animales usada como comida", cat: "food" },
  fish:      { en: "fish",      def: "an animal that lives and swims in water", defEs: "un animal que vive y nada en el agua", cat: "food" },
  salt:      { en: "salt",      def: "white grains that add flavor to food",    defEs: "granos blancos que dan sabor a la comida", cat: "food" },
  sugar:     { en: "sugar",     def: "sweet white grains used to make food sweet", defEs: "granos blancos dulces para endulzar la comida", cat: "food" },
  breakfast: { en: "breakfast", def: "the first meal of the day",               defEs: "la primera comida del día",            cat: "food" },
  lunch:     { en: "lunch",     def: "the meal you eat in the middle of the day", defEs: "la comida del mediodía",            cat: "food" },
  dinner:    { en: "dinner",    def: "the main meal you eat in the evening",    defEs: "la comida principal de la noche",     cat: "food" },
  kitchen:   { en: "kitchen",   def: "a room where food is cooked",             defEs: "una habitación donde se cocina comida", cat: "food" },
  recipe:    { en: "recipe",    def: "a set of steps for making a certain food", defEs: "un conjunto de pasos para preparar cierta comida", cat: "food" },
  flavor:    { en: "flavor",    def: "how food or drink tastes",                defEs: "cómo sabe una comida o bebida",       cat: "food" },
  hungry:    { en: "hungry",    def: "feeling like you need to eat",            defEs: "sentir que necesitas comer",          cat: "food" },
  eat:       { en: "eat",       def: "to put food in your mouth and swallow it", defEs: "meter comida en la boca y tragarla", cat: "food" },
  drink:     { en: "drink",     def: "to take liquid into your mouth and swallow it", defEs: "tomar líquido por la boca y tragarlo", cat: "food" },
  cook:      { en: "cook",      def: "to prepare food with heat",               defEs: "preparar comida con calor",           cat: "food" },

  happy:     { en: "happy",     def: "feeling good or pleased",                 defEs: "sentirse bien o contento",           cat: "feelings" },
  sad:       { en: "sad",       def: "feeling unhappy",                         defEs: "sentirse triste",                    cat: "feelings" },
  excited:   { en: "excited",   def: "feeling very happy about something coming soon", defEs: "muy feliz por algo que va a pasar pronto", cat: "feelings" },
  angry:     { en: "angry",     def: "feeling very annoyed or mad",             defEs: "sentirse muy molesto o enojado",     cat: "feelings" },
  tired:     { en: "tired",     def: "feeling you need rest or sleep",          defEs: "sentir que necesitas descanso",      cat: "feelings" },
  calm:      { en: "calm",      def: "quiet and free of worry",                 defEs: "tranquilo y sin preocupaciones",     cat: "feelings" },
  worried:   { en: "worried",   def: "feeling concerned about something",       defEs: "preocupado por algo",                cat: "feelings" },
  afraid:    { en: "afraid",    def: "feeling scared or frightened",            defEs: "sentirse asustado",                  cat: "feelings" },
  proud:     { en: "proud",     def: "feeling good about something you did",    defEs: "sentirse bien por algo que hiciste", cat: "feelings" },
  stress:    { en: "stress",    def: "a feeling of worry or pressure",          defEs: "una sensación de preocupación o presión", cat: "feelings" },
  love:      { en: "love",      def: "a very strong good feeling for someone",  defEs: "un sentimiento muy fuerte y bueno por alguien", cat: "feelings" },
  like:      { en: "like",      def: "to enjoy something or someone",           defEs: "disfrutar algo o a alguien",         cat: "feelings" },
  happy2_example_dummy: null
};

/* Búsqueda local normalizada: devuelve la entrada o null. */
export function lookupLocalWord(word) {
  if (!word) return null;
  const key = String(word).trim().toLowerCase();
  const hit = WORDBANK_EN[key];
  return hit && hit.en ? hit : null;
}

/* Devuelve las categorías presentes en el banco (para unir palabras afines sin IA). */
export function wordsByCategory(cat) {
  if (!cat) return [];
  return Object.values(WORDBANK_EN)
    .filter((w) => w && w.en && w.cat === cat)
    .map((w) => w.en);
}