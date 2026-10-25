// utils/settingsShare.js
//
// "Görünümümü paylaş" — kişiselleştirme ayarlarının sohbete gönderilip alıcıda
// SEÇİLEREK uygulanmasının SAF çekirdeği (React/Native/Firebase yok, jest ile test
// edilir). Mesaj şeması utils/chatShare.js'te (`kind: "settingsShare"`), balon
// components/chat/SharedSettingsMessage.js, uygulama hooks/useSettingsShareApplier.js.
//
// GÖVDE: { v, type: "settings", owner?, sections: { <bölüm>: { <registry anahtarı>: değer } } }
//   theme bölümü ayrıca `custom` taşır: seçili tema özel temaysa onun token seti
//   (alıcıda o tema yoksa uygulanamazdı).
//
// GÜVENLİK: gövde güvenilmeyen girdidir (sohbet belgesi elle yazılabilir). Her değer
// ayar yedeğinin kapısından geçer (utils/settingsBackup.sanitizeBackupValue: tip +
// registry doğrulayıcısı + kimliğe özel kural); özel tema token token temizlenir.
// Bilinmeyen bölüm/anahtar atlanır — daha yeni sürümden gelen paylaşım bozulmaz.
//
// KAPSAM: yalnız GÖRÜNÜM. Dil, yetişkin içerik, platformlar, bildirimler, veri ve
// widget tercihleri kişiye/cihaza özeldir; paylaşılmaz (bekçi: settingsShare.test.js).
//
// PREMIUM: kapı ÇİZİMDE (bkz. context/AppSettingsContext.js) — ama alıcıya "uygulandı"
// deyip varsayılanı çizmek yanıltıcı olur. Bu yüzden kilitli bölüm sayfada Premium
// rozetiyle gösterilir ve seçilemez (`sectionLock`).

import { sanitizeBackupValue, sanitizeCustomThemes } from "./settingsBackup";
import {
  FAMILY_THEME_KEYS,
  THEME_NAMES,
  buildCustomThemeFromEntry,
  getThemeColors,
  parseCustomSelection,
} from "../theme/colors";
import { DEFAULT_FONT_ROLES, TEXT_ROLES, normalizeFontRoles } from "./typographyRoles";
import { canUseFontPreset, getFeatureLimit } from "./premiumFeatures";

export const SETTINGS_SHARE_VERSION = 1;
export const SETTINGS_SHARE_TYPE = "settings";
const MAX_OWNER = 40;

// Sıra = balonda ve sayfada gösterilen sıra. `keys` registry anahtar adlarıdır ve
// HEPSİ ayar yedeğinin kapsamındadır (aynı doğrulayıcı).
export const SETTINGS_SHARE_SECTIONS = Object.freeze([
  { id: "theme", icon: "color-palette", keys: Object.freeze(["theme"]) },
  { id: "fonts", icon: "text", keys: Object.freeze(["fontRoles"]) },
  {
    id: "effects",
    icon: "sparkles",
    keys: Object.freeze([
      "showSnow",
      "showAmbientBackground",
      "showIconBackground",
      "iconBackgroundMode",
      "iconBackgroundOpacity",
      "decorScopes",
    ]),
  },
  {
    id: "posters",
    icon: "images",
    keys: Object.freeze([
      "allCornersRounded",
      "listsPosterRadius",
      "seeAllPosterRadius",
      "railPosterRadius",
      "railPosterSize",
      "postListPosterLayout",
    ]),
  },
  {
    id: "lists",
    icon: "grid",
    keys: Object.freeze(["listsGridColumns", "seeAllGridColumns", "listGridStyle", "listPosterInfo", "posterBadges"]),
  },
  { id: "home", icon: "layers", keys: Object.freeze(["sectionVisibility"]) },
]);

export const SETTINGS_SHARE_SECTION_IDS = Object.freeze(SETTINGS_SHARE_SECTIONS.map((section) => section.id));
export const SETTINGS_SHARE_KEYS = Object.freeze(SETTINGS_SHARE_SECTIONS.flatMap((section) => section.keys));
const SECTION_BY_ID = new Map(SETTINGS_SHARE_SECTIONS.map((section) => [section.id, section]));

const isPlain = (value) => !!value && typeof value === "object" && !Array.isArray(value);

const clipName = (value) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_OWNER) : "");

/** Seçili tema özel temaysa kimliği; değilse null. */
const customIdOf = (selection) => parseCustomSelection(selection)?.id || null;

