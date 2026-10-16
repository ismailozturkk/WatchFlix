# Yerel-öncelikli veri katmanı (buluttan tekrar tekrar çekmeme)

10 Ekim 2026. Hedef: kullanıcının **kendi yazdığı** veriyi cihazda **kaynak** tutmak, buluta
**yalnız yazmak**, buluttan **yalnız gerektiğinde ve tek seferlik** çekmek.

> **Tek cümle:** Yerel kopya varsa uygulama buluttan okumaz. Yazma önce yerelde ve kalıcı günlükte
> (anında), buluta arka planda gider. Buluttan çekim yalnız yerel kopya *yoksa* (yeni telefon,
> uygulama sıfırlama, hesap değişimi, sistemin dosyayı silmesi) ve cihaz başına **bir kez** olur.

---

## 1. Neden — mevcut durumun maliyeti

Önceki mimaride yerel kopya yalnız "ilk kare tohumu"ydu; **her açılışta** canlı dinleyiciler yine
koleksiyonun tamamını okuyordu.

| Veri | Eski davranış (her soğuk açılış) | Okuma |
|---|---|---|
| Notlar | `ProfileNotesContext` → `onSnapshot(Notes/{uid}/items)` | N |
| Notlar (tekrar) | `CalendarContext` → aynı koleksiyona **ikinci** dinleyici | N |
| Hatırlatıcılar | `ProfileRemindersContext` → filmler + diziler + **her dizi için** bölüm dinleyicisi (2 + S) | M + S + E |
| Hatırlatıcılar (tekrar) | `CalendarContext` → aynısının ikinci kopyası | M + S + E |
| Film/dizi notları | `MediaNotesContext` → `onSnapshot` | K |
| Hatırlatıcı çanı | `Reminder.js` → **her satır** mount'ta 1–2 `getDoc` | satır sayısı × 1–2 |
| Film detayı / hızlı eylem | her açılışta tek belge için `onSnapshot` | 1 / açılış |

Örnek (ölçülmüş değil, hesap): 40 not, 5 film, 4 dizi / 60 bölüm, 10 medya notu →
`2·40 + 2·(5+4+60) + 10 ≈ 228` okuma **her açılışta**. Yeni modelde sürekli rejimde **0**.

Yazma tarafı: `updateDoc` kısmi güncellemeleri ve her bölüm için ayrı `getDoc`+`setDoc` turları vardı;
çevrimdışıyken yazma hiçbir yerde kalıcı değildi (Firebase JS SDK'sında React Native için kalıcı yazma
kuyruğu yok).

---

## 2. Sınıflandırma — hangi veri yerel kaynak olabilir?

**Ölçüt:** koleksiyona *yalnız bu kullanıcının istemcisi* yazıyor mu? Cloud Function, başka kullanıcı
ya da başka bir transaction aynı belgeyi değiştiriyorsa yerel kopya bayatlar → o veri bu modele **girmez**.

