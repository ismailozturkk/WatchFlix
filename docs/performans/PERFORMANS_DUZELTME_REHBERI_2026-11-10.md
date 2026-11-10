# Seelogd — Performans analizi ve düzeltme rehberi

**Tarih:** 10 Kasım 2026  
**İncelenen sürüm:** 1.5.0 · Expo 57 · React Native 0.86.3 · React 19.2.3  
**Kaynak:** `codex/release-candidate-1.4.3`, HEAD `f52fa88b` ve inceleme anındaki kaydedilmemiş çalışma ağacı değişiklikleri.

## 1. Sonuç ve kapsam

En yüksek getirili işler **sekme görünürlüğünü doğru iletmek**, **bölüm başına bütün dizi geçmişini tekrar hazırlamayı kaldırmak**, **büyük kütüphanede tekrar eden hesapları azaltmak** ve **yorumları sayfalamak**. Görsel tarafta küçük kartların bazı koşullarda `original` görsel istemesi ve ekran dışındaki sürekli efektler ayrıca ele alınmalı.

Bu çalışma bir **düzeltme rehberidir**; uygulamanın çalışma koduna performans düzeltmesi uygulanmadı. Tekrar çalıştırılabilir, yerel ve sentetik bir ölçüm betiği eklendi. Canlı Firebase verisine erişilmedi, dağıtım yapılmadı.

### Kanıtların sınırı

- `components`, `screens`, `hooks`, `context`, `services`, `utils` altında **1.143 JavaScript dosyası** mekanik olarak tarandı. Riskli çağrıların sahipleri ve çağıranları seçilerek okundu; bu sayı 1.143 dosyanın tamamının satır satır incelendiği anlamına gelmez.
- Açılış, sekmeler, keşif, detay, sezon/bölüm, sohbet, akış, kütüphane/istatistik, yerel saklama, istekler ve görsel efektler incelendi. İçe/dışa aktarma ve sunucu sorgularına sınırlı tarama yapıldı; sunucu için yük testi yapılmadı.
- ADB'de yalnız `emulator-5554` görüldü. Kurulu `com.smlztrk.seelogd` 1.5.0 **DEBUGGABLE**; fiziksel cihaz/release ölçümü yapılmadı. Emülatördeki ikilinin güncel çalışma ağacını temsil ettiği de kanıtlanmadı.
- **Gerçek CPU yüzdesi, GPU yüzdesi, FPS, pil tüketimi, termal davranış ve açılış süresi bu çalışmada ölçülmedi.** Bunlar aşağıdaki cihaz planıyla doğrulanmalı. Koddan yüzdelik tasarruf veya kesin FPS kazanımı çıkarılamaz.
- **K:** kod yolu doğrulandı. **S:** sentetik ölçüm/çıktı doğrulaması da var. **Ö:** cihazda ölçülmesi gereken aday; gerçekleşmiş bir performans arızası olarak sunulmuyor.
- P1 önce ele alınacak; P2 sonraki iyileştirme; P3 ölçüme bağlı. Öncelikler bir mağaza yayın engeli kararı değildir.

## 2. Öncelik tablosu

| ID | Öncelik / kanıt | Sorun | Baskın maliyet | Önerilen iş boyutu |
|---|---|---|---|---|
| F01 | P1 / K | Özel sekmelerin seçili durumu odak kancalarına ulaşmıyor | Boşta CPU/GPU, gereksiz abonelik | Orta |
| F02 | P1 / K+S | Her bölüm satırı bütün dizinin geçmişini tekrar hazırlıyor | JS CPU, dokunma gecikmesi | Küçük–orta |
| F03 | P1 / K+S | Kök sağlayıcılarda kütüphane genelinde tekrar hesaplama | JS CPU, geçici nesneler/GC | Orta–büyük |
| F04 | P1 / K | Gönderi yorumları sınırsız dinleniyor; yanıtlar topluca çiziliyor | Ağ, JS, RAM | Orta |
| F05 | P1 / K+S | Snapshot'ın ilk okumasında çift dosya okuma/JSON parse | Açılış JS CPU ve I/O | Küçük |
| F06 | P1 / K+S | Normal kalite küçük görsellerde de `original`a çıkabiliyor | Ağ, decode, RAM/GPU dokusu | Küçük–orta |
| F07 | P2 / K | Sezonun tüm bölüm kartları `ScrollView` içine basılıyor | Mount/layout, RAM | Orta |
| F08 | P2 / K | Detaylar her açılışta ağ bekliyor; geniş cevap ve eksik iptal | Ağ gecikmesi, JS/JSON | Orta |
| F09 | P2 / K | Bölüm grafiğinde bütün sezonlar eşzamanlı ve topluca bekleniyor | Ağ patlaması, geç ilk içerik | Orta |
| F10 | P2 / K | Sabit zamanlı ön yükleme ve statik ekran importları | İlk saniyelerde CPU/RAM | Orta |
| F11 | P2 / K | Birden çok önbellek sahibi; kapasite sınırı eksik | Yazma, uzun oturum RAM/disk | Orta |
| F12 | P2 / K+Ö | Animasyon/zamanlayıcılarda görünürlük kapısı eksikleri | Boşta CPU, UI thread, GPU | Orta |
| F13 | P3 / Ö | Görünen ekranda cam, parçacık, katman ve layout animasyonu bütçesi | GPU/UI/JS | Ölçüme bağlı |

İş boyutu uygulama ve regresyon kapsamını anlatır; saat/gün taahhüdü değildir.

## 3. Bulgular ve uygulanacak düzeltmeler

### F01 — Sekme görünürlüğü ile navigasyon odağı farklı kaynaklarda

**Kanıt:** `components/navigation/AdaptiveTabShell.js:48`, `:73`, `:185`, `:200`; `screens/navigation/TabScreenNavigator.js:23`; `hooks/useScreenFocused.js:15`; `context/PostsContext.js:669`; `components/hub/FeedWidget.js:57`.

