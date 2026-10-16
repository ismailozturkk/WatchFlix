# Dil desteği rehberi (yeni dil ekleme referansı)

> Amaç: "X dilini ekleyelim" dendiğinde **önce bu dosya okunur**. Dilin nerede seçildiği, hangi
> yüzeylerde kullanıldığı, bir dil eksik bırakılırsa nereye düşeceği ve yeni dil için adım adım
> liste burada. İlk yazım ve İspanyolca (`es`) ekleme: 2026-10-15/16. Sayılar o günün kodundan;
> kod büyüdükçe kayar — kesin sayı için en alttaki "Yeniden sayma komutları"na bak.
>
> **Kısa yol:** yeni dil = `utils/appLanguages.js`'e bir satır + `translations/xx.json` + bu dosyadaki
> bölüm 9 listesi. Listeyi atlayan her adım o yüzeyi **sessizce İngilizceye** düşürür (Türkçeye değil).

## 1. Tek cümlede durum

Uygulamada **dil tek bir metin sözlüğü değil, yedi ayrı mekanizma**: (1) `translations/*.json`
(~2.940 yaprak anahtar), (2) `autoI18n.*` + `i18nText`, (3) yerel `{tr,en,es}` kopya tabloları,
(4) satır içi `lang === "tr" ? … : …` dallanmaları, (5) sunucu (Cloud Functions) metinleri,
(6) native widget kodu (Kotlin/Swift), (7) TMDB `language`/`region`/görsel dili parametreleri.
Hepsinin **tek ortak karar noktası** artık `utils/appLanguages.js` (bölüm 9). Yeni dil eklemek =
JSON paketi + o kayıt + yan mekanizmaların her birine bir giriş.

## 2. Dilin seçimi, saklanması, uygulanması

| Adım | Dosya | Not |
|---|---|---|
| **Merkezi kayıt** | `utils/appLanguages.js` → `APP_LANGUAGES` | Kod, ad, bayrak ISO'su, `intlLocale`, TMDB dil/bölge/görsel dilleri, yasal sayfa dili, AI prompt adı. Aşağıdaki her şey buradan beslenir |
| Kayıt (saklama) | `services/storage/registry.js` → `Keys.language` (`"selectedLanguage"`, string, varsayılan `"tr"`) | MMKV, senkron okunur |
| İlk açılış | `translations/index.js` → `cozumlenmisDil()` | Kayıt **yoksa** cihaz dili (`utils/deviceLanguage.js`). Kayıt varsa o. `has()` ile `get()` ayrımı bilerek: `get()` kayıt yokken `"tr"` döndürür |
| Cihaz dili | `utils/deviceLanguage.js` | `DESTEKLENEN_DILLER` kayıttan; desteklenmeyen cihaz dili `YEDEK_DIL = "en"`e düşer. **İspanyolca cihaz artık ilk açılışta İspanyolca açılır** |
| i18next | `translations/index.js` | `resources` (tr/en/es), `fallbackLng: { es: ["en","tr"], default: ["tr"] }`, `compatibilityJSON: "v3"`, `languageDetector.async = false`. Detector'ın `cacheUserLanguage` **no-op**: yazan tek taraf `AppSettingsContext` |
| Yazma | `context/AppSettingsContext.js` → `changeLanguage` | `setSelectedLanguage` + `persist(Keys.language, …)` |
| Yayın | `context/LanguageContext.js` | `useLanguage()` → `{ language, toggleLanguage, t }`. `t` = `i18n.getResourceBundle(dil, "translation")` **düz nesne**. `selectedLanguage` değişince `i18n.changeLanguage` + `setTmdbTitleLanguage` |
| Seçici UI | `screens/tabs/SettingsScreen.js` → `LANGUAGES = APP_LANGUAGES` + dil alt sayfası (arama kutulu, `CountryFlag`) | Bayrak: `react-native-country-flag` ISO kodu (`es` → İspanya bayrağı; dil≠ülke, bilinçli) |
| Onboarding dil düğmesi | `OnboardingScreen` → `nextAppLanguage(language)` | Kayıt sırasında döner: tr → en → es → tr |
| Yedek/geri yükleme | `utils/settingsBackup.js` → `language: { check: isSupportedAppLanguage }` | Kayıttan; eski yedeklerdeki boolean/`"en"` değerleri `legacyFlagToLanguage` ile köprülenir |

Döngü uyarısı: `AppSettingsContext` açılış state'ini `cozumlenmisDil`den alır; ayrışsalardı
`LanguageContext` depodaki `"tr"`yi i18n'e geri yazıp cihaz dilini ezerdi. Bu iki yer tek kaynaktan
beslenmeli.

## 3. Metin mekanizmaları (hangisi nerede, yeni dilde ne yapılır)

