// __tests__/helpers/storyCardFixtures.js
//
// Profil hikaye kartı (ProfileStoryCard) render testleri için ortak sahte veri.
// jest.mock çağrıları test dosyasında durmak zorunda (hoisting); burada yalnız
// kart props'u ve ağaç okuma yardımcıları var.

const { sanitizeStoryOptions } = require("../../utils/profileStoryCard");

const RING = ["hsl(265, 60%, 60%)", "hsl(265, 74%, 76%)"];

const mockTheme = {
  primary: "#111111",
  secondary: "#202020",
  between: "#181818",
  border: "#333333",
  accent: "#3388ff",
  text: { primary: "#ffffff", secondary: "#cccccc", muted: "#888888" },
};

const poster = (i) => ({
  key: `movie-${i}`,
  name: `Poster ${i}`,
  imagePath: `/p${i}.jpg`,
  uri: `https://img.test/p${i}.jpg`,
});

const STR_TR = {
  brandSub: "PROFİL",
  member: "ÜYE",
  movies: "FİLM",
  shows: "DİZİ",
  episodes: "BÖLÜM",
  hours: "SAAT",
  totalTime: "TOPLAM SÜRE",
  genres: "EN ÇOK İZLENEN TÜRLER",
  streak: "SERİ",
  streakRecord: "REKOR",
  dayUnit: "GÜN",
  badges: "ROZETLER",
  cta: "İzlediklerini sen de kaydet",
  favTitle: "DÖRT FAVORİM",
  posterTitle: {
    favorites: "FAVORİLERİM",
    movies: "SON İZLEDİĞİM FİLMLER",
    shows: "SON İZLEDİĞİM DİZİLER",
  },
};

/** Tam veri; `overrides` üstüne biner (options sanitize edilir). */
function makeCardProps(overrides = {}) {
  const { options: optionOverrides, ...rest } = overrides;
  return {
    options: sanitizeStoryOptions({ note: "", ...(optionOverrides || {}) }),
    theme: mockTheme,
    language: "tr",
    profile: { name: "Ayşe Yılmaz", username: "ayse", avatar: null, isCustomPhoto: false, ringColors: RING },
    badges: [
      { id: "founder", rarity: "legendary", glyph: "star-outline", glyphSolid: "star", tr: "Kurucu", en: "Founder" },
      { id: "premium", rarity: "epic", glyph: "diamond-outline", glyphSolid: "diamond", tr: "Premium", en: "Premium" },
    ],
    badgeInfo: {
      earned: 24,
      total: 81,
      showcase: [0, 1, 2, 3].map((i) => ({
        id: `b${i}`,
        glyph: "trophy-outline",
        glyphSolid: "trophy",
        rarity: "rare",
        sides: 6,
        ornate: false,
        color: null,
      })),
    },
    stats: { movies: 120, shows: 34, episodes: 980, hours: 1873, days: 78, remHours: 1, daysText: "78 GÜN 1 SAAT" },
    perde: { number: 9, makara: 0, name: "Sinefil", progress: 0.64, maxed: false, label: "PERDE 9", makaraLabel: "" },
    genres: {
      titles: 20,
      top: [
        { id: "drama", label: "Dram", count: 9, pct: 45 },
        { id: "scifi", label: "Bilim Kurgu", count: 6, pct: 30 },
        { id: "thriller", label: "Gerilim", count: 4, pct: 20 },
      ],
    },
    streak: { current: 5, record: 12, week: [true, true, false, true, true, true, false], activeDays: 40, showRecord: false },
    member: "MART 2025",
    posters: { source: "favorites", items: Array.from({ length: 9 }, (_, i) => poster(i + 1)) },
    str: STR_TR,
    favorites: null,
    onImageSettled: undefined,
    ...rest,
  };
}

const KIND_LABEL_TR = { movies: "FİLMLER", shows: "DİZİLER", people: "OYUNCULAR" };

/**
 * Kartın beklediği `favorites` (ProfileStoryModal'ın ürettiği biçim). `counts`
 * kategori başına öğe sayısı; `noImage` görsel adresi olmayan kategoriler.
 */
function makeCardFavorites(counts = { movies: 4, shows: 4, people: 4 }, { noImage = [] } = {}) {
  const groups = ["movies", "shows", "people"]
    .filter((kind) => (counts[kind] || 0) > 0)
    .map((kind) => ({
      kind,
      label: KIND_LABEL_TR[kind],
      items: Array.from({ length: counts[kind] }, (_, i) => ({
        key: `${kind}-${i + 1}`,
        title: `${kind} ${i + 1}`,
        uri: noImage.includes(kind) ? null : `https://img.test/${kind}${i + 1}.jpg`,
      })),
    }));
  return { count: groups.reduce((sum, g) => sum + g.items.length, 0), groups };
}

/** Test renderer ağacındaki tüm metinleri (sırayla) toplar. */
const textOf = (node) => {
  if (node == null) return [];
  if (typeof node === "string") return [node];
  if (Array.isArray(node)) return node.flatMap(textOf);
  return textOf(node.children);
};

module.exports = { mockTheme, makeCardProps, makeCardFavorites, poster, STR_TR, textOf, RING };
