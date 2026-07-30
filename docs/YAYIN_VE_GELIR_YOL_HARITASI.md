# SEELOGD — YAYIN VE GELİR YOL HARİTASI

> Hazırlanma tarihi: **7 Temmuz 2026**
> Hedef: Google Play + App Store'da para kazandıran bir uygulama olarak yayınlamak.
> Kapsam: Güvenlik, performans, özellikler, yasal uyum, fiyatlandırma, maliyet/gelir dengesi,
> pazarlama ve tarihli yayın takvimi.

---

## 0. YÖNETİCİ ÖZETİ

Uygulama **özellik olarak yayına hazıra çok yakın, ticari olarak sıfır noktasında.**
İçerik takibi + sosyal + oyun + AI sohbet + Wrapped kombinasyonu, Letterboxd/TV Time
tarzı rakiplere göre gerçek bir farklılaşma sunuyor. Ancak:

- **Gelir altyapısı hiç yok** (IAP yok, abonelik yok, reklam yok).
- **Ölçüm altyapısı hiç yok** (analytics yok, crash reporting yok) — para kazanan bir
  uygulama ölçemediği şeyi optimize edemez.
- **1 kritik güvenlik/maliyet açığı var**: Gemini API anahtarı istemciye gömülü —
  APK'dan çıkarılıp sınırsız kullanılabilir, faturası sana kesilir. Yayın blokeri.
- **iOS tarafı hiç yapılandırılmamış** (bundle ID bile yok) — App Store için ayrı iş.
- **Yasal riskler çözülmeli**: TMDB ticari kullanım koşulları, "Seelogd" marka
  kontrolü, mağaza veri güvenliği formları.

**Önerilen takvim (tek geliştirici):**

| Kilometre taşı                                  | Tarih                |
| ----------------------------------------------- | -------------------- |
| Faz 0 — Yayın blokerleri (güvenlik + yasal)     | 7 Tem – 26 Tem 2026  |
| Faz 1 — Gelir + ölçüm altyapısı                 | 27 Tem – 23 Ağu 2026 |
| Faz 2 — Polish + kapalı test + mağaza hazırlığı | 24 Ağu – 13 Eyl 2026 |
| 🚀 **Google Play TR yayını (soft launch)**      | **21–25 Eylül 2026** |
| Google Play global açılım                       | Ekim 2026 ortası     |
| 🚀 **App Store yayını (global)**                | **19–30 Ekim 2026**  |
| Wrapped viral kampanyası                        | Aralık 2026          |

Toplam: Android yayınına ~11 hafta, tam global (iOS dahil) ~15-16 hafta.

---

## 1. MEVCUT DURUM ANALİZİ

### 1.1 Özellik envanteri (güçlü yönler)

| Alan            | Durum                                                                                                     |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| İçerik keşfi    | TMDB tabanlı: trendler, türler, platformlar (watch providers), Oscar, koleksiyonlar, vizyondakiler        |
| Takip           | İzlenen film/dizi, bölüm bazlı takip, listeler, notlar, hatırlatıcılar, takvim                            |
| İstatistik      | Film/dizi istatistik ekranları, MyActivity, **Wrapped** (yıl özeti — viral potansiyeli en yüksek özellik) |
| Sosyal          | Feed (post/beğeni/yorum/bookmark), arkadaşlık, takip, engelleme, bildirimler, presence                    |
| Mesajlaşma      | 1-1 chat + grup chat (anket, pin, alıntı)                                                                 |
| Oyun            | Sahne tahmin oyunu: modlar, zorluklar, liderlik tabloları, başarımlar (Part 01-25 tamam)                  |
| Turnuva         | Aylık topluluk oylaması (bracket)                                                                         |
| AI              | Gemini tabanlı film/dizi öneri sohbeti                                                                    |
| Kişiselleştirme | Temalar, custom theme, 56 avatar, pet companion, poster ayarları                                          |
| i18n            | TR + EN                                                                                                   |
| Push            | Cloud Functions + Expo Push backend kurulu ✅                                                             |
| Hesap silme     | Uygulama içi mevcut ✅ (mağaza zorunluluğu)                                                               |

Bu genişlikte özellik seti kategoride nadir. **Sorun özellik eksikliği değil;
ticarileştirme, ölçüm ve uyum eksikliği.**

### 1.2 Güvenlik analizi

**🔴 KRİTİK — yayın blokeri:**

1. **Gemini API anahtarı istemcide** (`EXPO_PUBLIC_GEMINI_API_KEY`,
   `services/aiCineService.js`, `screens/chat/AIChatScreen.js`, `components/ChatModal.js`,
   `hooks/useSceneGame.js`). `EXPO_PUBLIC_*` değişkenleri APK/IPA içine düz metin gömülür.
   Anahtar çıkarılır → sınırsız Gemini kullanımı → **fatura sana**. Ayrıca abonelikle AI
   kotası satacaksan istemci anahtarıyla kota uygulanamaz.
   **Çözüm:** Cloud Function proxy (`callGemini` callable) + Firebase **App Check** +
   kullanıcı başına günlük kota (Firestore sayaç). Eski anahtarı iptal et, yenisini
   yalnız sunucuda tut.
