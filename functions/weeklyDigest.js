"use strict";

// functions/weeklyDigest.js
//
// SAF (bağımsız) yardımcılar — "Bu hafta çıkacaklar" haftalık özet bildiriminin mantığı. Firebase'den bağımsız
// → node:test ile test edilir (weeklyDigest.test.js). `weeklyReleaseDigest` zamanlanmış fonksiyonu kullanır.
//
// KAPSAM: kullanıcının İZLEME LİSTESİNDEKİ yapımlardan, önümüzdeki 7 günde (bugün dahil) çıkacak olanlar:
//   • film          → release_date pencerede
//   • dizi (yeni bölüm) → next_episode_to_air.air_date pencerede
//   • dizi (prömiyer)   → first_air_date pencerede (yeni bölüm yoksa)
// Takip edilen oyuncu / yönetmenler BU ÖZETE GİRMEZ: o liste yalnız cihazda (MMKV) tutuluyor, sunucu bilmiyor.
// Hatırlatıcılar da girmez: kendi yerel bildirimlerini zaten üretiyorlar.
//
// TARİH: pencere Europe/Istanbul takvim gününe göre kurulur (zamanlama 10:00 TR) — UTC kayması "bugün"ü bir
// gün öne/arkaya almasın. TMDB tarihleri saatsiz "YYYY-MM-DD" olduğundan gün karşılaştırması metin üzerinden yapılır.

const WINDOW_DAYS = 7;
const DEFAULT_TIME_ZONE = "Europe/Istanbul";
const MAX_NAMES = 3;

const DIGEST_STRINGS = {
  tr: { title: (n) => `Bu hafta çıkacaklar (${n})`, more: (n) => `+${n}`, locale: "tr-TR" },
  en: { title: (n) => `Coming up this week (${n})`, more: (n) => `+${n}`, locale: "en-US" },
  es: { title: (n) => `Esta semana llega (${n})`, more: (n) => `+${n}`, locale: "es-ES" },
  pt: { title: (n) => `Estreias da semana (${n})`, more: (n) => `+${n}`, locale: "pt-BR" },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;
const dateOnly = (value) => (typeof value === "string" && DATE_RE.test(value) ? value.slice(0, 10) : null);

/** `now` anının verilen saat dilimindeki takvim günü: "YYYY-MM-DD". */
function dayInZone(now, timeZone = DEFAULT_TIME_ZONE) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** "YYYY-MM-DD" + gün → "YYYY-MM-DD" (UTC aritmetiği; saat dilimi etkisiz). */
function addDays(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** Bugün + önümüzdeki `WINDOW_DAYS - 1` gün (toplam 7 gün). */
function weekWindow(now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const from = dayInZone(now, timeZone);
  return { from, to: addDays(from, WINDOW_DAYS - 1) };
}

const inWindow = (date, window) => date !== null && date >= window.from && date <= window.to;

/**
 * Bir TMDB DETAY gövdesi pencerede çıkıyor mu?
 * @returns {{ date: string, kind: "movie"|"episode"|"premiere", season?: number, episode?: number } | null}
 */
function releaseInWindow(type, details, window) {
  if (!details || typeof details !== "object") return null;
  if (type === "movie") {
    const date = dateOnly(details.release_date);
    return inWindow(date, window) ? { date, kind: "movie" } : null;
  }
  const next = details.next_episode_to_air;
  const nextDate = dateOnly(next?.air_date);
  if (inWindow(nextDate, window)) {
    return { date: nextDate, kind: "episode", season: next.season_number, episode: next.episode_number };
  }
  const premiere = dateOnly(details.first_air_date);
  return inWindow(premiere, window) ? { date: premiere, kind: "premiere" } : null;
}

/** Aynı yapım tek kez; tarih sonra ad sırası. `entries`: [{ key, title, type, release }] */
function pickDigestItems(entries) {
  const byKey = new Map();
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || !entry.title || !entry.release?.date) continue;
    if (!byKey.has(entry.key)) byKey.set(entry.key, entry);
  }
  return [...byKey.values()].sort(
    (a, b) => a.release.date.localeCompare(b.release.date) || a.title.localeCompare(b.title),
  );
}

/** Kısa gün adı: "Paz", "Sun", "dom". Tarih-yalnız olduğu için UTC öğlen kullanılır (kayma yok). */
function weekdayLabel(dateKey, lang) {
  const strings = DIGEST_STRINGS[lang] || DIGEST_STRINGS.en;
  return new Intl.DateTimeFormat(strings.locale, { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${dateKey}T12:00:00Z`),
  );
}

/**
 * Bildirim metni. Öğe yoksa null (bildirim gönderilmez).
 * Gövde: "Paz: Film A · Çar: Dizi B +2" — ilk MAX_NAMES yapım, kalan sayı.
 */
function buildDigestMessage(lang, items) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) return null;
  const strings = DIGEST_STRINGS[lang] || DIGEST_STRINGS.en;
  const shown = list.slice(0, MAX_NAMES).map((item) => `${weekdayLabel(item.release.date, lang)}: ${item.title}`);
  const rest = list.length - shown.length;
  return {
    title: strings.title(list.length),
    body: shown.join(" · ") + (rest > 0 ? ` ${strings.more(rest)}` : ""),
  };
}

module.exports = {
  DIGEST_STRINGS,
  MAX_NAMES,
  WINDOW_DAYS,
  addDays,
  buildDigestMessage,
  dayInZone,
  pickDigestItems,
  releaseInWindow,
  weekWindow,
  weekdayLabel,
};
