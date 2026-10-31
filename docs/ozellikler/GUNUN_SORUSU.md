# Günün Sorusu

Eğlence'de her gün aynı iki seçenekli bir soru ("Altyazı mı, dublaj mı?", "Sinemada mı, evde mi?"…). Oy verilince iki
seçenek yüzde çubuğuna döner, kendi seçimin işaretli kalır. Soru metni uygulamada **paketli** (40 soru × 5 dil); sunucuda
yalnız iki **oy sayacı** ve kullanıcı başına tek oy dokümanı var.

Kaynak: 21 Ekim 2026 "Eğlence sekmesine özellik" çalışması, 4. aday.

> ## ⚠️ YAYIN ÖNCESİ: `firestore.rules` DEPLOY EDİLMEDİ
> Kart, kurallar yayında olmadan da **çökmeden** çalışır (oy yerelde görünür, alt satır "bu cihazda kayıtlı, bağlantı
> gelince sayılacak" der) ama **sonuçlar ve sayaçlar kurallar yayına alınana dek çalışmaz**. Deploy komutu:
> `firebase deploy --only firestore:rules` (makine notu: `FUNCTIONS_DISCOVERY_TIMEOUT` yalnız functions içindir).
> Deploy, `firestore.rules`ın çalışma ağacındaki halini olduğu gibi yayar; başka oturumların eklediği bloklar (ör. sosyal
> hesaplar) zaten yayındaysa değişmez, yayında değilse onlar da gider — deploy öncesi `git diff firestore.rules` ile bakın.
> Kurallar emülatörde doğrulandı: `npm run test:rules` 226/226 (Günün Sorusu için 10 test).

## Dosyalar

| Dosya | Görev |
|---|---|
| `data/dailyPollQuestions.js` | Soru bankası: `{id, tr/en/es/pt/de: [soru, A, B]}`. `id` KALICI. |
| `utils/dailyPoll.js` | **Saf çekirdek**: günün sorusu (`questionForDay`), yüzdeler (`pollShares`), yerel oy kaydı, seri. |
| `utils/dailyPollCopy.js` | Kart metinleri (5 dil). |
| `services/dailyPollService.js` | `fetchPollCounts` (gün belgesi + parçaların toplamı), `fetchMyPollVote`, `castPollVote` (tek toplu yazım: oy + parçada `increment(1)`; transaction yok). |
| `hooks/useDailyPoll.js` | Veri bağı: yerel kayıt + sunucu; açılış eşitlemesi; oy; ölçüm. |
| `components/hub/DailyPollWidget.js` | Eğlence kartı. Hub bölümü `poll` (Ayarlar > Ekran bölümleri'nden gizlenebilir). |
| `firestore.rules` | `DailyPolls/{gün}` + `votes/{uid}` + `shards/{0-9}` (aşağıda). |
| `services/storage/registry.js` | `Keys.dailyPoll` (`{gün: {choice, synced}}`, son 14 gün, `keepOnLogout`). |
| `translations/*.json` | `autoI18n.gunun_sorusu_bolum` (bölüm başlığı). |
| `utils/analyticsEvents.js` | `DAILY_POLL_VOTED {question_id, synced, source}` (seçilen taraf GÖNDERİLMEZ). |

## Kurallar (sayaç şişirmeyi kural düzeyinde kapatır)

- Oy **tek**, değiştirilemez, silinemez (`votes/{uid}`: yalnız create; `!exists` kontrolü).
- Sayaç ancak **aynı toplu yazımda** o kullanıcının oy dokümanı oluşturulursa artar (`existsAfter/getAfter`), tam **+1** ve
  **yalnız seçilen yana**. Oy dokümanı da sayaç aynı yazımda tam +1 artmadan oluşturulamaz (karşılıklı).
- Gün anahtarı **sunucu saatine göre bugün (TR, UTC+3)** olmalı: geçmiş/gelecek günlerin sayacı doldurulamaz.
- Oylar yalnız sahibine okunur; sayaç giriş yapmış herkese.
- **Emülatörde yakalanan bir açık düzeltildi:** ilk kuralda sayaç zaten varken sayaçsız tek başına oy kaydı geçiyordu;
  oy kuralına "seçilen yanın sayacı yazım sonrası = öncesi + 1" koşulu eklendi.
- **Parçalı sayaç (2026-10-31):** yeni oy `{ choice, shard }` yazar ve YALNIZ o parçayı (`shards/{shard}`) +1 artırır;
  parça numarası 0-9 (`utils/dailyPoll.POLL_SHARD_COUNT` = 10, kuralla eşitliği `__tests__/dailyPoll.test.js` denetler).
  Eski istemcinin yolu (`{ choice }` + gün belgesi) açık; parçalı oy gün belgesini, eski oy parçayı artıramaz —
  bir oy tek sayaçta sayılır. Testler: kural emülatörü → "Günün Sorusu — parçalı sayaç".

## Kararlar

- **Oy vermeden sonuç görünmez** (önyargı yok, gereksiz okuma yok).
- **Toplam oy < 5 iken yüzde yok** ("%100" yanıltıcı): "ilk oy verenlerdensin" / "sonuçlar oy arttıkça belirir".
- **Oy önce yerele, sonra sunucuya.** Yazılamazsa "beklemede"; gün başına **bir kez** yeniden denenir (kartı her açışta
  dövmez). Başka cihazdan verilmiş oy, yerel kayıt yokken sunucudan geri okunur ve sunucudaki oy kazanır.
- **Soru sırası sabit karıştırılmış, döngü başa sarar:** 40 gün tekrar yok. Yeni soru eklemek yalnız karışık sıranın
  içindeki yerleri değiştirir (id sabit olduğu sürece geçmiş gün sorusu o gün için değişmez *yeni soru eklenmedikçe*;
  ekleme sonrası mevcut günün sorusu kayabilir — gün başında ekleyin).
- **Kullanıcı üretimi içerik yok:** moderasyon gerekmez. Sayaçlar toplu, kimin ne dediği başkasına açık değil.
- Cloud Function yok: sayaç istemci toplu yazımı + kural doğrulamasıyla tutuluyor. **Sayaç parçalı (10 parça)**:
  herkes aynı gün aynı belgeye yazdığı için tek belge sıcak noktaydı. 2026-10-31 ölçümü (emülatör, gerçek kurallar,
  istemci SDK'sı, her oy ayrı kullanıcı, aynı anda): eski transaction 100'de 8, 300'de 9, 1.000'de 58 oyu
  kaydedebildi; parçalı toplu yazım 100/100, 300/300, 1.000/1.000 (sayaç kesin). Ayrıntı:
  `docs/guvenlik/DENETIM_2026-10-31_GUVENLIK_PERFORMANS.md` §5.
- **Yayın sırası:** önce `firestore.rules` deploy, sonra istemci. Kural yayında değilken yeni istemcinin oyu reddedilir
  ("beklemede" kalır, gün başına bir kez yeniden denenir); eski istemciler yeni kuralla çalışmaya devam eder.

## Cihazda henüz görülmedi

Jest (çekirdek + bank bütünlüğü + kart/kanca, 24 test) ve kural emülatörü temiz. Cihazda ve gerçek Firestore'da
doğrulanmadı: iki cihazla gerçek oylama, toplu yazımın RN'deki çevrimdışı davranışı (reddedilip "beklemede" kalması
beklenir), seçenek metinlerinin 320 pt'te iki satıra sığması (Almanca/Portekizce en uzunlar).
