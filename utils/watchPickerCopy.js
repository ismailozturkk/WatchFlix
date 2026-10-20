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
};

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
