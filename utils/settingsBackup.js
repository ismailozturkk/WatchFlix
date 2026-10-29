// utils/settingsBackup.js
//
// "Ayarları dışa/içe aktar"ın SAF çekirdeği (React/Native bağımlılığı yok):
//   • hangi ayarlar yedeğe girer (BACKUP_GROUPS) ve hangileri bilerek girmez
//     (BACKUP_EXCLUDED — her `settings` deposu anahtarı bunlardan BİRİNDE olmak
//     zorunda, bkz. __tests__/settingsBackup.test.js),
//   • yedek dosyası biçimi (buildBackup / parseBackup),
//   • içe aktarma PLANI (planImport): hangi anahtara ne yazılacak, neler atlandı.
// Diske/ağa/ekrana dokunan kısım services/settingsBackupService.js'te.
//
// BİÇİM: { format, version, createdAt, app, settings: { <id>: değer } }.
// `<id>` registry'deki ANAHTAR ADIDIR (fiziksel ad değil). `null` = "kayıt yok":
// içe aktarınca anahtar silinir ve varsayılana dönülür — "kullanıcı hiç seçmedi"
// (ör. dil = cihaz dilini izle) bilgisi böylece korunur.
//
// GÜVENLİK: dosya güvenilmeyen girdidir (paylaşılmış, elle düzenlenmiş olabilir).
// Her değer tip + doğrulayıcı + boyut/derinlik sınırından geçer; bilinmeyen
// kimlikler yok sayılır; özel temalar token token temizlenir.

import { Keys } from "../services/storage/registry";
import { THEME_NAMES, CUSTOM_THEME_TOKENS } from "../theme/colors";
import { normalizeHex } from "./colorUtils";
import { normalizeDecorScopes } from "./decorScopes";
import { normalizeSectionVisibility } from "./sectionVisibility";
import { normalizePresets } from "./discoverFilters";
import { normalizeFontRoles } from "./typographyRoles";
import { EFFECT_MODES } from "./deviceTier";
import { DATA_CACHE_CATEGORIES } from "./dataCacheSettings";
import { isSupportedAppLanguage } from "./appLanguages";

export const BACKUP_FORMAT = "seelogd-settings-backup";
export const BACKUP_VERSION = 1;

/** Okunacak dosya/metin için üst sınır (karakter). Gerçek bir yedek ~10 KB. */
export const MAX_BACKUP_CHARS = 1024 * 1024;
const MAX_VALUE_CHARS = 200 * 1024;
const MAX_STRING = 200;
const MAX_DEPTH = 8;
const MAX_CUSTOM_THEMES = 40;
const MAX_THEME_NAME = 64;

/* ───────────────────────── Kapsam ───────────────────────── */

// Sıra, ekranda gösterilen sıradır. `keys` registry anahtar adlarıdır.
export const BACKUP_GROUPS = Object.freeze([
  {
    id: "appearance",
    icon: "color-palette-outline",
    keys: [
      "theme",
      "customThemes",
      "fontRoles",
      "effectMode",
      "showSnow",
      "showIconBackground",
      "showAmbientBackground",
      "iconBackgroundMode",
      "iconBackgroundOpacity",
      "decorScopes",
      "allCornersRounded",
    ],
  },
  {
    id: "layout",
    icon: "grid-outline",
    keys: [
      "sectionVisibility",
      "discoverPresets",
      "listsGridColumns",
      "listsPosterRadius",
      "listPosterInfo",
      "listGridStyle",
      "seeAllGridColumns",
      "seeAllPosterRadius",
      "railPosterSize",
      "railPosterRadius",
      "postListPosterLayout",
      "reminderPreviewLimit",
      "posterBadges",
      "searchResultsViewMode",
      "notesViewMode",
      "statsCountMode",
    ],
  },
  {
    id: "content",
    icon: "language-outline",
    keys: [
      "language",
      "adultContent",
      "showOngoingTvShows",
      "streamingProviderIds",
      "onboardingGenreKeys",
      "imageQualityLevel",
    ],
  },
  {
    id: "notifications",
    icon: "notifications-outline",
    keys: ["notificationSettings", "haptics"],
  },
  {
    id: "data",
    icon: "cloud-download-outline",
    keys: ["autoDataCache", "dataCacheTypes"],
  },
  {
    id: "widgets",
    icon: "apps-outline",
    keys: ["widgetPreferences"],
  },
  {
    id: "sharing",
    icon: "share-social-outline",
    keys: ["profileStoryCard", "wrappedCard"],
  },
]);

