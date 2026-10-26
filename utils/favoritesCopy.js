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
  pt: {
    kinds: {
      movies: {
        label: "Filmes",
        add: "Adicionar filme",
        pickTitle: "Escolha seus filmes favoritos",
        search: "Buscar filmes…",
        icon: "film-outline",
      },
      shows: {
        label: "Séries",
        add: "Adicionar série",
        pickTitle: "Escolha suas séries favoritas",
        search: "Buscar séries…",
        icon: "tv-outline",
      },
      people: {
        label: "Atores",
        add: "Adicionar ator",
        pickTitle: "Escolha seus atores favoritos",
        search: "Buscar atores…",
        icon: "person-outline",
      },
    },
    counter: (count, max) => `${count}/${max}`,
    section: {
      title: "Seus quatro favoritos",
      hint: "Quem puder ver seu perfil os verá. Escolha até 4 por categoria ou deixe em branco.",
    },
    picker: {
      done: "Pronto",
      full: "Completo · remova um para trocar",
      suggestions: "Sugestões",
      popular: "Populares",
      basedOnPicks: "Com base nas suas escolhas",
      castOfPicks: "Do elenco do que você escolheu",
      results: "Resultados",
      noResults: "Nenhum resultado encontrado",
      searchError: "Não foi possível buscar. Verifique sua conexão.",
      loadError: "Não foi possível carregar a lista.",
      retry: "Tentar novamente",
      typeMore: "Digite pelo menos 2 letras para buscar",
      remove: "Remover",
      selected: "Escolhido",
      add: (title) => `Adicionar ${title}`,
      removeLabel: (title) => `Remover ${title} dos favoritos`,
    },
    profile: {
      title: "Favoritos escolhidos",
      open: "Abrir",
    },
    rail: {
      title: "Pelos seus favoritos",
      subtitle: (names) => `Porque você escolheu ${names}`,
      more: (count) => `+${count}`,
    },
  },
  de: {
    kinds: {
      movies: {
        label: "Filme",
        add: "Film hinzufügen",
        pickTitle: "Wähle deine Lieblingsfilme",
        search: "Filme suchen…",
        icon: "film-outline",
      },
      shows: {
        label: "Serien",
        add: "Serie hinzufügen",
        pickTitle: "Wähle deine Lieblingsserien",
        search: "Serien suchen…",
        icon: "tv-outline",
      },
      people: {
        label: "Schauspieler",
        add: "Schauspieler hinzufügen",
        pickTitle: "Wähle deine Lieblingsschauspieler",
        search: "Schauspieler suchen…",
        icon: "person-outline",
      },
    },
    counter: (count, max) => `${count}/${max}`,
    section: {
      title: "Deine vier Favoriten",
      hint: "Alle, die dein Profil sehen können, sehen sie. Wähle bis zu 4 pro Kategorie – oder lass es leer.",
    },
    picker: {
      done: "Fertig",
      full: "Voll · entferne einen, um zu tauschen",
      suggestions: "Vorschläge",
      popular: "Beliebt",
      basedOnPicks: "Nach deiner Auswahl",
      castOfPicks: "Aus der Besetzung deiner Auswahl",
      results: "Ergebnisse",
      noResults: "Keine Ergebnisse gefunden",
      searchError: "Suche nicht möglich. Prüfe deine Verbindung.",
      loadError: "Die Liste konnte nicht geladen werden.",
      retry: "Erneut versuchen",
      typeMore: "Gib mindestens 2 Buchstaben zum Suchen ein",
      remove: "Entfernen",
      selected: "Ausgewählt",
      add: (title) => `${title} hinzufügen`,
      removeLabel: (title) => `${title} aus den Favoriten entfernen`,
    },
    profile: {
      title: "Lieblingstipps",
      open: "Öffnen",
    },
    rail: {
      title: "Wegen deiner Favoriten",
      subtitle: (names) => `Weil du ${names} gewählt hast`,
      more: (count) => `+${count}`,
    },
  },
};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getFavoritesCopy = (language) =>
  FAVORITES_COPY[copyLanguage(language, Object.keys(FAVORITES_COPY))];
