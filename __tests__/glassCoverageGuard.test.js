// Liquid Glass kapsam bekçisi (kaynak taraması) — "her düğme ve her yazı alanı cam".
//
// Düğmeler: components/ ve screens/ altındaki TouchableOpacity / Pressable
// kullanımlarından, cama ÇEVRİLEBİLİR (dolgulu/çerçeveli, kart olmayan, liste
// satırı olmayan, camın içinde olmayan…) olup hâlâ HAM kalanlar sayılır. Beklenen
// sayı aşağıdaki tablodur ve yalnız AZALABİLİR: yeni bir düğme `GlassTouchable` /
// `GlassPressable` ile yazılır; ham bırakılacaksa gerekçesiyle tabloya eklenir.
//
// Yazı alanları: her ham <TextInput> ya bir cam kabuğun (GlassBox role="field",
// GlassField, composer camı) içinde ya da `GlassTextInput` olmalı; kalanlar
// aşağıda gerekçeleriyle sayılı.
//
// Sınıflandırma kuralları: __tests__/helpers/glassInventory.js (başında açıklı).
const fs = require("fs");
const path = require("path");
const { ROOT, sourceFiles, rawEligibleTouchables, rawTextInputs } = require("./helpers/glassInventory");

// ── HAM kalmasına izin verilen düğmeler (dosya → en çok kaç tane) ─────────────
const RAW_TOUCHABLE_ALLOWED = {
  // Liste satırı / sohbet balonu / akış kartı İÇİ eylemler: her satırda cam pahalı
  // (UIGlassEffect başına bir görsel efekt katmanı) ve iç içe kalabalık.
  "components/chat/PollMessage.js": 1,
  "components/chat/SharedAiMessage.js": 1,
  "components/chat/SharedCineRoomMessage.js": 1,
  "components/chat/SharedListMessage.js": 1,
  "components/chat/SharedMediaCollection.js": 1,
  "components/chat/SharedMediaMessage.js": 2,
  "components/chat/SharedPostMessage.js": 2,
  "components/chat/SharedTournamentMessage.js": 1,
  "components/Comment.js": 7,
  "components/feed/FeedPostCard.js": 11,
  "components/feed/ClampedText.js": 1,
  "components/friends/PillButton.js": 1,
  // Basılı-tut onay düğmesi: yüzeyi soldan sağa dolan bir ilerleme çubuğu — cam bu dolguyu bozar.
  "components/profile/HoldToConfirmButton.js": 1,
  "components/friends/RoundIconButton.js": 1,
  "components/lists/GlobalSearchResults.js": 1,
  "components/modals/createPost/DraftCard.js": 2,
  "screens/tabs/profile/notes/NoteCards.js": 5,
  "components/tv/TvGraphGrid.js": 1, // yüzlerce bölüm hücresi
  "components/cineswipe/SwipeCard.js": 1, // kart içi bilgi düğmesi
  "components/badges/BadgeRail.js": 3, // kart gibi raf öğeleri
  "components/badges/BadgeShowcaseCard.js": 2, // kart gibi vitrin yuvası + yuvanın köşesindeki sil rozeti
  // Düğmenin KENDİSİ renk örneği / tema önizlemesi: cam tonu gösterdiği rengi bozar.
  "components/theme/ThemeShuffleDeck.js": 2,
  "components/theme/ThemeToneKit.js": 1,
  "screens/tabs/setting/SettingsTheme.js": 2,
  // Animasyonlu opaklıklı bildirim kartı (cam opaklıkla soldurulamaz).
  "components/toast/ToastCards.js": 1,
  // Marka renkli giriş düğmeleri (Apple / Google) — AuthKit'te glass={false}.
  "components/auth/AuthKit.js": 1,
  // Hata sınırı sağlayıcıların DIŞINDA: cam bileşeni tema okuyup "useTheme must be used within a
  // ThemeProvider" ile asıl hatayı gizlerdi (bkz. __tests__/errorBoundaryStandalone.test.js).
  "components/ErrorBoundary.js": 1,
  // Yalnız geliştirici ekranları.
  "screens/development/TabBarQaScreen.js": 1,
  "screens/tabs/UsageDebugScreen.js": 36,
};

// ── Cam kabuğun DIŞINDA kalan <TextInput>lar (dosya → en çok kaç tane) ────────
const RAW_INPUT_ALLOWED = {
  // Kendi cam katmanını elle çizen alan (AuthField: Animated.View + GlassSurface).
  "components/auth/AuthKit.js": 1,
  // Kabuğu bir üst bileşende cam: FilterSearchInput, GlassBox'lı satırın içinde.
  "components/profile/StatsComponents.js": 1,
  // Alt çizgili (kutusuz) alanlar ve not kâğıdı: kutu yok, cam olacak şey yok.
  "screens/chat/CreateGroupScreen.js": 1,
  "screens/tabs/profile/notes/NoteEditorSheet.js": 3,
  // Opaklığı animasyonlu atası olan alan (cam opaklıkla soldurulamaz).
  "screens/lists/ListsViewScreen.js": 1,
  // Yalnız geliştirici ekranları.
  "screens/development/TabBarQaScreen.js": 2,
  "screens/tabs/UsageDebugScreen.js": 4,
};

