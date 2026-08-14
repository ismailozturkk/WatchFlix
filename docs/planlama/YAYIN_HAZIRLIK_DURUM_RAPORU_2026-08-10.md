# SEELOGD YAYIN HAZIRLIK DURUM RAPORU

> Denetim tarihi: 10 Ağustos 2026
> Denetlenen sürüm: `1.4.3`
> Denetlenen dal: `checkpoint/oyun-ve-bekleyen-isler-2026-06-26`
> Karar: **YAYINA HAZIR DEĞİL**
> Hedef okuyucu: Bu depoda görevleri uygulayacak bir yapay zekâ ve son kontrolleri yapacak ürün sahibi.

Bu belge, 8 Ağustos tarihli `docs/planlama/YAYIN_ONCESI_AI_GOREV_PLANI.md` dosyasının yerine geçmez. O dosyadaki tamamlanan işlerden sonra oluşan **güncel çalışma ağacını ve mağaza kapılarını** yeniden denetler. Çelişki varsa bu belgedeki 10 Ağustos 2026 bulguları güncel durum kabul edilmelidir.

---

## 1. Kısa karar

Uygulamanın JavaScript ve Android derleme tabanı güçlüdür: 974 birim testi geçiyor, Expo Doctor 20/20, Android üretim Metro paketi oluşuyor ve Kotlin derlemesi başarılı. Android hedef API 36'dır. Hesap silme, kullanıcı engelleme, içerik şikâyeti ve canlı yasal sayfalar mevcuttur.

Ancak aşağıdaki konular çözülmeden mağazaya üretim sürümü gönderilmemelidir:

1. Çalışma ağacı 65 değişiklik içeriyor; yayınlanacak kaynak tekrarlanabilir ve incelemesi bitmiş bir commit değil.
2. Ücretli plan ekranındaki vaatler gerçek sunucu kotaları ve özellik kapılarıyla uyuşmuyor.
3. iOS üretim yapılandırması eksik: Apple Team ID yok, RevenueCat iOS anahtarı yok, Google iOS yapılandırması yok ve Apple'ın Login Services kuralını karşılayacak eşdeğer özel giriş seçeneği uygulanmamış.
4. Firestore güvenlik test komutu yerel Firebase CLI bulunmadığı için testleri çalıştırmadan başarılı görünebiliyor.
5. Android paketi reklam kimliği izinlerini ekliyor; canlı gizlilik politikası reklam kimliği toplanmadığını söylüyor.
6. App Check istemcisi var fakat AI Cloud Function üzerinde zorunlu değil; kötüye kullanım ve Gemini maliyet riski devam ediyor.
7. Gerçek imzalı Android/iOS build üzerinde Google giriş, satın alma, geri yükleme, bildirim, widget ve hesap silme uçtan uca kanıtlanmadı.
8. App Store varlıkları/metadata paketi yok; Play Store'da yalnız Türkçe ekran görüntüleri var.

Bu nedenle doğru sonraki hedef doğrudan production değil, önce **temiz bir release candidate**, ardından Play Internal/Closed Testing ve TestFlight'tır.

---

## 2. Denetimde doğrulananlar

| Alan | Sonuç | Kanıt |
|---|---|---|
| Birim testleri | Geçti | 69 suite, 974 test, 0 hata |
| Expo uyumluluğu | Geçti | `npx expo-doctor`: 20/20 |
| Android JS paketi | Geçti | production modunda `expo export --platform android`, 3.749 modül |
| Android native derleme | Geçti | `:app:compileDebugKotlin`, BUILD SUCCESSFUL |
| Android API seviyesi | Uygun | min 24, compile/target 36 |
| Yasal URL'ler | Canlı | privacy, terms ve delete-account URL'leri HTTP 200 |
| Hesap silme UI/servisi | Var | `EditProfileScreen.js` + `services/accountService.js` |
| UGC güvenlik araçları | Var | gönderi/yorum/mesaj/kullanıcı şikâyeti ve kullanıcı engelleme akışları |
| TMDB/JustWatch beyanı | Var | Hakkında ekranı ve Play açıklamaları |
| OTA uyumluluğu | İyi temel | `runtimeVersion.policy = fingerprint`, production channel tanımlı |
| Android mağaza varlıkları | Kısmen hazır | 512 ikon, 1024x500 TR/EN feature graphic, 8 adet TR 1080x1920 ekran görüntüsü |

