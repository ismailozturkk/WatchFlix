# Reklam planı

Son güncelleme: **2 Kasım 2026**

**Durum: Başlamadı. Şartlar sağlanmadan para harcanmayacak.**

## Başlama şartları

- [ ] Uygulama iki mağazada herkese açık
- [ ] Satın alma iki platformda çalışıyor
- [ ] TMDB ticari lisans durumu net
- [ ] D1 > %35, D7 > %15
- [ ] Crash-free > %99
- [ ] Kurulum ve abonelik olayları doğrulandı
- [ ] Sitede ve uygulamada kaynak ölçümü var
- [ ] Reklamda kullanılabilir görsel hazır

## Sıra

| Sıra | Kanal | Neden | Not |
|---|---|---|---|
| 1 | Google App Campaigns | Firebase Analytics zaten kurulu | Hedef: kurulum, sonra uygulama içi olay |
| 2 | Apple Ads | Arama niyeti yüksek | Yalnız kendi marka ve kategori sözcükleri |
| 3 | Instagram öne çıkarma | Basit test | Mağaza öncesi yalnız siteye trafik; görsel kurallarına uy |
| 4 | Meta veya TikTok uygulama kampanyası | Geniş kitle | Doğru ölçüm için SDK ve yeni build gerekebilir |

## İlk test (öneri)

| | |
|---|---|
| Süre | 14 gün |
| Toplam | En fazla $200-300 |
| Pazar | Tek ülke |
| Kreatif | 2-3 video veya görsel |
| Karar | Abone başına maliyet ve D7 |

Bütçe öneridir, kullanıcı onayı olmadan harcanmaz.

## Beklenen maliyet

Güvenilir güncel Türkiye verisi bulunamadı. Yol haritasındaki $0,10-0,30 kurulum maliyeti doğrulanmamış tahmindir. Küçük test gerçek rakamı verir. Bulunan ABD odaklı Apple Ads kaynakları Türkiye için kullanılmamalı.

## Karar hesabı

```text
Kullanıcı başına gelir = abone oranı × abone başına net gelir
Kullanıcı başına gelir > kurulum başına maliyet ise ölçekle
```

Yol haritası varsayımı: Türkiye karma abone net ~₺55/ay ve dönüşüm %1,5-2,5. Bunlar varsayımdır. Gerçek değerler RevenueCat ve analitikten alınıp burada güncellenecek.

## Kreatif kuralları

| Kural | Açıklama |
|---|---|
| Telifli afiş ve sahne yok | Ekran kaydında da gizle veya telifsiz içerik kullan |
| İlk 2 saniye | Tek sorun: "Hangi bölümdeydim?" |
| Tek mesaj | Tek özellik, tek fayda |
| Dürüst | Ücretli özellik "free" gibi gösterilmez |
| Test verisi | Gerçek kullanıcı başarısı gibi sunulmaz |

Mevcut görsellerden reklama en yakın olanlar: `post-03`, `post-08`, `post-10` (büyük afiş görünmüyor). Yayınlamadan önce platform kurallarıyla kontrol edilmeli. Liste: [GORSEL_ENVANTERI.md](../icerik/GORSEL_ENVANTERI.md).

## Ölçüm durumu

| Bileşen | Durum |
|---|---|
| Firebase Analytics, Sentry | Kod hazır; DebugView doğrulaması açık görünüyor |
| RevenueCat | Android'de fiyat görülüyor; iOS eksik |
| Meta, TikTok, AppsFlyer, Adjust SDK | Yok (`package.json`) |
| Site analitiği | Yok |

## Deneme kaydı

| Tarih | Kanal | Ülke | Bütçe | Kreatif | Kurulum | Maliyet/kurulum | Abone | Sonuç |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## Kaynaklar

- [AppTweak: Apple Ads 2026 verileri](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks)
- [SemNexus: TikTok uygulama reklamları (satıcı kaynağı)](https://semnexus.com/tiktok-ads-for-mobile-apps-a-performance-first-strategy-guide)
