# Seelogd — Cihazı yoran alanlar ve yol haritası

**Tarih:** 11 Kasım 2026 · **Dal:** `codex/release-candidate-1.4.3` (kaydedilmemiş çalışma ağacı dahil)
**Dayanak:** [10 Kas düzeltme rehberi](PERFORMANS_DUZELTME_REHBERI_2026-11-10.md) (F01–F13) yeniden doğrulandı + 10–11 Kas'ta eklenen alanlar (atmosfer evrenleri, Skia alevi, profil kapağı, Dev Lab) ayrıca tarandı.

> Statik kod incelemesidir; cihazda CPU/GPU/pil ölçümü yapılmadı. Bilinçli kararlar korunur:
> atmosfer ve alev **60 fps** kalır (30 fps / boşta modu reddedildi), orta sınıf cihaz **"full"** kalır.
> `UsageDebugScreen` (4.768 satır) yalnız `__DEV__` — kapsam dışı.

## Durum: 10 Kas rehberindeki maddeler

F01–F13'ün **hiçbiri henüz uygulanmadı** (kodda doğrulandı): sekme odağı, bölüm başına geçmiş yeniden hazırlama (`hooks/useWatchedShow.js:90-93`), çift snapshot okuma (`services/snapshotCache.js:67,72`), `original` görsel (`utils/tmdbImageUtils.js:39-62`), sınırsız gönderi yorumları (`services/postsService.js:631`), sezon ScrollView'ı, detay `append_to_response`, grafik `Promise.all`, Discover ikinci sayfa, skeleton döngüleri.

## Uygulama durumu (11 Kas, commit yok, cihazda ölçülmedi)

| Madde | Durum | Not |
|---|---|---|
| Y1 | ✅ | `context/TabActiveContext.js`; shell her sekmeyi sarar, dondurma 1 kare gecikir; `useScreenFocused` = odak && sekme aktif; banner/üye çubuğu ve `useLiveFeed` da sekme farkında |
| Y2 | ⏸ | Kullanıcı kararıyla sonraya |
| Y3 | ✅ | 4 kenar şeridi `ambientUri` (w100 dp) + küçük yarıçap |
| Y4 | ⏸ | Ölçüme bağlı; Y1 sonrası cihazda bakılacak |
| Y5 | ✅ | `useWatchedShow` tembel sezon/bölüm indeksi |
| Y6 | ✅ | `cacheStore.getRecord` tek okuma |
| Y7 | ✅ | Tavan: yalnız `high`/`original`/genişlik "original" orijinale çıkar; genişliksiz → en büyük türev |
| Y8 | ✅ | `scrollToMessage` ref'ten okur → `onJumpToMessage` sabit, balonlar memo'da kalır |
| Y9 | ⏸ | Composer ayrıştırma cihaz testi gerektiriyor (109 `text` kullanımı); Y8 sonrası yazarken liste zaten yeniden çizilmiyor |
| Y10 | ✅ | 40'lık canlı pencere + `fetchOlderPostComments` imleci; taşan belgeler korunur |
| Y11 | ✅ | Canlı 20 + `startAfter` eski sayfalar; kendi düzenleme/beğeni/yanıt sayısı yerelde yamanır; yanıt aboneliği updater dışına alındı |
| Y12 | ✅ | `services/tmdbDetailCache.js` (10 dk, 24 kayıt LRU); AbortController; 4 okunmayan append alanı çıktı; iptal edilen istek offline cache'e düşmez |
| Y13 | ✅ | 4 eşzamanlı sezon; bozuk sezon boş çizilir, hepsi düşerse hata |
| Y14 | ✅ | WeakMap ile dizi bazında hazırlama + bölüm kayıtları (nesne kimliği değişmeyen diziler yeniden hazırlanmaz) |
| Y15 | ✅ | `Animated.FlatList`, kahraman + özet ListHeader |
| Y16 | — | İncelendi: işaretlenen `.map`'ler sabit/kısa (palet, sekme, `slice`); asıl veri listeleri zaten FlatList → değişiklik gerekmedi |
| Y17 | ✅ | Hub'da Bingo/anket/Top100/meydan okuma/tier list/oyunlar 120 dp kaydırınca (ya da içerik ekranı doldurmuyorsa) kurulur |
| Y18 | ✅ | Tek paylaşılan iskelet nabzı (`isInteraction:false`, görünürlüğe bağlı); CountdownTimer + Turnuva/Günün Karesi saatleri `useLoopActive` |
| Y19 | ✅ | Keşfet'in öteki bölümü yalnız sekme görünürken ve zayıf olmayan cihazda ısıtılır |
| Faz 5 | ⏸ | Yapısal işler ölçüm sonrası |