Bu kontroller gerçek mağaza satın almasını, OAuth imzasını, APNs/FCM teslimini, cihaz widget'ını veya App Store incelemesini kanıtlamaz.

---

## 3. P0 — Yayın öncesi zorunlu bloklar

### P0.1 — Çalışma ağacını yayınlanabilir hâle getir

**Kanıt:** `git status --porcelain` 65 değiştirilmiş/yeni dosya gösteriyor. Bunlar fragman dili, onboarding, cache, widget, not/to-do, grafik, skeleton, çeviri ve detay ekranı gibi birbirinden farklı temaları içeriyor.

**Risk:** Build yeniden üretilemez; hangi özelliğin test edildiği ile hangi özelliğin mağazaya gittiği belli olmaz. Hızlı geri dönüş ve hata ayıklama zorlaşır.

**AI görevi:**

1. Kullanıcının değişikliklerini silme, resetleme veya geri alma.
2. `git diff --stat`, `git diff --check` ve tema bazlı diff incelemesi yap.
3. Değişiklikleri davranış temalarına ayır; her tema için ilgili testi doğrula.
4. Kullanıcı onayı olmadan push, merge, EAS build veya deploy yapma.
5. Yayın adayı için temiz bir commit/tag üretilecek şekilde kullanıcıya commit planı sun.

**Kabul:** `git diff --check` temiz, tüm değişiklikler gözden geçirilmiş, testler yeşil, yayınlanacak commit SHA sabit ve çalışma ağacı temiz.

### P0.2 — Premium vaatlerini gerçek yetkilerle eşleştir

**Kanıt:** `screens/premium/PremiumScreen.js` şu vaatleri gösteriyor:

- Premium: günde 100 AI mesajı, gelişmiş istatistikler, tüm Wrapped yılları, özel temalar, premium oyun modları.
- Unlimited: sınırsız AI, sınırsız liste/not/hatırlatıcı ve tüm Premium özellikleri.

Gerçek sunucu kotası `functions/aiQuota.js` içinde Free `5/30`, Premium `20/300`, Unlimited `50/900`. Unlimited teknik olarak sınırsız değil. Kod aramasında `isPremium/isUnlimited` kullanımı çoğunlukla Premium/Profile/Settings sunumunda; vaat edilen tema, istatistik, Wrapped, oyun, liste, not ve hatırlatıcı kapılarının merkezi uygulanması görünmüyor. `AboutAppScreen.js` ayrıca “reklamsız”, “sınırsız AI” ve “gelişmiş analitik” diyor; uygulamada zaten reklam ağı yok.

**Risk:** Kullanıcı ödeme yapıp vaat edilen farkı alamayabilir. Bu, iade/şikâyet ve Apple/Google yanıltıcı metadata veya abonelik reddi riskidir.

**Ürün sahibi kararı gerekir:**

- Seçenek A: Gerçek ürün davranışını vaatlere yükselt.
- Seçenek B: Premium metinlerini mevcut davranışa indir.

**AI görevi:**

1. Tek bir `planCapabilities`/quota kaynağı oluştur; istemci ve Functions aynı değerleri kullansın veya doğrulayan test ekle.
2. Her ücretli iddia için “ekran → kapı → sunucu doğrulaması → test” matrisi çıkar.
3. Yalnız istemci UI kilidi kullanma; maliyet veya yetki taşıyan özellikleri sunucuda da doğrula.
4. Unlimited sınırlı kalacaksa “sınırsız” sözcüğünü her yerden kaldır ve gerçek limitleri açıkla.
5. Reklam hiç yoksa “reklamsız”ı ücretli fayda olarak sunma.
6. Play/App Store açıklaması, Premium ekranı, Hakkında ve RevenueCat offering metinlerini aynılaştır.

**Kabul:** Satın alma öncesi görünen her vaat ölçülebilir ve gerçekten açılıyor; Free/Premium/Unlimited test matrisi geçiyor; mağaza metadata'sı aynı gerçeği anlatıyor.

