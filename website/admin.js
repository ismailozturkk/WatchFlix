/* admin.js — site yönetim paneli (admin.html).
 *
 * Akış: Firebase Auth (Google ya da e-posta/şifre) → siteAdmins/{uid} var mı → panel.
 * Yetki YALNIZ firestore.rules'ta (isSiteAdmin); bu dosya hiçbir şey yazmaz, yalnız okur:
 *   siteStats         günlük toplam parçaları (functions/siteStats.js) → Genel bakış, Trafik, Kitle, Davranış, Kayıtlar
 *   betaTesters/waitlist  kayıt listeleri (kopyala, CSV) + kayıt eğilimi
 *   betaFeatureVotes  beta özellik oyları
 * Seçili aralık (Bugün/7/30/90 gün) ile hemen önceki aynı uzunluktaki aralık birlikte okunur; KPI okları ikisini kıyaslar.
 * Saf hesaplar admin-stats.js'te (window.AdminStats, jest: __tests__/siteAdminStats.test.js).
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.7.3/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, signOut,
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, getDocs, query, where,
} from "https://www.gstatic.com/firebasejs/11.7.3/firebase-firestore.js";

const S = window.AdminStats;
const app = initializeApp(window.SITE_CONFIG.firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const nf = new Intl.NumberFormat("tr-TR");
const nf1 = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
const pct1 = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 1 });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const longDayFmt = new Intl.DateTimeFormat("tr-TR", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" });
const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: "Europe/Istanbul" });
const regionName = new Intl.DisplayNames(["tr"], { type: "region" });
const langName = new Intl.DisplayNames(["tr"], { type: "language" });

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const safe = (fn, fallback) => { try { return fn() || fallback; } catch { return fallback; } };
const pctSmart = (v) => (v > 0 && v < 0.1 ? pct1 : pct).format(v);
const dayLabel = (d) => dayFmt.format(new Date(d + "T00:00:00Z"));

const state = {
  days: 30, cur: null, prev: null, curDays: [], prevDays: [],
  beta: [], wait: [], betaVotes: {}, betaPlatform: "",
  page: { beta: 1, wait: 1 }, loaded: { stats: false, beta: false, wait: false, votes: false },
  srcSort: { k: "sessions", dir: -1 }, tab: "overview",
};
const BETA_FEATURES = [
  ["league", "Haftalık Lig"], ["challenges", "Meydan okumalar"], ["tierlist", "Tier list"],
  ["top100", "Seelogd Top 100"], ["chain", "Film Zinciri"], ["rating", "Puan yukarı-aşağı"],
  ["daily_frame", "Günün Karesi"], ["film_club", "Film Kulübü"], ["atmosphere", "Atmosfer"],
  ["profile_banner", "Profil kapağı"], ["app_icon", "Uygulama simgesi"], ["streak_flame", "Haftalık seri alevi"],
  ["match", "Uyum Çemberleri"],
];
const PAGE_SIZE = 25;
const PALETTE = ["#14c8e8", "#a597ff", "#ff5d84", "#ffb547", "#3ddc97", "#3d9bff", "#f27fe0", "#8a97ab"];
const WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const WEEKDAYS_LONG = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];

/* ── Etiketler ───────────────────────────────────────────────────── */
const REF_NAMES = {
  direct: "Doğrudan / bilinmiyor", google: "Google", bing: "Bing", duckduckgo: "DuckDuckGo", yandex: "Yandex",
  instagram: "Instagram", facebook: "Facebook", x: "X (Twitter)", youtube: "YouTube", tiktok: "TikTok", reddit: "Reddit",
  linkedin: "LinkedIn", whatsapp: "WhatsApp", telegram: "Telegram", threads: "Threads", bluesky: "Bluesky",
  "play-store": "Google Play", "app-store": "App Store",
};
const SEARCH_REFS = ["google", "bing", "duckduckgo", "yandex"];
const SOCIAL_REFS = ["instagram", "facebook", "x", "youtube", "tiktok", "reddit", "linkedin", "whatsapp", "telegram", "threads", "bluesky"];
const refLabel = (k) => REF_NAMES[k] || String(k).replace(/_/g, ".");
const campaignLabel = (k) => { const [src, camp] = String(k).split("~"); return `${refLabel(src)} · ${camp || "—"}`; };
const countryLabel = (k) => (k === "XX" || !k ? `${S.flagOf("XX")} Bilinmiyor` : `${S.flagOf(k)} ${safe(() => regionName.of(k), k)}`);
const langLabel = (k) => (k === "xx" || !k ? "Bilinmiyor" : safe(() => langName.of(k), k));
const DEVICE = { mobile: "Telefon", tablet: "Tablet", desktop: "Bilgisayar" };
const OS = { ios: "iOS / iPadOS", android: "Android", windows: "Windows", macos: "macOS", linux: "Linux", other: "Diğer" };
const BROWSER = { chrome: "Chrome", safari: "Safari", firefox: "Firefox", edge: "Edge", samsung: "Samsung Internet", opera: "Opera", inapp: "Uygulama içi (Instagram, TikTok…)", other: "Diğer" };
const SCREEN = { s: "Küçük (< 600 px)", m: "Orta (600–1023 px)", l: "Geniş (≥ 1024 px)" };
const PAGES = { index: "Ana sayfa", privacy: "Gizlilik", terms: "Kullanım şartları", delete: "Hesap silme", other: "Diğer" };
const GAP = { d1: "Dün de gelmişti", w1: "Son 7 gün içinde", m1: "Son 30 gün içinde", old: "30 günden önce" };
const SECTIONS = [
  ["sec_numbers", "Rakamlar"], ["sec_screens", "Ekran görüntüleri"], ["sec_features", "Özellikler"],
  ["sec_plans", "Planlar"], ["sec_faq", "SSS"], ["sec_footer", "Sayfa sonu"],
];
const ACTIONS = {
  tab_beta: ["Beta sekmesi açıldı", "form"], tab_notify: ["Haber ver sekmesi açıldı", "form"],
  waitlist_try: ["Bekleme formu gönderildi", "form"], waitlist_ok: ["Bekleme listesine kayıt", "signup"],
  waitlist_dup: ["Bekleme: zaten listede", "form"], waitlist_err: ["Bekleme: hata", "form"],
  beta_try: ["Beta formu gönderildi", "form"], beta_ok_android: ["Beta kaydı · Android", "signup"],
  beta_ok_ios: ["Beta kaydı · iOS", "signup"], beta_dup: ["Beta: zaten kayıtlı", "form"], beta_err: ["Beta: hata", "form"],
  store_apple: ["App Store düğmesi", "nav"], store_google: ["Google Play düğmesi", "nav"],
  faq_open: ["SSS sorusu açıldı", "nav"], lang_change: ["Site dili değiştirildi", "nav"],
  mock_use: ["Telefon maketiyle oynadı", "nav"], out_social: ["Sosyal medya bağlantısı", "nav"], nav_click: ["Menü bağlantısı", "nav"],
};
const ACTION_KIND = { signup: "Kayıt", form: "Form", nav: "Gezinme" };

/* ── Durum ekranları ─────────────────────────────────────────────── */
function show(id) {
  ["stLoading", "stLogin", "stDenied", "stPanel"].forEach((s) => { $("#" + s).hidden = s !== id; });
}

let toastTimer = null;
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

const AUTH_ERRORS = {
  "auth/popup-closed-by-user": "Giriş penceresi kapatıldı.",
  "auth/cancelled-popup-request": "Giriş penceresi kapatıldı.",
  "auth/popup-blocked": "Tarayıcı giriş penceresini engelledi; açılır pencerelere izin ver.",
  "auth/unauthorized-domain": "Bu alan adı Firebase Auth → Ayarlar → Yetkili alan adları listesinde değil.",
  "auth/invalid-credential": "E-posta ya da şifre hatalı.",
  "auth/too-many-requests": "Çok fazla deneme. Biraz sonra tekrar dene.",
};
const authError = (err) => AUTH_ERRORS[err?.code] || err?.message || "Giriş yapılamadı.";

$("#googleBtn").addEventListener("click", async () => {
  $("#loginErr").textContent = "";
  try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (err) { $("#loginErr").textContent = authError(err); }
});
$("#pwForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  $("#loginErr").textContent = "";
  try { await signInWithEmailAndPassword(auth, $("#pwEmail").value.trim(), $("#pwPass").value); } catch (err) { $("#loginErr").textContent = authError(err); }
});
$("#signOut").addEventListener("click", () => signOut(auth));
$$("[data-signout]").forEach((b) => b.addEventListener("click", () => signOut(auth)));
$("#copyUid").addEventListener("click", () => copy($("#uid").textContent, "UID kopyalandı"));

