// utils/tierList.js
//
// Tier list (kademeli sıralama) — SAF çekirdek (React / depo / ağ yok; jest doğrudan çalıştırır).
// Belge: docs/ozellikler/TIER_LIST.md.
//
// Kayıt (Keys.tierLists): { lists: [TierList] }
//   TierList { id, title, template, createdAt, updatedAt, tiers: [Tier], pool: [key], media: { key: Media } }
//   Tier     { id, label, color, items: [key] }
//   Media    { id, media_type: "movie"|"tv", title, poster_path?, year? }
//   key      `${media_type}_${id}` — bir yapım tabloda TEK yerde durur (bir kademe ya da havuz).
//
// Her işlem yeni nesne döner (girdi değişmez) ve `updatedAt`'i günceller; geçersiz istek AYNI nesneyi döner
// (çağıran `next === list` ile "bir şey olmadı"yı anlar, gereksiz yazım yapmaz).

export const TIER_LIMITS = Object.freeze({
  lists: 30,
  items: 100,
  tiers: 10,
  minTiers: 2,
  label: 24,
  title: 50,
});

// TierMaker'ın tanıdık pastel paleti (etiket yazısı hep koyu: hepsi açık ton) + iki nötr.
export const TIER_COLORS = Object.freeze([
  "#FF7F7F",
  "#FFBF7F",
  "#FFDF7F",
  "#FFFF7F",
  "#BFFF7F",
  "#7FFF7F",
  "#7FFFFF",
  "#7FBFFF",
  "#7F7FFF",
  "#FF7FFF",
  "#BF7FBF",
  "#CFCFCF",
]);

/** Havuzun hedef kimliği (kademe kimlikleri `t` ile başlar, çakışmaz). */
export const POOL = "pool";

// Şablon → kademe renkleri; etiketler dilden gelir (utils/tierListCopy.js `templates[id].labels`).
const TEMPLATE_COLORS = Object.freeze({
  classic: ["#FF7F7F", "#FFBF7F", "#FFDF7F", "#FFFF7F", "#BFFF7F", "#7FFF7F"],
  vibe: ["#FF7F7F", "#FFBF7F", "#FFFF7F", "#BFFF7F", "#7FFF7F", "#7FBFFF"],
  stars: ["#FFDF7F", "#FFFF7F", "#BFFF7F", "#7FFFFF", "#7FBFFF"],
  rewatch: ["#7FFF7F", "#BFFF7F", "#FFDF7F", "#FF7F7F"],
  blank: ["#FF7F7F", "#FFDF7F", "#7FBFFF"],
});
export const TIER_TEMPLATES = Object.freeze(Object.keys(TEMPLATE_COLORS));
export const DEFAULT_TEMPLATE = "classic";

/** Şablonun kademe sayısı (oluşturma sayfasındaki çizim için). */
export const templateSize = (template) => (TEMPLATE_COLORS[template] || TEMPLATE_COLORS[DEFAULT_TEMPLATE]).length;
export const templateColors = (template) => TEMPLATE_COLORS[template] || TEMPLATE_COLORS[DEFAULT_TEMPLATE];

// ─── Küçük temizleyiciler ────────────────────────────────────────────────────

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const HEX = /^#[0-9A-F]{6}$/i;
const ID = /^[A-Za-z0-9_-]{1,40}$/;
const KEY = /^(movie|tv)_[0-9]{1,10}$/;

const clipText = (value, max) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

export const tierColorOf = (value, fallback = TIER_COLORS[0]) =>
  typeof value === "string" && HEX.test(value) ? value.toUpperCase() : fallback;

/** Etiket zemini üzerinde okunur yazı rengi (palet açık; kullanıcı dışı renk gelirse diye). */
export function tierInkOf(color) {
  const hex = tierColorOf(color);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.36 ? "#1A1A1A" : "#FFFFFF";
}

export const mediaKeyOf = (type, id) => `${type}_${id}`;

/**
 * Herhangi bir yapım kaydı → tablo yapımı. Kabul edilen biçimler: TMDB sonucu (`title|name`, `media_type`),
 * profil listesi öğesi (`type`, `name`, `imagePath`), Top 100 havuz öğesi ve sohbet paylaşım medyası.
 * Kimliksiz / adsız / tür dışı (kişi) kayıt null.
 */