### 3.1 `translations/{tr,en,es}.json` — `t.xxx` (namespace) — 71 dosya, ~440 erişim
`const { t } = useLanguage(); t.profileScreen.title`. İç içe nesneler (`cineSwipe`, `AICineChat`,
`shareScreen`, `profileScreen`, `ChatModal`, `tvShowsDetails`, `cineRoomResults`, `movieScreens`…) +
~240 düz anahtar (`notifBody*`, `notifChannel*`, `language`, `searchLanguage`…).
Eksik anahtar = `undefined` (ekranda boş ya da `undefined` yazısı!). Yeni dilde **tüm anahtarlar şart**;
`__tests__/i18nKeys.test.js` küme eşitliğini, yer tutucu eşitliğini, dizi uzunluklarını ve boş değeri denetler.

### 3.2 `autoI18n.*` + `i18nText(anahtar, türkçeYedek)` — ~2.770 çağrı, 224 dosya, ~2.200 anahtar
`utils/i18nText.js`: `i18n.t(key, { defaultValue })`, bulunamazsa **Türkçe yedek metin**. Hem
bileşenlerde hem bileşen dışı modüllerde (servis, util) çalışır; dili `i18n` tekilinden okur.
Yeni dilin paketi **tam** değilse yedek zinciri (es → en → tr → kaynaktaki Türkçe metin) devreye girer;
bu yüzden `i18nKeys.test.js` var (bölüm 8). Dinamik anahtar kuran 3 dosya testte elle kayıtlı:
`ReportReasonSheet` (`REASON_UI`), `NotificationPrimingSheet` (`BENEFITS`), `CacheManagerModal`
(`cache_${id}`). Yeni dinamik anahtar → o testin `DINAMIK_YERLER`ine ekle.

### 3.3 Yerel `{tr, en, es}` kopya tabloları (JSON dışı) — ~25 modül
Her biri kendi seçicisini taşır. **Seçici `copyLanguage(language, ["tr","en","es"])` /
`pickByLanguage(language, tablo)`** olmalı (bilinmeyen → İngilizce). Üç dili de `__tests__/copyTablesSpanish.test.js`
karşılaştırır (anahtar kümesi, yer tutucu, işlev parametre sayısı) — **yeni tablo yazarsan o testin
`TABLOLAR` listesine ekle.**

| Modül | Seçici | Not |
|---|---|---|
| `utils/aiCopy.js` | `getAiCopy(lang)` → `TR`/`EN`/`ES` | CineMatch arayüz metinleri |
| `utils/favoritesCopy.js` | `getFavoritesCopy` | Dört favori |
| `utils/wrappedStrings.js` | `getWrappedStrings` | Wrapped slaytları |
| `utils/wrapped.js` | `lang === "tr" ? … : lang === "es" ? … : …` | Wrapped hesap metinleri, kişilikler |
| `utils/premiumFeatures.js` | `unitLabel`, `formatFeatureValue`, `buildLimitCopy` | Plan kapıları metinleri |
| `utils/premiumUpsellContent.js`, `premiumUsageModel.js` | `copyLanguage` | Yükseltme sayfası / kullanım ekranı |
| `utils/typographyRoles.js` | `names/descriptions: {tr,en,es}` | Yazı tipi adları/açıklamaları |
| `utils/profileStoryCard.js` | `copyLanguage` | Profil paylaşım kartı (tür adları dahil) |
| `utils/onboardingPreferences.js` | `onboardingGenreLabel` | Onboarding tür/tercih seçenekleri |
| `screens/onboarding/onboardingCopy.js`, `OnboardingShowcases.js` (`L(lang, tr, en, es)`) | `getOnboardingCopy` | Tanıtım metinleri |
| `screens/game/gameConfig.js`, `gameLabels.js` | alanlar `tr:`/`en:`/`es:` | Oyun modları, zorluklar |
| `screens/tabs/settings/backupCopy.js` | `getBackupCopy` | Yedekleme ekranı |
| `components/theme/themeStudioCopy.js` | `getStudioCopy` | Tema Stüdyosu |
| `components/badges/*` | `lang` (+ `ekTr/ekEn/ekEs`, `PERDE_ADLARI_*`) | Rozet katalogu (en büyük tablo) |
| `components/tournament/phaseMeta.js`, `services/tournamentEngine.js` | `tr:`/`en:`/`es:` | Turnuva aşamaları |
| `services/emmyService.js`, `services/oscarService.js` | idem | Ödül kategorileri |
| `services/aiCineInsights.js` | `FOLLOW_UP_COPY[…]` | AI sohbet çipleri, `formatDuration` |
| `services/appleAuthService.js`, `googleAuthService.js`, `accountConnectionsService.js` | hata metinleri | Giriş hata iletileri |
| `screens/tabs/settings/widgets/widgetSamples.js`, `IosPreviews.js`, `AndroidPreviews.js` | tablo / `lang` | Widget önizleme örnek verisi (native ile aynı metinler) |

