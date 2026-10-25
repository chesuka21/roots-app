/* ---------- Quiz data: bancos por IDIOMA + CEFR + i18n de instrucciones ----------
   BANKS[target_language][cefr] — las preguntas se evalúan en el idioma que se
   estudia (target_language); las INSTRUCCIONES van en native_language (i18n).
   EN es el banco completo; fr/de/it/pt tienen bancos core con fallback a EN. */
import { CEFR_ORDER } from "./patterns-cefr.js";

const EN_BANK = {
  A1: [
    { q: "I ___ a book every night before bed.", options: ["reads", "read", "reading", "to read"], correct: 1 },
    { q: "What is the opposite of \"happy\"?", options: ["sad", "hungry", "tired", "fast"], correct: 0 },
    { q: "She ___ to music every day.", options: ["listen", "listens", "listening", "listened"], correct: 1 },
    { q: "There ___ two apples on the table.", options: ["is", "am", "are", "be"], correct: 2 },
    { q: "Choose the correct question.", options: ["Where you live?", "Where do you live?", "Where you do live?", "Where lives you?"], correct: 1 },
  ],
  A2: [
    { q: "Choose the correct sentence.", options: ["She don't like coffee.", "She doesn't like coffee.", "She not like coffee.", "She isn't like coffee."], correct: 1 },
    { q: "I ___ to the store yesterday.", options: ["go", "goes", "went", "going"], correct: 2 },
    { q: "I'm ___ than my brother.", options: ["tall", "taller", "tallest", "more tall"], correct: 1 },
    { q: "We ___ visit my grandma on Sundays.", options: ["are", "does", "usually", "much"], correct: 2 },
    { q: "She ___ finish the book last night.", options: ["doesn't", "didn't", "isn't", "won't has"], correct: 1 },
  ],
  B1: [
    { q: "I have been living here ___ 3 years.", options: ["since", "for", "from", "during"], correct: 1 },
    { q: "By the time we arrived, the movie ___.", options: ["already started", "has already started", "had already started", "was already starting"], correct: 2 },
    { q: "If it rains, we ___ inside.", options: ["will stay", "stayed", "would stay", "will stayed"], correct: 0 },
    { q: "I used ___ early, but now I wake up late.", options: ["to waking up", "wake up", "to wake up", "waking up"], correct: 2 },
    { q: "He asked me where I ___.", options: ["live", "did live", "lived", "do live"], correct: 2 },
    { q: "The film was ___ interesting that I watched it twice.", options: ["so", "such", "very", "too"], correct: 0 },
  ],
  B2: [
    { q: "Choose the correct sentence.", options: ["If I would have known, I would have called.", "If I had known, I would have called.", "If I knew, I would have called.", "If I have known, I would call."], correct: 1 },
    { q: "The company's profits have ___ significantly this year.", options: ["rose", "raised", "risen", "rising"], correct: 2 },
    { q: "I wish I ___ how to play the piano.", options: ["know", "knew", "would know", "have known"], correct: 1 },
    { q: "It's high time we ___.", options: ["go", "went", "will go", "going"], correct: 1 },
    { q: "The house ___ while we were on holiday.", options: ["was broken into", "broke into", "had broken into", "is breaking into"], correct: 0 },
    { q: "Hardly ___ sat down when the phone rang.", options: ["I had", "had I", "did I", "I have"], correct: 1 },
  ],
  C1: [
    { q: "Choose the sentence with correct usage.", options: ["I wish I would have more time.", "I wish I had more time.", "I wish I have more time.", "I wish I would had more time."], correct: 1 },
    { q: "___ had he arrived than the phone rang.", options: ["Rarely", "No sooner", "Hardly ever", "Scarcely"], correct: 1 },
    { q: "The report ___ carefully before submission.", options: ["was reviewed", "was being reviewed", "has been reviewed", "is reviewed"], correct: 0 },
    { q: "Not until the results came out ___ the truth.", options: ["I realized", "did I realize", "I did realize", "realized I"], correct: 1 },
    { q: "Choose the correct sentence.", options: ["Rarely one finds such talent.", "Rarely does one find such talent.", "Rarely one does find such talent.", "Rarely find one such talent."], correct: 1 },
    { q: "He's not ___ to accept the proposal.", options: ["so fool", "such fool", "much of a fool", "enough of fool"], correct: 2 },
    { q: "The chairman's resignation came ___ the scandal.", options: ["in the wake of", "on the wake of", "at the wake of", "by the wake of"], correct: 0 },
  ],
  C2: [
    { q: "Choose the formal equivalent of \"But it was expensive.\"", options: ["However, it was expensive.", "And it was expensive.", "So it was expensive.", "Because it was expensive."], correct: 0 },
    { q: "Choose the correct cleft sentence.", options: ["What I need is a break.", "What I need it is a break.", "That I need is a break.", "What I need a break is."], correct: 0 },
    { q: "There's no point ___ the issue — they won't change their mind.", options: ["in arguing", "to argue", "arguing", "argue"], correct: 1 },
    { q: "Choose the sentence with correct inverted structure.", options: ["Never I have seen such chaos.", "Never have I seen such chaos.", "Never seen I have such chaos.", "Never I seen have such chaos."], correct: 1 },
    { q: "His excuse was ___ believable.", options: ["anything but", "nothing but", "something but", "all but to be"], correct: 0 },
    { q: "Choose the correct formal connector.", options: ["The plan was flawed; nonetheless, we proceeded.", "The plan was flawed; nevertheless of, we proceeded.", "The plan was flawed; despite, we proceeded.", "The plan was flawed; however of, we proceeded."], correct: 0 },
    { q: "She's ___ the most qualified candidate.", options: ["by far", "by long", "so far", "far away"], correct: 0 },
  ],
};

