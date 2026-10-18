// utils/watchPicker.js
//
// "Ne izlesem?" (izleme listesinden rastgele seçim) — SAF çekirdek (RN / ağ / i18n importu yok).
// Arayüz: components/lists/WatchPickerEntry.js (liste ekranındaki giriş kartı) ve
// components/lists/WatchPickerSheet.js (seçim sayfası). Metinler utils/watchPickerCopy.js.
//
// Eski "kasa açma" akışından devralınan KURALLAR (ve düzeltilen kusurlar):
//   • Havuz = ekranda o an görünen (arama/süzgeç uygulanmış) liste; tür seçimi havuzu daraltır.
//   • Aynı oturumda ARDARDA aynı yapım çıkmaz: görülenler elenir, hepsi görülünce baştan başlar
//     (eskiden "Yeniden seç" aynı yapımı tekrar verebiliyordu).
//   • Seçim `randomInt` ile (rejection sampling) yapılır; düz Math.random değil (bkz. utils/randomPick).
//   • Hareket kısa ve ATLANABİLİR: yavaşlayan birkaç kare (toplam ≈ 1 sn), "Hareketi azalt"ta hiç yok.

import { randomInt } from "./randomPick";

export const PICK_TYPES = Object.freeze(["mixed", "movie", "tv"]);

/** Kare sayısı ve süreleri: kısa, yavaşlayan bir "karıştırma". */
export const SHUFFLE_FRAME_COUNT = 9;
const FRAME_FIRST_MS = 55;
const FRAME_SPREAD_MS = 200;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const keyOf = (item) => `${item?.type === "tv" ? "tv" : "movie"}:${item?.id}`;

const isPickable = (item) => item && item.id != null && (item.type === "movie" || item.type === "tv");

/** Seçilebilir öğeler (kimliksiz / tanınmayan türde kayıtlar sessizce elenir). */
export function poolFor(items, type = "mixed") {
  if (!Array.isArray(items)) return [];
  const clean = items.filter(isPickable);
  return type === "movie" || type === "tv" ? clean.filter((item) => item.type === type) : clean;
}

export function countsOf(items) {
  const movie = poolFor(items, "movie").length;
  const tv = poolFor(items, "tv").length;
  return { mixed: movie + tv, movie, tv };
}

/** Sayfa açılırken seçili tür: ikisi de varsa Karışık, yalnız biri varsa o. */
export function defaultTypeFor(counts) {
  if (!counts || counts.mixed === 0) return "mixed";
  if (counts.movie > 0 && counts.tv > 0) return "mixed";
  return counts.movie > 0 ? "movie" : "tv";
}

/**
 * Sıradaki seçim.
 * @param {object} p
 * @param {Array}  p.pool      poolFor çıktısı
 * @param {string[]} [p.seen]  bu oturumda çıkanların anahtarları
 * @param {object} [p.current] ekranda duran yapım (döngü başlarken yine onu verme)
 * @param {(n:number)=>number} [p.rand]
 * @returns {{ item: object|null, seen: string[], cycled: boolean }}
 */
export function pickNext({ pool, seen = [], current = null, rand = randomInt }) {
  if (!Array.isArray(pool) || pool.length === 0) return { item: null, seen, cycled: false };
  const seenSet = new Set(seen);
  let candidates = pool.filter((item) => !seenSet.has(keyOf(item)));
  let cycled = false;
  let nextSeen = seen;
  if (candidates.length === 0) {
    // Hepsi görüldü: baştan başla ama az önce çıkanı hemen tekrar verme.
    cycled = pool.length > 1;
    const currentKey = current ? keyOf(current) : null;
    candidates = pool.length > 1 ? pool.filter((item) => keyOf(item) !== currentKey) : pool;
    nextSeen = [];
  }
  const item = candidates[rand(candidates.length)] ?? candidates[0];
  return { item, seen: [...nextSeen, keyOf(item)], cycled };
}

/**
 * Karıştırma karelerini üretir; SON kare her zaman kazanan, iki kare art arda aynı olmaz.
 * Havuzda tek yapım varsa yalnız o döner (animasyon anlamsız).
 */
export function shuffleFrames({ pool, winner, count = SHUFFLE_FRAME_COUNT, rand = randomInt }) {
  if (!winner) return [];
  if (!Array.isArray(pool) || pool.length < 2) return [winner];
  const frames = [];
  let previousKey = null;
  for (let i = 0; i < count - 1; i += 1) {
    let candidate = pool[rand(pool.length)];
    for (let attempt = 0; attempt < 6 && keyOf(candidate) === previousKey; attempt += 1) {
      candidate = pool[rand(pool.length)];
    }
    frames.push(candidate);
    previousKey = keyOf(candidate);
  }
  // Son geçişin önceki kareyle aynı olmaması için bir tur daha dene; olmazsa kabul (az yapımlı havuz).
  if (frames.length && keyOf(frames[frames.length - 1]) === keyOf(winner)) {
    const other = pool.find((item) => keyOf(item) !== keyOf(winner));
    if (other) frames[frames.length - 1] = other;
  }
  frames.push(winner);
  return frames;
}

