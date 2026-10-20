// components/badges/badgeMeta.js
//
// Katalog DIŞI ödüllerin tek çözümleyicisi: koleksiyonlar, dönem mühürleri ve
// prestij basamakları.
//
// Üçü de defterin `earned` kümesinde normal bir rozet gibi durur (kalıcılık ve
// kutlama bedava gelsin diye) ama hiçbiri `WATCH_BADGE_BY_ID` içinde DEĞİLDİR.
// Kutlama toast'ı adı oradan çözemeyince sessizce hiçbir şey göstermiyordu —
// yani kullanıcı Panteon'u tamamlıyor, ekranda hiçbir şey olmuyordu.

import { copyLanguage, pickByLanguage } from "../../utils/appLanguages";
import { AILE_PRESTIJ, WATCH_BADGES, WATCH_BADGE_BY_ID, badgeAd } from "./watchBadgeCatalog";
import { BADGE_SET_BY_ID } from "./badgeSets";
import { DONEM_BY_ID, muhurBasligi, muhurCoz } from "./seasonSeals";
import { RARITY, RARITY_ORDER } from "@theme/badgeTokens";

// Prestij id'si → aile + basamak. `prestij_film_3` → { family: "film", n: 3 }
export function prestijCoz(id) {
  const m = /^prestij_([a-zA-Z]+)_(\d+)$/.exec(String(id || ""));
  if (!m || !AILE_PRESTIJ[m[1]]) return null;
  return { family: m[1], n: Number(m[2]) };
}

const AILE_ADI = {
  film: { tr: "Film", en: "Film", es: "Película", pt: "Filme", de: "Film" },
  bolum: { tr: "Bölüm", en: "Episode", es: "Episodio", pt: "Episódio", de: "Folge" },
  final: { tr: "Final", en: "Finale", es: "Final", pt: "Final", de: "Finale" },
  sure: { tr: "Süre", en: "Screen time", es: "Tiempo de pantalla", pt: "Tempo de tela", de: "Bildschirmzeit" },
  gun: { tr: "Gün", en: "Day", es: "Día", pt: "Dia", de: "Tag" },
  uzunMetraj: { tr: "Uzun metraj", en: "Feature", es: "Largometraje", pt: "Longa-metragem", de: "Spielfilm" },
};

/**
 * Herhangi bir ödül id'sini görünür bir ada çevirir.
 * @returns {string|null} tanınmayan id'de null (çağıran kutlamayı atlar)
 */
export function odulAdi(id, lang = "tr") {
  const code = copyLanguage(lang, ["tr", "en", "es", "pt", "de"]);

  const rozet = WATCH_BADGE_BY_ID[id];
  if (rozet) return badgeAd(rozet, code);

  const set = BADGE_SET_BY_ID[id];
  if (set) return set[code] || set.en;

  const muhur = muhurCoz(id);
  if (muhur) {
    return muhurBasligi(code, muhur.yil, muhur.donem);
  }

  const prestij = prestijCoz(id);
  if (prestij) {
    const ad = AILE_ADI[prestij.family] || { tr: prestij.family, en: prestij.family, es: prestij.family, pt: prestij.family, de: prestij.family };
    const aile = ad[code] || ad.en;
    return pickByLanguage(code, {
      tr: `${aile} · ${prestij.n}. prestij`,
      en: `${aile} · prestige ${prestij.n}`,
      es: `${aile} · prestigio ${prestij.n}`,
      pt: `${aile} · prestígio ${prestij.n}`,
      de: `${aile} · Prestige ${prestij.n}`,
    });
  }

  return null;
}

/** Kutlama başlığı: ödül türüne göre değişir ("Rozet kazandın" her şeye uymaz). */
export function odulBasligi(id, lang = "tr") {
  const L = (tr, en, es, pt, de) => pickByLanguage(lang, { tr, en, es, pt: pt ?? en, de: de ?? en });
  if (BADGE_SET_BY_ID[id]) return L("Koleksiyon tamamlandı", "Collection complete", "Colección completada", "Coleção concluída", "Sammlung abgeschlossen");
  if (muhurCoz(id)) return L("Dönem mührü kazandın", "Season seal earned", "Has conseguido un sello de temporada", "Você conquistou um selo de temporada", "Saison-Siegel erhalten");
  if (prestijCoz(id)) return L("Prestij yükseldi", "Prestige up", "Subes de prestigio", "Você subiu de prestígio", "Prestige gestiegen");
  return L("Rozet kazandın", "Badge earned", "Has conseguido una insignia", "Você conquistou um emblema", "Abzeichen erhalten");
}

