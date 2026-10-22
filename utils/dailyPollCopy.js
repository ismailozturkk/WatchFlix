// utils/dailyPollCopy.js
//
// "Günün Sorusu" kartının metinleri (tr / en / es / pt / de). Soru ve seçenek metinleri data/dailyPollQuestions.js'te.
// Saf veri — bkz. utils/socialLinksCopy.js. __tests__/copyTablesSpanish.test.js dillerin aynı şekle sahip olduğunu,
// __tests__/dailyPollCard.test.js "her anahtar kullanılıyor"u denetler.

import { copyLanguage } from "./appLanguages";

export const POLL_COPY = {
  tr: {
    eyebrow: "GÜNÜN SORUSU",
    hint: "Birine dokun, herkes ne dedi gör",
    votes: (n) => `${n} oy`,
    youPicked: "Senin seçimin",
    fewVotes: "Sonuçlar oy arttıkça belirir",
    firstVoter: "İlk oy verenlerdensin",
    waiting: "Oyun kaydediliyor…",
    pendingSync: "Oyun bu cihazda kayıtlı; bağlantı gelince sayılacak",
    streak: (n) => `${n} gün üst üste`,
    nextQuestion: "Yarın yeni bir soru var",
    optionA11y: (text) => `${text}, oy ver`,
    resultA11y: (text, percent) => `${text}, yüzde ${percent}`,
  },
  en: {
    eyebrow: "QUESTION OF THE DAY",
    hint: "Tap one and see what everyone said",
    votes: (n) => (n === 1 ? "1 vote" : `${n} votes`),
    youPicked: "Your pick",
    fewVotes: "Results appear as votes come in",
    firstVoter: "You're among the first to vote",
    waiting: "Saving your vote…",
    pendingSync: "Your vote is saved on this device and will count once you're online",
    streak: (n) => `${n}-day streak`,
    nextQuestion: "A new question tomorrow",
    optionA11y: (text) => `${text}, vote`,
    resultA11y: (text, percent) => `${text}, ${percent} percent`,
  },
  es: {
    eyebrow: "PREGUNTA DEL DÍA",
    hint: "Toca una y mira qué dijo todo el mundo",
    votes: (n) => (n === 1 ? "1 voto" : `${n} votos`),
    youPicked: "Tu elección",
    fewVotes: "Los resultados aparecen al sumarse votos",
    firstVoter: "Eres de los primeros en votar",
    waiting: "Guardando tu voto…",
    pendingSync: "Tu voto está guardado en este dispositivo y contará al volver la conexión",
    streak: (n) => `Racha de ${n} días`,
    nextQuestion: "Mañana, una pregunta nueva",
    optionA11y: (text) => `${text}, votar`,
    resultA11y: (text, percent) => `${text}, ${percent} por ciento`,
  },
  pt: {
    eyebrow: "PERGUNTA DO DIA",
    hint: "Toque em uma e veja o que todos disseram",
    votes: (n) => (n === 1 ? "1 voto" : `${n} votos`),
    youPicked: "Sua escolha",
    fewVotes: "Os resultados aparecem conforme chegam os votos",
    firstVoter: "Você está entre os primeiros a votar",
    waiting: "Salvando seu voto…",
    pendingSync: "Seu voto está salvo neste dispositivo e contará quando houver conexão",
    streak: (n) => `Sequência de ${n} dias`,
    nextQuestion: "Amanhã, uma pergunta nova",
    optionA11y: (text) => `${text}, votar`,
    resultA11y: (text, percent) => `${text}, ${percent} por cento`,
  },
  de: {
    eyebrow: "FRAGE DES TAGES",
    hint: "Tippe auf eine Antwort und sieh, was alle sagten",
    votes: (n) => (n === 1 ? "1 Stimme" : `${n} Stimmen`),
    youPicked: "Deine Wahl",
    fewVotes: "Ergebnisse erscheinen mit den Stimmen",
    firstVoter: "Du gehörst zu den Ersten",
    waiting: "Stimme wird gespeichert …",
    pendingSync: "Deine Stimme ist auf diesem Gerät gespeichert und zählt, sobald du online bist",
    streak: (n) => `${n} Tage in Folge`,
    nextQuestion: "Morgen gibt es eine neue Frage",
    optionA11y: (text) => `${text}, abstimmen`,
    resultA11y: (text, percent) => `${text}, ${percent} Prozent`,
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getPollCopy = (language) => POLL_COPY[copyLanguage(language, Object.keys(POLL_COPY))];
