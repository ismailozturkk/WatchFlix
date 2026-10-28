// utils/badgeShowcase.js
//
// Kullanıcının profilinde (ve arkadaş profilinde) sergilemek üzere seçtiği
// en fazla 4 rozetin ("Vitrin Rozetleri") saf doğrulama, normalizasyon,
// seçme/çıkarma ve çözümleme katmanı.
//
// SAF MODÜL: React Native ve Firebase importu içermez.

import { RARITY } from "@theme/badgeTokens";
import {
  BOLUM,
  WATCH_BADGES,
  WATCH_BADGE_BY_ID,
} from "../components/badges/watchBadgeCatalog";
import { BADGE_SET_BY_ID } from "../components/badges/badgeSets";
import {
  DONEM_BY_ID,
  MUHUR_ESIK,
  muhurCoz,
  muhurleriHesapla,
} from "../components/badges/seasonSeals";
import { kartBul } from "../components/badges/badgeInsights";

export const MAX_SHOWCASE_BADGES = 4;
export const SHOWCASE_ID_REGEX = /^[a-zA-Z0-9_]{2,48}$/;

// Aile başına toplam kademe sayısı (katalogdan bir kez hesaplanır).
const AILE_TOPLAM = WATCH_BADGES.reduce((acc, b) => {
  if (b.family) acc[b.family] = Math.max(acc[b.family] || 0, b.tier || 0);
  return acc;
}, {});

/** Verilen rozet id'sinin ait olduğu kademeli aile adını döndürür (yoksa null). */
export function badgeFamilyOfId(id) {
  if (!id || typeof id !== "string") return null;
  return WATCH_BADGE_BY_ID[id]?.family || null;
}

/**
 * Bir rozet id'si vitrine yazılabilir geçerli bir rozet mi?
 * Katalog rozetleri (`WATCH_BADGE_BY_ID`), koleksiyonlar (`BADGE_SET_BY_ID`)
 * ve dönem mühürleri (`muhur_YYYY_donem`) kabul edilir.
 */
export function isValidShowcaseBadgeId(id) {
  if (typeof id !== "string") return false;
  const trimmed = id.trim();
  if (!SHOWCASE_ID_REGEX.test(trimmed)) return false;
  if (WATCH_BADGE_BY_ID[trimmed]) return true;
  if (BADGE_SET_BY_ID[trimmed]) return true;
  if (muhurCoz(trimmed)) return true;
  return false;
}

/**
 * Ham girdiyi (string[] ya da {id}[]) en fazla 4 geçerli ve tekrarsız rozet id'sine
 * indirger. Aynı kademeli aileden iki farklı kademe verilmişse ilk yuvanın konumunu
 * koruyarak yüksek kademeli olanı tutar.
 */
export function normalizeShowcaseBadges(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seenIds = new Set();
  const familyIndex = new Map();

  for (const item of raw) {
    const rawId = typeof item === "string" ? item : item?.id;
    if (typeof rawId !== "string") continue;
    const id = rawId.trim();
    if (!isValidShowcaseBadgeId(id) || seenIds.has(id)) continue;

    const family = badgeFamilyOfId(id);
    if (family && familyIndex.has(family)) {
      const idx = familyIndex.get(family);
      const prevId = out[idx];
      const prevTier = WATCH_BADGE_BY_ID[prevId]?.tier || 0;
      const nextTier = WATCH_BADGE_BY_ID[id]?.tier || 0;
      if (nextTier > prevTier) {
        seenIds.delete(prevId);
        seenIds.add(id);
        out[idx] = id;
      }
      continue;
    }

    if (out.length >= MAX_SHOWCASE_BADGES) continue;
    seenIds.add(id);
    if (family) familyIndex.set(family, out.length);
    out.push(id);
  }

  return out;
}

/** Firestore `Users/{uid}` belgesinden vitrin rozet id'lerini güvenle okur. */
export function readProfileShowcaseBadges(profile) {
  if (!profile || typeof profile !== "object") return [];
  return normalizeShowcaseBadges(profile.showcaseBadges);
}

/** En az bir geçerli vitrin rozeti seçilmiş mi? */
export function hasAnyShowcaseBadges(raw) {
  return normalizeShowcaseBadges(raw).length > 0;
}

