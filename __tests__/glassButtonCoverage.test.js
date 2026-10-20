// Liquid Glass düğme kapsamı bekçisi (kaynak taraması).
//
// 15 Eki taramasında kapat/geri/araç çubuğu düğmeleri tek yapıya (GlassCloseButton
// / GlassIconButton / GlassPillButton) çevrildi. Biri bu ekranlardan birine elle
// yazılmış bir kutu geri koyarsa iOS 26'da o düğme camsız kalır; bu test
// bileşenin hâlâ kullanıldığını sabitler.
//
// BİLEREK cam OLMAYANLAR (yeni düğme eklerken de aynı kural):
//   • Composer hapı İÇİNDEKİ düğmeler (gönder, ekle, ayarlar, temizle) — cam içine
//     cam konmaz (GlassSurface kural 3)
//   • Opaklık animasyonlu atası olanlar — MediaQuickActionsSheet (root fadeAnim),
//     ListsViewScreen yeni-liste satırı (headerAnim) — cam solarken bozulur (kural 1)
//   • Liste satırı içi eylemler (not kartı kopyala/sil, geçmiş sil, üye çıkar, adım
//     düğmeleri, kaldır/ekle) — içerik katmanı; her satırda cam pahalı ve HIG'e aykırı
//   • "x" temizle (alan içi), yer tutucu daireler. (Çipler / sekmeler / seçim
//     kutuları ARTIK cam: GlassTouchable/GlassPressable, bkz. glassCoverageGuard.test.js)
//   • Story/Wrapped'ın görüntüye YAKALANAN tuvali (yalnız çevresindeki düğmeler cam)
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");

const CLOSE = "GlassCloseButton";
const ICON = "GlassIconButton";
const PILL = "GlassPillButton";

