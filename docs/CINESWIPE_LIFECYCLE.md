# CineSwipe oda bitişi

- Oda `waiting → active → finished` durumlarından geçer. Bitiş, iki katılımcının destedeki tüm kartlar için kaydedilmiş oyu olduğunda son oy ile aynı Firestore transaction'ında yazılır.
- Oylar `movie_<id>` / `tv_<id>` anahtarlarıyla ayrılır. Eski sayısal anahtarlar okunabilir. Kaydedilmiş seçim tekrar yazılarak değiştirilemez; Duo geri alma düğmesi bu nedenle gösterilmez. Solo geri alma korunur.
- İlk bitiren kullanıcı arkadaşını bekler. İkisi de bitince tek sonuç ekranı açılır: kişi başı kart sayısı, ortak eşleşmeler, eşleşme oranı (ortak beğeni / deste), kişi bazında beğeni ve pas sayıları. Sıfır eşleşme de geçerli bir bitiştir.
- Son sonuç hesap kapsamında cihazda saklanır (`Keys.cineLastResult`). Yerel kayıt başarılı olmadan `resultsReceived` onayı yazılmaz. Onay hatası yeniden denenebilir.
- `cleanupDeliveredCineRoom`, iki kullanıcı da sonucu aldıktan sonra `CineRooms/{roomId}` belgesini transaction ile siler. Deste, oylar, eşleşmeler ve katılımcı bilgileri bu belgenin içindedir; alt koleksiyon oluşturulmaz. Kullanıcının ayrıca oluşturduğu kişisel/ortak listeler silinmez.
- `cleanupExpiredCineRooms` 15 dakikada bir çalışır. Bitmiş ama teslimi tamamlanamamış odalar için bir saat, terk edilmiş odalar için 24 saat süre tanınır. Eski `expiresAt` alanı olmayan odalar `createdAt` ile temizlenir. Her çalışmada sorgu başına en fazla 200 aday işlenir; yoğunlukta sonraki çalışmalarda devam edilir.
- Cihazdaki son sonuç oda silindikten sonra yeniden açılabilir. Yeni oyun sadece yerel son sonuç kaydını değiştirir; Firestore'da oyun geçmişi tutulmaz.

## Solo deste ve ekran