export const BACKUP_ENTRIES = Object.freeze(
  BACKUP_GROUPS.flatMap((group) => group.keys.map((key) => Object.freeze({ id: key, key, group: group.id }))),
);

const ENTRY_BY_ID = new Map(BACKUP_ENTRIES.map((entry) => [entry.id, entry]));
const GROUP_BY_ID = new Map(BACKUP_GROUPS.map((group) => [group.id, group]));

// `settings` deposundaki yedeğe GİRMEYEN anahtarlar + nedeni. Yeni bir ayar
// anahtarı eklenince test, onu BURAYA ya da BACKUP_GROUPS'a eklemeni zorlar.
export const BACKUP_EXCLUDED = Object.freeze({
  premiumLastPlan: "Abonelik durumu hesaptan türetilir; yedekten dönmesi yanıltıcı olur.",
  devPlanOverride: "Yalnız geliştirme build'inde plan simülatörü.",
  selectedAvatar: "Profil görseli hesaba bağlı ve bulutta tutuluyor.",
  hasSeenOnboarding: "Cihaza özel; yedekten dönünce tanıtım yeniden atlanırdı/açılırdı.",
  pendingFourFavorites: "Hesaba ait veri; kayıt sonrası profile aktarılıp silinen geçici kopya.",
  notificationPrimeShown: "İşletim sistemi bildirim iznine bağlı, cihaza özel.",
  recentUsers: "Hızlı giriş çipleri kullanıcı kimlikleri içerir; dosyada dolaşmamalı.",
  usageStats: "Tanılama sayaçları.",
  appIcon: "Gerçek simge işletim sisteminde; yalnızca önbelleği tutuluyor.",
  homeMediaType: "Film/Dizi sekmesinde son bakılan bölüm; gezinme durumu, ayar değil.",
  discoverFilters: "Ne izlesem? ekranında en son kullanılan süzgeç; gezinme durumu (kayıtlı süzgeçler yedeğe girer).",
  upcomingFilters: "Yaklaşan Filmler rafının son süzgeci; tarihe bağlı gezinme durumu (seçilen ay/aralık zamanla geçersizleşir).",
  settingsRestorePoint: "Geri alma noktası kendi kendini yedeklememeli.",
});

/* ───────────────────────── Doğrulama ───────────────────────── */

const isPlain = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** JSON'a güvenle yazılabilir mi (döngü yok, sınırlı derinlik/genişlik, yalnız düz tipler)? */
function jsonSafe(value, depth = 0) {
  if (value === null) return true;
  const t = typeof value;
  if (t === "string") return value.length <= MAX_VALUE_CHARS;
  if (t === "boolean") return true;
  if (t === "number") return Number.isFinite(value);
  if (depth >= MAX_DEPTH) return false;
  if (Array.isArray(value)) {
    return value.length <= 500 && value.every((item) => jsonSafe(item, depth + 1));
  }
  if (isPlain(value)) {
    const keys = Object.keys(value);
    return keys.length <= 200 && keys.every((key) => jsonSafe(value[key], depth + 1));
  }
  return false;
}

const isThemeId = (v) =>
  typeof v === "string" && (THEME_NAMES.includes(v) || /^custom:[A-Za-z0-9_-]{1,64}(:(light|mid|dark))?$/.test(v));

const isPositiveIntList = (v) =>
  Array.isArray(v) && v.length <= 60 && v.every((n) => Number.isInteger(n) && n > 0);

// Kimliğe özel kurallar. check: false → geçersiz. normalize: değeri kanonik biçime çeker.
const RULES = {
  // Desteklenen diller utils/appLanguages.js'ten: yeni dil eklenince yedek de onu kabul eder.
  language: { check: isSupportedAppLanguage },
  theme: { check: isThemeId },
  effectMode: { check: (v) => EFFECT_MODES.includes(v) },
  imageQualityLevel: { check: (v) => ["low", "medium", "good", "high", "original"].includes(v) },
  streamingProviderIds: { check: isPositiveIntList },
  fontRoles: { check: isPlain, normalize: normalizeFontRoles },
  decorScopes: { check: isPlain, normalize: normalizeDecorScopes },
  sectionVisibility: { check: isPlain, normalize: normalizeSectionVisibility },
  discoverPresets: { check: Array.isArray, normalize: normalizePresets },
  dataCacheTypes: {
    check: isPlain,
    normalize: (v) => Object.fromEntries(DATA_CACHE_CATEGORIES.map((id) => [id, v[id] !== false])),
  },
  // Eski kayıtlarda tek boolean ("hepsi aç/kapa") olabiliyor; tüketici normalize eder.
  posterBadges: { check: (v) => typeof v === "boolean" || isPlain(v) },
  notificationSettings: { check: isPlain },
  listPosterInfo: { check: isPlain },
  widgetPreferences: { check: isPlain },
  profileStoryCard: { check: isPlain },
  wrappedCard: { check: isPlain },
};

