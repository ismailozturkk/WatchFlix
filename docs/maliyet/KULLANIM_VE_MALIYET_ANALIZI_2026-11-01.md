# Seelogd — Kullanım ve Maliyet Analizi (Firestore · TMDB · OMDb · Gemini · Functions)

**Tarih:** 1 Kasım 2026 · **Yöntem:** canlı projeden salt-okunur ölçüm (Cloud Monitoring, Cloud Billing kataloğu, Auth
sayıları) + kaynak kod taraması + resmi fiyat/koşul sayfaları. Hiçbir ayar değiştirilmedi, hiçbir kod değiştirilmedi.
Her sayının yanında **ÖLÇÜLDÜ** ya da **TAHMİN** yazar.

---

## 0. Kısa cevap

1. **Bugün Firestore için 0 TL ödüyorsun.** Son 31 günün en yoğun gününde 18.313 okuma oldu. Günlük ücretsiz kota 50.000.
   Dev Monitor'daki "1,97 ₺" gerçek fatura değil; ücretsiz kota düşülmeden hesaplanmış bir tutar. (ÖLÇÜLDÜ)
2. **Ama endişen haklı:** aktif kullanıcı başına günde **~3.000 okuma** yapılıyor. 10.000 günlük kullanıcıda bu
   **günde 30 milyon okuma, ayda ~540 $ (~27.000 ₺)** demek. (TAHMİN; ölçülen orandan)
3. **Okumaların neredeyse tamamı aynı sebepten:** uygulama açıkken sürekli açık duran **~20-25 canlı dinleyici**
   var ve Firestore yerel önbelleği yalnız bellekte. Resmi kurala göre bu durumda **uygulama her ön plana döndüğünde
   ya da bağlantı her koptuğunda bütün dinleyiciler baştan, tam ücretle okunuyor.** (ÖLÇÜLDÜ + resmi kural)
4. **Yapıyı bozmadan** 1. ve 2. aşamadaki düzeltmelerle kullanıcı başına günlük okumayı **~300'e (10 kat azalma)**
   indirmek gerçekçi. Bu da 10.000 kullanıcıda **ayda ~55 $ (~2.700 ₺)** eder. (TAHMİN)
5. **Supabase'i şimdi önermiyorum.** Okuma başına ücret almıyor, ama Firestore'u düzelttikten sonra kazanç küçük
   kalıyor: iki veritabanı, iki ayrı güvenlik kuralı sistemi ve iki ayrı çevrimdışı senkron demek. Dar bir alan için
   (herkese açık yorumlar/akış) seçenek olarak duruyor; ayrıntılar §6'da.
