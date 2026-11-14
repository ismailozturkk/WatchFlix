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

  it: {
  kinds: {
    movies: {
      label: "Film",
      add: "Aggiungi film",
      pickTitle: "Scegli i tuoi film preferiti",
      search: "Cerca film…",
      icon: "film-outline"
    },
    shows: {
      label: "Serie TV",
      add: "Aggiungi serie TV",
      pickTitle: "Scegli i tuoi programmi preferiti",
      search: "Cerca programmi…",
      icon: "tv-outline"
    },
    people: {
      label: "Attori",
      add: "Aggiungi attore",
      pickTitle: "Scegli i tuoi attori preferiti",
      search: "Cerca attori…",
      icon: "person-outline"
    }
  },
  counter: (count, max) => `${count}/${max}`,
  section: {
    title: "I tuoi quattro preferiti",
    hint: "Chiunque possa vedere il tuo profilo li vede. Scegline fino a 4 per categoria o lascialo vuoto."
  },
  picker: {
    done: "Fatto",
    full: "Completo · rimuovine uno per scambiare",
    suggestions: "Suggerimenti",
    popular: "Popolare",
    basedOnPicks: "In base alle tue scelte",
    castOfPicks: "Dai cast delle tue scelte",
    results: "Risultati",
    noResults: "Nessun risultato trovato",
    searchError: "Impossibile cercare. Controlla la connessione.",
    loadError: "Impossibile caricare l'elenco.",
    retry: "Riprova",
    typeMore: "Digita almeno 2 lettere per cercare",
    remove: "Rimuovi",
    selected: "Selezionato",
    add: title => `Aggiungi ${title}`,
    removeLabel: title => `Rimuovi ${title} dai preferiti`
  },
  profile: {
    title: "Scelte preferite",
    open: "Apri"
  },
  rail: {
    title: "In base ai tuoi preferiti",
    subtitle: names => `Perché hai scelto ${names}`,
    more: count => `+${count}`
  }
},
  fr: {
    kinds: {
      movies: {
        label: "Films",
        add: "Ajouter un film",
        pickTitle: "Choisis tes films préférés",
        search: "Rechercher des films…",
        icon: "film-outline",
      },
      shows: {
        label: "Séries",
        add: "Ajouter une série",
        pickTitle: "Choisis tes séries préférées",
        search: "Rechercher des séries…",
        icon: "tv-outline",
      },
      people: {
        label: "Acteurs",
        add: "Ajouter un acteur",
        pickTitle: "Choisis tes acteurs préférés",
        search: "Rechercher des acteurs…",
        icon: "person-outline",
      },
    },
    counter: (count, max) => `${count}/${max}`,
    section: {
      title: "Tes quatre favoris",
      hint: "Toute personne qui peut voir ton profil les voit. Choisis jusqu'à 4 par catégorie — ou laisse vide.",
    },
    picker: {
      done: "Terminé",
      full: "Complet · retires-en un pour échanger",
      suggestions: "Suggestions",
      popular: "Populaire",
      basedOnPicks: "Selon tes choix",
      castOfPicks: "Tirés de la distribution de tes choix",
      results: "Résultats",
      noResults: "Aucun résultat",
      searchError: "Recherche impossible. Vérifie ta connexion.",
      loadError: "Impossible de charger la liste.",
      retry: "Réessayer",
      typeMore: "Tape au moins 2 lettres pour rechercher",
      remove: "Retirer",
      selected: "Sélectionné",
      add: (title) => `Ajouter ${title}`,
      removeLabel: (title) => `Retirer ${title} des favoris`,
    },
    profile: {
      title: "Choix favoris",
      open: "Ouvrir",
    },
    rail: {
      title: "Grâce à tes favoris",
      subtitle: (names) => `Parce que tu as choisi ${names}`,
      more: (count) => `+${count}`,
    },
  },
  ja: {
    kinds: {
      movies: {
        label: "映画",
        add: "映画を追加",
        pickTitle: "好きな映画を選ぼう",
        search: "映画を検索…",
        icon: "film-outline",
      },
      shows: {
        label: "TV番組",
        add: "番組を追加",
        pickTitle: "好きな番組を選ぼう",
        search: "番組を検索…",
        icon: "tv-outline",
      },
      people: {
        label: "俳優",
        add: "俳優を追加",
        pickTitle: "好きな俳優を選ぼう",
        search: "俳優を検索…",
        icon: "person-outline",
      },
    },
    counter: (count, max) => `${count}/${max}`,
    section: {
      title: "あなたの4つのお気に入り",
      hint: "プロフィールを見られる人全員に表示されます。各カテゴリ最大4つまで — 空欄でも構いません。",
    },
    picker: {
      done: "完了",
      full: "いっぱい · 入れ替えるには1つ外してください",
      suggestions: "おすすめ",
      popular: "人気",
      basedOnPicks: "あなたの選択に基づく",
      castOfPicks: "選んだ作品のキャストから",
      results: "結果",
      noResults: "結果が見つかりません",
      searchError: "検索できませんでした。接続を確認してください。",
      loadError: "リストを読み込めませんでした。",
      retry: "再試行",
      typeMore: "検索するには2文字以上入力してください",
      remove: "削除",
      selected: "選択済み",
      add: (title) => `${title}を追加`,
      removeLabel: (title) => `${title}をお気に入りから外す`,
    },
    profile: {
      title: "お気に入りのセレクト",
      open: "開く",
    },
    rail: {
      title: "お気に入りから",
      subtitle: (names) => `${names}を選んだあなたへ`,
      more: (count) => `+${count}`,
    },
  }};

// Bilinmeyen dil İngilizce (utils/appLanguages kuralı).
export const getFavoritesCopy = (language) =>
  FAVORITES_COPY[copyLanguage(language, Object.keys(FAVORITES_COPY))];