**Durum (12 Ağustos 2026): Kod ve yerel metadata tamam.** Üst planın kullanıcıya
görünen adı Premium Max oldu; teknik `unlimited` anahtarı mevcut aboneliklerle
uyumluluk için korundu. Uygulama, Hakkında, TR/EN Play metinleri ve şartlarda
Free `5/30`, Premium `20/300`, Premium Max `50/900` limitleri açıklandı;
uygulanmayan ücretli özellik vaatleri kaldırıldı. İstemci/sunucu kota eşitliği
testle güvenceye alındı. RevenueCat panelindeki offering/paywall metni mağaza
ürünleri kurulurken ayrıca Premium Max olarak güncellenmelidir.

### P0.3 — iOS kimlik ve imza yapılandırmasını tamamla

**Kanıt:**

- `app.json` içindeki `ios.appleTeamId`, 14 Ağustos 2026'da kullanıcıdan alınan
  `KN77DDXC9U` değeriyle tamamlandı. Apple targets eklentisi bu değeri ana
  uygulama ve ReminderWidget hedefinin imza ayarına aktarır; production iOS
  build ve gerçek cihaz doğrulaması yine gereklidir.
- `GoogleService-Info.plist` depoda mevcut ve `app.json` içindeki
  `ios.googleServicesFile` alanına bağlıdır; gerçek cihaz Google OAuth testi
  yine production kimlik bilgileriyle yapılmalıdır.
- EAS production ortamında `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` ve `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` görünmüyor.
- `expo-apple-authentication` ve Sign in with Apple akışı yok.
- Uygulama Google ile girişi birincil hesap girişi olarak sunuyor.

Apple App Review Guideline 4.8, üçüncü taraf/sosyal giriş kullanan uygulamaların gizlilik özellikleri tanımlanmış eşdeğer bir giriş seçeneği sunmasını ister. En güvenli uygulama Sign in with Apple'dır: <https://developer.apple.com/app-store/review/guidelines/#login-services>

**AI görevi:**

1. Apple Team ID'yi kullanıcıdan/Apple Developer hesabından al; `app.json` içine ekle.
2. Sign in with Apple hesap yaşam döngüsünü uygula: giriş, ilk profil tamamlama, aynı e-posta/credential çakışması, hesap bağlama, reauth, çıkış ve hesap silerken token revoke.
3. iOS Google OAuth client/plist yapılandırmasını ekle; bundle ID tam olarak `com.smlztrk.seelogd` olmalı.
4. RevenueCat iOS public SDK anahtarını EAS production ortamına ekle.
5. Widget extension ve ana uygulama için App Group/Team/entitlement eşleşmesini macOS/Xcode veya EAS artifact üzerinde doğrula.

**Kabul:** Temiz production-profile iOS build oluşur; gerçek cihazda e-posta, Google ve Apple girişleri çalışır; hesap bağlama/silme testleri geçer; widget görünür; satın alma ve restore sandbox'ta çalışır.

### P0.4 — Güvenlik kuralı testlerinin false-green olmasını düzelt

**Kanıt:** `package.json` içindeki `test:rules` global `firebase` komutuna güveniyor; yerel `firebase-tools` devDependency değil. Mevcut ortamda komut emülatör/Jest çıktısı üretmeden exit 0 döndü. Doğrudan Jest çalıştırıldığında 41 test `127.0.0.1:8085` üzerinde emülatör olmadığı için başarısız oldu. Ayrıca test project ID'si `seelogd-rules-test`, `firebase.json` varsayılan proje ise farklı; önceki loglarda singleProjectMode uyarısı bulunuyor.

**AI görevi:**

1. Expo/Node sürümüyle uyumlu, sabitlenmiş `firebase-tools` sürümünü devDependency yap.
2. Script'i yerel binary kullanacak biçimde bırak (`npx`/npm zaten `node_modules/.bin`i tercih eder), ancak CLI bulunmazsa sessiz geçemeyecek bir ön kontrol ekle.
3. Emulator project ID ve test project ID stratejisini tekleştir veya `singleProjectMode: false` kararını açıkça yapılandır.
4. CI'da rules testini ayrı zorunlu job yap.

**Kabul:** Komut çıktısında Firestore emulator başlangıcı ve **41/41 test geçti** bilgisi görünür; emulator başlayamazsa exit code sıfır değildir.

### P0.5 — Reklam kimliği/gizlilik çelişkisini kaldır