/** Özel tema girdisini temizler; kimlik beklenenle uyuşmazsa null. */
function cleanCustomTheme(raw, expectedId) {
  const theme = sanitizeCustomThemes([raw]).themes[0];
  return theme && theme.id === expectedId ? theme : null;
}

/** Bir bölümün ham değerlerini temizler; uygulanacak hiçbir şey kalmazsa null. */
function sanitizeSection(id, raw) {
  const section = SECTION_BY_ID.get(id);
  if (!section || !isPlain(raw)) return null;
  const values = {};
  for (const key of section.keys) {
    if (!(key in raw)) continue;
    const clean = sanitizeBackupValue(key, raw[key]);
    if (clean.ok) values[key] = clean.value;
  }
  if (!Object.keys(values).length) return null;
  if (id !== "theme") return values;

  // Tema: değer boş olamaz (paylaşılan şey tam olarak budur); özel temanın token
  // seti yoksa alıcıda uygulanamaz → bölüm atılır.
  if (typeof values.theme !== "string") return null;
  const customId = customIdOf(values.theme);
  if (!customId) return { theme: values.theme };
  const custom = cleanCustomTheme(raw.custom, customId);
  return custom ? { theme: values.theme, custom } : null;
}

/**
 * Bilinmeyen/bozuk gövde → null; geçerliyse temizlenmiş kopya (en az bir bölüm).
 * Bölümler kanonik sırayla yazılır.
 */
export function sanitizeSettingsShare(raw) {
  if (!isPlain(raw) || raw.type !== SETTINGS_SHARE_TYPE || !isPlain(raw.sections)) return null;
  const sections = {};
  for (const id of SETTINGS_SHARE_SECTION_IDS) {
    const clean = sanitizeSection(id, raw.sections[id]);
    if (clean) sections[id] = clean;
  }
  if (!Object.keys(sections).length) return null;
  const share = { v: SETTINGS_SHARE_VERSION, type: SETTINGS_SHARE_TYPE, sections };
  const owner = clipName(raw.owner);
  if (owner) share.owner = owner;
  return share;
}

/**
 * Cihazdaki ayarlardan paylaşım gövdesi kurar.
 *
 * @param {object} options
 * @param {(key: string) => any} options.read  registry anahtar adı → ETKİN değer (kayıt
 *   yoksa varsayılan; varsayılanı null olan anahtarlar için null = "varsayılan")
 * @param {object[]} [options.customThemes] cihazdaki özel temalar
 * @param {string[]} [options.sections] dahil edilecek bölümler (varsayılan: hepsi)
 * @param {string} [options.owner] gönderenin görünen adı
 * @returns {object|null}
 */
export function buildSettingsShare({ read, customThemes = [], sections = SETTINGS_SHARE_SECTION_IDS, owner } = {}) {
  if (typeof read !== "function") return null;
  const wanted = new Set(Array.isArray(sections) ? sections : []);
  const raw = {};
  for (const section of SETTINGS_SHARE_SECTIONS) {
    if (!wanted.has(section.id)) continue;
    const values = {};
    for (const key of section.keys) {
      const value = read(key);
      values[key] = value === undefined ? null : value;
    }
    if (section.id === "theme") {
      const customId = customIdOf(values.theme);
      if (customId) values.custom = (Array.isArray(customThemes) ? customThemes : []).find((t) => t?.id === customId);
    }
    raw[section.id] = values;
  }
  return sanitizeSettingsShare({ type: SETTINGS_SHARE_TYPE, sections: raw, owner });
}

/** Gövdedeki bölümler, kanonik sırayla. */
export function settingsShareSectionIds(share) {
  if (!isPlain(share?.sections)) return [];
  return SETTINGS_SHARE_SECTION_IDS.filter((id) => isPlain(share.sections[id]));
}

/**
 * Paylaşılan tema: seçim anahtarı, özel temaysa girdisi ve tonu; yerleşikse kimliği.
 * @returns {{selection: string, builtin: string|null, entry: object|null, tone: string}|null}
 */
export function sharedThemeOf(share) {
  const section = share?.sections?.theme;
  if (!section || typeof section.theme !== "string") return null;
  const custom = parseCustomSelection(section.theme);
  return {
    selection: section.theme,
    builtin: custom ? null : section.theme,
    entry: custom ? section.custom || null : null,
    tone: custom?.tone || "mid",
  };
}

/**
 * Paylaşılan temanın TAM renk nesnesi (balon/sayfa önizlemesi için); tema bölümü
 * yoksa null. Alıcıda bilinmeyen yerleşik tema kimliği (daha yeni sürüm) null döner.
 */
