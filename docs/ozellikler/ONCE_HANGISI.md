# Önce hangisi? (hızlı oyun)

Eğlence → Oyunlar modülünde iki oyun karosunun altındaki ince şerit. İki afiş çıkar, oyuncu hangisinin **daha önce
çıktığını** seçer. Üç can, art arda doğru sayısı skor. Cevaptan sonra iki afişin yılı görünür (1,5 sn ya da dokununca
sıradaki). Seri ilerledikçe yıl farkı küçülür (20 → 12 → 7 → 4 → 2 → 1). Rekor ve doğruluk yalnız bu cihazda tutulur.

Kaynak: 21 Ekim 2026 "Eğlence sekmesine özellik" çalışması, 3. aday. Yeni sunucu, rules, native build yok (OTA).

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/olderGame.js` | **Saf çekirdek**: zorluk basamakları (`gapForStreak`), çift seçimi (`pickPair`), cevap (`judgeAnswer`), kayıt (`recordOlderRun`, `normalizeOlderStats`). |
| `utils/olderGameCopy.js` | tr/en/es/pt/de metinleri. |
| `hooks/useOlderGame.js` | Durum makinesi: havuz → çift → cevap → gösterim → sıradaki / bitti; kayıt yazımı; ölçüm. |
| `screens/game/OlderGameScreen.js` | Ekran (rota `OlderGameScreen`, `App.js`). |
| `components/game/QuickGamesGrid.js` | Oyunlar modülündeki "Hızlı oyunlar" ızgarasındaki kare (rekor ya da "Yeni"); diğer hızlı oyunlar için `HIZLI_OYUNLAR.md`. |
| `services/storage/registry.js` | `Keys.olderGame` (`{best, plays, correct, answered}`, `keepOnLogout`). |
| `utils/analyticsEvents.js` | `OLDER_GAME_STARTED`, `OLDER_GAME_FINISHED`. |

## Kararlar

- **Soru kaynağı Sahne Tahmin'in başlık havuzu** (`fetchTitlePool`): en iyi filmler + popüler filmler + popüler diziler.
  Havuz öğelerinde yalnız çıkış YILI var (oy ortalaması yok), bu yüzden soru "hangisi daha eski". Aynı yıl asla eşleşmez.
- **Sahne Tahmin'in motoruna ve skor hattına DOKUNULMADI.** `useSceneGame` oturum/skor/XP/günlük hak/liderlik
  doğrulamasını bir arada taşıyan 1100+ satırlık bir motor; ikili (2 seçenekli) bir soru türü joker, seçenek sayısı ve
  istatistik anahtarlarını da değiştirirdi. Hafif ve bağımsız bir oyun daha az riskli.
- **Liderlik / XP / günlük hak YOK.** Bu yüzden skoru şişirmeye değer bir yüzey yok; sunucu doğrulaması gerekmez.
- **Premium kapısı YOK (bilinçli).** Şerit modülün kilit şeridinden bağımsız: Free kullanıcı da oynar. Oyun yerel ve
  sunucu maliyeti yok; Premium'a geçişte deneme kapısı olarak çalışır. Kilitlemek için `ProfileGamesModule`daki `onPress`i
  `guarded(...)` ile sarmak ve ekrana `usePremiumScreenGuard("games", navigation)` eklemek yeter. Kaynak bekçisi
  (`olderGameScreen.test.js`) ekranda `usePremium` çıkarsa kararı hatırlatır.
- **Zorluk eğrisi yıl farkıyla;** hedef fark havuzda yoksa kademeli gevşer, oyun "çift çıkmadığı için" bitmez. Havuzdaki
  herkes aynı yıldaysa çift YOK → hata durumu (cevabı olmayan soru sorulmaz).
- **Son 40 yapım tekrar çıkmaz** (taze havuz yetmezse tümü).
- **0 puanlı koşu rekor sayılmaz** ama oynanan oyun kaydedilir.

## Ölçüm

`older_game_started {source}` · `older_game_finished {score, answered, new_best, best}`. Ortalama skor ve rekor kırma
oranı, zorluk eğrisinin dengesini söyler (seri 10'da çok mu düşüyor?).

## Cihazda henüz görülmedi

Jest (çekirdek 15, ekran + durum makinesi 18 test) temiz. Cihazda doğrulanmadı: iki afişin 320 pt'te yan yana
yerleşimi (`aspectRatio 2/3` + 2 satır başlık), iOS 26 cam şeridi, gerçek TMDB havuzunda yıl çeşitliliği (en iyi filmler
kaynağı yeterince eski yapım getiriyor mu — getirmezse ilk bakılacak yer `POOL_SOURCES`).