const TYPE_CHECKS = {
  string: (v) => typeof v === "string" && v.length <= MAX_STRING,
  number: (v) => typeof v === "number" && Number.isFinite(v),
  boolean: (v) => typeof v === "boolean",
  json: (v) => jsonSafe(v),
};

/**
 * Bir ayar değerinin geçerli olmama nedeni; geçerliyse null.
 * `null` değer her zaman geçerlidir (anahtarı sil → varsayılan).
 */
export function valueProblem(entry, value) {
  if (value === null) return null;
  const descriptor = Keys[entry.key];
  if (!descriptor) return "unknown-key";
  const typeOk = TYPE_CHECKS[descriptor.type];
  if (!typeOk || !typeOk(value)) return "wrong-type";
  if (descriptor.type === "json" && JSON.stringify(value).length > MAX_VALUE_CHARS) return "too-large";
  if (descriptor.validate && !descriptor.validate(value)) return "invalid";
  const rule = RULES[entry.id];
  if (rule?.check && !rule.check(value)) return "invalid";
  return null;
}

/**
 * Tek bir ayarı yedeğin kurallarıyla doğrular ve kanonik biçime çeker. Sohbette
 * paylaşılan ayarlar da (utils/settingsShare.js) AYNI kapıdan geçer.
 * @returns {{ok: true, value: any} | {ok: false, reason: string}}
 */
export function sanitizeBackupValue(id, value) {
  const entry = ENTRY_BY_ID.get(id);
  if (!entry) return { ok: false, reason: "unknown" };
  const problem = valueProblem(entry, value);
  if (problem) return { ok: false, reason: problem };
  const rule = RULES[id];
  return { ok: true, value: value !== null && rule?.normalize ? rule.normalize(value) : value };
}

/* ───────────────────────── Özel temalar ───────────────────────── */

const TOKEN_KEYS = CUSTOM_THEME_TOKENS.map((token) => token.key);

function sanitizeTokenValue(key, value) {
  const hex = normalizeHex(value);
  if (hex) return hex;
  // Bağıl token: { from, l, s, h } — başka bir token'ın açık/koyu/doygun hali.
  if (isPlain(value) && typeof value.from === "string" && value.from !== key && TOKEN_KEYS.includes(value.from)) {
    const out = { from: value.from };
    for (const channel of ["l", "s", "h"]) {
      const n = value[channel];
      if (Number.isFinite(n)) out[channel] = Math.max(-360, Math.min(360, Math.round(n)));
    }
    return out;
  }
  return null;
}

function sanitizeTokens(rawTokens) {
  if (!isPlain(rawTokens)) return null;
  const tokens = {};
  for (const key of TOKEN_KEYS) {
    if (!(key in rawTokens)) continue;
    const value = sanitizeTokenValue(key, rawTokens[key]);
    if (value !== null) tokens[key] = value;
  }
  return Object.keys(tokens).length ? tokens : null;
}