Testler: `__tests__/perfRoadmapNov11.test.js` (16 test) + tam paket 496/496 geçti. Cihazda doğrulanmadı.

---

## Faz 0 — Isınma/pil: en büyük kazanç (önce bu)

### Y1 · Gizli sekmelerde atmosfer, alev ve banner animasyonları durmuyor — **EN KRİTİK**
- **Kanıt:** 5 kök sekmenin hepsinde `<ScreenDecor>` var (Discover, Hub, Library, MyPosts/Share, Profile). Shell 6,0 / 7,2 / 8,4 / 9,6 sn'de tüm sekmeleri kuruyor (`components/navigation/AdaptiveTabShell.js:131`). Animasyon kapıları `useScreenFocused` kullanıyor (`hooks/useScreenFocused.js:13`); bu **kök rotanın** odağını okuyor, sekme seçimini bilmiyor → sekmeler arası geçiş "blur" sayılmıyor.
- **Sonuç:** ~10 sn sonra en kötü durumda **4–5 tam ekran Skia atmosfer tuvali** 60 fps saatini UI thread'de çeviriyor. `ScreenSnow`'un 4 sn "park" mantığı (`components/ScreenSnow.js:44-85`) da aynı sinyale bağlı olduğu için hiç park etmiyor (her tuval ~10 MB GPU yüzeyi). Profil gizliyken alev shader'ı (`StreakFlameBadge`, `screens/tabs/ProfileScreen.js:194`), `PremiumTopBanner`'ın 3 döngüsü, `PremiumMemberBar`, `CineSwipeWidget`, `HubWrappedModule` döngüleri de sürüyor. Android'de `activityState=0` + freeze React'i durdurur ama Reanimated `useFrameCallback`'i durdurmaz.
- **Düzeltme:** Shell'den `TabActiveContext` (sekme adı → aktif mi) sağla; `useScreenFocused` = `navigation.isFocused() && tabActive`. Böylece `useLoopActive`, `useAmbientPlaying`, `useStreakFlameMotion`, `ScreenSnow` park mantığı tek yerden düzelir. Feed dinleyicisini (`useLiveFeed`) de aynı sinyale bağla.
- **İş:** küçük–orta · **Etki:** çok yüksek · **Kabul:** Hub'da beklerken diğer sekmelerin `frame.setActive(false)`; 4 sn sonra gizli sekme tuvalleri park.

### Y2 · Android: sekme çubuğu blur'ü her karede tüm sekme içeriğini yeniden bulanıklaştırıyor
- **Kanıt:** `AndroidBackdrop recordingEnabled` uygulama öndeyken hep açık (`AdaptiveTabShell.js:196`); `BlurTargetSurface "screen"` atmosfer tuvalini de içeriyor. Atmosfer her kare değiştiği için blur kaynağı her kare kirleniyor (11 Kas ısınma notunda "yapılmayanlar" listesindeydi).
- **Düzeltme seçenekleri (cihazda A/B):** (a) atmosfer katmanını BlurTarget'ın **dışına/üstüne** taşı (çubuk arkasında atmosfer bulanık görünmez ama net görünür); (b) atmosfer oynarken çubuğu buzlu-düz arka plana düşür. Y1'den sonra yalnız **görünen** sekmenin tuvali kalacağı için etkisi ölçülüp karar verilmeli.
- **İş:** orta · **Etki:** yüksek (yalnız Android glass modu).

