# T1.2 — Mekanik taramalar (2026-10-25)

> Rehber: `docs/planlama/YAYIN_ONCESI_TEST_REHBERI.md` › T1.2. Taranan commit: `e675082` + bu rapordaki düzeltme.

## Özet

| Tarama | Sonuç |
|---|---|
| Import / export | `npm test` içindeki `moduleImports` bekçisi yeşil |
| Tip taraması (`checkJs`) | Süzülen 106 uyarının hiçbiri gerçek hata değil |
| Ham Türkçe metin | Release'de görünen tek dilli ekran: **Debug ekranı** → düzeltildi (Yüksek, aşağıda) |
| Bağımlılık açıkları | Uygulama 29, fonksiyonlar 15 uyarı; çalışma anında önemli olanlar ayrıldı |
| Sır taraması | Sunucu sırrı yok; 3 Firebase istemci anahtarı (tasarım gereği açık) |
| Sessiz catch | 372 adet; kullanıcı akışını etkileyen adaylar listelendi |

Düzeltme sonrası `npm test`: **350 suite / 6784 test yeşil** (+1 bekçi testi).

---

## Bulgular

### [Yüksek] Ayarlar'daki "Debug" satırı mağaza build'inde görünüyor — DÜZELTİLDİ
- **Nerede:** `screens/tabs/SettingsScreen.js:1036` (Ayarlar'ın en altı), ayrıca `components/navigation/AdaptiveTabShell.js:118` (`initialTab: "debug"` yolu).
- **Nasıl tekrarlanır:** mağaza veya önizleme build'inde Ayarlar > en alttaki "Debug".
- **Beklenen / Gerçekleşen:** geliştirici araçları yalnız geliştirme build'inde olmalı (plan simülatörü ve test push düğmesi zaten `__DEV__` arkasında). Debug satırı kapısızdı. Açtığı `UsageDebugScreen` maliyet kokpiti ("Google'a ödenecek" tutarları, kota ayrıntıları), test bildirimleri, sayaç sıfırlama ve yedek yükleme içeriyor, üstelik yalnız Türkçe. Mağaza incelemesinde de "geliştirici özelliği" gerekçesiyle sorun çıkarabilir.
- **Düzeltme:** satır `{__DEV__ ? … : null}` içine alındı; `initialTab: "debug"` yolu yalnız `__DEV__`'de gezinir. Bekçi test `__tests__/devToolsReleaseGate.test.js`: `UsageDebugScreen`'e giden her `navigate` çağrısı `__DEV__` arkasında olmalı. Negatif kontrol: düzeltme geri alınınca iki girişi de yakalayıp düşüyor.
- **Not:** önizleme APK'ları da release kipinde derlenir, onlarda da artık görünmez. Önizleme build'inde de istenirse kapı EAS kanalına (`production` dışı) bağlanabilir.
- **Not:** bugün kuyruğa giren APK (`7e918a58`, commit `e675082`) bu düzeltmeden **önce** başladı; onda Debug satırı hâlâ görünür.
- **Durum:** düzeltildi (commit bekliyor).

### [Orta] Fonksiyon bağımlılıklarında yamalı açıklar
- `functions` altında 15 uyarı: 1 kritik (`proxy-addr`), 5 yüksek (`body-parser`, `@fastify/busboy`, `@grpc/grpc-js`, `brace-expansion`, `fast-xml-parser`), 9 orta (`qs`, `express`, `firebase-admin` zinciri…). **Hepsi sürüm atlamadan kapanıyor** (`fixAvailable: true`).
- Çalışma anında en ilgili olanlar: herkese açık `revenueCatWebhook` adresine gelen isteği ayrıştıran `qs` ve `body-parser` (bozuk istekle CPU tüketimi). `proxy-addr` yalnız `req.ip`'ye güvenen kodda önemli; bizde webhook yetki başlığıyla doğrulanıyor.
- Ayrıca CLI uyarısı: `firebase-functions` 7.3.0 → 7.4.0, `firebase-admin` 14.1.0 → 14.5.0.
- **Öneri:** `functions` içinde `npm audit fix` (zorlamasız) + bu iki paketin küçük sürüm yükseltmesi → fonksiyon birim + emülatör entegrasyon testleri → **tüm fonksiyonların** tek deploy'u (onay ister; `cleanupDeliveredCineRoom` `retry: true` olduğu için `--force`). Bu deploy, T0.2'deki "eski kaynak hâlinden çalışan 7 fonksiyon" kalemini de kapatır.
- **Durum:** düzeltildi (25 Eki): `firebase-functions` 7.4.0, `firebase-admin` 14.5.0 + `npm audit fix` → 0 açık; testler yeşil. Deploy bekliyor (T1.1 düzeltmeleriyle birlikte).

### [Düşük] Uygulama bağımlılıkları
29 uyarı (1 kritik, 17 yüksek, 11 orta). `npm audit`'in önerdiği "düzeltmeler" (`expo@44`, `firebase@9.14`) yıllar geriye sürüm düşürme; **uygulanmaz**. Ayrıştırma:
- **Telefona giden ve düzeltmeye değer:** `axios` (yüksek, doğrudan bağımlılık, TMDB çağrıları; 1.x içinde yamalı sürüm var). Saf JS, OTA ile gidebilir.
- **Telefona giden, düzeltmesi yok:** `markdown-it` / `linkify-it` (`react-native-markdown-display` üzerinden, AI cevaplarını çiziyor). Etki: aşırı uzun bozuk girdide yavaşlama; AI cevabı sunucudan geldiği için risk düşük.
- **Telefona giden, düzeltmesi var:** `query-string` / `decode-uri-component` (`@react-navigation/core` üzerinden, derin bağlantı ayrıştırma).
- **Yalnız derleme araçları (telefona gitmez):** `@expo/cli`, `xcode`, `@expo/config-plugins`, `node-forge`, `shell-quote` (kritik olan bu), `zod`, `brace-expansion`, `@xmldom/xmldom`, `uuid`, `moment` yerel ayar yolu.
- **Öneri:** yalnız `axios` ve `@react-navigation` yama sürümleri; derleme araçlarına yayından önce dokunma (EAS kilit dosyası riski, bkz. kökteki `.npmrc` notu).

### [Düşük] Firebase istemci anahtarlarına kısıt
Repoda üç Google API anahtarı var: `google-services.json` (Android), `GoogleService-Info.plist` (iOS), `website/site-config.js` (site, bekleme listesi). Üçü de Firebase istemci anahtarı; uygulamaya gömülü olmaları normal, sır değil. Sertleştirme önerisi (panel işi, T5'e): Google Cloud Console'da anahtar kısıtları — Android anahtarı paket adı + SHA, iOS anahtarı bundle id, web anahtarı `seelogd.com` yönlendiricisi ve yalnız gereken API'ler.

### [Düşük] Sessiz catch'ler
372 adet, 172 dosyada: 132 boş `catch {}`, 60 yalnız `console` yazan, 180 boş `.catch(() => {})`. Çoğu bilinçli (önbellek, titreşim, en-iyi-çaba temizlik). Hata görünmez kaldığında kullanıcıyı etkileyebilecek adaylar (T1.1 incelemesinde alan alan bakılacak, gerekenler `captureError`'a bağlanacak):
- Giriş: `screens/auth/LoginScreen.js` (6), `services/googleAuthService.js` (7), `services/appleAuthService.js` (4)
- Bildirim: `services/pushNotificationsService.js` (7), `services/socialNotificationsService.js` (4)
- Hesap: `services/accountService.js` (4)
- UGC: `components/Comment.js` (12), `services/postsService.js` (6), `context/PostsContext.js` (6)
- Sohbet: `screens/chat/ChatScreen.js` (9)

---

## Yanlış alarmlar (kayıt için)

- **`StyleSheet.absoluteFillObject`:** RN 0.86.3 bu alanı artık sağlamıyor ve uygulamada 15 yerde kullanılıyor. Ama `index.js`, uygulama yüklenmeden önce `utils/styleSheetCompat.js` ile alanı geri koyuyor (testi `__tests__/styleSheetCompat.test.js`). Hata değil. İsteğe bağlı temizlik: 15 kullanımı `absoluteFill`'e çevirip yamaya bağımlılığı azaltmak.
- **Tip taraması:** 27 bin satırlık çıktı `TS2304/2551/2305/2554`'e süzüldü (106 satır). Hepsi şu sınıflardan: `createContext()` varsayılanı (bağlamlar, `openQuickActions`), dinamik eklenen alanlar (`suffixRankTier` ile `borderColorMovie/Tv`, sahne oyunu günlük seri alanları), JSDoc tipleri (`DocumentSnapshot`, `Card`), varsayılanı olmayan isteğe bağlı parametreler. `__getValue` RN 0.86'da hâlâ var.
- **Ham metin taraması:** 885 dosya Babel ile tarandı. Dil seçen üçlü ifadeler (`tr ? … : es ? …`), 5 dilli yardımcı çağrılar, dil tabloları, `i18nText` ve `fallback` değerleri ayıklandı. Kalan 305 eşleşmeden örneklenenlerin hepsi yedek metin veya dil tablosu çıktı. Tam doğrulama T3'teki dil turunda (en/es/pt/de ekranlarına bakarak) yapılır.
- **Sır taraması:** `.env.example` içindeki 4 değer RevenueCat'in açık SDK anahtarları (`goog_`, `appl_`, test) ve entitlement kimliği, tasarım gereği açık. Git geçmişinde `sk_live` / `sk_test` yok. `.jks` dosyası `.gitignore`'da, izlenmiyor.

## Kullanılan geçici araçlar

Tip taraması için geçici `tsconfig.tmp-check.json` (silindi). Sessiz catch ve ham metin tarayıcıları oturumun geçici klasöründe, repoya girmedi.
