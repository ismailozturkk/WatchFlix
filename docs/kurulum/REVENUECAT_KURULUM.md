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

Kod `test_...` anahtarını yalnız `__DEV__` build'lerde seçer. Release build'de
platforma ait `goog_...` veya `appl_...` anahtarı zorunludur. Test Store
anahtarıyla mağazaya uygulama gönderilmemelidir. Public SDK anahtarları istemci
içindir; RevenueCat secret API key'i hiçbir zaman `EXPO_PUBLIC_` değişkenine
yazılmaz.

## 2. RevenueCat ürün kataloğu

RevenueCat > Product catalog altında Test Store için bu dört ürünü oluştur:

| Gösterim          | Product ID         | Süre  | Uygulama seviyesi |
| ----------------- | ------------------ | ----- | ----------------- |
| Premium           | `monthly_2`        | 1 ay  | Premium           |
| Yearly            | `yearly`           | 1 yıl | Premium           |
| Premium Unlimited | `monthly`          | 1 ay  | Unlimited         |
| Unlimited Yearly  | `unlimited_yearly` | 1 yıl | Unlimited         |

Tek entitlement oluştur:

```text
com.smlztrk.seelogd Pro
```

Dört ürünün tamamını bu entitlement'a bağla. Uygulama aktif entitlement'ın
`productIdentifier` alanını okuyarak `monthly` ve `unlimited_yearly` ürünlerini
Unlimited, `monthly_2` ve `yearly` ürünlerini Premium olarak sınıflandırır.

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
| Unlimited aylık (`monthly`)           |   ₺159,99 |              $7.99 |
| Unlimited yıllık (`unlimited_yearly`) | ₺1.199,99 |             $59.99 |

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
firebase deploy --only functions:revenueCatWebhook
firebase deploy --only firestore:rules
```

RevenueCat > Integrations > Webhooks alanında function URL'sini ekle.
Authorization header değeri, `REVENUECAT_WEBHOOK_AUTH` secret'ıyla aynı olmalı.
`REVENUECAT_SECRET_API_KEY` için RevenueCat secret v1 API key kullanılır.

Webhook `Users/{firebaseUid}.entitlements` altında `premium`,
`premiumUnlimited`, `premiumPlan`, ürün ve bitiş bilgilerini günceller. Free
kullanıcıda AI kotası 5/gün, Premium'da 100/gün, Unlimited'da günlük sayaç
uygulanmaz.

## 6. Uygulama akışı

- SDK, oturum açmış Firebase kullanıcısının UID'siyle bir kez configure edilir.
- Kullanıcı değişirse `Purchases.logIn(uid)`, çıkışta `Purchases.logOut()` çağrılır.
- `getCustomerInfo()` ve `getOfferings()` birlikte yüklenir.
- CustomerInfo listener satın alma/restore/yenileme değişikliklerini anında
  context'e taşır.
- Manuel package satın alma ve RevenueCat Paywall birlikte desteklenir.
- Kullanıcının iptali hemen erişimi kapatmaz; entitlement aktif olduğu sürece
  erişim devam eder.

## 7. Test matrisi

- Expo Go yerine yeni bir development build/APK kullan.
- Test Store'da başarı, kullanıcı iptali ve hata sonuçlarını ayrı dene.
- `monthly_2`, `yearly`, `monthly` ve `unlimited_yearly` ürünlerinin doğru planı
  açtığını doğrula.
- Purchase, restore, Premium -> Unlimited geçişi, expiration ve hesap değiştirme
  akışlarını test et.
- Production öncesinde Test Store anahtarını kaldır; gerçek platform anahtarları
  ve mağaza sandbox/internal testing ile son testleri yap.
