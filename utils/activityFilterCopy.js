// utils/activityFilterCopy.js
//
// "Etkinliklerim" arama + süzgeç metinleri — yerel { tr, en, es, pt, de } tablosu (SAF). Sayfa kabuğunun kendi
// metinleri (Sırala ve filtrele, Sıfırla, N sonuç göster…) utils/listSortFilterCopy.js'ten gelir. Anahtar ve yer
// tutucu eşitliği __tests__/copyTablesSpanish.test.js'te bekçilenir. Seçenek anahtarları utils/activityFilter.js ile
// BİREBİR eşleşir.

import { copyLanguage } from "./appLanguages";

const tr = {
  search: "Bu sekmede ara…",
  filter: "Filtrele",
  all: "Tümü",
  noMatch: "Aramaya ya da filtrelere uyan kayıt yok",
  clear: "Filtreleri temizle",
  sections: { kind: "TÜR", score: "PUAN", date: "TARİH", postType: "POST TÜRÜ", action: "ETKİLEŞİM" },
  sorts: { date: "Tarih", score: "Puan", name: "Ad", likes: "Beğeni", comments: "Yorum" },
  kinds: { movie: "Film", tv: "Dizi", post: "Post", list: "Liste", story: "Story" },
  scores: { 10: "10", 9: "9", 8: "8", 7: "7", 6: "6", "5-": "5 ve altı" },
  dates: { week: "Son 7 gün", month: "Son 30 gün", year: "Son 1 yıl", older: "Daha eski" },
  postTypes: {
    review: "İnceleme",
    list: "Liste",
    text: "Sohbet",
    poll: "Anket",
    tierlist: "Tier list",
    tvgraph: "Bölüm grafiği",
  },
  actions: { like: "Beğeniler", bookmark: "Kayıtlar" },
};

const en = {
  search: "Search this tab…",
  filter: "Filter",
  all: "All",
  noMatch: "Nothing matches your search or filters",
  clear: "Clear filters",
  sections: { kind: "TYPE", score: "SCORE", date: "DATE", postType: "POST TYPE", action: "INTERACTION" },
  sorts: { date: "Date", score: "Score", name: "Name", likes: "Likes", comments: "Comments" },
  kinds: { movie: "Movie", tv: "Series", post: "Post", list: "List", story: "Story" },
  scores: { 10: "10", 9: "9", 8: "8", 7: "7", 6: "6", "5-": "5 and below" },
  dates: { week: "Last 7 days", month: "Last 30 days", year: "Last year", older: "Older" },
  postTypes: {
    review: "Review",
    list: "List",
    text: "Talk",
    poll: "Poll",
    tierlist: "Tier list",
    tvgraph: "Episode graph",
  },
  actions: { like: "Likes", bookmark: "Saved" },
};

const es = {
  search: "Buscar en esta pestaña…",
  filter: "Filtrar",
  all: "Todo",
  noMatch: "Nada coincide con tu búsqueda o filtros",
  clear: "Borrar filtros",
  sections: { kind: "TIPO", score: "PUNTUACIÓN", date: "FECHA", postType: "TIPO DE POST", action: "INTERACCIÓN" },
  sorts: { date: "Fecha", score: "Puntuación", name: "Nombre", likes: "Me gusta", comments: "Comentarios" },
  kinds: { movie: "Película", tv: "Serie", post: "Post", list: "Lista", story: "Story" },
  scores: { 10: "10", 9: "9", 8: "8", 7: "7", 6: "6", "5-": "5 o menos" },
  dates: { week: "Últimos 7 días", month: "Últimos 30 días", year: "Último año", older: "Más antiguo" },
  postTypes: {
    review: "Reseña",
    list: "Lista",
    text: "Charla",
    poll: "Encuesta",
    tierlist: "Tier list",
    tvgraph: "Gráfico de episodios",
  },
  actions: { like: "Me gusta", bookmark: "Guardados" },
};

const pt = {
  search: "Buscar nesta aba…",
  filter: "Filtrar",
  all: "Tudo",
  noMatch: "Nada corresponde à busca ou aos filtros",
  clear: "Limpar filtros",
  sections: { kind: "TIPO", score: "NOTA", date: "DATA", postType: "TIPO DE POST", action: "INTERAÇÃO" },
  sorts: { date: "Data", score: "Nota", name: "Nome", likes: "Curtidas", comments: "Comentários" },
  kinds: { movie: "Filme", tv: "Série", post: "Post", list: "Lista", story: "Story" },
  scores: { 10: "10", 9: "9", 8: "8", 7: "7", 6: "6", "5-": "5 ou menos" },
  dates: { week: "Últimos 7 dias", month: "Últimos 30 dias", year: "Último ano", older: "Mais antigo" },
  postTypes: {
    review: "Resenha",
    list: "Lista",
    text: "Conversa",
    poll: "Enquete",
    tierlist: "Tier list",
    tvgraph: "Gráfico de episódios",
  },
  actions: { like: "Curtidas", bookmark: "Salvos" },
};

const de = {
  search: "In diesem Tab suchen…",
  filter: "Filtern",
  all: "Alle",
  noMatch: "Nichts passt zur Suche oder zu den Filtern",
  clear: "Filter zurücksetzen",
  sections: { kind: "ART", score: "BEWERTUNG", date: "DATUM", postType: "BEITRAGSART", action: "INTERAKTION" },
  sorts: { date: "Datum", score: "Bewertung", name: "Name", likes: "Likes", comments: "Kommentare" },
  kinds: { movie: "Film", tv: "Serie", post: "Beitrag", list: "Liste", story: "Story" },
  scores: { 10: "10", 9: "9", 8: "8", 7: "7", 6: "6", "5-": "5 und weniger" },
  dates: { week: "Letzte 7 Tage", month: "Letzte 30 Tage", year: "Letztes Jahr", older: "Älter" },
  postTypes: {
    review: "Rezension",
    list: "Liste",
    text: "Gespräch",
    poll: "Umfrage",
    tierlist: "Tier-Liste",
    tvgraph: "Episodengrafik",
  },
  actions: { like: "Likes", bookmark: "Gespeichert" },
};

export const ACTIVITY_FILTER_COPY = { tr, en, es, pt, de };

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getActivityFilterCopy = (language) =>
  ACTIVITY_FILTER_COPY[copyLanguage(language, Object.keys(ACTIVITY_FILTER_COPY))];
