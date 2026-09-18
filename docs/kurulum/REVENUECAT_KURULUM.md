# RevenueCat kurulum ve yayın kontrol listesi

Uygulama tarafı `react-native-purchases` ve `react-native-purchases-ui` 10.4.4
ile entegredir. Firebase UID, RevenueCat App User ID olarak kullanılır.

## 1. Ortam anahtarları

Geliştirme `.env` dosyası:

```text
EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=test_...
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID="com.smlztrk.seelogd Pro"
```

Production/EAS ortamı:

```text
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID="com.smlztrk.seelogd Pro"
```

14 Ağustos 2026 itibarıyla Android ve iOS public SDK anahtarları ile entitlement
EAS production ortamında tanımlıdır. Anahtar değerleri kaynak koda yazılmaz;
ortamda bulunup bulunmadıkları `eas env:list production` ile doğrulanır.

Kod `test_...` anahtarını yalnız `__DEV__` build'lerde seçer. Release build'de
platforma ait `goog_...` veya `appl_...` anahtarı zorunludur. Test Store
anahtarıyla mağazaya uygulama gönderilmemelidir. Public SDK anahtarları istemci
içindir; RevenueCat secret API key'i hiçbir zaman `EXPO_PUBLIC_` değişkenine
yazılmaz.

## 2. RevenueCat ürün kataloğu

RevenueCat > Product catalog altında Test Store için bu dört ürünü oluştur:

| Gösterim           | Product ID         | Süre  | Uygulama seviyesi |
| ------------------ | ------------------ | ----- | ----------------- |
| Premium            | `monthly_2`        | 1 ay  | Premium           |
| Premium Yıllık     | `yearly`           | 1 yıl | Premium           |
| Premium Max        | `monthly`          | 1 ay  | Premium Max       |
| Premium Max Yıllık | `unlimited_yearly` | 1 yıl | Premium Max       |

Tek entitlement oluştur:

```text
com.smlztrk.seelogd Pro
```

Dört ürünün tamamını bu entitlement'a bağla. Uygulama aktif entitlement'ın
`productIdentifier` alanını okuyarak `monthly` ve `unlimited_yearly` ürünlerini
kullanıcıya Premium Max olarak gösterir; teknik planda bunlar geriye dönük
uyumluluk için `unlimited` anahtarına eşlenir. `monthly_2` ve `yearly` ürünleri
Premium olarak sınıflandırılır.

`default` adında bir Offering oluştur, Current olarak işaretle ve dört custom
package ekle:

- `premium_monthly` -> `monthly_2`
- `premium_yearly` -> `yearly`
- `unlimited_monthly` -> `monthly`
- `unlimited_yearly` -> `unlimited_yearly`

RevenueCat Paywalls editöründe `default` offering için dört paketi içeren bir
paywall oluşturup Publish et. Uygulamadaki “RevenueCat ödeme ekranını aç”
butonu bu uzaktan yönetilen paywall'ı gösterir; tasarım ve metin güncellemeleri
uygulama sürümü çıkarmadan yapılabilir.

## 3. Gerçek mağazalar

- Android uygulaması/package adı: `com.smlztrk.seelogd`.
- iOS bundle ID, App Store Connect kaydıyla birebir aynı olmalı.
- Google Play Console ve App Store Connect'te aynı ürün kimliklerini oluştur.
- Ürünleri RevenueCat'e import edip Test Store ürünleriyle aynı offering/package
  düzenine bağla.

Önerilen lansman fiyatları (22 Temmuz 2026 araştırması):

| Ürün                                  |   Türkiye | Global (ABD taban) |
| ------------------------------------- | --------: | -----------------: |
| Premium aylık (`monthly_2`)           |    ₺79,99 |              $3.99 |
| Premium yıllık (`yearly`)             |   ₺599,99 |             $29.99 |
| Premium Max aylık (`monthly`)           |   ₺159,99 |              $7.99 |
| Premium Max yıllık (`unlimited_yearly`) | ₺1.199,99 |             $59.99 |

Bu yapı her iki yıllık planda da 12 aylık ödemeye göre yaklaşık `%37` gerçek
avantaj sağlar. Fiyatları Google Play Console ve App Store Connect'te bu şekilde
tanımla; sonra ürünleri RevenueCat'e yeniden içe aktar/senkronize et. Uygulama
fiyatı sabitlemez, mağazadan gelen yerelleştirilmiş `priceString` değerini
gösterir. İndirim oranı ve üzeri çizili referans fiyat da aynı plandaki gerçek
aylık ve yıllık mağaza fiyatları karşılaştırılarak dinamik hesaplanır; aylık
pakette sahte indirim gösterilmez.

