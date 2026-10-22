/* ---------- Quiz data: QUIZ_BANK adaptativo + i18n de instrucciones ----------
   Imported en App.jsx y Onboarding.jsx — evita hacer referencia circular.    */
import { CEFR_ORDER } from "./patterns-cefr.js";

export const QUIZ_BANK = {
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
export function pickQuizQuestion(rung, asked) {
  const pool = (QUIZ_BANK[rung] || []).filter((q) => !asked.includes(q.q));
  return pool.length ? pool[0] : (QUIZ_BANK[rung] || [])[0] || null;
}
