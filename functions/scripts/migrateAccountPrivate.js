// functions/scripts/migrateAccountPrivate.js
//
// TOPLU göç: kök Users/{uid} belgesinde kalmış özel alanları (e-posta, doğum
// tarihi, eski push jetonları) yalnız sahibinin okuyabildiği alt belgelere taşır
// ve kökten siler. İstemci de sahibi uygulamayı açınca aynı işi yapıyor
// (context/UserProfileContext.js → migrateRootAccountFields); bu betik hiç
// açmamış hesapları kapatır. Plan ve sıra: docs/mimari/KULLANICI_OZEL_ALAN_GOCU.md.
//
// VARSAYILAN KURU ÇALIŞMA: --apply verilmedikçe hiçbir şey yazılmaz. Çıktıya
// DEĞER yazılmaz (e-posta/tarih/jeton), yalnız uid ve alan adları.
//
// ⚠ ESKİ İSTEMCİ ETKİSİ: kökten silinen birthDate'i eski sürümler (bu göçten
// önceki) okuyamaz → o sürümde 18 altı hesabın yetişkin içerik kısıtı düşer.
// --apply'ı ancak sahadaki sürümler yeni yola geçtikten (ya da bu etkiyi kabul
// ederek) çalıştır. Betik idempotent: Aşama 3 kuralı yayına girene kadar eski
// istemciler kökü yeniden doldurabilir, gerekirse tekrar çalıştır.
//
// Çalıştırma (Windows PowerShell):
//   1) Firebase Console → Project Settings → Service accounts → Generate new
//      private key → JSON'u functions/scripts/ altına kaydet (ör. sa.json).
//   2) cd functions
//   3) $env:GOOGLE_APPLICATION_CREDENTIALS = "scripts/sa.json"
//   4) node scripts/migrateAccountPrivate.js            # kuru çalışma (rapor)
//      node scripts/migrateAccountPrivate.js --apply    # gerçek yazım
//   5) Bittiğinde sa.json'u SİL (gizli anahtar). .gitignore'da olduğundan emin ol.

const admin = require("firebase-admin");
const { planUserMigration, ALL_ROOT_FIELDS } = require("./accountMigrationPlan");

const APPLY = process.argv.includes("--apply");
const PAGE = 300;
const BATCH_LIMIT = 450; // 500 sınırının altında; bir kullanıcı en fazla 3 işlem

admin.initializeApp(); // GOOGLE_APPLICATION_CREDENTIALS env'inden okur
const db = admin.firestore();
const { FieldValue, FieldPath } = admin.firestore;

async function main() {
  console.log(APPLY ? "MOD: --apply (YAZILACAK)" : "MOD: kuru çalışma (hiçbir şey yazılmaz)");

  const stats = {
    scanned: 0,
    withLegacy: 0,
    accountWrites: 0,
    pushWrites: 0,
    rootCleaned: 0,
    conflicts: 0,
    fieldCounts: {},
  };

  let batch = db.batch();
  let ops = 0;
  const flush = async () => {
    if (ops === 0) return;
    if (APPLY) await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  let last = null;
  for (;;) {
    let q = db
      .collection("Users")
      .orderBy(FieldPath.documentId())
      .select(...ALL_ROOT_FIELDS)
      .limit(PAGE);
    if (last) q = q.startAfter(last);
    const page = await q.get();
    if (page.empty) break;
    last = page.docs[page.docs.length - 1];
    stats.scanned += page.size;

    const legacy = page.docs.filter((d) => {
      const data = d.data();
      return ALL_ROOT_FIELDS.some((k) => Object.prototype.hasOwnProperty.call(data, k));
    });
    if (legacy.length === 0) continue;

    // Gizli belgeleri tek turda oku (kullanıcı başına 2 ayrı get yerine).
    const refs = legacy.flatMap((d) => [
      db.doc(`Users/${d.id}/private/account`),
      db.doc(`Users/${d.id}/private/push`),
    ]);
    const priv = await db.getAll(...refs);

    for (let i = 0; i < legacy.length; i++) {
      const d = legacy[i];
      const accountSnap = priv[i * 2];
      const pushSnap = priv[i * 2 + 1];
      const plan = planUserMigration({
        root: d.data(),
        account: accountSnap.exists ? accountSnap.data() : null,
        push: pushSnap.exists ? pushSnap.data() : null,
      });

      stats.withLegacy++;
      for (const k of plan.rootDelete) stats.fieldCounts[k] = (stats.fieldCounts[k] || 0) + 1;
      if (plan.conflicts.length > 0) {
        stats.conflicts++;
        console.warn(`UYARI ${d.id}: ${plan.conflicts.join("; ")}`);
      }

      // Bir kullanıcının işlemleri AYNI batch'te kalsın (kopya + silme atomik):
      // sığmayacaksa önce mevcut batch'i boşalt.
      if (ops + 3 > BATCH_LIMIT) await flush();

      if (plan.accountPatch) {
        batch.set(
          accountSnap.ref,
          { ...plan.accountPatch, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        );
        ops++;
        stats.accountWrites++;
      }
      if (plan.pushPatch) {
        const patch = { updatedAt: FieldValue.serverTimestamp() };
        if (plan.pushPatch.tokens.length > 0) {
          patch.expoPushTokens = FieldValue.arrayUnion(...plan.pushPatch.tokens);
        }
        if (plan.pushPatch.token) patch.expoPushToken = plan.pushPatch.token;
        batch.set(pushSnap.ref, patch, { merge: true });
        ops++;
        stats.pushWrites++;
      }
      if (plan.rootDelete.length > 0) {
        const removal = {};
        for (const k of plan.rootDelete) removal[k] = FieldValue.delete();
        batch.update(d.ref, removal);
        ops++;
        stats.rootCleaned++;
      }
    }
    console.log(`... ${stats.scanned} kullanıcı tarandı, ${stats.withLegacy} kökte eski alan taşıyor`);
  }
  await flush();

  console.log(APPLY ? "Bitti (yazıldı)." : "Bitti (kuru çalışma — hiçbir şey yazılmadı).");
  console.log(JSON.stringify(stats, null, 2));
  if (stats.conflicts > 0) {
    console.log("Çelişkili hesaplar kökten SİLİNMEDİ; yukarıdaki UYARI satırlarına elle bak.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Hata:", e);
    process.exit(1);
  });
