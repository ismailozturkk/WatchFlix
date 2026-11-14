/* admin.js — site yönetim paneli (admin.html).
 *
 * Akış: Firebase Auth (Google ya da e-posta/şifre) → siteAdmins/{uid} var mı → panel.
 * Yetki YALNIZ firestore.rules'ta (isSiteAdmin); bu dosya hiçbir şey yazmaz, yalnız okur:
 *   siteStats  günlük toplam parçaları (functions/siteStats.js)  → Ziyaretler sekmesi
 *   betaTesters / waitlist                                    → listeler, kopyala, CSV
 * Saf hesaplar admin-stats.js'te (window.AdminStats).
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
const pct = new Intl.NumberFormat("tr-TR", { style: "percent", maximumFractionDigits: 0 });
const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Istanbul" });
const dayFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", timeZone: "UTC" });
const regionName = new Intl.DisplayNames(["tr"], { type: "region" });
const langName = new Intl.DisplayNames(["tr"], { type: "language" });

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const state = { days: 30, beta: [], wait: [], betaVotes: {}, betaPlatform: "", overviewStats: null, page: { beta: 1, wait: 1 }, loaded: { beta: false, wait: false, votes: false } };
const BETA_FEATURES = [
  ["league", "Haftalık Lig"], ["challenges", "Meydan okumalar"], ["tierlist", "Tier list"],
  ["top100", "Seelogd Top 100"], ["chain", "Film Zinciri"], ["rating", "Puan yukarı-aşağı"],
  ["daily_frame", "Günün Karesi"], ["film_club", "Film Kulübü"], ["atmosphere", "Atmosfer"],
  ["profile_banner", "Profil kapağı"], ["app_icon", "Uygulama simgesi"], ["streak_flame", "Haftalık seri alevi"],
  ["match", "Uyum Çemberleri"],
];
const PAGE_SIZE = 25;

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
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    $("#loginErr").textContent = authError(err);
  }
});
$("#pwForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  $("#loginErr").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, $("#pwEmail").value.trim(), $("#pwPass").value);
  } catch (err) {
    $("#loginErr").textContent = authError(err);
  }
});
$("#signOut").addEventListener("click", () => signOut(auth));
$("#copyUid").addEventListener("click", () => copy($("#uid").textContent, "UID kopyalandı"));

onAuthStateChanged(auth, async (user) => {
  $("#who").hidden = !user;
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
  refreshAll();
});

/* ── Sekmeler ────────────────────────────────────────────────────── */
function openTab(name) {
  const tab = $(`.tab[data-tab="${name}"]`);
  if (!tab) return;
  $$(".tab").forEach((t) => t.setAttribute("aria-selected", t === tab ? "true" : "false"));
  $$(".tab").forEach((t) => { t.tabIndex = t === tab ? 0 : -1; });
  $$(".pane").forEach((p) => { p.hidden = p.id !== "pane-" + tab.dataset.tab; });
  if (name === "stats") renderTrend(lastStats); // gizliyken genişlik 0 ölçülür
}
$$(".tab").forEach((tab) => tab.addEventListener("click", () => openTab(tab.dataset.tab)));
$$(".tab").forEach((tab) => tab.addEventListener("keydown", (ev) => {
  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(ev.key)) return;
  ev.preventDefault();
  const tabs = $$(".tab");
  const index = tabs.indexOf(tab);
  const target = ev.key === "Home" ? 0 : ev.key === "End" ? tabs.length - 1 : (index + (ev.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
  openTab(tabs[target].dataset.tab);
  tabs[target].focus();
}));
$$('[data-go]').forEach((button) => button.addEventListener("click", () => {
  openTab(button.dataset.go);
  $("#stPanel .tabs").scrollIntoView({ behavior: "smooth", block: "start" });
}));

function setSeg(group, btn) {
  group.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === btn));
}

