# Android R8 Etkinleştirme — Uygulama Rehberi (Claude Code için)

**Hazırlanma:** 17 Kasım 2026 · **Durum:** Aşama 0–5 TAMAM, Aşama 6 EAS derlemesi TAMAM (280c556e; eşleme Sentry'de) — gerçek cihaz testi kullanıcıda; sonra Aşama 7 (production, onay gerekir). Commit yok · **Hedef sürüm:** 1.5.2'den sonraki ilk sürüm

### İlerleme günlüğü

- **17 Kas — Aşama 0 (taban, R8 kapalı, x86_64 release APK):** derleme 7 dk 9 sn. APK 115.412.508 bayt;
  7 DEX toplam **71.913.640 bayt** (Play'deki 71,9 MB ile aynı). `res/` türleri: xml 1001, png 783, ttf 109,
  webp 26, jpg 25. Not: sürüm derlemesi kaynak yollarını zaten kısaltıyor (`res/zw.png`), klasöre göre sayım
  yapılamaz → Aşama 4'te proje görselleri `aapt2 dump resources` ile ada göre karşılaştırılır.
- **17 Kas — Aşama 1:** `expo-build-properties ~57.0.23` kuruldu; `plugins/withAndroidR8.js`,
  `native/android-r8/keep-rules.pro`, `__tests__/androidR8Plugin.test.js` yazıldı; app.json'a **Kademe A**
  (`optimize: false`, `optimizedResourceShrinking: false`) eklendi. npm 10 ve npm 11 `ci --dry-run` temiz.
  Tam jest 539/539 takım (yeni paket için `npm run licenses` ile `assets/ossLicenses.json` yenilendi).
  Prebuild iki kez çalıştırıldı: bayraklar + 4g/1g bellek yazıldı, kural bloğu tek. Kademe B'nin
  `proguard-android-optimize.txt` değişimi gerçek şablonda kuru denendi (1 satır değişiyor).
  **Sapma:** Credential Manager kuralı eklenmedi — `@react-native-google-signin` 16.x Android'de
  `play-services-auth` kullanıyor (kendi kurallarını taşır), `androidx.credentials` değil.
  **Sapma:** CI kipinde `expo prebuild` `--clean` verilmese de `android/`'i silip yeniden üretiyor.
- **17 Kas — Aşama 2 (Kademe A, R8 açık, optimizasyon kapalı):** derleme 10 dk 29 sn, eksik sınıf/uyarı YOK.
  DEX **71.913.640 → 28.184.280 bayt (−%61)**, 7 → 4 dosya; APK 115,4 → 100,1 MB. `res/` xml 1001 → 929;
  png/jpg/webp/ttf sayıları değişmedi (783/25/26/109). `configuration.txt` içinde tek global bayrak
  `-dontoptimize` ve kaynağı yalnız `proguard-android.txt` (beklenen; Kademe B kaldıracak) — hiçbir kütüphane
  `-dontobfuscate`/`-dontshrink` getirmiyor. `mapping.txt`: `MainActivity` ve `RNHeadlessAppLoader` adları korunmuş,
  26 widget sınıfı korunmuş.
- **17 Kas — Aşama 3 (Pixel_8a, Android 14, R8'li APK):** logcat'te Seelogd sürecinde ÇÖKME/sınıf/JNI/kaynak hatası
  SIFIR (12.078 satır; 49 kalıp eşleşmesinin tamamı Play Store/sistem süreçlerinden). GEÇENLER: soğuk açılış,
  tanıtımın 7 sayfası (posterler, ağ logoları), giriş ekranı, **Google ile giriş** (emülatördeki tek hesapla seçim
  sormadan giriş yaptı), bildirim izni sayfası + bulanıklık, ana ekran rafları + seri alevi, dizi detayı, profil
  (Firestore verisi, avatar, rozetler, istatistik), Ayarlar, Kişiselleştirme (44 yazı tipi, Atmosfer kar efekti),
  **uygulama simgesi değişimi** (`MainActivityClassic` etkinleşti, ana ekran simgesi değişti, Default'a geri alındı),
  **"Coming Up" widget'ı** ana ekranda gerçek veriyle (5 hatırlatma, posterler), **paylaşım (share-intent)** →
  TMDB bağlantısı The Matrix detayını açtı. R8 dışı, beklenen hatalar: App Check 403 (debug imzalı yerel APK
  Play Integrity'den geçemez), expo-updates açılışta DNS hatası.
  DENENMEDİ (Kademe B turunda yapılacak): fragman/webview, Lottie ekranı, oyunlar/Skia sahneleri, hikâye kartı
  (view-shot), takvim, kütüphane dışa aktarma, simge kısayolları, dil değişimi, Listelerim/İstatistik widget'ları.
  Bildirim izni "Not now" ile geçildi (izin verilse hesaba emülatör push jetonu yazılırdı).
- **17 Kas — Aşama 4 (Kademe B: `proguard-android-optimize.txt` + optimize kaynak küçültme):** derleme 12 dk, eksik
  sınıf yok. DEX **20.492.504 bayt (−%71, 2 dosya)**; APK 96,9 MB. `configuration.txt` içinde HİÇ global
  `-dont...` bayrağı yok. AAB'de `BUNDLE-METADATA/com.android.tools/r8.json` VAR (R8 8.12.14) → 2.3'teki "AGP 8.12.0
  yama" belirsizliği KAPANDI. `stats`: noObfuscation 37,72 / noOptimization 38,06 / noShrinking 37,64 → Play'in
  okuyacağı oranlar ≈ **%62 / %62 / %62** (eşik %25). Kesin değer Aşama 7'de Play'den okunur.
  Kaynaklar (`aapt2 dump resources`, ada göre): 269 `drawable/assets_*`, 20 `icon_alt`, font aynı. Silinenler:
  kullanılmayan 3 widget drawable + `reminder_widget_more` dizgisi (kodda başvuru yok — doğru), `raw/keep` ve
  `raw/firebase_common_keep` (işaret dosyaları — doğru) ve **Play Billing'in iki Phenotype kayıt dosyası**
  (`raw/com_android_billingclient_{heterodyne,registration}_info`). Bunlar Kademe A'da korunuyordu; GMS başka
  süreçten adıyla okuyabildiği için `native/android-r8/res/raw/seelogd_keep.xml` (`tools:keep`) ile geri alındı,
  plugin kopyalıyor; yeniden derlemede ikisi de APK'da, DEX/r8.json değişmedi (+465 bayt).
  Emülatör (Kademe B, oturum açık): Seelogd sürecinde R8 hatası SIFIR, cihazda FATAL yok. Kademe A'dakilere ek
  GEÇENLER: Oyunlar sekmesi (lig, gönderiler, turnuva, günün sorusu, Top 100, meydan okumalar), abonelik/limit
  sayfası (RevenueCat SDK; beta Max olduğu için ödeme ekranı yok), fragman sayfası + YouTube oynatma (webview),
  hikâye kartı → "Share Design" → view-shot görüntüsü sistem paylaşım sayfasında (gönderilmedi), 4 simge kısayolu
  sistemde kayıtlı (`dumpsys shortcut`), widget yeni kurulumdan sonra da veri gösteriyor.
  expo-updates "Remote update request not successful": R8'siz taban APK aynı ağda AYNI hatayı veriyor
  (`FileDownloader.downloadRemoteUpdate`) → yerel derleme EAS kanal başlığı taşımıyor; R8 ile ilgisi yok.
  DENENMEDİ (Aşama 6 gerçek cihazda): Lottie ekranı, takvim izni/yazma, kütüphane dışa aktarma, dil değişimi,
  Listelerim/İstatistik widget'ları, gerçek satın alma.
  **Tuzak:** prebuild öncesi `cd android && ./gradlew.bat --stop` ŞART — çalışan Gradle daemon
  `minifyReleaseWithR8/classes.dex`'i kilitler, prebuild `android/`'i yarım siler (EBUSY). Daemon kapanması birkaç
  saniye sürer; ardından prebuild temiz biter.
- **17 Kas — Aşama 5 (Sentry, kullanıcı A seçeneğini seçti):** app.json Sentry girişine
  `"experimental_android": { "enableAndroidGradlePlugin": true }`. Prebuild: kök `build.gradle`'a
  `io.sentry:sentry-android-gradle-plugin:5.12.2`, `app/build.gradle`'a `sentry { autoUploadProguardMapping =
  shouldSentryAutoUpload() … tracingInstrumentation/autoInstallation false }`. `SENTRY_DISABLE_AUTO_UPLOAD=true` ile
  yerel derleme BAŞARILI (Gradle 9.3.1 / AGP 8.12 uyumlu): `generateSentryProguardUuidRelease`,
  `injectSentryDebugMetaPropertiesIntoAssetsRelease`, `uploadSentryProguardMappingsRelease` ("skipping upload")
  çalıştı; APK'da `assets/sentry-debug-meta.properties` → `io.sentry.ProguardUuids=…`. R8 çıktısı değişmedi (aynı
  `pg_map_id`, DEX 20.492.504, r8.json aynı). Tek yeni uyarı: "Using 'io.sentry.android.gradle' is only supported for
  the app module" — Expo eklentisi `apply plugin` satırını Android eklentisinden ÖNCE yazıyor; görevler yine de
  kayıtlı ve çalışıyor, işlevsel etkisi yok. Emülatörde açılış temiz, RNSentry DSN ile başlıyor, R8 hatası 0.
  ("Could not find generated setter …" 85 satırı R8'siz tabanda da AYNI → RN'nin olağan geri dönüşü.)
- **17 Kas — Aşama 6 (EAS preview, derleme 280c556e, 1.5.2 / versionCode 8):** EAS'ta BUILD SUCCESSFUL (34 dk).
  Günlükte `minifyReleaseWithR8`, `generateSentryProguardUuidRelease`, `uploadSentryProguardMappingsRelease`
  çalıştı: "Uploaded a total of 1 new mapping files" + 180 native debug dosyası Sentry'ye yüklendi. Evrensel APK
  200,4 MB (4 ABI), DEX 2 dosya / 20.492.504 bayt (yerel Kademe B ile birebir), `io.sentry.ProguardUuids=
  5f30330f-1edd-33d7-a530-8c96cc514f50`. Emülatörde (imza farkı nedeniyle eski yerel sürüm kaldırılıp) kuruldu:
  açılış + 7 onboarding sayfası temiz, uygulama pid'inde R8 hata kalıbı 0. Gerçek cihaz kontrolleri kullanıcıda
  (aşağıdaki Aşama 6 listesi + Sentry › Debug Files'ta bu UUID).
- **17 Kas — Aşama 6 emülatör turu (EAS preview APK, gerçek hesapla Google girişi):** hepsi R8 hatasız —
  Google girişi (hesap seçici → ana ekran), dizi detayı + bölüm grafiği, turnuva balonu/ekranı, Top 100 ve
  meydan okuma kartları, Profil/İstatistik, Ayarlar › Kişiselleştirme › **simge değişimi** (Lens 3D → yalnız
  `MainActivityLensSolid` etkin, sonra Default'a geri), **kütüphane ZIP dışa aktarma** (dosya üretildi, paylaşım
  sayfası açıldı, gönderilmedi), **takvim izni** (izin verildi, expo-calendar "henüz etkinlik eklenmedi" okudu;
  gerçek takvime etkinlik YAZILMADI), sohbet listesi + zengin kartlı sohbet, **İstatistik ve Listelerim
  widget'ları** (gerçek veri, sayfa okları çalışıyor; sonra kaldırıldı). Tüm logcat'te uygulamaya ait
  ClassNotFound/NoSuchMethod/NoSuchField/AbstractMethod/VerifyError/Resources$NotFound YOK.
  **ANR bulgusu — UYGULAMA HATASI DEĞİL, emülatör durumu:** "Input dispatching timed out (Application does not
  have a focused window)" — herhangi bir alt sayfa (Modal) kapandıktan sonraki donanım GERİ tuşunda. `dumpsys
  input` › FocusRequests, KALKMIŞ dialog penceresinde `result='NO_WINDOW'` takılı kalıyordu (WM odağı ana
  pencereye geçmiş ama girdi sistemine iletilmemiş). R8'siz tabanda da aynıydı. Ancak: API 36 emülatörde
  (Pixel_9_Pro) YOK; aynı Pixel_8a API 34 **snapshot'sız soğuk açılışta** (`-no-snapshot-load`) 3/3 tur YOK
  (FocusRequests `OK`). Sebep: uzun süren emülatör oturumu (çok sayıda kur/kaldır + simge alias değişimi) sistem
  odak tablosunu bozmuş. Kod değişikliği gerekmez. Ders: tuhaf ANR'de önce emülatörü soğuk aç.
  Denenmedi: gerçek satın alma (Play kurulumu gerekir), oyun oynama (günlük hak/puan bozulmasın diye).
  EAS: `SENTRY_AUTH_TOKEN` production VE preview ortamlarında tanımlı (değerler okunmadı) → EAS derlemelerinde
  eşleme otomatik yüklenir; development'ta yok ama debug derleme R8/eşleme kullanmaz.
  Not: bu derleme 27 dk 53 sn sürdü (önceki Kademe B 12 dk; emülatör aynı anda çalışıyordu — EAS süresini
  Aşama 6'da gözle). **Aşama 6'da doğrulanacak:** Sentry > Settings > Debug Files'ta ProGuard eşlemesinin bu
  UUID ile görünmesi ve bir Java/Kotlin hatasının okunur gelmesi.

Bu dosya, Android sürüm derlemesinde R8'i (kod küçültme, karartma, optimizasyon, kaynak küçültme) açmak için
Claude Code'un sırayla izleyeceği adımları içerir. Her aşamanın sonunda bir **kapı** vardır: kapı geçilmeden
sonraki aşamaya geçilmez. "DUR" yazan yerlerde kullanıcıdan açık onay alınır.

---

## 1. Neden yapılıyor

Play Console (App bundle explorer, 1.5.2) şunu gösteriyor: DEX code optimization **Low**, Obfuscation **%2**,
Optimization ve Shrinking **"-"**, toplam sıkıştırılmamış DEX **71,9 MB**.

Bu bugün yayını engellemiyor, ama **Şubat 2027'den itibaren zorunlu**:

- Google Play, DEX kodu 10 MB'ı aşan uygulamalarda (oyunlarda 50 MB) her yüklemede **en az %25 optimizasyon,
  %25 karartma, %25 küçültme** isteyecek. Karşılanmazsa uygulamanın görünürlüğü ve yayınlama yetkisi etkilenebilir.
- Seelogd 71,9 MB DEX ile eşiğin 7 katı üstünde. Planlanan yayın tarihi 1 Ocak 2027; yani yayından sonraki ilk
  güncellemeler bu kurala takılır.

Kaynaklar bu dosyanın sonunda.

## 2. Araştırma bulguları (17 Kas 2026, repo + belgeler)

### 2.1 Projede bugünkü durum

| Konu | Bulgu |
| --- | --- |
| R8 | Kapalı. `android.enableMinifyInReleaseBuilds` hiçbir yerde ayarlı değil; şablon varsayılanı `false`. |
| `android/` | `.gitignore` ve `.easignore` içinde (CNG). Ayar yalnız config plugin ile verilebilir. |
| `expo-build-properties` | Kurulu değil. SDK 57 etiketi: **57.0.23** (`npx expo install` doğru sürümü seçer). |
| Sürümler | Expo 57.0.32, RN 0.86.3, AGP **8.12.0** (RN sabitler), Gradle 9.3.1, expo-modules-core 57.0.25. |
| Şablon | `proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"` — yerel `android/app/build.gradle:121` ve `node_modules/expo/template.tgz` aynı. |
| Gradle belleği | `org.gradle.jvmargs=-Xmx2048m -XX:MaxMetaspaceSize=512m` (şablon varsayılanı). |
| Sentry | `sentry.gradle` yalnız JS kaynak haritası ve native simge yükler; **ProGuard eşlemesi yüklemez**. |

### 2.2 Yalnız bayrağı açmak yetmez — üç ek gereksinim

1. **`proguard-android.txt` içinde `-dontoptimize` var.** Bu dosyayla R8 yalnız küçültür ve karartır,
   optimizasyon geçişi hiç çalışmaz → Play'in %25 optimizasyon şartı karşılanamaz. Doğrusu
   `proguard-android-optimize.txt`. `expo-build-properties` bu dosyayı değiştiremez; **özel config plugin gerekir**.
   (AGP 9.0 eski dosyayı zaten reddediyor.)
2. **Optimize kaynak küçültme AGP 8.12'de elle açılır:** `gradle.properties` içine
   `android.r8.optimizedResourceShrinking=true`. (`android.enableOptimizedResourceShrinking` diye bir özellik YOK;
   Gradle bilinmeyen özelliği sessizce yok sayar.)
3. **Gradle belleği artırılmalı.** Aynı yığındaki (Expo 57 / RN 0.86 / AGP 8.12) bir projede ilk R8 çalıştırması
   `OutOfMemoryError: Metaspace` ile düştü; 4 GB heap + 1 GB metaspace ile çözüldü.

### 2.3 "AGP 9.0'a yükselt" satırı

Yapılamaz. AGP sürümünü React Native belirler; elle yükseltmek derlemeyi bozar. Expo/RN yükseltmesiyle kendiliğinden
gelir. Bu satır Play'deki "R8 configuration" kartının ayrıntılı dökümü içindir; %25 eşikleri bundan bağımsızdır.

**Açık belirsizlik:** Android belgesine göre Play yüzdeleri, "AGP 8.10+ sürümünün *en son yaması*" ile derlenen
paketlerdeki `r8.json` dosyasından okur. RN 8.12.**0**'ı sabitliyor (en son yama değil). R8 açıldıktan sonra Play
yüzdeleri yine "-" gösterebilir. Bu, Aşama 7'de ölçülerek netleşecek; çözümü bu rehberin kapsamı dışında
(Expo SDK yükseltmesi) ve kullanıcıya raporlanır.

### 2.4 Kütüphane taraması (R8 neyi silebilir?)

Tüketici kuralı (consumer ProGuard) **olan**: react-native çekirdeği, expo-modules-core, expo-notifications,
expo-updates, expo-image, react-native-reanimated, react-native-worklets, react-native-svg.

Tüketici kuralı **olmayan** ama başka yoldan korunan:

| Kütüphane | Neden güvenli görünüyor |
| --- | --- |
| RNFirebase (app, analytics, app-check), netinfo, async-storage, view-shot, webview, gesture-handler, screens, safe-area, lottie, google-signin, purchases | Modülleri `NativeModule` uygular → RN çekirdek kuralı `-keep class * implements com.facebook.react.bridge.NativeModule { *; }` korur. Altlarındaki Android SDK'ları (Firebase, Play Billing, RevenueCat, Lottie) kendi AAR kurallarını taşır. |
| react-native-mmkv, nitro-modules, Skia | JNI + `@DoNotStrip` / `@Keep` açıklamaları (nitro+mmkv 13 dosya, Skia 5 dosya); RN kuralı `native <methods>` ve `@DoNotStrip`'i korur. |
| expo-share-intent, expo-quick-actions, expo-calendar, expo-video, liquid-glass-kit, modules/app-icon | Expo modülleri; expo-modules-core kuralı `Module`, `Record`, `SharedObject`, `ExpoView` alt sınıflarını korur. |

Yerel Kotlin kodu:

- **Widget'lar** (`native/android-widgets`, 12 dosya, ~1.600 satır): 3 `ReactContextBaseJavaModule` (RN kuralı korur),
  3 provider + 2 `RemoteViewsService` (manifestte kayıtlı → AAPT kuralı korur). JSON için `org.json`; Gson/Moshi/yansıma yok.
- **Simge takma adları** iki yerde **MainActivity'nin sınıf adından** türetiliyor:
  `AppIconRes.kt` (`MainActivity::class.java.name + alias`) ve `modules/app-icon/.../AppIconModule.kt`
  (`currentActivity.javaClass.name`). MainActivity manifestte olduğu için adı korunur, ama bu bağımlılık kritik:
  ad karartılırsa alternatif simge sessizce bozulur. Açık `-keepnames` kuralı eklenecek.
- **Ada göre kaynak arama:** `AppIconRes.kt` `getIdentifier(..., "mipmap", ...)` kullanıyor (simgeler manifestten de
  referanslı → korunur). RN, JS `require()` görsellerini sürümde `getIdentifier(..., "drawable", ...)` ile yükler;
  kaynak küçültme sonrası **görsel ve Lottie sayımı doğrulanmalı** (Aşama 4).

Bilinen ve çözülmüş: R8, `RNHeadlessAppLoader` sınıfını siliyordu (expo/expo#52250). Kurulu
expo-modules-core 57.0.25'te sınıf `@DoNotStrip` taşıyor; ayrıca projede `expo-task-manager` yok.

### 2.5 Sentry

R8 açılınca Sentry'deki **Java/Kotlin** yığın izleri karartılmış gelir (JS ve C++ izleri etkilenmez).
Eşleme dosyasını yüklemenin tek desteklenen yolu Sentry Android Gradle Plugin'dir; Expo eklentisinde
`experimental_android.enableAndroidGradlePlugin` ile açılır (kurulu 7.11.0'da eklenti sürümü 5.12.2).
"Deneysel" olarak işaretli ve Gradle 9.3.1 ile uyumu belgelerde doğrulanamadı → ayrı aşama (Aşama 5), yerelde denenir.
Play Console kendi çökme raporlarını etkilenmeden çözer (eşleme AAB'nin içinde gider).

---

## 3. Çalışma kuralları (bu depoya özgü)

- Çalışma ağacı başka oturumlarla (Codex) **paylaşımlı**. `git stash` YOK; indeks/ağaca toplu dokunan komut YOK;
  stage ederken yalnız kendi dosya yollarını tek tek ver.
- Commit, push, `eas build`, `eas submit`, sürüm numarası değişikliği: **her biri için DUR, kullanıcıya sor.**
- `npx expo prebuild --clean` KULLANMA (başka oturumun çalışan derlemesini bozar); `--clean`'siz çalıştır.
- Kök `.npmrc` (`legacy-peer-deps=true`) silinmez. Bağımlılık ekledikten sonra iki npm sürümüyle doğrula (Aşama 1).
- 2 dakikayı aşacak komutları (Gradle) arka planda çalıştır.
- Emülatörde sürüm derlemesi **canlı Firebase'e** bağlanır. Pixel_8a'daki test hesabında veri değiştiren
  düğmelere (İzledim, Favori, sil, gönder) dokunma; yalnız okuma/gezinme ile doğrula.
- Dosya düzenlerken Edit/Write aracını kullan; betikle satır sonu dönüştürme.

---

## 4. Aşamalar

### Aşama 0 — Taban ölçümü

Amaç: R8 kapalıyken karşılaştırma sayıları ve sıcak Gradle önbelleği.

1. `CI=1 npx expo prebuild --platform android --no-install`
2. `cd android` → `SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew.bat :app:assembleRelease -x lint -PreactNativeArchitectures=x86_64` (arka planda; ilk tam derleme ~15 dk)
3. Kaydet (scratchpad'e, repoya değil):
   - APK boyutu: `android/app/build/outputs/apk/release/app-release.apk`
   - DEX toplamı: `unzip -l app-release.apk | grep -E "classes[0-9]*\.dex"`
   - Kaynak sayımı: `unzip -l app-release.apk | grep -c "res/"` ve `grep -c "res/drawable"`, `grep -c "res/raw"`

**Kapı:** derleme başarılı, üç sayı kayıtlı. (Derleme R8'den bağımsız bir sebeple düşüyorsa önce onu raporla.)

### Aşama 1 — Bağımlılık ve yapılandırma (kod)

**1a. Paketi kur**

```bash
npx expo install expo-build-properties
```

Doğrula: `package.json` içinde `~57.0.x`. Sonra kilit dosyası:

```bash
npx --yes npm@10 ci --dry-run
```

```bash
npm ci --dry-run
```

İkisi de hatasız bitmeli.

**1b. Koruma kuralları dosyası** — yeni: `native/android-r8/keep-rules.pro`

```proguard
# Seelogd'a özgü R8 koruma kuralları.
# plugins/withAndroidR8.js bu dosyayı prebuild'de android/app/proguard-rules.pro içine ekler.
# KURAL: buraya -dontobfuscate / -dontoptimize / -dontshrink ve "-keep class **" gibi
# geniş kurallar YAZILMAZ (Play'in %25 eşiklerini düşürür). Her kuralın gerekçesi yazılır.

# Alternatif simge takma adları MainActivity'nin sınıf adından türetiliyor
# (AppIconRes.kt, modules/app-icon AppIconModule.kt). Ad karartılırsa simge değişimi sessizce bozulur.
-keepnames class com.smlztrk.seelogd.MainActivity

# Ana ekran widget'ları: sistem bu sınıfları manifest adıyla başlatır, hata uygulama içinde görünmez.
# Savunma amaçlı; ~1.600 satır, ölçülebilir maliyeti yok.
-keep class com.smlztrk.seelogd.widget.** { *; }
```

(Credential Manager kuralı bilinçli olarak YOK: Google Sign-In bu projede `play-services-auth` kullanıyor.)

**1c. Config plugin** — yeni: `plugins/withAndroidR8.js`

Yapması gerekenler (mevcut `plugins/withAndroidWidgets.js` üslubunda, saf yardımcılar dışa aktarılır):

```js
const { withAppBuildGradle, withGradleProperties, withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

const RULES_SRC = path.join(__dirname, "..", "native", "android-r8", "keep-rules.pro");
const BEGIN = "# >>> seelogd-r8 (plugins/withAndroidR8.js yazar)";
const END = "# <<< seelogd-r8";
const OLD_DEFAULT = 'getDefaultProguardFile("proguard-android.txt")';
const NEW_DEFAULT = 'getDefaultProguardFile("proguard-android-optimize.txt")';
const JVM_ARGS = "-Xmx4g -XX:MaxMetaspaceSize=1g";

// gradle.properties: varsa değeri değiştirir, yoksa ekler (idempotent).
function setGradleProperty(props, key, value) {
  const hit = props.find((p) => p.type === "property" && p.key === key);
  if (hit) hit.value = value;
  else props.push({ type: "property", key, value });
  return props;
}

// build.gradle: -dontoptimize içeren varsayılan dosyayı optimize sürümüyle değiştirir.
function swapDefaultProguardFile(contents) {
  if (contents.includes(NEW_DEFAULT)) return contents;
  if (!contents.includes(OLD_DEFAULT)) {
    throw new Error(
      "withAndroidR8: app/build.gradle içinde " + OLD_DEFAULT + " bulunamadı — Expo şablonu değişmiş, plugin güncellenmeli.",
    );
  }
  return contents.replace(OLD_DEFAULT, NEW_DEFAULT);
}

// proguard-rules.pro: işaretli bloğu ekler ya da yerinde yeniler (idempotent).
function mergeKeepRules(contents, rules) {
  const block = BEGIN + "\n" + rules.trim() + "\n" + END;
  const start = contents.indexOf(BEGIN);
  const end = contents.indexOf(END);
  if (start !== -1 && end > start) return contents.slice(0, start) + block + contents.slice(end + END.length);
  return contents.trimEnd() + "\n\n" + block + "\n";
}

function withAndroidR8(config, { optimize = true, optimizedResourceShrinking = true } = {}) {
  config = withGradleProperties(config, (c) => {
    setGradleProperty(c.modResults, "org.gradle.jvmargs", JVM_ARGS);
    if (optimizedResourceShrinking) setGradleProperty(c.modResults, "android.r8.optimizedResourceShrinking", "true");
    return c;
  });
  if (optimize) {
    config = withAppBuildGradle(config, (c) => {
      c.modResults.contents = swapDefaultProguardFile(c.modResults.contents);
      return c;
    });
  }
  return withDangerousMod(config, [
    "android",
    async (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
      fs.writeFileSync(file, mergeKeepRules(current, fs.readFileSync(RULES_SRC, "utf8")));
      return c;
    },
  ]);
}

module.exports = withAndroidR8;
module.exports.setGradleProperty = setGradleProperty;
module.exports.swapDefaultProguardFile = swapDefaultProguardFile;
module.exports.mergeKeepRules = mergeKeepRules;
```

Not: `optimizedResourceShrinking` kapatılırsa özellik *yazılmaz*; önceki prebuild'den kalan satırı elle silmek gerekir
(`--clean` kullanılmadığı için). Kademe değiştirirken `android/gradle.properties` içini doğrula.

**1d. `app.json`** — `plugins` dizisinin SONUNA (expo-share-intent'ten sonra) iki giriş.
İlk yerel deneme **Kademe A** ile başlar (optimizasyon kapalı):

```json
[
  "expo-build-properties",
  {
    "android": {
      "enableMinifyInReleaseBuilds": true,
      "enableShrinkResourcesInReleaseBuilds": true
    }
  }
],
["./plugins/withAndroidR8.js", { "optimize": false, "optimizedResourceShrinking": false }]
```

**1e. Bekçi testi** — yeni: `__tests__/androidR8Plugin.test.js` (`alternateAppIconsIos.test.js` üslubu):

- `swapDefaultProguardFile`: değiştirir; ikinci çağrıda aynı sonucu verir; çapa yoksa hata fırlatır.
- `mergeKeepRules`: iki kez uygulanınca çıktı aynı; işaretler tam bir kez geçer; mevcut içeriği korur.
- `setGradleProperty`: var olanı günceller, olmayanı ekler, yineleme üretmez.
- `native/android-r8/keep-rules.pro`: `-dontobfuscate`, `-dontoptimize`, `-dontshrink` ve `-keep class ** ` İÇERMEZ.
- `app.json`: `expo-build-properties` girişinde iki bayrak `true`; `./plugins/withAndroidR8.js` kayıtlı.

**Kapı:** `npx jest __tests__/androidR8Plugin.test.js` yeşil; `npx jest` genelinde yeni kırık yok;
`npx expo config --type prebuild` hatasız.

### Aşama 2 — Kademe A: küçültme + karartma (yerel derleme)

1. `CI=1 npx expo prebuild --platform android --no-install`
2. Üretileni doğrula:
   - `android/gradle.properties`: `android.enableMinifyInReleaseBuilds=true`, `android.enableShrinkResourcesInReleaseBuilds=true`, `org.gradle.jvmargs=-Xmx4g ...`
   - `android/app/proguard-rules.pro`: `seelogd-r8` bloğu tam bir kez.
3. Aşama 0'daki `assembleRelease` komutunu yeniden çalıştır.
4. **Derleme düşerse:**
   - `Missing class ...` → `android/app/build/outputs/mapping/release/missing_rules.txt` içindeki `-dontwarn` satırlarını
     gerekçesiyle `keep-rules.pro`'ya ekle. Eksik sınıf gerçekten çalışma anında gerekiyorsa `-dontwarn` değil, bağımlılık sorunudur → DUR.
   - `OutOfMemoryError` → `JVM_ARGS` değerini büyüt, `./gradlew.bat --stop` ile daemon'ı yenile.
5. Derleme geçince `android/app/build/outputs/mapping/release/configuration.txt` içinde ara:
   `-dontobfuscate`, `-dontshrink`, `-dontoptimize`. Şablon dosyasından gelen `-dontoptimize` (Kademe A'da beklenir)
   dışında bir tane bile varsa, hangi kütüphanenin tüketici kuralından geldiğini (dosyadaki `# The proguard configuration file for the following section is ...` başlığı) not et ve raporla — bu, tüm uygulamada karartmayı kapatır.
6. Aşama 0 sayılarını yeniden al (APK, DEX, kaynak sayımı).

**Kapı:** derleme başarılı; DEX toplamı belirgin biçimde düştü; `configuration.txt` beklenmeyen genel bayrak içermiyor.

### Aşama 3 — Emülatörde duman testi (her kademeden sonra tekrarlanır)

Kurulum (Pixel_8a; `android-emulator-dev-build` hafıza notundaki tuzaklar geçerli):

```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Sürüm derlemesi Metro istemez. Kurulum dev build'in üstüne yazar (aynı debug imzası); iş bitince dev build geri kurulur.

Günlüğü temizle, uygulamayı aç, akışları gez, sonra tara:

```bash
adb logcat -d | grep -E "FATAL EXCEPTION|ClassNotFoundException|NoClassDefFoundError|NoSuchMethodError|NoSuchFieldError|AbstractMethodError|UnsatisfiedLinkError|JNI DETECTED ERROR"
```

Kontrol listesi — her satır R8'in bozabileceği ayrı bir native yüzeyi sınar:

| # | Akış | Sınadığı |
| --- | --- | --- |
| 1 | Soğuk açılış, açılış ekranı, ana ekran rafları | Hermes, expo-updates, MMKV/nitro, Reanimated/worklets, expo-image |
| 2 | Atmosfer / Skia sahnesi olan bir ekran, seri alevi | Skia JNI |
| 3 | E-posta ile giriş ekranı + **Google ile giriş penceresinin açılması** | Credential Manager kuralı |
| 4 | Film detayı, fragman sayfası, YouTube oynatıcı | webview, expo-video |
| 5 | Lottie olan ekran, SVG simgeler, bulanık arka planlı modal | lottie, svg, blur |
| 6 | Bildirim izni akışı / bildirimler ekranı | expo-notifications |
| 7 | Yükseltme (Premium) sayfasını açma | react-native-purchases(-ui) |
| 8 | Ayarlar → uygulama simgesi değiştir, eski simgeye geri dön | activity-alias + MainActivity adı |
| 9 | Ana ekrana üç widget'ı ekle; Listelerim'de ‹ › okları | widget provider/service, LISTS_CYCLE |
| 10 | Simgeye uzun bas → kısayollar; başka uygulamadan metin paylaş | quick-actions, share-intent |
| 11 | Hikâye/paylaşım kartı oluştur → galeriye kaydet ekranına kadar | view-shot, media-library |
| 12 | Takvime ekle izin sayfası; kütüphane dışa aktar (ZIP) | expo-calendar, file-system, sharing |
| 13 | Yerel `require()` görselleri: varsayılan avatarlar, splash posterleri, simge önizlemeleri görünüyor mu | kaynak küçültme |
| 14 | Dil değiştir (en az 2 dil), tema değiştir | localization, kaynak dizgileri |

Veri değiştiren adımlar (3'te gerçek giriş, 11'de kaydetme, 12'de takvime yazma) yalnız pencere/izin sayfası
açılana kadar götürülür.

**Kapı:** logcat taramasında yukarıdaki kalıplardan hiçbiri yok; 14 satırın tümü geçti. Bir satır düşerse:
logcat'teki sınıf adını `mapping.txt` ile çöz, en dar kuralı (`-keep class tam.ad { ... }`) gerekçesiyle
`keep-rules.pro`'ya ekle, Aşama 2'den tekrarla. Geniş paket kuralı son çaredir ve raporlanır.

### Aşama 4 — Kademe B: optimizasyon + optimize kaynak küçültme

1. `app.json` → `["./plugins/withAndroidR8.js", { "optimize": true, "optimizedResourceShrinking": true }]`
   (varsayılanlar da böyle; seçenek nesnesi tümden kaldırılabilir).
2. Prebuild → doğrula: `android/app/build.gradle` içinde `proguard-android-optimize.txt`;
   `gradle.properties` içinde `android.r8.optimizedResourceShrinking=true`.
3. `assembleRelease` → `configuration.txt` içinde artık **hiç** `-dontoptimize` olmamalı.
4. Kaynakları ADA göre karşılaştır (yollar kısaltılmış olduğu için klasör sayımı işe yaramaz):
   `$ANDROID_HOME/build-tools/<sürüm>/aapt2 dump resources app-release.apk` çıktısında `drawable/assets_…`,
   `raw/…` ve `mipmap/icon_alt_…` adlarını taban APK'sı (scratchpad `baseline-app-release.apk`) ile kıyasla;
   proje görselleri **aynı** kalmalı, azalma yalnız kütüphane kaynaklarında olmalı.
   Proje görseli silindiyse: plugin'e `res/raw/seelogd_keep.xml` yazdır
   (`<resources xmlns:tools="http://schemas.android.com/tools" tools:keep="@drawable/*,@raw/*" />`) ve yeniden ölç.
5. Aşama 3'ün tamamını tekrarla.
6. Ölçüm için paket üret: `./gradlew.bat :app:bundleRelease -x lint -PreactNativeArchitectures=x86_64`, sonra

```bash
unzip -p android/app/build/outputs/bundle/release/app-release.aab BUNDLE-METADATA/com.android.tools/r8.json
```

   Dosya varsa optimizasyon/karartma/küçültme oranlarını kaydet. Yoksa (AGP 8.12.0 belirsizliği, bkz. 2.3) not et;
   kesin sonuç Aşama 7'de Play'den okunur.

**Kapı:** Aşama 3 kapısı yeniden geçildi; proje görselleri eksiksiz; DEX Kademe A'dan büyük değil.
Kademe B çözülemeyen bir çalışma anı hatası üretirse Kademe A ayarına dön ve **DUR** — Kademe A tek başına
%25 optimizasyon şartını karşılamaz, kullanıcı kararı gerekir.

### Aşama 5 — Sentry eşleme yüklemesi (karar gerektirir)

**DUR:** kullanıcıya iki seçeneği sun.

- **A (önerilen, önce yerelde denenir):** `app.json` Sentry girişine
  `"experimental_android": { "enableAndroidGradlePlugin": true }` ekle. Prebuild +
  `SENTRY_DISABLE_AUTO_UPLOAD=true` ile `assembleRelease`. Bu yalnız eklentinin Gradle 9.3.1 / AGP 8.12 ile
  **uygulanabildiğini** sınar (yükleme yapılmaz). Derleme geçerse kalır; gerçek yükleme EAS'te `SENTRY_AUTH_TOKEN`
  ile olur (kaynak haritası için zaten tanımlı olmalı — `eas env:list` ile adını doğrula, değerini yazdırma).
  Derleme eklenti yüzünden düşerse geri al, B'ye geç.
- **B:** Eklenti açılmaz. Sentry'de Java/Kotlin kareleri karartılmış kalır; JS ve C++ izleri ile Play Console
  çökme raporları etkilenmez. Bu bilinçli bir kabul olarak not edilir.

**Kapı:** seçilen yol uygulanmış ve yerel derleme hâlâ başarılı.

### Aşama 6 — EAS önizleme derlemesi ve gerçek cihaz

**DUR:** EAS derlemesi için onay al (derleme kotası).

```bash
npx eas-cli build --platform android --profile preview
```

- Derleme günlüğünde R8 görevi (`minifyReleaseWithR8`) ve (A seçildiyse) Sentry eşleme yüklemesi görünmeli.
- APK'yı gerçek cihaza kur; Aşama 3 listesini bu kez **gerçek hesapla, yazan akışlar dahil** kullanıcı gezer
  (Google ile gerçek giriş, satın alma sayfası, widget'lar, bildirim alma).
- 24 saat sonra Sentry'de yeni Android sorunlarına bak (kullanıcı; token'la okuma bu oturumda izinli değil).

**Kapı:** kullanıcı cihaz testini onayladı.

### Aşama 7 — Üretim derlemesi ve Play ölçümü

**DUR:** sürüm numarası ve gönderim için onay al. Sonra `npm run release` (iki platform derler, Android'i alpha
kanalına gönderir).

Play Console → App bundle explorer → yeni sürüm:

| Satır | Beklenen |
| --- | --- |
| Obfuscation / Optimization / Shrinking percentage | Her biri **≥ %25** |
| Total uncompressed DEX size | 71,9 MB'ın belirgin altında |
| DEX code optimization | "Low" değil |

Sonuca göre:

- **Üçü de ≥ %25** → bitti, Aşama 8.
- **Sayı var ama < %25** → en çok kod tutan kuralları daralt. Adaylar: `android/app/proguard-rules.pro` şablon
  kuralları (reanimated/turbomodule tekrarı), widget paket kuralı, `configuration.txt` içindeki geniş kütüphane
  kuralları. İsteğe bağlı Kademe C: `keep-rules.pro`'ya `-repackageclasses` (Play kartındaki "Repackage classes"
  satırı) — widget ve simge akışları yeniden sınanır.
- **Hâlâ "-"** → 2.3'teki AGP yaması belirsizliği doğrulanmış olur. R8'in gerçekten çalıştığını DEX boyutu ve
  `mapping.txt` ile kanıtla, kullanıcıya raporla; kalıcı çözüm Expo SDK yükseltmesi (ayrı iş).

### Aşama 8 — Kapanış

- Bu dosyanın başındaki **Durum** satırını ve ölçülen sayıları güncelle.
- Hafıza notu `r8-play-requirement-feb2027` güncellenir (sonuç yüzdeleri, eklenen kurallar, Sentry kararı).
- Commit (**DUR**, onay): yalnız şu yollar — `package.json`, `package-lock.json`, `app.json`,
  `plugins/withAndroidR8.js`, `native/android-r8/keep-rules.pro`, `__tests__/androidR8Plugin.test.js`, bu dosya.

---

## 5. Geri alma

Tek değişiklikle kapanır: `app.json`'daki iki plugin girişini kaldır (ya da `enableMinifyInReleaseBuilds` ve
`enableShrinkResourcesInReleaseBuilds` değerlerini `false` yap). Yerelde `android/gradle.properties` içinde kalan
satırlar elle silinir; EAS her derlemede `android/`'i sıfırdan üretir.

## 6. Kapsam dışı

- AGP 9 / Expo SDK 58 yükseltmesi.
- Başlangıç profili (Baseline/Startup Profile) — R8 oturduktan sonra ayrı iş.
- ABI azaltma (x86/x86_64): Play AAB'den cihaza özel bölme ürettiği için indirme boyutunu etkilemez.

## 7. Kaynaklar

- [Play Console technical quality requirements](https://support.google.com/googleplay/android-developer/answer/17492799?hl=en) — Şubat 2027, %25 eşikleri, 10 MB DEX tabanı
- [DEX code optimization — Android vitals](https://developer.android.com/topic/performance/vitals/code-optimization) — yüzdelerin `r8.json`'dan okunması, AGP yaması koşulu
- [Enable app optimization (R8)](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization) — `proguard-android-optimize.txt`, `android.r8.optimizedResourceShrinking`, AGP sürüm tablosu
- [Expo BuildProperties](https://docs.expo.dev/versions/latest/sdk/build-properties/) — `enableMinifyInReleaseBuilds`, `enableShrinkResourcesInReleaseBuilds`
- [Sentry Android Gradle Plugin (Expo)](https://docs.sentry.io/platforms/react-native/manual-setup/expo/gradle) — `experimental_android`
- [expo/expo#52250](https://github.com/expo/expo/issues/52250) — R8 ve `RNHeadlessAppLoader`
- [Selftend/selftend#2335](https://github.com/Selftend/selftend/issues/2335) — aynı yığında (Expo 57 / RN 0.86 / AGP 8.12) saha deneyimi: Metaspace OOM, doğru özellik adı, `-dontoptimize` engeli (ikincil kaynak)
