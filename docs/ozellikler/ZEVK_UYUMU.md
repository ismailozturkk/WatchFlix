# Arkadaşla zevk uyumu + "Birlikte izleyelim"

Arkadaş (ya da herkese açık) bir profilde, izleme istatistiklerinin altında **Zevk uyumu** kartı: yüzde, kademe, ortak izlenen / favori / tür / puan uyumu.
Aynı kartın altında **Birlikte izleyelim**: ikinizin de izlemediği adaylar ve **"Oda kur, X'e davet gönder"** düğmesi — hazır desteyle CineSwipe duo odası kurar ve davet
kartını o arkadaşın sohbetine gönderir. Plan kapısı yok (oda kurma günlük hakkı CineSwipe'ın mevcut kapısından geçer). Yalnız istemci (JS-only → OTA).

Kaynak: `docs/planlama/GELISTIRME_ONERI_ADAYLARI_2026-10-17.md` 5. aday.

## Gizlilik (önce bu)

Arkadaşın bir listesi yalnız **o listeyi bize açmışsa** (`Users/{uid}.listVisible` + profil/liste gizliliği) hesaba girer. Kapalı liste hesaba `null` gider:
"bilinmiyor", "boş" DEĞİL. Sonuçları:

- Karşılaştırma yalnız arkadaşın **görünen** izlenen kategorilerinde yapılır (film görünür / dizi gizliyse, benim dizilerim de dışarıda bırakılır).
- Puanlar yalnız **ikimizin de görünür izlenenlerinde ortak** başlıklar için okunur (gizli bir listeden dolaylı bilgi sızmasın).
- Arkadaşın izlenenleri gizliyse **benim listemdeki** bir yapım aday olarak ÖNERİLMEZ (izleyip izlemediği bilinmiyor). Onun **kendi izleme listesindekiler** kalır (listede olmak izlenmediğine işaret).
- Yeterli veri yoksa **yüzde çizilmez**, nedeni yazılır ("… izleme listelerini paylaşmıyor" / "biraz daha izleme kaydı olmalı").
- Kendi profilinde kart yok.

## Puan nasıl hesaplanıyor (heuristik — bilimsel ölçü değil)

Üç bileşenin ağırlıklı ortalaması; verisi yetersiz bileşen düşer, ağırlıklar kalanlara dağılır; hiçbiri yoksa puan yoktur.

| Bileşen | Ağırlık | Hesap | Gerekli veri |
|---|---|---|---|
| Tür benzerliği | 0.40 | izlenenlerin tür dağılımlarının kosinüs benzerliği, [0,5–1] → [0–1] | iki tarafta ≥ 5 türlü izlenen **ve ortak tür sözlüğü** |
| Ortak izlenen | 0.30 | √(ortak / küçük listenin boyutu) | iki tarafta ≥ 5 izlenen |
| Puan uyumu | 0.30 | 1 − ortalama mutlak fark / 9 | ≥ 3 ortak puanlanan başlık |

Kademeler: ≥ 75 çok yakın · ≥ 55 epey benzer · ≥ 35 kısmen örtüşüyor · altı farklı. Kısmi veride "yaklaşık" notu çıkar.

**Tür adı tuzağı:** tür adları TMDB'den yazanın diliyle gelen düz metin ("Dram" / "Drama"). Farklı dilde iki kullanıcının sözlüğü örtüşmez ve kosinüs sahte biçimde ~0 çıkardı.
Bu yüzden iki tarafın tür sözlüğü küçük olanın en az %50'si kadar ortak değilse tür bileşeni **hesaptan düşer** (`genres.comparable=false`); ortak izlenen yine hesaplanır.

## Birlikte izleyelim adayları

Sıra: (1) iki izleme listesinde de olan ve ikisinin de izlemediği → (2) yalnız birinin listesindekiler, **dönüşümlü** (biri diğerini bastırmasın). En fazla 20 aday; ilk 8'i kartta afiş olarak görünür.
Film ve dizi kimliği karışmaz (`movie_<id>` / `tv_<id>`).

**Davet akışı:** Kart → `CineSwipeScreen` (`initialMode: "duo"`, `together: { deck, friend }`) → ekran odayı **bir kez** otomatik kurar (günlük oda hakkı `roomsGate`'ten geçer, hak yoksa
yükseltme sayfası) → `chatParamsForShare` ile arkadaşın sohbeti açılır ve davet kartı (`cineRoomShare`) gönderilir. Geri dönünce bekleme odası ekranda durur. Deste kartları
`normalizeWatchlistItem` ile üretilir (afiş + ad; özet ve arka plan yok — mevcut "Kendi İzleme Listem" kategorisiyle aynı kalite).

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/tasteMatch.js` | **Saf çekirdek**: `computeTasteMatch`, `findTogetherCandidates`, `candidatesToDeckSource`, `tierOf`. RN/Firebase importu yok. |
| `utils/tasteMatchCopy.js` | tr/en/es. `copyTablesSpanish.test.js` dengeyi bekçiler. |
| `components/friends/TasteMatchCard.js` | Sunum: yüzde halkası, satırlar, aday afişleri, davet düğmesi. |
| `screens/tabs/profile/FriendProfileScreen.js` | Karşı tarafın `listVisible` temelli veri kümesi (`friendSide`), benim tarafım (`mySide`, ListStatusContext), kartın yerleşimi, `inviteToRoom`. |
| `screens/cineswipe/CineSwipeScreen.js` | `together` rota parametresi: otomatik oda kurma + sohbete davet; `handleConfirmCreateRoom(config, presetDeck)` artık `{code,count}` döner. |
| `utils/analyticsEvents.js` | `TOGETHER_ROOM_STARTED` (`candidates`, `both`, `score`), `TOGETHER_ROOM_INVITED` (`cards`). Ad/kimlik gönderilmez. |

## Bilerek yapılmadı / açık

- **Oda kurulamazsa** (günlük hak bitti, ağ) kullanıcı duo ekranında kalır; davet gönderilmez. Ayrı bir hata kartı yok (mevcut `showRoomError`).
- **Kendi hakkından düşer:** oda, ev sahibinin (bizim) günlük oda hakkından harcanır; arkadaşın hakkından değil.
- **Zenginleştirilmiş deste kartı** (özet, arka plan, yıl) için aday başına TMDB isteği gerekir; yapılmadı.
- **Ortak hedef listesi kaydetme**: CineSwipe sonuç ekranında zaten "ortak liste oluştur" var; profil kartından ayrıca yok.
- **Puan kalibrasyonu:** eşikler (75/55/35) gerçek kullanıcı verisiyle ayarlanmadı; `person` ölçümü yok (`score` olay içinde, dağılımı görünce eşikler revize edilebilir).
- **Gizli profil / gizli liste** yolları testle kilitli çekirdek düzeyinde; ekrandaki `listVisible` dönüşümü (`friendSide`) testle KAPSANMIYOR (FriendProfileScreen büyük).

## Cihazda henüz görülmedi

Jest temiz (tam paket 262 dosya): çekirdek (özdeş zevk, dil farkı, gizlilik, ortak puan sızıntısı, kimlik karışması, dönüşümlü sıra, üst sınır), kart (durumlar, davet düğmesi koşulları), metin dengesi.
**Görülmeyenler:** kartın profildeki yerleşimi ve afiş şeridi, `friendSide` dönüşümü gerçek `listVisible` biçimlerinde (nesne ve eski dizi biçimi), CineSwipe'ta otomatik oda kurma
+ sohbete geçiş akışı (`navigate("ChatScreen")` sonrası geri dönüşte bekleme odasının durumu), gerçek veride tür sözlüğü örtüşme eşiği ve puan dağılımı.
