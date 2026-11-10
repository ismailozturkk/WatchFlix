# Seelogd — Yayın Öncesi Tam Denetim

**Tarih:** 9 Kasım 2026 · **Dal:** `codex/release-candidate-1.4.3` · **Sürüm:** 1.5.0 · **Commit:** `f52fa88b`

**Yöntem:** Kaynak kodun statik taraması (grep + dosya okuma), `npm audit`, kuralların ve fonksiyonların okunması.
Cihazda profil alınmadı, canlı sisteme dokunulmadı, hiçbir kod değiştirilmedi. Bu belge önceki denetimlerin
(`docs/guvenlik/DENETIM_2026-10-31_…`, `docs/maliyet/…2026-11-01`, 9 Kas performans çalışması) üzerine yazıldı;
orada kapanan maddeler tekrar edilmedi, yalnız **bugün hâlâ açık olanlar** ve **yeni bulunanlar** var.

Her bulguda üç etiket var: **Önem** (🔴 yayından önce · 🟠 ilk güncellemede · 🟡 zamanla), **Kanıt** (dosya:satır),
**Durum** (`doğrulandı` = kodu okudum · `1 Kas notu` = eski nottan, bugün yeniden bakılmadı).

---

## 0. Özet

Uygulama yayına **yakın**. Kritik bir güvenlik açığı bulmadım: sırlar sunucuda, plan sunucuda doğrulanıyor,
kurallar kimliğe bürünmeyi ve sayaç şişirmeyi engelliyor. Yayını durduracak olanlar kod hatası değil, **küçük ama
gerçek kullanıcıya dokunan** dört iş:

| # | Bulgu | Alan | Önem | İş yükü |
|---|---|---|---|---|
| P-1 | ✅ 10 Kas düzeltildi — Geliştirici maliyet sayacı **yayın sürümünde de çalışıyor**: her Firestore okuması ve TMDB isteğinde tüm istatistik nesnesi diske yazılıyor | Performans | 🔴 | Küçük |
| N-1 | ✅ 10 Kas düzeltildi — 28 dosyadaki `axios.get` çağrılarında **zaman aşımı yok**: kötü ağda ekran sonsuza dek yükleniyor | Gecikme | 🔴 | Çok küçük |
| G-1 | ~~Çevrimiçi durumu / son görülme oturum açan herkesçe okunabiliyor~~ ✅ 10 Kas: özellik kaldırıldı (10 Kas yayında) | Gizlilik | 🔴 | Orta |
| G-2 | ~~Analitik için kullanıcıya kapatma seçeneği yok~~ ✅ 10 Kas: Gizlilik Ayarları'na anahtar eklendi | Gizlilik | 🔴 | Küçük |
| S-1 | App Check hâlâ hiçbir yerde zorunlu değil | Güvenlik | 🟠 | Panel + bekleme |
| S-2 | `npm audit`: 33 bulgu (1 kritik, 18 yüksek); çoğu derleme aracı, birkaçı uygulamanın içinde | Güvenlik | 🟠 | Küçük |
| G-3 | Eski hesaplarda e-posta ve doğum tarihi hâlâ herkese açık profil belgesinde | Gizlilik | 🟠 | Orta (göç) |
| R-1 | Gönderi yorumları ve yanıtlar sınırsız canlı dinleniyor | Okuma maliyeti | 🟠 | Orta |
| K-1 | 12 dosya 1.900 satırın üstünde; `ChatScreen` 4.737 satır, 40 `useState` | Bakım | 🟡 | Büyük |

**Test durumu:** 8.823 uygulama testi geçiyor, ama bir suite kararsız (iki tam koşumdan birinde 18 test düştü) — §8.

---

## 1. Güvenlik

### S-1 🟠 App Check hiçbir serviste zorunlu değil — `doğrulandı`
- `functions/index.js:1248` ve `:1354` → `enforceAppCheck: false`; diğer callable'larda ayar hiç yok.
- `functions/index.js:1143` yorumu bayat ("istemcide App Check yok" diyor; istemcide var).
- Sonuç: bir hesap açan herkes `callGemini`, `redeemCode`, `searchUsers` gibi uçları betikle çağırabilir.
  Kota ve hız sınırları etkiyi sınırlıyor ama cihaz doğrulaması fiilen yok.
- **Yapılacak:** Play dahili test kanalından kurulu sürümle birkaç gün kullan → `npm run appcheck:status` →
  geçerli jeton oranı %95'i geçince sırayla aç: callable'lar → Firestore → Auth → RTDB. Erken açılırsa eski
  sürümler kırılır.

