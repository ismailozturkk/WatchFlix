/* legal.js — yasal sayfaların ortak davranışı.
 *
 * Neden sözlük (I18N objesi) değil de DOM'da iki dil bloğu?
 * Uzun hukuki metinde yüzlerce çeviri anahtarı tutmak metni okunmaz hâle
 * getirir ve anahtar kayması riski taşır. Burada her sayfa iki
 * <section data-lang-block="tr|en"> içeriyor; JS yalnızca hangisinin
 * görüneceğine karar veriyor. JS çalışmazsa iki blok da görünür kalır —
 * yasal metin her koşulda okunabilir olmalı.
 *
 * Site 5 dil bilir (site-lang.js: tr · en · es · pt · de) ama HUKUKİ METİN yalnız
 * Türkçe ve İngilizce. es/pt/de seçiliyse İngilizce blok gösterilir; sayfanın
 * çerçevesi (başlık, içindekiler, alt bilgi) seçilen dilde, üstte de o dilde bir
 * not çıkar ("metin tr/en; çelişkide Türkçe esas"). Hukuki metni çevirmek hukuki
 * inceleme ister; çevrilirse ilgili dil için <section data-lang-block="xx"> ekle,
 * BLOCK_LANGS'e yaz ve CHROME.<dil>.note'u sil.
 *
 * Dil seçimi landing (index.html) ile aynı localStorage anahtarını paylaşır
 * ("wf_lang"). Uygulama içindeki bağlantılar `?lang=` ekler: telefonun dili
 * uygulamanın diliyle aynı olmak zorunda değil, yasal metin kullanıcının
 * uygulamada seçtiği dilde açılmalı.
 */
(function () {
  "use strict";

  var SL = window.SiteLang;
  var BLOCK_LANGS = ["tr", "en"]; // metni olan diller; diğerleri İngilizceye düşer

  var CHROME = {
    tr: { home: "Ana sayfa", privacy: "Gizlilik Politikası", terms: "Kullanım Şartları", "delete": "Hesap Silme", toc: "İçindekiler", menu: "Dil" },
    en: { home: "Home", privacy: "Privacy Policy", terms: "Terms of Use", "delete": "Delete Account", toc: "Contents", menu: "Language" },
    es: {
      home: "Inicio", privacy: "Política de privacidad", terms: "Términos de uso", "delete": "Eliminar cuenta", toc: "Contenido", menu: "Idioma",
      note: "Este texto legal solo está disponible en turco e inglés. Te mostramos la versión en inglés; si hay diferencias entre versiones, prevalece el texto en turco.",
    },
    pt: {
      home: "Início", privacy: "Política de Privacidade", terms: "Termos de Uso", "delete": "Excluir conta", toc: "Conteúdo", menu: "Idioma",
      note: "Este texto legal está disponível apenas em turco e inglês. Mostramos a versão em inglês; se houver diferenças entre as versões, prevalece o texto em turco.",
    },
    de: {
      home: "Startseite", privacy: "Datenschutzerklärung", terms: "Nutzungsbedingungen", "delete": "Konto löschen", toc: "Inhalt", menu: "Sprache",
      note: "Dieser Rechtstext gibt es nur auf Türkisch und Englisch. Wir zeigen dir die englische Fassung; bei Abweichungen gilt der türkische Text.",
    },
  };

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
  var tocList = document.querySelector(".toc ol");
  var tocTitle = document.getElementById("tocTitle");
  var barPage = document.getElementById("barPage");
  var page = document.body.dataset.page || "privacy";
  var main = document.querySelector("main");
  var note = null;
  var menu = null;
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

  function ensureNote() {
    if (note || !main) return note;
    note = document.createElement("p");
    note.className = "lang-note";
    note.setAttribute("role", "note");
    note.hidden = true;
    main.insertBefore(note, main.firstChild);
    return note;
  }

  function apply(lang) {
    if (SL.LANGS.indexOf(lang) === -1) lang = "en";
    current = lang;
    var blockLang = BLOCK_LANGS.indexOf(lang) !== -1 ? lang : "en";
    var chrome = CHROME[lang];
    document.documentElement.lang = blockLang;

    var active = null;
    blocks.forEach(function (b) {
      var on = b.dataset.langBlock === blockLang;
      b.hidden = !on;
      if (on) active = b;
    });

    // Sekme başlığı, üst bardaki sayfa adı, İçindekiler etiketi ve alt bilgi seçilen dilde.
    document.title = chrome[page] + " — seelogd";
    if (barPage) barPage.textContent = chrome[page];
    if (tocTitle) tocTitle.textContent = chrome.toc;
    Array.prototype.forEach.call(document.querySelectorAll("[data-nav]"), function (el) {
      var label = chrome[el.dataset.nav];
      if (label) el.textContent = label;
    });
    if (menu) { menu.set(lang); menu.setLabel(chrome.menu); }

    var n = ensureNote();
    if (n) {
      n.textContent = chrome.note || "";
      n.hidden = !chrome.note;
    }

    if (active) buildToc(active);
  }

  function setLang(lang) {
    if (lang === current) return;
    SL.store(lang);
    SL.syncUrl(lang);
    apply(lang);
  }

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
     önce gelir (SiteLang.resolve) ve ayrıca kaydedilir; kullanıcı yasal
     sayfalar arasında gezinirken (bağlantılarda parametre yok) dil sabit kalsın. */
  var initial = SL.resolve();
  menu = SL.mountMenu(document.getElementById("langMenu"), initial, setLang, CHROME[initial].menu);
  apply(initial);
})();