/* ── Ziyaretler ──────────────────────────────────────────────────── */
let lastStats = null;
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
  await Promise.allSettled([loadStats(), loadOverviewTraffic(), loadBeta(), loadWait(), loadBetaVotes()]);
  $("#updatedAt").textContent = "Son kontrol: " + dateFmt.format(new Date()) + " · İstanbul";
  button.disabled = false;
}

async function loadOverviewTraffic() {
  const days = S.dayRange(7);
  try {
    const snap = await getDocs(query(collection(db, "siteStats"), where("day", ">=", days[0]), where("day", "<=", days[days.length - 1])));
    state.overviewStats = { days, ...S.mergeStats(snap.docs.map((d) => d.data()), days) };
    renderOverview();
  } catch (err) {
    console.error(err);
    $("#overviewTraffic").innerHTML = '<p class="empty">Ziyaret verileri alınamadı. Yeniden deneyin.</p>';
  }
}

function renderOverview() {
  const stats = state.overviewStats;
  const week = S.dayRange(7)[0];
  const recent = (rows) => rows.filter((r) => r.at && S.istanbulDay(r.at) >= week).length;
  const t = stats?.total;
  $("#overviewKpis").innerHTML = [
    kpi("Son 7 gün · ziyaretçi", t ? nf.format(t.visitors) : "…", "Günlük tekillerin toplamı"),
    kpi("Son 7 gün · görüntüleme", t ? nf.format(t.views) : "…", "Tüm sayfalar"),
    kpi("Beta başvurusu", state.loaded.beta ? nf.format(state.beta.length) : "…", state.loaded.beta ? `Son 7 gün +${nf.format(recent(state.beta))}` : "Yükleniyor"),
    kpi("Bekleme listesi", state.loaded.wait ? nf.format(state.wait.length) : "…", state.loaded.wait ? `Son 7 gün +${nf.format(recent(state.wait))}` : "Yükleniyor"),
  ].join("");
  if (stats) {
    const rows = stats.days.map((day) => ({ day, views: stats.byDay[day].views, visitors: stats.byDay[day].visitors }));
    const max = Math.max(1, ...rows.map((r) => r.views));
    const best = rows.reduce((a, b) => b.views > a.views ? b : a, rows[0]);
    $("#overviewTraffic").innerHTML = `<div class="mini-bars" aria-label="Son 7 günlük görüntüleme dağılımı">${rows.map((r) => `<div title="${esc(r.day)}: ${nf.format(r.views)} görüntüleme"><i style="height:${r.views ? Math.max(4, r.views / max * 100) : 0}%"></i><span>${dayFmt.format(new Date(r.day + "T00:00:00Z"))}</span></div>`).join("")}</div><p class="insight-foot">${t.views ? `En yoğun gün <b>${dayFmt.format(new Date(best.day + "T00:00:00Z"))}</b> · ${nf.format(best.views)} görüntüleme` : "Bu aralıkta henüz ziyaret verisi yok."}</p>`;
  }
  $("#overviewJoin").innerHTML = `<div class="join-metrics"><div><span>Beta · son 7 gün</span><b>${state.loaded.beta ? "+" + nf.format(recent(state.beta)) : "…"}</b></div><div><span>Bekleme · son 7 gün</span><b>${state.loaded.wait ? "+" + nf.format(recent(state.wait)) : "…"}</b></div></div><p class="insight-foot">Beta başvuruları bekleme listesinde de yer alabilir. İki toplam farklı kişiler olarak toplanmaz.</p>`;
}
renderOverview();

async function loadStats() {
  const days = S.dayRange(state.days);
  const request = ++statsRequest;
  $("#kpis").classList.add("busy");
  try {
    const snap = await getDocs(query(collection(db, "siteStats"), where("day", ">=", days[0]), where("day", "<=", days[days.length - 1])));
    if (request !== statsRequest) return;
    lastStats = { days, ...S.mergeStats(snap.docs.map((d) => d.data()), days) };
    renderStats(lastStats);
  } catch (err) {
    console.error(err);
    toast("İstatistik okunamadı: " + (err.code || err.message));
  } finally {
    if (request === statsRequest) $("#kpis").classList.remove("busy");
  }
}