Sekme seçimi shell içindeki `state.activeTab` ile değişiyor. Çocuklara sekmeye özel bir `NavigationContext` veya aktiflik bağlamı verilmiyor. `useScreenFocused` üst navigasyonun `isFocused/focus/blur` değerlerini okuyor. `useLiveFeed` de üst navigasyonun `useFocusEffect` kancasına bağlı. Kök sekme ekranı odakta kaldığı sürece **Hub → Profil geçişi bu tüketiciler için ayrı bir blur değildir**.

Android fallback yolundaki `freezeOnBlur/shouldFreeze` React çizimini azaltır; var olan effect aboneliğini kapatacağı veya UI thread animasyonunu iptal edeceği varsayılamaz. iOS `Tabs.Screen` yolu da kaynakta sekme bazlı React Navigation odağı kurmuyor. Sonuç olarak önce açılmış bir sekmenin feed talebi veya dekor saati açık kalabilir. Görünmeyen yüzeyin GPU tarafından gerçekten çizilip çizilmediği platform trace'i gerektirir; görünürlük sinyalinin eksikliği ise kodda açıktır.

**Düzeltme:**

1. Tek bir görünürlük modeli kur: üst rota odakta **ve** ilgili sekme seçili **ve** uygulama aktif. Keşif içindeki film/dizi sayfası için seçili medya türünü de dahil et.
2. `useScreenFocused`, `useLoopActive` ve `useLiveFeed` gibi farklı yolları aynı modelden besle. Yalnız dekoru düzeltmek feed listener'ını düzeltmez.
3. Ya gerçek navigasyon odak olayları üreten sekme entegrasyonu kullan ya da açık bir sekme görünürlük deposu ve ortak effect kancası ekle. Dondurulan alt ağacın render/effect cleanup çalışmasını bekleme; yaşam döngüsü sahibini freeze sınırının dışında tut veya dondurmadan önce durdur.
4. Feed'in 60 saniyelik yeniden bağlanma toleransını koruyabilirsin; talep sıfırlanmalı ve süre sonunda dinleyici kapanmalı. Mesaj/bildirim gibi uygulama genelindeki zorunlu abonelikleri bu kurala körlemesine dahil etme.

**Kabul:** Hub → Profil → Kütüphane geçişlerinde yalnız seçili sekme aktif; feed için başka tüketici yoksa 60 sn sonra abonelik kapanmış; gizli sekmenin dekor saati ilerlemiyor. Android fallback ve iOS native tabs ayrı ayrı sınanmalı. Mevcut sekme testleri state/mount koruması sağlıyor; gerçek odak/lifecycle senaryosu ayrıca gerekli.

### F02 — Bölüm başına bütün dizi geçmişi yeniden hazırlanıyor

**Kanıt:** `screens/tv/SeasonDetails.js:709`, `:731`; `hooks/useWatchedShow.js:50`, `:90`; `utils/watchHistory.js:67`, `:170`.

`useWatchedShow` geçmişi bir kez hazırlıyor; ancak döndürdüğü `episodeWatchEvents` tekrar `tvWatchEvents(materializedDoc, …)` çağırıyor. O fonksiyon tekrar `materializeTvWatchState` ile bütün sezonları/bölümleri işliyor. Sezon ekranı bunu her satır için çağırıyor. İş yükü yalnız görüntülenen bölüm sayısına değil, dizinin toplam geçmişine de bağlı: yaklaşık **satır sayısı × tüm geçmişi hazırlama maliyeti**; içerideki event taramaları bazı verilerde daha da pahalı olabilir.

**Düzeltme:** Mevcut `historyState.watchEvents` üzerinden `eventsByEpisode` ve `eventsBySeason` indekslerini aynı `useMemo` içinde bir kez oluştur. Satır getter'ları indeksten dönsün. Boş sonuçlar için ortak sabit boş dizi, değişmeyen satırlar için sabit referans kullan. İzleme/silme/tekrar izleme sonrasında yalnız ilgili dizi revizyonunda yeniden üret.

**Kabul:** Ekran render'ında bölüm başına `materializeTvWatchState` çağrısı yok. Eski şema, bölüm/sezon/dizi kapsamındaki toplu izleme, tekrar izleme, tarih sırası ve silme sonuçları aynı. Benchmark karşılaştırması sentetik fixture'da **tüm event verisi ve sırası** için eşitliği doğruluyor; uygulama düzeltmesinin bütün kenar durumlarını kanıtlamıyor.

### F03 — Kök istatistik/rozet zinciri büyük kütüphaneyi tekrar tarıyor

**Kanıt:** `App.js:1159`, `:1164`; `context/ProfileStatsContext.js:321`, `:326`, `:336`, `:361`; `hooks/useWatchProgress.js:244`; `utils/watchHistory.js:193`.

`tvHistoryStates` tüm diziler için geçmiş hazırlıyor. Hemen ardından `flattenTvEpisodeWatchEntries` aynı diziler için tekrar geçmiş hazırlıyor. Puan motoru da `listItems/listItemsTv` değişiminde bütün kütüphaneyi tarıyor. `useMemo` ilgisiz render'ları azaltıyor, fakat tek bölüm güncellemesiyle dizi dizisinin kimliği değiştiğinde bu tam taramaları engellemiyor. Sağlayıcılar kökte olduğu için bu maliyet yalnız istatistik sayfasına ait değil.

**Düzeltme:**

1. Hazırlanmış dizi geçmişini tek kaynakta üret; flatten ve sayaçlar bu kaynağı kullansın.
2. Dizi kimliği + revizyon/değişmeyen nesne referansı ile dizi bazında memoization yap. Tek dizi değişince diğerlerinin hazırlanmış sonuçlarını koru.
3. Profilde gereken küçük sayaçları, ayrıntılı grafik/geçmiş dizilerinden ayır. Detaylı türetmeleri gerçekten tüketen ekran isteyince üret.
4. Tam puan yeniden hesabını ilk doğrulama/göç veya toplu değişim yolu olarak tut; günlük değişimler için artımlı sonuç veya birleşik hesaplama kuyruğu değerlendir. Rozet kazanma ve seri doğruluğunu geciktirip bozma.

**Kabul:** 1.000 film + 5.000 bölüm fixture'ında tek bölüm değişimi, değişmeyen dizilerde materialization başlatmıyor. Sayaç/puan/rozet sonuçları tam hesapla aynı. 5.000 film + 20.000 bölüm senaryosunda açılış ve işaretleme ayrıca cihazda ölçülmeli.