onAuthStateChanged(auth, async (user) => {
  if (!user) { show("stLogin"); return; }
  $("#whoEmail").textContent = user.email || user.uid;
  show("stLoading");
  let admin = false;
  try {
    admin = (await getDoc(doc(db, "siteAdmins", user.uid))).exists();
  } catch (err) {
    console.error("siteAdmins okunamadı:", err);
  }
  if (!admin) {
    $("#uid").textContent = user.uid;
    show("stDenied");
    return;
  }
  show("stPanel");
  openTab(readHashTab() || "overview", false);
  refreshAll();
});

/* ── Gezinme (sol menü / mobilde çekmece) ────────────────────────── */
const ANALYTIC_TABS = ["overview", "traffic", "audience", "behavior", "signups"];
function readHashTab() {
  const h = location.hash.replace("#", "");
  return $(`.tab[data-tab="${h}"]`) ? h : "";
}
function openTab(name, focusTop = true) {
  const tab = $(`.tab[data-tab="${name}"]`);
  if (!tab) return;
  state.tab = name;
  $$(".tab").forEach((t) => { t.setAttribute("aria-selected", t === tab ? "true" : "false"); t.tabIndex = t === tab ? 0 : -1; });
  $$(".pane").forEach((p) => { p.hidden = p.id !== "pane-" + name; });
  const pane = $("#pane-" + name);
  $("#pageTitle").textContent = pane.dataset.title;
  $("#pageEyebrow").textContent = pane.dataset.eyebrow;
  $("#rangeTools").style.visibility = ANALYTIC_TABS.includes(name) ? "" : "hidden";
  if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
  closeMenu();
  if (focusTop) window.scrollTo({ top: 0, behavior: "smooth" });
  redrawCharts(); // gizli bölmede genişlik 0 ölçülür; açılınca yeniden çiz
}
$$(".tab").forEach((tab) => tab.addEventListener("click", () => openTab(tab.dataset.tab)));
$$(".tab").forEach((tab) => tab.addEventListener("keydown", (ev) => {
  if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(ev.key)) return;
  ev.preventDefault();
  const tabs = $$(".tab");
  const index = tabs.indexOf(tab);
  const target = ev.key === "Home" ? 0 : ev.key === "End" ? tabs.length - 1 : (index + (ev.key === "ArrowDown" ? 1 : -1) + tabs.length) % tabs.length;
  openTab(tabs[target].dataset.tab);
  tabs[target].focus();
}));
document.addEventListener("click", (ev) => {
  const go = ev.target.closest("[data-go]");
  if (go) openTab(go.dataset.go);
});
function closeMenu() {
  $("#side").classList.remove("open");
  $("#scrim").hidden = true;
  $("#menuBtn").setAttribute("aria-expanded", "false");
}
$("#menuBtn").addEventListener("click", () => {
  const open = !$("#side").classList.contains("open");
  $("#side").classList.toggle("open", open);
  $("#scrim").hidden = !open;
  $("#menuBtn").setAttribute("aria-expanded", String(open));
});
$("#scrim").addEventListener("click", closeMenu);
document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") closeMenu(); });

function setSeg(group, btn) {
  group.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
}

/* ── Veri yükleme ────────────────────────────────────────────────── */
let statsRequest = 0;

$("#range").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-days]");
  if (!btn) return;
  setSeg($("#range"), btn);
  state.days = Number(btn.dataset.days);
  loadStats();
});
$("#refresh").addEventListener("click", refreshAll);

async function refreshAll() {
  const button = $("#refresh");
  button.disabled = true;
  $("#updatedAt").textContent = "Veriler yenileniyor…";
  await Promise.allSettled([loadStats(), loadBeta(), loadWait(), loadBetaVotes()]);
  $("#updatedAt").textContent = "Son kontrol: " + dateFmt.format(new Date()) + " · İstanbul saati";
  button.disabled = false;
}

async function loadStats() {
  const all = S.dayRange(state.days * 2);
  const prevDays = all.slice(0, all.length - state.days);
  const curDays = all.slice(all.length - state.days);
  const request = ++statsRequest;
  $$(".kpis").forEach((k) => k.classList.add("busy"));
  try {
    const snap = await getDocs(query(collection(db, "siteStats"), where("day", ">=", all[0]), where("day", "<=", all[all.length - 1])));
    if (request !== statsRequest) return;
    const docs = snap.docs.map((d) => d.data());
    state.curDays = curDays;
    state.prevDays = prevDays;
    state.cur = S.mergeStats(docs, curDays);
    state.prev = S.mergeStats(docs, prevDays);
    state.loaded.stats = true;
    renderAnalytics();
  } catch (err) {
    console.error(err);
    toast("İstatistik okunamadı: " + (err.code || err.message));
  } finally {
    if (request === statsRequest) $$(".kpis").forEach((k) => k.classList.remove("busy"));
  }
}

async function loadBeta() {
  try {
    const snap = await getDocs(collection(db, "betaTesters"));
    state.beta = snap.docs.map((d) => {
      const v = d.data();
      return { email: v.email || "", platform: v.platform || "", lang: v.lang || "", at: S.toDate(v.createdAt) };
    }).sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0));
    state.loaded.beta = true;
    renderBeta();
    if (state.loaded.wait) renderWait();
    renderAnalytics();
  } catch (err) {
    console.error(err);
    toast("Beta listesi okunamadı: " + (err.code || err.message));
  }
}

async function loadWait() {
  try {
    const snap = await getDocs(collection(db, "waitlist"));
    state.wait = snap.docs.map((d) => {
      const v = d.data();
      return { email: v.email || "", queueNo: v.queueNo ?? "", at: S.toDate(v.createdAt) };
    }).sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0));
    state.loaded.wait = true;
    renderWait();
    renderAnalytics();
  } catch (err) {
    console.error(err);
    toast("Bekleme listesi okunamadı: " + (err.code || err.message));
  }
}

async function loadBetaVotes() {
  try {
    const snap = await getDocs(collection(db, "betaFeatureVotes"));
    state.betaVotes = Object.fromEntries(snap.docs.map((item) => [item.id, item.data()]));
    state.loaded.votes = true;
    renderBetaVotes();
  } catch (err) {
    console.error(err);
    toast("Özellik oyları okunamadı: " + (err.code || err.message));
  }
}

/* ── Kayıt kayıtlarından türetilenler ────────────────────────────── */
const inDays = (rows, days) => {
  if (!days.length) return [];
  const first = days[0];
  const last = days[days.length - 1];
  return rows.filter((r) => { if (!r.at) return false; const d = S.istanbulDay(r.at); return d >= first && d <= last; });
};
const betaEmails = () => new Set(state.beta.map((r) => r.email));
/** Beta formu bekleme listesine de yazdığı için "yalnız bekleme" = beta'da olmayan bekleme kaydı. */
const waitOnly = (rows) => { const b = betaEmails(); return rows.filter((r) => !b.has(r.email)); };
/** Aralıkta yeni kayıt olan farklı kişi (iki listenin e-posta birleşimi). */
function peopleIn(days) {
  const set = new Set();
  inDays(state.beta, days).forEach((r) => set.add(r.email));
  inDays(state.wait, days).forEach((r) => set.add(r.email));
  return set.size;
}
const listsReady = () => state.loaded.beta && state.loaded.wait;

/* ── Ortak bileşenler ────────────────────────────────────────────── */
function deltaBadge(cur, prev, { points = false } = {}) {
  if (!state.loaded.stats && !points) return "";
  if (points) {
    const diff = (cur - prev) * 100;
    if (!isFinite(diff)) return "";
    const dir = Math.abs(diff) < 0.05 ? "flat" : diff > 0 ? "up" : "down";
    return `<span class="delta ${dir}" title="Önceki döneme göre">${dir === "up" ? "↑" : dir === "down" ? "↓" : "→"} ${nf1.format(Math.abs(diff))} puan</span>`;
  }
  const d = S.delta(cur, prev);
  if (d.ratio === null) return d.diff > 0 ? `<span class="delta new" title="Önceki dönemde yoktu">yeni</span>` : "";
  return `<span class="delta ${d.dir}" title="Önceki döneme göre: ${nf.format(prev)}">${d.dir === "up" ? "↑" : d.dir === "down" ? "↓" : "→"} ${pct.format(Math.abs(d.ratio))}</span>`;
}