### Y3 · Detay kahramanı aynı görseli 7 kez çiziyor, 6'sı bulanık
- **Kanıt:** `components/detail/DetailHeroStage.js:210-366` — net backdrop + 2–3 ambiyans `blurRadius` + **4 kenar "feather" görseli** (`EDGE_BLUR_INNER/OUTER`, tam backdrop yüksekliğinde, `:320-366`). `blurRadius` decode sonrası CPU'da uygulanır; feather'lar **tam çözünürlüklü** `uri`'den bulanıklaşıyor (ambiyans artık w300 kullanıyor, feather'lar kullanmıyor).
- **Düzeltme:** feather'lar da `ambientUri` (w300) kullansın — gözle fark edilmez; ya da 4 görsel yerine 1 bulanık kopya + `LinearGradient` maske. Film/dizi detayı en sık açılan ekran olduğu için açılış takılması ve bellek düşer.
- **İş:** küçük · **Etki:** yüksek.

### Y4 · Evren sahneleri (OVERLAY 17–30) — ölçüme bağlı
- `components/decor/universeOverlays.js` (2.567 satır, 86 Reanimated/Skia ilkel) tam ekran yol + `BlurMask` + gradyan; yollar bir kez kuruluyor (iyi). Y1 sonrası tek tuval kalınca GPU frame süresini cihazda ölç; `BlurMask`'lı hüzmeleri önceden rasterleştirilmiş sprite'a çevirmek yedek seçenek. Kare hızı **düşürülmeyecek**.

---

## Faz 1 — Tekrarlayan CPU işi (küçük, güvenli, ölçülmüş)

| # | Sorun | Yer | Düzeltme |
|---|---|---|---|
| Y5 (F02) | Her bölüm satırı dizinin **tüm** geçmişini yeniden hazırlıyor (1.000 bölümde ~87 ms → indeksle ~0,5 ms) | `hooks/useWatchedShow.js:90-93` | `useMemo` içinde `eventsByEpisode/BySeason` indeksi |
| Y6 (F05) | Snapshot ilk okumada dosya 2 kez okunup parse ediliyor | `services/snapshotCache.js:67,72` | tek `getEntry` → veri + yaş |
| Y7 (F06) | Normal kalitede still/backdrop `original` iniyor; **genişlik verilmezse de `original`** | `utils/tmdbImageUtils.js:39-62` | önizlemede en büyük `wXXX` tavanı; genişliksiz çağrı → güvenli varsayılan (ör. w780) |

## Faz 2 — Sohbet, yorumlar, ağ

| # | Sorun | Yer | Düzeltme |
|---|---|---|---|
| Y8 | Sohbette her yeni mesaj **tüm görünür satırları** yeniden çizdiriyor: `renderItem` bağımlılığında `memoizedMessages` (+ `highlightedMessageId`, `avatars`) | `screens/chat/ChatScreen.js:2044-2137` | komşu mesajları satıra prop olarak ver (`prev/next`), satırı `memo`; renderItem'ı mesaj dizisinden bağımsız yap |
| Y9 | ChatScreen 4.737 satır, 40 `useState`, 5 dinleyici; yazarken üst bileşen yeniden render | aynı dosya | composer'ı ayrı bileşene ayır (9 Kas'ta cihaz testi şartıyla ertelenmişti) |
| Y10 (F04) | Gönderi yorumları limitsiz dinleniyor | `services/postsService.js:631` | sayfa + cursor, yanıtlar açılınca |
| Y11 | Film/dizi yorumları "daha fazla" dedikçe **daha büyük limitle yeniden abone oluyor** (önceki belgeler yeniden işlenir); yanıt dinleyicisi `setState` güncelleyicisi içinde açılıyor | `components/Comment.js:816,835,936-956` | cursor'lı ek sayfa (`startAfter`) + yan etkiyi updater dışına al |
| Y12 (F08) | Detay isteğinde kullanılmayan `account_states, alternative_titles, changes, keywords, lists`; taze cache yolu ve iptal yok | `screens/movie/MovieDetail.js:464`, TvShowsDetails | alanları kırp, SWR cache, AbortController |
| Y13 (F09) | Bölüm grafiği tüm sezonları aynı anda istiyor, biri bozulursa hepsi düşüyor | `screens/tv/TvGraphDetailScreen.js:328-343` | 3–4 eşzamanlı, sezon bazında hata |