### F04 — Gönderi yorumları ve açık yanıt kümesi sınırsız

**Kanıt:** `services/postsService.js:631`; `components/modals/PostCommentSheetModal.js:378`, `:547`, `:570`, `:774`.

Sorgu yalnız `orderBy(createdAt, asc)` kullanıyor; `limit` ve cursor yok. Her snapshot tüm belgeleri yeniden nesnelere çeviriyor. Ana yorumlar FlatList olsa da bir yorumun açılan yanıtları `replies.map` ile aynı satıra topluca yerleştiriliyor. Modal kapanınca unsubscribe var; sorun kapanış sızıntısı değil, açıkken veri ve çizim miktarının sınırsız olması.

**Düzeltme:** Ana yorumlara 20–30 kayıtlık sayfalar ve cursor; yanıtları yalnız açılınca ayrı sayfalı sorgu ile getir. Yeni olaylar için küçük canlı pencere, eski sayfalar için tek seferlik okuma kullan. Flat şemada `parentId` alanının eski belgelerde eksik olmasını hesaba kat; `parentId == null` sorgusuna geçmeden uyumluluk/göç ve Firestore indeksi hazırlanmalı. `limit(30)` ekleyip ilk 30 eski kayda sıkıştırma; yeni yorum görünürlüğünü tasarla. Yanıtları görünür satır modeline düzleştirmek veya ayrı yanıt ekranı, tek dev satırdan daha güvenli.

**Kabul:** 10.000 yorumlu fixture'da ilk açılış sınırlı sayıda belge getiriyor; bir yorumun 500 yanıtı bir kerede mount edilmiyor. Kendi yeni yorumuna gitme, düzenleme/silme, sıralama ve cursor sınırlarında tekilleştirme korunuyor. Rules/emülatör testi gerekli; üretimde bu büyüklükte test verisi oluşturma.

### F05 — Snapshot'ın ilk okuması aynı dosyayı iki kez ayrıştırıyor

**Kanıt:** `services/snapshotCache.js:62` → `getJSON` (`:67`) ve `getAge` (`:72`); `utils/cacheStore.js:145`, `:165`, `:173`.

İki API de `getEntry` çağırıyor; her çağrı `file.textSync()` + `JSON.parse` yapıyor. Bellek cache'i sonraki `seed` çağrılarını koruyor, fakat **her anahtarın oturumdaki ilk okuması iki kez** dosya okuyor ve ayrıştırıyor. Büyük listelerde açılışın JS thread yükünü artırır.

**Düzeltme:** Veri ve zaman damgasını tek okuma ile döndüren `getEntry/readRecord` benzeri API sun. `seed`, `{t,v}` kaydından hem veri hem yaş hesaplasın. Eski kalıcı klasörden göçte zaman damgası ve hata davranışı korunsun.

**Kabul:** Soğuk bellekte bir `seed` için tek `textSync/parse`; sonraki okumada sıfır disk erişimi. Eksik/bozuk kayıt, eski klasörden göç ve kullanıcı ayrımı testleri korunmalı. Yalnız API dönüşlerini test etmek yerine alttaki gerçek okuma sayısını sayan mock kullan.

### F06 — Küçük görseller normal kalitede `original` istiyor

**Kanıt:** `utils/tmdbImageUtils.js:9`, `:39`, `:62`; `services/storage/registry.js:200`; `components/tv/UpNextRailCard.js:303`; `screens/tv/EpisodeDetails.js:246`; `screens/tv/TvGraphDetailScreen.js:555`.

Varsayılan kalite `good`. DPR 3 ile `still, 300` hedefi 900 piksel oluyor; listedeki en büyük still 300 olduğu için `original` seçiliyor. `backdrop, 1000` da 3.000 hedefleyip aynı sonuca gidiyor. Bu yalnız kullanıcının açıkça “orijinal kalite” seçmesi değil; normal akışta da oluşuyor.

**Düzeltme:** Önizleme/kart için en büyük uygun CDN türevine tavan koy. `original` yalnız açık kalite tercihi, indirme veya gerçek yakınlaştırma için seçilsin. Çağıranların sabit 1000/300 tahminlerini gerçek çizim genişliğiyle kontrol et; still/poster/backdrop türlerini semantiğine göre kullan. `screens/tv/SeasonDetails.js:116` still görselini `poster` türüyle istiyor; bunu da düzeltme kapsamına al. Büyük görüntüyü zoom sırasında yükseltmek, küçük önizlemeyi baştan büyük indirmekten daha kontrollü.

**Kabul:** DPR 1/2/3/4 × kalite × görsel türü matrisi; önizlemede beklenmedik `original` URL yok, bilinçli indirme/zoom yolu korunuyor. Decode boyutu, ağ baytı ve RSS/graphics belleği fiziksel cihazda karşılaştırılmalı. Decode downsampling varsa gerçek RAM kazancı kaynak dosya boyutuyla birebir olmayacaktır.

### F07 — Sezon bölümleri sanallaştırılmıyor

**Kanıt:** `screens/tv/SeasonDetails.js:458`, `:709`.

Bütün bölüm kartları, görselleri ve kontrolleri ScrollView altında kuruluyor. 8 bölümlük sezonla yüzlerce bölümlük sezon aynı stratejiyi kullanıyor. F02 giderilse bile mount/layout ve görsel belleği maliyeti kalır.

**Düzeltme:** Tek dikey FlatList; sezon kahraman alanı ve özetler `ListHeaderComponent`, bölümler satır. İlk render ve pencere boyutunu cihaz ölçümüyle seç. Dinamik yüksekliğe sahip bölüm kartlarına yanlış `getItemLayout` ekleme. `onPress` ve geçmiş dizilerini sabitleyerek mevcut memo'nun çalışmasını sağla.