2. **TMDB anahtarı istemcide** — daha az kritik (TMDB ücretsiz katman) ama anahtar
   çalınıp rate-limit'in tüketilebilir. Kısa vadede kabul edilebilir; orta vadede aynı
   proxy'ye taşı. App Check tek başına bunu da büyük ölçüde hafifletir.

**🟠 YÜKSEK — ilk sürümde düzeltilmeli:**

3. **Firestore counter cross-write** (`Users` update kuralı `onlyUpdating([...Count])`):
   herhangi bir kullanıcı herkesin `friendsCount`/`unreadNotifsCount` değerini keyfî
   sayıya yazabilir (increment zorunluluğu yok). Troll'e açık. **Çözüm:** kuralda
   `request.resource.data.X == resource.data.X + 1 || -1` kısıtı veya sayaçları Cloud
   Function trigger'a taşı.
4. **Chat kuralı substring eşleşmesi**: `chatId.matches('.*' + uid + '.*')` — uid'ler
   rastgele olduğundan pratik çakışma düşük ama kural niyeti ifade etmiyor; `split('_')`
   ile tam eşleşme yap (`chatId == uid1_uid2` deseni).
5. **`Lists/{uid}` tüm oturum açmış kullanıcılara okunur** — gizlilik yalnız UI'da.
   Gizli liste özelliği vaat ediyorsan kurala `listVisible`/friend kontrolü ekle.
6. **Oyun skorları istemci yazımlı** (Part 17'de belgelenmiş, `verified=false` ile
   işaretleniyor ✅). Dereceli sezon/ödül eklemeden önce Cloud Function doğrulaması şart;
   şimdilik "doğrulanmamış" rozeti yeterli.

**🟡 ORTA:**

