// website/mock-i18n.js üretir: uygulama maketlerindeki metinlerin 5 dilli sözlüğü.
// Çalıştır (proje kökünden): node --no-warnings scripts/site-mock-i18n/gen.mjs
// Uygulama metinleri değişince ya da makete yeni metin eklenince yeniden üret (SPEC aşağıda).
// Uygulamanın ESM kopya dosyaları uzantısız içe aktarma kullandığı için loader.mjs gerekir.
// Kaynak öncelikle UYGULAMANIN KENDİ çevirileri (translations/*.json, utils/aiCopy,
// utils/homeSectionCopy, screens/shared/discoverFiltersCopy) — maketler uygulamayla
// birebir aynı dili konuşsun. Uygulamada olmayan metinler T(...) ile elle yazıldı.
import { register } from "node:module";
import fs from "node:fs";
register("./loader.mjs", import.meta.url);
import { fileURLToPath } from "node:url";

const base = new URL("../../", import.meta.url).href; // proje kökü (file:///…/)
const root = fileURLToPath(base).split("\\").join("/");
const LANGS = ["en", "tr", "es", "pt", "de"];

const json = {};
LANGS.forEach((l) => (json[l] = JSON.parse(fs.readFileSync(root + `translations/${l}.json`, "utf8"))));
const { AI_COPY } = await import(base + "utils/aiCopy.js");
const { HOME_SECTIONS } = await import(base + "utils/homeSectionCopy.js");
const { DISCOVER_FILTERS_COPY } = await import(base + "screens/shared/discoverFiltersCopy.js");

const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
const clean = (s) => String(s).replace(/\{\{(\w+)\}\}/g, "{$1}");

const APP = (p) => (l) => get(json[l], p);
const AI = (p) => (l) => get(AI_COPY[l], p);
const DF = (p) => (l) => get(DISCOVER_FILTERS_COPY[l], p);
const HS = (id, sub) => (l) => get(HOME_SECTIONS[id].subtitle, sub ? `${sub}.${l}` : l);
const T = (en, tr, es, pt, de) => (l) => ({ en, tr, es, pt, de }[l]);
const SAME = (v) => () => v;