### S-2 🟠 Bağımlılık açıkları — `doğrulandı` (`npm audit --omit=dev`, 9 Kas)
33 bulgu: 1 kritik, 18 yüksek, 13 orta, 1 düşük. Ayrım:

| Uygulamanın içinde çalışan | Önem | Düzeltme |
|---|---|---|
| `axios`, `follow-redirects` | yüksek | `npm audit fix` |
| `@react-navigation/core`, `query-string`, `decode-uri-component` (derin bağlantı ayrıştırma) | yüksek | `npm audit fix` |
| `markdown-it`, `linkify-it` ← `react-native-markdown-display` (AI cevabı çizimi) | yüksek | **düzeltme yok**; paket bakımsız, değiştirmek gerekir |
| `firebase` / `@firebase/firestore` / `@grpc/grpc-js` | yüksek | audit "9.14'e in" diyor, uygulanamaz; `firebase` 11.x içinde en son yamaya çık |
| `expo-updates` | orta | `npm audit fix` |

Kalanlar (`shell-quote` kritik, `@expo/cli`, `node-forge`, `xcode`, `zod`, `re2js`, `glob`…) yalnız derleme
zamanında çalışır, kullanıcının telefonuna gitmez. `functions/` tarafında 6 orta bulgu, hepsi `npm audit fix` ile.

- **Yapılacak:** `npm audit fix` (majör olmayanlar) → testler → `expo export` ile paket derleniyor mu bak.
  `--force` **kullanma** (Expo'yu 53'e, Firebase'i 9'a indirmeye çalışıyor).

### S-3 🟡 Oturumsuz okunabilen koleksiyonlar — `doğrulandı`
`firestore.rules` içinde `allow read: if true`:
- `:959` `Posts`, `:988` `Posts/*/likes` — gönderiler ve **kimin beğendiği** oturum açmadan okunabiliyor.
- `:925` `Ratings/{mediaKey}` ve `userRatings/{uid}` — bir kullanıcının bir yapıma verdiği puan oturumsuz okunabiliyor.
- `:149` `AppConfig`, `:138` `meta/waitlist` — bilinçli (site kullanıyor).

Uygulama bu verileri yalnız oturum açıkken okuyor. Site gönderi/puan göstermiyorsa `if true` → `isSignedIn()`
yapmak kazıma yüzeyini kapatır, davranışı değiştirmez. **Önce** site kodunda `Posts`/`Ratings` okuması var mı bak.

