# Dil ve çeviri denetimi — 19 Ekim 2026

> Bu belge 19 Ekim tarihli bulguların tarihsel kaydıdır. Düzeltmeler ve Almanca dahil beş dilin güncel doğrulaması için [22 Ekim 2026 tamamlama raporuna](DIL_DENETIMI_2026-10-22.md) bakın. Aşağıdaki sekiz bulgu güncel açık hata listesi değildir.

## Sonuç

Türkçe, İngilizce, İspanyolca ve Brezilya Portekizcesi sözlükleri yapısal olarak eşit. Ancak uygulamanın tamamı çevrilmiş ve dil değişimine doğru tepki veriyor denemez. Aşağıdaki sekiz kullanım hatası doğrulandı. Bu çalışma incelemedir; uygulama kodu değiştirilmedi.

## Kapsam ve doğrulama

- `translations/{tr,en,es,pt}.json`: her birinde **3.033 yaprak anahtar**; anahtar kümeleri eşit. Boş metin, yinelenen JSON anahtarı veya diller arası yer tutucu uyuşmazlığı bulunmadı. Diziler yaprak kabul edildi; bu sayı ayrı ayrı çevrilmiş cümle sayısı değildir.
- `screens`, `components`, `context`, `hooks`, `services`, `utils`, `data` ve `App.js`: JavaScript/TypeScript kaynakları Babel AST ile tarandı. Statik çeviri erişimleri, modül yüklenirken çözülen çeviriler, JSX içindeki sabit metinler, yerel dil tabloları ve `i18nText` parametreleri incelendi.
- Mevcut anahtar, dil kaydı, cihaz dili, yerel metin tabloları, Portekizce, native izin ve widget dili testleri: **7 paket / 148 test başarılı**.
- Metin tabloları, onboarding, bildirim zamanlayıcısı ve fragman dilini de içeren ikinci seçili test çalışması: **17 paket / 240 test başarılı**. İki çalışma kısmen örtüşür; sayılar toplanmamalıdır.
- Kurulu i18next ve gerçek sözlüklerle takvim parametre hatası ve modül düzeyinde dondurulmuş etiket yeniden üretildi. Gerçek saf rozet modülleri çalıştırılarak iki ES/PT dil kaybı da doğrulandı.
- Canlı cihaz/emülatörde ekran taşması ve yeniden çizim testi yapılmadı. Sunucunun yayındaki sürümü, mağaza metinleri veya native derleme çıktısı doğrulanmadı. ES/PT metinlerinin tamamı için ana dil düzeyinde editoryal onay verilmiş değildir.

## Doğrulanan bulgular

### 1. İçe aktarma akışı bütün dillerde Türkçe kalıyor

**Öncelik: P2. Etkilenen diller: EN / ES / PT.**

- `screens/tabs/SettingsScreen.js:1000`: giriş satırının başlığı ve açıklaması sabit Türkçe.
- `components/import/ImportDataModal.js:470`: modal başlığı, açıklamalar, seçim düğmeleri, önizleme, ilerleme, tamamlanma ve hata metinleri sabit Türkçe. Örneğin 541. satırdaki alan ipucu ve 354. satırdaki ilerleme iletisi de çevrilmiyor.
- `components/import/ImportHelpModal.js:83`: yardım başlığı ve Letterboxd/IMDb adımları Türkçe.
- `services/import/letterboxdImporter.js:46`, `imdbImporter.js:47` ve `letterboxdBundleImporter.js:43`: kullanıcıya iletilen hata metinleri de Türkçe.

**Etkisi:** Ayarlar > Letterboxd/IMDb içe aktarma yoluna giren yabancı dil kullanıcısı, işlemin talimatlarını ve hatalarını kendi dilinde göremiyor.

**Düzeltme yönü:** Giriş satırı dahil tüm akış için dört dilli metinler; servis hataları için arayüzde çevrilebilen hata kodları. Yalnızca modal başlığını çevirmek yeterli değildir.

### 2. Bazı etiketler dil değiştirilince uygulama açılışındaki dilde kalıyor

**Öncelik: P2. Etkilenen diller: tüm dil geçişleri.**

Çeviriler bileşen çizilirken değil, dosya ilk yüklendiğinde sabit nesne/dizilere yazılıyor:

