// utils/watchPickerCopy.js
//
// "Ne izlesem?" (izleme listesinden rastgele seçim) metinleri — tr / en / es. Saf veri.
// __tests__/copyTablesSpanish.test.js üç dilin aynı şekle sahip olduğunu denetler.
// `{n}` yer tutucusu fillPickerCopy ile doldurulur.

import { copyLanguage } from "./appLanguages";

export const WATCH_PICKER_COPY = {
  tr: {
    entry: {
      title: "Ne izlesem?",
      movie: "Film",
      tv: "Dizi",
      empty: "Önce listene bir şeyler ekle",
      filteredNote: "Süzdüğün listeden seçilir",
      a11yRandom: "Ne izlesem? İzleme listenden rastgele bir yapım seç",
      a11yMovie: "İzleme listenden rastgele bir film seç",
      a11yTv: "İzleme listenden rastgele bir dizi seç",
    },
    sheet: {
      title: "Ne izlesem?",
      pool: "{n} yapım arasından",
      poolFiltered: "Süzülmüş listenden · {n} yapım",
      shuffling: "Karıştırılıyor…",
      reroll: "Başka biri",
      open: "Detaylara git",
      history: "Az önce çıkanlar",
      cycled: "Hepsini gördün, baştan karıştırdık",
      emptyType: "Bu türde listende yapım yok",
      unreleased: "Henüz yayınlanmadı. Başka biri seçmek ister misin?",
      close: "Kapat",
      types: { mixed: "Karışık", movie: "Film", tv: "Dizi" },
      kind: { movie: "Film", tv: "Dizi" },
      units: { hour: "sa", minute: "dk", season: "sezon", episode: "bölüm" },
    },
    reasons: {
      waitingMonths: "{n} aydır listende bekliyor",
      waitingDays: "{n} gündür listende bekliyor",
      fresh: "Yeni eklendi",
      shortFilm: "Kısa: {n} dakikada biter",
      longFilm: "Uzun bir akşam filmi",
      oneSeason: "Tek sezon, çabuk biter",
      longRun: "{n} sezonluk uzun soluklu bir seri",
    },
  },
  en: {
    entry: {
      title: "What to watch?",
      movie: "Movie",
      tv: "Show",
      empty: "Add something to your list first",
      filteredNote: "Picks from your filtered list",
      a11yRandom: "What to watch? Pick a random title from your watchlist",
      a11yMovie: "Pick a random movie from your watchlist",
      a11yTv: "Pick a random show from your watchlist",
    },
    sheet: {
      title: "What should I watch?",
      pool: "Out of {n} titles",
      poolFiltered: "From your filtered list · {n} titles",
      shuffling: "Shuffling…",
      reroll: "Another one",
      open: "Go to details",
      history: "Just rolled",
      cycled: "You've seen them all, so we reshuffled",
      emptyType: "No titles of this kind on your list",
      unreleased: "Not out yet. Want to pick another one?",
      close: "Close",
      types: { mixed: "Mixed", movie: "Movies", tv: "Shows" },
      kind: { movie: "Movie", tv: "Show" },
      units: { hour: "h", minute: "min", season: "seasons", episode: "episodes" },
    },
    reasons: {
      waitingMonths: "Waiting on your list for {n} months",
      waitingDays: "Waiting on your list for {n} days",
      fresh: "Just added",
      shortFilm: "Short: done in {n} minutes",
      longFilm: "A long-evening movie",
      oneSeason: "One season, over quickly",
      longRun: "A long-running series: {n} seasons",
    },
  },
  es: {
    entry: {
      title: "¿Qué veo?",
      movie: "Peli",
      tv: "Serie",
      empty: "Primero añade algo a tu lista",
      filteredNote: "Elige de tu lista filtrada",
      a11yRandom: "¿Qué veo? Elige una obra al azar de tu lista de pendientes",
      a11yMovie: "Elige una película al azar de tu lista de pendientes",
      a11yTv: "Elige una serie al azar de tu lista de pendientes",
    },
    sheet: {
      title: "¿Qué veo?",
      pool: "Entre {n} obras",
      poolFiltered: "De tu lista filtrada · {n} obras",
      shuffling: "Mezclando…",
      reroll: "Otra",
      open: "Ir a los detalles",
      history: "Las últimas",
      cycled: "Ya las viste todas, así que volvimos a mezclar",
      emptyType: "No hay obras de este tipo en tu lista",
      unreleased: "Aún no se estrena. ¿Quieres elegir otra?",
      close: "Cerrar",
      types: { mixed: "Mixto", movie: "Películas", tv: "Series" },
      kind: { movie: "Película", tv: "Serie" },
      units: { hour: "h", minute: "min", season: "temporadas", episode: "episodios" },
    },
    reasons: {
      waitingMonths: "Lleva {n} meses esperando en tu lista",
      waitingDays: "Lleva {n} días esperando en tu lista",
      fresh: "Recién añadida",
      shortFilm: "Corta: termina en {n} minutos",
      longFilm: "Una película para una noche larga",
      oneSeason: "Una temporada, se acaba rápido",
      longRun: "Una serie larga: {n} temporadas",
    },
  },
  pt: {
    entry: {
      title: "O que ver?",
      movie: "Filme",
      tv: "Série",
      empty: "Primeiro adicione algo à sua lista",
      filteredNote: "Escolhe da sua lista filtrada",
      a11yRandom: "O que assistir? Escolhe um título aleatório da sua lista para assistir",
      a11yMovie: "Escolhe um filme aleatório da sua lista para assistir",
      a11yTv: "Escolhe uma série aleatória da sua lista para assistir",
    },
    sheet: {
      title: "O que ver?",
      pool: "Entre {n} títulos",
      poolFiltered: "Da sua lista filtrada · {n} títulos",
      shuffling: "Embaralhando…",
      reroll: "Outro",
      open: "Ir para os detalhes",
      history: "Os últimos",
      cycled: "Você já viu todos, então embaralhamos de novo",
      emptyType: "Não há títulos deste tipo na sua lista",
      unreleased: "Ainda não estreou. Quer escolher outro?",
      close: "Fechar",
      types: { mixed: "Misto", movie: "Filmes", tv: "Séries" },
      kind: { movie: "Filme", tv: "Série" },
      units: { hour: "h", minute: "min", season: "temporadas", episode: "episódios" },
    },
    reasons: {
      waitingMonths: "Está esperando há {n} meses na sua lista",
      waitingDays: "Está esperando há {n} dias na sua lista",
      fresh: "Recém-adicionado",
      shortFilm: "Curto: termina em {n} minutos",
      longFilm: "Um filme para uma noite longa",
      oneSeason: "Uma temporada, acaba rápido",
      longRun: "Uma série longa: {n} temporadas",
    },
  },
  de: {
    entry: {
      title: "Was schauen?",
      movie: "Film",
      tv: "Serie",
      empty: "Füge zuerst etwas zu deiner Liste hinzu",
      filteredNote: "Tipps aus deiner gefilterten Liste",
      a11yRandom: "Was schauen? Wähle zufällig einen Titel aus deiner Merkliste",
      a11yMovie: "Wähle zufällig einen Film aus deiner Merkliste",
      a11yTv: "Wähle zufällig eine Serie aus deiner Merkliste",
    },
    sheet: {
      title: "Was soll ich schauen?",
      pool: "Aus {n} Titeln",
      poolFiltered: "Aus deiner gefilterten Liste · {n} Titel",
      shuffling: "Wird gemischt…",
      reroll: "Noch einer",
      open: "Zu den Details",
      history: "Gerade gewürfelt",
      cycled: "Du hast alle gesehen, deshalb haben wir neu gemischt",
      emptyType: "Keine Titel dieser Art in deiner Liste",
      unreleased: "Noch nicht erschienen. Möchtest du einen anderen wählen?",
      close: "Schließen",
      types: { mixed: "Gemischt", movie: "Filme", tv: "Serien" },
      kind: { movie: "Movie", tv: "Show" },
      units: { hour: "h", minute: "Min.", season: "Staffeln", episode: "Folgen" },
    },
    reasons: {
      waitingMonths: "Wartet seit {n} Monaten in deiner Liste",
      waitingDays: "Wartet seit {n} Tagen in deiner Liste",
      fresh: "Gerade hinzugefügt",
      shortFilm: "Kurz: in {n} Minuten geschafft",
      longFilm: "Ein Film für einen langen Abend",
      oneSeason: "Eine Staffel, schnell geschafft",
      longRun: "Eine langlaufende Serie: {n} Staffeln",
    },
  },

  it: {
  entry: {
    title: "Cosa guardare?",
    movie: "Film",
    tv: "Mostra",
    empty: "Aggiungi prima qualcosa alla tua lista",
    filteredNote: "Scelte dal tuo elenco filtrato",
    a11yRandom: "Cosa guardare? Scegli un titolo a caso dalla tua lista di titoli",
    a11yMovie: "Scegli un film a caso dalla tua lista di titoli",
    a11yTv: "Scegli un programma a caso dalla tua lista di titoli"
  },
  sheet: {
    title: "Cosa dovrei guardare?",
    pool: "Di {n} titoli",
    poolFiltered: "Dal tuo elenco filtrato · {n} titoli",
    shuffling: "Mischia...",
    reroll: "Un altro",
    open: "Vai ai dettagli",
    history: "Appena lanciato",
    cycled: "Li hai visti tutti, quindi li abbiamo rimescolati",
    emptyType: "Nessun titolo di questo tipo nella tua lista",
    unreleased: "Non ancora uscito. Vuoi sceglierne un altro?",
    close: "Chiudi",
    types: {
      mixed: "Misto",
      movie: "Film",
      tv: "Serie TV"
    },
    kind: {
      movie: "Film",
      tv: "Mostra"
    },
    units: {
      hour: "h",
      minute: "min",
      season: "stagioni",
      episode: "episodi"
    }
  },
  reasons: {
    waitingMonths: "In attesa nella tua lista per {n} mesi",
    waitingDays: "In attesa nella tua lista per {n} giorni",
    fresh: "Appena aggiunto",
    shortFilm: "Breve: finito in {n} minuti",
    longFilm: "Un film da serata lunga",
    oneSeason: "Una stagione, in poco tempo",
    longRun: "Una serie di lunga durata: {n} stagioni"
  }
},
  fr: {
    entry: {
      title: "Que regarder ?",
      movie: "Film",
      tv: "Série",
      empty: "Ajoute d'abord quelque chose à ta liste",
      filteredNote: "Choix parmi ta liste filtrée",
      a11yRandom: "Quoi regarder ? Tire un titre au hasard dans ta liste à voir",
      a11yMovie: "Tire un film au hasard dans ta liste à voir",
      a11yTv: "Tire une série au hasard dans ta liste à voir",
    },
    sheet: {
      title: "Qu'est-ce que je regarde ?",
      pool: "Parmi {n} titres",
      poolFiltered: "Depuis ta liste filtrée · {n} titres",
      shuffling: "Mélange…",
      reroll: "Un autre",
      open: "Voir les détails",
      history: "Tout juste tiré",
      cycled: "Tu les as tous vus, on a donc remélangé",
      emptyType: "Aucun titre de ce type dans ta liste",
      unreleased: "Pas encore sorti. Tu veux en choisir un autre ?",
      close: "Fermer",
      types: { mixed: "Mixte", movie: "Films", tv: "Séries" },
      kind: { movie: "Film", tv: "Série" },
      units: { hour: "h", minute: "min", season: "saisons", episode: "épisodes" },
    },
    reasons: {
      waitingMonths: "Attend dans ta liste depuis {n} mois",
      waitingDays: "Attend dans ta liste depuis {n} jours",
      fresh: "Tout juste ajouté",
      shortFilm: "Court : fini en {n} minutes",
      longFilm: "Un film pour une longue soirée",
      oneSeason: "Une saison, vite terminée",
      longRun: "Une série au long cours : {n} saisons",
    },
  },
  ja: {
    entry: {
      title: "何を観よう?",
      movie: "映画",
      tv: "番組",
      empty: "まずリストに何か追加してください",
      filteredNote: "絞り込んだリストから選択",
      a11yRandom: "何を観よう?ウォッチリストからランダムに1作品選ぶ",
      a11yMovie: "ウォッチリストからランダムに映画を選ぶ",
      a11yTv: "ウォッチリストからランダムに番組を選ぶ",
    },
    sheet: {
      title: "何を観よう?",
      pool: "{n}作品の中から",
      poolFiltered: "絞り込んだリストから · {n}作品",
      shuffling: "シャッフル中…",
      reroll: "別のを",
      open: "詳細へ",
      history: "今引いたもの",
      cycled: "すべて出たので、もう一度シャッフルしました",
      emptyType: "リストにこの種類の作品はありません",
      unreleased: "まだ公開されていません。別のを選びますか?",
      close: "閉じる",
      types: { mixed: "ミックス", movie: "映画", tv: "TV番組" },
      kind: { movie: "映画", tv: "番組" },
      units: { hour: "時間", minute: "分", season: "シーズン", episode: "話" },
    },
    reasons: {
      waitingMonths: "リストで{n}か月待っています",
      waitingDays: "リストで{n}日待っています",
      fresh: "追加したばかり",
      shortFilm: "短め:{n}分で観終わります",
      longFilm: "長い夜向けの映画",
      oneSeason: "1シーズンですぐ観終わる",
      longRun: "長寿シリーズ:{n}シーズン",
    },
  }};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getWatchPickerCopy = (language) =>
  WATCH_PICKER_COPY[copyLanguage(language, Object.keys(WATCH_PICKER_COPY))];

/** "{n}" yer tutucusunu doldurur. */
export const fillPickerCopy = (template, n) => String(template ?? "").replace("{n}", String(n));

/** Gerekçe cümlesi ({kind, value} → metin); gerekçe yoksa null. */
export function reasonText(copy, reason) {
  if (!reason) return null;
  const template = copy?.reasons?.[reason.kind];
  return template ? fillPickerCopy(template, reason.value ?? "") : null;
}
