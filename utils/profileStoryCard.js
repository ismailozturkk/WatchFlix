// utils/profileStoryCard.js
//
// Profilden "Hikayede Paylaş" kartının SAF mantığı: seçenekler, poster seçimi,
// sayı biçimi, tür/seri/Perde/rozet özetleri. React/RN importu YOKTUR (jest'te
// doğrudan test edilir); kartı çizen bileşen
// components/storyShare/ProfileStoryCard.js, düzenleyici sayfa
// components/storyShare/ProfileStoryModal.js.

import { copyLanguage, intlLocaleOf } from "./appLanguages";
import { sortItemsByListOrder } from "./listOrder";
import { toDate } from "./watchScoring";
import { kanonikTur } from "./genreCanon";
import { hexToHsl, hslToHex } from "./colorUtils";
import { FAVORITE_KINDS, normalizeFavorites } from "./fourFavorites";
import { RARITY_ORDER, kademeRengi, kademeSekli } from "../theme/badgeTokens";

// Kimlikler UI'dan bağımsız: kayıtlı seçenekler bu dizgelerle saklanır, o
// yüzden bir kimliği yeniden adlandırmak kullanıcının kayıtlı tercihini sıfırlar.
// (Düzenlerin GÖRÜNÜMÜ değişebilir; "showcase" artık bento, "wall" sinematik.)
// "picks" (Seçki): "dört favori"nin büyük gösterildiği düzen; favori yoksa
// çizilemez (bkz. resolveStoryLayout).
export const STORY_LAYOUT_IDS = Object.freeze(["showcase", "identity", "wall", "minimal", "picks"]);
export const STORY_POSTER_SOURCE_IDS = Object.freeze(["favorites", "movies", "shows"]);
export const STORY_BACKGROUND_IDS = Object.freeze(["glow", "clean"]);
// utils/wrappedCard.js → WRAPPED_PALETTES'in ortak ilk altısıyla AYNI kimlikler
// (renk paleti oradan gelir; bu dizi yalnız doğrulama için).
export const WRAPPED_THEME_IDS = Object.freeze([
  "signature",
  "sunset",
  "ocean",
  "forest",
  "gold",
  "noir",
]);
// "rank": palet kullanıcının avatar halkasının renginden türer (buildRankPalette).
export const STORY_THEME_IDS = Object.freeze([...WRAPPED_THEME_IDS, "rank"]);

export const STORY_NOTE_MAX = 80;

// Instagram Story tam çözünürlüğü. Önizleme küçük çizilse de çıktı bu boyutta
// alınır (react-native-view-shot kaynağı bu boyuta ölçekleyerek yeniden çizer).
export const STORY_CAPTURE = Object.freeze({ width: 1080, height: 1920 });

// Her düzenin gösterebildiği en çok poster sayısı. Seçki'de liste posteri yok
// (poster alanını dört favori doldurur) → 0.
export const STORY_POSTER_COUNT = Object.freeze({
  showcase: 5,
  identity: 3,
  wall: 9,
  minimal: 5,
  picks: 0,
});

// `showFavorites` + `favoriteKinds`: dört favori (Users/{uid}.fourFavorites;
// utils/fourFavorites.js). KARIŞTIRMA: `posterSource: "favorites"` kütüphanedeki
// "kalp" listesidir, dört favori ayrı bir vitrindir.
export const DEFAULT_PROFILE_STORY_OPTIONS = Object.freeze({
  layout: "showcase",
  themeId: "signature",
  background: "glow",
  posterSource: "favorites",
  showStats: true,
  showPosters: true,
  showPerde: true,
  showBadges: true,
  showUsername: true,
  showGenres: true,
  showStreak: true,
  showMember: true,
  showFavorites: true,
  favoriteKinds: Object.freeze([...FAVORITE_KINDS]),
  note: "",
});

const BOOLEAN_KEYS = [
  "showStats",
  "showPosters",
  "showPerde",
  "showBadges",
  "showUsername",
  "showGenres",
  "showStreak",
  "showMember",
  "showFavorites",
];

const oneOfOr = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

/**
 * Kayıtlı/bozuk bir kategori listesini kanonik sırada (filmler, diziler,
 * oyuncular), tekrarsız ve EN AZ BİR öğeyle döndürür. Dizi değilse ya da hiçbir
 * geçerli kategori yoksa hepsi.
 */
