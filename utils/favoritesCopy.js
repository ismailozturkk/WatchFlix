// utils/favoritesCopy.js
//
// "Dört favori" özelliğinin metinleri (tr / en). Üç yerde ortak kullanılır:
// onboarding (oturum ve dil ayarı açılmadan ÖNCE gösterilir, çeviri paketi
// yerine buradan okur), Profili Düzenle ve arkadaş profili.
//
// Saf veri: RN içe aktarması yok, jest ile doğrudan test edilebilir.
// Bkz. utils/wrappedStrings.js — aynı desen.

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
    own: {
      edit: "Düzenle",
      emptyTitle: "Dört favorini seç",
      emptyDesc:
        "Film, dizi ve oyuncu favorilerin profilinde görünür; öneriler de buna göre şekillenir.",
      cta: "Favorilerini seç",
      dismiss: "Gizle",
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
    own: {
      edit: "Edit",
      emptyTitle: "Pick your four favorites",
      emptyDesc:
        "Your favorite movies, shows and actors appear on your profile — and shape your suggestions.",
      cta: "Choose favorites",
      dismiss: "Dismiss",
    },
    rail: {
      title: "Because of Your Favorites",
      subtitle: (names) => `Because you picked ${names}`,
      more: (count) => `+${count}`,
    },
  },
};

export const getFavoritesCopy = (language) =>
  FAVORITES_COPY[language === "en" ? "en" : "tr"];
