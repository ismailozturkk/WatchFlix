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
