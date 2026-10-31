#!/usr/bin/env node
// scripts/appcheck-status.cjs
//
// App Check durum raporu — SALT-OKUNUR (yalnız GET; hiçbir ayarı değiştirmez, jeton yazdırmaz).
// Zorunluluğu (ENFORCE) açma kararı bununla verilir: docs/guvenlik/DENETIM_2026-10-31_GUVENLIK_PERFORMANS.md M-3.
//
// Kullanım:  npm run appcheck:status            (son 7 gün)
//            npm run appcheck:status -- --days 28
//
// Gereksinim: global firebase-tools + `firebase login` (makinedeki CLI oturumu kullanılır). Okunanlar:
//   • App Check: servis başına zorunluluk modu, sağlayıcı yapılandırmaları, debug jetonu SAYISI
//   • Cloud Monitoring: firebaseappcheck.googleapis.com/services/verification_count (security etiketine göre)
//
// Karar eşiği: bir serviste geçerli (VALID) pay ≥ %95 ve en az 500 doğrulama → o servis zorunluluğa hazır.
// Geliştirme build'leri App Check'i varsayılan olarak ATLAR (services/appCheck.js), yani jetonsuz sayılır:
// eşiğe bakarken trafiğin ne kadarının geliştirme build'i olduğunu hesaba kat.

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const PROJECT = "movieandtv-2832a";
const READY_SHARE = 0.95;
const READY_MIN = 500;
const ROOT = path.join(__dirname, "..");

function firebaseToolsLib() {
  const globalRoot = execSync("npm root -g", { encoding: "utf8" }).trim();
  const lib = path.join(globalRoot, "firebase-tools", "lib");
  if (!fs.existsSync(path.join(lib, "requireAuth.js"))) {
    throw new Error("Global firebase-tools bulunamadı (npm i -g firebase-tools && firebase login).");
  }
  return lib;
}

function appIds() {
  const android = require(path.join(ROOT, "google-services.json")).client?.[0]?.client_info?.mobilesdk_app_id;
  const plist = fs.readFileSync(path.join(ROOT, "GoogleService-Info.plist"), "utf8");
  const ios = /<key>GOOGLE_APP_ID<\/key>\s*<string>([^<]+)<\/string>/.exec(plist)?.[1];
  return { android, ios };
}

