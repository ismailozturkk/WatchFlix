# Seelogd — Geliştirme Öneri Adayları (17 Ekim 2026)

> Kapsam: kod tabanı taraması + `docs/planlama` belgeleri + 16 Temmuz tarihli eski rapor
> (`ozellik-onerileri-arastirma.md`). Hiçbir madde cihazda ya da gerçek veriyle denenmedi; dayanaklar koddan okundu.
> Bu dosya **aday listesidir**, karar belgesi değil: bir madde seçilince kendi `docs/ozellikler/` belgesini alır.

## 1. Durum: eski rapordan ne yapıldı

16 Temmuz raporundaki sekiz önerinin çoğu artık kodda:

| Eski öneri | Durum | Nerede |
|---|---|---|
| "Sırada" bölüm kuyruğu + tek dokunuş izledim | **Yapıldı** | TV ana ekranı `TvOngoingSection`, `services/upNextService.js` |
| Streaming uygunluk bildirimi | **Yapıldı** (functions deploy edildi) | `dailyStreamingAvailability`; izleme listesinde Free 10 / Premium 100 başlık takip eder |
| Letterboxd / IMDb içe aktarma | **Yapıldı** | `services/import/*` |
| Android + iOS widget | **Yapıldı** | `targets/reminder-widget`, `native/android-widgets` |
| AI'ya ruh hali / süre / kiminle | **Yapıldı** | `components/ai/AIWelcome.js` (vibe seçici) |
| Arkadaş aktivite akışı, öneri gönderme | **Yapıldı** | Hub feed, "Sohbete gönder" |
| Dışa aktarma (CSV/JSON) | **Yapılmadı** | aşağıda 2. aday |
| Trakt senkronu, watch party | **Yapılmadı** | aşağıda "şimdilik önerilmeyenler" |

Bu oturumda eklenenler: **Filtreli Keşif ("Ne izlesem?")** ve **yaş sınırı rozeti**
(`docs/ozellikler/FILTRELI_KESIF.md`). Üst satırda keşfet düğmesi, filtre ekranı, hazır/kayıtlı süzgeçler, Şaşırt beni.
Ardından aday 4 yapıldı: **Yıllık izleme hedefi** (`docs/ozellikler/YILLIK_HEDEF.md`) — profil başlığında halka düğmesi + hedef sayfası, JS-only, cihaz-yerel.

## 2. Aday özellikler

Sütunlar: **Build** = yeni native build gerekir mi; **Deploy** = Cloud Functions / Firestore rules deploy'u gerekir mi.
Efor kaba tahmindir. "Dayanak" koddan doğrulanan eksik/hazır parçadır.