### 3.4 Satır içi dallanma — ~600 satır, ~80 dosya
`language === "tr" ? "…" : language === "es" ? "…" : "…"`. Metni doğrudan koda gömer; JSON'a
girmediği için **ne `i18nKeys` ne `copyTablesSpanish` görür**. İspanyolca eklenirken bu dallanmalara
**üçüncü kol** eklendi (`PremiumScreen`, `AccountConnectionsScreen`, oyun ekranları, `RegisterScreen`…). Kural:
yeni dilde `else` kolu İngilizce kalır; yeni dil için üçüncü kol **eklenmediyse** o satır İngilizce görünür.
Yeni satır yazarken ikili ternary yerine `pickByLanguage`/`copyLanguage` kullan.

### 3.5 Sunucu ve native
Bölüm 5, 6. JS paketlerinden bağımsız; ayrı deploy/derleme ister.

## 4. Metin DIŞINDA dile bağlı yüzeyler

| Yüzey | Nerede | Dile nasıl bağlı (güncel) |
|---|---|---|
| **TMDB `language`** | ~35 dosya (`MovieContex`, `TvShowContex`, aramalar, `SeeAllScreen`, `onboarding/useOnboardingData`, `dataDownloader`, `sceneGameService`, `cineswipe/*`, `tmdbLookup` …) | `tmdbLanguageOf(language)` (`tr-TR` / `en-US` / `es-ES`). `utils/tmdbTitleFallback.js::tmdbLanguageForApp` kayıtlı dilleri kayıttan, tanınmayan kodu (içeriğin özgün dili: `"ja"`) olduğu gibi döndürür. Servis varsayılan parametreleri (`language = "tr-TR"`) çağıranın verdiği değere ezilir |
| **TMDB `watch_region`** | `MovieContex`, `TvShowContex`, `SeeAllScreen`, `MovieDetail`, `TvShowsDetails`, `Settings`, `useOnboardingData`, `DiscoveryMediaRail`, `dataDownloader`, `tmdbLookup`, `DeviceNotificationsContext` | `tmdbRegionOf(language)` (`TR`/`US`/`ES`). **Dil ≠ ülke**: İspanyolca için tek bölge seçilemez; `ES` bilinçli varsayılan (Latin Amerika için ileride bölge seçici gerekir) |
| **Önbellek anahtarları** | `movie_trends_${tmdbLanguage}_…`, `scene:pool:…:${language}`, `settings_provider_catalog_${lang}_${region}` | Dil anahtara girer → yeni dil ayrı önbellek (ilk açılışta soğuk, sorun değil) |
| **Başlık yedekleme** | `utils/tmdbTitleFallback.js` | Sıra: uygulama dili → İngilizce → özgün başlık; `/translations` ile tamamlar |
| **Tür adı kanonikleştirme** | `utils/genreCanon.js` `ALIASES`, `services/aiCineInsights.js::GENRE_ALIASES` | Tür **ad** olarak saklanır; TMDB türleri istemci diline göre çevirip döndürür → **yeni dilin tür adları aliasa girmezse `other` kovasına düşer** (tür puanı/rozetleri sessizce bozulur). `fold` sonrası: küçük harf, aksansız (`ciencia ficcion`). İspanyolca eklendi |
| **Tür adları (id→ad)** | `utils/genreLabels.js` | `autoI18n.*` anahtarlı; JSON'a çeviri yeter |
| **Fragman** | `utils/trailerLanguages.js`, `components/video/TrailerSection.js` | 13 dil listeli (`en tr de fr es it pt ru ja ko zh hi ar`). `appLangCode = normalizeAppLanguage(language)` → sıra: uygulama dili → `en` → özgün dil → seçilen. Yeni dil kayıtlıysa fragman otomatik o dille başlar |
| **Görsel (poster/arka plan) dili** | `ImageGalleryModal`, `StoryShareScreen` | `tmdbImageLanguageOrderOf(language)` → `"es,en,null"` |
| **Tarih/sayı biçimi** | `Intl.DateTimeFormat`, `toLocaleDateString`, `Intl.NumberFormat` — ~40 dosya | `intlLocaleOf(language)`. **Kalan sabit `"tr-TR"`**: yalnız hata ayıklama ekranı (`UsageDebugScreen`, `usageTrackerService`) ve arama/katlama yardımcıları (`toLocaleLowerCase("tr-TR")` — bilerek, `İ/ı` için) |
| **Sıralama / harf grubu** | `utils/friendsListModel.js` (dile bağlı), `SharedListsContext:68` ve `utils/listSearch.js:239` (**`"tr"` sabit**) | Bu iki yer hâlâ `localeCompare(…, "tr")`: İspanyolca `ñ`/`á` kullanıcılarında yalnız liste adı sıralaması etkilenir. **Yapılmadı** (düşük etki) |
| **Arama katlama** | `foldForSearch` (arkadaş/sohbet/liste aramaları) | NFD + aksan atma; İspanyolca için ek iş gerekmez (`ñ` → `n`, arama toleransı, bilinçli) |
| **AI sohbeti (Gemini)** | `services/geminiService.js`, `aiCineService.js` | Prompt'a `aiPromptLanguageOf(language)` konur (`"tr"`, `"en"`, `"Spanish (es)"`). Ham kod yerine **dil adı** vermek daha güvenli |
| **Hukuki bağlantılar** | `utils/legalLinks.js` → `…/privacy.html?lang=tr|en` | `legalLanguageOf(language)`; `website/legal.js` yalnız `tr`/`en` biliyor → **İspanyolca kullanıcı İngilizce sayfayı açar** (kayıtta `legalLang: "en"`). `LegalConsentNotice` metni ise İspanyolca |
| **Analytics** | `utils/analyticsEvents.js` `APP_LANGUAGE`, `OnboardingScreen` `entry_language` | Değer serbest dil kodu; panelde `es` yeni değer olarak görünür |
| **Premium fiyat pazarı** | `utils/premium.js:365` `language === "tr" ? configured.tr : configured.global` | Pazar **dile** bağlı (TR/global). İspanyolca → `global` fiyat. Ülke bazlı fiyat gerekirse dilden değil mağaza ülkesinden okunmalı |
| **Rakam/birim kısaltmaları** | "sa/dk" ↔ "h/m", "S1 · 3. Bölüm" | JSON'da `notifEpisodeShort`; widget yükü `reminderWidgetService`te `pickByLanguage`. İspanyolca ondalık virgül + "mil" kısaltması |
| **Yazı tipi** | `context/TypographyContext.js`, `@expo-google-fonts/*` | İspanyolca karakterler (á é í ó ú ñ ü ¿ ¡) Latin-1 → tüm yazı tiplerinde var; cihazda göz kontrolü yine de |

