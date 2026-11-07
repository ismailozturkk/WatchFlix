# Bölüm grafiği paylaşımı (4 Kasım 2026)

Dizi detayı > Sezonlar > **Bölüm Puan Grafiği** ekranı (`screens/tv/TvGraphDetailScreen.js`) üst çubuğundaki paylaş
düğmesi grafiği iki yere gönderir:

- **Akışta paylaş** → Paylaşımlar ekranında yeni gönderi penceresi, `tvgraph` türünde, başlık "<Dizi> bölüm grafiği",
  açıklama isteğe bağlı + spoiler anahtarı. Bu tür paylaşım penceresinin tür seçicisinde YOK (yalnız grafik ekranından
  ya da taslaktan gelir), o yüzden pencere açıkken tür seçici gizlenir.
- **Sohbete gönder** → arkadaş/grup seçimi (`ShareToChatSheet`), mesaj `kind: "tvGraphShare"`.

Seçim sayfası (`components/tv/TvGraphShareSheet.js`) alıcının göreceği kartın önizlemesini de gösterir; işi sayfa
kapandıktan sonra yapar (iOS iki Modal kuralı).

## Gövde — `utils/tvGraphShare.js`

Anlık görüntü; alıcı TMDB/OMDb çekmeden çizer, dizi sonradan puan alsa da kart paylaşıldığı gibi kalır.

```
{ v, type:"tvGraph", id, title, poster_path?, years?, rating?, seasons:[{ s, r:[puan] }], totalSeasons, totalEpisodes, host? }
```

- `r`: ekrandaki sırayla bölüm puanları (IMDb ile birleştirilmiş), 0–10 tek ondalık; `0` = puan yok (kartta "–").
- Özel bölümler (sezon 0) ve hiç puanı olmayan sezonlar (duyurulmuş, yayınlanmamış) gönderilmez.
- Sınırlar: 60 sezon, sezon başına 200, toplam 2000 bölüm (~20 KB). Kesilirse `totalSeasons/totalEpisodes` gerçek
  sayıyı söyler.
- Firestore iç içe diziyi saklayamaz → sezon başına `{ s, r }` nesnesi.
- Gönderide `Posts.tvGraph` = aynı gövde `v/type/host` olmadan (`postTvGraphOf`). `mediaList`'te dizinin kendisi durur:
  küçük resimler (Gönderilerim, yorum sayfası, taslak kartı) ondan gelir ve eski uygulama sürümleri gönderiyi dizinin
  afişli bir inceleme gibi gösterir. Firestore kuralları gönderi türünü/alanlarını kısıtlamadığı için kural değişikliği yok.

## Özel afiş

- Gövdedeki `poster_path` gönderenin **seçtiği afiş** (Premium "Özel afiş"; `context/PosterChoicesContext`): ekran
  `buildTvGraphShare({ …, resolvePoster })` ile çözüp yazar. Seçim yoksa ya da Premium bittiyse çözücü TMDB afişini
  döndürür. Gönderinin `mediaList` küçük resmi de aynı afiş.
- Alıcı tarafında yeniden çözülmez: sohbet ve gönderi anlık görüntüsü kuralı (herkes gönderenin paylaştığını görür;
  `__tests__/posterChoicesCoverage.test.js` HARİÇ listesinde gerekçesiyle). Gönderen afişini sonradan değiştirirse
  önceden paylaşılan kart eski afişle kalır.
- Afiş boyutu izleyenin görsel kalitesine göre (`getTmdbUrl`).

## Yerleşim — kısa ve uzun sezonlar

`planTvGraphLayout(seasons, { width, maxHeight, maxCell, minCell })` verilen kutuya en büyük kareyi veren düzeni seçer:

| Düzen | Ne zaman | Örnek (sohbet balonu 236×320) |
|---|---|---|
| **columns** — klasik grafik: sütun = sezon, satır = bölüm | sezon ve bölüm sayısı dengeliyse; puan yazısını taşıyabiliyorsa önceliklidir | Game of Thrones 8 × 6–10 |
| **columns (bantlı)** — çok sezon alt alta bantlarda | çok sezon, kısa sezonlar | — |
| **rows** — her sezon bir şerit, bölümler soldan sağa | az bölümlü tek sezon (1 × 5 tek şerit) | mini dizi |
| **rows (kayan)** — uzun sezon `perLine` bölümde alta geçer; tüm şeritler aynı `perLine`, bölümler alt alta hizalı | uzun sezonlar / sezon uzunlukları çok farklı | Breaking Bad 7–16, anime 2 × 60 |

- Kare 18 px'ten küçükse puan yazılmaz (yalnız renk); sezon etiketleri sığmıyorsa her n'inci yazılır.
- Hiçbir düzen `minCell`e (5) sığmıyorsa en sık düzen `minCell` ile çizilir, alt kısım solarak kesilir ve kart
  "Tamamı için grafiği aç" der.
- Kart dokununca dizinin canlı grafiği (`TvGraphDetailScreen`) açılır.

Kutu boyları: sohbet 260 genişlik / 320 grafik yüksekliği, akış kartı ölçülen genişlik / 460, gönderi detayı 900,
paylaşım penceresi 360, seçim sayfası önizlemesi 220.

## Dosyalar

- `utils/tvGraphShare.js` — gövde, temizleyici, yerleşim planlayıcı (saf)
- `components/tv/TvGraphSnapshot.js` — ızgarayı plana göre çizer · `TvGraphShareCard.js` — ortak kart · `TvGraphShareSheet.js`
- `components/chat/SharedTvGraphMessage.js` (MessageBubble), `components/feed/PostTvGraphBlock.js` (FeedPostCard, PostDetailScreen)
- `utils/chatShare.js` (`SHARE_TYPE.TV_GRAPH`, `tvGraphShare`), `utils/chatReply.js` (alıntı simgesi `grid`)
- `utils/postComposer.js` (`tvgraph` türü, doğrulama, rozet), `services/postsService.js` (`tvGraph` alanı), `CreatePostModal.js`
- Testler: `__tests__/tvGraphShare.test.js`, `__tests__/tvGraphSnapshotRender.test.js`
