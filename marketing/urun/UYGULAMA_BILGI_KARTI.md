# Uygulama bilgi kartı

Son güncelleme: **2 Kasım 2026**

Kaynaklar: `utils/premiumFeatures.js`, `store/play/`, `docs/kurulum/REVENUECAT_KURULUM.md`, `website/`.
Plan veya özellik değişirse **önce kod** esas alınır, sonra bu dosya güncellenir.

## Temel bilgiler

| | |
|---|---|
| Ad | seelogd (mağaza adı: `seelogd: Movie & TV Tracker`) |
| Tek cümle | Film ve dizilerini takip et, ne izleyeceğini bul, arkadaşlarınla paylaş ve oyna. |
| İngilizce slogan | Your movie & TV life, all in one place. |
| Platform | Android ve iOS |
| Diller | Türkçe, English, Español, Português (Brasil), Deutsch |
| Site | https://seelogd.com |
| Beta formu | https://seelogd.com/#beta |
| Gizlilik | https://seelogd.com/privacy.html |
| Veri kaynağı | TMDB; yayın platformu verisi JustWatch |
| Sürüm | 1.5.0, mağazalarda test aşamasında |

Uygulama film veya dizi barındırmaz, yayınlamaz.

## Özellikler

**Takip:** Film ve bölüm bazında dizi takibi, puan, yorum, özel notlar, izleme listesi, favoriler, özel ve ortak listeler, hatırlatıcılar, takvim, ana ekran widget'ları.

**Keşif:** Trendler, en iyiler, türler, yaklaşanlar, Dünya Turu, Oscar ve Emmy kazananları, filtreler, "nerede izlenir", platforma gelince bildirim, CineMatch AI önerileri.

**İstatistik:** Toplam izleme süresi, tür dağılımı, günlük geçmiş, seri, 158 rozet, yıllık Wrapped.

**Sosyal:** Arkadaşlar, paylaşımlar, birebir ve grup sohbeti, anketler, zevk uyumu, Film Kulübü, story kartları, sosyal hesap bağlantıları.

**Oyun:** Sahne tahmini, Poster Bulmaca, Bulanık Afiş, "Önce hangisi?", Günün Karesi, Film Zinciri, Sinema Bingosu, Meydan Okumalar, Günün Sorusu, Haftalık Lig, CineSwipe, aylık turnuva, Top 100.

**Veri taşıma:** Letterboxd ve IMDb'den içe aktarma; JSON veya CSV olarak dışa aktarma. TV Time içe aktarma **yok**.

**Kişiselleştirme:** Temalar, yazı tipleri, uygulama simgeleri, ambiyans arka planları.

## Planlar

Değerler `utils/premiumFeatures.js` ve `utils/premium.js` kaynaklıdır.

| Özellik | Free | Premium | Max |
|---|---|---|---|
| İzlenen, izleme listesi, favori | Sınırsız | Sınırsız | Sınırsız |
| CineMatch AI (mağaza metni) | 3/gün, 30/ay | 20/gün, 300/ay | 50/gün, 900/ay |
| Arkadaş | 2 | 150 | Sınırsız |
| Grup sohbeti kurma | 1 | 10 | Sınırsız |
| Özel liste | 1 | 25 | Sınırsız |
| Ortak liste kurma | 2 | 10 | Sınırsız |
| Not / yapılacak listesi | 5 | 50 | Sınırsız |
| Film ve dizi notu | 20 | 200 | Sınırsız |
| Film hatırlatıcısı | 10 | 50 | Sınırsız |
| Dizi hatırlatıcısı | 20 | 100 | Sınırsız |
| Platform bildirimi | 10 başlık | 100 başlık | 100 başlık |
| Oyunlar | Kapalı | 20/gün | Sınırsız |
| CineSwipe oda | Kapalı | 10/gün | Sınırsız |
| CineSwipe kart | Kapalı | 300/gün | Sınırsız |
| Top 100 oy hakkı | Yok | 10 | 20 |
| Turnuva | İzler | Oy verir | Oy verir |
| Wrapped arşivi | Bu yıl | Son 5 yıl | Tüm yıllar |
| Film Kulübü kurma, Film Zinciri, Günün Karesi | Kapalı | Açık | Açık |
| Özel tema, tüm yazı tipleri, simge, ambiyans | Kapalı | Açık | Açık |

Herkese açık: Günün Sorusu ve Haftalık Lig (mağaza metnine göre). Sinema Bingosu ve Meydan Okumalar için plan durumu bu dosyada doğrulanmadı; Free'de açık denmeden önce kontrol edilmeli.

## Fiyatlar

Mağaza fiyatı esastır; yerel para birimi ve kampanya değişebilir.

| Plan | Türkiye | Global (ABD) |
|---|---|---|
| Premium aylık | ₺59,99 | $1.99 |
| Premium yıllık | ₺449,99 | $14.99 |
| Max aylık | ₺149,99 | $4.99 |
| Max yıllık | ₺1.099,99 | $34.99 |

## Söylenebilir

- Ücretsiz başlanır; izlenenler, izleme listesi ve favoriler sınırsızdır.
- Letterboxd ve IMDb geçmişi içe aktarılır.
- Reklam gösterilmez, veri satılmaz (gizlilik politikasında böyle yazıyor; AdMob eklenirse değişmeli).
- 5 dilde kullanılabilir.
- Android ve iOS için beta kaydı açıktır.

## Söylenemez

| İfade | Neden |
|---|---|
| "Free games", "play for free" | Oyunlar Free planda kapalı |
| "Unlimited lists" (Free için) | Free planda 1 özel liste var |
| "No limits" (Max için) | AI mesajı ve platform bildirimi sınırlı |
| "Most popular", "thousands of users", "#1" | Veri yok |
| "1,071 people are waiting" | Sayıya sabit değer ekleniyor |
| "Out now", "Download now" | Henüz herkese açık yayın yok |
| "Import from TV Time" | Özellik yok |
| "Best Letterboxd alternative" | Kanıtlanamaz, mağaza metninde rakip adı sorun çıkarabilir |
| "Official", "partnered with TMDB/Netflix" | Doğru değil |

## Metinde dikkat

- "Play with friends" denirse oyunların ücretli plan gerektirdiği de açıklamada belirtilir.
- Rakam içeren örnekler ("383 hours") test hesabı verisidir, kullanıcı başarısı gibi sunulmaz.