export function sanitizeFavoriteKinds(raw) {
  if (!Array.isArray(raw)) return [...FAVORITE_KINDS];
  const picked = FAVORITE_KINDS.filter((kind) => raw.includes(kind));
  return picked.length ? picked : [...FAVORITE_KINDS];
}

/** Satır sonlarını/ardışık boşlukları tek boşluğa indirir, sınırı uygular. */
export function cleanStoryNote(raw) {
  if (typeof raw !== "string") return "";
  const flat = raw.replace(/\s+/g, " ").trim();
  return flat.length > STORY_NOTE_MAX
    ? flat.slice(0, STORY_NOTE_MAX).trimEnd()
    : flat;
}

/**
 * Kayıtlı/bozuk/eksik bir seçenek nesnesini güvenli tam nesneye çevirir.
 * Bilinmeyen anahtarlar atılır, geçersiz değerler varsayılana düşer — eski
 * sürümde kaydedilmiş bir tercih yeni sürümde ekranı bozamaz. Sonradan eklenen
 * anahtarlar (showGenres…) eski kayıtta yoktur ve varsayılanı (açık) alır.
 */
export function sanitizeStoryOptions(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const d = DEFAULT_PROFILE_STORY_OPTIONS;
  const out = {
    layout: oneOfOr(src.layout, STORY_LAYOUT_IDS, d.layout),
    themeId: oneOfOr(src.themeId, STORY_THEME_IDS, d.themeId),
    background: oneOfOr(src.background, STORY_BACKGROUND_IDS, d.background),
    posterSource: oneOfOr(src.posterSource, STORY_POSTER_SOURCE_IDS, d.posterSource),
    favoriteKinds: sanitizeFavoriteKinds(src.favoriteKinds),
    note: cleanStoryNote(src.note),
  };
  for (const key of BOOLEAN_KEYS) {
    out[key] = typeof src[key] === "boolean" ? src[key] : d[key];
  }
  return out;
}

/** Diske yazılacak hâl: not HER paylaşıma özel olduğundan saklanmaz. */
export function persistableStoryOptions(options) {
  const { note: _note, ...rest } = sanitizeStoryOptions(options);
  return rest;
}

const posterKey = (item, fallbackType) =>
  `${item?.type || fallbackType}-${item?.id}`;

const hasPoster = (item) =>
  item && item.id != null && typeof item.imagePath === "string" && item.imagePath !== "";

function orderedPosters(items, source) {
  const list = (Array.isArray(items) ? items : []).filter(hasPoster);
  if (source === "favorites") return sortItemsByListOrder(list);
  // İzlenenler: en yeni önce. Tarihi okunamayan kayıt sona düşer.
  const time = (item) => toDate(item.dateAdded)?.getTime() ?? 0;
  return list.slice().sort((a, b) => time(b) - time(a));
}

/**
 * Karta konacak posterleri seçer.
 *
 * İstenen kaynakta HİÇ posterli öğe yoksa sırayla diğerlerine düşülür; dönen
 * `source` fiilen kullanılan kaynaktır — kart başlığı ("Favorilerim" / "Son
 * izlediklerim") buna göre yazılmalı, yoksa boş favoriler listesinde "Favorilerim"
 * başlığı altında izlenen filmler görünürdü. İstenen kaynakta öğe VARSA yalnız
 * o kullanılır, eksik yuvalar başka listeyle doldurulmaz (aynı sebep).
 *
 * @param {{favorites?: any[], movies?: any[], shows?: any[]}} sources
 * @param {"favorites"|"movies"|"shows"} requested
 * @param {number} count
 * @returns {{ source: string|null, items: Array<{key: string, name: string, imagePath: string}> }}
 */
export function pickStoryPosters(sources, requested, count) {
  const order = [
    requested,
    ...STORY_POSTER_SOURCE_IDS.filter((id) => id !== requested),
  ];
  for (const source of order) {
    const fallbackType = source === "shows" ? "tv" : "movie";
    const seen = new Set();
    const items = [];
    for (const item of orderedPosters(sources?.[source], source)) {
      const key = posterKey(item, fallbackType);
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        key,
        name: String(item.name || item.title || ""),
        imagePath: item.imagePath,
      });
      if (items.length >= count) break;
    }
    if (items.length) return { source, items };
  }
  return { source: null, items: [] };
}

