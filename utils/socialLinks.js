// utils/socialLinks.js
//
// Profildeki SOSYAL HESAP bağlantılarının saf kararları (RN/Firebase yok; jest
// ile doğrudan test edilir).
//
// SAKLAMA: Users/{uid}.socialLinks = { instagram: "kullanici", x: "kullanici", … }
// Yalnız KULLANICI ADI saklanır, adres değil. Adresi her zaman burada, platformun
// sabit alan adından kurarız: profile rastgele bir URL (oltalama, kötü amaçlı
// site) yazılamaz — en kötü ihtimalle yanlış bir hesap açılır. Kullanıcı adres
// yapıştırırsa `parseSocialHandle` içinden kullanıcı adını çıkarırız.
//
// Kural tarafı: firestore.rules → socialLinksOk (aynı platform anahtarları ve
// uzunluk sınırı). Yeni platform = burası + kural + SOCIAL_COPY.

/**
 * Sıra = ekranlardaki sıra. `icon`: FontAwesome6 (brands) adı. `color`: marka rengi;
 * koyu/siyah olanlar (X, TikTok, Threads) temanın yazı rengine düşer (`brandColor`).
 * `pattern`: platformun kullanıcı adı biçimi. `host`: yapıştırılan adresi tanımak
 * için kabul edilen alan adları.
 */
export const SOCIAL_PLATFORMS = Object.freeze([
  {
    key: "instagram",
    icon: "instagram",
    color: "#E4405F",
    pattern: /^[A-Za-z0-9._]{1,30}$/,
    host: ["instagram.com"],
    url: (h) => `https://www.instagram.com/${h}`,
  },
  {
    key: "x",
    icon: "x-twitter",
    color: null,
    pattern: /^[A-Za-z0-9_]{1,15}$/,
    host: ["x.com", "twitter.com"],
    url: (h) => `https://x.com/${h}`,
  },
  {
    key: "tiktok",
    icon: "tiktok",
    color: null,
    pattern: /^[A-Za-z0-9._]{2,24}$/,
    host: ["tiktok.com"],
    url: (h) => `https://www.tiktok.com/@${h}`,
  },
  {
    key: "youtube",
    icon: "youtube",
    color: "#FF0000",
    pattern: /^[A-Za-z0-9._-]{3,30}$/,
    host: ["youtube.com", "youtu.be"],
    url: (h) => `https://www.youtube.com/@${h}`,
  },
  {
    key: "twitch",
    icon: "twitch",
    color: "#9146FF",
    pattern: /^[A-Za-z0-9_]{4,25}$/,
    host: ["twitch.tv"],
    url: (h) => `https://www.twitch.tv/${h}`,
  },
  {
    key: "letterboxd",
    icon: "letterboxd",
    color: "#00B020",
    pattern: /^[A-Za-z0-9_]{2,15}$/,
    host: ["letterboxd.com", "boxd.it"],
    url: (h) => `https://letterboxd.com/${h}/`,
  },
  {
    key: "snapchat",
    icon: "snapchat",
    color: "#FFC400",
    pattern: /^[A-Za-z0-9._-]{3,15}$/,
    host: ["snapchat.com"],
    url: (h) => `https://www.snapchat.com/add/${h}`,
  },
  {
    key: "threads",
    icon: "threads",
    color: null,
    pattern: /^[A-Za-z0-9._]{1,30}$/,
    host: ["threads.net", "threads.com"],
    url: (h) => `https://www.threads.com/@${h}`,
  },
]);

export const SOCIAL_KEYS = Object.freeze(SOCIAL_PLATFORMS.map((p) => p.key));

/** Kural ve alan uzunluğu için üst sınır (en uzun kullanıcı adı 30). */
export const SOCIAL_HANDLE_MAX = 30;

const BY_KEY = Object.freeze(Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p.key, p])));

export const getSocialPlatform = (key) => BY_KEY[key] || null;

// Yolun ilk anlamlı parçası: "/@ad", "/ad/", "/add/ad", "/user/ad", "/channel/…".
const PATH_NOISE = new Set(["add", "u", "user", "users"]);
// Hesap DEĞİL içerik adresleri (video, gönderi, kanal kimliği): kullanıcı adı çıkmaz.
const PATH_RESERVED = new Set([
  "channel", "c", "watch", "playlist", "shorts", "p", "reel", "reels", "explore",
  "video", "videos", "status", "i", "intent", "share", "hashtag", "film", "search",
]);

function handleFromUrl(raw, platform) {
  let text = raw.trim();
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    // "instagram.com/ad" gibi şemasız yapıştırma.
    if (!/^(www\.|m\.)?[a-z0-9-]+(\.[a-z0-9-]+)+\//i.test(text)) return null;
    text = `https://${text}`;
  }
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const hostName = url.hostname.toLowerCase().replace(/^(www|m|mobile)\./, "");
  const known = platform.host.some((h) => hostName === h || hostName.endsWith(`.${h}`));
  if (!known) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  while (parts.length > 1 && PATH_NOISE.has(parts[0].toLowerCase())) parts.shift();
  if (!parts[0] || PATH_RESERVED.has(parts[0].toLowerCase())) return null;
  return parts[0];
}

/**
 * Kullanıcının yazdığı / yapıştırdığı metinden kullanıcı adını çıkarır.
 * Kabul edilenler: "ad", "@ad", platformun kendi adresi ("instagram.com/ad",
 * "https://x.com/ad?s=20"). Başka bir sitenin adresi ya da biçime uymayan değer
 * için `null`; boş metin için "" (alan temizlendi).
 */
