# Kütüphane dışa aktarma (JSON + CSV/ZIP, Letterboxd uyumlu)

Ayarlar > Veri ve depolama > **Kütüphaneni Dışa Aktar**. İzlenen filmler/diziler, izleme listesi, favoriler, özel listeler, izleme tarihleri
(tekrar izlemeler dahil), dizilerde bölüm bölüm geçmiş ve puanlar iki biçimde cihaza dosya olarak çıkar ve sistem paylaşım sayfasından
kaydedilir/gönderilir. **Ücretsiz** (taşınabilirlik hakkı; plan kapısı yok). Yalnız istemci (JS-only → OTA).

Kaynak: `docs/planlama/GELISTIRME_ONERI_ADAYLARI_2026-10-17.md` 2. aday.

## Çıktılar

| Seçenek | Dosya | İçerik |
|---|---|---|
| **Tam yedek (JSON)** | `seelogd-library-YYYY-MM-DD.json` | Eksiksiz kopya: tüm listeler, film izleme tarihleri, dizi bölümleri (sezon/bölüm/tarih), puanlar, sayaçlar, uygulama sürümü. |
| **Tablo ve Letterboxd (ZIP)** | `seelogd-library-YYYY-MM-DD.zip` | `library.csv` (Excel/Sheets; UTF-8 BOM) + `letterboxd-watched*.csv` + `letterboxd-watchlist*.csv` + `README.txt` (kullanıcı dilinde). |

### Letterboxd dosyaları

Sütunlar Letterboxd'ın yayımlanmış içe aktarma biçimi (https://letterboxd.com/about/importing-data/, 18 Ekim 2026'da doğrulandı):
`tmdbID, Title, Year, WatchedDate, Rating10, Rewatch` (izlenenler) ve `tmdbID, Title, Year` (izleme listesi).

- **Yalnız film.** Letterboxd dizi tanımaz; diziler JSON ve `library.csv`'de tam, Letterboxd dosyalarında YOK (ekranda ve README'de yazar).
- `tmdbID` Letterboxd'da **kesin eşleşme** sağlar (Title/Year yalnız yardımcı). Seelogd liste öğeleri yayın yılı taşımadığından `Year` boş.
- İzleme tarihi başına bir satır; ilk izleme normal, sonrakiler `Rewatch=true`. Tarihi olmayan film tarihsiz tek satır (izlendi sayılır, günlük girişi açılmaz).
- `Rating10`: Seelogd puanı (0–10, ondalıklı olabilir) **tam sayıya yuvarlanıp 1–10'a** sıkıştırılır (7,5 → 8).
- **1 MB dosya sınırı** (Letterboxd): 900 KB'ta parçalanır, her parçada başlık satırı var (`letterboxd-watched-1.csv`, `-2.csv` …). Parçalar sırayla yüklenir.
- Tırnak içindeki tırnak RFC 4180'e göre ikilenir (`""`). Letterboxd'ın tırnak kaçışı belgede "escaped" diye geçiyor, biçimi ayrıntılı vermiyor; başlıklarda tırnak çok nadir.

### library.csv

