// services/followedUpcoming.js
//
// Takip edilen oyuncu / yönetmenlerin YAKLAŞAN yapımları: her kişi için TMDB
// `/person/{id}/combined_credits` çekilir, ayıklama ve birleştirme utils/followedPeople.js'teki
// saf mantığa bırakılır.
//
// ÖNBELLEK: URL başına (services/favoriteRecommendations.readTmdb ile aynı yol — sorgu dizgisi URL'in
// İÇİNDE). Yaklaşan listesi gün içinde oynamaz; 6 saat taze. Film ve Dizi rafı AYNI uç noktayı
// okur, ikincisi önbellekten gelir. Çevrimdışıyken eski kayıt döner.
//
// EŞZAMANLILIK: 60 kişiye aynı anda istek açmak TMDB hız sınırını zorlar; 6'şarlı gruplarla gidilir.
// Tek kişinin hatası listeyi düşürmez; HEPSİ düşerse hata yukarı çıkar (raf "boş" sanılmasın, sessiz kalsın).

import { readTmdb } from "./favoriteRecommendations";
import { mergeUpcoming, upcomingFromCredits } from "../utils/followedPeople";

const TTL = 6 * 60 * 60 * 1000;
const BATCH = 6;

/**
 * @param {object} p
 * @param {Array<{id:number,name:string}>} p.people
 * @param {"movie"|"tv"} p.mediaType
 * @param {string} p.apiKey
 * @param {string} p.language
 * @param {Iterable<number|string>} [p.exclude] elenecek TMDB id'leri (izlenmişler)
 * @param {Date} [p.now]
 * @param {number} [p.limit]
 * @returns {Promise<Array>} yaklaşanlar (yakın tarih önce); her biri `_people`, `_date` taşır
 */
export async function fetchFollowedUpcoming({
  people,
  mediaType,
  apiKey,
  language,
  exclude = [],
  now = new Date(),
  limit = 40,
}) {
  const type = mediaType === "tv" ? "tv" : "movie";
  const list = Array.isArray(people) ? people.filter((person) => person?.id) : [];
  if (!apiKey || list.length === 0) return [];

  const settled = [];
  for (let i = 0; i < list.length; i += BATCH) {
    const chunk = list.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map(async (person) => {
        try {
          const credits = await readTmdb(`/person/${person.id}/combined_credits`, {
            apiKey,
            language,
            type,
            maxAge: TTL,
          });
          return { ok: true, person, items: upcomingFromCredits(credits, type, now) };
        } catch (error) {
          return { ok: false, person, items: [], error };
        }
      }),
    );
    settled.push(...results);
  }

  if (settled.every((entry) => !entry.ok)) throw settled[0].error;
  return mergeUpcoming(settled.filter((entry) => entry.ok), { exclude, limit });
}
