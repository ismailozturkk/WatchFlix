# Seelogd: Liquid Glass sekmeler araştırması ve geçiş planı

Tarih: 9 Eylül 2026. Durum: araştırma ve mevcut sürümün başlangıç kontrolleri tamamlandı; yeni sekme uygulaması, native derleme ve cihaz kabul testleri henüz yapılmadı.

Kullanıcının netleştirdiği hedef: Android'de de cam görünümü öncelikli. Desteklenmeyen cihazlarda mevcut blurlu bar korunacak. Referans görsel görünüm örneğidir; görseldeki Home/Messages/Settings adları Seelogd sekmelerinin yerine geçirilmeyecek.

## 1. Araştırmanın sonucu

Expo Native Tabs iOS 26'da sistem Liquid Glass görünümünü kullanır. Android karşılığı Material'dır; aynı cam görünümünü sağlamaz. API hâlâ alpha olarak belgeleniyor. Android'de en fazla beş sekme vardır; dinamik sekme ekleme/çıkarma state kaybına yol açabilir. FlatList ile scroll-to-top ve minimize davranışlarında sınırlamalar bulunur. Kaynak: [Expo Native Tabs](https://docs.expo.dev/router/advanced/native-tabs/).

Bu nedenle hedef üç ayrı sunum gerektiriyor:

| Koşul | Hedef sunum | Açıklama |
| --- | --- | --- |
| Uygun native build, iOS 26+, kullanılabilir Liquid Glass | Native iOS sekmeler | Gerçek sistem malzemesi ve etkileşimi |
| Android 13/API 33+, doğrulanmış shader ve cihaz performansı | Özel cam sekme barı | Android AGSL ile kırılma ve dokunma animasyonu; Apple'ın sistem bileşeni değildir |
| Uygulamanın desteklediği eski iOS sürümleri | Mevcut AdaptiveBlurView barı | Eski iOS native tab görünümüne otomatik düşmek, kullanıcının istediği fallback ile aynı şey değildir |
| Android API 31–32 veya shader kullanılamayan modern cihaz | Mevcut AdaptiveBlurView barı | Mevcut hedef yüzey bağlama kuralı korunur |
| Desteklenen Android sürümlerinde API <31; blur kullanılamıyor veya efekt kapalı | Mevcut barın düz/yarı saydam fallback'i | Mevcut kod bu durumda gerçek blur üretmiyor; yeni planda da blur varmış gibi gösterilmeyecek |
| Web / bilinmeyen platform | Mevcut güvenli sunum | Native bileşen yüklenmemeli |

