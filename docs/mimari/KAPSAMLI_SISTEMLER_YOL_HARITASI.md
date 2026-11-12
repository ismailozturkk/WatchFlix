# Kapsamlı sistemler yol haritası (dil, tema, yazı tipi, dekor, ayarlar…)

> **Amaç:** Uygulamanın birçok ekranına aynı anda dokunan sistemlerde bir değişiklik yapılacağında
> **önce bu dosya açılır.** Her sistem için: tek doğruluk kaynağı, dosya haritası, "X eklemek / değiştirmek
> için adımlar", testteki bekçiler, bilinen tuzaklar ve daha ayrıntılı belge.
>
> İlk yazım: 2026-11-12. Dosya yolları ve sabitler o günün kodundan alındı; kod büyüdükçe sayılar kayabilir.
> Bir sistemi değiştirdiğinde **o sistemin kartını da güncelle** (en alttaki "Bakım" bölümüne bak).
>
> **Kısa yol:** Değişikliğin hangi sisteme dokunduğunu §2'deki etki tablosundan bul → o sistemin kartını
> (§3) oku → §4'teki ortak kontrol listesini uygula → `npx jest`.

---

## 1. Ortak mimari kalıp (her sistem buna uyar)

Kapsamlı sistemlerin neredeyse hepsi aynı beş katmanlı yapıyla kuruldu. Yeni bir sistem eklerken de bu yapıyı kullan:

| Katman | Nerede | Kural |
|---|---|---|
| **1. Saf çekirdek** | `utils/<sistem>.js` | React/Native içermez; kayıt tabloları (`Object.freeze`), normalleştirme, karar işlevleri. Jest ile doğrudan test edilir |
| **2. Kalıcı anahtar** | `services/storage/registry.js` → `Keys.<ad>` | Fiziksel anahtar adı **yalnız burada** yazılır. `type`, `default`, `validate` zorunlu düşünülür |
| **3. Durum / kanca** | `context/AppSettingsContext.js` ya da `hooks/use<Sistem>.js` | Premium kapısı burada uygulanır (etkin değer döner; ham bayrak yalnız burada okunur) |
| **4. Metin** | `translations/*.json` (`autoI18n.*`) veya yerel `<sistem>Copy.js` tablosu | 6 dil: `tr, en, es, pt, de, it`. Bilinmeyen dil → **İngilizce** |
| **5. Bekçi test** | `__tests__/<sistem>*.test.js` | Kayıt ↔ kullanım ↔ çeviri ↔ yedek eşliğini **kırarak** zorlar |

Ortak ilkeler:

- **Kayıtlı tercih silinmez.** Premium bitince ya da bir seçenek kaldırılınca kullanıcının kaydı korunur, yalnız varsayılan çizilir (tema, yazı tipi, kar, ikon, ambiyans, simge).
- **Saklanan şey "gizlenenler"dir** (dekor kapsamları, ekran bölümleri): boş liste = her yerde açık; yeni grup/bölüm eklenince eski kayıtlar onu kapalı bırakmaz.
- **Eski anahtarlar korunur:** kayıtlı seçim değerleri (ör. tema `gray`, `blue`) yeniden adlandırılmaz; yeni değer eklenir, eskisi göç etmeden çalışmaya devam eder.
- **Ayar değişince uygulama yeniden başlamaz** — yalnız ayar yedeğini içe aktarmak yeniden başlatır (bağlamlar açılışta senkron okuyor).

---

## 2. Etki tablosu — "şunu değiştiriyorum, nereler etkilenir?"

✔ = mutlaka dokunulur · ○ = duruma göre · boş = genelde gerekmez

| Değişiklik | Kayıt (`registry`) | Çeviri (6 dil) | Ayar yedeği | Premium kaydı | Native build | Sunucu deploy | Ayrıntı |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|
| Yeni dil | ○ | ✔ | ✔ (test) | ✔ (metin kolları) | ✔ (widget, izin metni) | ✔ (functions) | §3.1 |
| Yeni hazır tema / ton | | ✔ (ad) | ✔ (`isThemeId`) | ✔ (`PRESET_THEME_COUNT`) | | | §3.2 |
| Tema token'ı ekleme | | ○ | ✔ (özel tema temizleyici) | | | | §3.2 |
| Yeni yazı tipi | | ○ | | ✔ (`FONT_CATALOG_SIZE`, Free listesi) | ✔ (font paketi) | | §3.3 |
| Yeni atmosfer efekti / evren | ○ (`WEATHER_CHOICES` doğrular) | ✔ | ✔ | ○ (metin sayısı) | | | §3.4 |
| Yeni dekor ekranı / grubu | | ✔ (2 anahtar) | | | | | §3.5 |
| Yeni ayar anahtarı | ✔ | ✔ | ✔ (**zorunlu karar**) | ○ | | | §3.7, §3.8 |
| Yeni ücretli fark | | ✔ | | ✔ | | ○ (`functions/` aynası) | §3.6 |
| Yeni ekran bölümü (raf/kart) | | ✔ | (zaten grupta) | | | | §3.9 |
| Yeni uygulama simgesi | ✔ (`APP_ICON_IDS`) | ✔ | (bilerek dışarıda) | ✔ | ✔ | | §3.11 |
| Yeni düğme / alan / kart | | | | | | | §3.12 (cam bekçisi) |
| Yarım özellik yayına çıkıyor | | ✔ | | | | | §3.13 (BETA) |