## 5. Bildirimler (4 katman, hepsi ayrı dil kaynağı)

1. **Yerel zamanlanmış hatırlatıcılar** — `context/DeviceNotificationsContext.js`:
   `buildReminderBody` (`notifReminderBody*`), bölüm etiketi `notifEpisodeShort`. Hepsi `t.*` (JSON).
   Başlıklar içerik adı (film/dizi) ya da `t.movieReminderNotifications`. Zamanlama
   `services/reminderNotificationScheduler.js` (dil bilmez, hazır başlık/gövde alır).
2. **Ön plan sosyal bildirimi** — aynı dosyada `buildSocialContent(item, t)`: `t.notifBody*` + Türkçe
   yedek metin. Sunucudaki `buildContent` ile **birebir aynı mantık** olmak zorunda.
3. **Android bildirim kanal adları** — `setChannelNames({ default: t.notifChannelGeneral, … })`; dil
   değişince yeniden uygulanır (Android var olan kanalın adını günceller).
4. **Push (arka plan) — SUNUCU** — `functions/index.js`:
   - `STRINGS = { tr, en, es }` + `buildContent(n, lang)`: sosyal push gövdeleri.
   - `STREAM_STRINGS = { tr, en, es }`: "şu platformda izlenebilir" günlük bildirimi.
   - `NOTIFICATION_LANGUAGES` + `pickNotificationLang(raw)`: **kayıt yoksa `"tr"` (eski kullanıcılar),
     tanınmayan dil `"en"`**. Üç çağrı yeri (buildContent, push dağıtımı, `processUserStreaming`) bunu kullanır.
   - Dil kaynağı `Users/{uid}.notificationLanguage`; istemci `DeviceNotificationsContext` içinde
     `normalizeAppLanguage(language)` yazar. Yayın bölgesi `Users/{uid}.streamingProviders.region` =
     `tmdbRegionOf(language)`.
   - **Bu dosya değişince `firebase deploy --only functions` şart** (JDK/keşif zaman aşımı notları:
     `rules-tests-jdk` belleği). İstemci kanal metinleri (JSON) ile sunucu metinleri el ile senkron tutulur.
   - **Yeni dil**: `STRINGS.xx`, `STREAM_STRINGS.xx`, `NOTIFICATION_LANGUAGES`'e kod. Sunucu `functions/`
     içinde `appLanguages.js`'i **import edemez** (ayrı paket) — iki listeyi elle eşle.
5. İzin istem metinleri (`NotificationPrimingSheet`, `notifPermission*`) JSON'da.

## 6. Widget'lar ve native kaynaklar