## Faz 3 — Büyük kütüphane / uzun listeler

| # | Sorun | Yer | Düzeltme |
|---|---|---|---|
| Y14 (F03) | Kökteki istatistik zinciri her bölüm işaretinde tüm dizileri yeniden hazırlıyor; `flattenTvEpisodeWatchEntries` aynı işi tekrar yapıyor | `context/ProfileStatsContext.js:326-382` | dizi bazında memo, flatten `tvHistoryStates`'ten |
| Y15 (F07) | Sezon bölümleri ScrollView'da hepsi birden (FlatList yok) | `screens/tv/SeasonDetails.js` | tek FlatList, başlık = ListHeader |
| Y16 | ScrollView + çok sayıda `.map` ile büyük içerik: MyActivity (13), StoryShare (25), ProfileStoryModal (22), AICineCards (21), PosterSettings (15) | ilgili ekranlar | uzun/kullanıcı verisine bağlı olanları sanallaştır; sabit kısa listeler kalabilir |

## Faz 4 — Hub, zamanlayıcılar, ön yükleme

| # | Sorun | Yer | Düzeltme |
|---|---|---|---|
| Y17 | Hub tek ScrollView'da 9 widget hepsi kurulu; ekran dışındakiler de veri/animasyon çalıştırıyor | `screens/tabs/HubScreen.js:97-201` | görünürlüğe göre tembel kurulum / animasyon kapısı |
| Y18 (F12) | Her `Skeleton` kendi sonsuz döngüsü; CountdownTimer saniyede bir; kart saatleri 30 sn | `components/Skeleton.js:30`, `components/tournament/CountdownTimer.js` | paylaşılan tek pulse; saatler `useLoopActive` ile |
| Y19 (F10) | Discover ikinci medya sayfası 6 sn sonra kurulup `display:none` saklanıyor | `screens/tabs/DiscoverScreen.js:95,160` | talep üzerine kur |

## Faz 5 — Yapısal (orta vadeli)

- **Büyük ekranları bölme** (her biri tek bileşende çok state → her etkileşimde geniş render): ListsScreen 2.489 satır/32 state, CineSwipeScreen 32, StoryShareScreen 28, CreatePostModal 28, FriendProfileScreen 26. Hedef: sık değişen state'i (input, seçim) küçük memo'lu alt bileşenlere taşımak — dosya uzunluğu tek başına sorun değil.
- **FlashList:** 106 dosyada FlatList, 0 FlashList. Önce Y8/Y15 sonrası cihazda ölç; yalnız ağır listelerde (sohbet, kütüphane ızgarası, akış) dene.
- **Çift Firebase SDK** (web `firebase` + RNFirebase): açılış CPU'su/bundle — bilinçli ertelenmiş büyük göç.
- **Önbellek tavanları (F11):** `apiCache.mem`, dış puan Map'leri ve network dosyalarına LRU/bayt sınırı.

---

## Önerilen sıra

| Adım | İçerik | Neden önce |
|---|---|---|
| 1 | **Y1 + Y3** | Isınmanın en olası kaynağı; küçük değişiklik, büyük etki |
| 2 | Y5 + Y6 + Y7 | Saf hesap/URL düzeltmesi, testle doğrulanır |
| 3 | Y8 + Y11 + Y10 | Sohbet/yorum akıcılığı ve okuma maliyeti |
| 4 | Y2 (cihazda A/B) + Y4 ölçümü | Y1 sonrası kalan GPU yükü |
| 5 | Y14 + Y15 + Y16 | Büyük kütüphaneli kullanıcılar |
| 6 | Y12 + Y13 + Y17–Y19 | Ağ ve arka plan işi |
| 7 | Faz 5 | Ölçümle seçilen yapısal işler |

Her adım ayrı commit; her adımdan sonra aynı cihazda `adb shell dumpsys gfxinfo com.smlztrk.seelogd framestats` ve 10 dk kullanım sıcaklık/pil gözlemi.