### S-4 🟡 Kabul edilmiş / bilinen riskler — `1 Kas notu`
- **TMDB jetonu pakette gömülü** (`EXPO_PUBLIC_API_KEY`). Salt-okunur; karar: kalsın, 401/429 Sentry'ye düşüyor.
- **Bekleme listesi:** 6 Kas'ta tek kayıt okuması da kapatılmış (`firestore.rules:100-103`) → eski L-1 kapanmış görünüyor.
- **İmza anahtarı** `@smlztrk__seelogd.jks` hâlâ proje kökünde (git'te değil). Parola yöneticisine yedeklenip
  EAS/Play App Signing doğrulanınca klasörden kaldırılmalı. Klasörü zip'leyip paylaşma.
- **Tek Firebase projesi (yalnız prod).** Yük testi için ayrı proje yok.

### İncelendi, sorun yok — `doğrulandı`
- `eval`, `new Function`, `dangerouslySetInnerHTML`: yok. Uygulama kodunda doğrudan `<WebView>` kullanımı: yok.
- Açık metin `http://` isteği: yok. Koda gömülü gizli anahtar: yok (`website/site-config.js:38` Firebase web
  anahtarı ve Sentry DSN gizli değer değil).
- Git'te izlenen hassas dosya: yalnız `google-services.json` / `GoogleService-Info.plist` (olağan, gizli değil).
- Derin bağlantılar (`App.js:178-192`): yalnız 6 sabit ekran; tek parametre `lists/:listName`.
- `Users` toplu listeleme kapalı (`firestore.rules:332` → `legacyUserSearchList() = false`).
- RTDB kuralları: yalnız sahibi yazar, alanlar doğrulanıyor, bilinmeyen anahtar reddediliyor.
- Geliştirici ekranları yayın sürümünde kapalı: Debug kartı (`SettingsScreen.js:1215`), plan simülatörü (`:647`).
- Yayın paketinde `console.log` siliniyor (`babel.config.js`), `error`/`warn` kalıyor; loglarda e-posta/jeton yok.
- Herkese açık 3 HTTP ucu: `revenueCatWebhook` (Bearer + sabit zamanlı karşılaştırma), `top100Counters`
  (yalnız GET, kişisel veri yok), `siteBeacon` (IP başına 120/dk, IP yazılmıyor).

---

## 2. Gizlilik

### G-1 ✅ Çevrimiçi durumu herkese açıktı — `10 Kas: özellik tümüyle kaldırıldı`
**Bulgu (9 Kas):** `Presence/{uid}` (Firestore) ve `presence/$uid` (RTDB) oturum açan herkesçe okunabiliyordu;
uygulama 1 Kas'tan beri hiçbir yerde göstermediği hâlde hesabı olan biri API'den herkesin çevrimiçi olup
olmadığını ve son görülme zamanını okuyabiliyordu.
*Düzeltme (ilk yazımdaki hata):* "kullanıcı gizlese de okunabiliyor" demiştim; gizleme ayarı zaten yoktu.

**Yapılan (10 Kas, kullanıcı kararı: "tamamen kaldır"):**
- **Son görülme artık yazılmıyor**; eski değer ilk bağlantıda siliniyor (`services/presenceService.js`).
- **Okuma kapandı:** RTDB `presence/$uid` yalnız sahibi; `chatMeta/$chatId` hiç okunamıyor (yalnız sunucu).
  Firestore `Presence/{uid}` yalnız sahibi.
- **Okuyucu kod silindi:** `services/presenceModel.js` (dosya), `subscribeChatMeta`, `resolveFriendSignals`,
  "yazıyor" bayrağı ve denetleyicisi.
- **Kalan tek şey** teknik bağlantı kaydı (`presence/{uid}/conns`): sunucu, açık sohbetin bildirimini
  susturmak için buna bakıyor. Kimse okuyamaz. Bu da kalksın istenirse bildirim susturma başka bir
  yönteme taşınmalı; kayıt olmadan, uygulama ani kapanınca o sohbetin bildirimleri kalıcı olarak susar.
- Eski sürümler için `lastSeen`/`typing` YAZMA kuralları duruyor (kaldırılırsa eski sürümün arka plana
  geçiş yazımı toptan reddedilir ve bildirim susturması takılı kalır). Eski sürümde arkadaşın durumu boş görünür.
- Testler: `__tests__/databaseRules.test.js`, `presenceIntegration.test.js`, `readCostGuards.test.js`,
  kural testi `__tests__/rules/coverageGaps.test.js`.
- **Deploy:** `firestore.rules` ve `database.rules.json` 10 Kas yayında.

### G-2 ✅ Analitik kapatma seçeneği yoktu — `10 Kas: eklendi`
**Bulgu (9 Kas):** `setAnalyticsEnabled` tanımlıydı ama hiçbir yerden çağrılmıyordu; kullanıcının toplamayı
durdurma yolu yoktu.

**Yapılan (10 Kas):**
- Ayarlar → Gizlilik → **"İstatistik ve hata raporlarını paylaş"** anahtarı (5 dilde). Varsayılan açık.
- Tek sahip `services/usageSharing.js`; tercih cihazda (`Keys.usageSharing`), yedeğe girmez.
- Kapalıyken: Firebase Analytics olayı/ekranı/kullanıcı özelliği gönderilmez, native toplama kapatılır,
  kullanıcı kimliği bağı koparılır. Sentry o oturumda hiçbir olay göndermez (`beforeSend`), sonraki
  açılışlarda hiç başlatılmaz.
- `App.js` tercihi hata raporlamadan ÖNCE uygular. Test: `__tests__/usageSharing.test.js`.
- `website/privacy.html` 1.7: kapatma anahtarı eklendi, var olmayan "çevrimiçi durumu ayarı" ifadesi
  kaldırıldı (TR + EN). **Hosting deploy gerekir.**
- **Açık kalan karar:** AB kullanıcıları için varsayılanı kapalı başlatıp ilk açılışta sormak (rıza ekranı).
  Bugünkü hâli "kapatılabilir", "önce sor" değil.
- Cihazda denenmedi (anahtarın görünümü, kapatınca Firebase DebugView'da olay kesiliyor mu).

### G-3 🟠 Eski hesaplarda e-posta ve doğum tarihi profil kökünde — `1 Kas notu`
- Yeni kayıtlar `Users/{uid}/private/account`'a yazıyor; kural kök belgeye yazımı engelliyor
  (`firestore.rules:337-345`). Ama 1.5.0 öncesi açılmış hesaplarda bu alanlar hâlâ `Users/{uid}` kökünde ve
  kök belge oturum açan herkese `get` ile açık (`:502`). `website/privacy.html` durmadığını söylüyor.
- **Yapılacak:** `migrateAccountPrivate.js` kuru çalıştırma → `--apply` → kuralın son aşaması. 23 hesap var,
  yayından **önce** yapmak en temizi (sonra hesap sayısı artar).

### G-4 🟡 Takip listeleri ve liderlikler tüm oturumlulara açık — `doğrulandı`
- `firestore.rules:678/686` `following` / `followers`; `:801` oyun liderlikleri; `:827-830` lig tabloları.
- Tasarım gereği (sosyal uygulama). Profil gizliliği "özel" olan kullanıcının takip listesi de okunabiliyor;
  `privacy.lists` kuralı (`:161-167`) bunlara uygulanmıyor. Gizli profil vaadi varsa aynı süzgeç buraya da gelmeli.

### G-5 🟡 Yerel depolama şifresiz — `doğrulandı`
- `services/storage/instances.js:97` MMKV `encryptionKey` olmadan açılıyor; oturum jetonu da orada (`firebase.js:39`).
- Uygulama korumalı alanında durduğu için kabul edilebilir (root'lu cihaz hariç). İstenirse anahtar
  SecureStore'da tutulup MMKV şifrelenir; açılışa birkaç ms ekler.

### İyi durumda — `doğrulandı`
- Sentry: `sendDefaultPii: false`, kullanıcı yalnız uid ile etiketli (`services/crashReporting.js:90`).
- Analitik kullanıcı özellikleri yalnız plan, cihaz sınıfı, dil (`utils/analyticsEvents.js:187`).
- Android: izin listesi boş, medya/ses izinleri açıkça engelli; iOS takip (ATT) izni istenmiyor.
- Uygulama içi hesap silme + veri indirme var; Firestore önbelleği yalnız bellekte.

---

## 3. Performans — çalışma anı

### P-1 🔴 Maliyet sayacı yayın sürümünde çalışıyor — `doğrulandı`
- `services/usageTrackerService.js` içinde hiç `__DEV__` kapısı yok. 20+ servis/ekran `trackFirestoreRead`,
  `trackFirestoreWrite`, `trackTmdbRequest` çağırıyor.
- Her çağrıda (`:636-672`): iki `toLocaleString`, 1.000 girişlik günlük dizisinin kopyası (`:612`), sonra
  **tüm istatistik nesnesinin MMKV'ye yazılması** (`:579-586`, 1.000 günlük girişiyle birlikte JSON'a çevrilir).
- Bir ana ekran açılışı onlarca TMDB isteği + Firestore okuması demek → her biri JS iş parçacığında senkron
  serileştirme ve disk yazımı. Bunu gösteren ekran (`UsageDebugScreen`, 4.768 satır) yayında zaten kapalı;
  yani kullanıcı hiçbir fayda görmeden bedelini ödüyor.
- **Yapılacak:** Dışa açılan `track*` fonksiyonlarının başına `if (!__DEV__) return;`. Tek dosya, ~8 satır.
  Yan kazanç: paket küçülmez ama açılış ve kaydırma sırasında JS yükü düşer.

### P-2 🟠 Tanrı context'ler — `doğrulandı`
- `context/TvShowContex.js` 59 `useState`, `context/MovieContex.js` 52, `context/AppSettingsContext.js` 34.
- 9 Kas'ta raflar alan bazlı aboneliğe geçti (`useMovieFields`/`useTvShowFields`); `MovieOscar`, `SeeAll`,
  `TvShowsEmmy`, `TvShowsOnTheAir` hâlâ tüm context'e abone → herhangi bir raf yüklenince yeniden çiziliyor.
- `App.js`'te 31 sağlayıcı iç içe. `AppSettingsContext` 34 ayrı state: bir ayar değişince tüm tüketiciler çizilir.
- **Yapılacak:** Kalan 4 tüketiciyi alan aboneliğine geçir; `AppSettingsContext` için aynı `fieldStore` deseni.

### P-3 🟠 ChatScreen — `doğrulandı`
- 4.737 satır, 40 `useState`, 23 `useEffect`, 5 canlı dinleyici. Yazı kutusu aynı bileşende: her tuş vuruşu
  tüm ekranı yeniden çalıştırıyor (liste 9 Kas'ta korundu, ekranın geri kalanı değil).
- **Yapılacak:** Yazı kutusunu (`text` state'i ve bağlıları) ayrı bileşene çıkar; cihazda test şart.

### P-4 🟠 Bellek — `1 Kas/9 Kas notu, yayın sürümünde ÖLÇÜLMEDİ`
- Emülatör + debug: birkaç ekran sonra Native Heap ~1,24 GB; detay ekranı aç/kapa başına +46 View birikiyor
  (sızıntı adayı). Debug moduna bağlı olabilir.
- **Yapılacak:** EAS preview APK ile aynı ölçüm (`adb shell dumpsys meminfo`): 10 kez detay aç/kapa, View
  sayısı ve Native Heap artıyor mu. Artıyorsa yayından önce bulunmalı.

### P-5 🟡 Listeler ve animasyon — `doğrulandı`
- 74 dosyada `FlatList`, `FlashList` yok (bilinçli ertelendi, cihaz ölçümü bekliyor).
- `useNativeDriver: false` 10 dosyada (film/dizi detay, sohbet, AI sohbet): bu animasyonlar JS iş parçacığında.
- Saniyelik zamanlayıcılar: `CountdownTimer.js:92` (1 sn), `useSceneGame.js:588` (250 ms) — ekran odakta
  değilken duruyor mu, tek tek bakılmalı. `hooks/useLoopActive` deseni hazır.

### P-6 🟡 Açılış — `doğrulandı`
- `translations/index.js:8-12`: beş dil dosyasının hepsi (toplam 892 KB) açılışta yükleniyor. Yalnız seçili dil
  + İngilizce yedek yüklenip diğerleri dil değişince `require` edilebilir.
- `App.js`: 81 doğrudan import, 86 tembel ekran (iyi). Çift Firebase SDK (web + native) açılış maliyeti duruyor.

---

## 4. Ağ ve gecikme

### N-1 🔴 Zaman aşımı olmayan istekler — `doğrulandı`
- `axios.defaults.timeout` hiç ayarlanmamış (axios varsayılanı: sınırsız). `axios.get` kullanan 35 dosyadan
  **28'inde** hiç `timeout` yok. En önemlileri: `context/MovieContex.js` (6 çağrı), `context/TvShowContex.js` (7),
  üç arama ekranı, `SeasonDetails`, `EpisodeDetails`, `DiscoveryMediaRail` (4), `oscarService`, `emmyService`.
- Sonuç: zayıf bağlantıda (metro, asansör) istek asılı kalır; iskelet ekran sonsuza dek döner, hata mesajı
  ve "tekrar dene" hiç çıkmaz.
- **Yapılacak:** Tek satır, uygulama girişinde: `axios.defaults.timeout = 12000;`. Kendi süresini veren
  10 çağrı etkilenmez. Sonra uçak moduna yakın koşulda ana ekran + arama + detay hata durumlarını dene.

### N-2 🟡 Dağınık TMDB çağrıları — `doğrulandı`
- 47 dosya `api.themoviedb.org` adresini doğrudan içeriyor; ortak istemci yok. Önbellek, yetişkin süzgeci ve
  anahtar sağlığı global axios interceptor'larıyla çözülmüş (çalışıyor) ama yeniden deneme, eşzamanlı aynı
  isteği birleştirme ve iptal yok. `fetch` 12 yerde, `AbortController` 5 yerde.
- **Yapılacak (yayın sonrası):** tek `tmdb.get(path, params)` sarmalayıcısı; ekran kapanınca iptal.

### N-3 🟡 Sıralı bekleme — `doğrulandı`
- `services/userService.js:631` döngü içinde tek tek `getDoc` (arkadaş başına bir gidiş-dönüş). `Promise.all`
  ile paralel olmalı.
- `services/accountService.js:270-335` hesap silmede iç içe sıralı okuma/silme; sunucu purge'u asıl yol olduğu
  için kabul edilebilir, yalnız yavaş.

---

## 5. Firestore okuma / yazma

1 Kas maliyet çalışması üç aşamasıyla yayında (akış dinleyicisi odağa bağlı, yorum sayfalama, damgalı
önbellekler, CDN). Bugün 58 `onSnapshot`, 78 `getDocs` var. Kalanlar:

### R-1 🟠 Sınırsız canlı dinleyiciler — `doğrulandı`
| Yer | Sorun |
|---|---|
| `services/postsService.js:633-636` | Gönderi yorumları: `limit` yok, tüm yorumlar canlı. Viral gönderide her açılış = tüm yorumlar; her yeni yorum herkese yeniden okuma. |
| `components/Comment.js:941-945` | Açılan her yanıt dizisi için ayrı, sınırsız dinleyici. |
| `context/UnreadMessagesContext.js:53-101` | Uygulama boyunca açık 4 dinleyici, hepsi sınırsız: tüm `conversations`, `groupInbox`, üye olunan tüm `groups` belgeleri, `blocked`. |

- `groups` sorgusu (`where members array-contains`) iki ayrı yerde dinleniyor (`UnreadMessagesContext.js:87` ve
  `groupsService.js:113`); Firestore aynı sorguyu birleştirir ama grup belgesi büyük (üye listesi, `unread`
  haritası) ve her mesajda değişiyor → her mesaj, her üyenin telefonunda tam belge okuması.
- **Yapılacak:** Gönderi yorumlarını film yorumlarındaki gibi 20'lik sayfaya al; yanıtlara `limit(50)`;
  okunmamış sayacı için `groups` dinleyicisini kaldırıp yalnız `groupInbox` kullan (yeni model zaten orada).

### R-2 🟠 Koleksiyonun tamamını okuyanlar — `doğrulandı`
| Yer | Ne okunuyor |
|---|---|
| `services/tournamentService.js:483` ← `TournamentWidget.js:96`, `PodiumModal.js:474` | Bir turnuvanın **tüm oyları** (kullanıcı başına bir belge). Yalnız `agg` belgesi yokken çalışıyor; `agg` her zaman varsa sorun yok, yoksa Hub'ı açan herkes N okuma yapar. |
| `services/postsService.js:445`, `:481` | Tüm `likedPosts` ve `bookmarks` (akışa ilk girişte). |
| `services/postsService.js:298` | Tüm `following` listesi. |
| `FriendProfileScreen.js:543-547` | Arkadaşın 5 listesinin tamamı (24 saatlik önbellekli; ilk ziyaret pahalı). |
| `services/cineswipe/cineswipeService.js:108` | Tüm izleme listesi (yerel liste yoksa). |
| `services/tournamentService.js:469` | Tüm `tournamentWinners` (ayda 1 belge büyür; sorun değil). |

- **Yapılacak:** `fetchVotesOnce` yedek yolunu kaldır ya da `limit` koy (arşivleme fonksiyonu canlı olduğuna
  göre `agg` hep var). `likedPosts`/`bookmarks` için yalnız ekrandaki gönderilerin kimlikleriyle `in` sorgusu
  ya da damgalı önbellek.

### R-3 🟡 Yapısal — `1 Kas notu`
- Firestore önbelleği yalnız bellekte (`firebase.js:60`): uygulama her açılışta tüm dinleyicileri sıfırdan
  okur. Kalıcı önbellek için native Firestore'a geçiş gerekir (Auth da taşınmalı) — ayrı proje.
- Kurallardaki `get()`/`exists()` çağrıları (plan, liste gizliliği, grup üyeliği) her istekte faturalı okuma.
- Ölçülen: ~3.000 okuma / aktif kullanıcı / gün. Ücretsiz kota 50.000/gün → ~15 günlük aktif kullanıcıda
  faturalanmaya başlar (100.000 okuma ≈ 0,06 $; 1.000 aktif kullanıcıda kabaca 55 $/ay).

### Yazma tarafı — `doğrulandı`
- Sıcak sayaçlar parçalı sayaca geçmiş (`DailyPolls/shards`, kural `:1932`).
- Profil adı/avatarı değişimi ~15 yüzeye yayılıyor; 1 günlük bekleme ile sınırlı.
- `utils/…compareBeforeSet` MMKV'de açık: aynı değerin tekrar yazımı diske gitmiyor.

---

## 6. Büyük dosyalar

Uygulama kodu ~340.000 satır (ekranlar 99,6 bin · bileşenler 133 bin · servisler 36 bin · yardımcılar 50 bin).

| Satır | Dosya | `useState` | Not |
|---|---|---|---|
| 4.768 | `screens/tabs/UsageDebugScreen.js` | 15 | Yalnız geliştirmede açılıyor; tembel yüklü ama pakete giriyor. |
| 4.737 | `screens/chat/ChatScreen.js` | 40 | En riskli ekran (P-3). Yazı kutusu, mesaj listesi, başlık, sabitlenenler ayrılmalı. |
| 2.769 | `functions/index.js` | – | 29 fonksiyon tek dosyada; modüllere bölme başlamış (`league`, `referral`…). |
| 2.507 | `screens/story/StoryShareScreen.js` | 28 | |
| 2.489 | `screens/lists/ListsScreen.js` | 32 | |
| 2.064 | `components/wrapped/WrappedSlides.js` | | Slayt başına dosyaya bölünebilir. |
| 2.047 | `firestore.rules` | – | 369 kural testiyle korunuyor. |
| 2.006 | `components/profile/StatsComponents.js` | | |
| 1.972 | `screens/tabs/profile/FriendProfileScreen.js` | 24 | |
| 1.972 | `screens/tabs/SettingsScreen.js` | | |
| 1.959 | `components/Comment.js` | 15 | Dinleyici + sayfalama + UI tek dosyada. |
| 1.949 | `components/modals/CreatePostModal.js` | 28 | |
| 1.917 | `screens/premium/PremiumScreen.js` | | |
| 1.848 / 1.671 | `MovieDetail.js` / `TvShowsDetails.js` | 18 / 18 | Büyük oranda aynı yapı; ortak iskelet çıkarılabilir. |
| 1.648 | `screens/cineswipe/CineSwipeScreen.js` | 32 | |
| 1.068 | `context/MovieContex.js` / `TvShowContex.js` | 52 / 59 | P-2. Dosya adında yazım hatası (`Contex`). |

57 dosya 1.000 satırın üstünde. Bunlar yayını engellemez; risk, bir değişikliğin yan etkisini görmenin
zorlaşması. **Öneri:** yayından önce dokunma (yeniden yazım = yeni hata). Yayın sonrası sıra:
`ChatScreen` → iki tanrı context → `ListsScreen` → `Comment`.

---

## 7. Yayın kontrol listesi

### Yayından önce (kod)
- [x] **P-1** `usageTrackerService` `track*` fonksiyonlarına `__DEV__` kapısı — 10 Kas: 8 fonksiyon `trackingEnabled()` ile kapılı (çağrı anında `__DEV__`); bekçi `__tests__/usageTrackerReleaseGate.test.js`
- [x] **N-1** global axios zaman aşımı — 10 Kas: `utils/axiosDefaults.js` (15 sn), `App.js` açılışta kurar; bekçi `__tests__/axiosDefaults.test.js`
- [ ] **N-1 (cihaz)** kötü ağda ana ekran + arama + detay hata durumlarını dene (yapılmadı)
- [x] **G-1** Çevrimiçi durumu tümüyle kaldırıldı (okuma kapalı, son görülme yazılmıyor, okuyucu kod silindi) — 10 Kas
- [x] **G-1 (deploy, Firestore)** `firestore.rules` 10 Kas yayında (canlı = çalışma ağacı doğrulandı)
- [x] **G-1 (deploy, RTDB)** `database.rules.json` 10 Kas yayında (canlı = çalışma ağacı doğrulandı). Depodaki dosya ilk kez yayınlandı: alan doğrulaması, sıkı üyelik kontrolü ve `groupChatMeta` da birlikte gitti. Eski kurallar: `docs/guvenlik/RTDB_CANLI_KURALLAR_2026-11-10.json`
- [x] **S-5 (10 Kas: düzeltildi, yayında)** — 🔴 Sunucu yanlış veritabanına bakıyor (10 Kas, deploy sırasında bulundu).** Projede iki RTDB örneği var: uygulama `movieandtv-2832a` (europe-west1) kullanıyor, Cloud Functions ise varsayılan `movieandtv-2832a-default-rtdb` örneğini okuyor (`functions/index.js:88` `getDatabase()`; Admin SDK varsayılanı bu) ve o örnek BOŞ. Sonuç: `isRecipientViewingChat` her zaman false → açık sohbetin bildirimi canlıda hiç susturulmamış. Düzeltme: `getDatabaseWithUrl(<europe-west1 adresi>)` + functions deploy. `firebase.json` artık kuralları iki örneğe de gönderiyor (ilk deploy yanlışlıkla yalnız boş örneğe gitmişti).
- [ ] **G-1 (cihaz)** birebir sohbette ve grupta: sohbet açıkken bildirim susuyor mu, kapalıyken geliyor mu
- [x] **G-2** Analitik/çökme raporu kapatma anahtarı + gizlilik sayfası 1.7 — 10 Kas
- [x] **G-2 (deploy)** Hosting 10 Kas yayında (seelogd.com/privacy.html sürüm 1.7 doğrulandı)
- [ ] **G-2 (cihaz)** anahtarı cihazda dene
- [ ] **G-2 (karar)** AB için varsayılan kapalı + ilk açılışta sor?
- [ ] **S-2** `npm audit fix` (kök + `functions/`), testler, `expo export`
- [ ] **R-2** `fetchVotesOnce` yedek yoluna `limit` ya da kaldır

### Yayından önce (ölçüm / panel)
- [ ] **P-4** EAS preview APK ile bellek ölçümü (10× detay aç/kapa)
- [ ] **G-3** e-posta/doğum tarihi göçü (kuru çalıştırma → uygula → kural son aşama → site metni)
- [ ] Play: 12 testçi / 14 gün sayacı, Data Safety formu (G-2'den sonra "kullanıcı kapatabilir" cevabı değişir)
- [ ] App Store Connect: abonelik ürünleri "Gönderilmeye hazır", Paid Apps anlaşması, RevenueCat teklifi
- [ ] TMDB ticari lisans e-postası (Premium satıldığı için)
- [ ] Alternatif simge düzeltmesini yeni iOS build'inde doğrula

### İlk güncellemede
- [ ] **S-1** App Check zorunluluğu (oran ≥ %95 olunca, kademeli)
- [ ] **R-1** Gönderi yorumlarını sayfala, yanıtlara sınır, `groups` okunmamış dinleyicisini kaldır
- [ ] **P-2 / P-3** Kalan context tüketicileri, ChatScreen yazı kutusu ayrımı
- [ ] **S-3** `Posts` / `Ratings` okumasını oturumluya çek (site kullanmıyorsa)
- [ ] `react-native-markdown-display` yerine bakımlı bir paket

### Zamanla
- [ ] İmza anahtarını proje klasöründen çıkar
- [ ] Ortak TMDB istemcisi (N-2), dil dosyalarını tembel yükle (P-6)
- [ ] Native Firestore + kalıcı önbellek (R-3), ayrı test Firebase projesi
- [ ] Büyük dosyaları böl (§6 sırası)

---

## 8. Test durumu (9 Kas, bu oturum)

Uygulama testleri (`npx jest`) iki kez tam çalıştırıldı:

| Koşum | Sonuç |
|---|---|
| 1. tam koşum | 483 suite'ten **1 başarısız**: `__tests__/homeSettingsSync.test.js`, 18 test (ör. `:334` beklenen `337`) |
| Aynı dosya tek başına | 24/24 geçti |
| 2. tam koşum | 483/483 suite, **8.823/8.823** test geçti |

Yani `homeSettingsSync.test.js` **kararsız (flaky)**: kod aynıyken bir koşumda düştü, ikisinde geçti. Paralel
koşumda zamanlamaya ya da paylaşılan duruma bağlı görünüyor; sebebi araştırılmadı. Yayın öncesi CI/elle
koşumda yanlış alarm verir, gerçek bir yarış durumunu da gizliyor olabilir (ana ekran sağlayıcı seçimi senkronu).
🟠 **Yapılacak:** birkaç kez `npx jest --runInBand` ve paralel koşup sebebi bul.

Çalıştırılmayanlar: kural testleri (`npm run test:rules`, emülatör ister), `functions/` testleri, cihaz testi.

---

## 9. Bu denetimin kapsamadıkları

- Cihazda profil (kare hızı, bellek, açılış süresi) alınmadı; performans maddeleri kod okumasına dayanıyor.
- Canlı Firebase paneli (App Check oranı, okuma sayıları, fatura) bu oturumda açılmadı; rakamlar 1 Kas ölçümü.
- Aktif sızma testi ve yük testi yapılmadı.
- `website/` ve `marketing/` yalnız anahtar taramasından geçti.
- 340 bin satırın tamamı satır satır okunmadı; desen taraması + en büyük/en riskli dosyalar okundu.

---

## 10. S-5 — Sunucu yanlış veritabanına bakıyordu (10 Kas, düzeltildi)

- Projede iki RTDB örneği var: uygulama `movieandtv-2832a` (europe-west1) kullanır; projenin varsayılanı
  `movieandtv-2832a-default-rtdb` boştur. Admin SDK `getDatabase()` ve `firebase deploy --only database`
  varsayılana gider.
- Etki: açık sohbetin bildirimi canlıda hiç susturulmuyordu; hesap silme, kullanıcının bağlantı kaydını ve
  sohbet bayraklarını gerçek veritabanından silmiyordu.
- Düzeltme: `functions/rtdbInstance.js` + `functions/index.js` (`getDatabaseWithUrl`), bekçi
  `functions/rtdbInstance.test.js`; `firebase.json` kuralları iki örneğe de gönderir.
- Yayın (10 Kas): `onSocialNotificationCreated`, `onDirectMessageCreated`, `onGroupMessageCreated`,
  `deleteAccountData`, `purgeOnAuthUserDeleted`. Canlı kaynak indirildi ve çalışma ağacıyla aynı olduğu doğrulandı.
  Aynı deploy ile 9 Kas commit'indeki sunucu değişiklikleri de yayına girdi: grup sohbetinde bildirim susturma
  ve rozet sayısına grup okunmamışları + engellenenlerin hariç tutulması.
- **Doğrulanmayan:** gerçek bir mesajla çalışma anı davranışı. Cihazda dene: sohbet açıkken bildirim gelmemeli,
  kapalıyken gelmeli (birebir ve grup).
- **Kalan temizlik (isteğe bağlı):** daha önce silinen hesapların RTDB'de kalmış `presence` / `chatMeta`
  kayıtları olabilir; tek seferlik bir betikle süpürülebilir.
