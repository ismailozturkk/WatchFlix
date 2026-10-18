# İzleme listesinde "Platformlarımda" süzgeci

İzleme listesinin **Sırala & Filtrele** sayfasında yeni bir **PLATFORM** bölümü: "Platformlarımda · N" çipi, listeyi yalnız kullanıcının seçtiği
platformlarda (Netflix, Prime…) izlenebilen başlıklara daraltır. Yalnız `watchList` ekranında; plan kapısı yok; yalnız istemci (JS-only, OTA ile gider).

Kaynak: `docs/planlama/GELISTIRME_ONERI_ADAYLARI_2026-10-17.md` 3. aday.

## Veri nereden geliyor — ve sınırları

`ProviderWatch/{uid}` belgesini `dailyStreamingAvailability` (functions) yazar, istemci yalnız okur: `{ region, items: { "movie_123": { a: [sağlayıcıId…], n: […] } }, updatedAt }`.
`a` = o bölgede abonelikle / ücretsiz / reklamlı izlenebilen TÜM sağlayıcılar (kiralama/satın alma yok).

Belgenin üç sınırı vardı ve bu özellik bunları **gizlemez, söyler** (çipin altındaki satırlar):

1. **Belge yalnız "Yayına gelince bildir" (Ayarlar > Bildirimler) açık, platform seçmiş ve bildirim jetonu olan kullanıcı için yazılır.** Diğerlerinde belge yoktur.
   Öneri listesindeki "sunucu verisi hazır" cümlesi bu yüzden eksikti: çip çoğu kullanıcıda ilk başta veri bulamaz. Bu durumda çip ÇİZİLMEZ, yerine
   "Ayarlar > Bildirimler'de … aç; ilk sonuç bir sonraki akşam 18:00'de gelir" yazar.
2. **Belge yalnız takip edilen başlıkları kapsar** (Free 10 / Premium 100, listeye en son eklenenler). Kapsam dışı başlık "platformda yok" değil **bilinmiyor**tur:
   çip bunları göstermez ve "N başlık henüz denetlenmedi; bu süzgeçte görünmezler" der.
3. **Günde bir yazılır (18:00 TR).** Denetim 2 günden eskiyse "Son denetim N gün önce" notu çıkar.

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/providerWatch.js` | **Saf çekirdek**: belge normalize, `classifyTitle` (yes / no / unknown), `planPlatformFilter` (durum + sayılar + yaş), `platformsOfTitle`. RN/Firebase importu yok. |
| `utils/providerWatchCopy.js` | tr/en/es metinler (Ayarlar yolları gerçek etiketlerle: "Platform üyeliklerim"/"My subscriptions"/"Mis suscripciones", "Yayına gelince bildir"/"Notify when available"/"Avisar cuando esté disponible"). |
| `hooks/useProviderWatch.js` | Belgeyi `onSnapshot` ile dinler; `active` false iken (izleme listesi dışı) dinleyici açılmaz. Hata = "belge yok". |
| `components/lists/PlatformFilterSection.js` | Sunum: çip + durum satırları. |
| `screens/lists/ListsScreen.js` | `platformOnly` durumu, `platformPlan` (HAM listeden hesaplanır), süzgeç, filtre sayacı, sıfırla, ölçüm. |
| `utils/analyticsEvents.js` | `WATCHLIST_PLATFORM_FILTER` (`yes`, `unknown`, `total`; yalnız açılırken). |

## Durumlar (`planPlatformFilter().state`)

| Durum | Anlamı | Ekranda |
|---|---|---|
| `off` | platform seçilmemiş | "Önce Ayarlar > Platform üyeliklerim'den…" |
| `no-data` | belge yok / hiç başlık taranmamış | bildirim açma yönlendirmesi |
| `region` | belgenin bölgesi şimdiki bölgeden (`tmdbRegionOf(dil)`) farklı | "başka bir bölge için hazırlanmış" |
| `ready` | kullanılabilir | çip (yes > 0 iken) + "N başlıktan K tanesi…" + bilinmeyen / yaş notları |

## Kararlar

- **Sayılar HAM listeden** (diğer süzgeçlerden bağımsız): çipteki sayı tür/tarih seçildikçe oynamaz.
- **Veri kullanılamazsa süzgeç etkisiz** (`platformActive = platformOnly && state === "ready"`): seçiliyken belge kaybolursa liste boşalmaz.
- **Hiçbiri yokken çip çizilmez** ama seçiliyse kalır (kapatılabilsin).
- **Bölge uyuşmazlığında veri kullanılmaz**: bölge uygulama dilinden türüyor (`tmdbRegionOf`); dil değişince sunucu yeniden yazana dek eski bölgenin sağlayıcıları yanlış olurdu.
- **Çevrimdışı**: Firestore hatası "belge yok" gibi davranır (açıklama satırına düşer, ekran bozulmaz); yerel önbellek açılmadı.

## Bilerek yapılmadı

- **Poster üstü platform rozeti** ("Netflix'te") — `platformsOfTitle` hazır, rozet çizimi ayrı iş.
- **Kapsamı büyütmek**: Free 10 başlık sınırı çipi en çok kısıtlayan şey; sunucu tarafı (`planCapabilities`) işi, deploy gerekir.
- **Bildirim kapalıyken de veri üretmek** (belgeyi yalnız opt-in kullanıcıya yazmak yerine): functions değişikliği.
- **Belirli tek platform seçimi** (şu an "seçtiklerimin herhangi biri").

## Cihazda henüz görülmedi

Jest temiz (tam paket 257 dosya): çekirdek (sınıflama, durumlar, bölge, yaş), bölüm bileşeni, metin dengesi. `ListsScreen` testle KAPSANMIYOR (3000+ satır);
yalnız Babel ile derlenebilirliği doğrulandı. **Görülmeyenler:** filtre sayfasında bölümün yerleşimi/yüksekliği (küçük ekranda kaydırma), gerçek `ProviderWatch`
belgesiyle uçtan uca (belge canlı kullanıcıda var mı, `a` dizileri dolu mu), `onSnapshot`ın kural izniyle (`isOwner`) çalışması, bölge eşleşmesinin
gerçek cihaz dillerinde (`tmdbRegionOf` ↔ sunucuya yazılan `region`).