function spark(values, color = "var(--teal)") {
  if (!values || values.length < 2) return "";
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => `${(i / (values.length - 1) * 74).toFixed(1)},${(24 - (v / max) * 22).toFixed(1)}`).join(" ");
  return `<svg class="spark" viewBox="0 0 74 26" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

function kpi(label, value, { sub = "", delta = "", spark: sp = "", accent = "" } = {}) {
  return `<div class="kpi"${accent ? ` style="--accent:${accent}"` : ""}><span>${esc(label)}</span><b>${esc(value)}</b>${delta}${sub ? `<small>${sub}</small>` : ""}${sp}</div>`;
}

const daySeries = (key) => state.curDays.map((d) => Number(state.cur.byDay[d]?.[key]) || 0);

function renderBars(sel, map, label, { limit = 8, empty = "Henüz veri yok" } = {}) {
  const list = $(sel);
  const rows = S.topEntries(map, limit);
  if (!rows.length) { list.innerHTML = `<li class="empty">${esc(empty)}</li>`; return; }
  list.innerHTML = rows.map((r) => {
    const name = r.key === "__other" ? "Diğerleri" : label(r.key);
    return `<li${r.key === "__other" ? ' class="other"' : ""} title="${esc(name)}: ${nf.format(r.value)} (${pctSmart(r.share)})">
      <span class="bar-label">${esc(name)}</span>
      <span class="bar-value">${nf.format(r.value)} <small>${pctSmart(r.share)}</small></span>
      <span class="bar-track"><i style="width:${(r.share * 100).toFixed(1)}%"></i></span>
    </li>`;
  }).join("");
}

function donut(host, map, label, { center = "", limit = 5 } = {}) {
  const el = $(host);
  const rows = S.topEntries(map, limit);
  const sum = rows.reduce((s, r) => s + r.value, 0);
  if (!sum) { el.innerHTML = `<p class="empty">Henüz veri yok</p>`; return; }
  const R = 52;
  const C = 2 * Math.PI * R;
  let off = 0;
  const arcs = rows.map((r, i) => {
    const len = r.share * C;
    const a = `<circle r="${R}" cx="66" cy="66" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="16" stroke-dasharray="${Math.max(0, len - 1.5).toFixed(2)} ${C.toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"/>`;
    off += len;
    return a;
  }).join("");
  el.innerHTML = `<div class="donut"><svg viewBox="0 0 132 132" aria-hidden="true"><circle r="${R}" cx="66" cy="66" fill="none" stroke="rgba(255,255,255,.05)" stroke-width="16"/>${arcs}</svg>
    <div class="mid"><b>${nf.format(sum)}</b><span>${esc(center)}</span></div></div>
    <ul class="donut-legend">${rows.map((r, i) => `<li><i style="background:${PALETTE[i % PALETTE.length]}"></i><span class="nm">${esc(r.key === "__other" ? "Diğerleri" : label(r.key))}</span><em>${nf.format(r.value)}</em><small>${pctSmart(r.share)}</small></li>`).join("")}</ul>`;
}

function steps(host, rows, base, { empty = "Henüz veri yok" } = {}) {
  const el = $(host);
  if (!base || !rows.some((r) => r.value)) { el.innerHTML = `<p class="empty">${esc(empty)}</p>`; return; }
  el.innerHTML = rows.map((r) => {
    const share = Math.min(1, r.value / base);
    return `<div class="step" title="${esc(r.label)}: ${nf.format(r.value)}"><span class="lb">${esc(r.label)}</span><span class="tr"><i style="width:${(share * 100).toFixed(1)}%"></i></span><span class="vl">${pct.format(share)}<small>${nf.format(r.value)}</small></span></div>`;
  }).join("");
}

function rateClass(v, good, mid) { return v >= good ? "good" : v >= mid ? "mid" : "low"; }

/* ── Grafik (çizgi + yığılmış çubuk, tek eksen) ─────────────────── */
const charts = new Map();
function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * pow >= v / 4) * pow;
  return Math.ceil(v / step) * step;
}
/** cfg: { labels:[x etiketi], titles:[ipucu başlığı], series:[{name,color,values,type:"line"|"bar",dashed}], extra?(i) → ipucu ek satırı } */
function chart(sel, cfg) {
  const host = $(sel);
  charts.set(sel, cfg);
  if (!host.clientWidth) return;
  const n = cfg.labels.length;
  const W = host.clientWidth;
  const H = cfg.height || 250;
  const pad = { l: 40, r: 10, t: 12, b: 28 };
  const ih = H - pad.t - pad.b;
  const bars = cfg.series.filter((s) => s.type === "bar");
  const lines = cfg.series.filter((s) => s.type !== "bar");
  // cfg.barAxis: çubuklar sağdaki kendi ekseninde (ör. kayıt sayısı ziyaretçinin yanında kaybolmasın).
  const split = Boolean(cfg.barAxis) && bars.length > 0;
  if (split) pad.r = 34;
  const stackTop = (i) => bars.reduce((s, b) => s + (b.values[i] || 0), 0);
  let rawMax = 0;
  let barMaxRaw = 0;
  for (let i = 0; i < n; i += 1) {
    rawMax = Math.max(rawMax, ...lines.map((l) => l.values[i] || 0), split ? 0 : stackTop(i));
    barMaxRaw = Math.max(barMaxRaw, stackTop(i));
  }
  const max = niceMax(rawMax);
  const barMax = split ? niceMax(barMaxRaw * 2.2) : max; // çubuklar alt yarıda kalsın, çizgileri örtmesin
  const iw2 = W - pad.l - pad.r;
  const slot = iw2 / n;
  const x = (i) => pad.l + slot * i + slot / 2;
  const y = (v) => pad.t + ih - (v / max) * ih;
  const yb = (v) => pad.t + ih - (v / barMax) * ih;

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(cfg.aria || "Grafik")}">`;
  for (let i = 0; i <= 4; i += 1) {
    const v = (max / 4) * i;
    svg += `<line class="grid-line" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${nf.format(v)}</text>`;
    if (split) svg += `<text class="axis bar-axis" x="${W - pad.r + 8}" y="${y(v) + 4}" fill="${bars[0].color}">${nf.format((barMax / 4) * i)}</text>`;
  }
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw2 / 62))));
  cfg.labels.forEach((lb, i) => {
    if (i !== n - 1 && (i % every || n - 1 - i < every)) return;
    svg += `<text class="axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(lb)}</text>`;
  });
  const bw = Math.max(2, Math.min(26, slot * 0.62));
  for (let i = 0; i < n; i += 1) {
    let acc = 0;
    bars.forEach((b) => {
      const v = b.values[i] || 0;
      if (!v) return;
      svg += `<rect class="bar-rect" x="${(x(i) - bw / 2).toFixed(1)}" y="${yb(acc + v).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, yb(acc) - yb(acc + v)).toFixed(1)}" rx="3" fill="${b.color}"${split ? ' opacity=".55"' : ""}/>`;
      acc += v;
    });
  }
  lines.forEach((s) => {
    if (n === 1) { svg += `<circle cx="${x(0)}" cy="${y(s.values[0] || 0)}" r="4" fill="${s.color}"/>`; return; }
    const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v || 0).toFixed(1)}`).join(" ");
    if (s.area) svg += `<polygon points="${x(0).toFixed(1)},${y(0)} ${pts} ${x(n - 1).toFixed(1)},${y(0)}" fill="${s.color}" opacity=".08"/>`;
    svg += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="${s.dashed ? 1.5 : 2.2}" ${s.dashed ? 'stroke-dasharray="4 4" opacity=".7"' : ""} stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  svg += `<g class="hover" hidden><line class="cross" y1="${pad.t}" y2="${pad.t + ih}"/>${lines.map((s, k) => `<circle r="4" fill="${s.color}" class="dot" data-k="${k}"/>`).join("")}</g>`;
  svg += `<rect class="hit" x="${pad.l}" y="${pad.t}" width="${iw2}" height="${ih}" fill="transparent"/></svg><div class="tip" hidden></div>`;
  host.innerHTML = svg;

  const g = host.querySelector(".hover");
  const tip = host.querySelector(".tip");
  const hit = host.querySelector(".hit");
  const move = (ev) => {
    const box = hit.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.floor(((ev.clientX - box.left) / box.width) * n)));
    g.hidden = false;
    const cross = g.querySelector(".cross");
    cross.setAttribute("x1", x(i));
    cross.setAttribute("x2", x(i));
    g.querySelectorAll(".dot").forEach((c) => { c.setAttribute("cx", x(i)); c.setAttribute("cy", y(lines[c.dataset.k].values[i] || 0)); });
    tip.hidden = false;
    tip.innerHTML = `<b>${esc(cfg.titles ? cfg.titles[i] : cfg.labels[i])}</b>` +
      cfg.series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}<em>${nf.format(s.values[i] || 0)}</em></span>`).join("") +
      (cfg.extra ? cfg.extra(i) : "");
    const w = tip.offsetWidth;
    tip.style.left = Math.max(4, x(i) + 14 + w > W ? x(i) - w - 14 : x(i) + 14) + "px";
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", () => { g.hidden = true; tip.hidden = true; });
}
function legend(sel, series) {
  $(sel).innerHTML = series.map((s) => `<li><i class="${s.dashed ? "dashed" : ""}" style="background:${s.color}"></i>${esc(s.name)}</li>`).join("");
}
function redrawCharts() { charts.forEach((cfg, sel) => chart(sel, cfg)); }
let resizeTimer = null;
window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(redrawCharts, 120); });