// Genel-özel anahtar → kaynak
const SPEC = {
  // ── sekmeler / anahtar ────────────────────────────────────────────────
  mTabMovies: APP("moviesAndTv"), mTabFun: APP("funTab"), mTabLibrary: APP("library"), mTabSettings: APP("settings"), mTabProfile: APP("profile"),
  mLibSub: T("Up next, lists, reminders and notes", "Sıradaki, listeler, hatırlatmalar ve notlar", "Lo siguiente, listas, recordatorios y notas", "A seguir, listas, lembretes e notas", "Als Nächstes, Listen, Erinnerungen und Notizen"),
  mMovies: APP("movies"), mTv: APP("tvShows"), mSearch: APP("search"),
  mHint: T("Tap the tabs — this preview is interactive", "Sekmelere dokun — bu önizleme etkileşimli", "Toca las pestañas: esta vista previa es interactiva", "Toque nas abas: esta prévia é interativa", "Tippe auf die Tabs – diese Vorschau ist interaktiv"),
  mClose: T("Close", "Kapat", "Cerrar", "Fechar", "Schließen"),
  mBack: APP("autoI18n.geri"),

  // ── Film & Dizi ana ekranı ───────────────────────────────────────────
  mTrendWeek: APP("movieScreens.trendWeek"), mTrendDay: APP("movieScreens.trendDay"),
  mTrendSubMovie: HS("trends", "movie"), mTrendSubTv: HS("trends", "tv"),
  mVoted: APP("movieScreens.voted"), mPopularMovie: APP("movieScreens.popular"), mBestsSub: HS("bests"),
  mTheaters: APP("movieScreens.theaters"), mTheatersSub: HS("nowPlaying"),
  mOngoing: APP("autoI18n.devam_eden_dizilerim"), mOngoingSub: HS("ongoing"),
  mNextEp: APP("autoI18n.up_next_ray_bolum"), mSeasonEp: APP("autoI18n.season_episode_short"),
  mAiring: APP("tvShowScreens.airingToday"), mPopularTv: APP("tvShowScreens.popular"),
  mWatched: APP("watched"), mSeasonWord: APP("season"),

  // ── Hub ───────────────────────────────────────────────────────────────
  mHi: APP("autoI18n.merhaba"), mHubSub: APP("autoI18n.hub_alt_baslik"), mSocial: APP("autoI18n.sosyal"),
  mPosts: APP("autoI18n.hub_paylasimlar"), mPostsSub: APP("autoI18n.hub_feed_aciklama"),
  mWhatShare: APP("autoI18n.ne_paylasmak_istersin"),
  mReview: APP("autoI18n.inceleme"), mList: APP("autoI18n.liste_2"), mChat: APP("autoI18n.sohbet"), mPoll: APP("autoI18n.anket"),
  mCineTitle: APP("autoI18n.hub_cine_title"), mCineSub: APP("autoI18n.hub_cine_subtitle"),
  mCineSolo: APP("autoI18n.hub_cine_solo"), mCineDuo: APP("autoI18n.hub_cine_duo"), mNew: APP("autoI18n.hub_cine_new"),
  mTournament: APP("autoI18n.tournament_section"), mTourMonthly: APP("autoI18n.tournament_monthly"),
  mTourNext: APP("autoI18n.tournament_next_in"), mTourParticipants: APP("autoI18n.tournament_widget_voters"),
  mTourTheme: T("Animated Series", "Animasyon Dizi", "Series animadas", "Séries de animação", "Animationsserien"),
  mCdDay: T("DAY", "GÜN", "DÍA", "DIA", "TAG"), mCdHr: T("HR", "SAAT", "H", "H", "STD"),
  mCdMin: T("MIN", "DK", "MIN", "MIN", "MIN"), mCdSec: T("SEC", "SN", "S", "S", "SEK"),
  mGames: APP("autoI18n.oyunlar"), mGameHub: APP("autoI18n.oyun_merkezi"),

  // ── Ayarlar ───────────────────────────────────────────────────────────
  mPremiumTitle: T("Unlock Boundless Cinema", "Sinemanın Sınırlarını Kaldır", "Desbloquea el cine sin límites", "Desbloqueie o cinema sem limites", "Schalte grenzenloses Kino frei"),
  mPremiumCta: T("View Plans", "Planları Gör", "Ver planes", "Ver planos", "Pläne ansehen"),
  mGrpAccount: APP("autoI18n.ayarlar_grup_hesap"), mGrpAppearance: APP("appearance"),
  mGrpLang: APP("autoI18n.ayarlar_grup_dil_icerik"), mGrpNotif: APP("notifications"),
  mGrpData: APP("autoI18n.ayarlar_grup_veri_depolama"), mAbout: APP("about"),
  mRowConn: APP("autoI18n.hesap_baglantilari"), mRowConnSub: APP("autoI18n.hesap_baglantilari_aciklama"),
  mRowPrivacy: APP("autoI18n.gizlilik"), mRowPersonal: APP("personalization"),
  mRowPoster: APP("autoI18n.poster_gorunumu"), mRowWidgets: APP("autoI18n.widget_settings_title"),
  mRowHaptics: APP("haptics"), mRowSubs: APP("autoI18n.platform_uyeliklerim"),
  mRowAdult: APP("adultContent"), mRowReminders: APP("reminderNotificationGroup"),
  mRowSocialNotif: APP("socialNotificationGroup"), mRowDownload: APP("downloadData"),
  mRowPerms: APP("autoI18n.izinlerVeVeriler"),
  mTheme: APP("theme"), mLanguage: APP("language"),
  mFamDefault: APP("themeFamilyDefault"), mFamBlue: APP("themeFamilyBlue"), mFamGreen: APP("themeFamilyGreen"),
  mToneLight: APP("themeToneLight"), mToneMid: APP("themeToneMid"), mToneDark: APP("themeToneDark"),

  // ── Profil ────────────────────────────────────────────────────────────
  mEdit: APP("autoI18n.duzenle"), mShare: APP("autoI18n.paylas"),
  mFriendSearch: APP("autoI18n.ara_2"), mFriends: APP("autoI18n.arkadaslar"),
  mMessages: APP("autoI18n.mesajlar"), mRequests: APP("autoI18n.istekler"),
  mStatsUpper: APP("autoI18n.istatistikler_upper"), mMoviesWatched: APP("profileScreen.movieWatched"),
  mSeriesCount: APP("profileScreen.tvShowCount"), mEpisodeCount: APP("profileScreen.tvShowEpisodetotalCount"),
  mTotalDur: APP("profileScreen.totalDuration"),
  mLists: APP("profileScreen.ProfileLists.lists"), mWatchedMovies: APP("profileScreen.ProfileLists.watchedMovies"),
  mWatchedTv: APP("profileScreen.ProfileLists.watchedTvSeries"), mFavorites: APP("profileScreen.ProfileLists.favorite"),
  mWatchlist: APP("profileScreen.ProfileLists.watchList"),
  mNotes: APP("profileScreen.Notes.notes"), mNotesSub: APP("autoI18n.notlar_ve_yapilacaklar"),
  mReminders: APP("autoI18n.hatirlatmalar"), mActivity: APP("autoI18n.etkinliklerim"),
  mToday: APP("autoI18n.bugun"), mDays: APP("autoI18n.gun"),
  mFilmTag: APP("autoI18n.film_upper"), mTvTag: APP("autoI18n.dizi_upper"),

  // ── CineMatch (AI) ────────────────────────────────────────────────────
  mVibeTitle: AI("vibe.title"), mVibeSub: AI("vibe.subtitle"),
  mMoodLabel: AI("vibe.moodLabel"), mCozy: AI("vibe.mood.cozy"), mThrilling: AI("vibe.mood.thrilling"),
  mFunny: AI("vibe.mood.funny"), mEmotional: AI("vibe.mood.emotional"),
  mMindbending: AI("vibe.mood.mindbending"), mAdventurous: AI("vibe.mood.adventurous"),
  mLengthLabel: AI("vibe.lengthLabel"), mShort: AI("vibe.length.short"), mMedium: AI("vibe.length.medium"), mLong: AI("vibe.length.long"),
  mCompanyLabel: AI("vibe.companyLabel"), mSolo: AI("vibe.company.solo"), mPartner: AI("vibe.company.partner"),
  mFriendsCo: AI("vibe.company.friends"), mFamily: AI("vibe.company.family"),
  mVibeCta: AI("vibe.cta"), mPickOne: AI("vibe.pickOne"), mThinking: AI("thinking.0"),
  mActWatchlist: AI("actions.watchlist"), mActDetail: AI("actions.detail"),

  // ── Keşfet (Ne izlesem?) ──────────────────────────────────────────────
  mDfTitle: DF("ui.title"), mDfSurprise: DF("ui.surprise"), mDfFilters: DF("ui.filters"),
  mDfGenre: DF("ui.genre"), mDfEra: DF("ui.era"), mDfRating: DF("ui.rating"), mDfRuntime: DF("ui.runtime"),
  mDfOnMyServices: DF("ui.onMyPlatforms"), mDfApply: DF("ui.apply"), mDfQuick: DF("ui.quickTitle"),
  mDfThriller: DF("genres.53"), mGenAdventure: DF("genres.12"), mGenMystery: DF("genres.9648"), mDfScifi: DF("genres.878"), mDfDrama: DF("genres.18"), mDfEra2020: DF("eras.d2020"),
  mDfRuntimeMedium: DF("runtimes.movie.medium"), mDfRatingChip: DF("ui.ratingChip"), mDfFiltersCount: DF("ui.filtersCount"), mDfPresetFamily: DF("presets.tonight.1"),
  mDfPresetTonight: DF("presets.tonight.0"), mDfPresetTop: DF("presets.topRated.0"), mDfPresetFresh: DF("presets.fresh.0"), mDfPresetQuick: DF("presets.quick.0"), mDfPresetClassics: DF("presets.classics.0"), mDfPresetFamily2: DF("presets.family.0"),

  // ── İstatistik ────────────────────────────────────────────────────────
  mStatsTitle: APP("profileScreen.movieStatistics"), mStatsSub: APP("autoI18n.film_istatistikleri"),
  mRhythm: APP("autoI18n.izleme_ritmi"), mDaily: APP("autoI18n.gunluk"), mMonthly: APP("autoI18n.aylik"),
  mYearly: APP("autoI18n.yillik"), mAllDates: APP("autoI18n.tum_tarihler"), mAllGenres: APP("autoI18n.tum_turler"),
  mStatsSubtitle: T("A detailed summary of your watching journey", "İzleme yolculuğunun ayrıntılı özeti", "Un resumen detallado de tu recorrido", "Um resumo detalhado da sua jornada", "Eine detaillierte Übersicht deiner Seh-Reise"),
  mFilmArchive: T("MOVIE ARCHIVE", "FİLM ARŞİVİ", "ARCHIVO DE PELÍCULAS", "ARQUIVO DE FILMES", "FILMARCHIV"),
  mMin: T("min", "dk", "min", "min", "Min."),

  // ── Wrapped / hikâye kartı ────────────────────────────────────────────
  mStoryMovies: APP("autoI18n.profil_story_film"), mStoryEpisodes: APP("autoI18n.profil_story_bolum"),
  mStoryStreak: APP("autoI18n.profil_story_seri"), mStoryGenres: APP("autoI18n.profil_story_turler"),
  mWrapped: APP("autoI18n.wrapped_section"),
  mSaveStory: T("Save image", "Görseli kaydet", "Guardar imagen", "Salvar imagem", "Bild speichern"),

  // ── Sohbet (grup) ─────────────────────────────────────────────────────
  mGroupName: T("Movie night", "Film gecesi", "Noche de cine", "Noite de cinema", "Filmabend"),
  mMembers: T("4 members", "4 üye", "4 miembros", "4 membros", "4 Mitglieder"),
  mMsg1: T("Friday movie night?", "Cuma film gecesi?", "¿Noche de cine el viernes?", "Noite de cinema na sexta?", "Filmabend am Freitag?"),
  mMsg2: T("I'm in! Poll?", "Varım! Anket yapalım mı?", "¡Me apunto! ¿Hacemos una encuesta?", "Topo! Fazemos uma enquete?", "Bin dabei! Machen wir eine Umfrage?"),
  mMsg3: T("Dune, finally 😄", "Dune, sonunda 😄", "¡Dune, por fin! 😄", "Dune, finalmente 😄", "Endlich Dune 😄"),
  mPinned: APP("autoI18n.sabitlenmis_mesajlar"),
  mPinnedText: T("Friday 8:30 PM · Dune", "Cuma 20.30 · Dune", "Viernes 20:30 · Dune", "Sexta 20:30 · Dune", "Freitag 20:30 · Dune"),
  mMessage: T("Message", "Mesaj yaz", "Mensaje", "Mensagem", "Nachricht"),
  mPollVotes: T("3 votes", "3 oy", "3 votos", "3 votos", "3 Stimmen"),

  // ── Oyun ──────────────────────────────────────────────────────────────
  mScore: APP("autoI18n.skor"), mLeaderboard: APP("autoI18n.liderlik_tablosu"),
  mRound: T("Round 3/10", "Tur 3/10", "Ronda 3/10", "Rodada 3/10", "Runde 3/10"),
  mStreak: APP("autoI18n.profil_story_ogr_seri"),

  // ── Ayarlar / kişiselleştirme ekranı ─────────────────────────────────
  mThemeStudio: T("Theme Studio", "Tema Stüdyosu", "Estudio de temas", "Estúdio de temas", "Theme-Studio"),
  mFontsAll: T("All fonts", "Tüm yazı tipleri", "Todas las fuentes", "Todas as fontes", "Alle Schriften"),
  mAppIcon: T("App icon", "Uygulama simgesi", "Icono de la app", "Ícone do app", "App-Symbol"),
};