export function parseSocialHandle(key, input) {
  const platform = BY_KEY[key];
  if (!platform || typeof input !== "string") return null;
  const raw = input.trim();
  if (!raw) return "";
  const fromUrl = /[/.]/.test(raw) && /^(https?:\/\/|www\.|[^@\s]+\.[a-z]{2,}\/)/i.test(raw);
  let handle = fromUrl ? handleFromUrl(raw, platform) : raw;
  if (handle === null || handle === undefined) return null;
  handle = String(handle).replace(/^@+/, "");
  // Çoğu platform kullanıcı adının sonundaki noktayı/ayırıcıyı yutar; yapıştırma
  // artığı olan sondaki "/" ve boşluk zaten elendi.
  return platform.pattern.test(handle) ? handle : null;
}

/** Alana yazarken: boşluk ve bariz çöpü at, uzunluğu sınırla (URL yapıştırmayı BOZMA). */
export function formatSocialInput(input) {
  return String(input ?? "").replace(/\s/g, "").slice(0, 120);
}

/**
 * Profil belgesinden okunan değeri temiz `{ key: handle }` haritasına çevirir:
 * bilinmeyen anahtarlar, geçersiz biçimler ve boşlar atılır. Başkasının yazdığı
 * veri olduğu için (arkadaş profili) HER okumada geçer.
 */
export function normalizeSocialLinks(value) {
  const out = {};
  if (!value || typeof value !== "object") return out;
  for (const platform of SOCIAL_PLATFORMS) {
    const raw = value[platform.key];
    if (typeof raw !== "string") continue;
    const handle = raw.trim().replace(/^@+/, "");
    if (handle && platform.pattern.test(handle)) out[platform.key] = handle;
  }
  return out;
}

export const readProfileSocialLinks = (profile) => normalizeSocialLinks(profile?.socialLinks);

export const hasAnySocialLinks = (links) => Object.keys(links || {}).length > 0;

/** Firestore'a yazılacak yük: yalnız dolu girişler, sabit platform sırasıyla. */
export const toSocialPayload = (links) => normalizeSocialLinks(links);

export function socialLinksEqual(a, b) {
  const x = normalizeSocialLinks(a);
  const y = normalizeSocialLinks(b);
  return SOCIAL_KEYS.every((key) => (x[key] || "") === (y[key] || ""));
}

/** Platformun profil adresi; geçersiz kullanıcı adı için `null`. */
export function socialUrl(key, handle) {
  const platform = BY_KEY[key];
  if (!platform || typeof handle !== "string") return null;
  const clean = handle.trim().replace(/^@+/, "");
  return platform.pattern.test(clean) ? platform.url(clean) : null;
}

/** Görüntüleme için `@ad`. */
export const socialDisplayHandle = (handle) => `@${String(handle || "").replace(/^@+/, "")}`;

/**
 * Taslaktaki ham alan değerlerinden (`{ key: "yazılan" }`) kaydedilecek harita ve
 * hatalı alanlar: `{ links, invalid: [key…] }`. Boş alan = bağlantı yok.
 */
export function resolveSocialDraft(draft) {
  const links = {};
  const invalid = [];
  for (const key of SOCIAL_KEYS) {
    const raw = draft?.[key];
    if (typeof raw !== "string" || !raw.trim()) continue;
    const handle = parseSocialHandle(key, raw);
    if (handle) links[key] = handle;
    else invalid.push(key);
  }
  return { links, invalid };
}

/** Marka rengi; koyu markalar (X/TikTok/Threads) tema yazı rengini kullanır. */
export const brandColor = (platform, fallback) => platform?.color || fallback;

// ── Şerit yerleşimi ───────────────────────────────────────────────────────────
// Profildeki sosyal hesap düğmeleri HER ZAMAN tek satırda durur. Sekiz platformla 40 pt'lik
// düğmeler 376 pt ister; 360 pt'lik ekranda (kenar boşluğu düşünce ~328) sığmaz. Önce
// boşluk daralır, sonra düğme küçülür; ekran genişliyse varsayılan boy (40) korunur.
export const SOCIAL_CHIP_MAX = 40;
export const SOCIAL_CHIP_MIN = 24;
const GAP_WIDE = 8;
const GAP_TIGHT = 4;
// Bu boyun altına inmeden önce boşluk daralır (parmakla basılabilir kalsın).
const COMFORT_SIZE = 34;

/**
 * @param {number} width  Şeridin ölçülen genişliği (px)
 * @param {number} count  Çizilecek düğme sayısı
 * @returns {{size: number, gap: number, icon: number}} tek satıra sığan en büyük boy
 */
export function socialChipLayout(width, count) {
  const n = Math.max(1, Math.floor(Number(count) || 0));
  const w = Number(width);
  if (!Number.isFinite(w) || w <= 0) {
    return { size: COMFORT_SIZE, gap: GAP_TIGHT, icon: Math.round(COMFORT_SIZE * 0.46) };
  }
  const fit = (gap) => Math.floor((w - gap * (n - 1)) / n);
  let gap = GAP_WIDE;
  let size = fit(gap);
  if (size < COMFORT_SIZE) {
    gap = GAP_TIGHT;
    size = fit(gap);
  }
  size = Math.max(SOCIAL_CHIP_MIN, Math.min(SOCIAL_CHIP_MAX, size));
  return { size, gap, icon: Math.round(size * 0.46) };
}