- `screens/tabs/profile/PrivacySettingsScreen.js:24`: `OPTIONS` ve `SECTIONS`.
- `screens/tabs/settings/PosterSettingsScreen.js:370`: sütun, köşe, boyut, yerleşim ve rozet seçenekleri.
- `screens/actor/ActorViewScreen.js:37`: `FILTERS` ve `TV_FILTERS`.
- `screens/tabs/profile/FriendProfileScreen.js:107`: liste başlıkları.
- `components/storyShare/StoryTabs.js:8`: paylaşım düzenleyici sekmeleri.

**Yeniden üretim:** Gerçek `OPTIONS` bildirimi Türkçe i18next ile değerlendirildi, sonra dil İngilizce yapıldı. Saklanan etiket `Herkese Açık` kalırken aynı anahtarın yeni çevirisi `Public` oldu. Ekranın yeniden açılması modül sabitlerini yeniden oluşturmaz.

**Düzeltme yönü:** Sabitlerde çeviri anahtarı saklamak, metni güncel dil ile çizim sırasında çözmek. Bileşenleri dil bağlamına abone etmek ve varsa ilgili `useMemo` bağımlılıklarına dili eklemek.

### 3. Takvimde etkinlik sayısı yerine `{{n}}` görünüyor

**Öncelik: P2. Etkilenen diller: TR / EN / ES / PT.**

`screens/calendar/CalendarScreen.js:768`, `autoI18n.n_etkinlik` anahtarına `{ count: monthCounts.total }` gönderiyor. Dört sözlükte de bu anahtarın değişkeni `{{n}}`.

**Yeniden üretim:** Sayı 5 iken gerçek i18next çıktıları `{{n}} etkinlik`, `{{n}} activities`, `{{n}} actividades`, `{{n}} atividades`. Hata, toplam etkinlik sayısı sıfırdan büyük olduğunda görünür.

**Düzeltme yönü:** Çağrıdaki parametreyi `n` yapmak veya anahtarı ve tüm kullanımlarını birlikte `count` sözleşmesine geçirmek. Sözlüklerin kendi aralarında eşit olması bu çağrı hatasını yakalamıyor.

### 4. Oscar/Emmy kategori kartları yabancı dilde de Türkçe

**Öncelik: P2. Etkilenen diller: EN / ES / PT.**

- `screens/movie/MovieOscar.js:71`
- `screens/tv/TvShowsEmmy.js:71`

İki ekran da `item.categoryLabelTr || i18nText(item.categoryLabelKey, ...)` kullanıyor. `services/oscarService.js:845` ve `services/emmyService.js:877` dahil tüm yıl sonucu dalları `categoryLabelTr: cat.tr` dolduruyor. Böylece mevcut çeviri anahtarı hiç kullanılmıyor.

**Etkisi:** Yıl görünümündeki kartlarda ve bekleyen kategori kartlarında `En İyi Film`, `Uluslararası` gibi Türkçe kategori adları kalıyor.

**Düzeltme yönü:** Önce `categoryLabelKey` üzerinden güncel çeviriyi çözmek; düz kategori metnini yalnız yedek olarak kullanmak.

### 5. Rozet ailesinin sıradaki hedefi ES/PT çevirilerini kaybediyor

**Öncelik: P2. Etkilenen diller: ES / PT.**

`components/badges/watchBadgeCatalog.js:1687`, `sonrakiHedef` nesnesine yalnız `tr`, `en`, `descTr`, `descEn` alanlarını taşıyor. Katalogdaki `es`, `pt`, `descEs`, `descPt` alanları atılıyor. `badgeAciklama()` bu durumda İngilizceye düşüyor.

**Yeniden üretim:** Film ailesinin ikinci hedefinde beklenen ES `Ve 50 películas`, PT `Assista a 50 filmes`; gruplanmış hedefte ikisi de `Watch 50 films` oldu.

**Kullanım:** `components/badges/WatchBadgeCard.js:51` ve `WatchBadgeDetailModal.js:302`.

**Düzeltme yönü:** Sonraki hedefe bütün dil alanlarını koruyarak aktarmak veya kimlik üzerinden katalogdaki özgün hedefi çözmek.

### 6. Dönem mühürlerinin kart nesnelerinde ES/PT metinleri eksik

**Öncelik: P2. Etkilenen diller: ES / PT.**

`components/badges/seasonSeals.js:176`, üretilen mühür nesnesine yalnız TR/EN başlık ve açıklama ekliyor. Mevsim tanım tablosunda ES/PT bulunması bu nesnelerin çevrildiği anlamına gelmiyor.

