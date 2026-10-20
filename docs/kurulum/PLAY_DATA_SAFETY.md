# Play Console — Data Safety formu (koddan çıkarıldı)

**Kaynak:** 2026-09-24 kod taraması (`services/`, `utils/`, `components/`, `screens/`, `app.json`).
**Nerede doldurulur:** Play Console › Policy and programs › App content › **Data safety**.
**Kural:** Play yalnızca **cihazdan çıkan** veriyi "toplanıyor" sayar. Cihazda kalan izinler (takvim
yazma, galeriye kaydetme) burada beyan EDİLMEZ.

---

## 1. Karar gerektiren iki konu (formdan ÖNCE)

### 1.1 Advertising ID — beyan mı, kapatma mı?
Firebase Analytics Android'de reklam kimliğini **varsayılan olarak** toplar ve kodda bunu kapatan
bir ayar yok. İki seçenek:

> **24 Eyl doğrulandı:** 1.4.6 AAB manifestinde `com.google.android.gms.permission.AD_ID`
> ve `android.permission.ACCESS_ADSERVICES_AD_ID` mevcut — reklam kimliği gerçekten toplanıyor.

- **A) Olduğu gibi bırak** → Data safety'de "Device or other IDs" işaretlenir, ayrıca Play'in
  **Advertising ID** beyanı doldurulur. İleride reklam/atıf yapacaksan bu yol.
- **B) Kapat** → `app.json` Android manifest'ine `google_analytics_adid_collection_enabled=false`
  meta-data'sı eklenir. AD_ID izni düşer, form sadeleşir. Reklam atıfı hiç düşünmüyorsan bu yol
  daha temiz. **Native değişiklik → yeni build gerekir.**

> Uygulamada hiç reklam yok, `expo-ads`/AdMob bağımlılığı da yok. B mantıklı görünüyor ama
> yeni build maliyeti var — kapalı testi geciktirmemek için şimdilik A ile ilerlemek de savunulabilir.

### 1.2 `READ_MEDIA_IMAGES` izni — ÇÖZÜLDÜ (2026-09-24)
`app.json` ve manifest bu izni istiyordu ama aktif kodda hiçbir yerde fotoğraf **seçilmiyor**;
izin yalnızca `expo-media-library`'nin tam erişim isteyen `requestPermissionsAsync()` çağrısı
yüzünden geliyordu. Play, geniş fotoğraf izni isteyen uygulamalara **Photo & Video Permissions**
beyanı doldurtuyor ve "sadece kaydediyorsan write-only kullan" diyor.

Yapılan:
- Dört kaydetme noktası write-only'ye çevrildi: `storyShareService.js`, `ImageGalleryModal.js`,
  `StoryShareScreen.js`, `WrappedScreen.js` → `requestPermissionsAsync(true)`.
- `PermissionsSection.js`: `expo-image-picker` tabanlı "Fotoğraflar" satırı kaldırıldı
  (fotoğraf seçme akışı yok), galeri satırı write-only sorguluyor.
- `READ_MEDIA_IMAGES` + `READ_MEDIA_VISUAL_USER_SELECTED` → `blockedPermissions` /
  manifest'te `tools:node="remove"`.
- Native değişiklik → `app.json` version **1.4.5 → 1.4.6** (runtimeVersion politikası appVersion).