`list, type, tmdb_id, title, rating, added, watched_dates, episodes_watched, genres, minutes`. Başlığı `=`, `+`, `-`, `@` ile başlayan metin hücreleri
başına kesme işareti alır (**CSV/formül enjeksiyonu** koruması — Excel'de hücre formül sayılmasın). Bu koruma YALNIZ `library.csv`'de; Letterboxd dosyalarında başlık
olduğu gibi kalır (içe aktarıcıya bozuk başlık gitmesin).

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/libraryExport.js` | **Saf çekirdek**: anlık görüntü (`buildLibrarySnapshot`), CSV hücre/satır/parça, Letterboxd ve library.csv üreticileri, ZIP içerik listesi, dosya adı. RN/Firebase importu yok. |
| `services/libraryExportFiles.js` | Platform G/Ç: önbellek klasörüne yaz → `expo-sharing`. JSZip (`uint8array`) + `File.write(Uint8Array)`. Hata sözleşmesi `settingsBackupFiles` ile aynı (fırlatmaz, `{ok:false,error}`). |
| `screens/tabs/settings/LibraryExportScreen.js` | Ekran: özet sayıları, iki dışa aktarma satırı, notlar. |
| `screens/tabs/settings/libraryExportCopy.js` | tr/en/es metinler + README metni + hata kodu→metin. `copyTablesSpanish.test.js` dengeyi bekçiler. |
| `screens/tabs/SettingsScreen.js`, `App.js` | Satır ve `LibraryExportScreen` rotası. |

## Kararlar

- **Veri bellekten**: `ListStatusContext` (`combinedLists`, `activityIndex.ratings`) — ek Firestore okuması yok. Puanlar `activityIndex.ratings`'tan geliyor (`Users/{uid}/myRatings` taranmaz).
- **Listeler gelmeden dışa aktarılmaz** (`loading` ya da `!watchedTvLoaded`): diziler alt koleksiyondan geç gelir; erken basış EKSİK dosya üretirdi. Düğmeler "yükleniyor" notuyla kapalı.
- **Boş kütüphane** dışa aktarılmaz (açıklama gösterilir; servis de `empty` döner).
- **Aynı anda tek işlem**: çalışırken ikinci dokunuş yok sayılır.
- **Dosya önbellekte kalıcı değil**: paylaşım sayfası kopyayı alır; aynı adlı eski dosya silinip yazılır.
- Ayar yedeğinden (`BackupSettingsScreen`) **ayrı**: o yalnız tercihleri kapsar. "Verileri indir" (çevrimdışı önbellek) de dışa aktarma değildir.

## Bilerek yapılmadı

- **Gönderiler ve gönderi yorumları, notlar, hatırlatıcılar, sohbetler, hesap bilgileri** dışa aktarılmaz (ekranda yazar). Film/dizi yorumları 13 Kas'tan beri DAHİL (aşağıda). Notlar ve hatırlatıcılar yerel-öncelikli kaynak; ayrı bir "Notlarımı dışa aktar" olabilir.
- **IMDb biçimi** (ratings.csv) ve **Trakt**: istek olursa çekirdeğe yeni üretici eklenir.
- **Yayın yılı**: liste öğelerinde yok; TMDB'den çekmek her film için istek demek.
- **Yasal sayfalar**: `website/privacy.html` (satır ~463 ve İngilizce ~983) hâlâ "hesap verisini tek dokunuşla dışa aktaran bir ekran yok" diyor. Bu özellik sürüme girince **yanlış kalır**; metin güncellenmeli ve hosting deploy edilmeli (yapılmadı — hukuki beyan, karar kullanıcıda).

## Cihazda henüz görülmedi

Jest temiz (tam paket 260 dosya): çekirdek (anlık görüntü, tekrar izleme, dizi bölümleri, CSV kaçışı + formül koruması, parçalama ve 80 bin satırlık 1 MB sınırı, Letterboxd sütunları),
servis (gerçek JSZip ile ZIP içeriği, hata kodları), ekran (durumlar, çift basış, dil). **Görülmeyenler:** `expo-file-system`'in `File.write(Uint8Array)` çağrısı gerçek
cihazda (tipi doğrulandı, çalıştırılmadı), iOS/Android paylaşım sayfasında `public.zip-archive` / `application/zip`, ZIP'in Dosyalar uygulamasında açılması, Excel'de Türkçe karakterler
(BOM), Letterboxd'ın gerçek yüklemede `tmdbID` ile eşleşmesi ve dosya sınırı, uzun sürede binlerce bölümlü kütüphanede JSON boyutu/süresi, ekranın gerçek görünümü.

---

# İçe aktarma (geri yükleme) + yorumlar — 13 Kas 2026

Ayarlar → Veri ve depolama → **Kütüphaneni İçe Aktar** (`LibraryImportScreen`). Kütüphaneni Dışa Aktar'ın **Tam yedek (JSON)**
dosyasını geri yükler. ZIP/CSV seçilirse "JSON'u seç" der (Letterboxd/IMDb CSV'si için mevcut İçe Aktar modalı var).

## Şema v2 (`EXPORT_VERSION = 2`)

v1 dosyaları da okunur. v2'de eklenenler: her kayıtta `poster` (TMDB yolu, `/^\/[\w.-]{1,120}$/`), dizide `seasonCount`/`episodeCount`,
bölümde `minutes`/`name`, üst düzeyde `comments[]` = `{id, type, tmdbId, title, poster, text, isSpoiler, createdAt, parentId, scope}`
ve `counts.comments`. ZIP'e `comments.csv` girer (yorum varsa).

### 14 Kas 2026 düzeltmesi: süre ve dizi bilgisi kaybı (sürüm hâlâ 2, alanlar ek)

Dışa → içe dönüşünde dizi toplam süresi 0'a düşüyordu. Nedenler ve çözüm:
- **Bölümsüz "tüm dizi izlendi" olayları** (Letterboxd/IMDb aktarımı, eski kayıt) bölüm listesinde yoktu; dosyaya ne tarihi ne
  süresi yazılıyordu. Artık dizide `showWatchedDates` ve `episodeMinutes` var; `importMerge.mergeBackupTv` bölüm geçmişini
  (`mergeRestoredTv`) ve bu tarihleri (`mergeImportedTv`) birlikte kurar. Yazıcı (`importWriter`) bu tek yardımcıyı kullanır.
- **Liste öğeleri** (izleme listesi, favori, özel liste) süre/boyut taşımıyordu; geri yüklemede dizi "1 sezon · 1 bölüm" yazılıyordu.
  Artık filmde `minutes`, dizide `episodeMinutes`/`seasonCount`/`episodeCount`/`totalMinutes`; bilinmeyen sayı uydurulmaz (`null`).
- **Geri yükleme ekranı** bitince (ya da yarıda kalınca) `refreshList("all")` çağırır; eskiden cihaz önbelleği eski kalıyordu.
- **Eski dosya ve onarım:** dosyada süre yoksa bölümsüz izlenmiş dizinin bölüm süresi TMDB'den alınır (ad/afiş dosyadan; ağ
  hatası kaydı düşürmez). Önceki aktarımın 0 dk yazdığı "tüm dizi" olayları aynı dosya yeniden aktarılınca onarılır
  (`mergeImportedTv` → `repairedMinutes`; izleme sayısı çoğalmaz).
- Tam dönüş testi: `__tests__/libraryRoundTrip.test.js` (dışa → dosya → içe → profil istatistiği birebir).
- Bilinen, AYRI tutarsızlık (düzeltilmedi): bölüm iskeleti olan dizide "tüm dizi" olaylarının süresi profilde sayılmıyor
  (Letterboxd'dan gelmiş diziye sonradan bölüm işaretlenince o süre profilden düşer). Dönüş bunu korur, değiştirmez.

## Akış ve dosyalar

| Dosya | Görev |
| --- | --- |
| `utils/libraryImport.js` | SAF: `parseLibraryBackup` (BOM, 40 MB sınırı, sürüm, tür/uzunluk/tarih denetimi, bozuk kaydı atla+say), `backupCounts`, `buildImportPlan` (seçili bölümler → importRunner öğeleri + üst düzey yorumlar), `planStages`/`reduceStages` (ekran aşamaları). |
| `services/libraryImportService.js` | Dosya seçici (`expo-document-picker` + `File.text()`), `createLibraryRestoreJob`, `runLibraryRestore` (importRunner eşzamanlılık 6 → yorum aşaması; sürdürülebilir), `restoreSummary`. |
| `services/libraryCommentsIO.js` | `readMyTitleComments` (myComments aynası + özgün belge: spoiler, tarih, kapsam), `restoreTitleComments` (özgün kimlikle, transaction, yineleme koruması). |
| `services/import/tmdbResolver.js` | `tmdbId` varsa KESİN eşleşme; ad+afiş dosyadaysa ağa çıkmaz, yoksa TMDB detayı, 404'te dosyadaki bilgi. |
| `services/import/importMerge.js` | `mergeRestoredTv`: bölüm bölüm iskelet + gün başına tek `restore_tv_{id}_{tarih}` olayı (kapsam `episode`). |
| `services/import/importWriter.js` | Dizi geri yüklemesi `mergeRestoredTv` ile; özel liste ad çakışması öneki "Seelogd - ". |
| `screens/tabs/settings/LibraryImportScreen.js`, `libraryImportCopy.js` (6 dil) | Giriş → önizleme (bölüm seç) → aşamalar → özet / kesildi (sürdür, baştan). |
| `components/libraryImport/RestoreVisuals.js` | Küre (nabız / dönen yay / onay), aşama listesi + çubuk, bölüm satırı (yay basışı, kademeli giriş), afiş yelpazesi, sayan özet kutuları. Hareket azaltmaya uyar; ilk değerler görünür. |

## Kurallar (birleştirme)

- **Hiçbir şey silinmez ya da ezilmez.** İzleme tarihleri birleşir (aynı gün tekrar eklenmez), mevcut puan korunur, dizi bölüm bilgisi yalnız eksikse dolar.
- **Aynı dosya iki kez aktarılınca çoğalmaz**: dizi olay kimliği tarihe bağlı, yorumlar özgün kimlikle yazılır (`existing` sayılır), aynı yapıma aynı metin ikinci kez yazılmaz.
- **Puan** yapımın ilk kaydına (izlenen > izleme listesi > favori) bir kez eklenir; kütüphanede karşılığı olmayan puan yazılmaz ve özette söylenir.
- **Yanıtlar geri yüklenmez** (başkasının yorumuna bağlı; o yorum silinmiş olabilir); önizlemede yazar.
- **Yorum** yazımı kurallara uyar (`userId == auth.uid`), `restored: true` ve özgün tarih taşır; `mediaCommentCount` yalnız ayna yeniyse artar.
- Ekrandan çıkılırsa iş durur; yazılanlar kalır. Ağ kesilirse "Devam et" aynı işi kaldığı yerden sürdürür.
- Bitişte `rebuildImportedProfileStats` istatistikleri alt koleksiyonlardan yeniden kurar.

## Testler

`libraryImport.test.js` (doğrulama, kötü dosyalar, uçtan uca dönüş, plan, `mergeRestoredTv` tekrar aktarım, kimlikle eşleşme, 6 dil şekli),
`libraryImportScreen.test.js` (akış, seçim, sürdür), `restoreVisuals.render.test.js`, güncellenen `libraryExport*.test.js`.

## Açık / görülmedi

- Cihazda görülmedi: dosya seçici + `File.text()` büyük dosyada, animasyonların gerçek görünümü, binlerce kayıtta süre.
- `website/privacy.html` yorumların dışa aktarıldığını ve geri yüklemeyi henüz anmıyor (karar kullanıcıda; deploy edilmedi).
- Gönderi yorumları (kind `post`) kapsam dışı.

## Letterboxd / ortak kayıt hattı (14 Kas 2026)

- **Yanlış dizi eşleşmesi:** Letterboxd yalnız film tutar ama başlık araması film bulamayınca diziye düşüyor, benzer adlı dizinin TAMAMINI "izlendi" yazıyordu (dizi süresi yüzlerce saat şişebiliyordu). Artık tür ipucu yokken diziye düşüş yalnız ad + yıl birebir tutarsa (puan 7, `STRONG_MATCH_SCORE`), yılsız dizi araması yapılmaz (`tmdbResolver.resolveByTitleYear`). Eski aktarımın yanlış yazdığı diziler `importedFrom: "letterboxd"` taşır; Ayarlar → İçe aktar → Letterboxd verisini sıfırla ile temizlenip yeniden aktarılabilir.
- **Parçalı kayıt:** `writeImportedItems` öğe başına transaction yerine `ITEM_CHUNK_SIZE` (12) öğelik parçalar yazar; kök belge parça başına bir kez, sayaçlar parçada toplanıp tek `increment`. Aynı medya bir parçada iki kez bulunmaz. Parça kalıcı hatayla düşerse öğeler tek tek yeniden denenir. Durdurma parça sınırında etkili olur. Letterboxd ve yedek geri yükleme aynı hattı kullanır.
- **Eşleştirme eşzamanlılığı** 5 → 8 (429'da Retry-After ile geri çekilme zaten var).
- **İnceleme HTML'i** (`<i>`, `<br />`, `<p>` …) düz metne iner, satır sonları korunur (`cleanLetterboxdReview`); tekil CSV ayrıştırıcı da aynı puan/inceleme yardımcılarını kullanır.
- Test: `__tests__/letterboxdImportPipeline.test.js` (paket → TMDB → parçalı yazım → profil özeti; yeniden aktarım çoğaltmaz; parçada tek hatalı öğe).