export function tierMediaOf(raw, fallbackType = "movie") {
  if (!isObject(raw)) return null;
  const typeRaw = raw.media_type ?? raw.mediaType ?? raw.type ?? fallbackType;
  const type = typeRaw === "tv" || typeRaw === "series" || typeRaw === "show" ? "tv" : typeRaw === "movie" ? "movie" : null;
  const id = Math.trunc(Number(raw.id));
  const title = clipText(raw.title || raw.name, 90);
  if (!type || !Number.isFinite(id) || id <= 0 || id > 9999999999 || !title) return null;
  const media = { id, media_type: type, title };
  const poster = [raw.poster_path, raw.posterPath, raw.imagePath].find(
    (path) => typeof path === "string" && /^\/[\w.-]+$/.test(path),
  );
  if (poster) media.poster_path = poster;
  const date = String(raw.year || raw.release_date || raw.first_air_date || "");
  if (/^\d{4}/.test(date)) media.year = date.slice(0, 4);
  return media;
}

const addedAtOf = (raw) => {
  const value = raw?.dateAdded ?? raw?.addedAt ?? raw?.watchedAt;
  const ms = typeof value === "number" ? value : value?.seconds ? value.seconds * 1000 : Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
};

/**
 * İçerik ekleme sayfasının kaynak listesi: profil listesi öğeleri → tablo yapımları; tekil, en son eklenen önce.
 * @param {object[][]} groups  [[öğe, …], …] (ör. izlenen filmler + izlenen diziler)
 * @param {string[]}   fallbackTypes  grup başına tür alanı olmayan öğelerin türü
 */
export function pickerItemsOf(groups, fallbackTypes = []) {
  const seen = new Set();
  const out = [];
  groups.forEach((items, index) => {
    (Array.isArray(items) ? items : []).forEach((raw) => {
      const media = tierMediaOf(raw, fallbackTypes[index] || "movie");
      if (!media) return;
      const key = mediaKeyOf(media.media_type, media.id);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ key, media, at: addedAtOf(raw) });
    });
  });
  return out.sort((a, b) => b.at - a.at).map(({ key, media }) => ({ key, media }));
}

// ─── Normalleştirme (depodan okuma) ──────────────────────────────────────────

function normalizeTier(raw, index) {
  if (!isObject(raw)) return null;
  const label = clipText(raw.label, TIER_LIMITS.label);
  return {
    id: typeof raw.id === "string" && ID.test(raw.id) ? raw.id : `t${index}`,
    label: label || String(index + 1),
    color: tierColorOf(raw.color, TIER_COLORS[index % TIER_COLORS.length]),
    items: Array.isArray(raw.items) ? raw.items : [],
  };
}

/**
 * Bozuk / eski / elle değiştirilmiş kaydı geçerli tabloya çevirir. Kurallar: kimlik şart; kademe sayısı 2–10
 * (eksikse tamamlanır); bir yapım tek yerde (ilk görülen kazanır); yapım sözlüğünde olmayan anahtar düşer;
 * sözlükte olup hiçbir yerde olmayan yapım havuza eklenir; toplam en çok 100.
 */
export function normalizeTierList(raw) {
  if (!isObject(raw) || typeof raw.id !== "string" || !ID.test(raw.id)) return null;
  const media = {};
  if (isObject(raw.media)) {
    for (const [key, value] of Object.entries(raw.media)) {
      const item = tierMediaOf(value);
      if (item && KEY.test(key) && mediaKeyOf(item.media_type, item.id) === key) media[key] = item;
    }
  }

  let tiers = (Array.isArray(raw.tiers) ? raw.tiers : [])
    .map(normalizeTier)
    .filter(Boolean)
    .slice(0, TIER_LIMITS.tiers);
  const seenIds = new Set();
  tiers = tiers.map((tier, index) => {
    const id = seenIds.has(tier.id) ? `t${index}x` : tier.id;
    seenIds.add(id);
    return { ...tier, id };
  });
  while (tiers.length < TIER_LIMITS.minTiers) {
    const index = tiers.length;
    tiers.push({ id: `t${index}n`, label: String(index + 1), color: TIER_COLORS[index], items: [] });
  }

  const placed = new Set();
  let budget = TIER_LIMITS.items;
  const take = (keys) =>
    (Array.isArray(keys) ? keys : []).filter((key) => {
      if (typeof key !== "string" || !media[key] || placed.has(key) || budget <= 0) return false;
      placed.add(key);
      budget -= 1;
      return true;
    });
  tiers = tiers.map((tier) => ({ ...tier, items: take(tier.items) }));
  const pool = take(raw.pool);
  for (const key of Object.keys(media)) {
    if (!placed.has(key) && budget > 0) {
      placed.add(key);
      budget -= 1;
      pool.push(key);
    }
  }
  const kept = {};
  for (const key of placed) kept[key] = media[key];

  const createdAt = Number.isFinite(raw.createdAt) ? raw.createdAt : 0;
  return {
    id: raw.id,
    title: clipText(raw.title, TIER_LIMITS.title),
    template: TIER_TEMPLATES.includes(raw.template) ? raw.template : DEFAULT_TEMPLATE,
    createdAt,
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : createdAt,
    tiers,
    pool,
    media: kept,
  };
}

