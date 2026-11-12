# Tema rehberi (tema ekleme, tema yapısını değiştirme referansı)

> Amaç: "yeni tema ekleyelim", "temaya yeni bir renk ekleyelim", "açık temada şu okunmuyor",
> "tema seçim ekranını değiştirelim" dendiğinde **önce bu dosya okunur**. Temanın nerede seçildiği,
> hangi şekilde dağıtıldığı, **elle kopyalandığı** yerler, temadan bilerek bağımsız tutulan renkler ve
> her senaryonun adım adım listesi burada.
>
> İlk yazım: 2026-11-12. Sayılar o günün kodundan; kod büyüdükçe kayar — kesin sayı için en alttaki
> "Yeniden sayma komutları"na bak. Genel harita: [`KAPSAMLI_SISTEMLER_YOL_HARITASI.md`](./KAPSAMLI_SISTEMLER_YOL_HARITASI.md).
>
> **Kısa yol:** yeni hazır tema = `theme/colors.js`'e bir nesne + `THEME_FAMILIES` (ailedeyse) + 6 dilde
> ad + **§9'daki elle kopyalanmış listeler** (widget ekranı, AI sohbet seçicisi). §9'u atlayan tema,
> uygulamada çalışır ama widget ve AI sohbet seçicisinde **sessizce görünmez**.

## 1. Tek cümlede durum

Tema, **tek bir düz renk nesnesidir** (`theme`); `useTheme()` ile ~300 dosyaya dağılır ve renkler
stillere **düz değer** olarak yazılır (tema değişince React yeniden çizer, animasyonlu renk yok).
Açık/koyu kararı tema **adından değil, zemin renginin parlaklığından** verilir (`isLightSurface(theme.primary)`).
Buna karşın uygulamada ~3.580 satır sabit renk var; çoğu bilinçli (poster/fotoğraf üstü, paylaşım
görselleri, atmosfer sahneleri), bir kısmı temaya bağlanmamış eski kod. Ve tema listesi **iki yerde elle
kopyalanmış** (widget ayarları, AI sohbet hızlı seçicisi) — bunları hiçbir test korumuyor.

## 2. Temanın seçimi, saklanması, uygulanması

| Adım | Dosya | Not |
|---|---|---|
| **Tanım (tek kaynak)** | `theme/colors.js` → `themes` | 11 hazır tema nesnesi + yardımcılar |
| Saklama — seçim | `services/storage/registry.js` → `Keys.theme` (`"selectedTheme"`, string, varsayılan **`"blue"`**) | Değer: hazır tema anahtarı ya da `custom:<id>[:bright\|light\|mid\|amoled]` (eksiz = koyu) |
| Saklama — özel temalar | `Keys.customThemes` (`"customThemes"`, json dizi, `validate`: her öğede `id` + `tokens`) | Eski tek tema kaydı (`customThemeTokens`) göçü `services/storage/migration.js` → `migrateCustomThemes` |
| Ayar durumu | `context/AppSettingsContext.js` → `ThemeSettingsContext` / `useThemeSettings()` | `selectedTheme`, `changeTheme`, `customThemes`, `saveCustomTheme`, `deleteCustomTheme`. Açılışta **senkron** okur |
| Uygulama | `context/ThemeContext.js` → `ThemeProvider`, `useTheme()` | Değer: `{ theme, selectedTheme, appliedTheme, customThemesAllowed, changeTheme, customThemes, saveCustomTheme, deleteCustomTheme }` |
| Bilinmeyen anahtar | `getThemeColors(ad)` → `themes[ad] ?? themes.gray` | Silinmiş/bozuk seçim **gri** temaya düşer |
| Premium kilidi | `ThemeContext`: özel tema seçili ama `custom_themes` limiti 0 → `Keys.theme.default` (mavi) çizilir | Kayıtlı seçim **silinmez**; `appliedTheme` çizilen anahtarı verir |
| Bulunamayan özel tema | Son çizilen temaya (`lastThemeRef`), o da yoksa hazır temaya düşer | Silinen temanın seçimi bir kare bozuk çizilmesin diye |
| Geçiş animasyonu | `changeTheme(yeni, { animated, onApply })` | Ekran görüntüsü üste konur, tema altta değişir, görüntü 450 ms'de solar (`THEME_FADE_MS`) |
| React Navigation | `App.js` → `navigationTheme` | `isLightSurface` ile `DefaultTheme`/`DarkTheme` tabanı + `primary/background/card/text/border/notification` tema token'larından |
| Durum çubuğu (kök) | `App.js` → `<StatusBar style={isLightSurface(theme.primary) ? "dark" : "light"} />` | Ekranlar ayrıca kendi `StatusBar`'ını koyabilir (§6) |

**Seçim ekranları:**

| Ekran | Dosya | Ne yapar |
|---|---|---|
| Ayarlar > Tema | `screens/tabs/setting/SettingsTheme.js` (klasör adı **`setting`**, tekil) | 3 aile kartı × 5 ton düğmesi, eski temalar (seçiliyse tek kart), özel temalar, "Tema Oluştur" |
| Tema Stüdyosu | `screens/tabs/setting/CustomThemeScreen.js` | Özel tema oluştur/düzenle (4 sekme: Kur / Keşfet / Hazır / İnce ayar) |
| Atmosfer ekranı | `screens/tabs/settings/AtmosphereScreen.js` | Önizlemede aynı temanın açık/orta/koyu tonunu deneme (`toneVariants`) |
| AI sohbet | `components/modals/ChatModal.js` → `THEME_SWATCHES` | Sohbet ayar çubuğunda **5 tema noktası** (elle liste, §9) |
| Widget ayarları | `screens/tabs/settings/WidgetSettingsScreen.js` → `BUILTIN_THEMES` | Widget görünümü için tema kataloğu (elle liste, §9) |

