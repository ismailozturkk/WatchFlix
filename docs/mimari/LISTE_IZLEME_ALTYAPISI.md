# Liste ve izleme yazma altyapısı

3 Ekim 2026 denetimi sonrası. "Listeye ekle / çıkar" ve "izlendi işaretle / geri al"
için **tek kapı** vardır: `services/libraryActions.js`. Ekranlar yazma servislerini
(`listItemsService`, `watchedTvService`) doğrudan çağırmaz.

## Katmanlar

| Katman | Dosya | Sorumluluk |
|---|---|---|
| Saf çekirdek | `utils/libraryCore.js` | anahtar şeması, hata sınıflaması (`LibraryError`), anahtar başına **sıra kuyruğu**, TMDB detayından kanonik öğe/meta kurucuları |
| İyimser bindirme | `services/libraryOverlay.js` + `utils/listStatusIndex.applyStatusOverlay` | işlem sürerken niyetin (`inFavorites: true` …) `statusIndex` üstüne **bellekte** binmesi |
| Orkestrasyon | `services/libraryActions.js` | sıra + bindirme + yerel harita + geri alma + hata sınıflaması; kapılar (yayın tarihi, geçersiz tarih) ağdan/yazımdan **önce** |
| TMDB sezonları | `services/showSeasons.js` | diziyi/sezonu işaretlemek için bölüm çekme. **Eksik veriyle yazma yok**: bir sezon düşerse iş iptal |
| Depolama / muhasebe | `services/listItemsService.js`, `services/watchedTvService.js` | belge yazımı, kök özet (`counts`, `statusIndex`, `stats`), yerel önbellek |
| Hızlı ekleme | `services/listQuickAdd.js` | arama sonucu → doğru listeye doğru `libraryActions` çağrısı |
| Kullanıcı metni | `utils/libraryErrorText.js` | `LibraryError.code` → yerelleştirilmiş toast (`showLibraryError`) |
| Okuma tarafı | `context/ListStatusContext.js` | bindirmeyi uygular, ilk indirme kapısı, sapma onarımı |

## Yeni bir ekleme/izlendi giriş noktası eklerken

1. Öğeyi `utils/libraryCore`'daki kurucularla kur (`listItemFromDetails`, `movieWatchItemFromDetails`,
   `showMetaFromDetails`). Alanları elle yazma: dizi detayından eklenen öğede bölüm süresi
   yoktu, hızlı eklemede vardı (iki kapı iki farklı veri üretiyordu).
2. Yazmak için `libraryActions` fonksiyonunu çağır:
   `setListMembership` · `addManyToMembership` · `markMovieWatched` · `removeMovieWatch` ·
   `markShowWatched` · `markSeasonWatched` · `markEpisodeWatched` · `removeTvWatch` ·
   `removeFromListAny` · `reorderCustomList`.
3. Hedef durumu **görünen** durumdan türet (`useListStatus` bindirmeyi zaten içerir):
   `desired = !inFavorites`. "Tersine çevir" değil "şu olsun" — art arda iki dokunuş
   ekle→çıkar olur, ekle→ekle olmaz.
4. Hatayı `showLibraryError(error, { source })` ile göster. Ekranda kendi iyimser state'ini
   **tutma**: bindirme hata olunca kendiliğinden geri döner ve aynı eseri gösteren diğer
   ekranları da günceller.

## Hata kodları (`LibraryError.code`)

`offline` · `permission` · `conflict` · `quota` · `unreleased` · `unknown-release` ·
`seasons-incomplete` · `daily-watch-limit` · `list-name-reserved` · `list-name-conflict` · `invalid-request` · `unknown`.
`retryable` bayrağı kullanıcının tekrar denemesinin işe yarayıp yaramayacağını söyler.

## Veri sözleşmesi (kök doküman `Lists/{uid}`)

- Üyelik listeleri (`favorites`, `watchList`): belge `Lists/{uid}/{liste}/{type_id}`,
  `statusIndex.{type}.{id}.inFavorites|inWatchList`, `counts.{liste}` (yalnız **yeni** belge artırır).
- İzlenen film: izleme **olayı** (`watchEvents[]`), tekrar izleme olay ekler; üyelik/benzersiz
  sayaçları artmaz. İzlenen dizi: tek belge, gömülü sezon/bölüm + olaylar.
- `addToList/removeFromList` **yalnız** favorites/watchList. Başka anahtar `invalid-request`
  fırlatır (eskiden sessizce yanlış bayrak yazılıyordu).
