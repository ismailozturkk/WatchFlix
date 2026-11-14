// utils/titleTasteFitCopy.js
//
// Film/dizi detayındaki "Zevk uyumunu değerlendir" kartının metinleri (tr / en / es / pt / de).
// Saf veri: RN içe aktarması yok. Hesap utils/titleTasteFit.js'te.

import { copyLanguage } from "./appLanguages";

const pctTr = (n) => `%${n}`;
const pctEn = (n) => `${n}%`;

export const TITLE_TASTE_FIT_COPY = {
  tr: {
    pct: pctTr,
    button: { title: "Sana uygun mu, değerlendir", subtitle: "Sana göre mi? İzlediklerin, puanların, türlerin" },
    loading: ["İzlediklerin taranıyor", "Puan alışkanlığın çıkarılıyor", "Tür eğilimin ölçülüyor", "Benzer yapımlar eşleşiyor", "Puanın tahmin ediliyor", "Sonuç hazırlanıyor"],
    title: "Sana uygunluk",
    tiers: {
      love: "Çok seversin",
      like: "Büyük ihtimalle beğenirsin",
      maybe: "Beğenebilirsin",
      mixed: "Kararsız kalabilirsin",
      skip: "Pek sana göre değil",
    },
    tierHints: {
      love: "Tam sana göre",
      like: "Sevdiğin şeylerle çok örtüşüyor",
      maybe: "Birkaç noktada sana uyuyor",
      mixed: "Artıları da eksileri de var",
      skip: "Genelde izlediklerinden uzak",
    },
    confidence: { high: "Güven yüksek", medium: "Güven orta", low: "Güven düşük" },
    lowData: "Analiz edilecek içerik az olduğu için değerlerde yanılma olabilir",
    lowDataShort: "Az veri · yanılma payı var",
    predictedLabel: "Tahmini puanın",
    analyzed: (watched, rated, likes) => `${watched} izlenen · ${rated} puan · ${likes} beğeni analiz edildi`,
    parts: {
      predicted: "Tahmini puan",
      genres: "Tür eğilimi",
      recent: "Son dönem",
      genreRate: "Tür puanların",
      combo: "Tür karışımı",
      likes: "Beğenilerin",
      avoid: "Kaçındıkların",
      similar: "Benzer yapımlar",
      interest: "İzleme listesi",
      format: "Film/dizi tercihi",
      runtime: "Süre uyumu",
      public: "Genel beğeni",
    },
    details: "Ayrıntılar",
    hide: "Gizle",
    again: "Yeniden",
    similarTitle: "İzlediğin benzerleri",
    insufficient: (n) => `Değerlendirme için en az ${n} izlediğin film/dizi gerekli. Biraz daha izleyince tekrar dene.`,
    insights: {
      predicted: (r, n) => `Benzer ${n} yapıma verdiğin puanlara göre buna ~${r} verirsin`,
      topGenre: (g, rank, share) => `${g}, en çok izlediğin ${rank}. tür (${pctTr(Math.round(share * 100))})`,
      newGenre: (g) => `${g} senin için pek keşfedilmemiş bir tür`,
      trendUp: (share) => `Son izlediklerinin ${pctTr(Math.round(share * 100))}'i bu türlerde — son zamanlarda ilgin artmış`,
      trendDown: () => "Son zamanlarda bu türlerden biraz uzaklaşmışsın",
      genreRating: (avg, overall) => `Bu türlere ortalama ${avg} veriyorsun (genel ortalaman ${overall})`,
      dislikes: (count, total) => `Bu türlerde ${total} yapımdan ${count} tanesine düşük puan verdin`,
      combo: (count) => `Bu tür karışımından ${count} yapım izledin`,
      likesHit: (count, total) => `Beğendiklerinden ${count}/${total} tanesi bu türlerde`,
      similar: (count, avg) => (avg == null ? `Benzer ${count} yapımı izledin` : `Benzer ${count} yapımı izledin, ortalama ${avg} verdin`),
      similarNone: () => "Benzerlerinden hiçbirini henüz izlemedin",
      formatRare: () => "Bu biçimde (film/dizi) pek içerik izlemiyorsun",
      runtimeLong: (runtime, med) => `${runtime} dk; genelde ~${med} dk'lık filmler izliyorsun`,
      runtimeShort: (runtime, med) => `${runtime} dk; alıştığından (~${med} dk) kısa`,
      publicHigh: (avg) => `İzleyiciler de çok sevmiş (${avg})`,
      publicLow: (avg) => `Genel puanı düşük (${avg})`,
      inWatchlist: () => "Zaten izleme listende",
      ownRating: (r) => `Sen ${r}/10 verdin — sonuç puanına göre ayarlandı`,
      sideGenre: (g, side, total) => `İzlediğin ${total} ${g} yapımının ${side} tanesinde ${g} yalnız yan tür — saf ${g} senin için farklı olabilir`,
      primaryLower: (g, p, s) => `Ana türü ${g} olanlara ${p}, ${g} yan türken ${s} veriyorsun`,
      primaryHigher: (g, p, s) => `Ana türü ${g} olanları daha çok seviyorsun (${p} · yan türken ${s})`,
      typeBasis: (isTv, same, other, borrowed) =>
        borrowed
          ? `Az ${isTv ? "dizi" : "film"} izlediğin için ${other} ${isTv ? "film" : "dizi"} geçmişin de (daha az ağırlıkla) katıldı`
          : `Analiz izlediğin ${same} ${isTv ? "diziye" : "filme"} dayanıyor; ${other} ${isTv ? "film" : "dizi"} daha az ağırlıkla katıldı`,
    },
  },
  en: {
    pct: pctEn,
    button: { title: "Check your taste match", subtitle: "Is it for you? Your watches, ratings, genres" },
    loading: ["Scanning what you've watched", "Learning how you rate", "Measuring your genre leanings", "Matching similar titles", "Predicting your rating", "Preparing your result"],
    title: "Taste match",
    tiers: {
      love: "You'll love it",
      like: "You'll most likely enjoy it",
      maybe: "You might like it",
      mixed: "Could go either way",
      skip: "Not really your thing",
    },
    tierHints: {
      love: "Right in your wheelhouse",
      like: "Lines up with what you enjoy",
      maybe: "Fits you in a few ways",
      mixed: "Some pluses, some minuses",
      skip: "Far from what you usually watch",
    },
    confidence: { high: "High confidence", medium: "Medium confidence", low: "Low confidence" },
    lowData: "There isn't much content to analyze, so these values may be off",
    lowDataShort: "Little data · may be off",
    predictedLabel: "Your predicted rating",
    analyzed: (watched, rated, likes) => `${watched} watched · ${rated} ratings · ${likes} likes analyzed`,
    parts: {
      predicted: "Predicted rating",
      genres: "Genre leaning",
      recent: "Lately",
      genreRate: "Your genre ratings",
      combo: "Genre mix",
      likes: "Your likes",
      avoid: "Your dislikes",
      similar: "Similar titles",
      interest: "Watchlist",
      format: "Movie/series habit",
      runtime: "Runtime fit",
      public: "Audience score",
    },
    details: "Details",
    hide: "Hide",
    again: "Redo",
    similarTitle: "Similar ones you've watched",
    insufficient: (n) => `You need at least ${n} watched titles for a taste match. Watch a bit more and try again.`,
    insights: {
      predicted: (r, n) => `Based on ${n} similar titles you rated, you'd give this ~${r}`,
      topGenre: (g, rank, share) => `${g} is your #${rank} most-watched genre (${pctEn(Math.round(share * 100))})`,
      newGenre: (g) => `${g} is mostly unexplored for you`,
      trendUp: (share) => `${pctEn(Math.round(share * 100))} of your recent watches are in these genres — your interest is rising`,
      trendDown: () => "You've drifted a bit away from these genres lately",
      genreRating: (avg, overall) => `You rate these genres ${avg} on average (overall ${overall})`,
      dislikes: (count, total) => `You rated ${count} of ${total} titles in these genres low`,
      combo: (count) => `You've watched ${count} titles with this genre mix`,
      likesHit: (count, total) => `${count} of your ${total} likes are in these genres`,
      similar: (count, avg) => (avg == null ? `You've watched ${count} similar titles` : `You've watched ${count} similar titles, rated ${avg} on average`),
      similarNone: () => "You haven't watched any similar titles yet",
      formatRare: () => "You rarely watch this format (movie/series)",
      sideGenre: (g, side, total) => `In ${side} of your ${total} ${g} titles it's only a side genre — pure ${g} may feel different`,
      primaryLower: (g, p, s) => `You rate ${g}-led titles ${p}, but ${s} when ${g} is a side genre`,
      primaryHigher: (g, p, s) => `You like ${g}-led titles more (${p} · ${s} as a side genre)`,
      typeBasis: (isTv, same, other, borrowed) =>
        borrowed
          ? `You watch few ${isTv ? "series" : "movies"}, so your taste in ${other} ${isTv ? "movies" : "series"} also counted (at lower weight)`
          : `Based on the ${same} ${isTv ? "series" : "movies"} you watched; ${other} ${isTv ? "movies" : "series"} counted at lower weight`,
      runtimeLong: (runtime, med) => `${runtime} min; you usually watch ~${med} min films`,
      runtimeShort: (runtime, med) => `${runtime} min; shorter than your usual (~${med} min)`,
      publicHigh: (avg) => `Audiences loved it too (${avg})`,
      publicLow: (avg) => `Low audience score (${avg})`,
      inWatchlist: () => "Already on your watchlist",
      ownRating: (r) => `You rated it ${r}/10 — result adjusted to your rating`,
    },
  },
  es: {
    pct: pctEn,
    button: { title: "Evalúa tu afinidad", subtitle: "¿Es para ti? Lo que ves, tus notas, géneros" },
    loading: ["Revisando lo que has visto", "Aprendiendo cómo puntúas", "Midiendo tus géneros", "Buscando títulos similares", "Estimando tu nota", "Preparando el resultado"],
    title: "Afinidad",
    tiers: {
      love: "Te va a encantar",
      like: "Muy probablemente te guste",
      maybe: "Puede que te guste",
      mixed: "Podrías dudar",
      skip: "No es muy lo tuyo",
    },
    tierHints: {
      love: "Encaja totalmente con tu gusto",
      like: "Coincide con lo que disfrutas",
      maybe: "Te encaja en algunos aspectos",
      mixed: "Tiene pros y contras",
      skip: "Lejos de lo que sueles ver",
    },
    confidence: { high: "Confianza alta", medium: "Confianza media", low: "Confianza baja" },
    lowData: "Hay poco contenido para analizar, así que los valores pueden no ser exactos",
    lowDataShort: "Pocos datos · puede fallar",
    predictedLabel: "Tu nota estimada",
    analyzed: (watched, rated, likes) => `${watched} vistos · ${rated} notas · ${likes} favoritos analizados`,
    parts: {
      predicted: "Nota estimada",
      genres: "Afinidad de género",
      recent: "Últimamente",
      genreRate: "Tus notas por género",
      combo: "Mezcla de géneros",
      likes: "Tus favoritos",
      avoid: "Lo que evitas",
      similar: "Títulos similares",
      interest: "Lista por ver",
      format: "Película/serie",
      runtime: "Duración",
      public: "Valoración general",
    },
    details: "Detalles",
    hide: "Ocultar",
    again: "Repetir",
    similarTitle: "Similares que has visto",
    insufficient: (n) => `Necesitas al menos ${n} títulos vistos para evaluar. Ve un poco más y vuelve a intentarlo.`,
    insights: {
      predicted: (r, n) => `Según tus notas a ${n} títulos similares, le darías ~${r}`,
      topGenre: (g, rank, share) => `${g} es tu género n.º ${rank} más visto (${pctEn(Math.round(share * 100))})`,
      newGenre: (g) => `${g} es un género poco explorado para ti`,
      trendUp: (share) => `El ${pctEn(Math.round(share * 100))} de lo último que viste es de estos géneros — tu interés va en aumento`,
      trendDown: () => "Últimamente te has alejado un poco de estos géneros",
      genreRating: (avg, overall) => `Das a estos géneros un ${avg} de media (general ${overall})`,
      dislikes: (count, total) => `Pusiste nota baja a ${count} de ${total} títulos de estos géneros`,
      combo: (count) => `Has visto ${count} títulos con esta mezcla de géneros`,
      likesHit: (count, total) => `${count} de tus ${total} favoritos son de estos géneros`,
      similar: (count, avg) => (avg == null ? `Has visto ${count} títulos similares` : `Has visto ${count} títulos similares, con ${avg} de media`),
      similarNone: () => "Aún no has visto ningún título similar",
      formatRare: () => "Casi no ves este formato (película/serie)",
      sideGenre: (g, side, total) => `En ${side} de tus ${total} títulos de ${g} es solo un género secundario — ${g} puro puede sentirse distinto`,
      primaryLower: (g, p, s) => `A los títulos de ${g} como género principal les das ${p}; cuando es secundario, ${s}`,
      primaryHigher: (g, p, s) => `Te gustan más los títulos de ${g} como género principal (${p} · secundario ${s})`,
      typeBasis: (isTv, same, other, borrowed) =>
        borrowed
          ? `Ves pocas ${isTv ? "series" : "películas"}, así que también contó tu gusto en ${other} ${isTv ? "películas" : "series"} (con menos peso)`
          : `Basado en las ${same} ${isTv ? "series" : "películas"} que viste; ${other} ${isTv ? "películas" : "series"} contaron con menos peso`,
      runtimeLong: (runtime, med) => `${runtime} min; sueles ver películas de ~${med} min`,
      runtimeShort: (runtime, med) => `${runtime} min; más corta de lo habitual (~${med} min)`,
      publicHigh: (avg) => `Al público también le encantó (${avg})`,
      publicLow: (avg) => `Valoración general baja (${avg})`,
      inWatchlist: () => "Ya está en tu lista por ver",
      ownRating: (r) => `Le diste ${r}/10 — resultado ajustado a tu nota`,
    },
  },
  pt: {
    pct: pctEn,
    button: { title: "Avalie sua afinidade", subtitle: "É para você? O que assiste, notas, gêneros" },
    loading: ["Analisando o que você assistiu", "Entendendo como você avalia", "Medindo seus gêneros", "Buscando títulos parecidos", "Estimando sua nota", "Preparando o resultado"],
    title: "Afinidade",
    tiers: {
      love: "Você vai amar",
      like: "Muito provavelmente vai gostar",
      maybe: "Pode ser que goste",
      mixed: "Pode ficar em dúvida",
      skip: "Não é muito a sua praia",
    },
    tierHints: {
      love: "Combina totalmente com seu gosto",
      like: "Bate com o que você curte",
      maybe: "Combina com você em alguns pontos",
      mixed: "Tem prós e contras",
      skip: "Longe do que você costuma ver",
    },
    confidence: { high: "Confiança alta", medium: "Confiança média", low: "Confiança baixa" },
    lowData: "Há pouco conteúdo para analisar, então os valores podem não ser precisos",
    lowDataShort: "Poucos dados · pode errar",
    predictedLabel: "Sua nota estimada",
    analyzed: (watched, rated, likes) => `${watched} assistidos · ${rated} notas · ${likes} favoritos analisados`,
    parts: {
      predicted: "Nota estimada",
      genres: "Afinidade de gênero",
      recent: "Ultimamente",
      genreRate: "Suas notas por gênero",
      combo: "Mistura de gêneros",
      likes: "Seus favoritos",
      avoid: "O que você evita",
      similar: "Títulos parecidos",
      interest: "Sua lista",
      format: "Filme/série",
      runtime: "Duração",
      public: "Nota do público",
    },
    details: "Detalhes",
    hide: "Ocultar",
    again: "Refazer",
    similarTitle: "Parecidos que você viu",
    insufficient: (n) => `Você precisa de pelo menos ${n} títulos assistidos para avaliar. Assista um pouco mais e tente de novo.`,
    insights: {
      predicted: (r, n) => `Pelas suas notas em ${n} títulos parecidos, você daria ~${r}`,
      topGenre: (g, rank, share) => `${g} é seu ${rank}º gênero mais visto (${pctEn(Math.round(share * 100))})`,
      newGenre: (g) => `${g} é um gênero pouco explorado por você`,
      trendUp: (share) => `${pctEn(Math.round(share * 100))} do que você viu recentemente é desses gêneros — seu interesse está crescendo`,
      trendDown: () => "Ultimamente você se afastou um pouco desses gêneros",
      genreRating: (avg, overall) => `Você dá ${avg} em média a esses gêneros (geral ${overall})`,
      dislikes: (count, total) => `Você deu nota baixa a ${count} de ${total} títulos desses gêneros`,
      combo: (count) => `Você viu ${count} títulos com essa mistura de gêneros`,
      likesHit: (count, total) => `${count} dos seus ${total} favoritos são desses gêneros`,
      similar: (count, avg) => (avg == null ? `Você viu ${count} títulos parecidos` : `Você viu ${count} títulos parecidos, média ${avg}`),
      similarNone: () => "Você ainda não viu nenhum título parecido",
      formatRare: () => "Você quase não assiste a esse formato (filme/série)",
      sideGenre: (g, side, total) => `Em ${side} dos seus ${total} títulos de ${g} ele é só gênero secundário — ${g} puro pode ser diferente`,
      primaryLower: (g, p, s) => `Títulos com ${g} como gênero principal recebem ${p}; quando é secundário, ${s}`,
      primaryHigher: (g, p, s) => `Você gosta mais de títulos com ${g} como gênero principal (${p} · secundário ${s})`,
      typeBasis: (isTv, same, other, borrowed) =>
        borrowed
          ? `Você assiste a ${isTv ? "poucas séries" : "poucos filmes"}, então seu gosto em ${other} ${isTv ? "filmes" : "séries"} também contou (com peso menor)`
          : `Baseado nos ${same} ${isTv ? "séries" : "filmes"} que você assistiu; ${other} ${isTv ? "filmes" : "séries"} contaram com peso menor`,
      runtimeLong: (runtime, med) => `${runtime} min; você costuma ver filmes de ~${med} min`,
      runtimeShort: (runtime, med) => `${runtime} min; mais curto que o habitual (~${med} min)`,
      publicHigh: (avg) => `O público também amou (${avg})`,
      publicLow: (avg) => `Nota do público baixa (${avg})`,
      inWatchlist: () => "Já está na sua lista",
      ownRating: (r) => `Você deu ${r}/10 — resultado ajustado à sua nota`,
    },
  },
  de: {
    pct: pctEn,
    button: { title: "Geschmack prüfen", subtitle: "Passt das zu dir? Gesehenes, Bewertungen, Genres" },
    loading: ["Gesehenes wird durchsucht", "Dein Bewertungsstil wird gelernt", "Genre-Vorlieben werden gemessen", "Ähnliche Titel werden abgeglichen", "Deine Wertung wird geschätzt", "Ergebnis wird vorbereitet"],
    title: "Geschmack",
    tiers: {
      love: "Wirst du lieben",
      like: "Gefällt dir sehr wahrscheinlich",
      maybe: "Könnte dir gefallen",
      mixed: "Könnte so oder so ausgehen",
      skip: "Eher nicht dein Ding",
    },
    tierHints: {
      love: "Trifft genau deinen Geschmack",
      like: "Passt zu dem, was du magst",
      maybe: "Passt in einigen Punkten",
      mixed: "Hat Stärken und Schwächen",
      skip: "Weit weg von dem, was du sonst schaust",
    },
    confidence: { high: "Hohe Sicherheit", medium: "Mittlere Sicherheit", low: "Geringe Sicherheit" },
    lowData: "Es gibt wenig Inhalte zur Analyse, daher können die Werte ungenau sein",
    lowDataShort: "Wenig Daten · evtl. ungenau",
    predictedLabel: "Deine geschätzte Wertung",
    analyzed: (watched, rated, likes) => `${watched} gesehen · ${rated} Wertungen · ${likes} Favoriten analysiert`,
    parts: {
      predicted: "Geschätzte Wertung",
      genres: "Genre-Vorliebe",
      recent: "Zuletzt",
      genreRate: "Deine Genre-Wertungen",
      combo: "Genre-Mix",
      likes: "Deine Favoriten",
      avoid: "Was du meidest",
      similar: "Ähnliche Titel",
      interest: "Merkliste",
      format: "Film/Serie",
      runtime: "Laufzeit",
      public: "Publikumswertung",
    },
    details: "Details",
    hide: "Ausblenden",
    again: "Neu",
    similarTitle: "Ähnliche, die du gesehen hast",
    insufficient: (n) => `Für eine Einschätzung brauchst du mindestens ${n} gesehene Titel. Schau noch etwas mehr und versuch es erneut.`,
    insights: {
      predicted: (r, n) => `Nach deinen Wertungen für ${n} ähnliche Titel würdest du ~${r} geben`,
      topGenre: (g, rank, share) => `${g} ist dein Genre Nr. ${rank} (${pctEn(Math.round(share * 100))})`,
      newGenre: (g) => `${g} hast du kaum erkundet`,
      trendUp: (share) => `${pctEn(Math.round(share * 100))} deiner letzten Titel sind in diesen Genres — dein Interesse steigt`,
      trendDown: () => "Zuletzt hast du dich etwas von diesen Genres entfernt",
      genreRating: (avg, overall) => `Diese Genres bewertest du im Schnitt mit ${avg} (gesamt ${overall})`,
      dislikes: (count, total) => `${count} von ${total} Titeln in diesen Genres hast du schlecht bewertet`,
      combo: (count) => `Du hast ${count} Titel mit diesem Genre-Mix gesehen`,
      likesHit: (count, total) => `${count} deiner ${total} Favoriten sind in diesen Genres`,
      similar: (count, avg) => (avg == null ? `Du hast ${count} ähnliche Titel gesehen` : `Du hast ${count} ähnliche Titel gesehen, Schnitt ${avg}`),
      similarNone: () => "Du hast noch keinen ähnlichen Titel gesehen",
      formatRare: () => "Dieses Format (Film/Serie) schaust du selten",
      sideGenre: (g, side, total) => `Bei ${side} deiner ${total} ${g}-Titel ist es nur Nebengenre — reines ${g} kann anders wirken`,
      primaryLower: (g, p, s) => `Titel mit ${g} als Hauptgenre bewertest du mit ${p}, als Nebengenre mit ${s}`,
      primaryHigher: (g, p, s) => `Titel mit ${g} als Hauptgenre magst du mehr (${p} · als Nebengenre ${s})`,
      typeBasis: (isTv, same, other, borrowed) =>
        borrowed
          ? `Du schaust wenige ${isTv ? "Serien" : "Filme"}, daher zählte auch dein Geschmack bei ${other} ${isTv ? "Filmen" : "Serien"} (schwächer gewichtet)`
          : `Basiert auf ${same} gesehenen ${isTv ? "Serien" : "Filmen"}; ${other} ${isTv ? "Filme" : "Serien"} zählten schwächer`,
      runtimeLong: (runtime, med) => `${runtime} Min.; du schaust meist ~${med}-Min.-Filme`,
      runtimeShort: (runtime, med) => `${runtime} Min.; kürzer als gewohnt (~${med} Min.)`,
      publicHigh: (avg) => `Auch das Publikum liebt ihn (${avg})`,
      publicLow: (avg) => `Niedrige Publikumswertung (${avg})`,
      inWatchlist: () => "Schon auf deiner Merkliste",
      ownRating: (r) => `Du hast ${r}/10 gegeben — Ergebnis an deine Wertung angepasst`,
    },
  },

  it: {
  pct: pctEn,
  button: {
    title: "Verifica la corrispondenza dei tuoi gusti",
    subtitle: "Fa per te? Le tue visioni, valutazioni, generi"
  },
  loading: ["Scansione di ciò che hai guardato", "Scoprire come valuti", "Misurare le tue inclinazioni di genere", "Abbinare titoli simili", "Prevedere la tua valutazione", "Preparare il tuo risultato"],
  title: "Abbinamento di gusti",
  tiers: {
    love: "Ti piacerà",
    like: "Molto probabilmente ti piacerà",
    maybe: "Potrebbe piacerti",
    mixed: "Potrebbe andare in entrambi i casi",
    skip: "Non proprio adatto a te"
  },
  tierHints: {
    love: "Direttamente nelle tue mani",
    like: "Si allinea a ciò che ti piace",
    maybe: "Si adatta a te in diversi modi",
    mixed: "Alcuni vantaggi, alcuni svantaggi",
    skip: "Lontano da ciò che guardi di solito"
  },
  confidence: {
    high: "Alta confidenza",
    medium: "Media confidenza",
    low: "Bassa confidenza"
  },
  lowData: "Non ci sono molti contenuti da analizzare, quindi questi valori potrebbero essere sbagliati",
  lowDataShort: "Pochi dati · potrebbero essere errati",
  predictedLabel: "La tua valutazione prevista",
  analyzed: (watched, rated, likes) => `${watched} guardato · ${rated} valutazioni · ${likes} Mi piace analizzati`,
  parts: {
    predicted: "Valutazione prevista",
    genres: "Genere orientato",
    recent: "Ultimamente",
    genreRate: "Le tue valutazioni di genere",
    combo: "Mix di generi",
    likes: "I tuoi Mi piace",
    avoid: "Le tue Non mi piace",
    similar: "Titoli simili",
    interest: "Da vedere",
    format: "Abitudini di film/serie",
    runtime: "Adeguatezza in termini di autonomia",
    public: "Punteggio del pubblico"
  },
  details: "Dettagli",
  hide: "Nascondi",
  again: "Ripeti",
  similarTitle: "Quelli simili che hai guardato",
  insufficient: n => `Devi avere almeno ${n} titoli guardati per una corrispondenza di gusto. Guarda un altro po' e riprova.`,
  insights: {
    predicted: (r, n) => `Sulla base di ${n} titoli simili che hai valutato, diresti che ~${r}`,
    topGenre: (g, rank, share) => `${g} è il tuo #${rank} genere più visto (${pctEn(Math.round(share * 100))})`,
    newGenre: g => `${g} è per te in gran parte inesplorato`,
    trendUp: share => `${pctEn(Math.round(share * 100))} dei tuoi titoli visti di recente appartengono a questi generi: il tuo interesse è in aumento`,
    trendDown: () => "Ultimamente ti sei allontanato un po' da questi generi",
    genreRating: (avg, overall) => `Valuti questi generi in media ${avg} (complessivamente ${overall})`,
    dislikes: (count, total) => `Hai valutato basso ${count} di ${total} titoli di questi generi`,
    combo: count => `Hai guardato ${count} titoli con questo mix di generi`,
    likesHit: (count, total) => `${count} dei tuoi ${total} Mi piace appartengono a questi generi`,
    similar: (count, avg) => avg == null ? `Hai guardato ${count} titoli simili` : `Hai guardato ${count} titoli simili, valutato in media ${avg}`,
    similarNone: () => "Non hai ancora guardato nessun titolo simile",
    formatRare: () => "Guardi raramente questo formato (film/serie)",
    sideGenre: (g, side, total) => `In ${side} dei tuoi titoli ${total} ${g} è solo un genere secondario: il puro ${g} potrebbe sembrare diverso`,
    primaryLower: (g, p, s) => `Valuti i titoli guidati da ${g} ${p}, ma ${s} quando ${g} è un genere secondario`,
    primaryHigher: (g, p, s) => `Ti piace Titoli guidati da ${g} in più (${p} · ${s} come genere secondario)`,
    typeBasis: (isTv, same, other, borrowed) => borrowed ? `Guardi pochi ${isTv ? "serie" : "film"}, quindi anche i tuoi gusti in ${other} ${isTv ? "film" : "serie"} hanno contato (con peso inferiore)` : `In base a ${same} ${isTv ? "serie" : "film"} che hai guardato; ${other} ${isTv ? "film" : "serie"} conteggiato con peso inferiore`,
    runtimeLong: (runtime, med) => `${runtime} minuto; di solito guardi ~${med} min film`,
    runtimeShort: (runtime, med) => `${runtime} min; più breve del solito (~${med} min)`,
    publicHigh: avg => `Anche il pubblico ha apprezzato (${avg})`,
    publicLow: avg => `Punteggio del pubblico basso (${avg})`,
    inWatchlist: () => "Già nella tua lista di titoli",
    ownRating: r => `Lo hai valutato ${r}/10: risultato adattato al tuo punteggio`
  }
},
  fr: {
    pct: pctEn,
    button: { title: "Vérifie ton affinité", subtitle: "Est-ce pour toi ? Tes visionnages, notes, genres" },
    loading: ["Analyse de ce que tu as regardé", "Apprentissage de ta façon de noter", "Mesure de tes penchants de genre", "Recherche de titres similaires", "Prédiction de ta note", "Préparation de ton résultat"],
    title: "Affinité",
    tiers: {
      love: "Tu vas adorer",
      like: "Tu vas très probablement aimer",
      maybe: "Ça pourrait te plaire",
      mixed: "Ça peut aller dans les deux sens",
      skip: "Pas vraiment ton truc",
    },
    tierHints: {
      love: "Pile dans tes goûts",
      like: "Correspond à ce que tu aimes",
      maybe: "Te correspond à certains égards",
      mixed: "Des plus et des moins",
      skip: "Loin de ce que tu regardes d'habitude",
    },
    confidence: { high: "Confiance élevée", medium: "Confiance moyenne", low: "Confiance faible" },
    lowData: "Il n'y a pas beaucoup de contenu à analyser, ces valeurs peuvent donc être imprécises",
    lowDataShort: "Peu de données · peut être imprécis",
    predictedLabel: "Ta note prédite",
    analyzed: (watched, rated, likes) => `${watched} vus · ${rated} notes · ${likes} j'aime analysés`,
    parts: {
      predicted: "Note prédite",
      genres: "Penchant de genre",
      recent: "Récemment",
      genreRate: "Tes notes par genre",
      combo: "Mélange de genres",
      likes: "Tes j'aime",
      avoid: "Tes je n'aime pas",
      similar: "Titres similaires",
      interest: "À voir",
      format: "Habitude films/séries",
      runtime: "Adéquation de durée",
      public: "Score du public",
    },
    details: "Détails",
    hide: "Masquer",
    again: "Rétablir",
    similarTitle: "Titres similaires que tu as vus",
    insufficient: (n) => `Il te faut au moins ${n} titres vus pour une affinité. Regarde-en un peu plus et réessaie.`,
    insights: {
      predicted: (r, n) => `D'après ${n} titres similaires que tu as notés, tu lui donnerais ~${r}`,
      topGenre: (g, rank, share) => `${g} est ton genre n°${rank} le plus regardé (${pctEn(Math.round(share * 100))})`,
      newGenre: (g) => `${g} est un genre que tu as peu exploré`,
      trendUp: (share) => `${pctEn(Math.round(share * 100))} de tes visionnages récents sont dans ces genres — ton intérêt grandit`,
      trendDown: () => "Tu t'es un peu éloigné de ces genres récemment",
      genreRating: (avg, overall) => `Tu notes ces genres ${avg} en moyenne (global ${overall})`,
      dislikes: (count, total) => `Tu as mal noté ${count} titres sur ${total} dans ces genres`,
      combo: (count) => `Tu as regardé ${count} titres avec ce mélange de genres`,
      likesHit: (count, total) => `${count} de tes ${total} j'aime sont dans ces genres`,
      similar: (count, avg) => (avg == null ? `Tu as regardé ${count} titres similaires` : `Tu as regardé ${count} titres similaires, notés ${avg} en moyenne`),
      similarNone: () => "Tu n'as encore regardé aucun titre similaire",
      formatRare: () => "Tu regardes rarement ce format (film/série)",
      sideGenre: (g, side, total) => `Dans ${side} de tes ${total} titres ${g}, ce n'est qu'un genre secondaire — du ${g} pur peut sembler différent`,
      primaryLower: (g, p, s) => `Tu notes les titres principalement ${g} ${p}, mais ${s} quand ${g} est un genre secondaire`,
      primaryHigher: (g, p, s) => `Tu préfères les titres principalement ${g} (${p} · ${s} en genre secondaire)`,
      typeBasis: (isTv, same, other, borrowed) =>
        borrowed
          ? `Tu regardes peu de ${isTv ? "séries" : "films"}, donc tes goûts en ${other} ${isTv ? "films" : "séries"} ont aussi compté (avec un poids réduit)`
          : `D'après les ${same} ${isTv ? "séries" : "films"} que tu as vus ; ${other} ${isTv ? "films" : "séries"} comptés avec un poids réduit`,
      runtimeLong: (runtime, med) => `${runtime} min ; tu regardes d'habitude des films de ~${med} min`,
      runtimeShort: (runtime, med) => `${runtime} min ; plus court que d'habitude (~${med} min)`,
      publicHigh: (avg) => `Le public a adoré aussi (${avg})`,
      publicLow: (avg) => `Score du public faible (${avg})`,
      inWatchlist: () => "Déjà dans ta liste à voir",
      ownRating: (r) => `Tu l'as noté ${r}/10 — résultat ajusté à ta note`,
    },
  },
  ja: {
    pct: pctEn,
    button: { title: "好みの一致を確認", subtitle: "あなた向き?視聴、評価、ジャンルから" },
    loading: ["観た作品をスキャン中", "評価の傾向を学習中", "ジャンルの好みを測定中", "似た作品を照合中", "評価を予測中", "結果を準備中"],
    title: "好みの一致",
    tiers: {
      love: "きっと大好きになります",
      like: "おそらく楽しめます",
      maybe: "気に入るかもしれません",
      mixed: "どちらとも言えません",
      skip: "あまり好みではなさそう",
    },
    tierHints: {
      love: "まさにあなたの得意分野",
      like: "あなたの好みと一致しています",
      maybe: "いくつかの点で合っています",
      mixed: "プラスもマイナスもあります",
      skip: "いつも観るものとはかけ離れています",
    },
    confidence: { high: "信頼度:高", medium: "信頼度:中", low: "信頼度:低" },
    lowData: "分析できるコンテンツが少ないため、これらの値は正確でない可能性があります",
    lowDataShort: "データ少なめ · ずれる可能性あり",
    predictedLabel: "予測評価",
    analyzed: (watched, rated, likes) => `視聴${watched}件 · 評価${rated}件 · いいね${likes}件を分析`,
    parts: {
      predicted: "予測評価",
      genres: "ジャンルの傾向",
      recent: "最近",
      genreRate: "あなたのジャンル別評価",
      combo: "ジャンルの組み合わせ",
      likes: "好きな作品",
      avoid: "好きではない作品",
      similar: "似ている作品",
      interest: "ウォッチリスト",
      format: "映画/ドラマの習慣",
      runtime: "上映時間の相性",
      public: "視聴者スコア",
    },
    details: "詳細",
    hide: "隠す",
    again: "やり直す",
    similarTitle: "観たことのある似た作品",
    insufficient: (n) => `好みの一致には視聴済みの作品が${n}件以上必要です。もう少し観てから試してください。`,
    insights: {
      predicted: (r, n) => `評価した似た作品${n}件から、あなたの評価は約${r}と予測されます`,
      topGenre: (g, rank, share) => `${g}はあなたが${rank}番目によく観るジャンルです(${pctEn(Math.round(share * 100))})`,
      newGenre: (g) => `${g}はあなたにとってほぼ未開拓です`,
      trendUp: (share) => `最近の視聴のうち${pctEn(Math.round(share * 100))}件がこれらのジャンルです — 関心が高まっています`,
      trendDown: () => "最近これらのジャンルから少し離れています",
      genreRating: (avg, overall) => `これらのジャンルの平均評価は${avg}です(全体は${overall})`,
      dislikes: (count, total) => `これらのジャンルの${total}作品中${count}作品を低く評価しています`,
      combo: (count) => `このジャンルの組み合わせの作品を${count}件観ています`,
      likesHit: (count, total) => `好きな作品${total}件中${count}件がこれらのジャンルです`,
      similar: (count, avg) => (avg == null ? `似た作品を${count}件観ています` : `似た作品を${count}件観て、平均評価は${avg}です`),
      similarNone: () => "似た作品はまだ観ていません",
      formatRare: () => "この形式(映画/ドラマ)はあまり観ていません",
      sideGenre: (g, side, total) => `あなたが観た${g}作品${total}件中${side}件ではサブジャンルにすぎません — 純粋な${g}は印象が違うかもしれません`,
      primaryLower: (g, p, s) => `${g}が主軸の作品は${p}と評価していますが、${g}がサブジャンルの場合は${s}です`,
      primaryHigher: (g, p, s) => `${g}が主軸の作品の方が好みです(${p} · サブジャンルとしては${s})`,
      typeBasis: (isTv, same, other, borrowed) =>
        borrowed
          ? `${isTv ? "本のドラマ" : "映画"}をあまり観ていないため、${other}${isTv ? "映画" : "本のドラマ"}での好みも(低い重みで)考慮しました`
          : `観た${same}${isTv ? "本のドラマ" : "映画"}に基づき、${other}${isTv ? "映画" : "本のドラマ"}は低い重みで考慮しました`,
      runtimeLong: (runtime, med) => `${runtime}分。あなたがよく観るのは約${med}分の映画です`,
      runtimeShort: (runtime, med) => `${runtime}分。いつもより短め(約${med}分)`,
      publicHigh: (avg) => `視聴者からも大好評(${avg})`,
      publicLow: (avg) => `視聴者スコアが低い(${avg})`,
      inWatchlist: () => "すでにウォッチリストにあります",
      ownRating: (r) => `あなたの評価は${r}/10 — 結果をあなたの評価に合わせて調整しました`,
    },
  }};