function kpi(label, value, sub) {
  return `<div class="kpi"><span>${esc(label)}</span><b>${esc(value)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</div>`;
}

function renderStats(stats) {
  const t = stats.total;
  const avg = t.sessions ? t.engagedSec / t.sessions : 0;
  const perVisitor = t.visitors ? t.views / t.visitors : 0;
  $("#kpis").innerHTML = [
    kpi("Ziyaretçi", nf.format(t.visitors), "günlük tekil, toplanmış"),
    kpi("Yeni ziyaretçi", nf.format(t.newcomers), t.visitors ? pct.format(t.newcomers / t.visitors) + " ilk kez geldi" : ""),
    kpi("Oturum", nf.format(t.sessions), ""),
    kpi("Görüntüleme", nf.format(t.views), perVisitor ? perVisitor.toFixed(1).replace(".", ",") + " sayfa / ziyaretçi" : ""),
    kpi("Ort. kalma süresi", S.formatDuration(avg), "oturum başına, sekme öndeyken"),
    kpi("Beta testçi", state.loaded.beta ? nf.format(state.beta.length) : "…", betaSplit()),
  ].join("");

  renderBars("#countries", t.countries, (k) => k === "XX" ? `${S.flagOf(k)} Bilinmiyor` : `${S.flagOf(k)} ${safe(() => regionName.of(k), k)}`);
  renderBars("#refs", t.refs, refLabel);
  renderBars("#devices", t.devices, (k) => ({ mobile: "Telefon", tablet: "Tablet", desktop: "Bilgisayar" })[k] || k);
  renderBars("#os", t.os, (k) => ({ ios: "iOS / iPadOS", android: "Android", windows: "Windows", macos: "macOS", linux: "Linux", other: "Diğer" })[k] || k);
  renderBars("#langs", t.langs, (k) => k === "xx" ? "Bilinmiyor" : safe(() => langName.of(k), k));
  renderBars("#pages", t.pages, (k) => ({ index: "Ana sayfa", privacy: "Gizlilik", terms: "Kullanım şartları", delete: "Hesap silme", other: "Diğer" })[k] || k);
  renderHours(t.hours);
  renderTrend(stats);
}

const safe = (fn, fallback) => { try { return fn() || fallback; } catch { return fallback; } };

const REF_NAMES = {
  direct: "Doğrudan / bilinmiyor", google: "Google", bing: "Bing", duckduckgo: "DuckDuckGo", yandex: "Yandex",
  instagram: "Instagram", facebook: "Facebook", x: "X (Twitter)", youtube: "YouTube", tiktok: "TikTok", reddit: "Reddit",
  linkedin: "LinkedIn", whatsapp: "WhatsApp", telegram: "Telegram", threads: "Threads", bluesky: "Bluesky",
  "play-store": "Google Play", "app-store": "App Store",
};
const refLabel = (k) => REF_NAMES[k] || k.replace(/_/g, ".");

function renderBars(sel, map, label) {
  const list = $(sel);
  const rows = S.topEntries(map, 8);
  if (!rows.length) { list.innerHTML = `<li class="empty">Henüz veri yok</li>`; return; }
  list.innerHTML = rows.map((r) => {
    const name = r.key === "__other" ? "Diğerleri" : label(r.key);
    return `<li title="${esc(name)}: ${nf.format(r.value)} (${pct.format(r.share)})">
      <span class="bar-label">${esc(name)}</span>
      <span class="bar-track"><i style="width:${(r.share * 100).toFixed(1)}%"></i></span>
      <span class="bar-value">${nf.format(r.value)} <small>${pct.format(r.share)}</small></span>
    </li>`;
  }).join("");
}

