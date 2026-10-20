// components/appLogoSources.js
//
// Uygulama logosunun görsel kaynakları — assets/icon_default ve
// assets/icon_glass'a TEK giriş noktası. Uygulamanın başka hiçbir yeri bu
// klasörlerdeki görselleri doğrudan require etmez (bir test bunu doğrular);
// hepsi `useAppLogo()` ile seçili simgeye göre buradan beslenir.
//
// İki görsel türü:
//   logo → android-icon-foreground.png: ŞEFFAF zeminli "S" (uyarlanabilir
//          simgenin ön planı). Koyu/renkli yüzeylerde marka işareti olarak
//          kullanılır (giriş, splash, hakkında, filigran...).
//   icon → icon.png: arka planıyla birlikte TAM simge. Launcher'daki simgenin
//          birebir görüntüsü gereken yerler (ayar kartı önizlemesi, widget
//          önizlemesi).
//
// Metro statik require ister: yollar string literal olmak ZORUNDA, bu yüzden
// kimlik → kaynak tablosu elle yazıldı. Yeni simge eklerken buraya da satır
// ekle (appIcons.test.js katalogla tablonun aynı kimlikleri taşıdığını doğrular).

export const APP_LOGO_SOURCES = Object.freeze({
  default: Object.freeze({
    logo: require("../assets/icon_default/android-icon-foreground.png"),
    icon: require("../assets/icon_default/icon.png"),
  }),
  glass: Object.freeze({
    logo: require("../assets/icon_glass/android-icon-foreground.png"),
    icon: require("../assets/icon_glass/icon.png"),
  }),
});

/** Kimliğe göre kaynaklar; bilinmeyen kimlik varsayılana düşer. */
export function getAppLogoSources(iconId) {
  return APP_LOGO_SOURCES[iconId] || APP_LOGO_SOURCES.default;
}