**Yeniden üretim:** 19 Ekim 2026 için oluşturulan mühürde hem ES hem PT kart başlığı `Autumn 2026`, açıklaması `Log on 8 separate days during Autumn 2026` çıktı.

**Düzeltme yönü:** Mühür nesnesinin dört dilde başlık/açıklama üretmesi. Kutlama için kullanılan ayrı `badgeMeta` çözümleyicisi çevrilmiş olduğundan kart ile kutlama arasında da tutarsızlık oluşabiliyor.

### 7. Bölüm etiketi düz metin beklenen yerlerde hatalı noktalama içeriyor

**Öncelik: P2. Etkilenen diller: TR / EN.**

`translations/tr.json:1238` ve `translations/en.json:1238` içindeki `autoI18n.bolum`, sırasıyla `- Bölüm:` ve `- Episode:`. Çağıranlar düz bölüm etiketi bekliyor:

- `components/detail/WatchedDateSheet.js:99`
- `components/modals/WatchHistorySheet.js:33` ve `:346`
- `components/lists/ListItemActionsSheet.js:46`

**Etkisi:** Etikette fazladan tire/iki nokta ve örneğin `12 - Bölüm:` biçiminde bozuk sayaç metni. ES/PT bu anahtarı düz etiket olarak kullanıyor.

**Düzeltme yönü:** Anahtarı düz etiket yapmak; sayılı kullanım için ayrı bir değişkenli/çoğul çeviri kullanmak.

### 8. AI filtre önerisi ES/PT sohbetinde İngilizce kullanıcı mesajı oluşturuyor

**Öncelik: P2. Etkilenen diller: ES / PT.**

`screens/chat/AIChatScreen.js:399` filtre önerisi çipinin başlığını dört dilde, prompt metnini yalnız TR/EN tanımlıyor. `components/ai/AIWelcome.js:203` sadece `chip.prompt` gönderiyor. `AIChatScreen.js:866` bunu `handleSend(prompt)` ile ilettiği için 641. satırdaki `display` da İngilizce prompt oluyor.

**Etkisi:** İspanyolca/Portekizce düğmeye dokunulduğunda kullanıcı balonunda `Recommend the 5 best titles matching ...` yazıyor. Bu yalnızca modele gönderilen görünmez teknik talimat değil, kullanıcıya gösterilen metin de oluyor.

**Düzeltme yönü:** Promptu ES/PT için çevirmek veya mevcut `options.display` mekanizmasıyla yerelleştirilmiş görünen metin göndermek.

## Diğer gözlemler

- `utils/appLanguages.js` ES/PT yasal sayfalarını açıkça İngilizceye yönlendiriyor. Bu bir anahtar hatası değil; yasal web içeriği açısından tam ES/PT desteği yok.
- `context/SharedListsContext.js:68` ve `utils/listSearch.js:239` sıralamada sabit `localeCompare(..., "tr")` kullanıyor; dil değişiminde sıralama yereli değişmiyor.
- `FriendProfileScreen.js:116` sıfır süreyi her dilde `0 dk` döndürüyor; diğer süreler yerelleştirilmiş. Küçük bir ek metin eksiği.
- PT sözlüğünde İngilizceyle aynı görünen `cards` ifadeleri tek başına eksik çeviri sayılmadı; aynı sözcük Portekizce metinler içinde de tutarlı kullanılıyor. Marka adları, teknik adlar ve yalnız geliştirme ekranları kullanıcı akışı hatası olarak sayılmadı.
- Otomatik taramanın ürettiği yerel `t` değişkenleri ve alt sözlük prop erişimleri kaynakta kontrol edilerek elendi. Oscar/Emmy `{{year}}` kullanımları sonradan `.replace()` yaptığı için yanlış pozitif olarak elendi.

## Testlerin kaçırdığı alanlar

Mevcut testler sözlük yapısını iyi koruyor. Sabit Türkçe JSX, modül yüklenirken dondurulan çeviriler, çağrının yanlış yer tutucu parametresi göndermesi ve ara veri nesnelerinin dil alanlarını düşürmesi için yeterli davranış kontrolü yok. Sekiz bulgunun yeşil testlerle birlikte bulunabilmesinin nedeni bu.

Düzeltme sırasında en değerli ek kontroller: dil değiştirildikten sonraki etiketler, takvime gerçek sayı gönderildiğinde çözümlenmemiş yer tutucu kalmaması, rozetlerin oluşturulmuş/gruplanmış nesnelerinde dört dilin korunması ve içe aktarma akışının dört dilde metin sağlamasıdır.
