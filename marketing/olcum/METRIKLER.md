# Ölçüm

Son güncelleme: **7 Kasım 2026**

Şimdilik başarı **kayıt ve geri bildirim** ile ölçülür. Takipçi sayısı tek başına hedef değildir.

## Sayılar nereden okunur

| Sayı | Yer | Not |
|---|---|---|
| Beta kaydı | Firebase Console, `betaTesters` | Platform bilgisi var |
| Bekleme listesi | Firebase Console, `waitlist` | Sitedeki sayaç **kullanılmaz**: 1.071 ekleniyor |
| Bağlantı tıklaması | Instagram, TikTok, X istatistikleri | Kanal başına tek kaynak |
| Site ziyareti | `/admin` paneli, günlük toplam | `website/site-beacon.js` 4 Kas'ta yayına girdi; çerezsiz |
| Platform başına ziyaret | `/admin` → `refs` | Bağlantıda `?utm_source=` varsa platform adıyla ayrışır |
| Kurulum | Play Console, App Store Connect | Yayından sonra |
| Tutundurma | Firebase Analytics, mağaza panelleri | Yayından sonra |
| Abonelik | RevenueCat | Yayından sonra |

**Ziyarette** kanal bilgisi artık var: `site-beacon.js:64` ve `functions/siteStats.js:167` `utm_source`'u
yönlendirenin önüne alıp günlük `refs` haritasına yazıyor. **Kaydın kendisinde** hâlâ yok:
`betaTesters` ve `waitlist` kaynak alanı taşımıyor, o yüzden "bu kayıt TikTok'tan geldi" denemez;
ziyaret dağılımı ile kayıt artışı karşılaştırılarak tahmin yapılır.

Kullanılacak bağlantılar:

| Platform | Bağlantı |
|---|---|
| X | `https://seelogd.com/?utm_source=x#beta` |
| Instagram | `https://seelogd.com/?utm_source=instagram#beta` |
| Threads | `https://seelogd.com/?utm_source=threads#beta` |
| TikTok | `https://seelogd.com/?utm_source=tiktok#beta` |
| Reddit | `https://seelogd.com/?utm_source=reddit#beta` |

Kısa bağlantı (bit.ly vb.) kullanılmaz: `utm_source` kaybolur.

## Başlangıç değerleri

| Ölçüt | Değer | Tarih |
|---|---|---|
| Beta kaydı (Android) | Bilinmiyor | |
| Beta kaydı (iOS) | Bilinmiyor | |
| Bekleme listesi (gerçek) | Bilinmiyor | |

Bu değerler Firebase Console'dan alınıp yazılacak. E-posta adresleri bu klasöre yazılmaz; yalnız sayılar.

## Haftalık özet

| Hafta | Yeni beta | Yeni bekleme | Aktif testçi | Geri bildirim | Toplam erişim | Tıklama | En iyi içerik | Karar |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |

## Geri bildirim kaydı

| Tarih | Kanal | Geri bildirim | Kaç kez | Durum |
|---|---|---|---|---|
| | | | | |

## Eklenmesi önerilen ölçüm

1. ~~Sitede çerezsiz ziyaret ölçümü~~ — 4 Kas'ta eklendi (`site-beacon.js`).
2. ~~Bağlantı başına kaynak~~ — destekleniyor; yapılacak olan bağlantıları `?utm_source=` ile kullanmak.
3. Kaynağın `betaTesters` ve `waitlist` kaydına yazılması. Firestore kuralları belirli alanlara izin verdiği için kural ve gizlilik metni de güncellenmeli. **Hâlâ açık ve en değerli eksik:** bu olmadan kayıt, kanala bağlanamıyor.
4. Gönderi bazında ayrım gerekiyorsa günlük ek: `utm_source=tiktok-d3`.