/** x ekseni: "Bugün"de saat saat (İstanbul), diğerlerinde gün gün. */
function axis() {
  if (state.days === 1) {
    const labels = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
    return { hourly: true, labels, titles: labels.map((h) => `Bugün ${h}:00`) };
  }
  return { hourly: false, labels: state.curDays.map(dayLabel), titles: state.curDays.map((d) => longDayFmt.format(new Date(d + "T00:00:00Z"))) };
}
const hourValues = (hours) => Array.from({ length: 24 }, (_, h) => Number(hours?.[String(h).padStart(2, "0")]) || 0);
function recordSeries(rows, days, hourly) {
  if (hourly) {
    const out = Array(24).fill(0);
    inDays(rows, days).forEach((r) => { out[Number(hourFmt.format(r.at)) % 24] += 1; });
    return out;
  }
  const by = S.countByDay(rows, days);
  return days.map((d) => by[d] || 0);
}

/* ── Analiz bölmeleri ────────────────────────────────────────────── */
function renderAnalytics() {
  if (!state.loaded.stats) { renderListsSummary(); return; }
  renderOverview();
  renderTraffic();
  renderAudience();
  renderBehavior();
  renderSignups();
}

function rangeName() { return state.days === 1 ? "bugün" : `son ${state.days} gün`; }

function renderOverview() {
  const t = state.cur.total;
  const p = state.prev.total;
  const engagedRate = S.rate(t.engagedSessions, t.sessions);
  const prevEngaged = S.rate(p.engagedSessions, p.sessions);
  const avg = S.rate(t.engagedSec, t.sessions);
  const prevAvg = S.rate(p.engagedSec, p.sessions);
  const ready = listsReady();
  const people = ready ? peopleIn(state.curDays) : 0;
  const prevPeople = ready ? peopleIn(state.prevDays) : 0;
  const conv = S.rate(people, t.visitors);
  const prevConv = S.rate(prevPeople, p.visitors);
  const multi = state.days > 1;
  $("#ovKpis").innerHTML = [
    kpi("Ziyaretçi", nf.format(t.visitors), { delta: deltaBadge(t.visitors, p.visitors), sub: `${nf.format(t.newcomers)} ilk kez geldi`, spark: multi ? spark(daySeries("visitors")) : "" }),
    kpi("Oturum", nf.format(t.sessions), { delta: deltaBadge(t.sessions, p.sessions), sub: `${nf1.format(S.rate(t.views, t.sessions))} sayfa / oturum`, spark: multi ? spark(daySeries("sessions"), "var(--violet)") : "", accent: "var(--violet)" }),
    kpi("İlgi oranı", pct.format(engagedRate), { delta: t.sessions || p.sessions ? deltaBadge(engagedRate, prevEngaged, { points: true }) : "", sub: "15 sn+ kalan oturum", accent: "var(--blue)" }),
    kpi("Ort. kalma süresi", S.formatDuration(avg), { delta: deltaBadge(Math.round(avg), Math.round(prevAvg)), sub: "oturum başına, sekme önde", accent: "var(--amber)" }),
    kpi("Yeni kayıt", ready ? nf.format(people) : "…", { delta: ready ? deltaBadge(people, prevPeople) : "", sub: "farklı e-posta · beta + bekleme", accent: "var(--pink)", spark: ready && multi ? spark(recordSeries([...state.beta, ...waitOnly(state.wait)], state.curDays, false), "var(--pink)") : "" }),
    kpi("Ziyaretçiden kayda", ready ? pctSmart(conv) : "…", { delta: ready && (t.visitors || p.visitors) ? deltaBadge(conv, prevConv, { points: true }) : "", sub: "yeni kayıt ÷ ziyaretçi", accent: "var(--green)" }),
  ].join("");

  const ax = axis();
  const series = ax.hourly
    ? [
      { name: "Görüntüleme (bugün)", color: "var(--teal)", values: hourValues(t.hours), area: true },
      { name: "Görüntüleme (dün)", color: "var(--ink-3)", values: hourValues(p.hours), dashed: true },
      { name: "Kayıt (sağ eksen)", color: "var(--pink)", type: "bar", values: ready ? recordSeries([...state.beta, ...waitOnly(state.wait)], state.curDays, true) : [] },
    ]
    : [
      { name: "Ziyaretçi", color: "var(--teal)", values: daySeries("visitors"), area: true },
      { name: "Görüntüleme", color: "var(--violet)", values: daySeries("views") },
      { name: "Önceki dönem ziyaretçi", color: "var(--ink-3)", values: state.prevDays.map((d) => state.prev.byDay[d]?.visitors || 0), dashed: true },
      { name: "Kayıt (sağ eksen)", color: "var(--pink)", type: "bar", values: ready ? recordSeries([...state.beta, ...waitOnly(state.wait)], state.curDays, false) : [] },
    ];
  $("#ovTrendSub").textContent = ax.hourly ? "saat saat · İstanbul saati · kesikli çizgi dün" : "günlük · İstanbul saati · kesikli çizgi önceki dönem";
  legend("#ovLegend", series);
  chart("#ovTrend", {
    ...ax, series, aria: "Ziyaret ve kayıt eğilimi", barAxis: true,
    extra: ax.hourly ? null : (i) => {
      const r = state.cur.byDay[state.curDays[i]];
      return `<span>Ort. süre<em>${S.formatDuration(S.rate(r.engagedSec, r.sessions))}</em></span>`;
    },
  });

  renderFunnel("#ovFunnel", t);
  renderSourceMini("#ovSources", t);
  renderBars("#ovCountries", t.countries, countryLabel, { limit: 6 });
  donut("#ovDevices", t.devices, (k) => DEVICE[k] || k, { center: "ziyaretçi" });
  renderInsights(t, p);
  renderListsSummary();
}

const FUNNEL_LABELS = { visitors: "Ziyaretçi", engaged: "İlgili oturum (15 sn+)", tries: "Kayıt formu gönderildi", signups: "Kayıt tamamlandı" };
function renderFunnel(sel, total) {
  const rows = S.funnel(total);
  if (!rows[0].value) { $(sel).innerHTML = `<p class="empty">Bu aralıkta ziyaret yok</p>`; return; }
  $(sel).innerHTML = rows.map((r, i) => `<div class="f-step">
      <div class="f-top"><span>${FUNNEL_LABELS[r.key]}</span><b>${nf.format(r.value)}</b></div>
      <div class="f-bar"><i style="width:${Math.min(100, r.ofFirst * 100).toFixed(1)}%"></i></div>
      ${i ? `<span class="f-drop">bir önceki adımın <b>${pctSmart(Math.min(r.ofPrev, 9.99))}</b>'i · ziyaretçinin ${pctSmart(r.ofFirst)}'i</span>` : ""}
    </div>`).join("") + `<p class="note">Kayıt adımları 14 Kas 2026'dan beri sayılıyor; ziyaretçi günlük tekillerin toplamıdır.</p>`;
}

