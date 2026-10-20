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

- **Yorumlar, gönderiler, notlar, hatırlatıcılar, sohbetler, hesap bilgileri** dışa aktarılmaz (ekranda yazar). Notlar ve hatırlatıcılar yerel-öncelikli kaynak; ayrı bir "Notlarımı dışa aktar" olabilir.
- **İçe aktarma (Seelogd JSON'u geri yükleme)**: JSON şeması sürümlü (`version: 1`), ama geri yükleme yok. Başka cihaza taşıma için hesap zaten bulutta.
- **IMDb biçimi** (ratings.csv) ve **Trakt**: istek olursa çekirdeğe yeni üretici eklenir.
- **Yayın yılı**: liste öğelerinde yok; TMDB'den çekmek her film için istek demek.
- **Yasal sayfalar**: `website/privacy.html` (satır ~463 ve İngilizce ~983) hâlâ "hesap verisini tek dokunuşla dışa aktaran bir ekran yok" diyor. Bu özellik sürüme girince **yanlış kalır**; metin güncellenmeli ve hosting deploy edilmeli (yapılmadı — hukuki beyan, karar kullanıcıda).

## Cihazda henüz görülmedi

Jest temiz (tam paket 260 dosya): çekirdek (anlık görüntü, tekrar izleme, dizi bölümleri, CSV kaçışı + formül koruması, parçalama ve 80 bin satırlık 1 MB sınırı, Letterboxd sütunları),
servis (gerçek JSZip ile ZIP içeriği, hata kodları), ekran (durumlar, çift basış, dil). **Görülmeyenler:** `expo-file-system`'in `File.write(Uint8Array)` çağrısı gerçek
cihazda (tipi doğrulandı, çalıştırılmadı), iOS/Android paylaşım sayfasında `public.zip-archive` / `application/zip`, ZIP'in Dosyalar uygulamasında açılması, Excel'de Türkçe karakterler
(BOM), Letterboxd'ın gerçek yüklemede `tmdbID` ile eşleşmesi ve dosya sınırı, uzun sürede binlerce bölümlü kütüphanede JSON boyutu/süresi, ekranın gerçek görünümü.