**Kanıt:** Birleşik Android manifestinde şunlar var:

- `com.google.android.gms.permission.AD_ID`
- `android.permission.ACCESS_ADSERVICES_AD_ID`

Canlı gizlilik politikası Türkçe ve İngilizce olarak reklam kimliği toplanmadığını söylüyor. `store/README.md` ise Firebase Analytics'in Advertising ID eklediğinin Play Data Safety'de beyan edilmesini not etmiş.

**AI görevi:** Ürün sahibinin reklam/attribution ihtiyacına göre yalnız bir yol seç:

1. Reklam kimliği gerekmiyorsa `app.json.android.blockedPermissions` ile iki izni de çıkar; temiz production manifestte olmadığını doğrula; Firebase Analytics davranışını test et.
2. Gerekiyorsa gizlilik politikası, Play Data Safety ve App Store Privacy cevaplarını gerçek SDK davranışıyla güncelle; gerekli rıza/ATT akışını hukuki değerlendirmeyle ekle.

Ek veri minimizasyonu: Birleşik manifest CAMERA ve READ/WRITE_CALENDAR da içeriyor. Kodda `expo-calendar` kullanımı bulunmuyorsa paketi kaldır; yalnız galeri seçimi varsa CAMERA iznini engelle. Her iznin çalışan bir kullanıcı özelliği ve doğru purpose string'i olmalı.

**Kabul:** Production AAB/IPA izinleri, uygulama davranışı ve iki mağazadaki gizlilik beyanları birebir aynı.

### P0.6 — İmzalı release candidate ve gerçek cihaz matrisi

Statik kontroller şu özellikleri kanıtlamaz:

- Google OAuth için production SHA-1/SHA-256 ve iOS URL scheme.
- RevenueCat offering, entitlement, fiyat, satın alma, iptal, restore ve webhook.
- Play Integrity/App Attest token üretimi.
- APNs/FCM bildirim teslimi ve bildirimden deep link.
- Android launcher widget 3x2/4x2, iOS widget, 100 öğe sınırı ve yeniden başlatma sonrası durum.
- MMKV migration, offline cache, cold start ve eski sürümden yükseltme.

**Kabul matrisi:** En az Android 10/13/16; düşük ve normal bellekli cihaz; iPhone güncel iOS + bir önceki ana sürüm; iPad (çünkü `supportsTablet: true`); temiz kurulum ve 1.4.2→1.4.3 yükseltme. Her platformda smoke, auth, satın alma, push, widget, deep link, hesap silme ve offline açılış testleri kayda alınmalı.

---

## 4. P1 — Kapalı testten production'a geçmeden önce

### P1.1 — App Check'i aşamalı zorunlu yap

İstemci `@react-native-firebase/app-check` ile Play Integrity/App Attest köprüsü kuruyor; `functions/index.js` içindeki `callGemini` hâlâ `enforceAppCheck: false`.

1. Önce Preview/Production imzalı buildlerde geçerli token metriğini doğrula.
2. Debug tokenlarını yalnız geliştirme projelerine kaydet.
3. Functions, Firestore ve RTDB enforcement kapsamını kademeli aç; eski aktif sürümlerin kırılmasını izle.
4. `callGemini` için kullanıcı kotasına ek olarak App Check, timeout ve maliyet alarmı uygula.

**Kabul:** Sahte/unsigned istemci reddedilir; gerçek mağaza buildi etkilenmez; Gemini harcama alarmı ve günlük bütçe görünür.

### P1.2 — Bağımlılık güvenlik açıklarını triage et

`npm audit`: toplam 26 bulgu (15 high, 11 moderate); `--omit=dev`: 22 bulgu (12 high, 10 moderate), kritik yok. Doğrudan raporlananlar Expo, React Native, expo-sharing, expo-splash-screen, `@bacons/apple-targets` ve `react-native-markdown-display`.

`npm audit fix --force` çalıştırma; önerdiği Expo 53/RN 0.72 dönüşleri mevcut SDK 57 mimarisini bozar. Özellikle kullanıcı/AI kontrollü markdown işleyen `react-native-markdown-display` ve altındaki `markdown-it/linkify-it` DoS yolunu incele: cevap boyutu sınırı, render öncesi limit ve alternatif paket/patch değerlendir. Expo/RN toolchain advisories için Expo'nun uyumlu yamalı sürümünü bekle veya kontrollü SDK yükseltmesi yap.

