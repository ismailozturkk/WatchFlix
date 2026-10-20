# Ne izlesem? (Filtreli Keşif)

Film/Dizi ana ekranının üst satırındaki **keşfet düğmesi** (pusula simgeli yuvarlak cam düğme) ve açtığı **"Ne izlesem?" ekranı**. Süreye, puana, türe, döneme,
dile ve platforma göre filtreleyip sonuçları poster ızgarasında gösterir; "Şaşırt beni" süzgece uyan rastgele
bir yapımın detayını açar. **AI kotası harcamaz** (Free planda AI günde 3 mesajla sınırlı); CineMatch'in
ruh hali seçicisinin ücretsiz, kesin sonuç veren tamamlayıcısıdır. Plan kapısı yok.

Aynı işte detay ekranlarındaki **yaş sınırı rozeti** (PG-13, TV-MA, 13+ …) de eklendi — bkz. en alttaki bölüm.

## Dosyalar

| Dosya | Görev |
|---|---|
| `utils/discoverFilters.js` | **Saf çekirdek**: seçenek kümeleri, doğrulama, TMDB `/discover` parametreleri, Film↔Dizi tür eşlemesi, "izlediklerimi gizle", otomatik doldurma kararı, hazır ve kayıtlı süzgeçler. RN importu yok. |
| `services/discoverQuery.js` | Tek sayfa okuyucu (axios). URL'yi çekirdek kurar. |
| `hooks/useFilteredDiscover.js` | Sonuç akışı: sayfalama, eski cevabı atma, otomatik doldurma, "Şaşırt beni". |
| `hooks/useDiscoverFilterStore.js` | Kayıtlı süzgeçler + her medya türünün son kullanılan süzgeci (depo kancası). |
| `screens/shared/DiscoverFiltersScreen.js` | Ekran: Film/Dizi anahtarı + çip satırı + ızgara. Rota: `DiscoverFilters` (`App.js`). |
| `components/home/DiscoverExploreAction.js` | Keşfet düğmesi: üst satırda anahtarın SOLUNDA, arama düğmesiyle aynı kabuk. |
| `utils/discoverHeaderLayout.js` | Üst satırın (keşfet · anahtar · arama) saf yerleşimi: dar ekranda anahtarın bölme genişliği. |
| `components/home/DiscoverFilterSheet.js` | Filtre alt sayfası (taslak üzerinde çalışır). |
| `components/home/DiscoverFilterChip.js` | Ekranda, sayfada ve çip satırında ortak çip. |
| `components/home/MediaTypeSwitch.js` | `segmentWidth` prop'u eklendi (varsayılan 112; <100 → kompakt, simgesiz). |
| `components/home/DiscoverSearchAction.js` | `discoverActionStyle` dışa aktarıldı: iki yuvarlak düğme AYNI cam tonu/kutuyu tek yerden okur. |
| `screens/shared/SeeAllScreen.js` | `SeeAllGrid` artık **dışa aktarılıyor** + `emptyComponent` prop'u. Izgara tek yerde kalsın diye yeniden yazılmadı. |
| `screens/shared/discoverFiltersCopy.js` | tr/en/es metinleri. |
| `utils/certification.js`, `components/detail/CertificationBadge.js` | Yaş sınırı rozeti. |

## Kararlar

- **Giriş noktası üst satırdaki tek simgeli keşfet düğmesi.** İlk sürümde listenin başında "Ne izlesem?" KARTI vardı;
  çok yer kapladığı için kaldırıldı (kart, `picker` bölümü ve ayar kaydı silindi). Düğme Film/Dizi anahtarının soluna,
  arama düğmesinin SİMETRİĞİ olarak konur: [keşfet] [Film/Dizi] [arama]. Dokununca ekran seçili türle ve **son kullanılan
  süzgeçle** açılır.
