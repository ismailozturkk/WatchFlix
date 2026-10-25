// functions/scripts/auditFriendships.js
//
// SALT OKUMA denetim: canlıda tek taraflı (sahte olabilecek) arkadaş kaydı var mı?
//
// Arka plan (T2.2, 25 Eki 2026): 25 Ekim'deki kural düzeltmesine kadar herkes
// Users/{kurban}/friends/{kendisi} belgesini oluşturup kurbanın "yalnız arkadaşlar"
// listelerini okuyabiliyordu. Meşru arkadaşlık İKİ TARAFLIDIR (kabul batch'i iki
// kaydı birlikte yazar); karşılığı olmayan kayıt şüphelidir. Karşılıksız kaydın
// masum sebepleri de var: arkadaşlıktan çıkma ya da hesap silme yarıda kaldıysa.
// Bu yüzden betik HİÇBİR ŞEY SİLMEZ; yalnız listeler, karar insanda.
//
// Çalıştırma (PowerShell, functions/ içinde):
//   1) Firebase Console → Project Settings → Service accounts → Generate new private key
//      → JSON'u functions/scripts/sa.json olarak kaydet (.gitignore'da).
//   2) $env:GOOGLE_APPLICATION_CREDENTIALS = "scripts/sa.json"
//   3) node scripts/auditFriendships.js
//   4) Bittiğinde sa.json'u SİL ve konsoldan anahtarı iptal et.
//
// Maliyet: tüm friends belgeleri + karşılıksız kayıtların sahip profilleri okunur
// (10 bin arkadaşlık ≈ 20 bin okuma ≈ birkaç kuruş).

/**
 * Saf sınıflandırma (test edilir). `entries`: { owner, friend, data } listesi —
 * Users/{owner}/friends/{friend} belgeleri.
 * @returns {{ total: number, mutual: number, oneSided: Array<{owner, friend, hasFriendsSince, fields}> }}
 */
function classifyFriendEntries(entries) {
  const keys = new Set(entries.map((e) => `${e.owner}>${e.friend}`));
  const oneSided = [];
  let mutual = 0;
  for (const e of entries) {
    if (keys.has(`${e.friend}>${e.owner}`)) {
      mutual += 1;
      continue;
    }
    const data = e.data || {};
    oneSided.push({
      owner: e.owner,
      friend: e.friend,
      // Meşru kabul akışı friendsSince (sunucu zamanı) ve friendName yazar; sahte
      // kayıt çoğunlukla eksik ya da farklı alanlarla gelir.
      hasFriendsSince: data.friendsSince != null,
      fields: Object.keys(data).sort(),
    });
  }
  return { total: entries.length, mutual, oneSided };
}

async function main() {
  const admin = require("firebase-admin");
  admin.initializeApp(); // GOOGLE_APPLICATION_CREDENTIALS
  const db = admin.firestore();

  const snap = await db.collectionGroup("friends").get();
  const entries = [];
  for (const d of snap.docs) {
    const parts = d.ref.path.split("/"); // Users/{owner}/friends/{friend}
    if (parts.length !== 4 || parts[0] !== "Users") continue;
    entries.push({ owner: parts[1], friend: parts[3], data: d.data() });
  }
  const { total, mutual, oneSided } = classifyFriendEntries(entries);

  // Etki: sahibin listeleri "yalnız arkadaşlar" ise karşılıksız kayıt veri açmış olabilir.
  const owners = [...new Set(oneSided.map((r) => r.owner))];
  const privacy = new Map();
  for (let i = 0; i < owners.length; i += 300) {
    const refs = owners.slice(i, i + 300).map((uid) => db.doc(`Users/${uid}`));
    const snaps = await db.getAll(...refs, { fieldMask: ["privacy"] });
    snaps.forEach((s) => privacy.set(s.id, s.exists ? s.get("privacy.lists") || "public" : "(profil yok)"));
  }

  console.log(`friends belgesi: ${total} | karşılıklı: ${mutual} | karşılıksız: ${oneSided.length}`);
  for (const r of oneSided) {
    console.log(
      [
        `Users/${r.owner}/friends/${r.friend}`,
        `sahibin liste gizliliği=${privacy.get(r.owner)}`,
        `friendsSince=${r.hasFriendsSince ? "var" : "YOK"}`,
        `alanlar=${r.fields.join(",") || "-"}`,
      ].join(" | "),
    );
  }
  console.log("Hiçbir şey silinmedi. Şüpheli kayıtlar elle incelenip gerekirse silinmeli.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { classifyFriendEntries };