**Kabul:** 300 bölüm fixture'ında ilk mount sayısı viewport/pencereyle sınırlı; hızlı kaydırmada boşluk ve basma gecikmesi ölçülüyor. Büyük yazı boyutu, açılan kart, izleme butonları ve geri dönüşte scroll konumu doğru. FlatList ayarları CPU/RAM/boş satır arasında denge kurar; her ekrana aynı değerleri uygulama. [React Native 0.86 liste rehberi](https://reactnative.dev/docs/0.86/optimizing-flatlist-configuration).

### F08 — Detay ekranında taze cache yolu yok; istekler gereğinden geniş

**Kanıt:** `screens/movie/MovieDetail.js:441`, `:454`, `:474`; `screens/tv/TvShowsDetails.js:315`, `:328`, `:342`; `utils/axiosDataCache.js:34`; `components/video/TrailerSection.js:349`, `:379`.

Film/dizi detay efekti her mount/id/dil değişiminde yükleme açıp doğrudan axios çağırıyor. Global interceptor başarılı cevabı saklıyor ama istek öncesinde taze cache döndürmüyor; yalnız bağlantı hatasında cache'e düşüyor. Dolayısıyla aynı detayı yeniden açmak ağ bekletebilir. `append_to_response` içinde `account_states, alternative_titles, changes, keywords, lists` gibi ekranlarda tüketimi bulunmayan alanlar var. Fragman bölümü ayrıca dil bazlı `/videos` isteği yapıyor. Cleanup'taki `cancelled` yalnız state güncellemesini engelliyor; HTTP isteğini durdurmuyor.

**Düzeltme:** Detay anahtarı tür/id/dil ve cevap seçeneklerini içeren kısa TTL + stale-while-revalidate cache kur; eşzamanlı aynı isteği bir promise altında birleştir. İlk içerik hazırken arka plan yenilemesi göster. Gereksiz append alanlarını alan kullanım testiyle çıkar; hero/galeri/çeviri kullanan alanları koru. Ayrı videos yoluna taşınmış alanın tekrar taşınmasını önle. Cleanup'ta AbortController kullan ve iptali hata toast'ından/cache fallback'inden ayır. Sırf iptal edildi diye eski cache'i “başarılı yeni cevap” gibi uygulama.

**Kabul:** Aynı detayın TTL içi tekrar açılışı yeni GET beklemiyor; galeride/fragmanda/dil fallback'inde kayıp yok. Hızlı ileri-geri gezintide eski isteğin kaynak tüketimi duruyor. Kötü ağda ilk içerik, yenileme ve hata halleri ayrı.

### F09 — Bölüm grafiği bütün sezonları aynı anda istiyor

**Kanıt:** `screens/tv/TvGraphDetailScreen.js:294`, `:326`, `:341`; `services/externalRatings.js:36`, `:62`.

Önce dizi bilgisi; sonra her sezon için TMDB + dış puan servisi birlikte başlıyor. Dizi IMDb kimliği varsa ve cache boşsa S sezon için yaklaşık **2S + 2 istemci çağrısı** oluşabilir. Dış puanın kendisi null/önbellek olabilir; her açılışta bu sayıda ağ çağrısı yapılır demek doğru değil. İlk sonuç için bütün sezonların ve başlık puanının bitmesi bekleniyor. Bir TMDB sezonu hata verirse üst `Promise.all` bütün görünümü hata durumuna götürebilir. TMDB iptal denetimi zaten var; bu bir “hiç iptal yok” bulgusu değil.

**Düzeltme:** 3–4 eşzamanlı sezon işiyle başla ve ölçerek ayarla. Görünür/ilk sezonu önce getir; TMDB verisini çiz, dış puanı sonra zenginleştir. Sezon bazında durum/hata tut; başarılı sezonları koru. Dış puan ve TMDB için devam eden istekleri anahtar bazında birleştir. İptal desteği olmayan callable sonuçlarını generation kontrolüyle yok say; fiziksel iptal edilmiş gibi raporlama.

**Kabul:** 30 sezon + bir yavaş/bozuk sezon fixture'ında ilk içerik tüm istekleri beklemiyor; eşzamanlılık sınırı korunuyor; tekrar deneme yalnız başarısız sezonları hedefleyebiliyor.

### F10 — “Lazy” yüklemenin sabit süreli ön yükleme ile sınırı var

**Kanıt:** `App.js:86`; `screens/navigation/TabScreenNavigator.js:6`; `components/navigation/AdaptiveTabShell.js:131`; `screens/tabs/DiscoverScreen.js:66`, `:92`, `:140`; `context/TypographyContext.js:30`, `:148`, `:166`.

Tab ekranları üstten statik import ediliyor. Shell 6.000/7.200/8.400 ms civarında diğer sekmelerin kurulmasını talep ediyor. Android freeze ilk çizimi erteleyebilir; her platformda bütün effect'lerin tam bu anda başladığı söylenemez. Daha doğrudan yol: Discover 6 saniye sonra ikinci film/dizi sayfasını mount ediyor ve yalnız `display:none` ile saklıyor. Görünmeyen MovieProvider/ekranın etkileri durdurulmuyor.

Bu davranış ilk yükü erteleyip sekme geçişini hızlandırmak için yapılmış olabilir; ancak erteleme işin toplamını azaltmaz ve kullanıcı kaydırırken yeni iş başlatabilir. Font manifestinde 89 statik require var; **hepsi açılışta Font.loadAsync ile yüklenmiyor**. Seçili roller önce yükleniyor, tam katalog yalnız talepte. “89 font açılışta yükleniyor” denmemeli.

**Düzeltme:** Keşfin ikinci medya sayfasını talep üzerine kur veya kullanıcı etkileşimi/cihaz bütçesi uygun olduğunda sınırlandırılmış ön yükleme yap. Ekran kodlarını ilk ihtiyaçta require eden sabit loader'larla modül değerlendirmesini ertele. Boş zaman planlamasında iptal ve öncelik olsun; sadece daha uzun setTimeout ekleme. İlgili Expo/Metro build'inde inline-require ve modül değerlendirme trace'ini incelemeden bundle/açılış kazancı iddia etme.

**Kabul:** İlk 15 saniye sadece keşifte kalındığında görünmeyen medya/sekme için yeni ağ/CPU patlaması yok. Sonraki ilk sekme açılışındaki bedel ayrıca ölçülüyor; toplam iyileşme bir ekrandan diğerine taşınmış gecikme olmamalı.