- **Üç öğe 344 pt tutar** (46 + 10 + 232 + 10 + 46); 12 pt kenar boşluğuyla 368 pt ister, 320–367 pt'lik ekrana sığmaz. Bu yüzden
  anahtarın bölme genişliği ekrana göre daralır (`discoverRowLayout`: 360 pt → 108, 320 pt → 88; cam olmayan yolda düğmeler 48 + çerçeve
  → 3 pt daha dar). Bölme 100'ün altına inince anahtar **kompakt** olur: simgeler kalkar, yazı yeri alır ("Películas" 320 pt'te iki
  simgeyle sığmıyordu). Satır her genişlikte ortalı ve iki yanı simetrik (Yoga: 36 kombinasyon temiz).
- **Hazır süzgeçler ekranın çip satırında:** süzgeç YOKKEN "Filtreler" ve "Şaşırt beni"nin yanında hazır çipler (Bu akşam, En yüksek
  puanlı, Yeni ve iyi, Kısa ve tatlı, Klasikler, Aile ile) ve bu türün kayıtlı süzgeçleri durur; basınca TEK dokunuşla uygulanır
  ve yerlerini etkin süzgeç çiplerine bırakır. Süzgeç kalkınca geri gelirler. Satır bu geçişlerde başa kaydırılır (sağdaki çipe
  basılınca soldaki "Filtreler" ekran dışında kalmasın). Filtre sayfasında da "Hazır filtreler" bölümü var (taslağa yükler).