/** Depo kaydı → { lists } (en son düzenlenen önce; yinelenen kimlik bir kez). */
export function normalizeTierState(raw) {
  const seen = new Set();
  const lists = [];
  for (const entry of isObject(raw) && Array.isArray(raw.lists) ? raw.lists : []) {
    const list = normalizeTierList(entry);
    if (!list || seen.has(list.id)) continue;
    seen.add(list.id);
    lists.push(list);
  }
  lists.sort((a, b) => b.updatedAt - a.updatedAt);
  return { lists: lists.slice(0, TIER_LIMITS.lists) };
}

/** Yazılacak biçim; tablo yoksa null (anahtar silinir). */
export const toStoredTierState = (state) => (state?.lists?.length ? { lists: state.lists } : null);

// ─── Tablo düzeyi ────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string}   opts.id
 * @param {string}  [opts.title]
 * @param {string}  [opts.template]
 * @param {string[]} [opts.labels]  Şablon etiketleri (o anki dilde); eksik olan sıra numarası olur.
 * @param {number}   opts.now
 */
export function createTierList({ id, title, template, labels = [], now }) {
  const kind = TIER_TEMPLATES.includes(template) ? template : DEFAULT_TEMPLATE;
  const tiers = templateColors(kind).map((color, index) => ({
    id: `t${index}`,
    label: clipText(labels[index], TIER_LIMITS.label) || String(index + 1),
    color,
    items: [],
  }));
  return { id, title: clipText(title, TIER_LIMITS.title), template: kind, createdAt: now, updatedAt: now, tiers, pool: [], media: {} };
}

export function renameTierList(list, title, now) {
  const next = clipText(title, TIER_LIMITS.title);
  return next === list.title ? list : { ...list, title: next, updatedAt: now };
}

export const tierListItemCount = (list) => Object.keys(list?.media || {}).length;

/** { ranked, pool, total, tiers } — kartlardaki sayılar. */
export function tierListCounts(list) {
  const ranked = (list?.tiers || []).reduce((sum, tier) => sum + tier.items.length, 0);
  const pool = list?.pool?.length || 0;
  return { ranked, pool, total: ranked + pool, tiers: list?.tiers?.length || 0 };
}

/** Yapım nerede? { target: kademeId | POOL, index } ya da null. */
export function locateMedia(list, key) {
  for (const tier of list.tiers) {
    const index = tier.items.indexOf(key);
    if (index >= 0) return { target: tier.id, index };
  }
  const index = list.pool.indexOf(key);
  return index >= 0 ? { target: POOL, index } : null;
}

/**
 * Yapımları HAVUZA ekler (sona). Tabloda zaten olan ve tavanı aşan eklenmez.
 * @returns {{ list, added: number, full: number }}  `full`: tavan yüzünden düşenler
 */
export function addMedia(list, raws, now) {
  const media = { ...list.media };
  const pool = [...list.pool];
  let count = Object.keys(media).length;
  let added = 0;
  let full = 0;
  for (const raw of Array.isArray(raws) ? raws : [raws]) {
    const item = tierMediaOf(raw);
    if (!item) continue;
    const key = mediaKeyOf(item.media_type, item.id);
    if (media[key]) continue;
    if (count >= TIER_LIMITS.items) {
      full += 1;
      continue;
    }
    media[key] = item;
    pool.push(key);
    count += 1;
    added += 1;
  }
  if (!added) return { list, added, full };
  return { list: { ...list, media, pool, updatedAt: now }, added, full };
}

