// services/storyShare/storyShareService.js
//
// Sinema kartlarını yüksek çözünürlükte yakalayıp Instagram Story,
// WhatsApp veya galeriye aktaran servis.

import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";

/**
 * Belirtilen görünümün (ref) yüksek çözünürlüklü ekran görüntüsünü alır.
 * @param {React.RefObject} viewRef
 * @returns {Promise<string>} Geçici dosya URI'si
 */
export async function captureStoryCard(viewRef) {
  if (!viewRef || !viewRef.current) {
    throw new Error("Görünüm referansı bulunamadı.");
  }

  const uri = await captureRef(viewRef, {
    format: "png",
    quality: 1.0,
    result: "tmpfile",
  });

  return uri;
}

/**
 * Yakalanan kartı sistem paylaşım diyaloğuyla (Instagram, WhatsApp vb.) paylaşır.
 * @param {string} fileUri
 */
export async function shareStoryImage(fileUri) {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error("Bu cihazda paylaşım özelliği desteklenmiyor.");
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: "image/png",
    dialogTitle: "Sinema Kartını Paylaş",
    UTI: "public.png",
  });
}

/**
 * Yakalanan kartı kullanıcının fotoğraf galerisine kaydeder.
 * @param {string} fileUri
 */
export async function saveStoryToGallery(fileUri) {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    throw new Error("Galeriye kaydetmek için medya izni gereklidir.");
  }

  await MediaLibrary.saveToLibraryAsync(fileUri);
}