**Kabul:** Her bulgu için runtime/build-time, erişilebilirlik, karar ve takip sürümü kayıtlı; kullanıcı kontrollü markdown için kötü niyetli büyük giriş testi var.

### P1.3 — UGC moderasyon operasyonunu tamamla

Uygulamada report/block mekanizmaları ve Firestore `PostReports`/`ContentReports` kuralları var. Ancak raporların zamanında inceleneceği bir yönetici kuyruğu, karar kaydı, içerik kaldırma/hesap yaptırımı ve SLA bu istemci deposunda kanıtlanmadı.

Apple, UGC için uygunsuz içerik filtreleme, raporlama, zamanında yanıt ve kötüye kullananı engelleme ister: <https://developer.apple.com/app-store/review/guidelines/#user-generated-content>

**AI görevi:** Admin-only moderasyon aracı veya güvenli script; rapor durumu; audit trail; içerik kaldırma; kullanıcı askıya alma; itiraz/iletişim; yaş derecelendirmesi ve review notes hazırlığı.

**Kabul:** Test raporu açıldığında sorumlu kişi bunu görür, karar verir, içerik istemcilerden kalkar ve işlem kaydı tutulur.

### P1.4 — Hesap silmeyi üçüncü taraflarla uçtan uca doğrula

İç uygulama silme akışı ve canlı web sayfası olumlu. Yine de şu matrisi gerçek hesaplarla test et:

- Email/password ve Google reauthentication.
- Eklenecek Apple hesabında token revoke.
- Firestore alt koleksiyonları, mesajlar, gönderiler, yorumlar, notlar, listeler, push tokenı ve UGC.
- RevenueCat customer/alias verisi ve aktif aboneliğin kullanıcıya açıklanması.
- Sentry/Analytics kullanıcı kimliği temizliği ve yasal saklama istisnaları.

Apple account deletion rehberi: <https://developer.apple.com/support/offering-account-deletion-in-your-app/>
Google Play account deletion rehberi: <https://support.google.com/googleplay/android-developer/answer/13327111>

**Kabul:** Silinen UID ile veri sorguları sonuç döndürmez; kullanıcı tekrar giriş yapamaz; saklanan yasal kayıtlar politikada açıkça belirtilir; web talebi uygulamayı yeniden kurmayı gerektirmez.

### P1.5 — Analytics/Sentry rıza ve veri minimizasyonunu doğrula

Firebase Analytics üretimde varsayılan açık. `setAnalyticsEnabled` servisi var fakat kullanıcıya açık opt-out akışı bu denetimde doğrulanmadı. Sentry `sendDefaultPii: false` kullanıyor; yine de hata mesajı, extra ve breadcrumb çağrılarının içerik metni taşımadığını taramak gerekir.

**Kabul:** Kullanıcı ölçümü kapatabilir veya seçilen hukuki dayanak mağaza/politikada tutarlıdır; kapatma tercihi kalıcıdır; mesaj/not/yorum içeriği analytics, breadcrumb ve exception extra'ya gitmez.

### P1.6 — Mağaza paketlerini tamamla

**Play Store:** TR/EN metinleri, TR/EN feature graphic ve ikon var. Yalnız TR ekran görüntüsü var. `store/README.md` hâlâ “görseller henüz yok” diyor ve güncel değil. EN ekran görüntülerini üret; Data Safety, IARC/UGC, Advertising ID, account deletion, abonelik ve test kullanıcı alanlarını tamamla.

**App Store:** Depoda App Store Connect metadata dosyaları veya iPhone/iPad ekran görüntü setleri yok. `supportsTablet: true` olduğu için iPad deneyimi ve görselleri ayrıca doğrulanmalı. Privacy Nutrition Labels, age rating, subscription metadata, review notes ve demo hesap hazırlanmalı.

**Kabul:** Mağaza metni uygulamadaki gerçek özellik/ücret kapılarıyla uyumlu; tüm ekran görüntüleri son release candidate'tan; reviewer demo hesabı ve inceleme notu hazır.

### P1.7 — RevenueCat ve backend production durumunu panelden kanıtla

