# Hızlı oyunlar

Eğlence → Oyunlar modülünde iki büyük oyun kartının altında **"Hızlı oyunlar"** yatay rayı (her kartta oyunun küçük önizlemesi). Hepsi aynı iskelet: Sahne Tahmin'in
başlık havuzundan kurulan kısa sorular, **üç can**, art arda doğru sayısı skor, cevaptan sonra 1,5 sn bilgi ve sıradaki
(dokununca hemen ilerler). Rekor ve doğruluk yalnız bu cihazda. Liderlik / XP / günlük hak / premium kapısı **yok**.
Yeni sunucu, rules, native build gerekmez (OTA).

Kaynak: 21 Ekim 2026, "Önce hangisi? gibi birkaç tane daha" isteği. İlk üye: `docs/ozellikler/ONCE_HANGISI.md`.

| Oyun | Düzen | Soru | Zorluk eğrisi |
|---|---|---|---|
| **Önce hangisi?** (`older`) | iki afiş | hangisi daha önce çıktı | yıl farkı 20 → 1 |
| **Hangisi daha çok izlendi?** (`popular`) | iki afiş | hangisi daha çok oy aldı (cevaptan sonra oy sayıları) | oy oranı 8× → 1,2× |
| **Hangi on yıl?** (`decade`) | tek afiş + 4 şık | hangi on yılda çıktı (cevaptan sonra yıl) | yanlış şıklar uzak → komşu on yıl |
| **Film mi, dizi mi?** (`kind`) | tek afiş + 2 şık | film mi dizi mi | 8. doğrudan sonra başlık gizlenir (yalnız afiş) |
| **Hangi tür?** (`genre`) | tek afiş + 4 şık | yapımın türlerinden hangisi (cevaptan sonra bütün türleri) | yanlış şıklar bilindik türlerden (drama, komedi, aksiyon…) |

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/quickGames.js` | **Saf çekirdek**: dört oyunun soru üretimi (`buildQuickQuestion`), cevap (`judgeQuickAnswer`), zorluk basamakları, TMDB tür kimliği → kanonik tür, oyun başına kayıt (`recordQuickRun`). |
| `utils/quickGamesCopy.js` | Oyuna özgü metinler (5 dil): başlık / ipucu / soru, film-dizi etiketi, on yıl biçimi, 18 tür adı, oy sayısı biçimi. Ortak metinler `olderGameCopy`den gelir. |
| `services/quickGamePool.js` | Ortak havuz: en iyi filmler + popüler filmler + popüler diziler (`fetchTitlePool`). `useOlderGame` da bunu kullanır. |
| `hooks/useQuickGame.js` | Durum makinesi (loading → playing → revealed → over \| error), kayıt yazımı, ölçüm. |
| `screens/game/QuickGameScreen.js` | Dört oyunun ekranı (rota `QuickGameScreen`, parametre `gameId`). Afiş boyutu pencere yüksekliğinden türer. |
| `components/game/QuickGameParts.js` | Ortak parçalar: canlar, skor/rekor satırı, yükleniyor, hata, oyun sonu kartı, afiş kartı, "Doğru!/Yanlış" şeridi. `OlderGameScreen` de kullanır. |
| `components/game/QuickGamesGrid.js` | Eğlence oyun listesi: başta iki sahne oyunu kartı, altında beş kartlık yatay ray (23 Eki kompakt düzen; eskiden 2 sütunlu simge ızgarası). Eski `OlderGameCard` silindi. |
| `components/game/GamePreviews.js` | Kartlardaki "nasıl oynanır" önizlemeleri; paketli splash afişleri, `PREVIEW_FACTS` doğru cevapları (bekçi: `__tests__/gamePreviews.test.js`). |
| `services/storage/registry.js` | `Keys.quickGames` (`{oyun: {best, plays, correct, answered}}`, `keepOnLogout`). `older` kendi anahtarında (`olderGame`) kaldı. |
| `utils/analyticsEvents.js` | `QUICK_GAME_STARTED {game_id, source}`, `QUICK_GAME_FINISHED {game_id, score, answered, new_best, best}`. |

## Kararlar

- **Yalnız havuzdaki veriyle sorulur:** yıl, oy SAYISI, tür kimlikleri, film/dizi. Oy ORTALAMASI ve oyuncu kadrosu havuzda
  yok → "puanı kimin yüksek" ya da "baş rolde kim" kasten yok (her başlığı TMDB'den çekmek ağ + kota ister, çevrimdışı bozulur).
- **"Daha çok izlendi" aslında oy sayısı:** TMDB `vote_count` kaç kişinin oyladığını söyler, izlenme sayısı değil; metin
  "kaç kişi oyladı" diyor (ipucu/soru). 50'den az oylu yapımlar sorulmaz.
- **Hangi tür?'de çakışma yok:** doğru şık yapımın türlerinden biri; yanlış şıkların HİÇBİRİ yapımın türü olamaz
  (ör. film hem Aksiyon hem Macera ise "Macera" yanlış şık olarak çıkmaz). Haber/realite/talk show/TV filmi şık olmaz.
- **Film mi dizi mi'de denge:** önce tür %50/%50 seçilir, sonra o türden öğe (havuzda film çok olsa da dizi seyrelmez).
  Havuzda tek tür varsa o oyun hata durumuna düşer (diğer oyunlar etkilenmez).
- **Skor kaydı oyun başına ayrı;** hiçbiri Sahne Tahmin'in sunucu doğrulamalı skor hattına dokunmaz (kaynak bekçisi bunu denetler).
- **`useOlderGame` ile `useQuickGame` ayrı kaldı** (çalışan, testli kodu gereksiz birleştirmemek için); ortak olan havuz ve
  ekran parçaları çıkarıldı. İkisini tek kancaya indirmek sonraki bir temizlik.
- Premium kapısı yok (bilinçli, `ONCE_HANGISI.md`teki gerekçe aynı). Kilitlemek: `ProfileGamesModule`daki `openQuickGame`i
  `guarded(...)` ile sarmak + ekrana `usePremiumScreenGuard("games")`; kaynak bekçisi ekranda `usePremium` çıkarsa uyarır.

## Yeni hızlı oyun eklemek

1. `utils/quickGames.js`: `BUILDERS`a soru üretici + `QUICK_GAME_IDS` + `QUICK_GAME_META` (düzen, simge, iki renk).
2. `utils/quickGamesCopy.js`: `games.<id>` (başlık / ipucu / soru) beş dilde; gerekirse şık etiketi (`quickOptionLabel`).
3. `QuickGameScreen.js`: ek bilgi (cevaptan sonra rozet) varsa oyuna özel dal. Ray kartı ve kayıt kendiliğinden gelir;
   kart önizlemesi için `components/game/GamePreviews.js`e bir dal + `PREVIEW_FACTS` girdisi (gerçek bilgiyle) ekle —
   yoksa kart boş önizleme kutusuyla çizilir.
4. `__tests__/quickGames.test.js` (çekirdek) ve `quickGameScreen.test.js` (`describe.each` oyunu otomatik kapsar; doğru cevabı
   havuz bilgisinden çözen `currentAnswers`a yeni oyunun dalını ekle).

## Cihazda henüz görülmedi

Jest temiz (çekirdek 21, ekran/kanca/ızgara 4 oyun × senaryo + ortak 80+ test). Cihazda doğrulanmadı: tek afişli düzenin
kısa telefonda (320×568) sığması (afiş genişliği `(yükseklik − 470) × 2/3`, en az 110), ızgara karelerinin iOS 26'da
görünümü, `kind` oyununda TMDB'nin dizileri "film" gibi etiketlediği uç durumlar, `vote_count`ın gerçek havuzda oran
çeşitliliği (en iyi filmler kaynağı yüksek oylu yapımları öne çıkarır; düşük oranlı çift bulunamazsa eşik gevşer).
