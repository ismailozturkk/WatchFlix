# Yarım puan + 10 yıldız (14 Kas)

## Hedef
Kullanıcı film/dizi puanını **10 yıldız** üzerinden verir, **yarım puan** destekli: 0,5 · 1 · 1,5 … 8,5 … 10.

## Veri modeli — GÖÇ YOK
- Saklanan alan aynı: `Ratings/{key}/userRatings/{uid}.rating`, `Users/{uid}/myRatings/{key}.rating`,
  `Lists/{uid}.activityIndex.ratings[key]` → **0–10 ölçeği**.
- Eskiden 5 yıldız × yarım = tam sayılar 1..10 yazılıyordu. Artık 0,5 adımlı değerler (8.5) yazılır.
- Eski puan 7 (= 3½/5) yeni ölçekte 7/10 = 7 yıldız: oran birebir korunur, dönüştürme gerekmez.
- Firestore kuralları `userRatings.rating` tipini kısıtlamıyor; agregat `sum` zaten `number`
  (int değil) — 0,5 farklar kurala uyar. Kural değişikliği gerekmez.
- Tek kaynak: `utils/ratingScale.js` → `RATING_MAX=10`, `RATING_STEP=0.5`, `normalizeUserRating`
  (0,5'e yuvarla, 0,5..10'a kırp), `formatUserRating(v, dil)` ("8,5" / "8.5" / "8").

## Bileşenler
| Yer | Değişiklik |
|---|---|
| `components/RatingInput.js` | 10 yıldız; yıldızın sol yarısı x,5, sağ yarısı tam. Genişliğe sığdırma (onLayout → yıldız boyu küçülür), erişilebilirlik adımı 0,5, uçlarda titreşim duvarı. |
| `services/ratingsService.js` | `setMyRating` değeri `normalizeUserRating` ile yazar (8.4 → 8.5). |
| `RatingSheetModal`, `WatchedDateSheet` | Etiket "8,5 / 10" — dile göre ondalık ayraç, tam sayıda ",0" yok. |
| `utils/ratingDistribution.js` + kart | 20 kademe (0,5 adım). Ortalama ham puanlardan, 10 üzerinden ("7,4 ★"). Kademe etiketi sayı + tek yıldız ("8,5★"); eksen "½ … 10". |
| `utils/ratingSummaryModel.formatMyRating` | Dil parametresi (virgül/nokta). |
| `ChallengeSheet` (puan yelpazesi) | `★ rating/2` → `★ rating` (10 üzerinden). |
| Ayarlar "Puan dağılımı" açıklaması (8 dil) | "½'den 5 yıldıza" → "½'den 10 yıldıza". |

## Bilerek dokunulmayanlar
- **Gönderi (inceleme) puanı** `post.userRating` 1–5 tam yıldız — ayrı sistem.
- **Film Kulübü** puanı 1–10 tam sayı (kuralda `is int`) — ayrı seçici.
- Letterboxd/IMDb dışa aktarma: Rating10 sütunu tam sayı ister → yuvarlanır (değişmedi).
- TMDB/hibrit puan gösterimi (`RatingStars`, 5 yıldız özet) — salt gösterim, değişmedi.

## Test
- `__tests__/ratingScale.test.js` (yeni), `ratingDistribution.test.js` ve `decimalSeparator.test.js` güncel ölçeğe.
- Cihazda: puan sayfasında 8,5 seç → kaydet → profil dağılımında 8,5 sütunu; eski 7 puanlı yapım 7 yıldız görünür.

## Ek: 10'lu / 5'li ölçek ayarı (14 Kas)
- Ayarlar > Kişiselleştirme > **Puanlama sistemi**: "10 yıldız" (varsayılan, yarım puan) | "5 yıldız" (yarım yıldız = 1 puan).
- Cihaz tercihi `Keys.ratingScale` ("ten" | "five"), `hooks/useRatingScale`; ayar yedeğine "content" grubunda girer.
- **İki modda da değerlendirme 10 üzerinden — "/5" ölçeği YOK.** 5'li mod = 5 yıldızlı, KÜSURATSIZ giriş:
  yarım yıldız = 1 puan (1..10 tam sayı), etiket "9 / 10". 10'luda verilmiş 8.5, 5'lide 9 (4½ ★) görünür.
- Moda bağlı yerler: `RatingInput` (`scale` prop), puan sayfası + izleme tarihi sayfası (etiket),
  detaydaki "Senin puanın" hapı, profil puan dağılımı (5'lide 10 tam puan kademesi; ortalama iki modda /10).