/**
 * Verilen rozet (kart nesnesi ya da id) vitrin listesinde yer alıyor mu?
 * Kademeli ailelerde aynı ailenin herhangi bir kademesi vitrindeyse `true` döner.
 */
export function isBadgeInShowcase(showcaseIds, badgeOrId) {
  const list = normalizeShowcaseBadges(showcaseIds);
  if (!list.length || !badgeOrId) return false;
  const id = typeof badgeOrId === "string" ? badgeOrId.trim() : badgeOrId?.id;
  if (!id) return false;
  if (list.includes(id)) return true;

  const targetFamily =
    (typeof badgeOrId === "object" && badgeOrId?.family) || badgeFamilyOfId(id);
  if (targetFamily) {
    return list.some((savedId) => badgeFamilyOfId(savedId) === targetFamily);
  }
  if (typeof badgeOrId === "object" && Array.isArray(badgeOrId.aileUyeleri)) {
    return badgeOrId.aileUyeleri.some((u) => list.includes(u.id));
  }
  return false;
}

/**
 * Bir rozeti vitrine ekler veya vitrindeyse çıkarır.
 * Kilitli rozet (`acik === false`) vitrine eklenemez.
 *
 * @returns {{ next: string[], action: "added"|"removed"|"full"|"locked"|"invalid" }}
 */
export function toggleShowcaseBadge(showcaseIds, badgeOrId) {
  const current = normalizeShowcaseBadges(showcaseIds);
  if (!badgeOrId) return { next: current, action: "invalid" };

  const isObj = typeof badgeOrId === "object";
  const id = isObj ? String(badgeOrId.id || "").trim() : String(badgeOrId).trim();
  if (!isValidShowcaseBadgeId(id)) {
    return { next: current, action: "invalid" };
  }

  const targetFamily = (isObj && badgeOrId.family) || badgeFamilyOfId(id);
  const existingIdx = current.findIndex(
    (savedId) =>
      savedId === id || (targetFamily && badgeFamilyOfId(savedId) === targetFamily),
  );

  // Zaten vitrindeyse her durumda çıkarılabilir.
  if (existingIdx !== -1) {
    const next = current.filter((_, idx) => idx !== existingIdx);
    return { next, action: "removed" };
  }

  // Yeni ekleme: nesne verilmişse açık olması şart.
  if (isObj && badgeOrId.acik === false) {
    return { next: current, action: "locked" };
  }

  if (current.length >= MAX_SHOWCASE_BADGES) {
    return { next: current, action: "full" };
  }

  return { next: [...current, id], action: "added" };
}

/** Belirli bir rozet id'sini vitrinden çıkarır. */
export function removeShowcaseBadge(showcaseIds, idOrBadge) {
  const current = normalizeShowcaseBadges(showcaseIds);
  const id = typeof idOrBadge === "string" ? idOrBadge.trim() : idOrBadge?.id;
  if (!id) return current;
  const targetFamily =
    (typeof idOrBadge === "object" && idOrBadge?.family) || badgeFamilyOfId(id);
  return current.filter(
    (savedId) =>
      savedId !== id && !(targetFamily && badgeFamilyOfId(savedId) === targetFamily),
  );
}

/**
 * Kullanıcının kendi `kartlar` listesi yüklendiğinde:
 * - Kademeli bir ailede üst kademeye geçilmişse vitrindeki eski kademe id'sini
 *   güncel kademe id'sine (`kart.id`) yükseltir.
 * - Kilitli kalan (henüz kazanılmamış) bir id varsa temizler.
 */
export function upgradeShowcaseIdsWithCards(showcaseIds, kartlar) {
  const current = normalizeShowcaseBadges(showcaseIds);
  if (!current.length || !Array.isArray(kartlar) || !kartlar.length) return current;

  const upgraded = [];
  for (const id of current) {
    const kart = kartBul(kartlar, id);
    if (!kart || !kart.acik) continue;
    upgraded.push(kart.id);
  }
  return normalizeShowcaseBadges(upgraded);
}

/**
 * Tek bir rozet id'sini `AppBadge`, `FriendBadgeShowcase` ve `WatchBadgeDetailModal`
 * bileşenlerinin doğrudan çizebileceği tam kart nesnesine çözer.
 *
 * Arkadaş profilinde `kartlar` yoktur (arkadaşın yerel defteri okunmaz); bu fonksiyon
 * katalog, koleksiyon veya dönem mührü tanımından 5 dilde başlık/açıklama ve
 * kademe bilgisini eksiksiz kurar.
 */