| # | Aday | Neden değerli | Dayanak (kodda) | Efor | Build | Deploy |
|---|---|---|---|---|---|---|
| 1 ✅ | **Oyuncu / yönetmen takibi** — **aşama 1 yapıldı (18 Ekim)** | Kişi bazlı bekleme ("X'in yeni filmi ne zaman?") en çok istenen takip özelliklerinden; günlük açılma sebebi | **Aşama 1 yapıldı:** kişi sayfasında Takip et hapı, Film/Dizi'de "Takip ettiklerinin yaklaşanları" rafı + Takip ettiklerim sayfası (cihaz-yerel MMKV, 60 kişi sınırı, bölüm gizlenebilir). Push (aşama 2) ve takvim kaydı yapılmadı. Ayrıntı: `docs/ozellikler/OYUNCU_TAKIBI.md`. Önceki durum: `ActorViewScreen` zaten `movie_credits` + `tv_credits` çekiyor ve "yaklaşan" filtresi var; takip düğmesi ve liste yok | Orta | Hayır | Aşama 2 (push) için functions |
| 2 ✅ | **Kütüphane dışa aktarma** (JSON + Letterboxd uyumlu CSV) — **yapıldı (18 Ekim)** | Veri taşınabilirliği güveni; içe aktarmanın çıkış kapısı; KVKK/GDPR taşınabilirlik | Yedek yalnız ayarları kapsıyor; "Verileri indir" önbellektir, dışa aktarım değil (`docs/planlama` + yasal sayfa notu). `expo-sharing`, `expo-file-system` kurulu | Orta | Hayır | Hayır |
| 3 ✅ | **İzleme listesinde "platformlarımda" çipi** — **yapıldı (18 Ekim)** | "Bu akşam izleyebileceklerim" listesi; seçim yorgunluğunu azaltır | **Yapıldı:** Sırala & Filtrele sayfasında PLATFORM bölümü (`docs/ozellikler/PLATFORMLARIMDA_SUZGECI.md`). **Dikkat — bu satırdaki "sunucu verisi hazır" eksikti:** belge yalnız "Yayına gelince bildir" açık kullanıcılar için yazılıyor ve yalnız takip edilen başlıkları (Free 10 / Premium 100) kapsıyor; çip bunu açıkça söyler. Önceki not: sunucu her gün `ProviderWatch/{uid}` altına başlık başına `{ a: sağlayıcılar, n: bildirilenler }` yazıyor, **istemci hiç okumuyor**. `ListsScreen` süzgeçleri yalnız tür / tür-tipi / tarih / sıralama | Düşük–orta | Hayır | Hayır |
| 4 ✅ | **Yıllık izleme hedefi halkası** ("2026: 31/50") — **yapıldı (17 Ekim)** | Hedef + ilerleme bağlılığı; Wrapped ve widget ile birleşir | **Yapıldı:** profil başlığında Düzenle / Paylaş'ın yanında 36×36 halka düğmesi (ortada yalnız yüzde) + hedef sayfası: film ve dizi için AYRI hedefler, dizi için dizi sayısı ya da bölüm sayısı ölçüsü; özet, plan işaretli çubuk, tempo, "haftada/ayda ~N", yıl sonu tahmini, aylık plan grafiği. Sayım `useProfileStats` listelerinden (yeni listener yok), hedef cihaz-yerel MMKV. Ayrıntı: `docs/ozellikler/YILLIK_HEDEF.md` | Düşük–orta | Hayır | Hayır |
| 5 ✅ | **Arkadaşla zevk uyumu + "birlikte izleyelim"** — **yapıldı (18 Ekim)** (`docs/ozellikler/ZEVK_UYUMU.md`) | Sosyal sürtünmeyi düşürür: iki izleme listesinin kesişimi → CineSwipe odası daveti | `FriendProfileScreen`'de böyle bir hesap yok. Sınır: arkadaşın liste gizliliği (`canReadLists`) | Orta | Hayır | Hayır |
| 6 | **Başka uygulamadan paylaşıp ekle + simge kısayolları** | IMDb / TMDB / Netflix bağlantısını paylaş menüsünden listeye atma; uzun basınca "Ara / Sıradaki / CineMatch" | `package.json`'da share-intent / quick-actions yok. Kısa yol: panodaki IMDb/TMDB bağlantısını algılayıp "listeye ekle?" demek (native gerekmez) | Orta | **Evet** (tam sürüm) | Hayır |
| 7 | **Harici puanlar (IMDb / Rotten Tomatoes) güvenli biçimde** | Detay ekranında tanıdık puan; karar vermeyi hızlandırır | Şu an yalnız `TvGraphDetailScreen`'de, **anahtar istemciye gömülü** (bkz. 4. bölüm). Bir Cloud Function arkasına alınırsa her detayda gösterilebilir | Orta | Hayır | **Evet** |
| 8 | **Haftalık özet bildirimi** ("Bu hafta çıkacaklar") | Elde tutma; izleme listesi + takip edilenler (1. aday) + hatırlatıcılar tek bildirimde | Özet/haftalık bildirim mantığı yok; `dailyStreamingAvailability` kalıbı kopyalanabilir | Orta | Hayır | **Evet** |
| 9 | **Web paylaşım sayfaları / universal link** | Story kartı dışında tıklanabilir bağlantı; Aralık "Wrapped kampanyası" için büyüme | `linking` yalnız `seelogd://` şemasını tanıyor; `website/` statik yasal sayfalar | Yüksek | Evet (associated domains) | Hosting + function |

### Önerilen sıra

1. ~~**Oyuncu / yönetmen takibi (1)**~~ — **aşama 1 yapıldı (18 Ekim)**: takip düğmesi + yaklaşanlar rafı + yönetim sayfası. Kalan: takvim kaydı, push (aşama 2, functions).
2. ~~**İzleme listesinde "platformlarımda" (3)**~~ — **yapıldı (18 Ekim)**; asıl sınır sunucu kapsamı (opt-in + Free 10 başlık), ileride functions tarafında genişletilebilir.
3. ~~**Dışa aktarma (2)**~~ — **yapıldı (18 Ekim)** (`docs/ozellikler/KUTUPHANE_DISA_AKTARMA.md`). **Açık iş:** `website/privacy.html` "dışa aktaran ekran yok" diyor, sürümle birlikte güncellenmeli.
4. ~~**Yıllık hedef (4)**~~ — **yapıldı (17 Ekim)**; Wrapped (Aralık) öncesine yetişti. Wrapped'a hedef satırı, widget ve bildirim sonraki adım (aşağıda 5b).

Kriter: **yeni native build, rules veya functions deploy'u gerektirmeyenler önce** (OTA ile gider). Yol haritasında
yayın öncesi özellik dondurması ve App Store lansmanı (Ekim sonu) var; 1–4 bu kısıta uyuyor, 6–9 uymuyor.

## 3. Şimdilik önerilmeyenler

