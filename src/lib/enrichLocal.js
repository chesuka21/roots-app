/* ---------- Fallback LOCAL de enriquecimiento (0 tokens, sin IA) ----------
   Último eslabón del guardado en lote (Suggest Word): si ni el banco local
   (WORDBANK_EN) ni la IA resolvieron una palabra, aquí se infieren POS y
   categoría temática para que NUNCA entre al mapa vacía
   (pos null / cat "custom" / sin query de imagen).

   Por qué NO basta `includes`: produce falsos positivos — "teacher" contiene
   "tea" → food, "happiness" contiene "app" → technology. Por eso se compara
   por palabra completa y con scoring: coincidencia exacta > forma flexionada.
   ------------------------------------------------------------------------- */

/* POS: primero palabras funcionales/verbos frecuentes sin señal morfológica,
   después sufijos productivos, y por último el sustantivo (clase más común). */
const FUNCTION_WORDS = {
  adverb: ["how", "when", "where", "why", "very", "always", "never", "often", "sometimes", "already", "still", "just", "also", "again", "soon", "today", "yesterday", "tomorrow", "here", "there", "now", "then", "twice", "once"],
  verb: ["have", "do", "go", "get", "make", "know", "take", "see", "come", "think", "look", "want", "give", "use", "find", "tell", "ask", "seem", "feel", "try", "leave", "call", "need", "become", "mean", "keep", "let", "begin", "show", "hear", "play", "run", "move", "live", "believe", "bring", "happen", "write", "provide", "sit", "stand", "lose", "pay", "meet", "include", "continue", "set", "learn", "change", "lead", "understand", "watch", "follow", "stop", "create", "speak", "read", "allow", "add", "spend", "grow", "open", "walk", "win", "offer", "remember", "love", "consider", "appear", "buy", "wait", "serve", "send", "expect", "build", "stay", "fall", "cut", "reach", "kill", "remain", "borrow", "lend", "teach", "eat", "drink", "cook", "sleep", "wake", "drive", "fly", "swim", "sing", "dance", "laugh", "cry", "smile", "choose", "decide", "forget", "promise", "refuse", "accept", "arrive", "depart", "travel", "visit", "invite", "answer", "explain", "describe", "compare", "improve", "prepare", "deliver", "collect", "protect", "repair"],
  adjective: ["eager", "reluctant", "glad", "sad", "happy", "angry", "tired", "afraid", "sure", "ready", "busy", "free", "late", "early", "right", "wrong", "true", "false", "possible", "important", "different", "similar", "difficult", "easy", "expensive", "cheap", "comfortable", "dangerous", "delicious", "famous", "foreign", "healthy", "hungry", "thirsty", "lonely", "lucky", "nervous", "polite", "proud", "quiet", "serious", "strange", "strong", "weak", "wide", "narrow", "deep", "shallow", "bright", "dark", "soft", "hard", "smooth", "rough", "fresh", "dirty", "clean", "safe", "careful", "careless", "useful", "useless", "harmful", "hopeless"],
};
const POS_SUFFIX_RULES = [
  [/(ly)$/, "adverb"],
  [/(ing|ed)$/, "verb"],
  [/(tion|sion|ness|ity|ment|ance|ence|ship|hood|ism|ist|ology)$/, "noun"],
  // Solo sufijos inequívocamente adjetivales: "-al/-ic/-ish/-ary" se omiten a
  // propósito (darían falsos positivos: hospital, capital, animal → noun).
  [/(ful|ous|ive|able|ible|less)$/, "adjective"],
];
const PARTICLE = /^(up|out|on|off|in|over|away|back|down|through|for|with|at|to|into|about|after|before|around|by|from|of|along|across)$/;

export function inferPosLocal(word) {
  const w = String(word || "").toLowerCase().trim();
  if (!w) return null;
  const parts = w.split(/\s+/);
  if (parts.length > 1) return parts.length === 2 && PARTICLE.test(parts[1]) ? "phrasal verb" : "idiom";
  for (const [pos, list] of Object.entries(FUNCTION_WORDS)) if (list.includes(w)) return pos;
  for (const [re, pos] of POS_SUFFIX_RULES) if (re.test(w)) return pos;
  return "noun"; // clase más común cuando no hay señal morfológica
}

/* Categoría temática por palabras clave (alineada con las categorías de WORDBANK
   y las que usa el mapa para agrupar/colorear). Default: "general". */