---

## 3. Sistem kartları

### 3.1 Dil (i18n)

**Ayrıntılı belge:** [`DIL_DESTEGI_REHBERI.md`](./DIL_DESTEGI_REHBERI.md) — yeni dil eklemenin 15 adımlık listesi (§9) ve her dilin kararları burada. Bu kart yalnız özettir.

- **Tek doğruluk kaynağı:** `utils/appLanguages.js` → `APP_LANGUAGES` (kod, ad, bayrak, `intlLocale`, TMDB dil/bölge/görsel dili, yasal sayfa dili, AI prompt adı). Desteklenenler: `tr, en, es, pt, de, it`. "Yakında" (seçilemez): `fr, ja, ko, id, hi, ar, zh`.
- **Saklama / uygulama:** `Keys.language` (`"selectedLanguage"`) → `context/AppSettingsContext.js` → `context/LanguageContext.js` (`useLanguage()` → `{ language, toggleLanguage, t }`; i18next ile senkron, TMDB başlık dilini de ayarlar).
- **Yedi metin mekanizması** (yeni dil hepsine girmeli):
  1. `translations/{tr,en,es,pt,de,it}.json` + `translations/index.js` (kaynaklar + `fallbackLng`)
  2. `autoI18n.*` + `utils/i18nText.js` → `i18nText(anahtar, türkçeYedek)`
  3. Yerel kopya tabloları (`*Copy.js`: `themeStudioCopy`, `hapticsCopy`, `sectionVisibilityCopy`, `backupCopy`…)
  4. Satır içi `language === "tr" ? … : …` dalları (**bekçisi yok**)
  5. Sunucu: `functions/index.js` (`STRINGS`, `STREAM_STRINGS`, `NOTIFICATION_LANGUAGES`)
  6. Native: Android `WidgetLanguage.kt`, iOS `targets/reminder-widget/shared.swift`, `native/locales/*.json` (izin metinleri)
  7. TMDB/Intl parametreleri (kayıttan otomatik)
- **Bekçiler:** `i18nKeys`, `i18nTextExists`, `appLanguages`, `deviceLanguage`, `copyTablesSpanish` (adı eski; tüm dilleri karşılaştırır), `widgetNativeLanguage`, `nativePermissionLocales`, `germanSupport`, `portugueseSupport`, `settingsBackup`.
- **Tuzaklar:**
  - `i18nKeys` paketleri `JSON.parse` ile okur → **yinelenen anahtarı göremez**. Anahtar eklerken satır tabanlı ara (`rg -n '"anahtar_adi"' translations/`).
  - Bekçi `autoI18n.${…}` şablonunu yasaklar → anahtarı **tam literal** yaz.
  - UI'da `error.message`'ı doğrudan gösterme; koddan çevrilmiş metin göster (11 Kas denetiminde asıl sızıntı buydu).
  - `localeCompare(…, "tr")` sabit yerler (`SharedListsContext`, `utils/listSearch.js`) bilerek bırakıldı.
- **Açık iş:** İtalyanca metinler otomatik çeviri taslağı; ana dili İtalyanca biriyle ekran/taşma kontrolü + native build + functions deploy bekliyor.

### 3.2 Tema (renkler, aileler, tonlar, Tema Stüdyosu)

**Ayrıntılı belge:** [`TEMA_REHBERI.md`](./TEMA_REHBERI.md) — token tablosu, açık/koyu kuralı, **elle kopyalanmış tema listeleri** (widget, AI sohbet), sabit renk sınıfları ve 9 senaryonun adım adım listesi. Bu kart yalnız özettir.

