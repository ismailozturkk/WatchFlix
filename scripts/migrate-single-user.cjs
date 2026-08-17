#!/usr/bin/env node

/**
 * migrate-single-user.cjs
 *
 * Eski yapida kayitli bir kullanicinin Users/{uid} dokumani yeni semaya
 * tasir. Eksik alanlar varsayilan degerlerle doldurulur; VAR OLAN alanlar
 * ASLA EZILMEZ (merge mantigi).
 *
 * KULLANIM:
 *   node scripts/migrate-single-user.cjs --uid <FIREBASE_UID>          # kuru calisma
 *   node scripts/migrate-single-user.cjs --uid <FIREBASE_UID> --apply  # gercekten yaz
 *
 * ONKOSUL: firebase login  (Firebase CLI oturumu acik olmali)
 */

const readline = require("readline");
const path = require("path");
const { execFileSync } = require("child_process");

// --- Argumanlar ---------------------------------------------------------------
const argv = process.argv.slice(2);
const args = new Set(argv);
const apply = args.has("--apply");
const uidIndex = argv.indexOf("--uid");
const TARGET_UID = uidIndex >= 0 ? argv[uidIndex + 1] : null;

if (!TARGET_UID || TARGET_UID.startsWith("--")) {
  console.error("KULLANIM: node scripts/migrate-single-user.cjs --uid <UID> [--apply]");
  process.exit(1);
}

// --- Sabitler -----------------------------------------------------------------
const PROJECT_ID = "movieandtv-2832a";
const DATABASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)`;
const DOCUMENTS_URL = `${DATABASE_URL}/documents`;
const SCHEMA_VERSION = 2;

const DEFAULT_PRIVACY = {
  profile: "public",
  lists: "public",
  posts: "public",
  onlineStatus: "everyone",
};

const DEFAULT_LIST_VISIBLE = {
  watchedMovies: false,
  watchedTv: false,
  watchList: false,
  favorites: false,
};

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

// --- Firebase REST yardimcilari -----------------------------------------------

function loadAccessToken() {
  const npmRoot = execFileSync("npm", ["root", "-g"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  }).trim();
  const auth = require(path.join(npmRoot, "firebase-tools", "lib", "auth.js"));
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error("Firebase CLI oturumu bulunamadi. Once `firebase login` calistirin.");
  }
  return auth.getAccessToken(account.tokens.refresh_token, []).then((r) => {
    if (!r?.access_token) throw new Error("Erisim anahtari alinamadi.");
    return r.access_token;
  });
}

async function firestoreGet(token, docPath) {
  const url = `${DOCUMENTS_URL}/${docPath}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${docPath}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

async function firestorePatch(token, docPath, fields, updateMask) {
  const mask = updateMask
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  const url = `${DOCUMENTS_URL}/${docPath}?${mask}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`PATCH ${docPath}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

// --- Firestore deger donusumleri ---------------------------------------------

function toFsValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value))
    return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, toFsValue(v)])
        ),
      },
    };
  }
  throw new Error(`Bilinmeyen deger tipi: ${typeof value}`);
}

function fromFsDoc(doc) {
  if (!doc?.fields) return {};
  function fromValue(v) {
    if ("nullValue" in v) return null;
    if ("booleanValue" in v) return v.booleanValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("stringValue" in v) return v.stringValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("mapValue" in v) {
      return Object.fromEntries(
        Object.entries(v.mapValue.fields || {}).map(([k, val]) => [k, fromValue(val)])
      );
    }
    return null;
  }
  return Object.fromEntries(
    Object.entries(doc.fields).map(([k, v]) => [k, fromValue(v)])
  );
}

// --- Interaktif soru ---------------------------------------------------------

function askQuestion(prompt) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

// --- Ana mantik --------------------------------------------------------------