const out = {};
LANGS.forEach((l) => {
  out[l] = {};
  Object.keys(SPEC).forEach((key) => {
    const v = SPEC[key](l);
    if (v == null) {
      console.error(`EKSİK: ${key} (${l})`);
      return;
    }
    out[l][key] = clean(v);
  });
});

// Dil kodu → kısa etiket olarak Türkçe/İngilizce alanında tüm anahtarlar var mı?
const enKeys = Object.keys(out.en);
LANGS.forEach((l) => {
  const miss = enKeys.filter((k) => !(k in out[l]));
  if (miss.length) console.error(`${l}: eksik ${miss.join(", ")}`);
});

const banner = `/* mock-i18n.js — UYGULAMA MAKETLERİNİN metinleri (5 dil). başlangıçta bir betikle ÜRETİLDİ:
 * kaynak, uygulamanın kendi çevirileridir (translations/*.json, utils/aiCopy.js,
 * utils/homeSectionCopy.js, screens/shared/discoverFiltersCopy.js); böylece maketlerdeki
 * yazılar uygulamadakiyle birebir aynıdır. Uygulamada olmayan metinler elle yazıldı.
 * Artık elle de düzenlenebilir (yer tutucular {n} biçimindedir). Eksik anahtar,
 * home-i18n.js'teki (site metni) aynı anahtara, o da yoksa İngilizceye düşer. */
`;
fs.writeFileSync(
  root + "website/mock-i18n.js",
  banner + "window.MOCK_I18N = " + JSON.stringify(out, null, 1) + ";\n",
  "utf8",
);
console.log("yazıldı:", enKeys.length, "anahtar × 5 dil");