export function resolveShowcaseBadgeCard(id, kartlar = null) {
  if (!isValidShowcaseBadgeId(id)) return null;
  const trimmed = id.trim();

  if (Array.isArray(kartlar) && kartlar.length > 0) {
    const mevcud = kartBul(kartlar, trimmed);
    if (mevcud && mevcud.acik) return mevcud;
  }

  const katalogRozet = WATCH_BADGE_BY_ID[trimmed];
  if (katalogRozet) {
    const aileToplam = katalogRozet.family ? AILE_TOPLAM[katalogRozet.family] || 0 : 0;
    const tier = katalogRozet.tier || 0;
    return {
      ...katalogRozet,
      hidden: false,
      acik: true,
      oran: 1,
      ilerleme: katalogRozet.target || 1,
      aileKademe: tier,
      aileToplam,
      sonrakiHedef: null,
    };
  }

  const set = BADGE_SET_BY_ID[trimmed];
  if (set) {
    const uyeIdleri = typeof set.uyeler === "function" ? set.uyeler() : [];
    const target = Number.isFinite(set.esik) && set.esik > 0 ? set.esik : uyeIdleri.length;
    return {
      ...set,
      section: BOLUM.SET,
      family: null,
      tier: 0,
      aileKademe: 0,
      aileToplam: 0,
      hidden: false,
      acik: true,
      oran: 1,
      ilerleme: target,
      target,
      uyeIdleri: Number.isFinite(set.esik) && set.esik > 0 ? null : uyeIdleri,
    };
  }

  const muhur = muhurCoz(trimmed);
  if (muhur) {
    const hesaplanan = muhurleriHesapla([], { kazanilmis: [trimmed] }).find(
      (m) => m.id === trimmed,
    );
    if (hesaplanan) return { ...hesaplanan, acik: true, oran: 1, ilerleme: MUHUR_ESIK };
    const tanim = DONEM_BY_ID[muhur.donem];
    return {
      id: trimmed,
      section: BOLUM.MUHUR,
      family: null,
      tier: 0,
      aileKademe: 0,
      aileToplam: 0,
      hidden: false,
      icon: tanim?.icon || "ribbon-outline",
      iconSolid: tanim?.iconSolid || "ribbon",
      rarity: RARITY.uncommon,
      acik: true,
      oran: 1,
      ilerleme: MUHUR_ESIK,
      target: MUHUR_ESIK,
    };
  }

  return null;
}

/**
 * Vitrin id dizisini çizilebilir rozet kartları listesine çözer.
 */
export function resolveShowcaseBadges(rawIds, kartlar = null) {
  return normalizeShowcaseBadges(rawIds)
    .map((id) => resolveShowcaseBadgeCard(id, kartlar))
    .filter(Boolean);
}

/**
 * Kendi profil başlığındaki yatay rozet şeridi (`WatchBadgeStrip`) için
 * açık rozetleri sıralar: vitrindeki rozetler kullanıcının seçtiği sırayla
 * en başta, geri kalanlar nadirlik + kademe sırasıyla arkasından gelir.
 */
export function sortUnlockedWithShowcaseFirst(acikKartlar, showcaseIds, rarityOrder = []) {
  if (!Array.isArray(acikKartlar) || !acikKartlar.length) return [];
  const pinnedIds = normalizeShowcaseBadges(showcaseIds);

  const pinnedCards = [];
  const pinnedSet = new Set();
  for (const id of pinnedIds) {
    const found = kartBul(acikKartlar, id);
    if (found && found.acik && !pinnedSet.has(found.id)) {
      pinnedSet.add(found.id);
      pinnedCards.push({ ...found, vitrinde: true });
    }
  }

  const rest = acikKartlar
    .filter((k) => k?.acik && !pinnedSet.has(k.id))
    .sort((a, b) => {
      const fark = rarityOrder.indexOf(b.rarity) - rarityOrder.indexOf(a.rarity);
      return fark !== 0 ? fark : (b.aileKademe || 0) - (a.aileKademe || 0);
    });

  return [...pinnedCards, ...rest];
}