AGSL'nin alt sınırı Android 13'tür. Bu, seçilecek shader yolunun teknik alt sınırıdır; bütün Android 13 cihazları için yeterli performans garantisi değildir. Kaynak: [Android AGSL](https://developer.android.com/develop/ui/views/graphics/agsl).

`expo-glass-effect` iOS için gerçek cam yüzeyi sağlar; Android'de normal View'a düşer. Tek başına Android çözümü veya native sekme navigatörü değildir. Kaynak: [Expo GlassEffect](https://docs.expo.dev/versions/latest/sdk/glass-effect/).

## 2. Bu projede doğrulanan başlangıç durumu

| Alan | Canlı çalışma ağacındaki bulgu | Geçişe etkisi |
| --- | --- | --- |
| Paketler | Expo 57.0.12, React Native 0.86.2, react-native-screens 4.26.2 | SDK 54/Router v6 videosunun paket sürümleri kopyalanmamalı |
| Router | expo-router ve expo-glass-effect doğrudan bağımlılık olarak yok | Eklenecek çözüm native build ve bağımlılık değerlendirmesi gerektirir |
| Giriş | index.js → registerRootComponent(App); StyleSheet uyumluluk kurulumu var | Router entry geçişinde başlangıç düzeltmesi kaybolmamalı |
| Kök navigasyon | App.js içinde NavigationContainer, native stack, 66 Stack.Screen kaydı | Tam Router geçişi yalnız bar değişikliği kapsamını aşar |
| Sekmeler | tvshows, movies, share, settings, profile, debug | Debug koşulsuz altıncı sekme; yalnız geliştirmede görünür varsayımı yanlış |
| Sekme durumu | activeTab + mountedTabs + ScreenContainer; freezeOnBlur | Aynı ekran örnekleri, listelerin konumu ve yerel seçimler korunmalı |
| İlk açılış | tvshows ve istenen initialTab baştan mount ediliyor | Doğrudan hedef sekmeye girişte boş kare önlenmeli |
| Ön yükleme | 6 saniye gecikme, 1,2 saniye aralıkla diğer sekmeleri mount | Native navigatörün yaşam döngüsüne körlemesine taşınmamalı |
| Veri sahipliği | MovieProvider film sekmesinde; CalendarProvider profil sekmesinde | Yeni bar/renderer değişimi provider'ları yeniden kurmamalı |
| Bar | 56 yüksekliğinde, ikon odaklı, yüzen blur kapsülü | Native barın boyutları bu sabitler gibi kontrol edilemez |
| CineMatch | 44 px şeffaf FAB; bar yuvasından hesaplanan sağ/alt konum | Formül son yuvayı kullanıyor; Debug sonradan eklenince yorumdaki “profil” artık son yuva değil |
| Liste boşlukları | Film/Dizi 75; Hub/Ayarlar 110 alt padding | Native otomatik inset ile çift boşluk veya örtüşme riski |
| Profil | ScrollView içinde SafeAreaView ve yerel modal state'leri | Safe-area ve remount testleri gerekli |
| Efekt tercihi | services/effectSettings.js; full/balanced/off; senkron MMKV okuma | Kullanıcı tercihi cihazın otomatik sınıfından öncelikli |
| Güncelleme | app.json version 1.4.3; runtimeVersion policy appVersion | Native bağımlılık eklerken app version/runtime ayrımı gerekli |

İncelenen başlıca dosyalar: `App.js`, `index.js`, `screens/navigation/TabScreenNavigator.js`, beş ana sekme ekranı, `components/pet/PetCompanion.js`, `components/common/AdaptiveBlurView.js`, `components/common/BlurTarget.js` ile ilişkili kullanım, `utils/blurSupport.js`, `services/effectSettings.js`, `context/DeviceNotificationsContext.js` bağlantısı ve uygulama/EAS yapılandırması.

Korunacak somut yönlendirmeler:

- CalendarScreen → `TabScreen { initialTab: "profile" }`.
- CineSwipeScreen → `TabScreen { initialTab: "share" }`.
- GameHubScreen → `TabScreen { initialTab: "settings" }`.
- Aynı initialTab değeri ikinci kez gönderildiğinde yeniden çalışmalı; mevcut kod parametreyi tüketerek bunu sağlıyor.
- `seelogd://reminders`, `lists`, `lists/:listName`, `upnext`, `stats/movies`, `stats/tv` bağlantıları korunmalı.
- Bildirimden ekran açma, auth başlangıç seçimi, Sentry navigasyon kaydı ve kök detay ekranlarının geri dönüşü korunmalı.

## 3. Navigasyon mimarisi seçimi

| Yol | Kazanım | Maliyet / açık risk | Değerlendirme |
| --- | --- | --- | --- |
| Expo Router 57 + NativeTabs | Kullanıcının verdiği resmî Expo yolunu doğrudan kullanır | Giriş, 66 rota, parametreler, bildirim/ref ve hook importları taşınır; Android cam yine ayrıca gerekir | Tam Router geçişi istenirse aşağıdaki ek aşamalarla uygulanabilir |
| React Navigation Native Bottom Tabs + Android özel bar | Mevcut kök stack ve route adları korunarak iOS sistem barına ulaşılır | Yeni native sekme yaşam döngüsü, fallback ve paket peer uyumu prototipte kanıtlanmalı | Bu ürün hedefi için ilk teknik öneri |
| Mevcut ScreenContainer + iOS GlassView + Android özel bar | Altı sekme ve yerel ekran state'i en az değişiklikle korunur | iOS malzemesi native olsa da sekme kontrolü özel olur; sistem Native Tabs ile aynı değildir | Native sekme kısıtları ürün beklentileriyle uzlaşmazsa ayrı alternatif |

React Navigation'ın resmî `@react-navigation/bottom-tabs/unstable` yolu native iOS/Android bileşenleri kullanır; iOS Liquid Glass için Xcode 26+ gerekir. Kaynak: [Native Bottom Tabs](https://reactnavigation.org/docs/native-bottom-tab-navigator/).

9 Eylül npm registry kontrolü: bottom-tabs 7.18.18, `@react-navigation/native ^7.3.18` istiyor; kurulu native 7.3.14. Bu nedenle paketi eklemek tek başına yeterli değildir. Prototipte uyumlu sürümler birlikte sabitlenecek; peer kontrolü zorla atlanmayacak.

**Öneri, framework değişikliğini yapılmış kabul etmez.** İlk prototip mevcut React Navigation içinde native iOS sekmelerini ve Android cam yüzeyini doğrulamalı. Özellikle Expo Router kullanılması tercih edilirse ikinci bir bağımsız NavigationContainer gömmek yerine kök navigasyon düzgün şekilde taşınmalı.

Expo Router 56+ uygulama kodundaki dış `@react-navigation/*` importlarını desteklemiyor. Mevcut taramada 20 eşleşme var. Router geçişinde entry/plugin, root provider ağacı, route wrapper'ları, navigation/route props, deep link parametreleri ve navigasyon ref entegrasyonları birlikte ele alınmalı. Kaynaklar: [React Navigation'dan geçiş](https://docs.expo.dev/router/migrate/from-react-navigation/), [SDK 55 → 56 import değişimi](https://docs.expo.dev/router/migrate/sdk-55-to-56/).

Tam Router yolu seçilirse somut dosya düzeni: `src/app/_layout.tsx` kök provider/auth/splash sahipliği; `src/app/(tabs)/_layout.tsx` platform adaptörü; `index.tsx`, `movies.tsx`, `share.tsx`, `settings.tsx`, `profile.tsx` mevcut ekranları saran ince route dosyaları; detaylar `(tabs)` dışındaki kök stack altında. Mevcut 66 ekranın her biri için eski ad → yeni path → parametre dönüşümü tablosu oluşturulmadan entry değiştirilmemeli. Callback veya büyük içerik nesneleri URL parametresine çevrilmemeli; veri kimliği/store üzerinden çözülmeli.

## 4. Android cam adayları

Aşağıdakiler geliştiricilerin kendi kaynaklarından incelendi. Henüz Seelogd üzerinde kurulmadı, derlenmedi veya performansları ölçülmedi. README'deki hız iddiaları test sonucu sayılmadı.

| Aday | Doğrulanan yayın / lisans | Mimari özellik | Prototip önceliği |
| --- | --- | --- | --- |
| [liquid-glass-kit](https://github.com/Abdullajon1881/LiquidGlass/tree/main/packages/liquid-glass-kit) | 1.0.0; Apache-2.0 | Expo modülü, Android motoru paketin içinde; ayrı backdrop provider, AGSL API 33+ | İlk aday; mevcut kardeş hedef/yüzey düzenine uygun görünüyor |
| [react-native-android-liquid-glass](https://github.com/sssajjad007/react-native-liquid-glass-android) | 0.2.1; MIT; RN >=0.85, React >=19 | Fabric, AGSL; JitPack native bağımlılığı; ebeveyn/backdrop yerleşim kısıtı | İkinci aday; EAS bağımlılık çözümü ve içerik yakalama sınanmalı |
| [@uginy/react-native-liquid-glass](https://github.com/uginy/react-native-liquid-glass) | 1.2.6; MIT | Android AGSL, iOS için ayrı Metal yolu | Yedek; ihtiyaç dışı ikinci iOS motorunu taşımak tercih sebebi değil |

İlk adayın `isLiquidGlassSupported` değeri dokümanda Android platformu kontrolü olarak anlatılıyor. Bu değer tek başına “tam shader destekleniyor” kararı olamaz; API seviyesi, modül varlığı, native çizim başarısı ve ölçülen cihaz profili ayrı kontrol edilmeli. Kaynak: [paket README](https://raw.githubusercontent.com/Abdullajon1881/LiquidGlass/main/packages/liquid-glass-kit/README.md).

Prototipin görsel hedefi: canlı kaydırılan gerçek ekran içeriği camın arkasından görünmeli; kenarda kontrollü kırılma, okunabilir ikonlar, seçili kapsül ve basma tepkisi olmalı. Statik arka plan resmi üstündeki shader gösterimi yeterli kabul edilmeyecek. Android örneği iOS sistem barının piksel düzeyinde aynısı diye sunulmayacak.

Seçilen paket kendi eski cihaz blur'unu sunsa bile uygulama düşük destek düzeyinde mevcut AdaptiveBlurView'a dönecek. Böylece fallback'in tonu, efekt ayarı ve hedef bağlama davranışı değişmeyecek. Yüzey kendi backdrop'unu yakalamamalı; bar ve CineMatch katmanı hedefin dışında kalmalı. Aynı içerik iki ayrı ağır yakalama döngüsüyle işlenmemeli.

## 5. Destek ve fallback sözleşmesi

Önerilen saf karar modülü: `utils/tabBarCapabilities.js`. Native okumaları ayrı `services/tabBarCapabilities.js` sarmalayıcısı yapar. Çıktı: `native-ios`, `android-glass`, `legacy-blur` veya `legacy-solid`; ayrıca test/teşhis için sebep kodu.

Karar önceliği:

1. Efekt tercihi ve erişilebilirlik okunur. `off`, azaltılmış saydamlık ve gerekli kontrast tercihi dekoratif camı geçersiz kılar. Azaltılmış hareket, gereksiz büyüme/spring/tilt animasyonlarını kapatır; tek başına tüm saydamlığı kapatmak zorunda değildir.
2. Native modülün gerçekten build içinde bulunduğu doğrulanır. Paket importunun eksik native modülde çökmemesi için güvenli platform sarmalayıcısı kullanılır.
3. iOS sürümü ile cam API/design kullanılabilirliği birlikte değerlendirilir. `isLiquidGlassAvailable` erişilebilirlik tercihini kapsamaz; azaltılmış saydamlık ayrıca okunur. Kaynak: [Expo kullanılabilirlik kodu](https://raw.githubusercontent.com/expo/expo/main/packages/expo-glass-effect/src/isLiquidGlassAvailable.ios.ts), [API kontrolü](https://raw.githubusercontent.com/expo/expo/main/packages/expo-glass-effect/src/isGlassEffectAPIAvailable.ios.ts). Bunlar main dalı kaynaklarıdır; kurulan SDK 57 paketinin export ve davranışı ayrıca doğrulanmalı.
4. Android shader için API >=33, modül/renderer sağlığı, uygun efekt bütçesi ve başarılı cihaz profili gerekir. `balanced` için karar ölçümle verilir; sırf OS yeni diye pahalı efekt açılmaz.
5. Cam koşulları sağlanmıyorsa mevcut `resolveBlurPlan` kullanılır. API >=31 ve geçerli hedef varsa blur; diğer durumlarda mevcut düz katman.

**State koruma önemli bir prototip kapısıdır.** `mode ? <NativeNavigator/> : <LegacyNavigator/>` biçiminde canlı değişim ekranları yeniden kurar; yalnız aktif sekme adını saklamak liste, modal ve form state'ini korumaz. İlk kurulumda renderer kararı stabil olmalı. Çalışırken efekt değişiminde aynı navigator/screen örneklerini koruyan yalnız-bar değişimi kanıtlanmalı. Yerel react-native-screens 4.26.2 `TabsHost` içinde `tabBarHidden` sunuyor; seçilecek üst navigator API'sinin bunu güvenli biçimde taşıdığı henüz doğrulanmadı. API yoksa özel adapter veya gerekli yerel UI state'lerinin üst katmana çıkarılması değerlendirilir. Bu çözülmeden fallback geçişi tamamlandı denmeyecek.

JS ErrorBoundary, native GPU çökmesini veya process kapanmasını yakalayamaz. Koruma; destek kapısı, native hata raporu, denenmiş cihaz profilleri ve sonraki açılışta güvenli modu seçebilen kalıcı devre dışı bırakma üzerinden tasarlanmalı. Normal process kapanışı tek başına “glass crash” diye sınıflandırılmamalı.

## 6. Görünüm ve etkileşim kararları

- Ana beş sekmenin sırası ve ekran sahipliği korunur. Debug ekranını silmeden Ayarlar içindeki bir girişe taşımak öneridir; mevcut altıncı sekmenin sessizce kaldırıldığı varsayılmayacak. iOS'ta altı native sekmenin overflow/More davranışı da referans kapsül hedefiyle karşılaştırılmalı.
- Mevcut etiketler gizli; referansta görünür. İlk karşılaştırmada ikon-only düzen korunur, etiketli sürüm ayrıca incelenir. Görseldeki bildirim rozetleri Seelogd'da yeni veri alanları icat etmek için gerekçe değildir.
- Native iOS barına mevcut 56 px yükseklik ve 46 px gösterge dairesi zorlanmaz. Sistem geometrisi, tema ve içerik kontrastıyla birlikte değerlendirilir.
- CineMatch şeffaf kalır ve en az mevcut 44 px dokunma alanını korur. Konum son sekme varsayımından değil profil kimliği/gerçek kullanılabilir yerleşimden türemeli. Native bar ölçüsü alınamıyorsa güvenli ekran kenarı yerleşimi prototipte gösterilmeli; tahminle profil köşesine oturduğu söylenmemeli.
- Film/Dizi FlatList'leri nedeniyle ilk sürümde otomatik küçülme ve tekrar basınca yukarı kaydırma açılmayacak. Aynı sekmeye yeniden basmak mevcut davranışla uyumlu kalmalı. Native varsayılan pop/scroll davranışları açıkça kapatılmalı. Kaynak: [Expo Native Tabs davranışları](https://docs.expo.dev/router/advanced/native-tabs/).
- Android custom bar sekme değişiminde tek haptic üretir; native iOS tepkisine ikinci JS haptic bindirilmemesi cihazda dinlenerek/hissedilerek doğrulanır.
- Tüm detay ekranları ilk geçişte mevcut kök stack'te kalır; detayın altında yanlışlıkla bar belirmemeli. Android back tuşunun sekme geçmişine geçmesi ayrı bir ürün değişikliği sayılır; mevcut davranış baseline ile eşleştirilmeli.
- Native otomatik inset ile 75/110 sabit padding aynı anda toplanmaz. Her sekmenin en alttaki gerçek etkileşimli öğesi kaydırılabilir ve dokunulabilir olmalı.
- Tema değişiminde sahne zemini, ikon kontrastı ve native görünüm birlikte güncellenir. Kaydırma sırasında siyah/beyaz parlama olmamalı. Cam renginin tamamen uygulamanın JS renkleriyle kontrol edileceği varsayılmamalı.

## 7. Uygulama aşamaları ve çıkış koşulları

| Aşama | Yapılacak iş | Sonraki aşamaya geçiş koşulu |
| --- | --- | --- |
| 0. Başlangıç | Mevcut çalışma ağacını/checkpoint'i koru; çeviri test hatalarını ve SDK patch uyumunu ayrı hazırlıkta düzelt | Temiz test baseline'ı ve sabit dependency lock |
| 1. En küçük native prototip | Gerçek iOS native bar + Android canlı AGSL yüzeyi + mevcut blur karşılaştırması; scroll, klavye, modal, CineMatch | Her iki platformda native build, gerçek canlı backdrop ve doğru dokunma |
| 2. Mimari kararı sabitle | React Navigation yolu veya tam Expo Router yolu; Debug konumu; renderer değişiminde state koruma | Yukarıdaki açık riskler ölçülmüş/kararlaştırılmış |
| 3. Ortak sözleşme | Tab kimlikleri/etiketler, initialTab köprüsü, capabilities ve bar katmanı sınırı | Mevcut yönlendirmeler ve fallback saf testleri geçer |
| 4. Ürün entegrasyonu | Beş ana ekran, provider yaşam döngüsü, güvenli alan, tema, FAB, erişilebilirlik | Entegrasyon testleri + cihaz senaryoları geçer |
| 5. Dayanıklılık | Hızlı girişler, offline, bellek/arka plan, shader hata yolları, uzun oturum | Crash, kayıp input, gizli dokunma veya artan kaynak sızıntısı yok |
| 6. Yayın hazırlığı | Yeni native runtime/build; iki platformda preview; ölçümlü kademeli açılış ve geri dönüş anahtarı | Kanıtlı test matrisi, bilinen açık kritik hata yok |

Önerilen yeni sorumluluklar: `tabDefinitions`, `tabBarCapabilities`, platforma özel bar adapter'ları, `LegacyBlurTabBar`. Bunlar planlanan dosyalardır; henüz oluşturulmadı. Mevcut auth, premium, watchEvents, Firestore şeması ve veri servisleri görsel geçiş için yeniden tasarlanmayacak.

Runtime politikası şu anda `appVersion`. Yeni native bağımlılıklar için yeni binary ve uygulama sürümü/runtime gerekir; yalnız buildNumber/versionCode artırmak appVersion runtime'ını değiştirmez. Eski 1.4.3 binary'lere yeni native modül bekleyen OTA gönderilmemeli. Mevcut politika otomatik olarak fingerprint'e çevrilmeyecek. Kaynak: [EAS runtime uyumluluğu](https://docs.expo.dev/eas-update/runtime-versions/).

## 8. Test planı: yürütülebilir kabul senaryoları

Yeni sürüm için aşağıdaki satırların tamamı **BEKLİYOR**. Bunlar yapılmış test sonucu değildir. Her koşu; build/commit, OS/API, cihaz modeli, renderer, efekt/tema/dil, adımlar, sonuç ve gerektiğinde ekran kaydı ile kaydedilecek.

| ID | İşlem | Beklenen sonuç |
| --- | --- | --- |
| NAV-01 | Her ana sekmeye tek tek bas; ardından 50 hızlı karışık geçiş | Son basılan sekme/gösterge eşleşir; boş kare, crash veya input kilidi yok |
| NAV-02 | Aktif sekmeye 10 kez tekrar bas | İstenmeyen scroll-to-top, stack reset veya veri isteği çoğalması yok |
| NAV-03 | Film/Dizi listesini kaydır; başka sekmeye git, geri gel | Aynı kaydırma konumu, filtreler ve yüklenen içerik korunur |
| NAV-04 | Calendar→profil, CineSwipe→Hub, GameHub→Ayarlar; arada elle sekme değiştirip aynı yönlendirmeyi yinele | Her seferinde istenen sekme açılır; parametre tekrarları kaybolmaz |
| NAV-05 | Her sekmeden bir detay aç, iOS kenar geri/Android back ile dön | Doğru kök sekme ve scroll state; detayda yanlış bar yok |
| NAV-06 | Bütün 66 kayıtlı kök ekran için aç/kapat smoke matrisi | Hedef bulunamadı hatası veya yanlış navigation parent yok |
| NAV-07 | Altı mevcut seelogd:// path türünü soğuk/sıcak başlangıçta aç | Path ve parametreler korunur; auth sonrası hedef kaybolmaz |
| NAV-08 | Bildirime uygulama kapalı/açık/arkadayken bas | Tek hedef ekran; yinelenen açılış ve yanlış sekme yok |
| NAV-09 | Login, onboarding, profil tamamlama, logout ve başka hesapla giriş | Yetkisiz içerik/önceki hesap state'i görünmez; doğru başlangıç |
| NAV-10 | Debug erişimini seçilen yeni yerinden aç ve geri dön | Özellik kaybolmaz; native sekme sınırına takılmaz |
| UI-01 | Dizi/Film/Hub/Profil/Ayarlar en alta kaydır; son öğeye bas | Bar altında kalan dokunulamaz içerik veya çift inset yok |
| UI-02 | CineMatch'e bas; pet kapalı/açık; pet sürükle ve uzun bas | Doğru AI akışı; bar yanlış sekme seçmez; modal üstte kalır |
| UI-03 | Arama, yorum, mesaj ve AI girişinde klavyeyi aç/kapat | IME ve sistem barı çakışmaz; input/submit ulaşılabilir; kapanınca yerleşim düzelir |
| UI-04 | Quick actions, liste taşı/sil, tarih çarkı, avatar, story export, trailer ve paylaşım modallarını aç/kapat | Z-order/touch doğru; modal üzerinden alttaki tab'a dokunma sızmaz |
| UI-05 | Açık/koyu/özel temayı uygulama açıkken değiştir | Okunabilir ikon/seçim; beyaz/siyah parlama ve kayıp cam yok |
| UI-06 | Türkçe/İngilizce ve uzun etiketli mevcut diller, büyük yazı ölçeği | Taşma/kırpılma yok; erişilebilir sekme adları doğru |
| UI-07 | Döndürme, dar ekran, Android split screen, iPad yerleşimi | Doğru safe-area, bar/FAB konumu; seçim kaybolmaz |
| UI-08 | Kaydırırken bar altındaki poster/görsel değişimini izle | Cam canlı içeriği işler; eski sekmenin görüntüsü donup kalmaz |
| FB-01 | iOS eski sürüm; Android API 31–32; API <31 için desteklenen cihaz | Tam olarak mevcut fallback düzeyi; native import crash'i yok |
| FB-02 | API 33+ üzerinde renderer'ı test anahtarıyla kullanılamaz yap | Mevcut blur; ayrı üçüncü parti fallback tonu görünmez |
| FB-03 | full→balanced→off→full; liste kaydırılmış ve yerel seçim yapılmışken | Tercih anında uygulanır; ekran/provider remount kaynaklı state kaybı yok |
| FB-04 | Saydamlığı/hareketi azalt, kontrastı artır; uygulamaya geri dön | OS tercihi yeniden okunur; okunurluk ve hareket davranışı uygun |
| FB-05 | Hedef henüz bağlanmadan veya native modül içermeyen desteklenen eski binary ile aç | Güvenli katman; modül hatası yok; uyumsuz OTA zaten runtime ile engellenir |
| FB-06 | Kontrollü native init/shader hata dönüşü, sonra tekrar başlat | Güvenli mod ve teşhis; sonsuz yeniden deneme yok |
| A11Y-01 | VoiceOver/TalkBack ile sekmeleri sırayla seç | Etiket, seçili durum ve odak sırası doğru; çift erişilebilir ikon yok |
| A11Y-02 | Dokunma hedeflerini kenarlardan dene; ekran okuyucuyla modal aç/kapat | FAB/bar birbirinin hedefini kapatmaz; odak geri döner |
| LIFE-01 | 20 arka plan/ön plan döngüsü, ekran kilidi ve yeniden açma | Siyah yüzey/kayıp GPU kaynağı yok; animasyonlar arkada durur |
| LIFE-02 | Offline açılış, ağ geri gelişi ve veri yenilenirken sekme değiştir | Bar kullanılabilir; tekrarlanan listener veya ağ patlaması yok |
| DATA-01 | İzleme/puan/liste değiştir; sekmeler arasında gez, yeniden aç | Mevcut veri sayaçları ve local draft'lar korunur |
| PERF-01 | Aynı cihaz/veriyle legacy vs glass: ilk açılış, 50 geçiş, 60 sn kaydırma | Frame time, jank ve açılış farkı kaydedilir; belirgin regresyon varsa glass açılmaz |
| PERF-02 | 10 dk kaydırma/sekme/modal karışık kullanım | Artan native heap/listener sayısı ve sürekli ısınma eğilimi araştırılır |
| REL-01 | Yeni preview binary + uyumlu OTA; eski runtime; glass devre dışı açılış | Doğru update eşleşmesi ve geri dönüş; eski build yeni modüle erişmez |

Cihaz matrisi: iOS 26+ gerçek iPhone, desteklenen eski iOS gerçek/simülatör, iPad; Android API 33+ orta segment gerçek cihaz ve farklı GPU/OEM ikinci cihaz, API 31–32 ve uygulamanın gerçekten desteklediği API <31. Gesture navigation ve üç tuşlu navigation ayrı çalıştırılacak. Android 16 emülatörünün geçmesi eski Android veya gerçek GPU testinin yerine geçmez.

Otomasyon ayrımı:

- Mevcut Jest yalnız saf JS mantığını test ediyor. Capabilities karar tablosu, eksik modül, bilinmeyen platform/API, tercih önceliği ve initialTab tekrarları için saf testler eklenecek.
- UI entegrasyonu için SDK 57 ile uyumlu jest-expo/React Native Testing Library kurulumu ayrı doğrulanacak. Mock edilen native barın yeşil testi gerçek cam kanıtı sayılmayacak.
- Maestro veya eşdeğer cihaz E2E aracıyla NAV/UI/LIFE senaryoları, fixture hesap ve kararlı testID'ler üzerinden yürütülecek. Native bar accessibility ağacındaki gerçek seçiciler prototipten alınacak.
- Android native build ve iOS Xcode/EAS build yapılacak; iki platform Metro export'u ek kontrol olacak. Export'un native link veya GPU sorunlarını yakaladığı varsayılmayacak.
- Gerçek sosyal veri üzerinde mesaj gönderme/silme yaparak test edilmeyecek; gerekli mutasyonlar ayrılmış test hesabı/verisiyle yürütülecek.
- Önerilen performans kabul eşiği: aynı cihazda beş tekrarın medyanında açılış ve etkileşim sürelerinde >%10 regresyon araştırma kapısı; 60 Hz için 16,7 ms, 120 Hz için 8,3 ms kare bütçesi referans alınacak. Bunlar ölçülmüş sonuç değil, önerilen kabul hedefidir.

## 9. Bu araştırmada gerçekten çalıştırılan kontroller

| Kontrol | Sonuç |
| --- | --- |
| `npm test -- --runInBand` | 90 suite: 89 geçti, 1 başarısız. 1189 test: 1187 geçti, 2 başarısız. Yaklaşık 6,58 saniye Jest süresi |
| Başarısızlık | `__tests__/i18nKeys.test.js`: TR ve EN'de aynı 12 eksik `autoI18n` anahtarı |
| Mevcut blur/efekt testleri | Geçen testler içinde `blurSupport`, `surfaceBlur`, `effectSettings`, `deviceTier` bulunuyor; yeni glass davranışını test etmiyor |
| `npx expo install --check` | Başarısız: 18 paket için güncelleme önerisi; Expo ~57.0.21 ve RN 0.86.3 dahil |
| Paket export/peer kontrolü | npm registry üzerinden bottom-tabs unstable export'u ve Android aday sürümleri/lisansları kontrol edildi |
| `adb devices -l` | Bağlı/çalışan cihaz yok |
| Emülatör envanteri | Medium_Phone_API_36.0, Pixel_8a, Pixel_9_Pro, Pixel_9_Pro_2 tanımlı; bu araştırmada başlatılmadı |
| iOS test ortamı | Bu oturum Windows; yerel Xcode/iOS Simulator çalıştırılmadı |
| Yeni native/etkileşim testleri | Yapılmadı: yeni uygulama/prototip henüz yok; listedeki senaryolar bekliyor |

Eksik anahtarlar: `sezon_izlendi_olarak_isaretlendi`, `bolum_izlendi_olarak_isaretlendi`, `bolum_izleme_tarihi`, `sezon_izleme_tarihi`, `dizi_izleme_tarihi`, `film_izleme_tarihi`, `izleme_kaydini_sil_onay`, `kaydi_sil`, `tarih_bilinmiyor`, `kayit`, `farkli_tarih_sec`, `izleme_kaydi_yok` (tümü `autoI18n` altında). Çağrı yerleri SeasonItem, WatchedAdd, WatchedDateSheet ve WatchHistorySheet. Bunlar navigasyon değişmeden önce görülen baseline hatalarıdır; bu araştırmada düzeltilmedi.

Uygulama kodu ve bağımlılıklar bu çalışma kapsamında değiştirilmedi. Bu belge araştırma çıktısıdır. Cihazda doğrulanmış yeni tab bar veya tamamlanmış geçiş olarak değerlendirilmemeli.

## 10. Uygulama sonucu — 9 Eylül 2026

Bu bölüm, yukarıdaki başlangıç araştırmasından sonra yapılan uygulamanın kaydıdır; önceki iki “henüz yok” ifadesini günceller.

- Expo Router'a tam geçiş yapılmadı. Kök React Navigation stack ve mevcut 66 rota korundu. Bunun yerine `react-native-screens` içindeki `Tabs.Host` / `Tabs.Screen` doğrudan kullanıldı; bunlar Expo Native Tabs'ın dayandığı native iOS sekme yüzeyidir. Bu tercih deep link, auth ve mevcut navigation prop sözleşmesini taşımadan iOS'ta sistem tab barına geçiş sağlar.
- Beş ürün sekmesi (Dizi, Film, Hub, Ayarlar, Profil) korunuyor. Altıncı Debug sekmesi kaldırılmadı; Ayarlar ekranındaki Debug girişiyle açılıyor. CineMatch yerleşimi artık profil yuvasından türetiliyor.
- iOS 26+ ve kullanılabilir native host üzerinde sistem native tab bar kullanılıyor. Android API 33+ üzerinde build içine bağlanmış AGSL tabanlı `liquid-glass-kit` yüzeyi canlı screen backdrop'unu kullanıyor. `full` etkide destek yoksa, `balanced` etkide veya renderer hata bildirirse mevcut AdaptiveBlurView hattına; düşük API/erişilebilirlik/`off` tercihlerinde düz katmana geri dönülüyor.
- Effect tercihi, azaltılmış saydamlık, yüksek kontrast, azaltılmış hareket, uygulama aktifliği ve klavye durumu kararın parçasıdır. Bar değişimi mevcut ekran ağaçlarını, liste konumlarını ve yerel form state'ini yeniden kurmaz. Klavye açılırken bar ile yardımcı düğme gizlenir; yardımcı düğme unmount edilmediği için kendi state'ini korur.
- `patches/liquid-glass-kit+1.0.0.patch` Android renderer için API/shader sağlık sorgusu, backdrop recording kapısı ve `ready`/`failed` durum olayı ekler. Patch `postinstall` ile uygulanır. Yeni native kod nedeniyle sürüm/runtime 1.4.4'e yükseltildi; eski binary'lere bu kodu içeren OTA gönderilmemelidir.

Çalıştırılan doğrulamalar:

| Kontrol | Sonuç |
| --- | --- |
| `npm run test -- --runInBand` | 92 suite, 1223 test geçti |
| Tab state / capability / shell odaklı testleri | 34 test geçti; repeated `initialTab`, native/custom seçim uzlaşması, state koruma, klavye ve tekrar-seçim etkileri kapsandı |
| `:app:assembleDebug` (x86_64) | Başarılı; debug APK üretildi |
| Bağımlılık ağacı | `expo-modules-core@57.0.17` Expo ve liquid-glass-kit tarafından tek kopya olarak çözülüyor |
| Lisans envanteri | Yeniden üretildi; yeni bağımlılıklar dahil |
| `git diff --check` (bu değişikliğin dosyaları) | Geçti |

Android emülatöründe UI denemesi bu oturumda yürütülemedi: tanımlı AVD, kullanıcı profilindeki `snapshot.lock.lock` dosyasına erişemediği için ADB'ye hiç bağlanamadı. Bu bir uygulama derleme hatası değildir; APK derlemesi geçti. Gerçek Android GPU, iOS 26 cihazı/Xcode ve eski cihaz fallback senaryoları bu nedenle hâlâ cihaz kabul matrisinde bekliyor. Geliştirici fixture'ı `EXPO_PUBLIC_TAB_BAR_QA=1` ile çalışır; backend'e yazmadan sekme, klavye, modal, tema, scroll ve effect modlarını cihazda denemek için eklenmiştir.

## 11. İkinci ayrıntılı test turu — 9 Eylül 2026

- Tüm Jest paketi tekrar çalıştı: **92 suite, 1223 test geçti**. Tab yüzeyi için 34 odaklı test; capability/fallback kararları, 50 hızlı seçim, stale native acknowledgement, initialTab tekrarı, beş native screen kaydı, klavye görünürlüğü, local draft ve CineMatch katman önceliğini kapsıyor.
- `EXPO_PUBLIC_TAB_BAR_QA=1 npx expo export --platform android` Metro/Hermes bundle'ını başarıyla üretti. Bu, normal uygulama ile development QA fixture'ının tüm statik importlarını çözdü.
- `npx expo install --check` sonucu: **Dependencies are up to date**. Çözülmüş Expo core ve liquid-glass-kit tek `expo-modules-core@57.0.17` kopyasını kullanıyor.
- `npx expo config --type public` uygulama sürümünün ve `runtimeVersion: { policy: "appVersion" }` sözleşmesinin 1.4.4 olduğunu, `expo-image` plugin'inin de çözüldüğünü doğruladı.
- Android `:app:assembleDebug` yeniden APK aşamasına geldi ve başarılıydı. Aynı komuttaki `:app:lintDebug`, uygulama kodundan değil, bağımlılık `react-native-worklets:lintAnalyzeDebug` içinde Android Lint/Kotlin'in `Cannot find a KaModule for the VirtualFile` iç hatasıyla sona erdi. Bu nedenle lint sonucu “geçti” olarak sayılmıyor; native derleme sonucu geçerli.
