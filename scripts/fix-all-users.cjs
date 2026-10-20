#!/usr/bin/env node
/**
 * fix-all-users.cjs
 *
 * Uc kullanicinin Firestore verisini yeni semaya uyumlu hale getirir:
 *   - Eksik alanlari varsayilanlarla ekler (mevcut alanlara DOKUNMAZ)
 *   - Eski/kalinti alanlari kaldirir (typing, avatar, friends, friendRequests,
 *     mediaCommentCount, isOnline, lastActiveAt, lastSeen)
 *   - listVisible icindeki bozuk anahtarlari temizler (sadece 4 standart kalir)
 *   - uid alani eksikse ekler
 *
 * KULLANIM:
 *   node scripts/fix-all-users.cjs          # kuru calisma
 *   node scripts/fix-all-users.cjs --apply  # gercekten yaz
 */

const path = require("path");
const { execFileSync } = require("child_process");

const APPLY = process.argv.includes("--apply");

const PROJECT_ID = "movieandtv-2832a";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SCHEMA_VERSION = 2;

// Standart listVisible anahtarlari — bunun disindakiler kaldirilir
const STANDARD_LIST_VISIBLE_KEYS = ["watchedMovies", "watchedTv", "watchList", "favorites"];

// Kaldirilacak eski alanlar
const LEGACY_FIELDS = [
  "typing",
  "avatar",
  "friends",
  "friendRequests",
  "mediaCommentCount",
  "isOnline",
  "lastActiveAt",
  "lastSeen",
];

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

const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  mentionsEnabled: true,
  postCommentsEnabled: true,
  postLikesEnabled: true,
  friendRequestsEnabled: true,
  friendAcceptedEnabled: true,
  messagesEnabled: true,
  streamingEnabled: false,
};

const DEFAULT_STREAMING_PROVIDERS = { region: "TR", ids: [] };

// --- Firebase yardimcilari --------------------------------------------------

async function getToken() {
  const npmRoot = execFileSync("npm", ["root", "-g"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  }).trim();
  const auth = require(path.join(npmRoot, "firebase-tools", "lib", "auth.js"));
  const account = auth.getGlobalDefaultAccount();
  if (!account?.tokens?.refresh_token)
    throw new Error("Firebase CLI oturumu yok. 'firebase login' calistirin.");
  const result = await auth.getAccessToken(account.tokens.refresh_token, []);
  if (!result?.access_token) throw new Error("Token alinamadi.");
  return result.access_token;
}

async function fsGet(token, docPath) {
  const res = await fetch(`${BASE}/${docPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GET ${docPath}: HTTP ${res.status}`);
  return res.json();
}