Production EAS ortamında Android RevenueCat anahtarı ve entitlement adı var; iOS anahtarı yok. Test Store anahtarı da production ortamında bulunuyor; `__DEV__` guard nedeniyle release'te seçilmese de kafa karışıklığını azaltmak için production'dan kaldırılması önerilir.

Kontrol listesi:

- Google Play ve App Store ürün ID'leri `utils/premium.js` ile birebir.
- RevenueCat entitlement/offerings ve iki tier doğru.
- Webhook URL/authorization secret ve Functions secretları gerçek production projesinde.
- Satın alma transferi, restore, refund, expiration ve billing issue webhook testleri.
- Server entitlement alanını istemci doğrudan yükseltemiyor.

### P1.8 — Bildirim, widget ve arka plan davranışı

Android widget native kaynağı `native/android-widgets/` ve config plugin üzerinden üretiliyor; yalnız `android/` altındaki generated dosyayı düzeltmek kalıcı değildir. iOS widget target/App Group gerçek EAS artifact'ta doğrulanmalı.

100 liste/hatırlatma öğesi; küçük/büyük widget; boş/yükleniyor/hata; tema; uygulama kapalıyken yenileme; yeniden başlatma; timezone/DST; bildirim izni reddi; OEM pil optimizasyonu matrisini test et.

---

## 5. P2 — Yayın sonrası kalite ve optimizasyon

1. Android Hermes bundle yaklaşık 16 MB ve 392 asset içeriyor. Çok sayıdaki font/icon-background varlığını kullanım bazlı yükleme ve paket boyutu açısından incele.
2. Metro cache “unsupported version” uyarısı verdi ama full crawl ile export tamamlandı. CI temiz cache üzerinde koşmalı; yerel cache temizliği yalnız doğrulanmış hedefte yapılmalı.
3. Gradle 10 uyumsuzluğu yaratacak deprecated özellikler raporlandı. Gradle 10 yükseltmesinden önce `--warning-mode all` çıktısını sahiplerine ayır.
4. Sentry source map yüklemesini production build logunda doğrula; token değerini hiçbir log/MD/commit içine yazma.
5. Cold start, offline-first ana ekran cache'i ve düşük bellek ölçümlerini gerçek cihaz/Sentry Mobile Vitals ile takip et.
6. `@react-native-async-storage/async-storage` şu an bilinçli migration fallback'i ve Firebase Auth köprüsü için tutuluyor. Önce en az bir kararlı mağaza sürümü migration'ı tamamlasın; sonra `purgeMigratedAsyncStorage()` ve bağımlılık kaldırma ayrı native sürümde yapılsın.

---

## 6. AI uygulayıcı için çalışma kuralları

1. Her oturumda önce `git status`, ilgili diff ve bu raporu oku.
2. Kullanıcının mevcut değişikliklerini silme; `git reset --hard`, `checkout --` veya geniş temizlik yapma.
3. `android/` generated klasörünü kalıcı kaynak sayma. Widget değişikliklerini `native/android-widgets/` ve `plugins/withAndroidWidgets.js` üzerinden yap.
4. Native paket/config/permission/entitlement değişikliğinde app version/runtime uyumluluğunu değerlendir; eski binary'ye uyumsuz OTA gönderme.
5. `firebase deploy`, `eas build`, `eas update`, submit, Play/App Store/RevenueCat panel değişikliği ve push için kullanıcı onayı al.
6. EAS env çıktısındaki anahtar değerlerini cevaba, log dosyasına veya commit'e kopyalama. Yalnız değişken adları ve var/yok durumu raporla.
7. `npm audit fix --force` çalıştırma.
8. Yeni kullanıcı metinlerini TR ve EN birlikte ekle; `__tests__/i18nKeys.test.js` geçmeli.
9. Her görev küçük ve geri alınabilir commit olmalı; bir görevde ilgisiz refactor yapma.
10. Cihaz/panel gerektiren işi statik test geçti diye tamamlandı işaretleme.

---

## 7. Önerilen uygulama sırası

### Faz 1 — Kaynağı sabitle

- [ ] 65 dosyalık çalışma ağacını tema bazlı incele.
- [ ] `git diff --check` ve 974 testi tekrar geçir.
- [ ] Kullanıcı onayıyla temiz release-candidate commit/dalı oluştur.