const withoutKey = (list, key) => ({
  tiers: list.tiers.map((tier) => (tier.items.includes(key) ? { ...tier, items: tier.items.filter((k) => k !== key) } : tier)),
  pool: list.pool.includes(key) ? list.pool.filter((k) => k !== key) : list.pool,
});

/**
 * Yapımı bir kademeye ya da havuza taşır. `beforeKey` verilir ve hedefteyse onun ÖNÜNE, yoksa sona.
 * Aynı yere taşıma (sonuç değişmiyorsa) aynı nesneyi döner.
 */
export function placeMedia(list, key, target, beforeKey, now) {
  if (!list.media[key] || key === beforeKey) return list;
  if (target !== POOL && !list.tiers.some((tier) => tier.id === target)) return list;
  const from = locateMedia(list, key);
  const stripped = withoutKey(list, key);
  const insert = (keys) => {
    const at = beforeKey ? keys.indexOf(beforeKey) : -1;
    return at >= 0 ? [...keys.slice(0, at), key, ...keys.slice(at)] : [...keys, key];
  };
  const tiers = target === POOL ? stripped.tiers : stripped.tiers.map((tier) => (tier.id === target ? { ...tier, items: insert(tier.items) } : tier));
  const pool = target === POOL ? insert(stripped.pool) : stripped.pool;
  const next = { ...list, tiers, pool };
  const to = locateMedia(next, key);
  if (from && to && from.target === to.target && from.index === to.index) return list;
  return { ...next, updatedAt: now };
}

/** Kademe / havuz İÇİNDE bir adım öne (-1) ya da arkaya (+1). Uçtaysa değişmez. */
export function shiftMedia(list, key, delta, now) {
  const at = locateMedia(list, key);
  if (!at) return list;
  const keys = at.target === POOL ? list.pool : list.tiers.find((tier) => tier.id === at.target).items;
  const to = at.index + Math.sign(delta);
  if (to < 0 || to >= keys.length) return list;
  const moved = [...keys];
  [moved[at.index], moved[to]] = [moved[to], moved[at.index]];
  if (at.target === POOL) return { ...list, pool: moved, updatedAt: now };
  return { ...list, tiers: list.tiers.map((tier) => (tier.id === at.target ? { ...tier, items: moved } : tier)), updatedAt: now };
}

/** Yapımı tablodan tamamen çıkarır. */
export function removeMedia(list, key, now) {
  if (!list.media[key]) return list;
  const media = { ...list.media };
  delete media[key];
  return { ...list, ...withoutKey(list, key), media, updatedAt: now };
}

// ─── Kademe düzeyi ───────────────────────────────────────────────────────────

/** Etiket ve/veya renk. Boş etiket kabul edilmez (eskisi kalır). */
export function updateTier(list, tierId, { label, color } = {}, now) {
  let changed = false;
  const tiers = list.tiers.map((tier) => {
    if (tier.id !== tierId) return tier;
    const nextLabel = label === undefined ? tier.label : clipText(label, TIER_LIMITS.label) || tier.label;
    const nextColor = color === undefined ? tier.color : tierColorOf(color, tier.color);
    if (nextLabel === tier.label && nextColor === tier.color) return tier;
    changed = true;
    return { ...tier, label: nextLabel, color: nextColor };
  });
  return changed ? { ...list, tiers, updatedAt: now } : list;
}

/** Yeni kademe kimliği: tablodaki kimliklerle çakışmayan en küçük `t<n>`. */
export function nextTierId(list) {
  const used = new Set(list.tiers.map((tier) => tier.id));
  let n = list.tiers.length;
  while (used.has(`t${n}`)) n += 1;
  return `t${n}`;
}

/** `afterId` kademesinin altına (yoksa en alta) boş kademe ekler. Tavan doluysa değişmez. */
export function addTier(list, { afterId, label, color } = {}, now) {
  if (list.tiers.length >= TIER_LIMITS.tiers) return list;
  const used = new Set(list.tiers.map((tier) => tier.color));
  const tier = {
    id: nextTierId(list),
    label: clipText(label, TIER_LIMITS.label) || String(list.tiers.length + 1),
    color: tierColorOf(color, TIER_COLORS.find((c) => !used.has(c)) || TIER_COLORS[TIER_COLORS.length - 1]),
    items: [],
  };
  const at = list.tiers.findIndex((t) => t.id === afterId);
  const tiers = at >= 0 ? [...list.tiers.slice(0, at + 1), tier, ...list.tiers.slice(at + 1)] : [...list.tiers, tier];
  return { ...list, tiers, updatedAt: now };
}