function renderSourceMini(sel, total) {
  const rows = S.sourceTable(total).slice(0, 6);
  if (!rows.length) { $(sel).innerHTML = `<p class="empty">Henüz veri yok</p>`; return; }
  $(sel).innerHTML = `<div class="src-mini"><div class="src-row head"><span>Kaynak</span><span class="v">Oturum</span><span class="c">Kayıt</span></div>` +
    rows.map((r) => `<div class="src-row" title="İlgi oranı ${pct.format(r.engagedRate)} · dönüşüm ${pctSmart(r.convRate)}"><span class="nm">${esc(refLabel(r.key))}</span><span class="v">${nf.format(r.sessions)}</span><span class="c">${r.signups ? nf.format(r.signups) + " · " + pctSmart(r.convRate) : "—"}</span></div>`).join("") + "</div>";
}

function renderInsights(t, p) {
  const out = [];
  if (!t.visitors) {
    $("#ovInsights").innerHTML = `<li><i>ℹ️</i><span>Bu aralıkta henüz ziyaret yok. Aralığı genişletmeyi dene.</span></li>`;
    return;
  }
  const d = S.delta(t.visitors, p.visitors);
  if (d.ratio !== null && Math.abs(d.ratio) >= 0.05) out.push(["📈", `Ziyaretçi önceki döneme göre <b>${d.dir === "up" ? "%" + nf.format(Math.round(d.ratio * 100)) + " arttı" : "%" + nf.format(Math.round(-d.ratio * 100)) + " azaldı"}</b> (${nf.format(p.visitors)} → ${nf.format(t.visitors)}).`]);
  const src = S.sourceTable(t);
  const nonDirect = src.filter((r) => r.key !== "direct");
  if (nonDirect.length) out.push(["🔗", `En çok ziyaret getiren dış kaynak <b>${esc(refLabel(nonDirect[0].key))}</b>: ${nf.format(nonDirect[0].sessions)} oturum (${pct.format(S.rate(nonDirect[0].sessions, t.sessions))}).`]);
  const bestConv = src.filter((r) => r.sessions >= 5 && r.signups > 0).sort((a, b) => b.convRate - a.convRate)[0];
  if (bestConv) out.push(["🎯", `En iyi dönüştüren kaynak <b>${esc(refLabel(bestConv.key))}</b>: her 100 oturumdan ${nf1.format(bestConv.convRate * 100)} kayıt.`]);
  const conv = S.topEntries(t.convCountries, 1)[0];
  if (conv) out.push(["🌍", `Kayıt olanların çoğu <b>${esc(countryLabel(conv.key))}</b> (${pct.format(conv.share)}).`]);
  else {
    const c = S.topEntries(t.countries, 1)[0];
    if (c) out.push(["🌍", `Ziyaretçilerin ${pct.format(c.share)}'i <b>${esc(countryLabel(c.key))}</b>.`]);
  }
  const heat = S.weekHourMatrix(state.cur.byDay, state.curDays);
  if (heat.max > 0) {
    let best = [0, 0];
    heat.grid.forEach((row, r) => row.forEach((v, h) => { if (v > heat.grid[best[0]][best[1]]) best = [r, h]; }));
    out.push(["⏰", `En yoğun zaman <b>${WEEKDAYS_LONG[best[0]]} ${String(best[1]).padStart(2, "0")}:00</b> civarı — paylaşımları bu saate yakın planla.`]);
  }
  const inapp = S.rate(t.browsers.inapp, t.visitors);
  if (inapp >= 0.1) out.push(["📱", `Ziyaretçilerin ${pct.format(inapp)}'i <b>uygulama içi tarayıcıdan</b> (Instagram/TikTok vb.) geliyor; bio bağlantıları çalışıyor.`]);
  const mobile = S.rate(t.devices.mobile, t.visitors);
  if (mobile >= 0.5) out.push(["📲", `Ziyaretçilerin <b>${pct.format(mobile)}'i telefondan</b>; mobil görünüm öncelikli.`]);
  $("#ovInsights").innerHTML = out.slice(0, 5).map(([i, text]) => `<li><i>${i}</i><span>${text}</span></li>`).join("") || `<li><i>ℹ️</i><span>Henüz yorum çıkaracak kadar veri yok.</span></li>`;
}

function renderListsSummary() {
  if (!listsReady()) { $("#ovLists").innerHTML = `<p class="empty">Listeler yükleniyor…</p>`; return; }
  const cur = state.curDays.length ? state.curDays : S.dayRange(state.days);
  const betaNew = inDays(state.beta, cur).length;
  const waitNew = inDays(waitOnly(state.wait), cur).length;
  const all = new Set([...state.beta.map((r) => r.email), ...state.wait.map((r) => r.email)]);
  const today = S.istanbulDay(new Date());
  const todayCount = peopleIn([today]);
  $("#ovLists").innerHTML = [
    ["Beta testçisi", state.beta.length, `+${nf.format(betaNew)} ${rangeName()}`, betaNew],
    ["Yalnız bekleme listesi", waitOnly(state.wait).length, `+${nf.format(waitNew)} ${rangeName()}`, waitNew],
    ["Toplam farklı kişi", all.size, "iki liste birleşik", 0],
    ["Bugün kayıt olan", todayCount, "İstanbul takvimi", todayCount],
  ].map(([l, v, s, up]) => `<div class="pair"><span>${l}</span><b>${nf.format(v)}</b><small class="${up ? "up" : ""}">${esc(s)}</small></div>`).join("");
}

function renderTraffic() {
  const t = state.cur.total;
  const p = state.prev.total;
  const share = (keys, m) => keys.reduce((s, k) => s + (Number(m[k]) || 0), 0);
  const campSessions = Object.values(t.campaigns).reduce((s, v) => s + (Number(v) || 0), 0);
  $("#trKpis").innerHTML = [
    kpi("Oturum", nf.format(t.sessions), { delta: deltaBadge(t.sessions, p.sessions) }),
    kpi("Görüntüleme", nf.format(t.views), { delta: deltaBadge(t.views, p.views), sub: `${nf1.format(S.rate(t.views, t.sessions))} sayfa / oturum`, accent: "var(--violet)" }),
    kpi("Arama motoru", pct.format(S.rate(share(SEARCH_REFS, t.refs), t.sessions)), { sub: `${nf.format(share(SEARCH_REFS, t.refs))} oturum`, accent: "var(--blue)" }),
    kpi("Sosyal medya", pct.format(S.rate(share(SOCIAL_REFS, t.refs), t.sessions)), { sub: `${nf.format(share(SOCIAL_REFS, t.refs))} oturum`, accent: "var(--pink)" }),
    kpi("Doğrudan", pct.format(S.rate(t.refs.direct, t.sessions)), { sub: "yazarak / yer imi / bilinmiyor", accent: "var(--ink-3)" }),
    kpi("Kampanyalı oturum", nf.format(campSessions), { sub: "utm_campaign etiketli", accent: "var(--amber)" }),
  ].join("");

  const ax = axis();
  const series = ax.hourly
    ? [{ name: "Görüntüleme", color: "var(--violet)", values: hourValues(t.hours), area: true }]
    : [
      { name: "Ziyaretçi", color: "var(--teal)", values: daySeries("visitors"), area: true },
      { name: "Oturum", color: "var(--blue)", values: daySeries("sessions") },
      { name: "Görüntüleme", color: "var(--violet)", values: daySeries("views") },
    ];
  legend("#trLegend", series);
  chart("#trTrend", { ...ax, series, aria: "Günlük trafik" });

  renderSourceTable();
  renderBars("#trCampaigns", t.campaigns, campaignLabel, { limit: 10, empty: "Etiketli bağlantıdan gelen olmadı" });
  const returning = Math.max(0, t.visitors - t.newcomers);
  $("#trReturning").innerHTML = `<div class="stat-pairs"><div class="pair"><span>Yeni</span><b>${nf.format(t.newcomers)}</b><small>${pct.format(S.rate(t.newcomers, t.visitors))}</small></div><div class="pair"><span>Geri dönen</span><b>${nf.format(returning)}</b><small>${pct.format(S.rate(returning, t.visitors))}</small></div></div>
    <h3 class="sub-h">Geri dönenler en son ne zaman gelmişti?</h3><ol class="bars" id="trGap"></ol>`;
  renderBars("#trGap", t.returnGap, (k) => GAP[k] || k, { empty: "14 Kas 2026'dan beri ölçülüyor" });
  renderBars("#trPages", t.pages, (k) => PAGES[k] || k);
  donut("#trSourceDonut", t.refs, refLabel, { center: "oturum", limit: 6 });
}