| Yüzey | Dosya | Dil nasıl |
|---|---|---|
| JS → native yük | `services/reminderWidgetService.js`, `statsWidgetService.js`, `listsWidgetService.js`, `widgetBridge.js` | Yük JS'te kurulur (`pickByLanguage`), `language` kodu da native'e geçer (`UserDefaults` App Group anahtarı `"language"` / Android `SharedPreferences`) |
| **Android sabit metinler** | `native/android-widgets/java/com/smlztrk/seelogd/widget/WidgetLanguage.kt` (+ `ReminderWidgetProvider.kt`, `ReminderWidgetRemoteViewsService.kt`, `ListsWidgetProvider.kt`, `StatsWidgetProvider.kt`) | `WidgetLanguage.of(raw)` → `"tr"/"es"` ya da `"en"` (bilinmeyen → İngilizce, **kayıt yoksa `"tr"`**); metin `WidgetLanguage.pick(lang, tr, en, es)`; tarih `WidgetLanguage.locale(lang)`. Config eklentisi (`plugins/withAndroidWidgets.js`) `java/` klasörünü **bütün olarak** kopyalar — yeni `.kt` için eklenti değişmez |
| **iOS sabit metinler** | `targets/reminder-widget/shared.swift` (`widgetSupportedLanguages`, `widgetLanguage()`, `widgetPick(lang, tr:, en:, es:)`), `index.swift`, `lists-widget.swift`, `stats-widget.swift` | Aynı yapı. `stats-widget.swift` sabit metin taşımaz (başlık/etiket JS yükünden gelir). Eski `isTurkish` kalıbı kalktı |
| Widget **adları** (sistem seçicisi) | iOS `.configurationDisplayName("Seelogd Yaklaşanlar")` (Swift'te sabit Türkçe); Android `native/android-widgets/res/values/widget_strings.xml` (yalnız `values/`, Türkçe) | **Uygulama dilini değil**, sabit Türkçe; `values-en/`, `values-es/` yok. **Yapılmadı** — İngilizce için de yoktu. Yerelleştirmek için Android `values-xx/`, iOS `Localizable.strings`/`LocalizedStringResource` gerekir (sistem diline göre çalışır, uygulama diline değil) |
| Uygulama içi önizleme | `IosPreviews.js`, `AndroidPreviews.js`, `widgetSamples.js` | Gerçek widget'ın birebir çizimi; metinler native ile **aynı** olmalı. `isTr = language !== "en"` kalıbı kalktı |
| Native değişikliği | Kotlin/Swift | **Yeni native build şart** (EAS). OTA yetmez. Eski build'de İspanyolca widget metni İngilizce görünür (`isTurkish` ikilisinde `es` → İngilizce) |
| Koruma | `__tests__/widgetNativeLanguage.test.js` | Kotlin `SUPPORTED` ve Swift `widgetSupportedLanguages` kayıtla aynı mı, `pick`/`widgetPick` her dili taşıyor mu, `isTurkish` geri girdi mi |

**Yeni dil için native**: `WidgetLanguage.kt` `SUPPORTED`'e kod + `pick(...)` imzasına ve `when`'e kol +
`locale()`; her `WidgetLanguage.pick(...)` çağrısına yeni parametre (şu an 4 dosya, 11 çağrı). Swift'te
`widgetSupportedLanguages`, `widgetPick` imzası/`switch`'i, `index.swift` (9), `lists-widget.swift` (2) çağrı.
Swift bu makinede derlenemez (Windows) — **EAS iOS build'iyle doğrula**.

## 7. Kural: bilinmeyen dil → İngilizce ("düşüş yönü")

Eski kodda aynı iş için **iki ters kalıp** vardı; yeni bir dil kodu (`"es"`) gelince hangi kalıp varsa o
dile düşüyordu:

- **A) `=== "en"` mi? değilse Türkçe** (47 satır, ~35 dosya) → yabancı kullanıcıya **Türkçe** gösterirdi.
- **B) `=== "tr"` mi? değilse İngilizce** (11 satır) → güvenli yön.
- **C) İkili `=== "tr"` metin ternary'si** (~600 satır) → `else` İngilizce olduğu için ES İngilizce görürdü.

**Bu çalışmada**: A'nın tamamı `copyLanguage`/`normalizeAppLanguage`/`pickByLanguage`'e bağlandı (kalan
tek `!== "en"` `tmdbTitleFallback.js:149`, içeriğin **özgün dili** için, uygulama dili değil); C'ye
üçüncü `es` kolu eklendi. Bugün repoda `=== "en" ? "en" : "tr"` kalıbı **kalmadı**. Kural aynen geçerli:

