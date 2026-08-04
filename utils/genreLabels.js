// utils/genreLabels.js
//
// TMDB tür id'si → yerelleştirilmiş tür ADI. Tek tablo, iki tüketici:
// paylaşım oluşturan (CreatePostModal) ve paylaşılan listeyi kaydeden
// (SaveSharedListModal). Ortak olması bilinçli: kaydeden kullanıcı tür
// adlarını PAYLAŞANIN değil KENDİ dilinde alsın.
//
// İçinde mantık yok — düz tablo. i18nText import ettiği için jest kapsamı
// dışında (bkz. jest.config.js'in "yalnız saf modüller" kısıtı).

import { i18nText } from "./i18nText";

/** @returns {Record<number, string>} */
export function buildGenreMap() {
  return {
    // Film türleri
    28: i18nText("autoI18n.aksiyon", "Aksiyon"),
    12: i18nText("autoI18n.macera", "Macera"),
    16: i18nText("autoI18n.animasyon", "Animasyon"),
    35: i18nText("autoI18n.komedi", "Komedi"),
    80: i18nText("autoI18n.suc", "Suç"),
    99: i18nText("autoI18n.belgesel", "Belgesel"),
    18: i18nText("autoI18n.dram", "Dram"),
    10751: i18nText("autoI18n.aile", "Aile"),
    14: i18nText("autoI18n.fantastik", "Fantastik"),
    36: i18nText("autoI18n.tarih", "Tarih"),
    27: i18nText("autoI18n.korku", "Korku"),
    10402: i18nText("autoI18n.muzik", "Müzik"),
    9648: i18nText("autoI18n.gizem", "Gizem"),
    10749: i18nText("autoI18n.romantik", "Romantik"),
    878: i18nText("autoI18n.bilim_kurgu", "Bilim Kurgu"),
    53: i18nText("autoI18n.gerilim", "Gerilim"),
    10752: i18nText("autoI18n.savas", "Savaş"),
    37: i18nText("autoI18n.vahsi_bati", "Vahşi Batı"),
    // Dizi türleri — eksik olanlar tamamlandı, aksi halde dizi paylaşımlarında
    // tür çipleri sessizce boş kalıyordu.
    10759: i18nText("autoI18n.aksiyon_macera", "Aksiyon & Macera"),
    10762: i18nText("autoI18n.cocuk", "Çocuk"),
    10763: i18nText("autoI18n.haber", "Haber"),
    10764: i18nText("autoI18n.realite", "Realite"),
    10765: i18nText("autoI18n.bilim_kurgu_fantastik", "Bilim Kurgu & Fantastik"),
    10766: i18nText("autoI18n.pembe_dizi", "Pembe Dizi"),
    10767: i18nText("autoI18n.talk_show", "Talk Show"),
    10768: i18nText("autoI18n.savas_politika", "Savaş & Politika"),
    10770: i18nText("autoI18n.tv_filmi", "TV Filmi"),
  };
}
