// utils/feedbackValidation.js
//
// Uygulama içi geri bildirimin (hata bildirimi / özellik isteği) SAF doğrulaması
// ve normalizasyonu. Firestore'a hiç dokunmaz; testi bu yüzden mock istemez
// (__tests__/feedbackValidation.test.js).
//
// NEDEN AYRI DOSYA: kural tarafı (firestore.rules → Feedback) alan listesini,
// kategorileri ve uzunlukları sıkı doğrular. İstemci kurala uymayan bir kayıt
// üretirse yazma permission-denied ile düşer ve kullanıcı sebebini anlamadığı
// bir "gönderilemedi" görür. Şekil burada tek yerde tarif edilir; kurala
// kopyalanan listelerin eşitliğini __tests__/feedbackRulesParity.test.js korur.
//
// PLAN KAPISI: hata bildirimi Free dahil açık, özellik isteği yalnız Premium Max
// (utils/premiumFeatures.js → bug_report / feature_request). Plan burada
// DOĞRULANMAZ: istemci planı kendi söyler, asıl kapı kuralda (entitlements).

import { normalizeAppLanguage } from "./appLanguages";

export const FEEDBACK_KINDS = Object.freeze(["bug", "feature"]);

/** Premium kayıt kimliği: ekran, kural ve metin aynı kimlikle konuşur. */
export const FEEDBACK_FEATURE_ID = Object.freeze({
  bug: "bug_report",
  feature: "feature_request",
});

/** Kategori listeleri — UI'daki seçeneklerle aynı sıra; son eleman her zaman "other". */
export const FEEDBACK_CATEGORIES = Object.freeze({
  bug: Object.freeze(["crash", "display", "data", "notifications", "performance", "other"]),
  feature: Object.freeze(["discover", "lists", "social", "ai", "design", "other"]),
});

/** Yalnız hata bildiriminde: sorunun gündelik hayata etkisi. */
export const BUG_SEVERITIES = Object.freeze(["minor", "annoying", "blocking"]);

/**
 * Kaydın yaşam döngüsü. İstemci yalnız "open" yazar; ilerletmek konsoldan yapılır
 * ve kullanıcı durumu "Gönderdiklerim" listesinde görür.
 */
export const FEEDBACK_STATUSES = Object.freeze(["open", "reviewing", "planned", "done", "declined"]);

export const FEEDBACK_LIMITS = Object.freeze({
  titleMin: 3,
  titleMax: 80,
  messageMin: 10,
  messageMax: 1000,
  // appVersion / platform / osVersion / deviceModel / language
  shortMax: 40,
  languageMax: 5,
});

/** Geçmiş listesinde bir kind için en çok kaç kayıt çekilir. */
export const FEEDBACK_HISTORY_LIMIT = 50;

/** Kod noktası sayısı: emoji JS'te 2 birim ama kuralda 1 karakter. */
export const charCount = (text) => Array.from(String(text ?? "")).length;

const clip = (text, max) => Array.from(text).slice(0, max).join("");

/** Baştaki/sondaki boşluğu atar, yinelenen boşlukları ve satır sonlarını tek aralığa indirir. */
const oneLine = (value) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

/** Gövdede satır sonları KALIR (kullanıcı adım adım yazar); yalnız uçlar kırpılır, 3+ boş satır 2'ye iner. */
const body = (value) =>
  typeof value === "string" ? value.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim() : "";

const optionalShort = (value) => {
  const text = oneLine(value == null ? "" : String(value));
  return text ? clip(text, FEEDBACK_LIMITS.shortMax) : null;
};

export function isFeedbackKind(kind) {
  return FEEDBACK_KINDS.includes(kind);
}

/** Bu kind'ın kategorisi geçerli mi? */
export function isFeedbackCategory(kind, category) {
  return Boolean(FEEDBACK_CATEGORIES[kind]?.includes(category));
}

/**
 * Formun gönderilebilir olup olmadığı ve neden olmadığı: ekran düğmeyi açık/kapalı
 * çizmek ve sayaçları renklendirmek için kullanır. `buildFeedback` ile aynı eşikler.
 */
export function checkFeedbackDraft({ title, message } = {}) {
  const titleLength = charCount(oneLine(title));
  const messageLength = charCount(body(message));
  return {
    titleLength,
    messageLength,
    titleOk: titleLength >= FEEDBACK_LIMITS.titleMin,
    messageOk: messageLength >= FEEDBACK_LIMITS.messageMin,
    messageLeft: FEEDBACK_LIMITS.messageMax - messageLength,
    ready:
      titleLength >= FEEDBACK_LIMITS.titleMin && messageLength >= FEEDBACK_LIMITS.messageMin,
  };
}