// Ailenin kademe sayısı ve ZİRVE rozeti. Kutlama bildirimi rozetin şeklini
// (kare → sekizgen) ve rengini aile içindeki konumundan çizer; bunun için ailenin
// kaç kademeli olduğunu bilmek gerekir.
const AILE_ZIRVE = WATCH_BADGES.reduce((acc, b) => {
  if (!b.family) return acc;
  const o = acc[b.family];
  if (!o || b.tier > o.tier) acc[b.family] = b;
  return acc;
}, {});
const AILE_UZUNLUK = WATCH_BADGES.reduce((acc, b) => {
  if (b.family) acc[b.family] = Math.max(acc[b.family] || 0, b.tier);
  return acc;
}, {});

/**
 * Herhangi bir ödül id'sini ÇİZİLEBİLİR bir görünüme çevirir: ad, başlık, ikon,
 * nadirlik ve kademe konumu. Kutlama bildirimi (ve ileride paylaşım kartı) rozetin
 * kendi şeklini çizsin diye var — id'den ada giden `odulAdi` bunu veremiyordu.
 *
 * @returns {null|{ id, tur:"rozet"|"koleksiyon"|"muhur"|"prestij", ad:string,
 *   baslik:string, icon:string, iconSolid:string, rarity:string,
 *   tier:number, aileToplam:number }} tanınmayan id'de null
 */
export function odulGorunumu(id, lang = "tr") {
  const ad = odulAdi(id, lang);
  if (!ad) return null;
  const baslik = odulBasligi(id, lang);

  const rozet = WATCH_BADGE_BY_ID[id];
  if (rozet) {
    return {
      id, tur: "rozet", ad, baslik,
      icon: rozet.icon, iconSolid: rozet.iconSolid, rarity: rozet.rarity,
      tier: rozet.tier || 0,
      aileToplam: rozet.family ? AILE_UZUNLUK[rozet.family] || 0 : 0,
    };
  }

  const set = BADGE_SET_BY_ID[id];
  if (set) {
    return {
      id, tur: "koleksiyon", ad, baslik,
      icon: set.icon, iconSolid: set.iconSolid, rarity: set.rarity, tier: 0, aileToplam: 0,
    };
  }

  const muhur = muhurCoz(id);
  if (muhur) {
    const d = DONEM_BY_ID[muhur.donem];
    return {
      id, tur: "muhur", ad, baslik,
      icon: d.icon, iconSolid: d.iconSolid, rarity: RARITY.uncommon, tier: 0, aileToplam: 0,
    };
  }

  const prestij = prestijCoz(id);
  if (prestij) {
    // Prestij ailenin zirvesinin ÖTESİDİR: zirve rozetinin ikonu ve nadirliği,
    // son kademe konumu (altın sekizgen) — "aileyi bitirdin ve devam ettin".
    const zirve = AILE_ZIRVE[prestij.family];
    return {
      id, tur: "prestij", ad, baslik,
      icon: zirve?.icon || "star-outline", iconSolid: zirve?.iconSolid || "star",
      rarity: zirve?.rarity || RARITY.epic,
      tier: AILE_UZUNLUK[prestij.family] || 0,
      aileToplam: AILE_UZUNLUK[prestij.family] || 0,
    };
  }

  return null;
}

/**
 * Aynı turda kutlanacak ödüller içinden BAŞLIKTA gösterilecek olanı seçer: en nadir,
 * eşitse listedeki ilk. Tanınmayan id'ler (katalogdan çıkmış rozet) atlanır. İlk id'yi
 * göstermek rastgeleydi — üç rozetten biri Efsanevi ise ekranda o durmalı.
 * @returns {{ gorunum: object, ek: number } | null}  `ek`: başlığın dışında kalan ödül sayısı
 */
export function baslikOdulu(idler, lang = "tr") {
  const gorunumler = (idler || []).map((id) => odulGorunumu(id, lang)).filter(Boolean);
  if (!gorunumler.length) return null;
  let secili = gorunumler[0];
  for (const g of gorunumler) {
    if (RARITY_ORDER.indexOf(g.rarity) > RARITY_ORDER.indexOf(secili.rarity)) secili = g;
  }
  return { gorunum: secili, ek: gorunumler.length - 1 };
}
