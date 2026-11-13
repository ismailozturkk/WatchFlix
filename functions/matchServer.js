"use strict";

// Zevk Çemberleri — SUNUCU HATTI, Firestore bağlantısı (rehber Faz 5). Saf kararlar matchPipeline.js'te.
// index.js yalnız bu fonksiyonları çağırır: onMatchOptInWritten, matchNightly, matchHello, getMatchPairScore,
// matchAction (gizle / engelle / şikâyet; opak kimlikle), matchCircleJoin (çember → mevcut grup sohbeti).
//
// KOLEKSİYONLAR (hepsi istemciye KAPALI; yalnız MatchSuggestions/{uid} sahibine okunur — firestore.rules):
//   MatchMembers/{uid}            katılım kaydı { lanes, joinedAt, updatedAt, hello: { day, count } }
//   MatchProfiles/{uid}           sıkıştırılmış kulvar öğeleri + eşleşme gücü (girdi; bağlamdan bağımsız)
//   MatchProfiles/{uid}/built/{lane}  gecelik bağlamla kurulmuş çekirdek profili (getMatchPairScore okur)
//   MatchSuggestions/{uid}        sahibin öneri belgesi (aday: opak cid + görünen ad + avatar; uid YOK)
//   MatchPairs/{uid}              cid → aday uid eşlemesi + ters dizin `uids` (ayrılanı başkalarından silmek için)
//   MatchHellos/{a_b}             selam durumu { uids:[a,b], lane, from: { uid: ms }, mutualAt? }
//   MatchCircles/{key}            gece kurulan çember { lane, members, genres, joined: { uid: ms }, groupId? }
//   TitleFeatures/{movie_123}     TMDB'den yapım özellikleri (kişisel veri yok; 90 günde bir tazelenir)
//   MatchMeta/salt · MatchMeta/ctx_{lane} · MatchMeta/run   tuz, öğrenilen bağlam, son koşum özeti
//
// MALİYET (okuma): gece işi katılan başına ~5 belge + engel listesi + değişen kütüphanede tam liste okuması
// (en sık 6 saatte bir; Lists kök damgası değişmediyse hiç). Uygulama tarafı: kullanıcı başına öneri belgesi.

const { FieldValue } = require("firebase-admin/firestore");
const P = require("./matchPipeline");
const core = require("./tasteMatchCore");

const COL = Object.freeze({
  members: "MatchMembers",
  profiles: "MatchProfiles",
  suggestions: "MatchSuggestions",
  pairs: "MatchPairs",
  hellos: "MatchHellos",
  titles: "TitleFeatures",
  meta: "MatchMeta",
  circles: "MatchCircles",
});
/** Grubu kurulmamış çember kaydı bu kadar gün güncellenmezse silinir. */
const CIRCLE_KEEP_DAYS = 30;
/** Gizlenen aday listesi tavanı (üyelik belgesi şişmesin; en eskiler düşer). */
const HIDDEN_MAX = 500;
/** İstemcideki utils/reportValidation.js REPORT_REASONS ile AYNI. */
const REPORT_REASONS = Object.freeze(["spam", "harassment", "hate_speech", "sexual_content", "violence", "self_harm", "misinformation", "other"]);
const CID_RE = /^[A-Za-z0-9_-]{10,40}$/;
const CTX_MAX_BYTES = 900 * 1024;
const HELLO_KEEP_DAYS = 30;

class MatchError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const docsData = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

async function readConfig(db) {
  const snap = await db.doc("AppConfig/match").get();
  return P.parseServerConfig(snap.exists ? snap.data() : null);
}

/** Opak kimlik tuzu: ilk kez çağrıldığında üretilir, sonra hep aynı (öneriler yeniden çalıştırmada değişmez). */
async function ensureSalt(db, randomBytes = require("node:crypto").randomBytes) {
  const ref = db.doc(`${COL.meta}/salt`);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists && typeof snap.get("salt") === "string") return snap.get("salt");
    const salt = randomBytes(24).toString("base64url");
    tx.set(ref, { salt, createdAt: FieldValue.serverTimestamp() });
    return salt;
  });
}

// ── üyelik ───────────────────────────────────────────────────────────────────

/**
 * Katılım belgesi değişti (tetikleyici). Katılım kapalı / 18+ kanıtı yok → bütün eşleşme verisi silinir.
 * Açık → üyelik kaydı + profil hemen kurulur (öneriler ilk gece işinde).
 */
async function syncMember(db, uid, optInData, { now = Date.now() } = {}) {
  const { optedIn, lanes } = P.readOptIn(optInData);
  if (!optedIn) return removeMember(db, uid).then(() => ({ status: "removed" }));
  const user = await db.doc(`Users/${uid}`).get();
  if (!user.exists || !P.isAdultBirthDate(user.get("birthDate"), new Date(now))) {
    await removeMember(db, uid);
    return { status: "not-adult" };
  }
  const ref = db.doc(`${COL.members}/${uid}`);
  const prev = await ref.get();
  await ref.set(
    { lanes, updatedAt: now, ...(prev.exists ? {} : { joinedAt: now }) },
    { merge: true },
  );
  await refreshProfile(db, uid, { lanes, now, force: !prev.exists });
  return { status: "member", lanes };
}

