#!/usr/bin/env node
// scripts/create-missing-user.cjs
// Sadece Firebase Auth'da var olan, Firestore'da hic verisi olmayan
// kullaniciyi sifirdan olusturur.

const path = require("path");
const { execFileSync } = require("child_process");

// --- Kullanici bilgileri (hardcoded bu islem icin) --------------------------
const UID            = "G71uodw4dnVnQXbpEdRUvuI6GrB2";
const EMAIL          = "slhztrk60328@gmail.com";
const DISPLAY_NAME   = "salih ozturk";
const USERNAME       = "salihozturk";
const USERNAME_LOWER = "salihozturk";

// --- Firebase ---------------------------------------------------------------
const PROJECT_ID   = "movieandtv-2832a";
const BASE_URL     = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getToken() {
  const npmRoot = execFileSync("npm", ["root", "-g"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  }).trim();
  const auth    = require(path.join(npmRoot, "firebase-tools", "lib", "auth.js"));
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token) {
    throw new Error("Firebase CLI oturumu bulunamadi. Once 'firebase login' calistirin.");
  }
  const result = await auth.getAccessToken(account.tokens.refresh_token, []);
  if (!result?.access_token) throw new Error("Erisim anahtari alinamadi.");
  return result.access_token;
}

async function patch(token, docPath, fields) {
  const url = `${BASE_URL}/${docPath}`;
  const res = await fetch(url, {
    method:  "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body:    JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PATCH ${docPath}: HTTP ${res.status} - ${body.slice(0, 400)}`);
  }
  return res.json();
}

async function get(token, docPath) {
  const res = await fetch(`${BASE_URL}/${docPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${docPath}: HTTP ${res.status}`);
  return res.json();
}

async function main() {
  console.log("\nFirebase oturumu aliniyor...");
  const token = await getToken();
  console.log("Oturum acik.\n");

  // 1. Zaten var mi?
  const existing = await get(token, `Users/${UID}`);
  if (existing && existing.fields) {
    console.log("BILGI: Users/" + UID + " zaten mevcut. Baska islem gerekmiyor.");
    process.exit(0);
  }

  // 2. Username baska birine ait mi?
  const unDoc = await get(token, `Usernames/${USERNAME_LOWER}`);
  if (unDoc && unDoc.fields) {
    const takenUid = unDoc.fields.uid?.stringValue;
    if (takenUid && takenUid !== UID) {
      console.error("HATA: '" + USERNAME_LOWER + "' baska birine ait: " + takenUid);
      process.exit(1);
    }
  }

  const now = new Date().toISOString();

  const userFields = {
    uid:                     { stringValue: UID },
    email:                   { stringValue: EMAIL },
    displayName:             { stringValue: DISPLAY_NAME },
    username:                { stringValue: USERNAME },
    usernameLower:           { stringValue: USERNAME_LOWER },
    avatarIndex:             { integerValue: "0" },
    bio:                     { stringValue: "" },
    birthDate:               { nullValue: null },
    friendsCount:            { integerValue: "0" },
    postsCount:              { integerValue: "0" },
    followersCount:          { integerValue: "0" },
    followingCount:          { integerValue: "0" },
    pendingRequestsInCount:  { integerValue: "0" },
    pendingRequestsOutCount: { integerValue: "0" },
    unreadNotifsCount:       { integerValue: "0" },
    notificationLanguage:    { stringValue: "tr" },
    _schemaVersion:          { integerValue: "2" },
    createdAt:               { timestampValue: now },
    updatedAt:               { timestampValue: now },
    privacy: {
      mapValue: {
        fields: {
          profile:      { stringValue: "public" },
          lists:        { stringValue: "public" },
          posts:        { stringValue: "public" },
          onlineStatus: { stringValue: "everyone" },
        },
      },
    },
    listVisible: {
      mapValue: {
        fields: {
          watchedMovies: { booleanValue: false },
          watchedTv:     { booleanValue: false },
          watchList:     { booleanValue: false },
          favorites:     { booleanValue: false },
        },
      },
    },
    notificationSettings: {
      mapValue: {
        fields: {
          enabled:               { booleanValue: true },
          mentionsEnabled:       { booleanValue: true },
          postCommentsEnabled:   { booleanValue: true },
          postLikesEnabled:      { booleanValue: true },
          friendRequestsEnabled: { booleanValue: true },
          friendAcceptedEnabled: { booleanValue: true },
          messagesEnabled:       { booleanValue: true },
          streamingEnabled:      { booleanValue: false },
        },
      },
    },
    streamingProviders: {
      mapValue: {
        fields: {
          region: { stringValue: "TR" },
          ids:    { arrayValue: { values: [] } },
        },
      },
    },
  };

  // 3. Users/{uid} olustur
  console.log("Users/" + UID + " olusturuluyor...");
  await patch(token, `Users/${UID}`, userFields);
  console.log("OK: Users/" + UID + " olusturuldu.");

  // 4. Usernames rezervasyonu
  console.log("Usernames/" + USERNAME_LOWER + " rezerve ediliyor...");
  await patch(token, `Usernames/${USERNAME_LOWER}`, {
    uid:        { stringValue: UID },
    reservedAt: { timestampValue: now },
  });
  console.log("OK: Usernames/" + USERNAME_LOWER + " rezerve edildi.");

  // 5. Dogrulama
  console.log("\nDogrulama icin geri okunuyor...");
  const verified = await get(token, `Users/${UID}`);
  const f = verified?.fields || {};

  console.log("\n--- Dogrulama (" + UID + ") ---");
  console.log("  uid           :", f.uid?.stringValue);
  console.log("  email         :", f.email?.stringValue);
  console.log("  displayName   :", f.displayName?.stringValue);
  console.log("  username      :", f.username?.stringValue);
  console.log("  usernameLower :", f.usernameLower?.stringValue);
  console.log("  avatarIndex   :", f.avatarIndex?.integerValue);
  console.log("  _schemaVersion:", f._schemaVersion?.integerValue);
  console.log("  privacy.profile:", f.privacy?.mapValue?.fields?.profile?.stringValue);
  console.log("  notif.enabled :", f.notificationSettings?.mapValue?.fields?.enabled?.booleanValue);
  console.log("--------------------------------");

  const ok = f.uid && f.username && f.usernameLower && f._schemaVersion;
  if (ok) {
    console.log("\nMigration basariyla tamamlandi!\n");
  } else {
    console.warn("\nUYARI: Bazi alanlar eksik. Manuel kontrol edin.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\nHATA:", err.message);
  process.exit(1);
});