async function main() {
  console.log("\n  Firebase oturumu aliniyor...");
  const token = await loadAccessToken();
  console.log("  Oturum acik.\n");

  // 1. Mevcut kullanici dokumanini oku
  console.log(`  Users/${TARGET_UID} okunuyor...`);
  const userDoc = await firestoreGet(token, `Users/${TARGET_UID}`);

  if (!userDoc) {
    console.error(`\n  HATA: Users/${TARGET_UID} bulunamadi. UID dogru mu?`);
    process.exit(1);
  }

  const current = fromFsDoc(userDoc);

  console.log("\n--- Mevcut kullanici verisi ------------------------------------");
  console.log(`  uid          : ${current.uid || TARGET_UID}`);
  console.log(`  email        : ${current.email || "(yok)"}`);
  console.log(`  displayName  : ${current.displayName || "(yok)"}`);
  console.log(`  username     : ${current.username || "(YOK - EKSIK)"}`);
  console.log(`  avatarIndex  : ${current.avatarIndex ?? "(yok)"}`);
  console.log(`  _schemaVersion: ${current._schemaVersion ?? "(yok)"}`);
  console.log("----------------------------------------------------------------\n");

  // 2. Kullanici adi belirleme
  let chosenUsername = current.username || "";
  let chosenUsernameLower = current.usernameLower || "";
  let needsUsernameReservation = false;

  if (!chosenUsername) {
    console.log("  Bu kullanicinin kullanici adi yok.");
    chosenUsername = await askQuestion(
      "  Yeni kullanici adi girin (3-20 karakter, a-z 0-9 _): "
    );
    if (!USERNAME_REGEX.test(chosenUsername)) {
      console.error("\n  HATA: Gecersiz kullanici adi formati. Script durduruluyor.");
      process.exit(1);
    }
    chosenUsernameLower = chosenUsername.toLowerCase();

    // Usernames koleksiyonunda dolu mu kontrol et
    console.log(`\n  "${chosenUsernameLower}" uygun mu kontrol ediliyor...`);
    const usernameDoc = await firestoreGet(token, `Usernames/${chosenUsernameLower}`);
    if (usernameDoc) {
      const taken = fromFsDoc(usernameDoc);
      if (taken.uid && taken.uid !== TARGET_UID) {
        console.error(
          `\n  HATA: "${chosenUsernameLower}" baska biri tarafindan alinmis (uid: ${taken.uid}).`
        );
        process.exit(1);
      }
    } else {
      needsUsernameReservation = true;
    }
    console.log(`  "${chosenUsernameLower}" kullanilabilir.\n`);
  } else {
    console.log(`  Mevcut kullanici adi korunuyor: ${chosenUsername}`);
  }

  // 3. Eksik alanlari hesapla
  const patch = {};
  const fieldsToUpdate = [];

  function addIfMissing(key, value) {
    if (current[key] === undefined || current[key] === null) {
      patch[key] = toFsValue(value);
      fieldsToUpdate.push(key);
    }
  }

  if (!current.username) {
    patch["username"] = toFsValue(chosenUsername);
    patch["usernameLower"] = toFsValue(chosenUsernameLower);
    fieldsToUpdate.push("username", "usernameLower");
  }

  addIfMissing("uid", TARGET_UID);
  addIfMissing("avatarIndex", 0);
  addIfMissing("bio", "");
  addIfMissing("friendsCount", 0);
  addIfMissing("postsCount", 0);
  addIfMissing("followersCount", 0);
  addIfMissing("followingCount", 0);
  addIfMissing("pendingRequestsInCount", 0);
  addIfMissing("pendingRequestsOutCount", 0);
  addIfMissing("unreadNotifsCount", 0);
  addIfMissing("privacy", DEFAULT_PRIVACY);
  addIfMissing("listVisible", DEFAULT_LIST_VISIBLE);

  if ((current._schemaVersion || 0) < SCHEMA_VERSION) {
    patch["_schemaVersion"] = toFsValue(SCHEMA_VERSION);
    fieldsToUpdate.push("_schemaVersion");
  }

  patch["updatedAt"] = { timestampValue: new Date().toISOString() };
  fieldsToUpdate.push("updatedAt");

  const realChanges = fieldsToUpdate.filter((f) => f !== "updatedAt");

  if (realChanges.length === 0) {
    console.log("\n  Kullanici zaten guncel. Yapacak bir sey yok.");
    process.exit(0);
  }

  console.log("\n--- Eklenecek / guncellenecek alanlar --------------------------");
  for (const key of realChanges) {
    console.log(`  + ${key}`);
  }
  console.log("----------------------------------------------------------------");

  if (!apply) {
    console.log(
      "\n  KUR CALISMA - gercekte hicbir sey yazilmadi." +
        "\n  Gercek yazma icin: --apply bayragini ekleyin\n"
    );
    process.exit(0);
  }

  // 4. Kullanici dokumanini guncelle
  console.log(`\n  Users/${TARGET_UID} guncelleniyor...`);
  await firestorePatch(token, `Users/${TARGET_UID}`, patch, fieldsToUpdate);
  console.log(`  Users/${TARGET_UID} guncellendi.`);

  // 5. Kullanici adi rezervasyonu
  if (needsUsernameReservation && chosenUsername) {
    console.log(`\n  Usernames/${chosenUsernameLower} rezerve ediliyor...`);
    await firestorePatch(
      token,
      `Usernames/${chosenUsernameLower}`,
      {
        uid: toFsValue(TARGET_UID),
        reservedAt: { timestampValue: new Date().toISOString() },
      },
      ["uid", "reservedAt"]
    );
    console.log(`  Usernames/${chosenUsernameLower} rezerve edildi.`);
  }

  // 6. Dogrulama - geri oku
  console.log(`\n  Dogrulama icin Users/${TARGET_UID} yeniden okunuyor...`);
  const after = fromFsDoc(await firestoreGet(token, `Users/${TARGET_UID}`));

  console.log("\n--- Guncel kullanici verisi ------------------------------------");
  console.log(`  username       : ${after.username || "(HALA YOK!)"}`);
  console.log(`  usernameLower  : ${after.usernameLower || "(HALA YOK!)"}`);
  console.log(`  avatarIndex    : ${after.avatarIndex ?? "(yok)"}`);
  console.log(`  _schemaVersion : ${after._schemaVersion ?? "(yok)"}`);
  console.log(`  friendsCount   : ${after.friendsCount ?? "(yok)"}`);
  console.log(`  privacy.profile: ${after.privacy?.profile ?? "(yok)"}`);
  console.log("----------------------------------------------------------------");

  const allGood =
    after.username &&
    after.usernameLower &&
    after.avatarIndex !== undefined &&
    after._schemaVersion === SCHEMA_VERSION;

  if (allGood) {
    console.log("\n  Migration basariyla tamamlandi!\n");
  } else {
    console.warn("\n  UYARI: Bazi alanlar hala eksik - dogrulama basarisiz.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n  HATA:", err.message);
  process.exit(1);
});