> **Bilinmeyen dil → İngilizce** (cihaz dili okunamazsa da `YEDEK_DIL = "en"`). Türkçe **yalnız** `tr`
> seçilince çıkar. Yeni kod yazarken `lang === "en" ? en : tr` **yazma**.

İstisnalar (bilerek): sunucuda **kayıt hiç yoksa** `"tr"` (eski kullanıcılar Türkçe aldı; `pickNotificationLang`,
Android `WidgetLanguage.of`), `Keys.language` varsayılanı `"tr"`.

## 8. Testler ve bekçiler

| Test | Ne korur |
|---|---|
| `__tests__/i18nKeys.test.js` | Koddaki her statik `autoI18n.*` / `t.xxx` anahtarı **tr, en ve es** paketinde var; üç paket aynı anahtar kümesine, aynı `{{yer tutucu}}` kümesine, aynı dizi uzunluklarına sahip; EN/ES'te boş değer yok; **ES'te Türkçeye özgü harf (ğ ş ı İ) sızmaz** (tek istisna: kişi adı "İsmail Öztürk") |
| `__tests__/appLanguages.test.js` | Kayıt yapısı (alanlar, benzersiz kod), her dilin JSON'u var ve `index.js`'te, `normalizeAppLanguage`/`copyLanguage`/`pickByLanguage` düşüş yönü, ES TMDB/Intl/AI bağları, `nextAppLanguage` döngüsü, eski boolean bayrak göçü |
| `__tests__/deviceLanguage.test.js` | Cihaz dili → uygulama dili (tr/en/es/yedek) |
| `__tests__/copyTablesSpanish.test.js` | `BACKUP_COPY`, `STUDIO_COPY`, `AI_COPY`, `ONBOARDING_COPY`, `FAVORITES_COPY`, `getWrappedStrings` — üç dilde aynı anahtar/yer tutucu/işlev parametre sayısı; pozitif kontrol; bilinmeyen dil İngilizce |
| `__tests__/{aiCopy,favoritesCopy,onboardingCopy}.test.js` | Tek tek tablo davranışları (ES kolları dahil) |
| `__tests__/widgetNativeLanguage.test.js` | Native widget dil listeleri kayıtla aynı (bölüm 6) |
| `__tests__/settingsBackup.test.js` | Kayıtlı her dil kodu yedekten geri yüklenir; geçersiz dil (`"fr"`) reddedilir |
| `__tests__/premiumFeatures.test.js` | İspanyolca hücre/uyarı metinleri, bilinmeyen dil İngilizce, karşılaştırma tablosu üç dilde aynı satırlar |
| `__tests__/trailerLanguages.test.js`, `tmdbTitleFallback.test.js` | Fragman sırası, TMDB başlık düşüşü |
| `__tests__/{premium*,wrapped*,badgeMeta,hubWrappedModule}.test.js` | İlgili kopyaların dil çiftleri |

Bekçi kör noktası (bellek: `i18n-duplicate-key-blindspot`): test `JSON.parse` okuduğu için **yinelenen
anahtarı** görmez; `arkadas_ara` casing bölmesi bilinçle ertelendi. Satır içi ternary'lerde (3.4) **hiç
bekçi yok** — yeni üçüncü kol unutulursa metin sessizce İngilizce kalır.

## 9. Yeni dil ekleme kontrol listesi

Kod ADI = ISO 639-1 (`"xx"`). Aşağıda `xx` yerine onu koy. İspanyolca bu listeyle eklendi.

