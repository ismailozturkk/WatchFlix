# Whatchify — Eklenebilecek Özellikler (Araştırma Raporu)

> Tarih: 2026-07-16
> Kapsam: Kod tabanı analizi + sektör araştırması (Letterboxd, Trakt, Simkl, Serializd, TV Time, JustWatch, Teleparty ve 2026 trendleri)

## Konumlandırma (özet tespit)

Whatchify sosyal + oyunlaştırma tarafında rakiplerin **çok önünde**: story, wrapped, grup sohbet,
turnuva, sahne tahmin oyunu, pet, başarımlar — bunların hiçbiri Letterboxd/Trakt/Simkl'de yok.
Buna karşılık **çekirdek "izleme takibi" faydası** ve **elde tutma kancaları** tarafında rakiplerin
standart hâline gelmiş bazı şeyler eksik.

En net araştırma bulgusu: takip uygulamalarını **terk etme sebebi #1 = manuel loglama sürtünmesi**;
en çok istenen şeyler ise **otomatik takip, veri taşınabilirliği, streaming uygunluk bildirimleri ve widget'lar**.

## Zaten mevcut olanlar (tekrar önerilmedi)

AI öneri (CineMatch Pro — `aiCineService`, `geminiService`), sağlayıcı-farkında keşif rail'i
(`discoveryPersonalization`, `DiscoveryMediaRail`), gerçek zamanlı sohbet (`chatRtdb`, `presenceService`),
story, wrapped, oyun, turnuva, pet, başarımlar, listeler/paylaşılan listeler, notlar, hatırlatıcılar,
istatistikler, takvim, push bildirimleri (FCM + Cloud Functions), temalar, çoklu dil, onboarding.

---

## Öncelikli Öneriler (en yüksek etki → düşük)

### 1. Sürtünmesiz izleme takibi + birleşik "Sırada Ne Var" kuyruğu ⭐
- **Tek "Up Next" ekranı:** Takip edilen tüm dizilerin bir sonraki izlenmemiş bölümü, yayın tarihine göre
  sıralı, **tek dokunuşla "izledim"**. `OnGoingSeries` + `CalendarContext` altyapısı mevcut.
- **Hızlı toplu işaretleme:** "1. sezonun tamamını izledim", "buraya kadar izledim".
- İleri: Trakt hesabı bağlama (import + sync).

### 2. Streaming uygunluk bildirimleri *(mevcut altyapıyla düşük efor)*
- "Watchlist'indeki **X artık Netflix'te**" push'u (seçili servisler + bölge).
- Watchlist'i **servise göre filtreleme**.
- Parçalar hazır: `MovieProvders`, `TvShowsProvders`, FCM/Cloud Functions.

### 3. Veri taşınabilirliği: içe/dışa aktarma *(kullanıcı kazanımı için kritik)*
- **İçe aktarma:** Letterboxd CSV, IMDb CSV, Trakt/Simkl.
- **Dışa aktarma:** CSV/JSON ("verim kilitli değil" güveni).

### 4. Ana ekran / kilit ekranı widget'ları *(elde tutma kancası)*
- **Durum (2026-07-16):** Android "Yaklaşanlar" OS widget'ı **zaten mevcut ve bağlı** —
  `reminderWidgetService.js` → native `ReminderWidgetModule` → `ReminderWidgetProvider` (ana ekranda
  başlık + sayaç + ilk 2 yaklaşan film/bölüm, geri sayımla; tıklayınca `watchify://reminders`).
  `ProfileRemindersContext` canlı besliyor.
- **Eksikler:** (a) Widget'ın yeni native dosyaları git'e eklenmemiş (ignore+untracked) → temiz
  checkout/CI derlenmez; commit tutarlı hâle getirilmeli. (b) iOS widget'ı yok (WidgetKit gerekir).
- Olası genişlemeler: watchlist widget'ı, "bu akşam ne izlesem" widget'ı, kilit ekranı geri sayımı.