### F11 — Önbellek sahipliği ve kapasite politikası dağınık

**Kanıt:** `utils/axiosDataCache.js:42`; `utils/cachedRead.js:60`, `:77`; `utils/apiCache.js:29`, `:89`, `:131`; `services/snapshotCache.js:90`; `utils/sameData.js:12`; `services/externalRatings.js:10`; `services/storage/registry.js:243`.

- Otomatik veri saklama **açıksa**, bir cachedTmdb isteği hem global `network` cache'ine hem `tmdb` cache'ine yazılabilir. Bazı üst seviye akışlar ayrıca apiCache kullanıyor. Otomatik saklama varsayılan kapalı; bu yazma yükü bütün kullanıcılar için varsayılan değildir.
- SDK 57 yerel kurulumunda `File.write` senkron (`node_modules/expo-file-system/src/internal/NativeFileSystem.types.ts:208`); `JSON.stringify` de JS thread üzerinde. Fonksiyonun `async` bir çağıran içinde olması bunları başka thread'e taşımaz.
- `snapshotCache.publish` diski 300 ms geciktiriyor ama `sameJson` denetimini çağrı anında yapıyor; iki tam stringify maliyeti debounce edilmemiş.
- `apiCache.mem`, dış puan Map'leri ve network dosyaları için bu sahiplerde kapasiteye dayalı LRU/byte tavanı yok. TTL, kendiliğinden periyodik tahliye değildir. Kullanıcı temizleme yolları var; bunu kesin bir bellek sızıntısı diye adlandırmak doğru olmaz, uzun oturum büyüme riski var.

**Düzeltme:** Bir ağ cevabının tek kalıcı sahibi olsun. Diğer katmanlar aynı kaydı/referansı kullansın; request seçenekleri ve dil cache anahtarında yer alsın. Yeniden indirilebilir cache'e öğe/byte tavanı ve LRU ekle; kullanıcının açıkça offline indirdiği içeriği koruyacak pin/ayrı alan tasarla. Veri değişimini revizyon/referans ile izle; büyük JSON karşılaştırmasını mümkün olduğunca kaldır. Büyük kayıtları parçalara ayır, iptal edilebilir düşük öncelikli yazma kuyruğu kullan.

**Kritik sınır:** Yerel kullanıcının değişikliklerini taşıyan outbox/journal, notlar ve izleme geçmişi sıradan tahliye edilebilir cache değildir. Daha hızlı olsun diye dayanıklılık yazımını erteleyip veri kaybı oluşturma. MMKV'ye topluca taşımak da serialization maliyetini kendiliğinden kaldırmaz. SDK yükseltmeden `writeSync` gibi yalnız yeni sürümde olan API'yi kullanma.

**Kabul:** Aynı yanıt için tek kalıcı yazma; uzun gezintide cache byte/öğe sayısı tavanı aşmıyor; offline pinlenmiş içerik korunuyor; arka plana geçiş/ani kapanış sonrası bekleyen kullanıcı işlemleri kaybolmuyor.

### F12 — Sürekli döngüler ve saatler için ortak yaşam döngüsü eksik

**Kanıt:** `components/Skeleton.js:26`; `components/tournament/CountdownTimer.js:91`; `components/game/DailyFrameCard.js:26`; `components/hub/TournamentWidget.js:68`; `components/hub/CineSwipeWidget.js:68`; `components/hub/HubWrappedModule.js:660`; `hooks/useLoopActive.js:22`.

Skeleton her örneğe ayrı sonsuz native loop kuruyor; unmount cleanup var ama görünürlük/uygulama aktifliği kapısı yok. CountdownTimer her saniye, diğer kart saatleri 30 saniyede bir çalışıyor. CineSwipe ve Wrapped bazı döngülerde yalnız rota odağına bakıyor; AppState ve viewport kontrolü eksik. Hub ScrollView içindeki ekranın aşağısında kalan widget'lar da mount kalıyor. İşletim sistemi arka planda uygulamayı askıya alabilir; buradan “kesintisiz arka plan CPU tüketimi ölçüldü” sonucu çıkmaz.

**Düzeltme:** Önce F01. Sonra `active = routeFocused && selectedTab && appActive && visible && !reduceMotion` gibi kullanım yerine uygun ortak politika. Saatleri ihtiyaç çözünürlüğünde güncelle; geri dönüşte `Date.now()` ile telafi et. Skeleton gruplarında tek pulse paylaş, sürekli Animated döngüsünde uygun olduğunda `isInteraction:false` kullan. Viewport dışı kartın animasyonunu durdururken içerik/state'i koru.

**Kabul:** Sekme değişimi, üstüne modal açılması, ekran kilidi ve tekrar dönüş senaryolarında canlı timer/loop sayısı başlangıç düzeyine dönüyor. Geri sayım/seri tarihi doğru; yükleme bitince skeleton kaynakları serbest.

### F13 — GPU/çizim bütçesi: henüz ölçülmemiş adaylar

**Kanıt:** `components/decor/ParticleField.js:154`, `:201`; `utils/weatherParticles.js:547`, `:582`; `components/common/GlassSurface.js:117`, `:135`; `components/common/AdaptiveBlurView.js:68`; `utils/deviceTier.js:39`; `screens/chat/ChatScreen.js:1126`; `screens/movie/MovieDetail.js:342`.

Skia Atlas ve UI thread hesapları mevcut; “her parçacık her kare React render ediyor” teşhisi yanlış. Ancak hareketli tam ekran Canvas, cam/blur, yarı saydam katmanlar ve gölgeler birlikte çizim yükü yaratabilir. `balanced` parçacık sayısını azaltırken hava efektinin saatini hâlâ 60 fps tutuyor; `off` seçimi, hava efekti ayrıca açıksa az parçacıkla 30 fps çalışıyor. Bunlar tasarım tercihleri; tek başına hata kanıtı değil.

Bazı renk/boyut animasyonları `useNativeDriver:false`. Bu da otomatik hata değildir: layout özellikleri doğrudan native Animated sürücüsüne taşınamaz. JS profilinde sorun görünürse worklet tabanlı renk animasyonu, transform veya uygun layout animation değerlendir; körlemesine `true` yapma.

