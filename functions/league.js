// functions/league.js
//
// Haftalık Lig'in Firestore işleri (saf kurallar: ./leagueRules.js). db dışarıdan verilir: index.js gerçek
// Admin SDK'yı, testler emülatörü geçirir. Zaman damgaları düz ms sayısıdır (istemci doğrudan karşılaştırır).
//
// VERİ (hepsini yalnız sunucu yazar — firestore.rules):
//   LeagueUsers/{uid}                    { tier, week, groupId, xp, xpAt, todayKey, counts, refs, lastResult, updatedAt }
//                                        sahibi okur. refs/counts yalnız XP tavanı ve tekrar engeli için.
//   LeagueWeeks/{hafta}/open/{lig}       { groupId, size, count } — o ligin şu an doldurulan grubu (istemciye kapalı)
//   LeagueWeeks/{hafta}/groups/{grup}    { tier, week, size, settled, createdAt, settledAt? } — oturum açan okur
//     └─ leagueMembers/{uid}             { uid, xp, xpAt, tier, *Snapshot kimlik alanları, updatedAt } — oturum açan okur
//
// HAFTA DÖNÜMÜ iki yoldan, AYNI saf hesapla (settleGroup) yapılır:
//   • Oyuncu yeni haftada ilk XP'sini kazanırken geçen haftası henüz sonuçlanmamışsa bu çağrı onu sonuçlandırır
//     (pazartesi 00:01'de oynayan eski liginde yeni gruba girmesin).
//   • settleLeagueWeek (pazartesi 00:10) kalan herkesi sonuçlandırır; yeni haftaya geçmiş ya da sonucu yazılmış
//     oyuncuyu atlar. Geçmiş haftanın grupları artık yazılmadığı için iki yol aynı sonucu bulur.

const {
  GROUP_SIZE,
  TIERS,
  awardDecision,
  clampTier,
  freshWeek,
  groupIdOf,
  settleGroup,
  weekIdOf,
} = require("./leagueRules");

const userPath = (uid) => `LeagueUsers/${uid}`;
const groupPath = (week, groupId) => `LeagueWeeks/${week}/groups/${groupId}`;
const membersPath = (week, groupId) => `${groupPath(week, groupId)}/leagueMembers`;

const resultOf = (week, row) => ({
  week,
  fromTier: row.fromTier,
  toTier: row.toTier,
  outcome: row.outcome,
  rank: row.rank,
  size: row.size,
  xp: row.xp,
});

/** İstemciye dönen özet (refs/counts gibi iç alanlar YOK). */
const summaryOf = (state) => ({
  tier: clampTier(state.tier),
  week: state.week || null,
  groupId: state.groupId || null,
  xp: Number(state.xp) || 0,
  lastResult: state.lastResult || null,
});

/** Oy kaynağı: ref gerçek bir oy belgesine karşılık geliyor mu (Günün Sorusu / Top 100). */
async function voteExists(db, uid, ref) {
  const poll = /^poll:(\d{4}-\d{2}-\d{2})$/.exec(ref);
  const hype = /^top100:((movie|tv)_\d+)$/.exec(ref);
  const path = poll ? `DailyPolls/${poll[1]}/votes/${uid}` : hype ? `Top100Hype/${hype[1]}/votes/${uid}` : null;
  if (!path) return false;
  return (await db.doc(path).get()).exists;
}

/**
 * Tek olayın XP'sini işler (tek transaction).
 * @param {{ uid: string, source: string, ref: string, nowMs?: number, identity?: object }} p
 *   identity: functions/profileIdentity normalizeIdentity çıktısı (Users/{uid}'den, istemciden DEĞİL)
 * @returns {Promise<{ awarded: number, reason: string|null, settled: object|null } & ReturnType<typeof summaryOf>>}
 */
