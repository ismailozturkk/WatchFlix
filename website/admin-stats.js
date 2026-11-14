/* admin-stats.js — yönetim panelinin SAF yardımcıları (DOM ve Firebase yok; jest: __tests__/siteAdminStats.test.js).
 *
 * siteStats belgeleri günde SHARDS parçadır ({day}_{n}, functions/siteStats.js); burada günlere ve toplama
 * katlanır. Tarayıcıda window.AdminStats, Node'da module.exports.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AdminStats = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var NUMBERS = ["views", "sessions", "visitors", "newcomers", "engagedSec", "engagedSessions", "signups"];
  var MAPS = [
    "pages", "hours", "refs", "countries", "langs", "devices", "os",
    // 14 Kas: ayrıntılı analiz (functions/siteStats.js başlığı)
    "browsers", "siteLangs", "screens", "returnGap", "campaigns", "engagedRefs", "scroll", "actions",
    "convRefs", "convCountries", "convDevices", "convLangs",
  ];

  var DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });

  /** İstanbul takvimine göre "YYYY-MM-DD" (sunucunun gün anahtarıyla aynı). */
  function istanbulDay(date) {
    var p = {};
    DAY_FMT.formatToParts(date).forEach(function (x) { p[x.type] = x.value; });
    return p.year + "-" + p.month + "-" + p.day;
  }

  /** Son `days` gün, eskiden yeniye (bugün dahil). */
  function dayRange(days, now) {
    var out = [];
    var base = now || new Date();
    for (var i = days - 1; i >= 0; i -= 1) out.push(istanbulDay(new Date(base.getTime() - i * 86400000)));
    // Yaz saati yok (TR UTC+3 sabit) ama yine de tekrarı ayıkla.
    return out.filter(function (d, i) { return out.indexOf(d) === i; });
  }

  function emptyTotals() {
    var t = {};
    NUMBERS.forEach(function (k) { t[k] = 0; });
    MAPS.forEach(function (k) { t[k] = {}; });
    return t;
  }

  function addInto(target, source) {
    NUMBERS.forEach(function (k) {
      var n = Number(source[k]);
      if (isFinite(n)) target[k] += n;
    });
    MAPS.forEach(function (k) {
      var m = source[k];
      if (!m || typeof m !== "object") return;
      Object.keys(m).forEach(function (key) {
        var n = Number(m[key]);
        if (isFinite(n)) target[k][key] = (target[k][key] || 0) + n;
      });
    });
    return target;
  }

  /** Parça belgelerini (data() nesneleri) gün gün ve aralığın toplamı olarak birleştirir. */
  function mergeStats(docs, days) {
    var byDay = {};
    (days || []).forEach(function (d) { byDay[d] = emptyTotals(); });
    var total = emptyTotals();
    (docs || []).forEach(function (doc) {
      if (!doc || typeof doc.day !== "string") return;
      if (days && !byDay[doc.day]) return;
      if (!byDay[doc.day]) byDay[doc.day] = emptyTotals();
      addInto(byDay[doc.day], doc);
      addInto(total, doc);
    });
    return { byDay: byDay, total: total };
  }

  /** Haritadan en büyük `limit` girdi; kalanlar tek "__other" satırında. share = toplam içindeki pay (0–1). */
  function topEntries(map, limit) {
    var entries = Object.keys(map || {}).map(function (k) { return [k, Number(map[k]) || 0]; })
      .filter(function (e) { return e[1] > 0; })
      .sort(function (a, b) { return b[1] - a[1] || (a[0] < b[0] ? -1 : 1); });
    var sum = entries.reduce(function (s, e) { return s + e[1]; }, 0);
    var max = limit || 8;
    var shown = entries.slice(0, max);
    var rest = entries.slice(max).reduce(function (s, e) { return s + e[1]; }, 0);
    if (rest > 0) shown.push(["__other", rest]);
    return shown.map(function (e) { return { key: e[0], value: e[1], share: sum ? e[1] / sum : 0 }; });
  }

  /** 83 → "1 dk 23 sn", 9 → "9 sn", 0 → "0 sn". */
  function formatDuration(sec) {
    var s = Math.max(0, Math.round(Number(sec) || 0));
    var m = Math.floor(s / 60);
    var r = s % 60;
    if (!m) return r + " sn";
    return m + " dk " + (r < 10 ? "0" : "") + r + " sn";
  }

  /** ISO ülke kodu → bayrak emojisi; geçersiz/XX → 🌐 */
  function flagOf(code) {
    if (!/^[A-Z]{2}$/.test(code || "") || code === "XX") return "🌐";
    return String.fromCodePoint(0x1f1e6 + code.charCodeAt(0) - 65, 0x1f1e6 + code.charCodeAt(1) - 65);
  }

  /** CSV satırları; hücre başındaki = + - @ (formül enjeksiyonu) tırnakla etkisizleşir. */
  function toCsv(rows) {
    return rows.map(function (row) {
      return row.map(function (cell) {
        var s = cell == null ? "" : String(cell);
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(",");
    }).join("\r\n");
  }

  /** Firestore Timestamp | Date | ms → Date | null */
  function toDate(value) {
    if (!value) return null;
    if (typeof value.toDate === "function") return value.toDate();
    var d = value instanceof Date ? value : new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  /** Kayıt listesini arama, tarih ve sıralama seçimine göre süzer. Girdi dizisini değiştirmez. */
  function selectRows(rows, options, now) {
    var opts = options || {};
    var q = String(opts.search || "").trim().toLocaleLowerCase("tr-TR");
    var start = opts.period && opts.period !== "all" ? dayRange(Number(opts.period), now)[0] : null;
    return (rows || []).filter(function (r) {
      if (opts.platform && r.platform !== opts.platform) return false;
      if (q && !String(r.email || "").toLocaleLowerCase("tr-TR").includes(q)) return false;
      if (start && (!r.at || istanbulDay(r.at) < start)) return false;
      return true;
    }).sort(function (a, b) {
      if (opts.sort === "email") return String(a.email || "").localeCompare(String(b.email || ""), "tr");
      if (opts.sort === "queue") return (Number(a.queueNo) || Infinity) - (Number(b.queueNo) || Infinity);
      var diff = (a.at ? a.at.getTime() : 0) - (b.at ? b.at.getTime() : 0);
      return opts.sort === "old" ? diff : -diff;
    });
  }

  /** Önceki döneme göre değişim: { diff, ratio (null = önceki 0), dir: "up"|"down"|"flat" }. */
  function delta(current, previous) {
    var c = Number(current) || 0;
    var p = Number(previous) || 0;
    var diff = c - p;
    return { diff: diff, ratio: p ? diff / p : null, dir: diff > 0 ? "up" : diff < 0 ? "down" : "flat" };
  }

  /** a / b güvenli oran (b = 0 → 0). */
  function rate(a, b) {
    var d = Number(b) || 0;
    return d ? (Number(a) || 0) / d : 0;
  }

  /** "YYYY-MM-DD" → haftanın günü, Pazartesi = 0 … Pazar = 6 (gün anahtarı takvim günüdür, saat dilimi yok). */
  function weekdayOf(day) {
    var d = new Date(day + "T00:00:00Z");
    return (d.getUTCDay() + 6) % 7;
  }

  /** Gün × saat ısı haritası: 7 satır (Pzt→Paz) × 24 sütun görüntüleme toplamı ve en büyük hücre. */
  function weekHourMatrix(byDay, days) {
    var grid = [];
    for (var r = 0; r < 7; r += 1) { grid.push([]); for (var h = 0; h < 24; h += 1) grid[r].push(0); }
    var max = 0;
    (days || Object.keys(byDay || {})).forEach(function (day) {
      var hours = byDay && byDay[day] && byDay[day].hours;
      if (!hours) return;
      var row = weekdayOf(day);
      Object.keys(hours).forEach(function (k) {
        var h = Number(k);
        var n = Number(hours[k]) || 0;
        if (h >= 0 && h < 24 && n > 0) { grid[row][h] += n; if (grid[row][h] > max) max = grid[row][h]; }
      });
    });
    return { grid: grid, max: max };
  }

  /** Kayıt listesini (r.at: Date) gün gün sayar; days dışındakiler atlanır. */
  function countByDay(rows, days) {
    var out = {};
    (days || []).forEach(function (d) { out[d] = 0; });
    (rows || []).forEach(function (r) {
      if (!r || !r.at) return;
      var d = istanbulDay(r.at);
      if (Object.prototype.hasOwnProperty.call(out, d)) out[d] += 1;
    });
    return out;
  }

  /** Bir alanın değerlerini sayar (ör. platform, lang) → { değer: adet }; boş değer "xx". */
  function countBy(rows, field) {
    var out = {};
    (rows || []).forEach(function (r) {
      var k = r && r[field] ? String(r[field]) : "xx";
      out[k] = (out[k] || 0) + 1;
    });
    return out;
  }

  /**
   * Kaynak tablosu: oturum, ilgili oturum (15 sn+), kayıt ve oranlar; oturuma göre büyükten küçüğe.
   * Kaydı olup oturumu sayılmamış kaynak (ör. eski oturum bayrağı) yine satır olur.
   */
  function sourceTable(total) {
    var refs = (total && total.refs) || {};
    var engaged = (total && total.engagedRefs) || {};
    var conv = (total && total.convRefs) || {};
    var keys = {};
    [refs, engaged, conv].forEach(function (m) { Object.keys(m).forEach(function (k) { keys[k] = 1; }); });
    return Object.keys(keys).map(function (k) {
      var sessions = Number(refs[k]) || 0;
      var eng = Number(engaged[k]) || 0;
      var sign = Number(conv[k]) || 0;
      return { key: k, sessions: sessions, engaged: eng, signups: sign, engagedRate: rate(eng, sessions), convRate: rate(sign, sessions) };
    }).filter(function (r) { return r.sessions || r.signups; })
      .sort(function (a, b) { return b.sessions - a.sessions || b.signups - a.signups || (a.key < b.key ? -1 : 1); });
  }

  /** Ziyaretçi → ilgili oturum → kayıt denemesi → kayıt hunisi (aralık toplamından). */
  function funnel(total) {
    var a = (total && total.actions) || {};
    var tries = (Number(a.waitlist_try) || 0) + (Number(a.beta_try) || 0);
    var steps = [
      { key: "visitors", value: Number(total && total.visitors) || 0 },
      { key: "engaged", value: Number(total && total.engagedSessions) || 0 },
      { key: "tries", value: tries },
      { key: "signups", value: Number(total && total.signups) || 0 },
    ];
    var first = steps[0].value;
    return steps.map(function (s, i) {
      return { key: s.key, value: s.value, ofFirst: rate(s.value, first), ofPrev: i ? rate(s.value, steps[i - 1].value) : 1 };
    });
  }

  return {
    delta: delta,
    rate: rate,
    weekdayOf: weekdayOf,
    weekHourMatrix: weekHourMatrix,
    countByDay: countByDay,
    countBy: countBy,
    sourceTable: sourceTable,
    funnel: funnel,
    NUMBERS: NUMBERS,
    MAPS: MAPS,
    istanbulDay: istanbulDay,
    dayRange: dayRange,
    emptyTotals: emptyTotals,
    mergeStats: mergeStats,
    topEntries: topEntries,
    formatDuration: formatDuration,
    flagOf: flagOf,
    toCsv: toCsv,
    toDate: toDate,
    selectRows: selectRows,
  };
});
