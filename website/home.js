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
  var LOCALES = {
    tr: "tr-TR", en: "en-GB", es: "es-ES", pt: "pt-BR", de: "de-DE",
    it: "it-IT", fr: "fr-FR", ja: "ja-JP", zh: "zh-CN", hi: "hi-IN", id: "id-ID", ko: "ko-KR",
  };

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
    renderReel();
  }

  /* Sayaç olayı (site-beacon.js): yalnız eylem ADI gider, e-posta ya da kimlik gitmez. Sayaç yüklenmemişse
     ya da DNT açıksa kuyrukta kalır, hiçbir yere gönderilmez. Adlar functions/siteStats.js ACTIONS listesinde. */
  function track(name) {
    try { (window.__wfq = window.__wfq || []).push(name); } catch (e) { /* sayılamadı */ }
  }

  function setLang(next) {
    if (next === lang) return;
    track("lang_change");
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

  /* Katılım kartı iki yol sunar: "notify" (yayın günü e-posta) ve "beta" (şimdi test et;
     beta kaydı aynı e-postayı yayın listesine de ekler). */
  function setJoinMode(mode) {
    var box = $("#notify");
    if (!box) return;
    mode = mode === "beta" ? "beta" : "notify";
    box.setAttribute("data-mode", mode);
    $$(".join-tab").forEach(function (tab) {
      var on = tab.getAttribute("data-mode") === mode;
      tab.setAttribute("aria-selected", on ? "true" : "false");
      tab.tabIndex = on ? 0 : -1;
    });
    var paneNotify = $("#paneNotify");
    var paneBeta = $("#betaCard");
    if (paneNotify) paneNotify.hidden = mode !== "notify";
    if (paneBeta) paneBeta.hidden = mode !== "beta";
  }

  function focusJoin(mode) {
    setJoinMode(mode);
    var box = $("#notify");
    if (box) box.scrollIntoView({ behavior: "smooth", block: "center" });
    var beta = mode === "beta";
    var pane = beta ? $("#betaCard") : $("#paneNotify");
    if (!pane || pane.classList.contains("done")) return;
    var target = beta
      ? (document.querySelector('#betaForm input[name="platform"]:checked') ? $("#betaEmail") : document.querySelector('#betaForm input[name="platform"]'))
      : $("#emailInput");
    if (target) setTimeout(function () { target.focus({ preventScroll: true }); }, 450);
  }

  function setupJoin() {
    var tabs = $$(".join-tab");
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { setJoinMode(tab.getAttribute("data-mode")); });
      tab.addEventListener("keydown", function (ev) {
        if (ev.key !== "ArrowRight" && ev.key !== "ArrowLeft") return;
        ev.preventDefault();
        var next = tabs[(i + (ev.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
        setJoinMode(next.getAttribute("data-mode"));
        next.focus();
      });
    });
    // seelogd.com/#beta (Instagram bio vb.) beta sekmesiyle açılır.
    if (location.hash === "#beta") {
      setJoinMode("beta");
      var box = document.getElementById("notify");
      // Yükleme sırasında (maket/afiş yerleşirken) yumuşak kaydırma kesiliyor: sayfa
      // yüklenince anında kaydır.
      var jump = function () { if (box) box.scrollIntoView({ block: "center", behavior: "instant" }); };
      if (document.readyState === "complete") setTimeout(jump, 60);
      else window.addEventListener("load", function () { setTimeout(jump, 60); });
    }
  }

  document.addEventListener("click", function (ev) {
    if (!ev.target.closest) return;
    var soon = ev.target.closest(".store.is-soon");
    if (soon) { ev.preventDefault(); focusJoin("notify"); return; }
    var toBeta = ev.target.closest('[data-join="beta"], a[href="#beta"]');
    if (toBeta) { ev.preventDefault(); focusJoin("beta"); if (history.replaceState) history.replaceState(null, "", "#beta"); return; }
    var toNotify = ev.target.closest('a[href="#notify"]');
    if (toNotify) { ev.preventDefault(); focusJoin("notify"); }
  });

  /* ── 3) Bekleme listesi ─────────────────────────────────────────── */
  var LS = {
    get: function (k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* yoksay */ } },
  };
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* Gizlilik: tarayıcıda e-postanın kendisi SAKLANMAZ. Bilet (wf_ticket /
     wf_beta_ticket) yalnız maskeli gösterimi ("is•••@gmail.com"), eşitlik
     karşılaştırması için kısa bir özeti ve sıra numarasını tutar. */
  function maskEmail(email) {
    var at = String(email || "").lastIndexOf("@");
    if (at < 1) return "•••";
    var local = email.slice(0, at);
    return local.slice(0, local.length > 2 ? 2 : 1) + "•••" + email.slice(at);
  }
  function emailKey(email) { // FNV-1a 32 bit: yalnız "aynı adres mi?" sorusu için
    var h = 0x811c9dc5, s = String(email || "");
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  /* Eski biletlerde düz e-posta vardı: okurken maskeli biçime çevirip yeniden yaz. */
  function readTicket(key) {
    var v = LS.get(key, null);
    if (!v || typeof v !== "object") return null;
    if (v.email) {
      v.m = maskEmail(v.email);
      v.h = emailKey(v.email);
      delete v.email;
      LS.set(key, v);
    }
    return v.h ? v : null;
  }
  /* Kural gereği kayıtlar herkese okunmaz ve var olan kayıt değiştirilemez:
     aynı adresle ikinci yazma "permission-denied" döner = zaten listede. */
  function isAlreadyListed(err) {
    return !!err && (err.code === "permission-denied" || /permission/i.test(String(err.message || "")));
  }
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
        // Kayıt okunmaz (kural: get yalnız yönetici) — doğrudan yazılır; var olan
        // kayıt reddedilir. Sıra numarası o zaman yalnız bu tarayıcının biletinden gelir.
        return fs.getDoc(fs.doc(db.app, "meta", "waitlist")).then(function (countSnap) {
          var queueNo = store.base() + (countSnap.exists() ? countSnap.data().count || 0 : 0) + 1;
          return fs.setDoc(ref, { email: email, createdAt: fs.serverTimestamp(), source: "landing", queueNo: queueNo })
            .then(function () {
              return fs.setDoc(fs.doc(db.app, "meta", "waitlist"), { count: fs.increment(1) }, { merge: true })
                .then(function () { return { email: email, queueNo: queueNo, exists: false }; });
            }, function (err) {
              if (!isAlreadyListed(err)) throw err;
              var tk = readTicket("wf_ticket");
              return { email: email, queueNo: tk && tk.h === emailKey(email) ? tk.queueNo || null : null, exists: true };
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
    var notify = $("#paneNotify");
    if (!panel || !notify) return;
    if (!okState) { panel.hidden = true; notify.classList.remove("done"); return; }
    $("#okText").textContent = okState.exists ? t("okDup") : fmt(t("okText"), { email: okState.email });
    var okWrap = $("#okNoWrap");
    if (okWrap) okWrap.hidden = !okState.queueNo;
    if (okState.queueNo) $("#okNo").textContent = "#" + String(okState.queueNo).padStart(6, "0");
    panel.hidden = false;
    notify.classList.add("done");
  }

  function saveTicket(res) {
    // Numarası bilinmeyen yineleme kaydı, bu adresin eski biletini silmesin.
    if (!res.queueNo) return;
    LS.set("wf_ticket", { m: maskEmail(res.email), h: emailKey(res.email), queueNo: res.queueNo });
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
        track(res.exists ? "waitlist_dup" : "waitlist_ok");
        okState = res;
        saveTicket(res);
        if (!res.exists && countValue != null && res.queueNo > countValue) countValue = res.queueNo;
        renderOk();
        renderCount();
      }).catch(function (err) {
        console.error("Waitlist error:", err);
        track("waitlist_err");
        msg.textContent = t("errGeneric");
      }).then(function () { btn.disabled = false; });
    });
  }

  /* ── 3b) Test kullanıcısı (kapalı test) ─────────────────────────── */
  /* Kayıt: betaTesters/{base64(email)}_{platform}. Aynı kişi iki platforma ayrı
     ayrı yazılabilir. Alanlar firestore.rules'taki betaTesters kuralıyla birebir:
     { email, platform, lang, createdAt, source }. Alan eklersen kuralı da güncelle. */
  var BETA_PLATFORMS = { android: "Android", ios: "iOS" };
  var SITE_LANGS = ["tr", "en", "es", "pt", "de", "it", "fr", "ja", "zh", "hi", "id", "ko"];
  var betaState = null; // { email, platforms: ["android"|"ios"], exists }

  /* Bu tarayıcıdan yapılan kayıt (bekleme listesindeki wf_ticket gibi): sayfa
     yenilenince form yerine "zaten listedesin" görünür. Farklı e-postayla
     yeni kayıt eskisinin yerine geçer. */
  function saveBetaTicket(res) {
    var prev = readTicket("wf_beta_ticket");
    var h = emailKey(res.email);
    var platforms = prev && prev.h === h && Array.isArray(prev.platforms) ? prev.platforms.slice() : [];
    if (platforms.indexOf(res.platform) === -1) platforms.push(res.platform);
    LS.set("wf_beta_ticket", { m: maskEmail(res.email), h: h, platforms: platforms });
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
      var payload = { email: email, platform: platform, createdAt: fs.serverTimestamp(), source: "landing" };
      if (SITE_LANGS.indexOf(lang) !== -1) payload.lang = lang; // firestore.rules betaTesters ile aynı liste
      // Okuma yok (kural: get yalnız yönetici); var olan kayıt reddedilir = zaten listede.
      return fs.setDoc(ref, payload)
        .then(function () { return { email: email, platform: platform, exists: false }; }, function (err) {
          if (!isAlreadyListed(err)) throw err;
          return { email: email, platform: platform, exists: true };
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
      // Platform seçilmeden ipucu yok (kart kompakt kalsın); seçilince hangi e-postanın gerektiği yazar.
      hint.textContent = p === "android" ? t("betaHintAndroid") : p === "ios" ? t("betaHintIos") : "";
    }
    var card = $("#betaCard");
    var panel = $("#betaOk");
    if (!card || !panel) return;
    if (!betaState) { panel.hidden = true; card.classList.remove("done"); return; }
    $("#betaOkText").textContent = fmt(t(betaState.exists ? "betaOkDup" : "betaOkText"), {
      email: betaState.email,
      platform: betaPlatformLabel(betaState.platforms),
    });
    var noWrap = $("#betaNoWrap");
    if (noWrap) {
      noWrap.hidden = !betaState.queueNo;
      if (betaState.queueNo) $("#betaNo").textContent = "#" + String(betaState.queueNo).padStart(6, "0");
    }
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
        track(res.exists ? "beta_dup" : res.platform === "ios" ? "beta_ok_ios" : "beta_ok_android");
        var platforms = saveBetaTicket(res);
        // Yeni kayıtta yalnız bu platform anılır; yinelenende kayıtlı olanların tümü.
        betaState = { email: res.email, platforms: res.exists ? platforms : [res.platform], exists: res.exists, queueNo: null };
        // Beta'ya kaydolan yayın günü de haber alsın: aynı e-posta bekleme listesine yazılır.
        // Bu adım başarısız olsa da beta kaydı geçerlidir (yalnız sıra numarası görünmez).
        return withTimeout(store.addEmail(email), 12000).then(function (wl) {
          okState = wl;
          saveTicket(wl);
          if (!wl.exists && countValue != null && wl.queueNo > countValue) countValue = wl.queueNo;
          betaState.queueNo = wl.queueNo;
          renderOk();
          renderCount();
        }).catch(function (err) {
          console.warn("Waitlist (from beta) error:", err && err.message);
        }).then(function () { renderBeta(); });
      }).catch(function (err) {
        console.error("Beta signup error:", err);
        track("beta_err");
        msg.textContent = t("errGeneric");
      }).then(function () { btn.disabled = false; });
    });

    $("#betaAgain").addEventListener("click", function () {
      var ticket = readTicket("wf_beta_ticket");
      var done = ticket && Array.isArray(ticket.platforms) ? ticket.platforms : [];
      betaState = null;
      renderBeta();
      // Henüz kayıtlı olmayan platformu önceden seç: "ikinci cihaz" en sık durum.
      var next = Object.keys(BETA_PLATFORMS).filter(function (p) { return done.indexOf(p) === -1; })[0];
      var radio = next && form.querySelector('input[name="platform"][value="' + next + '"]');
      if (radio) { radio.checked = true; renderBeta(); }
      // E-posta tarayıcıda saklanmaz; bu oturumda yazılmışsa alanda zaten duruyor.
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

  /* "Çok daha fazlası" — görsel döşemeler (6 Kas). Metin kartta yalnız başlık; açıklama karta
     dokununca ayrıntı penceresinde (peek) açılır. `k` = home-i18n.js'teki mo<k>t / mo<k>d.
     img: media/t-*.webp (kapalı test ekranından kırpım); ani: simge döşemesinin hareketi. */
  var MORE = [
    { k: 1, img: "tier" },
    { k: 13, icon: "swap", ani: "sway", c: ["#ff3d5e", "#ff8a5c"] },
    { k: 6, icon: "flame", ani: "flicker", c: ["#ffb347", "#ff3d5e"] },
    { k: 4, img: "top100" },
    { k: 3, img: "league" },
    { k: 2, icon: "ticket", ani: "float", c: ["#8b7cf6", "#14c8e8"] },
    { k: 14, img: "graph" },
    { k: 9, icon: "star", ani: "twinkle", c: ["#ffc247", "#ff8a5c"] },
    { k: 12, icon: "heart", ani: "beat", c: ["#ff5c8a", "#8b7cf6"] },
    { k: 15, img: "badge" },
    { k: 16, img: "tournament" },
    { k: 8, icon: "bell", ani: "ring", c: ["#14c8e8", "#138df0"] },
    { k: 5, img: "challenges" },
    { k: 7, icon: "apps", ani: "pop", c: ["#3ddc97", "#14c8e8"] },
    { k: 11, img: "people" },
    { k: 10, icon: "download", ani: "drop", c: ["#138df0", "#8b7cf6"] },
  ];
  // Döşemenin küçük simgesi (görselli döşemelerde başlığın yanında)
  var MORE_ICON = { 1: "layers", 4: "trend-up", 3: "trophy", 14: "bars", 15: "shield", 16: "ribbon", 5: "flag", 11: "user" };

  function renderMore() {
    var grid = $("#moreGrid");
    if (!grid) return;
    grid.innerHTML = MORE.map(function (m, i) {
      var title = t("mo" + m.k + "t");
      var aria = ' aria-label="' + title.replace(/"/g, "&quot;") + " · " + t("tapMore") + '" aria-haspopup="dialog"';
      var plus = '<span class="mt-plus" aria-hidden="true"></span>';
      if (m.img) {
        return '<button type="button" class="mt mt-img" data-more="' + i + '"' + aria + '>' +
          '<img loading="lazy" decoding="async" alt="" src="media/t-' + m.img + '.webp">' +
          '<span class="mt-cap"><span class="mt-sico">' + icon(MORE_ICON[m.k] || "sparkles", 16) + "</span><b>" + title + "</b>" + plus + "</span></button>";
      }
      return '<button type="button" class="mt mt-ico" data-more="' + i + '" style="--c1:' + m.c[0] + ";--c2:" + m.c[1] + '"' + aria + '>' +
        '<span class="mt-badge ani-' + m.ani + '">' + icon(m.icon, 24) + "</span><b>" + title + "</b>" + plus + "</button>";
    }).join("");
  }

  /* ── Gerçek ekranlar şeridi (kapalı test kayıtları) ─────────────── */
  // v: media/v-<id>.mp4 + .webp (poster); s: media/s-<id>.webp (durağan ekran). t/d: i18n anahtarları.
  var REEL = [
    { v: "open", t: "rOpenT", d: "rOpenD" },
    { v: "swipe", t: "mo13t", d: "mo13d" },
    { s: "cinematch", t: "f3t", d: "f3d" },
    { v: "search", t: "f2t", d: "f2d" },
    { v: "stats", t: "f4t", d: "f4d" },
    { s: "story", t: "f8t", d: "f8d" },
    { v: "badges", t: "mo15t", d: "mo15d" },
    { v: "custom", t: "f9t", d: "f9d" },
  ];
  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)");
  var reelIO = null;

  function reelMedia(r, big) {
    if (r.s) return '<img ' + (big ? "" : 'loading="lazy" ') + 'decoding="async" alt="" src="media/s-' + r.s + '.webp">';
    return '<video muted loop playsinline preload="none" aria-hidden="true" poster="media/v-' + r.v + '.webp" data-src="media/v-' + r.v + '.mp4"' +
      (big && REDUCE.matches ? " controls" : "") + "></video>";
  }

  function playIfVisible(video, on) {
    if (!video) return;
    if (on && !REDUCE.matches) {
      if (!video.src) video.src = video.getAttribute("data-src");
      var p = video.play();
      if (p && p.catch) p.catch(function () { /* otomatik oynatma engellendiyse poster kalır */ });
    } else if (!video.paused) {
      video.pause();
    }
  }

  function renderReel() {
    var host = $("#reel");
    if (!host) return;
    if (!host.children.length) {
      host.innerHTML = REEL.map(function (r, i) {
        return '<button type="button" class="reel-card" data-reel="' + i + '" aria-haspopup="dialog">' +
          '<span class="reel-phone">' + reelMedia(r, false) + "</span>" +
          '<span class="reel-cap"><b></b><span class="mt-plus" aria-hidden="true"></span></span></button>';
      }).join("");
      if ("IntersectionObserver" in window) {
        reelIO = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) { playIfVisible(en.target, en.isIntersecting); });
        }, { threshold: 0.45 });
        $$("#reel video").forEach(function (v) { reelIO.observe(v); });
      }
    }
    Array.prototype.forEach.call(host.children, function (card, i) {
      var title = t(REEL[i].t);
      card.querySelector(".reel-cap b").textContent = title;
      card.setAttribute("aria-label", title + " · " + t("tapMore"));
    });
  }

  function setupReel() {
    var host = $("#reel");
    if (!host) return;
    renderReel();
    var step = function (dir) {
      var card = host.querySelector(".reel-card");
      var w = card ? card.getBoundingClientRect().width + 18 : 260;
      host.scrollBy({ left: dir * Math.max(w, Math.floor(host.clientWidth / w) * w), behavior: "smooth" });
    };
    var prev = $("#reelPrev"), next = $("#reelNext");
    if (prev) prev.addEventListener("click", function () { step(-1); });
    if (next) next.addEventListener("click", function () { step(1); });
    var edges = function () {
      if (prev) prev.disabled = host.scrollLeft < 8;
      if (next) next.disabled = host.scrollLeft + host.clientWidth > host.scrollWidth - 8;
    };
    host.addEventListener("scroll", edges, { passive: true });
    window.addEventListener("resize", edges);
    edges();
    host.addEventListener("click", function (ev) {
      var card = ev.target.closest(".reel-card");
      if (!card) return;
      var r = REEL[+card.getAttribute("data-reel")];
      openPeek({ title: t(r.t), text: t(r.d), html: reelMedia(r, true), phone: true }, card);
    });
    // Fareyle üzerine gelince hafif eğim (yalnız fare, hareket azaltma kapalıyken)
    host.addEventListener("pointermove", function (ev) {
      if (ev.pointerType !== "mouse" || REDUCE.matches) return;
      var card = ev.target.closest(".reel-card");
      if (!card) return;
      var b = card.getBoundingClientRect();
      card.style.setProperty("--rx", ((ev.clientY - b.top) / b.height - 0.5) * -8 + "deg");
      card.style.setProperty("--ry", ((ev.clientX - b.left) / b.width - 0.5) * 10 + "deg");
    });
    host.addEventListener("pointerout", function (ev) {
      var card = ev.target.closest(".reel-card");
      if (card && !card.contains(ev.relatedTarget)) { card.style.removeProperty("--rx"); card.style.removeProperty("--ry"); }
    });
  }

  /* ── Ayrıntı penceresi (peek) ───────────────────────────────────── */
  var peekFrom = null;
  function openPeek(o, from) {
    var dlg = $("#peek");
    if (!dlg || typeof dlg.showModal !== "function") return;
    peekFrom = from || null;
    var media = $("#peekMedia");
    media.className = "peek-media" + (o.phone ? " is-phone" : "") + (o.tile ? " is-tile" : "");
    if (o.tile) media.setAttribute("style", o.tile); else media.removeAttribute("style");
    media.innerHTML = o.html;
    $("#peekTitle").textContent = o.title;
    $("#peekText").textContent = o.text;
    dlg.showModal();
    playIfVisible(media.querySelector("video"), true);
  }
  function setupPeek() {
    var dlg = $("#peek");
    if (!dlg) return;
    var close = function () { if (dlg.open) dlg.close(); };
    $("#peekClose").addEventListener("click", close);
    // Pencerenin dışına (arka plana) dokununca kapan
    dlg.addEventListener("click", function (ev) { if (ev.target === dlg) close(); });
    dlg.addEventListener("close", function () {
      var v = dlg.querySelector("video");
      if (v) { v.pause(); v.removeAttribute("src"); v.load(); }
      $("#peekMedia").innerHTML = "";
      if (peekFrom && peekFrom.focus) peekFrom.focus({ preventScroll: true });
    });
    var grid = $("#moreGrid");
    if (grid) grid.addEventListener("click", function (ev) {
      var tile = ev.target.closest(".mt");
      if (!tile) return;
      var m = MORE[+tile.getAttribute("data-more")];
      var html = m.img
        ? '<img decoding="async" alt="" src="media/t-' + m.img + '.webp">'
        : '<span class="mt-badge big ani-' + m.ani + '">' + icon(m.icon, 44) + "</span>";
      openPeek({
        title: t("mo" + m.k + "t"), text: t("mo" + m.k + "d"), html: html,
        tile: m.img ? "" : "--c1:" + m.c[0] + ";--c2:" + m.c[1],
      }, tile);
    });
  }

  /* ── Rakamlar bandı: görünür olunca sayılar sıfırdan yükselir ─────── */
  function setupCountUp() {
    var nums = $$(".num-grid b");
    if (!nums.length || REDUCE.matches || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        var el = en.target, txt = el.getAttribute("data-final") || el.textContent;
        var m = /^(\d+)(.*)$/.exec(txt);
        if (!m) return;
        el.setAttribute("data-final", txt);
        var end = +m[1], suf = m[2], t0 = performance.now(), dur = 1100 + Math.min(end, 200) * 3;
        var tick = function (now) {
          var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(end * e) + suf;
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (b) { io.observe(b); });
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

  /* Planlar: beta süresince gizli (site-config.js → showPlans). HTML'de
   * `hidden` gelir, JS çalışmasa da gizli kalır. */
  function setupPlans() {
    if (CFG.showPlans !== true) return;
    $$("[data-plans]").forEach(function (el) { el.hidden = false; });
  }

  /* ── Başlat ─────────────────────────────────────────────────────── */
  menu = SL.mountMenu($("#langMenu"), lang, setLang, t("langLabel"));
  applyI18n();
  setupPhones();
  setupTour();
  setupReel();
  setupPeek();
  setupCountUp();
  setupJoin();
  setupForm();
  setupBeta();
  buildPosters();
  setupChrome();
  setupEyes();
  setupPlans();

  // Biletler maskeli adresle geri yüklenir (eski düz e-postalı biletler burada dönüştürülür).
  var saved = readTicket("wf_ticket");
  if (saved && saved.queueNo) {
    okState = { email: saved.m, queueNo: saved.queueNo, exists: false };
    renderOk();
  }

  var savedBeta = readTicket("wf_beta_ticket");
  if (savedBeta && Array.isArray(savedBeta.platforms)) {
    var known = savedBeta.platforms.filter(function (p) { return BETA_PLATFORMS[p]; });
    if (known.length) {
      betaState = {
        email: savedBeta.m, platforms: known, exists: true,
        queueNo: saved && saved.h === savedBeta.h ? saved.queueNo : null,
      };
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
