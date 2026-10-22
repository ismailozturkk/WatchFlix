/* site-lang.js — landing (index.html) ve yasal sayfaların ORTAK dil mantığı.
 *
 * Site, uygulamanın 5 diliyle aynı dilleri bilir: tr · en · es · pt · de
 * (kaynak: utils/appLanguages.js → APP_LANGUAGES). Yeni dil eklerken:
 *   1) LANGS / NAMES / SHORT'a ekle,
 *   2) home-i18n.js'e dil sözlüğünü ekle,
 *   3) legal.js içindeki CHROME'a menü/altbilgi metinlerini ekle.
 *
 * Dil seçimi tek localStorage anahtarında ("wf_lang") tutulur; sayfalar
 * arasında gezinirken sabit kalır. Öncelik: ?lang= (uygulamadan gelen bağlantı)
 * → kayıtlı tercih → tarayıcı dili → İngilizce.
 *
 * `mountMenu`: üst çubuktaki dil menüsünü (düğme + liste) kurar. Markup'ı JS
 * üretir ki dört sayfada aynı HTML kopyalanmasın; stili lang-menu.css'te.
 */
(function (root) {
  "use strict";

  var LANGS = ["tr", "en", "es", "pt", "de"];
  var NAMES = { tr: "Türkçe", en: "English", es: "Español", pt: "Português", de: "Deutsch" };
  var SHORT = { tr: "TR", en: "EN", es: "ES", pt: "PT", de: "DE" };
  var KEY = "wf_lang";

  /* "pt-BR", "de-AT", "TR" gibi değerlerin ilk iki harfi. Desteklenmiyorsa null. */
  function norm(value) {
    if (!value) return null;
    var v = String(value).toLowerCase().slice(0, 2);
    return LANGS.indexOf(v) !== -1 ? v : null;
  }

  function readStored() {
    try { return norm(localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  function store(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) { /* gizli sekme / kapalı depolama */ }
  }

  function readParam() {
    var m = /[?&]lang=([a-z-]+)/i.exec(location.search || "");
    return m ? norm(m[1]) : null;
  }

  function detect() {
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages
      : [navigator.language || navigator.userLanguage || ""];
    for (var i = 0; i < list.length; i++) {
      var n = norm(list[i]);
      if (n) return n;
    }
    return "en";
  }

  /* Sıra önemli: adres çubuğundaki istek kayıtlı tercihten önce gelir ve
     ayrıca kaydedilir (kullanıcı sayfalar arasında gezinirken dil sabit kalsın). */
  function resolve() {
    var fromParam = readParam();
    if (fromParam) { store(fromParam); return fromParam; }
    return readStored() || detect();
  }

  /* Adreste ?lang= varsa seçilen dile günceller; yoksa dokunmaz. Aksi hâlde
     ?lang=en ile gelen kullanıcı dili değiştirip sayfayı yenileyince eski dile döner. */
  function syncUrl(lang) {
    try {
      var u = new URL(location.href);
      if (u.searchParams.has("lang")) {
        u.searchParams.set("lang", lang);
        history.replaceState(null, "", u.toString());
      }
    } catch (e) { /* eski tarayıcı */ }
  }

  var ICON_GLOBE =
    '<svg class="lm-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9z"/></svg>';
  var ICON_CHEVRON =
    '<svg class="lm-chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

  /* Dil menüsü. host: boş bir kap öğe. onSelect(lang): seçim yapılınca çağrılır.
     Dönen nesne: set(lang) menüdeki aktif dili günceller, setLabel(text) erişilebilir adı. */
  function mountMenu(host, current, onSelect, label) {
    if (!host) return null;
    host.classList.add("lang-menu");
    host.innerHTML =
      '<button type="button" class="lm-btn" aria-haspopup="listbox" aria-expanded="false">' +
      ICON_GLOBE + '<span class="lm-cur"></span>' + ICON_CHEVRON + "</button>" +
      '<ul class="lm-list" role="listbox" tabindex="-1" hidden></ul>';

    var btn = host.querySelector(".lm-btn");
    var cur = host.querySelector(".lm-cur");
    var list = host.querySelector(".lm-list");
    var value = current;

    LANGS.forEach(function (code) {
      var li = document.createElement("li");
      li.setAttribute("role", "option");
      li.dataset.lang = code;
      li.tabIndex = -1;
      li.innerHTML =
        '<span class="lm-name">' + NAMES[code] + '</span><span class="lm-code">' + SHORT[code] +
        '</span><svg class="lm-tick" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
      list.appendChild(li);
    });
    var items = Array.prototype.slice.call(list.children);

    function paint() {
      cur.textContent = SHORT[value];
      items.forEach(function (li) {
        li.setAttribute("aria-selected", li.dataset.lang === value ? "true" : "false");
      });
    }

    function open() {
      list.hidden = false;
      host.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      var active = items.filter(function (li) { return li.dataset.lang === value; })[0] || items[0];
      active.focus();
    }

    function close(focusBtn) {
      list.hidden = true;
      host.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      if (focusBtn) btn.focus();
    }

    function choose(code) {
      close(true);
      if (code === value) return;
      value = code;
      paint();
      onSelect(code);
    }

    btn.addEventListener("click", function () { if (list.hidden) open(); else close(false); });
    list.addEventListener("click", function (ev) {
      var li = ev.target.closest && ev.target.closest("li[data-lang]");
      if (li) choose(li.dataset.lang);
    });
    list.addEventListener("keydown", function (ev) {
      var i = items.indexOf(document.activeElement);
      if (ev.key === "ArrowDown") { ev.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (ev.key === "ArrowUp") { ev.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (ev.key === "Home") { ev.preventDefault(); items[0].focus(); }
      else if (ev.key === "End") { ev.preventDefault(); items[items.length - 1].focus(); }
      else if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); if (i >= 0) choose(items[i].dataset.lang); }
      else if (ev.key === "Escape") { ev.preventDefault(); close(true); }
      else if (ev.key === "Tab") { close(false); }
    });
    btn.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown") { ev.preventDefault(); if (list.hidden) open(); }
    });
    document.addEventListener("click", function (ev) {
      if (!list.hidden && !host.contains(ev.target)) close(false);
    });

    if (label) btn.setAttribute("aria-label", label);
    paint();

    return {
      set: function (code) { value = code; paint(); },
      setLabel: function (text) { btn.setAttribute("aria-label", text); },
    };
  }

  root.SiteLang = {
    LANGS: LANGS, NAMES: NAMES, SHORT: SHORT, KEY: KEY,
    norm: norm, store: store, resolve: resolve, syncUrl: syncUrl, mountMenu: mountMenu,
  };
})(window);