### 5. Watch party / "birlikte izleme odaları" *(sosyal gücün uzantısı)*
- Planlı birlikte izleme: oda + uygulama içi **canlı sohbet + reaksiyon + bitişte ortak puanlama**.
- `chatRtdb`, `presenceService` altyapısı bunun büyük kısmı.

### 6. Mevcut AI'yı "bu akşam ne izlesem?" deneyimine dönüştürme *(2026'nın en büyük trendi)*
- CineMatch'e **bağlam/ruh hali** ekle: süre, kiminle, ruh hali, hangi servis.
- İkincil: **Swipe ile keşif** (`SwipeCard`/`SwipeView` hazır).

### 7. Zengin sosyal aktivite feed'i + öneri gönderme *(farklılaşma)*
- Letterboxd tarzı arkadaş aktivite akışı (`activityService`).
- Arkadaşa öneri gönder → bildirim + watchlist'e düşer.
- Spoiler-korumalı bölüm/sezon tartışması.

### 8. İçerik kapsamı & monetizasyon *(ileri aşama)*
- Anime'yi birinci sınıf yapma (Simkl büyüme motoru) veya cross-media.
- **VIP katmanı:** sınırsız liste, gelişmiş istatistik, widget temaları, AI kotası, reklamsız.

---

## Özet tablo

| Özellik | Neden (araştırma bulgusu) | Sizdeki durum | Efor |
|---|---|---|---|
| "Up Next" bölüm kuyruğu + tek dokunuş izledim | Terk sebebi #1 manuel loglama | Parçalar var | Orta |
| Streaming uygunluk bildirimi + servise göre filtre | En çok istenen 3 özellikten biri | Provider + push hazır | Düşük |
| Import (Letterboxd/IMDb/Trakt) + CSV export | Kullanıcı kazanımı & veri güveni | Yok | Orta |
| OS widget (bölüm geri sayımı) | TV tracker'larda en sevilen | Android var (commit'siz); iOS yok | Düşük (commit) / Yüksek (iOS) |
| Watch party / birlikte izleme odası | Sosyal farklılaşma | Realtime chat hazır | Orta-Yüksek |
| AI'ya mood/bağlam (süre, kiminle, servis) | 2026'nın #1 keşif trendi | CineMatch temeli hazır | Düşük |
| Arkadaş aktivite feed'i + öneri gönderme | Letterboxd'un yapışkanlığı | activityService var | Orta |

## Eğer 3 tanesini seçseydim (ilk sprint)

1. **Streaming uygunluk bildirimleri** — altyapı hazır, çok istenen, düşük efor.
2. **AI'ya mood/bağlam parametreleri** — trendin tam merkezi, düşük efor.
3. **"Up Next" birleşik bölüm kuyruğu** — günlük açılma sebebi (elde tutma motoru).

Sonraki dalga: import/export (büyüme) + OS widget (elde tutma) + watch party (farklılaşma).

> Fizibilite notu: Gerçek "scrobbling" (Netflix'ten otomatik okuma) mobilde pratik değil. Widget ve
> watch party Expo dev-client ile yapılabilir ama native config plugin / geliştirme build'i gerektirir.

## Kaynaklar

- TasteRay — Best Movie Watchlist Apps 2026: https://www.tasteray.com/review/best-movie-watchlist-apps
- Achriom — Best TV Tracking Apps 2026: https://www.achriom.com/blog/best-tv-tracking-apps/
- Achriom — Best Trakt Alternatives: https://www.achriom.com/blog/best-trakt-alternatives/
- Moviebase — TV Time Alternatives: https://moviebase.app/resources/tv-time-alternatives
- Trakt Forums — Streaming Scrobbler: https://forums.trakt.tv/t/automatically-sync-your-streaming-services/34947
- TasteRay — Mood-based AI Recommendations: https://www.tasteray.com/articles/movie-ai-recommendations
- Teleparty: https://www.teleparty.com/
- Up Next — TV Show Tracker: https://apps.apple.com/us/app/up-next-tv-show-tracker/id6786803491
- Cineswipe — Best Movie Discovery App 2026: https://blog.cineswipe.app/blog/best-movie-discovery-app-in-2026-complete-guide
