// utils/postComposer.js
//
// Paylaşım oluşturmanın SAF (React/Firebase'siz) çekirdeği — doğrulama, anket
// nesnesi kurma, dizi yeniden sıralama ve oy sayımı. CreatePostModal bunları
// kullanır; jest ile test edilir (__tests__/postComposer.test.js).

export const POST_TYPES = ["review", "list", "text", "poll"];
export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 4;

/**
 * Bir paylaşımın gönderilmeye hazır olup olmadığını doğrular.
 * @returns {{ ok: boolean, error: string|null }}  error = i18n anahtarı sonu
 */
export function validatePost({
  type,
  title,
  content,
  selectedMedia = [],
  pollOptions = [],
}) {
  const t = (title || "").trim();
  const c = (content || "").trim();

  if (!POST_TYPES.includes(type)) return { ok: false, error: "type" };
  if (!t) return { ok: false, error: "title" };

  if (type === "review") {
    if (selectedMedia.length === 0) return { ok: false, error: "reviewMedia" };
    if (!c) return { ok: false, error: "content" };
  } else if (type === "list") {
    if (selectedMedia.length < 2) return { ok: false, error: "listMedia" };
    if (!c) return { ok: false, error: "content" };
  } else if (type === "text") {
    if (!c) return { ok: false, error: "content" };
  } else if (type === "poll") {
    const valid = pollOptions.filter(
      (o) => (o?.label || "").trim() || o?.media,
    );
    if (valid.length < MIN_POLL_OPTIONS) return { ok: false, error: "pollOptions" };
  }

  return { ok: true, error: null };
}

/**
 * Bir diziyi from→to indeksine taşıyıp YENİ dizi döner (mutasyonsuz).
 * Sıralı liste (drag/ok tuşları) ve anket seçeneği taşıma için.
 */
