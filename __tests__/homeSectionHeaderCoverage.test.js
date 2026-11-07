// Film / Dizi ana ekranı raf başlığı kapsamı bekçisi (kaynak taraması).
//
// 19 Eki yenilemesinde sekiz ayrı elle yazılmış başlık düzeni tek bileşene (components/home/SectionHeader)
// indi. Biri bir rafa tekrar elle bir başlık/çip satırı yazarsa ekranın tutarlılığı sessizce bozulur; bu
// test hem "hepsi aynı bileşeni kullanıyor"u hem de "yükleme ve yüklenmiş durum AYNI başlığı çiziyor"u
// (ray başlığın altında; başlık yüksekliği değişirse ray aşağı zıplar) sabitler.
//
// YENİ RAF EKLERKEN: dosyayı SECTION_FILES'a ekle (+ gerekirse HEADER_REUSE), utils/homeSectionCopy
// tablosuna giriş aç (bkz. __tests__/homeSectionCopy.test.js).
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

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

// Yükleme dalı ile yüklenmiş dal başlığı AYNI öğe değişkeniyle çizmeli (≥ 2 kullanım).
// (Devam Edenler / Koleksiyon / Keşif / Favori / Takip: yükleme dalı yok ya da başlık tek dalda.)
const HEADER_REUSE = {
  "screens/movie/MovieBests.js": "bestsHeader",
  "screens/movie/MovieGenres.js": "genreHeader",
  "screens/movie/MovieNowPlaying.js": "nowPlayingHeader",
  "screens/movie/MovieOscar.js": "headerComponent",
  "screens/movie/MovieProvders.js": "providerHeader",
  "screens/movie/MovieTrends.js": "trendHeader",
  "screens/movie/MovieUpcoming.js": "headerComponent",
  "screens/tv/TvShowBests.js": "bestsHeader",
  "screens/tv/TvShowsEmmy.js": "headerComponent",
  "screens/tv/TvShowsGenres.js": "genreHeader",
  "screens/tv/TvShowsOnTheAir.js": "onTheAirHeader",
  "screens/tv/TvShowsProvders.js": "providerHeader",
  "screens/tv/TvShowsTrends.js": "trendHeader",
  "screens/tv/TvShowsUpcoming.js": "upcomingHeader",
};

// Çip satırı olan raflar ortak rayı (SectionChipRail) ve çip dilini (DiscoverFilterChip / ProviderChip) kullanır.
const CHIP_FILES = {
  "screens/movie/MovieBests.js": "DiscoverFilterChip",
  "screens/movie/MovieGenres.js": "DiscoverFilterChip",
  "screens/movie/MovieOscar.js": "DiscoverFilterChip",
  "screens/movie/MovieProvders.js": "ProviderChip",
  "screens/movie/MovieTrends.js": "DiscoverFilterChip",
  // Yaklaşan: çip satırı raf ile "Tümü" ekranında ortak bileşende (tarih çipleri + Filtreler).
  "components/home/UpcomingFilterChips.js": "DiscoverFilterChip",
  // Yaklaşan Diziler: aralık çipleri raf ile "Tümü" ekranında ortak bileşende.
  "components/home/TvUpcomingRangeChips.js": "DiscoverFilterChip",
  "screens/tv/TvShowBests.js": "DiscoverFilterChip",
  "screens/tv/TvShowsEmmy.js": "DiscoverFilterChip",
  "screens/tv/TvShowsGenres.js": "DiscoverFilterChip",
  "screens/tv/TvShowsOnTheAir.js": "DiscoverFilterChip",
  "screens/tv/TvShowsProvders.js": "ProviderChip",
  "screens/tv/TvShowsTrends.js": "DiscoverFilterChip",
};

describe("raf başlıkları — ortak SectionHeader", () => {
  test.each(SECTION_FILES)("%s SectionHeader kullanıyor", (file) => {
    const src = read(file);
    expect(src).toMatch(/import\s+SectionHeader[\s,][^;]*from\s+"[./]+(?:components\/)?(?:home\/)?SectionHeader"/);
    expect(src).toMatch(/<SectionHeader[\s>/]/);
  });

  test.each(SECTION_FILES)("%s eski başlık bileşenlerini kullanmıyor", (file) => {
    const src = read(file);
    expect(src).not.toMatch(/SeeAllHeader|SeeAllButton|ExpandPill/);
  });

  test("eski SeeAllHeader dosyası silindi (ölü kod geri gelmesin)", () => {
    expect(fs.existsSync(path.join(ROOT, "components/SeeAllHeader.js"))).toBe(false);
  });

  test.each(Object.entries(HEADER_REUSE))("%s: yükleme ve yüklenmiş dal aynı başlığı (%s) çiziyor", (file, name) => {
    const src = read(file);
    const uses = src.match(new RegExp(`\\{${name}\\}`, "g")) || [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
    // Başlık öğesi tek yerde tanımlı.
    expect(src.match(new RegExp(`const ${name} = \\(`, "g"))).toHaveLength(1);
  });

  test.each(Object.entries(CHIP_FILES))("%s ortak çip rayını ve çip dilini (%s) kullanıyor", (file, chip) => {
    const src = read(file);
    expect(src).toMatch(/SectionChipRail/);
    expect(src).toMatch(new RegExp(`<${chip}[\\s>/]`));
    // Elle yazılmış çip kutusu geri gelmesin.
    expect(src).not.toMatch(/styles\.(categoryChip|genreButton|chip)\b/);
  });
});

describe("SectionHeader — tasarım kuralları", () => {
  const header = read("components/home/SectionHeader.js");

  test("düz yüzey: cam (GlassSurface) kullanmaz — kaydırılan listenin içinde", () => {
    expect(header).not.toMatch(/GlassSurface|expo-glass-effect|NativeGlassView/);
  });

  test("vurgu üstü metin yok: ikon kutusu ve düğme vurgunun SOLUK tonu üstünde", () => {
    // Dolu vurgu zemini + beyaz yazı kuralı SectionChips'te de geçerli değil: seçili çip tonlu zemin kullanır.
    expect(header).toMatch(/alpha\(tint, 0\.14\)/);
    expect(header).toMatch(/alpha\(theme\.accent, 0\.13\)/);
    expect(header).not.toMatch(/backgroundColor: theme\.accent[,\s]/);
  });

  test("başlık erişilebilirlik rolü header; eylem düğmesi hangi rafın tümü olduğunu söyler", () => {
    expect(header).toMatch(/accessibilityRole="header"/);
    expect(header).toMatch(/\$\{seeAll\}: \$\{title\}/);
  });

  test("alt başlık satırı yer tutar (yükleme/yüklenmiş yükseklik sabit)", () => {
    expect(header).toMatch(/reserveSubtitle = true/);
    expect(header).toMatch(/subtitle \|\| " "/);
  });
});