const COVERED = [
  // Alt sayfa / modal başlıkları
  ["components/lists/ListItemActionsSheet.js", CLOSE],
  ["components/lists/ListManageSheet.js", CLOSE],
  ["components/lists/CreateListModal.js", CLOSE],
  ["components/modals/CreateSharedListModal.js", CLOSE],
  ["components/lists/OtherListsPickerModal.js", CLOSE],
  ["components/detail/MediaNoteSheet.js", CLOSE],
  ["components/detail/WatchedDateSheet.js", CLOSE],
  ["components/modals/WatchHistorySheet.js", CLOSE],
  ["components/modals/ProfileListPickerModal.js", CLOSE],
  ["components/modals/SaveSharedListModal.js", CLOSE],
  ["components/modals/RatingSheetModal.js", CLOSE],
  ["components/modals/CommentSheetModal.js", CLOSE],
  ["components/modals/PostCommentSheetModal.js", CLOSE],
  ["components/video/TrailerModal.js", CLOSE],
  ["components/chat/GroupInfoModal.js", CLOSE],
  ["components/chat/PinnedMessagesModal.js", CLOSE],
  ["components/chat/NewConversationSheet.js", CLOSE],
  ["components/chat/TextPollComposer.js", CLOSE],
  ["components/chat/GroupAvatarPickerModal.js", CLOSE],
  ["components/profile/ProfileAvatarPickerModal.js", CLOSE],
  ["components/profile/StatsComponents.js", CLOSE],
  ["components/calendar/CalendarFilterPanel.js", CLOSE],
  ["components/hub/HubWrappedModule.js", CLOSE],
  ["components/modals/DatePickerModal.js", CLOSE],
  ["components/ListView.js", CLOSE],
  ["components/ListViewTv.js", CLOSE],
  ["screens/lists/ListsScreen.js", CLOSE],
  ["screens/lists/SharedListScreen.js", CLOSE],
  ["screens/movie/MovieCollection.js", CLOSE],
  ["screens/tabs/profile/FriendProfileScreen.js", CLOSE],
  ["screens/tabs/UpNextScreen.js", CLOSE],
  ["screens/chat/ChatScreen.js", CLOSE],
  ["screens/story/StoryShareScreen.js", CLOSE],
  ["components/import/ImportDataModal.js", CLOSE],
  ["components/import/ImportHelpModal.js", CLOSE],
  ["components/CacheManagerModal.js", ICON],
  ["components/cineswipe/CineSheet.js", CLOSE],
  ["components/cineswipe/CineLikedBasketModal.js", CLOSE],
  ["components/lists/WatchPickerSheet.js", CLOSE],
  ["components/tournament/NomineeSearchModal.js", CLOSE],
  ["components/tournament/PodiumModal.js", CLOSE],
  ["components/game/GameTopBar.js", CLOSE],
  ["components/storyShare/ProfileStoryModal.js", CLOSE],
  ["screens/tabs/SettingsScreen.js", CLOSE],
  ["screens/tabs/settings/OpenSourceLicensesScreen.js", CLOSE],
  ["screens/game/SceneGameDetailScreen.js", CLOSE],
  ["screens/tournament/TournamentScreen.js", CLOSE],
  ["screens/cineswipe/CineSwipeScreen.js", CLOSE],
  ["screens/movie/MovieOscar.js", ICON],
  ["screens/tv/TvShowsEmmy.js", ICON],
  ["screens/tabs/setting/CustomThemeScreen.js", ICON],
  ["screens/game/GameHubScreen.js", ICON],
  ["screens/game/GameLeaderboardScreen.js", ICON],
  ["components/profile/ProfileIdentityBlock.js", ICON],
  ["components/PermissionsSection.js", ICON],
  // Ekran araç çubuğu / yüzen düğmeler
  ["screens/calendar/CalendarScreen.js", ICON],
  ["components/friends/FriendProfileSections.js", ICON],
  ["screens/tabs/profile/ProfileLists.js", ICON],
  ["screens/tabs/profile/ProfileReminders.js", ICON],
  ["screens/tabs/profile/RemindersPreviewButton.js", ICON],
  ["screens/search/MovieSearch.js", ICON],
  ["screens/search/TvShowSearch.js", ICON],
  ["screens/search/ActorSearch.js", ICON],
  ["screens/chat/AIChatScreen.js", ICON],
  ["components/modals/ChatModal.js", ICON],
  ["components/modals/CreatePostModal.js", ICON],
  ["components/modals/ImageGalleryModal.js", ICON],
  ["components/storyShare/StoryHeader.js", ICON],
  ["components/wrapped/WrappedShareEditor.js", ICON],
  ["screens/wrapped/WrappedScreen.js", ICON],
  // Etiketli hap düğmeler
  ["screens/chat/CreateGroupScreen.js", PILL],
  ["screens/auth/LoginScreen.js", PILL],
];

describe("Liquid Glass düğme kapsamı", () => {
  test.each(COVERED)("%s → %s kullanıyor", (file, component) => {
    const src = read(file);
    expect(src).toMatch(new RegExp(`import\\s+${component}\\s+from`));
    expect(src).toMatch(new RegExp(`<${component}[\\s>/]`));
  });

  test("kabuk bileşenler yalnız GlassIconButton / GlassSurface üstüne kurulu", () => {
    // Cam çizen TEK yer GlassSurface; yeni düğmeler GlassView'ı doğrudan çağırmasın.
    for (const file of [
      "components/common/GlassCloseButton.js",
      "components/common/GlassPillButton.js",
      "components/common/GlassIconButton.js",
    ]) {
      expect(read(file)).not.toMatch(/expo-glass-effect|NativeGlassView/);
    }
    expect(read("components/common/GlassCloseButton.js")).toMatch(/from "\.\/GlassIconButton"/);
    expect(read("components/common/GlassPillButton.js")).toMatch(/from "\.\/GlassSurface"/);
  });

  test("cam yoluna opaklık sızdırılmıyor: pill/ikon düğmesi opaklığı yalnız cam dışında verir", () => {
    // `pressedFallback` / `disabledFallback` yalnız `!glass` koşuluyla uygulanır.
    expect(read("components/common/GlassPillButton.js")).toMatch(/!glass && disabled && styles\.disabledFallback/);
    expect(read("components/common/GlassPillButton.js")).toMatch(/!glass && !disabled && pressed && styles\.pressedFallback/);
    expect(read("components/common/GlassIconButton.js")).toMatch(/!glass && pressed && styles\.pressedFallback/);
  });
});
