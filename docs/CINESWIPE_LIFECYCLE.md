# CineSwipe oda bitişi

- Oda `waiting → active → finished` durumlarından geçer. Bitiş, iki katılımcının destedeki tüm kartlar için kaydedilmiş oyu olduğunda son oy ile aynı Firestore transaction'ında yazılır.
- Oylar `movie_<id>` / `tv_<id>` anahtarlarıyla ayrılır. Eski sayısal anahtarlar okunabilir. Kaydedilmiş seçim tekrar yazılarak değiştirilemez; Duo geri alma düğmesi bu nedenle gösterilmez. Solo geri alma korunur.
- İlk bitiren kullanıcı arkadaşını bekler. İkisi de bitince tek sonuç ekranı açılır: kişi başı kart sayısı, ortak eşleşmeler, eşleşme oranı (ortak beğeni / deste), kişi bazında beğeni ve pas sayıları. Sıfır eşleşme de geçerli bir bitiştir.
- Son sonuç hesap kapsamında cihazda saklanır (`Keys.cineLastResult`). Yerel kayıt başarılı olmadan `resultsReceived` onayı yazılmaz. Onay hatası yeniden denenebilir.
- `cleanupDeliveredCineRoom`, iki kullanıcı da sonucu aldıktan sonra `CineRooms/{roomId}` belgesini transaction ile siler. Deste, oylar, eşleşmeler ve katılımcı bilgileri bu belgenin içindedir; alt koleksiyon oluşturulmaz. Kullanıcının ayrıca oluşturduğu kişisel/ortak listeler silinmez.
- `cleanupExpiredCineRooms` 15 dakikada bir çalışır. Bitmiş ama teslimi tamamlanamamış odalar için bir saat, terk edilmiş odalar için 24 saat süre tanınır. Eski `expiresAt` alanı olmayan odalar `createdAt` ile temizlenir. Her çalışmada sorgu başına en fazla 200 aday işlenir; yoğunlukta sonraki çalışmalarda devam edilir.
- Cihazdaki son sonuç oda silindikten sonra yeniden açılabilir. Yeni oyun sadece yerel son sonuç kaydını değiştirir; Firestore'da oyun geçmişi tutulmaz.

## Yayınlama

Sunucu temizliği istemci güncellemesinden önce yayınlanmalıdır. Bu değişiklikte canlı yayın yapılmadı.

```powershell
firebase deploy --only "functions:cleanupDeliveredCineRoom,functions:cleanupExpiredCineRooms"
```

Mevcut CineRooms kuralları katılımcı güncellemelerine izin verir; bu çalışma kuralları değiştirmez. Sorgular tek alanlı varsayılan indeksleri kullanır.

## Doğrulama

```powershell
npx jest __tests__/cineswipe.test.js __tests__/cineResultsStore.test.js __tests__/storage.test.js --runInBand
node --test functions/cineRoomCleanup.test.js
```

İki cihazla canlı doğrulama: aynı anda son oy, ilk bitirenin beklemesi, sıfır eşleşme, yerel kayıt/onay sırasında bağlantı kesilmesi, iki sonuç tesliminden sonra belgenin silinmesi ve silinmeden sonra sonuçlardan ortak liste oluşturma. Bu cihaz/canlı ortam kontrolleri henüz yapılmadı.
