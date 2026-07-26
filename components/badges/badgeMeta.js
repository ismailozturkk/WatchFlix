// components/badges/badgeMeta.js
//
// Katalog DIŞI ödüllerin tek çözümleyicisi: koleksiyonlar, dönem mühürleri ve
// prestij basamakları.
//
// Üçü de defterin `earned` kümesinde normal bir rozet gibi durur (kalıcılık ve
// kutlama bedava gelsin diye) ama hiçbiri `WATCH_BADGE_BY_ID` içinde DEĞİLDİR.
// Kutlama toast'ı adı oradan çözemeyince sessizce hiçbir şey göstermiyordu —
// yani kullanıcı Panteon'u tamamlıyor, ekranda hiçbir şey olmuyordu.

import { AILE_PRESTIJ, WATCH_BADGE_BY_ID, badgeAd } from "./watchBadgeCatalog";
import { BADGE_SET_BY_ID } from "./badgeSets";
import { DONEM_BY_ID, muhurCoz } from "./seasonSeals";

// Prestij id'si → aile + basamak. `prestij_film_3` → { family: "film", n: 3 }
export function prestijCoz(id) {
  const m = /^prestij_([a-zA-Z]+)_(\d+)$/.exec(String(id || ""));
  if (!m || !AILE_PRESTIJ[m[1]]) return null;
  return { family: m[1], n: Number(m[2]) };
}

const AILE_ADI = {
  film: { tr: "Film", en: "Film" },
  bolum: { tr: "Bölüm", en: "Episode" },
  final: { tr: "Final", en: "Finale" },
  sure: { tr: "Süre", en: "Screen time" },
  gun: { tr: "Gün", en: "Day" },
  uzunMetraj: { tr: "Uzun metraj", en: "Feature" },
};

/**
 * Herhangi bir ödül id'sini görünür bir ada çevirir.
 * @returns {string|null} tanınmayan id'de null (çağıran kutlamayı atlar)
 */
export function odulAdi(id, lang = "tr") {
  const tr = lang !== "en";

  const rozet = WATCH_BADGE_BY_ID[id];
  if (rozet) return badgeAd(rozet, tr ? "tr" : "en");

  const set = BADGE_SET_BY_ID[id];
  if (set) return tr ? set.tr : set.en;

  const muhur = muhurCoz(id);
  if (muhur) {
    const d = DONEM_BY_ID[muhur.donem];
    return tr ? `${muhur.yil} ${d?.tr || ""}`.trim() : `${d?.en || ""} ${muhur.yil}`.trim();
  }

  const prestij = prestijCoz(id);
  if (prestij) {
    const ad = AILE_ADI[prestij.family] || { tr: prestij.family, en: prestij.family };
    return tr ? `${ad.tr} · ${prestij.n}. prestij` : `${ad.en} · prestige ${prestij.n}`;
  }

  return null;
}

/** Kutlama başlığı: ödül türüne göre değişir ("Rozet kazandın" her şeye uymaz). */
export function odulBasligi(id, lang = "tr") {
  const tr = lang !== "en";
  if (BADGE_SET_BY_ID[id]) return tr ? "Koleksiyon tamamlandı" : "Collection complete";
  if (muhurCoz(id)) return tr ? "Dönem mührü kazandın" : "Season seal earned";
  if (prestijCoz(id)) return tr ? "Prestij yükseldi" : "Prestige up";
  return tr ? "Rozet kazandın" : "Badge earned";
}