/**
 * Ayrılma ya da hesap silme: üyenin bütün eşleşme verisi + bekleyen selamlar silinir, başkalarının
 * öneri belgelerinden de çıkarılır (ters dizin MatchPairs.uids). Tekrar çağrılabilir.
 */
async function removeMember(db, uid) {
  const writer = db.bulkWriter();
  const del = (ref) => writer.delete(ref).catch(() => {});
  del(db.doc(`${COL.members}/${uid}`));
  del(db.doc(`${COL.suggestions}/${uid}`));
  del(db.doc(`${COL.pairs}/${uid}`));
  const built = await db.collection(`${COL.profiles}/${uid}/built`).listDocuments();
  built.forEach(del);
  del(db.doc(`${COL.profiles}/${uid}`));
  const hellos = await db.collection(COL.hellos).where("uids", "array-contains", uid).get();
  hellos.docs.forEach((d) => del(d.ref));
  // Çember kayıtlarından çıkar (kurulmuş grup sohbeti bozulmaz; gruptan ayrılmak grup ekranında).
  const circles = await db.collection(COL.circles).where("members", "array-contains", uid).get();
  circles.docs.forEach((d) =>
    writer.update(d.ref, { members: FieldValue.arrayRemove(uid), [`joined.${uid}`]: FieldValue.delete() }).catch(() => {}),
  );
  await writer.close();

  // Başkalarının önerilerinden çıkar (bir sonraki gece işini beklemeden).
  const owners = await db.collection(COL.pairs).where("uids", "array-contains", uid).get();
  for (const ownerDoc of owners.docs) {
    await db.runTransaction(async (tx) => {
      const pairRef = ownerDoc.ref;
      const sugRef = db.doc(`${COL.suggestions}/${ownerDoc.id}`);
      const [pairSnap, sugSnap] = await Promise.all([tx.get(pairRef), tx.get(sugRef)]);
      if (!pairSnap.exists) return;
      const map = { ...(pairSnap.get("map") || {}) };
      const gone = Object.keys(map).filter((cid) => map[cid]?.uid === uid);
      gone.forEach((cid) => delete map[cid]);
      tx.set(pairRef, { map, uids: (pairSnap.get("uids") || []).filter((u) => u !== uid) }, { merge: false });
      if (sugSnap.exists && gone.length) {
        const lanes = { ...(sugSnap.get("lanes") || {}) };
        for (const [lane, entry] of Object.entries(lanes)) {
          lanes[lane] = { ...entry, items: (entry.items || []).filter((it) => !gone.includes(it.cid)) };
        }
        tx.update(sugRef, { lanes });
      }
    });
  }
}

// ── profil ───────────────────────────────────────────────────────────────────

/** Kütüphane okuması → MatchProfiles/{uid}. Kaynak damgası değişmediyse ya da 6 saat dolmadıysa OKUMAZ. */
async function refreshProfile(db, uid, { lanes, now = Date.now(), force = false, cfg = P.SERVER_DEFAULTS } = {}) {
  const profileRef = db.doc(`${COL.profiles}/${uid}`);
  const [listsRoot, existing] = await Promise.all([db.doc(`Lists/${uid}`).get(), profileRef.get()]);
  const sourceStamp = P.toMs(listsRoot.get("updatedAt"));
  const prev = existing.exists ? existing.data() : null;
  if (!force && !P.needsRebuild(prev, { sourceStamp, lanes, now, cfg })) return { profile: prev, rebuilt: false };

  const needMovie = lanes.includes("movie");
  const needTv = lanes.includes("tv");
  const [movies, shows, favorites, user] = await Promise.all([
    needMovie ? db.collection(`Lists/${uid}/watchedMovies`).get().then(docsData) : [],
    needTv ? db.collection(`Lists/${uid}/watchedTv`).get().then(docsData) : [],
    db.collection(`Lists/${uid}/favorites`).get().then(docsData),
    db.doc(`Users/${uid}`).get(),
  ]);
  const activity = listsRoot.get("activityIndex") || {};
  const { lanes: laneData } = P.buildLaneInputs({
    side: { watchedMovies: movies, watchedShows: shows, favorites, ratings: activity.ratings || {} },
    commentKeys: Array.isArray(activity.comments) ? activity.comments : [],
    fourFavorites: user.get("fourFavorites") || null,
    lanes,
    now,
    maxItemsPerLane: cfg.maxItemsPerLane,
  });
  const profile = { v: P.PROFILE_VERSION, builtAt: now, sourceStamp: sourceStamp ?? null, lastActive: sourceStamp ?? null, optLanes: lanes, lanes: laneData };
  await profileRef.set(profile);
  return { profile, rebuilt: true };
}

// ── yapım özellikleri (TMDB) ─────────────────────────────────────────────────

