// services/storyShare/storyShareService.js
//
// Sinema/profil kartlarını yüksek çözünürlükte yakalayıp Instagram Story,
// WhatsApp veya galeriye aktaran servis.

import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { i18nText } from "../../utils/i18nText";
import * as MediaLibrary from "expo-media-library";
// SDK 57: `saveToLibraryAsync` ana giriste calisma aninda hata firlatiyor;
// legacy girisinden alinmali (izin fonksiyonlari ana giriste gecerli).
import { saveToLibraryAsync } from "expo-media-library/legacy";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Belirtilen görünümün (ref) yüksek çözünürlüklü ekran görüntüsünü alır.
 *
 * Gradient ve expo-image katmanları boyanmadan yakalama boş/yarım çıkabiliyor;
 * kısa bir bekleme + tek yeniden deneme bunu önler (WrappedScreen ile aynı gerekçe).
 *
 * @param {React.RefObject} viewRef
 * @param {{ width?: number, height?: number }} [size]  Verilirse çıktı bu piksel
 *        boyutuna ölçeklenerek yeniden çizilir (ör. 1080x1920 Story).
 * @returns {Promise<string>} Geçici dosya URI'si
 */
export async function captureStoryCard(viewRef, size = {}) {
  if (!viewRef || !viewRef.current) {
    throw new Error("Görünüm referansı bulunamadı.");
  }

  const options = { format: "png", quality: 1.0, result: "tmpfile" };
  if (size.width && size.height) {
    options.width = size.width;
    options.height = size.height;
  }

  await wait(100);
  try {
    return await captureRef(viewRef, options);
  } catch {
    await wait(140);
    return captureRef(viewRef, options);
  }
}

/**
 * view-shot bazı platformlarda şemasız yol döndürür; expo-sharing yerel dosya
 * için file:// bekler (Android'de eksikse sessizce başarısız olur).
 */
export function toShareableUri(fileUri) {
  return /^(file|content):\/\//.test(fileUri) ? fileUri : `file://${fileUri}`;
}

/**
 * Yakalanan kartı sistem paylaşım diyaloğuyla (Instagram, WhatsApp vb.) paylaşır.
 * @param {string} fileUri
 */
export async function shareStoryImage(fileUri) {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error(i18nText("autoI18n.paylasim_desteklenmiyor", "Bu cihazda paylaşım özelliği desteklenmiyor."));
  }

  await Sharing.shareAsync(toShareableUri(fileUri), {
    mimeType: "image/png",
    dialogTitle: i18nText("autoI18n.sinema_karti_paylas_baslik", "Sinema kartını paylaş"),
    UTI: "public.png",
  });
}

/**
 * Yakalanan kartı kullanıcının fotoğraf galerisine kaydeder.
 * @param {string} fileUri
 */
export async function saveStoryToGallery(fileUri) {
  // writeOnly=true: uygulama galeriyi hic OKUMUYOR, yalnizca kart gorselini
  // kaydediyor. Tam izin istenirse Android READ_MEDIA_IMAGES gerektirir ve Play
  // "Photo & Video Permissions" beyani acilir (bkz. docs/kurulum/PLAY_DATA_SAFETY.md).
  const { status } = await MediaLibrary.requestPermissionsAsync(true);
  if (status !== "granted") {
    throw new Error("Galeriye kaydetmek için medya izni gereklidir.");
  }

  await saveToLibraryAsync(toShareableUri(fileUri));
}
