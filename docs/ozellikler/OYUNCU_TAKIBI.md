# Oyuncu / yönetmen takibi (aşama 1 — yalnız istemci)

Oyuncu ya da yönetmen sayfasında **Takip et** hapı; takip edilenlerin yayın tarihi bugün ya da sonrası olan işleri
Film ve Dizi sekmelerinde **"Takip ettiklerinin yaklaşanları"** rafında toplanır. Raftan **Takip ettiklerim** alt sayfası açılır
(kişiye git / takipten çıkar). Plan kapısı yok (ücretsiz). Liste **yalnız bu cihazda** tutulur, buluta yazılmaz.
Push bildirimi bu aşamada YOK (aşama 2: functions).

Kaynak: `docs/planlama/GELISTIRME_ONERI_ADAYLARI_2026-10-17.md` 1. aday.

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/followedPeople.js` | **Saf çekirdek**: kayıt (normalize / takip / bırak / üst sınır), yaklaşan ayıklama (`upcomingFromCredits`), kişiler arası birleştirme (`mergeUpcoming`), özet metni, gün farkı. RN/Firebase importu yok. |
| `utils/followedPeopleCopy.js` | tr/en/es metinler. `copyTablesSpanish.test.js` dengeyi bekçiler. |
| `hooks/useFollowedPeople.js` | Depoya bağlama: `people`, `count`, `isFollowing`, `follow` (durum döner), `unfollow`. Yazma son kayıttan okur. |
| `services/followedUpcoming.js` | Kişi başına `/person/{id}/combined_credits` (6'şarlı gruplar, 6 saat önbellek), hata yalıtımı. |
| `components/person/FollowPersonButton.js` | Kişi sayfasındaki hap (hero'nun altında); toast + "Geri Al"; sınırda uyarı. |
| `components/person/FollowedUpcomingRail.js` | Film/Dizi rafı: üç durum (kimse yok → çizilmez / yaklaşan yok → ince bilgi satırı / poster rafı). |
| `components/person/FollowedPeopleSheet.js` | "Takip ettiklerim" alt sayfası (BottomSheetModal). |
| `screens/actor/ActorViewScreen.js` | Hap `heroBottom` içinde, rozetlerin altında. |
| `screens/tabs/MovieScreen.js`, `TvShowScreen.js` | `followedPeople` rafı, yalnız `count > 0` iken bölüm listesine girer (3. sıra). |
| `utils/sectionVisibility.js` + `sectionVisibilityCopy.js` | Bölüm `followedPeople` (Ayarlar > Kişiselleştirme > Ekran bölümleri'nden gizlenebilir); tv ve movie'de `best(s)`'ten sonra. |
| `services/storage/registry.js` | `Keys.followedPeople` (json, `scope: "user"`, `keepOnLogout: true`). |
| `utils/analyticsEvents.js` | `PERSON_FOLLOW`, `FOLLOWED_UPCOMING_OPENED`. |

## Ne "yaklaşan" sayılır

- `combined_credits`'te yayın tarihi (`release_date` / `first_air_date`) **bugün ve sonrası** (yerel takvim günü, UTC değil).
  **Tarihsiz kayıt sayılmaz:** TMDB'de "duyuruldu ama tarihsiz" çok kayıt var; rafa koymak "ne zaman?" sorusunu cevapsız bırakırdı.
- Oyuncu kredisi (cast) her zaman; yönetmen kredisi (crew `Director`) her zaman; dizide `Creator` da. Hem oynayıp yöneten kişide aynı
  yapım **tek kayıt**, iki rol.
- Elenenler: posteri olmayan, `adult`, "Self/Himself/Herself…" olarak çıktığı, haber/gerçeklik/talk-show türleri.
- Aynı yapım birden çok takip edilen kişiden çıkarsa **tek kart** (`_people` hepsini taşır).
  Sıra: tarih (yakın önce), eşitlikte daha çok kişiyle ilgili olan.
- Zaten **izlenmiş** olanlar elenir (`ListStatusContext` indeksi, ek okuma yok).

## Kararlar

- **Cihaz-yerel (MMKV), çıkışta silinmez** — `docs/planlama` açık soru 1'in cevabı (yıllık hedefle aynı). Bulut kopyası olmadığından
  silinen liste geri getirilemez; uygulamayı silen / başka cihazdan giren görmez. Local-first motora taşıma kapısı açık.
- **Üst sınır 60 kişi** (`MAX_FOLLOWED`), plan kapısı YOK — açık soru 2 için geçici cevap: sınır teknik (60 kişi = 10 grup istek). Free/Premium ayrımı
  istenirse `utils/premiumFeatures.js` tek kaynak olur; kayıt biçimi buna hazır.
- **Takip bırakma onaysız + "Geri Al"** (toast eylemi, kişi yeniden eklenir; takip zamanı yenilenir).
- **Yaklaşan yokken de satır kalır**: takip var ama yaklaşan yoksa ince "Takip ettiklerinden yaklaşan yok" satırı çizilir, yoksa yönetim kapısı kaybolur.
- **Yükleme hatası sessiz**: raf çizilmez (Favorilerine Göre rafıyla aynı); tek kişinin hatası listeyi düşürmez.
- **Ölçüm:** `person_follow` (`action`, `source` = profile | sheet | undo, `department`) — kişi adı/kimliği GÖNDERİLMEZ (testle kilitli);
  `followed_upcoming_opened` (`media_type`).
- **Kişi hero'su koyu degrade üstünde** → hap yazısı her zaman beyaz; takipteyken vurgu rengiyle dolar.

## Bilerek yapılmadı (sonraki adımlar)

- **Push bildirimi** ("X'in yeni filmi 3 gün sonra") — aşama 2; functions + liste sunucuya yazılmalı (şu an cihazda) → **local-first motora/Firestore'a taşıma kararı** gerekir.
- **Takvim kaydı** ("yaklaşanı telefon takvimine ekle") — `phoneCalendar` servisi var; ayrı iş, izin akışı (İzinlerim > Takvim) hazır.
- **Haftalık özet bildirimi** (8. aday) bu listeyi besler.
- **Arama sonuçlarından / film detayındaki kadrodan** doğrudan takip (bugün yalnız kişi sayfasından).
- **Kişi başına poster altı etiket** (kimin işi olduğu): kartta yok, yalnız başlık altı özet + erişilebilirlik etiketi.
- **Arkadaşın takip ettikleri** / paylaşım.

## Cihazda henüz görülmedi

Jest temiz (tam paket 256 dosya): çekirdek (kayıt, ayıklama, birleştirme, tarih sınırı), düğme + alt sayfa + kanca gerçek depoyla,
servis (hata yalıtımı, 6'lı grup üst sınırı), metin dengesi, bölüm gizleme kapsam bekçileri. **Görülmeyenler:** hapın hero'da (özellikle uzun
adlı / uzun bölüm rozetli kişide) yerleşimi, rafın gerçek TMDB cevaplarıyla içeriği (tarihsiz/yinelenen kredi oranı, `Creator` kredisi
dizide ne kadar gürültülü), iOS 26'da alt sayfa, 60 kişide ilk yükleme süresi (soğuk önbellekte 10 grup istek), "Geri Al" toast'ının
Modal içinde görünmesi (sayfa kendi `ToastHost`'unu taşıyor ama gerçek cihazda denenmedi).