/**
 * Feedback dokümanının gövdesini üretir (createdAt HARİÇ — onu servis
 * serverTimestamp ile ekler).
 *
 * @param {object} input
 * @param {"bug"|"feature"} input.kind
 * @param {string} input.uid
 * @param {string} input.category        Listede yoksa "other"a düşer
 * @param {string} [input.severity]      Yalnız bug; geçersizse "annoying"
 * @param {string} input.title
 * @param {string} input.message
 * @param {string} [input.language]
 * @param {{appVersion?:string, platform?:string, osVersion?:string, deviceModel?:string}|null} [input.device]
 *   null/boş → cihaz alanları HİÇ yazılmaz (kullanıcı "cihaz bilgisini ekle"yi kapattı).
 * @returns {{ok: true, data: object} | {ok: false, error: string}}
 */
export function buildFeedback(input = {}) {
  const { kind, uid, category, severity, title, message, language, device } = input;

  if (!isFeedbackKind(kind)) return { ok: false, error: "kind" };
  if (typeof uid !== "string" || !uid.trim()) return { ok: false, error: "uid" };

  const cleanTitle = oneLine(title);
  if (charCount(cleanTitle) < FEEDBACK_LIMITS.titleMin) return { ok: false, error: "title" };

  const cleanMessage = body(message);
  if (charCount(cleanMessage) < FEEDBACK_LIMITS.messageMin) return { ok: false, error: "message" };

  // Bilinmeyen kategori reddedilmez "other"a düşer: etiket yüzünden kayıt kaybetmeyelim.
  const safeCategory = isFeedbackCategory(kind, category) ? category : "other";

  const data = {
    uid: uid.trim(),
    kind,
    category: safeCategory,
    title: clip(cleanTitle, FEEDBACK_LIMITS.titleMax),
    message: clip(cleanMessage, FEEDBACK_LIMITS.messageMax),
    status: "open",
    language: clip(normalizeAppLanguage(language), FEEDBACK_LIMITS.languageMax),
  };

  if (kind === "bug") {
    data.severity = BUG_SEVERITIES.includes(severity) ? severity : "annoying";
  }

  if (device && typeof device === "object") {
    for (const field of ["appVersion", "platform", "osVersion", "deviceModel"]) {
      const value = optionalShort(device[field]);
      if (value) data[field] = value;
    }
  }

  return { ok: true, data };
}

const PLATFORM_NAME = Object.freeze({ ios: "iOS", android: "Android" });

/**
 * Kullanıcıya "şunu göndereceğiz" diye gösterilen tek satır:
 * "Seelogd v1.4.9 · iOS 26.0 · iPhone 16". Eksik parça atlanır; hiçbiri yoksa "".
 */
export function formatDeviceLine(device) {
  if (!device || typeof device !== "object") return "";
  const platform = PLATFORM_NAME[device.platform] || oneLine(device.platform);
  const system = [platform, oneLine(device.osVersion)].filter(Boolean).join(" ");
  return [
    oneLine(device.appVersion) ? `Seelogd ${oneLine(device.appVersion)}` : "",
    system,
    oneLine(device.deviceModel),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Okunan dokümanı ekranın kullandığı sade şekle çevirir. Bilinmeyen durum "open"a,
 * eksik alanlar boş dizgeye düşer: konsoldan elle düzenlenen bir kayıt listeyi
 * bozmasın.
 */
export function normalizeFeedbackDoc(id, data = {}) {
  const createdAt = data.createdAt;
  const createdAtMs =
    typeof createdAt?.toMillis === "function"
      ? createdAt.toMillis()
      : Number.isFinite(createdAt?.seconds)
        ? createdAt.seconds * 1000
        : 0;
  return {
    id,
    kind: isFeedbackKind(data.kind) ? data.kind : "bug",
    category: typeof data.category === "string" ? data.category : "other",
    severity: BUG_SEVERITIES.includes(data.severity) ? data.severity : null,
    title: typeof data.title === "string" ? data.title : "",
    message: typeof data.message === "string" ? data.message : "",
    status: FEEDBACK_STATUSES.includes(data.status) ? data.status : "open",
    // Yönetici yanıtı konsoldan `reply` alanına yazılır; yoksa boş.
    reply: typeof data.reply === "string" ? data.reply.trim() : "",
    createdAtMs,
  };
}

/** En yeni üstte; tarihi olmayan (henüz sunucuya yazılmamış) kayıt en üstte kalır. */
export function sortFeedback(items) {
  return [...items].sort((a, b) => {
    const left = a.createdAtMs || Number.MAX_SAFE_INTEGER;
    const right = b.createdAtMs || Number.MAX_SAFE_INTEGER;
    return right - left;
  });
}