**Sonuç: Photo & Video Permissions beyanı artık hiç açılmıyor.**
**24 Eyl doğrulandı:** 1.4.6 AAB manifestinde iki izin de yok; cihazda hikâye kartı ve Wrapped
görseli galeriye sorunsuz kaydediliyor. (Android ≤12'de `WRITE_EXTERNAL_STORAGE` zaten
`blockedPermissions`'ta — eski sürümlerde kaydetme kısıtlı olabilir, bugünkü değişiklikten bağımsız.)

---

## 2. TOPLANAN veriler

Hepsi **kullanıcı kimliğine bağlı** (linked), hiçbiri **geçici işlenmiyor** (ephemeral değil),
hiçbiri **kullanıcı tarafından kapatılamıyor** (uygulamada analytics/crash anahtarı yok →
"Required" işaretlenecek).

| Play kategorisi | Ne | Nerede | Amaç (Play seçenekleri) |
|---|---|---|---|
| Personal info › **Name** | `displayName` | `userService.js:175` | App functionality, Account management |
| Personal info › **Email address** | `email` | `userService.js:174` | App functionality, Account management |
| Personal info › **User IDs** | `uid`, `username` | `userService.js:249` | App functionality, Account management |
| Personal info › **Other info** | `birthDate` (yaş kapısı) | `userService.js:176` | App functionality |
| Financial info › **Purchase history** | abonelik durumu | RevenueCat + `revenueCatWebhook` | App functionality |
| Messages › **Other in-app messages** | DM / sohbet | `chatRtdb.js` | App functionality |
| Messages › **Other in-app messages** | AI sohbet metinleri | Gemini proxy (`functions/index.js`) | App functionality |
| App activity › **Other user-generated content** | yorum, gönderi, liste, puan, izleme kaydı, içe aktarılan veri | Firestore | App functionality |
| App activity › **App interactions** | ekran görüntüleme + olaylar | `analytics.js:79,98` | **Analytics** |
| App info and performance › **Crash logs** | Sentry | `crashReporting.js:76` | Analytics *(veya App functionality)* |
| App info and performance › **Diagnostics** | Sentry performans (`tracesSampleRate: 0.15`) | `crashReporting.js:86` | Analytics |
| **Device or other IDs** | Advertising ID, Firebase installation ID, push token | Analytics + `expo-notifications` | Analytics, App functionality |

> **Not:** `analytics.js:110` ve `crashReporting.js:105` `uid` gönderiyor → bu iki kalem de
> **"Data is linked to the user"**. Aksini işaretleme.

---

## 3. TOPLANMAYAN veriler (hepsine "Hayır")

| Kategori | Neden |
|---|---|
| **Location** | Konum paketi yok, izin istenmiyor. |
| **Photos and videos** | Firebase Storage **hiç kullanılmıyor**, fotoğraf yükleme yok. Galeriye yalnızca **yazılıyor** (write-only izin). |
| **Calendar** | `phoneCalendar.js` yalnızca cihazda etkinlik **oluşturuyor/siliyor**; takvim verisi okunup gönderilmiyor. |
| **Contacts** | Paket/izin yok. |
| **Audio files** | `RECORD_AUDIO` ve `READ_MEDIA_AUDIO` `blockedPermissions`'ta. |
| **Health and fitness** | İlgisiz. |
| **Web browsing history** | Toplanmıyor. |
| **Financial info › Payment info** | Ödeme tamamen Google Play'de; uygulama kart bilgisi görmüyor. |
| **Files and docs** | Kullanıcı içe aktarma dosyası seçiyor (`ImportDataModal`) ama dosya saklanmıyor; içeriği izleme kaydı olarak App activity altında beyan ediliyor. |

---

## 4. Paylaşım (sharing) sorusu → **HAYIR**

Play'in tanımında "paylaşım", veriyi **hizmet sağlayıcı dışındaki** üçüncü taraflara aktarmaktır.
Firebase, Sentry, RevenueCat ve Gemini bu uygulama için **işleyici/hizmet sağlayıcı** — hiçbiri
reklam, veri satışı veya kendi amaçları için kullanmıyor. Dolayısıyla her kalem için
"Is this data shared with third parties?" → **Hayır**.

---

## 5. Güvenlik bölümü

| Soru | Cevap |
|---|---|
| Data encrypted in transit? | **Evet** — tüm trafik HTTPS/TLS (Firebase SDK, Functions, TMDB). |
| Can users request data deletion? | **Evet** — uygulama içi tam hesap silme + web formu. |
| Silme URL'si | `https://seelogd.com/delete-account.html` (canlı olduğunu teyit et) |
| Committed to Play Families policy? | **Hayır** — çocuklara yönelik değil, asgari yaş 13. |
| Independent security review? | Hayır. |

---

## 6. Doldururken sırayla işaretlenecek akış

1. "Does your app collect or share any of the required user data types?" → **Evet**
2. "Is all of the user data collected by your app encrypted in transit?" → **Evet**
3. "Do you provide a way for users to request that their data is deleted?" → **Evet** + URL
4. Sonra kategori kategori yukarıdaki tablo 2'yi işaretle; tablo 3'tekilere dokunma.
5. Her seçilen kalem için: Collected **Evet** / Shared **Hayır** / Processed ephemerally **Hayır** /
   Required **Evet** / Purpose = tablodaki amaç.

---

## 7. 16 Ekim 2026 güncellemesi — 24 Eylül taramasından SONRA eklenenler

Gizlilik politikası 1.1 (`website/privacy.html`) bu listeye göre yazıldı. Formu doldururken/güncellerken
tablo 2'ye şunlar eklenir (hepsi **linked**, **Shared: Hayır**, **Required** — kapatma anahtarı yok):

| Play kategorisi | Ne | Kaynak | Amaç |
|---|---|---|---|
| Messages › **Other in-app messages** | AI sohbet GEÇMİŞİ artık hesapta saklanıyor (`AiConversations/{uid}/items`) — tablo 2'deki "AI sohbet metinleri"nin saklama kısmı | `services/userData/aiConversations.js` | App functionality |
| App activity › **Other user-generated content** | Geri bildirim kutusu: başlık, açıklama, kategori, önem, dil (`Feedback`) + dört favori (`Users.fourFavorites`) | `feedbackService.js`, `fourFavoritesService.js` | App functionality |
| App info and performance › **Diagnostics** | Geri bildirimde isteğe bağlı cihaz bilgisi: uygulama sürümü, platform, OS sürümü, cihaz modeli | `FeedbackScreen.js` (`includeDevice`) | App functionality |
| Personal info › **Email address / Name** | Apple ile giriş (Apple'ın paylaştığı e-posta/ad, gizli yönlendirme adresi olabilir) | `appleAuthService.js` | App functionality, Account management |

- **Reklam kimliği:** 16 Ekim'de hâlâ toplanıyor (`google_analytics_adid_collection_enabled=true`, AD_ID izni).
  Gizlilik politikası bunu artık AÇIKÇA söylüyor ("yalnız ölçüm, reklam yok"). Kararı değiştirip B yolunu
  (kapatma) seçersen politikadaki "Kullanım ölçümü" bölümü ve "Toplamadığımız veriler" kutusundaki cümleler de
  sadeleşmeli.
- **Takvim:** `READ_CALENDAR`+`WRITE_CALENDAR` izni var ama yalnız uygulamanın kendi etkinliklerini yazar/siler,
  veri çıkmaz → formda yine "Hayır" (tablo 3 geçerli). İzin sebebi politikada "Telefon takvimi (isteğe bağlı)".
- **Sentry performans** (`tracesSampleRate: 0.15`) tablo 2'de zaten var; politika artık "performans ölçümü" diyor.
- **iOS App Store gizlilik etiketi** (App Privacy) için de aynı döküm: Contact Info (e-posta, ad), User Content,
  Identifiers (kullanıcı kimliği, cihaz kimliği), Usage Data, Diagnostics, Purchases; Tracking = YOK
  (ATT istenmiyor). Apple 5.1.2(i): üçüncü taraf AI'a kişisel veri gidiyorsa açık bilgilendirme/izin beklenir —
  AI Ayarları'nda "Listelerimi kullan" varsayılan KAPALI ve ipucu metni Gemini'yi açıkça söylüyor.

---

**İlgili:** `REVENUECAT_KURULUM.md` (abonelik tarafı), `YAYIN_ONCESI_AI_GOREV_PLANI.md` C5.