**Düzeltme kararı:** Aynı kaydırma senaryosunda (1) tüm efektler, (2) hava/ambiyans kapalı, (3) blur/cam kapalı, (4) tüm dekor kapalı varyantlarını karşılaştır. CPU rahatken UI/RenderThread/GPU süresi yükseliyorsa yüzey alanı ve overdraw'ı azalt. Önce ekran dışını durdur; ardından düşük cihaz için kullanıcı tercihine saygılı 30 fps/sade görünüm seçeneğini değerlendir. Evrensel rasterization/hardware texture önerisi verme; katman belleğini artırabilir.

**Kabul:** Görsel kalite A/B kontrolüyle birlikte frame deadline kaçırma, GPU/graphics bellek ve uzun kullanım ısınması ölçülmüş olmalı. Bu madde için sayısal kazanç henüz yok.

## 4. Sentetik ölçüm: yeniden üretilebilir kanıt

Çalıştırma: depo kökünde `node scripts/performance-audit.cjs`.

Kaynak: [ölçüm betiği](../../scripts/performance-audit.cjs) · [kaydedilen son çalıştırma](PERFORMANS_BENCHMARK_2026-11-10.json).

Windows, Node **v22.21.1 / V8**, Intel Core Ultra 7 155H; her görev 3 ısınma ve 7 ölçüm, tabloda medyan. Babel yükleme ve fixture üretimi zaman ölçümünün dışında. Ağ, disk, React render, native görünüm, Hermes ve GPU ölçülmüyor. Aynı makinede iki çalıştırma da değişkenlik gösterdi; son kaydın sayıları aşağıda. Bu değerleri telefon performansına veya yüzde pil kazancına çevirmeyin.

| Dizi toplam bölümü | Sezonda sorgulanan satır | Mevcut tekrar hazırlama | Bir indeks kurma + lookup |
|---:|---:|---:|---:|
| 24 | 24 | 1,508 ms | 0,015 ms |
| 240 | 24 | 8,133 ms | 0,078 ms |
| 1.000 | 50 | 86,651 ms | 0,471 ms |

İki kolun ortak başlangıç materialization'ı ölçüm dışında; indeks kolunun indeks kurma maliyeti ölçüm içinde. İlk keşif çalıştırmasında son satır 38,190 / 0,159 ms idi. İki koşum da tekrarlı işin kaldırılmasını destekliyor; tek bir hızlanma oranı garanti edilmiyor. Benchmark sadece fixture'da eşdeğer sonucu üretiyor, uygulamaya indeks düzeltmesi henüz yapılmadı.

| Film / bölüm | JSON büyüklüğü | Çift parse | İki stringify ile eşitlik | Profil türetmeleri* | Puan hesabı |
|---|---:|---:|---:|---:|---:|
| 100 / 1.000 | 162.192 bayt | 3,056 ms | 1,926 ms | 4,420 ms | 5,476 ms |
| 1.000 / 5.000 | 872.332 bayt | 13,473 ms | 10,561 ms | 15,505 ms | 16,238 ms |
| 5.000 / 20.000 | 3.624.182 bayt | 31,036 ms | 32,852 ms | 60,512 ms | 65,070 ms |

\* Film geçmişini düzleştirme + dizi geçmişi hazırlama + bölüm geçmişini düzleştirme + TV sayaçları. Gerçek provider'ın bütün işi değildir. JSON fixture'ı birleşik bir veri kümesidir; uygulamada bütün bunların tek dosya olarak tutulduğu veya tüm maliyetlerin aynı frame'de oluştuğu iddia edilmiyor.

Görsel fonksiyonu da mevcut kaynakla çalıştırıldı: DPR 3 / `good` için `still(300)` ve `backdrop(1000)` → `original`; `poster(200)` → `w780`.

## 5. Zaten bulunan korumalar: geri alınmamalı

| Koruma | Güncel kanıt / sınırı |
|---|---|
| Axios genel 15 sn zaman aşımı | `utils/axiosDefaults.js:15`, `App.js:132`; özel timeout kullanan çağrı kendi değerini korur. “Timeout yok” eski bulgusu güncel değil. |
| Yayında geliştirici kullanım sayacı kapısı | `__tests__/usageTrackerReleaseGate.test.js` bu çalışmada geçti. Eski rapordaki “release'te her istekte maliyet kaydı” yeniden açık bulgu sayılmadı. |
| Liste durumu indeksi | `context/ListStatusContext.js:389`; kart başına tüm listeleri tarama eski önerisini topluca tekrarlamak gereksiz. |
| Yerel veri/outbox ve snapshot birleştirme | `services/userData/createDomain.js:215`, `services/snapshotCache.js:90`; dayanıklılık korunmalı. F05/F11 kalan maliyetler. |
| Alan bazlı context tüketimi | `utils/fieldStore.js:58`; işlev referansları için sabit wrapper var. Her context fonksiyonunu yeniden useCallback'e sarmalamak ilk iş değil. |
| Listeler/sohbet/takvimde sanallaştırma | `screens/lists/ListsScreen.js:1296`, `screens/chat/ChatScreen.js:2596`, `screens/calendar/CalendarScreen.js:827`. |
| Sohbet cursor sayfalama | `services/chatMessagePager.js:35`; eski büyüyen limit sorununu aynen tekrar etme. Çok uzun oturumda canlı sayfaların sayısı ayrıca ölçülebilir. |
| Galeride ekran ve küçük resim çözünürlüğü ayrımı | `components/modals/ImageGalleryModal.js:662`, `:699`; F06 diğer çağrı yollarına odaklı. |
| Fontların rol bazında yüklenmesi | `context/TypographyContext.js:166`; tüm katalog açılışta yüklenmiyor. |
| Skia Atlas, hareket azaltma ve bazı aktiflik kapıları | `components/decor/ParticleField.js:154`, `components/ScreenSnow.js:38`, `components/streak/useStreakFlameMotion.js:11`; F01 ortak odak kaynağını düzeltmeli. |
| Console kaldırma ve gözlemleme | `babel.config.js` production eklentisi; `services/crashReporting.js:102` trace örneklemesi. Ağ zaman aşımı, cache ve render süresi birbirinden ayrılmalı. |

