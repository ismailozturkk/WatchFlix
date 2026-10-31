// Seelogd — Firestore tek-belge sayaç çekişmesi koşumu
// DURUM: HENÜZ ÇALIŞTIRILMADI. Yalnız emülatör ya da staging. Prod YASAK.
//
// Amaç: DailyPolls / Top100Hype gibi TEK belgeye akan sayaçların eşzamanlı
// yazmada nasıl davrandığını ölçmek (transaction abort/retry oranı, gecikme).
// Bu, §3.1 "sıcak nokta" bulgusunun deneysel karşılığıdır.
//
// Çalıştırma (emülatör):
//   FIRESTORE_EMULATOR_HOST=localhost:8085 STAGING_PROJECT=demo-seelogd \
//   CONCURRENCY=1000 node load-test/firestore-hotspot-harness.mjs
//
// Gereksinim: functions/node_modules içindeki firebase-admin (ya da kökte kurulu).

import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const PROJECT = process.env.STAGING_PROJECT || "";
const CONCURRENCY = Number(process.env.CONCURRENCY || 200);

// ── Guard: prod'a karşı çalışmayı reddet ─────────────────────────────────
if (PROJECT === "movieandtv-2832a") {
  throw new Error("PROD HEDEFI YASAK: STAGING_PROJECT prod projeyi gösteriyor.");
}
if (!process.env.FIRESTORE_EMULATOR_HOST && !PROJECT) {
  throw new Error("Emülatör (FIRESTORE_EMULATOR_HOST) ya da STAGING_PROJECT gerekli.");
}

initializeApp({ projectId: PROJECT || "demo-seelogd" });
const db = getFirestore();

const dayKey = new Date().toISOString().slice(0, 10);
const counterRef = db.doc(`DailyPolls/${dayKey}`);

// N eşzamanlı sanal kullanıcı aynı sayaç belgesine (a/b) oy yazmaya çalışır.
// Gerçek kurallar yerine ham transaction ile saf çekişmeyi ölçeriz
// (kural koşumu için emülatöre kurallar yüklenip kurallı yol da denenebilir).
async function voteOnce(i) {
  const started = Date.now();
  let retries = 0;
  await db.runTransaction(async (tx) => {
    retries += 1;
    const snap = await tx.get(counterRef);
    const cur = snap.exists ? snap.data() : { a: 0, b: 0 };
    const choice = i % 2 === 0 ? "a" : "b";
    tx.set(counterRef, { ...cur, [choice]: (cur[choice] || 0) + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { ms: Date.now() - started, retries };
}

(async () => {
  console.log(`[harness] ${CONCURRENCY} eşzamanlı yazma → ${counterRef.path}`);
  const t0 = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: CONCURRENCY }, (_, i) => voteOnce(i)),
  );
  const ok = results.filter((r) => r.status === "fulfilled");
  const fail = results.length - ok.length;
  const lats = ok.map((r) => r.value.ms).sort((a, b) => a - b);
  const retries = ok.reduce((s, r) => s + r.value.retries, 0);
  const p = (q) => lats.length ? lats[Math.floor((lats.length - 1) * q)] : 0;
  console.log(`[harness] toplam süre=${Date.now() - t0}ms başarılı=${ok.length} başarısız=${fail}`);
  console.log(`[harness] gecikme p50=${p(0.5)}ms p95=${p(0.95)}ms p99=${p(0.99)}ms`);
  console.log(`[harness] toplam transaction denemesi=${retries} (çekişme = denemeler/başarılı = ${(retries / Math.max(ok.length, 1)).toFixed(2)})`);
  process.exit(0);
})();