/** Kart için temiz sayaçlar (negatif/NaN → 0). */
export function buildStoryStats({
  movies = 0,
  shows = 0,
  episodes = 0,
  totalMinutes = 0,
} = {}) {
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
  const minutes = n(totalMinutes);
  const hours = Math.floor(minutes / 60);
  return {
    movies: n(movies),
    shows: n(shows),
    episodes: n(episodes),
    hours,
    days: Math.floor(hours / 24),
    // "78 gün 1 saat" cümlesinin saat kısmı (gün sayıldıktan SONRA kalan).
    remHours: hours % 24,
  };
}

/**
 * 12345 → "12.345" (yerel biçim). `compact` açıkken 10.000+ kısaltılır
 * ("12,3B" / "12.3K") — dar istatistik karolarına sığsın diye.
 */
export function formatStoryNumber(value, language = "tr", { compact = false } = {}) {
  const n = Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
  const lang = copyLanguage(language, ["tr", "en", "es", "pt"]);
  const short = (divisor, unit) => {
    const text = (n / divisor).toFixed(1).replace(/\.0$/, "");
    // Ondalık virgül: Türkçe ve İspanyolca; ayraç İngilizcede nokta.
    return `${lang === "en" ? text : text.replace(".", ",")}${unit}`;
  };
  if (compact && n >= 1_000_000) return short(1_000_000, "M");
  if (compact && n >= 10_000) return short(1_000, lang === "en" ? "K" : lang === "es" ? " mil" : lang === "pt" ? " mil" : "B");
  try {
    return n.toLocaleString(intlLocaleOf(language));
  } catch {
    return String(n);
  }
}

/** Hesap kimliğini karta uygun hâle getirir: baştaki @ atılır, boşluk kırpılır. */
export function cleanStoryUsername(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "");
}

// ── Türler ───────────────────────────────────────────────────────────────────

// Kanonik tür kimliği → karttaki ad. Uygulama tür adını TMDB'nin o anki dilinde
// saklar (utils/genreCanon.js başlığı); aynı türün "Bilim Kurgu"/"Science
// Fiction" yazımları tek kimliğe iner ve kart adı BURADAN, kartın diliyle çıkar.
export const STORY_GENRE_LABELS = Object.freeze({
  action: { tr: "Aksiyon", en: "Action", es: "Acción", pt: "Ação" },
  adventure: { tr: "Macera", en: "Adventure", es: "Aventura", pt: "Aventura" },
  animation: { tr: "Animasyon", en: "Animation", es: "Animación", pt: "Animação" },
  comedy: { tr: "Komedi", en: "Comedy", es: "Comedia", pt: "Comédia" },
  crime: { tr: "Suç", en: "Crime", es: "Crimen", pt: "Crime" },
  documentary: { tr: "Belgesel", en: "Documentary", es: "Documental", pt: "Documentário" },
  drama: { tr: "Dram", en: "Drama", es: "Drama", pt: "Drama" },
  family: { tr: "Aile", en: "Family", es: "Familia", pt: "Família" },
  fantasy: { tr: "Fantastik", en: "Fantasy", es: "Fantasía", pt: "Fantasia" },
  history: { tr: "Tarih", en: "History", es: "Historia", pt: "História" },
  horror: { tr: "Korku", en: "Horror", es: "Terror", pt: "Terror" },
  music: { tr: "Müzik", en: "Music", es: "Música", pt: "Música" },
  mystery: { tr: "Gizem", en: "Mystery", es: "Misterio", pt: "Mistério" },
  romance: { tr: "Romantik", en: "Romance", es: "Romance", pt: "Romance" },
  scifi: { tr: "Bilim Kurgu", en: "Sci-Fi", es: "Ciencia ficción", pt: "Ficção científica" },
  thriller: { tr: "Gerilim", en: "Thriller", es: "Suspense", pt: "Thriller" },
  war: { tr: "Savaş", en: "War", es: "Bélica", pt: "Guerra" },
  western: { tr: "Vahşi Batı", en: "Western", es: "Western", pt: "Faroeste" },
  reality: { tr: "Realite", en: "Reality", es: "Reality", pt: "Reality" },
  tvmovie: { tr: "TV Filmi", en: "TV Movie", es: "Película de TV", pt: "Filme para TV" },
});

