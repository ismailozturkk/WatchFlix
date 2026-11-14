/* legal.js — yasal sayfaların ortak davranışı.
 *
 * Neden sözlük (I18N objesi) değil de DOM'da iki dil bloğu?
 * Uzun hukuki metinde yüzlerce çeviri anahtarı tutmak metni okunmaz hâle
 * getirir ve anahtar kayması riski taşır. Burada her sayfa iki
 * <section data-lang-block="tr|en"> içeriyor; JS yalnızca hangisinin
 * görüneceğine karar veriyor. JS çalışmazsa iki blok da görünür kalır —
 * yasal metin her koşulda okunabilir olmalı.
 *
 * Site 12 dil bilir (site-lang.js: tr · en · es · pt · de · it · fr · ja · zh · hi · id · ko).
 * HUKUKİ METİN uygulamanın 8 dilinde var (tr · en · es · pt · de · it · fr · ja);
 * Türkçe asıl metin, diğerleri çeviri. Çeviri bloklarında üstte o dilde bir not
 * çıkar ("bu bir çeviridir; çelişkide Türkçe esas"). Yalnız sitede olan dillerde
 * (zh · hi · id · ko) İngilizce blok gösterilir; çerçeve (başlık, içindekiler, alt
 * bilgi) seçilen dilde kalır ve not "metin bu dilde yok" der. Yeni dil çevrilirse
 * üç sayfaya <section data-lang-block="xx"> ekle, BLOCK_LANGS'e yaz, CHROME.<dil>.note'u
 * çeviri notuna çevir ve utils/appLanguages `legalLang`'i aç. TR/EN metni değişince
 * çeviri blokları da aynı değişikliği almalı.
 *
 * Dil seçimi landing (index.html) ile aynı localStorage anahtarını paylaşır
 * ("wf_lang"). Uygulama içindeki bağlantılar `?lang=` ekler: telefonun dili
 * uygulamanın diliyle aynı olmak zorunda değil, yasal metin kullanıcının
 * uygulamada seçtiği dilde açılmalı.
 */
(function () {
  "use strict";

  var SL = window.SiteLang;
  var BLOCK_LANGS = ["tr", "en", "es", "pt", "de", "it", "fr", "ja"]; // metni olan diller; diğerleri İngilizceye düşer

  var CHROME = {
    tr: { home: "Ana sayfa", privacy: "Gizlilik Politikası", terms: "Kullanım Şartları", "delete": "Hesap Silme", toc: "İçindekiler", menu: "Dil" },
    en: { home: "Home", privacy: "Privacy Policy", terms: "Terms of Use", "delete": "Delete Account", toc: "Contents", menu: "Language" },
    es: {
      home: "Inicio", privacy: "Política de privacidad", terms: "Términos de uso", "delete": "Eliminar cuenta", toc: "Contenido", menu: "Idioma",
      note: "Esta es una traducción del texto original en turco. Si hay diferencias entre las versiones, prevalece el texto en turco.",
    },
    pt: {
      home: "Início", privacy: "Política de Privacidade", terms: "Termos de Uso", "delete": "Excluir conta", toc: "Conteúdo", menu: "Idioma",
      note: "Esta é uma tradução do texto original em turco. Se houver diferenças entre as versões, prevalece o texto em turco.",
    },
    de: {
      home: "Startseite", privacy: "Datenschutzerklärung", terms: "Nutzungsbedingungen", "delete": "Konto löschen", toc: "Inhalt", menu: "Sprache",
      note: "Dies ist eine Übersetzung des türkischen Originaltexts. Bei Abweichungen zwischen den Fassungen gilt der türkische Text.",
    },
    it: {
      home: "Home", privacy: "Informativa sulla privacy", terms: "Termini di utilizzo", "delete": "Elimina account", toc: "Indice", menu: "Lingua",
      note: "Questa è una traduzione del testo originale in turco. In caso di divergenze tra le versioni, prevale il testo in turco.",
    },
    fr: {
      home: "Accueil", privacy: "Politique de confidentialité", terms: "Conditions d’utilisation", "delete": "Supprimer le compte", toc: "Sommaire", menu: "Langue",
      note: "Ceci est une traduction du texte original en turc. En cas de divergence entre les versions, le texte turc prévaut.",
    },
    ja: {
      home: "ホーム", privacy: "プライバシーポリシー", terms: "利用規約", "delete": "アカウント削除", toc: "目次", menu: "言語",
      note: "本文書はトルコ語の原文を翻訳したものです。言語版の間に相違がある場合は、トルコ語版が優先されます。",
    },
    zh: {
      home: "首页", privacy: "隐私政策", terms: "使用条款", "delete": "删除账户", toc: "目录", menu: "语言",
      note: "本法律文本暂未提供中文版本。当前为您显示英语版本；如各版本之间存在差异，以土耳其语文本为准。",
    },
    hi: {
      home: "होम", privacy: "गोपनीयता नीति", terms: "उपयोग की शर्तें", "delete": "खाता हटाएँ", toc: "विषय-सूची", menu: "भाषा",
      note: "यह कानूनी पाठ अभी हिन्दी में उपलब्ध नहीं है। हम आपको अंग्रेज़ी संस्करण दिखा रहे हैं; यदि संस्करणों में कोई अंतर होता है, तो तुर्की पाठ मान्य होगा।",
    },
    id: {
      home: "Beranda", privacy: "Kebijakan Privasi", terms: "Ketentuan Penggunaan", "delete": "Hapus Akun", toc: "Daftar Isi", menu: "Bahasa",
      note: "Teks hukum ini belum tersedia dalam bahasa Indonesia. Kami menampilkan versi bahasa Inggris; jika terdapat perbedaan antarversi, teks bahasa Turki yang berlaku.",
    },
    ko: {
      home: "홈", privacy: "개인정보 처리방침", terms: "이용약관", "delete": "계정 삭제", toc: "목차", menu: "언어",
      note: "이 법률 문서는 아직 한국어로 제공되지 않습니다. 아래에 영어 버전을 표시하며, 버전 간 차이가 있을 경우 튀르키예어 원문이 우선합니다.",
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