async function makeGet() {
  const lib = firebaseToolsLib();
  const { requireAuth } = require(path.join(lib, "requireAuth"));
  const { getAccessToken } = require(path.join(lib, "apiv2"));
  const { configstore } = require(path.join(lib, "configstore"));
  // CLI komut sarmalayıcısının yaptığı gibi kayıtlı oturumu ver ({} verilirse varsayılan bulut kimliğine düşer).
  await requireAuth({ user: configstore.get("user"), tokens: configstore.get("tokens") });
  return async (url) => {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${await getAccessToken()}`, "x-goog-user-project": PROJECT },
    });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {}
    return { status: res.status, body };
  };
}

function monitoringUrl(days) {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const q = new URLSearchParams({
    filter: 'metric.type="firebaseappcheck.googleapis.com/services/verification_count"',
    "interval.startTime": start.toISOString(),
    "interval.endTime": end.toISOString(),
    "aggregation.alignmentPeriod": `${days * 86400}s`,
    "aggregation.perSeriesAligner": "ALIGN_SUM",
    "aggregation.crossSeriesReducer": "REDUCE_SUM",
  });
  ["resource.label.service_id", "metric.label.security"].forEach((g) => q.append("aggregation.groupByFields", g));
  return `https://monitoring.googleapis.com/v3/projects/${PROJECT}/timeSeries?${q}`;
}

const sumPoints = (series) =>
  (series.points || []).reduce((acc, p) => acc + Number(p.value?.int64Value || p.value?.doubleValue || 0), 0);
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");

async function main() {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg > 0 ? Math.max(1, Math.min(42, Number(process.argv[daysArg + 1]) || 7)) : 7;
  const get = await makeGet();
  const { android, ios } = appIds();
  const appCheck = `https://firebaseappcheck.googleapis.com/v1/projects/${PROJECT}`;

  console.log(`\nApp Check durumu — ${PROJECT} (salt-okunur)\n`);

  const services = await get(`${appCheck}/services`);
  const modes = {};
  (services.body?.services || []).forEach((s) => {
    modes[s.name.split("/").pop()] = s.enforcementMode;
  });
  console.log("Zorunluluk modları:");
  Object.entries(modes).forEach(([id, mode]) => console.log(`  ${id.padEnd(34)} ${mode}`));
  console.log("  cloud functions (callable)         kodda: functions/index.js enforceAppCheck");

  const [pi, aa, dc, dtA, dtI] = await Promise.all([
    get(`${appCheck}/apps/${android}/playIntegrityConfig`),
    get(`${appCheck}/apps/${ios}/appAttestConfig`),
    get(`${appCheck}/apps/${ios}/deviceCheckConfig`),
    get(`${appCheck}/apps/${android}/debugTokens`),
    get(`${appCheck}/apps/${ios}/debugTokens`),
  ]);
  console.log("\nSağlayıcılar:");
  console.log(`  Android Play Integrity   ${pi.status === 200 ? "yapılandırılmış" : `HTTP ${pi.status}`}` +
    ` · cihaz bütünlüğü: ${pi.body?.deviceIntegrity?.minDeviceRecognitionLevel || "varsayılan"}` +
    ` · debug jetonu: ${(dtA.body?.debugTokens || []).length}`);
  console.log(`  iOS App Attest           ${aa.status === 200 ? "yapılandırılmış" : `HTTP ${aa.status}`}` +
    " · yetki: app.json ios.entitlements com.apple.developer.devicecheck.appattest-environment");
  console.log(`  iOS DeviceCheck (yedek)  özel anahtar: ${dc.body?.privateKeySet ? "KAYITLI" : "KAYITLI DEĞİL"}` +
    ` · debug jetonu: ${(dtI.body?.debugTokens || []).length}`);

  const metrics = await get(monitoringUrl(days));
  if (metrics.status !== 200) {
    console.log(`\nMetrik okunamadı: HTTP ${metrics.status}`);
    return;
  }
  const byService = {};
  (metrics.body?.timeSeries || []).forEach((series) => {
    const service = series.resource?.labels?.service_id || "?";
    const security = series.metric?.labels?.security || "?";
    byService[service] = byService[service] || {};
    byService[service][security] = (byService[service][security] || 0) + sumPoints(series);
  });

  console.log(`\nDoğrulamalar — son ${days} gün:`);
  const services2 = Object.keys(byService).sort();
  if (!services2.length) console.log("  (kayıt yok)");
  services2.forEach((service) => {
    const counts = byService[service];
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const valid = Object.entries(counts)
      .filter(([security]) => security.startsWith("VALID"))
      .reduce((acc, [, n]) => acc + n, 0);
    const ready = total >= READY_MIN && valid / total >= READY_SHARE;
    console.log(`  ${service}  toplam ${total} · geçerli ${valid} (${pct(valid, total)}) · ` +
      `${ready ? "ZORUNLULUĞA HAZIR" : "HAZIR DEĞİL — zorunlu kılma"}`);
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([security, n]) => console.log(`      ${security.padEnd(26)} ${String(n).padStart(8)}  ${pct(n, total)}`));
  });
  console.log(`\nEşik: geçerli ≥ ${READY_SHARE * 100}% ve ≥ ${READY_MIN} doğrulama. Jetonsuz (MISSING_*) trafiğin bir kısmı` +
    " geliştirme build'leridir (App Check orada varsayılan kapalı).\n");
}

main().catch((error) => {
  console.error("appcheck-status:", String(error?.message || error).slice(0, 300));
  process.exitCode = 1;
});
