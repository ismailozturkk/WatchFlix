// components/search/searchHeaderCopy.js
//
// Film / dizi / oyuncu arama ekranının (screens/tabs/SearchScreen.js) üst kısmının
// metinleri (5 dil): tür anahtarı, alan ipucu, keşif çipleri, düğme adları.
// Tür etiketleri KISA (segment içine sığar); eski "Film Ara" çevirileri yalnız alan
// ipucu olarak anlamlıydı. Beş dilin eşitliğini __tests__/copyTablesSpanish.test.js
// korur.

import { copyLanguage } from "../../utils/appLanguages";

const tr = {
  tabs: { movie: "Film", tv: "Dizi", actor: "Oyuncu" },
  placeholder: { movie: "Film ara…", tv: "Dizi ara…", actor: "Oyuncu ara…" },
  typeLabel: "Arama türü",
  categoryLabel: "Keşfet",
  categories: {
    popular: "Popüler",
    upcoming: "Yakında",
    onAir: "Yayında",
    topRated: "En İyi",
    trending: "Trend",
  },
  clear: "Aramayı temizle",
  gridView: "Izgara görünümüne geç",
  listView: "Liste görünümüne geç",
};

const en = {
  tabs: { movie: "Movies", tv: "TV Shows", actor: "Actors" },
  placeholder: { movie: "Search movies…", tv: "Search TV shows…", actor: "Search actors…" },
  typeLabel: "Search type",
  categoryLabel: "Discover",
  categories: {
    popular: "Popular",
    upcoming: "Upcoming",
    onAir: "On the air",
    topRated: "Top rated",
    trending: "Trending",
  },
  clear: "Clear search",
  gridView: "Switch to grid view",
  listView: "Switch to list view",
};

const es = {
  tabs: { movie: "Películas", tv: "Series", actor: "Actores" },
  placeholder: { movie: "Buscar películas…", tv: "Buscar series…", actor: "Buscar actores…" },
  typeLabel: "Tipo de búsqueda",
  categoryLabel: "Descubrir",
  categories: {
    popular: "Populares",
    upcoming: "Próximamente",
    onAir: "En emisión",
    topRated: "Mejor valoradas",
    trending: "Tendencia",
  },
  clear: "Borrar búsqueda",
  gridView: "Cambiar a cuadrícula",
  listView: "Cambiar a lista",
};

const pt = {
  tabs: { movie: "Filmes", tv: "Séries", actor: "Atores" },
  placeholder: { movie: "Buscar filmes…", tv: "Buscar séries…", actor: "Buscar atores…" },
  typeLabel: "Tipo de busca",
  categoryLabel: "Descobrir",
  categories: {
    popular: "Populares",
    upcoming: "Em breve",
    onAir: "No ar",
    topRated: "Mais bem avaliados",
    trending: "Em alta",
  },
  clear: "Limpar busca",
  gridView: "Mudar para grade",
  listView: "Mudar para lista",
};

const de = {
  // "Schauspieler" üç bölmeli anahtara sığmıyordu (simgeyle ~130 px, bölme ~115 px).
  tabs: { movie: "Filme", tv: "Serien", actor: "Personen" },
  placeholder: { movie: "Filme suchen…", tv: "Serien suchen…", actor: "Personen suchen…" },
  typeLabel: "Suchart",
  categoryLabel: "Entdecken",
  categories: {
    popular: "Beliebt",
    upcoming: "Demnächst",
    onAir: "Läuft gerade",
    topRated: "Top bewertet",
    trending: "Im Trend",
  },
  clear: "Suche löschen",
  gridView: "Zur Rasteransicht",
  listView: "Zur Listenansicht",
};

export const SEARCH_HEADER_COPY = Object.freeze({ tr, en, es, pt, de });

/** Uygulama diline göre metin tablosu (bilinmeyen dil → İngilizce). */
export const getSearchHeaderCopy = (language) =>
  SEARCH_HEADER_COPY[copyLanguage(language, Object.keys(SEARCH_HEADER_COPY))];

/** Keşif çiplerinin simgeleri (Ionicons; seçili değilken `-outline`). */
export const CATEGORY_ICONS = Object.freeze({
  popular: "flame",
  upcoming: "calendar",
  onAir: "radio",
  topRated: "star",
  trending: "trending-up",
});