- **Tek doğruluk kaynağı:** `theme/colors.js`
  - `themes` — hazır temalar (anahtar → token nesnesi): `gray, dark, light, sky, blue, green, blueDeep, greenMid, greenDeep` + eski `purple, amber`.
  - `THEME_FAMILIES` — Ayarlar'daki 3 aile × 5 ton, merdiven L* ~97·76·27·11·0 (`default`: light/silver/dusk/gray/dark · `blue`: blueBright/sky/blueDusk/blue/blueDeep · `green`: greenBright/green/greenDusk/greenMid/greenDeep); ton listesi `theme/toneModel.js`, v2 token şeması `theme/themeTokens.js`.
  - `LEGACY_PRESET_THEME_KEYS` — listede görünmeyen ama eski seçenler için duran temalar.
  - `CUSTOM_THEME_TOKENS` (11 düzenlenebilir token) + `CUSTOM_THEME_GROUPS`; türetilen değerler (`secondaryt`, `ai`, `shadow`, `colors`, `notesColor`) otomatik.
  - Özel tema seçimi biçimi: `custom:<id>` (= orta ton) | `custom:<id>:light|dark` → `parseCustomSelection`, `customSelectionKey`, `buildCustomThemeFromEntry`.
- **Motor:** `utils/themeStudio.js` (ton üretimi, uyum, ruh hali, rastgele aday, kontrast analizi/düzeltme), `utils/themePresets.js` (beş tonlu deste `{base, accent, tones}`, Stüdyo'nun hazır temaları), `utils/colorUtils.js`.
- **Saklama:** `Keys.theme` (`"selectedTheme"`, varsayılan `"blue"`) + özel temalar listesi; `AppSettingsContext` → `useThemeSettings()`.
- **Uygulama:** `context/ThemeContext.js` → `useTheme()` (~300 dosya kullanıyor). Premium yoksa özel tema yerine varsayılan çizilir (`custom_themes` limiti). Tema geçişi ekran görüntüsüyle **çapraz solma** (renkler stillere düz değer olarak dağıldığı için tek tek anime edilemez).
- **Ekranlar / UI:** `screens/tabs/setting/SettingsTheme.js`, `screens/tabs/setting/CustomThemeScreen.js`, `components/theme/*` (`ThemeToneKit`, `ThemeShuffleDeck`, `ColorPickerSheet`, `ThemePreviewCard`, `themeStudioCopy.js`).
- **Ek token dosyaları:** `theme/badgeTokens.js` (rozet renkleri), `theme/gameTokens.js` (oyun ekranları) — temadan bağımsız sabit paletler.

**Yeni hazır tema / ton eklemek:**
1. `theme/colors.js` → `themes`'e anahtar (tüm token'lar dolu; `colors`/`notesColor` için uygun koyu/açık set).
2. Bir aileye girecekse `THEME_FAMILIES[...].tones`; yeni aileyse `labelKey` + `fallback` + 6 dilde `themeFamily<Ad>` çevirisi.
3. Free'ye açıksa `utils/premiumFeatures.js` → `PRESET_THEME_COUNT` (= aile ton sayısı) ve metinler.
4. `utils/settingsBackup.js` tema doğrulayıcısı yeni anahtarı kabul ediyor mu kontrol et.
5. Stüdyo'da hazır tema olarak görünecekse `utils/themePresets.js`.

**Yeni token eklemek (ör. yeni yüzey rengi):** `themes`'teki **her** temaya + `buildCustomTheme` (özel temalar için türetme) + gerekirse `CUSTOM_THEME_TOKENS` ve 6 dil etiketi + `settingsBackup.sanitizeTheme`. Kullanıldığı yerde `theme.<token> ?? yedek` yazmak yerine tüm temalara eklemek tercih edilir.

- **Bekçiler:** `themeFamilies`, `themeStudio`, `themeStudioCopy`, `themeAppearance`, `colorUtils`, `settingsBackup`, `premiumFeatures`.
- **Tuzaklar:**
  - Vurgu üstü düğme yazısı **beyaz** kabul edilir (uygulamada ~350 `#fff`); yeni vurgu beyaza karşı ≥3:1 olmalı (`fitAccent`).
  - `colorUtils.readableTextOn` eşiği (0.5) orta tonlarda yanlış — bilerek dokunulmadı; yeni yerde kontrast için `themeStudio.analyzeContrast` kullan.
  - `ColorPickerSheet`'e her render'da yeni `[]` verme (durumu sıfırlanır) → sabit dizi.
  - Açık temalar (`light`, `sky`, `green`) için cam/blur yüzeylerdeki metin okunabilirliği ayrıca kontrol edilmeli.

### 3.3 Yazı tipi (tipografi)

