// utils/homeSectionCopy.js
//
// Film / Dizi ana ekranındaki raf başlıklarının (components/home/SectionHeader) KİMLİK tablosu:
// her bölümün simgesi, tonu ve alt başlığı (bilgilendirme satırı) tek yerde durur. SAF modül
// (React/RN importu yok) — jest doğrudan okuyabilir.
//
// NEDEN: raf başlıkları 8 ayrı elle yazılmış düzendi (düz Text, başlıksız kategori sekmeleri, çip
// satırları…) ve yarısında bölümün adı bile yoktu. Artık hepsi aynı bileşenden çıkıyor; bu tablo
// "hangi bölüm hangi simgeyle ve hangi cümleyle sunulur"u sabitler. Başlık METNİ burada DEĞİL: var olan
// çeviri anahtarlarından gelir (t.movieScreens.*, autoI18n.*) — yalnız "Türler" gibi anahtarı büyük
// harfle kayıtlı olan başlıklar için `title` verilir.
//
// DİL: tr/en/es; bilinmeyen dil İngilizce (utils/appLanguages.pickByLanguage).
//
// YENİ BÖLÜM EKLERKEN: buraya bir giriş + ekranın bölüm listesine (MovieScreen / TvShowScreen) ekle.
// __tests__/homeSectionCopy.test.js her girişin üç dilde dolu ve simgesinin gerçek olduğunu doğrular;
// __tests__/homeSectionHeaderCoverage.test.js her raf dosyasının SectionHeader kullandığını doğrular.
import { pickByLanguage } from "./appLanguages";

/** @param {string} tr @param {string} en @param {string} es */
const tri = (tr, en, es, pt, de) => ({ tr, en, es, pt: pt ?? en, de: de ?? en });

/** "accent" = temanın vurgusu; "gold" = ödül rafları (Oscar / Emmy). */
export const SECTION_TONES = Object.freeze(["accent", "gold"]);

/**
 * `subtitle`: tek tablo (iki ekranda aynı) ya da `{ movie, tv }` (türe göre farklı).
 * `title`: yalnız var olan çeviri anahtarı uygun değilse (bkz. dosya başı).
 */