function sourceRows() {
  const t = state.cur.total;
  const { k, dir } = state.srcSort;
  return S.sourceTable(t).map((r) => ({ ...r, share: S.rate(r.sessions, t.sessions) }))
    .sort((a, b) => (k === "key" ? refLabel(a.key).localeCompare(refLabel(b.key), "tr") : (a[k] - b[k])) * dir);
}
function renderSourceTable() {
  const rows = sourceRows();
  $$("#srcTable th[data-k]").forEach((th) => {
    th.classList.toggle("asc", th.dataset.k === state.srcSort.k && state.srcSort.dir === 1);
    th.classList.toggle("desc", th.dataset.k === state.srcSort.k && state.srcSort.dir === -1);
    th.tabIndex = 0;
  });
  $("#srcTable tbody").innerHTML = rows.length ? rows.map((r) => `<tr>
      <td>${esc(refLabel(r.key))}</td><td class="num">${nf.format(r.sessions)}</td>
      <td class="num"><span class="mini-bar"><i style="width:${(r.share * 100).toFixed(1)}%"></i></span>${pctSmart(r.share)}</td>
      <td class="num">${nf.format(r.engaged)}</td><td class="num"><span class="rate ${rateClass(r.engagedRate, 0.5, 0.25)}">${r.sessions ? pct.format(r.engagedRate) : "—"}</span></td>
      <td class="num">${nf.format(r.signups)}</td><td class="num"><span class="rate ${rateClass(r.convRate, 0.05, 0.01)}">${r.sessions ? pctSmart(r.convRate) : "—"}</span></td>
    </tr>`).join("") : `<tr><td colspan="7" class="empty">Henüz veri yok</td></tr>`;
}
$("#srcTable thead").addEventListener("click", (ev) => sortSources(ev.target.closest("th[data-k]")));
$("#srcTable thead").addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); sortSources(ev.target.closest("th[data-k]")); } });
function sortSources(th) {
  if (!th || !state.cur) return;
  const k = th.dataset.k;
  state.srcSort = { k, dir: state.srcSort.k === k ? -state.srcSort.dir : k === "key" ? 1 : -1 };
  renderSourceTable();
}
$("#srcCsv").addEventListener("click", () => {
  if (!state.cur) return;
  download(`seelogd-kaynaklar-${state.curDays[0]}_${state.curDays[state.curDays.length - 1]}.csv`, S.toCsv([
    ["source", "sessions", "share", "engagedSessions", "engagedRate", "signups", "conversionRate"],
    ...sourceRows().map((r) => [r.key, r.sessions, r.share.toFixed(4), r.engaged, r.engagedRate.toFixed(4), r.signups, r.convRate.toFixed(4)]),
  ]));
});

function renderAudience() {
  const t = state.cur.total;
  const countries = S.topEntries(t.countries, 200).filter((r) => r.key !== "__other");
  const top = countries[0];
  const knownCountries = countries.filter((r) => r.key !== "XX").length;
  $("#auKpis").innerHTML = [
    kpi("Ülke", nf.format(knownCountries), { sub: "ziyaretçi gelen" }),
    kpi("En büyük pazar", top ? countryLabel(top.key) : "—", { sub: top ? `${pct.format(top.share)} ziyaretçi` : "", accent: "var(--violet)" }),
    kpi("Telefon", pct.format(S.rate(t.devices.mobile, t.visitors)), { sub: `bilgisayar ${pct.format(S.rate(t.devices.desktop, t.visitors))}`, accent: "var(--blue)" }),
    kpi("iOS / Android", `${pct.format(S.rate(t.os.ios, t.visitors))} / ${pct.format(S.rate(t.os.android, t.visitors))}`, { sub: "tekil ziyaretçinin işletim sistemi", accent: "var(--green)" }),
    kpi("Uygulama içi tarayıcı", pct.format(S.rate(t.browsers.inapp, t.visitors)), { sub: "Instagram, TikTok, Facebook…", accent: "var(--pink)" }),
  ].join("");

  const conv = t.convCountries;
  const maxV = countries.length ? countries[0].value : 1;
  const convKeys = Object.keys(conv).filter((k) => !t.countries[k]);
  const rows = [...countries.map((r) => ({ key: r.key, value: r.value, share: r.share })), ...convKeys.map((k) => ({ key: k, value: 0, share: 0 }))].slice(0, 40);
  $("#countryTable tbody").innerHTML = rows.length ? rows.map((r) => {
    const sign = Number(conv[r.key]) || 0;
    return `<tr><td>${esc(countryLabel(r.key))}</td><td class="num">${nf.format(r.value)}</td>
      <td><span class="mini-bar"><i style="width:${(r.value / maxV * 100).toFixed(1)}%"></i></span>${pctSmart(r.share)}</td>
      <td class="num">${sign ? nf.format(sign) : "—"}</td><td class="num">${sign && r.value ? `<span class="rate ${rateClass(sign / r.value, 0.05, 0.01)}">${pctSmart(sign / r.value)}</span>` : "—"}</td></tr>`;
  }).join("") : `<tr><td colspan="5" class="empty">Henüz veri yok</td></tr>`;

  renderBars("#auDevices", t.devices, (k) => DEVICE[k] || k);
  renderBars("#auOs", t.os, (k) => OS[k] || k);
  renderBars("#auBrowsers", t.browsers, (k) => BROWSER[k] || k, { empty: "14 Kas 2026'dan beri ölçülüyor" });
  renderBars("#auLangs", t.langs, langLabel);
  renderBars("#auSiteLangs", t.siteLangs, langLabel, { empty: "14 Kas 2026'dan beri ölçülüyor" });
  renderBars("#auScreens", t.screens, (k) => SCREEN[k] || k, { empty: "14 Kas 2026'dan beri ölçülüyor" });
}

function renderBehavior() {
  const t = state.cur.total;
  const p = state.prev.total;
  const homeViews = Number(t.pages.index) || 0;
  const deep = Number(t.scroll["75"]) || 0;
  const avg = S.rate(t.engagedSec, t.sessions);
  $("#bhKpis").innerHTML = [
    kpi("Ort. kalma süresi", S.formatDuration(avg), { delta: deltaBadge(Math.round(avg), Math.round(S.rate(p.engagedSec, p.sessions))), sub: "oturum başına" }),
    kpi("İlgili oturum", nf.format(t.engagedSessions), { delta: deltaBadge(t.engagedSessions, p.engagedSessions), sub: `${pct.format(S.rate(t.engagedSessions, t.sessions))} oturum 15 sn+`, accent: "var(--violet)" }),
    kpi("Sayfa / ziyaretçi", nf1.format(S.rate(t.views, t.visitors)), { sub: `${nf.format(t.views)} görüntüleme`, accent: "var(--blue)" }),
    kpi("Sayfanın %75'ini gören", pct.format(S.rate(deep, t.views)), { sub: `${nf.format(deep)} görüntüleme`, accent: "var(--amber)" }),
    kpi("SSS açılışı", nf.format(Number(t.actions.faq_open) || 0), { sub: "soru tıklaması", accent: "var(--green)" }),
  ].join("");

  // Isı haritası
  const heat = S.weekHourMatrix(state.cur.byDay, state.curDays);
  let html = `<span></span>` + Array.from({ length: 24 }, (_, h) => `<span class="hh">${h % 3 ? "" : String(h).padStart(2, "0")}</span>`).join("");
  heat.grid.forEach((row, r) => {
    html += `<span class="hl">${WEEKDAYS[r]}</span>` + row.map((v, h) => {
      const a = heat.max ? v / heat.max : 0;
      const label = `${WEEKDAYS_LONG[r]} ${String(h).padStart(2, "0")}:00 — ${nf.format(v)} görüntüleme`;
      return `<span class="cell" title="${label}" aria-label="${label}"${v ? ` style="background:rgba(20,200,232,${(0.12 + a * 0.88).toFixed(3)})"` : ""}></span>`;
    }).join("");
  });
  $("#bhHeat").innerHTML = html;

  steps("#bhScroll", [25, 50, 75, 100].map((d) => ({ label: d === 100 ? "Sonuna kadar" : `%${d}`, value: Number(t.scroll[String(d)]) || 0 })), t.views, { empty: "14 Kas 2026'dan beri ölçülüyor" });
  steps("#bhSections", SECTIONS.map(([k, label]) => ({ label, value: Number(t.actions[k]) || 0 })), homeViews, { empty: "14 Kas 2026'dan beri ölçülüyor" });

  const acts = Object.keys(ACTIONS).map((k) => ({ k, v: Number(t.actions[k]) || 0 })).filter((r) => r.v).sort((a, b) => b.v - a.v);
  const maxA = acts.length ? acts[0].v : 1;
  $("#actionTable tbody").innerHTML = acts.length ? acts.map((r) => {
    const [label, kind] = ACTIONS[r.k];
    return `<tr><td>${esc(label)}</td><td><span class="chip ${kind}">${ACTION_KIND[kind]}</span></td><td class="num">${nf.format(r.v)}</td>
      <td><span class="mini-bar"><i style="width:${(r.v / maxA * 100).toFixed(1)}%"></i></span>${pctSmart(S.rate(r.v, t.views))}</td></tr>`;
  }).join("") : `<tr><td colspan="4" class="empty">14 Kas 2026'dan beri ölçülüyor; bu aralıkta etkileşim yok</td></tr>`;

  const hours = hourValues(t.hours);
  const maxH = Math.max(1, ...hours);
  $("#bhHours").innerHTML = hours.map((v, h) => {
    const label = `${String(h).padStart(2, "0")}:00 — ${nf.format(v)} görüntüleme`;
    return `<div class="hour" title="${label}" aria-label="${label}"><i style="height:${v ? Math.max(3, (v / maxH) * 100) : 0}%"></i><span>${h % 3 ? "" : String(h).padStart(2, "0")}</span></div>`;
  }).join("");
}