6. **Para dışı bir risk daha var ve daha acil:** TMDB'nin ticari kullanımı yazılı sözleşme istiyor; abonelikli
   uygulama ticari sayılıyor (§7). OMDb sorun değil: Patreon üyeliğin var (ayda 1 $, günde 100.000 istek;
   1 Kas'ta kullanıcı bildirdi). Mevcut önbellekle bile 10.000 kullanıcıya yeter.

---

## 1. Ölçülen gerçek durum (canlı proje, son 31 gün)

### 1.1 Firestore
| Ölçüm | Değer | Not |
|---|---|---|
| Toplam okuma | **135.180** (günde ort. 4.361, en yüksek 18.313) | ÖLÇÜLDÜ, `document/read_ops_count` |
| Okuma türü | Sorgu/dinleyici **%96**, tek belge (getDoc) %2, bulunamayan %2 | ÖLÇÜLDÜ, `read_count` type etiketi |
| Yazma | 2.820 oluşturma + 4.853 güncelleme + **1.875 "boş" güncelleme** | Boş güncelleme = veriyi değiştirmeyen ama faturalanan yazım |
| Silme | 740 | |
| Eşzamanlı açık dinleyici (günlük tepe) | **32–77**, bağlantı sayısı 1–7 | → bağlantı başına ~20-25 dinleyici |
| Veritabanı konumu | **eur3** (Avrupa çoklu bölge), Standard sürüm, ücretsiz katman açık | |
| Yerel önbellek | `memoryLocalCache` (yalnız bellek; diske yazılmıyor) | `firebase.js:55` |

### 1.2 Kullanıcı sayısı (Auth, yalnız sayılar)
- 23 hesap; son 1 günde 2, son 7 günde 6, son 30 günde 11 aktif.
- Son 7 günde günde ort. 7.900 okuma ÷ ~2-3 günlük aktif = **aktif kullanıcı başına günde ~2.600-3.900 okuma**.
  Bu oranda senin geliştirme sürümün de var (sıcak yenileme, Dev Monitor): gerçek bir kullanıcı muhtemelen daha az
  okur. Örnek küçük; tahminler bu belirsizliği taşır.

### 1.3 Birim fiyatlar (Google Cloud Billing kataloğundan, Standard sürüm)
| | eur3 (senin konumun) | europe-west1 Belçika (tek bölge) |
|---|---|---|
| 100.000 okuma | **0,060 $** | 0,033 $ |
| 100.000 yazma | **0,180 $** | 0,099 $ |
| 100.000 silme | 0,020 $ | — |
| Depolama GiB/ay | 0,18 $ | 0,165 $ |
| Ücretsiz / gün | 50.000 okuma · 20.000 yazma · 20.000 silme · 1 GiB | |

Uygulamadaki `PRICING` sabitleri (0,06 / 0,18 ve 1 $ = 50 TL) eur3 ile uyumlu. Bu belgede TL için de 50 kullanıldı.

### 1.4 Diğer servisler
| Servis | 30 günlük kullanım | Maliyet durumu |
|---|---|---|
| Cloud Functions | En çok çağrılanlar: `cleanupExpiredCineRooms` 1.478 (zamanlanmış, 15 dk'da bir), `getExternalRatings` **496**, `onUserProfileUpdated` 457, `expirePromoGrants` 290; `callGemini` 37 | Aylık 2M ücretsiz çağrının çok altında |
| Realtime Database | 6,1 MB gönderim | Aylık 10 GB ücretsiz; ihmal edilebilir |
| Gemini 2.5 Flash | Ekranında 9 istek / 12K token ≈ 0,0067 $ | Kota ve hız sınırıyla kontrollü; ölçekte de küçük |
| TMDB | Ekranında 5.327 istek, %64 önbellekten | Para yok, **lisans konusu var (§7)** |
| OMDb (IMDb/RT puanı) | 496 fonksiyon çağrısı / 30 gün, 6 kullanıcı | Patreon: 1 $/ay, **günde 100.000 istek** — rahat |

---

## 2. Dev Monitor neden yanıltıcı

`services/usageTrackerService.js` gerçek faturayı değil, kodda elle işaretlenen noktaları sayıyor:

- **Fazla sayıyor:** Dinleyicilerin çoğu her bildirimde `snap.docs.length` sayıyor (ör. `friendsService.js:64`,
  `notificationsService.js:55`, `activityService.js:36`, `UnreadMessagesContext.js:58`). Firestore yalnız
  **değişen** belgeyi faturalar. 50 arkadaşın varken biri adını değiştirince fatura 1 okuma, monitör 50 yazar.
- **Eksik sayıyor:** Takip satırı olmayan okumalar hiç görünmüyor. Örneğin arkadaş profili (5 koleksiyonun tamamı),
  film yorumları, turnuva, puanlar, oyunlar ve kuralların kendi içinde yaptığı okumalar.
- **Geliştirme sürümü canlıya yazıyor:** tek proje var (staging yok). Her Metro yenilemesi bütün dinleyicileri baştan
  okur ve bu, gerçek faturaya da yansır.

Gerçek rakam için tek güvenilir kaynak Cloud Monitoring (§1). Dev Monitor'ün düzeltilmesi §8'de.

---

## 3. Okumalar nereden geliyor (kod envanteri)

### 3.1 Uygulama boyunca HEP açık olan dinleyiciler (App.js sağlayıcıları)
Her açılışta, her ön plana dönüşte ve her bağlantı kopmasında **hepsi baştan, tam ücretle** okunur (önbellek
yalnız bellekte; resmi kural: "persistence kapalıysa her kopup bağlanma yeni sorgu gibi faturalanır").

| # | Dinleyici | Dosya | Sınır | Bir açılışta okuma (tipik aktif kullanıcı, TAHMİN) |
|---|---|---|---|---|
| 1 | Kendi profilim `Users/{uid}` | `context/UserProfileContext.js:169` | tek belge | 1 |
| 2 | Sosyal bağlantılar | `services/socialLinksService.js:8` | tek belge | 1 |
| 3 | Gizli hesap bilgisi | `services/accountPrivateService.js:75` | tek belge | 1 |
| 4 | Liste kökü `Lists/{uid}` | `context/ListStatusContext.js:298` | tek belge | 1 |
| 5 | **Arkadaşlar (tamamı)** | `services/friendsService.js:61` | yok | 50 |
| 6 | Gelen istekler | `friendsService.js:84` | bekleyenler | 2 |
| 7 | Giden istekler | `friendsService.js:104` | bekleyenler | 2 |
| 8 | **Engellenenler (tamamı)** | `friendsService.js:483` | yok | 3 |
| 9 | Bildirimler | `services/notificationsService.js:52` | 30 | 30 |
| 10 | **Gizlenen gönderiler (tamamı)** | `services/hiddenPostsService.js:42` | yok | 5 |
| 11 | **Herkese açık akış** | `context/PostsContext.js:202` → `postsService.js:335` | 15 | 15 + **her yeni gönderi ve beğenide 1** |
| 12 | Ortak listelerim | `services/sharedListsService.js:268` | yok | 3 |
| 13 | **Her ortak listenin TÜM öğeleri** (liste başına ayrı dinleyici) | `context/SharedListsContext.js:110` | yok | 3 × 50 = 150 |
| 14 | **Sohbetler (tamamı)** | `context/UnreadMessagesContext.js:55` | yok | 30 |
| | **Toplam / açılış** | | | **≈ 290** |

Varsayım: günde ~10 ön plana dönüş/yeniden bağlanma × ~290 ≈ **2.900 okuma/gün**. Tablodaki adetler (50 arkadaş,
30 sohbet, 3 ortak liste × 50 öğe) de varsayım. Bu, ölçülen 2.600-3.900 ile örtüşüyor.
Yani **asıl kaynak bu tablo**.

### 3.2 Kullanıcı sayısıyla KARESEL büyüyenler (en tehlikeli)
| Yer | Sorun | 10K kullanıcıda etkisi (TAHMİN) |
|---|---|---|
| `context/PostsContext.js:202` akış dinleyicisi | Akış ekranı açık olmasa da uygulama boyunca açık. İlk 15 gönderiye her yeni gönderi / beğeni / yorum sayacı → **çevrimiçi herkese 1 okuma** | 1.000 çevrimiçi × günde 2.000 akış olayı = **2M okuma/gün** |
| `components/Comment.js:799` film/dizi yorumları | **`limit` yok.** Detay sayfası açılınca o filmin bütün yorumları okunuyor | Popüler film 500 yorum × günde 2.000 görüntüleme = **1M okuma/gün** |
| `components/Comment.js:907` yanıtlar, `postsService.js:601` gönderi yorumları | `limit` yok | aynı desen, daha küçük |

### 3.3 Tek seferlik ama pahalı okumalar
| Yer | Ne yapıyor | Maliyet |
|---|---|---|
| `screens/tabs/profile/FriendProfileScreen.js:446-450` | Arkadaş profili her açıldığında **5 koleksiyonun tamamını** okuyor (izlenen film/dizi, favoriler, izleme listesi, özel listeler); önbellek yok, monitörde görünmüyor | 1.000 izlemeli arkadaş = **profil açılışı başına 1.000+** |
| `context/ListStatusContext.js:345-358` `refreshList` | Yenile / sapma onarımı **delta yerine 4 listenin tamamını** çekiyor; `syncListDelta` var ama kullanılmıyor | Kütüphane boyu kadar, her yenilemede |
| `services/cineswipe/cineswipeService.js:103` | İzleme listesinin tamamını Firestore'dan okuyor; aynı veri cihazda zaten var (`listSyncService.getLocalList`) | Liste boyu, gereksiz |
| `services/ratingsService.js:235`, `services/activityService.js:33` | Puanlarım / etkinliğim: `limit` yok | Kullanıcı geçmişi büyüdükçe artar |
| `services/tournamentService.js:355` | Bütün oy koleksiyonu; yalnız eski aylar için (kodda uyarılı) | Eski ay açılınca |

### 3.4 İyi olanlar (dokunma)
- Listeler: yerel MMKV + "eksikse çek" deseni (`services/listSyncService.js`) — açılışta liste okuması yok.
- Notlar/hatırlatıcılar: yerel-öncelikli, yalnız yazım senkronu (`services/userData/`).
- TMDB: MMKV + bayat-göster-arkada-tazele (`utils/apiCache.js`), 24 saat / 7 gün TTL.
- `utils/cachedRead.js`: Firestore için hazır "taze değilse oku" yardımcısı. Aşağıdaki önerilerin çoğu bunu kullanıyor.
- Kurallardaki `get()` okumaları sorgu başına bir kez faturalanıyor, yani küçük pay.

---

## 4. Ölçek projeksiyonu (TAHMİN)

Hesap: (günlük okuma − 50.000 ücretsiz) × 0,06 $ / 100.000 × 30 gün; 1 $ = 50 TL. Yalnız Firestore okuma.
Yazma, depolama ve Functions bugünkü oranlarla bu tablonun yanında küçük kalıyor.

| Günlük aktif | Bugünkü desen (3.000/kişi) | Gerçek kullanıcı tahmini (1.000/kişi) | Düzeltme sonrası hedef (300/kişi) |
|---|---|---|---|
| 100 | 300K/gün → **4,5 $/ay** (~225 ₺) | 100K → 0,9 $ | 30K → **0 $** (ücretsiz kota) |
| 1.000 | 3M → **53 $/ay** (~2.650 ₺) | 1M → 17 $ | 300K → 4,5 $ |
| 10.000 | 30M → **539 $/ay** (~27.000 ₺) | 10M → 179 $ | 3M → **53 $/ay** (~2.650 ₺) |
| 10.000 + §3.2 karesel kalemler | +3M/gün → **+54 $/ay** ve kullanıcıyla birlikte hızla büyür | | düzeltilince ihmal edilebilir |

---

## 5. Yapıyı bozmadan maliyet azaltma (öncelik sırasıyla)

### Aşama 1 — Hızlı ve düşük riskli (her biri birkaç dosya; birlikte ~%40-60 azalma, TAHMİN)
1. **Akış dinleyicisini yalnız akış ekranı açıkken çalıştır** (`PostsContext.js:192`). Ekran odakta değilken kapat,
   dönünce önbellekten çiz ve bir kez `getDocs` ile tazele. Karesel büyümeyi tamamen keser.
   > ✅ **YAPILDI (1 Kas).** `useLiveFeed()`: akış ekranı ve Hub akış kartı odaktayken dinleyici açık, odak gidince
   > 60 sn sonra kapanır (kısa sekme geçişi yeniden okutmaz). Açılıştaki ayrı ilk sayfa okuması kalktı (ilk sayfa ve
   > sayfalama imleci dinleyiciden). Ek bulgu, aynı işte düzeltildi: **beğendiklerim ve kaydettiklerimin tamamı her
   > açılışta okunuyordu** (beğeni başına 1 okuma). Artık yalnız akış ekranına ilk girişte okunuyor. Testler:
   > `__tests__/postsLiveFeed.test.js` (5). Cihazda denenmedi.
2. **Yorumlara sayfalama:** `Comment.js:799/907` ve `postsService.js:601` → `limit(20)` + "daha fazla yükle"
   (`startAfter`). Toplam sayı zaten sayaç alanında gösterilebilir.
   > ✅ **Film/dizi yorumları YAPILDI (1 Kas).** En yeni 20 yorum canlı; "Daha fazla yorum göster" 20 ekler. Sezon/bölüm
   > süzgeci istemcide çalışır (eski yorumlarda kapsam alanı yok), bu yüzden süzgeçte 20'den az eşleşme varsa sonraki
   > sayfalar kendiliğinden çekilir (en fazla 200 yorum). Çip sayıları devamı varken "+" ile gösterilir. 5 dilde
   > çeviri eklendi. **Bilinçli bırakılan:** gönderi yorumları (`postsService.js` düz model, yanıtlar aynı koleksiyonda
   > `parentId` ile; sayfalama yanıtı üst yorumundan ayırabilir) ve yorum yanıtları (yalnız açılınca dinleniyor).
   > Bekçi: `__tests__/readCostGuards.test.js`. Cihazda denenmedi.
   >
   > **Ek (1 Kas, kullanıcı kararı):** Sohbette çevrimiçi / "Sohbette" / "yazıyor" / son görülme göstergeleri
   > kaldırıldı. Sohbet ekranı artık arkadaşın RTDB durumunu dinlemiyor ve "yazıyor" sinyali yazmıyor. Başlıkta
   > `@kullanıcıadı` gösteriliyor. Aynı gün ikinci adımda **çevrimiçi durumu uygulamanın tamamından kaldırıldı**:
   > arkadaş profilindeki durum çipi ve avatar noktası, gizlilik ayarlarındaki "Çevrimiçi Durumu" seçeneği, yeni
   > hesapların `privacy.onlineStatus` varsayılanı ve tanıtım ekranındaki "çevrimiçi" etiketi. Artık hiçbir ekran
   > başka birinin RTDB durumunu okumuyor. Kalan tek parça görünmez altyapı: kişinin kendi bağlantı kaydı ve "sohbette"
   > bayrağı (sunucu açık sohbetin push'unu bununla susturuyor; bayrak yalnız canlı bağlantı kaydıyla geçerli).
   > `services/chatRtdb.js` içindeki typing/meta fonksiyonları artık çağrılmıyor, testleriyle birlikte duruyor.
3. **Arkadaş profili:** üst kısım ve istatistik için yalnız `Lists/{friendUid}` kök belgesi (zaten dinleniyor, 1
   okuma). Koleksiyonlar yalnız ilgili sekme açılınca ve `cachedRead` ile (ör. 6 saat taze kabul) okunsun.
4. **`refreshList` → `syncListDelta`:** yenilemede yalnız `updatedAt > son senkron` okunur. Silinen öğeler için kök
   belgedeki `statusIndex` sapma denetimi zaten var.
5. **CineSwipe** izleme listesini `getLocalList(uid, "watchList")`'ten okusun → 0 okuma.
6. **Puanlarım / etkinliğim** dinleyicilerine `limit` + sayfalama.
7. **OMDb önbelleği (düşük öncelik, günde 100.000 sınırı var):** istemcide oturumluk `Map` yerine MMKV, 7 gün
   (puanlar yavaş değişir). Amaç kotayı korumak değil, detay sayfasında puanın anında gelmesi ve Functions çağrısının
   azalması. Sunucu tarafı paylaşımlı önbellek bu kotayla gerekmiyor.

### Aşama 2 — Yapısal ama mimariyi değiştirmeyen (asıl büyük kazanç; toplam hedef ~10 kat)
8. **Seyrek değişen hep-açık dinleyicileri "önbellek + delta"ya çevir.** Bu desen listelerde zaten çalışıyor.
   - Arkadaşlar, engellenenler, gizlenen gönderiler, ortak liste öğeleri, sosyal bağlantılar, gizli hesap bilgisi:
     açılışta MMKV'den çiz, `where("updatedAt", ">", sonSenkron)` ile yalnız değişenleri oku.
   - Canlı kalması gerekenler: sohbetler, bildirimler, gelen istekler, kendi profilim.
   - Gereken: ilgili belgelere `updatedAt` alanı (çoğunda var) ve silme için "tombstone" ya da kök sayaç.
9. **Ortak liste öğeleri:** liste başına hep-açık dinleyici yerine yalnız liste ekranı açıkken. Uygulama genelindeki
   "bu film ortak listede mi" işareti için `SharedLists/{id}` belgesine küçük bir öğe kimliği dizini (en fazla birkaç
   yüz kimlik) yazılsın; 3 × 50 okuma yerine 3 okuma.
10. **Kalıcı yerel önbellek: Firestore'u yerel SDK'ya taşımak** (`@react-native-firebase/firestore`; app,
    app-check ve analytics zaten bu aileden). Disk önbelleği ve "30 dakika içinde yeniden bağlanınca yalnız
    değişeni öde" kuralı bununla devreye girer. Açılış performansı notundaki "çift Firebase SDK birleştirme" işiyle
    aynı iş: 69 dosya `firebase/firestore`'dan import ediyor, modüler API büyük ölçüde aynı. Orta-büyük, mekanik bir
    geçiş. Tek başına hep-açık dinleyici maliyetini kısa arka plan dönüşlerinde büyük ölçüde siler. 8. ile birlikte
    yapılırsa en büyük kazanç.

### Aşama 3 — Herkese aynı görünen veriyi CDN'den ver
11. **Firestore veri paketleri (bundles) + Firebase Hosting CDN:** Top 100, turnuva havuzu, liderlik tabloları,
    Oscar/Emmy (`AppConfig`), Günün Sorusu metni gibi herkes için aynı olan veriler. Bir zamanlanmış fonksiyon
    saatte bir paketi üretir, istemci CDN'den indirir. **Firestore okuması 0** (Hosting: ayda 10 GB ücretsiz,
    sonrası GB başına ücret). Kullanıcı sayısıyla büyüyen okumayı sabit maliyete çevirir.

### Bilinçli olarak ÖNERMEDİKLERİM
- **Veritabanını tek bölgeye (Belçika) taşımak:** okuma %45 daha ucuz. Ama konum sonradan değiştirilemez; yeni
  veritabanı + tam veri göçü gerekir ve çoklu bölgenin yüksek erişilebilirliği kaybolur. 5. aşamadan sonra
  rakamlar hâlâ büyükse konuşuruz.
- **Dinleyicileri arka planda kapatmak:** persistence yokken geri açmak yine tam ücret. Sorunu çözmez, 10.
  maddeyle birlikte anlamlı olur.

---

## 6. Supabase hibrit değerlendirmesi

### Supabase ne sunuyor (resmi fiyat sayfası)
- **Pro: 25 $/ay.** İçinde 8 GB disk, 250 GB çıkış trafiği, 100.000 aylık aktif kullanıcı, 500 eşzamanlı realtime
  bağlantı, ayda 5M realtime mesaj, 2M edge function çağrısı ve 10 $ işlem kredisi (Micro sunucu).
- Aşım: GB başına 0,09 $ çıkış; her 1.000 ek eşzamanlı realtime bağlantı için 10 $.
- **Okuma/yazma başına ücret YOK.** Maliyet sabit sunucu + trafik.
- **Firebase Auth ile çalışabiliyor ("Third-Party Auth"):** kullanıcılar Firebase'de kalır, Supabase Firebase'in
  kimlik jetonunu kabul eder. Belgedeki önemli uyarı: kuralların (RLS) jetonun hangi Firebase projesinden geldiğini
  (`iss`/`aud`) mutlaka denetlemesi gerekiyor. Firebase UID'si metin, UUID değil.

### Seelogd'a uyumu
| Veri | Supabase'e uygun mu | Neden |
|---|---|---|
| Film/dizi yorumları, herkese açık akış, puan toplamları, Top 100, liderlikler | **Evet, en iyi aday** | Herkese açık, okuma ağırlıklı, sayfalı. SQL ve HTTP önbelleği ile kullanıcı sayısından bağımsız maliyet |
| Sohbet, bildirim, arkadaşlık, presence | Hayır | Firestore'un gerçek zamanlı ve çevrimdışı senkronu güçlü. Supabase realtime 500 bağlantıdan sonra ücretli |
| Kişisel listeler, notlar, ayarlar | Hayır | Zaten yerel-öncelikli. Firestore okuması neredeyse yok |

### Maliyet karşılaştırması (10.000 günlük aktif, TAHMİN)
| Yol | Aylık |
|---|---|
| Firestore, bugünkü desen | ~540 $ |
| Firestore, Aşama 1-2 sonrası | **~55 $** |
| Firestore (düzeltilmiş) + Supabase Pro (yorumlar/akış oraya) | ~40 $ Firestore + 25-60 $ Supabase (sunucu boyu + trafik) ≈ **65-100 $** |

### Öneri
**Şimdi değil.** Aşama 1-2 sonrası Firestore tek başına Supabase'li hibritten ucuz ya da ona yakın. Hibrit üstüne
şunları getirir: ikinci bir güvenlik kuralı sistemi (RLS + Firestore kuralları), ikinci bir yedekleme/izleme yükü ve
kendi çevrimdışı katmanı olmayan bir veri kaynağı. **Ne zaman yeniden düşünelim:** Aşama 1-2'den sonra ölçümde
herkese açık sosyal içerik (yorum/akış) toplam okumanın yarısını geçerse. O zaman yalnız o bölüm taşınır; kimlik
Firebase'de kalır.

---

## 7. Para dışı riskler (limit ve lisans)

| Konu | Durum | Neden önemli | Öneri |
|---|---|---|---|
| **TMDB ticari kullanım** | Resmi API koşulları: lisans ticari kullanıma izin vermiyor; ticari kullanım ayrı yazılı sözleşme ister ve "ticari mi" kararını TMDB verir. Bir üçüncü taraf kaynak, 1M $ altı ciroya ~149 $/ay diyor (TMDB sayfasında doğrulanamadı) | Seelogd'da ücretli Premium var. Uygulamadaki "%100 ücretsiz" notu (`usageTrackerService.js` `tmdb`) bu açıdan yanıltıcı | **Yayından önce TMDB ile iletişime geç** (karar senin). Maliyet tablosuna olası lisans ücretini ekle |
| OMDb günlük sınır | **Çözülmüş:** Patreon üyeliği, 1 $/ay, günde 100.000 istek (1 Kas, kullanıcı bildirdi). Ücretsiz anahtar 1.000/gün olurdu | Bugünkü oran (6 kullanıcıda ayda 496 çağrı) 10.000 kullanıcıda günde ~28.000'e çıkar, sınırın dörtte biri (TAHMİN). Sınır aşılırsa uygulama TMDB puanına döner, çökmez | Üyeliği sürdür. Madde 7 yalnız hız için |
| IMDb veri setleri | Resmi IMDb veri setleri yalnız ticari olmayan kullanım için | OMDb yerine "bedava" alternatif gibi görünse de Seelogd ticari | Kullanma |
| Gemini | Kota + hız sınırı sunucuda | Ölçekte de küçük kalem (giriş 0,15 $/M token, çıkış 0,60 $/M) | Değişiklik gerekmiyor |

---

## 8. Ölçümün kendisini düzeltmek (önerilen)
- Dev Monitor dinleyicilerde `snap.docs.length` yerine **`snap.docChanges().length`** saysın ve
  `snap.metadata.fromCache` olan bildirimleri atlasın. Bunun doğru örneği zaten var: `hiddenPostsService.js:45`.
- Takipsiz `getDocs` noktalarına (`FriendProfileScreen`, `Comment.js`, `cineswipeService`, `tournamentService`,
  `ratingsService`) `trackFirestoreRead` eklensin.
- `npm run usage:report`: §1'deki canlı ölçümü (günlük okuma/yazma, dinleyici, kullanıcı sayısı, Functions çağrıları)
  tek komutla basan salt-okunur betik (`appcheck:status` ile aynı yöntem). Her aşamadan önce ve sonra
  çalıştırılırsa kazanç gerçek rakamla görülür.
- Geliştirme trafiği canlıyı kirletmesin diye ayrı bir geliştirme projesi. T-LOAD-1'deki staging projesi bu işi de
  görebilir.

---

## 9. Önerilen sıra ve karar soruları

**Sıra:**
1. Aşama 1 (1-7) + ölçüm düzeltmesi (§8). Düşük risk; karesel kalemleri hemen kapatır.
2. `npm run usage:report` ile 1 hafta ölç.
3. Aşama 2 (8-10).
4. Gerekirse Aşama 3 ve Supabase kararı.

**Senin kararın:**
1. Aşama 1'e başlayayım mı? (Tamamı kod; yayın gerektirir, kural değişikliği yok.)
2. Firestore'un yerel SDK'ya taşınması (madde 10): "çift SDK birleştirme" ile birlikte planlansın mı?
3. TMDB ticari lisansı için TMDB'ye yazacak mısın?
4. ~~OMDb anahtarın ücretsiz mi, Patreon mu?~~ Cevaplandı: Patreon, günde 100.000.

---

### Kaynaklar
- Firestore faturalama kuralları (dinleyiciler, persistence, 30 dakika kuralı, kural okumaları, boş sorgu):
  https://firebase.google.com/docs/firestore/pricing
- Birim fiyatlar: Google Cloud Billing kataloğu, hizmet `EE2C-7FAC-5E08` (Cloud Firestore), eur3 ve Belçika SKU'ları
  (31 Eki 2026'da API'den okundu).
- Supabase fiyatları: https://supabase.com/pricing
- Supabase + Firebase Auth: https://supabase.com/docs/guides/auth/third-party/firebase-auth
- TMDB API koşulları: https://www.themoviedb.org/api-terms-of-use. 149 $ rakamı (doğrulanmadı):
  https://api.market/blog/sleeyax/entertainment/best-movie-apis
- OMDb anahtar sayfası: https://www.omdbapi.com/apikey.aspx. Kademe bilgisi (üçüncü taraf):
  https://github.com/api-evangelist/omdb
