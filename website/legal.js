/* legal.js — yasal sayfaların ortak davranışı.
 *
 * Neden sözlük (I18N objesi) değil de DOM'da iki dil bloğu?
 * Uzun hukuki metinde yüzlerce çeviri anahtarı tutmak metni okunmaz hâle
 * getirir ve anahtar kayması riski taşır. Burada her sayfa iki
 * <section data-lang-block="tr|en"> içeriyor; JS yalnızca hangisinin
 * görüneceğine karar veriyor. JS çalışmazsa iki blok da görünür kalır —
 * yasal metin her koşulda okunabilir olmalı.
 *
 * Dil seçimi landing (index.html) ile aynı localStorage anahtarını
 * paylaşır: "wf_lang". Uygulama içindeki bağlantılar `?lang=tr|en` ekler:
 * telefonun dili uygulamanın diliyle aynı olmak zorunda değil, yasal metin
 * kullanıcının uygulamada seçtiği dilde açılmalı.
 */
(function () {
  "use strict";

  var LANGS = ["tr", "en"];
  var KEY = "wf_lang";

  function readStored() {
    try {
      var v = localStorage.getItem(KEY);
      return LANGS.indexOf(v) !== -1 ? v : null;
    } catch (e) {
      return null; // Depolama kapalıysa (gizli sekme/katı ayarlar) sessiz geç.
    }
  }

  function store(lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) { /* yoksay */ }
  }

  /* ?lang=tr / ?lang=en — uygulamadan gelen bağlantı bunu ekler.
     "tr-TR" gibi bölgeli değerler de kabul edilir (ilk iki harf). */
  function readParam() {
    var m = /[?&]lang=([a-z-]+)/i.exec(location.search || "");
    var v = m ? m[1].toLowerCase().slice(0, 2) : null;
    return LANGS.indexOf(v) !== -1 ? v : null;
  }

  function detect() {
    var nav = (navigator.language || navigator.userLanguage || "").toLowerCase();
    return nav.indexOf("tr") === 0 ? "tr" : "en";
  }

  /* İçindekiler kutusu: masaüstünde (≥1000px) her zaman açık — kenar
     çubuğunda duruyor. Küçük ekranda tek satıra katlanır; orada sayfanın
     en üstünde yapışkan durduğu için kapalı başlaması gerekiyor.
     Markup'ta `open` var: JS çalışmazsa liste her koşulda erişilebilir kalır. */
  var tocBox = document.querySelector(".toc-box");
  var wide = window.matchMedia("(min-width: 1000px)");
  function syncToc(e) {
    if (!tocBox) return;
    // Kullanıcı elle açtıysa/kapattıysa küçük ekranda ona dokunma.
    if (e && !wide.matches && tocBox.dataset.touched === "1") return;
    tocBox.open = wide.matches;
  }
  if (tocBox) {
    syncToc();
    tocBox.addEventListener("toggle", function () {
      if (!wide.matches) tocBox.dataset.touched = "1";
    });
    if (wide.addEventListener) wide.addEventListener("change", syncToc);
    else if (wide.addListener) wide.addListener(syncToc); // eski Safari
    /* Küçük ekranda bir başlığa atlayınca listeyi kapat: yapışkan kutu
       hedefin üstünü kapatmasın. */
    document.addEventListener("click", function (ev) {
      var a = ev.target.closest && ev.target.closest(".toc a");
      if (a && !wide.matches) tocBox.open = false;
    });
  }

  var blocks = Array.prototype.slice.call(document.querySelectorAll("[data-lang-block]"));
  var buttons = Array.prototype.slice.call(document.querySelectorAll(".lang button[data-lang]"));
  var tocList = document.querySelector(".toc ol");
  var tocTitle = document.querySelector(".toc-title");
  var barPage = document.querySelector(".bar-page");
  var current = null;
  var spy = null;

  /* İçindekiler'i aktif dil bloğunun h2'lerinden üretir; böylece başlık
     listesi metinle asla ayrışmaz. */
  function buildToc(block) {
    if (!tocList) return;
    tocList.innerHTML = "";
    var heads = block.querySelectorAll("h2[id]");
    if (!heads.length) {
      var toc = document.querySelector(".toc");
      if (toc) toc.hidden = true;
      return;
    }
    var frag = document.createDocumentFragment();
    Array.prototype.forEach.call(heads, function (h) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.dataset.toc || h.textContent;
      li.appendChild(a);
      frag.appendChild(li);
    });
    tocList.appendChild(frag);
    startSpy(heads);
  }

  /* Kaydırırken görünür bölümü İçindekiler'de işaretler. */
  function startSpy(heads) {
    if (spy) spy.disconnect();
    if (!("IntersectionObserver" in window)) return;
    var links = {};
    Array.prototype.forEach.call(tocList.querySelectorAll("a"), function (a) {
      links[a.getAttribute("href").slice(1)] = a;
    });
    var visible = {};
    spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { visible[en.target.id] = en.isIntersecting; });
      var first = null;
      Array.prototype.forEach.call(heads, function (h) {
        if (!first && visible[h.id]) first = h.id;
      });
      Object.keys(links).forEach(function (id) {
        links[id].classList.toggle("active", id === first);
      });
    }, { rootMargin: "-90px 0px -70% 0px", threshold: 0 });
    Array.prototype.forEach.call(heads, function (h) { spy.observe(h); });
  }

  function apply(lang) {
    if (LANGS.indexOf(lang) === -1) lang = "en";
    current = lang;
    document.documentElement.lang = lang;

    var active = null;
    blocks.forEach(function (b) {
      var on = b.dataset.langBlock === lang;
      b.hidden = !on;
      if (on) active = b;
    });

    buttons.forEach(function (btn) {
      var on = btn.dataset.lang === lang;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    // Sekme başlığı, üst bardaki sayfa adı ve İçindekiler etiketi dile uyar.
    // dataset anahtarı camelCase'e çevrilir: data-title-tr → titleTr.
    var titleKey = lang === "tr" ? "titleTr" : "titleEn";
    if (document.body.dataset[titleKey]) {
      document.title = document.body.dataset[titleKey];
    }
    if (barPage && barPage.dataset[lang]) barPage.textContent = barPage.dataset[lang];
    if (tocTitle && tocTitle.dataset[lang]) tocTitle.textContent = tocTitle.dataset[lang];

    document.querySelectorAll("[data-foot-tr][data-foot-en]").forEach(function (el) {
      el.textContent = el.dataset["foot" + (lang === "tr" ? "Tr" : "En")];
    });

    if (active) buildToc(active);
  }

  buttons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var lang = btn.dataset.lang;
      if (lang === current) return;
      store(lang);
      apply(lang);
    });
  });

  /* Kopyala düğmeleri: data-copy-target ile eşleşen <pre> içeriğini alır. */
  document.querySelectorAll("[data-copy-target]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var el = document.getElementById(btn.dataset.copyTarget);
      if (!el) return;
      var text = el.innerText;
      var done = function () {
        var old = btn.textContent;
        btn.textContent = btn.dataset.doneLabel || "✓";
        btn.classList.add("done");
        setTimeout(function () {
          btn.textContent = old;
          btn.classList.remove("done");
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () { fallback(text, done); });
      } else {
        fallback(text, done);
      }
    });
  });

  // clipboard API'si yoksa (http, eski tarayıcı) seçim tabanlı yedek yol.
  function fallback(text, done) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* yoksay */ }
    document.body.removeChild(ta);
  }

  /* Sıra önemli: adres çubuğundaki istek, daha önce kaydedilmiş tercihten
     önce gelir. Parametreyle gelen dil ayrıca kaydedilir; kullanıcı yasal
     sayfalar arasında gezinirken (bağlantılarda parametre yok) dil sabit kalsın. */
  var fromParam = readParam();
  if (fromParam) store(fromParam);
  apply(fromParam || readStored() || detect());
})();
