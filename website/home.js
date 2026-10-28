/* home.js — landing sayfasının davranışı.
 * Ayarlar: site-config.js · Dil mantığı: site-lang.js · Metinler: home-i18n.js
 *
 * Bölümler: 1) dil + metin uygulama  2) mağaza düğmeleri / sayfa durumu
 *           3) bekleme listesi (Firestore)  4) poster şeridi  5) cila (reveal,
 *           üst çubuk, spot ışığı, logo gözleri)
 */
(function () {
  "use strict";

  var CFG = window.SITE_CONFIG || {};
  var DICT = window.HOME_I18N || {};
  var SL = window.SiteLang;
  var LOCALES = { tr: "tr-TR", en: "en-GB", es: "es-ES", pt: "pt-BR", de: "de-DE" };

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  var lang = SL.resolve();
  var menu = null;
  var countValue = null;   // bekleme listesi sayısı (null = henüz okunmadı)
  var okState = null;      // { email, queueNo, exists }

  /* ── 1) Dil ve metinler ─────────────────────────────────────────── */
  /* Sıra: site metni (seçili dil) → uygulama maketi metni (seçili dil) → İngilizce. */
  function t(key) {
    var d = DICT[lang];
    if (d && d[key] != null) return d[key];
    var mock = window.MOCK_I18N;
    if (mock && mock[lang] && mock[lang][key] != null) return mock[lang][key];
    if (DICT.en && DICT.en[key] != null) return DICT.en[key];
    return mock && mock.en && mock.en[key] != null ? mock.en[key] : key;
  }

  function fmt(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (_, k) {
      return vars && vars[k] != null ? vars[k] : "{" + k + "}";
    });
  }

  function setMeta(selector, value) {
    var el = $(selector);
    if (el) el.setAttribute("content", value);
  }

  function applyI18n() {
    document.documentElement.lang = lang;
    if (window.AppMock) window.AppMock.setLang(lang); // telefon maketleri seçili dilde yeniden çizilir

    $$("[data-i18n]").forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-html]").forEach(function (el) { el.innerHTML = t(el.dataset.i18nHtml); });
    $$("[data-i18n-ph]").forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
    $$("[data-i18n-aria]").forEach(function (el) { el.setAttribute("aria-label", t(el.dataset.i18nAria)); });
    $$("[data-list]").forEach(function (ul) {
      var items = t(ul.dataset.list);
      ul.textContent = "";
      (Array.isArray(items) ? items : []).forEach(function (text) {
        var li = document.createElement("li");
        li.textContent = text;
        ul.appendChild(li);
      });
    });

    document.title = t("metaTitle");
    setMeta('meta[name="description"]', t("metaDesc"));
    setMeta('meta[property="og:title"]', t("metaTitle"));
    setMeta('meta[property="og:description"]', t("metaDesc"));

    if (menu) { menu.set(lang); menu.setLabel(t("langLabel")); }

    applyStores();
    applyState();
    renderCount();
    renderOk();
    renderBeta();
    renderTour();
    renderMore();
  }

  function setLang(next) {
    if (next === lang) return;
    lang = next;
    SL.store(lang);
    SL.syncUrl(lang);
    applyI18n();
  }

  /* ── 2) Mağaza düğmeleri ve sayfa durumu ────────────────────────── */
  var STORE_NAMES = { apple: "App Store", google: "Google Play" };

  function storeInfo() {
    var s = CFG.stores || {};
    var n = (s.apple ? 1 : 0) + (s.google ? 1 : 0);
    return { apple: s.apple || "", google: s.google || "", any: n > 0, all: n === 2 };
  }

  /* Telefona göre doğru mağaza: iOS → App Store, diğerleri → Google Play. */
  function preferredStoreUrl() {
    var s = storeInfo();
    var ios = /iPhone|iPad|iPod|Macintosh/i.test(navigator.userAgent || "");
    if (ios && s.apple) return s.apple;
    return s.google || s.apple || "";
  }

  function applyStores() {
    var info = storeInfo();
    $$(".store").forEach(function (a) {
      var key = a.dataset.store;
      var url = info[key];
      var small = a.querySelector("small");
      var label = (small ? small.textContent + " " : "") + STORE_NAMES[key];
      if (url) {
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener";
        a.classList.add("is-live");
        a.classList.remove("is-soon");
        a.removeAttribute("aria-disabled");
        a.removeAttribute("title");
        a.setAttribute("aria-label", label);
      } else {
        a.setAttribute("href", "#notify");
        a.removeAttribute("target");
        a.classList.add("is-soon");
        a.classList.remove("is-live");
        a.setAttribute("aria-disabled", "true");
        a.setAttribute("title", t("storeSoonTip"));
        a.setAttribute("aria-label", STORE_NAMES[key] + " — " + t("storeSoonFull"));
      }
    });
  }

  function launchTarget() {
    if (!CFG.launchDate) return null;
    var d = new Date(CFG.launchDate);
    return isNaN(d.getTime()) ? null : d;
  }

  /* Hero hapı, üst çubuk düğmesi ve son çağrı metni duruma göre çizilir. */
  function applyState() {
    var info = storeInfo();
    document.body.classList.toggle("is-live", info.all);

    var pill = $("#pillText");
    var target = launchTarget();
    if (pill) {
      if (info.any) pill.textContent = t("pillLive");
      else if (target && target.getTime() > Date.now()) {
        var date = new Intl.DateTimeFormat(LOCALES[lang], { day: "numeric", month: "long", year: "numeric" }).format(target);
        pill.textContent = fmt(t("pillDate"), { date: date });
      } else pill.textContent = t("pillSoon");
    }

    var cta = $("#navCta");
    if (cta) {
      if (info.any) {
        cta.textContent = t("navCtaLive");
        cta.href = preferredStoreUrl();
        cta.target = "_blank";
        cta.rel = "noopener";
      } else {
        cta.textContent = t("navCta");
        cta.setAttribute("href", "#notify");
        cta.removeAttribute("target");
      }
    }

    var sub = $("#ctaSub");
    if (sub) sub.textContent = info.any ? t("ctaSubLive") : t("ctaSub");
    var actions = $("#ctaActions");
    if (actions) actions.hidden = info.all;
  }

  function focusNotify() {
    var input = $("#emailInput");
    var box = $("#notify");
    if (box) box.scrollIntoView({ behavior: "smooth", block: "center" });
    if (input && !$("#notify").classList.contains("done")) {
      setTimeout(function () { input.focus({ preventScroll: true }); }, 450);
    }
  }

  document.addEventListener("click", function (ev) {
    var soon = ev.target.closest && ev.target.closest(".store.is-soon");
    if (soon) { ev.preventDefault(); focusNotify(); return; }
    var toNotify = ev.target.closest && ev.target.closest('a[href="#notify"]');
    if (toNotify) { ev.preventDefault(); focusNotify(); }
  });

  /* ── 3) Bekleme listesi ─────────────────────────────────────────── */
  var LS = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* yoksay */ } },
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var db = null;
  var dbReady = null;

  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(function (_, reject) { setTimeout(function () { reject(new Error("timeout")); }, ms); }),
    ]);
  }

  /* Firestore yalnızca gerektiğinde (boşta ya da form gönderilince) yüklenir. */
  function initDb() {
    if (dbReady) return dbReady;
    if (!CFG.firebaseConfig) { dbReady = Promise.resolve(); return dbReady; }
    dbReady = Promise.all([
      import("https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js"),
    ]).then(function (mods) {
      var fs = mods[1];
      db = { fs: fs, app: fs.getFirestore(mods[0].initializeApp(CFG.firebaseConfig)) };
    }).catch(function (err) {
      dbReady = null; // sonraki denemede yeniden dene
      throw err;
    });
    return dbReady;
  }

  var store = {
    base: function () { return Number(CFG.baseCount) || 0; },
    getCount: function () {
      if (!CFG.firebaseConfig) return Promise.resolve(store.base() + LS.get("wf_emails", []).length);
      return initDb().then(function () {
        return db.fs.getDoc(db.fs.doc(db.app, "meta", "waitlist"));
      }).then(function (snap) {
        return store.base() + (snap.exists() ? snap.data().count || 0 : 0);
      });
    },
    /* Firestore'a yazılan alanlar firestore.rules'taki waitlist kuralıyla birebir:
       { email, createdAt, source, queueNo }. Alan eklersen kuralı da güncelle. */
    addEmail: function (email) {
      if (!CFG.firebaseConfig) {
        var list = LS.get("wf_emails", []);
        var idx = list.indexOf(email);
        if (idx !== -1) return Promise.resolve({ email: email, queueNo: store.base() + idx + 1, exists: true });
        list.push(email);
        LS.set("wf_emails", list);
        return Promise.resolve({ email: email, queueNo: store.base() + list.length, exists: false });
      }
      return initDb().then(function () {
        var fs = db.fs;
        var id = btoa(unescape(encodeURIComponent(email))).replace(/[/+=]/g, "_");
        var ref = fs.doc(db.app, "waitlist", id);
        return fs.getDoc(ref).then(function (snap) {
          if (snap.exists()) {
            return { email: email, queueNo: snap.data().queueNo || store.base() + 1, exists: true };
          }
          return fs.getDoc(fs.doc(db.app, "meta", "waitlist")).then(function (countSnap) {
            var queueNo = store.base() + (countSnap.exists() ? countSnap.data().count || 0 : 0) + 1;
            return fs.setDoc(ref, { email: email, createdAt: fs.serverTimestamp(), source: "landing", queueNo: queueNo })
              .then(function () {
                return fs.setDoc(fs.doc(db.app, "meta", "waitlist"), { count: fs.increment(1) }, { merge: true });
              })
              .then(function () { return { email: email, queueNo: queueNo, exists: false }; });
          });
        });
      });
    },
  };

  function renderCount() {
    var box = $("#count");
    var text = $("#countText");
    if (!box || !text) return;
    if (countValue == null || countValue <= 0 || document.body.classList.contains("is-live")) {
      box.hidden = true;
      return;
    }
    text.innerHTML = fmt(t("countLabel"), { n: countValue.toLocaleString(LOCALES[lang]) });
    box.hidden = false;
  }

  function renderOk() {
    var panel = $("#joinOk");
    var notify = $("#notify");
    if (!panel || !notify) return;
    if (!okState) { panel.hidden = true; notify.classList.remove("done"); return; }
    $("#okText").textContent = okState.exists ? t("okDup") : fmt(t("okText"), { email: okState.email });
    $("#okNo").textContent = "#" + String(okState.queueNo).padStart(6, "0");
    panel.hidden = false;
    notify.classList.add("done");
  }

  function setupForm() {
    var form = $("#joinForm");
    var input = $("#emailInput");
    var msg = $("#formMsg");
    var btn = $("#joinBtn");
    if (!form) return;

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      msg.textContent = "";
      var email = input.value.trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length >= 200) {
        form.classList.remove("shake");
        void form.offsetWidth;
        form.classList.add("shake");
        msg.textContent = t("errInvalid");
        input.focus();
        return;
      }
      btn.disabled = true;
      withTimeout(store.addEmail(email), 12000).then(function (res) {
        okState = res;
        LS.set("wf_ticket", { email: res.email, queueNo: res.queueNo });
        if (!res.exists && countValue != null && res.queueNo > countValue) countValue = res.queueNo;
        renderOk();
        renderCount();
      }).catch(function (err) {
        console.error("Waitlist error:", err);
        msg.textContent = t("errGeneric");
      }).then(function () { btn.disabled = false; });
    });
  }

  /* ── 3b) Test kullanıcısı (kapalı test) ─────────────────────────── */
  /* Kayıt: betaTesters/{base64(email)}_{platform}. Aynı kişi iki platforma ayrı
     ayrı yazılabilir. Alanlar firestore.rules'taki betaTesters kuralıyla birebir:
     { email, platform, lang, createdAt, source }. Alan eklersen kuralı da güncelle. */
  var BETA_PLATFORMS = { android: "Android", ios: "iOS" };
  var betaState = null; // { email, platforms: ["android"|"ios"], exists }

  /* Bu tarayıcıdan yapılan kayıt (bekleme listesindeki wf_ticket gibi): sayfa
     yenilenince form yerine "zaten listedesin" görünür. Farklı e-postayla
     yeni kayıt eskisinin yerine geçer. */
  function saveBetaTicket(res) {
    var prev = LS.get("wf_beta_ticket", null);
    var platforms = prev && prev.email === res.email && Array.isArray(prev.platforms) ? prev.platforms.slice() : [];
    if (platforms.indexOf(res.platform) === -1) platforms.push(res.platform);
    LS.set("wf_beta_ticket", { email: res.email, platforms: platforms });
    return platforms;
  }

  function betaPlatformLabel(platforms) {
    return platforms.length > 1 ? t("betaBoth") : BETA_PLATFORMS[platforms[0]];
  }

  function addBetaTester(email, platform) {
    if (!CFG.firebaseConfig) {
      var list = LS.get("wf_beta", []);
      var key = email + "|" + platform;
      var exists = list.indexOf(key) !== -1;
      if (!exists) { list.push(key); LS.set("wf_beta", list); }
      return Promise.resolve({ email: email, platform: platform, exists: exists });
    }
    return initDb().then(function () {
      var fs = db.fs;
      var id = btoa(unescape(encodeURIComponent(email))).replace(/[/+=]/g, "_") + "_" + platform;
      var ref = fs.doc(db.app, "betaTesters", id);
      return fs.getDoc(ref).then(function (snap) {
        if (snap.exists()) return { email: email, platform: platform, exists: true };
        return fs.setDoc(ref, { email: email, platform: platform, lang: lang, createdAt: fs.serverTimestamp(), source: "landing" })
          .then(function () { return { email: email, platform: platform, exists: false }; });
      });
    });
  }

  function selectedPlatform() {
    var el = document.querySelector('#betaForm input[name="platform"]:checked');
    return el ? el.value : "";
  }

  function renderBeta() {
    var hint = $("#betaHint");
    if (hint) {
      var p = selectedPlatform();
      hint.textContent = t(p === "android" ? "betaHintAndroid" : p === "ios" ? "betaHintIos" : "betaHintNone");
    }
    var card = $("#betaCard");
    var panel = $("#betaOk");
    if (!card || !panel) return;
    if (!betaState) { panel.hidden = true; card.classList.remove("done"); return; }
    $("#betaOkText").textContent = fmt(t(betaState.exists ? "betaOkDup" : "betaOkText"), {
      email: betaState.email,
      platform: betaPlatformLabel(betaState.platforms),
    });
    // İki platform da kayıtlıysa "başka cihaz" seçeneği kalmaz.
    $("#betaAgain").hidden = betaState.platforms.length >= Object.keys(BETA_PLATFORMS).length;
    panel.hidden = false;
    card.classList.add("done");
  }

  function setupBeta() {
    var form = $("#betaForm");
    if (!form) return;
    var input = $("#betaEmail");
    var msg = $("#betaMsg");
    var btn = $("#betaBtn");
    var plats = form.querySelector(".beta-platforms");

    var shake = function (el) {
      el.classList.remove("shake");
      void el.offsetWidth;
      el.classList.add("shake");
    };

    form.addEventListener("change", function (ev) {
      if (ev.target.name === "platform") { msg.textContent = ""; renderBeta(); }
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      msg.textContent = "";
      var platform = selectedPlatform();
      if (!BETA_PLATFORMS[platform]) {
        shake(plats);
        msg.textContent = t("betaErrPlatform");
        var first = form.querySelector('input[name="platform"]');
        if (first) first.focus();
        return;
      }
      var email = input.value.trim().toLowerCase();
      if (!EMAIL_RE.test(email) || email.length >= 200) {
        shake($("#betaRow"));
        msg.textContent = t("errInvalid");
        input.focus();
        return;
      }
      btn.disabled = true;
      withTimeout(addBetaTester(email, platform), 12000).then(function (res) {
        var platforms = saveBetaTicket(res);
        // Yeni kayıtta yalnız bu platform anılır; yinelenende kayıtlı olanların tümü.
        betaState = { email: res.email, platforms: res.exists ? platforms : [res.platform], exists: res.exists };
        renderBeta();
      }).catch(function (err) {
        console.error("Beta signup error:", err);
        msg.textContent = t("errGeneric");
      }).then(function () { btn.disabled = false; });
    });

    $("#betaAgain").addEventListener("click", function () {
      var ticket = LS.get("wf_beta_ticket", null);
      var done = ticket && Array.isArray(ticket.platforms) ? ticket.platforms : [];
      betaState = null;
      renderBeta();
      // Henüz kayıtlı olmayan platformu ve aynı e-postayı önceden doldur: "ikinci cihaz" en sık durum.
      var next = Object.keys(BETA_PLATFORMS).filter(function (p) { return done.indexOf(p) === -1; })[0];
      var radio = next && form.querySelector('input[name="platform"][value="' + next + '"]');
      if (radio) { radio.checked = true; renderBeta(); }
      if (ticket && ticket.email) input.value = ticket.email;
      input.focus();
    });
  }

  /* ── 4) Poster şeridi (dekoratif) ───────────────────────────────── */
  var POSTERS = [
    "d5NXSklXo0qyIYkgV94XAgMIckC", "gEU2QniE6E77NI6lCU6MxlNBvIx", "9yxep7oJdkj3Pla9TD9gKflRApY",
    "ggFHVNu6YYI5L9pCfOacjizRGt", "49WJfeN0moxb9IPfGn8AIqMGskD", "uKvVjHNqB5VmOrdxqAt2F7J78ED",
    "8UlWHLMpgZm9bx6QYh0NFoq67TZ", "qJ2tW6WMUDux911r6m7haRef0WH", "34FaY8qpjBAVysSfrJ1l7nrAQaD",
    "7IiTTgloJzvGI1TAYymCfbfl3vT", "6kbAMLteGO8yyewYau6bJ683sw7", "rqeYMLryjcawh2JeRpCVUDXYM5b",
    "2CAL2433ZeIihfX1Hb2139CX0pW", "u3bZgnGQ9T01sWNhyveQz0wH0Hl", "7WUHnWGx5OO145IRxPDUkQSh4C7",
    "6UH52Fmau8RPsMAbQbjwN3wJSCj", "1XS1oqL89opfnbLl8WnZY1O1uJx", "5MwkWH9tYHv3mV9OdYTMR5qreIz",
  ];
  /* Aynı yapımın iki afişi yan yana düşmesin (14 ve 15 numaralı kimlikler ikisi de GoT). */
  POSTERS.splice(8, 0, POSTERS.splice(15, 1)[0]);

  function buildPosters() {
    var host = $("#posters");
    if (!host) return;
    [0, 1].forEach(function (r) {
      var ids = r ? POSTERS.slice(9).concat(POSTERS.slice(0, 9)) : POSTERS;
      var row = document.createElement("div");
      row.className = "p-row" + (r ? " rev" : "");
      var html = "";
      for (var k = 0; k < 2; k++) { // iki özdeş yarım: -%50 kaydırma kesintisiz döner
        ids.forEach(function (id) {
          html += '<img loading="lazy" decoding="async" alt="" width="185" height="278" src="https://image.tmdb.org/t/p/w185/' + id + '.jpg">';
        });
      }
      row.innerHTML = html;
      host.appendChild(row);
    });
  }

  /* ── 5) Cila ────────────────────────────────────────────────────── */
  function setupChrome() {
    var top = $("#top");
    var onScroll = function () { if (top) top.classList.toggle("scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    var items = $$(".reveal");
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
      items.forEach(function (el) { io.observe(el); });
    } else {
      items.forEach(function (el) { el.classList.add("in"); });
    }

    /* Kartlarda imleci izleyen spot ışığı (yalnız fare). */
    $$(".card").forEach(function (card) {
      card.addEventListener("pointermove", function (ev) {
        if (ev.pointerType !== "mouse") return;
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ev.clientX - r.left + "px");
        card.style.setProperty("--my", ev.clientY - r.top + "px");
      });
    });
  }

  /* Alt bilgideki logonun gözleri imleci/dokunuşu yumuşakça izler. */
  function setupEyes() {
    var svg = $(".foot-logo");
    if (!svg || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var pupils = Array.prototype.map.call(svg.querySelectorAll(".sl-pupil"), function (el) {
      return { el: el, cx: +el.getAttribute("data-cx"), cy: +el.getAttribute("data-cy"), max: +el.getAttribute("data-max") || 12 };
    });
    if (!pupils.length) return;
    var rect = null, px = 0, py = 0, queued = false;
    function measure() { rect = svg.getBoundingClientRect(); }
    function apply() {
      queued = false;
      if (!rect || !rect.width) return;
      var vb = svg.viewBox.baseVal;
      var sx = (px - rect.left) / rect.width * vb.width;
      var sy = (py - rect.top) / rect.height * vb.height;
      pupils.forEach(function (e) {
        var dx = sx - e.cx, dy = sy - e.cy, d = Math.hypot(dx, dy) || 1, m = Math.min(e.max, d) / d;
        e.el.style.transform = "translate(" + (dx * m).toFixed(1) + "px," + (dy * m).toFixed(1) + "px)";
      });
    }
    function onMove(x, y) { px = x; py = y; if (!queued) { queued = true; requestAnimationFrame(apply); } }
    measure();
    window.addEventListener("mousemove", function (e) { onMove(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener("touchmove", function (e) { if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    window.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
  }

  /* ── "İçeride neler var": etkileşimli tur + "ve çok daha fazlası" ───── */
  // Her satır: uygulamada o özelliği gösteren ekran (app-mock-tour.js) + liste simgesi.
  // Başlık/açıklama `f<n>t` / `f<n>d` anahtarlarından (n = satır sırası).
  var TOUR = [
    { screen: "series", icon: "film" }, { screen: "discover", icon: "compass" }, { screen: "ai", icon: "sparkles" },
    { screen: "stats", icon: "bars" }, { screen: "chat", icon: "people" }, { screen: "game", icon: "gamepad" },
    { screen: "lists", icon: "list" }, { screen: "story", icon: "image" }, { screen: "custom", icon: "sliders" },
  ];
  var MORE_ICONS = ["apps", "calendar", "bell", "star", "download", "user", "heart", "play", "trophy", "shield", "clock", "share"];
  var tour = { phone: null, index: 0, autoplay: true, visible: false, built: false };

  function icon(name, size) { return window.AppMock ? window.AppMock.helpers.ic(name, size) : ""; }

  function renderTour() {
    var list = $("#tourList");
    if (!list) return;
    if (!tour.built) {
      list.innerHTML = TOUR.map(function (item, i) {
        return '<button type="button" role="tab" class="tour-item" data-i="' + i + '" id="tour-tab-' + i + '" aria-controls="tourPhone">' +
          '<span class="tour-ico">' + icon(item.icon, 21) + '</span><span class="tour-t"></span><span class="tour-d"></span><span class="tour-bar"><i></i></span></button>';
      }).join("");
      tour.built = true;
    }
    Array.prototype.forEach.call(list.children, function (btn, i) {
      btn.querySelector(".tour-t").textContent = t("f" + (i + 1) + "t");
      btn.querySelector(".tour-d").textContent = t("f" + (i + 1) + "d");
      var on = i === tour.index;
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
      btn.tabIndex = on ? 0 : -1;
    });
    var cap = $("#tourCap");
    if (cap) cap.textContent = t("f" + (tour.index + 1) + "d");
  }

  /* Otomatik ilerleme yalnızca bölüm görünürken, sekme açıkken ve hareket azaltma kapalıyken
     çalışır; kullanıcı listeye ya da telefona dokunur dokunmaz bir daha başlamaz. */
  function updatePlaying() {
    var box = $("#tour");
    if (!box) return;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    box.classList.toggle("playing", tour.autoplay && tour.visible && !reduce && !document.hidden);
  }

  function selectTour(i, byUser) {
    tour.index = i;
    if (byUser) tour.autoplay = false;
    if (tour.phone) tour.phone.show(TOUR[i].screen);
    renderTour();
    updatePlaying();
    // Telefonda liste yatay çip satırıdır: seçilen çip görünür alanda ortalansın.
    var list = $("#tourList");
    var btn = list && list.children[i];
    if (btn && list.scrollWidth > list.clientWidth + 4) {
      list.scrollTo({ left: btn.offsetLeft - (list.clientWidth - btn.offsetWidth) / 2, behavior: "smooth" });
    }
  }

  function setupTour() {
    var AM = window.AppMock;
    var host = $("#tourPhone");
    var list = $("#tourList");
    var box = $("#tour");
    if (!AM || !host || !list || !box) return;
    tour.phone = AM.create(host, { tabs: false, screen: TOUR[0].screen });
    AM.fit(host, 1.0, 1.0);
    renderTour();

    list.addEventListener("click", function (ev) {
      var btn = ev.target.closest(".tour-item");
      if (btn) selectTour(+btn.dataset.i, true);
    });
    list.addEventListener("keydown", function (ev) {
      var step = ev.key === "ArrowDown" || ev.key === "ArrowRight" ? 1 : ev.key === "ArrowUp" || ev.key === "ArrowLeft" ? -1 : 0;
      if (!step) return;
      ev.preventDefault();
      var next = (tour.index + step + TOUR.length) % TOUR.length;
      selectTour(next, true);
      var btn = list.children[next];
      if (btn) btn.focus();
    });
    list.addEventListener("animationend", function (ev) {
      if (ev.animationName === "tour-fill") selectTour((tour.index + 1) % TOUR.length, false);
    });
    host.addEventListener("pointerdown", function () { tour.autoplay = false; updatePlaying(); });
    document.addEventListener("visibilitychange", updatePlaying);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        tour.visible = entries[0].isIntersecting;
        updatePlaying();
      }, { threshold: 0.35 }).observe(box);
    }
  }

  function renderMore() {
    var grid = $("#moreGrid");
    if (!grid) return;
    grid.innerHTML = MORE_ICONS.map(function (name, i) {
      return '<article class="more-tile"><span class="more-ico">' + icon(name, 20) + "</span><div><h4>" + t("mo" + (i + 1) + "t") + "</h4><p>" + t("mo" + (i + 1) + "d") + "</p></div></article>";
    }).join("");
  }

  /* ── Etkileşimli uygulama maketi (hero) ─────────────────────────── */
  function setupPhones() {
    var AM = window.AppMock;
    if (!AM) return;
    AM.setLang(lang);
    var front = $("#phoneFront");
    var back = $("#phoneBack");
    if (front) { AM.create(front, { tabs: true, screen: "movies" }); AM.fit(front, 1.05, 0.64); }
    if (back) { AM.create(back, { tabs: false, screen: "hub" }); AM.fit(back, 1.05, 0.64); }
  }

  /* ── Başlat ─────────────────────────────────────────────────────── */
  menu = SL.mountMenu($("#langMenu"), lang, setLang, t("langLabel"));
  applyI18n();
  setupPhones();
  setupTour();
  setupForm();
  setupBeta();
  buildPosters();
  setupChrome();
  setupEyes();

  var saved = LS.get("wf_ticket", null);
  if (saved && saved.email && saved.queueNo) {
    okState = { email: saved.email, queueNo: saved.queueNo, exists: false };
    renderOk();
  }

  var savedBeta = LS.get("wf_beta_ticket", null);
  if (savedBeta && savedBeta.email && Array.isArray(savedBeta.platforms)) {
    var known = savedBeta.platforms.filter(function (p) { return BETA_PLATFORMS[p]; });
    if (known.length) {
      betaState = { email: savedBeta.email, platforms: known, exists: true };
      renderBeta();
    }
  }

  /* Sayaç: sayfa boşa çıkınca oku (kritik değil). */
  var readCount = function () {
    withTimeout(store.getCount(), 6000).then(function (n) {
      countValue = n;
      renderCount();
    }).catch(function (err) { console.warn("Waitlist count unavailable:", err && err.message); });
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(readCount, { timeout: 2500 });
  else setTimeout(readCount, 1200);
})();