### Faz 2 — Yanıltıcı ürün ve güvenlik blokları

- [ ] Premium vaat/kota/gate matrisini düzelt.
- [ ] Firebase CLI'ı sabitle ve 41 rules testini gerçekten çalıştır.
- [ ] Advertising ID/permission/privacy kararını uygula.
- [ ] App Check production tokenlarını ölç, sonra aşamalı enforce planı çıkar.
- [ ] UGC moderasyon operasyonunu hazırla.

### Faz 3 — iOS ve abonelik

- [ ] Apple Team ID ve iOS credentials.
- [ ] Sign in with Apple tam hesap yaşam döngüsü.
- [ ] Google iOS OAuth yapılandırması.
- [ ] RevenueCat iOS key/products/offering/webhook.
- [ ] TestFlight sandbox purchase + widget + push.

### Faz 4 — Mağaza ve kapalı test

- [ ] Android AAB ve iOS IPA artifact incelemesi.
- [ ] Play EN screenshots ve App Store iPhone/iPad varlıkları.
- [ ] Data Safety, Privacy Labels, IARC/age rating, demo hesap ve review notes.
- [ ] Play Internal/Closed ve TestFlight gerçek cihaz matrisi.
- [ ] Crash-free başlangıç, auth, purchase, push, widget, deletion ve offline kanıtı.

### Faz 5 — Production kararı

- [ ] Tüm P0 maddeleri kapalı.
- [ ] P1 maddeleri kapalı veya ürün sahibi tarafından risk kabulü yazılı.
- [ ] Son build SHA/version code/build number ve source commit kaydedilmiş.
- [ ] Rollback/EAS update politikası ve destek iletişimi hazır.
- [ ] Production submit yalnız kullanıcı onayıyla.

---

## 8. Her release candidate için çalıştırılacak komutlar

```powershell
git status --short
git diff --check
npm test -- --runInBand
npx expo-doctor
npm run test:rules
$env:NODE_ENV='production'; npx expo export --platform android --output-dir "$env:TEMP\seelogd-android-export"
Push-Location android; .\gradlew.bat :app:compileDebugKotlin --no-daemon; Pop-Location
npm audit
npm audit --omit=dev
```

Kurallar testinde yalnız exit code'a güvenme; emulator başlangıcını ve 41 test sonucunu gör. Production EAS build, deploy ve submit komutlarını bu otomatik listenin parçası yapma; kullanıcı onayı ve panel hazırlığı gerekir.

---

## 9. Go / no-go kontrol listesi

**NO-GO** koşullarından biri bile varsa production gönderme:

- [ ] Çalışma ağacı kirli veya release commit belirsiz.
- [ ] Premium ekranındaki bir vaat gerçek davranışla uyuşmuyor.
- [ ] Rules testleri emulator ile gerçekten geçmedi.
- [ ] Production privacy beyanı manifest/SDK ile çelişiyor.
- [ ] Android veya iOS production key/credential eksik.
- [ ] Google/Apple auth ve satın alma gerçek imzalı buildde test edilmedi.
- [ ] Hesap silme ve UGC moderasyon uçtan uca test edilmedi.
- [ ] Store metadata/screenshot/reviewer hesabı eksik.
- [ ] Crash/push/widget/offline smoke matrisi tamamlanmadı.

**GO** ancak tüm P0'lar kapandığında, kapalı testte kritik/yüksek hata kalmadığında ve yayınlanacak artifact'ın source commit'i kesin olduğunda verilir.

---

## 10. Dış politika kaynakları

- Apple App Review Guidelines: <https://developer.apple.com/app-store/review/guidelines/>
- Apple account deletion: <https://developer.apple.com/support/offering-account-deletion-in-your-app/>
- Google Play target API policy: <https://support.google.com/googleplay/android-developer/answer/11926878?hl=tr>
- Google Play account deletion: <https://support.google.com/googleplay/android-developer/answer/13327111>

10 Ağustos 2026 itibarıyla Android hedef API 36 olması, 31 Ağustos 2026'da başlayacak Android 16/API 36 yeni uygulama ve güncelleme şartına teknik olarak uygundur. Politika ve tarihleri submit günü yeniden doğrula.
