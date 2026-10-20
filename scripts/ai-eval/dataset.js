// scripts/ai-eval/dataset.js
//
// Değerlendirme vakaları. ⚠️ Bunlar GERÇEK kullanıcı günlükleri değil, uygulamadaki
// tipik istekleri (öneri, karşılaştırma, plan, liste, künye, sohbet, konu dışı,
// takip) taklit eden elle yazılmış örneklerdir. Ölçümün güvenilirliği için mümkünse
// kendi gerçek isteklerinden 20–30 tanesini `extraCases.json` olarak ekle
// (bkz. README). Aynı dosya biçimi geçerlidir.
//
// Vaka alanları:
//   id, language (tr|en|es), persona, message, expect: [yanıt tipleri]
//   history?      önceki turlar [{role, text}]
//   avoidTitles?  bu sohbette zaten önerilenler (avoidBlock'a gider)
//   style?        { responseStyle, spoilerLevel, maxItems }
//   targetMedia?  tek yapım sorusu (cevap uygulamada title_spotlight'a kilitlenir)
//   fromList?     "watchList" | "favorites" → seçimler yalnız o listeden olmalı
//   offTopic?     true → birebir ret cümlesi beklenir

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 17);

/** [ad, [tür...]] → allLists öğeleri (en yeni önce). */
function mk(entries, type, startDaysAgo = 1, stepDays = 9) {
  return entries.map(([name, genres], i) => ({
    id: 1000 + i + (type === "tv" ? 500 : 0),
    name,
    type,
    genres,
    dateAdded: new Date(NOW - (startDaysAgo + i * stepDays) * DAY).toISOString(),
  }));
}

