// utils/activityFilter.js
//
// "Etkinliklerim" (screens/tabs/profile/MyActivityScreen.js) sekme başına ARAMA + SÜZGEÇ + SIRALAMA kararları.
// SAF: RN / i18n importu yok (__tests__/activityFilter.test.js). Metinler utils/activityFilterCopy.js'te; sayfa
// kabuğu liste ekranlarıyla ortak (components/lists/ListSortFilterSheet.js).
//
// Her sekmenin KENDİ süzgeçleri var (yalnız o veride anlamlı olanlar):
//   ratings       tür (film/dizi) · puan kademesi (10 … 6, "5 ve altı") · tarih   | sırala: tarih, puan, ad
//   comments      tür (film/dizi/post/liste…; yalnız VAR olanlar) · tarih          | sırala: tarih, ad
//   posts         post türü (VAR olanlar) · tarih                                 | sırala: tarih, beğeni, yorum, ad
//   drafts        post türü · tarih                                              | sırala: tarih, ad
//   story         tarih                                                          | sırala: tarih, ad
//   interactions  beğeni/kayıt · post türü · tarih                               | sırala: tarih, ad
// Arama her sekmede başlık + metin alanlarında (Türkçe büyük/küçük harf ve aksan duyarsız).

export const ALL = "all";
export const DEFAULT_SORT = Object.freeze({ key: "date", dir: "desc" });

/** Tarih aralıkları: gün sayısı (older = 365 günden eski). */
export const DATE_RANGES = Object.freeze(["week", "month", "year", "older"]);
const RANGE_DAYS = { week: 7, month: 30, year: 365 };
const DAY = 86400000;

/** Puan kademeleri (tam puan; "5-" = 5 ve altı). */
export const SCORE_BUCKETS = Object.freeze(["10", "9", "8", "7", "6", "5-"]);

/** Post türlerinin sabit sırası (seçenekler bu sırayla, yalnız veride olanlar). */
export const POST_TYPE_ORDER = Object.freeze(["review", "list", "text", "poll", "tierlist", "tvgraph"]);
/** Yorum hedef türlerinin sabit sırası. */
export const COMMENT_KIND_ORDER = Object.freeze(["movie", "tv", "post", "list", "story"]);

/** Sekme → hangi süzgeçler, hangi sıralamalar. */
export const ACTIVITY_TAB_CONFIG = Object.freeze({
  ratings: { filters: ["kind", "score", "date"], sorts: ["date", "score", "name"] },
  comments: { filters: ["kind", "date"], sorts: ["date", "name"] },
  posts: { filters: ["postType", "date"], sorts: ["date", "likes", "comments", "name"] },
  drafts: { filters: ["postType", "date"], sorts: ["date", "name"] },
  story: { filters: ["date"], sorts: ["date", "name"] },
  interactions: { filters: ["action", "postType", "date"], sorts: ["date", "name"] },
});

export const emptyActivityFilter = () => ({
  query: "",
  sort: { ...DEFAULT_SORT },
  kind: ALL,
  score: ALL,
  date: ALL,
  postType: ALL,
  action: ALL,
});

const toMs = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v.seconds === "number") return v.seconds * 1000;
  if (v instanceof Date) return v.getTime();
  return 0;
};

/** Sekmeye göre kaydın okunacak alanları. */
export function activityFieldsOf(tab, item) {
  const it = item || {};
  switch (tab) {
    case "ratings":
      return { kind: it.mediaType, score: Number(it.rating || 0), date: toMs(it.updatedAt), name: it.title, text: [it.title] };
    case "comments":
      return { kind: it.kind, date: toMs(it.createdAt), name: it.title, text: [it.title, it.text] };
    case "posts":
      return {
        postType: it.type,
        date: toMs(it._createdAtMs ?? it.createdAt),
        name: it.title,
        likes: Number(it.likesCount || 0),
        comments: Number(it.commentsCount || 0),
        text: [it.title, it.content, it.tierList?.title, it.tvGraph?.title, it.poll?.question],
      };
    case "drafts":
      return { postType: it.postType, date: toMs(it.createdAt), name: it.title, text: [it.title, it.content, it.tierList?.title] };
    case "story":
      return { date: toMs(it.updatedAt || it.createdAt), name: it.name || it.title, text: [it.name, it.title] };
    case "interactions":
      return {
        action: it._kind,
        postType: it.postType,
        date: toMs(it._ts),
        name: it.postTitle,
        text: [it.postTitle, it.postAuthorName],
      };
    default:
      return { date: 0, name: "", text: [] };
  }
}

