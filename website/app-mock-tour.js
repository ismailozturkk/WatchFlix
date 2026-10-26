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
    key: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><path d="M8 15l4-7 4 7M9.5 12.5h5"/>',
    "star-o": '<path d="M12 3.4l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.8l6-.9z" stroke-width="1.7"/>',
    "star-half": '<path d="M12 3.4l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.8l6-.9z" stroke-width="1.7"/><path d="M12 3.4v14.4l-5.3 2.8 1-6L3.3 9.8l6-.9z" fill="currentColor" stroke="none"/>',
    create: '<path d="M11 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V13"/><path d="M17.6 3.9a1.8 1.8 0 0 1 2.5 2.5L12 14.5l-3.3.8.8-3.3z"/>',
    chats: '<path d="M4 4.5h11a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 15 14H9l-3.5 2.5V14H4a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 4 4.5z"/><path d="M16.5 8.5H20a1.5 1.5 0 0 1 1.5 1.5v6.5A1.5 1.5 0 0 1 20 18h-1v2.5L15.5 18H11a1.5 1.5 0 0 1-1.5-1.5V16"/>',
    document: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>'
  });

  function date(y, m, d, opts) {
    return new Intl.DateTimeFormat(LOCALES[AM.lang()] || "en-GB", opts || { day: "numeric", month: "long", year: "numeric" }).format(new Date(y, m, d));
  }
  function pill(icon, txt, cls) { return '<span class="am-pill' + (cls ? " " + cls : "") + '">' + (icon ? ic(icon, 12) : "") + txt + "</span>"; }
  var DOTS = '<span class="am-roundbtn sm" aria-hidden="true">' + ic("dots", 16) + "</span>";

  /* ═══ Dizi detayı → sezon listesi → sezon detayı (Game of Thrones) ═════
   * Uygulamadaki TvShowsDetails · SeasonItem · SeasonDetails ekranları. 1. sezon kartına dokununca
   * sezon detayı açılır, oradaki geri düğmesi diziye döner. Sayılar/görseller TMDB'den; sezon ve
   * bölüm metinleri mock-i18n.js'te (mGot*, kaynak scripts/site-mock-i18n/tmdb-got.json). */
  var GOT = {
    backdrop: "zZqpAXxVSBtxV9qPBcscfXBcL2w",
    // [sezon, bölüm sayısı, yayın tarihi (yıl, ay-1, gün), puan, afiş]
    seasons: [[1, 10, [2011, 3, 17], 8.4, "wgfKiqzuMrFIkU1M68DDDY8kGC1"], [2, 10, [2012, 3, 1], 8.3, "9xfNkPwDOqyeUvfNhs1XlWA0esP"],
      [3, 10, [2013, 2, 31], 8.4, "5MkZjRnCKiIGn3bkXrXfndEzqOU"], [4, 10, [2014, 3, 6], 8.5, "jXIMScXE4J4EVHUba1JgxZnWbo4"],
      [5, 10, [2015, 3, 12], 8.2, "7Q1Hy1AHxAzA2lsmzEMBvuWTX0x"], [6, 10, [2016, 3, 24], 8.3, "p1udLh0gfqyZFmXBGa393gk8go5"],
      [7, 7, [2017, 6, 16], 8.2, "oX51n32QyHeFP5kErksemJsJljL"], [8, 6, [2019, 3, 14], 6.2, "yToCshWmirenreC6mrHwFAScFNJ"]],
    // 1. sezonun ilk bölümleri: [no, yayın tarihi, süre (dk), puan, kare]
    eps: [[1, [2011, 3, 17], 62, 8.2, "o4IX9Mm0kpLITVANJMx7inyEUaY"], [2, [2011, 3, 24], 56, 8.0, "l0GJx3IR8YasbztTJi5uK0XqkEo"], [3, [2011, 4, 1], 58, 8.1, "8HjOlb4slc1xusMgOtoNpxuTgSI"]]
  };
  var SHORT = { day: "numeric", month: "short", year: "numeric" };
  // Uygulamadaki getRatingColor (SeasonItem / SeasonDetails)
  function rc(r) { return r >= 8 ? "#29B864" : r >= 6 ? "#F5C518" : r >= 4 ? "#FF6400" : "#EE3333"; }
  // RatingStars: 10'luk puan 5 yıldıza; kalan ≥ ,25 yarım, ≥ ,75 tam yıldız
  function stars(r) {
    var v = r / 2, full = Math.floor(v), f = v - full, h = "";
    if (f >= 0.75) { full++; f = 0; }
    for (var i = 0; i < 5; i++) h += ic(i < full ? "star" : i === full && f >= 0.25 ? "star-half" : "star-o", 9);
    return '<span class="am-stars">' + h + "</span>";
  }
  function watchProgress(done, total) {
    return '<div class="am-wprog"><span><b>' + done + "</b>&nbsp;/ " + total + " " + t("mEpWord") + "</span><em>" + Math.round(done / total * 100) + "%</em></div>";
  }
  function seasonItem(s) {
    var n = s[0], open = n === 1; // yalnız 1. sezonun detayı çizili
    return '<div class="am-sitem"' + (open ? ' data-go="season" role="button" tabindex="0"' : "") + '><span class="am-sitem-p">' + img(s[4], 185) + '</span>' +
      '<div class="am-sitem-b"><div class="am-sitem-h"><b>' + t("mGotS" + n + "Name") + "</b><small>· " + s[1] + " " + t("mEpisode") + " · " + date(s[2][0], s[2][1], s[2][2], SHORT) + '</small><span class="am-ck">' + ic("check", 10) + "</span></div>" +
      '<div class="am-sitem-r"><span class="am-rpill" style="--rc:' + rc(s[3]) + '">★<b>' + s[3].toFixed(1) + "</b></span>" + stars(s[3]) + "</div>" +
      "<p>" + t("mGotS" + n + "Ov") + '</p><i class="am-sitem-bar"></i></div></div>';
  }
  S.series = function () {
    var genres = [t("mGenreSciFan"), t("mGenreDrama"), t("mGenreActAdv")];
    return '<div class="am-tvd-float"><span class="am-roundbtn" aria-hidden="true">' + ic("back", 14) + '</span><span class="am-roundbtn" aria-hidden="true">' + ic("share-social", 13) + "</span></div>" +
      '<div class="am-scroll am-tvd"><div class="am-tvd-hero"><img loading="lazy" decoding="async" alt="" src="https://image.tmdb.org/t/p/w780/' + GOT.backdrop + '.jpg"></div>' +
      '<div class="am-tvd-head"><span class="am-tvd-poster">' + img(TVS.got, 185) + '</span><div class="am-tvd-info"><b class="h">Game of Thrones</b><p class="am-tagline">“' + t("mGotTagline") + "”</p>" +
      '<div class="am-gen"><span class="age">' + ic("shield", 8) + "18+</span><span>" + genres.join("</span><span>") + "</span></div>" +
      '<div class="am-tvd-rate"><span class="st">' + ic("star", 17) + '</span><div><b class="n">8.5<small>/10</small></b><small>28K</small></div><span class="mine">' + ic("star", 9) + '<b class="n">10</b></span></div>' +
      '<span class="am-imdb"><i>IMDb</i><b class="n">9.2</b></span></div></div>' +
      '<div class="am-tvd-acts">' + [["bookmark", "#3B82F6", "mInList"], ["eye", "#22C55E", "mWatchedLbl"], ["heart-fill", "#EF4444", "mFavorited"]].map(function (a) {
        return '<span><i style="color:' + a[1] + '">' + ic(a[0], 19) + "</i><small>" + t(a[2]) + "</small></span>";
      }).join("") + '<span><i class="xtra">' + ic("apps9", 12) + "<u>2</u></i><small>" + t("mOthers") + "</small></span></div>" +
      watchProgress(73, 73) +
      '<div class="am-tvd-tiles">' + [["create", "#3B82F6", "mReview", "mShareHub"], ["sparkles", "#A855F7", "mAiLbl", "mAiInfo"], ["send", "#22C55E", "mSend", "mSendChat"]].map(function (x) {
        return '<span><i style="--c:' + x[1] + '">' + ic(x[0], 12) + "</i><b>" + t(x[2]) + "</b><small>" + t(x[3]) + "</small></span>";
      }).join("") + "</div>" +
      '<div class="am-tvd-stats"><span><i>' + ic("layers", 12) + '</i><b class="n">8</b><small>' + t("mSeasons") + "</small></span>" +
      "<span><i>" + ic("play", 12) + '</i><b class="n">73<u>/73</u></b><small>' + t("mEpisode") + "</small></span>" +
      '<span><i class="g">' + ic("calendar", 12) + "</i><b>" + date(2011, 3, 17) + "</b><small>" + t("mAirDate") + "</small></span></div>" +
      '<div class="am-tvd-row"><i>' + ic("chats", 13) + '</i><div><b class="h">' + t("mComments") + "</b></div>" + ic("chev", 12) + "</div>" +
      '<div class="am-tvd-row"><i>' + ic("document", 13) + '</i><div><b class="h">' + t("mMyNote") + "</b><small>" + t("mMyNoteSub") + "</small></div>" + ic("chev", 12) + "</div>" +
      '<h4 class="am-bar-h">' + t("mSeasons") + "</h4>" + GOT.seasons.map(seasonItem).join("") + "</div>";
  };
  S.season = function () {
    var s = GOT.seasons[0];
    return '<div class="am-tvd-float"><button type="button" class="am-ssd-back" data-go="series" aria-label="' + t("mBack") + '"><span class="am-roundbtn">' + ic("back", 14) + "</span>" + t("mSeasonN", { n: 1 }) + "</button></div>" +
      '<div class="am-scroll am-ssd"><div class="am-ssd-hero">' + img(s[4], 342) + "</div>" +
      '<p class="am-ssd-show">Game of Thrones</p><div class="am-ssd-chips"><span>' + ic("calendar", 10) + date(s[2][0], s[2][1], s[2][2]) + "</span><span>" + ic("play", 10) + s[1] + " " + t("mEpisode") + "</span></div>" +
      '<span class="am-ssd-rate" style="--rc:' + rc(s[3]) + '">' + ic("star", 12) + '<b class="n">' + s[3].toFixed(1) + "</b><small>/10</small></span>" +
      watchProgress(10, 10) +
      '<div class="am-ssd-com">' + ic("chat-fill", 13) + "<div><b>" + t("mComments") + "</b><small>" + t("mSeasonN", { n: 1 }) + " – " + t("mGotS1Name") + "</small></div>" + ic("chev", 12) + "</div><hr>" +
      '<h4 class="am-bar-h g">' + t("mOverview") + '</h4><p class="am-ssd-ov">' + t("mGotOv") + "</p>" +
      '<h4 class="am-bar-h g">' + t("mEpisode") + '<span class="am-cnt">' + s[1] + "</span></h4>" +
      GOT.eps.map(function (e, i) {
        return '<div class="am-epc"><span class="am-epc-img"><img loading="lazy" decoding="async" alt="" src="https://image.tmdb.org/t/p/w300/' + e[4] + '.jpg">' +
          '<em class="r" style="--rc:' + rc(e[3]) + '">★<b>' + e[3].toFixed(1) + '</b></em><em class="d">' + ic("clock", 7) + e[2] + " " + t("mMinutes") + "</em></span>" +
          '<div class="am-epc-b"><div class="am-epc-h"><small>' + t("mEpN", { n: e[0] }) + "&nbsp;&nbsp;" + date(e[1][0], e[1][1], e[1][2], SHORT) + '</small><span class="am-ck">' + ic("check", 10) + "</span></div>" +
          "<b>" + t("mGotE" + (i + 1) + "Name") + "</b><p>" + t("mGotE" + (i + 1) + "Ov") + "</p></div></div>";
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

  /* ═══ Listeler · hatırlatıcılar · notlar (Kütüphane sekmesinin parçaları) ═ */
  S.lists = function () {
    return '<div class="am-scroll am-pushed">' + nav(t("mLists"), '<span class="am-roundbtn sm">' + ic("plus", 14) + "</span>") +
      '<div class="am-lgrid">' + H.lcard([TVS.fallout, TVS.moneyHeist, TVS.got, TVS.twd, TVS.office], "tv-fill", t("mWatchedTv"), 17, "#8B5CF6") +
      H.lcard([MOV.venom, MOV.avengers, MOV.interstellar, MOV.inception, MOV.oneBattle], "film", t("mWatchedMovies"), 22, "#3B82F6") +
      H.lcard([MOV.forrest, MOV.pulp, MOV.shawshank, MOV.fightClub, MOV.titanic], "heart-fill", t("mFavorites"), 12, "#EF4444") +
      H.lcard([TVS.bear, TVS.reacher, TVS.mobland, TVS.shogun, TVS.pitt], "bookmark", t("mWatchlist"), 9, "#F59E0B") + "</div>" +
      '<div class="am-lab">' + t("mReminderLabel") + "</div>" +
      H.remCard(MOV.mongoose, true, "Mongoose", "99 " + t("mMin"), date(2026, 9, 29), 3) +
      H.remCard(MOV.secretWars, true, "Avengers: Secret Wars", null, date(2027, 11, 17), 417) +
      '<div class="am-lab">' + t("mNotes") + "</div>" + H.notesCard() + "</div>";
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
    var langs = [["Türkçe", "Turkish", 0], ["English", "English", 1], ["Español", "Spanish", 0], ["Português", "Portuguese", 0], ["Deutsch", "German", 0]];
    var cur = AM.lang();
    var code = { tr: 0, en: 1, es: 2, pt: 3, de: 4 }[cur];
    return '<div class="am-scroll am-pushed">' + nav(t("mGrpAppearance"), "") +
      H.themeCard(st).replace(/<\/div>$/, '<div class="am-swatch"><span class="a"><b>Aa</b></span><span class="b"><b>Aa</b></span><span class="c"><b>Aa</b></span></div></div>') +
      '<div class="am-card stacked">' + H.row("palette", t("mThemeStudio"), null, { tone: "violet" }) + H.row("font", t("mFontsAll"), null, { tone: "orange" }) + H.row("key", t("mAppIcon"), null, { tone: "teal", right: '<span class="am-icons"><i style="--g:linear-gradient(135deg,#2ee6d6,#138df0)"></i><i style="--g:linear-gradient(135deg,#8b7cf6,#ff8ad4)"></i><i style="--g:linear-gradient(135deg,#ffc247,#ff7a59)"></i></span>' }) + "</div>" +
      '<div class="am-lab">' + t("mLanguage").toUpperCase() + "</div>" +
      '<div class="am-card">' + langs.map(function (l, i) {
        return '<div class="am-row"><span class="am-lang-c">' + ["TR", "EN", "ES", "PT", "DE"][i] + '</span><span class="am-row-tx"><b>' + l[0] + "</b><small>" + l[1] + "</small></span>" + (i === code ? '<span class="am-chev on">' + ic("check", 15) + "</span>" : "") + "</div>";
      }).join("") + "</div>" +
      '<div class="am-card stacked">' + H.row("lock", t("mRowAdult"), null, { tone: "red", right: H.toggle(false) }) + H.row("phone", t("mRowHaptics"), null, { right: H.toggle(true) }) + "</div></div>";
  };
})(window);