function renderSignups() {
  const t = state.cur.total;
  const ready = listsReady();
  const a = t.actions;
  if (!ready) { $("#sgKpis").innerHTML = kpi("Kayıtlar", "…", { sub: "listeler yükleniyor" }); }
  else {
    const betaCur = inDays(state.beta, state.curDays);
    const betaPrev = inDays(state.beta, state.prevDays);
    const waitCur = inDays(waitOnly(state.wait), state.curDays);
    const waitPrev = inDays(waitOnly(state.wait), state.prevDays);
    const people = peopleIn(state.curDays);
    const prevPeople = peopleIn(state.prevDays);
    const tries = (Number(a.waitlist_try) || 0) + (Number(a.beta_try) || 0);
    const android = betaCur.filter((r) => r.platform === "android").length;
    $("#sgKpis").innerHTML = [
      kpi("Yeni kişi", nf.format(people), { delta: deltaBadge(people, prevPeople), sub: "farklı e-posta", accent: "var(--pink)" }),
      kpi("Beta kaydı", nf.format(betaCur.length), { delta: deltaBadge(betaCur.length, betaPrev.length), sub: `Android ${nf.format(android)} · iOS ${nf.format(betaCur.length - android)}` }),
      kpi("Yalnız bekleme", nf.format(waitCur.length), { delta: deltaBadge(waitCur.length, waitPrev.length), sub: "beta'ya başvurmadan", accent: "var(--violet)" }),
      kpi("Ziyaretçiden kayda", pctSmart(S.rate(people, t.visitors)), { sub: `${nf.format(t.visitors)} ziyaretçi`, accent: "var(--green)" }),
      kpi("Form başarı oranı", tries ? pct.format(S.rate(t.signups, tries)) : "—", { sub: tries ? `${nf.format(tries)} gönderimden ${nf.format(t.signups)} kayıt` : "henüz form gönderimi yok", accent: "var(--amber)" }),
    ].join("");

    const ax = axis();
    const series = [
      { name: "Beta · Android", color: "#3ddc97", type: "bar", values: recordSeries(state.beta.filter((r) => r.platform === "android"), state.curDays, ax.hourly) },
      { name: "Beta · iOS", color: "#3d9bff", type: "bar", values: recordSeries(state.beta.filter((r) => r.platform === "ios"), state.curDays, ax.hourly) },
      { name: "Yalnız bekleme", color: "#a597ff", type: "bar", values: recordSeries(waitOnly(state.wait), state.curDays, ax.hourly) },
    ];
    legend("#sgLegend", series);
    chart("#sgChart", { ...ax, series, aria: "Günlük kayıt" });
    donut("#sgPlatforms", S.countBy(betaCur, "platform"), (k) => ({ android: "Android", ios: "iOS" })[k] || k, { center: "beta" });
    renderBars("#sgLangs", S.countBy(betaCur, "lang"), langLabel, { empty: "Bu aralıkta beta kaydı yok" });
  }
  const since = "14 Kas 2026'dan beri ölçülüyor";
  renderBars("#sgRefs", t.convRefs, refLabel, { empty: since });
  renderBars("#sgCountries", t.convCountries, countryLabel, { empty: since });
  renderBars("#sgDevices", t.convDevices, (k) => DEVICE[k] || k, { empty: since });

  const n = (k) => Number(a[k]) || 0;
  const stack = (title, parts) => {
    const sum = parts.reduce((s, p) => s + p[1], 0);
    return `<div><h3>${title}</h3>${sum ? `<div class="stack">${parts.map(([, v, c]) => v ? `<i style="width:${(v / sum * 100).toFixed(2)}%;background:${c}"></i>` : "").join("")}</div>
      <div class="stack-legend">${parts.map(([l, v, c]) => `<span><i style="background:${c}"></i>${l} <b>${nf.format(v)}</b></span>`).join("")}</div>` : `<p class="empty">${since}</p>`}</div>`;
  };
  $("#sgForms").innerHTML = `<div class="form-res">${stack(`Bekleme formu · ${nf.format(n("waitlist_try"))} gönderim`, [["Kayıt", n("waitlist_ok"), "#3ddc97"], ["Zaten listede", n("waitlist_dup"), "#ffb547"], ["Hata", n("waitlist_err"), "#ff6b7a"]])}
    ${stack(`Beta formu · ${nf.format(n("beta_try"))} gönderim`, [["Android", n("beta_ok_android"), "#3ddc97"], ["iOS", n("beta_ok_ios"), "#3d9bff"], ["Zaten kayıtlı", n("beta_dup"), "#ffb547"], ["Hata", n("beta_err"), "#ff6b7a"]])}</div>`;
}

/* ── Beta özellik oyları ─────────────────────────────────────────── */
function renderBetaVotes() {
  const rows = BETA_FEATURES.map(([id, label]) => {
    const item = state.betaVotes[id] || {};
    const likes = Math.max(0, Number(item.likes) || 0);
    const dislikes = Math.max(0, Number(item.dislikes) || 0);
    return { label, likes, dislikes, total: likes + dislikes };
  }).sort((a, b) => b.total - a.total || b.likes - a.likes);
  const totals = rows.reduce((s, r) => ({ likes: s.likes + r.likes, dislikes: s.dislikes + r.dislikes, total: s.total + r.total }), { likes: 0, dislikes: 0, total: 0 });
  const liked = rows.filter((r) => r.total >= 3).sort((a, b) => b.likes / b.total - a.likes / a.total)[0];
  $("#voteKpis").innerHTML = [
    kpi("Toplam oy", nf.format(totals.total), { sub: `${BETA_FEATURES.length} özellik` }),
    kpi("Beğeni", nf.format(totals.likes), { sub: totals.total ? pct.format(totals.likes / totals.total) : "", accent: "var(--green)" }),
    kpi("Beğenmeme", nf.format(totals.dislikes), { accent: "var(--danger)" }),
    kpi("En sevilen", liked ? liked.label : "—", { sub: liked ? `${pct.format(liked.likes / liked.total)} beğeni · ${nf.format(liked.total)} oy` : "en az 3 oy gerekir", accent: "var(--violet)" }),
  ].join("");
  $("#votesList").innerHTML = rows.map((r) => `<div class="vote">
      <span>${esc(r.label)}</span>
      <span class="split" title="${nf.format(r.likes)} beğeni · ${nf.format(r.dislikes)} beğenmeme">${r.total ? `<i style="width:${(r.likes / r.total * 100).toFixed(1)}%"></i><i style="width:${(r.dislikes / r.total * 100).toFixed(1)}%"></i>` : ""}</span>
      <span class="vn">👍 <b>${nf.format(r.likes)}</b> · 👎 <b>${nf.format(r.dislikes)}</b>${r.total ? ` · ${pct.format(r.likes / r.total)}` : ""}</span>
    </div>`).join("");
}

