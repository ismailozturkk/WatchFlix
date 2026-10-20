// utils/followedPeople.js
//
// "Oyuncu / yönetmen takibi" — SAF çekirdek. Burada RN/Firebase importu YOK (jest yalnız saf
// modülleri test edebiliyor).
//
// SAKLAMA: { "<tmdbPersonId>": { id, name, photo, department, at } } — cihaz-yerel (MMKV, registry:
// followedPeople). Dizi değil NESNE: aynı kişiyi iki kez eklemek yapısal olarak imkânsız ve
// silme/aranma O(1). `at` takip zamanı (ms), "yeni eklenen üstte" sırası için.
//
// "YAKLAŞAN" NE DEMEK: TMDB `combined_credits` içinde yayın tarihi BUGÜN ya da sonrası olan
// yapım. Tarihi hiç olmayan kayıt yaklaşan SAYILMAZ — TMDB'de "duyuruldu ama tarihsiz" bir sürü
// kayıt var ve onları rafa koymak "ne zaman?" sorusunu cevapsız bırakır.
//
// HANGİ KREDİLER: oyuncu (cast) her zaman; yönetmen (crew, job "Director") her zaman — bir
// kişi hem oynayıp hem yönetebilir ve "X'in yeni işi" ikisini de kapsar. Dizide "Creator" da
// sayılır (TMDB dizi kadrosunda yönetmen yerine yaratıcı öne çıkar). Kendisi olarak çıktığı
// söyleşi / haber / gerçeklik yapımları elenir (fourFavorites.js ile aynı kural).

export const MAX_FOLLOWED = 60;

const NON_SCRIPTED_GENRES = new Set([10763, 10764, 10767]); // haber, gerçeklik, talk-show
const SELF_CREDIT = /\b(self|himself|herself|themselves|kendisi)\b/i;
const DIRECTOR_JOBS = Object.freeze({ movie: ["Director"], tv: ["Director", "Creator"] });

const isPositiveInt = (value) => Number.isInteger(value) && value > 0;
const asText = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

/** Depodan okunan ham değeri güvenli sözlüğe çevirir; bozuk kayıtlar atılır, üst sınır uygulanır. */
export function normalizeFollowed(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const entries = [];
  for (const [key, value] of Object.entries(raw)) {
    const id = Number(value?.id ?? key);
    const name = asText(value?.name, 120);
    if (!isPositiveInt(id) || !name) continue;
    entries.push({
      id,
      name,
      photo: asText(value?.photo, 120) || null,
      department: asText(value?.department, 40) || null,
      at: Number.isFinite(Number(value?.at)) ? Number(value.at) : 0,
    });
  }
  entries.sort((a, b) => b.at - a.at);
  return Object.fromEntries(entries.slice(0, MAX_FOLLOWED).map((entry) => [String(entry.id), entry]));
}

/** Takip edilenler, en yeni takip üstte. */
export const followedList = (followed) =>
  Object.values(normalizeFollowed(followed)).sort((a, b) => b.at - a.at || a.name.localeCompare(b.name));

export const isFollowed = (followed, id) => Boolean(followed && followed[String(id)]);

/** TMDB kişi nesnesinden saklanacak kayıt. Geçersizse null. */
export function toFollowRecord(person, now = Date.now()) {
  const id = Number(person?.id);
  const name = asText(person?.name, 120);
  if (!isPositiveInt(id) || !name) return null;
  return {
    id,
    name,
    photo: asText(person.profile_path ?? person.photo, 120) || null,
    department: asText(person.known_for_department ?? person.department, 40) || null,
    at: now,
  };
}

/**
 * Kişiyi takibe alır. Yeni nesne döner (girdi değişmez).
 * @returns {{ followed: object, status: "added"|"exists"|"limit"|"invalid" }}
 */
export function followPerson(followed, person, now = Date.now()) {
  const current = normalizeFollowed(followed);
  const record = toFollowRecord(person, now);
  if (!record) return { followed: current, status: "invalid" };
  if (current[String(record.id)]) return { followed: current, status: "exists" };
  if (Object.keys(current).length >= MAX_FOLLOWED) return { followed: current, status: "limit" };
  return { followed: { ...current, [String(record.id)]: record }, status: "added" };
}

export function unfollowPerson(followed, id) {
  const current = normalizeFollowed(followed);
  if (!current[String(id)]) return current;
  const { [String(id)]: _removed, ...rest } = current;
  return rest;
}

/** Depoya yazılacak değer: kimse kalmadıysa null (anahtar silinir, boş nesne dolaşmaz). */
export const toStoredFollowed = (followed) => {
  const normalized = normalizeFollowed(followed);
  return Object.keys(normalized).length === 0 ? null : normalized;
};