**Çekirdek (zorunlu)**
1. `utils/appLanguages.js` → `APP_LANGUAGES`'e satır: `code, name, nativeName, flag (ISO ülke), intlLocale,
   tmdbLanguage, tmdbRegion, tmdbImageLanguages ([xx,"en"]), legalLang ("en" — sayfa yoksa), aiPromptName`.
   Bu tek satır Ayarlar seçicisini, cihaz dilini, yedek doğrulayıcısını, onboarding düğmesini, fragmanı, TMDB'yi besler.
2. `translations/xx.json` — `en.json` ile **birebir aynı anahtar kümesi**; `{{x}}` yer tutucuları aynen; `\n`
   ve emoji aynen; dizi uzunlukları aynı. (Çeviri yöntemi: bölümlere ayırıp doldur, `scratchpad/es/merge.js`
   benzeri bir birleştirici ile anahtar eşitliğini doğrula.)
3. `translations/index.js` — `import xx from "./xx.json"`, `resources.xx`, `fallbackLng`'e `xx: ["en","tr"]`.
4. `utils/genreCanon.js` `ALIASES` + `services/aiCineInsights.js::GENRE_ALIASES` — yeni dilin **TMDB tür
   adları** (aksansız, küçük harf). Yoksa tür sayacı `other`a düşer.

**Metin mekanizmaları**
5. `{tr,en,es}` tabloları (3.3): her birine yeni kol; `copyTablesSpanish.test.js` kırmızı olacak, kolu ekleyince yeşil.
6. Satır içi ternary'ler (3.4): üçüncü kol / `pickByLanguage`. Bul: `rg -n '(language|lang)\s*===\s*"es"' ` ile
   **es'in olduğu her yeri** tara, aynı dosyalarda yeni dili ara.
7. Dile bağlı tarihler: `MONTHS_ES` gibi elle ay adları (`DatePickerModal`), `Intl` yoksa; hafta başlangıcı
   (`CalendarScreen`: İspanyolca Pazartesi); sayı biçimi (`formatNumber`: ondalık virgül, "mil" kısaltması).

**Sunucu / bildirim**
8. `functions/index.js`: `STRINGS.xx`, `STREAM_STRINGS.xx`, `NOTIFICATION_LANGUAGES` → **`firebase deploy --only functions`**.
9. `context/DeviceNotificationsContext.js` ek iş gerekmez (`normalizeAppLanguage`/`tmdbRegionOf` kayıttan).

**Native**
10. Widget (bölüm 6): Kotlin `WidgetLanguage.kt` + 4 sağlayıcı, Swift `shared.swift` + `index.swift` + `lists-widget.swift`,
    widget önizlemeleri (`IosPreviews.js`, `AndroidPreviews.js`, `widgetSamples.js`) → **yeni EAS native build**.
11. `app.json` izin metinleri (`photosPermission`, `calendarPermission` Türkçe sabit) ve `expo.locales` /
    `CFBundleLocalizations`: yerelleştirme **yapılmadı** (bkz. Durum).

**Dışarısı**
12. Mağaza: `store/play/xx-XX/` metinleri + ekran görüntüleri (şu an `en-US`, `tr-TR`).
13. Web: `website/privacy.html`, `terms.html`, `delete-account.html`, `legal.js` `data-lang` düğmeleri — sayfa
    yazılınca kayıtta `legalLang: "xx"` yap.
14. `utils/analyticsEvents.js` yorumu (güncel), `localeCompare(…, "tr")` sabit yerleri (bölüm 4).

**Doğrulama**
15. `npx jest` (hepsi), `node --check functions/index.js`. Uygulamayı yeni dille açıp gez: Ayarlar, Hub, Film/Dizi,
    detay, arama, sohbet, AI, bildirim ayarları, takvim (ay/gün adları), Wrapped, rozetler, Premium sayfası,
    turnuva/oyunlar, onboarding, widget önizlemesi; sonra cihaz dilini değiştirip temiz kurulum.

## 10. İspanyolca (es) — kararlar

- Hedef: **tarafsız, Latin Amerika ile İspanya'nın ortak anlayacağı İspanyolca**. Samimi `tú` hitabı
  (uygulama zaten "sen" diliyle yazılmış). `vosotros`, `vos`, `coger`, `ordenador`, `móvil` gibi bölgesel
  kelimeler yok.
- Bölge: TMDB için **`es-ES` / `ES`** (kayıtta tek yer; ileride kullanıcıya bölge seçtirmek istenirse burası ayrılır).
- Teknik terimler (`Wrapped`, `CineSwipe`, `CineMatch`, `Premium`, `Seelogd`) çevrilmez.
- Sabit sözlük: "Lista de seguimiento" (watchlist), "insignia" (rozet), "Ajustes" (Ayarlar), plan adı cümle
  içinde "Gratis" (Free), "Premium Max" aynen.
- Biçim: ondalık virgül, kompakt sayıda " mil" son eki, haftanın ilk günü Pazartesi, ay/gün adları küçük harf.
- Çoğul/eril-dişil: cinsiyetsiz ifadeler tercih edilir; "arkadaş" → `amistades`/`amigos`.
- Yasal sayfalar çevrilmedi → `legalLang: "en"` (kullanıcı İngilizce sayfayı açar; onay metni İspanyolca).

## Yeniden sayma komutları

```bash
# i18nText çağrısı ve dosya sayısı
rg -c "i18nText\(" --glob '!node_modules' --glob '*.js' | wc -l
# tr/en/es ikili-üçlü dallanma satırları
rg -n '(language|lang)\s*(===|!==)\s*"(tr|en|es)"' --glob '*.js' --glob '!node_modules' --glob '!website' | wc -l
# "Türkçe'ye düşen" kalıplar (olmamalı)
rg -n '=== "en" \? "en" : "tr"|!== "en"' --glob '*.js' --glob '!node_modules'
# sabit locale
rg -n 'tr-TR|en-US' --glob '*.js' --glob '!node_modules' --glob '!website' --glob '!__tests__'
# tr: alanı olup es: kolu olmayan tablo satırları
node scratchpad/scan4.js        # (oturum betiği; yoksa rg -n "tr: \"" ile elle)
```

Windows/Bash notu: `node -e` içinde `\n`/`\` bozuluyor → betik dosyası kullan (`windows-edit-tooling-gotchas`).

## Durum (2026-10-16, İspanyolca çalışmasının sonu)

**Yapıldı** (otomatik doğrulama: tam jest 206 paket / 3.620 test yeşil; değişen 179 dosyada babel sözdizimi
temiz; tanımsız-değişken taramasında tek bulgu `plugins/withAndroidWidgets.js` `__dirname` = CommonJS yanlış alarm;
`node --check functions/index.js` temiz):

| Alan | Durum |
|---|---|
| `translations/es.json` | 2.941 yaprak anahtar, en.json ile birebir (yer tutucu, dizi uzunluğu, boş değer) |
| Merkezi kayıt `utils/appLanguages.js` + Ayarlar seçici, cihaz dili, yedek, onboarding düğmesi | Tamam |
| Düşüş yönü (A kalıbı) | Kalıp kalmadı; bilinmeyen dil → İngilizce |
| `{tr,en,es}` tabloları (3.3) | Tamam, `copyTablesSpanish.test.js` korur |
| Satır içi ternary'ler (3.4) | Taranan dosyalarda üçüncü kol eklendi; **bekçi yok** |
| TMDB dil/bölge/görsel dili, Intl, AI prompt, fragman | Kayıttan |
| Tür kanonikleştirme (TR+EN+ES) | Tamam |
| Cloud Functions `STRINGS`/`STREAM_STRINGS`/`pickNotificationLang` | Kodda tamam, **deploy EDİLMEDİ** |
| Android widget (Kotlin `WidgetLanguage`) | Kodda tamam, **derlenmedi / native build şart** |
| iOS widget (Swift `widgetPick`) | Kodda tamam, **derlenmedi (Windows)** / EAS build şart |
| Widget önizleme, takvim, tarih seçici, Wrapped, rozetler, Premium, turnuva, oyunlar, auth, onboarding | Tamam |

**Bilinen açıklar / yapılmayanlar**

1. **Hiçbir yüzey cihazda görülmedi.** Uzun İspanyolca metinlerin taşma/kırpma davranışı (düğmeler, rozet adları,
   sekme etiketleri, widget satırları) cihazda doğrulanmalı; İspanyolca metin Türkçeden ortalama %15–25 uzundur.
2. **Functions deploy** edilmezse İspanyolca kullanıcı push bildirimini **İngilizce** alır (`es` sunucuda tanınmıyor).
   Yeni `notificationLanguage: "es"` yazımı eski sunucuda `"en"`e düşer; zararsız.
3. **Native build** olmadan widget'ın sabit metinleri (başlık, "Hoy/Mañana", "Película/Serie") İngilizce kalır.
4. Widget **adları** (iOS `configurationDisplayName`, Android `widget_strings.xml`) uygulama diline bağlı değil, sabit Türkçe.
5. `app.json` izin metinleri (`photosPermission`, `calendarPermission`) Türkçe sabit; `expo.locales` /
   `CFBundleLocalizations` tanımlı değil → sistem izin iletişim kutuları İspanyolca kullanıcıda Türkçe.
6. `store/play/es-ES/` yok (Play mağaza sayfası); App Store metni de ayrıca gerekir.
7. Web yasal sayfaları yalnız `tr`/`en` → İspanyolca kullanıcı İngilizce sayfayı görür.
8. `SharedListsContext.js:68`, `utils/listSearch.js:239` `localeCompare(…, "tr")` — İspanyolca sıralamada `ñ`/aksan farkı.
9. `utils/premium.js:365` fiyat pazarı dile bağlı (TR/global) — İspanyolca `global` fiyat.
10. **`autoI18n.bolum` anahtarı çakışması (eski hata):** tr/en paketinde değeri `"- Bölüm:"` / `"- Episode:"` (başka bir
    kullanımdan kalma ek ifadeli biçim), ama `WatchedDateSheet.js:99` bunu düz etiket ("Bölüm") olarak okuyor.
    `es.json`'da bu yüzden düz etiket `"Episodio"` verildi; tr/en'deki değer **dokunulmadı** — ayrı bir düzeltme işi.
11. `i18nKeys.test.js` ve `copyTablesSpanish.test.js` ES metinlerinin **doğruluğunu/kalitesini** ölçmez (yalnız yapı).
    Çeviriyi ana dili İspanyolca olan biri gözden geçirmeli (özellikle: "Lista de seguimiento", rozet adları,
    Premium plan metinleri, hukuki/izin dili, tarih biçimleri).
12. Bu çalışma **commit edilmedi** (194 değişen/yeni dosya çalışma ağacında; diğer oturumların bekleyen işleriyle karışık).