const files = sourceFiles().filter(({ rel }) => !/^components\/common\/(Glass|useGlass)/.test(rel));
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

describe("Liquid Glass kapsamı — düğmeler", () => {
  const raw = {};
  for (const { file, rel } of files) {
    const src = fs.readFileSync(file, "utf8");
    if (!/TouchableOpacity|Pressable/.test(src)) continue;
    const found = rawEligibleTouchables(src);
    if (found.length) raw[rel] = found.map((f) => f.line);
  }

  test("cama çevrilebilir ham düğme, izin tablosundan fazla olamaz", () => {
    const fazla = Object.entries(raw)
      .filter(([rel, lines]) => lines.length > (RAW_TOUCHABLE_ALLOWED[rel] ?? 0))
      .map(([rel, lines]) => `${rel} (satır ${lines.join(", ")}) — izin: ${RAW_TOUCHABLE_ALLOWED[rel] ?? 0}`);
    expect(fazla).toEqual([]);
  });

  test("izin tablosunda artık ham düğmesi kalmamış dosya yok (tablo güncel tutulur)", () => {
    const eskimis = Object.keys(RAW_TOUCHABLE_ALLOWED).filter((rel) => (raw[rel]?.length ?? 0) === 0);
    expect(eskimis).toEqual([]);
  });
});

describe("Liquid Glass kapsamı — yazı alanları", () => {
  const raw = {};
  for (const { file, rel } of files) {
    const src = fs.readFileSync(file, "utf8");
    if (!/TextInput/.test(src)) continue;
    const found = rawTextInputs(src);
    if (found.length) raw[rel] = found.map((f) => f.line);
  }

  test("cam kabuğun dışındaki ham <TextInput>, izin tablosundan fazla olamaz", () => {
    const fazla = Object.entries(raw)
      .filter(([rel, lines]) => lines.length > (RAW_INPUT_ALLOWED[rel] ?? 0))
      .map(([rel, lines]) => `${rel} (satır ${lines.join(", ")}) — izin: ${RAW_INPUT_ALLOWED[rel] ?? 0}`);
    expect(fazla).toEqual([]);
  });

  test("izin tablosunda artık ham alanı kalmamış dosya yok", () => {
    const eskimis = Object.keys(RAW_INPUT_ALLOWED).filter((rel) => (raw[rel]?.length ?? 0) === 0);
    expect(eskimis).toEqual([]);
  });
});

describe("Liquid Glass kapsamı — örnek yüzeyler (geri alınmasın)", () => {
  const WRAPPER = {
    touch: /<Glass(Touchable|Pressable)[\s>]/,
    field: /<GlassBox\s+role="field"|<GlassTextInput[\s>]/,
    card: /<GlassBox\s+role="card"/,
  };
  const SAMPLE = [
    // Alanlar
    ["components/lists/CreateListModal.js", "field"],
    ["components/lists/ListManageSheet.js", "field"],
    ["components/lists/ListItemActionsSheet.js", "field"],
    ["components/favorites/FavoritePickerSheet.js", "field"],
    ["components/chat/NewConversationSheet.js", "field"],
    ["components/modals/createPost/ComposerParts.js", "field"],
    ["components/tournament/NomineeSearchModal.js", "field"],
    ["screens/tabs/SettingsScreen.js", "field"],
    ["components/premium/RedeemCodeSheet.js", "field"],
    ["components/cineswipe/CineDuoLobby.js", "field"],
    // Düğmeler
    ["components/AppAlert.js", "touch"],
    ["components/common/ConfirmSheet.js", "touch"],
    ["components/import/ImportDataModal.js", "touch"],
    ["screens/movie/MovieDetail.js", "touch"],
    ["screens/tv/TvShowsDetails.js", "touch"],
    ["screens/tabs/SettingsScreen.js", "touch"],
    ["screens/chat/ChatScreen.js", "touch"],
    ["components/home/SectionHeader.js", "touch"],
    // Kartlar
    ["screens/tabs/SettingsScreen.js", "card"],
    ["screens/tabs/settings/AboutAppScreen.js", "card"],
    ["components/friends/TasteMatchCard.js", "card"],
    ["components/profile/WatchLevelCard.js", "card"],
    ["screens/game/GameHubScreen.js", "card"],
  ];
  test.each(SAMPLE)("%s → %s", (rel, kind) => {
    expect(read(rel)).toMatch(WRAPPER[kind]);
  });
});

describe("Liquid Glass sarmalayıcıları — yapı", () => {
  test("GlassView'ı doğrudan çağıran TEK yer GlassSurface; yeni sarmalayıcılar onun üstüne kurulu", () => {
    for (const rel of [
      "components/common/GlassTouchable.js",
      "components/common/GlassPressable.js",
      "components/common/GlassBox.js",
      "components/common/GlassTextInput.js",
      "components/common/useGlassChrome.js",
    ]) {
      expect(read(rel)).not.toMatch(/expo-glass-effect|NativeGlassView/);
    }
  });

  test("marka renkli giriş düğmeleri (Apple / Google) cam OLMAZ", () => {
    const src = read("components/auth/AuthKit.js");
    expect(src).toMatch(/pressedScale=\{0\.98\}\s*glass=\{false\}/);
  });
});