/* ── Bancos multi-idioma: gramática esencial de fr/de/it/pt por nivel ──
   fr completo (A1-C2); de/it/pt core A1-B1 — los niveles faltantes hacen
   fallback automático al banco EN (bankFor). */

const FR_BANK = {
  A1: [
    { q: "Elle ___ de la musique tous les jours.", options: ["écoute", "écoutes", "écoutent", "écouté"], correct: 0 },
    { q: "Nous ___ français.", options: ["parle", "parles", "parlons", "parlez"], correct: 2 },
    { q: "Tu ___ où ?", options: ["habites", "habite", "habitent", "habitez"], correct: 0 },
    { q: "Quel est le contraire de « grand » ?", options: ["petit", "gros", "long", "haut"], correct: 0 },
    { q: "Je ___ un chat.", options: ["ai", "as", "a", "ont"], correct: 0 },
  ],
  A2: [
    { q: "Hier, je ___ au cinéma.", options: ["vais", "allais", "irai", "allé"], correct: 1 },
    { q: "Elle est ___ que moi.", options: ["plus grande", "plus grand", "grand plus", "le plus grand"], correct: 0 },
    { q: "Nous ___ fini nos devoirs.", options: ["sommes", "avons", "avez", "ont"], correct: 1 },
    { q: "Je vais ___ le musée demain.", options: ["visité", "visiter", "visitons", "visite"], correct: 1 },
    { q: "Ils ___ venir ce soir.", options: ["va", "vas", "vont", "allons"], correct: 2 },
  ],
  B1: [
    { q: "Si tu viens, nous ___ le film.", options: ["regarderons", "regarderions", "regardions", "regardions"], correct: 0 },
    { q: "Il faut que tu ___ à l'heure.", options: ["sois", "es", "seras", "serais"], correct: 0 },
    { q: "Le livre que j'ai ___ est passionnant.", options: ["lu", "lis", "lire", "lisais"], correct: 0 },
    { q: "Je te téléphonerai dès que je ___.", options: ["arriverai", "arriverais", "arrive", "arriver"], correct: 2 },
    { q: "C'est le film ___ j'ai vu hier.", options: ["que", "qui", "dont", "où"], correct: 0 },
  ],
  B2: [
    { q: "Si j'avais su, je ___ venu.", options: ["serais", "serai", "suis", "fus"], correct: 0 },
    { q: "Il est temps que nous ___.", options: ["partons", "partions", "partirons", "partirions"], correct: 1 },
    { q: "La maison ___ on parle date du XVIIIe siècle.", options: ["que", "qui", "dont", "où"], correct: 2 },
    { q: "Je doute qu'il ___ raison.", options: ["a", "ait", "aura", "aurait"], correct: 1 },
    { q: "Elle parle ___ elle pense.", options: ["comme", "comme si", "tel que", "aussi"], correct: 0 },
  ],
  C1: [
    { q: "___ les résultats parus, il a compris la vérité.", options: ["À peine", "Dès", "Quand même", "Malgré que"], correct: 0 },
    { q: "Il n'est pas ___ d'accepter la proposition.", options: ["si fou", "tel fou", "assez fou", "trop de fou"], correct: 0 },
    { q: "Sa démission est venue ___ le scandale.", options: ["dans le sillage de", "au réveil de", "au sillage du", "par le réveil de"], correct: 0 },
    { q: "Bien qu'il ___ riche, il est avare.", options: ["soit", "est", "sera", "serait"], correct: 0 },
    { q: "___ riches qu'ils soient, ils ne sont pas heureux.", options: ["Si", "Quel", "Tout", "Malgré"], correct: 2 },
  ],
  C2: [
    { q: "Choisissez l'équivalent formel de « Mais c'était cher. »", options: ["Cependant, c'était cher.", "Et c'était cher.", "Donc c'était cher.", "Parce que c'était cher."], correct: 0 },
    { q: "Choisissez la phrase clivée correcte.", options: ["Ce dont j'ai besoin, c'est d'une pause.", "Ce que j'ai besoin, c'est d'une pause.", "Ce qu'il me faut besoin est une pause.", "Ce dont j'ai besoin, c'est une pause prendre."], correct: 0 },
    { q: "Son excuse était ___ crédible.", options: ["tout sauf", "rien sauf", "quelque chose sauf", "mais que"], correct: 0 },
    { q: "Elle est ___ la candidate la plus qualifiée.", options: ["de loin", "de long", "jusqu'ici", "loin"], correct: 0 },
    { q: "___ riche qu'il soit, il n'est pas heureux.", options: ["Si", "Quel", "Tout", "Malgré"], correct: 2 },
  ],
};