`assets` klasörünün diskteki toplamı yaklaşık 14,88 MiB; bu **APK/IPA boyutu değildir**. Kullanılmayan dosyalar, node_modules fontları ve native kaynak paketlemesi ayrı değerlendirilir. Dosya uzunluğu veya dependency sayısı tek başına performans hatası sayılmadı.

## 6. Uygulama sırası ve regresyon kontrolleri

| Aşama | İşler | Çıkış koşulu |
|---|---|---|
| 0 — Referans ölçüm | Aynı cihaz/build/veriyle başlangıç kayıtları | Soğuk açılış, scroll, idle, ağ ve bellek tablosu dolu |
| 1 — Doğrudan tekrarları kaldır | F02 + F05 + F06 | Fonksiyon eşdeğerliği, okuma sayısı ve URL boyut testleri geçiyor |
| 2 — Yaşam döngüsü | F01 → F12 → F10 | Gizli sekmede subscriber/loop duruyor; ilk ziyaret gecikmesi kabul edilebilir |
| 3 — Büyük veri | F03 + F04 + F07 | Büyük fixture'lar, geçmiş doğruluğu, yorum cursor/yanıt testleri geçiyor |
| 4 — Ağ ve cache | F08 + F09 + F11 | İstek sayısı/eşzamanlılığı sınırlı; offline ve ani kapanışta veri korunuyor |
| 5 — Görsel bütçe | F13 | Trace'te ölçülen yük azalıyor; tasarım/erişilebilirlik kontrolü geçti |

Her aşamayı ayrı küçük değişiklik/PR olarak tut. Aynı anda navigasyon, veri şeması ve animasyon altyapısını değiştirmek regresyon kaynağını gizler. Şema gerektiren F04 için istemci, indeks ve uyumluluk birlikte planlanmalı.

### Bu çalışmada çalıştırılan doğrulama

**10 suite, 201 test geçti:** `watchHistory`, `watchScoring`, `snapshotCache`, `apiCacheSwr`, `fieldStore`, `readCostGuards`, `usageTrackerReleaseGate`, `axiosDefaults`, `userDataSyncWorker`, `tabBarModel`.

```powershell
npx jest --runInBand __tests__/watchHistory.test.js __tests__/watchScoring.test.js __tests__/snapshotCache.test.js __tests__/apiCacheSwr.test.js __tests__/fieldStore.test.js __tests__/readCostGuards.test.js __tests__/usageTrackerReleaseGate.test.js __tests__/axiosDefaults.test.js __tests__/userDataSyncWorker.test.js __tests__/tabBarModel.test.js
node scripts/performance-audit.cjs
```

`fieldStore` testinde react-test-renderer deprecation/act ortam uyarıları var; test sonucu başarılı. Tam uygulama suite'i, Firebase emülatör suite'i, release export/build ve fiziksel cihaz turu bu çalışma kapsamında koşulmadı. Mevcut testlerin geçmesi performans darboğazlarının bulunmadığı anlamına gelmez.

## 7. CPU, GPU, gecikme ve bellek için cihaz doğrulama planı

### Ortam ve veri