const GENRE_ORDER = Object.keys(STORY_GENRE_LABELS);

/**
 * İzlenen yapımlardan en çok izlenen türleri çıkarır.
 *
 * Sayım BAŞLIK başınadır (tekrar izleme şişirmez, bir yapım bir türü bir kez
 * sayar). `pct`: türü taşıyan yapımların, türü bilinen yapımlar içindeki payı —
 * bir yapım birden çok türde olabildiği için yüzdeler 100'e TOPLANMAZ ve bu
 * doğrudur ("izlediklerimin %38'i dram"). Tanınmayan/boş tür adları yok sayılır.
 *
 * @param {any[]} items  film + dizi listesi öğeleri (`genres`: ad dizisi)
 * @returns {{ titles: number, top: Array<{id, label, count, pct}> }}
 */
export function buildStoryGenres(items, language = "tr", limit = 3) {
  const lang = copyLanguage(language, ["tr", "en", "es", "pt"]);
  const counts = new Map();
  const seen = new Set();
  let titles = 0;
  for (const item of Array.isArray(items) ? items : []) {
    if (!item || item.id == null) continue;
    const key = `${item.type || ""}-${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const ids = new Set();
    for (const entry of Array.isArray(item.genres) ? item.genres : []) {
      const id = kanonikTur(typeof entry === "string" ? entry : entry?.name);
      if (id && id !== "other") ids.add(id);
    }
    if (!ids.size) continue;
    titles += 1;
    for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
  }
  const top = [...counts.entries()]
    .sort(
      (a, b) =>
        b[1] - a[1] || GENRE_ORDER.indexOf(a[0]) - GENRE_ORDER.indexOf(b[0]),
    )
    .slice(0, Math.max(0, limit))
    .map(([id, count]) => ({
      id,
      label: STORY_GENRE_LABELS[id]?.[lang] || id,
      count,
      pct: titles ? Math.round((count / titles) * 100) : 0,
    }));
  return { titles, top };
}

// ── Seri ─────────────────────────────────────────────────────────────────────

/**
 * `useWatchProgress().seriler` → kart özeti. Hiç aktiflik yoksa null (kart
 * "0 günlük seri" diye boş bir karo çizmesin).
 *
 * `showRecord`: şu an seri yok ama geçmişte vardı → karo REKORU gösterir
 * ("rekor 12 gün"); kırık bir seriyi "0" diye paylaşmak kimseye yaramaz.
 */
export function buildStoryStreak(seriler) {
  if (!seriler || typeof seriler !== "object") return null;
  const n = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
  const current = n(seriler.gunSerisi);
  const record = Math.max(n(seriler.rekorGun), current);
  if (!current && !record) return null;
  const week =
    Array.isArray(seriler.haftaKutulari) && seriler.haftaKutulari.length === 7
      ? seriler.haftaKutulari.map(Boolean)
      : Array(7).fill(false);
  return {
    current,
    record,
    week,
    activeDays: n(seriler.aktifGunSayisi),
    showRecord: current === 0,
  };
}

// ── Perde ────────────────────────────────────────────────────────────────────

/**
 * `useWatchProgress().perde` → kart özeti (metin olmadan; "PERDE 9" biçimi
 * çeviri gerektirdiği için bileşende kurulur).
 */
export function buildStoryPerde(info, language = "tr") {
  const number = Math.floor(Number(info?.perde));
  if (!Number.isFinite(number) || number < 1) return null;
  const progress = Number(info.ilerleme);
  return {
    number,
    makara: Math.max(0, Math.floor(Number(info.makara)) || 0),
    name: (language === "tr" ? info.ad : language === "es" ? info.adEs : language === "pt" ? info.adPt : info.adEn) || "",
    progress: Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0,
    maxed: Boolean(info.zirve),
  };
}

// ── Üyelik ───────────────────────────────────────────────────────────────────

/**
 * Hesap oluşturulma anı → "MART 2025" / "MAR 2025". Firebase `createdAt` ms
 * DİZGESİ, `creationTime` ise tarih dizgesi verir; ikisi de kabul edilir.
 * Okunamazsa "" (kart üyelik satırını çizmez).
 */
export function formatMemberSince(raw, language = "tr") {
  if (raw == null || raw === "") return "";
  const value = typeof raw === "string" && /^\d+$/.test(raw.trim()) ? Number(raw) : raw;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const locale = intlLocaleOf(language);
  try {
    return date
      .toLocaleDateString(locale, { month: copyLanguage(language, ["tr", "en", "es", "pt"]) === "en" ? "short" : "long", year: "numeric" })
      .toLocaleUpperCase(locale);
  } catch {
    return String(date.getFullYear());
  }
}

// ── Rozet vitrini ────────────────────────────────────────────────────────────

/**
 * Açılmış izleme rozetlerinden vitrine en nadir olanları seçer (profildeki
 * WatchBadgeStrip ile AYNI sıra: nadirlik, sonra aile kademesi). `cards`:
 * `useWatchProgress().kartlar` — her aile için tek kart olduğundan aynı aileden
 * dört rozet gelmez.
 */
export function pickShowcaseBadges(cards, limit = 4) {
  const rank = (card) => Math.max(0, RARITY_ORDER.indexOf(card?.rarity));
  return (Array.isArray(cards) ? cards : [])
    .filter((card) => card && card.acik)
    .sort(
      (a, b) =>
        rank(b) - rank(a) ||
        (b.aileKademe || 0) - (a.aileKademe || 0) ||
        String(a.id).localeCompare(String(b.id)),
    )
    .slice(0, Math.max(0, limit));
}

// Kart HEP koyu zeminde çizilir; uygulama teması açık olsa da kademe renginin
// koyu-yüzey tonu seçilsin diye sahte bir koyu yüzey verilir.
const DARK_SURFACE = { primary: "#000000" };

/**
 * Rozet kartı → AppBadge girdisi (siluet + kademe rengi). Ailesiz rozette
 * `color` null kalır; kart nadirliğe göre sabit bir ton seçer.
 */
export function toStoryBadge(card) {
  const shape = kademeSekli(card?.tier, card?.aileToplam);
  return {
    id: card?.id,
    glyph: card?.icon,
    glyphSolid: card?.iconSolid,
    rarity: card?.rarity,
    sides: shape.kenar,
    ornate: shape.ornate,
    color: kademeRengi(shape.kademe, DARK_SURFACE) || null,
  };
}

// ── "Profil rengi" teması ────────────────────────────────────────────────────

const HSL_RE = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i;

/** "hsl(265, 60%, 60%)" → "#RRGGBB"; tanınmazsa null. */
export function hslStringToHex(value) {
  const match = typeof value === "string" ? value.match(HSL_RE) : null;
  return match ? hslToHex(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}

/**
 * Avatar halkasının (rütbe) iki renginden kart paleti. Wrapped paletleriyle
 * AYNI şekil: accent/secondary + dört duraklı koyulaşan zemin. Halka renkleri
 * okunamazsa null → çağıran varsayılan temaya düşer.
 */
export function buildRankPalette(ringColors) {
  if (!Array.isArray(ringColors) || ringColors.length < 2) return null;
  const base = hslStringToHex(ringColors[0]);
  const light = hslStringToHex(ringColors[1]);
  if (!base || !light) return null;
  const { h, s } = hexToHsl(base);
  const sat = Math.min(86, Math.max(38, s));
  return {
    id: "rank",
    accent: light,
    secondary: hslToHex(h + 38, sat, 62),
    colors: [
      hslToHex(h, sat, 46),
      hslToHex(h, sat * 0.85, 26),
      hslToHex(h, sat * 0.6, 11),
      hslToHex(h, sat * 0.4, 4),
    ],
  };
}

// ── Dört favori ──────────────────────────────────────────────────────────────

/**
 * Dört favoriden karta konacak kategori grupları (filmler, diziler, oyuncular
 * kanonik sırasıyla). `kinds` kullanıcının seçtiği kategorilerdir.
 *
 * Boş kategori grup üretmez. Seçili kategorilerin HİÇBİRİNDE öğe yoksa (ör. yalnız
 * "oyuncular" seçiliyken oyuncu favorileri silindi) bayat seçim yüzünden vitrin
 * kaybolmasın diye tüm kategorilere genişletilir.
 *
 * @param {object} favorites  readProfileFavorites(profile) çıktısı
 * @param {string[]} kinds
 * @returns {{ groups: Array<{kind: string, items: Array<{key, title, imagePath, year}>}>, kinds: string[], count: number }}
 *   `kinds`: fiilen gösterilen kategoriler; `count`: toplam öğe sayısı.
 */
export function pickStoryFavorites(favorites, kinds) {
  const safe = normalizeFavorites(favorites);
  const build = (allowed) =>
    FAVORITE_KINDS.filter((kind) => allowed.includes(kind))
      .map((kind) => ({
        kind,
        items: safe[kind].map((entry) => ({
          key: `${kind}-${entry.id}`,
          title: entry.title,
          imagePath: entry.image || null,
          year: entry.year || "",
        })),
      }))
      .filter((group) => group.items.length > 0);
  let groups = build(sanitizeFavoriteKinds(kinds));
  if (!groups.length) groups = build(FAVORITE_KINDS);
  return {
    groups,
    kinds: groups.map((group) => group.kind),
    count: groups.reduce((sum, group) => sum + group.items.length, 0),
  };
}

/** Dört favori kartta gerçekten çizilecek mi? (Anahtar açık VE gösterilecek öğe var.) */
export const isFavoritesActive = (options, pick) =>
  Boolean(options?.showFavorites) && (pick?.count || 0) > 0;

/**
 * Çizilecek düzen kimliği. Seçki favorisiz çizilemez; kayıtlı tercih "picks"
 * kalır (favori eklenince geri gelir) ama kart o sürece Vitrin'e düşer.
 */
export function resolveStoryLayout(layout, favoritesActive) {
  const id = STORY_LAYOUT_IDS.includes(layout) ? layout : DEFAULT_PROFILE_STORY_OPTIONS.layout;
  return id === "picks" && !favoritesActive ? "showcase" : id;
}

/**
 * Kategori düğmesine basılınca yeni seçili kategoriler. Boş kategori seçilemez ve
 * son görünen kategori kapatılamaz — ikisi de kartı favorisiz bırakırdı. Çıktı
 * hep kanonik sırada ve `pickStoryFavorites(...).kinds` ile aynı küme.
 */
export function toggleStoryKind(selected, kind, favorites) {
  const safe = normalizeFavorites(favorites);
  const current = pickStoryFavorites(favorites, selected).kinds;
  if (!FAVORITE_KINDS.includes(kind) || !safe[kind].length) return current;
  if (current.includes(kind)) {
    return current.length <= 1 ? current : current.filter((k) => k !== kind);
  }
  return FAVORITE_KINDS.filter((k) => k === kind || current.includes(k));
}

// ── Dört favori: yerleşim bütçesi ────────────────────────────────────────────
//
// Kart referans tuvalde (360x640, kenar boşluğu 20) 600 piksellik dikey alana
// sahiptir. Seçki düzeni bu alanı AÇIK olan bölümlere göre paylaştırır: sabit
// yükseklikli bölümler (aşağıda) düşülür, kalan dikey alan favori raflarına
// verilir ve raf boyutu bu alana göre ÇÖZÜLÜR. Böylece her anahtar birleşiminde
// (not, istatistik, Perde, tür, seri/rozet, 1–3 kategori) kart taşmaz — bu
// invariant testle sabit (__tests__/profileStoryCard.test.js). Kart bileşeni
// aynı sabitleri kullanır; bölüm yüksekliklerinden birini değiştirirsen BURAYI
// da değiştir.

export const STORY_INNER_H = 600;

export const PICKS_BUDGET = Object.freeze({
  header: 30,
  footer: 28,
  identity: 52,
  note: 52, // en çok 2 satır
  noteGap: 8,
  stats: 54,
  perde: 50,
  chips: 26, // tür hapları (tek satır)
  pills: 32, // seri + rozet hapları
  extrasGap: 8,
  gap: 6, // bölümler arası en küçük boşluk; kalan `space-between` ile dağılır
  safety: 4,
});

export const FAVORITE_SHELF = Object.freeze({
  titleH: 22, // bölüm başlığı (14) + 8 boşluk
  padY: 11, // cam panel: 10 iç boşluk + 1 kenar (üstte ve altta)
  rowGap: 8,
  nameH: 16, // 4 boşluk + 12 ad satırı
  labelH: 18, // üst etiketli kip: 14 etiket + 4 boşluk
  minW: 26,
  sideMaxW: 52, // soldaki etiket sütunlu (3 kategori) kip
  topMaxW: 66, // üstte etiketli (1–2 kategori) kip
  namesMinW: 40, // ad satırı yalnız poster bundan geniş kalabiliyorsa
});

const shelfArtHeight = (kind, width) => (kind === "people" ? width : Math.round(width * 1.5));

/**
 * `available` dikey alana sığan en büyük raf boyutu. 3 kategori: soldaki etiket
 * sütunu + 4 yuva; 1–2 kategori: etiket rafın üstünde, yuvalar tam genişlikte
 * (daha büyük posterler). Ad satırı yalnız yer varsa; sığmazsa küçülür.
 *
 * @param {{kinds: string[], available: number}} input
 * @returns {null | {style: "side"|"top", names: boolean, width: number,
 *   rows: Array<{kind: string, artW: number, artH: number}>, height: number}}
 */
export function planFavoriteShelves({ kinds, available }) {
  const S = FAVORITE_SHELF;
  const list = (Array.isArray(kinds) ? kinds : []).filter((k) => FAVORITE_KINDS.includes(k));
  if (!list.length) return null;
  const n = list.length;
  const style = n >= 3 ? "side" : "top";
  const maxW = style === "side" ? S.sideMaxW : S.topMaxW;
  const chrome = S.titleH + S.padY * 2 + S.rowGap * (n - 1) + (style === "top" ? S.labelH * n : 0);
  const heightFor = (width, names) =>
    chrome +
    list.reduce((sum, kind) => sum + shelfArtHeight(kind, width), 0) +
    (names ? S.nameH * n : 0);
  const fit = (names) => {
    let width = maxW;
    while (width > S.minW && heightFor(width, names) > available) width -= 1;
    return width;
  };
  let names = true;
  let width = fit(true);
  if (width < S.namesMinW) {
    names = false;
    width = fit(false);
  }
  return {
    style,
    names,
    width,
    rows: list.map((kind) => ({ kind, artW: width, artH: shelfArtHeight(kind, width) })),
    height: heightFor(width, names),
  };
}

/**
 * Seçki düzeninin dikey planı. Bayraklar kartın o an çizeceği bölümleri söyler:
 * `hasNote` (not dolu → 2 satır payı), `showPills` (seri ve/veya rozet hapı).
 *
 * @returns {{ fixed: number, gaps: number, available: number, used: number, shelf: object|null }}
 */
export function planPicksLayout({ kinds, hasNote, showStats, showPerde, showGenres, showPills }) {
  const B = PICKS_BUDGET;
  let fixed = B.header + B.identity + B.footer + (hasNote ? B.noteGap + B.note : 0);
  let sections = 4; // üst bilgi, kimlik, favoriler, altbilgi
  if (showStats) {
    fixed += B.stats;
    sections += 1;
  }
  if (showPerde) {
    fixed += B.perde;
    sections += 1;
  }
  if (showGenres || showPills) {
    fixed +=
      (showGenres ? B.chips : 0) + (showGenres && showPills ? B.extrasGap : 0) + (showPills ? B.pills : 0);
    sections += 1;
  }
  const gaps = (sections - 1) * B.gap;
  const available = STORY_INNER_H - fixed - gaps - B.safety;
  const shelf = planFavoriteShelves({ kinds, available });
  return { fixed, gaps, available, used: fixed + gaps + (shelf?.height || 0), shelf };
}

// ── Dört favori: şerit (eski düzenlerin poster alanı) ───────────────────────

// Vitrin/Kimlik/Minimal'de dört favori poster alanının YERİNE geçer: kategori
// başına üst üste binen küçük bir poster destesi. `slot`: o düzendeki poster
// alanının yüksekliği (kart bu kutuya ortalar), `thumb`: yuva genişliği.
export const FAVORITE_RIBBON = Object.freeze({
  showcase: { slot: 86, thumb: 38 },
  identity: { slot: 96, thumb: 38 },
  minimal: { slot: 78, thumb: 36 },
});

/** Bir şerit grubunun ölçüleri: 4 posterlik deste genişliği ve toplam yükseklik. */
export function ribbonMetrics(thumb) {
  const offset = Math.round(thumb * 0.52);
  const thumbH = Math.round(thumb * 1.5);
  return { thumb, offset, thumbH, stackW: thumb + offset * 3, labelH: 18, height: 18 + thumbH };
}