export const PERSONAS = {
  none: { movieGenres: [], tvGenres: [], lists: null },

  tr_scifi: {
    movieGenres: ["Bilim Kurgu", "Gerilim", "Dram"],
    tvGenres: ["Bilim Kurgu & Fantazi", "Suç", "Dram"],
    lists: {
      watchList: [
        ...mk([["Dune: Part Two", ["Bilim Kurgu", "Macera"]], ["Past Lives", ["Dram", "Romantik"]], ["The Zone of Interest", ["Dram", "Tarih"]], ["Civil War", ["Aksiyon", "Gerilim"]]], "movie", 2, 11),
        ...mk([["Severance", ["Dram", "Gizem"]], ["Slow Horses", ["Dram", "Suç"]], ["Shōgun", ["Dram", "Tarih"]]], "tv", 3, 13),
      ],
      favorites: [
        ...mk([["Blade Runner 2049", ["Bilim Kurgu"]], ["Interstellar", ["Bilim Kurgu", "Dram"]], ["Parasite", ["Gerilim", "Dram"]]], "movie", 20, 30),
        ...mk([["Dark", ["Bilim Kurgu & Fantazi", "Gizem"]], ["Chernobyl", ["Dram", "Tarih"]], ["Mindhunter", ["Suç", "Dram"]]], "tv", 25, 30),
      ],
      Haftasonu: mk([["Prisoners", ["Gerilim", "Suç"]], ["Gone Girl", ["Gerilim", "Gizem"]], ["Zodiac", ["Suç", "Gizem"]], ["Se7en", ["Suç", "Gerilim"]]], "movie", 40, 7),
      watchedMovies: mk(
        [["Inception", ["Bilim Kurgu"]], ["The Matrix", ["Bilim Kurgu", "Aksiyon"]], ["Arrival", ["Bilim Kurgu", "Dram"]], ["Ex Machina", ["Bilim Kurgu", "Gerilim"]], ["Oppenheimer", ["Dram", "Tarih"]], ["Joker", ["Suç", "Dram"]], ["Whiplash", ["Dram", "Müzik"]], ["Dune", ["Bilim Kurgu", "Macera"]], ["Tenet", ["Aksiyon", "Bilim Kurgu"]], ["Her", ["Romantik", "Bilim Kurgu"]], ["Moon", ["Bilim Kurgu"]], ["Annihilation", ["Bilim Kurgu", "Korku"]], ["Sicario", ["Suç", "Gerilim"]], ["Nightcrawler", ["Gerilim", "Suç"]], ["The Prestige", ["Dram", "Gizem"]], ["Memento", ["Gizem", "Gerilim"]], ["Shutter Island", ["Gizem", "Gerilim"]], ["Gravity", ["Bilim Kurgu", "Gerilim"]]],
        "movie", 4, 6,
      ),
      watchedTv: mk([["Breaking Bad", ["Suç", "Dram"]], ["Black Mirror", ["Bilim Kurgu & Fantazi", "Dram"]]], "tv", 5, 8),
    },
  },

  en_comfort: {
    movieGenres: ["Comedy", "Animation", "Romance"],
    tvGenres: ["Comedy", "Animation", "Drama"],
    lists: {
      watchList: [
        ...mk([["The Holdovers", ["Comedy", "Drama"]], ["Paddington 2", ["Family", "Comedy"]], ["Palm Springs", ["Comedy", "Romance"]]], "movie", 2, 10),
        ...mk([["Ted Lasso", ["Comedy", "Drama"]], ["Abbott Elementary", ["Comedy"]], ["Bluey", ["Animation", "Family"]]], "tv", 3, 12),
      ],
      favorites: [
        ...mk([["The Grand Budapest Hotel", ["Comedy", "Adventure"]], ["Spirited Away", ["Animation", "Fantasy"]]], "movie", 30, 40),
        ...mk([["Parks and Recreation", ["Comedy"]], ["Arcane", ["Animation", "Drama"]]], "tv", 35, 40),
      ],
      watchedMovies: mk(
        [["Superbad", ["Comedy"]], ["Toy Story", ["Animation", "Family"]], ["Up", ["Animation", "Adventure"]], ["Knives Out", ["Comedy", "Crime"]], ["Everything Everywhere All at Once", ["Sci-Fi", "Comedy"]], ["Crazy Rich Asians", ["Comedy", "Romance"]], ["Barbie", ["Comedy", "Fantasy"]], ["Soul", ["Animation", "Comedy"]], ["La La Land", ["Romance", "Music"]], ["Home Alone", ["Comedy", "Family"]], ["Shrek", ["Animation", "Comedy"]], ["Ratatouille", ["Animation", "Family"]]],
        "movie", 4, 7,
      ),
      watchedTv: mk([["The Office", ["Comedy"]], ["Brooklyn Nine-Nine", ["Comedy", "Crime"]], ["Schitt's Creek", ["Comedy"]], ["Friends", ["Comedy"]]], "tv", 5, 9),
    },
  },
};

/** aiUserContext ile aynı kural: tüm izlenenlerden EN YENİ 20'sinin adı modele gider. */
export function visibleWatched(persona) {
  const lists = PERSONAS[persona]?.lists;
  if (!lists) return [];
  return [...(lists.watchedMovies || []), ...(lists.watchedTv || [])]
    .slice()
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .slice(0, 20)
    .map((it) => it.name);
}

export const OFF_TOPIC_REPLY = {
  tr: "Yalnızca film, dizi ve izlenebilir içeriklerle ilgili yardımcı olabilirim.",
  en: "I can only help with movies, TV series, and watchable content.",
  es: "Solo puedo ayudar con películas, series y contenido para ver.",
};

const rec = ["recommendations"];
const c = (id, category, language, persona, message, expect, extra = {}) => ({
  id, category, language, persona, message, expect, ...extra,
});

const hist = (userText, assistantText) => [
  { role: "user", text: userText },
  { role: "model", text: assistantText },
];

