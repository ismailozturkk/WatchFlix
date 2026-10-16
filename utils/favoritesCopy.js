// utils/favoritesCopy.js
//
// "Dört favori" özelliğinin metinleri (tr / en / es). Üç yerde ortak kullanılır:
// onboarding (oturum ve dil ayarı açılmadan ÖNCE gösterilir, çeviri paketi
// yerine buradan okur), Profili Düzenle ve arkadaş profili.
//
// Saf veri: RN içe aktarması yok, jest ile doğrudan test edilebilir.
// Bkz. utils/wrappedStrings.js — aynı desen.

import { copyLanguage } from "./appLanguages";

export const FAVORITES_COPY = {
  tr: {
    kinds: {
      movies: {
        label: "Filmler",
        add: "Film ekle",
        pickTitle: "Favori filmlerini seç",
        search: "Film ara…",
        icon: "film-outline",
      },
      shows: {
        label: "Diziler",
        add: "Dizi ekle",
        pickTitle: "Favori dizilerini seç",
        search: "Dizi ara…",
        icon: "tv-outline",
      },
      people: {
        label: "Oyuncular",
        add: "Oyuncu ekle",
        pickTitle: "Favori oyuncularını seç",
        search: "Oyuncu ara…",
        icon: "person-outline",
      },
    },
    counter: (count, max) => `${count}/${max}`,
    section: {
      title: "Dört favorin",
      hint: "Profilini görenler bunları görür. Her kategoride en fazla 4 seç; istersen boş bırak.",
    },
    picker: {
      done: "Tamam",
      // Başlık altındaki tek satır: uzun olursa sarıp başlığı zıplatır.
      full: "Dolu · önce birini kaldır",
      suggestions: "Önerilenler",
      popular: "Popüler",
      basedOnPicks: "Seçimlerine göre",
      castOfPicks: "Seçtiğin yapımların oyuncuları",
      results: "Sonuçlar",
      noResults: "Sonuç bulunamadı",
      searchError: "Aranamadı. Bağlantını kontrol et.",
      loadError: "Liste yüklenemedi.",
      retry: "Tekrar dene",
      typeMore: "Aramak için en az 2 harf yaz",
      remove: "Kaldır",
      selected: "Seçildi",
      add: (title) => `${title} ekle`,
      removeLabel: (title) => `${title} favorilerden kaldır`,
    },
    profile: {
      title: "Favori seçimleri",
      open: "Aç",
    },
    rail: {
      title: "Favorilerine Göre",
      subtitle: (names) => `${names} favorilerine göre`,
      more: (count) => `+${count}`,
    },
  },
  en: {
    kinds: {
      movies: {
        label: "Movies",
        add: "Add movie",
        pickTitle: "Pick your favorite movies",
        search: "Search movies…",
        icon: "film-outline",
      },
      shows: {
        label: "TV Shows",
        add: "Add show",
        pickTitle: "Pick your favorite shows",
        search: "Search shows…",
        icon: "tv-outline",
      },
      people: {
        label: "Actors",
        add: "Add actor",
        pickTitle: "Pick your favorite actors",
        search: "Search actors…",
        icon: "person-outline",
      },
    },
    counter: (count, max) => `${count}/${max}`,
    section: {
      title: "Your four favorites",
      hint: "Anyone who can see your profile sees these. Pick up to 4 per category — or leave it empty.",
    },
    picker: {
      done: "Done",
      full: "Full · remove one to swap",
      suggestions: "Suggestions",
      popular: "Popular",
      basedOnPicks: "Based on your picks",
      castOfPicks: "From your picks' casts",
      results: "Results",
      noResults: "No results found",
      searchError: "Couldn't search. Check your connection.",
      loadError: "Couldn't load the list.",
      retry: "Try again",
      typeMore: "Type at least 2 letters to search",
      remove: "Remove",
      selected: "Selected",
      add: (title) => `Add ${title}`,
      removeLabel: (title) => `Remove ${title} from favorites`,
    },
    profile: {
      title: "Favorite picks",
      open: "Open",
    },
    rail: {
      title: "Because of Your Favorites",
      subtitle: (names) => `Because you picked ${names}`,
      more: (count) => `+${count}`,
    },
  },
  es: {
    kinds: {
      movies: {
        label: "Películas",
        add: "Añadir película",
        pickTitle: "Elige tus películas favoritas",
        search: "Buscar películas…",
        icon: "film-outline",
      },
      shows: {
        label: "Series",
        add: "Añadir serie",
        pickTitle: "Elige tus series favoritas",
        search: "Buscar series…",
        icon: "tv-outline",
      },
      people: {
        label: "Actores",
        add: "Añadir actor",
        pickTitle: "Elige tus actores favoritos",
        search: "Buscar actores…",
        icon: "person-outline",
      },
    },
    counter: (count, max) => `${count}/${max}`,
    section: {
      title: "Tus cuatro favoritos",
      hint: "Quien pueda ver tu perfil los verá. Elige hasta 4 por categoría o déjalo vacío.",
    },
    picker: {
      done: "Listo",
      full: "Completo · quita uno para cambiar",
      suggestions: "Sugerencias",
      popular: "Populares",
      basedOnPicks: "Según tus elecciones",
      castOfPicks: "Del reparto de lo que has elegido",
      results: "Resultados",
      noResults: "No se encontraron resultados",
      searchError: "No se pudo buscar. Revisa tu conexión.",
      loadError: "No se pudo cargar la lista.",
      retry: "Reintentar",
      typeMore: "Escribe al menos 2 letras para buscar",
      remove: "Quitar",
      selected: "Elegido",
      add: (title) => `Añadir ${title}`,
      removeLabel: (title) => `Quitar ${title} de favoritos`,
    },
    profile: {
      title: "Favoritos elegidos",
      open: "Abrir",
    },
    rail: {
      title: "Por tus favoritos",
      subtitle: (names) => `Porque elegiste ${names}`,
      more: (count) => `+${count}`,
    },
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getFavoritesCopy = (language) =>
  FAVORITES_COPY[copyLanguage(language, Object.keys(FAVORITES_COPY))];
