/* site-beacon.js — çerezsiz ziyaret sayacı (sonuçlar: admin.html, yalnız siteAdmins).
 *
 * Gönderilen her şey bir sayım olayıdır; sunucu (functions/siteStats.js) yalnız GÜNLÜK TOPLAM yazar:
 *   görüntüleme  { t:"v", p:sayfa, r:yönlendiren, c:utm_campaign, tz:saat dilimi, l:tarayıcı dili, sl:site dili,
 *                  d:cihaz, o:işletim sistemi, b:tarayıcı, w:ekran sınıfı, s:yeni oturum, n:bugünün ilk ziyareti,
 *                  f:ilk ziyaret, g:son ziyaretten bu yana gün }
 *   süre         { t:"e", sec }  sayfa gizlenince, görünür kalınan saniye (sekme arka plandayken sayılmaz)
 *   ilgi         { t:"g", r }    oturum 15 sn görünür kaldı (oturum başına bir kez; r = oturumun giriş kaynağı)
 *   kaydırma     { t:"s", d }    sayfanın %25/50/75/100'ü görüldü (görüntüleme başına her eşik bir kez)
 *   etkileşim    { t:"a", a, r, tz, d, l }  izinli eylem adı (sunucuda ACTIONS); kayıt başarıları dahil
 * Çerez, kimlik, IP kaydı yok; ülke saat diliminden tahmin edilir. Tarayıcıda yalnız iki bayrak tutulur:
 * localStorage "wf_visit" ({ day, since }) ve sessionStorage "wf_session" ({ r: giriş kaynağı }). Do Not Track /
 * Global Privacy Control açıksa ve yerel geliştirmede (localhost) hiç çalışmaz. Gizlilik: privacy.html "Web sitesi".
 *
 * Sayfa kodu eylemi `(window.__wfq = window.__wfq || []).push("waitlist_ok")` ile bildirir; sayaç yüklenince
 * kuyruğu boşaltır ve sonrakileri doğrudan gönderir (sayaç çalışmıyorsa kuyruk sessizce bekler, zarar yok).
 */
