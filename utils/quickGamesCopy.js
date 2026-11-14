// utils/quickGamesCopy.js
//
// Hızlı oyunların (utils/quickGames.js) oyuna özgü metinleri (tr / en / es / pt / de): başlık, kart ipucu, soru,
// film/dizi etiketleri, on yıl biçimi, tür adları, oy sayısı biçimi ve puan biçimi ("Yüksek puanı bul"). Ortak metinler (can, rekor, yükleniyor, hata,
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
      rating: { title: "Hangisinin puanı daha yüksek?", hint: "Yüksek TMDB puanlı afişi seç · Tek hata bitirir", prompt: "Hangisinin TMDB puanı daha yüksek?" },
    },
    blur: {
      scoreLabel: "Puan",
      points: (n) => `+${n} puan`,
      endScore: (n) => `${n} puan`,
      timeUp: "Süre doldu",
      secondsLeft: (n) => `${n} sn`,
      posterA11y: "Bulanık afiş",
    },
    rating: {
      format: (r) => `★ ${r.toFixed(1).replace(".", ",")}`,
      ratingA11y: (title, r) => `${title}, TMDB puanı ${r.toFixed(1).replace(".", ",")}`,
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
      rating: { title: "Which is rated higher?", hint: "Pick the higher-rated poster · One miss ends it", prompt: "Which title has the higher TMDB rating?" },
    },
    blur: {
      scoreLabel: "Points",
      points: (n) => `+${n} pts`,
      endScore: (n) => (n === 1 ? "1 point" : `${n} points`),
      timeUp: "Time's up",
      secondsLeft: (n) => `${n}s`,
      posterA11y: "Blurred poster",
    },
    rating: {
      format: (r) => `★ ${r.toFixed(1)}`,
      ratingA11y: (title, r) => `${title}, TMDB rating ${r.toFixed(1)}`,
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
      rating: { title: "¿Cuál tiene mejor nota?", hint: "Elige el cartel con mejor nota de TMDB · Un fallo y se acaba", prompt: "¿Cuál tiene la nota de TMDB más alta?" },
    },
    blur: {
      scoreLabel: "Puntos",
      points: (n) => `+${n} pts`,
      endScore: (n) => (n === 1 ? "1 punto" : `${n} puntos`),
      timeUp: "Se acabó el tiempo",
      secondsLeft: (n) => `${n} s`,
      posterA11y: "Cartel borroso",
    },
    rating: {
      format: (r) => `★ ${r.toFixed(1).replace(".", ",")}`,
      ratingA11y: (title, r) => `${title}, nota de TMDB ${r.toFixed(1).replace(".", ",")}`,
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
      rating: { title: "Qual tem a nota mais alta?", hint: "Escolha o pôster com a maior nota do TMDB · Um erro encerra", prompt: "Qual tem a maior nota no TMDB?" },
    },
    blur: {
      scoreLabel: "Pontos",
      points: (n) => `+${n} pts`,
      endScore: (n) => (n === 1 ? "1 ponto" : `${n} pontos`),
      timeUp: "Tempo esgotado",
      secondsLeft: (n) => `${n} s`,
      posterA11y: "Pôster borrado",
    },
    rating: {
      format: (r) => `★ ${r.toFixed(1).replace(".", ",")}`,
      ratingA11y: (title, r) => `${title}, nota do TMDB ${r.toFixed(1).replace(".", ",")}`,
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
      rating: { title: "Welcher ist höher bewertet?", hint: "Wähle das Poster mit der höheren TMDB-Wertung · Ein Fehler beendet das Spiel", prompt: "Welcher Titel hat die höhere TMDB-Wertung?" },
    },
    blur: {
      scoreLabel: "Punkte",
      points: (n) => `+${n} Pkt.`,
      endScore: (n) => (n === 1 ? "1 Punkt" : `${n} Punkte`),
      timeUp: "Zeit abgelaufen",
      secondsLeft: (n) => `${n} s`,
      posterA11y: "Unscharfes Poster",
    },
    rating: {
      format: (r) => `★ ${r.toFixed(1).replace(".", ",")}`,
      ratingA11y: (title, r) => `${title}, TMDB-Wertung ${r.toFixed(1).replace(".", ",")}`,
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

  it: {
  gridTitle: "Giochi veloci",
  games: {
    popular: {
      title: "Quale è più popolare?",
      hint: "Due poster: quale ha ottenuto più voti?",
      prompt: "Quale ha ottenuto più voti?"
    },
    decade: {
      title: "Quale decennio?",
      hint: "Guarda il poster e dai un nome al decennio",
      prompt: "Quale decennio è uscito?"
    },
    kind: {
      title: "Film o serie?",
      hint: "Guarda il poster: film o serie?",
      prompt: "È un film o una serie?"
    },
    genre: {
      title: "Quale genere?",
      hint: "Indovina il genere dal poster",
      prompt: "Quale di questi è uno dei suoi generi?"
    },
    blur: {
      title: "Poster sfocato",
      hint: "Dagli un nome prima che diventi più nitido, prendi i punti",
      prompt: "Che titolo è questo?"
    },
    rating: {
      title: "Quale ha il punteggio più alto?",
      hint: "Scegli il poster con il punteggio più alto · Un errore lo fa finire",
      prompt: "Quale titolo ha il punteggio TMDB più alto?"
    }
  },
  blur: {
    scoreLabel: "Punti",
    points: n => `+${n} punti`,
    endScore: n => n === 1 ? "1 punto" : `${n} punti`,
    timeUp: "Tempo scaduto",
    secondsLeft: n => `${n}s`,
    posterA11y: "Poster sfocato"
  },
  rating: {
    format: r => `★ ${r.toFixed(1)}`,
    ratingA11y: (title, r) => `${title}, valutazione TMDB ${r.toFixed(1)}`
  },
  kind: {
    movie: "Film",
    tv: "Serie"
  },
  decadeLabel: d => `${d}s`,
  votes: n => n >= 1e6 ? `${compact(n / 1e6, ".")}M voti` : n >= 1e3 ? `${compact(n / 1e3, ".")}K voti` : n === 1 ? "1 voto" : `${n} voti`,
  genres: {
    action: "Azione",
    adventure: "Avventura",
    animation: "Animazione",
    comedy: "Commedia",
    crime: "Crimine",
    documentary: "Documentario",
    drama: "Drammatico",
    family: "Famiglia",
    fantasy: "Fantasy",
    history: "Storia",
    horror: "Orrore",
    music: "Musica",
    mystery: "Mistero",
    romance: "Romantico",
    scifi: "Fantascienza",
    thriller: "Thriller",
    war: "Guerra",
    western: "Western"
  }
},
  fr: {
    gridTitle: "Jeux rapides",
    games: {
      popular: { title: "Lequel est le plus populaire ?", hint: "Deux affiches : laquelle a reçu le plus de votes ?", prompt: "Lequel a reçu le plus de votes ?" },
      decade: { title: "Quelle décennie ?", hint: "Regarde l'affiche et trouve sa décennie", prompt: "De quelle décennie date-t-il ?" },
      kind: { title: "Film ou série ?", hint: "Regarde l'affiche : film ou série ?", prompt: "Est-ce un film ou une série ?" },
      genre: { title: "Quel genre ?", hint: "Devine le genre à partir de l'affiche", prompt: "Lequel de ces genres est l'un des siens ?" },
      blur: { title: "Affiche floue", hint: "Trouve-le avant qu'il devienne net et rafle les points", prompt: "Quel est ce titre ?" },
      rating: { title: "Lequel est le mieux noté ?", hint: "Choisis l'affiche la mieux notée · Une erreur et c'est fini", prompt: "Quel titre a la meilleure note TMDB ?" },
    },
    blur: {
      scoreLabel: "Points",
      points: (n) => `+${n} pts`,
      endScore: (n) => (n === 1 ? "1 point" : `${n} points`),
      timeUp: "Temps écoulé",
      secondsLeft: (n) => `Années ${n}`,
      posterA11y: "Affiche floue",
    },
    rating: {
      format: (r) => `★ ${r.toFixed(1)}`,
      ratingA11y: (title, r) => `${title}, note TMDB ${r.toFixed(1)}`,
    },
    kind: { movie: "Film", tv: "Séries" },
    decadeLabel: (d) => `Années ${d}`,
    votes: (n) =>
      n >= 1e6 ? `${compact(n / 1e6, ".")} M votes` : n >= 1e3 ? `${compact(n / 1e3, ".")} k votes` : n === 1 ? "1 vote" : `${n} votes`,
    genres: {
      action: "Action", adventure: "Aventure", animation: "Animation", comedy: "Comédie", crime: "Crime",
      documentary: "Documentaire", drama: "Drame", family: "Family", fantasy: "Fantastique", history: "Histoire",
      horror: "Horreur", music: "Musique", mystery: "Mystère", romance: "Romance", scifi: "SF",
      thriller: "Thriller", war: "Guerre", western: "Western",
    },
  },
  ja: {
    gridTitle: "クイックゲーム",
    games: {
      popular: { title: "人気なのはどっち?", hint: "2枚のポスター:票が多いのはどっち?", prompt: "票が多いのはどっち?" },
      decade: { title: "どの年代?", hint: "ポスターを見て年代を当てよう", prompt: "これはどの年代に公開された?" },
      kind: { title: "映画?ドラマ?", hint: "ポスターを見て:映画?ドラマ?", prompt: "これは映画?ドラマ?" },
      genre: { title: "どのジャンル?", hint: "ポスターからジャンルを当てよう", prompt: "この作品のジャンルはどれ?" },
      blur: { title: "ぼやけたポスター", hint: "はっきりする前に当てて、ポイントをゲット", prompt: "この作品は何?" },
      rating: { title: "評価が高いのはどっち?", hint: "評価が高いポスターを選ぼう · 1回のミスで終了", prompt: "TMDB評価が高いのはどっち?" },
    },
    blur: {
      scoreLabel: "ポイント",
      points: (n) => `+${n}点`,
      endScore: (n) => (n === 1 ? "1ポイント" : `${n}ポイント`),
      timeUp: "時間切れ",
      secondsLeft: (n) => `${n}年代`,
      posterA11y: "ぼかしたポスター",
    },
    rating: {
      format: (r) => `★ ${r.toFixed(1)}`,
      ratingA11y: (title, r) => `${title}、TMDB評価 ${r.toFixed(1)}`,
    },
    kind: { movie: "映画", tv: "シリーズ" },
    decadeLabel: (d) => `${d}年代`,
    votes: (n) =>
      n >= 1e6 ? `${compact(n / 1e6, ".")}M票` : n >= 1e3 ? `${compact(n / 1e3, ".")}K票` : n === 1 ? "1票" : `${n}票`,
    genres: {
      action: "アクション", adventure: "アドベンチャー", animation: "アニメーション", comedy: "コメディ", crime: "犯罪",
      documentary: "ドキュメンタリー", drama: "ドラマ", family: "Family", fantasy: "ファンタジー", history: "歴史",
      horror: "ホラー", music: "音楽", mystery: "ミステリー", romance: "ロマンス", scifi: "SF",
      thriller: "スリラー", war: "戦争", western: "西部劇",
    },
  }};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getQuickCopy = (language) => QUICK_COPY[copyLanguage(language, Object.keys(QUICK_COPY))];

/**
 * Bir şıkkın metni (oyuna göre): film/dizi etiketi, on yıl biçimi ve tür adı. Pair/rating oyunlarında
 * şık afiştir (metin yok); Bulanık Afiş'te şık yapımın kendi başlığıdır (`option.title`, çeviri yok).
 */
export function quickOptionLabel(copy, gameId, key) {
  if (gameId === "kind") return copy.kind[key] || key;
  if (gameId === "decade") return copy.decadeLabel(Number(key));
  if (gameId === "genre") return copy.genres[key] || key;
  return key;
}
