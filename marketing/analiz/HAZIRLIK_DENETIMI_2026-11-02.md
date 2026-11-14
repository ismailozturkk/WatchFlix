# Pazarlama hazırlık denetimi

Tarih: **2 Kasım 2026**

Bu rapor o günkü durumu yazar, güncel iş takibi [DURUM.md](../DURUM.md) içindedir.

## Sonuç

Organik paylaşıma başlanabilir. **Ücretli reklam ve büyük içerik üreticisiyle iş birliği için erken.** Önce 1-4 numaralı maddeler çözülmeli.

## Bulgular

| # | Önem | Bulgu | Kanıt | Öneri | Sorumlu |
|---|---|---|---|---|---|
| 1 | Yüksek | TMDB ticari lisansı netleşmedi | `docs/guvenlik/GELISTIRME_REHBERI_BEN.md`; maliyet analizi | Yayın ve reklam bütçesinden önce TMDB'ye yaz. Olası ücret ($149/ay iddiası) resmî olarak doğrulanmadı | Kullanıcı |
| 2 | Yüksek | Bekleme sayacı gerçek değil | `website/site-config.js:30`, `baseCount: 1071` | Sıfırla | Karar kullanıcıda |
| 3 | Yüksek | Pazarlanan özellikler Free'de kapalı veya dar | Oyun 0, CineSwipe 0, arkadaş 2 | Metinlerde açıkça söyle; küçük ücretsiz oyun denemesini değerlendir | Karar kullanıcıda |
| 4 | Yüksek | Site ziyareti ölçülmüyor | `website/` içinde analitik kodu bulunamadı; kayıtlar `source: landing` yazıyor | Gizlilik uyumlu ölçüm ve kanal bilgisi ekle; gizlilik metni ve kural kontrolü gerekir | Birlikte |
| 5 | Orta | "Seelogd" marka taraması görünmüyor | Yol haritası ve görev planında işaretlenmemiş | TÜRKPATENT, EUIPO, USPTO ve mağaza taraması | Kullanıcı |
| 6 | Orta | iOS'ta satın alma paketleri görünmüyordu | `docs/DEVAM.md` | App Store Connect'te tamamla; iOS testçilerine söyle | Kullanıcı |
| 7 | Orta | İngilizce görsellerde Türkçe tür adları | `post-01, 02, 05, 06, 11` | Tür çevirisi uygulamada doğrulanınca ekranları yeniden çek | Birlikte |
| 8 | Orta | TikTok ve story için 9:16 içerik yok | Yalnız `story-01` | 9:16 şablon ekle ve ekran kaydı çek | Birlikte |
| 9 | Orta | Reklam ölçüm SDK'sı yok | `package.json` içinde Meta, TikTok, AppsFlyer, Adjust yok | Önce Google ve Apple kampanyalarını kullan; SDK yeni build ister | Reklam aşamasında |
| 10 | Orta | Davet akışı eksik olabilir | Notlara göre davet bağlantısı yalnız seelogd.com, kayıtta kod alanı yok | Yayın öncesi yeniden kontrol | Birlikte |
| 11 | Orta | Paylaşım kartlarında indirme adresi belirsiz | `SceneResultShareCard` içinde filigran var; Wrapped doğrulanmadı | Wrapped kampanyasından önce denetle | Birlikte |
| 12 | Düşük | Sitede Max için "No limits" yazıyor | `website/home-i18n.js`, `planMaxTag` | "Highest limits" benzeri ifade | Birlikte |
| 13 | Düşük | Test profili görselde görünüyor | `post-07`: "Üç Kişi", `@uckisi` | Yeniden çekimde nötr profil kullan | Birlikte |
| 14 | Düşük | `marketing/` EAS arşivine dahil olabilir | Klasör 50 MB, `.easignore` içinde yok | `.easignore` dosyasına ekle | Birlikte |
| 15 | Düşük | Klasör git'e eklenmemiş | `git status`: `?? marketing/` | Yedek için commit kararı ver | Kullanıcı |

## Kapasite

Büyük tek seferlik trafikten önce kontrol edilecekler (`docs/DEVAM.md`):

- Cloud Run bölge kotası toplam 20 vCPU
- App Check zorunlu olunca Play Integrity 10.000/gün kotası; yaklaşık 3-4 bin günlük kullanıcıda dolabilir
- Yük testi henüz yapılmadı

## Hukuk ve platform kuralları

Bu bölüm hukuki görüş değildir.

- Telifli afiş ve sahneler ücretli reklamda kullanılmaz.
- Ücretli veya karşılıklı iş birlikleri reklam olarak işaretlenir.
- Sahte hesap, satın alınmış takipçi ve teşvikli mağaza yorumu kullanılmaz.
- Rakip adları mağaza metninde kullanılmaz.
