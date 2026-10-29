// Özel afiş ve arka plan kapsam bekçisi (kaynak taraması).
//
// Seçim ÇİZİM anında uygulanır (context/PosterChoicesContext): film/dizi afişi ya da
// arka planı çizen bir yer çözücüden geçmezse kullanıcının seçtiği görsel orada
// görünmez, varsayılan TMDB görseli çıkar. Kurallar:
//
//   1) Her <PosterImage> `mediaId` geçer (bileşen seçimi kendisi çözer).
//   2) Afiş adresini `getTmdbUrl(..., "poster", ...)` ile DOĞRUDAN kuran her dosya ya
//      çözücüyü kullanır (usePosterUri / usePosterResolver) ya da aşağıda gerekçesiyle
//      HARİÇ listesindedir. Yeni dosya = karar: ya çözücü ya gerekçe.
//   3) Arka plan için aynısı: `getTmdbUrl(..., "backdrop", ...)` → useBackdropUri /
//      useBackdropResolver ya da EXCLUDED_BACKDROP.
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIRS = ["components", "screens", "context", "hooks"];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".js")) out.push(full);
  }
  return out;
}

const FILES = DIRS.flatMap((d) => walk(path.join(ROOT, d))).map((file) => ({
  rel: path.relative(ROOT, file).split(path.sep).join("/"),
  src: fs.readFileSync(file, "utf8"),
}));

// <PosterImage> çağrısı mediaId'siz kalabilecek yerler (dosya → en çok kaç tane).
const POSTER_IMAGE_WITHOUT_ID = {
  // Sezon kartı SEZON afişi çizer; özel afiş yapım (film/dizi) düzeyinde.
  "screens/lists/ListsScreen.js": 1,
};

// Afişi doğrudan kuran ama BİLEREK çözücüden geçmeyen dosyalar.
const EXCLUDED = {
  // Sohbet / paylaşılan mesaj: gönderilen anlık görüntü — karşı taraf ne gönderildiyse onu görür.
  "components/chat/MessageReplyPreview.js": "sohbet anlık görüntüsü",
  "components/chat/PollMessage.js": "sohbet anlık görüntüsü",
  "components/chat/PosterStrip.js": "sohbet anlık görüntüsü",
  "components/chat/SharedAiMessage.js": "sohbet anlık görüntüsü",
  "components/chat/SharedListSheet.js": "başkasının paylaştığı liste",
  "components/chat/SharedMediaCollection.js": "sohbet anlık görüntüsü",
  "components/chat/SharedMediaMessage.js": "sohbet anlık görüntüsü",
  "components/chat/SharedTournamentMessage.js": "sohbet anlık görüntüsü",
  "components/modals/ChatModal.js": "sohbete gönderilecek kart",
  "screens/chat/ChatScreen.js": "sohbet anlık görüntüsü",
  "components/modals/SaveSharedListModal.js": "başkasının paylaştığı liste",
  // Gönderi / yorum: topluluk içeriği, yazarın paylaştığı afiş.
  "components/modals/CommentSheetModal.js": "topluluk içeriği",
  "components/modals/CreatePostModal.js": "topluluk içeriği",
  "components/modals/createPost/DraftCard.js": "topluluk içeriği",
  "screens/tabs/MyPostsScreen.js": "topluluk içeriği",
  // Turnuva: herkesin AYNI afişi gördüğü ortak yarışma.
  "components/hub/TournamentWidget.js": "ortak turnuva",
  "components/tournament/BracketTree.js": "ortak turnuva",
  "components/tournament/MatchCard.js": "ortak turnuva",
  "components/tournament/NomineeSearchModal.js": "ortak turnuva",
  "components/tournament/PodiumModal.js": "ortak turnuva",
  "screens/tournament/TournamentScreen.js": "ortak turnuva",
  // Seelogd Top 100: topluluk sıralaması; turnuva gibi herkes aynı afişi görür (liste/sohbete de bu afiş gider).
  "components/hub/Top100Widget.js": "ortak Top 100",
  "components/top100/Top100CountSheet.js": "ortak Top 100",
  "components/top100/Top100VoteSheet.js": "ortak Top 100",
  "screens/fun/Top100Screen.js": "ortak Top 100",
  // CineMatch yanıt kartları: yanıtta kayıtlı öneri anlık görüntüsü.
  "components/AICineCards.js": "AI yanıt kartı",
  "components/ai/AIHistory.js": "AI yanıt kartı",
  "components/ai/aiCardKit.js": "AI yanıt kartı",
  // Paylaşım kartı düzenleyicileri: kart öğeleri yapım kimliği taşımıyor (sonraki faz).
  "components/storyShare/ProfileStoryModal.js": "paylaşım kartı (sonraki faz)",
  "screens/story/StoryShareScreen.js": "paylaşım kartı (sonraki faz)",
  "screens/tabs/ShareContentScreen.js": "paylaşım kartı (sonraki faz)",
  "components/hub/HubWrappedModule.js": "Wrapped (sonraki faz)",
  "components/wrapped/WrappedShareCard.js": "Wrapped (sonraki faz)",
  "components/wrapped/WrappedSlides.js": "Wrapped (sonraki faz)",
  // Sezon afişi: özel afiş yapım düzeyinde.
  "screens/tabs/profile/TvStatisticsScreen.js": "sezon afişi",
  "screens/tv/SeasonDetails.js": "sezon afişi",
  "screens/tv/SeasonItem.js": "sezon afişi",
  // Diğer
  "components/detail/DetailContentSections.js": "platform/kanal LOGOSU (\"poster\" boyutuyla), yapım afişi değil",
  "components/modals/ImageGalleryModal.js": "galeri TÜM afişleri listeler (seçici burada)",
  "components/video/TrailerModal.js": "fragman sayfası başlığı (sonraki faz)",
  "screens/onboarding/OnboardingShowcases.js": "hesap öncesi vitrin",
  "screens/onboarding/useOnboardingData.js": "hesap öncesi vitrin",
};

