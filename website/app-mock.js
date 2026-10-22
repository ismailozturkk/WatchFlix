/* app-mock.js — uygulama arayüzünün etkileşimli HTML/CSS maketi.
 *
 * GERÇEK ekran görüntüsü DEĞİL: uygulamanın yapısını (4 sekme + ayrık CineMatch düğmesi,
 * Lacivert tema, Hub kartları, Ayarlar grupları, Profil…) yeniden çizer. Metinler
 * uygulamanın kendi çevirileridir (mock-i18n.js). Stil: app-mock.css.
 *
 * Kullanım:
 *   var phone = AppMock.create(hostEl, { tabs: true, screen: "movies" });
 *   phone.show("hub");  phone.setLang("de");
 * Ekranlar `AppMock.screens` altında (app-mock-tour.js ek ekranlar kaydeder).
 * Hero telefonu sekmeli (movies · hub · settings · profile + CineMatch düğmesi);
 * "İçeride neler var" turundaki telefon sekmesiz, tek ekran gösterir.
 */
(function (root) {
  "use strict";

  var MOCK = root.MOCK_I18N || {};
  var HOME = root.HOME_I18N || {};
  var lang = "en";

  /* ── Metin ──────────────────────────────────────────────────────────── */
  function t(key, vars) {
    var v = (MOCK[lang] && MOCK[lang][key]);
    if (v == null) v = HOME[lang] && HOME[lang][key];
    if (v == null) v = MOCK.en && MOCK.en[key];
    if (v == null) v = HOME.en && HOME.en[key];
    if (v == null) v = key;
    return vars ? String(v).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : "{" + k + "}"; }) : v;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ── Afişler (TMDB) ────────────────────────────────────────────────── */
  var IMG = "https://image.tmdb.org/t/p/";
  var MOV = { dune: "d5NXSklXo0qyIYkgV94XAgMIckC", interstellar: "gEU2QniE6E77NI6lCU6MxlNBvIx", ww84: "8UlWHLMpgZm9bx6QYh0NFoq67TZ", dark: "qJ2tW6WMUDux911r6m7haRef0WH", parasite: "7IiTTgloJzvGI1TAYymCfbfl3vT", ddlj: "2CAL2433ZeIihfX1Hb2139CX0pW", eternal: "5MwkWH9tYHv3mV9OdYTMR5qreIz" };
  var TVS = { jl: "9yxep7oJdkj3Pla9TD9gKflRApY", bb: "ggFHVNu6YYI5L9pCfOacjizRGt", st: "49WJfeN0moxb9IPfGn8AIqMGskD", tlou: "uKvVjHNqB5VmOrdxqAt2F7J78ED", lm: "34FaY8qpjBAVysSfrJ1l7nrAQaD", falcon: "6kbAMLteGO8yyewYau6bJ683sw7", twd: "rqeYMLryjcawh2JeRpCVUDXYM5b", got: "1XS1oqL89opfnbLl8WnZY1O1uJx" };
  function img(id, w, cls) {
    return '<img' + (cls ? ' class="' + cls + '"' : "") + ' loading="lazy" decoding="async" alt="" src="' + IMG + "w" + (w || 185) + "/" + id + '.jpg">';
  }

  /* ── Simgeler (kendi çizimim; Ionicons değil) ───────────────────────── */
  var P = {
    "play": '<circle cx="12" cy="12" r="9"/><path d="M10.2 8.4l5 3.6-5 3.6z" fill="currentColor"/>',
    "play-fill": '<circle cx="12" cy="12" r="9.6" fill="currentColor" stroke="none"/><path d="M10.2 8.3l5.2 3.7-5.2 3.7z" fill="var(--tab)" stroke="none"/>',
    "grid": '<rect x="3.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2.2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2.2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2.2"/>',
    "grid-fill": '<rect x="3.5" y="3.5" width="7" height="7" rx="2.2" fill="currentColor"/><rect x="13.5" y="3.5" width="7" height="7" rx="2.2" fill="currentColor"/><rect x="3.5" y="13.5" width="7" height="7" rx="2.2" fill="currentColor"/><rect x="13.5" y="13.5" width="7" height="7" rx="2.2" fill="currentColor"/>',
    "game": '<rect x="2.5" y="6.8" width="19" height="11.4" rx="5.7"/><path d="M7.6 10.4v4M5.6 12.4h4"/><circle cx="16.2" cy="11.4" r="1" fill="currentColor"/><circle cx="18.2" cy="13.6" r="1" fill="currentColor"/>',
    "game-fill": '<rect x="2.5" y="6.8" width="19" height="11.4" rx="5.7" fill="currentColor" stroke="none"/><path d="M7.6 10.4v4M5.6 12.4h4" stroke="var(--tab)" stroke-width="1.8"/><circle cx="16.2" cy="11.4" r="1.1" fill="var(--tab)" stroke="none"/><circle cx="18.2" cy="13.6" r="1.1" fill="var(--tab)" stroke="none"/>',
    "library": '<rect x="4" y="4.5" width="4.4" height="15.5" rx="1.2"/><rect x="10" y="4.5" width="4.4" height="15.5" rx="1.2"/><path d="M16.3 6.2l3.9-1 3.2 14.2-3.9 1z" transform="translate(-1.2 0)"/>',
    "library-fill": '<rect x="4" y="4.5" width="4.4" height="15.5" rx="1.2" fill="currentColor"/><rect x="10" y="4.5" width="4.4" height="15.5" rx="1.2" fill="currentColor"/><path d="M16.3 6.2l3.9-1 3.2 14.2-3.9 1z" transform="translate(-1.2 0)" fill="currentColor"/>',
    "gear": '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.6" stroke-width="3.2" stroke-dasharray="3.2 3.4"/>',
    "gear-fill": '<circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="12" cy="12" r="7.6" stroke-width="3.6" stroke-dasharray="3.2 3.4"/><circle cx="12" cy="12" r="5.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2.4" fill="var(--tab)" stroke="none"/>',
    "user": '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.2"/><path d="M5.8 18.6c1.2-3 3.4-4.4 6.2-4.4s5 1.4 6.2 4.4"/>',
    "user-fill": '<circle cx="12" cy="12" r="9.8" fill="currentColor" stroke="none"/><circle cx="12" cy="10" r="3.1" fill="var(--tab)" stroke="none"/><path d="M6 18.4c1.3-2.9 3.3-4.2 6-4.2s4.7 1.3 6 4.2" fill="var(--tab)" stroke="none"/>',
    "sparkles": '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
    "search": '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    "compass": '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    "flame": '<path d="M12 3c.6 3.3 4.6 5.1 4.6 9.6A4.6 4.6 0 0 1 12 17.2a4.6 4.6 0 0 1-4.6-4.6c0-1.9.8-3.1 1.9-4.1.2 1.2.9 1.8 1.7 2C11 10 10.5 6.4 12 3z"/>',
    "star": '<path d="M12 3.4l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.8l6-.9z" fill="currentColor" stroke="none"/>',
    "heart": '<path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    "tv": '<rect x="3" y="5.5" width="18" height="12" rx="3"/><path d="M8.5 21h7"/>',
    "videocam": '<rect x="3" y="7" width="12" height="10" rx="3"/><path d="M15 11l6-3v8l-6-3"/>',
    "film": '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    "people": '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c0-3 2.4-5.3 5.5-5.3s5.5 2.3 5.5 5.3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M17 14.4c2.3 0 4 1.7 4 4.1"/>',
    "chev": '<path d="M9.5 5l7 7-7 7"/>',
    "back": '<path d="M15 5l-7 7 7 7"/>',
    "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "check": '<path d="M5 12.5l4.6 4.6L19 7.6"/>',
    "close": '<path d="M6 6l12 12M18 6L6 18"/>',
    "send": '<path d="M4 12l16-8-6 16-2.6-6.4z"/>',
    "edit": '<path d="M4 20l1.2-4.2L16.5 4.5l3 3L8.2 18.8z"/><path d="M14.5 6.5l3 3"/>',
    "share": '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
    "list": '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
    "chat": '<path d="M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 3.5V18H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
    "bars": '<path d="M5 20V11M12 20V5M19 20v-7"/>',
    "trophy": '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7"/>',
    "bell": '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    "calendar": '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    "diamond": '<path d="M12 3.5l8 5.5-8 11.5L4 9z"/><path d="M4 9h16M9 9l3 11.5M15 9l-3 11.5"/>',
    "shield": '<path d="M12 3l7 3v5.5c0 4.6-3 7.7-7 9.5-4-1.8-7-4.9-7-9.5V6z"/>',
    "palette": '<path d="M12 4a8 8 0 1 0 0 16c1.3 0 1.9-1 1.5-2.1-.4-1.1.3-2.1 1.5-2.1H17a3 3 0 0 0 3-3c0-4.2-3.6-8.8-8-8.8z"/><circle cx="8" cy="11" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/><circle cx="16" cy="11" r="1" fill="currentColor"/>',
    "image": '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
    "apps": '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><circle cx="16.7" cy="16.7" r="3.2"/>',
    "phone": '<rect x="7.5" y="3" width="9" height="18" rx="2.5"/><path d="M4 8.5v7M20 8.5v7"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9z"/>',
    "download": '<path d="M12 4v11M7.5 11L12 15.5 16.5 11"/><path d="M5 19.5h14"/>',
    "lock": '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    "wand": '<path d="M5 19L16.5 7.5l2 2L7 21z"/><path d="M15 4.5l.7 1.8 1.8.7-1.8.7L15 9.5l-.7-1.8-1.8-.7 1.8-.7z"/>',
    "pin": '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
    "expand": '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    "cafe": '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 4v2M12 4v2"/>',
    "pulse": '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
    "happy": '<circle cx="12" cy="12" r="9"/><path d="M8.5 14c.9 1.5 2 2.2 3.5 2.2s2.6-.7 3.5-2.2"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>',
    "infinite": '<path d="M7.5 8.5c-2.5 0-4 1.6-4 3.5s1.5 3.5 4 3.5c3.5 0 5-7 9-7 2.5 0 4 1.6 4 3.5s-1.5 3.5-4 3.5c-4 0-5.5-7-9-7z" transform="translate(0 .4)"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    "home": '<path d="M4 11l8-7 8 7v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    "dots": '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    "refresh": '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    "text": '<path d="M5 6h14M12 6v13M9 19h6"/>'
  };
  function ic(name, size) {
    var s = size || 18;
    return '<svg class="am-ic" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || "") + "</svg>";
  }

  /* ── Parçalar ───────────────────────────────────────────────────────── */
  var AV = ["linear-gradient(135deg,#2ee6d6,#138df0)", "linear-gradient(135deg,#8b7cf6,#ff8ad4)", "linear-gradient(135deg,#ffc247,#ff7a59)", "linear-gradient(135deg,#3ddc97,#138df0)"];
  function avatar(i, size, letter) {
    return '<i class="am-av" style="--g:' + AV[i % AV.length] + ";width:" + size + "px;height:" + size + 'px">' + (letter || "") + "</i>";
  }
  function secHead(icon, title, sub, extra) {
    return '<div class="am-sh"><span class="am-sh-ic">' + ic(icon, 16) + '</span><div class="am-sh-tx"><b>' + title + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</div>" + (extra || "") + '<span class="am-sh-btn">' + ic("expand", 14) + "</span></div>";
  }
  function rated(txt) { return '<span class="am-rate"><i>★</i>' + txt + "</span>"; }
  function pcards(ids, ratings) {
    return '<div class="am-hs">' + ids.map(function (id, i) {
      return '<div class="am-pc">' + img(id, 185) + rated(ratings[i]) + "</div>";
    }).join("") + "</div>";
  }
  function bigCards(ids, ratings, votes) {
    return '<div class="am-hs am-snap">' + ids.map(function (id, i) {
      return '<div class="am-big">' + img(id, 342) + '<span class="am-rate big"><i>★</i>' + ratings[i] + "<em>" + ic("people", 11) + votes[i] + "</em></span></div>";
    }).join("") + "</div>";
  }
  function row(icon, title, sub, opt) {
    opt = opt || {};
    return '<div class="am-row"><span class="am-row-ic' + (opt.tone ? " " + opt.tone : "") + '">' + ic(icon, 15) + '</span><span class="am-row-tx"><b>' + title + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</span>" + (opt.right || '<span class="am-chev">' + ic("chev", 14) + "</span>") + "</div>";
  }
  function nav(title, right) {
    return '<div class="am-nav"><button class="am-roundbtn sm" type="button" tabindex="-1" aria-hidden="true">' + ic("back", 16) + "</button><b>" + title + "</b>" + (right || "<span></span>") + "</div>";
  }
  function navBack(title, go) {
    return '<div class="am-nav"><button class="am-roundbtn sm" type="button" data-go="' + go + '" aria-label="' + t("mBack") + '">' + ic("back", 16) + "</button><b>" + title + "</b><span></span></div>";
  }
  function chip(txt, on, extra) { return '<span class="am-chip' + (on ? " on" : "") + '"' + (extra || "") + ">" + txt + "</span>"; }

  var screens = {};

  /* ═══ Film & Dizi (ana sayfa) ═════════════════════════════════════════ */
  screens.movies = function (st) {
    var tv = st.media === "tv";
    var float =
      '<div class="am-float">' +
      '<span class="am-roundbtn" aria-hidden="true">' + ic("compass", 18) + "</span>" +
      '<div class="am-switch" role="tablist"><i style="transform:translateX(' + (tv ? "100%" : "0") + ')"></i>' +
      '<button type="button" role="tab" data-mt="movie" aria-selected="' + (!tv) + '" class="' + (tv ? "" : "on") + '">' + ic("videocam", 14) + "<span>" + t("mMovies") + "</span></button>" +
      '<button type="button" role="tab" data-mt="tv" aria-selected="' + tv + '" class="' + (tv ? "on" : "") + '">' + ic("tv", 14) + "<span>" + t("mTv") + "</span></button></div>" +
      '<span class="am-roundbtn" aria-hidden="true">' + ic("search", 18) + "</span></div>";
    var week = st.trend !== "day";
    var trendHead =
      '<div class="am-sh am-sh-trend"><span class="am-sh-ic">' + ic("flame", 16) + '</span><div class="am-sh-tx"><div class="am-tt">' +
      '<button type="button" data-trend="week" class="' + (week ? "on" : "") + '">' + t("mTrendWeek") + "</button>" +
      '<button type="button" data-trend="day" class="' + (week ? "" : "on") + '">' + t("mTrendDay") + "</button></div>" +
      "<small>" + (tv ? t("mTrendSubTv") : t("mTrendSubMovie")) + '</small></div><span class="am-sh-btn">' + ic("expand", 14) + "</span></div>";
    var body;
    if (!tv) {
      var big = week ? [MOV.dune, MOV.interstellar, MOV.dark] : [MOV.ww84, MOV.parasite, MOV.eternal];
      body =
        trendHead + bigCards(big, week ? ["7.7", "8.4", "8.5"] : ["7.0", "8.5", "8.3"], week ? ["46", "31", "52"] : ["28", "64", "39"]) +
        '<div class="am-sh am-sh-seg"><div class="am-seg"><span class="on">' + t("mVoted") + "</span><span>" + t("mPopularMovie") + '</span></div></div>' +
        pcards([MOV.interstellar, MOV.dune, MOV.dark, MOV.parasite, MOV.eternal], ["8.5", "7.8", "8.5", "8.5", "8.3"]) +
        secHead("ticket", t("mTheaters"), t("mTheatersSub")) +
        pcards([MOV.ww84, MOV.ddlj, MOV.dune, MOV.parasite], ["6.4", "8.5", "7.8", "8.5"]);
    } else {
      body =
        secHead("play", t("mOngoing"), t("mOngoingSub")) +
        '<div class="am-hs">' + [[TVS.st, 4, 5, 60], [TVS.tlou, 2, 3, 28], [TVS.bb, 5, 11, 82], [TVS.got, 8, 2, 12]].map(function (c) {
          return '<div class="am-up">' + img(c[0], 342) + '<div class="am-up-ov"><small>' + t("mNextEp") + "</small><b>" + t("mSeasonEp", { season: c[1], episode: c[2] }) + '</b></div><span class="am-up-ok">' + ic("check", 13) + '</span><span class="am-up-bar"><i style="width:' + c[3] + '%"></i></span></div>';
        }).join("") + "</div>" +
        trendHead + bigCards(week ? [TVS.st, TVS.tlou, TVS.falcon] : [TVS.twd, TVS.bb, TVS.jl], ["8.6", "8.7", "7.2"], ["58", "73", "21"]) +
        secHead("calendar", t("mAiring"), null) +
        pcards([TVS.falcon, TVS.twd, TVS.jl, TVS.lm], ["7.2", "8.1", "6.9", "8.0"]);
    }
    return float + '<div class="am-scroll am-top">' + body + "</div>";
  };
  P["ticket"] = '<path d="M4 8.5A2.5 2.5 0 0 0 4 13.5v2.2a1.8 1.8 0 0 0 1.8 1.8h12.4a1.8 1.8 0 0 0 1.8-1.8v-2.2A2.5 2.5 0 0 1 20 8.5V6.8A1.8 1.8 0 0 0 18.2 5H5.8A1.8 1.8 0 0 0 4 6.8z" transform="translate(0 .5)"/><path d="M14 6v12" stroke-dasharray="1.6 2.4"/>';

  /* ═══ Hub ══════════════════════════════════════════════════════════════ */
  function bracketSvg() {
    // 31 maçın iki taraflı eleme ağacı (8-4-2-1 çentik, ortada final) — basit şematik
    var s = '<svg viewBox="0 0 240 70" preserveAspectRatio="none" class="am-bracket" aria-hidden="true">';
    function side(x0, dir) {
      var out = "", xs = [x0, x0 + dir * 16, x0 + dir * 32, x0 + dir * 46], n = [8, 4, 2, 1];
      var ys = [];
      for (var c = 0; c < 4; c++) {
        var cnt = n[c], gap = 62 / cnt, col = [];
        for (var i = 0; i < cnt; i++) {
          var y = 4 + gap * i + gap / 2;
          col.push(y);
          out += '<rect x="' + (xs[c] - (dir > 0 ? 0 : 9)) + '" y="' + (y - 2.2) + '" width="9" height="4.4" rx="2.2" fill="rgba(255,255,255,.88)"/>';
        }
        ys.push(col);
      }
      for (var c2 = 0; c2 < 3; c2++) {
        for (var j = 0; j < ys[c2 + 1].length; j++) {
          var a = ys[c2][j * 2], b = ys[c2][j * 2 + 1], m = ys[c2 + 1][j];
          var xa = xs[c2] + (dir > 0 ? 9 : -9), xb = xs[c2 + 1] + (dir > 0 ? 0 : 0);
          var xm = (xa + xb) / 2;
          out += '<path d="M' + xa + " " + a + "H" + xm + "V" + b + "H" + xa + "M" + xm + " " + m + "H" + xb + '" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1"/>';
        }
      }
      return out;
    }
    return s + side(6, 1) + side(234, -1) + '<line x1="76" y1="35" x2="164" y2="35" stroke="rgba(255,255,255,.55)" stroke-width="1"/></svg>';
  }
  screens.hub = function () {
    return '<div class="am-scroll am-hubtop">' +
      '<div class="am-greet"><div><h3>' + t("mHi") + ", Alex</h3><p>" + t("mHubSub") + "</p></div>" + avatar(0, 40, "A") + "</div>" +
      '<div class="am-lab">' + t("mSocial") + "</div>" +
      '<div class="am-hub feed">' +
      '<div class="am-hub-top"><span class="am-hub-ic">' + ic("list", 18) + '</span><div class="am-hub-tx"><b>' + t("mPosts") + "</b><small>" + t("mPostsSub") + '</small></div><span class="am-faces">' + avatar(1, 22) + avatar(2, 22) + avatar(3, 22) + '</span><span class="am-white-arrow">' + ic("arrow", 14) + "</span></div>" +
      '<div class="am-compose">' + avatar(0, 24, "A") + "<span>" + t("mWhatShare") + '</span><i>' + ic("plus", 14) + "</i></div>" +
      '<div class="am-tiles"><span>' + ic("edit", 15) + t("mReview") + "</span><span>" + ic("list", 15) + t("mList") + "</span><span>" + ic("chat", 15) + t("mChat") + "</span><span>" + ic("bars", 15) + t("mPoll") + "</span></div></div>" +
      '<div class="am-lab">CINESWIPE</div>' +
      '<div class="am-hub cine"><div class="am-cine-l"><span class="am-new">' + t("mNew") + "</span><b>" + t("mCineTitle") + "</b><small>" + t("mCineSub") + '</small><div class="am-cine-btns"><span>' + ic("user", 13) + t("mCineSolo") + "</span><span>" + ic("people", 13) + t("mCineDuo") + '</span></div></div><div class="am-fan">' + img(MOV.dune, 185) + img(MOV.parasite, 185) + img(MOV.interstellar, 185) + "</div></div>" +
      '<div class="am-lab">' + t("mTournament") + "</div>" +
      '<div class="am-hub tour"><div class="am-tour-top"><span class="am-glass">' + ic("trophy", 12) + t("mTourMonthly") + '</span><span class="am-white-arrow gold">' + ic("arrow", 14) + "</span></div>" +
      "<h4>" + t("mTourTheme") + "</h4><small>" + t("mTourNext") + '</small>' +
      '<div class="am-cd">' + [["02", "mCdDay"], ["03", "mCdHr"], ["23", "mCdMin"], ["04", "mCdSec"]].map(function (c) { return "<span><b>" + c[0] + "</b><em>" + t(c[1]) + "</em></span>"; }).join("<i>:</i>") + "</div>" +
      '<div class="am-bracket-box">' + bracketSvg() + '<div class="am-champ">' + img(TVS.st, 185) + "</div></div></div>" +
      '<div class="am-lab am-lab-row"><span>' + t("mGames") + '</span><u>' + t("mGameHub") + " →</u></div>" +
      '<div class="am-hub game"><span class="am-hub-ic">' + ic("trophy", 18) + '</span><div class="am-hub-tx"><b>' + t("mGameHub") + "</b><small>" + t("vizGuess") + '</small></div><span class="am-white-arrow">' + ic("arrow", 14) + "</span></div>" +
      "</div>";
  };

  /* ═══ Ayarlar ══════════════════════════════════════════════════════════ */
  var FAM_TONE = {
    "default": { light: "light", mid: "gray", dark: "dark" },
    blue: { light: "sky", mid: "blue", dark: "blueDeep" },
    green: { light: "green", mid: "greenMid", dark: "greenDeep" }
  };
  function toggle(on) { return '<span class="am-sw' + (on ? " on" : "") + '"></span>'; }
  screens.settings = function (st) {
    var fams = [["default", "mFamDefault"], ["blue", "mFamBlue"], ["green", "mFamGreen"]];
    var tones = [["light", "mToneLight"], ["mid", "mToneMid"], ["dark", "mToneDark"]];
    return '<div class="am-scroll am-settop">' + navBack(t("mTabSettings"), "profile") +
      '<div class="am-lab first">SEELOGD PREMIUM</div>' +
      '<div class="am-prem"><div class="am-prem-top"><span class="am-prem-ic">' + ic("diamond", 20) + "</span><b>" + t("mPremiumTitle") + '</b></div><div class="am-prem-cta"><span>' + t("mPremiumCta") + "</span>" + ic("arrow", 15) + "</div></div>" +
      '<div class="am-lab">' + t("mGrpAccount").toUpperCase() + "</div>" +
      '<div class="am-card">' + row("user", t("mRowConn"), t("mRowConnSub")) + row("shield", t("mRowPrivacy"), null, { tone: "green" }) + "</div>" +
      '<div class="am-lab">' + t("mGrpAppearance").toUpperCase() + "</div>" +
      '<div class="am-card am-theme"><div class="am-theme-h"><span class="am-row-ic">' + ic("palette", 15) + "</span><b>" + t("mTheme") + "</b></div>" +
      '<div class="am-seg3">' + fams.map(function (f) { return '<button type="button" data-fam="' + f[0] + '" class="' + (st.family === f[0] ? "on" : "") + '">' + t(f[1]) + "</button>"; }).join("") + "</div>" +
      '<div class="am-seg3 tones">' + tones.map(function (f) { return '<button type="button" data-tone="' + f[0] + '" class="' + (st.tone === f[0] ? "on" : "") + '">' + t(f[1]) + "</button>"; }).join("") + "</div></div>" +
      '<div class="am-card stacked">' + row("palette", t("mRowPersonal"), null, { tone: "violet" }) + row("image", t("mRowPoster"), null, { tone: "orange" }) + row("apps", t("mRowWidgets"), null, { tone: "teal" }) + row("phone", t("mRowHaptics"), null, { right: toggle(true) }) + "</div>" +
      '<div class="am-lab">' + t("mGrpLang").toUpperCase() + "</div>" +
      '<div class="am-card">' + row("globe", t("mLanguage"), "Türkçe · English · Español · Português · Deutsch") + row("tv", t("mRowSubs"), null, { tone: "orange" }) + row("lock", t("mRowAdult"), null, { tone: "red", right: toggle(false) }) + "</div>" +
      '<div class="am-lab">' + t("mGrpNotif").toUpperCase() + "</div>" +
      '<div class="am-card">' + row("bell", t("mRowReminders"), null, { tone: "orange" }) + row("chat", t("mRowSocialNotif"), null, { tone: "green" }) + "</div>" +
      '<div class="am-lab">' + t("mGrpData").toUpperCase() + "</div>" +
      '<div class="am-card">' + row("download", t("mRowDownload"), null) + row("shield", t("mRowPerms"), null, { tone: "green" }) + "</div>" +
      "</div>";
  };

  /* ═══ Profil ═══════════════════════════════════════════════════════════ */
  function listCard(ids, name, n) {
    return '<div class="am-lc"><div class="am-collage">' + ids.map(function (id) { return img(id, 185); }).join("") + "</div><b>" + name + "</b><small>" + n + "</small></div>";
  }
  screens.profile = function () {
    function stat(num, label) { return '<div class="am-stat"><b>' + num + "</b><small>" + label + "</small></div>"; }
    return '<div class="am-scroll am-proftop">' +
      '<button type="button" class="am-gear" data-go="settings" aria-label="' + t("mTabSettings") + '">' + ic("gear", 18) + "</button>" +
      '<div class="am-halo"><div class="am-halo-ring" style="--p:72"><i class="am-av" style="--g:' + AV[0] + '">A</i></div></div>' +
      '<div class="am-ident"><h3>Alex Morgan</h3><p>@alex</p><div class="am-badges"><span class="am-bpill">' + ic("diamond", 11) + 'Premium</span></div></div>' +
      '<div class="am-actions"><span class="am-btn">' + ic("edit", 14) + t("mEdit") + '</span><span class="am-btn icon">' + ic("share", 15) + '</span><span class="am-btn icon ring" style="--p:68"><b>34</b></span></div>' +
      '<div class="am-bstrip">' + ["#ffc247", "#2ee6d6", "#8b7cf6", "#ff8ad4", "#3ddc97", "#4c8dff"].map(function (c, i) { return '<i style="--c:' + c + ";--p:" + (95 - i * 13) + '"></i>'; }).join("") + "</div>" +
      '<div class="am-fbar">' + [["search", t("mFriendSearch"), ""], ["people", t("mFriends"), "12"], ["chat", t("mMessages"), "3"], ["bell", t("mRequests"), "1"]].map(function (x, i) { return "<span>" + ic(x[0], 17) + (x[2] ? "<em>" + x[2] + "</em>" : "") + "<small>" + x[1] + "</small></span>"; }).join("") + "</div>" +
      '<div class="am-lab">' + t("mStatsUpper") + "</div>" +
      '<div class="am-card am-stats"><div class="am-stat-c">' + ic("videocam", 15) + stat("439", t("mMoviesWatched")) + "</div><div class=\"am-stat-c tv\">" + ic("tv", 15) + stat("128", t("mSeriesCount")) + stat("3,2K", t("mEpisodeCount")) + "</div></div>" +
      '<div class="am-lab">' + t("mActivity") + "</div>" +
      '<div class="am-card">' + row("star", t("mActivity"), "128", { tone: "orange" }) + "</div>" +
      "</div>";
  };

  /* ═══ Kütüphane (Sıradaki · Listeler · Hatırlatmalar · Notlar) ═══════ */
  screens.library = function () {
    function up(id, season, ep, pct) {
      return '<div class="am-up">' + img(id, 342) + '<div class="am-up-ov"><small>' + t("mNextEp") + "</small><b>" + t("mSeasonEp", { season: season, episode: ep }) + '</b></div><span class="am-up-ok">' + ic("check", 13) + '</span><span class="am-up-bar"><i style="width:' + pct + '%"></i></span></div>';
    }
    return '<div class="am-scroll am-hubtop">' +
      '<div class="am-greet"><div><h3>' + t("mTabLibrary") + "</h3><p>" + t("mLibSub") + "</p></div></div>" +
      secHead("play", t("mOngoing"), t("mOngoingSub")) +
      '<div class="am-hs">' + up(TVS.st, 4, 5, 60) + up(TVS.tlou, 2, 3, 28) + up(TVS.bb, 5, 11, 82) + up(TVS.got, 8, 2, 12) + "</div>" +
      '<div class="am-lab am-lab-row"><span>' + t("mLists") + "</span><u>" + ic("plus", 13) + "</u></div>" +
      '<div class="am-hs">' + listCard([MOV.dune, MOV.interstellar, MOV.parasite, MOV.dark], t("mWatchedMovies"), "439") + listCard([TVS.bb, TVS.st, TVS.tlou, TVS.got], t("mWatchedTv"), "128") + listCard([MOV.eternal, MOV.ww84, MOV.dune, MOV.ddlj], t("mFavorites"), "64") + listCard([TVS.jl, TVS.falcon, MOV.parasite, TVS.twd], t("mWatchlist"), "52") + "</div>" +
      '<div class="am-lab">' + t("mReminders") + "</div>" +
      '<div class="am-card am-rem"><span class="am-rem-img">' + img(TVS.st, 185) + '</span><div><small class="am-tag">' + t("mTvTag") + "</small><b>Stranger Things</b><small>" + t("mSeasonEp", { season: 4, episode: 6 }) + '</small></div><span class="am-today">' + t("mToday") + "</span></div>" +
      '<div class="am-lab">' + t("mNotes") + "</div>" +
      '<div class="am-card">' + row("edit", t("mNotes"), t("mNotesSub"), { tone: "violet" }) + "</div>" +
      "</div>";
  };

  /* ═══ CineMatch (AI) paneli ════════════════════════════════════════════ */
  var AIOPT = {
    mood: [["cozy", "cafe", "mCozy"], ["thrilling", "pulse", "mThrilling"], ["funny", "happy", "mFunny"], ["emotional", "heart", "mEmotional"], ["mind", "infinite", "mMindbending"], ["adv", "compass", "mAdventurous"]],
    length: [["short", "clock", "mShort"], ["medium", "clock", "mMedium"], ["long", "clock", "mLong"]],
    company: [["solo", "user", "mSolo"], ["partner", "heart", "mPartner"], ["friends", "people", "mFriendsCo"], ["family", "home", "mFamily"]]
  };
  function aiSheet(st) {
    var ai = st.ai;
    var ready = !!(ai.mood || ai.length || ai.company);
    function group(field, label) {
      return '<div class="am-ai-l">' + t(label) + '</div><div class="am-chips">' + AIOPT[field].map(function (o) {
        return '<button type="button" class="am-chip' + (ai[field] === o[0] ? " on" : "") + '" data-vibe="' + field + ":" + o[0] + '">' + ic(o[1], 13) + t(o[2]) + "</button>";
      }).join("") + "</div>";
    }
    var body;
    if (ai.phase === "think") {
      body = '<div class="am-think"><span class="am-dots"><i></i><i></i><i></i></span><p>' + t("mThinking") + "</p></div>";
    } else if (ai.phase === "result") {
      var picks = [[MOV.interstellar, "8.4"], [MOV.parasite, "8.5"], [MOV.eternal, "8.3"]];
      body = '<div class="am-ai-res">' + picks.map(function (p) {
        return '<div class="am-pick">' + img(p[0], 185) + '<div class="am-pick-tx">' + rated(p[1]) + '<span class="am-pick-btn">' + ic("plus", 12) + t("mActWatchlist") + '</span><span class="am-pick-btn ghost">' + t("mActDetail") + "</span></div></div>";
      }).join("") + '</div><button type="button" class="am-ai-again" data-vibe-reset>' + ic("refresh", 14) + t("mVibeTitle") + "</button>";
    } else {
      body = '<div class="am-vibe"><div class="am-vibe-h"><span class="am-vibe-ic">' + ic("wand", 17) + "</span><div><b>" + t("mVibeTitle") + "</b><small>" + t("mVibeSub") + "</small></div></div>" +
        group("mood", "mMoodLabel") + group("length", "mLengthLabel") + group("company", "mCompanyLabel") +
        '<button type="button" class="am-cta' + (ready ? "" : " off") + '" data-vibe-go' + (ready ? "" : ' aria-disabled="true"') + ">" + ic("sparkles", 14) + (ready ? t("mVibeCta") : t("mPickOne")) + "</button></div>";
    }
    return '<div class="am-sheet-h"><span class="am-sheet-t">' + ic("sparkles", 16) + "<b>CineMatch</b></span><button type=\"button\" class=\"am-roundbtn sm\" data-ai-close aria-label=\"" + t("mClose") + "\">" + ic("close", 15) + "</button></div>" + body;
  }

  /* ── Telefon ───────────────────────────────────────────────────────── */
  var TABS = [["movies", "play", "mTabMovies"], ["hub", "game", "mTabFun"], ["library", "library", "mTabLibrary"], ["profile", "user", "mTabProfile"]];
  // Sekme olmayan ekranlar hangi sekmenin altında açılır (Ayarlar: Profil'in dişlisinden).
  var PARENT_TAB = { settings: "profile" };
  var phones = [];
  var uid = 0;

  function create(host, opts) {
    opts = opts || {};
    var id = "am" + (++uid);
    var st = {
      screen: opts.screen || "movies", media: "movie", trend: "week", family: "blue", tone: "mid",
      ai: { open: false, phase: "pick", mood: null, length: null, company: null }, timer: null
    };
    var tabs = opts.tabs !== false;
    var themeId = "blue";

    host.classList.add("am-wrap");
    host.innerHTML =
      '<div class="am" data-theme="blue" data-tabs="' + tabs + '">' +
      '<div class="am-bezel"><div class="am-screen">' +
      '<div class="am-status"><b>9:41</b><span class="am-sig"><i></i><i></i><i></i><i></i><u></u></span></div><span class="am-island"></span>' +
      '<div class="am-pages" id="' + id + '-page"></div>' +
      (tabs ? tabbar() : "") +
      '<div class="am-sheet" id="' + id + '-sheet" hidden></div>' +
      "</div></div></div>";

    var el = host.querySelector(".am");
    var pages = host.querySelector(".am-pages");
    var sheet = host.querySelector(".am-sheet");

    function tabbar() {
      var i, h = '<div class="am-bar-wrap"><div class="am-bar" role="tablist" aria-label="App"><i class="am-ind"></i>';
      for (i = 0; i < TABS.length; i++) {
        h += '<button type="button" role="tab" class="am-tab" data-go="' + TABS[i][0] + '" data-ic="' + TABS[i][1] + '"><span class="am-tab-ic"></span></button>';
      }
      return h + '</div><button type="button" class="am-aibtn" data-ai aria-haspopup="dialog">' + ic("sparkles", 22) + "</button></div>";
    }

    function paintTabs() {
      if (!tabs) return;
      var buttons = host.querySelectorAll(".am-tab");
      Array.prototype.forEach.call(buttons, function (b, i) {
        var on = b.dataset.go === (PARENT_TAB[st.screen] || st.screen);
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.setAttribute("aria-label", t(TABS[i][2]));
        b.title = t(TABS[i][2]);
        b.querySelector(".am-tab-ic").innerHTML = ic(on ? TABS[i][1] + "-fill" : TABS[i][1], 22);
      });
      var idx = TABS.map(function (x) { return x[0]; }).indexOf(PARENT_TAB[st.screen] || st.screen);
      var ind = host.querySelector(".am-ind");
      if (ind) ind.style.transform = "translateX(" + (Math.max(idx, 0) * 100) + "%)";
      var ai = host.querySelector(".am-aibtn");
      if (ai) {
        ai.setAttribute("aria-label", "CineMatch");
        ai.setAttribute("aria-expanded", st.ai.open ? "true" : "false");
        ai.classList.toggle("on", st.ai.open);
      }
    }

    function render() {
      var fn = screens[st.screen] || screens.movies;
      // aria-hidden YOK: sayfa içinde odaklanabilir denetimler (anahtar, tema, CineMatch seçenekleri) var.
      pages.innerHTML = '<div class="am-page" data-screen="' + st.screen + '">' + fn(st) + "</div>";
      paintTabs();
      renderSheet();
    }
    function renderSheet() {
      sheet.hidden = !st.ai.open;
      el.classList.toggle("ai-open", st.ai.open);
      if (st.ai.open) sheet.innerHTML = aiSheet(st);
    }
    function applyTheme() {
      themeId = FAM_TONE[st.family][st.tone];
      el.setAttribute("data-theme", themeId);
    }

    function show(name) {
      var wantAi = name === "ai";
      if (wantAi) name = "movies"; // arka plan; panel üstte açılır
      if (!screens[name]) return;
      st.screen = name;
      st.ai.open = false;
      if (wantAi) { st.ai.open = true; st.ai.phase = "pick"; }
      render();
      var sc = pages.querySelector(".am-scroll");
      if (sc) sc.scrollTop = 0;
    }

    function closeAi() { clearTimeout(st.timer); st.ai.open = false; renderSheet(); paintTabs(); }

    host.addEventListener("click", function (ev) {
      var target = ev.target.closest ? ev.target.closest("[data-go],[data-ai],[data-ai-close],[data-mt],[data-trend],[data-fam],[data-tone],[data-vibe],[data-vibe-go],[data-vibe-reset]") : null;
      if (!target || !host.contains(target)) return;
      if (target.hasAttribute("data-go")) { show(target.getAttribute("data-go")); return; }
      if (target.hasAttribute("data-ai")) {
        st.ai.open = !st.ai.open;
        if (st.ai.open && st.ai.phase === "think") st.ai.phase = "pick";
        renderSheet(); paintTabs(); return;
      }
      if (target.hasAttribute("data-ai-close")) { closeAi(); return; }
      if (target.hasAttribute("data-mt")) { st.media = target.getAttribute("data-mt"); render(); return; }
      if (target.hasAttribute("data-trend")) { st.trend = target.getAttribute("data-trend"); render(); return; }
      if (target.hasAttribute("data-fam")) { st.family = target.getAttribute("data-fam"); applyTheme(); render(); keepScroll(); return; }
      if (target.hasAttribute("data-tone")) { st.tone = target.getAttribute("data-tone"); applyTheme(); render(); keepScroll(); return; }
      if (target.hasAttribute("data-vibe")) {
        var parts = target.getAttribute("data-vibe").split(":");
        st.ai[parts[0]] = st.ai[parts[0]] === parts[1] ? null : parts[1];
        renderSheet(); return;
      }
      if (target.hasAttribute("data-vibe-reset")) { st.ai.phase = "pick"; renderSheet(); return; }
      if (target.hasAttribute("data-vibe-go")) {
        if (!(st.ai.mood || st.ai.length || st.ai.company)) return;
        st.ai.phase = "think"; renderSheet();
        clearTimeout(st.timer);
        st.timer = setTimeout(function () { st.ai.phase = "result"; renderSheet(); }, 1500);
      }
    });

    var settingsScroll = 0;
    function keepScroll() {
      // Tema değişince Ayarlar ekranı baştan çizilir; kaydırma konumunu koru.
      var sc = pages.querySelector(".am-scroll");
      if (sc) sc.scrollTop = settingsScroll;
    }
    pages.addEventListener("scroll", function (e) {
      if (e.target.classList && e.target.classList.contains("am-scroll")) settingsScroll = e.target.scrollTop;
    }, true);

    var api = {
      el: el, host: host,
      show: show,
      setLang: function () { render(); },
      setTheme: function (fam, tone) { st.family = fam; st.tone = tone; applyTheme(); }
    };
    applyTheme();
    render();
    phones.push(api);
    return api;
  }

  /* ── Ölçek: telefon tasarım boyutu 300×630; kap genişliğine göre küçülür ─ */
  var DESIGN_W = 300, DESIGN_H = 630;
  function fit(host, maxK, share) {
    var box = host.parentElement;
    function apply() {
      var w = box.clientWidth || DESIGN_W;
      var k = Math.max(0.55, Math.min(maxK || 1.05, (w * (share || 1)) / DESIGN_W));
      host.style.setProperty("--k", k.toFixed(3));
    }
    apply();
    if (window.ResizeObserver) new ResizeObserver(apply).observe(box);
    else window.addEventListener("resize", apply);
  }

  root.AppMock = {
    create: create,
    fit: fit,
    screens: screens,
    lang: function () { return lang; },
    addIcons: function (extra) { Object.keys(extra).forEach(function (k) { P[k] = extra[k]; }); },
    helpers: { t: t, ic: ic, img: img, rated: rated, avatar: avatar, row: row, nav: nav, chip: chip, secHead: secHead, pcards: pcards, esc: esc, toggle: toggle, MOV: MOV, TVS: TVS, AV: AV },
    setLang: function (l) {
      lang = l;
      phones.forEach(function (p) { p.setLang(); });
    },
    DESIGN: { w: DESIGN_W, h: DESIGN_H }
  };
})(window);