const DE_BANK = {
  A1: [
    { q: "Sie ___ jeden Tag Musik.", options: ["hört", "hören", "höre", "hört zu"], correct: 0 },
    { q: "Wir ___ Deutsch.", options: ["sprecht", "spreche", "sprechen", "spricht"], correct: 2 },
    { q: "Wo ___ du ?", options: ["wohnt", "wohne", "wohnen", "wohnst"], correct: 3 },
    { q: "Das Gegenteil von 'groß' ist ___.", options: ["klein", "dick", "lang", "hoch"], correct: 0 },
    { q: "Ich ___ einen Kaffee.", options: ["möchte", "möchtest", "möchten", "möchtet"], correct: 0 },
  ],
  A2: [
    { q: "Gestern ___ ich ins Kino.", options: ["gehe", "ging", "gehen", "gehe ging"], correct: 1 },
    { q: "Wir haben die Hausaufgaben ___.", options: ["machen", "gemacht", "machte", "machen gemacht"], correct: 1 },
    { q: "Ich muss morgen ___ Museum gehen.", options: ["zum", "zu dem", "zu", "zur"], correct: 0 },
    { q: "Sie ___ bald kommen.", options: ["wirst", "werden", "wird", "werdet"], correct: 2 },
    { q: "Ich bin ___ als mein Bruder.", options: ["groß", "größer", "am größten", "großer"], correct: 1 },
  ],
  B1: [
    { q: "Wenn du kommst, ___ wir den Film ansehen.", options: ["werden", "würden", "sehen", "werdet"], correct: 0 },
    { q: "Es ist wichtig, dass du pünktlich ___.", options: ["bist", "sei", "warst", "wärst"], correct: 0 },
    { q: "Das Buch, das ich ___, ist spannend.", options: ["gelesen habe", "gelesen", "lese", "las"], correct: 0 },
    { q: "Ich rufe dich an, sobald ich ___.", options: ["ankomme", "ankam", "ankommen werde", "ankommen"], correct: 0 },
    { q: "Der Mann, ___ Auto rot ist, wohnt hier.", options: ["dessen", "deren", "das", "der"], correct: 0 },
  ],
};

