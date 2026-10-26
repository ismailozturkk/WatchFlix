/* app-mock.js — uygulama arayüzünün etkileşimli HTML/CSS maketi.
 *
 * GERÇEK ekran görüntüsü DEĞİL: uygulamanın 26 Eki 2026 görünümünü (4 sekme + ayrık
 * CineMatch düğmesi, Tema Stüdyosu teması, Denk One / Nova Square / Audiowide yazı tipleri)
 * yeniden çizer. Metinler uygulamanın kendi çevirileridir (mock-i18n.js). Stil: app-mock.css.
 *
 * Kullanım:
 *   var phone = AppMock.create(hostEl, { tabs: true, screen: "movies" });
 *   phone.show("hub");  phone.show("ai");  AppMock.setLang("de");
 * Ekranlar `AppMock.screens` altında (app-mock-tour.js ek ekranlar kaydeder).
 * Hero telefonu sekmeli (movies · hub · library · profile + CineMatch düğmesi; Ayarlar
 * Profil'in dişlisinden açılır); "İçeride neler var" turundaki telefon sekmesiz, tek ekran gösterir.
 */
(function (root) {
  "use strict";

  var MOCK = root.MOCK_I18N || {};
  var HOME = root.HOME_I18N || {};
  var lang = "en";
  var LOCALES = { tr: "tr-TR", en: "en-GB", es: "es-ES", pt: "pt-BR", de: "de-DE" };

  /* ── Metin ve biçim ─────────────────────────────────────────────────── */
  function t(key, vars) {
    var v = (MOCK[lang] && MOCK[lang][key]);
    if (v == null) v = HOME[lang] && HOME[lang][key];
    if (v == null) v = MOCK.en && MOCK.en[key];
    if (v == null) v = HOME.en && HOME.en[key];
    if (v == null) v = key;
    return vars ? String(v).replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : "{" + k + "}"; }) : v;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function loc() { return LOCALES[lang] || "en-GB"; }
  function fmt(n) { return new Intl.NumberFormat(loc()).format(n); }
  function short(n) { return n < 1000 ? String(n) : new Intl.NumberFormat(loc(), { notation: "compact", maximumFractionDigits: 1 }).format(n); }
  function pct(x, sign) { return new Intl.NumberFormat(loc(), { style: "percent", signDisplay: sign ? "always" : "auto" }).format(x); }
  function fdate(y, m, d, opts) { return new Intl.DateTimeFormat(loc(), opts).format(new Date(y, m, d)); }

  /* ── Afişler (TMDB, en-US yolları; 26 Eki ekran görüntülerindeki yapımlar) ── */
  var IMG = "https://image.tmdb.org/t/p/";
  var MOV = {
    clayface: "9l1NuFjel2j89hiuiJbsxfblqjy", frankenstein: "g4JtvGlQO7DByTI6frUobqvSL3R", blackPhone2: "vBOpqxW0SDhACwEO2LZT29DuNG2",
    oneBattle: "lbBWwxBht4JFP5PsuJ5onpMqugW", anora: "cgXk2tNYhJZLXdBDO5DidAVzQ82", mongoose: "eSS5mvSG84UUuvtbHel5Yu3Wik4",
    secretWars: "f0YBuh4hyiAheXhh4JnJWoKi9g5",
    interstellar: "yQvGrMoipbRoddT0ZR8tPoR7NfX", inception: "xlaY2zyzMfkhk0HSC5VUwzoZPU1", avengers: "RYMX2wcKCBAr24UyPD7xwmjaTn",
    fightClub: "jSziioSwPVrOy9Yow3XhWIBDjq1", gotg: "r7vmZjiyZw9rpJMQJdXpjgiCOk9", shawshank: "9cqNxx0GxF0bflZmeSMuL5tnGzr",
    forrest: "saHP97rTPS5eLmrLQEcANmKrsFl", pulp: "vQWk5YBFWF4bZaofAbv0tShwBvQ", residentEvil: "1UKNef590A0ZaMnxsscIcWuK1Em",
    titanic: "9xjZS2rlVxm8SFx8kPC3aIGCOYQ", venom: "2uNW4WbgBXL25BAbXGLnLqX71Sw", avatar: "gKY6q7SjCkAU6FqvqWybDYgUKIF",
    // Tur ekranlarının (app-mock-tour.js) afişleri
    dune: "d5NXSklXo0qyIYkgV94XAgMIckC", ww84: "8UlWHLMpgZm9bx6QYh0NFoq67TZ", dark: "qJ2tW6WMUDux911r6m7haRef0WH",
    parasite: "7IiTTgloJzvGI1TAYymCfbfl3vT", ddlj: "2CAL2433ZeIihfX1Hb2139CX0pW", eternal: "5MwkWH9tYHv3mV9OdYTMR5qreIz"
  };
  var COL = { starWars: "pWVLFh4OuejTpUaDQbB1C4zoS2p", harryPotter: "eVPs2Y0LyvTLZn6AP5Z6O2rtiGB", avengers: "yFSIUVTCvgYrpalUktulvk3Gi5Y" };
  var TVS = {
    apothecary: "sJZcy8QsOPuRPiCfoCWVB3r9Ohg", pluribus: "z7Nga7Q9IGFWs5OEduY2gGFxnX3", wednesday: "9PFonBhy4cQy7Jz20NpMygczOkv",
    got: "1XS1oqL89opfnbLl8WnZY1O1uJx", st: "49WJfeN0moxb9IPfGn8AIqMGskD", moneyHeist: "reEMJA1uzscCbkpeRJeTT2bjqUp",
    breakingBad: "anFx9aTOOYqgS3v7x3R84Kz67ly", squid: "1QdXdRYfktUSONkl1oD5gc6Be0s", mobland: "5Xc7WpWsgflfgEMoBlf9TmWhfbH",
    reasons13: "nel144y4dIOdFFid6twN5mAX9Yd", nightManager: "1MccRnw41qQjREuZkovqP2UX1i3", office: "7DJKHzAi83BmQrWLrYYOqcoKfhR",
    greys: "gO8Fo47KV1opiutRDdBS5jclTQB", poi: "f8aIvYk5h7Z8EP3dinCmVgQFYow", shadows: "wa3ZQE9kLnqwN3vQ0NNjg1NPsCa",
    bear: "eKfVzzEazSIjJMrw9ADa2x8ksLz", reacher: "f1VCQIG2iCyOookdgOzwtUpwWC0", runningMan: "2Wmmu1MkqxJ48J7aySET9EKEjXz",
    proBono: "8wovOkYH4CBH45jH1zzkyOMDMSb", shogun: "7O4iVfOMQmdCSxhOg1WnzG1AgYT", pitt: "kvFSpESyBZMjaeOJDx7RS3P1jey",
    lanterns: "rb94rKVIzLyfWufIN7WqLvadBDH", lioness: "rzpHPSEgPTpRs8EHbygwsOw7jC0", daryl: "sP5QdW9FN18XWcA4ROz3MPAQBTx",
    mentalist: "acYXu4KaDj1NIkMgObnhe4C4a0T", fallout: "c15BtJxCXMrISLVmysdsnZUPQft", riverdale: "d8mmn9thQ5dBk2qbv6BCqGUXWK3",
    twd: "rqeYMLryjcawh2JeRpCVUDXYM5b",
    // Tur ekranları
    jl: "9yxep7oJdkj3Pla9TD9gKflRApY", bb: "ggFHVNu6YYI5L9pCfOacjizRGt", tlou: "uKvVjHNqB5VmOrdxqAt2F7J78ED",
    lm: "34FaY8qpjBAVysSfrJ1l7nrAQaD", falcon: "6kbAMLteGO8yyewYau6bJ683sw7"
  };
  var BACKDROP = { avatar: "vL5LR6WdxWPjLPFRLe133jXWsh5" };
  var PROV = [["Netflix", "rK1KljqmbvO9HQa1PBFLILWah72.png"], ["Amazon Prime Video", "gMZdpavHmxFNnLpMHwVxfqeux2g.png"], ["Disney+", "5eZ872CghnHFLB1j8grszbrx0dx.png"]];
  function img(id, w, cls) {
    return '<img' + (cls ? ' class="' + cls + '"' : "") + ' loading="lazy" decoding="async" alt="" src="' + IMG + "w" + (w || 185) + "/" + id + '.jpg">';
  }

  /* ── Simgeler (kendi çizimim; Ionicons değil) ───────────────────────── */
  var P = {
    "play": '<circle cx="12" cy="12" r="9"/><path d="M10.2 8.4l5 3.6-5 3.6z" fill="currentColor"/>',
    "play-fill": '<circle cx="12" cy="12" r="9.6" fill="currentColor" stroke="none"/><path d="M10.2 8.3l5.2 3.7-5.2 3.7z" fill="#fff" stroke="none"/>',
    "play-solid": '<path d="M7 4.5l12 7.5-12 7.5z" fill="currentColor" stroke="none"/>',
    "game": '<rect x="2.5" y="6.8" width="19" height="11.4" rx="5.7"/><path d="M7.6 10.4v4M5.6 12.4h4"/><circle cx="16.2" cy="11.4" r="1" fill="currentColor"/><circle cx="18.2" cy="13.6" r="1" fill="currentColor"/>',
    "game-fill": '<rect x="2.5" y="6.8" width="19" height="11.4" rx="5.7" fill="currentColor" stroke="none"/><path d="M7.6 10.4v4M5.6 12.4h4" stroke="#fff" stroke-width="1.8"/><circle cx="16.2" cy="11.4" r="1.1" fill="#fff" stroke="none"/><circle cx="18.2" cy="13.6" r="1.1" fill="#fff" stroke="none"/>',
    "library": '<rect x="3.5" y="4.5" width="4" height="15.5" rx="1"/><rect x="9" y="7.5" width="4" height="12.5" rx="1"/><path d="M14.6 6.6l3.6-1 3.4 13.8-3.6 1z"/><path d="M3.5 8h4M9 10.5h4"/>',
    "library-fill": '<rect x="3.5" y="4.5" width="4" height="15.5" rx="1" fill="currentColor"/><rect x="9" y="7.5" width="4" height="12.5" rx="1" fill="currentColor"/><path d="M14.6 6.6l3.6-1 3.4 13.8-3.6 1z" fill="currentColor"/>',
    "gear": '<circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.6" stroke-width="3.2" stroke-dasharray="3.2 3.4"/>',
    "user": '<circle cx="12" cy="12" r="9.5"/><circle cx="12" cy="10" r="3.2"/><path d="M5.8 18.6c1.2-3 3.4-4.4 6.2-4.4s5 1.4 6.2 4.4"/>',
    "user-fill": '<circle cx="12" cy="12" r="9.8" fill="currentColor" stroke="none"/><circle cx="12" cy="10" r="3.1" fill="#fff" stroke="none"/><path d="M6 18.4c1.3-2.9 3.3-4.2 6-4.2s4.7 1.3 6 4.2" fill="#fff" stroke="none"/>',
    "person": '<circle cx="12" cy="7.5" r="4" fill="currentColor" stroke="none"/><path d="M4 20.5c.8-4.4 4-6.8 8-6.8s7.2 2.4 8 6.8z" fill="currentColor" stroke="none"/>',
    "sparkles": '<path d="M10 3.5l1.9 5.2 5.2 1.9-5.2 1.9L10 17.7l-1.9-5.2-5.2-1.9 5.2-1.9z"/><path d="M18.5 14l.9 2.3 2.3.9-2.3.9-.9 2.3-.9-2.3-2.3-.9 2.3-.9z"/><path d="M18 3l.6 1.5 1.5.6-1.5.6L18 7.2l-.6-1.5-1.5-.6 1.5-.6z"/>',
    "search": '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    "compass": '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    "flame": '<path d="M12 3c.6 3.3 4.6 5.1 4.6 9.6A4.6 4.6 0 0 1 12 17.2a4.6 4.6 0 0 1-4.6-4.6c0-1.9.8-3.1 1.9-4.1.2 1.2.9 1.8 1.7 2C11 10 10.5 6.4 12 3z"/>',
    "flame-fill": '<path d="M12 2.5c.7 3.6 5.4 5.6 5.4 10.6a5.4 5.4 0 0 1-10.8 0c0-2.2.9-3.6 2.2-4.8.2 1.4 1 2.1 2 2.3C10.9 8.6 10.3 5 12 2.5z" fill="currentColor" stroke="none"/>',
    "star": '<path d="M12 3.4l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.8l6-.9z" fill="currentColor" stroke="none"/>',
    "heart": '<path d="M12 20s-7.5-4.6-7.5-10.1A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
    "heart-fill": '<path d="M12 20.5s-8-4.8-8-10.6A4.6 4.6 0 0 1 12 7.2a4.6 4.6 0 0 1 8 2.7c0 5.8-8 10.6-8 10.6z" fill="currentColor" stroke="none"/>',
    "tv": '<rect x="3" y="5.5" width="18" height="12" rx="3"/><path d="M8.5 21h7"/>',
    "tv-fill": '<rect x="3" y="5" width="18" height="12.5" rx="3" fill="currentColor" stroke="none"/><path d="M8.5 21h7"/>',
    "videocam": '<rect x="3" y="7" width="12" height="10" rx="3"/><path d="M15 11l6-3v8l-6-3"/>',
    "videocam-fill": '<rect x="2.5" y="6.5" width="13" height="11" rx="3" fill="currentColor" stroke="none"/><path d="M15.5 10.4l6-3.1v9.4l-6-3.1z" fill="currentColor" stroke="none"/>',
    "film": '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    "people": '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5c0-3 2.4-5.3 5.5-5.3s5.5 2.3 5.5 5.3"/><circle cx="17" cy="9.5" r="2.4"/><path d="M17 14.4c2.3 0 4 1.7 4 4.1"/>',
    "chev": '<path d="M9.5 5l7 7-7 7"/>',
    "chev-down": '<path d="M5 9l7 7 7-7"/>',
    "back": '<path d="M15 5l-7 7 7 7"/>',
    "arrow": '<path d="M5 12h14M13 6l6 6-6 6"/>',
    "plus": '<path d="M12 5v14M5 12h14"/>',
    "check": '<path d="M5 12.5l4.6 4.6L19 7.6"/>',
    "close": '<path d="M6 6l12 12M18 6L6 18"/>',
    "send": '<path d="M4 12l16-8-6 16-2.6-6.4z"/>',
    "edit": '<path d="M4 20l1.2-4.2L16.5 4.5l3 3L8.2 18.8z"/><path d="M14.5 6.5l3 3"/>',
    "edit-fill": '<path d="M4 20l1.3-4.6L16.4 4.3a2 2 0 0 1 2.8 0l.5.5a2 2 0 0 1 0 2.8L8.6 18.7z" fill="currentColor" stroke="none"/>',
    "share": '<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
    "share-social": '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/>',
    "list": '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/>',
    "chat": '<path d="M5 5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-5 3.5V18H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>',
    "chat-fill": '<path d="M12 3.5c5 0 9 3.4 9 7.7s-4 7.7-9 7.7c-1 0-2-.1-2.9-.4L4.5 20.5l1.2-3.6C4 15.5 3 13.5 3 11.2 3 6.9 7 3.5 12 3.5z" fill="currentColor" stroke="none"/><circle cx="8.3" cy="11.2" r="1.1" fill="#fff" stroke="none"/><circle cx="12" cy="11.2" r="1.1" fill="#fff" stroke="none"/><circle cx="15.7" cy="11.2" r="1.1" fill="#fff" stroke="none"/>',
    "chat-plus": '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-5 3.5V17H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M12 8.2v5.6M9.2 11h5.6"/>',
    "bars": '<path d="M5 20V11M12 20V5M19 20v-7"/>',
    "trophy": '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3 3 0 0 0 3 3M16 6h3v1a3 3 0 0 1-3 3M12 13v4M8.5 20h7"/>',
    "trophy-fill": '<path d="M7.5 3.5h9v5.5a4.5 4.5 0 0 1-9 0z" fill="currentColor" stroke="none"/><path d="M7.5 5.5H4.8v1.2a3.3 3.3 0 0 0 3.3 3.3M16.5 5.5h2.7v1.2a3.3 3.3 0 0 1-3.3 3.3M12 13.5v3.8M8.5 20.5h7"/>',
    "bell": '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    "calendar": '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    "diamond": '<path d="M12 3.5l8 5.5-8 11.5L4 9z"/><path d="M4 9h16M9 9l3 11.5M15 9l-3 11.5"/>',
    "shield": '<path d="M12 3l7 3v5.5c0 4.6-3 7.7-7 9.5-4-1.8-7-4.9-7-9.5V6z"/>',
    "shield-fill": '<path d="M12 2.5l7.5 3.2v5.8c0 4.8-3.2 8.2-7.5 10-4.3-1.8-7.5-5.2-7.5-10V5.7z" fill="currentColor" stroke="none"/>',
    "palette": '<path d="M12 4a8 8 0 1 0 0 16c1.3 0 1.9-1 1.5-2.1-.4-1.1.3-2.1 1.5-2.1H17a3 3 0 0 0 3-3c0-4.2-3.6-8.8-8-8.8z"/><circle cx="8" cy="11" r="1" fill="currentColor"/><circle cx="12" cy="8" r="1" fill="currentColor"/><circle cx="16" cy="11" r="1" fill="currentColor"/>',
    "image": '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/>',
    "images": '<rect x="6.5" y="3.5" width="14.5" height="13" rx="2.5" fill="currentColor" stroke="none"/><path d="M3.5 7.5v11a2 2 0 0 0 2 2h12"/><path d="M8 14.5l3.5-3 2.5 2 2.5-2 3 2.5" stroke="#fff" stroke-width="1.4"/>',
    "apps": '<rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><circle cx="16.7" cy="16.7" r="3.2"/>',
    "apps9": '<g fill="currentColor" stroke="none"><circle cx="5" cy="5" r="2.1"/><circle cx="12" cy="5" r="2.1"/><circle cx="19" cy="5" r="2.1"/><circle cx="5" cy="12" r="2.1"/><circle cx="12" cy="12" r="2.1"/><circle cx="19" cy="12" r="2.1"/><circle cx="5" cy="19" r="2.1"/><circle cx="12" cy="19" r="2.1"/><circle cx="19" cy="19" r="2.1"/></g>',
    "grid-fill": '<g fill="currentColor" stroke="none"><rect x="3.5" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="13" y="3.5" width="7.5" height="7.5" rx="2"/><rect x="3.5" y="13" width="7.5" height="7.5" rx="2"/><rect x="13" y="13" width="7.5" height="7.5" rx="2"/></g>',
    "albums": '<rect x="3" y="9" width="18" height="11.5" rx="2.5" fill="currentColor" stroke="none"/><path d="M5.5 6.2h13M8 3.4h8"/>',
    "phone": '<rect x="7.5" y="3" width="9" height="18" rx="2.5"/><path d="M4 8.5v7M20 8.5v7"/>',
    "globe": '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9z"/>',
    "download": '<path d="M12 4v11M7.5 11L12 15.5 16.5 11"/><path d="M5 19.5h14"/>',
    "lock": '<rect x="5" y="10.5" width="14" height="10" rx="3"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    "wand": '<path d="M5 19L16.5 7.5l2 2L7 21z"/><path d="M15 4.5l.7 1.8 1.8.7-1.8.7L15 9.5l-.7-1.8-1.8-.7 1.8-.7z"/><path d="M8 4l.4 1 1 .4-1 .4L8 7l-.4-1.2-1-.4 1-.4z"/>',
    "pin": '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
    "expand": '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    "cafe": '<path d="M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 4v2M12 4v2"/>',
    "pulse": '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
    "happy": '<circle cx="12" cy="12" r="9"/><path d="M8.5 14c.9 1.5 2 2.2 3.5 2.2s2.6-.7 3.5-2.2"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/>',
    "infinite": '<path d="M7.5 8.5c-2.5 0-4 1.6-4 3.5s1.5 3.5 4 3.5c3.5 0 5-7 9-7 2.5 0 4 1.6 4 3.5s-1.5 3.5-4 3.5c-4 0-5.5-7-9-7z" transform="translate(0 .4)"/>',
    "clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    "hourglass": '<path d="M6.5 3.5h11M6.5 20.5h11M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5"/>',
    "home": '<path d="M4 11l8-7 8 7v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
    "dots": '<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>',
    "refresh": '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/>',
    "text": '<path d="M5 6h14M12 6v13M9 19h6"/>',
    "ticket": '<path d="M4 8.5A2.5 2.5 0 0 0 4 13.5v2.2a1.8 1.8 0 0 0 1.8 1.8h12.4a1.8 1.8 0 0 0 1.8-1.8v-2.2A2.5 2.5 0 0 1 20 8.5V6.8A1.8 1.8 0 0 0 18.2 5H5.8A1.8 1.8 0 0 0 4 6.8z" transform="translate(0 .5)"/><path d="M14 6v12" stroke-dasharray="1.6 2.4"/>',
    "trend-up": '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    "bookmark": '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z" fill="currentColor" stroke="none"/>',
    "eye": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
    "newspaper": '<rect x="3" y="4.5" width="14" height="15" rx="2" fill="currentColor" stroke="none"/><path d="M17 8.5h2.5a1.5 1.5 0 0 1 1.5 1.5v7.5a2 2 0 0 1-2 2H5"/><path d="M6.5 8.5h7M6.5 12h7M6.5 15.5h4" style="stroke:var(--hole,#fff)" stroke-width="1.5"/>',
    "help": '<circle cx="12" cy="12" r="9.5" fill="currentColor" stroke="none"/><path d="M9.7 9.5a2.4 2.4 0 1 1 3.3 2.2c-.7.3-1 .8-1 1.5v.4" stroke="#7E22CE" stroke-width="2"/><circle cx="12" cy="16.8" r="1.1" fill="#7E22CE" stroke="none"/>',
    "branch": '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 4-6 3-12 7"/>',
    "sunny": '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
    "swap": '<path d="M7 7.5h12.5L16 4M17 16.5H4.5L8 20"/>',
    "layers": '<path d="M12 3.5l9 4.8-9 4.8-9-4.8z" fill="currentColor" stroke="none"/><path d="M3 12.6l9 4.8 9-4.8"/><path d="M3 16.4l9 4.8 9-4.8"/>',
    "flash": '<path d="M13.5 2.5L5 13.5h6.2l-1 8 8.3-11h-6.2z" fill="currentColor" stroke="none"/>',
    "doc": '<path d="M6 3h8l5 5v13H6z" fill="currentColor" stroke="none"/><path d="M9 13h7M9 17h5" stroke="#fff" stroke-width="1.5"/>',
    "checkbox": '<rect x="3.5" y="3.5" width="17" height="17" rx="4.5" fill="currentColor" stroke="none"/><path d="M8 12.3l2.8 2.8 5.4-6" stroke="#fff"/>',
    "sliders": '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    "history": '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M3.5 3.8v4.5H8"/><path d="M12 7.8V12l3 2"/>',
    "mail": '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    "mail-fill": '<rect x="2.5" y="5" width="19" height="14" rx="3" fill="currentColor" stroke="none"/><path d="M4 7.5l8 5.5 8-5.5" stroke="#fff" stroke-width="1.6"/>',
    "verified": '<path d="M12 2.5l2.4 1.8 3-.2.9 2.8 2.5 1.7-1 2.8 1 2.8-2.5 1.7-.9 2.8-3-.2L12 21.5l-2.4-1.8-3 .2-.9-2.8-2.5-1.7 1-2.8-1-2.8 2.5-1.7.9-2.8 3 .2z" fill="currentColor" stroke="none"/><path d="M8.5 12.2l2.4 2.4 4.6-4.8" stroke="#fff"/>',
    "flag": '<path d="M6 21V4M6 4.5h11l-2 4 2 4H6"/>',
    "ribbon": '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4L7 21l5-2.6 5 2.6-1.6-7.6"/>',
    "logout": '<path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14"/><path d="M10 12h10.5M17 8.5l3.5 3.5-3.5 3.5"/>',
    "skip": '<path d="M5 6l9 6-9 6z" fill="currentColor" stroke="none"/><path d="M18 6v12"/>',
    "ellipse": '<circle cx="12" cy="12" r="6.5" fill="currentColor" stroke="none"/>',
    "time": '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    "notes": '<rect x="6.5" y="5" width="4" height="14" rx="1.8" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.8" fill="currentColor" stroke="none"/>',
    "wifi": '<path d="M12 19.5l2.8-3.3a4 4 0 0 0-5.6 0z" fill="currentColor" stroke="none"/><path d="M6.6 13.2a7.6 7.6 0 0 1 10.8 0M3.4 9.9a12 12 0 0 1 17.2 0" stroke-width="2.4"/>',
    "aperture": '<circle cx="12" cy="12" r="9"/><path d="M12 3l3 9M21 12l-9 3M12 21l-3-9M3 12l9-3"/>',
    "inbox": '<path d="M4 13l2.5-8h11L20 13v6H4z"/><path d="M4 13h5l1 2h4l1-2h5"/>'
  };
  function ic(name, size) {
    var s = size || 18;
    return '<svg class="am-ic" viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || "") + "</svg>";
  }

  /* Bayraklar emoji değil SVG: Windows bayrak emojisini harf olarak çizer. */
  var FLAGS = {
    ko: '<rect width="12" height="8" fill="#fff"/><path d="M4 4a2 2 0 0 1 4 0z" fill="#CD2E3A"/><path d="M4 4a2 2 0 0 0 4 0z" fill="#0047A0"/><path d="M1.4 1.8l1.3 1M9.3 2.8l1.3-1M1.4 6.2l1.3-1M9.3 5.2l1.3 1" stroke="#000" stroke-width=".6"/>',
    ja: '<rect width="12" height="8" fill="#fff"/><circle cx="6" cy="4" r="2.3" fill="#BC002D"/>',
    tr: '<rect width="12" height="8" fill="#E30A17"/><circle cx="4.6" cy="4" r="2" fill="#fff"/><circle cx="5.1" cy="4" r="1.6" fill="#E30A17"/><path d="M6.9 4l1.6-.55-1 1.35V3.2l1 1.35z" fill="#fff"/>',
    fr: '<rect width="4" height="8" fill="#0055A4"/><rect x="4" width="4" height="8" fill="#fff"/><rect x="8" width="4" height="8" fill="#EF4135"/>'
  };
  function flag(code) { return '<span class="am-flag"><svg viewBox="0 0 12 8" aria-hidden="true">' + FLAGS[code] + "</svg></span>"; }

  /* ── Parçalar ───────────────────────────────────────────────────────── */
  var AV = ["linear-gradient(135deg,#FDBA74,#F97316)", "linear-gradient(135deg,#8b7cf6,#ff8ad4)", "linear-gradient(135deg,#2ee6d6,#138df0)", "linear-gradient(135deg,#3ddc97,#138df0)"];
  function avatar(i, size, letter) {
    return '<i class="am-av" style="--g:' + AV[i % AV.length] + ";width:" + size + "px;height:" + size + 'px">' + (letter || "") + "</i>";
  }
  function sec(inner) { return '<section class="am-sec">' + inner + "</section>"; }
  // Raf başlığı: ikon kutusu · başlık (+ rozet) · alt başlık · "Tümü ›"
  function sh(icon, title, sub, o) {
    o = o || {};
    return '<div class="am-sh"><span class="am-sh-ic' + (o.gold ? " gold" : "") + '">' + ic(icon, 13) + '</span><div class="am-sh-tx"><b><span>' + title + "</span>" + (o.badge || "") + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</div>" +
      (o.all === false ? "" : '<span class="am-all">' + t("mSeeAll") + ic("chev", 9) + "</span>") + "</div>";
  }
  // Çip satırı; `key` verilirse çipler düğmedir ve st.pick[key]'i değiştirir.
  function chips(list, on, key) {
    return '<div class="am-chiprow">' + list.map(function (c, i) {
      var label = typeof c === "string" ? c : c[1] + c[0];
      if (key) return '<button type="button" class="am-chip' + (i === on ? " on" : "") + '" data-pick="' + key + ":" + i + '" aria-pressed="' + (i === on) + '">' + label + "</button>";
      return '<span class="am-chip' + (i === on ? " on" : "") + '">' + label + "</span>";
    }).join("") + "</div>";
  }
  function rated(r, tv, votes) {
    return '<span class="am-rate' + (tv ? " tv" : "") + '"><i>★</i>' + r + (votes ? "<em>" + ic("people", 7) + votes + "</em>" : "") + "</span>";
  }
  var STK = { b: ["bookmark", "#3B82F6"], e: ["eye", "#22C55E"], h: ["heart-fill", "#EF4444"], g: ["grid-fill", "#F59E0B"], p: ["people", "#60A5FA"], s: ["star", "#FACC15"], c: ["chat-fill", "#A855F7"] };
  // Afiş: puan + isteğe bağlı yıl rozeti ve kütüphane durum simgeleri (sol alt)
  function pc(x, tv) {
    return '<div class="am-pc">' + img(x[0], 185) +
      (x[2] ? '<span class="am-yr">' + ic("calendar", 7) + x[2] + "</span>" : "") +
      (x[3] ? '<span class="am-stack">' + x[3].split("").map(function (k) { return '<i style="color:' + STK[k][1] + '">' + ic(STK[k][0], 8) + "</i>"; }).join("") + "</span>" : "") +
      (x[1] ? rated(x[1], tv) : "") + "</div>";
  }
  function rail(items, tv) { return '<div class="am-hs">' + items.map(function (x) { return pc(x, tv); }).join("") + "</div>"; }
  function pcards(ids, ratings) { return rail(ids.map(function (id, i) { return [id, ratings[i]]; })); }
  // Ortalanan büyük afiş dönencesi; yandakiler kaydırıldıkça büyür (bindCars)
  function carousel(items, tv) {
    return '<div class="am-car" data-car>' + items.map(function (x, i) {
      return '<div class="am-cc" style="--s:' + (i ? 0.7 : 1) + '">' + img(x[0], 342) + rated(x[1], tv, short(x[2])) + "</div>";
    }).join("") + "</div>";
  }
  function award(tv) {
    var items = tv ? [[2026, TVS.shogun, "8.4"], [2025, TVS.pitt, "8.7"]] : [[2026, MOV.oneBattle, "7.3"], [2025, MOV.anora, "7.1"]];
    function col(y) { return '<span class="am-yearcol">' + ic("star", 9) + "<b>" + y + "</b></span>"; }
    return '<div class="am-hs">' +
      '<div class="am-award">' + col(2027) + '<div class="am-pending">' + ic("trophy-fill", 20) + '<span class="n">2027</span><small>' + t(tv ? "mEmmyPending" : "mOscarPending") + "</small><em>" + t(tv ? "mEmmyPendingSub" : "mOscarPendingSub") + "</em></div></div>" +
      items.map(function (x) { return '<div class="am-award">' + col(x[0]) + pc([x[1], x[2]], tv) + "</div>"; }).join("") + "</div>";
  }
  function providers() {
    return '<div class="am-hs">' + PROV.map(function (p) { return '<span class="am-prov"><img loading="lazy" decoding="async" alt="" src="' + IMG + "w92/" + p[1] + '">' + p[0] + "</span>"; }).join("") + "</div>";
  }
  function row(icon, title, sub, opt) {
    opt = opt || {};
    return '<div class="am-row"><span class="am-row-ic' + (opt.tone ? " " + opt.tone : "") + '">' + ic(icon, 14) + '</span><span class="am-row-tx"><b>' + title + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + "</span>" + (opt.right || '<span class="am-chev">' + ic("chev", 13) + "</span>") + "</div>";
  }
  function nav(title, right) {
    return '<div class="am-nav"><span class="am-roundbtn sm" aria-hidden="true">' + ic("back", 14) + "</span><b>" + title + "</b>" + (right || "<span></span>") + "</div>";
  }
  function navBack(title, go) {
    return '<div class="am-nav"><button class="am-roundbtn sm" type="button" data-go="' + go + '" aria-label="' + t("mBack") + '">' + ic("back", 14) + "</button><b>" + title + "</b><span></span></div>";
  }
  function chip(txt, on, extra) { return '<span class="am-chip' + (on ? " on" : "") + '"' + (extra || "") + ">" + txt + "</span>"; }
  function toggle(on) { return '<span class="am-sw' + (on ? " on" : "") + '"></span>'; }

  var screens = {};

  /* ═══ Film & Dizi (ana sayfa) ═════════════════════════════════════════ */
  screens.movies = function (st) {
    var tv = st.media === "tv";
    var float =
      '<div class="am-float">' +
      '<span class="am-roundbtn" aria-hidden="true">' + ic("compass", 16) + "</span>" +
      '<div class="am-switch" role="tablist"><i style="transform:translateX(' + (tv ? "0" : "100%") + ')"></i>' +
      '<button type="button" role="tab" data-mt="tv" aria-selected="' + tv + '" class="' + (tv ? "on" : "") + '">' + ic(tv ? "tv-fill" : "tv", 14) + "<span>" + t("mTv") + "</span></button>" +
      '<button type="button" role="tab" data-mt="movie" aria-selected="' + !tv + '" class="' + (tv ? "" : "on") + '">' + ic(tv ? "videocam" : "videocam-fill", 14) + "<span>" + t("mMovies") + "</span></button></div>" +
      '<span class="am-roundbtn" aria-hidden="true">' + ic("search", 15) + "</span></div>";
    var day = st.pick.trend === 1, pop = st.pick.best === 1;
    var trend = sec(sh("flame-fill", t(tv ? "mTrendTv" : "mTrendMovies"), t(tv ? "mTrendSubTv" : "mTrendSubMovie")) +
      chips([t("mTrendWeek"), t("mTrendDay")], day ? 1 : 0, "trend") +
      carousel(tv
        ? (day ? [[TVS.squid, "7.9", 17877], [TVS.mobland, "8.6", 1090], [TVS.apothecary, "8.7", 686]] : [[TVS.apothecary, "8.7", 686], [TVS.pluribus, "7.9", 1171], [TVS.wednesday, "8.3", 10922]])
        : (day ? [[MOV.blackPhone2, "6.6", 1406], [MOV.oneBattle, "7.3", 4451], [MOV.clayface, "7.6", 150]] : [[MOV.clayface, "7.6", 150], [MOV.frankenstein, "7.6", 4006], [MOV.blackPhone2, "6.6", 1406]]), tv));
    var best = sec(sh("star", t(tv ? "mBestTv" : "mBestMovies"), t("mBestsSub")) +
      chips([t(tv ? "mVotedTv" : "mVoted"), t(tv ? "mPopularTv" : "mPopularMovie")], pop ? 1 : 0, "best") +
      (tv
        ? rail(pop ? [[TVS.squid, "7.9", "2021"], [TVS.wednesday, "8.3", "2022"], [TVS.mobland, "8.6", "2025"], [TVS.reacher, "8.1", "2022"]]
          : [[TVS.got, "8.5", "2011", "behgpsc"], [TVS.st, "8.5", "2016", "p"], [TVS.moneyHeist, "8.2", "2017", "eg"], [TVS.breakingBad, "9.0", "2008"]], true)
        : rail(pop ? [[MOV.clayface, "7.6"], [MOV.frankenstein, "7.6"], [MOV.oneBattle, "7.3"], [MOV.avatar, "7.6"]]
          : [[MOV.interstellar, "8.5"], [MOV.inception, "8.4"], [MOV.avengers, "8.1"], [MOV.shawshank, "8.7"]])));
    var body;
    if (!tv) {
      body = trend + best +
        sec(sh("trophy-fill", t("mOscar"), t("mAwardSub"), { gold: true }) +
          '<div class="am-chiprow"><span class="am-seg2"><span class="on">' + t("mModeCat") + "</span><span>" + t("mModeYear") + "</span></span>" +
          chip(ic("star", 10) + t("mBestPicture"), true) + chip(ic("globe", 10) + t("mIntl")) + "</div>" + award(false)) +
        sec(sh("albums", t("mCollections"), t("mCollectionsSub"), { all: false }) +
          '<div class="am-hs">' + [[COL.starWars, 9], [COL.harryPotter, 8], [COL.avengers, 4]].map(function (c) {
            return '<div class="am-pc">' + img(c[0], 185) + '<span class="am-colct">' + ic("film", 8) + c[1] + "</span></div>";
          }).join("") + "</div>") +
        sec(sh("apps9", t("mProviders"), t("mProvidersSub")) + providers());
    } else {
      body = trend + best +
        sec(sh("heart-fill", t("mFromFav"), t("mFromFavSub", { names: "Reacher, The Mentalist +6" })) +
          rail([[TVS.reasons13, "7.5"], [TVS.nightManager, "7.7"], [TVS.office, "8.6"]], true)) +
        sec(sh("palette", t("mTopGenres"), [t("mGenreDrama"), t("mGenreSciFan"), t("mGenreComedy")].join("  •  ")) +
          rail([[TVS.greys, "8.2"], [TVS.poi, "8.1"], [TVS.shadows, "8.0"]], true)) +
        sec(sh("trend-up", t("mRecentFav"), t("mRecentFavSub")) +
          rail([[TVS.bear, "8.2"], [TVS.reacher, "8.1", null, "eg"], [TVS.mobland, "8.6"]], true)) +
        sec(sh("globe", t("mWorldTour"), t("mWorldTourSub")) +
          chips([[t("mWtKo"), flag("ko")], [t("mWtJa"), flag("ja")], [t("mWtTr"), flag("tr")], [t("mWtFr"), flag("fr")]], 0) +
          rail([[TVS.runningMan, "8.2"], [TVS.squid, "7.9"], [TVS.proBono, "8.2"]], true)) +
        sec(sh("trophy-fill", t("mEmmy"), t("mAwardSub"), { gold: true }) +
          '<div class="am-chiprow"><span class="am-seg2"><span class="on">' + t("mModeCat") + "</span><span>" + t("mModeYear") + "</span></span>" +
          chip(ic("tv", 10) + t("mEmmyDrama"), true) + chip(ic("happy", 10) + t("mEmmyComedy")) + "</div>" + award(true)) +
        sec(sh("apps9", t("mProviders"), t("mProvidersSub")) + providers());
    }
    return float + '<div class="am-scroll am-top">' + body + "</div>";
  };

  /* ═══ Eğlence (Hub) ════════════════════════════════════════════════════ */
  function bracketSvg() {
    // 31 maçın iki taraflı eleme ağacı (8-4-2-1 çentik, ortada şampiyon) — şematik
    var s = '<svg viewBox="0 0 240 60" preserveAspectRatio="none" class="am-bracket" aria-hidden="true">';
    function side(x0, dir) {
      var out = "", xs = [x0, x0 + dir * 17, x0 + dir * 33, x0 + dir * 47], n = [8, 4, 2, 1], ys = [];
      for (var c = 0; c < 4; c++) {
        var cnt = n[c], gap = 56 / cnt, col = [];
        for (var i = 0; i < cnt; i++) {
          var y = 2 + gap * i + gap / 2;
          col.push(y);
          out += '<rect x="' + (xs[c] - (dir > 0 ? 0 : 10)) + '" y="' + (y - 2.2) + '" width="10" height="4.4" rx="2.2" fill="rgba(255,255,255,.9)"/>';
        }
        ys.push(col);
      }
      for (var c2 = 0; c2 < 3; c2++) {
        for (var j = 0; j < ys[c2 + 1].length; j++) {
          var a = ys[c2][j * 2], b = ys[c2][j * 2 + 1], m = ys[c2 + 1][j];
          var xa = xs[c2] + dir * 10, xb = xs[c2 + 1], xm = (xa + xb) / 2;
          out += '<path d="M' + xa + " " + a + "H" + xm + "V" + b + "H" + xa + "M" + xm + " " + m + "H" + xb + '" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1"/>';
        }
      }
      return out;
    }
    return s + side(4, 1) + side(236, -1) + '<path d="M61 30H100M140 30H179" stroke="rgba(255,255,255,.6)" stroke-width="1"/></svg>';
  }
  function gcard(cls, prev, title, play) {
    return '<div class="am-gcard ' + cls + '"><div class="am-gprev">' + prev + "</div><b>" + title + '</b><div class="am-gmeta">' + ic("sparkles", 9) + "<span>" + t("mGameNew") + "</span>" + (play ? "<i>" + ic("play-solid", 8) + "</i>" : "") + "</div></div>";
  }
  function puzzle(id) {
    var url = "url(" + IMG + "w185/" + id + ".jpg)", h = "";
    for (var i = 0; i < 9; i++) {
      h += i === 4 ? '<i class="x">?</i>' : '<i style="--p:' + url + ";background-position:" + (-(i % 3) * 15) + "px " + (-Math.floor(i / 3) * 21) + 'px"></i>';
    }
    return '<div class="am-puz">' + h + "</div>";
  }
  screens.hub = function (st) {
    var feed = '<div class="am-hub feed"><div class="am-hub-top"><span class="am-hub-ic">' + ic("newspaper", 18) + '</span><div class="am-hub-tx"><b>' + t("mPosts") +
      '<span class="am-faces">' + avatar(1, 17, "M") + avatar(2, 17, "L") + avatar(3, 17, "S") + "</span></b><small>" + t("mPostsSub") + '</small></div><span class="am-white-arrow">' + ic("arrow", 13) + "</span></div>" +
      '<div class="am-compose">' + avatar(0, 19, "A") + "<span>" + t("mWhatShare") + "</span><i>" + ic("plus", 12) + "</i></div>" +
      '<div class="am-tiles">' + [["edit-fill", "#3B82F6", "mReview"], ["list", "#22C55E", "mList"], ["chat-fill", "#3B82F6", "mChat"], ["bars", "#8B5CF6", "mPoll"]].map(function (x) {
        return '<span><i style="color:' + x[1] + '">' + ic(x[0], 13) + "</i>" + t(x[2]) + "</span>";
      }).join("") + "</div></div>";
    var cine = '<div class="am-hub cine"><div class="am-cine-row"><div class="am-cine-l"><div class="am-gpills"><span class="am-gp dark">' + ic("film", 9) + "CINESWIPE</span><span class=\"am-gp gold\">" + ic("sparkles", 9) + t("mNew") + "</span></div>" +
      '<b class="h">' + t("mCineTitle") + "</b><small>" + t("mCineSub") + '</small></div><div class="am-fan">' + img(MOV.inception, 92) + img(TVS.st, 92) + img(TVS.moneyHeist, 92) + '<span class="am-heart">' + ic("heart-fill", 12) + "</span></div></div>" +
      '<div class="am-cine-btns"><span>' + ic("person", 11) + t("mCineSolo") + '</span><span class="light">' + ic("people", 12) + t("mCineDuo") + "</span></div></div>";
    var bingo = '<div class="am-hub bingo"><div class="am-bingo-top"><div><div class="am-gpills"><span class="am-gp dark">' + ic("grid-fill", 9) + t("mBingoEyebrow") + '</span><span class="am-gp plain">' + ic("clock", 9) + t("mBingoDaysLeft", { n: 6 }) + "</span></div>" +
      '<b class="h">' + t("mBingoTitle") + "</b><small>" + t("mBingoLines", { n: 1 }) + " • " + t("mBingoSquares", { done: 4, total: 9 }) + '</small></div><div class="am-mini">' +
      [1, 0, 0, 1, 1, 0, 0, 1, 0].map(function (d, i) { return "<i" + (d ? ' class="d"' : i === 4 ? ' class="c"' : "") + "></i>"; }).join("") + "</div></div>" +
      '<div class="am-bingo-w"><span>' + t("mBingoWeekly") + "</span><em>" + t("mBingoWeeklyCount", { n: 1 }) + '</em></div><div class="am-foot"><span>' + t("mBingoHint") + '</span><span class="am-white-arrow" style="--arrow:#0F766E">' + ic("arrow", 13) + "</span></div></div>";
    var voted = st.poll, share = [0.64, 0.36];
    var poll = '<div class="am-hub poll"><div class="am-gpills"><span class="am-gp dark">' + ic("help", 9) + t("mPollLabel") + '</span></div><b class="h">' + t("mPollQ") + "</b>" +
      [t("mPollA"), t("mPollB")].map(function (o, i) {
        return '<button type="button" class="am-popt' + (voted === i ? " mine" : "") + '" data-poll="' + i + '"' + (voted != null ? ' style="--w:' + share[i] * 100 + '%"' : "") + "><span>" + o + "</span>" + (voted === i ? ic("check", 11) : "") + (voted != null ? "<em>" + pct(share[i]) + "</em>" : "") + "</button>";
      }).join("") + "<small>" + (voted != null ? t("mPollVotesN", { n: fmt(1248) }) : t("mPollHint")) + "</small></div>";
    var rd = t("mRounds").split(",");
    var tour = '<div class="am-hub trn"><span class="am-tour-bgic">' + ic("trophy-fill", 96) + "</span>" +
      '<div class="am-tour-top"><div class="am-gpills"><span class="am-gp">' + ic("trophy", 9) + t("mTourMonthly") + '</span><span class="am-gp dark plain">' + ic("people", 9) + '<span class="n">3</span></span></div><span class="am-white-arrow" style="--arrow:#D97706">' + ic("arrow", 13) + "</span></div>" +
      '<b class="h">' + t("mTourHorror") + "</b><small>" + t("mTourNext") + "</small>" +
      '<div class="am-cdrow"><div class="am-cd">' + [["05", "mCdDay"], ["22", "mCdHr"], ["12", "mCdMin"], ["48", "mCdSec"]].map(function (c) { return "<span><b>" + c[0] + "</b><em>" + t(c[1]) + "</em></span>"; }).join("<i>:</i>") + '</div><span class="am-send">' + ic("send", 12) + "</span></div>" +
      '<div class="am-tree"><div class="am-tree-h">' + ic("branch", 9) + t("mTree") + "<em>31/31</em><u>" + t("mChampion") + '</u></div><div class="am-brk">' + bracketSvg() + '<div class="am-champ">' + img(MOV.residentEvil, 92) + "<b>#1</b></div></div>" +
      '<div class="am-tree-l"><span>' + rd.join("</span><span>") + "</span><b>" + t("mChampion") + "</b><span>" + rd.slice().reverse().join("</span><span>") + "</span></div></div></div>";
    var scene = '<div class="am-scene"><img loading="lazy" decoding="async" alt="" src="' + IMG + "w300/" + BACKDROP.avatar + '.jpg"><span class="fr"></span><span class="q">?</span><span class="ans"><i></i><i class="y"></i></span></div>';
    var games = '<div class="am-lab am-lab-row"><span>' + t("mGames") + '</span><span class="am-gamepill"><b>1</b>' + ic("flame-fill", 9) + '<span class="n">0</span>' + ic("chev", 9) + "</span></div>" +
      '<div class="am-hub daily"><div class="am-daily-top"><div><div class="am-gpills"><span class="am-gp dark">' + ic("sunny", 9) + t("mDailyEyebrow") + '</span></div><b class="h">' + t("mDailyTitle") + "</b><small>" + t("mDailySub") + '</small></div><div class="am-fan mini">' + img(MOV.fightClub, 92) + img(MOV.gotg, 92) + img(MOV.shawshank, 92) + "</div></div>" +
      '<div class="am-daily-b"><span>' + ic("clock", 9) + "22:12</span><span>" + ic("flame-fill", 9) + "0</span><span>" + ic("sparkles", 9) + '+50</span><span class="am-startbtn">' + t("mStart") + ic("play-solid", 9) + "</span></div></div>" +
      '<div class="am-gfeat">' + gcard("scene", scene, t("mSceneGuess"), true) + gcard("puzzle", puzzle(TVS.squid), t("mPosterPuzzle"), true).replace('class="am-gcard puzzle"', 'class="am-gcard puzzle" style="--pc:#EA580C"') + "</div>" +
      '<div class="am-lab">' + t("mQuickGames") + '</div><div class="am-qrow">' +
      gcard("older", '<span class="am-qp g">' + img(MOV.forrest, 92) + '<em>1994</em></span><span class="am-swapic">' + ic("swap", 8) + '</span><span class="am-qp">' + img(MOV.inception, 92) + "<em>2010</em></span>", t("mOlder")) +
      gcard("popular", '<span class="am-qp g">' + img(MOV.titanic, 92) + '<u><i style="width:82%"></i></u></span>' + ic("people", 11) + '<span class="am-qp">' + img(TVS.riverdale, 92) + '<u><i style="width:34%;background:#fff"></i></u></span>', t("mPopularGame")) +
      gcard("decade", '<span class="am-qp">' + img(MOV.pulp, 92) + "</span>" + ic("hourglass", 13), t("mDecadeGame")) + "</div>";
    return '<div class="am-scroll am-hubtop">' +
      '<div class="am-greet"><div><h3>' + t("mHi") + ", Alex</h3><p>" + t("mHubSub") + "</p></div>" + avatar(0, 31, "A") + "</div>" +
      '<div class="am-lab">' + t("mSocial") + "</div>" + feed +
      '<div class="am-lab">CINESWIPE</div>' + cine +
      '<div class="am-lab">BINGO</div>' + bingo +
      '<div class="am-lab">' + t("mPollLabel") + "</div>" + poll +
      '<div class="am-lab">' + t("mTournament") + "</div>" + tour + games + "</div>";
  };

  /* ═══ Ayarlar ══════════════════════════════════════════════════════════ */
  var FAM_TONE = {
    studio: { light: "studioLight", mid: "studio", dark: "studioDeep" },
    "default": { light: "light", mid: "gray", dark: "dark" },
    blue: { light: "sky", mid: "blue", dark: "blueDeep" },
    green: { light: "green", mid: "greenMid", dark: "greenDeep" }
  };
  // Aile seçici: uygulamanın üç ailesi + Tema Stüdyosu'ndaki özel tema (simgeli düğme)
  function themeCard(st) {
    var fams = [["default", "mFamDefault"], ["blue", "mFamBlue"], ["green", "mFamGreen"]];
    var tones = [["light", "mToneLight"], ["mid", "mToneMid"], ["dark", "mToneDark"]];
    return '<div class="am-card am-theme"><div class="am-theme-h"><span class="am-row-ic">' + ic("palette", 14) + "</span><b>" + t("mTheme") + "</b></div>" +
      '<div class="am-seg3">' + fams.map(function (f) { return '<button type="button" data-fam="' + f[0] + '" class="' + (st.family === f[0] ? "on" : "") + '">' + t(f[1]) + "</button>"; }).join("") +
      '<button type="button" data-fam="studio" class="ico' + (st.family === "studio" ? " on" : "") + '" aria-label="' + t("mThemeStudio") + '" title="' + t("mThemeStudio") + '">' + ic("sparkles", 13) + "</button></div>" +
      '<div class="am-seg3 tones">' + tones.map(function (f) { return '<button type="button" data-tone="' + f[0] + '" class="' + (st.tone === f[0] ? "on" : "") + '">' + t(f[1]) + "</button>"; }).join("") + "</div></div>";
  }
  screens.settings = function (st) {
    return '<div class="am-scroll am-settop">' + navBack(t("mTabSettings"), "profile") +
      '<div class="am-lab first">SEELOGD PREMIUM</div>' +
      '<div class="am-prem"><div class="am-prem-top"><span class="am-prem-ic">' + ic("diamond", 18) + "</span><b>" + t("mPremiumTitle") + '</b></div><div class="am-prem-cta"><span>' + t("mPremiumCta") + "</span>" + ic("arrow", 14) + "</div></div>" +
      '<div class="am-lab">' + t("mGrpAccount") + "</div>" +
      '<div class="am-card">' + row("user", t("mRowConn"), t("mRowConnSub")) + row("shield", t("mRowPrivacy"), null, { tone: "green" }) + "</div>" +
      '<div class="am-lab">' + t("mGrpAppearance") + "</div>" + themeCard(st) +
      '<div class="am-card stacked">' + row("palette", t("mRowPersonal"), null, { tone: "violet" }) + row("image", t("mRowPoster"), null, { tone: "orange" }) + row("apps", t("mRowWidgets"), null, { tone: "teal" }) + row("phone", t("mRowHaptics"), null, { right: toggle(true) }) + "</div>" +
      '<div class="am-lab">' + t("mGrpLang") + "</div>" +
      '<div class="am-card">' + row("globe", t("mLanguage"), "Türkçe · English · Español · Português · Deutsch") + row("tv", t("mRowSubs"), null, { tone: "orange" }) + row("lock", t("mRowAdult"), null, { tone: "red", right: toggle(false) }) + "</div>" +
      '<div class="am-lab">' + t("mGrpNotif") + "</div>" +
      '<div class="am-card">' + row("bell", t("mRowReminders"), null, { tone: "orange" }) + row("chat", t("mRowSocialNotif"), null, { tone: "green" }) + "</div>" +
      '<div class="am-lab">' + t("mGrpData") + "</div>" +
      '<div class="am-card">' + row("download", t("mRowDownload"), null) + row("shield", t("mRowPerms"), null, { tone: "green" }) + "</div>" +
      "</div>";
  };

  /* ═══ Kütüphane (Devam Edenler · Listeler · Hatırlatıcı · Notlar · Wrapped) ═ */
  function lcard(ids, icon, name, n, tint) {
    return '<div class="am-lcard" style="--tint:' + tint + '"><div class="am-lfan">' + ids.map(function (id) { return img(id, 92); }).join("") + '</div><div class="am-lfoot"><i>' + ic(icon, 9) + "</i><span>" + name + "</span><b>" + n + "</b></div></div>";
  }
  // Kalan gün kutusu uygulamadaki gibi (RemindersPreviewButton → countdownStyle): <4 gün yeşil, <7 mavi,
  // <1 ay turuncu, <3 ay kırmızı, sonrası mor; 99 günü aşınca sayı yerine "13 Ay 27 Gün".
  var CD = [[4, "flash", "#22C55E"], [7, "time", "#3B82F6"], [30, "calendar", "#F97316"], [90, "hourglass", "#EF4444"], [Infinity, "ellipse", "#A855F7"]];
  function remCard(id, film, title, sub, date, days, cls) {
    var cd = CD.filter(function (c) { return days < c[0]; })[0];
    var m = Math.floor(days / 30), r = days % 30;
    var left = days <= 99 ? "<b>" + days + "</b><small>" + t("mDays") + "</small>"
      : "<small class=\"txt\">" + m + " " + t("mMonthW") + (r ? " " + r + " " + t("mDayW") : "") + "</small>";
    return '<div class="am-rem' + (cls ? " " + cls : "") + '"><span class="am-rem-img">' + img(id, 92) + '</span><div class="am-rem-tx"><small class="am-tag">' + ic(film ? "film" : "tv", 8) + t(film ? "mFilmTag" : "mTvTag") + "</small><b>" + title + "</b>" + (sub ? "<small>" + sub + "</small>" : "") + '<small class="muted">' + ic("calendar", 8) + date + '</small></div><span class="am-days" style="--cd:' + cd[2] + '">' + ic(cd[1], 10) + left + "</span></div>";
  }
  // Kütüphane'deki hatırlatıcı destesi: öndeki kart + arkada aşağıdan görünen kartlar (en fazla 3) ve noktalar.
  // Uygulamada kaydırılır; makette desteye dokununca sıradaki öne gelir.
  function remStack(items, top) {
    var n = items.length;
    return '<div class="am-remstack" data-remnext role="button" tabindex="0">' + items.map(function (x, i) {
      var pos = (i - top + n) % n;
      return pos > 2 ? "" : remCard(x[0], x[1], x[2], x[3], x[4], x[5], "p" + pos);
    }).join("") + '</div><div class="am-remdots">' + items.map(function (x, i) { return "<i" + (i === top ? ' class="on"' : "") + "></i>"; }).join("") + "</div>";
  }
  function notesCard() {
    return '<div class="am-notes"><div class="am-notes-h"><span class="am-notes-ic">' + ic("notes", 13) + "</span><div><b>" + t("mNoteEntries", { n: 1 }) + "</b><small>" + t("mNotesSub") + '</small></div><span class="am-arrowtile">' + ic("arrow", 12) + "</span></div>" +
      '<div class="am-note1"><div><span>' + t("mGroupName") + "</span><small>" + t("mToday") + "</small></div><small>Dune · Arrival · Parasite</small></div>" +
      '<div class="am-note2"><span><i>' + ic("doc", 10) + "</i><div><b>1</b><small>" + t("mNoteWord") + "</small></div></span><span><i>" + ic("checkbox", 10) + "</i><div><b>0</b><small>" + t("mListWord") + "</small></div></span></div></div>";
  }
  screens.library = function (st) {
    function up(id, s, e, prog, pct, soon) {
      return '<div class="am-up">' + img(id, 185) + '<span class="am-up-se">' + t("mSeShort", { s: s, e: e }) + "</span>" + (prog ? '<span class="am-up-pr">' + prog + "</span>" : "") +
        (soon ? '<span class="am-up-ep">' + t("mEpN", { n: e }) + '</span><span class="am-up-act"><span class="soon">' + ic("clock", 8) + soon + "</span></span>"
          : '<span class="am-up-act"><span>' + ic("check", 8) + t("mWatchedBtn") + '</span><span class="cal">' + ic("calendar", 8) + "</span></span>") +
        '<span class="am-up-bar"><i style="width:' + pct + '%"></i></span></div>';
    }
    var bars = [0, 0, 0, 0, 0, 14, -1, 0, 0, 30, 26, 0, 0, 0];
    var tiles = [["film", "#F59E0B", "14", null, "mFilmWord"], ["tv-fill", "#3B82F6", "9", null, "mTvWord"], ["play-fill", "#22C55E", "727", null, "mEpisodeWord"], ["calendar", "#EC4899", "15", "mDays", "mWrActive"], ["flame-fill", "#F97316", "2", "mDays", "mWrStreak"]];
    return '<div class="am-scroll am-hubtop">' +
      '<h3 class="am-ptitle">' + t("mTabLibrary") + "</h3>" +
      sh("play-fill", t("mOngoing"), t("mOngoingSub"), { badge: '<span class="am-count">' + ic("skip", 7) + "3</span>" }) +
      '<div class="am-hs">' + up(TVS.lanterns, 1, 6, "5/8", 62) + up(TVS.lioness, 3, 8, "23/24", 95) + up(TVS.daryl, 4, 1, null, 0, fdate(2027, 6, 8, { day: "numeric", month: "short" })) + up(TVS.fallout, 2, 3, "2/8", 25) + "</div>" +
      '<div class="am-lab am-lab-row"><span>' + t("mLists") + '</span><span class="am-labbtns"><i>' + ic("plus", 12) + "</i><i>" + ic("layers", 11) + "</i><i>" + ic("arrow", 12) + "</i></span></div>" +
      '<div class="am-hs">' + lcard([TVS.fallout, TVS.moneyHeist, TVS.got, TVS.twd, TVS.office], "tv-fill", t("mWatchedTv"), 17, "#8B5CF6") +
      lcard([MOV.venom, MOV.avengers, MOV.interstellar, MOV.inception, MOV.oneBattle], "film", t("mWatchedMovies"), 22, "#3B82F6") +
      lcard([MOV.forrest, MOV.pulp, MOV.shawshank, MOV.fightClub, MOV.titanic], "heart-fill", t("mFavorites"), 12, "#EF4444") + "</div>" +
      '<div class="am-lab am-lab-row"><span>' + t("mReminderLabel") + '</span><span class="am-labbtns"><span class="am-pilltag">' + ic("film", 8) + '2</span><i class="ac">' + ic("calendar", 11) + "</i></span></div>" +
      // Kalan günler 26 Eki 2026'ya göre; Secret Wars'ın süresi henüz yok (uygulama o satırı göstermez).
      remStack([[MOV.mongoose, true, "Mongoose", "99 " + t("mMin"), fdate(2026, 9, 29, { day: "numeric", month: "long", year: "numeric" }), 3],
        [MOV.secretWars, true, "Avengers: Secret Wars", null, fdate(2027, 11, 17, { day: "numeric", month: "long", year: "numeric" }), 417]], st.remTop) +
      '<div class="am-lab">' + t("mNotes") + "</div>" + notesCard() +
      '<div class="am-lab">' + t("mWrapped") + '</div><div class="am-wrapped"><div class="am-wr-top"><span class="am-wr-pill">' + ic("sparkles", 8) + 'SEELOGD · WRAPPED</span><span class="am-wr-pill yr">' + ic("calendar", 8) + "2026</span></div>" +
      '<div class="am-wr-mid"><div><small class="e">' + t("mWrTotal") + '</small><div class="am-wr-big"><span class="n">634</span><b>' + t("mWrHours") + '</b></div><small class="s">≈ 26 ' + t("mDays") + " 10 " + t("mWrHoursShort") + '</small><span class="am-wr-vs">' + ic("trend-up", 9) + pct(0.24, true) + " " + t("mWrVsLast") + "</span></div>" +
      '<div class="am-wr-chart"><div class="am-wr-bars">' + bars.map(function (h) { return h < 0 ? '<i class="pk"></i>' : h ? '<i class="t" style="--h:' + h + 'px"></i>' : "<i></i>"; }).join("") + "</div><small>" + t("mWrPeak") + " · " + fdate(2026, 5, 1, { month: "long" }) + "</small></div></div>" +
      '<div class="am-wr-tiles">' + tiles.map(function (x) { return '<span><b><i style="color:' + x[1] + '">' + ic(x[0], 9) + "</i>" + x[2] + (x[3] ? "<u>" + t(x[3]) + "</u>" : "") + "</b><small>" + t(x[4]) + "</small></span>"; }).join("") + "</div>" +
      '<div class="am-wr-per"><div class="am-wr-fan">' + img(TVS.got, 92) + img(TVS.twd, 92) + img(TVS.mentalist, 92) + "</div><div><small>" + t("mWrPersona") + '</small><b class="h">🎭 ' + t("mPersonaDrama") + '</b><div class="am-gpills"><span class="am-gp">' + t("mGenreDrama") + '</span><span class="am-gp">Game of Thrones</span></div></div></div>' +
      '<div class="am-wr-foot"><span>' + t("mWrReady") + '</span><span class="am-wr-cta">' + t("mWrCta") + "<i>" + ic("arrow", 10) + "</i></span></div></div>" +
      '<div class="am-arch"><span class="am-ictile">' + ic("calendar", 13) + "</span><div><b>" + t("mWrArchive") + "</b><small>" + t("mWrArchiveSub", { n: 3 }) + '</small></div><span class="am-yrs"><i class="on">26</i><i>25</i><i>23</i></span>' + ic("chev", 11) + "</div>" +
      "</div>";
  };

  /* ═══ Profil ═══════════════════════════════════════════════════════════ */
  function mcard(color, icon, title, weeks, nums, durs) {
    var units = ["mUnitY", "mUnitMo", "mUnitD", "mUnitH", "mUnitMin"];
    return '<div class="am-mcard" style="--mc:' + color + '"><div class="am-mc-h"><span class="am-ictile">' + ic(icon, 15) + '</span><div class="am-mc-t"><b class="h">' + title + '</b><span class="am-wk">' + ic("shield-fill", 7) + t("mWeeksN", { n: weeks }) + '</span></div><div class="am-mc-n">' +
      nums.map(function (n) { return '<div><span class="n">' + n[0] + "</span><small>" + n[1] + "</small></div>"; }).join("") + '<span class="am-chev">' + ic("chev", 11) + "</span></div></div>" +
      '<div class="am-durs">' + durs.map(function (d, i) { return '<span><span class="n' + (d ? "" : " z") + '">' + d + "</span><small>" + t(units[i]) + "</small></span>"; }).join("") + "</div></div>";
  }
  screens.profile = function () {
    var hexes = [["#22C55E", "tv"], ["#22C55E", "inbox"], ["#22C55E", "flag"], ["#EAB308", "infinite"], ["#A855F7", "trend-up"], ["#A855F7", "aperture"], ["#A855F7", "star"], ["#A855F7", "library"]];
    return '<div class="am-scroll am-proftop">' +
      '<div class="am-phead"><div class="am-halo" style="--p:58">' + avatar(0, 74, "A") + '</div><div class="am-pid"><h3>Alex Morgan</h3><p>@alex</p>' +
      '<span class="am-prem-pill">' + ic("diamond", 10) + "Premium</span>" +
      '<div class="am-pmeta">' + ic("mail", 10) + '<span>alex@example.com</span><span class="v">' + ic("verified", 10) + "</span></div>" +
      '<div class="am-pmeta">' + ic("calendar", 10) + "<span>" + t("mJoined") + " " + fdate(2026, 5, 11, { day: "numeric", month: "short", year: "numeric" }) + "</span></div>" +
      '<div class="am-pbtns"><span class="ac">' + ic("edit", 11) + "</span><span>" + ic("bell", 11) + '</span><button type="button" class="am-gear" data-go="settings" aria-label="' + t("mTabSettings") + '">' + ic("gear", 12) + "</button><span>" + ic("share-social", 11) + "</span><span>" + ic("flag", 11) + "</span></div></div></div>" +
      '<div class="am-bstrip"><span class="am-bcount">' + ic("ribbon", 9) + "57/154" + ic("chev", 8) + "</span>" + hexes.map(function (h) { return '<span class="am-hex" style="--c:' + h[0] + '"><span>' + ic(h[1], 10) + "</span></span>"; }).join("") + "</div>" +
      '<div class="am-fbar">' + [["search", "#6366F1", "mFriendSearch"], [null, "#6366F1", "mFriends"], ["chat-fill", "#8B5CF6", "mMessages"], ["mail-fill", "#22C55E", "mRequests"]].map(function (x) {
        return '<span><i style="color:' + x[1] + ";background:color-mix(in srgb," + x[1] + ' 20%,transparent)">' + (x[0] ? ic(x[0], 13) : '<b class="n">2</b>') + "</i><small>" + t(x[2]) + "</small></span>";
      }).join("") + "</div>" +
      '<div class="am-lab am-lab-row"><span>' + t("mStatsUpper") + '</span><span class="am-segpill"><span class="on">' + t("mWithRewatch") + "</span><span>" + t("mUnique") + "</span></span></div>" +
      '<div class="am-total"><div class="am-total-h"><span class="am-ictile">' + ic("clock", 15) + "</span><div><small>" + t("mTotalDur") + '</small><b class="h">' + fmt(94286) + " " + t("mMin") + '</b></div><span class="am-chev">' + ic("swap", 13) + "</span></div>" +
      '<div class="am-tbar"><i class="m"></i><i class="t"></i></div><div class="am-tleg"><span style="--d:#4A9BE8">' + t("mMovies") + " <b>" + fmt(3287) + " " + t("mMin") + '</b></span><span style="--d:#E2573F">' + t("mTv") + " <b>" + fmt(90999) + " " + t("mMin") + "</b></span></div></div>" +
      mcard("#3B82F6", "film", t("mMovies"), 0, [[26, t("mMoviesWatched")]], [0, 0, 2, 6, 47]) +
      mcard("#EF4444", "tv", t("mTv"), 9, [[2485, t("mEpisodeCount")], [19, t("mSeriesCount")]], [0, 2, 3, 4, 39]) +
      '<div class="am-lab">' + t("mActivity") + '</div><div class="am-act"><div class="am-act-h"><span class="am-act-ic">' + ic("sparkles", 15) + '</span><div><b class="h">' + t("mActCount", { n: 38 }) + "</b><small>" + t("mActSub") + '</small></div><span class="am-arrowtile">' + ic("arrow", 12) + "</span></div>" +
      '<div class="am-act-g">' + [["star", "#F97316", 16], ["chat-fill", "#22C55E", 10], ["newspaper", "#3B82F6", 2], ["doc", "#A855F7", 0], ["images", "#EC4899", 0], ["heart-fill", "#EF4444", 10]].map(function (x) {
        return '<span><i style="color:' + x[1] + '">' + ic(x[0], 12) + '</i><b class="n">' + x[2] + "</b></span>";
      }).join("") + "</div></div>" +
      '<div class="am-logout">' + ic("logout", 13) + t("mLogout") + "</div>" +
      "</div>";
  };

  /* ═══ CineMatch (tam ekran) ════════════════════════════════════════════ */
  var AIOPT = {
    mood: [["cozy", "cafe", "mCozy"], ["thrilling", "pulse", "mThrilling"], ["funny", "happy", "mFunny"], ["emotional", "heart", "mEmotional"], ["mind", "infinite", "mMindbending"], ["adv", "compass", "mAdventurous"]],
    length: [["short", "flash", "mShort"], ["medium", "clock", "mMedium"], ["long", "hourglass", "mLong"]],
    company: [["solo", "user", "mSolo"], ["partner", "heart", "mPartner"], ["friends", "people", "mFriendsCo"], ["family", "home", "mFamily"]]
  };
  function aiSheet(st) {
    var ai = st.ai;
    var ready = !!(ai.mood || ai.length || ai.company);
    function group(field, label) {
      return '<div class="am-ai-l">' + t(label) + '</div><div class="am-chips">' + AIOPT[field].map(function (o) {
        return '<button type="button" class="am-chip' + (ai[field] === o[0] ? " on" : "") + '" data-vibe="' + field + ":" + o[0] + '" aria-pressed="' + (ai[field] === o[0]) + '">' + ic(o[1], 11) + t(o[2]) + "</button>";
      }).join("") + "</div>";
    }
    var head = '<div class="am-ai-h"><button type="button" class="am-aiclose" data-ai-close aria-label="' + t("mClose") + '">' + ic("chev-down", 17) + '</button><span class="am-star4"></span>' +
      '<div class="am-ai-t"><b class="h">CineMatch</b><div class="am-ai-q"><i></i><span>Premium · ' + t("mAiLeft", { n: 20 }) + "</span></div></div>" +
      '<div class="am-ai-hb"><span>' + ic("sliders", 12) + "</span><span>" + ic("chat-plus", 12) + "</span><span>" + ic("history", 12) + "</span></div></div>";
    var body;
    if (ai.phase === "think") {
      body = '<div class="am-think"><span class="am-dots"><i></i><i></i><i></i></span><p>' + t("mThinking") + "</p></div>";
    } else if (ai.phase === "result") {
      var picks = [[MOV.interstellar, "Interstellar", "8.5"], [MOV.inception, "Inception", "8.4"], [MOV.shawshank, "The Shawshank Redemption", "8.7"]];
      body = picks.map(function (p) {
        return '<div class="am-pick">' + img(p[0], 185) + '<div class="am-pick-tx"><b>' + p[1] + "</b>" + rated(p[2]) + '<span class="am-pick-b"><span class="am-pick-btn">' + ic("plus", 10) + t("mActWatchlist") + '</span><span class="am-pick-btn ghost">' + t("mActDetail") + "</span></span></div></div>";
      }).join("") + '<button type="button" class="am-ai-again" data-vibe-reset>' + ic("refresh", 12) + t("mVibeTitle") + "</button>";
    } else {
      var prompts = ["🎯 " + t("mAiForYou", { genre: t("mGenreAction") }), t("mAiChip0"), t("mAiChip1"), t("mAiChip2"), t("mAiChip3"), t("mAiChip4"), t("mAiChip5"), t("mAiSurprise")];
      body = '<div class="am-ai-hero"><span class="am-star4"></span><div><small>' + t("mAiMoment") + '</small><b class="h">' + t("mAiHero") + "</b><p>" + t("mAiHeroSub") + "</p></div></div>" +
        '<div class="am-vibe"><div class="am-vibe-h"><span class="am-vibe-ic">' + ic("wand", 13) + '</span><div><b class="h">' + t("mVibeTitle") + "</b><small>" + t("mVibeSub") + "</small></div></div>" +
        group("mood", "mMoodLabel") + group("length", "mLengthLabel") + group("company", "mCompanyLabel") +
        '<button type="button" class="am-cta' + (ready ? "" : " off") + '" data-vibe-go' + (ready ? "" : ' aria-disabled="true"') + ">" + ic("sparkles", 13) + (ready ? t("mVibeCta") : t("mPickOne")) + "</button></div>" +
        '<div class="am-modes">' + [["compass", "mAiTabExplore", "mAiTabExploreHint"], ["swap", "mAiTabPlan", "mAiTabPlanHint"], ["layers", "mAiTabLists", "mAiTabListsHint"]].map(function (m, i) {
          return '<span class="' + (i ? "" : "on") + '"><i>' + ic(m[0], 11) + "</i><b>" + t(m[1]) + "</b><small>" + t(m[2]) + "</small></span>";
        }).join("") + "</div>" +
        prompts.map(function (p) { return '<div class="am-qp-row"><i>' + ic("compass", 11) + "</i><span>" + esc(p) + "</span>" + ic("arrow", 12) + "</div>"; }).join("");
    }
    return head + '<div class="am-ai-body">' + body + '</div><div class="am-ai-in"><i>' + ic("sparkles", 13) + "</i><span>" + t("mAiPlaceholder") + "</span><i>" + ic("arrow", 13).replace('viewBox="0 0 24 24"', 'viewBox="0 0 24 24" style="transform:rotate(-90deg)"') + "</i></div>";
  }

  /* ── Telefon ───────────────────────────────────────────────────────── */
  var TABS = [["movies", "play", "mTabMovies"], ["hub", "game", "mTabFun"], ["library", "library", "mTabLibrary"], ["profile", "user", "mTabProfile"]];
  // Sekme olmayan ekranlar hangi sekmenin altında açılır (Ayarlar: Profil'in dişlisinden).
  var PARENT_TAB = { settings: "profile" };
  var phones = [];
  var uid = 0;

  // Büyük afiş dönencesi: ortadaki afiş tam boy, kenara gittikçe %70'e küçülür.
  function bindCars(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll("[data-car]"), function (car) {
      var raf = 0;
      function update() {
        raf = 0;
        var mid = car.scrollLeft + car.clientWidth / 2;
        Array.prototype.forEach.call(car.children, function (c) {
          var d = Math.min(1, Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) / (c.offsetWidth + 5));
          c.style.setProperty("--s", (1 - d * 0.3).toFixed(3));
        });
      }
      car.addEventListener("scroll", function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
      update();
    });
  }

  function create(host, opts) {
    opts = opts || {};
    var st = {
      screen: opts.screen || "movies", media: "movie", pick: { trend: 0, best: 0 }, poll: null, remTop: 0, family: "studio", tone: "mid",
      ai: { open: false, phase: "pick", mood: null, length: null, company: null }, timer: null
    };
    var tabs = opts.tabs !== false;

    host.classList.add("am-wrap");
    host.innerHTML =
      '<div class="am" data-theme="studio" data-tabs="' + tabs + '">' +
      '<div class="am-bezel"><div class="am-screen">' +
      '<div class="am-status"><b>9:41</b><span class="am-sig"><span class="am-bars4"><i></i><i></i><i></i><i></i></span>' + ic("wifi", 13) + '<span class="am-batt"><b>90</b></span></span></div><span class="am-island"></span>' +
      '<div class="am-pages"></div>' +
      (tabs ? tabbar() : "") +
      '<div class="am-sheet" role="dialog" aria-label="CineMatch" hidden></div>' +
      "</div></div></div>";

    var el = host.querySelector(".am");
    var pages = host.querySelector(".am-pages");
    var sheet = host.querySelector(".am-sheet");

    function tabbar() {
      var i, h = '<div class="am-bar-wrap"><div class="am-bar" role="tablist" aria-label="App"><i class="am-ind"></i>';
      for (i = 0; i < TABS.length; i++) {
        h += '<button type="button" role="tab" class="am-tab" data-go="' + TABS[i][0] + '"><span class="am-tab-ic"></span><span class="am-tab-l"></span></button>';
      }
      return h + '</div><button type="button" class="am-aibtn" data-ai aria-haspopup="dialog">' + ic("sparkles", 19) + "</button></div>";
    }

    function paintTabs() {
      if (!tabs) return;
      var current = PARENT_TAB[st.screen] || st.screen;
      Array.prototype.forEach.call(host.querySelectorAll(".am-tab"), function (b, i) {
        var on = b.dataset.go === current;
        b.classList.toggle("on", on);
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.querySelector(".am-tab-ic").innerHTML = ic(on ? TABS[i][1] + "-fill" : TABS[i][1], 17);
        var label = b.querySelector(".am-tab-l");
        label.textContent = t(TABS[i][2]);
        // iOS sekme etiketi gibi: uzun çeviride (de "Filme & Serien") yazı küçülür, kesilmez.
        label.style.fontSize = label.textContent.length > 12 ? "6.3px" : label.textContent.length > 10 ? "6.9px" : "";
      });
      var idx = TABS.map(function (x) { return x[0]; }).indexOf(current);
      var ind = host.querySelector(".am-ind");
      if (ind) ind.style.transform = "translateX(" + (Math.max(idx, 0) * 100) + "%)";
      var ai = host.querySelector(".am-aibtn");
      if (ai) {
        ai.setAttribute("aria-label", "CineMatch");
        ai.setAttribute("aria-expanded", st.ai.open ? "true" : "false");
      }
    }

    function render() {
      var fn = screens[st.screen] || screens.movies;
      // aria-hidden YOK: sayfa içinde odaklanabilir denetimler (anahtar, çipler, tema, anket) var.
      pages.innerHTML = '<div class="am-page" data-screen="' + st.screen + '">' + fn(st) + "</div>";
      bindCars(pages);
      paintTabs();
      renderSheet();
    }
    function renderSheet() {
      sheet.hidden = !st.ai.open;
      el.classList.toggle("ai-open", st.ai.open);
      if (st.ai.open) sheet.innerHTML = aiSheet(st);
    }
    function applyTheme() {
      el.setAttribute("data-theme", FAM_TONE[st.family][st.tone]);
    }

    function show(name) {
      var wantAi = name === "ai";
      if (wantAi) name = "movies"; // arka plan; CineMatch tam ekran üstte açılır
      if (!screens[name]) return;
      st.screen = name;
      st.ai.open = wantAi;
      if (wantAi) st.ai.phase = "pick";
      render();
      var sc = pages.querySelector(".am-scroll");
      if (sc) sc.scrollTop = 0;
    }

    function closeAi() { clearTimeout(st.timer); st.ai.open = false; renderSheet(); paintTabs(); }

    // Bir çizimde kaydırma konumunu koru (tema/çip/anket değişince ekran baştan çizilir).
    function keep(fn) {
      var sc = pages.querySelector(".am-scroll");
      var y = sc ? sc.scrollTop : 0;
      var xs = Array.prototype.map.call(pages.querySelectorAll(".am-hs,.am-chiprow"), function (r) { return r.scrollLeft; });
      fn();
      sc = pages.querySelector(".am-scroll");
      if (sc) sc.scrollTop = y;
      Array.prototype.forEach.call(pages.querySelectorAll(".am-hs,.am-chiprow"), function (r, i) { if (xs[i]) r.scrollLeft = xs[i]; });
    }

    // Yeniden çizimde klavye odağı kaybolmasın (deste role="button" bir div).
    function refocus(sel) { var n = pages.querySelector(sel); if (n && document.activeElement === document.body) n.focus({ preventScroll: true }); }
    host.addEventListener("keydown", function (ev) {
      var el = ev.target;
      if ((ev.key === "Enter" || ev.key === " ") && el.hasAttribute && el.tagName !== "BUTTON" && (el.hasAttribute("data-remnext") || el.hasAttribute("data-go"))) { ev.preventDefault(); el.click(); }
    });

    host.addEventListener("click", function (ev) {
      var target = ev.target.closest ? ev.target.closest("[data-go],[data-ai],[data-ai-close],[data-mt],[data-pick],[data-poll],[data-remnext],[data-fam],[data-tone],[data-vibe],[data-vibe-go],[data-vibe-reset]") : null;
      if (!target || !host.contains(target)) return;
      if (target.hasAttribute("data-go")) { show(target.getAttribute("data-go")); return; }
      if (target.hasAttribute("data-ai")) {
        st.ai.open = !st.ai.open;
        if (st.ai.open && st.ai.phase === "think") st.ai.phase = "pick";
        renderSheet(); paintTabs(); return;
      }
      if (target.hasAttribute("data-ai-close")) { closeAi(); return; }
      if (target.hasAttribute("data-mt")) {
        st.media = target.getAttribute("data-mt"); st.pick = { trend: 0, best: 0 };
        render(); var sc = pages.querySelector(".am-scroll"); if (sc) sc.scrollTop = 0; return;
      }
      if (target.hasAttribute("data-pick")) {
        var kv = target.getAttribute("data-pick").split(":");
        st.pick[kv[0]] = +kv[1]; keep(render); return;
      }
      if (target.hasAttribute("data-poll")) { st.poll = +target.getAttribute("data-poll"); keep(render); return; }
      if (target.hasAttribute("data-remnext")) { st.remTop = (st.remTop + 1) % target.children.length; keep(render); refocus("[data-remnext]"); return; }
      if (target.hasAttribute("data-fam")) { st.family = target.getAttribute("data-fam"); applyTheme(); keep(render); return; }
      if (target.hasAttribute("data-tone")) { st.tone = target.getAttribute("data-tone"); applyTheme(); keep(render); return; }
      if (target.hasAttribute("data-vibe")) {
        var parts = target.getAttribute("data-vibe").split(":");
        st.ai[parts[0]] = st.ai[parts[0]] === parts[1] ? null : parts[1];
        var body = sheet.querySelector(".am-ai-body"), y = body ? body.scrollTop : 0;
        renderSheet();
        body = sheet.querySelector(".am-ai-body"); if (body) body.scrollTop = y;
        return;
      }
      if (target.hasAttribute("data-vibe-reset")) { st.ai.phase = "pick"; renderSheet(); return; }
      if (target.hasAttribute("data-vibe-go")) {
        if (!(st.ai.mood || st.ai.length || st.ai.company)) return;
        st.ai.phase = "think"; renderSheet();
        clearTimeout(st.timer);
        st.timer = setTimeout(function () { st.ai.phase = "result"; renderSheet(); }, 1500);
      }
    });

    var api = {
      el: el, host: host,
      show: show,
      setLang: function () { keep(render); },
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
    helpers: {
      t: t, ic: ic, img: img, rated: rated, avatar: avatar, row: row, nav: nav, chip: chip, sh: sh, pcards: pcards, esc: esc, toggle: toggle,
      fdate: fdate, fmt: fmt, lcard: lcard, remCard: remCard, notesCard: notesCard, themeCard: themeCard, MOV: MOV, TVS: TVS, AV: AV
    },
    setLang: function (l) {
      lang = l;
      phones.forEach(function (p) { p.setLang(); });
    },
    DESIGN: { w: DESIGN_W, h: DESIGN_H }
  };
})(window);
