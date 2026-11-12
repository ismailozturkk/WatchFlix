/* site-lang.js — landing (index.html) ve yasal sayfaların ORTAK dil mantığı.
 *
 * Site 12 dili destekler: tr · en · es · pt · de · it · fr · ja · zh · hi · id · ko
 * Yeni dil eklerken:
 *   1) LANGS / NAMES / SHORT'a ekle,
 *   2) home-i18n.js ve mock-i18n.js'e dil sözlüğünü ekle,
 *   3) legal.js içindeki CHROME'a menü/altbilgi metinlerini ekle.
 *
 * Dil seçimi tek localStorage anahtarında ("wf_lang") tutulur; sayfalar
 * arasında gezinirken sabit kalır. Öncelik: ?lang= (uygulamadan gelen bağlantı)
 * → kayıtlı tercih → cihaz/tarayıcı dili + yerel bölge/konum (saat dilimi) → İngilizce ("en").
 *
 * `mountMenu`: üst çubuktaki dil menüsünü (düğme + liste) kurar. Markup'ı JS
 * üretir ki dört sayfada aynı HTML kopyalanmasın; stili lang-menu.css'te.
 */
(function (root) {
  "use strict";

  var LANGS = ["tr", "en", "es", "pt", "de", "it", "fr", "ja", "zh", "hi", "id", "ko"];
  var NAMES = {
    tr: "Türkçe",
    en: "English",
    es: "Español",
    pt: "Português",
    de: "Deutsch",
    it: "Italiano",
    fr: "Français",
    ja: "日本語",
    zh: "中文",
    hi: "हिन्दी",
    id: "Bahasa Indonesia",
    ko: "한국어",
  };
  var SHORT = {
    tr: "TR",
    en: "EN",
    es: "ES",
    pt: "PT",
    de: "DE",
    it: "IT",
    fr: "FR",
    ja: "JA",
    zh: "ZH",
    hi: "HI",
    id: "ID",
    ko: "KO",
  };
  var KEY = "wf_lang";

  /* Eski veya alternatif ISO dil alt etiketleri (ör. eski Android/Java "in" -> "id"). */
  var LANG_ALIASES = {
    in: "id", ind: "id",
    cmn: "zh", yue: "zh", wuu: "zh", zho: "zh",
    jpn: "ja", kor: "ko", hin: "hi", ita: "it",
    fra: "fr", fre: "fr", deu: "de", ger: "de",
    spa: "es", por: "pt", tur: "tr", eng: "en",
  };

  /* İzin istemeden erişilebilen yerel ayar (BCP-47) ülke/bölge alt etiketlerinden dil eşlemesi. */
  var REGION_LANG = {
    TR: "tr", CY: "tr",
    IT: "it", SM: "it", VA: "it",
    FR: "fr", MC: "fr",
    JP: "ja",
    CN: "zh", TW: "zh", HK: "zh", MO: "zh",
    IN: "hi",
    ID: "id",
    KR: "ko",
    DE: "de", AT: "de", LI: "de",
    ES: "es", MX: "es", AR: "es", CO: "es", CL: "es", PE: "es", VE: "es",
    EC: "es", UY: "es", PY: "es", BO: "es", CR: "es", PA: "es", DO: "es",
    GT: "es", HN: "es", SV: "es", NI: "es", CU: "es", PR: "es",
    BR: "pt", PT: "pt", AO: "pt", MZ: "pt",
    US: "en", GB: "en", AU: "en", CA: "en", NZ: "en", IE: "en",
  };

  /* İzin istemeden erişilebilen IANA saat diliminden (Intl) bölge/dil eşlemesi. */
  var TZ_LANG = {
    "Europe/Istanbul": "tr", "Asia/Istanbul": "tr", "Europe/Nicosia": "tr", "Asia/Nicosia": "tr",
    "Europe/Rome": "it", "Europe/Vatican": "it", "Europe/San_Marino": "it",
    "Europe/Paris": "fr", "Europe/Monaco": "fr",
    "Asia/Tokyo": "ja", "Japan": "ja",
    "Asia/Shanghai": "zh", "Asia/Chongqing": "zh", "Asia/Harbin": "zh", "Asia/Urumqi": "zh",
    "Asia/Kashgar": "zh", "Asia/Taipei": "zh", "Asia/Hong_Kong": "zh", "Asia/Macau": "zh", "Asia/Macao": "zh",
    "Asia/Kolkata": "hi", "Asia/Calcutta": "hi",
    "Asia/Jakarta": "id", "Asia/Pontianak": "id", "Asia/Makassar": "id", "Asia/Ujung_Pandang": "id", "Asia/Jayapura": "id",
    "Asia/Seoul": "ko", "ROK": "ko",
    "Europe/Berlin": "de", "Europe/Busingen": "de", "Europe/Vienna": "de", "Europe/Vaduz": "de",
    "Europe/Madrid": "es", "Africa/Ceuta": "es", "Atlantic/Canary": "es",
    "America/Mexico_City": "es", "America/Cancun": "es", "America/Merida": "es", "America/Monterrey": "es",
    "America/Tijuana": "es", "America/Chihuahua": "es", "America/Hermosillo": "es", "America/Mazatlan": "es",
    "America/Argentina/Buenos_Aires": "es", "America/Buenos_Aires": "es", "America/Cordoba": "es",
    "America/Argentina/Cordoba": "es", "America/Argentina/Mendoza": "es",
    "America/Bogota": "es", "America/Santiago": "es", "America/Lima": "es", "America/Caracas": "es",
    "America/Guayaquil": "es", "America/Montevideo": "es", "America/Asuncion": "es", "America/La_Paz": "es",
    "America/Costa_Rica": "es", "America/Panama": "es", "America/Santo_Domingo": "es", "America/Guatemala": "es",
    "America/Tegucigalpa": "es", "America/El_Salvador": "es", "America/Managua": "es", "America/Havana": "es",
    "America/Sao_Paulo": "pt", "America/Fortaleza": "pt", "America/Recife": "pt", "America/Bahia": "pt",
    "America/Belem": "pt", "America/Manaus": "pt", "America/Cuiaba": "pt", "America/Porto_Velho": "pt",
    "Europe/Lisbon": "pt", "Atlantic/Madeira": "pt", "Atlantic/Azores": "pt",
  };

  /* "pt-BR", "zh-Hans-CN", "in-ID", "TR" gibi değerleri desteklenen 2 harfli koda çevirir. Desteklenmiyorsa null. */
  function norm(value) {
    if (!value) return null;
    var clean = String(value).trim().replace(/_/g, "-");
    if (!clean) return null;
    var primary = clean.split("-")[0].toLowerCase();
    var v = LANG_ALIASES[primary] || primary.slice(0, 2);
    return LANGS.indexOf(v) !== -1 ? v : null;
  }

  function extractRegion(tag) {
    if (!tag) return null;
    var parts = String(tag).trim().replace(/_/g, "-").split("-");
    for (var i = 1; i < parts.length; i++) {
      var p = parts[i];
      if (p.length === 2 && /^[a-zA-Z]{2}$/.test(p)) return p.toUpperCase();
    }
    return null;
  }

  function readStored() {
    try { return norm(localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  function store(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) { /* gizli sekme / kapalı depolama */ }
  }

  function readParam() {
    var m = /[?&]lang=([a-z_-]+)/i.exec(location.search || "");
    return m ? norm(m[1]) : null;
  }

  /* İzin istemeden erişilebilen istemci sinyalleriyle (telefon/tarayıcı dili,
     yerel bölge alt etiketi ve saat dilimi) otomatik dil tespiti. Eşleşme yoksa "en". */
  function detect() {
    var list = [];
    if (typeof navigator !== "undefined") {
      if (navigator.languages && navigator.languages.length) {
        for (var k = 0; k < navigator.languages.length; k++) {
          if (navigator.languages[k]) list.push(navigator.languages[k]);
        }
      }
      var fallbacks = [navigator.language, navigator.userLanguage, navigator.browserLanguage, navigator.systemLanguage];
      for (var f = 0; f < fallbacks.length; f++) {
        if (fallbacks[f] && list.indexOf(fallbacks[f]) === -1) list.push(fallbacks[f]);
      }
    }
    var intlTz = "";
    try {
      var opts = Intl.DateTimeFormat().resolvedOptions();
      if (opts && opts.locale && list.indexOf(opts.locale) === -1) list.push(opts.locale);
      intlTz = (opts && opts.timeZone) || "";
    } catch (e) { /* Intl desteklenmiyor */ }

    // 1) İlk tercih edilen dil doğrudan desteklenen (ve İngilizce dışı) bir dilse hemen seç.
    var firstLang = list.length ? norm(list[0]) : null;
    if (firstLang && firstLang !== "en") return firstLang;

    // 2) Tarayıcı/cihaz dil listesinde İngilizce dışında desteklenen bir dil varsa onu seç.
    for (var i = 0; i < list.length; i++) {
      var n = norm(list[i]);
      if (n && n !== "en") return n;
    }

    // 3) Dil etiketlerindeki ülke/bölge alt etiketine bak (ör. en-TR -> tr, mr-IN -> hi, jv-ID -> id, ca-ES -> es).
    for (var j = 0; j < list.length; j++) {
      var reg = extractRegion(list[j]);
      if (reg && REGION_LANG[reg] && REGION_LANG[reg] !== "en") {
        return REGION_LANG[reg];
      }
    }

    // 4) İzin gerektirmeyen saat dilimi (konum/bölge) sinyaline bak (ör. Europe/Istanbul -> tr, Asia/Tokyo -> ja).
    if (intlTz && TZ_LANG[intlTz]) {
      return TZ_LANG[intlTz];
    }

    // 5) Dil veya bölge desteklenenler arasında yoksa varsayılan İngilizce ("en").
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
    norm: norm, detect: detect, store: store, resolve: resolve, syncUrl: syncUrl, mountMenu: mountMenu,
  };
})(window);