const CATEGORY_HINTS = {
  food: ["eat", "drink", "food", "apple", "bread", "rice", "meat", "fish", "salt", "sugar", "meal", "breakfast", "lunch", "dinner", "kitchen", "recipe", "taste", "hungry", "cook", "coffee", "tea", "milk", "juice", "fruit", "egg", "plate", "restaurant", "menu", "cheese", "soup", "salad", "cake", "snack", "flour", "oil", "pepper", "dessert", "flavor"],
  drink: ["water", "beer", "wine", "cup", "glass", "thirsty", "bottle", "soda"],
  family: ["mother", "father", "mom", "dad", "sister", "brother", "son", "daughter", "child", "baby", "wife", "husband", "aunt", "uncle", "cousin", "nephew", "niece", "grandma", "grandpa", "parent", "family", "relative", "twin", "widow"],
  school: ["school", "student", "teacher", "teach", "class", "lesson", "homework", "exam", "study", "learn", "book", "pen", "pencil", "university", "grade", "notebook", "library", "course", "degree", "essay", "dictionary", "backpack"],
  work: ["work", "job", "office", "boss", "meeting", "salary", "company", "career", "colleague", "deadline", "project", "business", "client", "interview", "hire", "employee", "manager", "task", "schedule", "promotion", "resign"],
  feelings: ["happy", "sad", "angry", "tired", "excited", "nervous", "proud", "worried", "afraid", "love", "hate", "feel", "mood", "glad", "upset", "calm", "jealous", "eager", "reluctant", "lonely", "embarrassed", "confused", "grateful", "bored", "shy", "hopeful", "disappointed", "relieved"],
  travel: ["travel", "trip", "airport", "plane", "flight", "hotel", "ticket", "passport", "luggage", "train", "bus", "station", "map", "tourist", "beach", "holiday", "vacation", "abroad", "journey", "route", "suitcase", "visa", "sightseeing"],
  home: ["home", "house", "room", "kitchen", "bedroom", "door", "window", "table", "chair", "bed", "sofa", "floor", "wall", "key", "garden", "roof", "stairs", "furniture", "mirror", "lamp", "curtain", "shelf", "drawer", "couch", "pillow", "blanket"],
  nature: ["tree", "forest", "river", "mountain", "sky", "sea", "ocean", "flower", "grass", "rain", "snow", "wind", "sun", "moon", "star", "animal", "bird", "dog", "cat", "plant", "root", "leaf", "soil", "hill", "lake", "island", "desert", "jungle", "field", "stone", "sand", "cloud", "insect", "horse", "cow", "sheep", "rabbit"],
  body: ["head", "hand", "arm", "leg", "foot", "eye", "ear", "nose", "mouth", "hair", "heart", "back", "tooth", "skin", "finger", "knee", "shoulder", "stomach", "neck", "face", "brain", "bone", "blood", "throat", "elbow", "wrist", "ankle", "chest"],
  health: ["health", "doctor", "hospital", "medicine", "sick", "pain", "hurt", "ill", "nurse", "injury", "fever", "pill", "healthy", "symptom", "cough", "flu", "wound", "treatment", "clinic", "disease", "recover"],
  clothes: ["shirt", "dress", "shoes", "pants", "jacket", "hat", "coat", "skirt", "sock", "wear", "clothes", "jeans", "sweater", "boots", "belt", "scarf", "glove", "uniform", "pocket", "button", "zipper", "suit", "tie"],
  money: ["money", "price", "cost", "cheap", "expensive", "pay", "buy", "sell", "bank", "cash", "card", "bill", "discount", "loan", "rich", "poor", "budget", "coin", "income", "tax", "profit", "save", "spend", "afford", "receipt"],
  time: ["time", "hour", "minute", "day", "week", "month", "year", "morning", "night", "evening", "yesterday", "clock", "watch", "early", "late", "calendar", "century", "decade", "moment", "season", "winter", "summer", "spring", "autumn"],
  music: ["music", "song", "sing", "guitar", "piano", "drum", "band", "concert", "listen", "dance", "sound", "melody", "radio", "singer", "album", "instrument", "violin", "chorus", "rhythm"],
  sport: ["sport", "play", "game", "team", "score", "run", "swim", "ball", "match", "coach", "win", "lose", "race", "gym", "training", "player", "goal", "referee", "stadium", "bicycle", "trophy", "champion", "soccer", "tennis", "basketball", "yoga"],
  technology: ["computer", "phone", "internet", "screen", "data", "click", "file", "download", "website", "software", "device", "camera", "laptop", "password", "email", "online", "keyboard", "mouse", "charger", "battery", "network", "video", "photo", "app", "application", "digital", "robot", "machine"],
  city: ["city", "street", "town", "market", "store", "shop", "building", "park", "road", "bridge", "traffic", "corner", "square", "neighborhood", "sidewalk", "crosswalk", "museum", "church", "pharmacy", "bakery", "downtown", "subway"],
  weather: ["weather", "storm", "fog", "sunny", "rainy", "windy", "cloudy", "snowy", "temperature", "forecast", "humid", "chilly", "freeze", "thunder", "lightning", "umbrella", "shower"],
  communication: ["say", "speak", "talk", "call", "answer", "ask", "tell", "word", "language", "voice", "message", "letter", "chat", "explain", "borrow", "lend", "discuss", "argue", "agree", "disagree", "question", "reply", "whisper", "shout", "promise", "apologize", "translate", "conversation", "opinion", "advice", "news", "story"],
  art: ["art", "paint", "draw", "picture", "color", "artist", "design", "film", "movie", "theater", "write", "novel", "poem", "poetry", "sculpture", "gallery", "exhibition", "creative", "canvas", "brush", "portrait", "actor", "director", "script", "animation"],
};

/* token ↔ hint por palabra completa, aceptando flexiones leves (plural/derivada):
   "apples"↔"apple", "teaches"↔"teach". Nunca por substring. */
function tokenMatches(token, hint) {
  if (token === hint) return 2; // exacto
  if (token.length >= 4 && hint.length >= 4) {
    if (token.startsWith(hint) && token.length - hint.length <= 2) return 1; // plural / 3ª persona
    if (hint.startsWith(token) && hint.length - token.length <= 3) return 1; // derivada (teach → teacher)
  }
  return 0;
}

export function inferCategoryLocal(word) {
  const w = String(word || "").toLowerCase().trim();
  if (!w) return "general";
  const tokens = w.split(/[^a-z']+/).filter(Boolean);
  if (!tokens.length) return "general";
  let best = null;
  let bestScore = 0;
  for (const [cat, hints] of Object.entries(CATEGORY_HINTS)) {
    let score = 0;
    for (const token of tokens) for (const hint of hints) score += tokenMatches(token, hint);
    if (score > bestScore) { best = cat; bestScore = score; }
  }
  return bestScore > 0 ? best : "general";
}
