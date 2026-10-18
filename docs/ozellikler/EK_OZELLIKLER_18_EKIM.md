# 18 Ekim ek işleri: harici puanlar, haftalık özet, bağlantıdan aç, oyuncu takvimi

`docs/planlama/GELISTIRME_ONERI_ADAYLARI_2026-10-17.md` 7, 8 ve 6'nın native gerektirmeyen kısmı + oyuncu takibinin takvim kaydı + OMDb güvenlik bulgusu.
**Hiçbiri cihazda ya da canlı sunucuda denenmedi.** İki tanesi (`getExternalRatings`, `weeklyReleaseDigest`) **deploy edilmedikçe çalışmaz** — aşağıdaki "Deploy" bölümüne bakın.

## 1. Harici puanlar (IMDb / Rotten Tomatoes / Metascore) + OMDb anahtarı güvenlik düzeltmesi

**Sorun:** OMDb API anahtarı `screens/tv/TvGraphDetailScreen.js` içinde düz metin gömülüydü (iki çağrı). Paketten herkes çıkarabilirdi.
**Çözüm:** anahtar istemciden **tamamen çıkarıldı**; `getExternalRatings` Cloud Function'ı (Secret `OMDB_API_KEY`) araya girdi.

| Dosya | Görev |
|---|---|
| `functions/externalRatings.js` (+ `.test.js`) | Saf: istek doğrulama (**yalnız** `tt…` IMDb kimliği + sezon 1–99; istemci anahtarla keyfi sorgu atamaz), OMDb URL'i, cevap ayrıştırma, TTL önbellek, kullanıcı başına sınırlayıcı. |
| `functions/index.js` → `getExternalRatings` | Oturum şart; önbellek (başlık 12 sa, sezon 24 sa); dakikada 60 çağrı/kullanıcı (örnek içi, caydırıcı — kesin kota değil); hata/kota → `{found:false}`. |
| `services/externalRatings.js` | Callable istemcisi; **asla fırlatmaz** (null); kesin sonuç oturumda önbelleklenir, geçici hata değil. |
| `utils/externalRatings.js` | Saf: `pickMainRating` (IMDb yoksa TMDB'ye düş), `mergeEpisodeRatings`, `formatImdbVotes`. |
| `screens/tv/TvGraphDetailScreen.js` | OMDb axios çağrıları kalktı; servis kullanılır. |
| `components/detail/ExternalRatingsRow.js` | **Yeni:** film/dizi detayında IMDb · Rotten Tomatoes · Metascore çipleri. Yalnız veri GELİNCE görünür (iskelet yok, "N/A" yok). `MovieDetail` / `TvShowsDetails` rating satırının altında. |

> ⚠️ **Eski anahtar sızmış sayılmalı.** Kod geçmişinde ve yayınlanmış sürümlerde duruyor. OMDb panelinden **yenisini üretip** `firebase functions:secrets:set OMDB_API_KEY` ile yükleyin; eskiyi iptal edin. Bunu yapmadan eski anahtar çalışmaya devam eder.
> Deploy edilmeden önceki sürümler (paketlenmiş eski istemci) eski gömülü anahtarı kullanmaya devam eder; yeni istemci function yokken TMDB puanına düşer (ekran bozulmaz, IMDb puanı görünmez).

## 2. Haftalık özet bildirimi ("Bu hafta çıkacaklar")

Her **Pazar 10:00 (Europe/Istanbul)**, izleme listesindeki yapımlardan önümüzdeki 7 günde çıkacakları tek bildirimde toplar. **Opt-in, varsayılan kapalı**
(Ayarlar > Bildirimler > "Haftalık özet"); genel bildirim anahtarı kapalıysa gönderilmez. Bildirime dokununca Takvim ekranı açılır.

| Dosya | Görev |
|---|---|
| `functions/weeklyDigest.js` (+ `.test.js`) | Saf: Istanbul gününe göre 7 günlük pencere, film/yeni bölüm/prömiyer ayrımı, tekilleştirme + sıralama, tr/en/es metin ("Pzt: A · Sal: B · Çar: C +2"). |
| `functions/index.js` → `weeklyReleaseDigest` | Zamanlanmış; kullanıcı başına en çok 60 başlık (en son eklenenler); aynı (tür\|id) TMDB'ye çalışma boyunca **tek** kez; ölü jeton temizliği. `TMDB_API_KEY` secret'ını ortak kullanır. |
| `context/AppSettingsContext.js`, `context/DeviceNotificationsContext.js` | `weeklyDigestEnabled` ayarı + `Users/{uid}.notificationSettings`e yansıtma + bildirim yönlendirmesi. |
| `screens/tabs/settings/ReminderNotificationsScreen.js`, `translations/*.json` | Anahtar satırı + metinler. |

**Kapsam dışı (bilerek):** takip edilen oyuncu/yönetmenler (yalnız cihazda, sunucu bilmiyor) ve hatırlatıcılar (kendi yerel bildirimleri var).
**Bilinmeyen:** Free/Premium ayrımı yok; kullanıcı başına 60 başlık sınırı teknik maliyet freni. Gönderim saatinin kullanıcının saat diliminde olması yok (herkese TR 10:00).

## 3. Bağlantıdan aç (başka uygulamadan paylaşım — native gerektirmeyen kısım)

Arama ekranında alana **IMDb / TMDB bağlantısı yapıştırınca** (ya da alan boşken **bağlantı simgesine** basınca panodakini okuyunca) ilgili film/dizinin detayı açılır
(ekle / izledim düğmeleri orada). IMDb kimliği TMDB'ye `/find` ile çevrilir (film → dizi → bölümün dizisi sırasıyla; 30 gün önbellek).

| Dosya | Görev |
|---|---|
| `utils/mediaLinks.js` | Saf: TMDB (`/movie|tv/<id>`, yerel önekli) ve IMDb (`/title/tt…`, mobil dahil) tanıma; metin içindeki bağlantı; 600 karakter üstü reddedilir. |
| `services/mediaLinkResolver.js` | IMDb → TMDB; fırlatmaz (null). `services/favoriteRecommendations.readTmdb` artık `query` seçeneği alır. |
| `screens/tabs/SearchScreen.js` | Yapıştırma yakalama + bağlantı simgesi. Pano **yalnız kullanıcı simgeye basınca** okunur (arka planda okuma yok — iOS'ta yapıştırma uyarısı çıkarırdı). |
| `utils/mediaLinkCopy.js` | tr/en/es. |

**Yapılmayan (native build ister):** başka uygulamanın **Paylaş menüsünden** Seelogd'a bağlantı göndermek (share-intent) ve **simge uzun basma kısayolları** (quick actions).
İkisi de yeni native modül + `app.json` eklentisi gerektirir; build alınamadığı/test edilemediği için körlemesine eklenmedi. Letterboxd / Netflix bağlantıları TMDB'ye çevrilemediği için tanınmaz.

## 4. Oyuncu takibi: yaklaşanı telefon takvimine ekle

`FollowedUpcomingRail` kartlarında posterin sağ altında takvim düğmesi (ekle / kaldır, "Geri Al" toast'ı mevcut `utils/phoneCalendar` akışından) ve başlıkta
"hepsini ekle" simgesi. Etkinlik anahtarı Seelogd **hatırlatıcılarıyla aynı** (`movie_<id>_<tarih>`, `tv_<id>_1_1_<tarih>`): aynı yapım iki yoldan eklenirse takvimde **çift etkinlik açılmaz**
("zaten eklendi" der). Dizi için `first_air_date` S1E1 sayılır. Takvim izni mevcut izin akışından (İzinlerim > Takvim) yönetilir.
Dosyalar: `utils/followedPeople.js` (`upcomingToCalendarItem`), `components/person/FollowedUpcomingRail.js`, `utils/followedPeopleCopy.js`.

## 5. Gizlilik sayfaları

`website/privacy.html` (tr+en) ve `website/delete-account.html` (tr+en) kütüphane dışa aktarmasına göre güncellendi: "dışa aktaran ekran yok" cümlesi yerine ekranın kapsamı ve **kapsam dışı** veriler
(yorum, gönderi, not, hatırlatıcı, sohbet, hesap bilgisi) yazıldı; sürüm **1.2 — 18 Ekim 2026**. **Hosting deploy edilmedikçe yayında görünmez.**
Not: bu oturumdaki yeni özellikler (OMDb proxy'si, haftalık özet) veri akışını değiştiriyor: OMDb'ye IMDb kimliği sunucudan gider (eskiden istemciden), haftalık özet mevcut izleme listesi verisini kullanır.
Gizlilik metninde OMDb ayrıca anılmıyor (eskiden de anılmıyordu); hukuki beyanı değiştirmeden bırakıldı — **gözden geçirilmeli**.

## Deploy (yapılmadı — onay gerekir)

```bash
# 1) Secret'lar
firebase functions:secrets:set OMDB_API_KEY        # YENİ anahtar (eskisi sızmış sayılır)
# TMDB_API_KEY zaten tanımlı (dailyStreamingAvailability ile ortak)

# 2) Yalnız yeni iki fonksiyon
firebase deploy --only functions:getExternalRatings,functions:weeklyReleaseDigest

# 3) Gizlilik sayfaları (isteğe bağlı, hosting)
firebase deploy --only hosting
```
Firestore kuralları **değişmedi** (yeni koleksiyon yok; `weeklyDigestEnabled` mevcut `notificationSettings` haritasına yazılıyor).
Cloud Scheduler API projede zaten açık (dailyStreamingAvailability çalışıyor).

## Cihazda / canlıda henüz görülmedi

Jest temiz (265 dosya) + `functions` node testleri temiz (36). Görülmeyenler: `getExternalRatings` canlı OMDb ile (Secret yok → `not-configured`), harici puan çiplerinin detayda yerleşimi, haftalık özet
bildiriminin gerçek jetonla ulaşması ve Takvim ekranına yönlendirmesi, Istanbul gün sınırında pencere (testle kilitli ama canlıda değil), arama alanında bağlantı simgesinin GlassField içinde görünümü ve
iOS pano davranışı, kart üstündeki takvim düğmesinin poster rozetleriyle çakışması.
