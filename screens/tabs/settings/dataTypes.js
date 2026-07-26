// screens/tabs/settings/dataTypes.js
//
// "Verileri indir" tür seçiminin SUNUM tarafı (etiket + ikon + renk).
// Kimlikler `utils/dataCacheSettings.DATA_CACHE_CATEGORIES` ile birebir aynıdır;
// mantık orada, görünüm burada. Ayarlar > Genel (seçim) ve İzinler & Veriler
// (özet) aynı listeyi kullanır.
//
// Etiketler her çağrıda üretilir — dil değişince yeniden hesaplansın diye
// modül seviyesinde donmuş bir dizi tutulmaz.

import { DATA_CACHE_CATEGORIES } from "@utils/dataCacheSettings";
import { i18nText } from "@utils/i18nText";

/** @returns {{id:string, icon:string, colorKey:string, label:string, subtitle:string}[]} */
export function getDataTypeOptions() {
  const byId = {
    profile: {
      icon: "person-circle-outline",
      colorKey: "blue",
      label: i18nText("autoI18n.veri_turu_profil", "Profil"),
      subtitle: i18nText("autoI18n.veri_turu_profil_alt", "Profil bilgin ve istatistiklerin"),
    },
    lists: {
      icon: "bookmarks-outline",
      colorKey: "green",
      label: i18nText("autoI18n.veri_turu_listeler", "Listelerim"),
      subtitle: i18nText(
        "autoI18n.veri_turu_listeler_alt",
        "İzleme listesi, favoriler, izlenenler",
      ),
    },
    reminders: {
      icon: "alarm-outline",
      colorKey: "amber",
      label: i18nText("autoI18n.veri_turu_hatirlaticilar", "Hatırlatıcılar"),
      subtitle: i18nText("autoI18n.veri_turu_hatirlaticilar_alt", "Film ve bölüm hatırlatıcıların"),
    },
    notes: {
      icon: "document-text-outline",
      colorKey: "purple",
      label: i18nText("autoI18n.veri_turu_notlar", "Notlar"),
      subtitle: i18nText("autoI18n.veri_turu_notlar_alt", "Kendi notların"),
    },
    posts: {
      icon: "chatbubbles-outline",
      colorKey: "blue",
      label: i18nText("autoI18n.veri_turu_gonderiler", "Gönderiler"),
      subtitle: i18nText("autoI18n.veri_turu_gonderiler_alt", "Paylaşım akışının son hâli"),
    },
    activity: {
      icon: "pulse-outline",
      colorKey: "teal",
      label: i18nText("autoI18n.veri_turu_etkinlikler", "Etkinliklerim"),
      subtitle: i18nText(
        "autoI18n.veri_turu_etkinlikler_alt",
        "Puanların, yorumların, beğenilerin",
      ),
    },
    movieContent: {
      icon: "film-outline",
      colorKey: "amber",
      label: i18nText("autoI18n.veri_turu_film", "Film içerikleri"),
      subtitle: i18nText("autoI18n.veri_turu_film_alt", "Trend, en iyiler, türler, vizyon"),
    },
    tvContent: {
      icon: "tv-outline",
      colorKey: "green",
      label: i18nText("autoI18n.veri_turu_dizi", "Dizi içerikleri"),
      subtitle: i18nText("autoI18n.veri_turu_dizi_alt", "Trend, en iyiler, türler, yayında"),
    },
    images: {
      icon: "images-outline",
      colorKey: "purple",
      label: i18nText("autoI18n.veri_turu_gorseller", "Posterler"),
      subtitle: i18nText(
        "autoI18n.veri_turu_gorseller_alt",
        "İçeriklerin poster görselleri (en çok yer kaplayan)",
      ),
    },
  };

  // Sıra DATA_CACHE_CATEGORIES'ten gelir → mantık ile görünüm ayrışmaz.
  return DATA_CACHE_CATEGORIES.map((id) => ({ id, ...byId[id] })).filter(
    (opt) => !!opt.label,
  );
}

/** Seçili (açık) tür sayısı — eksik anahtar açık sayılır. */
export function countEnabledTypes(types) {
  return DATA_CACHE_CATEGORIES.filter((id) => types?.[id] !== false).length;
}

/** Tüm türleri tek seferde aç/kapat için hazır nesne. */
export function buildAllTypes(enabled) {
  return Object.fromEntries(DATA_CACHE_CATEGORIES.map((id) => [id, !!enabled]));
}

export const DATA_TYPE_COUNT = DATA_CACHE_CATEGORIES.length;