export const CASES = [
  // ── Öneri (recommendations) ─────────────────────────────────────────────
  c("rec-tr-01", "öneri", "tr", "none", "Bu akşam izlemek için gerilim filmi öner", rec),
  c("rec-tr-02", "öneri", "tr", "none", "Kafa karıştıran, sonu şaşırtan filmler istiyorum", rec),
  c("rec-tr-03", "öneri", "tr", "tr_scifi", "Bana uygun yeni bir şey öner", rec),
  c("rec-tr-04", "öneri", "tr", "tr_scifi", "Arrival ve Ex Machina'yı sevdim, benzer bir şey var mı?", rec),
  c("rec-tr-05", "öneri", "tr", "none", "Ailecek izleyebileceğimiz, çocuklara uygun animasyon filmi", rec),
  c("rec-tr-06", "öneri", "tr", "none", "2025'te çıkan iyi korku filmleri neler?", rec),
  c("rec-tr-07", "öneri", "tr", "none", "Güney Kore'den az bilinen ama çok iyi gerilim filmleri", rec),
  c("rec-tr-08", "öneri", "tr", "none", "Hafta sonu maratonu yapmalık 3 sezonluk bir dizi", rec),
  c("rec-tr-09", "öneri", "tr", "none", "Türk yapımı son yılların en iyi dizileri", rec),
  c("rec-tr-10", "öneri", "tr", "tr_scifi", "İzleme listemden bu gece ne izlesem?", rec, { fromList: "watchList" }),
  c("rec-tr-11", "öneri", "tr", "tr_scifi", "Favorilerimden yola çıkarak benzer diziler öner", rec),
  c("rec-tr-12", "öneri", "tr", "none", "Sevgilimle izlemelik hafif bir romantik komedi", rec),
  c("rec-en-01", "öneri", "en", "none", "Recommend a slow-burn mystery series", rec),
  c("rec-en-02", "öneri", "en", "en_comfort", "Something cozy to watch tonight", rec),
  c("rec-en-03", "öneri", "en", "en_comfort", "Pick something from my watchlist for a rainy Sunday", rec, { fromList: "watchList" }),
  c("rec-en-04", "öneri", "en", "none", "Underrated sci-fi movies from the 2010s", rec),
  c("rec-en-05", "öneri", "en", "none", "Best miniseries released in 2025 or 2026", rec),
  c("rec-en-06", "öneri", "en", "en_comfort", "I loved Ted Lasso. What else is like it?", rec),
  c("rec-es-01", "öneri", "es", "none", "Recomiéndame una película de terror psicológico", rec),
  c("rec-es-02", "öneri", "es", "none", "Series españolas que valgan la pena", rec),
  c("rec-es-03", "öneri", "es", "none", "Algo ligero para ver en familia este fin de semana", rec),
  c("rec-es-04", "öneri", "es", "en_comfort", "¿Qué comedia me recomiendas esta noche?", rec),
  // ── Stil / sınır varyantları ────────────────────────────────────────────
  c("style-tr-01", "stil", "tr", "tr_scifi", "Bilim kurgu öner", rec, { style: { responseStyle: "concise", spoilerLevel: "none", maxItems: 3 } }),
  c("style-tr-02", "stil", "tr", "none", "Dram filmi öner", rec, { style: { responseStyle: "detailed", spoilerLevel: "light", maxItems: 8 } }),
  c("style-en-01", "stil", "en", "none", "Give me anime recommendations", rec, { style: { responseStyle: "balanced", spoilerLevel: "none", maxItems: 8 } }),
  // ── Karşılaştırma ───────────────────────────────────────────────────────
  c("cmp-tr-01", "karşılaştırma", "tr", "none", "Breaking Bad mi Better Call Saul mu?", ["comparison"]),
  c("cmp-tr-02", "karşılaştırma", "tr", "none", "Inception mı Interstellar mı daha iyi?", ["comparison"]),
  c("cmp-tr-03", "karşılaştırma", "tr", "none", "Dark ile Stranger Things'i karşılaştır", ["comparison"]),
  c("cmp-tr-04", "karşılaştırma", "tr", "none", "Oppenheimer vs Barbie, hangisi izlemeye değer?", ["comparison"]),
  c("cmp-en-01", "karşılaştırma", "en", "none", "The Office US vs The Office UK", ["comparison"]),
  c("cmp-en-02", "karşılaştırma", "en", "none", "Dune (2021) versus Blade Runner 2049", ["comparison"]),
  c("cmp-en-03", "karşılaştırma", "en", "none", "Which is better, Succession or Billions?", ["comparison"]),
  c("cmp-es-01", "karşılaştırma", "es", "none", "La casa de papel o Narcos: ¿cuál es mejor?", ["comparison"]),
  // ── İzleme planı ────────────────────────────────────────────────────────
  c("plan-tr-01", "plan", "tr", "none", "Stranger Things'i 5 günde bitirmek istiyorum, plan yap", ["watch_plan"]),
  c("plan-tr-02", "plan", "tr", "none", "Cumartesi film gecesi için 3 filmlik bir program hazırla", ["watch_plan"]),
  c("plan-tr-03", "plan", "tr", "none", "Marvel filmlerini hangi sırayla izlemeliyim? Bir haftalık plan", ["watch_plan", "watchlist"]),
  c("plan-en-01", "plan", "en", "none", "Plan a Studio Ghibli weekend marathon", ["watch_plan"]),
  c("plan-en-02", "plan", "en", "none", "I have 4 days. How do I finish The Wire?", ["watch_plan"]),
  c("plan-es-01", "plan", "es", "none", "Organiza un maratón de Harry Potter para el fin de semana", ["watch_plan"]),
  // ── Liste (watchlist) ───────────────────────────────────────────────────
  c("list-tr-01", "liste", "tr", "none", "En iyi uzay filmleri listesi hazırla", ["watchlist"]),
  c("list-tr-02", "liste", "tr", "none", "Bir kerede bitirilecek kısa diziler koleksiyonu yap", ["watchlist"]),
  c("list-tr-03", "liste", "tr", "none", "Christopher Nolan filmlerini en iyiden başlayarak sırala", ["watchlist"]),
  c("list-tr-04", "liste", "tr", "tr_scifi", "Yağmurlu günler için bir koleksiyon yap", ["watchlist"]),
  c("list-en-01", "liste", "en", "none", "A watchlist of essential heist movies", ["watchlist"]),
  c("list-en-02", "liste", "en", "none", "Make me a collection of feel-good true stories", ["watchlist"]),
  c("list-es-01", "liste", "es", "none", "Una lista con las mejores películas de ciencia ficción de los 80", ["watchlist"]),
  // ── Künye (tek yapım) ───────────────────────────────────────────────────
  c("spot-tr-01", "künye", "tr", "none", "Parasite hakkında bilgi ver", ["title_spotlight"]),
  c("spot-tr-02", "künye", "tr", "none", "Dark dizisinin oyuncuları kimler, nereden izlerim?", ["title_spotlight"]),
  c("spot-tr-03", "künye", "tr", "none", "Eşkıya filmi hakkında bilgi verir misin?", ["title_spotlight"]),
  c("spot-en-01", "künye", "en", "none", "Tell me about Severance", ["title_spotlight"]),
  c("spot-en-02", "künye", "en", "none", "Who directed Past Lives and is it worth watching?", ["title_spotlight"]),
  c("spot-es-01", "künye", "es", "none", "Cuéntame sobre Parásitos", ["title_spotlight"]),
  c("lock-tr-01", "künye (kilitli)", "tr", "none", "Bu film hakkında bilgi ver", ["title_spotlight"], {
    locked: true,
    targetMedia: { id: 27205, mediaType: "movie", title: "Başlangıç", originalTitle: "Inception", year: "2010", genres: ["Bilim Kurgu", "Aksiyon"], overview: "Rüyalara girerek fikir çalan bir hırsız, bu kez bir fikir yerleştirmekle görevlendirilir.", cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Elliot Page"] },
  }),
  c("lock-en-01", "künye (kilitli)", "en", "none", "Is this show worth my time?", ["title_spotlight"], {
    locked: true,
    targetMedia: { id: 1396, mediaType: "tv", title: "Breaking Bad", originalTitle: "Breaking Bad", year: "2008", genres: ["Drama", "Crime"], overview: "A chemistry teacher turned drug manufacturer.", cast: ["Bryan Cranston", "Aaron Paul"] },
  }),
  // ── Sohbet / bilgi (general) ────────────────────────────────────────────
  c("gen-tr-01", "genel", "tr", "none", "Merhaba!", ["general", "recommendations"]),
  c("gen-tr-02", "genel", "tr", "none", "Oscar'ı en çok kazanan film hangisi?", ["general"]),
  c("gen-tr-03", "genel", "tr", "none", "Christopher Nolan'ın en iyi filmi sence hangisi?", ["general", "watchlist", "recommendations"]),
  c("gen-en-01", "genel", "en", "none", "How many seasons does Game of Thrones have?", ["general"]),
  c("gen-en-02", "genel", "en", "none", "What's the difference between a miniseries and a limited series?", ["general"]),
  c("gen-es-01", "genel", "es", "none", "¿Quién ganó el Oscar a mejor película en 2020?", ["general"]),
  // ── Konu dışı ───────────────────────────────────────────────────────────
  c("off-tr-01", "konu dışı", "tr", "none", "Bana bir yemek tarifi ver", ["general"], { offTopic: true }),
  c("off-tr-02", "konu dışı", "tr", "none", "Python'da liste nasıl sıralanır?", ["general"], { offTopic: true }),
  c("off-en-01", "konu dışı", "en", "none", "What's the weather like in Paris?", ["general"], { offTopic: true }),
  c("off-en-02", "konu dışı", "en", "none", "Write me a cover letter for a marketing job", ["general"], { offTopic: true }),
  c("off-es-01", "konu dışı", "es", "none", "¿Cómo puedo invertir en bolsa?", ["general"], { offTopic: true }),
  // ── Takip (geçmiş + tekrar engeli) ──────────────────────────────────────
  c("fu-tr-01", "takip", "tr", "none", "Biraz daha öner", rec, {
    history: hist("Gerilim filmi öner", "recommendations: Prisoners, Gone Girl, Se7en, Zodiac, Nightcrawler"),
    avoidTitles: ["Prisoners", "Gone Girl", "Se7en", "Zodiac", "Nightcrawler"],
  }),
  c("fu-tr-02", "takip", "tr", "none", "Bunlardan daha eski olanlar olsun", rec, {
    history: hist("Bilim kurgu dizisi öner", "recommendations: Severance, Dark, Black Mirror, The Expanse"),
    avoidTitles: ["Severance", "Dark", "Black Mirror", "The Expanse"],
  }),
  c("fu-en-01", "takip", "en", "none", "More like the first one, please", rec, {
    history: hist("Recommend a heist movie", "recommendations: Heat, Ocean's Eleven, Baby Driver, Inside Man"),
    avoidTitles: ["Heat", "Ocean's Eleven", "Baby Driver", "Inside Man"],
  }),
  c("fu-en-02", "takip", "en", "en_comfort", "Anything shorter than 90 minutes?", rec, {
    history: hist("Something funny tonight", "recommendations: Superbad, Palm Springs, Game Night"),
    avoidTitles: ["Superbad", "Palm Springs", "Game Night"],
  }),
  c("fu-tr-03", "takip", "tr", "none", "Peki ya bunu kim yönetti?", ["general", "title_spotlight"], {
    history: hist("Oppenheimer hakkında bilgi ver", "title: Oppenheimer — Atom bombasının babası J. Robert Oppenheimer'ın hikâyesi."),
  }),
  c("fu-es-01", "takip", "es", "none", "Dame otras opciones", rec, {
    history: hist("Recomiéndame una serie de misterio", "recommendations: Dark, True Detective, Broadchurch"),
    avoidTitles: ["Dark", "True Detective", "Broadchurch"],
  }),
];