function renderHours(hours) {
  const values = Array.from({ length: 24 }, (_, h) => Number(hours[String(h).padStart(2, "0")]) || 0);
  const max = Math.max(1, ...values);
  $("#hours").innerHTML = values.map((v, h) => {
    const label = `${String(h).padStart(2, "0")}:00 — ${nf.format(v)} görüntüleme`;
    return `<div class="hour" title="${label}" aria-label="${label}"><i style="height:${v ? Math.max(4, (v / max) * 100) : 0}%"></i><span>${h % 3 ? "" : String(h).padStart(2, "0")}</span></div>`;
  }).join("");
}

/* Günlük çizgi grafik: ziyaretçi + görüntüleme, tek eksen (ikisi de sayım). Üzerine gelince dikey çizgi + kutu. */
const SERIES = [
  { key: "visitors", name: "Ziyaretçi", color: "var(--teal)" },
  { key: "views", name: "Görüntüleme", color: "var(--violet)" },
];
$("#trendLegend").innerHTML = SERIES.map((s) => `<li><i style="background:${s.color}"></i>${s.name}</li>`).join("");

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const step = [1, 2, 2.5, 5, 10].find((m) => m * pow >= v / 4) * pow;
  return Math.ceil(v / step) * step;
}

function renderTrend(stats) {
  const host = $("#trend");
  if (!stats || !host.clientWidth) return;
  const days = stats.days;
  const W = host.clientWidth;
  const H = 240;
  const pad = { l: 44, r: 12, t: 12, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const rows = days.map((d) => stats.byDay[d] || S.emptyTotals());
  const max = niceMax(Math.max(...rows.map((r) => Math.max(r.views, r.visitors))));
  const x = (i) => pad.l + (days.length === 1 ? iw / 2 : (i / (days.length - 1)) * iw);
  const y = (v) => pad.t + ih - (v / max) * ih;

  let svg = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Günlük ziyaretçi ve görüntüleme">`;
  for (let i = 0; i <= 4; i += 1) {
    const v = (max / 4) * i;
    svg += `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${nf.format(v)}</text>`;
  }
  const every = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(iw / 70))));
  const last = days.length - 1;
  days.forEach((d, i) => {
    // Son gün her zaman yazılır; bir önceki etiket çok yakınsa o atlanır.
    if (i === last ? false : i % every || last - i < every) return;
    svg += `<text class="axis" x="${x(i)}" y="${H - 8}" text-anchor="middle">${dayFmt.format(new Date(d + "T00:00:00Z"))}</text>`;
  });
  SERIES.forEach((s) => {
    const pts = rows.map((r, i) => `${x(i).toFixed(1)},${y(r[s.key]).toFixed(1)}`).join(" ");
    svg += days.length === 1
      ? `<circle cx="${x(0)}" cy="${y(rows[0][s.key])}" r="4" fill="${s.color}"/>`
      : `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  });
  svg += `<g class="hover" hidden><line class="cross" y1="${pad.t}" y2="${pad.t + ih}"/>${SERIES.map((s) => `<circle r="4.5" fill="${s.color}" class="dot" data-k="${s.key}"/>`).join("")}</g>`;
  svg += `<rect class="hit" x="${pad.l}" y="${pad.t}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="tip" hidden></div>`;
  host.innerHTML = svg;

  const g = host.querySelector(".hover");
  const tip = host.querySelector(".tip");
  const hit = host.querySelector(".hit");
  const move = (ev) => {
    const box = hit.getBoundingClientRect();
    const rel = (ev.clientX - box.left) / box.width;
    const i = Math.max(0, Math.min(days.length - 1, Math.round(rel * (days.length - 1))));
    const r = rows[i];
    g.hidden = false;
    g.querySelector(".cross").setAttribute("x1", x(i));
    g.querySelector(".cross").setAttribute("x2", x(i));
    g.querySelectorAll(".dot").forEach((c) => { c.setAttribute("cx", x(i)); c.setAttribute("cy", y(r[c.dataset.k])); });
    tip.hidden = false;
    tip.innerHTML = `<b>${dayFmt.format(new Date(days[i] + "T00:00:00Z"))}</b>` +
      SERIES.map((s) => `<span><i style="background:${s.color}"></i>${s.name}<em>${nf.format(r[s.key])}</em></span>`).join("") +
      `<span class="sub">Ort. süre<em>${S.formatDuration(r.sessions ? r.engagedSec / r.sessions : 0)}</em></span>`;
    // Kutu çizginin sağında; sığmıyorsa solunda.
    const w = tip.offsetWidth;
    tip.style.left = Math.max(4, x(i) + 12 + w > W ? x(i) - w - 12 : x(i) + 12) + "px";
  };
  hit.addEventListener("pointermove", move);
  hit.addEventListener("pointerdown", move);
  hit.addEventListener("pointerleave", () => { g.hidden = true; tip.hidden = true; });
}

let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderTrend(lastStats), 120);
});

