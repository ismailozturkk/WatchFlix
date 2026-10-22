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
| `services/dailyPollService.js` | `fetchPollCounts`, `fetchMyPollVote`, `castPollVote` (tek transaction: oy + sayaç). |
| `hooks/useDailyPoll.js` | Veri bağı: yerel kayıt + sunucu; açılış eşitlemesi; oy; ölçüm. |
| `components/hub/DailyPollWidget.js` | Eğlence kartı. Hub bölümü `poll` (Ayarlar > Ekran bölümleri'nden gizlenebilir). |
| `firestore.rules` | `DailyPolls/{gün}` + `votes/{uid}` (aşağıda). |
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

## Kararlar

- **Oy vermeden sonuç görünmez** (önyargı yok, gereksiz okuma yok).
- **Toplam oy < 5 iken yüzde yok** ("%100" yanıltıcı): "ilk oy verenlerdensin" / "sonuçlar oy arttıkça belirir".
- **Oy önce yerele, sonra sunucuya.** Yazılamazsa "beklemede"; gün başına **bir kez** yeniden denenir (kartı her açışta
  dövmez). Başka cihazdan verilmiş oy, yerel kayıt yokken sunucudan geri okunur ve sunucudaki oy kazanır.
- **Soru sırası sabit karıştırılmış, döngü başa sarar:** 40 gün tekrar yok. Yeni soru eklemek yalnız karışık sıranın
  içindeki yerleri değiştirir (id sabit olduğu sürece geçmiş gün sorusu o gün için değişmez *yeni soru eklenmedikçe*;
  ekleme sonrası mevcut günün sorusu kayabilir — gün başında ekleyin).
- **Kullanıcı üretimi içerik yok:** moderasyon gerekmez. Sayaçlar toplu, kimin ne dediği başkasına açık değil.
- Cloud Function yok: sayaç istemci transaction'ı + kural doğrulamasıyla tutuluyor (Turnuva'daki gibi tetikleyici
  aggregator gerekmedi; tek sayaç dokümanı sıcak nokta olabilir — günde yüz binlerce oyda Firestore'un ~1 yazım/sn
  doküman sınırı devreye girer; o ölçekte sayaç parçalama (`shards`) gerekir. Bugünkü kullanıcı sayısında sorun değil).

## Cihazda henüz görülmedi

Jest (çekirdek + bank bütünlüğü + kart/kanca, 24 test) ve kural emülatörü temiz. Cihazda ve gerçek Firestore'da
doğrulanmadı: iki cihazla gerçek oylama, transaction'ın RN'deki çevrimdışı davranışı (reddedilip "beklemede" kalması
beklenir), seçenek metinlerinin 320 pt'te iki satıra sığması (Almanca/Portekizce en uzunlar).