export function sharedThemeColors(share) {
  const shared = sharedThemeOf(share);
  if (!shared) return null;
  if (shared.entry) return buildCustomThemeFromEntry(shared.entry, shared.tone);
  return THEME_NAMES.includes(shared.builtin) ? getThemeColors(shared.builtin) : null;
}

/** Etkin yazı tipi rolleri ({heading, body, numeric}); bölüm yoksa null. */
export function sharedFontRolesOf(share) {
  const section = share?.sections?.fonts;
  if (!section) return null;
  return normalizeFontRoles(section.fontRoles ?? DEFAULT_FONT_ROLES);
}

/**
 * Bölüm bu planda uygulanabilir mi? Kilitliyse yükseltme sayfasının özellik kimliği,
 * değilse null.
 */
export function sectionLock(share, sectionId, plan) {
  const values = share?.sections?.[sectionId];
  if (!values) return null;
  if (sectionId === "theme") {
    // Aile tonları herkese açık; Gece Moru gibi eski hazır temalar ve özel temalar
    // Tema Stüdyosu'nda (Premium).
    const selection = values.theme;
    if (FAMILY_THEME_KEYS.includes(selection)) return null;
    return getFeatureLimit("custom_themes", plan) ? null : "custom_themes";
  }
  if (sectionId === "fonts") {
    const roles = sharedFontRolesOf(share);
    return TEXT_ROLES.every((role) => canUseFontPreset(roles[role], plan)) ? null : "font_catalog";
  }
  if (sectionId === "effects") {
    // Yalnız AÇIK gelen efekt kapıya takılır: "kar kapalı" Free'de de uygulanır.
    if (values.showSnow === true && !getFeatureLimit("snow_effect", plan)) return "snow_effect";
    if (values.showAmbientBackground === true && !getFeatureLimit("ambient_background", plan)) {
      return "ambient_background";
    }
    if (values.showIconBackground === true && !getFeatureLimit("icon_background", plan)) return "icon_background";
  }
  return null;
}

/** Anahtar sırasından bağımsız JSON (aynı ayar = aynı metin). */
function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isPlain(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value === undefined ? null : value);
}

const themeLook = (entry) => stableStringify({ tokens: entry?.tokens, tones: entry?.tones || null, base: entry?.base || null });

/**
 * Bölüm cihazdakiyle zaten aynı mı? (Sayfa bu bölümü baştan seçmez, "Zaten aynı" der.)
 * Karşılaştırma iki tarafı da aynı temizleyiciden geçirerek yapılır.
 */
export function sectionMatchesCurrent(share, sectionId, { read, customThemes = [] } = {}) {
  const incoming = share?.sections?.[sectionId];
  if (!incoming || typeof read !== "function") return false;
  const current = buildSettingsShare({ read, customThemes, sections: [sectionId] })?.sections?.[sectionId];
  if (!current) return false;
  if (sectionId === "theme") {
    if (current.theme !== incoming.theme) return false;
    if (!incoming.custom) return true;
    // Aynı kimlikli tema cihazda var ama renkleri farklıysa (gönderen sonradan
    // değiştirdi) uygulanacak bir şey var demektir.
    return !!current.custom && themeLook(current.custom) === themeLook(incoming.custom);
  }
  return stableStringify(current) === stableStringify(incoming);
}

/**
 * Seçilen bölümlerin uygulanacak değerleri. Kilitli ve gövdede olmayan bölümler
 * atlanır ve raporlanır. DİSKE YAZMAZ (uygulayıcı: hooks/useSettingsShareApplier.js).
 *
 * @returns {{sections: Record<string, object>, locked: {id: string, feature: string}[], missing: string[]}}
 */
export function planSettingsApply(share, sectionIds, { plan } = {}) {
  const sections = {};
  const locked = [];
  const missing = [];
  for (const id of SETTINGS_SHARE_SECTION_IDS) {
    if (!sectionIds?.includes(id)) continue;
    const values = share?.sections?.[id];
    if (!values) {
      missing.push(id);
      continue;
    }
    const feature = sectionLock(share, id, plan);
    if (feature) {
      locked.push({ id, feature });
      continue;
    }
    sections[id] = values;
  }
  return { sections, locked, missing };
}

/** Sohbet önizlemesi için bölüm sayısı ve ilk bölümler (gönderen dilinde metne çevrilir). */
export function settingsSharePreviewParts(share, max = 2) {
  const ids = settingsShareSectionIds(share);
  return { ids: ids.slice(0, max), rest: Math.max(0, ids.length - max), total: ids.length };
}
