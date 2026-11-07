// utils/personAvatars.js
//
// "Oyuncu & Yönetmen" avatarı seçicisinin SAF kararları (RN/Firebase yok;
// testi __tests__/personAvatars.test.js).
//
// Kaynaklar (seçici, sorgu yokken bu sırayla gösterir):
//   favorites  profildeki "dört favori" oyuncular   Users/{uid}.fourFavorites.people
//   followed   takip edilen oyuncu/yönetmenler       Keys.followedPeople (cihaz-yerel)
//   popular    TMDB /person/popular                   (yalnız oyuncu + yönetmen)
// Sorgu varken: TMDB /search/person sonuçları.
//
// Avatar herkese görünür: yetişkin işaretli kişi ve fotoğrafsız kişi HİÇBİR
// kaynakta satır olmaz (personAvatarChoice null döner).

import { personAvatarChoice } from "./avatarPhotos";

/** Seçicide gösterilen meslekler. Bilinmeyen (alan yok) kişi elenmez. */
export const PERSON_AVATAR_DEPARTMENTS = Object.freeze(["Acting", "Directing"]);
export const PERSON_SEARCH_MIN_CHARS = 2;
export const PERSON_ROW_LIMIT = 40;
export const PERSON_GRID_COLUMNS = 4;

const ALLOWED = new Set(PERSON_AVATAR_DEPARTMENTS);

function departmentOf(person) {
  const raw = person?.known_for_department ?? person?.department ?? null;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

/**
 * Kişi listesi (TMDB sonucu, favori girişi, takip kaydı) → seçici satırları.
 *
 * @param {Array} people
 * @param {object} [opts]
 * @param {number} [opts.limit]
 * @param {Iterable<number|string>} [opts.exclude]  zaten gösterilen kişi id'leri
 * @param {boolean} [opts.requireDepartment]  mesleği bilinmeyeni de ele (popüler
 *   listede TMDB her kayda meslek yazar; yoksa veri bozuktur)
 * @returns {Array<{key:string, id:number, name:string, department:string|null, choice:object}>}
 */
export function toPersonAvatarRows(people, { limit = PERSON_ROW_LIMIT, exclude = [], requireDepartment = false } = {}) {
  const seen = new Set([...exclude].map(String));
  const rows = [];
  for (const person of Array.isArray(people) ? people : []) {
    const department = departmentOf(person);
    if (department ? !ALLOWED.has(department) : requireDepartment) continue;
    const choice = personAvatarChoice(person);
    if (!choice) continue;
    const id = choice.photoPerson.id;
    if (seen.has(String(id))) continue;
    seen.add(String(id));
    rows.push({ key: `person:${id}`, id, name: choice.photoPerson.name, department, choice });
    if (rows.length >= limit) break;
  }
  return rows;
}

/**
 * Sorgu yokken gösterilen bölümler. Bir kişi yalnız İLK bölümünde görünür
 * (favori oyuncun popülerde ikinci kez çıkmaz); boş bölüm atılır.
 *
 * @returns {Array<{id:"favorites"|"followed"|"popular", rows:Array}>}
 */
export function buildPersonAvatarSections({ favorites = [], followed = [], popular = [] } = {}) {
  const shown = new Set();
  const sections = [];
  const add = (id, people, opts = {}) => {
    const rows = toPersonAvatarRows(people, { ...opts, exclude: shown });
    rows.forEach((row) => shown.add(String(row.id)));
    if (rows.length) sections.push({ id, rows });
  };
  add("favorites", favorites);
  add("followed", followed);
  add("popular", popular, { requireDepartment: true });
  return sections;
}

/** Satırları ızgara satırlarına böler (SectionList her öğede bir satır çizer). */
export function chunkRows(rows, size = PERSON_GRID_COLUMNS) {
  const out = [];
  const list = Array.isArray(rows) ? rows : [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/**
 * Seçicinin arama durumu: "idle" (sorgu kısa), "loading", "error", "empty",
 * "results". Ekran metnini ve boş hâli tek yerden seçmek için.
 */
export function personSearchState({ query, loading, error, rows }) {
  if (String(query || "").trim().length < PERSON_SEARCH_MIN_CHARS) return "idle";
  if (loading && !(rows && rows.length)) return "loading";
  if (error && !(rows && rows.length)) return "error";
  return rows && rows.length ? "results" : "empty";
}