- App Store/Play server notification entegrasyonlarını RevenueCat panelinden
  tamamla.

## 4. Customer Center

RevenueCat > Customer Center alanında merkezi yayınla. Aktif aboneler için
“Aboneliği yönet” butonu Customer Center'ı açar. Restore, plan değiştirme,
iptal/geri bildirim ve mağaza abonelik yönetimi burada ele alınır. Customer
Center henüz yayınlanmamışsa uygulama `managementURL`/mağaza abonelik ekranına
geri düşer.

## 5. Firebase webhook

Secret'leri tanımla ve deploy et:

```powershell
firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH
firebase functions:secrets:set REVENUECAT_SECRET_API_KEY
firebase deploy --only functions:revenueCatWebhook,functions:syncPremiumStatus,functions:dailyStreamingAvailability
firebase deploy --only firestore:rules
```

RevenueCat > Integrations > Webhooks alanında function URL'sini ekle.
Authorization header değeri, `REVENUECAT_WEBHOOK_AUTH` secret'ıyla aynı olmalı.
`REVENUECAT_SECRET_API_KEY` için RevenueCat secret v1 API key kullanılır.

Webhook aboneliği RevenueCat'ten yeniden okur ve iki belgeye yazar:

- `Users/{firebaseUid}.entitlements` — herkese açık profil belgesi, yalnız
  plan: `premium`, `premiumUnlimited`, `premiumPlan`. AI kotası ve arkadaş
  profilindeki kimlik rozeti bunu okur.
- `Users/{firebaseUid}/private/entitlements` — yalnız sahibi okur: ürün,
  mağaza, bitiş tarihi. (Eskiden bu ayrıntılar herkese açık belgedeydi; ilk
  yazımda oradan silinir.)

İki alanı da istemci yazamaz (`firestore.rules`); `badges` (kurucu rozeti)
de aynı şekilde sunucuya aittir. Silinmiş hesaba gecikmeli gelen olay
sahipsiz `Users` belgesi yaratmaz.