/* ── Beta özellik oyları (yalnız siteAdmins) ─────────────────────── */
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

function renderBetaVotes() {
  const rows = BETA_FEATURES.map(([id, label]) => {
    const item = state.betaVotes[id] || {};
    const likes = Math.max(0, Number(item.likes) || 0);
    const dislikes = Math.max(0, Number(item.dislikes) || 0);
    return { label, likes, dislikes, total: likes + dislikes };
  });
  const totals = rows.reduce((sum, row) => ({ likes: sum.likes + row.likes, dislikes: sum.dislikes + row.dislikes, total: sum.total + row.total }), { likes: 0, dislikes: 0, total: 0 });
  $("#voteKpis").innerHTML = [
    kpi("Toplam oy", nf.format(totals.total), "Tüm beta özellikleri"),
    kpi("Beğeni", nf.format(totals.likes), ""),
    kpi("Beğenmeme", nf.format(totals.dislikes), ""),
  ].join("");
  $("#votesTable tbody").innerHTML = rows.map((row) => `<tr><td>${esc(row.label)}</td><td>${nf.format(row.likes)}</td><td>${nf.format(row.dislikes)}</td><td>${nf.format(row.total)}</td><td>${row.total ? pct.format(row.likes / row.total) : "—"}</td></tr>`).join("");
}

/* ── Beta testçileri ─────────────────────────────────────────────── */
function betaSplit() {
  if (!state.loaded.beta) return "";
  const a = state.beta.filter((r) => r.platform === "android").length;
  return `Android ${nf.format(a)} · iOS ${nf.format(state.beta.length - a)}`;
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
    renderOverview();
    if (lastStats) renderStats(lastStats);
  } catch (err) {
    console.error(err);
    toast("Beta listesi okunamadı: " + (err.code || err.message));
  }
}

function betaRows() {
  return S.selectRows(state.beta, { search: $("#betaSearch").value, platform: state.betaPlatform, period: $("#betaPeriod").value, sort: $("#betaSort").value });
}