export function reorderArray(arr, from, to) {
  if (
    !Array.isArray(arr) ||
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= arr.length ||
    to >= arr.length
  ) {
    return arr;
  }
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Composer seçeneklerinden Firestore'a uygun anket nesnesi kurar.
 * options: [{ id?, label?, media?: { id, type, poster_path } }]
 */
export function buildPollObject({ pollType, question, options = [] }) {
  return {
    type: pollType === "media" ? "media" : "text",
    question: (question || "").trim(),
    options: options
      .filter((o) => (o?.label || "").trim() || o?.media)
      .map((o, i) => {
        const opt = { id: o.id || `opt_${i}`, label: (o.label || "").trim() };
        if (o.media) {
          opt.media = {
            id: o.media.id ?? null,
            type: o.media.type || o.media.media_type || "movie",
            poster_path: o.media.poster_path || null,
          };
        }
        return opt;
      }),
    votes: {},
  };
}

// Post tipi → rozet dili (feed'deki PostCard ile ortak: list=yeşil,
// poll=mor, text/review=mavi). Modül SAF kaldığı için i18n burada
// uygulanmaz; çağıran taraf i18nText(labelKey, fallback) ile çevirir.
const POST_TYPE_BADGES = {
  review: { labelKey: "autoI18n.inceleme_upper", fallback: "İNCELEME", colorKey: "blue",   colorFallback: "#4a7cf6" },
  list:   { labelKey: "autoI18n.liste_upper",    fallback: "LİSTE",    colorKey: "green",  colorFallback: "#3ddc84" },
  text:   { labelKey: "autoI18n.sohbet_upper",   fallback: "SOHBET",   colorKey: "blue",   colorFallback: "#4a7cf6" },
  poll:   { labelKey: "autoI18n.anket_upper",    fallback: "ANKET",    colorKey: "purple", colorFallback: "#a855f7" },
};

/**
 * @param {string} type        POST_TYPES üyesi (bilinmeyen tip → review)
 * @param {Object} themeColors theme.colors (yoksa sabit fallback renkleri)
 * @returns {{ labelKey: string, fallback: string, color: string }}
 */
export function postTypeBadge(type, themeColors) {
  const meta = POST_TYPE_BADGES[type] || POST_TYPE_BADGES.review;
  return {
    labelKey: meta.labelKey,
    fallback: meta.fallback,
    color: themeColors?.[meta.colorKey] || meta.colorFallback,
  };
}

/**
 * Oy haritasından ({ [uid]: optionId }) seçenek başına sayı + toplam.
 * PollMessage'daki sayımla birebir (feed + chat tutarlı).
 */
export function tallyVotes(votes = {}) {
  const counts = {};
  let total = 0;
  Object.values(votes || {}).forEach((optId) => {
    if (optId == null) return;
    counts[optId] = (counts[optId] || 0) + 1;
    total += 1;
  });
  return { counts, total };
}

/**
 * Alan, eklenecek metni ZATEN içeriyor mu? (büyük/küçük harf duyarsız)
 * Yalnız ilk 60 karakter aranır: sınıra sığmayıp "…" ile kırpılarak eklenmiş
 * uzun bir özet de "eklenmiş" sayılsın, ikinci dokunuş onu ikilemesin.
 */
export function isQuickTextPresent(current, addition) {
  const base = typeof current === "string" ? current.trim().toLowerCase() : "";
  const extra = typeof addition === "string" ? addition.trim() : "";
  if (!base || !extra) return false;
  return base.includes(extra.slice(0, 60).toLowerCase());
}

/**
 * "Hızlı ekle": başlığa film adı / açıklamaya özet eklerken kullanıcının
 * yazdığını ASLA ezmez (bkz. handleImportList'teki aynı kural).
 *   • eklenecek metin boş            → değişmez            (reason: "empty")
 *   • alan boş                       → ek metin yazılır    (gerekirse kırpılır)
 *   • alan ek metni zaten içeriyor   → değişmez            (reason: "duplicate";
 *     çift dokunuş metni ikilemesin)
 *   • sonuna `separator` ile eklenir; sınıra sığmazsa ek metin "…" ile
 *     kırpılır, kırpılacak yer 12 karakterden azsa hiç dokunulmaz
 *     (reason: "full").
 * @returns {{ text: string, changed: boolean, reason: "empty"|"duplicate"|"full"|null }}
 */
export function appendQuickText(current, addition, { max = Infinity, separator = "\n\n" } = {}) {
  const base = typeof current === "string" ? current : "";
  const extra = typeof addition === "string" ? addition.trim() : "";
  if (!extra) return { text: base, changed: false, reason: "empty" };

  if (!base.trim()) {
    const text = extra.length > max ? `${extra.slice(0, Math.max(0, max - 1)).trimEnd()}…` : extra;
    return { text, changed: true, reason: null };
  }
  if (isQuickTextPresent(base, extra)) {
    return { text: base, changed: false, reason: "duplicate" };
  }

  const head = `${base.trimEnd()}${separator}`;
  const room = max - head.length;
  if (extra.length <= room) return { text: head + extra, changed: true, reason: null };
  if (room < 12) return { text: base, changed: false, reason: "full" };
  return { text: `${head}${extra.slice(0, room - 1).trimEnd()}…`, changed: true, reason: null };
}

/**
 * Kullanıcı "kapat" dediğinde (çarpı / yukarıdan çekme / donanım geri) ne
 * olacağını söyler. Karar saf tutulur: kapatma akışı iOS'ta iki native pencerenin
 * üst üste binmesiyle bozulmuştu, o yüzden hangi yolun seçildiği ayrı ve
 * test edilebilir olmalı.
 *
 *   • "leave-prompt"  → onay sayfası açık: geri/çarpı onu KAPATIR, pencereye dokunmaz
 *   • "close-search"  → içerik araması açık: önce aramadan çık
 *   • "close"         → kaybedilecek bir şey yok (ya da taslak zaten kayıtlı): kapat
 *   • "confirm-edit"  → var olan gönderi düzenleniyor ve değişiklik var: "iptal et?"
 *   • "confirm-draft" → yeni paylaşım, kaydedilmemiş içerik var: "taslağa kaydet?"
 *
 * @returns {"leave-prompt"|"close-search"|"close"|"confirm-edit"|"confirm-draft"}
 */
export function resolveCloseIntent({
  promptOpen = false,
  searchActive = false,
  hasContent = false,
  isEditing = false,
  isSavedDraft = false,
} = {}) {
  if (promptOpen) return "leave-prompt";
  if (searchActive) return "close-search";
  if (!hasContent) return "close";
  if (isEditing) return "confirm-edit";
  if (isSavedDraft) return "close";
  return "confirm-draft";
}