/** Kare başına bekleme (ms): yavaşlar. */
export function frameDelays(count = SHUFFLE_FRAME_COUNT) {
  if (count <= 1) return [0];
  return Array.from({ length: count }, (_, i) =>
    Math.round(FRAME_FIRST_MS + FRAME_SPREAD_MS * (i / (count - 1)) ** 2),
  );
}

/** Listede kaç gündür? (dateAdded geçersizse null) */
export function daysInList(item, now = Date.now()) {
  const ts = item?.dateAdded ? new Date(item.dateAdded).getTime() : NaN;
  if (!Number.isFinite(ts) || ts > now) return null;
  return Math.floor((now - ts) / MS_PER_DAY);
}

/**
 * "Neden bu?" için tek cümlelik gerekçe ANAHTARI (metin copy'de). Öncelik: uzun süredir bekleyen,
 * yeni eklenen, sonra süre/sezon özelliği. Hiçbiri yoksa null (satır gizlenir).
 * @returns {{ kind: string, value?: number } | null}
 */
export function reasonOf(item, now = Date.now()) {
  if (!item) return null;
  const days = daysInList(item, now);
  if (days != null && days >= 60) return { kind: "waitingMonths", value: Math.floor(days / 30) };
  if (days != null && days >= 14) return { kind: "waitingDays", value: days };
  if (days != null && days <= 3) return { kind: "fresh" };
  if (item.type === "movie") {
    const minutes = Number(item.minutes);
    if (minutes > 0 && minutes <= 100) return { kind: "shortFilm", value: minutes };
    if (minutes >= 150) return { kind: "longFilm", value: minutes };
  } else {
    const seasons = Number(item.seasonCount);
    if (seasons === 1) return { kind: "oneSeason" };
    if (seasons >= 5) return { kind: "longRun", value: seasons };
  }
  return null;
}

/** 112 → "1 sa 52 dk"; 45 → "45 dk"; 120 → "2 sa". */
export function formatMinutes(minutes, { hour = "sa", minute = "dk" } = {}) {
  const total = Math.round(Number(minutes));
  if (!(total > 0)) return null;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} ${minute}`;
  return m === 0 ? `${h} ${hour}` : `${h} ${hour} ${m} ${minute}`;
}

/**
 * Süre / hacim bilgisi parçaları: film → "1 sa 52 dk"; dizi → "3 sezon", "28 bölüm".
 * Etiketler çağıran tarafından (copy) verilir; bu modül dil bilmez.
 */
export function factParts(item, units = {}) {
  if (!item) return [];
  const { hour = "sa", minute = "dk", season = "sezon", episode = "bölüm" } = units;
  if (item.type === "movie") {
    const label = formatMinutes(item.minutes, { hour, minute });
    return label ? [label] : [];
  }
  const parts = [];
  const seasons = Number(item.seasonCount);
  const episodes = Number(item.episodeCount);
  if (seasons > 0) parts.push(`${seasons} ${season}`);
  if (episodes > 0) parts.push(`${episodes} ${episode}`);
  return parts;
}

/**
 * TMDB ayrıntı cevabından yalnız gösterilecekler. Cevap yoksa/bozuksa boş nesne (sayfa bunsuz da çalışır).
 * `unreleased`: yayın tarihi gelecekte ya da film durumu "Released" değil.
 */
export function releaseInfoOf(details, type, now = Date.now()) {
  if (!details || typeof details !== "object") return {};
  const date = type === "tv" ? details.first_air_date : details.release_date;
  const ts = date ? new Date(date).getTime() : NaN;
  const year = Number.isFinite(ts) ? new Date(ts).getUTCFullYear() : null;
  const rating = Number(details.vote_average) > 0 && Number(details.vote_count) >= 10
    ? Math.round(Number(details.vote_average) * 10) / 10
    : null;
  const overview = typeof details.overview === "string" && details.overview.trim() ? details.overview.trim() : null;
  const futureDate = Number.isFinite(ts) && ts > now;
  const notReleased = type === "movie" && typeof details.status === "string" && details.status !== "Released";
  return { year, rating, overview, unreleased: futureDate || notReleased };
}