- **Türler elle listelenir** (`/genre/list` çağrılmaz): TMDB kimlikleri sabit, çevrimdışı çalışır, etiketler üç
  dilli kopya tablosunda. Film ve Dizi tür kümeleri farklı — tür değiştirirken eşdeğerler taşınır
  (Aksiyon/Macera → "Aksiyon & Macera", Bilim Kurgu/Fantastik → "Bilim Kurgu & Fantastik", Savaş → "Savaş & Politika"),
  eşi olmayan düşer (Korku Dizi'de yok).
- **Türler VE ile birleşir** (virgül): "Komedi + Romantik" romantik komedi demek. En çok 4 tür.
- **Süre bandı Film'de toplam süre, Dizi'de BÖLÜM süresi** (`with_runtime`): film ≤90/≤120/≥150 dk, dizi ≤30/≤45/≥60 dk.
  Kopya tablosu ikisini ayrı etiketler.
- **Oy tabanı:** puana göre sıralama ya da en düşük puan seçiliyken `vote_count.gte` eklenir (az oylu yapımın 10 ortalaması
  gürültüdür). "En yeni" sıralaması da küçük bir taban alır. Üst tarih sınırı daima **bugün** — çıkmamış yapım "ne izlesem"e girmez.
- **`include_adult` BURADA yazılmaz:** ayarı tek yerden `utils/tmdbAdultGuard.js` uygular (kaynak taraması bunu kilitler).
- **"İzlediklerimi gizle" yalnız istemcide süzülür** (TMDB kütüphaneyi bilmez), bu yüzden sorgu anahtarına GİRMEZ:
  açıp kapamak listeyi yeniden yüklemez. Bir sayfa tamamen izlenmişse liste kaydırılamaz kalırdı; görünür sayı 18'e ulaşana
  dek (en çok 5 sayfa) kendiliğinden sonraki sayfa çekilir. Kütüphane durumu geç gelirse ya da anahtar sonradan açılırsa
  doldurma sorgu başına en çok 3 kez daha çalışır — sınırsız sayfa çekilmez. Dizide "izlendi" = izleme geçmişine girmiş dizi
  (en az bir bölüm); bilerek geniş.
- **"Platformlarımda"** `streamingProviderIds` ayarını okur (Ayarlar > Platform üyeliklerim). Platform yoksa anahtar kilitli
  ve açıklama yönlendirir; kayıtlı süzgeçte açık kalmışsa ekran "uygulanmıyor" uyarısı gösterir, sonuç sessizce yanlış olmaz.
- **Şaşırt beni:** süzgece uyan sonuçların ilk 8 sayfasından rastgele bir sayfa, izlenenler elenir, **puanı ≥6 olanlar tercih
  edilir** (süzgeç boşken "sürpriz" düşük puanlı çıkmasın; hiçbiri yoksa tüm afişli havuz).
- **Kayıtlı süzgeç adı otomatik** (ilk üç çip: "Komedi · ★ 7+ · 2010'lar"; metin kutusu yok → klavye sorunu yok). Aynı süzgeç tekrar
  kaydedilince kopya olmaz, başa taşınır. En çok 8 kayıt. **Yedeğe girer** (`discoverPresets`, "Düzen" grubu);
  son kullanılan süzgeç (`discoverFilters`) girmez (gezinme durumu).
- **Ölçüm:** `discover_filter_applied` (`source` = preset | saved | manual, `filter_count`, `genre_count`…) ve `discover_surprise`
  (`outcome`). Kayıtlı süzgeç adı ve arama metni ASLA gönderilmez.
- **Rota parametreleri** (`presetId`, `savedId`, `filters`) ekranda desteklenir ama şu an çağıran yok (düğme yalnız `mediaType` verir);
  derin bağlantı / gelecekteki girişler için hazır, `resolveInitialFilters` ile testli.

## YENİ SEÇENEK EKLEMEK

1. `utils/discoverFilters.js` → ilgili kümeye ekle (`ERAS`, `LANGUAGES`, …); gerekirse `buildDiscoverParams`'a bağla.
2. `screens/shared/discoverFiltersCopy.js` → üç dile etiket yaz.
3. `npx jest __tests__/discoverFilters __tests__/discoverFiltersCopy __tests__/copyTablesSpanish` — her seçeneğin URL'e çıktığı ve
   üç dilde etiketi olduğu kilitli; unutulan test kırar. Filtre sayfası kümeyi döngüyle çizer (`DiscoverFilterSheet.js`).

## Yaş sınırı rozeti

Film detayı `release_dates`, dizi detayı `content_ratings` ile TMDB'den dereceyi zaten çekiyordu ama hiç göstermiyordu.
Rozet tür çiplerinin başında durur (satır sarıyor, taşma yok). Kullanıcının bölgesinde kayıt yoksa **ABD derecesi bölge etiketiyle**
gösterilir ("PG-13 · US"). Film'de sürüm türü önceliği: sinema > dijital > fiziksel > TV. "NR / Not Rated" gibi bilgi vermeyen
değerler yok sayılır; derece yoksa **hiçbir şey çizilmez**. Ton: yeşil = her yaş, amber = genç (PG-13, 13+), kırmızı = yetişkin (R, TV-MA, 16+/18+).
Dizi çağrısında `release_dates` yerine `content_ratings` istenir (dizide `release_dates` geçerli bir uç değil).

## Doğrulama

Jest: çekirdek, metin bekçisi, kanca (sayfalama/eski cevap/otomatik doldurma sınırları/Şaşırt beni — 4 bilinçli bozma yakalandı),
depo, filtre sayfası, ekran (7 bilinçli bozma yakalandı), yedek + kapsam bekçisi, rozet, üst satır yerleşimi (`discoverHeaderLayout`),
keşfet düğmesi, dar anahtar (6 bilinçli bozma yakalandı). Yoga yerleşim ölçümü: üst satır 320–412 pt × tr/en/es × iki çizim yolu
(36 kombinasyon) temiz — satır ortalı/simetrik, boşluklar 10, bölme etiketleri sığıyor; ekran/sayfa 320–412 × tr/en/es temiz (uzun
kayıtlı ad satırdan 29 pt taşıyordu, düzeltildi). react-native-web önizlemesinde üst satır (390 ve 320 pt kompakt), filtre sayfası,
ekran (koyu/açık tema, çip değişimi), boş durum ve rozet görüldü.

**Cihazda GÖRÜLMEDİ:** iOS 26 cam görünümü (üstteki üç öğe ve filtre ekranındaki anahtar; iki yuvarlak düğmenin anahtarla hizası), gerçek yazı tipiyle satır
sarmaları, gerçek TMDB cevaplarıyla süzgeçlerin sonuç kalitesi (özellikle dizide `with_runtime` ve düşük oylu başlıklar),
`SeeAllGrid` ile gerçek birleşim (testlerde ızgara taklit).