- **Trakt senkronu:** büyük iş, düşük marjinal kazanç (Letterboxd/IMDb içe aktarma zaten var).
- **Watch party:** eşzamanlı oynatma yok; CineSwipe odaları "ne izleyelim" kararını zaten çözüyor.
- **Canlı Etkinlik (Live Activity) / Siri Kısayolları:** yeni native hedef + bakım yükü; kazanç belirsiz.
- **Otomatik "scrobbling" (Netflix'ten otomatik okuma):** mobilde pratik değil (eski rapordaki fizibilite notu geçerli).

## 4. Yan bulgu — güvenlik

`screens/tv/TvGraphDetailScreen.js:248` ve `:300` içinde **OMDb API anahtarı düz metin olarak gömülü** (`omdbapi.com/?i=…&apikey=…`, iki çağrı). İstemciye
paketlendiği için herkes çıkarabilir. Seçenekler: (a) anahtarı yenileyip Cloud Function arkasına almak (7. adayla birleşir),
(b) kullanılmayacaksa çağrıyı kaldırmak. Özellik işinden bağımsız, ayrı bir iş olarak yapılabilir.

## 5. Yeni özelliklerin devamı (Filtreli Keşif)

Bu oturumda yapılan işin doğal devamları — ayrı özellik değil, iyileştirme:

- **Cihazda doğrulama borcu:** iOS 26 cam görünümünde üst satırın üç öğesi ve filtre ekranındaki anahtar; gerçek yazı tipiyle dar ekran etiketleri;
  gerçek TMDB cevaplarıyla sonuç kalitesi (özellikle dizide `with_runtime` ve düşük oylu başlıklar); gerçek `SeeAllGrid` birleşimi (testlerde taklit).
- **Belirli platformu seçme:** şu an yalnız "platformlarım" (tümü). Tek tek platform seçimi ve "hariç tut" türleri.
- **Arama ekranından girişe:** aramada "filtreyle ara" kısayolu (bugün giriş yalnız üst satırdaki düğme).
- **Kayıtlı süzgeçleri yeniden adlandırma:** ad şu an otomatik (ilk üç çip); metin kutusu bilerek yok (klavye sorunu), isterse sayfa içi mini düzenleme.
- **Ölçümden öğrenme:** `discover_filter_applied.source` ve `discover_surprise.outcome` birkaç hafta toplanınca hazır çiplerin hangisinin kullanıldığına göre
  set güncellenir (kullanılmayan çip satırı gereksiz uzatır).

## 5b. Yıllık hedefin devamı

Yapılmadı, ayrı iş olarak seçilebilir (hepsi `docs/ozellikler/YILLIK_HEDEF.md` "Bilerek yapılmayanlar" bölümünde):

- **Wrapped'a hedef satırı** ("Hedefine ulaştın: 52/50") — Aralık Wrapped kampanyasına malzeme; JS-only.
- **Hedef tamam kutlaması / rozeti** ve **yarı yol bildirimi** — rozet kataloğu (`watchBadgeCatalog`) ve bildirim izni kararı gerekir.
- **Widget'ta halka** — yeni native build.
- **Bulut senkronu** — şu an hedef yalnız cihazda; uygulamayı silen / başka cihazdan giren görmez (açık soru 1'in ters yüzü).
- **Geçmiş yıl görünümü** ("2025: 41/50") — veri kayıtta duruyor, ekran yok.
- **Süre (saat) hedefi** — üçüncü bir hat; ölçü seçimi kalıbı hazır (`kind` + limit/adım/çip tabloları).
- **Cihazda doğrulama borcu:** SVG halkanın 36 pt cam düğmede çizimi, sayfanın gerçek yükseklikte kaydırılması, 320 pt'te hat kartı hücreleri ve eylem satırının sarılması, aylık çubukların sütununda sayı etiketleri, iOS 26 cam kapat düğmesi, "Hareketi azalt".

## 6. Karar için açık sorular

1. Takip listesi (1. aday) **kullanıcı verisi mi** (Firestore, local-first motor; cihazlar arası senkron) yoksa yalnız cihazda mı (MMKV, yedeğe girer)?
   Öneri: local-first motor (`docs/mimari/YEREL_ONCELIKLI_VERI_KATMANI.md`); ilk sürüm MMKV ile başlayıp motora taşınabilir.
   *Yıllık hedef (4) için bu soru MMKV lehine cevaplandı (17 Ekim):* cihaz-yerel, çıkışta silinmez; takip listesi (1) aşama 1 de aynı kararla yapıldı (18 Ekim); push (aşama 2) için liste sunucuya yazılacağından local-first motora/Firestore'a taşıma kararı o zaman gerekir.
2. Free planda takip edilen kişi sayısı sınırlanacak mı? *(Aşama 1: yalnız teknik sınır 60, plan kapısı yok; karar hâlâ açık.)* (`utils/premiumFeatures.js` tek kaynak; sunucu kotası gerekirse `functions/planCapabilities.js` ile eşitlenir.)
3. Dışa aktarma ücretsiz mi? (Öneri: evet — taşınabilirlik hakkı, ücretli kapıya konmamalı.)

## Kaynaklar

- `docs/planlama/ozellik-onerileri-arastirma.md` — 16 Temmuz 2026 önceki rapor (sektör kaynakları orada)
- `docs/planlama/YAYIN_VE_GELIR_YOL_HARITASI.md` — yayın takvimi, özellik dondurması
- `docs/ozellikler/FILTRELI_KESIF.md`, `docs/ozellikler/EKRAN_BOLUMLERI.md` — bu oturumun işleri