- **Tek doğruluk kaynağı:** `utils/typographyRoles.js` — roller `TEXT_ROLES = heading | body | numeric`, `FONT_PRESETS` (katalog), `FONT_FAMILY_MAP` (ağırlık/italik → aile adı), `REQUIRED_FONT_FAMILIES`, `resolveTextRole`, `resolveFontFamily`.
- **Yükleme:** `context/TypographyContext.js` → `APP_FONT_MANIFEST` (expo-font `require`'ları), `ensureCatalogFontsLoaded`.
- **Ayar:** `services/typographySettings.js`; UI `components/typography/FontSettingsSection.js`.
- **Premium:** `utils/premiumFeatures.js` → `FREE_FONT_PRESET_IDS`, `FONT_CATALOG_SIZE` (şu an 56), `canUseFontPreset`.

**Yeni yazı tipi eklemek:**
1. `npm i @expo-google-fonts/<ad>` (EAS lock uyumu için `package-lock.json` da commit edilir).
2. `APP_FONT_MANIFEST`'e kullanılan **her** ağırlık/italik.
3. `FONT_FAMILY_MAP` + `FONT_PRESETS` (rol önerisi, ad).
4. `FONT_CATALOG_SIZE` sayısını güncelle; Free'ye açıksa `FREE_FONT_PRESET_IDS`.
- **Bekçiler:** `typographyRoles` (manifest ↔ `REQUIRED_FONT_FAMILIES` birebir; manifest dosyasını okuyarak), `typographySettings`, `premiumFeatures`.
- **Tuzak:** Manifestte eksik aile **hata vermez**, sessizce sistem fontuna düşer.

### 3.4 Atmosfer (hava efektleri + film/dizi/anime evren sahneleri)

**Ayrıntılı belge:** [`../planlama/ATMOSFER_EVRENLER.md`](../planlama/ATMOSFER_EVRENLER.md) (evrenler, teknik plan, güncel durum), [`../planlama/ATMOSFER_TUR_ONERILERI.md`](../planlama/ATMOSFER_TUR_ONERILERI.md).

- **Tek doğruluk kaynakları:**
  - `utils/weatherParticles.js` — seçici grupları `WEATHER_GROUPS` (mevsimler, gökyüzü, doğa, şenlik + evren grupları), `WEATHER_CHOICES`, `WEATHER_DENSITIES`, şekil dokusu (`SPRITE`, `SPRITE_CELL = 128`, `SPRITE_COUNT`), `OVERLAY` kimlikleri, `OVERLAY_UNDER` / `OVERLAY_FRONT` katman sırası.
  - `utils/weatherUniverses.js` — `UNIVERSES` (TMDB kimliğiyle eşleme), `UNIVERSE_GROUPS`, `universeFor(title)`, `UNIVERSE_SPECS`, `SCENERY` (ör. `lift` = sekme çubuğu payı), `SCENE_BUILDERS`.
- **Çizim:** `components/decor/WeatherLayer.js` → `ParticleField.js` (Skia parçacık) + `OverlayLayers.js` (vektör sahneleri içe aktarır) + `VectorLayers.js`; sahne başına `components/decor/<ad>Scene.js` (ör. `gotScene.js`, `winterScene.js`, `solarScene.js`), ortak parçalar `seasonKit.js`, `universeOverlays.js`, `universeSprites.js`, `particleSprites.js`.
- **Ekranlar:** `screens/tabs/settings/AtmosphereScreen.js`, `components/settings/AtmosphereControls.js`, `AtmosphereGenreInfoSheet.js`, `BackgroundLayerCards.js`.
- **Seçim önceliği (detay ekranı, "Türe göre" açıkken):** özel gün > evren > tür.

**Yeni efekt / sahne eklemek:**
1. Kimliği `WEATHER_GROUPS` içindeki doğru gruba ekle (grup başına en çok `WEATHER_GROUP_MAX = 7`).
2. Vektör sahneyse yeni `OVERLAY` kimliği + `components/decor/<ad>Scene.js` + `OverlayLayers.js`'te bağlama; arka/ön katman sırası için `OVERLAY_UNDER`/`OVERLAY_FRONT`.
3. Evrense `UNIVERSES` satırı (TMDB koleksiyon/dizi kimliği **TMDB'den doğrulanarak**) + `UNIVERSE_SPECS`.
4. Tekrarlayan olay varsa **`rest`** ver (olaylar 1–2 dakikada bir; sürekli animasyon ısınma yapar).
5. 6 dilde ad + seçici etiketi; Premium metnindeki efekt sayısı (`premiumFeatures` → atmosfer satırı "20 atmosfer efekti").
- **Bekçiler:** `weatherParticles`, `weatherUniverses`, `weatherSceneIntegrity`, `weatherRestCycles`, `sceneFrames`, `seasonScenes`, `starWarsScene`, `bbPbScene`, `settingsBackup`.
- **Tuzaklar:**
  - Alt kenara oturan silüetler `SCENERY.lift` kadar yukarıda; yeni sahne aynı sabiti kullanmalı (sekme çubuğu altında kalmasın).
  - Büyük figürler atlas sprite değil **vektör** çizilir (bulanıklık).
  - Isınma kararı: 60 fps korunur, kullanıcı 30 fps/boşta modunu reddetti — maliyeti sahne seyrekliğiyle düşür.
  - Sahnelerin çoğu **cihazda görülmedi** (yalnız test + canvaskit render).

### 3.5 Dekor katmanları (kar, ikon deseni, ambiyans) ve ekran kapsamları

- **Katman sırası** (`ScreenDecor`): ambiyans → ikon deseni → kar → içerik.
- **Kapsam çekirdeği:** `utils/decorScopes.js` — `DECOR_EFFECTS = snow | icon | ambient`, `DECOR_SCOPES` (11 grup: home, search, details, lists, chat, conversation, social, profile, settings, more, auth), `decorVisibility`, `isDecorVisible`. Saklanan: `Keys.decorScopes` = gizlenen gruplar.
- **Ambiyans:** `utils/ambientBackground.js` + `components/AmbientBackground.js` (modül düzeyinde **tek ortak saat**, SVG radyal degrade — gerçek blur yok).
- **Ekranlar:** `screens/tabs/settings/PersonalizationScreen.js` (genel anahtarlar), `screens/tabs/settings/DecorScopesScreen.js` (ekran bazında).
- **Premium:** kar, ikon arka planı, ambiyans → Free'de kapalı çizilir, kayıt silinmez (`AppSettingsContext` etkin değer + setter ikinci kapı).

**Yeni ekran eklerken:** dekor isteniyorsa `<ScreenDecor scope="<grup>">` kullan; **elle `<IconBacground/>`, `<ScreenSnow/>`, `<AmbientBackground/>` koyma** (bekçi kırar; tek bilinçli istisna Onboarding).
**Yeni grup eklerken:** `DECOR_SCOPES` + `autoI18n.dekor_grup_<id>` ve `autoI18n.dekor_grup_<id>_alt` (6 dil) + `DecorScopesScreen` kopyası; efekt kısıtı varsa `effects` (ör. `conversation` = karsız).
- **Bekçiler:** `decorScopes` (premium kapısı bekçisi dahil), `decorLayout`, `ambientBackground`, `iconBackgroundRender`.
- **Tuzaklar:** Android'de blur, `BlurTargetView`'ın **kardeşi** olmalı (bkz. bellek `blur-android-target`); degrade `id`'leri örnek başına `useId` ile benzersiz (Android'de Defs ad alanı global).

### 3.6 Premium yetkileri (plan kapıları)

**Ayrıntılı belge:** [`../kurulum/REVENUECAT_KURULUM.md`](../kurulum/REVENUECAT_KURULUM.md) §6.1 (tam limit tablosu).

- **Tek doğruluk kaynağı:** `utils/premiumFeatures.js` → `PREMIUM_FEATURES` (özellik kimliği → tür, plan limitleri, ödeme ekranı metinleri 6 dilde), `FEATURE_KIND`, `FEATURE_CATEGORIES`, `UPSELL_BUNDLES`; yardımcılar `getFeatureLimit`, `isLockedFor`, `canUseFeature`, `remainingUses`, `nextPlanFor`.
- **Plan durumu:** `services/premiumState` → `usePremiumPlanSnapshot()`; `context/PremiumContext.js`.
- **Tek ödeme ekranı:** `screens/premium/PremiumScreen.js` (RevenueCat panel paywall'ı bilerek yok).
- **Geliştirme:** plan simülatörü (`__DEV__`), Geliştirici Laboratuvarı.

**Yeni ücretli fark:** registry girdisi (`PREMIUM_FEATURES`) → kapı (kanca/bağlamda etkin değer) → test → en son metin. Limit 0 = "bu planda kapalı" → ekran "limit doldu" değil `upsell.lockedTitle` konuşur.
**Limit/ürün değişirse sunucu aynası birlikte değişir:** `functions/aiQuota.js`, `planCapabilities.js`, `revenueCatWebhook.js` (`UNLIMITED_PRODUCT_IDS`); webhook deploy'u offering değişikliğinden **önce**.
- **Bekçiler:** `premiumFeatures`, `premium`, `premiumUpsellContent`, `premiumShowcase`, `premiumScreenHierarchy`, `premiumUsageModel`, `premiumTopBanner`, `premiumMemberBar`.
- **Yayın notu:** Beta'da herkes Premium Max (`open:true`); **yayından önce kapatılacak** (bellek `beta-max-access-nov10`).

### 3.7 Kalıcı ayarlar (depolama kaydı)

- **Tek doğruluk kaynağı:** `services/storage/registry.js` — her MMKV anahtarı `defineKey(ad, { key, store, type, default, scope, validate, legacy, keepOnLogout })`.
  - `store`: `settings | data | cache | session` (silme davranışını belirler).
  - `scope: "user"` → anahtar uid önekiyle saklanır; çıkışta silinir (`keepOnLogout` istisnası gerekçeyle).
- **Kural:** fiziksel anahtar adı başka hiçbir dosyada yazılmaz; çağrı yeri `Keys.<ad>`.
- **Yeni ayar:** registry girdisi → okuyan bağlam/kanca → **§3.8 yedek kararı** → 6 dil metni → test.
- **Bekçiler:** `storage`, `settingsBackup` (kapsam bekçisi).
- **Tuzak:** Ayar kayıt bağlamları (`AppSettingsContext`) açılışta **senkron** okur ve depoyu izlemez → depoyu dışarıdan değiştiren kod bağlamı güncellemez.

### 3.8 Ayarları yedekle / geri yükle

- **Dosyalar:** saf çekirdek `utils/settingsBackup.js` (`BACKUP_GROUPS`, `BACKUP_EXCLUDED`, `buildBackup`, `parseBackup`, `planImport`, tema temizleyici), `services/settingsBackupService.js` (toplama, uygulama, geri alma noktası), `services/settingsBackupFiles.js` (dosya/pano), ekran `screens/tabs/settings/BackupSettingsScreen.js` + `backupCopy.js`.
- **Biçim:** `{format:"seelogd-settings-backup", version:1, createdAt, app, settings:{<registry anahtar ADI>: değer}}`; `null` = kayıt yok (içe aktarınca silinir).
- **En önemli kural:** `settings` deposundaki **her** registry anahtarı ya `BACKUP_GROUPS`'ta ya `BACKUP_EXCLUDED`'ta (gerekçeyle). Yeni ayar eklerken `settingsBackup.test.js` kırılır ve **karar ister**.
- **Yeni seçenek değeri** (yeni tema, yeni efekt, yeni dil) eklenince, yedek doğrulayıcısı registry `validate`'ten beslenir → genelde otomatik; özel doğrulayıcı varsa (tema kimliği) elle güncelle.
- **Tuzak:** Yeni değer eski istemcide reddedilir (ör. görsel kalitesi `"auto"`) — bilinçli.

### 3.9 Ekran bölümlerini gizle / göster

- **Dosyalar:** `utils/sectionVisibility.js` (`SECTION_SCREENS`: `tv | movie | hub | profile`), `Keys.sectionVisibility` (gizlenenler), `hooks/useSectionVisibility.js`, `screens/tabs/settings/SectionVisibilityScreen.js` + `sectionVisibilityCopy.js`.
- **Yeni bölüm:** kayda ekle **ve** ekranda bekçinin tanıdığı kalıpla yaz: Film/Dizi `key: "x"`, Hub `show("x")`, Profil `showSection("x")`. Yoksa `sectionVisibility.test.js` kırılır.
- **Bekçiler:** `sectionVisibility`, `sectionVisibilityCopy`, `sectionVisibilityScreen`, `useSectionVisibility`, `sectionsHiddenNotice`, `homeSectionHeaderCoverage`.
- **Tuzak:** "Devam Edenler" eski `showOngoingTvShows` ayarına bağlı (ikinci doğruluk kaynağı açılmadı).

### 3.10 Ana ekran içerik ayarları, görsel kalitesi, poster görünümü

- **Ana ekran senkronu:** `utils/homeContentSettings.js` (`HOME_SETTING_EFFECTS`: ayar → `data` yeniden çek | `render` yalnız hücre yenile; `adultScoped`, `dropAdult`) + `hooks/useHomeContentSettings.js`. Yeni ana ekran ayarı önce `HOME_SETTING_EFFECTS`'e. Yeni `movie_*`/`tv_*` liste anahtarı → `homeSettingsCoverage.test.js` `/discover` kullanıyorsa kapsamlı listeye.
- **Hassas içerik:** `utils/tmdbAdultGuard.js`, `utils/sensitiveContent.js`, `screens/tabs/settings/SensitiveContentScreen.js`.
- **Görsel kalitesi:** `utils/imageQuality.js` (varsayılan `auto` = ekran genişliği × DPR, mobil veri/düşük cihazda tavan), UI `components/settings/ImageQualityPanel.js`, `screens/tabs/settings/PosterSettingsScreen.js`.
- **Poster boyutu / köşe:** `utils/posterSizes.js`, `utils/posterCorners.js` (registry bunlardan doğrular).

### 3.11 Uygulama simgesi

- **Tek doğruluk kaynağı:** `utils/appIcons.js` → `APP_ICONS` (`id`, `nativeName`), `APP_ICON_IDS`, `LEGACY_NATIVE_NAMES`.
- **Servis:** `services/appIconService.js`, `services/appIconStore.js`; UI `components/settings/AppIconSection.js`.
- **Yeni simge:** kayıt satırı + Android alias + iOS alternatif simge (**çok ölçülü** olmalı) → **native build**. Premium (Free'de kapalı). Yedeğe bilerek dahil değil.
- **Bekçiler:** `appIcons`, `appIconService`, `appIconStore`, `alternateAppIconsIos`.

### 3.12 Cam (Liquid Glass) ve bulanıklık

- **Karar çekirdeği:** `utils/glassChrome.js` (`planGlassChrome`), `utils/liquidGlass.js`, `utils/surfaceBlur.js`, `utils/blurSupport.js`; kanca `components/common/useGlassChrome.js`.
- **Sarmalayıcılar:** `GlassTouchable` (TouchableOpacity yerine), `GlassPressable`, `GlassBox` (`role="field" | "card"`), `GlassTextInput`.
- **Yeni düğme / yazı alanı eklerken** ham `TouchableOpacity` yerine bunları kullan: `glassCoverageGuard.test.js` dosya bazında "cama aday" ham sayıyı tutar ve **yalnız azalabilir**.
- **Bilerek cam olmayanlar:** liste satırı/sohbet balonu/akış kartı içi eylemler, renk örneği düğmeleri (performans).
- **Bekçiler:** `glassChrome`, `glassCoverageGuard`, `glassButtonCoverage`, `glassWrappers`, `glassField`, `glassSurface`, `liquidGlass`, `glassNativePatch`.

### 3.13 BETA / DEV rozetleri

- **Tek liste:** `utils/betaFeatures.js` (`BETA_FEATURE_IDS`, `isBetaFeature`, ana şalter `BETA_BADGES_ENABLED`). Bileşen `components/common/BetaBadge.js` (+ `DevBadge`, `__DEV__` dışında `null`).
- **Yarım özellik:** kimliği listeye ekle + giriş noktasına `isBetaFeature(id)` ile rozet. **Bitti** dendiğinde kimliği listeden sil → rozet her yerden kalkar.
- **Yeni `__DEV__`-yalnız UI:** `<DevBadge />` koy.

### 3.14 Titreşim, toast, bildirim metinleri

- **Titreşim:** `utils/hapticPatterns.js` (`HAPTIC_LEVELS`, `HAPTIC_INTENSITIES`, `HAPTIC_CATEGORIES`, `HAPTIC_PATTERNS`), `services/hapticsService.js`, `screens/tabs/settings/HapticsSettingsScreen.js` + `hapticsCopy.js`. Varsayılan **kapalı** (`Keys.haptics`). Yeni desen → `HAPTIC_PATTERNS` + kategori; bekçiler `hapticPatterns`, `hapticsService`, `hapticsSettings`. Politika: bellek `haptics-policy-oct15`, analiz `../planlama/TITRESIM_ANALIZI_2026-11-06.md`.
- **Toast:** [`TOAST_SISTEMI.md`](./TOAST_SISTEMI.md) (`utils/toastStore.js`; bekçiler `toastStore`, `toastFacade`, `toastUi`).
- **Bildirimler:** 4 ayrı dil kaynağı — bkz. dil rehberi §5.

---

## 4. Ortak kontrol listesi (her kapsamlı değişiklikte)

1. **Kayıt önce:** saf çekirdekteki kayıt tablosunu güncelle (tema/efekt/dil/simge/bölüm…), sonra kullanan yer.
2. **Kalıcı anahtar** gerekiyorsa `services/storage/registry.js` + `validate`.
3. **Yedek kararı:** `BACKUP_GROUPS` mı `BACKUP_EXCLUDED` mı (gerekçe yaz).
4. **Premium:** ücretli mi? `PREMIUM_FEATURES` + sayı sabitleri (`PRESET_THEME_COUNT`, `FONT_CATALOG_SIZE`, atmosfer efekt sayısı metni).
5. **Metin:** 6 dilde (`tr, en, es, pt, de, it`); JSON'a anahtar ekliyorsan yinelenmeyi satır tabanlı kontrol et.
6. **Native / sunucu:** widget, izin metni, simge, font paketi → yeni EAS build; `functions/` → deploy. Bunu yapılmadıysa belgeye "bekliyor" diye yaz.
7. **Test:** `npx jest` (tam paket). İlgili bekçi kırmızıysa **testi gevşetme**, eksik adımı tamamla.
8. **Görsel doğrulama:** dar ekran (320/360/412 dp) × uzun diller (de, pt) × açık/koyu tema. Web önizlemesi RN flex'ini birebir doğrulamaz → Yoga harness'i ya da cihaz (bellek `yoga-layout-harness`).
9. **Belge:** bu dosyadaki ilgili kartı ve ayrıntılı belgeyi güncelle; "cihazda görülmedi" ise açıkça yaz.

---

## 5. Yol haritası — bilinen açıklar ve sıradaki iyileştirmeler

Öncelik sırasıyla; yapılan maddeyi buradan sil ya da "YAPILDI (tarih)" diye işaretle.

| # | Konu | Sistem | Durum / öneri |
|---|---|---|---|
| 1 | İtalyanca ana dil kontrolü + native build + functions deploy | Dil | Bekliyor (12 Kas) |
| 2 | Yayından önce Beta Max erişimini kapat (`open:false`) + beta e-postalarına kod | Premium | Bekliyor |
| 3 | Çeviri paketlerinde **yinelenen anahtar** bekçisi (satır tabanlı tarama `i18nKeys`'e) | Dil | Öneri — kör nokta kalıcı kapanır |
| 4 | Satır içi `language === …` dalları için bekçi ya da `pickByLanguage`'a toplu geçiş | Dil | Öneri — şu an bekçisiz. 12 Kas: `de ? X : "English"` biçiminde İtalyancayı atlayan dallar ve 5 dilli `tri`/`L` yardımcıları (homeSectionCopy, worldTour, badgeMeta, DiscoveryMediaRail, widgetSamples, premiumFeatures) elle kapatıldı; tarama: `grep -rnE '\bde \? ("[^"]*"\|`[^`]*`) : ("\|`)'` |
| 4b | `InteractionManager` RN 0.86'da koçan (beklemiyor) → `utils/afterInteractions.js` (`requestIdleCallback` + zaman aşımı) | Performans | YAPILDI (12 Kas); `afterInteractions.test.js` geri gelmesini engeller |
| 5 | `localeCompare(…, "tr")` sabitlerini `intlLocaleOf(language)`'a çevir | Dil | Düşük etki, ertelendi |
| 6 | `colorUtils.readableTextOn` eşiğini düzelt (0.5 → gerçek 0.179) ve çağrı yerlerini gözden geçir | Tema | Öneri — görsel değişiklik yapar, cihazda bakılmalı |
| 7 | Açık temalarda cam kart üstü metin okunabilirliği + ayarlar ekranında 10+ cam kart performansı | Tema / Cam | Cihazda bakılacak |
| 8 | Atmosfer sahneleri, DVD/Vitrin kapakları, profil kapağı vb. cihaz turu | Atmosfer | Çoğu yalnız testle doğrulandı |
| 9 | Eski `purple`/`amber` temalarını kullanan kalmadıysa listeden tümüyle kaldırma kararı | Tema | Veri gerektirir (analitik) |
| 10 | `copyTablesSpanish.test.js` adını tüm dilleri anlatan bir adla değiştir | Test | Kozmetik |

---

## 6. Hızlı komutlar

```bash
npx jest
```

```bash
npx jest i18nKeys appLanguages copyTablesSpanish widgetNativeLanguage nativePermissionLocales
```

```bash
npx jest themeFamilies themeStudio themeAppearance typographyRoles settingsBackup premiumFeatures
```

```bash
npx jest weatherParticles weatherUniverses weatherSceneIntegrity weatherRestCycles decorScopes
```

Bir anahtarın paketlerde kaç kez geçtiğini görmek (yinelenme kontrolü):

```bash
rg -c '"anahtar_adi"\s*:' translations/
```

---

## 7. İlgili belgeler

- [`DIL_DESTEGI_REHBERI.md`](./DIL_DESTEGI_REHBERI.md) — dil ekleme ayrıntısı
- [`TEMA_REHBERI.md`](./TEMA_REHBERI.md) — tema ekleme / tema yapısını değiştirme ayrıntısı
- [`TOAST_SISTEMI.md`](./TOAST_SISTEMI.md) — toast mimarisi
- [`YEREL_ONCELIKLI_VERI_KATMANI.md`](./YEREL_ONCELIKLI_VERI_KATMANI.md) — kullanıcı verisi saklama
- [`LISTE_IZLEME_ALTYAPISI.md`](./LISTE_IZLEME_ALTYAPISI.md) — liste/izleme yazma kapısı
- [`UYGULAMA_BILGISI_VE_MIMARISI.md`](./UYGULAMA_BILGISI_VE_MIMARISI.md) — genel mimari
- [`../planlama/ATMOSFER_EVRENLER.md`](../planlama/ATMOSFER_EVRENLER.md) — atmosfer evrenleri
- [`../performans/PERFORMANS_YOL_HARITASI_2026-11-11.md`](../performans/PERFORMANS_YOL_HARITASI_2026-11-11.md) — cihaz yükü kararları (atmosfer/alev fps)
- [`../kurulum/REVENUECAT_KURULUM.md`](../kurulum/REVENUECAT_KURULUM.md) — premium limit tablosu

## Bakım

- Bir sistemin tek doğruluk kaynağı taşınır ya da yeni bir kapsamlı sistem eklenirse (ör. yeni bir "ekran bazında" ayar), **§2 tablosuna satır + §3'e kart** ekle.
- Kart kısa kalır; uzun karar geçmişi ayrıntılı belgeye yazılır, buradan bağlantı verilir.