`syncPremiumStatus` (callable) aynı okumayı istemcinin isteğiyle yapar:
`PremiumContext`, RevenueCat planı ile sunucu planı ayrıştığında çağırır
(satın alma webhook'tan önce geldi, webhook kaçtı, iade oldu). Sunucu
istemcinin söylediğine güvenmez, RevenueCat'e kendisi sorar; kullanıcı başına
15 saniyede bir. Böylece webhook paneli henüz kurulmamışken bile satın alan
kullanıcı AI kotasında yeni planını görür.

Free kullanıcıda AI kotası 5/gün ve 30/ay, Premium'da 20/gün ve 300/ay,
Premium Max'te 50/gün ve 900/aydır.

## 6. Uygulama akışı

- SDK, oturum açmış Firebase kullanıcısının UID'siyle bir kez configure edilir.
- Kullanıcı değişirse `Purchases.logIn(uid)`, çıkışta `Purchases.logOut()` çağrılır.
- `getCustomerInfo()` ve `getOfferings()` birlikte yüklenir.
- CustomerInfo listener satın alma/restore/yenileme değişikliklerini anında
  context'e taşır.
- Manuel package satın alma ve RevenueCat Paywall birlikte desteklenir.
- **Android plan değişimi:** aktif bir Play aboneliği varken başka ürün
  alınırsa satın alma `productChangeInfo` ile ÜRÜN DEĞİŞİMİ olarak gönderilir
  (`utils/premium.js` → `getStoreProductChange`). Aksi halde Google Play
  ikinci, bağımsız bir abonelik açar ve kullanıcı iki kez ödeme yapar. Üst
  plana / yıllığa geçiş anında olur (kalan süre orantılı iade), alt plana /
  aylığa geçiş dönem sonunda. iOS'ta dört ürün AYNI abonelik grubunda
  olmalı; o zaman değişimi App Store kendisi yönetir.
- Kullanıcının iptali hemen erişimi kapatmaz; entitlement aktif olduğu sürece
  erişim devam eder.
- **Etkin plan** RevenueCat planı ile sunucu planının yükseğidir. RevenueCat
  cevabı beklenirken son bilinen plan (`services/premiumState.js`, diskte)
  kullanılır; premium kullanıcı açılışta bir anlığına kilit ya da varsayılan
  tema görmez.

## 6.1 Premium yetkileri (kapılar)

Tek kaynak `utils/premiumFeatures.js`: her özelliğin plan başına limiti VE
ödeme ekranında görünen metni oradadır. Ödeme ekranındaki karşılaştırma,
Ayarlar kartı ve limit uyarıları bu kayıttan üretilir — kaydı olmayan bir
şey satılamaz, kayıttaki her şeyin bir kapısı vardır.

| Özellik | Free | Premium | Max | Kapı |
| --- | --- | --- | --- | --- |
| CineMatch AI | 5/gün · 30/ay | 20 · 300 | 50 · 900 | Sunucu (`callGemini`) |
| Kimlik rozeti (arkadaş profilinde de) | — | Epik | Efsanevi | Sunucu alanı |
| Arkadaş (istek gönderme) | 30 | 150 | Sınırsız | `FriendsContext.sendRequest` |
| Sohbet grubu kurma | 2 | 10 | Sınırsız | `CreateGroupScreen` |
| Özel liste | 5 | 25 | Sınırsız | `ListsViewScreen`, `CreateListModal`, CineSwipe |
| Ortak liste kurma | 2 | 10 | Sınırsız | `CreateSharedListModal`, CineSwipe |
| Sahne tahmin oyunu | 5/gün | 20/gün | Sınırsız | `useSceneGame` |
| CineSwipe oda kurma | 2/gün | 10/gün | Sınırsız | `CineSwipeScreen` |
| CineSwipe tek başına | 60 kart/gün | 300/gün | Sınırsız | `CineSwipeScreen` |
| Özel tema oluşturma | 8 hazır tema | ✓ | ✓ | `SettingsTheme`, `ThemeContext` |
| Yazı tipi kataloğu | 7 font | 56 font | 56 font | `FontSettingsSection`, `typographySettings` |
| Platform bildirimi | 10 başlık | 100 | 100 | Sunucu (`dailyStreamingAvailability`) |
| Wrapped arşivi | Bu yıl + geçen yıl | Tüm yıllar | Tüm yıllar | `WrappedScreen`, `HubWrappedModule` |

Kurallar:

- **İşi başlatan sayılır:** isteği kabul etmek, odaya / gruba / ortak listeye
  katılmak, mesaj almak hiçbir kapıdan geçmez. Premium kullanıcı Free
  arkadaşlarıyla engelsiz etkileşir.
- **Abonelik bitince veri silinmez:** fazla listeler ve arkadaşlar kalır,
  yalnız yenisi engellenir. Özel tema ve premium font seçimi saklanır ama
  varsayılan tema / sistem fontu çizilir; abonelik yenilenince kendiliğinden
  geri gelir.
- **Maliyetli ve başkalarına görünen özellikler sunucuda** (AI, platform
  bildirimi, rozet). Kozmetik ve sayı limitleri istemcide; günlük haklar
  cihazda sayılır (`services/premiumUsage.js`). Uygulama verisini silen
  bugünkü hakkını sıfırlayabilir — bu özelliklerin sunucu maliyeti düşük
  olduğu için bilinçli tercih.
- Limitler değişecekse: `utils/premiumFeatures.js` + sunucu aynası
  (`functions/aiQuota.js`, `functions/planCapabilities.js`) birlikte;
  `__tests__/premiumFeatures.test.js` ayrışmayı yakalar. Ardından
  `store/play/*/full-description.txt`, `website/terms.html` ve RevenueCat
  panelindeki paywall metnini güncelle.
- Analytics: kapıya takılma `premium_gate_hit` (`feature`, `plan`), ödeme
  ekranı görüntüleme `paywall_view` (`source` = kapının özellik kimliği).

## 7. Test matrisi

- Expo Go yerine yeni bir development build/APK kullan.
- Test Store'da başarı, kullanıcı iptali ve hata sonuçlarını ayrı dene.
- `monthly_2`, `yearly`, `monthly` ve `unlimited_yearly` ürünlerinin doğru planı
  açtığını doğrula.
- Purchase, restore, Premium -> Premium Max geçişi, expiration ve hesap değiştirme
  akışlarını test et.
- Android'de Premium → Premium Max geçişinden sonra Play Store abonelik
  listesinde TEK abonelik kaldığını doğrula (çift abonelik açılmamalı).
- Satın almadan hemen sonra AI sohbetinde kotanın yeni plana geçtiğini
  doğrula (`syncPremiumStatus`; webhook beklenmez).
- Her kapı için: Free'de limitte uyarı + "Planları gör" → ödeme ekranı
  özelliği gösterir; Premium'da limit yükselir; Max'te sınırsız.
- Abonelik bitince: özel tema/font varsayılana döner, yeniden abone olunca
  geri gelir; mevcut listeler/arkadaşlar silinmez.
- Production öncesinde Test Store anahtarını kaldır; gerçek platform anahtarları
  ve mağaza sandbox/internal testing ile son testleri yap.
