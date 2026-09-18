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

Ürün kimlikleri 19 Eylül 2026'da yeniden kuruldu; Play, App Store ve Test
Store'da AYNI kimlikler kullanılır. Mağaza kimliği bir kez oluşturulunca
değişmez ve silinse de yeniden kullanılamaz; plan kimlikten okunduğu için adı
planı söyler:

| Gösterim           | Product ID        | Play base plan | Süre  | Uygulama seviyesi |
| ------------------ | ----------------- | -------------- | ----- | ----------------- |
| Premium            | `premium_monthly` | `p1m`          | 1 ay  | Premium           |
| Premium Yıllık     | `premium_yearly`  | `p1y`          | 1 yıl | Premium           |
| Premium Max        | `max_monthly`     | `p1m`          | 1 ay  | Premium Max       |
| Premium Max Yıllık | `max_yearly`      | `p1y`          | 1 yıl | Premium Max       |

Play'de her ürün ayrı bir abonelik, içinde tek base plan; RevenueCat Play
kimliğini `premium_monthly:p1m` olarak verir, kod `:` sonrasını atar
(`baseProductIdentifier`).

Tek entitlement oluştur:

```text
com.smlztrk.seelogd Pro
```

Dört ürünün tamamını bu entitlement'a bağla. Uygulama aktif entitlement'ın
`productIdentifier` alanını okuyarak `max_*` ürünlerini Premium Max
(teknik planda `unlimited`), `premium_*` ürünlerini Premium sayar
(`utils/premium.js`, sunucu aynası `functions/revenueCatWebhook.js`).

**Eski kimlikler:** `monthly_2`, `yearly` (Premium), `monthly`,
`unlimited_yearly` (Max) Eylül 2026'ya kadar yalnız Test Store'da vardı, gerçek
satış olmadı. Kod test abonelikleri bitene kadar bunları da tanır; sonra iki
yerdeki `LEGACY`/eski kimlik listeleri silinir.

`default` adında bir Offering oluştur, Current olarak işaretle ve dört custom
package ekle (paket kimliği = ürün kimliği):

- `premium_monthly` -> `premium_monthly`
- `premium_yearly` -> `premium_yearly`
- `max_monthly` -> `max_monthly`
- `max_yearly` -> `max_yearly`

Offering'i yeni ürünlere ancak yeni kimlikleri tanıyan uygulama sürümü ve
webhook yayındayken çevir: eski sürüm `max_monthly`'yi tanımaz ve Max alana
Premium verir.

RevenueCat Paywalls editöründe paywall KURULMAZ: tek ödeme ekranı uygulamanın
kendi `PremiumScreen`'idir ve metnini `utils/premiumFeatures.js`'ten üretir.
Eskiden PremiumScreen'deki “Alternatif Güvenli Ödeme Ekranı” butonu
RevenueCatUI paywall'ını açıyordu; 18 Eylül 2026'da kaldırıldı. Panelde paywall
yayında değildi (RevenueCat'in özelliksiz varsayılan ekranı görünüyordu), buton
paketler yüklenemeyince zaten devre dışıydı ve panelde ikinci bir vaat metni
tutmak P0.2'deki ayrışmayı geri getirirdi. RevenueCat Paywalls/A-B testi
ileride istenirse metin registry'den elle aktarılır ve Android'de ürün
değişiminin tek abonelikle kaldığı ayrıca test edilir.

## 3. Gerçek mağazalar

- Android uygulaması/package adı: `com.smlztrk.seelogd`.
- iOS bundle ID, App Store Connect kaydıyla birebir aynı olmalı.
- Google Play Console ve App Store Connect'te aynı ürün kimliklerini oluştur.
- Ürünleri RevenueCat'e import edip Test Store ürünleriyle aynı offering/package
  düzenine bağla.

Lansman fiyatları (19 Eylül 2026 kararı; önceki 22 Temmuz tablosu ₺79,99 /
$3.99 tabanlıydı):

| Ürün                                |    Türkiye | Global (ABD taban) |
| ----------------------------------- | ---------: | -----------------: |
| Premium aylık (`premium_monthly`)   |     ₺59,99 |              $1.99 |
| Premium yıllık (`premium_yearly`)   |    ₺449,99 |             $14.99 |
| Premium Max aylık (`max_monthly`)   |    ₺149,99 |              $4.99 |
| Premium Max yıllık (`max_yearly`)   |  ₺1.099,99 |             $34.99 |

Max, Premium'un 2,5 katı: TR'de ₺119,99'da (2 kat) net gelir ~₺85 kalırken
aylık 900 mesaj kotasını uzun sohbetlerle dolduran Max kullanıcısının Gemini
maliyeti ~₺88'e çıkıyordu (mesaj başı ölçülen ~$0,0007, yoğun ~$0,002; kur
48,8). Mağazaya fiyatı USD taban + Türkiye elle girilerek tanımla.

Yıllık planlar 12 aylık ödemeye göre yaklaşık `%37–42` avantaj sağlar. Fiyatları Google Play Console ve App Store Connect'te bu şekilde
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
- Satın alma yalnız `PremiumScreen` üzerinden, manuel package satın alma ile
  yapılır (RevenueCatUI yalnız Customer Center için kullanılır).
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
  `store/play/*/full-description.txt` ve `website/terms.html`'i güncelle
  (RevenueCat panelinde paywall yok, bkz. §2).
- Analytics: kapıya takılma `premium_gate_hit` (`feature`, `plan`), ödeme
  ekranı görüntüleme `paywall_view` (`source` = kapının özellik kimliği).

## 7. Test matrisi

- Expo Go yerine yeni bir development build/APK kullan.
- Test Store'da başarı, kullanıcı iptali ve hata sonuçlarını ayrı dene.
- `premium_monthly`, `premium_yearly`, `max_monthly` ve `max_yearly` ürünlerinin doğru planı
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