export const HOME_SECTIONS = Object.freeze({
  trends: {
    icon: "flame",
    subtitle: {
      movie: tri(
        "Şu an en çok konuşulan filmler",
        "Most talked-about movies right now",
        "Las películas más comentadas ahora", "Os filmes mais comentados agora", "Die meistdiskutierten Filme gerade",
      ),
      tv: tri(
        "Şu an en çok konuşulan diziler",
        "Most talked-about shows right now",
        "Las series más comentadas ahora", "As séries mais comentadas agora", "Die meistdiskutierten Serien gerade",
      ),
    },
  },
  bests: {
    icon: "star",
    subtitle: tri(
      "Puan ve popülerliğe göre sıralı",
      "Ranked by rating and popularity",
      "Por valoración y popularidad", "Por nota e popularidade", "Nach Bewertung und Beliebtheit sortiert",
    ),
  },
  ongoing: {
    icon: "play-circle",
    subtitle: tri("Kaldığın yerden devam et", "Pick up where you left off", "Sigue donde lo dejaste", "Continue de onde parou", "Mach da weiter, wo du aufgehört hast"),
  },
  followedPeople: {
    icon: "sparkles",
    // Alt başlığı bileşen kendisi üretir (takip edilen kişi adları); bu yalnız yedek.
    subtitle: tri("Takip ettiklerinin yeni işleri", "New work from people you follow", "Lo nuevo de a quienes sigues", "As novidades de quem você segue", "Neue Arbeiten von Personen, denen du folgst"),
  },
  fromFavorites: {
    icon: "heart",
    subtitle: tri("Favorilerine göre öneriler", "Picked from your favorites", "Según tus favoritos", "Com base nos seus favoritos", "Aus deinen Favoriten ausgewählt"),
  },
  subscriptions: {
    icon: "tv",
    subtitle: tri(
      "Platformlarında izleyebileceklerin",
      "Available on your services",
      "Disponible en tus plataformas", "Disponível nos seus serviços", "Bei deinen Diensten verfügbar",
    ),
  },
  topGenres: {
    icon: "color-palette",
    // Yedek: bileşen normalde kullanıcının üç türünün adını yazar (DiscoveryMediaRail).
    subtitle: tri(
      "Başlangıçta seçtiğin türlere göre",
      "Based on your onboarding picks",
      "Según los géneros que elegiste", "Com base nos gêneros que você escolheu", "Nach deiner Auswahl beim Start",
    ),
  },
  recentFavorites: {
    icon: "trending-up",
    subtitle: tri(
      "Yeni ve güçlü izleyici puanlı",
      "New and highly rated by viewers",
      "Recientes y bien valorados", "Recentes e bem avaliados", "Neu und von Zuschauern hoch bewertet",
    ),
  },
  worldTour: {
    icon: "earth",
    // Alt başlık türe göre; çip satırı (utils/worldTour) dili seçtirir.
    subtitle: {
      movie: tri(
        "Dünyanın dört bir yanından filmler",
        "Films from around the world",
        "Películas de todo el mundo", "Filmes do mundo todo", "Filme aus aller Welt",
      ),
      tv: tri(
        "Dünyanın dört bir yanından diziler",
        "Shows from around the world",
        "Series de todo el mundo", "Séries do mundo todo", "Serien aus aller Welt",
      ),
    },
  },
  providers: {
    icon: "apps",
    subtitle: tri("Platforma göre göz at", "Browse by streaming service", "Explora por plataforma", "Explore por serviço", "Nach Streaming-Dienst durchstöbern"),
  },
  genres: {
    icon: "grid",
    title: tri("Türler", "Genres", "Géneros", "Gêneros", "Genres"),
    subtitle: tri(
      "Bir ya da birden fazla tür seç",
      "Pick one or more genres",
      "Elige uno o varios géneros", "Escolha um ou mais gêneros", "Wähle ein oder mehrere Genres",
    ),
  },
  nowPlaying: {
    icon: "ticket",
    subtitle: tri("Şu an sinemalarda", "In cinemas right now", "En cines ahora mismo", "Em cartaz agora", "Gerade im Kino"),
  },
  upcoming: {
    icon: "calendar",
    subtitle: tri("Yakında vizyona girecekler", "Coming soon to cinemas", "Próximamente en cines", "Em breve nos cinemas", "Bald im Kino"),
  },
  collection: {
    icon: "albums",
    subtitle: tri("Film serileri ve devam filmleri", "Film series and sequels", "Sagas y secuelas", "Sagas e continuações", "Filmreihen und Fortsetzungen"),
  },
  oscar: {
    icon: "trophy",
    tone: "gold",
    subtitle: tri(
      "Kategori ve yıla göre kazananlar",
      "Winners by category or year",
      "Ganadores por categoría o año", "Vencedores por categoria ou ano", "Gewinner nach Kategorie oder Jahr",
    ),
  },
  emmy: {
    icon: "trophy",
    tone: "gold",
    subtitle: tri(
      "Kategori ve yıla göre kazananlar",
      "Winners by category or year",
      "Ganadores por categoría o año", "Vencedores por categoria ou ano", "Gewinner nach Kategorie oder Jahr",
    ),
  },
  onTheAir: {
    icon: "radio",
    subtitle: tri(
      "Bu hafta yeni bölümü yayınlananlar",
      "Shows with new episodes this week",
      "Episodios nuevos esta semana", "Episódios novos esta semana", "Serien mit neuen Folgen diese Woche",
    ),
  },
  airingToday: {
    icon: "today",
    subtitle: tri("Bugün yeni bölümü çıkanlar", "New episodes airing today", "Episodios nuevos hoy", "Episódios novos hoje", "Heute laufen neue Folgen"),
  },
});

/**
 * Başlıktaki "Tümü" düğmesinin kısa etiketi. Çeviri anahtarı (`autoI18n.tumu`) İngilizce'de yalnız "All"
 * ve İspanyolca'da "Todo" — yanında bir ok olan düğmede doğal değil; burada her dilin kendi kalıbı var.
 */
const SEE_ALL = tri("Tümü", "See all", "Ver todo", "Ver tudo", "Alle anzeigen");
export const getSeeAllLabel = (language) => pickByLanguage(language, SEE_ALL);

/** Tabloda olan bölüm kimlikleri (testler ve ekranlar için). */
export const HOME_SECTION_IDS = Object.freeze(Object.keys(HOME_SECTIONS));

const pickLocalized = (value, language, mediaType) => {
  if (!value) return undefined;
  // `{ movie, tv }` ise önce türe göre indir; sonra dile göre seç.
  const byMedia =
    value.movie || value.tv ? value[mediaType === "tv" ? "tv" : "movie"] || value.movie || value.tv : value;
  return pickByLanguage(language, byMedia);
};

/**
 * Bir bölümün başlık bileşeni için kimliği.
 *
 * @param {string} section    HOME_SECTIONS anahtarı
 * @param {string} language   uygulama dili
 * @param {"movie"|"tv"} [mediaType]
 * @returns {{ icon: string, tone: "accent"|"gold", subtitle: string|undefined, title: string|undefined }}
 *   Bilinmeyen bölümde simge/ton varsayılana düşer, metinler undefined kalır (başlık yine çizilir).
 */
export function getSectionMeta(section, language, mediaType) {
  const entry = HOME_SECTIONS[section];
  if (!entry) return { icon: "film", tone: "accent", subtitle: undefined, title: undefined };
  return {
    icon: entry.icon,
    tone: entry.tone || "accent",
    subtitle: pickLocalized(entry.subtitle, language, mediaType),
    title: pickLocalized(entry.title, language, mediaType),
  };
}
