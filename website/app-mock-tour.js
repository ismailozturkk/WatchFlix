/* app-mock-tour.js — "İçeride neler var" turunun ek ekranları (app-mock.js'e kayıt olur).
 * Bunlar uygulamada sekme değil, sekmelerden açılan tam ekranlardır (geri düğmeli başlık).
 * "ai" ekranı motorun kendisinde: Film&Dizi arka planında CineMatch paneli açık gelir. */
(function (root) {
  "use strict";
  var AM = root.AppMock;
  if (!AM) return;
  var H = AM.helpers, t = H.t, ic = H.ic, img = H.img, nav = H.nav, rated = H.rated, avatar = H.avatar, MOV = H.MOV, TVS = H.TVS;
  var S = AM.screens;
  var LOCALES = { tr: "tr-TR", en: "en-GB", es: "es-ES", pt: "pt-BR", de: "de-DE" };

  AM.addIcons({
    gamepad: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="16" cy="11.5" r="1" fill="currentColor"/><circle cx="18" cy="13.8" r="1" fill="currentColor"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    dice: '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="9" r="1" fill="currentColor"/><circle cx="9" cy="15" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/>',
    fire: '<path d="M12 3c.6 3.3 4.6 5.1 4.6 9.6A4.6 4.6 0 0 1 12 17.2a4.6 4.6 0 0 1-4.6-4.6c0-1.9.8-3.1 1.9-4.1.2 1.2.9 1.8 1.7 2C11 10 10.5 6.4 12 3z" fill="currentColor" stroke="none"/>',
    font: '<path d="M5 19L10 5l5 14M7 14h6M17 9v10M17 12.5c.8-1.2 2.2-1.6 3-1"/>',
    key: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M8 15l4-7 4 7M9.5 12.5h5"/>'
  });

  function date(y, m, d, opts) {
    return new Intl.DateTimeFormat(LOCALES[AM.lang()] || "en-GB", opts || { day: "numeric", month: "long", year: "numeric" }).format(new Date(y, m, d));
  }
  function pill(icon, txt, cls) { return '<span class="am-pill' + (cls ? " " + cls : "") + '">' + (icon ? ic(icon, 12) : "") + txt + "</span>"; }
  var DOTS = '<span class="am-roundbtn sm" aria-hidden="true">' + ic("dots", 16) + "</span>";

  /* ═══ Dizi takibi ═════════════════════════════════════════════════════ */
  S.series = function () {
    var eps = [
      ["Chapter One: The Hellfire Club", 78, true],
      ["Chapter Two: Vecna's Curse", 77, true],
      ["Chapter Three: The Monster and the Superhero", 63, true],
      ["Chapter Four: Dear Billy", 78, false],
      ["Chapter Five: The Nina Project", 75, false]
    ];
    return '<div class="am-scroll am-pushed">' + nav("Stranger Things", DOTS) +
      '<div class="am-show"><div class="am-show-p">' + img(TVS.st, 185) + '</div><div class="am-show-i"><b>Stranger Things</b>' +
      '<div class="am-chips">' + pill(null, '<i class="am-star">★</i> 8.6') + pill(null, "2016") + "</div>" +
      '<div class="am-prog"><span>26/34</span><div class="am-prog-b"><i style="width:76%"></i></div></div>' +
      '<div class="am-show-btns"><span class="am-btn ac">' + ic("check", 13) + t("mWatched") + '</span><span class="am-btn icon">' + ic("heart", 14) + '</span><span class="am-btn icon">' + ic("bell", 14) + "</span></div></div></div>" +
      '<div class="am-chips seasons">' + [1, 2, 3, 4].map(function (n) { return '<span class="am-chip' + (n === 4 ? " on" : "") + '">' + t("mSeasonWord") + " " + n + "</span>"; }).join("") + "</div>" +
      eps.map(function (e, i) {
        return '<div class="am-ep' + (e[2] ? " done" : i === 3 ? " next" : "") + '"><span class="am-ep-n">' + (i + 1) + '</span><div class="am-ep-t"><b>' + e[0] + "</b><small>" + (i === 3 ? t("mNextEp") + " · " : "") + t("mSeasonEp", { season: 4, episode: i + 1 }) + " · " + e[1] + " " + t("mMin") + '</small></div><span class="am-ep-ck">' + (e[2] ? ic("check", 13) : "") + "</span></div>";
      }).join("") + "</div>";
  };

  /* ═══ Keşfet (Ne izlesem?) ════════════════════════════════════════════ */
  S.discover = function () {
    var presets = [t("mDfPresetTonight"), t("mDfPresetTop"), t("mDfPresetFresh"), t("mDfPresetQuick"), t("mDfPresetClassics"), t("mDfPresetFamily2")];
    var grid = [[MOV.interstellar, "8.5"], [MOV.parasite, "8.5"], [MOV.dark, "8.5"], [TVS.bb, "8.9"], [MOV.eternal, "8.3"], [MOV.dune, "7.8"], [TVS.tlou, "8.6"], [MOV.ww84, "6.4"], [TVS.st, "8.6"]];
    return '<div class="am-scroll am-pushed">' + nav(t("mDfTitle"), "") +
      '<div class="am-df-top"><span class="am-chip on">' + ic("sliders", 13) + t("mDfFiltersCount", { n: 4 }) + '</span><span class="am-chip">' + ic("dice", 13) + t("mDfSurprise") + "</span></div>" +
      '<div class="am-lab slim">' + t("mDfQuick") + "</div>" +
      '<div class="am-hs am-presets">' + presets.map(function (p, i) { return '<span class="am-chip' + (i === 0 ? " on" : "") + '">' + p + "</span>"; }).join("") + "</div>" +
      '<div class="am-chips am-active">' +
      '<span class="am-chip on">' + t("mDfThriller") + ic("close", 11) + "</span>" +
      '<span class="am-chip on">' + t("mDfRatingChip", { n: "7.5" }) + ic("close", 11) + "</span>" +
      '<span class="am-chip on">' + t("mDfRuntimeMedium") + ic("close", 11) + "</span>" +
      '<span class="am-chip on">' + t("mDfOnMyServices") + ic("close", 11) + "</span></div>" +
      '<div class="am-grid3">' + grid.map(function (g) { return '<div class="am-pc wide">' + img(g[0], 185) + rated(g[1]) + "</div>"; }).join("") + "</div></div>";
  };

  /* ═══ İstatistik (Film İstatistikleri) ════════════════════════════════ */
  S.stats = function () {
    function entry(d, mins, tags, id) {
      return '<div class="am-tl"><i class="am-tl-dot"></i><div class="am-tl-h">' + pill("calendar", date(d[0], d[1], d[2])) + pill("clock", mins + " " + t("mMin"), "warn") + '</div><div class="am-tl-tags">' + tags.map(function (g) { return '<span class="am-chip">' + g + "</span>"; }).join("") + '</div><div class="am-tl-p">' + img(id, 185) + "</div></div>";
    }
    return '<div class="am-scroll am-stat-top">' +
      '<div class="am-nav stats"><span class="am-roundbtn sm">' + ic("back", 16) + '</span><div class="am-stat-hd"><small>' + t("mFilmArchive") + "</small><b>" + t("mStatsTitle") + '</b></div><span class="am-teal-tile">' + ic("film", 18) + "</span></div>" +
      '<div class="am-tealcard"><span class="am-weeks">' + ic("shield", 12) + "5</span>" +
      '<div class="am-big-n">439</div><div class="am-big-l">' + t("mWatchedMovies") + "</div>" +
      '<div class="am-rhythm"><div class="am-rh-h"><b>' + ic("bars", 14) + t("mRhythm") + "</b><small>157 " + t("mMin") + "</small></div>" +
      '<div class="am-seg"><span class="on">' + t("mDaily") + "</span><span>" + t("mMonthly") + "</span><span>" + t("mYearly") + "</span></div>" +
      '<div class="am-bars">' + [18, 34, 0, 52, 26, 0, 100].map(function (h) { return '<i style="--h:' + (h || 4) + '%"' + (h === 100 ? ' class="hi"' : "") + "></i>"; }).join("") + "</div></div></div>" +
      '<div class="am-filters"><span class="am-roundbtn sm">' + ic("search", 14) + "</span>" + '<span class="am-chip">' + ic("calendar", 13) + t("mAllDates") + '</span><span class="am-chip">' + ic("pin", 13) + t("mAllGenres") + "</span></div>" +
      '<div class="am-timeline">' + entry([2026, 6, 2], 157, [t("mDfScifi"), t("mGenAdventure")], MOV.interstellar) + entry([2026, 4, 26], 132, [t("mDfThriller"), t("mGenMystery")], MOV.parasite) + "</div>" +
      "</div>";
  };

  /* ═══ Grup sohbeti ════════════════════════════════════════════════════ */
  S.chat = function () {
    return '<div class="am-chat">' +
      '<div class="am-chat-h"><span class="am-roundbtn sm">' + ic("back", 16) + '</span><span class="am-faces2">' + avatar(1, 28, "M") + avatar(2, 28, "L") + avatar(3, 28, "S") + "</span>" +
      '<div class="am-chat-t"><b>' + t("mGroupName") + "</b><small>" + t("mMembers") + "</small></div>" + DOTS + "</div>" +
      '<div class="am-pinbar">' + ic("pin", 13) + '<div><small>' + t("mPinned") + "</small><b>" + t("mPinnedText") + "</b></div></div>" +
      '<div class="am-msgs">' +
      '<div class="am-msg">' + avatar(1, 24, "M") + '<span class="am-bub">' + t("mMsg1") + "</span></div>" +
      '<div class="am-msg me"><span class="am-bub me">' + t("mMsg2") + "</span></div>" +
      '<div class="am-pollmsg"><div class="am-poll-h">' + ic("bars", 14) + "<b>" + t("vizPoll") + "</b></div>" +
      '<div class="am-opt on" style="--w:67%"><span><i>' + ic("check", 11) + "</i>Dune<em>67%</em></span></div>" +
      '<div class="am-opt" style="--w:33%"><span><i></i>Arrival<em>33%</em></span></div>' +
      '<small>' + t("mPollVotes") + "</small></div>" +
      '<div class="am-msg">' + avatar(2, 24, "L") + '<span class="am-bub">' + t("mMsg3") + "</span></div>" +
      "</div>" +
      '<div class="am-composer"><span>' + t("mMessage") + '</span><i>' + ic("send", 15) + "</i></div></div>";
  };

  /* ═══ Sahne tahmin oyunu ══════════════════════════════════════════════ */
  S.game = function () {
    var opts = [["Inception", false], ["Interstellar", true], ["Parasite", false], ["Whiplash", false]];
    var board = [["Mia", "1.280", 2], ["Alex", "1.140", 0], ["Leo", "980", 1]];
    return '<div class="am-scroll am-pushed">' + nav(t("vizGuess"), "") +
      '<div class="am-game-top">' + pill("play", t("mRound")) + pill("trophy", t("mScore") + " 240") + pill("clock", "0:12", "warn") + pill("fire", t("mStreak") + " 4", "hot") + "</div>" +
      '<div class="am-frame">' + img(MOV.interstellar, 342) + '<span class="am-q">?</span></div>' +
      '<div class="am-gopts">' + opts.map(function (o) { return '<span class="am-gopt' + (o[1] ? " right" : "") + '">' + (o[1] ? ic("check", 13) : "") + o[0] + "</span>"; }).join("") + "</div>" +
      '<div class="am-lab">' + t("mLeaderboard") + "</div>" +
      '<div class="am-card">' + board.map(function (b, i) {
        return '<div class="am-lb"><b class="r' + (i + 1) + '">' + (i + 1) + "</b>" + avatar(b[2], 26, b[0][0]) + "<span>" + b[0] + "</span><em>" + b[1] + "</em></div>";
      }).join("") + "</div></div>";
  };

  /* ═══ Listeler · hatırlatıcılar · notlar ═════════════════════════════ */
  S.lists = function () {
    function lc(ids, name, n) { return '<div class="am-lc2"><div class="am-collage">' + ids.map(function (id) { return img(id, 185); }).join("") + "</div><b>" + name + "</b><small>" + n + "</small></div>"; }
    function rem(id, tag, title, sub, chipTxt, hot) {
      return '<div class="am-rem2"><span class="am-rem-img">' + img(id, 185) + '</span><div><small class="am-tag">' + tag + "</small><b>" + title + "</b><small>" + sub + '</small></div><span class="am-today' + (hot ? "" : " calm") + '">' + chipTxt + "</span></div>";
    }
    return '<div class="am-scroll am-pushed">' + nav(t("mLists"), '<span class="am-roundbtn sm">' + ic("plus", 16) + "</span>") +
      '<div class="am-lgrid">' + lc([MOV.dune, MOV.interstellar, MOV.parasite, MOV.dark], t("mWatchedMovies"), "439") + lc([TVS.bb, TVS.st, TVS.tlou, TVS.got], t("mWatchedTv"), "128") + lc([MOV.eternal, MOV.ww84, MOV.dune, MOV.ddlj], t("mFavorites"), "64") + lc([TVS.jl, TVS.falcon, MOV.parasite, TVS.twd], t("mWatchlist"), "52") + "</div>" +
      '<div class="am-lab">' + t("mReminders") + "</div>" +
      rem(TVS.st, t("mTvTag"), "Stranger Things", t("mSeasonEp", { season: 4, episode: 6 }), t("mToday"), true) +
      rem(MOV.dune, t("mFilmTag"), "Dune", date(2026, 10, 28, { day: "numeric", month: "short" }), "3 " + t("mDays"), false) +
      '<div class="am-lab">' + t("mNotes") + "</div>" +
      '<div class="am-card am-note"><b>' + t("mGroupName") + '</b><div class="am-todo done">' + ic("check", 12) + "<span>Dune</span></div>" + '<div class="am-todo">' + ic("check", 12) + "<span>Arrival</span></div>" + '<div class="am-todo">' + ic("check", 12) + "<span>Parasite</span></div></div></div>";
  };

  /* ═══ Hikâye kartı ════════════════════════════════════════════════════ */
  S.story = function () {
    return '<div class="am-scroll am-pushed">' + nav(t("mShare"), "") +
      '<div class="am-story"><div class="am-story-top">' + avatar(0, 30, "A") + '<div><b>Alex Morgan</b><small>@alex</small></div></div>' +
      "<h4>" + t("vizStory") + "</h4>" +
      '<div class="am-story-stats"><div><b>439</b><small>' + t("mStoryMovies") + "</small></div><div><b>3,2K</b><small>" + t("mStoryEpisodes") + "</small></div><div><b>12</b><small>" + t("mStoryStreak") + "</small></div></div>" +
      '<div class="am-story-g"><small>' + t("mStoryGenres") + '</small><div class="am-chips"><span class="am-chip">' + t("mDfScifi") + '</span><span class="am-chip">' + t("mDfDrama") + '</span><span class="am-chip">' + t("mDfThriller") + "</span></div></div>" +
      '<div class="am-story-p">' + [MOV.interstellar, MOV.dune, MOV.parasite, MOV.dark].map(function (id) { return img(id, 185); }).join("") + "</div>" +
      '<div class="am-story-brand">seelogd</div></div>' +
      '<div class="am-story-btns"><span class="am-cta sm">' + ic("share", 14) + t("mShare") + '</span><span class="am-btn">' + ic("download", 14) + t("mSaveStory") + "</span></div></div>";
  };

  /* ═══ Görünüm ve dil (Kişiselleştirme) ═══════════════════════════════ */
  S.custom = function (st) {
    var fams = [["default", "mFamDefault"], ["blue", "mFamBlue"], ["green", "mFamGreen"]];
    var tones = [["light", "mToneLight"], ["mid", "mToneMid"], ["dark", "mToneDark"]];
    var langs = [["Türkçe", "Turkish", 0], ["English", "English", 1], ["Español", "Spanish", 0], ["Português", "Portuguese", 0], ["Deutsch", "German", 0]];
    var cur = AM.lang();
    var code = { tr: 0, en: 1, es: 2, pt: 3, de: 4 }[cur];
    return '<div class="am-scroll am-pushed">' + nav(t("mGrpAppearance"), "") +
      '<div class="am-card am-theme"><div class="am-theme-h"><span class="am-row-ic">' + ic("palette", 15) + "</span><b>" + t("mTheme") + "</b></div>" +
      '<div class="am-seg3">' + fams.map(function (f) { return '<button type="button" data-fam="' + f[0] + '" class="' + (st.family === f[0] ? "on" : "") + '">' + t(f[1]) + "</button>"; }).join("") + "</div>" +
      '<div class="am-seg3">' + tones.map(function (f) { return '<button type="button" data-tone="' + f[0] + '" class="' + (st.tone === f[0] ? "on" : "") + '">' + t(f[1]) + "</button>"; }).join("") + "</div>" +
      '<div class="am-swatch"><span class="a"><b>Aa</b></span><span class="b"><b>Aa</b></span><span class="c"><b>Aa</b></span></div></div>' +
      '<div class="am-card stacked">' + H.row("palette", t("mThemeStudio"), null, { tone: "violet" }) + H.row("font", t("mFontsAll"), null, { tone: "orange" }) + H.row("key", t("mAppIcon"), null, { tone: "teal", right: '<span class="am-icons"><i style="--g:linear-gradient(135deg,#2ee6d6,#138df0)"></i><i style="--g:linear-gradient(135deg,#8b7cf6,#ff8ad4)"></i><i style="--g:linear-gradient(135deg,#ffc247,#ff7a59)"></i></span>' }) + "</div>" +
      '<div class="am-lab">' + t("mLanguage").toUpperCase() + "</div>" +
      '<div class="am-card">' + langs.map(function (l, i) {
        return '<div class="am-row"><span class="am-lang-c">' + ["TR", "EN", "ES", "PT", "DE"][i] + '</span><span class="am-row-tx"><b>' + l[0] + "</b><small>" + l[1] + "</small></span>" + (i === code ? '<span class="am-chev on">' + ic("check", 15) + "</span>" : "") + "</div>";
      }).join("") + "</div>" +
      '<div class="am-card stacked">' + H.row("lock", t("mRowAdult"), null, { tone: "red", right: H.toggle(false) }) + H.row("phone", t("mRowHaptics"), null, { right: H.toggle(true) }) + "</div></div>";
  };
})(window);