/** Yerel takvim günü "YYYY-MM-DD" (UTC değil: akşam saatinde bir gün kayması olmasın). */
export function localDateKey(now = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const dateOf = (item, type) => {
  const raw = type === "tv" ? item.first_air_date : item.release_date;
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : null;
};

/**
 * Bir kişinin `combined_credits` cevabından, verilen türdeki YAKLAŞAN yapımlar.
 * Bir kredi birden çok kez gelebilir (hem oyuncu hem yönetmen); `id` ile tekilleşir ve
 * `roles` her ikisini toplar. Posteri olmayan kayıt elenir (rafta boş kutu görünmesin).
 *
 * @returns {Array<object>} TMDB nesnesi + `_date` ("YYYY-MM-DD") + `_roles` ("cast"|"director")
 */
export function upcomingFromCredits(credits, mediaType, now = new Date()) {
  const type = mediaType === "tv" ? "tv" : "movie";
  const today = localDateKey(now);
  const byId = new Map();

  const take = (item, role) => {
    if (!item || item.media_type !== type || item.adult === true) return;
    if (!isPositiveInt(Number(item.id)) || !item.poster_path) return;
    const date = dateOf(item, type);
    if (!date || date < today) return;
    if ((item.genre_ids || []).some((id) => NON_SCRIPTED_GENRES.has(id))) return;
    if (role === "cast" && SELF_CREDIT.test(String(item.character || ""))) return;
    const found = byId.get(item.id);
    if (found) {
      if (!found._roles.includes(role)) found._roles.push(role);
      return;
    }
    byId.set(item.id, { ...item, _date: date, _roles: [role] });
  };

  for (const item of Array.isArray(credits?.cast) ? credits.cast : []) take(item, "cast");
  const jobs = DIRECTOR_JOBS[type];
  for (const item of Array.isArray(credits?.crew) ? credits.crew : []) {
    if (jobs.includes(item?.job)) take(item, "director");
  }
  return [...byId.values()];
}

/**
 * Kişi başına bulunan yaklaşanları TEK listede birleştirir: aynı yapım birden çok takip
 * edilen kişiden çıkarsa tek kart olur ve `_people` hepsini taşır. Sıra: yayın tarihi (yakın
 * önce), eşitlikte daha çok kişiyle ilgili olan.
 *
 * @param {Array<{ person: {id:number, name:string}, items: Array }>} groups
 * @param {object} [options]
 * @param {Iterable<number|string>} [options.exclude] elenecek TMDB id'leri (izlenmişler…)
 * @param {number} [options.limit]
 */
export function mergeUpcoming(groups, { exclude = [], limit = 40 } = {}) {
  const blocked = new Set([...exclude].map(String));
  const byId = new Map();
  for (const { person, items } of Array.isArray(groups) ? groups : []) {
    if (!person) continue;
    for (const item of Array.isArray(items) ? items : []) {
      if (!item || blocked.has(String(item.id))) continue;
      const found = byId.get(item.id);
      if (!found) {
        byId.set(item.id, { ...item, _people: [person.name], _personIds: [person.id] });
      } else if (!found._personIds.includes(person.id)) {
        found._people.push(person.name);
        found._personIds.push(person.id);
      }
    }
  }
  return [...byId.values()]
    .sort((a, b) => a._date.localeCompare(b._date) || b._people.length - a._people.length)
    .slice(0, Math.max(0, limit));
}

/**
 * Kişi adlarını tek satıra sığacak biçimde özetler: "A, B +3". `more` bir fonksiyon
 * (sayı → "+3" / "ve 3 kişi daha").
 */
export function describePeople(names, { limit = 2, more = (n) => `+${n}` } = {}) {
  const list = (Array.isArray(names) ? names : []).filter(Boolean);
  if (list.length <= limit) return list.join(", ");
  return `${list.slice(0, limit).join(", ")} ${more(list.length - limit)}`;
}

/**
 * Yaklaşan yapım → telefon takvimi öğesi (utils/phoneCalendar.js biçimi). Aynı yapım ve tarih için anahtar,
 * Seelogd hatırlatıcılarının anahtarıyla AYNIDIR (`movie_<id>_<tarih>`, `tv_<id>_1_1_<tarih>`): aynı yapımı
 * hem hatırlatıcıdan hem buradan eklemek takvimde iki etkinlik açmaz ("zaten eklendi" der).
 * Dizi için `first_air_date` ilk bölümün (S1E1) tarihidir.
 * @returns {object|null} tarihi ya da kimliği olmayan öğede null
 */
export function upcomingToCalendarItem(item, mediaType) {
  const id = Number(item?.id);
  const date = typeof item?._date === "string" ? item._date : null;
  const title = (item?.title || item?.name || "").trim();
  if (!isPositiveInt(id) || !date || !title) return null;
  if (mediaType === "tv") {
    return { eventType: "reminder_tv", id, title, date, seasonNumber: 1, episodeNumber: 1 };
  }
  return { eventType: "reminder_movie", id, title, date };
}

/** Gün farkı (yerel takvim günü): bugün 0, yarın 1. Tarih geçersizse null. */
export function daysUntil(dateKey, now = new Date()) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const target = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}