- Özel liste adı ayrılmış alanlarla (`counts`, `stats`, `statusIndex`, …) çakışamaz
  (`list-name-reserved`); kök doküman bu adları harita olarak kullanır.

## Denetimde bulunan ve düzeltilen hatalar

Hepsi için önce kırmızı emülatör testi yazıldı (`__tests__/rules/library*.test.js`).

1. **Eski kök `watchedTv[]` göçü yeni modeli eziyordu.** `migrateLegacyShow` merge'siz `setDoc`
   yapıyor, kök dizi göçten sonra silinmiyordu → eski kökten gelen hesaplarda her açılışta
   diziler eski verisiyle yeniden yazılıp sonradan işaretlenen bölümler/olaylar siliniyordu.
   Artık belge varsa dokunulmaz, göç sonrası dizi temizlenir.
2. **İzlenen filmi listeden çıkarmak** (`ListsScreen`) yanlış bayrağı (`inWatchList`) kapatıp
   `isWatched`'ı ve tüm istatistiği olduğu gibi bırakıyordu. Film listeden kaybolur, detay ekranı
   "izlendi" demeye devam ederdi. `removeWatchedMovie` tüm kaydı ve etkisini geri alır.
3. **Özel listeye yazan iki detay ekranı** (`MovieDetail`, `TvShowsDetails`) kilitsiz
   oku-değiştir-yaz yapıyor ve `updateDoc` ile yazıyordu: başka cihazdaki eşzamanlı ekleme
   siliniyor, noktalı liste adları ("S.W.A.T. Listem") iç içe haritaya dönüşüyordu.
4. **Özel liste yeniden sıralama** aynı kalıbı kullanıyordu; ayrıca eşleştirme yalnız `id`'ye
   bakıyordu (aynı TMDB id'li film+dizi karışırdı). Transaction + tip duyarlı `reorderCustomRootList`.
5. **Ayrılmış özel liste adı** servis katmanında engellenmiyordu; `counts`/`stats` alanı diziye
   dönüşüp sonraki her sayaç yazımını bozabilirdi.
6. **Geçersiz izleme tarihi** sessizce `null` dönüyor, ekran "başarılı" toast'ı gösteriyordu.
7. **Hiç bölümü yayınlanmamış dizi** "tüm diziyi işaretle"de sessizce "eklendi" dönüyordu (yazım yok).
8. **Eksik sezonla yazma:** hızlı ekleme düşen sezonu atlayıp diziyi "tamamen izlendi" yazıyordu.
9. **Hızlı ekle→çıkar yarışı:** iki transaction aynı belgeye aynı anda gidiyor, sunucu ile yerel
   önbellek ayrışabiliyordu.
10. **İlk indirme kapısı sayaca bağlıydı** (`counts.X > 0`); sapmış/sıfıra inmiş sayaç yeni cihazda
    dolu listeyi boş gösterirdi. Kapı artık "bu cihaza hiç indirildi mi" (`hasLocalList`).
11. **Başka cihazdaki değişiklik liste ekranına hiç ulaşmıyordu** (yerel haritalar yalnız kendi
    yazımlarıyla güncelleniyordu). Sunucu `statusIndex`'i ile yerel harita sıfır okumayla
    karşılaştırılır; yalnız sapan liste yeniden çekilir (kök sürümü başına bir kez).
12. **Çevrimdışı açılışta** `App.js` her seferinde hata toast'ı + Sentry raporu basıyordu; kök
    doküman oluşturma da merge'siz `setDoc` idi. `ensureListsRoot` (transaction) + çevrimdışı sessiz.
13. **CineSwipe sepetini izlenecekler'e eklemek** içe aktarma yazıcısından geçiyordu (eser başına
    transaction + tüm yorumları okuma + bütün listeleri tarayan istatistik yeniden hesabı).
    `addItemsToList`: 100'lük parçalar hâlinde tek transaction.
14. Ölü ve hatalı `unmarkEpisode`/`unmarkSeason` kaldırıldı (hiçbir yerden çağrılmıyordu; istatistik,
    olay geçmişi ve yerel önbelleği güncellemiyordu). Bölüm/sezon geri alma `removeTvWatch`.

## Günlük 1440 dakika sınırı

Bir güne en fazla **24 saat** (1440 dk) izleme yazılır. Kural `utils/dailyWatchLimit.js`'te (saf),
kapı `services/libraryActions.js`'te, metinler `utils/dailyLimitCopy.js`'te.