(function () {
  "use strict";

  var ENDPOINT = "/api/beacon";
  var HOSTS = /^(www\.)?seelogd\.com$|^movieandtv-2832a\.(web\.app|firebaseapp\.com)$/;
  var nav = window.navigator || {};

  if (!HOSTS.test(location.hostname)) return;
  if (nav.doNotTrack === "1" || window.doNotTrack === "1" || nav.globalPrivacyControl === true) return;
  if (nav.webdriver || /bot|crawl|spider|headless|lighthouse/i.test(nav.userAgent || "")) return;

  function store(kind) {
    try { return window[kind]; } catch (e) { return null; }
  }
  function read(kind, key) {
    var s = store(kind);
    try { return s ? JSON.parse(s.getItem(key)) : null; } catch (e) { return null; }
  }
  function write(kind, key, value) {
    var s = store(kind);
    try { if (s) s.setItem(key, JSON.stringify(value)); } catch (e) { /* gizli pencere: sayım yine gider */ }
  }

  function send(payload) {
    var body = JSON.stringify(payload);
    try {
      // text/plain: aynı köken, ön uçuş isteği yok; sendBeacon sayfa kapanırken de gider.
      if (nav.sendBeacon && nav.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }))) return;
    } catch (e) { /* fetch'e düş */ }
    try { fetch(ENDPOINT, { method: "POST", body: body, keepalive: true, headers: { "Content-Type": "text/plain" } }); } catch (e) { /* sayılamadı */ }
  }

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function dayKey(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  var now = new Date();
  var today = dayKey(now);

  var visit = read("localStorage", "wf_visit");
  var firstEver = !visit || !visit.day;
  var newToday = firstEver || visit.day !== today;
  var gapDays = 0;
  if (!firstEver && newToday) {
    var last = Date.parse(visit.day + "T00:00:00");
    if (isFinite(last)) gapDays = Math.max(1, Math.round((Date.parse(today + "T00:00:00") - last) / 86400000));
  }
  write("localStorage", "wf_visit", { day: today, since: (visit && visit.since) || today });

  var path = location.pathname.replace(/\/+$/, "") || "/";
  var page = path === "/" || /\/index(\.html)?$/.test(path) ? "index"
    : /privacy/.test(path) ? "privacy"
    : /terms/.test(path) ? "terms"
    : /delete-account/.test(path) ? "delete"
    : "other";

  var ref = "";
  var campaign = "";
  try {
    var params = new URLSearchParams(location.search);
    var utm = params.get("utm_source");
    if (utm) {
      ref = "utm:" + utm.slice(0, 40);
      campaign = (params.get("utm_campaign") || "").slice(0, 40);
    } else if (document.referrer) {
      var host = new URL(document.referrer).hostname;
      if (host !== location.hostname) ref = host;
    }
  } catch (e) { /* boş = doğrudan */ }

  // Oturumun GİRİŞ kaynağı: sonraki sayfalarda ve kayıt anında aynı kaynağa yazılsın (kimlik değil, yalnız kaynak adı).
  var session = read("sessionStorage", "wf_session");
  var newSession = !session;
  // Eski sürümün bayrağı (1) ya da bozuk değer: oturum sürer ama kaynağı bilinmez.
  if (newSession || typeof session !== "object") {
    session = { r: newSession ? ref : "" };
    write("sessionStorage", "wf_session", session);
  }
  var entryRef = typeof session.r === "string" ? session.r : "";

  var ua = nav.userAgent || "";
  var touchMac = /Macintosh/.test(ua) && nav.maxTouchPoints > 1; // iPadOS masaüstü kimliğiyle gelir
  var device = /iPad|Tablet/i.test(ua) || touchMac || (/Android/i.test(ua) && !/Mobile/i.test(ua)) ? "tablet"
    : /Mobi|iPhone|iPod|Android/i.test(ua) ? "mobile"
    : "desktop";
  var os = /iPhone|iPad|iPod/i.test(ua) || touchMac ? "ios"
    : /Android/i.test(ua) ? "android"
    : /Windows/i.test(ua) ? "windows"
    : /Mac OS X|Macintosh/i.test(ua) ? "macos"
    : /Linux|CrOS/i.test(ua) ? "linux"
    : "other";
  // Sıra önemli: uygulama içi tarayıcılar ve türev tarayıcılar Chrome/Safari kimliğini de taşır.
  var browser = /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Twitter|LinkedInApp|Snapchat|Line\//i.test(ua) ? "inapp"
    : /SamsungBrowser/i.test(ua) ? "samsung"
    : /Edg(e|A|iOS)?\//i.test(ua) ? "edge"
    : /OPR\/|Opera/i.test(ua) ? "opera"
    : /Firefox|FxiOS/i.test(ua) ? "firefox"
    : /Chrome|CriOS|Chromium/i.test(ua) ? "chrome"
    : /Safari/i.test(ua) ? "safari"
    : "other";
  var width = Math.min(window.innerWidth || 0, (window.screen && window.screen.width) || Infinity);
  var screenClass = width && width < 600 ? "s" : width && width < 1024 ? "m" : width ? "l" : "";

  var tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* bilinmiyor */ }
  var browserLang = nav.language || "";
  function siteLang() { return (document.documentElement.getAttribute("lang") || "").slice(0, 2).toLowerCase(); }

  send({
    t: "v", p: page, r: ref, c: campaign || undefined, tz: tz, l: browserLang, sl: siteLang(), d: device, o: os,
    b: browser, w: screenClass, s: newSession, n: newToday, f: firstEver, g: gapDays || undefined,
  });

  /* ── Etkileşimler ─────────────────────────────────────────────────── */
  var sentOnce = {};
  function action(name, once) {
    if (typeof name !== "string" || !name) return;
    if (once) {
      if (sentOnce[name]) return;
      sentOnce[name] = 1;
    }
    send({ t: "a", a: name, r: entryRef, tz: tz, d: device, l: siteLang() });
  }

  // Sayfa kodunun kuyruğu (home.js kayıt sonucu vb.).
  var queue = window.__wfq;
  window.__wfq = { push: function (name) { action(name); return 0; } };
  if (queue && typeof queue.length === "number") for (var qi = 0; qi < queue.length; qi += 1) action(queue[qi]);

  // Tıklamalar: tek bir dinleyici; yalnız bilinen öğeler sayılır.
  document.addEventListener("click", function (ev) {
    var el = ev.target && ev.target.closest ? ev.target : null;
    if (!el) return;
    var hit;
    if ((hit = el.closest("#tabBeta"))) return action("tab_beta");
    if ((hit = el.closest("#tabNotify"))) return action("tab_notify");
    if ((hit = el.closest("[data-store]"))) return action(hit.getAttribute("data-store") === "apple" ? "store_apple" : "store_google");
    if ((hit = el.closest("#phoneFront, #phoneBack"))) return action("mock_use", true);
    if ((hit = el.closest("a[href]"))) {
      var href = hit.getAttribute("href") || "";
      if (/instagram\.com|tiktok\.com|x\.com|twitter\.com|youtube\.com|threads\.(net|com)|bsky\.app|reddit\.com|linkedin\.com/i.test(href)) return action("out_social");
      if (href.charAt(0) === "#" && hit.closest("header, nav")) return action("nav_click");
    }
    return undefined;
  }, true);

  document.addEventListener("submit", function (ev) {
    var form = ev.target;
    if (!form || !form.id) return;
    if (form.id === "joinForm") action("waitlist_try");
    else if (form.id === "betaForm") action("beta_try");
  }, true);

  // SSS: <details> açılınca (kapanış sayılmaz). toggle kabarcıklanmaz → yakalama evresi.
  document.addEventListener("toggle", function (ev) {
    var d = ev.target;
    if (d && d.tagName === "DETAILS" && d.open && d.closest && d.closest("#faq")) action("faq_open");
  }, true);

  /* ── Bölüm görüntüleme ve kaydırma derinliği (görüntüleme başına bir kez) ─────────── */
  if (page === "index" && "IntersectionObserver" in window) {
    var SECTIONS = { numbers: "sec_numbers", screens: "sec_screens", features: "sec_features", plans: "sec_plans", faq: "sec_faq" };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var key = en.target.getAttribute("data-wf-sec");
        if (key) action(key, true);
        io.unobserve(en.target);
      });
    }, { threshold: 0.35 });
    var observeAll = function () {
      Object.keys(SECTIONS).forEach(function (id) {
        var el = document.getElementById(id) || (id === "numbers" ? document.querySelector(".numbers, [aria-labelledby='numTitle']") : null);
        if (el && el.offsetParent !== null) { el.setAttribute("data-wf-sec", SECTIONS[id]); io.observe(el); }
      });
      var foot = document.querySelector("footer");
      if (foot) { foot.setAttribute("data-wf-sec", "sec_footer"); io.observe(foot); }
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", observeAll);
    else observeAll();
  }

  var depthSent = {};
  var scrollTimer = 0;
  function checkDepth() {
    scrollTimer = 0;
    var doc = document.documentElement;
    var total = Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0);
    if (!total) return;
    var seen = (window.scrollY || doc.scrollTop || 0) + (window.innerHeight || doc.clientHeight || 0);
    var share = Math.min(1, seen / total);
    [25, 50, 75, 100].forEach(function (d) {
      if (!depthSent[d] && share >= (d === 100 ? 0.98 : d / 100)) {
        depthSent[d] = 1;
        send({ t: "s", d: d });
      }
    });
  }
  window.addEventListener("scroll", function () { if (!scrollTimer) scrollTimer = setTimeout(checkDepth, 400); }, { passive: true });
  setTimeout(checkDepth, 1500); // kısa sayfalar kaydırmadan da eşik geçebilir

  /* ── Görünür kalınan süre + ilgi eşiği ───────────────────────────────── */
  var ENGAGED_MS = 15000;
  var engagedSent = !!(session && session.g);
  var visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
  var pending = 0;
  var sessionVisible = Number(session && session.v) || 0;
  function markEngaged() {
    if (engagedSent) return;
    var live = visibleSince ? Date.now() - visibleSince : 0;
    if (sessionVisible + pending + live < ENGAGED_MS) return;
    engagedSent = true;
    session.g = 1;
    write("sessionStorage", "wf_session", session);
    send({ t: "g", r: entryRef });
  }
  var engagedTimer = setInterval(function () {
    markEngaged();
    if (engagedSent) clearInterval(engagedTimer);
  }, 2500);

  function flush() {
    if (visibleSince) { pending += Date.now() - visibleSince; visibleSince = 0; }
    markEngaged();
    var sec = Math.floor(pending / 1000);
    if (sec >= 1) {
      send({ t: "e", sec: sec });
      sessionVisible += sec * 1000;
      if (!engagedSent) { session.v = sessionVisible; write("sessionStorage", "wf_session", session); }
      pending -= sec * 1000;
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
    else if (!visibleSince) visibleSince = Date.now();
  });
  window.addEventListener("pagehide", flush);
})();