En az düşük/orta Android fiziksel cihaz ve desteklenen bir iPhone; mümkünse 60 Hz ve yüksek yenileme hızlı cihaz. Native performansı release veya release'e yakın profileable build ile ölç. React commit nedenlerini incelemek için ayrı profiling/dev oturumu kullan; dev sürelerini release sonucu diye yazma. React Native'in kendi rehberi de release ölçümünü özellikle vurgular. [RN 0.86 performans rehberi](https://reactnative.dev/docs/0.86/performance).

Aynı hesap fixture'ı, aynı ağ, aynı efekt/kalite ayarı, benzer pil/termal durum. Cold-cache ve warm-cache senaryolarını ayrı tut. Her etkileşim senaryosunda en az 20 tekrar; uzun oturumda 15 dakika gezinme. p50/p95/max raporla; 20 örnekte p95'in yaklaşık olduğunu belirt. Canlı kullanıcı hesabına sentetik toplu veri yazma.

| Senaryo | Ne aranacak? |
|---|---|
| Cold start → ilk kullanılabilir keşif | Native başlangıç, JS yükleme, splash minimumu, ilk veri; özellikle 6–9 sn ön yükleme penceresi |
| Keşifte 30 sn hızlı kaydırma | JS uzun görev, UI/RenderThread gecikmesi, boş liste hücresi, görsel decode |
| Hub → Profil → Kütüphane, sonra 60+ sn bekleme | Aktif abonelik, timer, animasyon sayısı; F01'in asıl regresyonu |
| Film/dizi detayını 20 kez aç/kapat | Yeni GET sayısı, iptal, tepe/kalıcı RAM, görsel cache |
| 1.000 bölümlük dizi, 50+ bölümlük sezon | Satır geçmişi hesaplama, ilk çizim, izleme işaretleme gecikmesi |
| 1.000 film + 5.000 bölüm; sonra 5.000 + 20.000 | Tek kayıt değişiminin CPU maliyeti, GC, büyük liste açılışı |
| 10.000 yorum / 500 yanıt fixture'ı | İlk gelen belge sayısı, mount edilen satırlar, canlı güncelleme maliyeti |
| 30 sezonluk grafik, bir yavaş/bozuk cevap | İlk kullanılabilir içerik, azami in-flight istek, kısmi hata |
| Ağ yavaş/kapalı → geri gelir | Spinner süresi, cache fallback, yinelenen istek/yazma, outbox korunması |
| Efekt tam/orta/kapalı + hava/ambiyans ayrı | GPU/UI frame farkı ve pil/termal eğilim; görsel kalite |
| Ekranı kilitle/arka plan → geri dön | Görsel loop/timer durması; saatler/seri/geri sayım doğruluğu |
| İçe/dışa aktarma ve “Verileri indir” | İş kuyruğu, eşzamanlı istek, JSZip CPU, tepe bellek ve iptal |

### Hangi araç hangi soruyu yanıtlar?

- **JS/React:** React Native DevTools ve uygun profiling build; commit sayısı/süresi, CPU flame chart. `materializeTvWatchState`, `computeWatchScore`, JSON parse/stringify, sort ve büyük render zincirlerini işaretle. Sadece “render sayısı”na değil süreye bak.
- **Android native/UI:** Android Studio System Trace/Perfetto; ana thread, RenderThread, scheduling ve FrameTimeline. Yavaş frame'in CPU çalışmasından mı, beklemeden mi, çizimden mi geldiğini ayır. [Android ölçüm rehberi](https://developer.android.com/topic/performance/measuring-performance), [Perfetto kullanım rehberi](https://github.com/google/perfetto/blob/main/docs/getting-started/start-using-perfetto.md).
- **GPU:** cihazın desteklediği GPU sayaçları/trace araçları; sayaç yoksa GPU yüzdesi uydurma. Efekt A/B + FrameTimeline + graphics bellek ile daralt. JS FPS tek başına GPU kullanımını göstermez.
- **iOS:** Xcode Instruments ile Time Profiler, Animation Hitches/Core Animation, Allocations/Leaks ve cihaz destekliyorsa GPU/Metal araçları. TestFlight/release davranışını doğrula.
- **Bellek:** Android Memory Profiler/PSS ve iOS Allocations; 20 navigasyon turundan sonra GC/cache yerleşince kalıcı yükseliş var mı? Fotoğraf ve Skia yüzeylerini JS heap'ten ayrı incele.
- **Ağ:** istek adedi, toplam bayt, aynı anahtardaki eşzamanlı istek, iptal, TTL hit, server/cache ilk içerik süreleri. Auth/header/body içeriğini performans loglarına taşıma.

Android'de aynı fiziksel test cihazı açıkken aşağıdaki salt okunur komutlar yardımcıdır; tek başlarına tam CPU/GPU profili değildir:

```powershell
adb shell dumpsys gfxinfo com.smlztrk.seelogd framestats
adb shell dumpsys meminfo com.smlztrk.seelogd
```

### Başlangıç kabul hedefleri

Bu eşikler **proje için önerilen başlangıç hedefleridir**, elde edilmiş sonuç veya platformun resmî garantisi değildir:

| Ölçü | Başlangıç hedefi |
|---|---|
| Kare süresi | 60 Hz'de 16,67 ms; 120 Hz'de 8,33 ms bütçesini referans al; gerçek deadline/jank oranını trace'ten ölç |
| Takılma | Standart scroll turunda missed-deadline oranı <%1, tekrarlanan ≥100 ms duraklama yok; düşük cihaz hedefi ayrıca kaydedilsin |
| Dokunma → ilk görsel geri bildirim | p95 <100 ms; ağ yanıtı süresinden ayrı |
| Kütüphane işaretleme | İyimser UI gecikmeden cevap veriyor; ağır hesaplamalar hareketi bloklamıyor |
| Detayı tekrar açma | TTL içi cache gösterimi için ağ cevabı beklenmiyor |
| Boşta/gizli sekme | Uygulamanın yönettiği gereksiz görsel timer/loop sıfır; CPU yüzdesi aynı cihazın bazal durumuyla karşılaştırılıyor |
| Bellek | Isınma/cache yerleşmesinden sonra tekrar eden gezinmeyle sınırsız monoton büyüme yok; byte tavanları belgelenmiş |
| Veri güvenliği | İptal, offline, app kill ve hesap değiştirme testlerinde kayıp/yabancı hesap verisi yok |

## 8. Sonraki inceleme alanları ve yanlış optimizasyonlardan kaçınma

- **İndirme/içe aktarma:** TMDB import resolver'ında eşzamanlılık sınırı zaten var (`services/import/tmdbResolver.js:329`). `services/dataDownloader.js:377` ve `:387` toplu Promise.all kullanıyor; bu isteğe bağlı iş için ortak 3–5 işçi kuyruğu, ilerleme ve iptal değerlendirilmeli.
- **ZIP/CSV:** `services/libraryExportFiles.js:72` tüm CSV'leri ve ZIP'i bellekte oluşturuyor. `generateAsync` kullanılması CPU'nun JS dışına taşındığını kanıtlamaz. Büyük arşivde tepe bellek/progress ölç; gerekirse parçalı üretim veya native sıkıştırma değerlendir.
- **Uzun sohbet:** Cursor sayfalama mevcut, ancak açılan eski sayfalar canlı kalıyor (`services/chatMessagePager.js:84`). Çok uzun oturumda eski sayfalara listener bütçesi düşün; anket/düzenleme/silme canlılığı için ürün davranışı korunmalı.
- **Sunucu gecikmesi:** Functions cold start, bölge, Firestore indeks süreleri, callable p95 ve TMDB/dış puan beklemesi gerçek telemetry olmadan kesin sıralanamaz. İstemci spinner'ını CPU sorunu diye sınıflandırma.
- **Paket/başlangıç:** Font/ekran importlarının gerçek değerlendirme maliyeti release bundle/trace ile ayrıştırılmalı. Her büyük dosyayı parçalamak veya bütün bileşenlere memo eklemek yeterli bir strateji değil.
- `setTimeout`, Promise veya `async` ağır senkron işi otomatik olarak başka thread'e taşımaz. Kaydırma sırasında çalışan uzun görev yine uzun görevdir.
- `removeClippedSubviews` her ekranda açılmamalı; `screens/lists/ListsScreen.js:1303` Android geçmişindeki çökme nedeniyle kapalı. Sanallaştırma, clipping ve veri sayfalama üç ayrı kontrol katmanıdır.
- Optimize ederken geçmiş doğruluğu, çevrimdışı kullanım, kaydırma konumu ve mevcut görsel tercihler başarı ölçütünün parçasıdır.

**İlk uygulanacak somut paket:** F02 geçmiş indeksleme + F05 tek snapshot okuması + F06 önizleme çözünürlük tavanı. Ardından F01 odak düzeltmesi, F12 yaşam döngüsü ve F03/F04 büyük veri işleri. Gerçek CPU/GPU kazanımı ancak aynı fiziksel cihazda önce/sonra ölçümle kapatılmalı.