function sanitizeTheme(raw) {
  if (!isPlain(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const tokens = sanitizeTokens(raw.tokens);
  if (!tokens) return null;
  const name = typeof raw.name === "string" ? raw.name.trim().slice(0, MAX_THEME_NAME) : "";
  const out = { id, name, tokens };
  // Üç tonlu temalar: açık/orta/koyu setleri ve "ana renk" tohumu korunur.
  // Geçersiz bir ton atılır (o ton, orta tondan yeniden türetilir).
  if (isPlain(raw.tones)) {
    const tones = {};
    for (const tone of ["light", "mid", "dark"]) {
      const clean = sanitizeTokens(raw.tones[tone]);
      if (clean) tones[tone] = clean;
    }
    if (Object.keys(tones).length) out.tones = tones;
  }
  const base = normalizeHex(raw.base);
  if (base) out.base = base;
  return out;
}

/**
 * Özel tema listesini temizler: geçersiz/yinelenen/aşırı sayıdakiler atılır.
 * @returns {{themes: object[], dropped: number}}
 */
export function sanitizeCustomThemes(list) {
  const themes = [];
  let dropped = 0;
  if (!Array.isArray(list)) return { themes, dropped };
  const seen = new Set();
  for (const raw of list) {
    const theme = sanitizeTheme(raw);
    if (!theme || seen.has(theme.id) || themes.length >= MAX_CUSTOM_THEMES) {
      dropped += 1;
      continue;
    }
    seen.add(theme.id);
    themes.push(theme);
  }
  return { themes, dropped };
}

/** Mevcut + gelen temaları birleştirir: gelen, aynı kimlikliyi EZER; mevcut diğerleri korunur. */
function mergeThemes(current, incoming) {
  const byId = new Map(current.map((theme) => [theme.id, theme]));
  let added = 0;
  let updated = 0;
  let dropped = 0;
  for (const theme of incoming) {
    if (byId.has(theme.id)) {
      byId.set(theme.id, theme);
      updated += 1;
    } else if (byId.size >= MAX_CUSTOM_THEMES) {
      dropped += 1;
    } else {
      byId.set(theme.id, theme);
      added += 1;
    }
  }
  return { themes: [...byId.values()], added, updated, dropped };
}

/* ───────────────────────── Dışa aktarma ───────────────────────── */

/**
 * Yedek nesnesini kurar.
 *
 * @param {(key: string) => any} read  registry anahtar adı → mevcut değer; kayıt
 *   YOKSA `null`/`undefined` (servis bunu `has()` ile ayırır)
 * @param {{now?: Date, appVersion?: string, platform?: string}} [meta]
 */
export function buildBackup(read, meta = {}) {
  const settings = {};
  for (const entry of BACKUP_ENTRIES) {
    let value = read(entry.key);
    if (value === undefined) value = null;
    if (entry.id === "customThemes" && value !== null) value = sanitizeCustomThemes(value).themes;
    settings[entry.id] = value;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: (meta.now || new Date()).toISOString(),
    app: { version: meta.appVersion || null, platform: meta.platform || null },
    settings,
  };
}

export const serializeBackup = (backup) => JSON.stringify(backup, null, 2);

const pad = (n) => String(n).padStart(2, "0");

/** seelogd-ayarlar-2026-10-15.json (yerel tarih) */
export function backupFileName(date = new Date()) {
  return `seelogd-ayarlar-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`;
}

/* ───────────────────────── İçe aktarma ───────────────────────── */

/**
 * Dosya/pano metnini ayrıştırır ve zarfı doğrular (değerlere planImport bakar).
 * @returns {{ok: true, backup: object} | {ok: false, error: "empty"|"too-large"|"not-json"|"not-backup"|"too-new"}}
 */
export function parseBackup(text) {
  if (typeof text !== "string" || !text.trim()) return { ok: false, error: "empty" };
  if (text.length > MAX_BACKUP_CHARS) return { ok: false, error: "too-large" };
  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^﻿/, "").trim());
  } catch {
    return { ok: false, error: "not-json" };
  }
  if (
    !isPlain(parsed) ||
    parsed.format !== BACKUP_FORMAT ||
    !Number.isInteger(parsed.version) ||
    parsed.version < 1 ||
    !isPlain(parsed.settings)
  ) {
    return { ok: false, error: "not-backup" };
  }
  if (parsed.version > BACKUP_VERSION) return { ok: false, error: "too-new", version: parsed.version };
  return { ok: true, backup: parsed };
}

/**
 * İçe aktarma planı: DISKE HİÇBİR ŞEY YAZMAZ, ne yazılacağını söyler.
 *
 * @param {object} backup parseBackup'tan geçmiş yedek
 * @param {object} [options]
 * @param {object[]} [options.currentThemes] cihazdaki mevcut özel temalar
 * @param {"merge"|"replace"} [options.themeMode] merge (varsayılan): mevcut temalar
 *   korunur, gelenler eklenir/aynı kimlikliyi ezer. replace: liste yedektekiyle birebir
 *   (geri alma noktasında gerekli).
 * @returns {{
 *   writes: {id: string, key: string, value: any}[],
 *   skipped: {id: string, reason: string}[],
 *   themes: {incoming: number, added: number, updated: number, kept: number, dropped: number, names: string[]},
 *   groups: {id: string, applied: number, total: number}[],
 *   warnings: string[],
 *   meta: {createdAt: string|null, appVersion: string|null, platform: string|null},
 * }}
 */
