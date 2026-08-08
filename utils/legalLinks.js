// utils/legalLinks.js
//
// Yasal sayfaların TEK kaynağı: gizlilik politikası, kullanım koşulları,
// hesap silme.
//
// NEDEN TEK YERDE: bu URL'ler artık üç ekranda birden geçiyor (Uygulama
// Hakkında, paywall, kayıt ekranları) ve aynıları mağaza formlarına da
// giriyor. Kopyalandığında biri güncellenip diğeri unutulur; Apple 3.1.2
// denetiminde paywall'daki ölü link tek başına ret sebebi.
//
// Metinler uygulamada değil SİTEDE tutuluyor: metin değiştiğinde yeni sürüm
// yayınlamak gerekmiyor ve mağaza formları zaten URL istiyor.

import * as WebBrowser from "expo-web-browser";
import { Linking } from "react-native";

export const LEGAL_SITE = "https://seelogd.com";
export const SUPPORT_EMAIL = "support@seelogd.com";

/** Sayfa anahtarı → dosya adı. Site iki dili tek dosyada tutuyor. */
export const LEGAL_PAGES = Object.freeze({
  privacy: "privacy.html",
  terms: "terms.html",
  deleteAccount: "delete-account.html",
});

/**
 * Yasal sayfanın tam adresi.
 *
 * `?lang=` ŞART: sayfa dili tarayıcıdan seçiyor, yani Türkçe uygulamayı
 * İngilizce cihazda kullanan biri metni İngilizce görürdü. Uygulamanın
 * dilini açıkça geçiyoruz.
 */
export function legalUrl(page, language) {
  const file = LEGAL_PAGES[page] || page;
  return `${LEGAL_SITE}/${file}?lang=${language === "en" ? "en" : "tr"}`;
}

/**
 * Yasal sayfayı aç. Uygulama içi tarayıcı tercih ediliyor: kullanıcı
 * uygulamadan çıkmıyor ve geri dönüşte akış (ör. yarım kalan satın alma)
 * bozulmuyor. Açılamazsa sistem tarayıcısına düşer.
 */
export async function openLegalPage(page, language) {
  const url = legalUrl(page, language);
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    Linking.openURL(url).catch(() => {});
  }
}
