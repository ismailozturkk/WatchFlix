// utils/libraryErrorText.js
//
// Liste/izleme işlemlerinin hatasını kullanıcıya gösterilecek YERELLEŞTİRİLMİŞ
// metne çevirir ve gösterir. Ekranlar eskiden `"Hata: " + error.message`
// basıyordu: çevrimdışıyken "Failed to get document because the client is
// offline.", yetkisizken ham SDK metni görünüyordu. Karar `LibraryError.code`
// üzerinden (utils/libraryCore) verilir, metin burada.

import Toast from "@components/AppToast";

import { captureError } from "../services/crashReporting";
import { i18nText } from "./i18nText";
import { LIBRARY_ERROR, toLibraryError } from "./libraryCore";

/** Hata kodunun kullanıcı metni. Bilinmeyen/teknik kodlar genel mesaja düşer. */
export function libraryErrorMessage(error) {
  switch (toLibraryError(error).code) {
    case LIBRARY_ERROR.OFFLINE:
      return i18nText(
        "autoI18n.kutuphane_cevrimdisi",
        "İnternet bağlantısı yok. Bağlanınca tekrar dene.",
      );
    case LIBRARY_ERROR.PERMISSION:
      return i18nText("autoI18n.kutuphane_yetki", "Bu işlem için yetkin yok.");
    case LIBRARY_ERROR.CONFLICT:
      return i18nText(
        "autoI18n.kutuphane_cakisma",
        "Liste başka bir yerde de değişti. Tekrar dene.",
      );
    case LIBRARY_ERROR.QUOTA:
      return i18nText(
        "autoI18n.kutuphane_kota",
        "Şu an çok fazla istek var. Biraz sonra tekrar dene.",
      );
    case LIBRARY_ERROR.SEASONS_INCOMPLETE:
      return i18nText(
        "autoI18n.kutuphane_sezonlar_eksik",
        "Bölüm bilgisi tam alınamadı. Tekrar dene.",
      );
    case LIBRARY_ERROR.UNRELEASED:
      return i18nText(
        "autoI18n.kutuphane_henuz_yayinlanmadi",
        "Henüz yayınlanmadı; izlendi olarak eklenemez.",
      );
    case LIBRARY_ERROR.UNKNOWN_RELEASE:
      return i18nText(
        "autoI18n.yayin_tarihi_bilinmiyor_izlendi",
        "Tarihi belli olmayan içerik izlendi olarak eklenemez.",
      );
    case LIBRARY_ERROR.LIST_RESERVED:
      return i18nText(
        "autoI18n.kutuphane_liste_adi_ayrilmis",
        "Bu ad liste adı olarak kullanılamaz.",
      );
    case LIBRARY_ERROR.LIST_CONFLICT:
      return i18nText(
        "autoI18n.kutuphane_liste_adi_dolu",
        "Bu adla başka bir kayıt var.",
      );
    default:
      return i18nText("autoI18n.islem_tamamlanamadi", "İşlem tamamlanamadı");
  }
}

// Kullanıcının/ağın olağan sonuçları — Sentry'yi kirletmesin. Geri kalanı
// (beklenmeyen, çakışma, kota, geçersiz istek) bir hataya işaret eder.
const EXPECTED = new Set([
  LIBRARY_ERROR.OFFLINE,
  LIBRARY_ERROR.PERMISSION,
  LIBRARY_ERROR.UNRELEASED,
  LIBRARY_ERROR.UNKNOWN_RELEASE,
  LIBRARY_ERROR.SEASONS_INCOMPLETE,
  LIBRARY_ERROR.LIST_RESERVED,
  LIBRARY_ERROR.LIST_CONFLICT,
]);

/**
 * Hata toast'ı gösterir; beklenmeyen hatayı raporlar.
 * @param {unknown} error
 * @param {{ source?: string, title?: string }} [options]
 *        `source`: rapordaki etiket; `title` verilirse başlık o, neden ikinci satır olur
 * @returns {import("./libraryCore").LibraryError}
 */
export function showLibraryError(error, { source = "library", title } = {}) {
  const libraryError = toLibraryError(error);
  if (!EXPECTED.has(libraryError.code)) {
    captureError(libraryError.cause || libraryError, {
      tags: { source, library_code: libraryError.code },
    });
  }
  const message = libraryErrorMessage(libraryError);
  Toast.show({
    type: "error",
    text1: title || message,
    ...(title ? { text2: message } : {}),
  });
  return libraryError;
}