function renderBeta() {
  const a = state.beta.filter((r) => r.platform === "android").length;
  const emails = new Set(state.beta.map((r) => r.email));
  const today = S.istanbulDay(new Date());
  const week = S.dayRange(7)[0];
  const recent = state.beta.filter((r) => r.at && S.istanbulDay(r.at) >= week).length;
  $("#betaBadge").textContent = nf.format(state.beta.length);
  $("#betaKpis").innerHTML = [
    kpi("Kayıt", nf.format(state.beta.length), `${nf.format(emails.size)} farklı kişi`),
    kpi("Android", nf.format(a), ""),
    kpi("iOS", nf.format(state.beta.length - a), ""),
    kpi("Son 7 gün", nf.format(recent), `bugün ${nf.format(state.beta.filter((r) => r.at && S.istanbulDay(r.at) === today).length)}`),
  ].join("");
  const rows = betaRows();
  const page = paginate("beta", rows);
  $("#betaCopy").disabled = !rows.length;
  $("#betaCsv").disabled = !rows.length;
  $("#betaCount").textContent = `${nf.format(rows.length)} sonuç · ${nf.format(state.beta.length)} toplam kayıt`;
  $("#betaTable tbody").innerHTML = page.length
    ? page.map((r) => `<tr><td>${esc(r.email)}</td><td><span class="chip ${esc(r.platform)}">${r.platform === "ios" ? "iOS" : r.platform === "android" ? "Android" : esc(r.platform)}</span></td><td>${esc(r.lang.toUpperCase())}</td><td>${r.at ? dateFmt.format(r.at) : "—"}</td></tr>`).join("")
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
$("#betaCopy").addEventListener("click", () => {
  const list = [...new Set(betaRows().map((r) => r.email))];
  copy(list.join(", "), `${nf.format(list.length)} e-posta kopyalandı`);
});
$("#betaCsv").addEventListener("click", () => download(
  `seelogd-beta-${S.istanbulDay(new Date())}.csv`,
  S.toCsv([["email", "platform", "lang", "createdAt"], ...betaRows().map((r) => [r.email, r.platform, r.lang, r.at ? r.at.toISOString() : ""])]),
));

/* ── Bekleme listesi ─────────────────────────────────────────────── */
async function loadWait() {
  try {
    const snap = await getDocs(collection(db, "waitlist"));
    state.wait = snap.docs.map((d) => {
      const v = d.data();
      return { email: v.email || "", queueNo: v.queueNo ?? "", at: S.toDate(v.createdAt) };
    }).sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0));
    state.loaded.wait = true;
    renderWait();
  } catch (err) {
    console.error(err);
    toast("Bekleme listesi okunamadı: " + (err.code || err.message));
  }
}

function waitRows() {
  return S.selectRows(state.wait, { search: $("#waitSearch").value, period: $("#waitPeriod").value, sort: $("#waitSort").value });
}

function renderWait() {
  $("#waitBadge").textContent = nf.format(state.wait.length);
  const week = S.dayRange(7)[0];
  const today = S.istanbulDay(new Date());
  const recent = state.wait.filter((r) => r.at && S.istanbulDay(r.at) >= week).length;
  const queues = state.wait.map((r) => Number(r.queueNo)).filter((n) => Number.isFinite(n) && n > 0);
  $("#waitKpis").innerHTML = [kpi("Toplam kayıt", nf.format(state.wait.length), "Tüm zamanlar"), kpi("Son 7 gün", nf.format(recent), "Yeni kayıt"), kpi("Bugün", nf.format(state.wait.filter((r) => r.at && S.istanbulDay(r.at) === today).length), "İstanbul takvimi"), kpi("Son sıra no", queues.length ? nf.format(queues.reduce((a, b) => Math.max(a, b), 0)) : "—", "Kayıt sıra numarası")].join("");
  const rows = waitRows();
  const page = paginate("wait", rows);
  $("#waitCopy").disabled = !rows.length;
  $("#waitCsv").disabled = !rows.length;
  $("#waitCount").textContent = `${nf.format(rows.length)} sonuç · ${nf.format(state.wait.length)} toplam kayıt`;
  $("#waitTable tbody").innerHTML = page.length
    ? page.map((r) => `<tr><td>${esc(r.email)}</td><td>${esc(r.queueNo)}</td><td>${r.at ? dateFmt.format(r.at) : "—"}</td></tr>`).join("")
    : `<tr><td colspan="3" class="empty">Kayıt yok</td></tr>`;
  renderOverview();
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
  S.toCsv([["email", "queueNo", "createdAt"], ...waitRows().map((r) => [r.email, r.queueNo, r.at ? r.at.toISOString() : ""])]),
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