**Modal kuralı:** RN `Modal` içinden tema değiştiren kod `changeTheme(x, { animated: false })` çağırmalı
(Modal ayrı native pencerede çizilir; ekran görüntüsü onu örtemez, iOS'ta "hayalet" kalır).
Temayla **aynı commit'te** yazılması gereken yan durum varsa `onApply` kullan; önce yazarsan solma görünmez.

## 3. Tema nesnesinin şekli (token'lar)

Her tema (hazır ya da `buildCustomTheme` ile üretilen özel) **birebir aynı şekle** sahip olmak zorunda.
Kullanım sayıları yaklaşıktır (`theme.x`, `C.x`, `colors.x` gibi erişimler dahil).

| Token | Anlam | Kullanım | Özel temada |
|---|---|---|---|
| `primary` | Ekran zemini. **Açık/koyu kararının girdisi** | ~550 (205 dosya) | Düzenlenir |
| `secondary` | Kart / yüzey | ~770 (268 dosya) | Düzenlenir |
| `secondaryt` | `secondary` %50 saydam | 3 dosya | Türetilir |
| `between` | Ara yüzey (zeminle kart arası) | ~150 (61 dosya) | Düzenlenir |
| `border` | Kenarlık / ayraç | ~1.340 (278 dosya) | Düzenlenir |
| `tab` | Sekme çubuğu zemini | 4 dosya | Düzenlenir |
| `ai` | `tab` %40 saydam | **0 — kullanılmıyor** | Türetilir |
| `text.primary` | Ana metin | ~900 (246 dosya) | Düzenlenir |
| `text.secondary` | İkincil metin | ~490 (158 dosya) | Düzenlenir |
| `text.between` | Ara metin | 6 dosya | Düzenlenir |
| `text.muted` | Soluk metin / ikon | ~1.370 (235 dosya) | Düzenlenir |
| `accent` | Vurgu (düğme, seçili durum). **Üstündeki yazı beyaz** kabul edilir | ~1.530 (238 dosya) | Düzenlenir |
| `bold` | Koyu vurgu (basılı / ikinci vurgu) | ~80 (21 dosya) | Düzenlenir |
| `shadow` | Gölge rengi | ~40 (35 dosya) | Sabit (siyah %70) |
| `colors.{green,red,blue,orange,purple,yellow}` | **Anlam renkleri** (başarı, hata, uyarı…) | ~190 (40 dosya) | Zemine göre seçilir (§4.2) |
| `notesColor.{renk, renkBackground}` | Not etiketi renkleri (9 renk + zeminleri) | ~25 (7 dosya) | Zemine göre seçilir |

Özel temada düzenlenebilen 11 token: `CUSTOM_THEME_TOKENS` (düz adlar: `textPrimary` vb.); tema nesnesine
`buildCustomTheme(tokens)` çevirir. Hazır temadan 11 token çıkarmak: `themeToTokens(ad)`.

## 3b. Token şeması v2 (`theme/themeTokens.js`, 12 Kas)

Her tema nesnesi (hazır: `themes[ad]`, özel: `buildCustomTheme`) `expandTheme` içinden geçer. **Geriye uyumlu:** eski
anahtarlar (`primary`, `secondary`, `text.*`, `accent`, `border`...) AYNEN durur, yalnız yenileri eklenir.
`theme.tokensVersion === 2`. Sonuç WeakMap'te önbelleklenir.

| Grup | Anahtarlar |
|---|---|
| Kip | `scheme` ("light"/"dark"), `isDark` |
| Metin (6) | `text.primary/secondary/muted` + `faint`, `disabled`, `placeholder`, `inverse`, `onAccent`, `link`; sıralı dizi `textScale` |
| Yüzey (8) | `surface.sunken/canvas/subtle/card/raised/overlay/highest/inverse`; sıralı dizi `surfaceScale` (7) |
| Vurgu | `accentScale` (50…950, 11 adım), `accentAlpha` (4…72), `accentSoft/Subtle/Text/Hover/Pressed`, `onAccent` |
| Kenarlık | `borders.hairline/subtle/default/strong/focus/accent/inverse` (`default` = eski `border`) |
| Etkileşim | `state.hover/pressed/focus/selected/dragged/disabledContainer`, `disabledOpacity` |
| Perde | `scrim.faint/soft/medium/strong/heavy` |
| Durum | `status.success/warning/danger/info` → `{ base, fg, soft, softSolid, border, on }` (`fg` zemine okunur) |
| Gölge | `elevation[0..5]` (RN gölge nesneleri) |
| Medya üstü | `onMedia` — afiş/görsel üstünde SABİT beyaz kademeler (temaya göre değişmez) |
| Diğer | `chart` (8 renk), `gradients.accent/surface/hero` |

Yardımcılar: `toRgba` (#rgb/#rrggbb/#rrggbbaa/rgb()/rgba()), `mix`, `inkOn`, `colorScale`, `alphaScale`.
`theme/colors.js` → `alpha(renk, a)` artık `toRgba` kullanır (eskiden `alpha("#fff", …)` siyah dönüyordu).

**Kural:** Tema yüzeyindeki metne sabit `#fff`/`rgba(255,255,255,…)` yazma — `theme.text.*` / `theme.borders.*`
kullan. Beyaz yalnız vurgu, gradyan veya görsel üstünde doğrudur (`theme.onMedia` ya da `theme.onAccent`).
Denetim betiği: `node scripts/audit-theme-colors.js [dizin|dosya] [--lines] [--json]` — şüpheli satırları listeler;
bilinçli istisna satır sonuna `// theme-audit-ok`. (12 Kas: ~555 bulgu, çoğu görsel/vurgu üstünde doğru kullanım;
açık temada gerçekten bozuk olanlar düzeltildi.)

## 4. Hazır temalar, aileler, anlam renkleri

### 4.1 Hazır temalar

| Anahtar | Aile · ton | Ad anahtarı (`translations`) | Zemin | Anlam rengi seti |
|---|---|---|---|---|
| `light` | Varsayılan · çok açık (~97) | `lightTheme` | açık | `LIGHT_THEME_*` |
| `silver` | Varsayılan · açık (~76) | `silverTheme` | açık | `LIGHT_THEME_*` |
| `dusk` | Varsayılan · orta (~27) | `duskTheme` | koyu | `DARK_THEME_*` |
| `gray` | Varsayılan · koyu (~12) | `grayTheme` | koyu | `DARK_THEME_*` |
| `dark` | Varsayılan · AMOLED (0) | `darkTheme` | koyu | `DARK_THEME_*` |
| `blueBright` | Mavi · çok açık | `blueBrightTheme` | açık | `SKY_THEME_*` |
| `sky` | Mavi · açık (12 Kas'ta L* 86 → 76) | `skyTheme` | açık | `SKY_THEME_*` |
| `blueDusk` | Mavi · orta | `blueDuskTheme` | koyu | `BLUE_THEME_*` |
| `blue` | Mavi · koyu (**uygulama varsayılanı**) | `blueTheme` | koyu | `BLUE_THEME_*` |
| `blueDeep` | Mavi · AMOLED (zemin #000) | `blueDeepTheme` | koyu | `BLUE_THEME_*` |
| `greenBright` | Yeşil · çok açık | `greenBrightTheme` | açık | `GREEN_THEME_*` |
| `green` | Yeşil · açık (12 Kas'ta L* 81 → 76) | `greenTheme` | açık | `GREEN_THEME_*` |
| `greenDusk` | Yeşil · orta | `greenDuskTheme` | koyu | `DARK_THEME_*` |
| `greenMid` | Yeşil · koyu (ad tarihsel) | `greenMidTheme` | koyu | `DARK_THEME_*` |
| `greenDeep` | Yeşil · AMOLED (zemin #000) | `greenDeepTheme` | koyu | `DARK_THEME_*` |
| `purple` | — (eski, Gece Moru) | `purpleTheme` | koyu | `DARK_THEME_*` |
| `amber` | — (eski, Kızıl Sinema) | `amberTheme` | koyu | `DARK_THEME_*` |

- **Aileler:** `THEME_FAMILIES` (`id`, `icon`, `labelKey` = `themeFamily<Ad>`, `fallback`, `tones: {bright, light, mid, dark, amoled}`).
  Ton listesi/etiketleri TEK KAYNAK: `theme/toneModel.js` (`TONES`, `DEFAULT_TONE = "dark"`, `toneLabel`, `TONE_PATTERN`,
  `completeToneMap`); etiketler `themeToneBright/Light/Mid/Dark/Amoled`. `FAMILY_THEME_KEYS` = ailelerdeki 15 anahtar =
  Free'nin seçebildiği temalar (`premiumFeatures.PRESET_THEME_COUNT = 15`). `familyOfTheme(ad)` → `{ family, tone }`.
- **Eski temalar:** `LEGACY_PRESET_THEME_KEYS = ["purple", "amber"]` — listede yalnız seçiliyken görünür; asıl
  yerleri Tema Stüdyosu > Hazır temalar (`utils/themePresets.js`). Eski seçenler bozulmasın diye `themes`'te durur.
- **Kayıtlı anahtarlar asla yeniden adlandırılmaz** (`gray`, `dark`, `light`, `sky`, `blue`, `green` 19 Eki öncesinden).
  **Ton merdiveni (12 Kas, zemin L\*):** çok açık ~97 · açık ~76 · orta ~27 · koyu ~11 · AMOLED 0. Yayımlanmış
  anahtarların görünümü korunarak basamaklara dağıtıldı (`gray`/`blue`/`greenMid` = koyu, `dark`/`blueDeep`/`greenDeep`
  = AMOLED, `light` = çok açık); ara basamaklar yeni (`silver`, `dusk`, `blueDusk`, `greenDusk`). En büyük basamak
  açık→orta (~50): yazı orada siyahtan beyaza döner ve orta ton, vurgu zemine ≥3 + beyaz düğme yazısı ≥3 kalsın
  diye L\* ~30'u geçemez. Bekçi: `themeFamilies.test.js` → "ton merdiveni dengeli".
- `translations/*.json`'daki `orangeTheme` anahtarı hiçbir temaya bağlı değil (artık).

### 4.2 Anlam renkleri (`colors`, `notesColor`)

Zemin açıkken yeşil/kırmızı vb. koyulaştırılmalı, koyuyken açılmalı (WCAG). Bu yüzden 5 set var:
`DARK_`, `LIGHT_`, `GREEN_`, `SKY_`, `BLUE_THEME_COLORS` (+ `_NOTES_COLORS`).

- Hazır temada set **nesnenin içinde elle** yazılır (`colors: LIGHT_THEME_COLORS`).
- Özel temada `getSemanticColorsForTheme("custom", zemin)` zemin rengine göre seçer: yeşilimsi açık → `GREEN`,
  gök mavisi açık → `SKY`, açık → `LIGHT`, aksi → `DARK`.
- `getSemanticColorsForTheme` içindeki **anahtar listesi** de hazır temaları sayar; yeni hazır tema eklerken oraya da ekle
  (şu an yalnız özel tema yolu çağırıyor, ama liste tutarlı kalmalı).
- Anlam rengini herhangi bir yüzeyde okunur yapmak için `utils/colorUtils.js` → `readableOn` (testi:
  "TÜM anlam rengi / tema yüzeyi çiftleri WCAG AA eşiğini geçer").

## 5. Özel temalar (Tema Stüdyosu)

| Konu | Yer | Kural |
|---|---|---|
| Kayıt girdisi | `AppSettingsContext.saveCustomTheme` | `{ id, name, ladder: 2, tokens (= varsayılan/koyu ton), tones?: {bright, light, mid, dark, amoled}, base? }` |
| Seçim anahtarı | `customSelectionKey(id, ton)` / `parseCustomSelection` | Varsayılan (koyu) ton eksiz `custom:<id>`, diğerleri `custom:<id>:bright\|light\|mid\|amoled`. Eski çıplak `"custom"` = ilk özel tema |
| Eski tek tonlu tema | `customToneTokens` | `tones` yoksa varsayılan ton (`tokens`) **AYNEN**, eksik tonlar `deriveToneTokens(tokens, ton, "dark")` ile türetilir (önbellekli) |
| Merdiven göçü | `migrateCustomEntry`, `migrateCustomSelection`, `migrateThemeLadder` (`theme/colors.js`) | `ladder` bayrağı yoksa kayıt ESKİ merdivendendir: eski orta → koyu (= `tokens`, görünüm aynı), eski açık → çok açık, eski koyu atılır (AMOLED saf siyah türetilir). Seçim: eski `:dark` → `:amoled`, `:light` → `:bright`. Açılışta `AppSettingsContext.readThemeState`, yedek dönüşünde `planImport`, paylaşımda `sanitizeSection` uygular. Motor: `toneOfTokens` bir seti zemin açıklığına göre basamağına oturtur. |
| Bağıl token | `isRelativeToken`, `resolveThemeTokens` | `{ from: "accent", l: +15 }` gibi; döngü/eksik referans varsayılana düşer |
| Üretim motoru | `utils/themeStudio.js` | `generateToneSet`, `harmonizeTokens`, `fitAccent` (vurgu zemine ≥3 **ve beyaz yazıya** ≥3), `analyzeContrast`, `fixReadability`, ruh halleri `MOODS`, rastgele `generateCandidates` |
| Deste modeli | `utils/themePresets.js` | `{ base, accent, tones }`; `bundleFromEntry`, `entryFromBundle`, `initialBundle`; Stüdyo'nun hazır temaları; eksik ton `completeToneMap` ile tamamlanır |
| Geri al / yinele | `utils/draftHistory.js` | |
| Metinler | `components/theme/themeStudioCopy.js` | **JSON değil, yerel tablo** — dil eklerken buraya kol ekle |
| UI parçaları | `components/theme/` (`ThemeToneKit`, `ThemeShuffleDeck`, `ColorPickerSheet`, `ThemePreviewCard`, `ThemeStudioKit` → `inkOn`) | |
| Premium | `premiumFeatures` → `custom_themes` (ACCESS, Premium) | Free'de seçim saklanır, varsayılan çizilir |
| Yedek / paylaşım | `utils/settingsBackup.js` (`sanitizeCustomThemes`, en çok `MAX_CUSTOM_THEMES = 40`), `utils/settingsShare.js` (seçili özel tema token'larıyla arkadaşa gönderilir) | Token anahtarları `CUSTOM_THEME_TOKENS`'tan doğrulanır |

## 6. Açık / koyu kararı — tek kural

**Kural: tema adına (`selectedTheme === "light"`) bakma; zemini ölç.**

```js
import { isLightSurface } from "../utils/colorUtils";
const light = isLightSurface(theme.primary); // WCAG parlaklık > 0.179
```

Bu sayede yeni açık tema ya da açık özel tema **otomatik doğru** davranır. Bugün kodda tema adı
karşılaştıran yer yok (yalnız `custom` önekine bakan seçim mantığı var). Kullanan yerler:

| Yüzey | Dosya(lar) | Not |
|---|---|---|
| Kök durum çubuğu, React Navigation teması | `App.js` | |
| Ekran durum çubukları | `ChatScreen`, `CalendarScreen`, `ListsViewScreen`, `MovieTrends`, `TvShowsTrends`, `NotesScreen`, `RemindersScreen`, `StoryShareScreen`, `StoryDraftsScreen`, auth ekranları, `OnboardingScreen`, `EditProfileScreen` | `barStyle={isLightSurface(...) ? "dark-content" : "light-content"}` |
| **Bilerek hep açık** durum çubuğu | `MovieDetail`, `TvShowsDetails`, `SeasonDetails`, `EpisodeDetails`, `ActorViewScreen`, `WrappedScreen` | Üstte koyu fotoğraf/hero var; temaya bağlama |
| Cam şeması, klavye görünümü | `components/common/GlassSurface.js` → `useGlassScheme()` (11 yerde `keyboardAppearance`) | |
| Açılış animasyonu | `utils/splashPlan.js` → `splashPaletteFor(tema zemini)` | Yazı/halka/yıldız rengi + durum çubuğu |
| Auth / onboarding arka planları | `components/auth/AuthKit.js` (`AuthBackdrop`), `AuthPosterField`, `NotificationBellHero` (`SheetGlow`) | `isLightTheme` prop'u |
| Widget ön izleme duvar kâğıdı | `WidgetSettingsScreen` (`paper`/`night`) | |
| Toplam | `isLightSurface` 54 dosyada | |

**Okunur yazı rengi:** zemin üstünde siyah mı beyaz mı → `isLightSurface(zemin) ? koyu : "#FFFFFF"` ya da
`ThemeStudioKit.inkOn`. **`colorUtils.readableTextOn` kullanma** — eşiği 0.5, orta tonlarda yanlış sonuç verir
(bilinen açık, §13).

## 7. Temadan türeyen paletler (temayı değiştirince bunlar da değişir)

Bazı ekran aileleri temayı kendi adlarıyla bir palete çevirir. Yeni token eklerken ya da anlamını
değiştirirken bunlara bak:

| Palet | Dosya | Kullanan |
|---|---|---|
| `buildUiColors(theme)` | `screens/tabs/settings/settingsUi.js` | Ayarlar hub'ı + **31 dosya** (`bg, card, cardAlt, border, text, muted, accent, danger, iconBlue…`) |
| `cineColors(theme)` + `ON_POSTER` | `components/cineswipe/cineTheme.js` | CineSwipe; beğen/pas = `theme.colors.green/red`, kalp/altın marka sabiti |
| `buildGameTokens(theme)` | `theme/gameTokens.js` | Oyun ekranları (`game.*` namespace) |
| `rarityStyle`, `perdeStyle`, `kademeRengi(…, theme)` | `theme/badgeTokens.js` | Rozetler (nadirlik renkleri sabit, zemin/çerçeve temadan) |
| `sharePalette({ theme, isOutgoing, accent })` | `components/chat/shareKit.js` | Sohbete paylaşılan kartlar |
| `resolveGameAccentColors(game, theme)` | `screens/game/gameRegistry.js` | Oyun kartı vurguları |
| `splashPaletteFor(bg)` | `utils/splashPlan.js` (`NATIVE_SPLASH_BG` → `utils/splashMotion.js`) | Açılış animasyonu |
| `buildNoteColorPairs(theme.notesColor)` | `utils/notesView.js` | Not renk seçici (9 çift) |
| `planGlassChrome` / cam ton sabitleri | `utils/glassChrome.js` (`GLASS_SURFACE_TINT_ALPHA = 0.55`, `GLASS_FIELD_TINT_ALPHA = 0.55`) | Cam düğme/alan/kart |
| `navigationTheme` | `App.js` | React Navigation |

## 8. Temaya bilerek BAĞLI OLMAYAN renkler

`components` (~2.170 satır) + `screens` (~1.420 satır) içinde sabit renk var. Beyaz (`#fff` türevleri)
~1.220, `rgba(255,255,255,…)` ~865, siyah ~180, `rgba(0,0,0,…)` ~345 kez geçiyor. Hepsi hata **değil**.
Sınıflar:

| Sınıf | Örnek dosyalar | Temaya bağlanmalı mı? |
|---|---|---|
| **Poster / fotoğraf / hero üstü** (zemin fotoğraf) | `ON_POSTER`, `PosterInfoBadges`, `ImageGalleryModal`, detay hero'ları | **Hayır** — beyaz yazı + koyu örtü doğru |
| **Dışa aktarılan görseller** (hikâye, Wrapped, paylaşım kartı) | `components/storyShare/*`, `components/wrapped/*`, `SceneResultShareCard`, `utils/wrappedCard.js`, `utils/profileStoryCard.js` | **Hayır** — kendi palet seçicileri var (`themeId: "signature"…`), görsel uygulama dışında görülür |
| **Atmosfer / dekor sahneleri** | `components/decor/*` (`universeSprites` ~240 satır…) | **Hayır** — sahne renkleri |
| **Marka / ödül renkleri** | altın `#F5C518`/`#FFD700`, CineSwipe kalbi, rozet nadirliği `RARITY`, lig görselleri | **Hayır** |
| **Vurgu üstü yazı** | ~350 yerde `accent` zeminde `#fff` | **Hayır, ama** yeni vurgu beyaza ≥3:1 olmalı (`fitAccent`) |
| **Widget önizlemeleri** | `screens/tabs/settings/widgets/*` | **Hayır** — widget'ın kendi görünümünü çizer |
| **Geliştirici ekranları** | `UsageDebugScreen` (~480 satır), `TabBarQaScreen`, DevLab | Hayır |
| **Tema yüzeyi üstünde metin/ikon** | — | **EVET.** Açık temada okunmayan şey bulunursa sebep budur → `theme.text.*` / `theme.border` / `buildUiColors` |

**Gözden geçirilmesi gereken adaylar** (temayı okumadan sabit renk kullanan, tema zemini üstünde çizilen
olası dosyalar; renk prop olarak geliyorsa sorun yoktur): `screens/tabs/profile/notes/*`
(`NoteCards`, `NoteEditorSheet`, `NotesChrome`), `screens/onboarding/OnboardingPreferences.js`,
`OnboardingShowcases.js`, `components/import/*` (`ImportProgressView`, `ImportAnalysisView`, `ImportResultView`),
`components/CacheManagerModal.js`, `components/calendar/CalendarAgendaDay.js`, `CalendarFilterPanel.js`,
`components/tournament/*` (`MatchCard`, `PodiumModal`, `StageTimeline`, `genreMeta`, `phaseMeta`),
`components/hub/*Widget.js`, `components/profile/StatsComponents.js`, `components/feed/FeedPostCard.js`,
`components/detail/TasteFitButton.js`, `components/AICineCards.js`, `components/tv/UpNextRailCard.js`.
Açık temada (`light`, `sky`, `green`) gezerek bakılmalı (§11 madde 6).

## 9. Tema listesinin ELLE KOPYALANDIĞI yerler (en önemli bölüm)

Yeni hazır tema eklenince ya da biri kaldırılınca **bunlar otomatik güncellenmez** ve **hiçbir test uyarmaz**:

| # | Yer | Ne kopyalanmış | Eksik kalırsa |
|---|---|---|---|
| 1 | `screens/tabs/settings/WidgetSettingsScreen.js` → `BUILTIN_THEMES` | 11 temanın `id` + ad anahtarı + Türkçe yedek | Yeni tema widget görünüm kataloğunda **çıkmaz** |
| 2 | `components/modals/ChatModal.js` → `THEME_SWATCHES` | 5 tema (`dark, light, gray, blue, green`) + **elle yazılmış nokta renkleri** | AI sohbet hızlı seçicide çıkmaz; nokta renkleri temanın gerçek renginden **kayabilir** (zaten kaymış: ör. `gray` noktası `#2C2C2C`, tema zemini `#1D1F23`) |
| 3 | `screens/tabs/setting/SettingsTheme.js` → `LEGACY_LABEL_KEYS` | Eski temaların ad anahtarı | Eski tema adsız görünür |
| 4 | `utils/settingsShareCopy.js` | Aile/eski tema adlandırması (`familyOfTheme`, `LEGACY_PRESET_THEME_KEYS`) | Paylaşım özetinde tema adı yanlış |
| 5 | `theme/colors.js` → `getSemanticColorsForTheme` anahtar listesi | Hangi tema hangi anlam seti | Özel tema yolu dışında etkisiz, ama tutarsız |
| 6 | `services/widgetPreferencesService.js` → `PURPLE_APPEARANCE`, `BLUE_APPEARANCE` (+ Android `WidgetPreferences.kt`, iOS `targets/reminder-widget/shared.swift` yedekleri) | Widget **varsayılan** görünümü: Gece Moru / Lacivert renklerinin kopyası | `purple`/`blue` renkleri değişirse widget varsayılanı eski renkte kalır |
| 7 | `utils/themePresets.js` | Stüdyo hazır temaları (3 aile aynen + 6 ek) | Stüdyo'da görünmez |

**Widget'lar temayı izlemez:** widget görünümü, kullanıcı seçtiği anda temanın 9 rengiyle **kopyalanır**
(`appearanceFromPalette` → `background, surface, surfaceAlt, border, text, secondaryText, muted, accent, bold`).
Uygulama teması sonra değişse widget eski renkte kalır; bir temanın renklerini güncellersen o temayı seçmiş
widget'lar da eski renkte kalır (bilinçli değil, eksik; §13).

## 10. Native ve sistem tarafı

| Yer | Değer | Not |
|---|---|---|
| `app.json` → `expo-splash-screen` `backgroundColor` | `#0D0E13` (sabit) | Native açılış ekranı temayı bilemez (JS yüklenmeden çizilir); `SplashLensIntro` sonra tema zeminine boyar. Değiştirirsen `utils/splashMotion.js` → `NATIVE_SPLASH_BG` de aynı olmalı (dalga katmanı kurulup kurulmayacağı buna bakar). **Native build** |
| `app.json` → `userInterfaceStyle` | `"automatic"` | Sistem açık/koyu kipi yalnız sistem bileşenlerini etkiler; uygulama teması sistem kipini **izlemez** |
| Android `adaptiveIcon` | şeffaf zemin + görsel katmanlar | Temayla ilgisi yok (simge: `utils/appIcons.js`) |
| Android gezinti çubuğu | `NavigationBar` API'si kullanılmıyor | Temaya göre renk verilmiyor |
| Widget'lar (Kotlin / Swift) | JS'ten gelen 9 renk + yerel yedekler | §9 madde 6 |

## 11. Senaryolar — adım adım

### A. Yeni hazır tema (mevcut bir aileye ton ya da bağımsız)
1. `theme/colors.js` → `themes`'e anahtar: **tüm** token'lar (§3) dolu; `colors`/`notesColor` için uygun set (§4.2).
2. Aileye giriyorsa `THEME_FAMILIES[...].tones`. Girmiyorsa listede nerede görüneceğine karar ver (`SettingsTheme.js`).
3. Ad: 6 dilde `<anahtar>Theme` (`translations/{tr,en,es,pt,de,it}.json`) — yinelenme için satır tabanlı ara.
4. **§9 listesini tek tek uygula** (widget `BUILTIN_THEMES`, gerekiyorsa `THEME_SWATCHES`, `getSemanticColorsForTheme`).
5. Free'ye açıksa `utils/premiumFeatures.js` → `PRESET_THEME_COUNT` + karşılaştırma metinleri; değilse Stüdyo hazır teması (`utils/themePresets.js`).
6. Yedek: `THEME_NAMES` otomatik → `settingsBackup` yeni anahtarı kabul eder; testte doğrula.
7. `__tests__/themeFamilies.test.js`'e yeni tema için "tam şekil + okunur" beklentisi ekle.
8. Açık temaysa §11-F.

### B. Yeni aile
A'daki adımlar × 5 ton + `THEME_FAMILIES`'e `{ id, icon, labelKey: "themeFamily<Ad>", fallback, tones }` + 6 dilde
aile adı + `PRESET_THEME_COUNT` (= aile ton sayısı) + Ayarlar kart düzeni (3 kart için tasarlandı; 4. kart dar ekranda
320 dp'de kontrol edilmeli).

### C. Yeni token (ör. `danger`, `surfaceRaised`)
1. Türetilebiliyorsa `theme/themeTokens.js` → `expandTheme` içine ekle (hazır + özel HER tema otomatik alır). Ham token ise `RAW_THEMES`'teki **17 temanın hepsine** ekle (hiçbiri eksik kalmasın; `theme.yeni ?? yedek` yazmak yerine).
2. `buildCustomTheme` içinde üret (düzenlenebilir mi, türetilmiş mi?).
3. Düzenlenebilirse: `CUSTOM_THEME_TOKENS` + grup + 6 dilde etiket (`autoI18n.ct_*`) + `themeToTokens` +
   `DEFAULT_CUSTOM_TOKENS` + `themeStudio.generateTokensFromSeeds` / `deriveToneTokens` (üretim motoru 11 token varsayar;
   testi "tam 11 token üretir") + `settingsBackup` token doğrulayıcısı (eski yedeklerde **olmayacak** → varsayılana düşmeli).
4. Kullanıcı yeri: önce türetilen paletlere (§7) ekle (`buildUiColors` vb.), sonra ekranlar.
5. Widget'a da gidecekse `APPEARANCE_COLOR_KEYS` + Kotlin/Swift ayrıştırıcıları → **native build**.

### D. Token kaldırma / yeniden adlandırma
Kalıcı veri **token adı taşır** (özel temalar `customThemes`, yedek dosyaları, arkadaşa paylaşılan görünüm). Düz adı
(`textPrimary`) değiştirmek = göç gerekir (`services/storage/migration.js`). Tema nesnesi alanını (`theme.ai` gibi)
kaldırmak güvenli: `rg "\.ai\b"` ile kullanım 0 olduğunu doğrula (bugün `ai` gerçekten 0).

### E. Anlam renk setini (yeşil/kırmızı…) değiştirmek
`*_THEME_COLORS` + `*_NOTES_COLORS` birlikte; `colorUtils.test.js` WCAG AA bekçisi kırılırsa değeri düzelt, testi değil.
**Dikkat — notlar hex saklar:** not düzenleyici (`screens/tabs/profile/notes/NoteEditorSheet.js`) notun
`color` + `backgroundColor` alanına seçildiği andaki temanın **hex değerini** yazar (renk adı değil). Sonuç:
`*_NOTES_COLORS` değerini değiştirmek mevcut notları güncellemez; açık temada oluşturulan not koyu temada
açık-tema rengiyle görünür; düzenleyici kayıtlı rengi `colorPairs.find(item.color === draft.color)` ile eşleştirir,
tutmazsa seçim kaybolur. Not renklerini temaya bağlamak istenirse göç gerekir (renk adı/indeks saklamak).

### F. Açık tema eklerken / açık temada sorun düzeltirken
1. `isLightSurface(primary)` gerçekten `true` mu (eşik 0.179).
2. Vurgu üstü beyaz yazı ≥3:1 (`fitAccent`).
3. `shadow` açık temada çok hafif olmalı (`light`: `alpha("#0F172A", 0.08)`).
4. Cam yüzeylerde metin okunabilirliği (`GLASS_*_TINT_ALPHA`), özellikle ayarlar ekranları.
5. §8'deki "gözden geçirilecek adaylar"ı bu temada gez.
6. Ekran turu: Film/Dizi ana ekranı, detay, arama, sohbet, AI sohbet, takvim, notlar, ayarlar, Tema Stüdyosu,
   CineSwipe, oyunlar, turnuva, rozetler, Premium sayfası, onboarding/giriş, widget ayarları, içe aktarma, önbellek yöneticisi.

### G. Seçim biçimini değiştirmek (`custom:<id>:<ton>`)
Biçim 4 yerde ayrıştırılır: `parseCustomSelection` (tek kaynak), `settingsBackup.isThemeId` (**ayrı regex**),
`settingsShare.customIdOf`, `ThemeContext` (`startsWith("custom")`). Eski biçimler (`"custom"`, `custom:<id>`) okunmaya
devam etmeli — kullanıcı cihazlarında kayıtlı.

### H. Premium kapsamını değiştirmek
`premiumFeatures`: `custom_themes` (ACCESS) ve `PRESET_THEME_COUNT`; kapı `ThemeContext.customThemesAllowed`.
Kural: kayıt silinmez, varsayılan çizilir. Metinler 6 dilde `premiumFeatures` içinde.

### I. Eski bir temayı tümüyle kaldırmak
Yapma — kaldırılırsa o temayı seçmiş kullanıcı **gri** temaya düşer (`getThemeColors` yedeği) ve widget/yedek/paylaşım
kayıtları geçersizleşir. Gerekirse önce göç: `migration.js`'te eski anahtarı en yakın aile tonuna çevir, sonra §9
listelerinden ve `THEME_NAMES`'ten çıkar.

## 12. Testler ve bekçiler

| Test | Ne korur |
|---|---|
| `__tests__/themeFamilies.test.js` | 3 aile × 5 ton gerçek tema; merdiven hedefte (±5 L*), komşu basamak ≥9 ve ≤55; vurgu zemin/kart/beyaz yazı okunur; merdiven göçü (kayıt, seçim, yedek); ton ekli seçim yedekte kaybolmaz; eski anahtarlar ailelerde; `purple`/`amber` duruyor; yeni temalar tam şekil + okunur; bilinmeyen → gri; aile/tema etiketleri dillerde var; özel tema seçim anahtarı ve ton türetme |
| `__tests__/themeStudio.test.js` | Ton üretimi: 11 token, kontrast kademeleri, açık/koyu ayrımı algısal parlaklıkla, kontrast/yüzey kipleri |
| `__tests__/themeStudioCopy.test.js` | Stüdyo metin tablosu: diller aynı anahtar kümesi, boş yok, her ruh hali/uyum/ton etiketli |
| `__tests__/themeAppearance.test.js` | Orta-açık zeminlerde düşük kontrastlı renk koyulaşır; widget renkleri yüzeysiz sabit; `rgba` kenarlık opaklıkta geçerli kalır |
| `__tests__/colorUtils.test.js` | `contrastRatio`; `readableOn`: **tüm anlam rengi × tema yüzeyi çiftleri WCAG AA** |
| `__tests__/settingsBackup.test.js` | Tema kimliği doğrulama, özel tema temizleme |
| `__tests__/themeTokensV2.test.js` | v2 şeması her temada tam; metin/yüzey kademeleri sıralı; durum renkleri ve `onAccent` okunur; ham anahtarlar değişmedi |
| `__tests__/premiumFeatures.test.js` | `PRESET_THEME_COUNT`, kopya metinler |
| `__tests__/glass*.test.js` | Cam kararı (temaya göre şema) |

**Kör noktalar (bekçisi YOK):**
- §9'daki elle kopyalanmış listeler (`BUILTIN_THEMES`, `THEME_SWATCHES`, widget varsayılanları).
- Sabit renkler (§8) — yeni dosyada `#fff` yazmayı hiçbir şey engellemiyor.
- Ekran düzeyinde durum çubuğu (`StatusBar`) seçimi.
- Açık temada gerçek görünüm — yalnız cihazda / önizlemede görülür.

## 13. Bilinen açıklar (yol haritası)

| # | Açık | Öneri |
|---|---|---|
| 1 | `BUILTIN_THEMES` (widget) ve `THEME_SWATCHES` (AI sohbet) elle liste, test yok | `THEME_FAMILIES` + `LEGACY_PRESET_THEME_KEYS`'ten türet; AI sohbet noktalarını `themes[k].primary/accent`'ten çiz; ya da en azından `themeFamilies.test.js`'e "widget listesi = `THEME_NAMES`" bekçisi |
| 2 | AI sohbet nokta renkleri gerçek tema renklerinden kaymış | Madde 1 ile çözülür |
| 3 | Widget görünümü seçim anında kopya; uygulama temasını izlemez | "Uygulama temasını izle" seçeneği (`themeId` saklı, renkler yazılırken temadan çözülür) — native build gerekir |
| 4 | `colorUtils.readableTextOn` eşiği 0.5 (doğrusu 0.179) | Eşiği düzelt ya da kaldırıp `isLightSurface`'e yönlendir; çağrı yerlerini cihazda kontrol et |
| 5 | `theme.ai` hiç kullanılmıyor; `secondaryt`, `tab`, `text.between` çok az | Temizlik adayı (§11-D); kaldırmadan önce `rg` ile doğrula |
| 6 | `orangeTheme` çeviri anahtarı yetim | Sil (6 dil) |
| 7 | Widget Türkçe yedek adı "Koyu Mavi", çeviri "Koyu Lacivert" | Yedeği çeviriyle eşitle |
| 8 | §8 adayları açık temada gezilmedi | Cihaz/önizleme turu |
| 9 | Sabit renk bekçisi yok | `glassCoverageGuard` gibi "yalnız azalabilir" sayaç: dosya başına tema yüzeyi üstündeki `#fff`/`#000` |
| 10 | Notlar rengi hex olarak saklıyor; tema değişince eski notlar eski temanın rengiyle kalır (§11-E) | Renk adı saklayan göç; okurken adı temanın `notesColor`'ından çöz |
| 11 | Uygulama sistem açık/koyu kipini izlemiyor | İstenirse "Sistemle aynı" seçeneği: `useColorScheme()` → aile içinde açık/koyu ton |

## Yeniden sayma komutları

```bash
rg -l "useTheme\(\)" components screens hooks context App.js | wc -l
```

```bash
rg -c "#[0-9a-fA-F]{3,8}\b" components screens | sort -t: -k2 -rn | head -30
```

```bash
rg -lw isLightSurface components screens hooks utils context App.js | wc -l
```

```bash
rg -n "barStyle=|<StatusBar" components screens App.js
```

```bash
rg -n "BUILTIN_THEMES|THEME_SWATCHES|LEGACY_LABEL_KEYS|PURPLE_APPEARANCE|BLUE_APPEARANCE"
```

```bash
rg -n "theme\.ai\b|theme\.secondaryt\b|theme\.tab\b|text\.between\b" components screens
```
