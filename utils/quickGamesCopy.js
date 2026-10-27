// utils/quickGamesCopy.js
//
// Hızlı oyunların (utils/quickGames.js) oyuna özgü metinleri (tr / en / es / pt / de): başlık, kart ipucu, soru,
// film/dizi etiketleri, on yıl biçimi, tür adları ve oy sayısı biçimi. Ortak metinler (can, rekor, yükleniyor, hata,
// "tekrar oyna"…) "Önce hangisi?" tablosundan gelir (utils/olderGameCopy) — iki yerde yazılmasın.
//
// Saf veri — bkz. utils/socialLinksCopy.js. __tests__/copyTablesSpanish.test.js dillerin aynı şekle sahip olduğunu,
// __tests__/quickGameScreen.test.js "her anahtar kullanılıyor"u denetler.

import { copyLanguage } from "./appLanguages";

/** 12400 → "12,4"; 340 → "340". Ondalık ayracı dile göre; 100 üstünde ondalık yok. */
function compact(value, decimal) {
  const text = value < 100 ? value.toFixed(1) : String(Math.round(value));
  return text.replace(/\.0$/, "").replace(".", decimal);
}

export const QUICK_COPY = {
  tr: {
    gridTitle: "Hızlı oyunlar",
    games: {
      popular: { title: "Hangisi daha çok izlendi?", hint: "İki afiş: hangisini daha çok kişi oyladı?", prompt: "Hangisini daha çok kişi oyladı?" },
      decade: { title: "Hangi on yıl?", hint: "Afişe bak, çıktığı on yılı bil", prompt: "Bu yapım hangi on yılda çıktı?" },
      kind: { title: "Film mi, dizi mi?", hint: "Afişe bak: film mi dizi mi?", prompt: "Bu bir film mi, dizi mi?" },
      genre: { title: "Hangi tür?", hint: "Afişin türünü tahmin et", prompt: "Bunlardan hangisi bu yapımın türü?" },
      blur: { title: "Bulanık Afiş", hint: "Afiş netleşmeden bil, puanı kap", prompt: "Bu hangi yapım?" },
    },
    blur: {
      scoreLabel: "Puan",
      points: (n) => `+${n} puan`,
      endScore: (n) => `${n} puan`,
      timeUp: "Süre doldu",
      posterA11y: "Bulanık afiş",
    },
    kind: { movie: "Film", tv: "Dizi" },
    decadeLabel: (d) => `${d}'lar`,
    votes: (n) =>
      n >= 1e6 ? `${compact(n / 1e6, ",")} milyon oy` : n >= 1e3 ? `${compact(n / 1e3, ",")} bin oy` : `${n} oy`,
    genres: {
      action: "Aksiyon", adventure: "Macera", animation: "Animasyon", comedy: "Komedi", crime: "Suç",
      documentary: "Belgesel", drama: "Dram", family: "Aile", fantasy: "Fantastik", history: "Tarih",
      horror: "Korku", music: "Müzik", mystery: "Gizem", romance: "Romantik", scifi: "Bilim kurgu",
      thriller: "Gerilim", war: "Savaş", western: "Western",
    },
  },
  en: {
    gridTitle: "Quick games",
    games: {
      popular: { title: "Which is more popular?", hint: "Two posters: which got more votes?", prompt: "Which one got more votes?" },
      decade: { title: "Which decade?", hint: "Look at the poster and name its decade", prompt: "Which decade did this come out?" },
      kind: { title: "Movie or series?", hint: "Look at the poster: movie or series?", prompt: "Is this a movie or a series?" },
      genre: { title: "Which genre?", hint: "Guess the genre from the poster", prompt: "Which of these is one of its genres?" },
      blur: { title: "Blurry Poster", hint: "Name it before it sharpens, grab the points", prompt: "What title is this?" },
    },
    blur: {
      scoreLabel: "Points",
      points: (n) => `+${n} pts`,
      endScore: (n) => (n === 1 ? "1 point" : `${n} points`),
      timeUp: "Time's up",
      posterA11y: "Blurred poster",
    },
    kind: { movie: "Movie", tv: "Series" },
    decadeLabel: (d) => `${d}s`,
    votes: (n) =>
      n >= 1e6 ? `${compact(n / 1e6, ".")}M votes` : n >= 1e3 ? `${compact(n / 1e3, ".")}K votes` : n === 1 ? "1 vote" : `${n} votes`,
    genres: {
      action: "Action", adventure: "Adventure", animation: "Animation", comedy: "Comedy", crime: "Crime",
      documentary: "Documentary", drama: "Drama", family: "Family", fantasy: "Fantasy", history: "History",
      horror: "Horror", music: "Music", mystery: "Mystery", romance: "Romance", scifi: "Sci-fi",
      thriller: "Thriller", war: "War", western: "Western",
    },
  },
  es: {
    gridTitle: "Juegos rápidos",
    games: {
      popular: { title: "¿Cuál es más popular?", hint: "Dos carteles: ¿cuál recibió más votos?", prompt: "¿Cuál recibió más votos?" },
      decade: { title: "¿Qué década?", hint: "Mira el cartel y adivina la década", prompt: "¿En qué década se estrenó?" },
      kind: { title: "¿Película o serie?", hint: "Mira el cartel: ¿película o serie?", prompt: "¿Es una película o una serie?" },
      genre: { title: "¿Qué género?", hint: "Adivina el género por el cartel", prompt: "¿Cuál de estos es uno de sus géneros?" },
      blur: { title: "Cartel borroso", hint: "Adivínalo antes de que se aclare", prompt: "¿Qué título es este?" },
    },
    blur: {
      scoreLabel: "Puntos",
      points: (n) => `+${n} pts`,
      endScore: (n) => (n === 1 ? "1 punto" : `${n} puntos`),
      timeUp: "Se acabó el tiempo",
      posterA11y: "Cartel borroso",
    },
    kind: { movie: "Película", tv: "Serie" },
    decadeLabel: (d) => `${d}s`,
    votes: (n) =>
      n >= 1e6 ? `${compact(n / 1e6, ",")} M votos` : n >= 1e3 ? `${compact(n / 1e3, ",")} mil votos` : n === 1 ? "1 voto" : `${n} votos`,
    genres: {
      action: "Acción", adventure: "Aventura", animation: "Animación", comedy: "Comedia", crime: "Crimen",
      documentary: "Documental", drama: "Drama", family: "Familiar", fantasy: "Fantasía", history: "Historia",
      horror: "Terror", music: "Música", mystery: "Misterio", romance: "Romance", scifi: "Ciencia ficción",
      thriller: "Suspense", war: "Bélico", western: "Western",
    },
  },
  pt: {
    gridTitle: "Jogos rápidos",
    games: {
      popular: { title: "Qual é mais popular?", hint: "Dois pôsteres: qual recebeu mais votos?", prompt: "Qual recebeu mais votos?" },
      decade: { title: "Qual década?", hint: "Veja o pôster e adivinhe a década", prompt: "Em que década estreou?" },
      kind: { title: "Filme ou série?", hint: "Veja o pôster: filme ou série?", prompt: "É um filme ou uma série?" },
      genre: { title: "Qual gênero?", hint: "Adivinhe o gênero pelo pôster", prompt: "Qual destes é um dos gêneros dele?" },
      blur: { title: "Pôster borrado", hint: "Acerte antes que fique nítido", prompt: "Que título é este?" },
    },
    blur: {
      scoreLabel: "Pontos",
      points: (n) => `+${n} pts`,
      endScore: (n) => (n === 1 ? "1 ponto" : `${n} pontos`),
      timeUp: "Tempo esgotado",
      posterA11y: "Pôster borrado",
    },
    kind: { movie: "Filme", tv: "Série" },
    decadeLabel: (d) => `Anos ${d}`,
    votes: (n) =>
      n >= 1e6 ? `${compact(n / 1e6, ",")} mi de votos` : n >= 1e3 ? `${compact(n / 1e3, ",")} mil votos` : n === 1 ? "1 voto" : `${n} votos`,
    genres: {
      action: "Ação", adventure: "Aventura", animation: "Animação", comedy: "Comédia", crime: "Crime",
      documentary: "Documentário", drama: "Drama", family: "Família", fantasy: "Fantasia", history: "História",
      horror: "Terror", music: "Música", mystery: "Mistério", romance: "Romance", scifi: "Ficção científica",
      thriller: "Suspense", war: "Guerra", western: "Faroeste",
    },
  },
  de: {
    gridTitle: "Schnelle Spiele",
    games: {
      popular: { title: "Was ist beliebter?", hint: "Zwei Poster: Welches bekam mehr Stimmen?", prompt: "Welches bekam mehr Stimmen?" },
      decade: { title: "Welches Jahrzehnt?", hint: "Schau aufs Poster und nenne das Jahrzehnt", prompt: "In welchem Jahrzehnt erschien das?" },
      kind: { title: "Film oder Serie?", hint: "Schau aufs Poster: Film oder Serie?", prompt: "Ist das ein Film oder eine Serie?" },
      genre: { title: "Welches Genre?", hint: "Errate das Genre anhand des Posters", prompt: "Welches davon ist eines seiner Genres?" },
      blur: { title: "Unscharfes Poster", hint: "Errate es, bevor es scharf wird", prompt: "Welcher Titel ist das?" },
    },
    blur: {
      scoreLabel: "Punkte",
      points: (n) => `+${n} Pkt.`,
      endScore: (n) => (n === 1 ? "1 Punkt" : `${n} Punkte`),
      timeUp: "Zeit abgelaufen",
      posterA11y: "Unscharfes Poster",
    },
    kind: { movie: "Film", tv: "Serie" },
    decadeLabel: (d) => `${d}er`,
    votes: (n) =>
      n >= 1e6 ? `${compact(n / 1e6, ",")} Mio. Stimmen` : n >= 1e3 ? `${compact(n / 1e3, ",")} Tsd. Stimmen` : n === 1 ? "1 Stimme" : `${n} Stimmen`,
    genres: {
      action: "Action", adventure: "Abenteuer", animation: "Animation", comedy: "Komödie", crime: "Krimi",
      documentary: "Dokumentarfilm", drama: "Drama", family: "Familie", fantasy: "Fantasy", history: "Historie",
      horror: "Horror", music: "Musik", mystery: "Mystery", romance: "Liebesfilm", scifi: "Sci-Fi",
      thriller: "Thriller", war: "Krieg", western: "Western",
    },
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getQuickCopy = (language) => QUICK_COPY[copyLanguage(language, Object.keys(QUICK_COPY))];

/**
 * Bir şıkkın metni (oyuna göre): film/dizi etiketi, on yıl biçimi, tür adı. Pair oyunlarda şık afiştir (metin yok);
 * Bulanık Afiş'te şık yapımın kendi başlığıdır (`option.title`, çeviri yok).
 */
export function quickOptionLabel(copy, gameId, key) {
  if (gameId === "kind") return copy.kind[key] || key;
  if (gameId === "decade") return copy.decadeLabel(Number(key));
  if (gameId === "genre") return copy.genres[key] || key;
  return key;
}