- **Ne sayılır:** izleme tarihi (`watchedAt`) o güne denk gelen her olayın süresi — film olayları
  (belgedeki `minutes`), dizi olayları (olay `minutes`'ı). Tekrar izleme de süre harcar. Süresi
  bilinmeyen (0 dk) içerik sınırı doldurmaz. Kullanım **yerel listelerden** hesaplanır (ağ yok).
- **Film / tek bölüm** (`markMovieWatched`, `markEpisodeWatched`): günün kalanına sığmazsa
  `daily-watch-limit` fırlatılır (`error.details`: `reason, day, used, remaining, requested`); hiçbir şey
  yazılmaz, bindirme geri alınır. Tam sınır kabul edilir.
- **Sezon / tüm dizi** (`markSeasonWatched`, `markShowWatched`): sığmıyorsa bölümler **sırayla günlere
  yayılır**. Seçilen tarih izlemenin **bittiği gün**dür: son bölümler o güne, öncekiler geriye doğru
  önceki günlere yazılır (gelecek tarih üretilmez); zaten dolu günlerin yalnız boş kısmı kullanılır.
  Yayılma `MAX_SPREAD_DAYS` (366) günü aşarsa `reason: "span"` ile reddedilir ve **hiçbir şey yazılmaz**.
  Sonuçta `spread: { days, startDate, endDate }` döner; ekranlar `showWatchSpreadNotice(result)` ile söyler.
- **Yazım:** yayılan işlem TEK transaction'da birkaç olay yazar (`watchedTvService.commitWatch` →
  `schedule`). Olaylar aynı `batchId`'yi, `part`/`parts` sırasını taşır; asıl kapsam (`show`/`season`)
  seçilen günün (son) olayında kalır, öncekiler `episode` olur → `countTvWatchStats` tam izleme sayacı
  şişmez. `removeTvWatchEvent` aynı `batchId`'li tüm parçaları birlikte siler.
- **Sıralama:** denetim + yazım kullanıcı başına TEK sırada (`${uid}:watch-days`); eşzamanlı iki ekleme
  aynı günün son dakikasını paylaşamaz.
- **Kapsam dışı (bilinçli):** içe aktarma (Letterboxd/IMDb) ve eski kayıtlar sınırdan geçmez; bu yüzden
  bir günün kullanımı zaten 1440'ı aşmış olabilir (kalan 0 sayılır). Sınır **istemci kuralı**dır —
  Firestore kuralları dakika toplamını denetleyemez.
- **Testler:** `__tests__/dailyWatchLimit.test.js` (saf), `__tests__/rules/dailyWatchLimit.test.js`
  (emülatör: sınır, yayılma, tek hamlede silme, eşzamanlılık), `__tests__/dailyLimitCopy.test.js`.

## Testler

- `npm test` — saf çekirdek (`libraryCore`, `libraryOverlay`) ve `ListStatusContext` render testi
  (bindirme, ilk indirme kapısı, sapma onarımı, çevrimdışı yeniden deneme).
- `npm run test:rules` (JDK 21 — bkz. hafıza notu) — **gerçek servis kodu, gerçek Firestore
  emülatörü ve gerçek güvenlik kuralları**: `libraryServices`, `libraryActions`, `listQuickAdd`.
  Servisleri yeniden düzenlerken regresyonu yakalayan asıl güvence bu; mock'lu testler aynı
  hataları "geçiyor" gösteriyordu.

## Bilinen sınırlar / sonraki adımlar

- **Kalıcı çevrimdışı yazma yok.** Transaction'lar çevrimdışı çalışmaz; RN'de Firestore yalnız
  bellek önbelleği kullanır. Çevrimdışıyken ekleme `offline` hatasıyla geri alınır. Gerçek çözüm
  kalıcı bir "bekleyen işlemler" kuyruğu (MMKV) + yeniden oynatma; işlemlerin çoğu zaten idempotent.
- Liste **oluşturma/silme/yeniden adlandırma** (`CreateListModal`, `ListsViewScreen.addNewList`,
  `ListManageSheet`) bu katmanın dışında kaldı: `getDoc` + `batch.commit` kullanıyor, çevrimdışıyken
  commit bekler.
- Kök sayaçlar (`counts`, `stats`) artış/azalışla tutulur ve zamanla sapabilir (ör. `isFirstWatch`
  eski, olaysız belgelerde bir kez fazla sayabilir). Ekranlar öğelerden yeniden hesapladığı için
  görünür etkisi sınırlı; `importWriter.rebuildImportedProfileStats` onarım aracı olarak kullanılabilir.
- Sunucudaki kök `statusIndex`'te kalmış hayalet bayraklar (eski hatalardan) otomatik yazılarak
  onarılmaz; sapma onarımı yalnız okur.