const IT_BANK = {
  A1: [
    { q: "Lei ___ musica ogni giorno.", options: ["ascolta", "ascolti", "ascoltano", "ascoltato"], correct: 0 },
    { q: "Noi ___ italiano.", options: ["parlo", "parli", "parliamo", "parlate"], correct: 2 },
    { q: "Tu dove ___ ?", options: ["abiti", "abita", "abitano", "abitate"], correct: 0 },
    { q: "Il contrario di « grande » è ___.", options: ["piccolo", "grosso", "lungo", "alto"], correct: 0 },
    { q: "Io ___ un caffè.", options: ["vorrei", "vorresti", "vorremmo", "vorrebbero"], correct: 0 },
  ],
  A2: [
    { q: "Ieri sono ___ al cinema.", options: ["andato", "andare", "andavo", "andrò"], correct: 0 },
    { q: "Abbiamo ___ i compiti.", options: ["fatto", "fare", "facevamo", "faremo"], correct: 0 },
    { q: "Domani ___ al museo.", options: ["andremo", "andiamo", "andavamo", "andato"], correct: 0 },
    { q: "Sono ___ di mio fratello.", options: ["più alto", "più alta", "alto più", "il più alto"], correct: 0 },
    { q: "Loro ___ venire stasera.", options: ["vanno", "vengono", "verranno", "vanno a"], correct: 2 },
  ],
  B1: [
    { q: "Se vieni, ___ il film.", options: ["guarderemo", "guarderemmo", "guardavamo", "guarderanno"], correct: 0 },
    { q: "È importante che tu ___ puntuale.", options: ["sia", "sei", "sarai", "fossi"], correct: 0 },
    { q: "Il libro che ho ___ è appassionante.", options: ["letto", "leggere", "leggevo", "leggo"], correct: 0 },
    { q: "Ti chiamerò appena ___.", options: ["arrivo", "arrivai", "arriverò", "arrivare"], correct: 0 },
    { q: "L'uomo ___ macchina è rossa abita qui.", options: ["la cui", "di cui la", "del quale", "che la"], correct: 2 },
  ],
};

const PT_BANK = {
  A1: [
    { q: "Ela ___ música todos os dias.", options: ["ouve", "ouves", "ouvem", "ouvido"], correct: 0 },
    { q: "Nós ___ português.", options: ["falo", "falas", "falamos", "falam"], correct: 2 },
    { q: "Onde você ___ ?", options: ["mora", "moram", "moramos", "morais"], correct: 0 },
    { q: "O contrário de 'grande' é ___.", options: ["pequeno", "gordo", "longo", "alto"], correct: 0 },
    { q: "Eu ___ um café.", options: ["quero", "queres", "queremos", "querem"], correct: 0 },
  ],
  A2: [
    { q: "Ontem eu ___ ao cinema.", options: ["vou", "fui", "ia", "irei"], correct: 1 },
    { q: "Nós ___ os deveres de casa.", options: ["fizemos", "fazemos", "faremos", "fiz"], correct: 0 },
    { q: "Eles ___ vir hoje à noite.", options: ["vai", "vão", "vamos", "vás"], correct: 1 },
    { q: "Eu sou ___ que meu irmão.", options: ["mais alto", "mais alta", "alto mais", "o mais alto"], correct: 0 },
    { q: "Amanhã vou ___ o museu.", options: ["visitar", "visitado", "visitamos", "visito"], correct: 0 },
  ],
  B1: [
    { q: "Se você vier, ___ o filme.", options: ["assistiremos", "assistiríamos", "assistíamos", "assistirão"], correct: 0 },
    { q: "É importante que você ___ pontual.", options: ["seja", "é", "será", "fosse"], correct: 0 },
    { q: "O livro que eu ___ é apaixonante.", options: ["li", "ler", "leio", "lia"], correct: 0 },
    { q: "Vou te ligar assim que ___.", options: ["chegar", "cheguei", "chegarei", "chegando"], correct: 0 },
    { q: "É o filme ___ eu vi ontem.", options: ["que", "quem", "cujo", "onde"], correct: 0 },
  ],
};

/* Banco por idioma objetivo. Fallback por nivel: bankFor(). */
export const BANKS = { en: EN_BANK, fr: FR_BANK, de: DE_BANK, it: IT_BANK, pt: PT_BANK };

/* Preguntas de un rung para el idioma dado — fallback EN si el nivel no existe. */
export function bankFor(targetLang, rung) {
  const bank = BANKS[targetLang] || EN_BANK;
  return bank[rung] || EN_BANK[rung] || [];
}