async function awardXp(db, { uid, source, ref, nowMs = Date.now(), identity = {} }) {
  const userRef = db.doc(userPath(uid));
  return db.runTransaction(async (tx) => {
    // ── OKUMALAR (Firestore transaction'da tüm okumalar yazmalardan önce) ──
    const snap = await tx.get(userRef);
    const stored = snap.exists ? snap.data() || {} : {};
    const week = weekIdOf(nowMs);
    let tier = clampTier(stored.tier);
    let lastResult = stored.lastResult || null;
    let settled = null;

    if (stored.week && stored.week !== week && stored.groupId && lastResult?.week !== stored.week) {
      const members = await tx.get(db.collection(membersPath(stored.week, stored.groupId)));
      const mine = settleGroup(tier, members.docs.map((d) => d.data())).find((row) => row.uid === uid);
      if (mine) {
        tier = mine.toTier;
        lastResult = resultOf(stored.week, mine);
        settled = lastResult;
      }
    }

    const decision = awardDecision(stored, { source, ref, nowMs });
    if (!decision.ok) {
      if (settled) {
        tx.set(userRef, { ...freshWeek(week), tier, lastResult, updatedAt: nowMs }, { merge: true });
      }
      const state = settled ? { ...freshWeek(week), tier, lastResult } : { ...stored, tier, lastResult };
      return { awarded: 0, reason: decision.reason, settled, ...summaryOf(state) };
    }

    const next = decision.next;
    let groupId = next.groupId;
    let openRef = null;
    let open = null;
    if (!groupId) {
      openRef = db.doc(`LeagueWeeks/${week}/open/${TIERS[tier]}`);
      const openSnap = await tx.get(openRef);
      open = openSnap.exists ? openSnap.data() || {} : {};
    }

    // ── YAZMALAR ──
    if (!groupId) {
      const size = Math.max(0, Math.trunc(Number(open.size)) || 0);
      if (open.groupId && size < GROUP_SIZE) {
        groupId = open.groupId;
        tx.set(openRef, { size: size + 1 }, { merge: true });
        tx.set(db.doc(groupPath(week, groupId)), { size: size + 1 }, { merge: true });
      } else {
        const count = (Math.trunc(Number(open.count)) || 0) + 1;
        groupId = groupIdOf(tier, count);
        tx.set(openRef, { groupId, size: 1, count });
        tx.set(db.doc(groupPath(week, groupId)), { tier, week, size: 1, settled: false, createdAt: nowMs });
      }
    }

    tx.set(
      db.doc(`${membersPath(week, groupId)}/${uid}`),
      {
        uid,
        xp: next.xp,
        xpAt: nowMs,
        tier,
        displayNameSnapshot: identity.displayName || null,
        usernameSnapshot: identity.username || null,
        avatarIndexSnapshot: typeof identity.avatarIndex === "number" ? identity.avatarIndex : null,
        photoURLSnapshot: identity.photoURL || null,
        updatedAt: nowMs,
      },
      { merge: true },
    );
    const state = { ...next, groupId, tier, lastResult };
    tx.set(userRef, { ...state, updatedAt: nowMs });
    return { awarded: decision.xp, reason: null, settled, ...summaryOf(state) };
  });
}

/** Bir grubu sonuçlandırır (bir kez). @returns {Promise<number>} lig/sonuç yazılan oyuncu sayısı */
async function settleGroupDoc(db, week, groupRef, nowMs = Date.now()) {
  return db.runTransaction(async (tx) => {
    const group = await tx.get(groupRef);
    if (!group.exists || group.data()?.settled) return 0;
    const members = await tx.get(groupRef.collection("leagueMembers"));
    const rows = settleGroup(group.data()?.tier, members.docs.map((d) => d.data()));
    const userRefs = rows.map((row) => db.doc(userPath(row.uid)));
    const users = userRefs.length ? await tx.getAll(...userRefs) : [];
    let written = 0;
    rows.forEach((row, index) => {
      const user = users[index];
      const data = user?.exists ? user.data() || {} : null;
      // Yeni haftaya geçmiş (çağrı yolu sonuçlandırdı) ya da sonucu zaten yazılmış oyuncu atlanır.
      if (!data || data.week !== week || data.lastResult?.week === week) return;
      tx.set(user.ref, { tier: row.toTier, lastResult: resultOf(week, row), updatedAt: nowMs }, { merge: true });
      written += 1;
    });
    tx.update(groupRef, { settled: true, settledAt: nowMs });
    return written;
  });
}

/** Haftanın sonuçlanmamış tüm gruplarını sonuçlandırır. */
async function settleWeek(db, week, nowMs = Date.now()) {
  let groups = 0;
  let players = 0;
  for (;;) {
    const snap = await db.collection(`LeagueWeeks/${week}/groups`).where("settled", "==", false).limit(200).get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      players += await settleGroupDoc(db, week, doc.ref, nowMs);
      groups += 1;
    }
  }
  return { groups, players };
}

module.exports = { awardXp, settleGroupDoc, settleWeek, voteExists, resultOf, summaryOf };