// updateMask ile sadece belirtilen alanlari yazar/siler
async function fsPatch(token, docPath, fields, maskPaths) {
  const mask = maskPaths
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");
  const url = `${BASE}/${docPath}?${mask}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`PATCH ${docPath}: HTTP ${res.status} - ${body.slice(0, 300)}`);
  }
  return res.json();
}

// --- Firestore deger donusumleri -------------------------------------------

function toFsValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value))
    return { integerValue: String(value) };
  if (typeof value === "number") return { doubleValue: value };
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value))
    return { arrayValue: { values: value.map(toFsValue) } };
  if (typeof value === "object") {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([k, v]) => [k, toFsValue(v)])
        ),
      },
    };
  }
  throw new Error(`Bilinmeyen tip: ${typeof value}`);
}

function fromFsDoc(doc) {
  if (!doc?.fields) return {};
  function fromValue(v) {
    if (!v) return undefined;
    if ("nullValue" in v) return null;
    if ("booleanValue" in v) return v.booleanValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("stringValue" in v) return v.stringValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(fromValue);
    if ("mapValue" in v) {
      if (!v.mapValue.fields) return {};
      return Object.fromEntries(
        Object.entries(v.mapValue.fields).map(([k, val]) => [k, fromValue(val)])
      );
    }
    return null;
  }
  return Object.fromEntries(
    Object.entries(doc.fields).map(([k, v]) => [k, fromValue(v)])
  );
}

// --- Kullanici analiz + patch plani ----------------------------------------

function buildPlan(uid, current) {
  const patch = {};      // yazilacak alanlar (Firestore format)
  const deletions = [];  // silinecek alan adlari (updateMask'e girer, fields'ta olmaz)
  const adds = [];       // log icin
  const removes = [];    // log icin

  function addIfMissing(key, value) {
    if (current[key] === undefined || current[key] === null) {
      patch[key] = toFsValue(value);
      adds.push(`+ ${key}`);
    }
  }

  // uid alani
  addIfMissing("uid", uid);

  // Temel sayicilar
  addIfMissing("bio", "");
  addIfMissing("avatarIndex", 0);
  addIfMissing("friendsCount", 0);
  addIfMissing("postsCount", 0);
  addIfMissing("followersCount", 0);
  addIfMissing("followingCount", 0);
  addIfMissing("pendingRequestsInCount", 0);
  addIfMissing("pendingRequestsOutCount", 0);
  addIfMissing("unreadNotifsCount", 0);
  addIfMissing("notificationLanguage", "tr");

  // Karmasik alanlar
  addIfMissing("privacy", DEFAULT_PRIVACY);
  addIfMissing("notificationSettings", DEFAULT_NOTIFICATION_SETTINGS);
  addIfMissing("streamingProviders", DEFAULT_STREAMING_PROVIDERS);

  // listVisible — yalnizca standart anahtarlar
  if (!current.listVisible) {
    patch["listVisible"] = toFsValue(DEFAULT_LIST_VISIBLE);
    adds.push("+ listVisible (sifirdan)");
  } else {
    // Bozuk anahtarlari temizle, eksik standart anahtarlari ekle
    const cleaned = {};
    let needsClean = false;
    for (const k of STANDARD_LIST_VISIBLE_KEYS) {
      cleaned[k] =
        typeof current.listVisible[k] === "boolean"
          ? current.listVisible[k]
          : false;
    }
    // Standart disminda anahtar var mi?
    const extraKeys = Object.keys(current.listVisible).filter(
      (k) => !STANDARD_LIST_VISIBLE_KEYS.includes(k)
    );
    if (extraKeys.length > 0) {
      needsClean = true;
      adds.push(
        `~ listVisible temizlendi (kaldirildi: ${extraKeys.map((k) => JSON.stringify(k)).join(", ")})`
      );
    }
    if (needsClean) {
      patch["listVisible"] = toFsValue(cleaned);
    }
  }

  // _schemaVersion
  if ((current._schemaVersion || 0) < SCHEMA_VERSION) {
    patch["_schemaVersion"] = toFsValue(SCHEMA_VERSION);
    adds.push(`~ _schemaVersion -> ${SCHEMA_VERSION}`);
  }

  // Eski / kalinti alanlari sil
  for (const field of LEGACY_FIELDS) {
    if (current[field] !== undefined) {
      deletions.push(field);
      removes.push(`- ${field}`);
    }
  }

  // updatedAt her zaman guncelle
  patch["updatedAt"] = { timestampValue: new Date().toISOString() };

  return { patch, deletions, adds, removes };
}

// --- Ana mantik -------------------------------------------------------------

async function processUser(token, uid) {
  console.log(`\n${"=".repeat(62)}`);
  console.log(`  Kullanici: ${uid}`);
  console.log(`${"=".repeat(62)}`);

  const doc = await fsGet(token, `Users/${uid}`);
  if (!doc) {
    console.log("  ATLANDI: Users/" + uid + " Firestore'da yok.");
    return;
  }

  const current = fromFsDoc(doc);
  console.log(`  Mevcut alanlar: ${Object.keys(current).join(", ")}`);

  const { patch, deletions, adds, removes } = buildPlan(uid, current);

  const hasChanges =
    adds.length > 0 ||
    removes.length > 0;

  if (!hasChanges) {
    console.log("  Degisiklik yok — kullanici zaten guncel.");
    return;
  }

  console.log("\n  Yapilacak degisiklikler:");
  [...adds, ...removes].forEach((l) => console.log("    " + l));

  if (!APPLY) {
    console.log("\n  [KUR CALISMA — hicbir sey yazilmadı]");
    return;
  }

  // Yazilacak alanlar + silinecek alanlar icin updateMask olustur
  const maskPaths = [
    ...Object.keys(patch),
    ...deletions,
  ];

  // Silme: fields objesine dahil ETME, sadece updateMask'e ekle
  // Firestore: updateMask'te olan ama fields'ta olmayan alanlar silinir.
  await fsPatch(token, `Users/${uid}`, patch, maskPaths);
  console.log(`\n  YAZILDI: ${maskPaths.length} alan (${adds.length} eklendi/guncellendi, ${deletions.length} silindi)`);
}

async function main() {
  console.log(`\nFirebase oturumu aliniyor...`);
  const token = await getToken();
  console.log(`Oturum acik. Mod: ${APPLY ? "GERCEK YAZMA" : "KUR CALISMA"}\n`);

  const UIDS = [
    "Sno7mWprjhS24fc4ub3fC1wyBYq2",
    "OtZL4u10cbOdoCEIbtDPYR7rZt12",
    "G71uodw4dnVnQXbpEdRUvuI6GrB2",
  ];

  for (const uid of UIDS) {
    await processUser(token, uid);
  }

  console.log(`\n${"=".repeat(62)}`);
  if (APPLY) {
    console.log("  Tum islemler tamamlandi!\n");
  } else {
    console.log("  Kuru calisma bitti. Gercek yazma icin: --apply\n");
  }
}

main().catch((err) => {
  console.error("\nHATA:", err.message);
  process.exit(1);
});
