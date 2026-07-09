// functions/scripts/purgeStaleTokens.js
//
// TEK SEFERLİK temizlik: eski (Expo Go) push token'larını ayıkla.
//
// Problem: expoPushTokens[] dizisine arrayUnion ile token EKLENİYOR ama hiç
// silinmiyordu. Kullanıcılar Expo Go'da çalışırken üretilen token'lar diziye
// takılı kalmış → backend o token'lara da gönderince bildirim Expo Go'ya düşüyor.
//
// Çözüm: her kullanıcının dizisini, EN SON kayıtlı tek token'a (expoPushToken)
// indir. Standalone'a geçmiş kullanıcıda bu zaten doğru standalone token →
// push kesintisi olmaz; birikmiş eski token'lar temizlenir.
//
// Çalıştırma (Windows PowerShell):
//   1) Firebase Console → Project Settings → Service accounts → Generate new
//      private key → JSON'u functions/scripts/ altına kaydet (ör. sa.json).
//   2) cd functions
//   3) $env:GOOGLE_APPLICATION_CREDENTIALS = "scripts/sa.json"
//   4) node scripts/purgeStaleTokens.js
//   5) Bittiğinde sa.json'u SİL (gizli anahtar). .gitignore'da olduğundan emin ol.

const admin = require("firebase-admin");

admin.initializeApp(); // GOOGLE_APPLICATION_CREDENTIALS env'inden okur
const db = admin.firestore();

async function main() {
  const snap = await db.collection("Users").get();
  let scanned = 0;
  let updated = 0;

  let batch = db.batch();
  let inBatch = 0;

  for (const doc of snap.docs) {
    scanned++;
    const d = doc.data() || {};
    const current = d.expoPushToken || null;
    const arr = Array.isArray(d.expoPushTokens) ? d.expoPushTokens : [];

    // İndirgenmiş dizi: yalnız en son kayıtlı (current) token.
    const next = current ? [current] : [];

    // Değişiklik gerekiyor mu? (uzunluk veya içerik farklıysa)
    const sameLen = arr.length === next.length;
    const sameContent = sameLen && arr.every((t) => next.includes(t));
    if (sameContent) continue;

    batch.update(doc.ref, { expoPushTokens: next });
    inBatch++;
    updated++;

    if (inBatch >= 450) {
      await batch.commit();
      batch = db.batch();
      inBatch = 0;
      console.log(`... ${updated} kullanıcı güncellendi`);
    }
  }

  if (inBatch > 0) await batch.commit();
  console.log(`Bitti. Tarandı: ${scanned}, güncellendi: ${updated}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Hata:", e);
    process.exit(1);
  });
