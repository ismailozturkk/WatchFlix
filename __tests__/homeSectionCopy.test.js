// Film / Dizi ana ekranı raf başlıklarının kimlik tablosu (utils/homeSectionCopy.js).
// Tablo bozulursa bir rafın başlığı simgesiz ya da alt başlıksız çıkar; yeni dil/yeni raf eklenirken de
// biri eksik bırakılamasın diye her giriş üç dilde ve gerçek bir simgeyle doğrulanır.
const fs = require("fs");
const path = require("path");
const {
  HOME_SECTIONS,
  HOME_SECTION_IDS,
  SECTION_TONES,
  getSectionMeta,
  getSeeAllLabel,
} = require("../utils/homeSectionCopy");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const IONICONS = require("../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Ionicons.json");

const LANGUAGES = ["tr", "en", "es", "pt"];

// Başlık bileşenini kullanan tüm raf dosyaları (`section="…"` ya da DiscoveryMediaRail ön ayarı).
const SECTION_FILES = [
  "components/DiscoveryMediaRail.js",
  "components/favorites/FavoritesRecommendationRail.js",
  "components/person/FollowedUpcomingRail.js",
  "screens/movie/MovieBests.js",
  "screens/movie/MovieCollection.js",
  "screens/movie/MovieGenres.js",
  "screens/movie/MovieNowPlaying.js",
  "screens/movie/MovieOscar.js",
  "screens/movie/MovieProvders.js",
  "screens/movie/MovieTrends.js",
  "screens/movie/MovieUpcoming.js",
  "screens/tv/TvOngoingSection.js",
  "screens/tv/TvShowBests.js",
  "screens/tv/TvShowsEmmy.js",
  "screens/tv/TvShowsGenres.js",
  "screens/tv/TvShowsOnTheAir.js",
  "screens/tv/TvShowsProvders.js",
  "screens/tv/TvShowsTrends.js",
  "screens/tv/TvShowsUpcoming.js",
];

describe("HOME_SECTIONS tablosu", () => {
  test.each(HOME_SECTION_IDS)("%s: simge gerçek, ton geçerli, alt başlık her dilde ve her türde dolu", (id) => {
    const entry = HOME_SECTIONS[id];
    expect(IONICONS[entry.icon]).toBeDefined();
    expect(SECTION_TONES).toContain(entry.tone || "accent");
    for (const language of LANGUAGES) {
      for (const mediaType of ["movie", "tv"]) {
        const meta = getSectionMeta(id, language, mediaType);
        expect(typeof meta.subtitle).toBe("string");
        expect(meta.subtitle.trim().length).toBeGreaterThan(0);
        if (entry.title) {
          expect(meta.title.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("ödül rafları altın tonlu, ötekiler vurgu tonlu", () => {
    expect(getSectionMeta("oscar", "tr", "movie").tone).toBe("gold");
    expect(getSectionMeta("emmy", "tr", "tv").tone).toBe("gold");
    const others = HOME_SECTION_IDS.filter((id) => id !== "oscar" && id !== "emmy");
    for (const id of others) expect(getSectionMeta(id, "tr", "movie").tone).toBe("accent");
  });

  test("tür-bağımlı alt başlık (Trendler) Film ve Dizi için ayrı cümle verir", () => {
    for (const language of LANGUAGES) {
      expect(getSectionMeta("trends", language, "movie").subtitle).not.toBe(
        getSectionMeta("trends", language, "tv").subtitle,
      );
    }
  });

  // Alt başlık, başlık satırında ikon kutusu ve "Tümü" düğmesiyle paylaşılan ~210 pt'ye 12 pt'te
  // sığmalı (≈ 36 karakter); uzun cümle iki satıra düşer ve raf başlıkları arasında yükseklik oynar.
  test("alt başlıklar tek satıra sığacak kadar kısa (≤ 38 karakter)", () => {
    for (const id of HOME_SECTION_IDS) {
      for (const language of LANGUAGES) {
        for (const mediaType of ["movie", "tv"]) {
          const { subtitle } = getSectionMeta(id, language, mediaType);
          if (id === "followedPeople") continue; // bileşen kendi cümlesini üretir; bu yalnız yedek
          expect({ id, language, length: subtitle.length <= 38 }).toEqual({ id, language, length: true });
        }
      }
    }
  });

  test("bilinmeyen dil İngilizce'ye düşer (Türkçe'ye değil)", () => {
    expect(getSectionMeta("onTheAir", "fr", "tv").subtitle).toBe(getSectionMeta("onTheAir", "en", "tv").subtitle);
    expect(getSectionMeta("onTheAir", "fr", "tv").subtitle).not.toBe(getSectionMeta("onTheAir", "tr", "tv").subtitle);
  });

  test("bilinmeyen bölüm çökmez: varsayılan simge, metinler boş", () => {
    expect(getSectionMeta("yok", "tr", "movie")).toEqual({
      icon: "film",
      tone: "accent",
      subtitle: undefined,
      title: undefined,
    });
    expect(getSectionMeta(undefined, "tr")).toMatchObject({ icon: "film" });
  });

  test("'Tümü' etiketi her dilin kendi kalıbında; bilinmeyen dil İngilizce", () => {
    expect(getSeeAllLabel("tr")).toBe("Tümü");
    expect(getSeeAllLabel("en")).toBe("See all");
    expect(getSeeAllLabel("es")).toBe("Ver todo");
    expect(getSeeAllLabel("fr")).toBe("See all");
  });

  test("Türler başlığı büyük harfli çeviri anahtarına değil tabloya bağlı (cümle düzeni)", () => {
    expect(getSectionMeta("genres", "tr").title).toBe("Türler");
    expect(getSectionMeta("genres", "en").title).toBe("Genres");
    expect(getSectionMeta("genres", "es").title).toBe("Géneros");
  });
});

describe("tablo ↔ raf dosyaları", () => {
  const used = new Set();
  for (const file of SECTION_FILES) {
    const src = read(file);
    for (const match of src.matchAll(/section="([A-Za-z]+)"/g)) used.add(match[1]);
  }
  // DiscoveryMediaRail `section={preset}` verir; ön ayarlar ekranların bölüm listesinde yazılı.
  for (const file of ["screens/tabs/MovieScreen.js", "screens/tabs/TvShowScreen.js"]) {
    for (const match of read(file).matchAll(/preset: "([A-Za-z]+)"/g)) used.add(match[1]);
  }

  test("raf dosyalarındaki her `section=` tabloda var", () => {
    for (const id of used) expect(HOME_SECTION_IDS).toContain(id);
  });

  test("tablodaki her giriş bir rafta kullanılıyor (ölü giriş yok)", () => {
    for (const id of HOME_SECTION_IDS) expect([...used]).toContain(id);
  });
});