7. App Check hiç yok — Firestore'a uygulama dışından erişim mümkün. Play Integrity +
   App Attest ile aç (Faz 0'da; Gemini proxy zaten gerektiriyor).
8. `google-services.json` içindeki Firebase anahtarı gizli değildir (normal), ama App
   Check olmadan kötüye kullanım kolaylaşır.
9. Kullanıcı üretimi içerik (UGC) var → **rapor + engelle mevcut ✅** (PostReports,
   blocked). Apple 1.2 kuralı için ayrıca **yorum/mesaj için de** rapor akışı ve
   "içeriği gizle" seçeneği olduğunu App Review notlarında belirt.

### 1.3 Performans

`docs/PERFORMANS_INCELEME_RAPORU.txt` (Opus 4.8, 13 Haz 2026) zaten mükemmel bir
envanter çıkarmış. Yayın öncesi **mutlaka** yapılacak alt küme:

- **IconBacground**: her ekranda 45 absolute `<Image>` + 175 PNG statik require.
  Tek başına en büyük genel maliyet. Lite-mode veya tek pre-render edilmiş arka plan
  görseline indir.
- **PetCompanion sürekli animasyon + BlurView**: düşük cihazlarda `deviceTier`
  kontrolüyle kapat/durağanlaştır.
  - Sprite kare hızı kısma ✅ (`perfPreset.spriteFpsScale`).
  - BlurView: `components/common/AdaptiveBlurView.js` eklendi — `low` katmanda
    blur yerine yarı saydam düz katman çizer, mid/high'da görüntü birebir aynı.
    **Geçiş TAMAMLANDI (29 Tem):** 28 dosya AdaptiveBlurView kullanıyor;
    `expo-blur`'ü doğrudan import eden tek dosya sarmalayıcının kendisi.
- **ProfileStatsContext global ağır türetme**: hesaplamayı ekrana girişte lazy yap.
- **Açılışta toptan provider mount**: ağır context'leri (Posts, Stats) ilk kullanım
  anına ertele.
- Hermes + `newArchEnabled: true` zaten açık ✅; FlatList/expo-image disiplini yerinde ✅.

Kalanlar (listener birleştirme vb.) yayın sonrası iterasyona kalabilir. **Ölçüm
olmadan daha fazla optimizasyona girme** — önce Faz 1'de Sentry/Firebase Performance
kur, gerçek cihaz verisiyle devam et.

### 1.4 Eksik altyapı

| Eksik           | Neden kritik                                                                     | Öneri                                                            |
| --------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Analytics       | Dönüşüm hunisi, retention, paywall ölçümü olmadan fiyat/özellik kararı verilemez | Firebase Analytics (ücretsiz) + temel event seti                 |
| Crash reporting | Mağaza puanını en hızlı düşüren şey sessiz crash'ler                             | Sentry (ücretsiz katman) veya Crashlytics                        |
| Otomatik test   | Oyun skorlaması dışında yok                                                      | Yayın öncesi sadece kritik akış smoke testleri; genişletme sonra |
| CI              | Yok                                                                              | EAS Build zaten var; şimdilik yeterli                            |
| OTA güncelleme  | Kritik bug'da mağaza onayı beklememek için                                       | `expo-updates` (EAS Update) ekle — yayın sonrası hayat kurtarır  |

### 1.5 Yasal / mağaza uyumluluğu

1. **TMDB ticari kullanım** 🔴: TMDB ücretsiz API'si ticari olmayan kullanım içindir.
   Para kazanan uygulama için TMDB ile ticari koşullar hakkında iletişime geç
   (birçok küçük uygulama atıf şartıyla kullanıyor; yazılı onay en güvenlisi).
   Zorunlular: **"This product uses the TMDB API but is not endorsed or certified by
   TMDB"** atfı + logo (ayarlar/hakkında ekranı) ve watch-provider verisi için
   **JustWatch atfı** (MovieProviders/TvShowsProviders ekranlarına).
2. **Marka kontrolü** 🔴: "Seelogd" adı için TÜRKPATENT + EUIPO + USPTO ve her iki
   mağazada ad çakışması kontrolü yap. (Slug'daki "Seelogd" adını hiçbir görünür
   yerde kullanma — "flix" Netflix'in agresif koruduğu bir ek.) Ad değişecekse en ucuz
   zaman şimdi.
3. **Android izinleri** 🟠: `WRITE_EXTERNAL_STORAGE` (deprecated), `READ_MEDIA_AUDIO`,
   `READ_MEDIA_VIDEO` muhtemelen gereksiz → Play, geniş medya izinlerinde açıklama
   ister, reddetme sebebi olabilir. Story kaydetme için `READ_MEDIA_IMAGES` +
   `READ_MEDIA_VISUAL_USER_SELECTED` yeterli olmalı. Temizle.
4. **Gizlilik Politikası + Hesap Silme web sayfası** 🔴: İki mağaza da URL ister; Play
   ayrıca web üzerinden hesap silme talep yolu ister. Basit bir statik site yeterli
   (Firebase Hosting, ücretsiz). KVKK + GDPR uyumlu metin.
5. **Play Data Safety + Apple Privacy Nutrition** formları: toplanan veriler (e-posta,
   kullanıcı adı, mesajlar, kullanım verisi) doğru beyan edilmeli.
6. **Sign in with Apple** 🔴 (iOS): Google Sign-In sunduğun için Apple, kendi girişini
   **zorunlu** tutar. iOS sürümüne eklenecek.
7. **Play kapalı test şartı** 🟠: Kişisel geliştirici hesabı (13 Kas 2023 sonrası
   açıldıysa) production erişimi için **12 test kullanıcısıyla kesintisiz 14 gün**
   kapalı test ister. Takvimde Faz 2'ye yerleştirildi — test kullanıcılarını
   (arkadaş/aile/topluluk) ŞİMDİDEN ayarla.
8. **Yaş derecelendirme**: UGC + chat → IARC anketinde doğru beyan; muhtemelen 12+/Teen.
   `adultContent` ayarı varsayılan KAPALI kalmalı.

---

## 2. PARA KAZANMA STRATEJİSİ

### 2.1 Model: Freemium abonelik + (ölçülü) reklam

Kategori gerçeği: içerik takip uygulamalarında kullanıcılar çekirdek takibe para
ödemez; **kimlik, statü, konfor ve derin içgörüye** öder (Letterboxd Pro/Patron,
TV Time premium örnekleri). Bu yüzden:

**ASLA kilitleme (büyüme motoru):** izleme takibi, listeler (makul limit), sosyal
feed, arkadaş/chat, temel istatistikler, oyunun temel modu, turnuva oylaması.
Sosyal özellik kilitlemek ağ etkisini öldürür.

**Seelogd Premium içeriği:**

| Kategori | Özellik                                                                                                 |
| -------- | ------------------------------------------------------------------------------------------------------- |
| Konfor   | Reklamsız deneyim                                                                                       |
| AI       | AI sohbet: free 5 mesaj/gün → premium 100/gün (sunucu tarafı kota — Faz 0 proxy'si bunu mümkün kılıyor) |
| İçgörü   | Gelişmiş istatistikler, tüm-zamanlar Wrapped, CSV/dışa aktarım                                          |
| Kimlik   | Özel temalar + custom theme, premium pet kostümleri, profil rozeti, özel avatar çerçeveleri             |
| Oyun     | Premium oyun modları/kaynakları, gelişmiş başarım takibi                                                |
| Güç      | Sınırsız liste/not/hatırlatıcı (free: örn. 5 liste, 50 hatırlatıcı)                                     |

Mevcut kod tabanı için iyi haber: temalar, pet, oyun modları, Wrapped ve AI zaten
var — **premium paket %80 hazır, sadece kapı (entitlement) eklenecek.**

### 2.2 Fiyatlandırma

Hedef kitle TR + EN → **bölgesel fiyatlandırma şart** (Türkiye'de küresel fiyat
satmaz; küresel pazarda TR fiyatı para bırakır).

| Plan                |              Türkiye | Global (ABD baz) | Not                                              |
| ------------------- | -------------------: | ---------------: | ------------------------------------------------ |
| Premium aylık       |               ₺79,99 |            $3.99 | 100 CineMatch AI mesajı/gün + Premium özellikler |
| Premium yıllık ⭐   |    ₺599,99 (≈₺50/ay) |           $29.99 | Aylık ödemeye göre yaklaşık %37 avantaj          |
| Unlimited aylık     |              ₺159,99 |            $7.99 | Sınırsız AI + sınırsız güç özellikleri           |
| Unlimited yıllık ⭐ | ₺1.199,99 (≈₺100/ay) |           $59.99 | Aylık ödemeye göre yaklaşık %37 avantaj          |

- Mağaza komisyonu: iki mağazada da küçük işletme programıyla **%15** → net ~%85.
- İlk fiyat testi bu dört mağaza fiyatıyla başlatılır; kampanya/deneme uygulanacaksa
  mağaza promosyonu olarak ayrıca tanımlanır ve arayüz yalnız gerçek oranı gösterir.
- Fiyatları Faz 1'de RevenueCat üzerinden kur ki sonradan A/B test edebilesin.

### 2.3 Reklam (ikincil gelir)

- **Sadece free kullanıcıya.** Önerilen yüzeyler: feed'de her ~8 postta 1 native ad,
  oyun sonu ekranında interstitial (oturum başına en fazla 1), hatırlatıcı ekranında
  banner YOK (UX'i bozar).
- Rewarded video fırsatı: "reklam izle → 3 ek AI mesajı / 1 ek oyun hakkı" — TR'de
  eCPM'i en yüksek format ve premium'a köprü kurar.
- AdMob + `react-native-google-mobile-ads`. UMP ile GDPR/consent akışı zorunlu.
- Beklenti yönetimi: TR trafiğinde reklam ARPDAU düşüktür (~$0.005–0.02). Reklam
  "kâr merkezi" değil, "premium'a itici + marjinal gelir" olarak konumlandır.

### 2.4 Teknik altyapı önerisi

**RevenueCat** (ücretsiz katman: aylık $2.5K gelire kadar): tek SDK ile iki mağaza,
deneme/iptal/upgrade yönetimi, webhook → Firestore `Users/{uid}.entitlements` senkronu,
paywall A/B testi hazır. Elle StoreKit/Billing yazmaktan haftalarca ucuz.

Entitlement kontrolü tek noktadan: `usePremium()` hook'u → tüm premium kapılar bundan
okur. Firestore'a da yansıt ki Cloud Function'lar (AI kota) görebilsin.

---

## 3. MALİYET / GELİR DENGESİ

### 3.1 Sabit maliyetler

| Kalem                                 | Maliyet                                                   |
| ------------------------------------- | --------------------------------------------------------- |
| Google Play geliştirici               | $25 (tek sefer)                                           |
| Apple Developer                       | $99/yıl                                                   |
| Alan adı (seelogdapp.com vb.)        | ~$15/yıl                                                  |
| EAS Build                             | Ücretsiz kota başlangıç için yeterli; yoğunlaşınca $19/ay |
| Firebase Hosting (politika sayfaları) | Ücretsiz                                                  |
| RevenueCat / Sentry / Analytics       | Ücretsiz katman                                           |

**Toplam yıl-1 sabit: ~$150–400.** Giriş bariyeri fiilen yok.

### 3.2 Değişken maliyetler (kullanıcı başına)

- **Firestore**: sosyal + chat + presence yoğun ama FAZ 1-12 optimizasyonları yapılmış.
  Gerçekçi tahmin: **$0.02–0.06 / MAU / ay**. (İzlenecek: presence heartbeat +
  feed listener'ları. Analytics kurulunca gerçek read/write sayısıyla doğrula.)
- **Gemini 2.5 Flash**: mesaj başına ~$0.001–0.003. Free kota 5 mesaj/gün olsa bile
  tavan: aktif AI kullanıcısı başına ~$0.15–0.45/ay → **kota şart** (Faz 0'da geliyor).
- **Cloud Functions (push)**: 10K MAU'da bile ~$5–10/ay. İhmal edilebilir.
- **TMDB**: ücretsiz (ticari koşullar netleşene kadar risk kalemi olarak izle).

### 3.3 Senaryo tablosu (1 USD ≈ ₺40 varsayımı — kuru güncelle)

Varsayımlar: %85'i TR kitle (soft launch sonrası), premium dönüşüm %1,5–2,5
(kategori normali), abone başına karma net ~₺55/ay (TR ağırlıklı, yıllık planlar
aylığa bölünmüş, mağaza kesintisi düşülmüş).

| Senaryo                    | Aylık altyapı maliyeti | Abonelik geliri (%2)                                    | Reklam geliri | Net              |
| -------------------------- | ---------------------- | ------------------------------------------------------- | ------------- | ---------------- |
| 1.000 MAU                  | $40–90                 | 20 abone ≈ ₺1.100 ($28)                                 | ~$10–30       | 🔴 −$20…−50      |
| 10.000 MAU                 | $300–650               | 200 abone ≈ ₺11.000 ($275)                              | ~$100–300     | 🟡 başabaş bandı |
| 50.000 MAU                 | $1.400–3.000           | 1.000 abone ≈ ₺55.000 ($1.375) + global abonelerle üstü | ~$500–1.500   | 🟢 pozitif       |
| 50K MAU + %30 global kitle | aynı                   | global abone değeri TR'nin ~2,5 katı → ~$2.500–3.500    | ~$800–2.000   | 🟢 net kârlı     |

**Çıkarımlar:**

1. **Başabaş ~8–15K MAU bandında** — ilk 6 ayın tek hedefi bu bandı geçmek.
2. **Global (EN) kullanıcı, TR kullanıcının ~2,5–4 katı gelir getirir** → iOS + global
   Android açılımı gelir planının parçası, "sonra bakarız" işi değil.
3. En tehlikeli maliyet kalemi AI idi; Faz 0 kota çözümüyle tavanlanıyor.
4. Zarar penceresi (ilk aylar) aylık ~$50–100 — taşınabilir düzeyde.

---

## 4. PAZARLAMA PLANI

### 4.1 ASO (mağaza optimizasyonu)

- **Başlık formülü:** "Seelogd: Film & Dizi Takibi" (TR) / "Seelogd: Movie & TV
  Tracker" (EN) — kategori anahtar kelimesi başlıkta olmalı.
- Anahtar kelimeler TR: film takip, dizi takip, izleme listesi, film önerisi, dizi
  arkadaşı, film oyunu. EN: movie tracker, tv show tracker, watchlist, what to watch.
- Ekran görüntüleri hikâye anlatmalı (ilk 3 tanesi indirme kararını verir):
  1. "İzlediklerini takip et" 2) "Arkadaşlarınla paylaş" 3) "Wrapped — film yılın"
  2. "Sahne tahmin oyunu" 5) "AI film önerisi". Koyu tema + gerçek içerik.
- Küçük ama etkili: yayın ilk haftasında 20–30 gerçek kullanıcı yorumu organize et
  (kapalı test grubuna in-app review prompt) — ilk sıralama sinyali.

### 4.2 Lansman stratejisi

1. **TR soft launch (Eylül)**: sadece Google Play TR. Amaç gelir değil; retention
   (D1 >%35, D7 >%15 hedef), crash oranı (<%1) ve paywall dönüşüm verisi.
2. **Topluluk tohumlama**: TR film Twitter'ı/X, r/movies değil ama r/television yerine
   TR odaklı: Ekşi Sözlük başlığı, TikTok/Reels film hesaplarıyla mikro işbirliği
   (₺0–5K bütçe), Discord film sunucuları. Oyun + Wrapped klipleri en paylaşılabilir
   içerik.
3. **Ürün içi viral döngüler (zaten kodda var, parlat):**
   - Wrapped/story paylaşım kartları (`StoryShareScreen`, `SceneResultShareCard`) →
     her karta köşede logo + indirme linki/QR ekle. **En ucuz kullanıcı edinme kanalın bu.**
   - Oyun skoru paylaşımı → "beni geçebilir misin?" linki.
   - Arkadaş davet et: davet eden + edilen 1'er hafta premium (RevenueCat promo).
4. **Global açılım (Ekim)**: soft launch metrikleri hedefi tutuyorsa EN pazarlar +
   iOS. Product Hunt lansmanı iOS çıkışıyla aynı haftaya denk getir.
5. **Aralık — Wrapped kampanyası**: Spotify Wrapped dalgasının (Aralık ilk haftası)
   üstüne "Film/Dizi Wrapped'ın hazır" push + sosyal kampanya. Yılın en büyük organik
   fırsatı; Ekim'den itibaren Wrapped'ı buna göre cilala.
6. **Ücretli reklam**: başabaş öncesi büyük bütçe YOK. Sadece Ekim'de $200–300'lük
   Google UAC testi ile CPI öğren (TR CPI ~$0.10–0.30 beklenir); LTV > CPI netleşince ölçekle.

---

## 5. TARİHLİ YOL HARİTASI

> Tek geliştirici + AI destekli tempo varsayımı. Haftalar Pazartesi başlangıçlı.

### FAZ 0 — Yayın Blokerleri: Güvenlik + Yasal (7 Tem – 26 Tem, 3 hafta)

**Hafta 1 (7–13 Tem)**

- [x] Gemini proxy Cloud Function (`callGemini` callable) + istemcinin buna geçirilmesi
      (AIChatScreen, ChatModal, aiCineService — not: useSceneGame Gemini KULLANMIYORMUŞ,
      kapsam dışı çıktı) _(8 Tem — kod; **29 Tem — DEPLOY EDİLDİ**: billing (Blaze)
      açıldı, 7 fonksiyonun tamamı canlı. Secret'lar: GEMINI_API_KEY,
      TMDB_API_KEY, REVENUECAT_WEBHOOK_AUTH, REVENUECAT_SECRET_API_KEY (v1 sk_).
      callGemini doğrulandı: anonim istek 401 UNAUTHENTICATED — 404 değil.
      "Asistan şu anda kullanılamıyor" hatası bununla çözüldü. NOT: RevenueCat
      webhook'unun PANEL tarafı yapılandırılmadı — Play ürünleri tanımlanınca
      Integrations→Webhooks'a fonksiyon URL'si + Authorization değeri girilecek.)_
- [ ] Eski Gemini anahtarını iptal et _(yeni anahtar 29 Tem'de Functions
      secret'ına kondu ve canlıda çalışıyor; KALAN: AI Studio'da ESKİ anahtarın
      — ve yanlışlıkla komut satırına yazılıp iptal edilmesi istenen ara
      anahtarın — silindiğinin teyidi)_
- [x] Kullanıcı başına günlük AI kotası (Firestore sayaç `AiUsage/{uid}`, sunucu tarafı;
      free 5 / premium 100) _(8 Tem)_
- [ ] **Apple Developer hesabını bugün aç** (onay + D-U-N-S günler/haftalar sürebilir)
- [ ] "Seelogd" marka taraması (TÜRKPATENT/EUIPO/USPTO + mağaza araması) → AD KARARI

**Hafta 2 (14–20 Tem)**

- [x] Firebase App Check — KOD tarafı _(29 Tem: `@react-native-firebase/app-check`
      25.1.0 + `services/appCheck.js`. Native katman Play Integrity token'ı
      üretir (dev'de "debug" provider), web SDK'ya CustomProvider köprüsüyle
      bağlanır — Firestore/Functions istekleri token taşır. Native modül
      eklendiği için `version` 1.4.1'e çekildi. ① TAMAM _(30 Tem: App Check
      API etkin, Android uygulaması Play Integrity ile kayıtlı, dev cihazın
      debug token'ı izin listesinde, dev build logcat'i attestation hatasız.)_
      **KALAN (sırasıyla):**
      ② yeni build dağıtıldıktan sonra Console metriklerinde "verified"
      isteklerin oranını izle, ③ TÜM aktif build'ler App Check'li olunca:
      functions/index.js `enforceAppCheck: true` + deploy ve Console'dan
      Firestore/RTDB enforcement — ERKEN açılırsa eski build'ler kırılır.
      iOS App Attest Faz 3'te.)_
- [x] Firestore rules düzeltmeleri: counter increment kısıtı (±1), chat tam eşleşme
      (`split('_')`), Lists gizlilik kuralı (`privacy.lists`) _(8 Tem — kod;
      **29 Tem — rules DEPLOY EDİLDİ**, featureRequests kuralı kaldırılmış hâliyle)_
- [x] Android izin temizliği (WRITE_EXTERNAL_STORAGE, READ_MEDIA_AUDIO/VIDEO,
      RECORD_AUDIO çıkarıldı — manifest `tools:node="remove"` + app.json
      `blockedPermissions`) _(8 Tem — erken bitti)_
- [ ] TMDB'ye ticari kullanım için yaz _(MANUEL)_ — [x] TMDB (zorunlu cümle + resmi
      logo, Ayarlar→Hakkında) + JustWatch atıfları (provider ekranları) uygulamaya
      eklendi _(8 Tem)_

**Hafta 3 (21–26 Tem)**

- [x] Gizlilik politikası + kullanım şartları + web hesap silme sayfası (Firebase Hosting)
      _(25 Tem — `website/privacy.html`, `website/terms.html`,
      `website/delete-account.html` + ortak `legal.css`/`legal.js`; TR/EN dil
      anahtarı landing ile aynı localStorage'ı paylaşıyor, landing footer'ına
      linkler eklendi. **29 Tem — hosting DEPLOY EDİLDİ**: seelogd.com özel alan
      adı dahil tüm sayfalar 200 dönüyor — Play formlarına girilecek adresler:
      https://seelogd.com/privacy.html + https://seelogd.com/delete-account.html.
      KALAN: sayfalardaki `mark.todo` alanları (veri sorumlusunun
      kimliği/ülkesi, yetkili mahkeme) doldurulacak)_
      Aynı turda: `waitlist` kuralı `read`→`get` (koleksiyon listeleme kapatıldı;
      e-postalar herkese dökülebiliyordu).
- [x] expo-updates (EAS Update) entegrasyonu — yayın sonrası acil yama kanalı
      _(26 Tem — `expo-updates ~29.0.19`, app.json'a `updates.url` +
      `runtimeVersion`, eas.json'daki 3 profile `channel` (kanalsız build
      hiçbir güncellemeye abone olmaz).
      **runtimeVersion politikası `appVersion`, `fingerprint` DEĞİL:**
      fingerprint parmak izi yerel `node_modules`'tan hesaplanıyor ve
      Windows'ta üretilen hash EAS'in Linux imajınınkiyle tutmuyordu
      (dokunulmamış paketlerde bile: skia, svg, screens, webview…). O hâliyle
      yerelden yayınlanan hiçbir OTA güncellemesi build'lere ULAŞAMAZDI.
      **Bunun getirdiği disiplin:** runtime sürümü artık app.json'daki
      `version` alanı. Native tarafı değiştiren her şeyde (paket ekleme/çıkarma,
      SDK yükseltme, config plugin) `version` MUTLAKA artırılmalı — yoksa eski
      native'e uymayan bir JS güncellemesi eski build'lere düşer ve çökertir.
      Yalnız JS değiştiyse `version` sabit kalır, OTA doğru şekilde ulaşır.)_
- [ ] Kapalı test için 12+ test kullanıcısı listesini kesinleştir

### FAZ 1 — Gelir + Ölçüm Altyapısı (27 Tem – 23 Ağu, 4 hafta)

**Hafta 4 (27 Tem – 2 Ağu)**

- [x] Firebase Analytics + Sentry kurulumu; temel event seti
      (signup, content_tracked, post_created, game_played, ai_message,
      paywall_view, trial_start, purchase)
      _(26 Tem — erken bitti, KOD tarafı. Paketler: `@sentry/react-native`,
      `@react-native-firebase/app` + `/analytics` (app.json'a config plugin
      olarak eklendi). Sarmalayıcılar: `services/analytics.js`,
      `services/crashReporting.js` — uygulamanın hiçbir yeri Sentry/Firebase'i
      doğrudan import etmez; DSN veya native modül yoksa her çağrı sessiz
      no-op olur (mevcut dev client patlamaz). Olay adı/parametre doğrulaması
      `utils/analyticsEvents.js`'te saf ve testli (Firebase geçersiz olayı
      SESSİZCE atar; artık __DEV__'de görünür hata veriyor). `signup` →
      GA4'ün önerdiği `sign_up` adıyla, `method: email|google`.
      Bağlanan yerler: ErrorBoundary (üretimde iz bırakmadan yutulan React
      hataları), `utils/firestoreError.js` (sessizce yutulan snapshot
      hataları — enjekte edilen raporlayıcı ile), NavigationContainer
      `onStateChange` → `screen_view`, auth durumu → user id, PremiumContext →
      `premium_tier` özelliği, `services/deviceTier.js` → `device_tier`.
      Olaylar servis katmanına bağlandı (ekranlara değil): listItemsService /
      watchedTvService (`content_tracked`), postsService, sceneGameService,
      aiCineService (token sayımlarıyla), revenueCatService (paywall `source`
      parametresiyle + `purchase`/`trial_start` ayrımı), userService.
      ①② TAMAM _(29 Tem — Sentry projesi açıldı: org `seelogd`, proje
      `react-native`, bölge de.sentry.io; app.json plugin'inde
      organization/project/url var. DSN + `SENTRY_AUTH_TOKEN` EAS'te
      preview+production ortamlarında, "sensitive" görünürlükte. TUZAK:
      token EAS'e ilk yapıştırmada son ~5 karakteri kırpılmıştı → build
      Sentry upload'da "Invalid org token (401)" ile düştü. Doğrulama:
      token'ı ekrana basmadan uzunluk (org token 187 krk) + API'ye curl
      ile 200 kontrolü. 29 Tem preview build yeşil, source map yüklemesi
      çalışıyor.)_
      ③ TAMAM _(29 Tem — yeni development build alındı, ölçümün native
      modülleri içinde.)_ **KALAN (manuel):** ④ Firebase Console →
      Analytics'te DebugView ile olayları doğrula.)_
- [x] Google Play Console hesabı _(29 Tem — developer hesabı AÇILDI)_
      — [ ] ürün kaydı; IAP ürünlerinin tanımı (Pro/Unlimited abonelikleri,
      TR+global fiyat; RevenueCat panel bağlantısı + webhook yapılandırması
      bununla birlikte)

**Hafta 5–6 (3–16 Ağu)**

- [x] RevenueCat entegrasyonu — KOD tarafı _(erken bitti, commit 2b77a93:
      `services/revenueCatService.js`, Pro/Unlimited akışı. KALAN: Play
      Console'da abonelik ürünlerinin tanımı (TR+global fiyat) + RevenueCat
      panelinde Play service credentials bağlanması — Play Console hesabı
      ön koşul)_
- [x] `usePremium()` entitlement katmanı _(`context/PremiumContext.js`;
      Firestore senkronunun kapsamı doğrulanacak)_
- [x] Paywall ekranı _(`screens/premium/PremiumScreen.js`; mağaza bazlı
      deneme/fiyat testi ürünler Play'de tanımlanınca)_
- [ ] Premium kapılar: AI kota farkı, temalar, pet kostümleri, oyun modları,
      gelişmiş istatistik/Wrapped, liste limitleri _(kodda kısmen mevcut —
      kapıların tam listesi çıkarılıp tek tek doğrulanacak)_

**Hafta 7 (17–23 Ağu)**

- [ ] AdMob: feed native ad + oyun sonu interstitial + rewarded ("reklam izle → AI mesajı") + UMP consent akışı (yalnız free kullanıcı)
- [ ] Onboarding akışı: 3 ekran değer anlatımı → zevk seçimi → bildirim izni
      (paywall'u onboarding SONUNA koy, soft göster)
      _(kodda `screens/onboarding/OnboardingScreen.js` + `OnboardingShowcases.js`
      mevcut — buradaki kapsamla karşılaştırılıp ona göre işaretlenecek)_

### FAZ 2 — Polish + Kapalı Test + Mağaza Hazırlığı (24 Ağu – 13 Eyl, 3 hafta)

**Hafta 8 (24–30 Ağu)**

- [ ] 🔑 **Kapalı test BAŞLAR (24 Ağu)** — Play 14 gün / 12 kullanıcı sayacı işlemeye başlar
- [x] Performans kritikleri: IconBacground lite-mode, PetCompanion device-tier,
      ProfileStats lazy hesaplama, ağır provider'ların ertelenmesi
      _(26 Tem — erken bitti. Cihaz sınıfı altyapısı: `utils/deviceTier.js` (saf,
      testli) + `services/deviceTier.js`. IconBacground: 174 desen görseli ayrı
      modüle alınıp LAZY require edildi (desen varsayılan kapalı — kapalıyken
      artık hiç asset kaydı yok), 345 → 174 çift require temizlendi, düşük
      katmanda ızgara 45 → 24 öğe. SpritePet: kare ilerletme setInterval+setState
      yerine Reanimated shared value ile UI thread'inde; pet/AI FAB uygulama arka
      plandayken duruyor (`hooks/useAppActive.js`). ProfileStats: sıralama /
      gruplama / en çok tekrar izlenenler artık getter — yalnız istatistik ve
      Wrapped ekranları okuyunca hesaplanıyor; bölüm listesi iki kez flatten
      ediliyordu, teke indi. Ağır provider ertelemesi zaten yapılmıştı:
      useStartupGate (Posts 2200 / Stats 3200 / DeviceNotifications 4200) +
      TabScreen sekmeleri kademeli mount ediyor.)_
- [ ] Crash/ANR takibi: test grubundan gelen Sentry verisiyle düzeltme turu

**Hafta 9 (31 Ağu – 6 Eyl)**

- [ ] Mağaza varlıkları: ekran görüntüleri (TR+EN), feature graphic, tanıtım videosu (30 sn)
- [ ] Data Safety formu + IARC anketi + ASO metinleri
- [ ] Düşük cihaz + tablet + büyük font + TR/EN test matrisi

**Hafta 10 (7–13 Eyl)**

- [ ] 7 Eyl: 14 gün doldu → production erişim başvurusu
- [ ] Paywall/onboarding verisiyle son ayar; sürüm dondurma (release candidate)
- [ ] iOS paralel başlangıç: bundle ID, Firebase iOS app, GoogleService-Info.plist,
      Sign in with Apple, APNs — ilk EAS iOS build

### FAZ 3 — YAYIN (14 Eyl – 31 Eki)

- [ ] **14–19 Eyl**: Play production'a gönder (inceleme 1–7 gün)
- [ ] 🚀 **21–25 Eyl: Google Play TR yayını** — aşamalı: %10 → %50 (3 gün sorunsuzsa) → %100
- [ ] Eyl sonu: topluluk tohumlama kampanyası + in-app review prompt aktif
- [ ] **Ekim H1–H2**: soft launch metrik değerlendirmesi (D1/D7, crash, dönüşüm)
      → Google Play global açılım
- [ ] **Ekim H2**: TestFlight beta (1–2 hafta) + App Store başvurusu
      (App Review notlarına: UGC moderasyon mekanizmaları, demo hesap)
- [ ] 🚀 **19–30 Eki: App Store global yayını** + Product Hunt lansmanı

### FAZ 4 — Yayın Sonrası Büyüme (Kas – Ara 2026)

- [ ] Haftalık sürüm ritmi (EAS Update ile hotfix, 2 haftada bir mağaza sürümü)
- [ ] Kasım: davet sistemi + paywall A/B testleri (RevenueCat) + UAC testi ($200–300)
- [ ] **Aralık ilk haftası: WRAPPED KAMPANYASI** — yılın en büyük organik dalgası
- [ ] Backend skor doğrulama (dereceli oyun sezonu) — premium oyun değerini artırır
- [ ] Metrik hedefleri (Aralık sonu): 10K+ MAU, D7 ≥ %15, premium dönüşüm ≥ %1,5,
      crash-free ≥ %99

---

## 6. RİSKLER VE KARARLAR

| Risk                                       | Olasılık             | Etki   | Aksiyon                                                                                     |
| ------------------------------------------ | -------------------- | ------ | ------------------------------------------------------------------------------------------- |
| TMDB ticari kullanımı reddeder/ücret ister | Düşük-orta           | Yüksek | Faz 0'da yazılı iletişim; B planı: Trakt/OMDb hibrit veya lisans ücreti bütçele             |
| "Seelogd" marka çakışması                 | Orta                 | Orta   | Faz 0 hafta 1'de tarama; gerekiyorsa yeniden adlandırma (şimdi ucuz, sonra pahalı)          |
| Apple, UGC/moderasyon nedeniyle reddeder   | Orta                 | Orta   | Rapor+engelle+gizle akışlarını Review notlarında belgele; demo hesap ver                    |
| AI maliyeti patlar                         | Düşük (kota sonrası) | Orta   | Sunucu kota + günlük bütçe alarmı (Billing alert $50/$100)                                  |
| Play 14 gün kapalı test gecikmesi          | Orta                 | Takvim | Test kullanıcılarını Temmuz'da topla; 24 Ağu'da kesin başlat                                |
| Tek geliştirici tükenmişliği               | Orta                 | Yüksek | Faz kapsamlarını KORU — yeni özellik ekleme dondurması: yayına kadar sadece bu listedekiler |

**Şimdi verilmesi gereken 3 karar:**

1. Uygulama adı (marka taraması sonrası) — her şey buna bağlı.
2. Reklam ilk sürümde olacak mı? (Önerim: evet ama minimal — rewarded + oyun sonu;
   feed native ad'i global açılıma ertele.)
3. Lifetime planı sunulacak mı? (Önerim: evet, ilk 6 ay "kurucu" teklifi olarak.)

---

_Bu doküman canlı tutulmalı: her faz sonunda durum işaretle, tarih kayarsa tabloyu güncelle._
