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

  var NUMBERS = ["views", "sessions", "visitors", "newcomers", "engagedSec"];
  var MAPS = ["pages", "hours", "refs", "countries", "langs", "devices", "os"];

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

  return {
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