/** Kademeyi siler; içindekiler havuzun BAŞINA döner. En az iki kademe kalır. */
export function removeTier(list, tierId, now) {
  const tier = list.tiers.find((t) => t.id === tierId);
  if (!tier || list.tiers.length <= TIER_LIMITS.minTiers) return list;
  return {
    ...list,
    tiers: list.tiers.filter((t) => t.id !== tierId),
    pool: [...tier.items, ...list.pool],
    updatedAt: now,
  };
}

/** Kademeyi bir adım yukarı (-1) ya da aşağı (+1). */
export function moveTier(list, tierId, delta, now) {
  const at = list.tiers.findIndex((t) => t.id === tierId);
  const to = at + Math.sign(delta);
  if (at < 0 || to < 0 || to >= list.tiers.length) return list;
  const tiers = [...list.tiers];
  [tiers[at], tiers[to]] = [tiers[to], tiers[at]];
  return { ...list, tiers, updatedAt: now };
}

// ─── Koleksiyon düzeyi ───────────────────────────────────────────────────────

/** Tabloyu ekler ya da aynı kimliklisinin yerine koyar (en üste). */
export function upsertTierList(state, list) {
  const rest = state.lists.filter((entry) => entry.id !== list.id);
  return { lists: [list, ...rest] };
}

export function deleteTierList(state, id) {
  const lists = state.lists.filter((entry) => entry.id !== id);
  return lists.length === state.lists.length ? state : { lists };
}

/** Yeni tablo açılabilir mi (30 tavanı)? */
export const canCreateTierList = (state) => (state?.lists?.length || 0) < TIER_LIMITS.lists;

/** Kopya: yeni kimlik, başlığa ek; kademeler ve yerleşim aynen. */
export function duplicateTierList(list, { id, title, now }) {
  return {
    ...list,
    id,
    title: clipText(title ?? list.title, TIER_LIMITS.title),
    createdAt: now,
    updatedAt: now,
    tiers: list.tiers.map((tier) => ({ ...tier, items: [...tier.items] })),
    pool: [...list.pool],
    media: { ...list.media },
  };
}

// ─── Çizim ───────────────────────────────────────────────────────────────────

/** Tablo → TierBoard satırları: [{ id, label, color, items: [{ key, media }] }]. */
export const tierBoardRows = (list) =>
  list.tiers.map((tier) => ({
    id: tier.id,
    label: tier.label,
    color: tier.color,
    items: tier.items.map((key) => ({ key, media: list.media[key] })).filter((entry) => entry.media),
  }));

/** Paylaşım görünümü / sohbet gövdesi → TierBoard satırları (salt okunur). */
export const viewBoardRows = (view) =>
  (view?.tiers || []).map((tier, index) => ({
    id: `v${index}`,
    label: tier.label,
    color: tier.color,
    items: (tier.items || []).map((media) => ({ key: mediaKeyOf(media.media_type, media.id), media })),
  }));

// ─── Paylaşım ────────────────────────────────────────────────────────────────

/**
 * Paylaşılacak görünüm: yalnız YERLEŞTİRİLMİŞ yapımlar (havuz paylaşılmaz), kademe sırasıyla.
 * Gövdenin son temizliği utils/chatShare.js'te (`buildTierListShare`).
 */
export function tierListShareView(list) {
  return {
    title: list.title,
    tiers: list.tiers.map((tier) => ({
      label: tier.label,
      color: tier.color,
      items: tier.items.map((key) => list.media[key]).filter(Boolean),
    })),
  };
}

/** Sohbette gelen tablonun alıcıdaki kopyası: kademeler ve yapımlar aynen, havuz boş. */
export function tierListFromShare(share, { id, now }) {
  const media = {};
  const tiers = (share?.tiers || []).slice(0, TIER_LIMITS.tiers).map((tier, index) => ({
    id: `t${index}`,
    label: tier.label,
    color: tier.color,
    items: (tier.items || [])
      .map((raw) => tierMediaOf(raw))
      .filter(Boolean)
      .map((item) => {
        const key = mediaKeyOf(item.media_type, item.id);
        media[key] = item;
        return key;
      }),
  }));
  return normalizeTierList({ id, title: share?.title, template: DEFAULT_TEMPLATE, createdAt: now, updatedAt: now, tiers, pool: [], media });
}