/**
 * Havuzdaki yapımların TitleFeatures belgelerini okur; olmayan ya da bayat olanları (en çok `limit`)
 * TMDB'den çekip yazar. `fetchTitle(type, id)` → TMDB JSON | null (index.js verir; testte sahte).
 * @returns {Promise<Map<string, object>>}
 */
async function loadTitleFeatures(db, keys, { fetchTitle, now = Date.now(), cfg = P.SERVER_DEFAULTS, concurrency = 8 } = {}) {
  const ids = [...new Set(keys.map(P.titleIdOf).filter(Boolean))].sort();
  const out = new Map();
  for (let i = 0; i < ids.length; i += 300) {
    const refs = ids.slice(i, i + 300).map((id) => db.doc(`${COL.titles}/${id}`));
    const snaps = await db.getAll(...refs);
    snaps.forEach((s) => s.exists && out.set(s.id, s.data()));
  }
  if (!fetchTitle) return out;
  const ttl = cfg.titleFeaturesTtlDays * P.DAY;
  const todo = ids.filter((id) => !out.has(id) || !(now - (out.get(id).fetchedAt || 0) < ttl)).slice(0, cfg.tmdbPerRun);
  const writer = db.bulkWriter();
  let cursor = 0;
  const worker = async () => {
    while (cursor < todo.length) {
      const id = todo[cursor++];
      const [type, num] = id.split("_");
      const json = await fetchTitle(type, Number(num)).catch(() => null);
      const doc = P.titleFeaturesFromTmdb(type, json, now);
      if (!doc) continue;
      out.set(id, doc);
      writer.set(db.doc(`${COL.titles}/${id}`), doc).catch(() => {});
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
  await writer.close();
  return out;
}

// ── gece işi ─────────────────────────────────────────────────────────────────

/** Bağlamı sakla (getMatchPairScore için). 1 MB'ı aşarsa büyük tablolar düşer, hesap varsayılana yaslanır. */
function storableContext(ctx) {
  const plain = JSON.parse(JSON.stringify(ctx));
  let text = JSON.stringify(plain);
  for (const heavy of ["featureIdf", "watchers", "crowdS", "meanProfile"]) {
    if (Buffer.byteLength(text) <= CTX_MAX_BYTES) break;
    delete plain[heavy];
    text = JSON.stringify(plain);
  }
  return { json: text };
}

/**
 * Gecelik eşleşme. Yeniden çalıştırılabilir: aynı veriyle aynı belgeleri yazar (opak kimlik tuzlu ve belirlenimli).
 * @param {{ now?: number, fetchTitle?: Function, log?: Function }} [options]
 */
async function runNightly(db, { now = Date.now(), fetchTitle = null, log = () => {} } = {}) {
  const config = await readConfig(db);
  if (!config.enabled) return { skipped: "disabled" };
  const cfg = config.server;
  const salt = await ensureSalt(db);
  const memberDocs = docsData(await db.collection(COL.members).get());

  // 1) Üyeleri doğrula + profilleri tazele (sırayla, küçük eşzamanlılık).
  const members = [];
  const cards = new Map();
  const blocks = new Map();
  let rebuilt = 0;
  for (const m of memberDocs) {
    const uid = m.id;
    const [user, optIn, blocked] = await Promise.all([
      db.doc(`Users/${uid}`).get(),
      db.doc(`Users/${uid}/private/match`).get(),
      db.collection(`Users/${uid}/blocked`).get(),
    ]);
    const { optedIn, lanes } = P.readOptIn(optIn.exists ? optIn.data() : null);
    const adult = user.exists && P.isAdultBirthDate(user.get("birthDate"), new Date(now));
    if (!optedIn || !adult) {
      await removeMember(db, uid);
      continue;
    }
    const { profile, rebuilt: did } = await refreshProfile(db, uid, { lanes, now, cfg });
    if (did) rebuilt += 1;
    cards.set(uid, P.publicCard(user.data()));
    // Engellenenler + eşleşmede "gizle" denenler: ikisi de skorlanmaz (her iki yönde).
    blocks.set(uid, new Set([...blocked.docs.map((d) => d.id), ...(Array.isArray(m.hidden) ? m.hidden : [])]));
    members.push({ uid, lanes, adult, profile, lastActive: profile?.lastActive ?? null });
  }
  const active = new Set(members.filter((m) => m.lastActive != null && now - m.lastActive <= cfg.activeDays * P.DAY).map((m) => m.uid));

  // 2) Yapım özellikleri: yalnız havuza girecek kulvarların yapımları.
  const pools = Object.fromEntries(P.MATCH_LANES.map((lane) => [lane, P.laneEligible(members, lane)]));
  const keys = [];
  for (const lane of P.MATCH_LANES) for (const m of pools[lane]) for (const it of m.profile.lanes[lane].items) keys.push(it.key);
  const features = await loadTitleFeatures(db, keys, { fetchTitle, now, cfg });

  // 3) Selam durumu (son 30 gün).
  const helloSnap = await db.collection(COL.hellos).where("createdAt", ">=", now - HELLO_KEEP_DAYS * P.DAY).get();
  const sent = new Map();
  const greeted = new Map();
  const add = (map, a, b) => {
    if (!map.has(a)) map.set(a, new Set());
    map.get(a).add(b);
  };
  for (const h of helloSnap.docs) {
    const from = h.get("from") || {};
    const [a, b] = h.get("uids") || [];
    if (!a || !b) continue;
    if (from[a]) { add(sent, a, b); add(greeted, b, a); }
    if (from[b]) { add(sent, b, a); add(greeted, a, b); }
  }

  // 4) Kulvar başına skor, karar, çember.
  const perOwner = new Map(members.map((m) => [m.uid, { lanes: {}, map: {}, uids: new Set() }]));
  const builtWriter = db.bulkWriter();
  const stats = {};
  const circleDocs = new Map(); // key → { lane, members, genres }
  for (const lane of P.MATCH_LANES) {
    const pool = pools[lane];
    const activeInLane = pool.filter((m) => active.has(m.uid)).length;
    const { ctx, profiles, scores } = P.scoreLane(pool, lane, { features, cfg, coreConfig: config.core, blocks, now });
    const { suggestions, twinsEnabled } = P.decideSuggestions(scores, { active, poolSize: activeInLane, cfg, coreConfig: config.core });
    const circles = P.formCircles(scores, { cfg, enabled: twinsEnabled });
    const circleOf = new Map();
    for (const members_ of circles) {
      const key = P.circleKey(salt, lane, members_);
      const genres = P.circleGenres(members_.map((u) => pool.find((m) => m.uid === u).profile.lanes[lane].items));
      for (const u of members_) circleOf.set(u, { key, size: members_.length, genres });
      circleDocs.set(key, { lane, members: [...members_].sort(), genres });
    }
    await db.doc(`${COL.meta}/ctx_${lane}`).set({ updatedAt: now, poolSize: pool.length, ...storableContext(ctx) });
    for (const [uid, prof] of profiles) builtWriter.set(db.doc(`${COL.profiles}/${uid}/built/${lane}`), { builtAt: now, json: JSON.stringify(prof) }).catch(() => {});
    for (const m of members) {
      if (!m.lanes.includes(lane)) continue;
      const owner = perOwner.get(m.uid);
      const inPool = profiles.has(m.uid);
      const { items, map } = inPool
        ? P.buildLaneSuggestion({ owner: m.uid, lane, picks: suggestions.get(m.uid) || [], salt, cards, greetedBy: greeted.get(m.uid), sentTo: sent.get(m.uid) })
        : { items: [], map: {} };
      owner.lanes[lane] = { pool: pool.length, active: activeInLane, inPool, twinsEnabled, items, circle: circleOf.get(m.uid) || null };
      for (const [cid, other] of Object.entries(map)) {
        owner.map[cid] = { uid: other, lane };
        owner.uids.add(other);
      }
    }
    stats[lane] = { pool: pool.length, active: activeInLane, circles: circles.length, features: features.size };
  }
  await builtWriter.close();

  // 4b) Çember durumu (katılan / kurulan grup) önceki kayıtlardan; öneriye eklenir.
  const circleState = new Map();
  const circleRefs = [...circleDocs.keys()].map((key) => db.doc(`${COL.circles}/${key}`));
  if (circleRefs.length) {
    for (const snap of await db.getAll(...circleRefs)) {
      if (snap.exists) circleState.set(snap.id, { joined: snap.get("joined") || {}, groupId: snap.get("groupId") || null });
    }
  }
  for (const [uid, o] of perOwner) {
    for (const entry of Object.values(o.lanes)) {
      if (!entry.circle) continue;
      const st = circleState.get(entry.circle.key) || { joined: {}, groupId: null };
      entry.circle = P.circleView(entry.circle, st, uid);
    }
  }

  // 5) Belgeler.
  const writer = db.bulkWriter();
  for (const [uid, o] of perOwner) {
    writer.set(db.doc(`${COL.suggestions}/${uid}`), { v: 1, updatedAt: now, lanes: o.lanes }).catch(() => {});
    writer.set(db.doc(`${COL.pairs}/${uid}`), { updatedAt: now, map: o.map, uids: [...o.uids].sort() }).catch(() => {});
  }
  for (const [key, c] of circleDocs) writer.set(db.doc(`${COL.circles}/${key}`), { ...c, updatedAt: now }, { merge: true }).catch(() => {});
  // Grubu kurulmamış, uzun süredir oluşmayan çember kayıtları silinir.
  const staleCircles = await db.collection(COL.circles).where("updatedAt", "<", now - CIRCLE_KEEP_DAYS * P.DAY).get();
  staleCircles.docs.filter((d) => !d.get("groupId")).forEach((d) => writer.delete(d.ref).catch(() => {}));
  const stale = await db.collection(COL.hellos).where("createdAt", "<", now - HELLO_KEEP_DAYS * P.DAY).get();
  // 30 günü geçen selam kayıtları silinir (karşılıklıysa arkadaşlık zaten kuruldu; kayıt artık gereksiz).
  stale.docs.forEach((d) => writer.delete(d.ref).catch(() => {}));
  await writer.close();
  const summary = { at: now, members: members.length, rebuilt, lanes: stats };
  await db.doc(`${COL.meta}/run`).set(summary);
  log(`[match] gece işi: ${JSON.stringify(summary)}`);
  return summary;
}

// ── selam ────────────────────────────────────────────────────────────────────

const metaOf = (uid, data) => ({
  uid,
  displayName: data?.displayName || "",
  username: data?.username || "",
  avatarIndex: Number.isFinite(data?.avatarIndex) ? data.avatarIndex : 0,
  photoURL: data?.photoURL || null,
});

/**
 * Opak aday kimliğiyle selam. Karşılıklıysa ARKADAŞLIK kurulur (mevcut arkadaşlık belgeleri, sayaçlar ve
 * "friend_accepted" bildirimi; istemcideki acceptFriendRequest ile aynı şekil) — ayrı bir eşleşme sohbeti yok.
 * @returns {Promise<{ status: "sent"|"mutual"|"already" }>}
 */
async function sendHello(db, uid, { cid } = {}, { now = Date.now() } = {}) {
  if (typeof cid !== "string" || !CID_RE.test(cid)) throw new MatchError("invalid-argument");
  const config = await readConfig(db);
  if (!config.enabled) throw new MatchError("failed-precondition", "disabled");
  const pairSnap = await db.doc(`${COL.pairs}/${uid}`).get();
  const entry = pairSnap.exists ? (pairSnap.get("map") || {})[cid] : null;
  if (!entry?.uid) throw new MatchError("not-found");
  const other = entry.uid;
  const lane = entry.lane;
  const [meMember, otherMember, iBlocked, theyBlocked] = await Promise.all([
    db.doc(`${COL.members}/${uid}`).get(),
    db.doc(`${COL.members}/${other}`).get(),
    db.doc(`Users/${uid}/blocked/${other}`).get(),
    db.doc(`Users/${other}/blocked/${uid}`).get(),
  ]);
  if (!meMember.exists || !otherMember.exists) throw new MatchError("not-found");
  if (iBlocked.exists || theyBlocked.exists) throw new MatchError("not-found");

  const helloRef = db.doc(`${COL.hellos}/${P.helloKey(uid, other)}`);
  const memberRef = db.doc(`${COL.members}/${uid}`);
  return db.runTransaction(async (tx) => {
    const [hello, member, meUser, otherUser, friendSnap, reqMine, reqTheirs, mySug, theirSug, theirPairs] = await Promise.all([
      tx.get(helloRef),
      tx.get(memberRef),
      tx.get(db.doc(`Users/${uid}`)),
      tx.get(db.doc(`Users/${other}`)),
      tx.get(db.doc(`Users/${uid}/friends/${other}`)),
      tx.get(db.doc(`Users/${other}/friendRequests/${uid}_${other}`)),
      tx.get(db.doc(`Users/${uid}/friendRequests/${other}_${uid}`)),
      tx.get(db.doc(`${COL.suggestions}/${uid}`)),
      tx.get(db.doc(`${COL.suggestions}/${other}`)),
      tx.get(db.doc(`${COL.pairs}/${other}`)),
    ]);
    const from = { ...(hello.exists ? hello.get("from") || {} : {}) };
    if (from[uid] || hello.get?.("mutualAt")) return { status: "already" };
    const { allowed, quota } = P.nextHelloQuota(member.get("hello"), now, config.server.helloDailyLimit);
    if (!allowed) throw new MatchError("resource-exhausted");
    tx.set(memberRef, { hello: quota }, { merge: true });
    from[uid] = now;
    const mutual = !!from[other];
    tx.set(helloRef, { uids: [uid, other].sort(), lane, from, createdAt: hello.exists ? hello.get("createdAt") : now, ...(mutual ? { mutualAt: now } : {}) });

    // Öneri belgelerinde bayraklar: bende "gönderdim", onda "selam verdi".
    const flag = (sugSnap, cidOf, patch) => {
      if (!sugSnap.exists) return null;
      const lanes = { ...(sugSnap.get("lanes") || {}) };
      let hit = false;
      for (const [l, e] of Object.entries(lanes)) {
        lanes[l] = { ...e, items: (e.items || []).map((it) => (cidOf(it.cid) ? ((hit = true), { ...it, ...patch }) : it)) };
      }
      return hit ? lanes : null;
    };
    // Karşılıklıysa iki taraf artık arkadaş: kartta sohbet açmak için karşı tarafın uid'si yazılır.
    const myLanes = flag(mySug, (c) => c === cid, mutual ? { sent: true, mutual: true, friendUid: other } : { sent: true });
    if (myLanes) tx.update(mySug.ref, { lanes: myLanes });
    const theirMap = theirPairs.exists ? theirPairs.get("map") || {} : {};
    const theirLanes = flag(theirSug, (c) => theirMap[c]?.uid === uid, mutual ? { greeted: true, mutual: true, friendUid: uid } : { greeted: true });
    if (theirLanes) tx.update(theirSug.ref, { lanes: theirLanes });

    if (!mutual) return { status: "sent" };
    // Karşılıklı: artık arkadaşlar → uid ve ad döner (sohbet açmak için; arkadaşlık belgesi zaten gösterir).
    const done = { status: "mutual", friendUid: other, friendName: metaOf(other, otherUser.data()).displayName };
    if (friendSnap.exists) return done;
    const me = metaOf(uid, meUser.data());
    const them = metaOf(other, otherUser.data());
    const since = FieldValue.serverTimestamp();
    tx.set(db.doc(`Users/${uid}/friends/${other}`), { friendUid: other, friendName: them.displayName, friendUsername: them.username, friendAvatarIndex: them.avatarIndex, friendPhotoURL: them.photoURL, friendsSince: since });
    tx.set(db.doc(`Users/${other}/friends/${uid}`), { friendUid: uid, friendName: me.displayName, friendUsername: me.username, friendAvatarIndex: me.avatarIndex, friendPhotoURL: me.photoURL, friendsSince: since });
    // Bekleyen klasik arkadaşlık isteği varsa (iki yönden biri) kapatılır; sayaçlar istemciyle aynı kurala göre.
    const myCounters = { friendsCount: FieldValue.increment(1), unreadNotifsCount: FieldValue.increment(1) };
    const theirCounters = { friendsCount: FieldValue.increment(1), unreadNotifsCount: FieldValue.increment(1) };
    if (reqMine.exists) {
      tx.delete(reqMine.ref);
      tx.delete(db.doc(`Users/${uid}/sentRequests/${uid}_${other}`));
      theirCounters.pendingRequestsInCount = FieldValue.increment(-1);
      myCounters.pendingRequestsOutCount = FieldValue.increment(-1);
    }
    if (reqTheirs.exists) {
      tx.delete(reqTheirs.ref);
      tx.delete(db.doc(`Users/${other}/sentRequests/${other}_${uid}`));
      myCounters.pendingRequestsInCount = FieldValue.increment(-1);
      theirCounters.pendingRequestsOutCount = FieldValue.increment(-1);
    }
    tx.update(db.doc(`Users/${uid}`), myCounters);
    tx.update(db.doc(`Users/${other}`), theirCounters);
    const notify = (to, by) =>
      tx.set(db.collection(`Users/${to}/notifications`).doc(), {
        type: "match_mutual",
        source: "match",
        fromUid: by.uid,
        fromName: by.displayName,
        fromAvatarIndex: by.avatarIndex,
        fromPhotoURL: by.photoURL,
        read: false,
        createdAt: since,
      });
    notify(uid, them);
    notify(other, me);
    return done;
  });
}

// ── gizle / engelle / şikâyet (opak kimlikle; istemci adayın uid'sini bilmez) ───────────────

/** Sahibin önerisinden ve eşlemesinden tek adayı çıkarır (gece işini beklemeden). */
async function dropCandidate(db, uid, cid) {
  await db.runTransaction(async (tx) => {
    const pairRef = db.doc(`${COL.pairs}/${uid}`);
    const sugRef = db.doc(`${COL.suggestions}/${uid}`);
    const [pairSnap, sugSnap] = await Promise.all([tx.get(pairRef), tx.get(sugRef)]);
    if (pairSnap.exists) {
      const map = { ...(pairSnap.get("map") || {}) };
      const other = map[cid]?.uid;
      delete map[cid];
      const still = new Set(Object.values(map).map((v) => v.uid));
      // update: `map` alanı BÜTÜNÜYLE değişir (merge'lü set iç içe haritayı birleştirip silineni geri bırakırdı).
      tx.update(pairRef, { map, uids: (pairSnap.get("uids") || []).filter((u) => u !== other || still.has(u)) });
    }
    if (sugSnap.exists) {
      const lanes = { ...(sugSnap.get("lanes") || {}) };
      for (const [lane, entry] of Object.entries(lanes)) {
        lanes[lane] = { ...entry, items: (entry.items || []).filter((it) => it.cid !== cid) };
      }
      tx.update(sugRef, { lanes });
    }
  });
}

/**
 * Kartın "…" menüsü. Üçü de adayı GİZLER (bir daha önerilmez; iki yönde skorlanmaz):
 *   hide   — yalnız gizle
 *   block  — + Users/{uid}/blocked/{aday} (istemcideki blockUser ile aynı belge; arkadaşsa arkadaşlık biter)
 *   report — + ContentReports (istemcideki reportUser şekli, `source: "match"`)
 * @returns {Promise<{ status: "ok" }>}
 */
async function matchAction(db, uid, { cid, action, reason } = {}) {
  if (typeof cid !== "string" || !CID_RE.test(cid)) throw new MatchError("invalid-argument");
  if (!["hide", "block", "report"].includes(action)) throw new MatchError("invalid-argument");
  const pairSnap = await db.doc(`${COL.pairs}/${uid}`).get();
  const other = pairSnap.exists ? (pairSnap.get("map") || {})[cid]?.uid : null;
  if (!other || other === uid) throw new MatchError("not-found");
  if (action === "block") {
    const batch = db.batch();
    batch.set(db.doc(`Users/${uid}/blocked/${other}`), { blockedAt: FieldValue.serverTimestamp() });
    const friend = await db.doc(`Users/${uid}/friends/${other}`).get();
    if (friend.exists) {
      batch.delete(friend.ref);
      batch.delete(db.doc(`Users/${other}/friends/${uid}`));
      batch.update(db.doc(`Users/${uid}`), { friendsCount: FieldValue.increment(-1) });
      batch.update(db.doc(`Users/${other}`), { friendsCount: FieldValue.increment(-1) });
    }
    await batch.commit();
  }
  if (action === "report") {
    const target = await db.doc(`Users/${other}`).get();
    await db.collection("ContentReports").add({
      type: "user",
      targetPath: `Users/${other}`,
      targetUserId: other,
      reporterId: uid,
      targetPreview: String(target.get("displayName") || "").trim().slice(0, 200),
      reason: REPORT_REASONS.includes(reason) ? reason : "other",
      source: "match",
      createdAt: FieldValue.serverTimestamp(),
    });
  }
  const memberRef = db.doc(`${COL.members}/${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(memberRef);
    if (!snap.exists) return;
    const hidden = (snap.get("hidden") || []).filter((u) => u !== other);
    hidden.push(other);
    tx.update(memberRef, { hidden: hidden.slice(-HIDDEN_MAX) });
  });
  await dropCandidate(db, uid, cid);
  return { status: "ok" };
}

// ── çember → grup sohbeti ────────────────────────────────────────────────────

// Kullanıcı adı YAZILMAZ: gizlilik metni 1.8 "eşleşmede kullanıcı adınız gösterilmez" (grup kartında görünen ad + avatar).
const memberInfoOf = (data) => ({
  name: data?.displayName || "",
  username: "",
  avatarIndex: Number.isFinite(data?.avatarIndex) ? data.avatarIndex : 0,
  photoURL: data?.photoURL || null,
});

/**
 * Çembere katıl. Gece işi çemberi yalnız ÖNERİR; grup, en az `circleMin` üye "katıl" deyince kurulur
 * (mevcut `groups` şekli: CreateGroupScreen ile aynı alanlar, `source: "match"`). Kurulduktan sonra katılan
 * gruba eklenir. Katılan biri diğer katılanlardan biriyle engelliyse katılım reddedilir. Grup kurulunca diğer
 * katılanlara `match_circle` bildirimi gider. Katılmayan üyenin uid'si kimseye açılmaz.
 * @param {{ lane: "movie"|"tv", name?: string }} input name = grubun adı (istemci dilinde)
 * @returns {Promise<{ status: "waiting"|"group", joined: number, size: number, groupId: string|null }>}
 */
async function joinCircle(db, uid, { lane, name } = {}, { now = Date.now() } = {}) {
  if (!P.MATCH_LANES.includes(lane)) throw new MatchError("invalid-argument");
  const config = await readConfig(db);
  if (!config.enabled) throw new MatchError("failed-precondition", "disabled");
  const sug = await db.doc(`${COL.suggestions}/${uid}`).get();
  const key = sug.exists ? sug.get("lanes")?.[lane]?.circle?.key : null;
  if (typeof key !== "string" || !key) throw new MatchError("not-found");
  const circleRef = db.doc(`${COL.circles}/${key}`);
  const groupName = String(name || "").trim().slice(0, 40) || "Seelogd";
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(circleRef);
    const members = snap.exists ? snap.get("members") || [] : [];
    if (!members.includes(uid)) throw new MatchError("not-found");
    const joined = { ...(snap.get("joined") || {}) };
    let groupId = snap.get("groupId") || null;
    const result = (extra = {}) => ({
      status: groupId ? "group" : "waiting",
      joined: Object.keys(joined).filter((u) => members.includes(u)).length,
      size: members.length,
      groupId,
      ...extra,
    });
    if (joined[uid]) return result();
    const others = Object.keys(joined).filter((u) => members.includes(u) && u !== uid);
    const blockSnaps = await Promise.all(
      others.flatMap((o) => [tx.get(db.doc(`Users/${o}/blocked/${uid}`)), tx.get(db.doc(`Users/${uid}/blocked/${o}`))]),
    );
    if (blockSnaps.some((s) => s.exists)) throw new MatchError("failed-precondition", "blocked");
    joined[uid] = now;
    const ids = [...others, uid].sort((a, b) => joined[a] - joined[b] || (a < b ? -1 : 1));
    const [users, sugSnaps] = await Promise.all([
      Promise.all(ids.map((u) => tx.get(db.doc(`Users/${u}`)))),
      Promise.all(members.map((u) => tx.get(db.doc(`${COL.suggestions}/${u}`)))),
    ]);
    // Kurulan grup sonradan silindiyse (kurucu sildi) çember yeniden kurulabilir.
    if (groupId && !(await tx.get(db.doc(`groups/${groupId}`))).exists) groupId = null;
    const ts = FieldValue.serverTimestamp();
    let created = false;
    if (groupId) {
      tx.update(db.doc(`groups/${groupId}`), {
        members: FieldValue.arrayUnion(uid),
        [`memberInfo.${uid}`]: memberInfoOf(users[ids.indexOf(uid)].data()),
        updatedAt: ts,
      });
    } else if (ids.length >= config.server.circleMin) {
      const groupRef = db.collection("groups").doc();
      groupId = groupRef.id;
      created = true;
      tx.set(groupRef, {
        name: groupName,
        color: "#8B5CF6",
        avatarIndex: 0,
        members: ids,
        memberInfo: Object.fromEntries(ids.map((u, i) => [u, memberInfoOf(users[i].data())])),
        admins: [],
        createdBy: ids[0],
        createdAt: ts,
        updatedAt: ts,
        lastMessage: null,
        source: "match",
      });
      const me = metaOf(uid, users[ids.indexOf(uid)].data());
      for (const to of ids.filter((u) => u !== uid)) {
        tx.set(db.collection(`Users/${to}/notifications`).doc(), {
          type: "match_circle",
          source: "match",
          groupId,
          groupName,
          fromUid: uid,
          fromName: me.displayName,
          fromAvatarIndex: me.avatarIndex,
          fromPhotoURL: me.photoURL,
          read: false,
          createdAt: ts,
        });
        tx.update(db.doc(`Users/${to}`), { unreadNotifsCount: FieldValue.increment(1) });
      }
    }
    tx.set(circleRef, { joined, groupId: groupId || FieldValue.delete() }, { merge: true });
    // Üyelerin öneri belgelerinde sayaç (+ katılanlara grup kimliği) hemen güncellenir.
    sugSnaps.forEach((s, i) => {
      const circle = s.exists ? s.get("lanes")?.[lane]?.circle : null;
      if (!circle || circle.key !== key) return;
      tx.update(s.ref, { [`lanes.${lane}.circle`]: P.circleView(circle, { joined, groupId }, members[i]) });
    });
    return result({ created });
  });
}

// ── arkadaş kartı için sunucu skoru (Y2, Faz 6 kullanır) ─────────────────────

/**
 * İki ARKADAŞ da havuzdaysa kulvar başına sunucu skoru. Yapım anahtarı DÖNMEZ (arkadaşın gizli listesi sızmasın).
 * @returns {Promise<{ lanes: Record<string, object> }>}
 */
async function pairScore(db, uid, friendUid) {
  if (typeof friendUid !== "string" || !friendUid || friendUid === uid) throw new MatchError("invalid-argument");
  const [friend, a, b] = await Promise.all([
    db.doc(`Users/${uid}/friends/${friendUid}`).get(),
    db.doc(`${COL.members}/${uid}`).get(),
    db.doc(`${COL.members}/${friendUid}`).get(),
  ]);
  if (!friend.exists) throw new MatchError("permission-denied");
  if (!a.exists || !b.exists) return { lanes: {} };
  const lanes = (a.get("lanes") || []).filter((l) => (b.get("lanes") || []).includes(l));
  const out = {};
  for (const lane of lanes) {
    const [pa, pb, ctxDoc] = await Promise.all([
      db.doc(`${COL.profiles}/${uid}/built/${lane}`).get(),
      db.doc(`${COL.profiles}/${friendUid}/built/${lane}`).get(),
      db.doc(`${COL.meta}/ctx_${lane}`).get(),
    ]);
    if (!pa.exists || !pb.exists || !ctxDoc.exists) continue;
    const ctx = JSON.parse(ctxDoc.get("json") || "{}");
    const r = core.scorePair(JSON.parse(pa.get("json")), JSON.parse(pb.get("json")), ctx);
    if (!r) continue;
    const verdict = core.verdictOf(r, ctx);
    out[lane] = {
      display: verdict === "guide" ? null : r.display,
      verdict,
      common: r.common,
      E1: Math.round((r.E1 || 0) * 100) / 100,
      immature: !!r.flags.immature,
      implicitHeavy: !!r.flags.implicitHeavy,
      builtAt: pa.get("builtAt"),
    };
  }
  return { lanes: out };
}

/** TMDB ayrıntı + anahtar kelime (v4 okuma belirteci). Hata → null. */
function tmdbFetcher(apiKey, fetchImpl = fetch) {
  return async (type, id) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetchImpl(`https://api.themoviedb.org/3/${type}/${id}?append_to_response=keywords`, {
        headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
        signal: controller.signal,
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };
}

module.exports = {
  COL,
  MatchError,
  readConfig,
  ensureSalt,
  syncMember,
  removeMember,
  refreshProfile,
  loadTitleFeatures,
  runNightly,
  sendHello,
  matchAction,
  joinCircle,
  pairScore,
  tmdbFetcher,
  storableContext,
};