/** Arama için sadeleştirme: Türkçe küçük harf, aksansız, ı→i. */
export function normalizeSearch(value) {
  return String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i")
    .trim();
}

export function matchesScoreBucket(score, bucket) {
  if (!bucket || bucket === ALL) return true;
  const step = Math.min(10, Math.max(0, Math.floor(Number(score) || 0)));
  if (bucket === "5-") return step <= 5;
  return step === Number(bucket);
}

export function matchesDateRange(ms, range, now = Date.now()) {
  if (!range || range === ALL) return true;
  if (!ms) return false;
  const age = now - ms;
  if (range === "older") return age > RANGE_DAYS.year * DAY;
  const days = RANGE_DAYS[range];
  return days ? age <= days * DAY : true;
}

/** Bu sekmede etkin süzgeç sayısı (arama hariç; sıralama varsayılandan farklıysa +1). */
export function countActiveActivityFilters(tab, state) {
  const cfg = ACTIVITY_TAB_CONFIG[tab];
  if (!cfg || !state) return 0;
  const filters = cfg.filters.filter((key) => state[key] && state[key] !== ALL).length;
  const sortChanged = state.sort && (state.sort.key !== DEFAULT_SORT.key || state.sort.dir !== DEFAULT_SORT.dir);
  return filters + (sortChanged ? 1 : 0);
}

/** Veride gerçekten bulunan değerler, sabit sırayla (boş süzgeç seçeneği gösterilmesin). */
export function presentValues(tab, items, field, order) {
  const seen = new Set();
  for (const item of items || []) {
    const value = activityFieldsOf(tab, item)[field];
    if (value) seen.add(value);
  }
  const known = order.filter((value) => seen.has(value));
  const unknown = [...seen].filter((value) => !order.includes(value)).sort();
  return [...known, ...unknown];
}

/**
 * Süz + sırala. Yeni dizi döner (girdi değişmez).
 * @param {string} tab
 * @param {Array} items
 * @param {ReturnType<typeof emptyActivityFilter>} state
 * @param {{ now?: number }} [opts]
 */
export function applyActivityFilter(tab, items, state, { now = Date.now() } = {}) {
  const cfg = ACTIVITY_TAB_CONFIG[tab];
  const list = Array.isArray(items) ? items : [];
  if (!cfg || !state) return list.slice();
  const active = new Set(cfg.filters);
  const query = normalizeSearch(state.query);

  const rows = [];
  list.forEach((item, index) => {
    const f = activityFieldsOf(tab, item);
    if (active.has("kind") && state.kind !== ALL && f.kind !== state.kind) return;
    if (active.has("postType") && state.postType !== ALL && (f.postType || "review") !== state.postType) return;
    if (active.has("action") && state.action !== ALL && f.action !== state.action) return;
    if (active.has("score") && !matchesScoreBucket(f.score, state.score)) return;
    if (active.has("date") && !matchesDateRange(f.date, state.date, now)) return;
    if (query && !f.text.some((part) => normalizeSearch(part).includes(query))) return;
    rows.push({ item, f, index });
  });

  const sort = cfg.sorts.includes(state.sort?.key) ? state.sort : DEFAULT_SORT;
  const sign = sort.dir === "asc" ? 1 : -1;
  const byDate = (a, b) => (a.f.date - b.f.date) * sign;
  const compare = {
    date: byDate,
    score: (a, b) => (a.f.score - b.f.score) * sign || b.f.date - a.f.date,
    likes: (a, b) => (a.f.likes - b.f.likes) * sign || b.f.date - a.f.date,
    comments: (a, b) => (a.f.comments - b.f.comments) * sign || b.f.date - a.f.date,
    name: (a, b) =>
      String(a.f.name || "").localeCompare(String(b.f.name || ""), "tr", { sensitivity: "base" }) * sign ||
      b.f.date - a.f.date,
  }[sort.key];
  // Eşitlikte özgün sıra korunur (kararlı sıralama).
  rows.sort((a, b) => compare(a, b) || a.index - b.index);
  return rows.map((row) => row.item);
}
