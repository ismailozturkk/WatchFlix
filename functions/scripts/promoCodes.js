// functions/scripts/promoCodes.js
//
// Promosyon kodu yönetimi (1 ay ücretsiz Premium). Kodları yalnız yönetici üretir;
// uygulamada kullanıcı kodu Premium sayfasındaki "Kodun var mı?" alanına girer
// (functions/index.js → redeemCode).
//
// Sınırlar (iki ayrı tavan):
//   • --uses N     her kodun kaç KİŞİ tarafından kullanılabileceği (varsayılan 1)
//   • --count M    kaç kod üretileceği
//   Toplam açılacak ücretsiz ay en fazla  M x N.  Ayrıca:
//   • --days D     her kullanımın verdiği gün (varsayılan 30)
//   • --expires YYYY-MM-DD   kodun son kullanma günü (UTC gün sonu), isteğe bağlı
//   • --note "..." kodun nereye/kime verildiği (yalnız yönetici görür)
//
// Komutlar (VARSAYILAN KURU ÇALIŞMADIR; yazmak için --apply ekle):
//   node scripts/promoCodes.js create --count 5 --uses 1 --days 30 --note "Basın" [--apply]
//   node scripts/promoCodes.js list
//   node scripts/promoCodes.js disable ABCDEFGH [--apply]
//
// Kimlik (Windows PowerShell):
//   1) Firebase Console → Project Settings → Service accounts → Generate new private key
//      → JSON'u functions/scripts/ altına kaydet (ör. sa.json; .gitignore'da olmalı).
//   2) cd functions
//   3) $env:GOOGLE_APPLICATION_CREDENTIALS = "scripts/sa.json"
//   4) node scripts/promoCodes.js ...
//   5) Bitince sa.json'u SİL.

const { randomInt } = require("node:crypto");
const { generateReferralCode, formatCodeForDisplay, normalizeCode, PROMO_DEFAULT_DAYS } = require("../referral");

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  const positional = [];
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = rest[i + 1];
      if (next === undefined || next.startsWith("--")) flags[key] = true;
      else {
        flags[key] = next;
        i += 1;
      }
    } else positional.push(token);
  }
  return { command, flags, positional };
}

function positiveInt(value, fallback, name) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--${name} pozitif tam sayı olmalı`);
  return n;
}

function parseExpires(value) {
  if (value === undefined) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    throw new Error("--expires YYYY-MM-DD olmalı");
  }
  const ms = Date.parse(`${value}T23:59:59Z`);
  if (!Number.isFinite(ms)) throw new Error("--expires geçersiz tarih");
  return ms;
}

async function main() {
  const { command, flags, positional } = parseArgs(process.argv.slice(2));
  if (!["create", "list", "disable"].includes(command)) {
    console.log("Kullanım: create | list | disable  (yukarıdaki başlık yorumuna bak)");
    process.exit(1);
  }

  const admin = require("firebase-admin");
  admin.initializeApp();
  const db = admin.firestore();
  const { FieldValue, Timestamp } = require("firebase-admin/firestore");
  const apply = flags.apply === true;

  if (command === "list") {
    const snap = await db.collection("PromoCodes").get();
    if (snap.empty) console.log("Hiç promosyon kodu yok.");
    snap.docs.forEach((doc) => {
      const d = doc.data();
      const exp = d.expiresAt?.toDate?.().toISOString().slice(0, 10) || "-";
      console.log(
        `${formatCodeForDisplay(doc.id)}  kullanım ${d.redeemedCount || 0}/${d.maxRedemptions}  ` +
          `${d.days} gün  son: ${exp}  ${d.active === false ? "[PASİF]" : "aktif"}  ${d.note || ""}`,
      );
    });
    return;
  }

  if (command === "disable") {
    const code = normalizeCode(positional[0]);
    if (!code) throw new Error("Geçerli bir kod ver");
    const ref = db.doc(`PromoCodes/${code}`);
    if (!(await ref.get()).exists) throw new Error(`${code} bulunamadı`);
    if (apply) await ref.update({ active: false });
    console.log(`${apply ? "Pasifleştirildi" : "[KURU ÇALIŞMA] Pasifleştirilecek"}: ${code}`);
    return;
  }

  const count = positiveInt(flags.count, 1, "count");
  const uses = positiveInt(flags.uses, 1, "uses");
  const days = positiveInt(flags.days, PROMO_DEFAULT_DAYS, "days");
  const expiresMs = parseExpires(flags.expires);
  const note = typeof flags.note === "string" ? flags.note.slice(0, 120) : "";
  if (count > 500) throw new Error("Tek seferde en fazla 500 kod");

  const codes = [];
  while (codes.length < count) {
    const code = generateReferralCode(randomInt);
    if (codes.includes(code)) continue;
    // Davet kodlarıyla çakışmasın: redeemCode önce PromoCodes'a bakar.
    const [promo, ref] = await Promise.all([
      db.doc(`PromoCodes/${code}`).get(),
      db.doc(`ReferralCodes/${code}`).get(),
    ]);
    if (!promo.exists && !ref.exists) codes.push(code);
  }

  console.log(
    `${count} kod x ${uses} kullanım = en fazla ${count * uses} kişi, her biri ${days} gün` +
      (expiresMs ? `, son gün ${flags.expires}` : ", süresiz") +
      (note ? `, not: ${note}` : ""),
  );
  if (!apply) {
    console.log("[KURU ÇALIŞMA] Yazılmadı. Yazmak için --apply ekle. Örnek kodlar:");
    codes.slice(0, 3).forEach((c) => console.log("  " + formatCodeForDisplay(c)));
    return;
  }

  const batch = db.batch();
  codes.forEach((code) => {
    batch.create(db.doc(`PromoCodes/${code}`), {
      days,
      plan: "premium",
      maxRedemptions: uses,
      redeemedCount: 0,
      active: true,
      note,
      expiresAt: expiresMs ? Timestamp.fromMillis(expiresMs) : null,
      createdAt: FieldValue.serverTimestamp(),
    });
  });
  await batch.commit();
  console.log("Oluşturuldu:");
  codes.forEach((c) => console.log("  " + formatCodeForDisplay(c)));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