- Katman ayrımı: saf mantık `services/cineswipe/deckModel.js` (kategori/tür çelişkileri, TMDB isteği kurulumu, kart normalizasyonu) ve `soloReducer.js` (deste/sayfa/sepet durum makinesi); ağ `cineswipeService.js` (`fetchSwipeDeckPage` hatada fırlatır, 5xx/429'da bir kez yeniden dener); bunları `hooks/useCineSoloDeck.js` birleştirir; `screens/cineswipe/CineSwipeScreen.js` yalnız orkestrasyon yapar, görünüm `components/cineswipe/*`.
- Her asenkron cevap `requestId` taşır. Filtre değişince ya da 2. tur başlayınca eski isteğin geç cevabı reducer'da atılır; yeni desteye karışmaz.
- Solo ↔ Duo geçişi solo desteyi ve sepeti silmez; deste yalnız ilk açılışta ve hesap değişince yüklenir.
- Aynı filtreler yeniden uygulanırsa istek atılmaz. Filtre değişince bu oturumda kaydırılan kartlar yeni desteden elenir; "Desteyi baştan başlat" bu listeyi temizler.
- Sepet `cineMediaKey` (`movie_<id>` / `tv_<id>`) ile tekilleştirilir. "Liste yap" `addItemsToCustomRootList` ile tek işlemde yazar: aynı günün listesi varsa öğeler birleşir, `statusIndex` yazılır, yeni liste ancak limit izin verirse açılır.
- 2. tur: sepet karıştırılıp yeni deste olur, sayfalama kapanır. Sonunda tek içerik kalırsa kazanan sayfası bir kez kendiliğinden açılır.
- Günlük kaydırma hakkı (`cineswipe_swipes`): hak bittiyse kart hiç fırlamaz (`swipesAllowed=false`); geri al hakkı iade eder. Final turundaki kaydırmalar da hakkı tüketir.
- Duo oy sırası yerel `roomIndex`tir; oy yazılana kadar ilerlemez, yazma hatasında kart geri döner. Duo'da geri al yoktur.
- Odadan çıkış (geri tuşu, kaydırma, başlık oku) `beforeRemove` ile onay ister: bekleyen oda silinir, oynanan oda yarım bırakılır (24 saatlik süre sonunda temizlenir). Kendi silmemizde dinleyicinin "oda silindi" hatası yok sayılır.
- Metinler `translations/*.json → cineSwipe`; `__tests__/cineCopy.test.js` her `copy.*` kullanımının iki dilde bulunduğunu ve yer tutucuların eşleştiğini doğrular.

## Sırayla (oturumlu) oda

- Oda kurulurken `mode`: `live` (eski davranış) ya da `async` (sırayla). Kural: `services/cineswipe/asyncRoom.js`; görünüm `components/cineswipe/CineAsyncRoom.js`.
- Sırayla odada kurucu, misafir yokken (`status: waiting`) oy verebilir; davet 24 saat açıktır. Misafir katılınca `expiresAt` yeniden 24 saate uzar; grup davetinden geldiyse grup `resultChat` olarak odaya yazılır.
- Ekrandan çıkmak sırayla odayı kapatmaz (onay sorulmaz). Lobide "Süren odalar" listesi (`listMyAsyncRooms`: hostUid / guestUid tek alanlı sorgular) odaya `loadCineRoom` ile döner. Kimse katılmadıysa kurucu odayı kapatabilir.
- Son oyu veren cihaz (`recordSwipe` → `finishedByMe`) eşleşmeleri sohbete yazar (`resultChat` ya da 1-1 sohbet; eşleşme yoksa yazmaz) ve diğer kişiye `cineswipe_result` bildirimi bırakır (`roomId`, `matchCount`, `chatPosted`). Sohbete yazıldıysa sunucu bildirim push'unu atlar; mesaj push'u yeter.

## Sohbetteki davet kartı

- Kartın durumu mesajın kendisinde (`utils/chatInvites.js`): alıcı `accepts.{uid}` ya da `declines.{uid}` yazar (kartta [Reddet] [Odaya katıl]; katılmak = kabul), oda bitince `done = { at, matches }` bir kez yazılır. Kural: `firestore.rules` → `inviteAnswer`, `cineInviteDone`.
- Profil'deki önemli davetler çubuğundan verilen yanıt da bildirim kaydındaki `messageId` ile aynı mesaja yazılır; karttan verilen yanıt bildirim kaydını aynı yanıta çeker (`respondMatchingInvitations`).
- `done`'ı kim yazar: canlı odada davetle katılan misafir (karttan/çubuktan gelen `inviteMessageId` ekranda), sırayla odada son oyu veren — bunun için katılırken `inviteMessageId` odaya `resultChat` ile birlikte yazılır. Kod elle girilerek katılınan odada kart "Tamamlandı"ya dönmez.
- Yanıtsız kart 24 saatte, kabul edilmiş ama bitmemiş kart 48 saatte "Süresi doldu" olur.
- Bitmiş sırayla oda 24 saat durur (canlıda 1 saat): bildirime dokunan kişi sonucu açar; oda silinmişse cihazdaki geçmişten açılır.
- Kural değişikliği yok. Sunucu (`functions/index.js` push metni + tekrar push atlama, `socialPush.js` `roomId`) deploy edilmeden bu bildirimin push'u genel "Bildirim" metniyle gider.

## Yayınlama

Sunucu temizliği istemci güncellemesinden önce yayınlanmalıdır. Bu değişiklikte canlı yayın yapılmadı.

```powershell
firebase deploy --only "functions:cleanupDeliveredCineRoom,functions:cleanupExpiredCineRooms"
```

Mevcut CineRooms kuralları katılımcı güncellemelerine izin verir; bu çalışma kuralları değiştirmez. Sorgular tek alanlı varsayılan indeksleri kullanır.

## Doğrulama

```powershell
npx jest __tests__/cineswipe.test.js __tests__/cineResultsStore.test.js __tests__/cineSoloReducer.test.js __tests__/cineDeckModel.test.js __tests__/cineCopy.test.js __tests__/storage.test.js --runInBand
node --test functions/cineRoomCleanup.test.js
```

İki cihazla canlı doğrulama: aynı anda son oy, ilk bitirenin beklemesi, sıfır eşleşme, yerel kayıt/onay sırasında bağlantı kesilmesi, iki sonuç tesliminden sonra belgenin silinmesi ve silinmeden sonra sonuçlardan ortak liste oluşturma. Bu cihaz/canlı ortam kontrolleri henüz yapılmadı.
