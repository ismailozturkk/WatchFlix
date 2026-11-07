/* site-beacon.js — çerezsiz ziyaret sayacı (sonuçlar: admin.html, yalnız siteAdmins).
 *
 * Gönderilen tek şey bir sayım olayıdır; sunucu (functions/siteStats.js) yalnız GÜNLÜK TOPLAM yazar:
 *   görüntüleme  { t:"v", p:sayfa, r:yönlendiren, tz:saat dilimi, l:tarayıcı dili, d:cihaz, o:işletim sistemi,
 *                  s:yeni oturum, n:bugünün ilk ziyareti, f:ilk ziyaret }
 *   süre         { t:"e", sec }  sayfa gizlenince, görünür kalınan saniye (sekme arka plandayken sayılmaz)
 * Çerez, kimlik, IP kaydı yok; ülke saat diliminden tahmin edilir. Tarayıcıda yalnız iki bayrak tutulur:
 * localStorage "wf_visit" ({ day, since }) ve sessionStorage "wf_session". Do Not Track / Global Privacy
 * Control açıksa ve yerel geliştirmede (localhost) hiç çalışmaz. Gizlilik: privacy.html "Web sitesi".
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
  var now = new Date();
  var today = now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());

  var visit = read("localStorage", "wf_visit");
  var firstEver = !visit || !visit.day;
  var newToday = firstEver || visit.day !== today;
  write("localStorage", "wf_visit", { day: today, since: (visit && visit.since) || today });

  var newSession = !read("sessionStorage", "wf_session");
  if (newSession) write("sessionStorage", "wf_session", 1);

  var path = location.pathname.replace(/\/+$/, "") || "/";
  var page = path === "/" || /\/index(\.html)?$/.test(path) ? "index"
    : /privacy/.test(path) ? "privacy"
    : /terms/.test(path) ? "terms"
    : /delete-account/.test(path) ? "delete"
    : "other";

  var ref = "";
  try {
    var utm = new URLSearchParams(location.search).get("utm_source");
    if (utm) ref = "utm:" + utm.slice(0, 40);
    else if (document.referrer) {
      var host = new URL(document.referrer).hostname;
      if (host !== location.hostname) ref = host;
    }
  } catch (e) { /* boş = doğrudan */ }

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

  var tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { /* bilinmiyor */ }

  send({ t: "v", p: page, r: ref, tz: tz, l: nav.language || "", d: device, o: os, s: newSession, n: newToday, f: firstEver });

  /* Görünür kalınan süre: sekme önde olduğu sürece birikir, her gizlenişte gönderilip sıfırlanır. */
  var visibleSince = document.visibilityState === "visible" ? Date.now() : 0;
  var pending = 0;
  function flush() {
    if (visibleSince) { pending += Date.now() - visibleSince; visibleSince = 0; }
    var sec = Math.floor(pending / 1000);
    if (sec >= 1) { send({ t: "e", sec: sec }); pending -= sec * 1000; }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") flush();
    else if (!visibleSince) visibleSince = Date.now();
  });
  window.addEventListener("pagehide", flush);
})();