export function planImport(backup, options = {}) {
  const { currentThemes = [], themeMode = "merge" } = options;
  const source = isPlain(backup?.settings) ? backup.settings : {};
  const writes = [];
  const skipped = [];
  const warnings = [];
  const themes = { incoming: 0, added: 0, updated: 0, kept: 0, dropped: 0, names: [] };

  // Bilinmeyen kimlikler (daha yeni sürümden gelen ayarlar) bilgi olarak raporlanır.
  for (const id of Object.keys(source)) {
    if (!ENTRY_BY_ID.has(id)) skipped.push({ id, reason: "unknown" });
  }

  const currentSafe = sanitizeCustomThemes(currentThemes).themes;
  let finalThemes = currentSafe;

  for (const entry of BACKUP_ENTRIES) {
    if (!(entry.id in source)) continue;
    let value = source[entry.id];

    if (entry.id === "customThemes") {
      if (value === null) {
        // Yedek "özel tema yok" diyor: birleştirmede mevcutlar korunur, değiştirmede silinir.
        if (themeMode === "replace") {
          finalThemes = [];
          writes.push({ id: entry.id, key: entry.key, value: null });
        }
        continue;
      }
      if (!Array.isArray(value)) {
        skipped.push({ id: entry.id, reason: "wrong-type" });
        continue;
      }
      const clean = sanitizeCustomThemes(value);
      themes.incoming = clean.themes.length;
      themes.dropped += clean.dropped;
      themes.names = clean.themes.map((theme) => theme.name).filter(Boolean).slice(0, 6);
      if (themeMode === "replace") {
        finalThemes = clean.themes;
        themes.added = clean.themes.length;
      } else {
        const merged = mergeThemes(currentSafe, clean.themes);
        finalThemes = merged.themes;
        themes.added = merged.added;
        themes.updated = merged.updated;
        themes.dropped += merged.dropped;
        themes.kept = currentSafe.filter((t) => !clean.themes.some((n) => n.id === t.id)).length;
      }
      writes.push({ id: entry.id, key: entry.key, value: finalThemes });
      continue;
    }

    const problem = valueProblem(entry, value);
    if (problem) {
      skipped.push({ id: entry.id, reason: problem });
      continue;
    }
    const rule = RULES[entry.id];
    if (value !== null && rule?.normalize) value = rule.normalize(value);
    writes.push({ id: entry.id, key: entry.key, value });
  }

  // Seçili tema, var olmayan bir özel temayı gösteriyorsa varsayılana dön (yoksa
  // ThemeContext boş referansla açılışta yanlış temaya düşer).
  const themeWrite = writes.find((w) => w.id === "theme");
  if (themeWrite && typeof themeWrite.value === "string" && themeWrite.value.startsWith("custom:")) {
    const wanted = themeWrite.value.slice("custom:".length);
    if (!finalThemes.some((theme) => theme.id === wanted)) {
      themeWrite.value = null;
      warnings.push("theme-missing");
    }
  }

  if (skipped.some((s) => s.reason !== "unknown")) warnings.push("some-invalid");
  if (themes.dropped > 0) warnings.push("themes-dropped");

  const groups = BACKUP_GROUPS.map((group) => ({
    id: group.id,
    applied: writes.filter((w) => GROUP_BY_ID.get(group.id).keys.includes(w.id)).length,
    total: group.keys.length,
  }));

  return {
    writes,
    skipped,
    themes,
    groups,
    warnings,
    meta: {
      createdAt: typeof backup?.createdAt === "string" ? backup.createdAt : null,
      appVersion: typeof backup?.app?.version === "string" ? backup.app.version : null,
      platform: typeof backup?.app?.platform === "string" ? backup.app.platform : null,
    },
  };
}

/**
 * Dışa aktarma ekranı için içerik özeti: grup başına "kayıtlı ayar sayısı" + tema sayısı.
 * (`null` değerler "kayıt yok" olduğundan sayılmaz.)
 */
export function summarizeBackupContents(backup) {
  const settings = isPlain(backup?.settings) ? backup.settings : {};
  const groups = BACKUP_GROUPS.map((group) => ({
    id: group.id,
    icon: group.icon,
    saved: group.keys.filter((key) => settings[key] !== null && settings[key] !== undefined).length,
    total: group.keys.length,
  }));
  const themeCount = Array.isArray(settings.customThemes) ? settings.customThemes.length : 0;
  return { groups, themeCount };
}