/* Acceso retro-compatible (inglés). */
export const QUIZ_BANK = EN_BANK;

export const PRESET_INTERESTS = ["Cooking", "Soccer", "Music", "Technology", "Movies & TV", "Video games", "Travel", "Fitness", "Art & design", "Business & finance", "Reading", "Nature"];

export const QUIZ_I18N = {
  "Choose the correct sentence.": { es: "Elige la oración correcta.", fr: "Choisis la phrase correcte.", de: "Wähle den richtigen Satz.", pt: "Escolha a frase correta." },
  "Choose the sentence with correct usage.": { es: "Elige la oración con el uso correcto.", fr: "Choisis la phrase avec le bon usage.", de: "Wähle den Satz mit der richtigen Verwendung.", pt: "Escolha a frase com o uso correto." },
  "What is the opposite of \"happy\"?": { es: "¿Cuál es el opuesto de \"happy\" (feliz)?", fr: "Quel est le contraire de « happy » (heureux) ?", de: "Was ist das Gegenteil von \"happy\" (glücklich)?", pt: "Qual é o oposto de \"happy\" (feliz)?" },
  "Choose the formal equivalent of \"But it was expensive.\"": { es: "Elige el equivalente formal de \"But it was expensive.\" (Pero era caro.)", fr: "Choisis l'équivalent formel de « But it was expensive. » (Mais c'était cher.)", de: "Wähle die formale Entsprechung von \"But it was expensive.\" (Aber es war teuer.)", pt: "Escolha o equivalente formal de \"But it was expensive.\" (Mas era caro.)" },
  "Choose the correct cleft sentence.": { es: "Elige la oración cleft correcta.", fr: "Choisis la phrase clivée correcte.", de: "Wähle den korrekten Cleft-Satz.", pt: "Escolha a frase clivada correta." },
  "Nivelación adaptativa — pregunta": { es: "Nivelación adaptativa — pregunta", fr: "Test adaptatif — question", de: "Adaptiver Test — Frage", pt: "Teste adaptativo — pergunta" },
  "nivel": { es: "nivel", fr: "niveau", de: "Niveau", pt: "nível" },
  "Based on the quiz, you're at": { es: "Según el quiz, estás en", fr: "D'après le test, tu es au", de: "Laut dem Test bist du auf", pt: "Segundo o teste, você está no" },
  "Spanish translations will show by default — you can turn them off anytime.": { es: "Las traducciones al español se muestran por defecto — puedes apagarlas cuando quieras.", fr: "Les traductions espagnoles s'affichent par défaut — tu peux les désactiver quand tu veux.", de: "Spanische Übersetzungen werden standardmäßig angezeigt — du kannst sie jederzeit ausschalten.", pt: "As traduções para o espanhol aparecem por padrão — você pode desligá-las quando quiser." },
  "Translations will be hidden but one tap away when you need them.": { es: "Las traducciones estarán ocultas pero a un toque cuando las necesites.", fr: "Les traductions seront cachées mais à un geste quand tu en as besoin.", de: "Übersetzungen sind versteckt, aber auf einen Tippen entfernt, wenn du sie brauchst.", pt: "As traduções ficarão ocultas, mas a um toque quando precisar." },
  "The app will stay 100% English — no translations shown.": { es: "La app estará 100% en inglés — sin traducciones.", fr: "L'app restera 100 % en anglais — sans traductions.", de: "Die App bleibt 100 % Englisch — keine Übersetzungen.", pt: "No translations" },
};
export function quizQuestionText(q, lang) {
  if (!q) return "";
  const tr = QUIZ_I18N[q.q];
  if (tr && tr[lang]) return tr[lang];
  return q.q;
}
export const QUIZ_LENGTH = 5;
export const SELF_TO_RUNG = { beginner: "A1", intermediate: "B1", advanced: "B2" };
export function nextRung(rung, correct) {
  const i = CEFR_ORDER.indexOf(rung);
  return CEFR_ORDER[Math.min(CEFR_ORDER.length - 1, Math.max(0, i + (correct ? 1 : -1)))];
}
export function pickQuizQuestion(rung, asked, targetLang = "en") {
  const bank = bankFor(targetLang, rung);
  const pool = bank.filter((q) => !asked.includes(q.q));
  return pool.length ? pool[0] : bank[0] || null;
}
