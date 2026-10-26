# Yayın öncesi test: devam notu (2026-10-26)

Yeni bir Claude Code oturumu (başka hesap dahil) bu dosyayı okuyarak kaldığı yerden devam eder. Başlangıç cümlesi:

> `docs/test/DEVAM_NOTU.md`'yi oku, sonra rehberdeki sıradaki işe geç.

## Nerede kaldık

| Faz | Durum | Rapor |
|---|---|---|
| T0 taban + açık uçlar | ✅ (gizlilik göçü kararı açık) | `T0_TABAN_2026-10-25.md`, `T0_ACIK_UCLAR_2026-10-25.md` |
| T1 statik tarama + kod incelemesi | ✅, düzeltmeler yapıldı ve deploy edildi | `T1_MEKANIK_TARAMA_2026-10-25.md`, `T1_KOD_INCELEME_2026-10-25.md` |
| T2 otomatik testler | ✅, kural açıkları kapatıldı ve deploy edildi | `T2_OTOMATIK_TESTLER_2026-10-25.md` |
| T3.1 cihaz kontrol listesi | ✅ | `T3_CIHAZ_KONTROL_LISTESI.md` |
| T3.2 Android emülatör turu | ~ 22 satır yürütüldü, 11 bulgu, **düzeltme yok** | `T3_BULGULAR_2026-10-26.md` |
| T3.3 iPhone turu, T4–T8 | başlamadı | rehber: `docs/planlama/YAYIN_ONCESI_TEST_REHBERI.md` |

## Sıradaki iş (kullanıcı seçecek)

1. **T3 Orta bulgularını düzelt:** B1 (13 yaş altı ipucu, `components/auth/BirthDateField.js`), B6 ("11B", `components/PosterInfoBadges.js`), B7 (e-posta uyarısı çevirisi, `translations/*.json` `profileScreen.emailVerified`), B9 (AI kart eşleşmesi, `services/tmdbLookup.js`), B10 (çevrimdışı detay, `TvShowsDetails.js` + `MovieDetail.js`). Düşükler (B2–B5, B8, B11) uygunsa aynı turda. Her biri için test + rapordaki "Düzeltme durumu".
2. **Sosyal satırlar (ikinci test hesabı):** 8.x, 9.x, 10.5; ayrıca 14.2 (çevrimdışı yazma → senkron).

## Kurallar ve kararlar (kullanıcıdan)

- **Deploy, build, push, Play/RevenueCat panel işi: önce kullanıcıya sor.** Commit yalnız kullanıcı isteyince.
- **iOS EAS build ALMA:** aylık iOS kotası doldu; iPhone'daki 1.4.8 dev build kullanılıyor.
- T1'den 1.2 ve 3.3 bilerek bırakıldı.
- Tek Firebase projesi (`movieandtv-2832a`) = canlı. Yük ve sızma testleri canlıya yapılmaz (T0.3 staging kararı açık).
- Emülatördeki uygulama canlı Firebase'e bağlı: ajan orada **hesap açamaz, şifre giremez**. Kullanıcı test hesabıyla girer ("Test 1", Free). Test hesabı şu an **Almanca + yeşil açık tema**da.
- Servis hesabı anahtarı (`functions/scripts/sa.json`) gerekiyorsa kullanıcı oluşturur; iş bitince silinir ve konsolda iptal edilir. Gizli değerler ekrana yazılmaz.
- Çalışma ağacında başka bir oturumun commit edilmemiş işi var (sosyal hesaplar, detay AI eylemleri: `DetailAiActionSheet`, `socialLinksService`…). Ona dokunma, commit'leme.

## Açık işler (T3 dışı)

- Gizlilik göçü: eski hesaplarda kökte email/birthDate duruyor → `migrateAccountPrivate.js` kuru çalışma, `--apply`, sonra Aşama 3 + rules deploy (servis hesabı gerekli). `website/privacy.html:272` ile çelişiyor (Yüksek).
- Sahte arkadaş denetimi: `functions/scripts/auditFriendships.js` hazır, çalıştırılmadı (sa.json gerekli).
- İstemci düzeltmeleri (T1: 2.1, 3.1, 3.2, 5.1, Debug kapısı) cihazlara yeni build/OTA ile gidecek; Play kapalı testi için production AAB gerekli (T6 öncesi).
- `expirePromoGrants` deploy sonrası ilk çalışma günlüğü kontrol edilmedi.
- T5'e kalan kural zayıflıkları: likesCount şişirme, skor tablosu güveni, conversations şekil/engel, waitlist get.
- Ödeme ekranı dev build'de "$9.99" gösteriyor (RevenueCat Test Store); Play sürümünde fiyatı doğrula.

## Komutlar

Testler:

```bash
npx jest
```

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" && export PATH="$JAVA_HOME/bin:$PATH" && npm run test:rules
```

```bash
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr" && export PATH="$JAVA_HOME/bin:$PATH" && npx firebase emulators:exec --only firestore,auth --project demo-referral "cd functions && node --test --test-concurrency=1 accountPurge.integration.test.js referral.integration.test.js callables.integration.test.js"
```

Emülatör turu (Git Bash):
- AVD `Pixel_8a`; APK `android/app/build/outputs/apk/debug/app-debug.apk` (x86_64, native değişmedikçe yeniden derleme gerekmez).
- Metro: `.claude/launch.json` → `metro-devclient-8082` (preview_start). Bağlama: `adb reverse tcp:8082 tcp:8082` ve `MSYS_NO_PATHCONV=1 adb shell am start -a android.intent.action.VIEW -d "seelogd://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082" com.smlztrk.seelogd`.
- Ekran görüntüsü: `adb exec-out screencap -p > raw.png`, sonra PIL ile 540×1200'e küçült; dokunma koordinatı = görüntü × 2 (`adb shell input tap X Y`).
- **Tuzak:** odaksız alana `adb shell input text` ile içinde iki "r" olan metin yazmak RN geliştirici yeniden yüklemesini tetikler. Yazmadan önce klavyenin açık olduğunu ekran görüntüsüyle doğrula, mümkünse "r" içermeyen metin kullan.
- Donanım GERİ tuşu kök ekranda uygulamadan çıkıp emülatördeki Google Hesabı sayfasına düşürebilir; uygulama içi geri düğmesini kullan.
- RevenueCat kırmızı geliştirme kutusu sekme çubuğunu örter; kapatırken dokunuş alttaki öğeye geçebilir.