/* ── Beta testçileri ─────────────────────────────────────────────── */
function betaRows(platform = state.betaPlatform) {
  return S.selectRows(state.beta, { search: $("#betaSearch").value, platform, period: $("#betaPeriod").value, sort: $("#betaSort").value });
}
/** Kopyalama platforma göre ayrı: Android → Play Console, iOS → TestFlight. Arama/tarih süzgeci geçerli. */
function betaPlatformEmails(platform) {
  return [...new Set(betaRows(platform).map((r) => r.email))];
}

function renderBeta() {
  const a = state.beta.filter((r) => r.platform === "android").length;
  const emails = new Set(state.beta.map((r) => r.email));
  const today = S.istanbulDay(new Date());
  const week = S.dayRange(7)[0];
  const recent = state.beta.filter((r) => r.at && S.istanbulDay(r.at) >= week).length;
  const langs = S.topEntries(S.countBy(state.beta, "lang"), 1)[0];
  $("#betaBadge").textContent = nf.format(state.beta.length);
  $("#betaKpis").innerHTML = [
    kpi("Kayıt", nf.format(state.beta.length), { sub: `${nf.format(emails.size)} farklı kişi` }),
    kpi("Android", nf.format(a), { sub: state.beta.length ? pct.format(a / state.beta.length) : "", accent: "var(--green)" }),
    kpi("iOS", nf.format(state.beta.length - a), { sub: state.beta.length ? pct.format((state.beta.length - a) / state.beta.length) : "", accent: "var(--blue)" }),
    kpi("Son 7 gün", nf.format(recent), { sub: `bugün ${nf.format(state.beta.filter((r) => r.at && S.istanbulDay(r.at) === today).length)}`, accent: "var(--pink)" }),
    kpi("En yaygın dil", langs ? langLabel(langs.key) : "—", { sub: langs ? pct.format(langs.share) : "", accent: "var(--violet)" }),
  ].join("");
  const rows = betaRows();
  const page = paginate("beta", rows);
  const nA = betaPlatformEmails("android").length, nI = betaPlatformEmails("ios").length;
  $("#betaCopyAndroid").disabled = !nA;
  $("#betaCopyAndroid").textContent = `Android e-postalarını kopyala (${nf.format(nA)})`;
  $("#betaCopyIos").disabled = !nI;
  $("#betaCopyIos").textContent = `iOS e-postalarını kopyala (${nf.format(nI)})`;
  $("#betaCsv").disabled = !rows.length;
  $("#betaCount").textContent = `${nf.format(rows.length)} sonuç · ${nf.format(state.beta.length)} toplam kayıt`;
  $("#betaTable tbody").innerHTML = page.length
    ? page.map((r) => `<tr><td>${esc(r.email)}</td><td><span class="chip ${esc(r.platform)}">${r.platform === "ios" ? "iOS" : r.platform === "android" ? "Android" : esc(r.platform)}</span></td><td>${r.lang ? esc(langLabel(r.lang)) : "—"}</td><td>${r.at ? dateFmt.format(r.at) : "—"}</td></tr>`).join("")
    : `<tr><td colspan="4" class="empty">Kayıt yok</td></tr>`;
}

$("#betaFilter").addEventListener("click", (ev) => {
  const btn = ev.target.closest("button[data-p]");
  if (!btn) return;
  setSeg($("#betaFilter"), btn);
  state.betaPlatform = btn.dataset.p;
  state.page.beta = 1;
  renderBeta();
});
for (const id of ["betaSearch", "betaPeriod", "betaSort"]) $("#" + id).addEventListener(id === "betaSearch" ? "input" : "change", () => { state.page.beta = 1; renderBeta(); });
for (const [id, platform, label] of [["betaCopyAndroid", "android", "Android"], ["betaCopyIos", "ios", "iOS"]]) {
  $("#" + id).addEventListener("click", () => {
    const list = betaPlatformEmails(platform);
    copy(list.join(", "), `${nf.format(list.length)} ${label} e-postası kopyalandı`);
  });
}
$("#betaCsv").addEventListener("click", () => download(
  `seelogd-beta-${S.istanbulDay(new Date())}.csv`,
  S.toCsv([["email", "platform", "lang", "createdAt"], ...betaRows().map((r) => [r.email, r.platform, r.lang, r.at ? r.at.toISOString() : ""])]),
));

/* ── Bekleme listesi ─────────────────────────────────────────────── */
function waitRows() {
  return S.selectRows(state.wait, { search: $("#waitSearch").value, period: $("#waitPeriod").value, sort: $("#waitSort").value });
}

function renderWait() {
  $("#waitBadge").textContent = nf.format(state.wait.length);
  const week = S.dayRange(7)[0];
  const today = S.istanbulDay(new Date());
  const recent = state.wait.filter((r) => r.at && S.istanbulDay(r.at) >= week).length;
  const queues = state.wait.map((r) => Number(r.queueNo)).filter((n) => Number.isFinite(n) && n > 0);
  const beta = betaEmails();
  const fromBeta = state.loaded.beta ? state.wait.filter((r) => beta.has(r.email)).length : null;
  $("#waitKpis").innerHTML = [
    kpi("Toplam kayıt", nf.format(state.wait.length), { sub: "tüm zamanlar" }),
    kpi("Son 7 gün", nf.format(recent), { sub: "yeni kayıt", accent: "var(--pink)" }),
    kpi("Bugün", nf.format(state.wait.filter((r) => r.at && S.istanbulDay(r.at) === today).length), { sub: "İstanbul takvimi", accent: "var(--amber)" }),
    kpi("Beta başvurusu da yapan", fromBeta === null ? "…" : nf.format(fromBeta), { sub: fromBeta ? pct.format(fromBeta / state.wait.length) : "", accent: "var(--green)" }),
    kpi("Son sıra no", queues.length ? nf.format(queues.reduce((x, y) => Math.max(x, y), 0)) : "—", { sub: "kayıt sıra numarası", accent: "var(--violet)" }),
  ].join("");
  const rows = waitRows();
  const page = paginate("wait", rows);
  $("#waitCopy").disabled = !rows.length;
  $("#waitCsv").disabled = !rows.length;
  $("#waitCount").textContent = `${nf.format(rows.length)} sonuç · ${nf.format(state.wait.length)} toplam kayıt`;
  $("#waitTable tbody").innerHTML = page.length
    ? page.map((r) => `<tr><td>${esc(r.email)}</td><td>${esc(r.queueNo)}</td><td>${beta.has(r.email) ? '<span class="chip ios">Beta</span>' : "—"}</td><td>${r.at ? dateFmt.format(r.at) : "—"}</td></tr>`).join("")
    : `<tr><td colspan="4" class="empty">Kayıt yok</td></tr>`;
}

for (const id of ["waitSearch", "waitPeriod", "waitSort"]) $("#" + id).addEventListener(id === "waitSearch" ? "input" : "change", () => { state.page.wait = 1; renderWait(); });

function paginate(kind, rows) {
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page[kind] = Math.min(state.page[kind], pages);
  const current = state.page[kind];
  $("#" + kind + "Page").textContent = `${nf.format(current)} / ${nf.format(pages)}`;
  $("#" + kind + "Prev").disabled = current <= 1;
  $("#" + kind + "Next").disabled = current >= pages;
  return rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
}
for (const kind of ["beta", "wait"]) {
  for (const [id, step] of [["Prev", -1], ["Next", 1]]) {
    $("#" + kind + id).addEventListener("click", () => {
      state.page[kind] += step;
      (kind === "beta" ? renderBeta : renderWait)();
      $("#" + kind + "Table").scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }
}
$("#waitCopy").addEventListener("click", () => {
  const list = [...new Set(waitRows().map((r) => r.email))];
  copy(list.join(", "), `${nf.format(list.length)} e-posta kopyalandı`);
});
$("#waitCsv").addEventListener("click", () => download(
  `seelogd-bekleme-${S.istanbulDay(new Date())}.csv`,
  S.toCsv([["email", "queueNo", "alsoBeta", "createdAt"], ...waitRows().map((r) => [r.email, r.queueNo, betaEmails().has(r.email) ? "yes" : "", r.at ? r.at.toISOString() : ""])]),
));

/* ── Yardımcılar ─────────────────────────────────────────────────── */
async function copy(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast("Kopyalanamadı — tarayıcı panoya izin vermedi.");
  }
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