export const getTitleTasteFitCopy = (language) =>
  TITLE_TASTE_FIT_COPY[copyLanguage(language, Object.keys(TITLE_TASTE_FIT_COPY))];

/** Yapılandırılmış içgörüyü (titleTasteFit) metne çevirir. `genreLabel(id)` kanonik tür adını verir. */
export function insightText(copy, insight, genreLabel) {
  const f = copy.insights[insight.kind];
  if (!f) return "";
  switch (insight.kind) {
    case "predicted":
      return f(insight.rating, insight.neighbors);
    case "topGenre":
      return f(genreLabel(insight.genre), insight.rank, insight.share);
    case "newGenre":
      return f(genreLabel(insight.genre));
    case "trendUp":
    case "trendDown":
      return f(insight.share);
    case "genreRating":
      return f(insight.avg, insight.overall);
    case "dislikes":
    case "likesHit":
      return f(insight.count, insight.total);
    case "combo":
      return f(insight.count);
    case "similar":
      return f(insight.count, insight.avg);
    case "runtimeLong":
    case "runtimeShort":
      return f(insight.runtime, insight.median);
    case "publicHigh":
    case "publicLow":
      return f(insight.avg);
    case "ownRating":
      return f(insight.rating);
    case "sideGenre":
      return f(genreLabel(insight.genre), insight.side, insight.total);
    case "primaryLower":
    case "primaryHigher":
      return f(genreLabel(insight.genre), insight.primaryAvg, insight.sideAvg);
    case "typeBasis":
      return f(insight.type === "tv", insight.sameType, insight.otherType, insight.borrowed);
    default:
      return f();
  }
}