| Veri (Firestore yolu) | Tek yazarlı mı | Karar | Durum |
|---|---|---|---|
| Notlar `Notes/{uid}/items` | evet | **yerel kaynak** | ✅ Faz 1 |
| Film/dizi notları `MediaNotes/{uid}/items` | evet | **yerel kaynak** | ✅ Faz 1 |
| Hatırlatıcılar `Reminders/{uid}/movies`, `tvShows/{id}/episodes` | evet (Functions okumuyor/yazmıyor) | **yerel kaynak** | ✅ Faz 2 |
| AI sohbet geçmişi `AiConversations/{uid}/items/{id}` (CineMatch) | evet (kota sayacı `AiUsage` AYRI ve yalnız Functions yazar) | **yerel kaynak** | ✅ Bkz. Bölüm 8 |
| Takvim (notlar + hatırlatıcılardan türev) | türev | aynı yerel kopyadan türetilir | ✅ Faz 2 |
| Listeler `Lists/{uid}/favorites·watchList·watchedMovies·watchedTv` | evet | zaten **bir kez iner**, yerel güncellenir (`ListStatusContext`) | ✅ önceden vardı; yalnız dosya konumu kalıcılaştırıldı |
| Liste kök belgesi `Lists/{uid}` | evet (transaction'larla) | 1 okuma/açılış kalıyor | ⏳ Faz 4 |
| Dizi izleme belgesi `Lists/{uid}/watchedTv/tv_{id}` (`useWatchedShow`) | evet | yerel haritadan okunabilir | ⏳ Faz 4 |
| Özel liste öğeleri (`listItemsService` `getDocs`) | evet | Faz 4 incelemesi | ⏳ Faz 4 |
| Etkinlik: `myComments`, `likedPosts`, `bookmarks`, `myRatings` | evet ama **8+ yazma noktası**, çoğu batch/transaction içinde | yerel kaynak, *yazma-sonrası ayna* ile | ⏳ Faz 5 |
| Profil `Users/{uid}` | **hayır** (`friendsCount`, `unreadNotifsCount` başkalarınca/Functions'la değişir) | canlı kalır | — |
| Arkadaşlar, istekler, sohbetler, bildirimler, presence | hayır | canlı kalır | — |
| Gönderiler, yorumlar, beğeni sayaçları, `Ratings` agregatları | hayır | canlı kalır | — |
| Ortak listeler, turnuva, CineSwipe odaları, skor tabloları | hayır | canlı kalır | — |
| TMDB içeriği | harici | `apiCache` (SWR) — ayrı katman | — |

---

## 3. Mimari

```
 Ekran / Context ──────────────►  services/userData  ◄────── hooks/useUserDataDomain
 (ProfileNotes, MediaNotes,        notesDomain · mediaNotesDomain · remindersDomain
  ProfileReminders, Calendar,      remindersActions
  Reminder.js, MovieDetail …)               │
                                             │ apply(uid, değişiklikler)   (senkron, ağ beklemez)
                       ┌─────────────────────┼─────────────────────────┐
                       ▼                     ▼                         ▼
              yerel harita + görünüm   YAZMA GÜNLÜĞÜ (outbox)   anlık görüntü dosyası
              (useSyncExternalStore)   MMKV · senkron · kalıcı   <document>/userdata/…  (ertelenmiş)
                                             │                         ▲
                                             ▼                         │ beforeAck: önce diske in
                                      SyncWorker ── batch ──►  Firestore (writeBatch)
                                      (çevrimdışı bekler, geri çekilme, zehirli işlem ayırma)

   Buluttan okuma:  yalnız ensureHydrated()  →  kopya yok VEYA doğrulanmamış  →  TEK SEFER
```

### Dosya haritası

| Dosya | Sorumluluk |
|---|---|
| `utils/cacheStore.js` | Kalıcı ad alanları (`notes`, `mediaNotes`, `aiConversations`, `reminders`, `lists`) **belge dizinine** yazılır; eski önbellek konumundan tembel taşıma. `clearAll()` kalıcı veriye **dokunmaz**. |
| `utils/cacheKeys.js` | Anahtarlar değişmedi (tek kaynak). Disk biçimi (dizi/harita) aynı → geri dönüş güvenli. |
| `services/userData/outbox.js` | Buluta gitmemiş işlemlerin **kalıcı günlüğü**. Aynı belge için ardışık işlem tek işleme iner. |
| `services/userData/syncWorker.js` | Günlüğü boşaltır: toplu commit, çevrimdışı bekleme, geri çekilme (2→5→15→45→120→300 sn), zaman aşımı, zehirli işlem izolasyonu, ölü harf. |
| `services/userData/createDomain.js` | Alan motoru: senkron yükleme, `apply`, tek seferlik `ensureHydrated`, `resync`, `clearLocal`. React'siz, Firebase'siz. |
| `services/userData/domains.js` | Alan tanımları (yollar, sıralama, indirme, **eski şema göçü**) + hatırlatıcı eylemleri (dizi belgesi yerel sayımdan türetilir). |
| `services/userData/aiConversations.js` | AI sohbetlerinin **şeması, boyut bütçesi, depo API'si** (`save/remove/clearAll/trim/migrateLegacy`). Firebase'siz. |
| `services/userData/hydrationMarker.js` | "Bu alan bu cihazda buluttan tam doğrulandı" işareti (MMKV, çıkışta silinir). |
| `services/userData/firestoreRemote.js` | Tek Firestore kapısı (okuma/yazma maliyeti `usageTrackerService`e işlenir). |
| `services/userData/index.js` | Varsayılan kablolama + `startUserData` / `clearUserLocal` / `purgeUserData` / `resyncUserData` / `flushUserData`. |
| `hooks/useAiConversations.js` | AI sohbet geçmişi için React bağlayıcısı (`conversations`, `save`, `remove`, `trim`, `clearAll`, `refresh`). |
| `hooks/useUserDataDomain.js`, `hooks/useSyncStatus.js` | React bağlayıcıları. `useSyncStatus` → `{ pending, dead, syncing, lastSyncedAt, waiting }` (arayüz henüz yok). |
| `components/UserDataSyncHost.js` | Yaşam döngüsü: giriş, öne gelme, arka plan, ağ dönüşü. `App.js`'te `AuthProvider` içinde. |

### Değişmez kurallar

1. **Anlık görüntü dosyasının varlığı = "indirildi".** Alan hazır değilken diske anlık görüntü yazılmaz;
   o dönemin değişiklikleri yalnız günlüktedir.
2. **Günlük, anlık görüntüden önce silinmez.** Onay sırası: commit OK → anlık görüntüyü diske indir →
   günlükten sil (`beforeAck`).
3. **Her yazma tam belge `set` / `delete`** — idempotent. Kısmi `updateDoc` yok; "gitti mi gitmedi mi"
   belirsizliği, zaman aşımı ve süreç ölümü sonrası yeniden gönderim güvenli.
4. **`undefined` alan Firestore'da eşzamanlı hata** (gerçek SDK ile doğrulandı) ve batch'i düşürür →
   günlüğe girmeden önce temizlenir (`sanitize.js`).
5. **Çıkışta yerel kopya silinir, günlük kalır.** Başka hesap görmez; onaysız değişiklik aynı hesapla
   dönünce gider.
6. **Hesap silinirken önce yerel günlük temizlenir**, sonra bulut — yoksa işçi silinen hesabı
   bulutta yeniden yaratabilirdi.

### Güvenlik modeli — kurtarma üçgeni

`bulut` = yedek · `anlık görüntü` = yerel kontrol noktası · `günlük` = kontrol noktasından sonraki
onaysız değişiklikler. Üçünden herhangi ikisi doğru durumu kurar.

| Olay | Sonuç |
|---|---|
| Uygulama anlık görüntü yazılmadan öldürüldü | Açılışta günlük bindirilir → değişiklik geri gelir |
| Anlık görüntü dosyası bozuldu | "Kayıt yok" sayılır → tek seferlik indirme + günlük bindirmesi |
| İşletim sistemi dosyaları sildi | Aynı; belge dizini zaten sistem tarafından silinmez |
| Commit sonrası, günlük silinmeden çökme | Aynı işlem yeniden gider (idempotent) |
| İndirme sürerken kullanıcı not ekledi/sildi | Sonuç = bulut + günlük + indirme sırasındaki `journal`; kaybolmaz |
| Çevrimdışı not yazıldı | Yerelde anında; bağlantı gelince `subscribeOnline` ile gider |
| Tek bozuk belge | Batch düşer → işlemler tek tek denenir → bozuk olan "ölü" ayrılır, kuyruk tıkanmaz; yerel kopyada **kalır** |

---

## 4. Davranış matrisi

| Durum | Ne olur |
|---|---|
| Normal açılış (kopya var) | Buluttan **0 okuma**; ilk karede dolu |
| Yeni telefon / yeni kurulum / sıfırlama | Alan başına **tek seferlik** tam indirme |
| Hesap değiştirme | Çıkışta yerel kopya silinir; yeni hesap için tek seferlik indirme |
| **Eski sürümden güncelleme** | Eski önbellek dosyaları **ağsız** yeni konuma taşınır ve ilk karede gösterilir; her alan cihazda **bir kez** sessizce doğrulanır (aşağıya bak) |
| Çevrimdışı yazma | Hata yok; günlüğe girer, bağlantı gelince gider |
| Çevrimdışı yeni cihaz | Boş + `waiting`; bağlantı gelince indirir |
| Çıkış (Ayarlar) | Önce en çok 4 sn bekleyen yazımları göndermeyi dener; çevrimdışıysa vazgeçer |
| Önbelleği temizle → "Tümünü temizle" | Notlar/hatırlatıcılar/listelere **dokunmaz** |
| Önbellek ekranı → Notlar / Hatırlatıcılar satırı | Simge ☁️↓: **silmez**, buluttan yeniden kurar (çevrimdışıysa hiçbir şey yapmaz) |
| "Verileri indir" | Notlar/hatırlatıcılar için `resync` (bekleyen yerel değişiklikler korunur) |

### Neden "bir kez doğrulama"? (bulduğum açık)

Eski sürüm, dizi başına bölüm dinleyicileri sırayla gelirken **kısmi** listeyi diske yazıyordu. O
pencerede kapanan bir uygulamanın diskte eksik kopyası kalır; yeni motor bunu "tam" sanıp **bir daha
hiç çekmezdi**. Bu yüzden anlık görüntü dosyası tek başına yetmez: motorun *kendi* tam indirmesinden
sonra konan işaret (`hydrationMarker`) gerekir. İşaretsiz kopya anında gösterilir (skeleton yok), arka
planda bir kez buluttan alınır, sonra işaret konur. Maliyet = eski modelin **tek** açılışı; sonrası 0.
Alan `version`'ı yükseltilirse herkes bir kez daha doğrulanır. Başarısız arka plan denemesinden sonra
30 sn beklenir (okuma fırtınası olmasın).

---

## 5. Bilinen sınırlar ve açık kararlar

1. **Çok cihaz.** Aynı hesap iki cihazda açıksa, birinin değişikliği diğerinde **otomatik görünmez**
   (istenen model bu). Aynı belgeyi iki cihaz düzenlerse son yazan kazanır (artık tam belge).
   Önlem şu an elle: Önbellek ekranı → satır → yeniden kur. Seçenekler (Faz 6):
   - **A.** Ekranlara çek-yenile → `resyncUserData` (maliyet: kullanıcı isteyince N okuma).
   - **B.** `SyncMeta/{uid}` revizyon belgesi: yazma salvosu başına +1 yazma, ön plana gelişte (en çok
     6 saatte bir) 1 okuma; yalnız revizyon değişmişse çek. Çok cihaz şikâyeti gelirse öneri.
   - **C.** `updatedAt` delta sorgusu: silmeleri göremez (tombstone gerekir) ve hatırlatıcılarda
     `updatedAt` yok → önerilmez.
2. **iOS yedekleme.** Belge dizini iCloud/iTunes yedeğine girer. Notlar/hatırlatıcılar için istenen şey;
   `lists` (özellikle `watchedTv`) yeniden üretilebilir ama büyük olabilir. Yedek boyutu sorun olursa
   `lists`i `DURABLE_NAMESPACES`ten çıkarmak tek satır (karşılığı: nadir sistem temizliğinde yeniden indirme).
3. **Ölü işlemler** (kural/veri hatası): yerelde kalır, buluta gitmez, her yeni oturumda bir kez daha
   denenir. `useSyncStatus().dead > 0` için kullanıcıya gösterilecek bir arayüz **yok** (Faz 6).
4. **Premium sayaçları** (`useReminderGate`, `usePremiumGate("notes")` …) artık yerel kopyadan sayıyor;
   başka cihazda eklenen kayıt bu cihazın sayacına yansımaz. Sunucu tarafı tavan gerekiyorsa ayrı iş.
5. **Kısmi → tam belge yazımı.** `toggleTodo`, `pin` gibi eski kısmi güncellemeler artık tam belge
   yazar. İki cihaz farklı alanları eşzamanlı düzenlerse eskiden birleşirdi, şimdi son yazan kazanır.

---

## 6. Yol haritası

| Faz | İçerik | Durum |
|---|---|---|
| **0** Temel | kalıcı konum + eski konumdan taşıma · günlük · işçi · alan motoru · doğrulama işareti | ✅ |
| **1** Notlar + medya notları | `ProfileNotesContext`, `MediaNotesContext` | ✅ |
| **2** Hatırlatıcılar + Takvim | `ProfileRemindersContext`, `CalendarContext` (4 dinleyici → türetme), `Reminder.js`, `MovieDetail`, `MediaQuickActionsSheet` | ✅ |
| **3** Yaşam döngüsü | giriş/çıkış/hesap silme · "Verileri indir" · Önbellek ekranı · ağ/ön plan tetikleyicileri | ✅ |
| **4** Listeler | (a) `useWatchedShow`: `Lists/.../watchedTv/tv_{id}` `onSnapshot`'ını yerel `watchedTvMap`ten oku — **ön koşul:** `libraryActions` yazmasından sonra yerel haritanın *tam* belgeyi (gömülü sezon/bölüm + olaylar) taşıdığı emülatör testiyle doğrulanmalı; (b) kök belge dinleyicisini tek seferlik `getDoc`a çevirme ve `statusIndex` sapma onarımının çok cihaz varsayımını gözden geçirme; (c) `listItemsService` `getDocs` (özel liste öğeleri) | ⏳ |
| **5** Etkinlik | `MyActivityButton` profil her açıldığında 3 koleksiyonu **tamamen** dinleyip yalnız sayı gösteriyor. Tasarım: `activity` alanı + yazma noktalarında (`Comment.js`, `mediaCommentsService`, `postsService`, `ratingsService`) **yazma-sonrası ayna** (batch/transaction içindeki sayaçlarla birlikte atomik kaldıkları için günlükten geçmez); sayılar yerel kopyadan | ⏳ |
| **6** Çok cihaz + görünürlük | çek-yenile (seçenek A) · Ayarlar > Veri ve depolama'da "Bulut durumu" satırı (`useSyncStatus`) · gerekirse revizyon belgesi (seçenek B) | ⏳ |

### Yeni bir kullanıcı-sahipli koleksiyon eklemek

1. Tek yazarlı mı? (Bölüm 2.) Değilse bu modele girmez.
2. `utils/cacheKeys.js`'e anahtar, `utils/cacheStore.js` `DURABLE_NAMESPACES`e ad alanı.
3. `services/userData/domains.js`'e `DomainSpec` (`kinds`, `pathOf`, `fetchCloud`, gerekirse `compare`,
   `version`) ve `index.js`'te `createUserDataDomain` + `ALL_DOMAINS`.
4. Context'te `useUserDataDomain(domain)` ile oku, `domain.apply(uid, [...])` ile yaz. **Firestore'a
   doğrudan yazma / dinleyici ekleme.**
5. Emülatör testine yol + kural + zehirli işlem senaryosu ekle.

---

## 7. Doğrulama

| Katman | Ne | Sonuç (10 Eki 2026) |
|---|---|---|
| Birim | `cacheStoreDurable`, `userDataOutbox`, `userDataSyncWorker`, `userDataDomain`, `userDataReminders` | geçti |
| Entegrasyon (react-test-renderer, gerçek sağlayıcılar) | `userDataContexts`: dinleyici **0**, açılışta okuma **0**, yazma anında görünür, çevrimdışı yazma, Takvim türetmesi, çıkış/hesap silme | geçti |
| Emülatör (gerçek SDK + gerçek kurallar) | `rules/userData`: iç içe yol batch, `undefined` reddi, iç içe dizi → zehirli işlem, yetkisiz yazma → ölü harf, eski şema göçü, süreç ölümü | geçti |
| Mutasyon kontrolü | 16 kritik değişmez bilerek bozuldu (günlük bindirmesi, `journal`, onay sırası, işaret, birleştirme, taşıma …) | 16/16 yakalandı |

Toplam: `npm test` 143 paket / 2286 test · `npm run test:rules` 5 paket / 156 test.

### Cihazda görülmedi — elle doğrulanacaklar

Geliştirme ortamı (Windows) cihaz çalıştıramıyor; aşağıdakiler yalnız gerçek cihazda doğrulanabilir:

- [ ] Güncelleme sonrası ilk açılış: notlar/hatırlatıcılar anında dolu, skeleton yok; Kullanım ekranında
      yalnız bir kerelik okuma var, sonraki açılışlarda 0.
- [ ] Uçak modunda not/hatırlatıcı ekle → uygulamayı öldür → bağlantıyı aç → bulutta görünüyor mu.
- [ ] Çıkış → başka hesapla giriş: önceki hesabın verisi yok; geri dönünce tek seferlik indirme.
- [ ] Android "Önbelleği temizle" (sistem ayarları) sonrası notlar yerinde (belge dizini).
- [ ] Film detayı / bölüm listesinde çan simgesi anında doğru durumda; Takvim noktaları güncel.
- [ ] iOS: Ayarlar > Önbellek > Notlar satırı simgesi ☁️↓, dokununca veri kaybolmadan yenileniyor.
- [ ] Hesap silme akışı sonrası bulutta belge yeniden oluşmuyor.

---

## 8. AI sohbet geçmişi (CineMatch) — bulut yedekli

Eskiden yalnız cihazdaki MMKV'de duruyordu (telefon değişince / uygulama silinince giderdi). Artık
yukarıdaki motorun bir alanıdır: okuma yerel kopyadan senkron, yazma yerelde + günlükte anında,
indirme yalnız yerel kopya yokken tek seferlik.

**Şema.** `AiConversations/{uid}/items/{conversationId}` — sohbet başına **bir belge**:
`{ v, id, title, messages[], messageCount, createdAt, updatedAt }`. Mesaj şekli `services/aiCineStore.js`
başında belgeli (`aiResponse`, `posterMap`, `attachment`, …). Kurallar: yalnız sahibi okur/yazar
(`firestore.rules`). `AiUsage/{uid}` (günlük/aylık kota) **ayrı** ve yalnız Cloud Function yazar.

**Neden tek belge, alt koleksiyon değil.** Mesajları bölmek ilk indirmede okuma sayısını ~20 kat artırır
(sohbet + her sohbetin mesaj koleksiyonu). Tek belgede: indirme = sohbet başına 1 okuma, her cevap = 1
yazma, aynı sohbetin hızlı ardışık güncellemeleri günlükte tek işleme iner. Bedeli Firestore'un 1 MiB
belge tavanı → aşağıdaki bütçe.

**Boyut bütçesi** (`aiConversations.js`): bir belge `MAX_DOC_BYTES` (450 000 UTF-8 bayt; karakter değil —
ASCII dışı metin 2-4 bayt) veya
`MAX_MESSAGES` (200) sınırını aşarsa **en eski tam turlar** (kullanıcı + asistan) belgeden düşer; başlık
ayrı saklandığı için kaybolmaz. Ayrıca Firestore'un reddettiği iki şey yazmadan önce temizlenir:
`undefined` (motor) ve **iç içe dizi** (`flattenNestedArrays` — model çıktısı serbest biçimli).

**Saklama sınırı** (Ayarlar > Yapay zeka > Saklanacak sohbet: 10/25/50): aşan en eski sohbetler
aynı adımda **cihazdan ve hesaptan** silinir. "Tümünü sil" ve tek sohbet silme de buluta gider; ilgili
metinler (tr/en/es) bunu söyler.

**Eski geçmişin taşınması.** `startUserData(uid)` indirmeyi başlattıktan SONRA `migrateLegacy` çalışır:
eski MMKV anahtarındaki (`Keys.aiCineConversations`) sohbetler `apply` ile günlüğe girer, ardından anahtar
silinir (günlük MMKV'de kalıcı olduğundan ağ yokken de kayıp yok). İdempotent; buluttaki/yerel daha
yeni sürümü ezmez. Eski CineMatch'in (`Keys.aiConversations`, `aiConversationsStore`) ayrı geçmişi
kapsam dışı — o arayüz artık açılmıyor.

**Çok cihaz (Faz 6, seçenek A'nın AI karşılığı).** Geçmiş ekranında aşağı çekmek `refresh()` çağırır:
önce bekleyen yazımlar gönderilir, sonra `resync` (N okuma, yalnız kullanıcı isteyince). Başka cihazda
silinen sohbet bu cihazda aşağı çekilene kadar görünür; o arada bu cihazda devam ettirilirse buluta
yeniden yazılır (diriltme) — bilinen, kabul edilen sınır.

**Diğer yerler:** hesap silme `AiConversations/{uid}/items`i siler (`accountService`) ve yerel
kopya + günlük `purgeUserData` ile temizlenir; Önbellek ekranında "Yapay zeka sohbetleri" satırı
(düğme silmez, buluttan yeniden kurar); `website/delete-account.html` ve `privacy.html` güncellendi.

**Doğrulama:** `aiConversationStore` + `aiConversationsCloud` (motor/depo, yeni telefon, çevrimdışı,
taşıma, kural reddi), `aiConversationsWiring` (gerçek `services/userData` + hook), `aiHistoryCloudStates`
(arayüz durumları), `rules/userData` (gerçek SDK + gerçek kurallar; kural satırı kaldırılınca 4 test
kırmızı). Bellek içi mutasyon kontrolü: depo 9/9, kablolama 4/4 yakalandı.

**Cihazda görülmedi:**

- [ ] Güncelleme sonrası ilk giriş: eski sohbetler geçmişte duruyor ve Firestore konsolunda
      `AiConversations/{uid}/items` altında görünüyor.
- [ ] Uygulamayı sil → yeniden kur → giriş: geçmiş (poster/kartlarıyla) geri geliyor.
- [ ] Uçak modunda cevap al → kapat → bağlantıyı aç: sohbet buluta gidiyor.
- [ ] Geçmişte aşağı çek (iki cihaz): diğer cihazdaki sohbet geliyor; boş liste de çekilebiliyor.
- [ ] Saklama sınırını 10'a indir: fazla sohbetler hem cihazdan hem konsoldan siliniyor.

> **Dağıtım sırası:** `firestore.rules` (yeni `AiConversations` kuralı) uygulamadan ÖNCE yayınlanmalı.
> Yayınlanmadan sürüm çıkarsa yazmalar `permission-denied` ile ölü harfe ayrılır; sohbetler cihazda
> görünmeye devam eder ve kural yayınlanınca (yeni oturumda) buluta gider — kayıp olmaz.