const DIRECT_POSTER = /getTmdbUrl\([^)]*["']poster["']/;
const USES_RESOLVER = /\busePosterUri\b|\busePosterResolver\b/;

// Arka planı doğrudan kuran ama BİLEREK çözücüden geçmeyen dosyalar.
const EXCLUDED_BACKDROP = {
  "components/AICineCards.js": "AI yanıt kartı",
  "components/modals/ImageGalleryModal.js": "galeri TÜM arka planları listeler (seçici burada)",
  "components/wrapped/WrappedShareCard.js": "Wrapped (sonraki faz)",
  "screens/story/StoryShareScreen.js": "paylaşım kartı (sonraki faz)",
  "screens/tv/EpisodeDetails.js": "bölüm görseli (still), yapım arka planı değil",
};
const DIRECT_BACKDROP = /getTmdbUrl\([^)]*["']backdrop["']/;
const USES_BACKDROP_RESOLVER = /\buseBackdropUri\b|\buseBackdropResolver\b/;

describe("özel afiş kapsamı", () => {
  test("her <PosterImage> mediaId geçer", () => {
    const missing = {};
    for (const { rel, src } of FILES) {
      if (rel === "components/PosterImage.js") continue;
      const blocks = src.match(/<PosterImage\b[\s\S]*?\/>/g) || [];
      const count = blocks.filter((b) => !/\bmediaId=/.test(b)).length;
      if (count > (POSTER_IMAGE_WITHOUT_ID[rel] || 0)) missing[rel] = count;
    }
    expect(missing).toEqual({});
  });

  test("afişi doğrudan kuran dosya ya çözücüyü kullanır ya gerekçeyle hariçtir", () => {
    const undecided = FILES.filter(
      ({ rel, src }) =>
        DIRECT_POSTER.test(src) && !USES_RESOLVER.test(src) && !EXCLUDED[rel] && rel !== "hooks/usePosterUri.js",
    ).map(({ rel }) => rel);
    expect(undecided).toEqual([]);
  });

  test("hariç listesi bayatlamaz (dosya hâlâ afiş kuruyor ve çözücüyü kullanmıyor)", () => {
    const stale = Object.keys(EXCLUDED).filter((rel) => {
      const file = FILES.find((f) => f.rel === rel);
      return !file || !DIRECT_POSTER.test(file.src) || USES_RESOLVER.test(file.src);
    });
    expect(stale).toEqual([]);
  });

  test("arka planı doğrudan kuran dosya ya çözücüyü kullanır ya gerekçeyle hariçtir", () => {
    const undecided = FILES.filter(
      ({ rel, src }) =>
        DIRECT_BACKDROP.test(src) &&
        !USES_BACKDROP_RESOLVER.test(src) &&
        !EXCLUDED_BACKDROP[rel] &&
        rel !== "hooks/useBackdropUri.js",
    ).map(({ rel }) => rel);
    expect(undecided).toEqual([]);
    const stale = Object.keys(EXCLUDED_BACKDROP).filter((rel) => {
      const file = FILES.find((f) => f.rel === rel);
      return !file || !DIRECT_BACKDROP.test(file.src) || USES_BACKDROP_RESOLVER.test(file.src);
    });
    expect(stale).toEqual([]);
    // Doğrudan getTmdbUrl'siz arka plan yüzeyleri de bağlı kalsın.
    const required = [
      "screens/movie/MovieDetail.js",
      "screens/tv/TvShowsDetails.js",
      "screens/tv/TvGraphDetailScreen.js",
      "screens/search/MovieSearch.js",
      "screens/search/TvShowSearch.js",
      "components/modals/MediaQuickActionsSheet.js",
    ];
    const missing = required.filter(
      (rel) => !USES_BACKDROP_RESOLVER.test(FILES.find((f) => f.rel === rel)?.src || ""),
    );
    expect(missing).toEqual([]);
  });

  test("ana yüzeyler çözücüye bağlı", () => {
    const required = [
      "screens/movie/MovieDetail.js",
      "screens/tv/TvShowsDetails.js",
      "components/lists/ListCovers.js",
      "components/favorites/FavoriteArt.js",
      "screens/tabs/profile/FriendProfileScreen.js",
      "screens/tabs/profile/MyActivityScreen.js",
      "screens/tabs/profile/ProfileReminders.js",
      "context/CalendarContext.js",
      "screens/search/MovieSearch.js",
      "screens/search/TvShowSearch.js",
    ];
    const missing = required.filter((rel) => !USES_RESOLVER.test(FILES.find((f) => f.rel === rel)?.src || ""));
    expect(missing).toEqual([]);
    // Arkadaş profili sahibinin seçimini ÜSTE koyar.
    const friend = FILES.find((f) => f.rel === "screens/tabs/profile/FriendProfileScreen.js").src;
    expect(friend).toMatch(/<PosterChoicesScope choices=\{friendPosterChoices\}>/);
    // Detay galerileri seçiciyi açar.
    for (const rel of ["screens/movie/MovieDetail.js", "screens/tv/TvShowsDetails.js"]) {
      expect(FILES.find((f) => f.rel === rel).src).toMatch(/<ImageGalleryModal[\s\S]*?posterPicker[\s\S]*?\/>/);
    }
  });
});
