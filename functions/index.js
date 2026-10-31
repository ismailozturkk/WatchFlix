// functions/index.js
//
// Seelogd push bildirim sunucusu (Cloud Functions v2 + Expo Push API).
//
// Akış:
//   1) İstemci bir sosyal bildirim yazınca → Users/{uid}/notifications/{notifId}
//      dökümanı oluşur (alıcı = path'teki {uid}).
//   2) Bu trigger tetiklenir; alıcının Users/{uid} dökümanından Expo push
//      token(lar)ını okur.
//   3) Expo Push API'ye gönderir (uygulama kapalı/arka planda olsa bile bildirim).
//   4) "DeviceNotRegistered" dönen ölü token'ları kullanıcı dökümanından temizler.
//
// NOT: Cihazdaki tür-bazlı bildirim ayarları (postLikesEnabled vb.) AsyncStorage'da
// tutulur → sunucu göremez. Bu yüzden arka plan push TÜM sosyal türler için gider.
// Tür bazlı kontrolü arka planda da istersen, ayarları Firestore'a (ör.
// Users/{uid}.notificationSettings) yansıtmamız gerekir (bkz. README altındaki not).

const {
  onDocumentCreated,
  onDocumentDeleted,
  onDocumentUpdated,
  onDocumentWritten,
} = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const {
  resolveAiPlan,
  getAiPlanLimits,
  readAiUsage,
  buildAiQuota,
} = require("./aiQuota");
const aiProxy = require("./aiProxy");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
// firebase-admin v14: eski namespaced API (admin.firestore()) KALDIRILDI —
// modüler girişler kullanılır (firebase-admin/app + firebase-admin/firestore).
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue, Timestamp } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");
const { Expo } = require("expo-server-sdk");
const { createHash, randomInt, timingSafeEqual } = require("node:crypto");
const { extractRegionProviders, computeNewlyAvailable } = require("./streamingDiff");
const externalRatings = require("./externalRatings");
const weeklyDigest = require("./weeklyDigest");
const tournamentBracket = require("./tournamentBracket");
const {
  buildProfileIdentityChanges,
  mappedPatch,
  hasPatch,
} = require("./profileIdentity");
const {
  LEGACY_PUBLIC_ENTITLEMENT_FIELDS,
  buildEntitlementDocuments,
  getTransferChanges,
  parseRevenueCatPremiumState,
  resolveFirebaseUserId,
  resolvePremiumWebhookState,
} = require("./revenueCatWebhook");
const {
  getStreamingAlertLimit,
  pickTrackedTitles,
  resolvePremiumPlan,
} = require("./planCapabilities");
const {
  revokeAppleAuthorizationCode,
  verifyAppleIdentityToken,
} = require("./appleAuth");
const { createSocialPush } = require("./socialPush");
const { sendExpoPushes } = require("./expoSend");
const referral = require("./referral");
const userSearch = require("./userSearch");
const { CAPACITY } = require("./capacity");
const { purgeAccountData, PURGE_PHASES } = require("./accountPurge");
const functionsV1 = require("firebase-functions/v1");

initializeApp();
const db = getFirestore();
const expo = new Expo();
// RTDB'ye erişim yalnızca "alıcı zaten bu sohbeti ekranda açık tutuyor mu"
// kontrolü için (bkz. onSocialNotificationCreated) — RTDB yoksa (proje
// database.rules.json'suz kurulmuşsa) null kalır, kontrol sessizce atlanır.
let rtdb = null;
try {
  rtdb = getDatabase();
} catch (e) {
  console.warn("RTDB başlatılamadı (inChat kontrolü atlanacak):", e.message);
}

// Yedek tavan: her fonksiyon kendi tavanını CAPACITY'den açıkça seçer (gerekçe capacity.js).
setGlobalOptions({ maxInstances: 10 });

// Google native SDK'nin idToken'i bu web OAuth client'i icin uretilir.
// Istemcideki googleAuthService WEB_CLIENT_ID ile ayni kalmali.
const GOOGLE_WEB_CLIENT_ID =
  "427087836931-in7lreg3vjgnvudn5h8gauradaeo58kc.apps.googleusercontent.com";
const APPLE_CLIENT_ID = "com.smlztrk.seelogd";
const APPLE_TEAM_ID = "KN77DDXC9U";

// RevenueCat Dashboard > Integrations > Webhooks ekranındaki Authorization
// header ile aynı olmalı. Public SDK anahtarı değildir.
const REVENUECAT_WEBHOOK_AUTH = defineSecret("REVENUECAT_WEBHOOK_AUTH");
const REVENUECAT_SECRET_API_KEY = defineSecret("REVENUECAT_SECRET_API_KEY");
const APPLE_SIGN_IN_KEY_ID = defineSecret("APPLE_SIGN_IN_KEY_ID");
const APPLE_SIGN_IN_PRIVATE_KEY = defineSecret("APPLE_SIGN_IN_PRIVATE_KEY");

function webhookAuthorizationMatches(received, expected) {
  if (!received || !expected) return false;
  const normalized = received.startsWith("Bearer ")
    ? received.slice("Bearer ".length)
    : received;
  const left = Buffer.from(normalized);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function fetchRevenueCatPremiumState(uid) {
  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`,
    {
      headers: {
        Authorization: `Bearer ${REVENUECAT_SECRET_API_KEY.value()}`,
        Accept: "application/json",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`RevenueCat customer lookup failed: ${response.status}`);
  }
  return parseRevenueCatPremiumState(await response.json());
}

/**
 * Abonelik durumunu iki belgeye yazar (bkz. buildEntitlementDocuments):
 * herkese açık profil belgesinde yalnız plan, ayrıntılar sahibine özel
 * Users/{uid}/private/entitlements'ta. `writer` bir transaction veya batch.
 */
// ETKİN PLAN = max(RevenueCat durumu, süren ücretsiz-ay promosyonu). Promosyon
// (`promoUntil`) mağaza aboneliği değildir ama webhook bu belgeyi her olayda
// yeniden yazar; promosyonu burada birleştirmezsek ilk olayda silinirdi.
//   • `currentEntitlements`: kullanıcı belgesindeki mevcut alan (promoUntil buradan).
//   • `promoUntilMs`: verilirse promosyon bitişi bu değerle DEĞİŞTİRİLİR (kod/ödül).
//   • `promoPlan`: o promosyonun verdiği plan ("premium" | "unlimited" = Max); yoksa "premium".
//     Plan, bitişle birlikte `entitlements.promoPlan` olarak saklanır; webhook'un her yeniden
//     yazışında `currentEntitlements`tan okunur (saklanmazsa Max kod ilk olayda Premium'a düşerdi).
function writeEntitlements(
  writer,
  uid,
  state,
  { store, source, extraPrivate, currentEntitlements, promoUntilMs, promoPlan } = {},
) {
  const nowMs = Date.now();
  const promo = Number.isFinite(promoUntilMs)
    ? { untilMs: promoUntilMs, plan: referral.normalizePromoPlan(promoPlan) }
    : referral.readPromo(currentEntitlements, nowMs);
  const applied = referral.applyPromoToState(state, promo, nowMs);
  const effectiveSource = applied.source || source || "revenuecat";
  const { publicEntitlements, privateEntitlements } = buildEntitlementDocuments(
    applied.state,
    { store: applied.source ? null : store, source: effectiveSource },
  );
  // Promosyon gerçek bir mağaza aboneliğinin ÜSTÜNE çıktıysa abonelik izi silinmez:
  // "abone mi / daha önce satın aldı mı" kapıları (referral.hasActiveStoreSubscription,
  // redeemCode) bunlara bakar. `state` burada promosyon uygulanmamış RevenueCat durumu.
  const storeSubscribed = Boolean(state.premium);
  if (applied.source && storeSubscribed) {
    privateEntitlements.productId = state.productId || null;
    privateEntitlements.store = store || state.store || null;
  }
  const legacyCleanup = Object.fromEntries(
    LEGACY_PUBLIC_ENTITLEMENT_FIELDS.map((field) => [field, FieldValue.delete()]),
  );
  // Süren promosyon korunur; dolmuş olan temizlenir (saatlik süpürme de aynısını yapar).
  const promoField = !promo
    ? {}
    : promo.untilMs > nowMs
      ? { promoUntil: Timestamp.fromMillis(promo.untilMs), promoPlan: promo.plan }
      : { promoUntil: FieldValue.delete(), promoPlan: FieldValue.delete() };
  writer.set(
    db.doc(`Users/${uid}`),
    {
      entitlements: {
        ...publicEntitlements,
        storeSubscribed,
        ...legacyCleanup,
        ...promoField,
        premiumSyncedAt: FieldValue.serverTimestamp(),
      },
    },
    { merge: true },
  );
  writer.set(
    db.doc(`Users/${uid}/private/entitlements`),
    {
      ...privateEntitlements,
      ...extraPrivate,
      syncedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/**
 * Webhook transaction'ının OKUMA aşaması: her değişen kullanıcı için davet
 * kaydını (ve gerekirse davet edenin hesabını) okuyup ne yazılacağını hesaplar.
 * Yazmalar `applyReferralUpdate` ile, tüm okumalar bittikten sonra yapılır.
 */
async function planReferralUpdates(tx, changes, userSnaps, event) {
  if (!referral.isSubscriptionStartEvent(event)) return [];
  const plans = [];
  for (let index = 0; index < changes.length; index += 1) {
    const { uid, state } = changes[index];
    if (!userSnaps[index].exists || !state.premium) continue;
    const referralRef = db.doc(`Referrals/${uid}`);
    const referralSnap = await tx.get(referralRef);
    if (!referralSnap.exists) continue;
    const record = referralSnap.data();
    const inviterRef = db.doc(`ReferralAccounts/${record.inviterUid}`);
    const inviterSnap = await tx.get(inviterRef);
    const update = referral.planReferralUpdate({
      referral: {
        inviterUid: record.inviterUid,
        subscribedAt: record.subscribedAt?.toMillis?.() || null,
        rewardedAt: record.rewardedAt?.toMillis?.() || null,
      },
      event,
      inviterEarnedMonths: inviterSnap.get("earnedMonths") || 0,
      nowMs: Date.now(),
    });
    if (update) plans.push({ ...update, referralRef, inviterRef });
  }
  return plans;
}

function applyReferralUpdate(tx, { patch, reward, capped, referralRef, inviterRef }) {
  const fields = {};
  if (patch.subscribedAt) fields.subscribedAt = Timestamp.fromMillis(patch.subscribedAt);
  if (patch.rewardedAt) fields.rewardedAt = Timestamp.fromMillis(patch.rewardedAt);
  if (capped) fields.rewardCapped = true;
  tx.set(referralRef, fields, { merge: true });
  if (reward) {
    tx.set(
      inviterRef,
      {
        creditMonths: FieldValue.increment(1),
        earnedMonths: FieldValue.increment(1),
      },
      { merge: true },
    );
  }
}

exports.revenueCatWebhook = onRequest(
  {
    ...CAPACITY.upstream,
    secrets: [REVENUECAT_WEBHOOK_AUTH, REVENUECAT_SECRET_API_KEY],
    cors: false,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.set("Allow", "POST").status(405).send("Method Not Allowed");
      return;
    }

    if (
      !webhookAuthorizationMatches(
        req.get("authorization"),
        REVENUECAT_WEBHOOK_AUTH.value(),
      )
    ) {
      res.status(401).send("Unauthorized");
      return;
    }

    const event = req.body?.event;
    if (!event?.id || !event?.type) {
      res.status(400).send("Invalid RevenueCat event");
      return;
    }

    const transferChanges = getTransferChanges(event);
    const premiumState = resolvePremiumWebhookState(event);
    const firebaseUserId = resolveFirebaseUserId(event);
    const candidateChanges = transferChanges.length
      ? transferChanges
      : premiumState !== null && firebaseUserId
        ? [{ uid: firebaseUserId, premium: premiumState }]
        : [];

    if (candidateChanges.length === 0) {
      res.status(200).json({ received: true, ignored: true });
      return;
    }

    // Webhook türü tek başına yeterli değildir: CANCELLATION bir dönem
    // sonu iptali veya anında refund olabilir; birden fazla ürün de aynı
    // entitlement'ı açabilir. RevenueCat Customer Info'yu server-to-server
    // okuyarak webhook anındaki gerçek aktif durumu tek kaynak kabul et.
    const changes = await Promise.all(
      candidateChanges.map(async ({ uid, premium }) => ({
        uid,
        state:
          transferChanges.length && premium === false
            ? {
                premium: false,
                premiumUnlimited: false,
                premiumPlan: "free",
                productId: null,
                expiresAt: null,
              }
            : await fetchRevenueCatPremiumState(uid),
      })),
    );

    // Event ID'yi path'e doğrudan koyma; beklenmedik '/' karakteri doküman
    // yolunu bozmasın. Transaction event tekrarını ve entitlement yazımını
    // atomik tutar: yarıda kalan webhook "işlendi" diye kaybolmaz.
    const eventKey = createHash("sha256").update(String(event.id)).digest("hex");
    const eventRef = db.doc(`RevenueCatWebhookEvents/${eventKey}`);
    let duplicate = false;

    await db.runTransaction(async (tx) => {
      const eventSnap = await tx.get(eventRef);
      if (eventSnap.exists) {
        duplicate = true;
        return;
      }
      // Silinmiş hesaba gecikmeli gelen olay (ör. EXPIRATION) sahipsiz bir
      // Users belgesi YARATMASIN. Satın alma yalnız profil tamamlandıktan
      // sonra mümkün (PremiumContext), yani gerçek kullanıcıda belge vardır.
      const userSnaps = await Promise.all(
        changes.map((change) => tx.get(db.doc(`Users/${change.uid}`))),
      );

      // Arkadaş daveti: satın alan davetliyse "abone oldu" işaretlenir ve ilk
      // ücretli dönemde davet edene ücretsiz ay yazılır. Transaction içinde:
      // webhook yeniden denenirse ödül ikinci kez verilmez (rewardedAt).
      const referralPlans = transferChanges.length
        ? []
        : await planReferralUpdates(tx, changes, userSnaps, event);

      changes.forEach((change, index) => {
        if (!userSnaps[index].exists) return;
        writeEntitlements(tx, change.uid, change.state, {
          store: event.store || null,
          source: "revenuecat",
          currentEntitlements: userSnaps[index].get("entitlements"),
        });
      });
      referralPlans.forEach((plan) => applyReferralUpdate(tx, plan));
      tx.create(eventRef, {
        eventId: String(event.id),
        type: event.type,
        appUserId: event.app_user_id || null,
        processedAt: FieldValue.serverTimestamp(),
      });
    });

    res.status(200).json({ received: true, duplicate });
  },
);

// Tek kullanıcının RevenueCat okuma sıklığı: istemci ayrışma görünce çağırır;
// kötü niyetli döngü RevenueCat REST kotasını tüketemesin.
const PREMIUM_SYNC_MIN_INTERVAL_MS = 15 * 1000;

/**
 * İstemci planı ile sunucu planı ayrıştığında (satın alma webhook'tan önce
 * geldi, webhook kaçtı, iade oldu) sunucuyu RevenueCat'ten yeniden okutur.
 * İstemcinin iddia ettiği plan KULLANILMAZ: RevenueCat Customer Info tek
 * kaynaktır. Böylece satın alan kullanıcı AI kotası gibi sunucu kapılarında
 * yeni planını webhook'u beklemeden görür.
 */
exports.syncPremiumStatus = onCall(
  { ...CAPACITY.upstream, secrets: [REVENUECAT_SECRET_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign-in required");
    }
    const uid = request.auth.uid;
    const userRef = db.doc(`Users/${uid}`);
    const privateRef = db.doc(`Users/${uid}/private/entitlements`);

    const [userSnap, privateSnap] = await Promise.all([
      userRef.get(),
      privateRef.get(),
    ]);
    if (!userSnap.exists) {
      // Profil tamamlanmadan satın alma yok; sahipsiz belge de yaratma.
      throw new HttpsError("failed-precondition", "Profile required");
    }

    const lastSync = privateSnap.get("manualSyncAt")?.toMillis?.() || 0;
    if (Date.now() - lastSync < PREMIUM_SYNC_MIN_INTERVAL_MS) {
      return {
        plan: resolvePremiumPlan(userSnap.get("entitlements")),
        throttled: true,
      };
    }

    let state;
    try {
      state = await fetchRevenueCatPremiumState(uid);
    } catch (error) {
      console.warn(`[syncPremiumStatus] uid=${uid}:`, error?.message);
      throw new HttpsError("unavailable", "Subscription status unavailable");
    }

    const batch = db.batch();
    writeEntitlements(batch, uid, state, {
      source: "revenuecat_sync",
      extraPrivate: { manualSyncAt: FieldValue.serverTimestamp() },
      currentEntitlements: userSnap.get("entitlements"),
    });
    await batch.commit();
    return { plan: state.premiumPlan, throttled: false };
  },
);

// ─── Arkadaş daveti + promosyon kodu ─────────────────────────────────────────
// Kurallar functions/referral.js'te; burada yalnız Firestore bağlantısı var.
// Tüm belgeler (ReferralCodes, ReferralAccounts, Referrals, PromoCodes) yalnız
// Admin SDK'ya açıktır (firestore.rules): kod uydurma ve ödül yazma istemciden
// mümkün değil.

const FREE_PLAN_STATE = Object.freeze({
  premium: false,
  premiumUnlimited: false,
  premiumPlan: "free",
  productId: null,
  expiresAt: null,
});

function referralFailure(reason) {
  const code =
    reason === referral.REASONS.NOT_FOUND
      ? "not-found"
      : reason === referral.REASONS.RATE_LIMITED
        ? "resource-exhausted"
        : "failed-precondition";
  return new HttpsError(code, reason, { reason });
}

function dayKeyUtc(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Kullanıcının davet kodu; yoksa çakışmasız üretip kaydeder. */
async function ensureReferralCode(uid) {
  const accountRef = db.doc(`ReferralAccounts/${uid}`);
  const existing = (await accountRef.get()).get("code");
  if (existing) return existing;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = referral.generateReferralCode(randomInt);
    const codeRef = db.doc(`ReferralCodes/${code}`);
    const result = await db.runTransaction(async (tx) => {
      const [accountSnap, codeSnap] = await Promise.all([
        tx.get(accountRef),
        tx.get(codeRef),
      ]);
      if (accountSnap.get("code")) return accountSnap.get("code");
      if (codeSnap.exists) return null; // çakışma: yeni kod dene
      tx.create(codeRef, { ownerUid: uid, createdAt: FieldValue.serverTimestamp() });
      tx.set(
        accountRef,
        { code, createdAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
      return code;
    });
    if (result) return result;
  }
  throw new HttpsError("internal", "Could not allocate a referral code");
}

function profileSummary(snap) {
  if (!snap?.exists) return null;
  const data = snap.data();
  return {
    uid: snap.id,
    name: data.displayName || data.username || "",
    username: data.username || "",
    avatarIndex: typeof data.avatarIndex === "number" ? data.avatarIndex : 0,
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
  };
}

/**
 * Davet ekranının tüm verisi: kodum, davet ettiklerim (kayıtlı / abone / ödül),
 * kazandığım ücretsiz aylar ve BEN davetle geldiysem ilk ay indirimim.
 */
exports.getReferralOverview = onCall(CAPACITY.light, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required");
  const uid = request.auth.uid;
  const userSnap = await db.doc(`Users/${uid}`).get();
  if (!userSnap.exists) throw new HttpsError("failed-precondition", "Profile required");

  const code = await ensureReferralCode(uid);
  const nowMs = Date.now();
  const [accountSnap, inviteesSnap, ownReferralSnap] = await Promise.all([
    db.doc(`ReferralAccounts/${uid}`).get(),
    db.collection("Referrals").where("inviterUid", "==", uid).limit(200).get(),
    db.doc(`Referrals/${uid}`).get(),
  ]);

  const inviteeRefs = inviteesSnap.docs.map((doc) => db.doc(`Users/${doc.id}`));
  const ownInviterRef = ownReferralSnap.exists
    ? db.doc(`Users/${ownReferralSnap.get("inviterUid")}`)
    : null;
  const profileSnaps = inviteeRefs.length || ownInviterRef
    ? await db.getAll(...inviteeRefs, ...(ownInviterRef ? [ownInviterRef] : []))
    : [];

  const invitees = inviteesSnap.docs
    .map((doc, index) => {
      const profile = profileSummary(profileSnaps[index]);
      if (!profile) return null; // hesabı silinmiş davetli listede görünmez
      const data = doc.data();
      return {
        ...profile,
        status: referral.inviteeStatus({
          subscribedAt: data.subscribedAt,
          rewardedAt: data.rewardedAt,
        }),
        joinedAtMs: data.createdAt?.toMillis?.() || null,
        subscribedAtMs: data.subscribedAt?.toMillis?.() || null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (b.joinedAtMs || 0) - (a.joinedAtMs || 0));

  const counts = { registered: 0, subscribed: 0, rewarded: 0 };
  invitees.forEach((item) => {
    counts.registered += 1;
    if (item.status !== "registered") counts.subscribed += 1;
    if (item.status === "rewarded") counts.rewarded += 1;
  });

  const entitlements = userSnap.get("entitlements");
  const promo = referral.readPromo(entitlements, nowMs);
  const inviterProfile = ownInviterRef
    ? profileSummary(profileSnaps[profileSnaps.length - 1])
    : null;

  return {
    code,
    displayCode: referral.formatCodeForDisplay(code),
    creditMonths: accountSnap.get("creditMonths") || 0,
    earnedMonths: accountSnap.get("earnedMonths") || 0,
    maxMonths: referral.REFERRAL.MAX_REWARD_MONTHS,
    rewardDays: referral.REFERRAL.REWARD_DAYS,
    promoUntilMs: promo?.active ? promo.untilMs : null,
    storeSubscribed: referral.hasActiveStoreSubscription(entitlements),
    invitees,
    counts,
    // Ben davetle geldiysem: kimin kodu + ilk ay indirimim hâlâ geçerli mi.
    invitedBy: ownReferralSnap.exists
      ? {
          name: inviterProfile?.name || "",
          discount: referral.inviteeDiscountFor({
            subscribedAt: ownReferralSnap.get("subscribedAt"),
          }),
        }
      : null,
    limits: {
      discountPercent: referral.REFERRAL.INVITEE_DISCOUNT_PERCENT,
      offerId: referral.REFERRAL.INVITEE_OFFER_ID,
      windowDays: referral.REFERRAL.REDEEM_WINDOW_DAYS,
    },
  };
});

/**
 * Tek kod alanı: promosyon kodu (yönetici üretir, N kişiyle sınırlı, 1 ay ücretsiz)
 * ya da bir arkadaşın davet kodu (ilk ay indirimi) kabul edilir.
 * Hepsi tek transaction'da: sayaç, kullanım kaydı ve plan birlikte yazılır.
 */
exports.redeemCode = onCall(CAPACITY.light, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required");
  const uid = request.auth.uid;
  const code = referral.normalizeCode(request.data?.code);
  if (!code) throw referralFailure(referral.REASONS.NOT_FOUND);

  // Kayıt tarihi davet kodunun 14 günlük penceresi için şart: okunamazsa kod
  // denetimsiz kabul edilmez (eskiden pencere atlanıyordu), kullanıcı tekrar dener.
  let accountCreatedMs = null;
  try {
    const record = await getAuth().getUser(uid);
    const created = Date.parse(record.metadata?.creationTime || "");
    if (Number.isFinite(created)) accountCreatedMs = created;
  } catch (error) {
    console.warn(`[redeemCode] auth lookup failed uid=${uid}:`, error?.message);
    throw new HttpsError("unavailable", "Account lookup failed, try again");
  }

  const nowMs = Date.now();
  const userRef = db.doc(`Users/${uid}`);
  const accountRef = db.doc(`ReferralAccounts/${uid}`);
  const privateEntRef = db.doc(`Users/${uid}/private/entitlements`);
  const promoRef = db.doc(`PromoCodes/${code}`);
  const redemptionRef = db.doc(`PromoCodes/${code}/redemptions/${uid}`);
  const referralCodeRef = db.doc(`ReferralCodes/${code}`);
  const ownReferralRef = db.doc(`Referrals/${uid}`);

  const outcome = await db.runTransaction(async (tx) => {
    const [
      userSnap,
      accountSnap,
      privateEntSnap,
      promoSnap,
      redemptionSnap,
      referralCodeSnap,
      ownReferralSnap,
    ] = await Promise.all([
      tx.get(userRef),
      tx.get(accountRef),
      tx.get(privateEntRef),
      tx.get(promoRef),
      tx.get(redemptionRef),
      tx.get(referralCodeRef),
      tx.get(ownReferralRef),
    ]);
    if (!userSnap.exists) return { fail: "profile-required" };

    const budget = referral.checkAttemptBudget(
      accountSnap.get("attempts"),
      dayKeyUtc(nowMs),
    );
    if (!budget.allowed) return { fail: referral.REASONS.RATE_LIMITED };
    // Başarısızlıkta sayaç işlenir; başarıda dokunulmaz.
    const failWith = (reason) => {
      tx.set(accountRef, { attempts: budget.next }, { merge: true });
      return { fail: reason };
    };

    const entitlements = userSnap.get("entitlements");

    if (promoSnap.exists) {
      const verdict = referral.evaluatePromoCode(promoSnap.data(), nowMs);
      if (!verdict.ok) return failWith(verdict.reason);
      // Hesap başına TEK promosyon kodu: kodlar tek tek harcanıp yığılmasın.
      if (redemptionSnap.exists || accountSnap.get("promoRedeemedCode")) {
        return failWith(referral.REASONS.ALREADY_REDEEMED);
      }
      if (referral.hasActiveStoreSubscription(entitlements)) {
        return failWith(referral.REASONS.STORE_SUBSCRIBED);
      }
      const days = Number.isFinite(promoSnap.get("days"))
        ? promoSnap.get("days")
        : referral.PROMO_DEFAULT_DAYS;
      const currentUntil = referral.readPromo(entitlements, nowMs);
      const untilMs = referral.extendPromoUntil(currentUntil?.untilMs, nowMs, days);
      // Kodun planı (Premium ya da Max). Hesapta zaten süren daha yüksek bir promosyon varsa
      // o korunur (ör. Max kodu olan biri davet ödülünü başlatınca Premium'a düşmez).
      const plan = referral.higherPromoPlan(
        promoSnap.get("plan"),
        currentUntil?.active ? currentUntil.plan : null,
      );

      tx.update(promoRef, { redeemedCount: FieldValue.increment(1) });
      tx.create(redemptionRef, { redeemedAt: FieldValue.serverTimestamp() });
      tx.set(accountRef, { promoRedeemedCode: code }, { merge: true });
      writeEntitlements(tx, uid, FREE_PLAN_STATE, {
        source: "promo",
        currentEntitlements: entitlements,
        promoUntilMs: untilMs,
        promoPlan: plan,
      });
      return { kind: "promo", days, untilMs };
    }

    if (referralCodeSnap.exists) {
      const ownerUid = referralCodeSnap.get("ownerUid");
      const verdict = referral.evaluateReferralRedemption({
        ownerUid,
        redeemerUid: uid,
        existingReferral: ownReferralSnap.exists ? ownReferralSnap.data() : null,
        accountCreatedMs,
        nowMs,
        purchased: Boolean(privateEntSnap.get("productId")),
        storeSubscribed: referral.hasActiveStoreSubscription(entitlements),
      });
      if (!verdict.ok) return failWith(verdict.reason);
      tx.create(ownReferralRef, {
        inviterUid: ownerUid,
        code,
        createdAt: FieldValue.serverTimestamp(),
        subscribedAt: null,
        rewardedAt: null,
      });
      return { kind: "referral", ownerUid };
    }

    return failWith(referral.REASONS.NOT_FOUND);
  });

  if (outcome.fail === "profile-required") {
    throw new HttpsError("failed-precondition", "Profile required");
  }
  if (outcome.fail) throw referralFailure(outcome.fail);

  if (outcome.kind === "promo") {
    return { kind: "promo", days: outcome.days, untilMs: outcome.untilMs };
  }
  const ownerSnap = await db.doc(`Users/${outcome.ownerUid}`).get();
  return {
    kind: "referral",
    inviterName: profileSummary(ownerSnap)?.name || "",
    discount: referral.inviteeDiscountFor({}),
  };
});

/** Birikmiş davet ödülünü (1 ay) başlatır. Mağaza aboneliği sürerken başlatılamaz. */
exports.claimReferralReward = onCall(CAPACITY.light, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required");
  const uid = request.auth.uid;
  const userRef = db.doc(`Users/${uid}`);
  const accountRef = db.doc(`ReferralAccounts/${uid}`);

  const untilMs = await db.runTransaction(async (tx) => {
    const [userSnap, accountSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(accountRef),
    ]);
    if (!userSnap.exists) throw new HttpsError("failed-precondition", "Profile required");
    if ((accountSnap.get("creditMonths") || 0) < 1) {
      throw referralFailure(referral.REASONS.NO_CREDIT);
    }
    const entitlements = userSnap.get("entitlements");
    if (referral.hasActiveStoreSubscription(entitlements)) {
      throw referralFailure(referral.REASONS.STORE_SUBSCRIBED);
    }
    const nowMs = Date.now();
    const current = referral.readPromo(entitlements, nowMs);
    const next = referral.extendPromoUntil(
      current?.untilMs,
      nowMs,
      referral.REFERRAL.REWARD_DAYS,
    );
    tx.set(accountRef, { creditMonths: FieldValue.increment(-1) }, { merge: true });
    writeEntitlements(tx, uid, FREE_PLAN_STATE, {
      source: "promo",
      currentEntitlements: entitlements,
      promoUntilMs: next,
      // Davet ödülü Premium verir; hesapta süren Max promosyonu varsa o korunur.
      promoPlan: current?.active ? current.plan : referral.PROMO_PLAN,
    });
    return next;
  });
  return { untilMs };
});

/**
 * Süresi dolan ücretsiz ayları temizler: etkin plan RevenueCat'in gerçek
 * durumuna döner (arada abone olduysa abone kalır). İstemci süreyi kendisi de
 * kontrol eder; bu süpürme sunucu kapılarını (kurallar, AI kotası) düzeltir.
 */
exports.expirePromoGrants = onSchedule(
  {
    ...CAPACITY.singleton,
    schedule: "every 60 minutes",
    timeZone: "Etc/UTC",
    secrets: [REVENUECAT_SECRET_API_KEY],
  },
  async () => {
    const expired = await db
      .collection("Users")
      .where("entitlements.promoUntil", "<=", Timestamp.now())
      .limit(200)
      .get();
    let cleared = 0;
    for (const doc of expired.docs) {
      try {
        let state;
        try {
          state = await fetchRevenueCatPremiumState(doc.id);
        } catch (error) {
          // RevenueCat'e ulaşılamadı. Bilinen bir mağaza aboneliği yoksa dolmuş promosyon
          // yine de kaldırılır (plan vermeye devam etmesin); varsa abonelik planını
          // bilmeden Free yazılmaz, bir sonraki çalışmada tekrar denenir.
          if (referral.hasActiveStoreSubscription(doc.get("entitlements"))) throw error;
          console.warn(`[expirePromoGrants] uid=${doc.id}: RevenueCat yok, Free yazılıyor:`, error?.message);
          state = FREE_PLAN_STATE;
        }
        const batch = db.batch();
        writeEntitlements(batch, doc.id, state, {
          source: "revenuecat_sync",
          currentEntitlements: doc.get("entitlements"),
        });
        await batch.commit();
        cleared += 1;
      } catch (error) {
        console.warn(`[expirePromoGrants] uid=${doc.id}:`, error?.message);
      }
    }
    console.log(`[expirePromoGrants] ${cleared}/${expired.size} cleared`);
  },
);

/** Hesap silinince davet verisi de silinir (kod, davet hesabı, davet kayıtları). */
exports.cleanupReferralOnUserDeleted = onDocumentDeleted(
  { ...CAPACITY.trigger, document: "Users/{uid}" },
  async (event) => {
    const uid = event.params.uid;
    const accountRef = db.doc(`ReferralAccounts/${uid}`);
    const accountSnap = await accountRef.get();
    const batch = db.batch();
    const code = accountSnap.get("code");
    if (code) batch.delete(db.doc(`ReferralCodes/${code}`));
    if (accountSnap.exists) batch.delete(accountRef);
    batch.delete(db.doc(`Referrals/${uid}`));
    const invited = await db
      .collection("Referrals")
      .where("inviterUid", "==", uid)
      .limit(400)
      .get();
    invited.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  },
);

/**
 * Hesap silme: kullanıcının buluttaki TÜM verisini Admin yetkisiyle siler
 * (functions/accountPurge.js — istemci kuralları yüzünden silemediği izler dahil).
 * İstemci bunu Auth kullanıcısını silmeden ÖNCE çağırır; dönen `failed` boş değilse
 * kendi yedek yoluna da düşer. `data.phase` (PURGE_PHASES) verilirse yalnız o aşama
 * çalışır — istemci aşamaları sırayla çağırıp ilerleme çubuğunu çizer; verilmezse hepsi.
 * Kimlik doğrulaması taze olmalı: çalınmış eski bir
 * oturum belirteciyle veri silinmesin diye (deleteUser'ın "recent login" şartının eşi).
 */
// Aşamalı silme (aşağıdaki `phase`) birkaç dakika sürebilir; tek belirteç bütün aşamaları taşır.
const DELETE_ACCOUNT_MAX_AUTH_AGE_SEC = 15 * 60;
exports.deleteAccountData = onCall(
  { ...CAPACITY.light, timeoutSeconds: 540, memory: "512MiB" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError("unauthenticated", "Authentication required");
    const authTime = Number(request.auth?.token?.auth_time) || 0;
    if (Date.now() / 1000 - authTime > DELETE_ACCOUNT_MAX_AUTH_AGE_SEC) {
      throw new HttpsError("unauthenticated", "Recent sign-in required");
    }
    const phase = request.data?.phase;
    if (phase !== undefined && !PURGE_PHASES.includes(phase)) {
      throw new HttpsError("invalid-argument", "Unknown phase");
    }
    const result = await purgeAccountData({ db, rtdb }, uid, { phase });
    console.log(
      `[deleteAccountData] uid=${uid} phase=${phase || "all"} failed=${result.failed.length} skipped=${result.skipped.length}`,
    );
    return result;
  },
);

/**
 * Auth kullanıcısı silinince (uygulamadan ya da konsoldan) verisini BİR KEZ DAHA
 * süpürür: istemci silme sürerken açık kalan dinleyiciler (presence, senkron…)
 * silinmiş belgeleri geri yazmış olabilir. İşlem idempotent.
 */
// gen1: setGlobalOptions buna UYGULANMAZ (canlı tavan 3000'di) — tavan runWith ile.
exports.purgeOnAuthUserDeleted = functionsV1
  .runWith(CAPACITY.trigger)
  .auth.user()
  .onDelete(async (user) => {
  const result = await purgeAccountData({ db, rtdb }, user.uid);
  console.log(
    `[purgeOnAuthUserDeleted] uid=${user.uid} failed=${result.failed.length} skipped=${result.skipped.length}`,
  );
});

/**
 * Google ile giris yapilmadan ONCE hesap cakismasini guvenli bicimde denetler.
 *
 * Neden istemcide fetchSignInMethodsForEmail kullanmiyoruz?
 * Firebase'in email-enumeration protection ayari bu metodu bilerek bos donmeye
 * zorlar. Daha onemlisi, Google gibi guvenilir bir saglayici ayni Gmail adresli
 * dogrulanmamis email/sifre hesabinin saglayicisini otomatik ezebilir. Bu callable
 * yalniz gecerli bir Google idToken sahibinin KENDI emailini sorgulamasina izin
 * verir; boylece email hesabi once normal giris yapip Ayarlar'dan Google'i acikca
 * baglamadan Google credential Firebase'e hic gonderilmez.
 */
exports.checkGoogleSignInEligibility = onCall(CAPACITY.light, async (request) => {
  const idToken = request.data?.idToken;
  if (typeof idToken !== "string" || idToken.length < 100 || idToken.length > 5000) {
    throw new HttpsError("invalid-argument", "Valid Google idToken required");
  }

  let claims;
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!response.ok) throw new Error(`tokeninfo:${response.status}`);
    claims = await response.json();
  } catch (error) {
    console.warn("Google idToken verification failed", error?.message);
    throw new HttpsError("unauthenticated", "Google identity could not be verified");
  }

  if (
    claims?.aud !== GOOGLE_WEB_CLIENT_ID ||
    !claims?.sub ||
    !claims?.email ||
    !(claims.email_verified === true || claims.email_verified === "true")
  ) {
    throw new HttpsError("unauthenticated", "Google identity is not valid");
  }

  let existingUser = null;
  try {
    existingUser = await getAuth().getUserByEmail(claims.email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      console.error("Google eligibility Auth lookup failed", error?.code);
      throw new HttpsError("unavailable", "Account check is temporarily unavailable");
    }
  }

  if (
    existingUser &&
    !existingUser.providerData.some((provider) => provider.providerId === "google.com")
  ) {
    throw new HttpsError(
      "already-exists",
      "Existing account must link Google after signing in",
      { reason: "LINK_REQUIRED" },
    );
  }

  return { allowed: true };
});

/** Apple credential Firebase'e girmeden once ayni e-posta cakismasini denetler. */
exports.checkAppleSignInEligibility = onCall(CAPACITY.light, async (request) => {
  const identityToken = request.data?.identityToken;
  if (
    typeof identityToken !== "string" ||
    identityToken.length < 100 ||
    identityToken.length > 10000
  ) {
    throw new HttpsError("invalid-argument", "Valid Apple identityToken required");
  }

  let claims;
  try {
    claims = await verifyAppleIdentityToken(identityToken, APPLE_CLIENT_ID);
  } catch (error) {
    console.warn("Apple identityToken verification failed", error?.message);
    throw new HttpsError("unauthenticated", "Apple identity could not be verified");
  }

  let existingUser = null;
  try {
    existingUser = await getAuth().getUserByEmail(claims.email);
  } catch (error) {
    if (error?.code !== "auth/user-not-found") {
      console.error("Apple eligibility Auth lookup failed", error?.code);
      throw new HttpsError("unavailable", "Account check is temporarily unavailable");
    }
  }

  if (
    existingUser &&
    !existingUser.providerData.some((provider) => provider.providerId === "apple.com")
  ) {
    throw new HttpsError(
      "already-exists",
      "Existing account must link Apple after signing in",
      { reason: "LINK_REQUIRED" },
    );
  }
  return { allowed: true };
});

/**
 * Hesap silme/baglanti kaldirma aninda alinan tek kullanimlik authorization
 * code'u Apple tokenina cevirir ve Apple yetkilendirmesini iptal eder.
 */
exports.revokeAppleAuthorization = onCall(
  { ...CAPACITY.upstream, secrets: [APPLE_SIGN_IN_KEY_ID, APPLE_SIGN_IN_PRIVATE_KEY] },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError("unauthenticated", "Authentication required");
    }
    const authorizationCode = request.data?.authorizationCode;
    if (
      typeof authorizationCode !== "string" ||
      authorizationCode.length < 10 ||
      authorizationCode.length > 5000
    ) {
      throw new HttpsError("invalid-argument", "Valid authorization code required");
    }
    try {
      await revokeAppleAuthorizationCode(authorizationCode, {
        teamId: APPLE_TEAM_ID,
        clientId: APPLE_CLIENT_ID,
        keyId: APPLE_SIGN_IN_KEY_ID.value(),
        privateKey: APPLE_SIGN_IN_PRIVATE_KEY.value(),
      });
      return { revoked: true };
    } catch (error) {
      console.error("Apple authorization revocation failed", error?.message);
      throw new HttpsError("internal", "Apple authorization could not be revoked");
    }
  },
);

// ─── Arkadaş araması (searchUsers) ──────────────────────────────────────────
// İstemci Users koleksiyonunu artık LİSTELEMEZ (firestore.rules → legacyUserSearchList, 2026-10-31 denetimi H-1);
// kullanıcı adı ön-ek araması buradan, kullanıcı başına hız sınırıyla ve yalnız arama kartının beş alanıyla döner
// (functions/userSearch.js). Sınır örnek içidir (dağıtık değil): betikli kazımayı yavaşlatır, ekranda dolmaz
// (arama yazarken gecikmeli tetiklenir).
const userSearchAllow = externalRatings.createRateLimiter({ limit: 30, windowMs: 60 * 1000 });

exports.searchUsers = onCall(CAPACITY.light, async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required");
  const term = userSearch.normalizeSearchTerm(request.data?.term);
  if (!term) return { users: [] };
  if (!userSearchAllow(request.auth.uid)) {
    throw new HttpsError("resource-exhausted", "Too many searches", { reason: "RATE_LIMITED" });
  }
  // Bir fazla çekilir: arayan kendi adıyla eşleşip listeden çıkınca sonuç yine tam sayfa kalsın.
  const snap = await db
    .collection("Users")
    .where("usernameLower", ">=", term)
    .where("usernameLower", "<=", `${term}${userSearch.PREFIX_END}`)
    .limit(userSearch.SEARCH_LIMIT + 1)
    .get();
  return { users: userSearch.pickResults(snap.docs, request.auth.uid) };
});

// ───────────────────────────────────────────────────────────────────────────
// GEMINI PROXY (callGemini callable)
//
// Yayın blokeri çözümü (YAYIN_VE_GELIR_YOL_HARITASI.md §1.2 madde 1):
// Gemini API anahtarı ARTIK istemciye gömülmez. İstemci bu callable'ı çağırır;
// anahtar yalnız burada (Secret Manager) yaşar. Kurulum:
//
//   firebase functions:secrets:set GEMINI_API_KEY
//   (eski EXPO_PUBLIC_GEMINI_API_KEY anahtarını Google AI Studio'dan İPTAL ET,
//    yeni bir anahtar üret ve yalnız yukarıdaki secret'a koy)
//
// Kota: kullanıcı başına günlük + aylık mesaj tavanı — AiUsage/{uid}
// dokümanında transaction'lı sayaç (UTC). Free 3/30, Premium 20/300,
// Unlimited 50/900. Premium durumu Users/{uid}.entitlements alanından okunur.
//
// Girdi doğrulama, yeniden deneme/yedek model ve yanıt doğrulama ./aiProxy.js'te.
// Hak YALNIZ kullanıcıya bir cevap ya da kendi içeriğinden doğan güvenlik
// engeli döndüğünde harcanır; üst akış hatası ve boş model yanıtı iade edilir.
//
// App Check: Faz 0 Hafta 2'de Play Integrity kurulunca aşağıdaki
// enforceAppCheck true yapılmalı (şimdilik false — istemcide App Check yok).
// ───────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
// TMDB v4 "Read Access Token" — watch/providers sorgusu için (streaming
// uygunluk bildirimleri). Kurulum: firebase functions:secrets:set TMDB_API_KEY
const TMDB_API_KEY = defineSecret("TMDB_API_KEY");

// Kısa süreli patlama freni (örnek içi, dağıtık değil): günlük kota maliyeti
// sınırlar; bu yalnız betikli seri çağrının üst akış hız sınırını herkes için
// tüketmesini önler. Arayüz bir sohbette aynı anda tek istek gönderdiği için
// gerçek kullanımda dolmaz.
const aiBurstAllow = externalRatings.createRateLimiter({ limit: 8, windowMs: 60 * 1000 });

const toHttpsError = (err) => new HttpsError(err.code, err.message, err.details);

/** UTC gün/ay anahtarı (kota penceresi): "2026-07-08" / "2026-07". */
function aiQuotaWindow(date = new Date()) {
  const iso = date.toISOString();
  return { today: iso.slice(0, 10), month: iso.slice(0, 7) };
}

/**
 * Kota transaction'ı: günlük ve aylık hakkı birlikte, atomik olarak tüketir.
 * Pencere geri döner: iade AYNI güne/aya yazılsın (gece yarısını aşan istek
 * yeni günün sayacından düşmesin).
 */
async function consumeAiQuota(uid, plan) {
  const ref = db.doc(`AiUsage/${uid}`);
  const window = aiQuotaWindow();
  const { today, month } = window;
  const limits = getAiPlanLimits(plan);
  const quota = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const { dailyUsed, monthlyUsed } = readAiUsage(data, today, month);
    if (dailyUsed >= limits.daily) {
      throw new HttpsError("resource-exhausted", "Daily AI quota exceeded", {
        reason: "DAILY_QUOTA",
        ...buildAiQuota(plan, dailyUsed, monthlyUsed),
      });
    }
    if (monthlyUsed >= limits.monthly) {
      throw new HttpsError("resource-exhausted", "Monthly AI quota exceeded", {
        reason: "MONTHLY_QUOTA",
        ...buildAiQuota(plan, dailyUsed, monthlyUsed),
      });
    }

    const nextDaily = dailyUsed + 1;
    const nextMonthly = monthlyUsed + 1;
    tx.set(
      ref,
      {
        dailyKey: today,
        dailyCount: nextDaily,
        monthKey: month,
        monthlyCount: nextMonthly,
        plan,
        dailyLimit: limits.daily,
        monthlyLimit: limits.monthly,
        // Geriye dönük uyumluluk.
        date: today,
        count: nextDaily,
        limit: limits.daily,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return buildAiQuota(plan, nextDaily, nextMonthly);
  });
  return { quota, window };
}

/** Üst akış hatasında günlük ve aylık sayaçları, tüketildikleri pencerede geri al. */
async function refundAiQuota(uid, { today, month }) {
  try {
    const ref = db.doc(`AiUsage/${uid}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data();
      const patch = {};
      if (data.dailyKey === today && data.dailyCount > 0) {
        patch.dailyCount = data.dailyCount - 1;
        patch.count = patch.dailyCount;
      } else if (data.date === today && data.count > 0) {
        patch.count = data.count - 1;
      }
      if (data.monthKey === month && data.monthlyCount > 0) {
        patch.monthlyCount = data.monthlyCount - 1;
      }
      if (Object.keys(patch).length) tx.update(ref, patch);
    });
  } catch (e) {
    console.warn("AI kota iadesi başarısız:", e?.message);
  }
}

exports.callGemini = onCall(
  {
    ...CAPACITY.upstream,
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 70,
    // TODO(Faz 0 Hafta 2): App Check (Play Integrity) istemcide kurulunca aç.
    enforceAppCheck: false,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign-in required");
    }
    const uid = request.auth.uid;

    // ── Girdi doğrulama (geçersizse Gemini'ye ve kotaya hiç dokunmadan) ──
    let parsed;
    try {
      parsed = aiProxy.parseAiRequest(request.data);
    } catch (err) {
      if (err instanceof aiProxy.AiProxyError) throw toHttpsError(err);
      throw err;
    }
    const { mode, contents, systemInstruction } = parsed;

    if (!aiBurstAllow(uid)) {
      throw new HttpsError("resource-exhausted", "Too many AI requests", { reason: "BURST_LIMIT" });
    }

    // Anahtar yoksa hak HİÇ harcanmaz (eskiden tüketilip iade ediliyordu).
    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      console.error("[callGemini] GEMINI_API_KEY secret tanımsız!");
      throw new HttpsError("failed-precondition", "AI is not configured");
    }

    // ── Üyelik seviyesi → kota tavanı ──
    // Okunamazsa "free" VARSAYILMAZ: ücretli kullanıcı geçici bir okuma
    // hatasında Free tavanına çarpıp "Planları gör" satışıyla karşılaşırdı.
    let plan;
    try {
      const userSnap = await db.doc(`Users/${uid}`).get();
      plan = resolveAiPlan(userSnap.data()?.entitlements);
    } catch (e) {
      console.error("[callGemini] Users okunamadı:", e?.message);
      throw new HttpsError("unavailable", "Account could not be read");
    }

    // ── Kota tüket (yetersizse burada resource-exhausted fırlar) ──
    let quota;
    let quotaWindow;
    try {
      ({ quota, window: quotaWindow } = await consumeAiQuota(uid, plan));
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      console.error("[callGemini] kota işlemi başarısız:", e?.message);
      throw new HttpsError("unavailable", "AI quota could not be checked");
    }

    // ── Gemini isteği (yeniden deneme + yedek model aiProxy'de) ──
    const started = Date.now();
    const quotaLabel =
      `${quota.plan} daily=${quota.daily.used}/${quota.daily.limit} ` +
      `monthly=${quota.monthly.used}/${quota.monthly.limit}`;
    try {
      const result = await aiProxy.generateWithFallback({
        body: aiProxy.buildGenerateBody({ mode, contents, systemInstruction }),
        apiKey,
      });
      const u = result.data.usageMetadata;
      console.log(
        `[callGemini] uid=${uid} mode=${mode} kota=${quotaLabel} ` +
          `sonuç=${result.verdict} denemeler=${aiProxy.describeAttempts(result.attempts)} ` +
          `süre=${Date.now() - started}ms ` +
          `token(giriş/çıkış/toplam)=${u.promptTokenCount}/${u.candidatesTokenCount}/${u.totalTokenCount}`,
      );
      return { data: result.data, quota, model: result.model };
    } catch (err) {
      // Kullanıcıya cevap gitmedi → hakkını iade et.
      await refundAiQuota(uid, quotaWindow);
      if (!(err instanceof aiProxy.UpstreamError)) {
        console.error("[callGemini] beklenmeyen hata:", err?.message);
        throw new HttpsError("internal", "AI request failed");
      }
      const line =
        `[callGemini] uid=${uid} mode=${mode} kota=${quotaLabel} (iade edildi) ` +
        `denemeler=${aiProxy.describeAttempts(err.attempts)} süre=${Date.now() - started}ms`;
      // Kalıcı hata (anahtar iptal, model adı yanlış, 400) her isteği düşürür: hata düzeyinde görünsün.
      if (err.transient) console.warn(line);
      else console.error(line);
      throw toHttpsError(aiProxy.toClientError(err));
    }
  },
);

// ───────────────────────────────────────────────────────────────────────────
// HARİCİ PUANLAR (OMDb proxy): getExternalRatings
//
// IMDb / Rotten Tomatoes / Metascore puanları ve dizi bölüm puanları. OMDb anahtarı ESKİDEN istemciye
// gömülüydü (paketten çıkarılabilirdi); artık yalnız burada, Secret Manager'da.
// Kurulum: firebase functions:secrets:set OMDB_API_KEY   (ESKİ gömülü anahtar yenilenmeli — sızmış sayılır)
//
// Girdi sıkı doğrulanır (yalnız IMDb kimliği + sezon): istemci anahtarı başka sorgu için kullanamaz.
// Örnek içi önbellek (başlık 12 sa, sezon 24 sa) OMDb günlük kotasını korur; kullanıcı başına dakikada
// 60 çağrı sınırı kötüye kullanımı caydırır (dağıtık değil — kesin kota değil).
// Hata kuralı: OMDb ulaşılamaz / kota doluysa { found:false } döner; istemci TMDB puanına düşer.
// ───────────────────────────────────────────────────────────────────────────
const OMDB_API_KEY = defineSecret("OMDB_API_KEY");
const omdbTitleCache = externalRatings.createTtlCache({ ttlMs: 12 * 60 * 60 * 1000 });
const omdbSeasonCache = externalRatings.createTtlCache({ ttlMs: 24 * 60 * 60 * 1000 });
const omdbAllow = externalRatings.createRateLimiter({ limit: 60, windowMs: 60 * 1000 });

exports.getExternalRatings = onCall(
  { ...CAPACITY.upstream, secrets: [OMDB_API_KEY], timeoutSeconds: 20, enforceAppCheck: false },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign-in required");
    const req = externalRatings.validateRatingsRequest(request.data);
    if (!req.ok) throw new HttpsError("invalid-argument", req.reason);
    if (!omdbAllow(request.auth.uid)) throw new HttpsError("resource-exhausted", "Too many requests");

    const cache = req.kind === "title" ? omdbTitleCache : omdbSeasonCache;
    const cacheKey = `${req.imdbId}:${req.season ?? ""}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const apiKey = OMDB_API_KEY.value();
    if (!apiKey) {
      console.error("[getExternalRatings] OMDB_API_KEY secret tanımsız!");
      return { found: false, reason: "not-configured" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(
        externalRatings.buildOmdbUrl({ imdbId: req.imdbId, season: req.season, apiKey }),
        { signal: controller.signal },
      );
      const json = await res.json().catch(() => null);
      if (externalRatings.isQuotaResponse(json)) return { found: false, reason: "quota" };
      const parsed =
        req.kind === "title"
          ? externalRatings.parseTitleResponse(json)
          : externalRatings.parseSeasonResponse(json);
      // "Yok" yalnız OMDb açıkça söylediyse; geçersiz anahtar, "Error getting data."
      // ya da HTTP hatası geçicidir (unavailable) — istemci TMDB puanına düşer.
      const miss = externalRatings.isNotFoundResponse(json);
      const out = parsed
        ? req.kind === "title" ? { found: true, ...parsed } : { found: true, episodes: parsed }
        : { found: false, reason: miss ? "not-found" : "unavailable" };
      // Yalnız KESİN sonuç önbelleğe girer (geçici hata / kota 12 saat sabitlenmesin).
      if (out.found || miss) cache.set(cacheKey, out);
      if (!out.found && !miss) {
        console.warn(`[getExternalRatings] OMDb geçici hata (HTTP ${res.status}):`, json?.Error || "yanıt yok");
      }
      return out;
    } catch (err) {
      console.warn("[getExternalRatings] OMDb isteği başarısız:", err?.message);
      return { found: false, reason: "unavailable" };
    } finally {
      clearTimeout(timer);
    }
  },
);

// Bildirim metinleri (TR/EN). İstemci translations/*.json (notifBody*) ile birebir
// aynı tutulur ki foreground (yerel) ve background (push) gösterimi tutarlı olsun.
// WhatsApp/Instagram tarzı: BAŞLIK = kişi/grup adı, GÖVDE = aksiyon (emoji) / mesaj.
const STRINGS = {
  tr: {
    someone: "Birisi",
    notification: "Bildirim",
    messageFallback: "sana bir mesaj gönderdi",
    cineswipe_invite: "🎬 seni CineSwipe odasına davet etti",
    cineswipe_result: "🎬 CineSwipe sonuçları hazır",
    cineswipe_result_detail: "🎬 CineSwipe sonuçları hazır · {n} ortak eşleşme",
    game_challenge: "⚔️ seni günlük düelloya davet etti",
    friend_request: "👤 sana arkadaşlık isteği gönderdi",
    friend_accepted: "🤝 arkadaşlık isteğini kabul etti",
    post_like: "❤️ gönderini beğendi",
    post_comment: "💬 gönderine yorum yaptı",
    post_comment_text: "💬 yorum yaptı: {text}",
    comment_reply: "💬 yorumuna yanıt verdi",
    comment_reply_text: "💬 yanıt verdi: {text}",
    mention: "💬 senden bahsetti",
    mention_text: "💬 senden bahsetti: {text}",
  },
  en: {
    someone: "Someone",
    notification: "Notification",
    messageFallback: "sent you a message",
    cineswipe_invite: "🎬 invited you to a CineSwipe room",
    cineswipe_result: "🎬 CineSwipe results are ready",
    cineswipe_result_detail: "🎬 CineSwipe results are ready · {n} shared matches",
    game_challenge: "⚔️ challenged you to a daily duel",
    friend_request: "👤 sent you a friend request",
    friend_accepted: "🤝 accepted your friend request",
    post_like: "❤️ liked your post",
    post_comment: "💬 commented on your post",
    post_comment_text: "💬 commented: {text}",
    comment_reply: "💬 replied to your comment",
    comment_reply_text: "💬 replied: {text}",
    mention: "💬 mentioned you",
    mention_text: "💬 mentioned you: {text}",
  },
  es: {
    someone: "Alguien",
    notification: "Notificación",
    messageFallback: "te ha enviado un mensaje",
    cineswipe_invite: "🎬 te invitó a una sala de CineSwipe",
    cineswipe_result: "🎬 Los resultados de CineSwipe están listos",
    cineswipe_result_detail: "🎬 Los resultados de CineSwipe están listos · {n} coincidencias",
    game_challenge: "⚔️ te retó a un duelo diario",
    friend_request: "👤 te ha enviado una solicitud de amistad",
    friend_accepted: "🤝 ha aceptado tu solicitud de amistad",
    post_like: "❤️ le ha dado me gusta a tu publicación",
    post_comment: "💬 ha comentado tu publicación",
    post_comment_text: "💬 ha comentado: {text}",
    comment_reply: "💬 ha respondido a tu comentario",
    comment_reply_text: "💬 ha respondido: {text}",
    mention: "💬 te ha mencionado",
    mention_text: "💬 te ha mencionado: {text}",
  },
  pt: {
    someone: "Alguém",
    notification: "Notificação",
    messageFallback: "enviou uma mensagem para você",
    cineswipe_invite: "🎬 convidou você para uma sala do CineSwipe",
    cineswipe_result: "🎬 Os resultados do CineSwipe estão prontos",
    cineswipe_result_detail: "🎬 Os resultados do CineSwipe estão prontos · {n} matches em comum",
    game_challenge: "⚔️ desafiou você para um duelo diário",
    friend_request: "👤 enviou um pedido de amizade para você",
    friend_accepted: "🤝 aceitou seu pedido de amizade",
    post_like: "❤️ curtiu sua publicação",
    post_comment: "💬 comentou na sua publicação",
    post_comment_text: "💬 comentou: {text}",
    comment_reply: "💬 respondeu ao seu comentário",
    comment_reply_text: "💬 respondeu: {text}",
    mention: "💬 mencionou você",
    mention_text: "💬 mencionou você: {text}",
  },
  de: {
    someone: "Jemand",
    notification: "Benachrichtigung",
    messageFallback: "hat dir eine Nachricht gesendet",
    cineswipe_invite: "🎬 hat dich in einen CineSwipe Raum eingeladen",
    cineswipe_result: "🎬 Deine CineSwipe-Ergebnisse sind da",
    cineswipe_result_detail: "🎬 Deine CineSwipe-Ergebnisse sind da · {n} gemeinsame Treffer",
    game_challenge: "⚔️ hat dich zu einem Tagesduell herausgefordert",
    friend_request: "👤 hat dir eine Freundschaftsanfrage gesendet",
    friend_accepted: "🤝 hat deine Freundschaftsanfrage angenommen",
    post_like: "❤️ gefällt dein Beitrag",
    post_comment: "💬 hat deinen Beitrag kommentiert",
    post_comment_text: "💬 hat kommentiert: {text}",
    comment_reply: "💬 hat auf deinen Kommentar geantwortet",
    comment_reply_text: "💬 hat geantwortet: {text}",
    mention: "💬 hat dich erwähnt",
    mention_text: "💬 hat dich erwähnt: {text}",
  },
};

// Push dili: istemci Users/{uid}.notificationLanguage'a uygulama dilini yazar
// (utils/appLanguages.js ile AYNI kodlar). Alan yoksa eski kullanıcıdır → "tr"
// (alan yokken varsayılan her zaman Türkçeydi). Alan var ama bu listede yoksa
// (ileride eklenecek bir dil, bu deploy'dan önce) → İNGİLİZCE: yabancı kullanıcıya
// Türkçe push gitmesin. YENİ DİL: STRINGS + STREAM_STRINGS'e giriş + bu liste.
const NOTIFICATION_LANGUAGES = ["tr", "en", "es", "pt", "de"];
function pickNotificationLang(value) {
  if (!value) return "tr";
  return NOTIFICATION_LANGUAGES.includes(value) ? value : "en";
}

// notification.type → {title, body}. lang: "tr" | "en" | "es" | "pt" | "de".
function buildContent(n, lang) {
  const S = STRINGS[pickNotificationLang(lang)];
  const name = n.fromName || S.someone;
  const text = n.text ? String(n.text) : "";
  switch (n.type) {
    case "friend_request":
      return { title: name, body: S.friend_request };
    case "friend_accepted":
      return { title: name, body: S.friend_accepted };
    case "post_like":
      return { title: name, body: S.post_like };
    case "post_comment":
      return { title: name, body: text ? S.post_comment_text.replace("{text}", text) : S.post_comment };
    case "comment_reply":
      return { title: name, body: text ? S.comment_reply_text.replace("{text}", text) : S.comment_reply };
    case "mention":
      return { title: name, body: text ? S.mention_text.replace("{text}", text) : S.mention };
    case "message":
      // Grup → başlık=grup adı, gövde="gönderen: mesaj"; 1-1 → başlık=isim, gövde=mesaj.
      if (n.groupId) {
        return { title: n.groupName || name, body: `${name}: ${text || S.messageFallback}` };
      }
      return { title: name, body: text || `${name} ${S.messageFallback}` };
    case "cineswipe_invite":
    case "game_challenge":
      return { title: name, body: S[n.type] };
    case "cineswipe_result":
      return {
        title: name,
        body: Number.isInteger(n.matchCount) && n.matchCount > 0
          ? S.cineswipe_result_detail.replace("{n}", String(n.matchCount))
          : S.cineswipe_result,
      };
    default:
      return { title: S.notification, body: name };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// PUSH TOKEN ERİŞİMİ (iki tüketici de bunu kullanır)
//
// Token'lar Users/{uid}/private/push dokümanında. Kök Users dokümanı tüm
// oturumlu kullanıcılara okunur olduğu için token'lar orada duramazdı.
//
// ⚠ GEÇİŞ FALLBACK'İ — KALDIRILACAK: aşağıdaki "legacy" blokları, sahada
// henüz güncellenmemiş istemcilerin hâlâ kök alanlara yazması için duruyor.
// İstemci yeni yola yazdıktan sonra kök alanları kendisi siliyor, yani
// kullanıcılar uygulamayı bir kez açtıkça alanlar kendiliğinden boşalıyor.
// app.json version 1.5.0'a geçtiğinde (yani 1.4.x sahadan düştüğünde) bu
// bloklar ve kök dokümana yazan temizlik silinsin. Admin SDK kural tanımadığı
// için okuma tarafında bir izin sorunu yok.
// ───────────────────────────────────────────────────────────────────────────

/** Kullanıcının geçerli Expo push token'ları + gizli dokümanın ham içeriği. */
async function loadPushTokens(uid, userData) {
  let priv = {};
  try {
    const snap = await db.doc(`Users/${uid}/private/push`).get();
    if (snap.exists) priv = snap.data() || {};
  } catch (e) {
    console.error("private/push okunamadı:", e);
  }

  const tokenSet = new Set();
  if (priv.expoPushToken) tokenSet.add(priv.expoPushToken);
  if (Array.isArray(priv.expoPushTokens)) {
    priv.expoPushTokens.forEach((t) => t && tokenSet.add(t));
  }
  // legacy (geçiş) — bkz. yukarıdaki not.
  if (userData.expoPushToken) tokenSet.add(userData.expoPushToken);
  if (Array.isArray(userData.expoPushTokens)) {
    userData.expoPushTokens.forEach((t) => t && tokenSet.add(t));
  }

  return { tokens: [...tokenSet].filter((t) => Expo.isExpoPushToken(t)), priv };
}

/**
 * Uygulaması silinmiş/çıkış yapılmış cihazların token'larını temizle.
 * Tek alan (expoPushToken) da gönderim setine giriyor; yalnız diziden
 * silersek ölü token oradan sonsuza dek yeniden denenir.
 */
async function clearDeadPushTokens(uid, userData, priv, deadTokens) {
  if (!deadTokens.length) return;
  try {
    const patch = { expoPushTokens: FieldValue.arrayRemove(...deadTokens) };
    if (priv.expoPushToken && deadTokens.includes(priv.expoPushToken)) {
      patch.expoPushToken = FieldValue.delete();
    }
    // update değil set+merge: doküman hiç oluşmamış olabilir (yalnız legacy
    // alanları olan kullanıcı), update o durumda hata verirdi.
    await db.doc(`Users/${uid}/private/push`).set(patch, { merge: true });
  } catch (e) {
    console.error("Ölü token temizliği hatası (private):", e);
  }

  // legacy (geçiş) — kök alanlar duruyorsa oradan da düş.
  if (!userData.expoPushToken && !Array.isArray(userData.expoPushTokens)) return;
  try {
    const patch = { expoPushTokens: FieldValue.arrayRemove(...deadTokens) };
    if (userData.expoPushToken && deadTokens.includes(userData.expoPushToken)) {
      patch.expoPushToken = FieldValue.delete();
    }
    await db.doc(`Users/${uid}`).update(patch);
  } catch (e) {
    console.error("Ölü token temizliği hatası (legacy):", e);
  }
}

// Sosyal push'un hazırlanması/gönderimi tek yerde (socialPush.js): bildirim
// belgesi tetikleyicisi ve mesaj tetikleyicileri AYNI ayar/engel/inChat/rozet
// mantığını kullanır.
const socialPush = createSocialPush({
  db,
  rtdb,
  expo,
  buildContent,
  pickNotificationLang,
  loadPushTokens,
  clearDeadPushTokens,
});

exports.onSocialNotificationCreated = onDocumentCreated(
  { ...CAPACITY.trigger, document: "Users/{uid}/notifications/{notifId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    const data = snap.data() || {};
    // Sırayla CineSwipe sonucu sohbete de yazıldıysa o mesajın push'u yeter; ikincisi gürültü.
    if (data.type === "cineswipe_result" && data.chatPosted === true) return;
    const prepared = await socialPush.prepare(event.params.uid, data, {
      notifId: event.params.notifId,
    });
    if (prepared) await socialPush.send([prepared]);
  },
);

// Mesaj push'u: yeni istemci mesaja `push: "server"` yazar ve bildirim belgesi
// ÜRETMEZ; dağıtım burada (alıcı başına sıfır Firestore yazımı, tüm alıcılar tek
// gönderimde). İşaretsiz mesaj (eski istemci) yok sayılır — onun push'u bildirim
// belgesinden gelir. Ayrıntı: socialPush.js.
exports.onDirectMessageCreated = onDocumentCreated(
  { ...CAPACITY.trigger, document: "chats/{chatId}/messages/{msgId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    await socialPush.deliverMessagePush({
      message: snap.data() || {},
      messageId: event.params.msgId,
      chatId: event.params.chatId,
    });
  },
);

exports.onGroupMessageCreated = onDocumentCreated(
  { ...CAPACITY.trigger, document: "groups/{groupId}/messages/{msgId}" },
  async (event) => {
    const snap = event.data;
    if (!snap) return;
    await socialPush.deliverMessagePush({
      message: snap.data() || {},
      messageId: event.params.msgId,
      groupId: event.params.groupId,
    });
  },
);

// ───────────────────────────────────────────────────────────────────────────
// Profil fan-out: kullanıcı isim/username/avatar değiştirince DENORMALIZE
// kopyaları güncelle. İstemci izin sınırı olmadan (admin) tüm yerlere yazar.
//
// Tetik: Users/{uid} dokümanı UPDATE. Yalnız displayName/username/avatarIndex
// değiştiyse çalışır (isOnline/counter/pushToken gibi sık güncellemelerde erken çıkar).
// Self-trigger yok: yalnız ALT koleksiyonlara + Posts'a yazar, hiçbir Users/{x}
// ÜST dokümanına dokunmaz.
//
// Users/{uid} tek dogru kaynaktir. Kimlik bilgisini snapshot olarak tutmak
// zorunda olan eski/yeni butun sosyal yuzeyler bu tetikleyiciyle tazelenir.
// ───────────────────────────────────────────────────────────────────────────

// Bir referans listesini verilen patch ile chunk'lı (max 450/batch) günceller.
async function commitRefs(refs, patch) {
  let batch = db.batch();
  let n = 0;
  let total = 0;
  for (const ref of refs) {
    batch.update(ref, patch);
    n++;
    total++;
    if (n >= 450) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  }
  if (n) await batch.commit();
  return total;
}

// Her hedefin patch'i farkli oldugunda (nested member map / lastMessage gibi)
// ayni chunk guvencesiyle yaz.
async function commitUpdates(items) {
  let batch = db.batch();
  let n = 0;
  let total = 0;
  for (const item of items) {
    if (!item?.ref || !hasPatch(item.patch)) continue;
    batch.update(item.ref, item.patch);
    n++;
    total++;
    if (n >= 450) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  }
  if (n) await batch.commit();
  return total;
}

exports.onUserProfileUpdated = onDocumentUpdated(
  {
    ...CAPACITY.trigger,
    document: "Users/{uid}",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async (event) => {
  const uid = event.params.uid;
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};

  const changes = buildProfileIdentityChanges(before, after);
  const { nameChanged, usernameChanged, avatarChanged } = changes;
  if (!nameChanged && !usernameChanged && !avatarChanged) return;

  const { displayName: name, username, avatarIndex, photoURL } = changes.after;

  // Hedefe gore yalniz DEGISEN alanlar (gereksiz yazma yok).
  const patchAuthor = mappedPatch(changes, {
    displayName: "authorName",
    username: "authorUsername",
    avatarIndex: "authorAvatarIndex",
    photoURL: "authorPhotoURL",
  });
  const patchMediaComment = mappedPatch(changes, {
    displayName: "username",
    username: "userHandle",
    avatarIndex: "avatarIndex",
    photoURL: "authorPhotoURL",
  });
  const patchFriend = mappedPatch(changes, {
    displayName: "friendName",
    username: "friendUsername",
    avatarIndex: "friendAvatarIndex",
    photoURL: "friendPhotoURL",
  });
  const patchFrom = mappedPatch(changes, {
    displayName: "fromName",
    username: "fromUsername",
    avatarIndex: "fromAvatarIndex",
    photoURL: "fromPhotoURL",
  });
  const patchTo = mappedPatch(changes, {
    displayName: "toName",
    username: "toUsername",
    avatarIndex: "toAvatarIndex",
    photoURL: "toPhotoURL",
  });
  const patchNotif = mappedPatch(changes, {
    displayName: "fromName",
    username: "fromUsername",
    avatarIndex: "fromAvatarIndex",
    photoURL: "fromPhotoURL",
  });
  const patchConversation = mappedPatch(changes, {
    displayName: "withName",
    username: "withUsername",
    avatarIndex: "withAvatarIndex",
    photoURL: "withPhotoURL",
  });
  const patchMessage = mappedPatch(changes, {
    displayName: "senderName",
    username: "senderUsername",
    avatarIndex: "senderAvatarIndex",
    photoURL: "senderPhotoURL",
  });
  const patchLeaderboard = mappedPatch(changes, {
    displayName: "displayNameSnapshot",
    username: "usernameSnapshot",
    avatarIndex: "avatarIndexSnapshot",
    photoURL: "photoURLSnapshot",
  });

  const log = (k, c) => console.log(`profil fan-out [${k}] uid=${uid}: ${c}`);

  // 1) Postlar (authorId==uid) + 2) post yorumları (collectionGroup "comments")
  if (hasPatch(patchAuthor)) {
    try {
      const s = await db.collection("Posts").where("authorId", "==", uid).get();
      log("posts", await commitRefs(s.docs.map((d) => d.ref), patchAuthor));
    } catch (e) {
      console.error("fan-out posts:", e);
    }
    try {
      // "comments" collectionGroup: post yorumları authorId tutar; film/dizi
      // yorumları (MovieComment) userId tuttuğu için bu filtreye TAKILMAZ.
      const s = await db.collectionGroup("comments").where("authorId", "==", uid).get();
      log("post-comments", await commitRefs(s.docs.map((d) => d.ref), patchAuthor));
    } catch (e) {
      console.error("fan-out comments:", e);
    }
  }

  // 2b) Film/dizi yorumlari ve yanitlari. Bu sema gorunen adi tarihsel olarak
  // `username` alaninda tutuyor; userHandle yeni gercek kullanici adidir.
  if (hasPatch(patchMediaComment)) {
    for (const collectionId of ["comments", "replies"]) {
      try {
        const s = await db
          .collectionGroup(collectionId)
          .where("userId", "==", uid)
          .get();
        log(
          `media-${collectionId}`,
          await commitRefs(s.docs.map((d) => d.ref), patchMediaComment),
        );
      } catch (e) {
        console.error(`fan-out media-${collectionId}:`, e);
      }
    }
  }

  // 3) Arkadaş kayıtları: her arkadaşın listesindeki benim kaydım.
  if (hasPatch(patchFriend)) {
    try {
      const s = await db.collection("Users").doc(uid).collection("friends").get();
      const refs = s.docs.map((d) => db.doc(`Users/${d.id}/friends/${uid}`));
      // Refs sorgudan değil kendi listemden türetildi; karşı taraf mirror'ı
      // eksikse update() NOT_FOUND atar ve batch atomik olduğu için chunk'taki
      // diğer tüm arkadaş güncellemeleri de düşer. Önce var olanları süz.
      const existing = [];
      for (let i = 0; i < refs.length; i += 300) {
        const snaps = await db.getAll(...refs.slice(i, i + 300));
        snaps.forEach((snap) => {
          if (snap.exists) existing.push(snap.ref);
        });
      }
      log("friends", await commitRefs(existing, patchFriend));
    } catch (e) {
      console.error("fan-out friends:", e);
    }
  }

  // 4) Gelen istekler (başka kullanıcıların friendRequests'inde fromUid==uid)
  if (hasPatch(patchFrom)) {
    try {
      const s = await db.collectionGroup("friendRequests").where("fromUid", "==", uid).get();
      log("friendRequests", await commitRefs(s.docs.map((d) => d.ref), patchFrom));
    } catch (e) {
      console.error("fan-out friendRequests:", e);
    }
  }

  // 5) Giden istekler (başka kullanıcıların bana gönderdiği sentRequests'te toUid==uid)
  if (hasPatch(patchTo)) {
    try {
      const s = await db.collectionGroup("sentRequests").where("toUid", "==", uid).get();
      log("sentRequests", await commitRefs(s.docs.map((d) => d.ref), patchTo));
    } catch (e) {
      console.error("fan-out sentRequests:", e);
    }
  }

  // 6) Bildirimler (başka kullanıcıların notifications'ında fromUid==uid)
  if (hasPatch(patchNotif)) {
    try {
      const s = await db.collectionGroup("notifications").where("fromUid", "==", uid).get();
      log("notifications", await commitRefs(s.docs.map((d) => d.ref), patchNotif));
    } catch (e) {
      console.error("fan-out notifications:", e);
    }
  }

  // 7) Birebir sohbet gelen kutusu. Acik sohbet ayrica Users/{uid}'yi canli
  // dinler; bu indeks Mesajlar ekranini ve sonraki acilislari gunceller.
  if (hasPatch(patchConversation)) {
    try {
      const s = await db
        .collectionGroup("conversations")
        .where("withUid", "==", uid)
        .get();
      log(
        "conversations",
        await commitRefs(s.docs.map((d) => d.ref), patchConversation),
      );
    } catch (e) {
      console.error("fan-out conversations:", e);
    }
  }

  // 8) Gruplar: uye karti + son mesaj onizlemesi. Nested leaf patch yetkileri
  // ve gelecekte eklenecek uye alanlarini ezmez.
  if (nameChanged || usernameChanged || avatarChanged) {
    try {
      const s = await db
        .collection("groups")
        .where("members", "array-contains", uid)
        .get();
      const items = s.docs.map((d) => {
        const data = d.data() || {};
        const patch = {};
        if (nameChanged) patch[`memberInfo.${uid}.name`] = name;
        if (usernameChanged) patch[`memberInfo.${uid}.username`] = username;
        if (avatarChanged) {
          patch[`memberInfo.${uid}.avatarIndex`] = avatarIndex;
          patch[`memberInfo.${uid}.photoURL`] = photoURL || null;
        }
        if (data.lastMessage?.senderId === uid && nameChanged) {
          patch["lastMessage.senderName"] = name;
        }
        return { ref: d.ref, patch };
      });
      log("groups", await commitUpdates(items));
    } catch (e) {
      console.error("fan-out groups:", e);
    }
  }

  // 9) Grup mesajlari, reply snapshot'lari ve sabitlenen mesajlar. Chat UI
  // memberInfo'dan canli cozer; bunlar ayrilan uye/legacy kayit fallback'idir.
  if (hasPatch(patchMessage)) {
    try {
      const s = await db.collectionGroup("messages").where("senderId", "==", uid).get();
      log("messages", await commitRefs(s.docs.map((d) => d.ref), patchMessage));
    } catch (e) {
      console.error("fan-out messages:", e);
    }
    try {
      const s = await db.collectionGroup("messages").where("reply.senderId", "==", uid).get();
      const replyPatch = {};
      if (nameChanged) replyPatch["reply.senderName"] = name;
      if (usernameChanged) replyPatch["reply.senderUsername"] = username;
      if (avatarChanged) {
        replyPatch["reply.senderAvatarIndex"] = avatarIndex;
        replyPatch["reply.senderPhotoURL"] = photoURL || null;
      }
      log("message-replies", await commitRefs(s.docs.map((d) => d.ref), replyPatch));
    } catch (e) {
      console.error("fan-out message replies:", e);
    }
    try {
      const s = await db.collectionGroup("pins").where("senderId", "==", uid).get();
      log("pins", await commitRefs(s.docs.map((d) => d.ref), patchMessage));
    } catch (e) {
      console.error("fan-out pins:", e);
    }
  }

  // 10) Ortak listeler: uye/kurucu kimligi ve eski ogelerdeki ekleyen kimligi.
  try {
    const s = await db
      .collection("SharedLists")
      .where("memberIds", "array-contains", uid)
      .get();
    const items = s.docs.map((d) => {
      const data = d.data() || {};
      const patch = {};
      if (nameChanged) patch[`members.${uid}.name`] = name;
      if (usernameChanged) patch[`members.${uid}.username`] = username;
      if (avatarChanged) {
        patch[`members.${uid}.avatarIndex`] = avatarIndex;
        patch[`members.${uid}.photoURL`] = photoURL || null;
      }
      if (data.ownerId === uid && nameChanged) patch.ownerName = name;
      if (data.ownerId === uid && usernameChanged) patch.ownerUsername = username;
      if (data.ownerId === uid && avatarChanged) {
        patch.ownerAvatarIndex = avatarIndex;
        patch.ownerPhotoURL = photoURL || null;
      }
      return { ref: d.ref, patch };
    });
    log("shared-lists", await commitUpdates(items));
  } catch (e) {
    console.error("fan-out shared lists:", e);
  }
  const patchSharedItem = mappedPatch(changes, {
    displayName: "addedByName",
    username: "addedByUsername",
    avatarIndex: "addedByAvatarIndex",
    photoURL: "addedByPhotoURL",
  });
  if (hasPatch(patchSharedItem)) {
    try {
      const s = await db.collectionGroup("items").where("addedBy", "==", uid).get();
      log("shared-list-items", await commitRefs(s.docs.map((d) => d.ref), patchSharedItem));
    } catch (e) {
      console.error("fan-out shared list items:", e);
    }
  }

  // 11) Oyun liderlik yuzeyleri. Kisisel istatistikler degismez; yalniz
  // oyuncunun gorunen kimlik snapshot'i tazelenir.
  if (hasPatch(patchLeaderboard)) {
    try {
      const s = await db.collectionGroup("entries").where("uid", "==", uid).get();
      log("leaderboards", await commitRefs(s.docs.map((d) => d.ref), patchLeaderboard));
    } catch (e) {
      console.error("fan-out leaderboards:", e);
    }
    const legacyPatch = mappedPatch(changes, {
      displayName: "displayName",
      username: "username",
      avatarIndex: "avatarIndex",
    });
    const refs = [
      db.collection("SceneGame").doc(uid),
      db.collection("Users").doc(uid).collection("gameProfile").doc("summary"),
    ];
    try {
      const snaps = await db.getAll(...refs);
      log(
        "game-profile",
        await commitRefs(snaps.filter((s) => s.exists).map((s) => s.ref), legacyPatch),
      );
    } catch (e) {
      console.error("fan-out game profile:", e);
    }
  }
  },
);

// ───────────────────────────────────────────────────────────────────────────
// TURNUVA OY AGREGASYONU
//
// Çok kullanıcı optimizasyonu: istemciler tally için TÜM votes koleksiyonunu
// dinlemek yerine tek bir agregat dokümanı dinler:
//   tournaments/{periodId}/agg/tallies = {
//     noms:   { [nomineeId]: hypeSayısı },      (seçim fazı — ilk 32 oylaması)
//     picks:  { [matchId]: { a: n, b: n } },    (eleme maçları)
//     voters: katılımcı sayısı,
//   }
// Her oy yazımında before/after FARKI kadar increment uygulanır. Agg dokümanı
// henüz yoksa (fonksiyon sonradan devreye girdi / eski ay) koleksiyonun tamamı
// okunarak SIFIRDAN kurulur — geçmiş oylar da sayıma girer.
//
// Not: Firestore trigger'ları "en az bir kez" teslim eder; nadir çift teslimde
// sayaç ±1 sapabilir (topluluk oylaması için kabul edilebilir; kesin sayım
// istenirse eventId tabanlı dedup eklenebilir).
// ───────────────────────────────────────────────────────────────────────────

// Bir votes dokümanını agregat şekline katar (rebuild yolunda kullanılır).
function accumulateVoteDoc(acc, v) {
  if (!v) return;
  const noms = v.noms || {};
  for (const k of Object.keys(noms)) {
    if (!noms[k]) continue;
    acc.noms[k] = (acc.noms[k] || 0) + 1;
  }
  const picks = v.picks || {};
  let any = Object.keys(noms).some((k) => noms[k]);
  for (const k of Object.keys(picks)) {
    const side = picks[k];
    if (side !== "a" && side !== "b") continue;
    if (!acc.picks[k]) acc.picks[k] = { a: 0, b: 0 };
    acc.picks[k][side] += 1;
    any = true;
  }
  if (any) acc.voters += 1;
}

exports.onTournamentVoteWritten = onDocumentWritten(
  { ...CAPACITY.trigger, document: "tournaments/{periodId}/votes/{voterUid}" },
  async (event) => {
    const periodId = event.params.periodId;
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    if (!before && !after) return;

    const inc = FieldValue.increment;
    const updates = {};

    // noms farkı (rules artık değişikliğe izin vermez ama eski istemci/silme
    // ihtimaline karşı iki yön de hesaplanır).
    const bNoms = (before && before.noms) || {};
    const aNoms = (after && after.noms) || {};
    for (const k of Object.keys(aNoms)) {
      if (aNoms[k] && !bNoms[k]) updates[`noms.${k}`] = inc(1);
    }
    for (const k of Object.keys(bNoms)) {
      if (bNoms[k] && !aNoms[k]) updates[`noms.${k}`] = inc(-1);
    }

    // picks farkı
    const bPicks = (before && before.picks) || {};
    const aPicks = (after && after.picks) || {};
    for (const k of Object.keys(aPicks)) {
      const nv = aPicks[k];
      const ov = bPicks[k];
      if (nv !== "a" && nv !== "b") continue;
      if (ov === nv) continue;
      updates[`picks.${k}.${nv}`] = inc(1);
      if (ov === "a" || ov === "b") updates[`picks.${k}.${ov}`] = inc(-1);
    }
    for (const k of Object.keys(bPicks)) {
      const ov = bPicks[k];
      if (!(k in aPicks) && (ov === "a" || ov === "b")) {
        updates[`picks.${k}.${ov}`] = inc(-1);
      }
    }

    if (!before && after) updates.voters = inc(1);
    if (before && !after) updates.voters = inc(-1);

    if (Object.keys(updates).length === 0) return;
    updates.updatedAt = FieldValue.serverTimestamp();

    const aggRef = db.doc(`tournaments/${periodId}/agg/tallies`);
    // Agregat varken yalnız increment'ler yazılır: değişmeli oldukları için okumaya/transaction'a gerek yok ve
    // kör update çekişmede DÜŞMEZ (2026-10-31 denetimi: tüm oylar tek belgede transaction'a yığılınca yeniden
    // deneme bütçesi doluyor, catch yalnız logladığı için o oy sayımdan sessizce kayboluyordu). Belge yoksa
    // (NOT_FOUND) aşağıdaki ilk-yazım yolu koleksiyondan sıfırdan kurar.
    try {
      await aggRef.update(updates);
      return;
    } catch (e) {
      const notFound = e?.code === 5 || /NOT_FOUND|No document to update/i.test(String(e?.message));
      if (!notFound) {
        console.error(`turnuva agg (${periodId}):`, e);
        return;
      }
    }
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(aggRef);
        if (snap.exists) {
          tx.update(aggRef, updates);
          return;
        }
        // İlk yazım: koleksiyonun tamamından sıfırdan kur (after bu snapshot'ta
        // zaten var; increment'leri AYRICA uygulamayız — çift sayım olmasın).
        const votesSnap = await tx.get(
          db.collection(`tournaments/${periodId}/votes`),
        );
        const acc = { noms: {}, picks: {}, voters: 0 };
        votesSnap.forEach((d) => accumulateVoteDoc(acc, d.data()));
        tx.set(aggRef, {
          ...acc,
          rebuiltAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
    } catch (e) {
      console.error(`turnuva agg (${periodId}):`, e);
    }
  },
);

// ───────────────────────────────────────────────────────────────────────────
// STREAMING UYGUNLUK BİLDİRİMLERİ (günlük zamanlanmış)
//
// Kullanıcının izleme listesindeki (Lists/{uid}/watchList) bir yapım, abone
// olduğu bir platforma (Users/{uid}.streamingProviders.ids) EKLENDİĞİNDE push
// gönderir. TMDB "yeni eklendi" olayı yayınlamadığı için anlık durumu periyodik
// çekip ProviderWatch/{uid} snapshot'ıyla karşılaştırırız (diff mantığı saf +
// test'li: streamingDiff.js).
//
// Opt-in: yalnız notificationSettings.streamingEnabled === true kullanıcılar.
// Kurulum: firebase functions:secrets:set TMDB_API_KEY  (TMDB v4 Read Access Token)
// ───────────────────────────────────────────────────────────────────────────

// Okuma tavanı; TAKİP edilen başlık sayısı plana bağlı (Free 10, Premium 100 —
// functions/planCapabilities.js, istemci aynası utils/premiumFeatures.js).
const STREAM_MAX_WATCHLIST_PER_USER = 100; // kullanıcı başına maliyet freni
const STREAM_MAX_USERS = 3000;             // tek çalışmada güvenlik tavanı

const STREAM_STRINGS = {
  tr: {
    single: (p) => `📺 ${p} platformunda izlenebilir`,
    multi: (ps) => `📺 Şu platformlarda izlenebilir: ${ps}`,
    fallbackTitle: "İzleme listen",
  },
  en: {
    single: (p) => `📺 Now streaming on ${p}`,
    multi: (ps) => `📺 Now streaming on: ${ps}`,
    fallbackTitle: "Your watchlist",
  },
  es: {
    single: (p) => `📺 Ya disponible en ${p}`,
    multi: (ps) => `📺 Ya disponible en: ${ps}`,
    fallbackTitle: "Tu lista de seguimiento",
  },
  pt: {
    single: (p) => `📺 Já disponível em ${p}`,
    multi: (ps) => `📺 Já disponível em: ${ps}`,
    fallbackTitle: "Sua lista para assistir",
  },
  de: {
    single: (p) => `📺 Jetzt verfügbar bei ${p}`,
    multi: (ps) => `📺 Jetzt verfügbar bei: ${ps}`,
    fallbackTitle: "Deine Merkliste",
  },
};

/** TMDB watch/providers — tek başlık (timeout'lu; hata → null). */
async function fetchWatchProviders(mediaType, tmdbId, apiKey) {
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/watch/providers`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Bir kullanıcıyı işler; bildirilen benzersiz başlık sayısını döner. */
async function processUserStreaming(userDoc, getProviders) {
  const uid = userDoc.id;
  const u = userDoc.data() || {};

  // SIRA: sağlayıcı kontrolü ÖNCE. Token'lar artık ayrı bir dokümanda
  // (Users/{uid}/private/push) yani okumaya mal oluyor; bu fonksiyon her gün
  // tüm kullanıcıları geziyor. Sağlayıcı seçmemiş kullanıcı zaten eleneceği
  // için o okumayı hiç yapmıyoruz.
  const sp = u.streamingProviders || {};
  const subscribedIds = (Array.isArray(sp.ids) ? sp.ids : [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (subscribedIds.length === 0) return 0;

  const { tokens, priv } = await loadPushTokens(uid, u);
  if (tokens.length === 0) return 0;

  const region = typeof sp.region === "string" && sp.region ? sp.region : "US";
  const lang = pickNotificationLang(u.notificationLanguage);
  const S = STREAM_STRINGS[lang];

  // İzleme listesi (maliyet freni).
  const wlSnap = await db
    .collection(`Lists/${uid}/watchList`)
    .limit(STREAM_MAX_WATCHLIST_PER_USER)
    .get();
  if (wlSnap.empty) {
    await db.doc(`ProviderWatch/${uid}`).set(
      { items: {}, region, updatedAt: FieldValue.serverTimestamp() },
      { merge: false },
    );
    return 0;
  }

  const snapRef = db.doc(`ProviderWatch/${uid}`);
  const prevItems = ((await snapRef.get()).data() || {}).items || {};
  const nextItems = {};
  const messages = [];

  // Plan tavanı (Free 10 / Premium 100): izleme listesine en son eklenen
  // başlıklar takip edilir. Tavan dışında kalanlar snapshot'tan düşer; plan
  // yükselince ilk görülmeleri taban sayılır (hasPrev=false) — bildirim
  // seli olmaz.
  const toMillis = (value) =>
    value?.toMillis?.() ?? (typeof value === "string" ? Date.parse(value) || 0 : 0);
  const trackedDocs = pickTrackedTitles(
    wlSnap.docs.map((itemDoc) => ({
      itemDoc,
      updatedAtMs: toMillis(itemDoc.get("updatedAt")),
    })),
    getStreamingAlertLimit(u.entitlements),
  ).map((entry) => entry.itemDoc);

  for (const itemDoc of trackedDocs) {
    const it = itemDoc.data() || {};
    const type = it.type === "tv" ? "tv" : "movie";
    const tmdbId = Number(it.id);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) continue;

    const key = itemDoc.id; // `${type}_${id}`
    const { ids: currentIds, names } = await getProviders(region, type, tmdbId);

    const prev = prevItems[key] || {};
    const hasPrev = Array.isArray(prev.a);
    const res = computeNewlyAvailable({
      currentIds,
      prevIds: prev.a || [],
      notifiedIds: prev.n || [],
      subscribedIds,
      hasPrev,
    });

    // Snapshot yalnız izleme listesindeki başlıkları tutar → liste ile senkron.
    nextItems[key] = { a: res.availableIds, n: res.notifiedIds };

    if (res.toNotify.length > 0) {
      const providerNames = res.toNotify.map((id) => names[id] || `#${id}`);
      const body =
        providerNames.length === 1
          ? S.single(providerNames[0])
          : S.multi(providerNames.join(", "));
      const title = it.name || S.fallbackTitle;
      for (const to of tokens) {
        messages.push({
          to,
          sound: "default",
          title,
          body,
          channelId: "reminders",
          priority: "high",
          data: {
            kind: "streaming",
            mediaType: type,
            tmdbId: String(tmdbId),
            providerIds: res.toNotify.join(","),
          },
        });
      }
    }
  }

  // Snapshot'ı yaz (izleme listesinden çıkanları düşürerek).
  await snapRef.set(
    { items: nextItems, region, updatedAt: FieldValue.serverTimestamp() },
    { merge: false },
  );

  if (messages.length === 0) return 0;

  // Gönder + ölü token temizliği (ortak döngü: karışık Expo projesi isteği
  // bölünür — bkz. expoSend.js).
  const deadTokens = await sendExpoPushes(expo, messages, { label: "streaming" });
  await clearDeadPushTokens(uid, u, priv, deadTokens);

  return new Set(messages.map((m) => m.title)).size;
}

exports.dailyStreamingAvailability = onSchedule(
  {
    ...CAPACITY.singleton,
    schedule: "0 18 * * *", // her gün 18:00
    timeZone: "Europe/Istanbul",
    secrets: [TMDB_API_KEY],
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const apiKey = TMDB_API_KEY.value();
    if (!apiKey) {
      console.error("[streaming] TMDB_API_KEY secret tanımsız — atlandı.");
      return;
    }

    const usersSnap = await db
      .collection("Users")
      .where("notificationSettings.streamingEnabled", "==", true)
      .limit(STREAM_MAX_USERS)
      .get();

    if (usersSnap.empty) {
      console.log("[streaming] özellik açık kullanıcı yok.");
      return;
    }

    // Aynı (region|type|id) için TMDB'yi TEK kez çek (çalışma-içi cache →
    // popüler başlıklar kullanıcılar arasında tekrar çekilmez).
    const providerCache = new Map();
    const getProviders = async (region, type, id) => {
      const cacheKey = `${region}|${type}|${id}`;
      if (providerCache.has(cacheKey)) return providerCache.get(cacheKey);
      const resp = await fetchWatchProviders(type, id, apiKey);
      const extracted = resp
        ? extractRegionProviders(resp, region)
        : { ids: [], names: {} };
      providerCache.set(cacheKey, extracted);
      return extracted;
    };

    let totalTitles = 0;
    for (const userDoc of usersSnap.docs) {
      try {
        totalTitles += await processUserStreaming(userDoc, getProviders);
      } catch (e) {
        console.error(`[streaming] kullanıcı ${userDoc.id}:`, e && e.message);
      }
    }

    console.log(
      `[streaming] tamam — kullanıcı: ${usersSnap.size}, bildirilen başlık: ${totalTitles}, benzersiz TMDB sorgusu: ${providerCache.size}`,
    );
  },
);

// ───────────────────────────────────────────────────────────────────────────
// HAFTALIK ÖZET BİLDİRİMİ ("Bu hafta çıkacaklar") — her Pazar 10:00 (Europe/Istanbul)
//
// Kullanıcının izleme listesindeki (Lists/{uid}/watchList) yapımlardan önümüzdeki 7 günde çıkacak olanları
// tek bildirimde toplar. Mantık saf + testli: weeklyDigest.js. Opt-in: notificationSettings.weeklyDigestEnabled
// === true (varsayılan KAPALI) ve notificationSettings.enabled !== false. Takip edilen oyuncu / yönetmenler
// ve hatırlatıcılar bu özete girmez (bkz. weeklyDigest.js başlığı).
//
// MALİYET: kullanıcı başına en çok 60 başlık (en son eklenenler); aynı (tür|id) için TMDB çalışma boyunca
// TEK kez sorulur — popüler başlıklar kullanıcılar arasında tekrar çekilmez. Kurulum: TMDB_API_KEY secret'ı
// (dailyStreamingAvailability ile ortak).
// ───────────────────────────────────────────────────────────────────────────
const DIGEST_MAX_USERS = 3000;
const DIGEST_MAX_TITLES_PER_USER = 60;

async function fetchTitleDetails(mediaType, tmdbId, apiKey) {
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Bir kullanıcıya özeti gönderir; gönderilen yapım sayısını döner (0 = bildirim yok). */
async function processUserDigest(userDoc, getDetails, window) {
  const uid = userDoc.id;
  const u = userDoc.data() || {};
  const ns = u.notificationSettings || {};
  if (ns.enabled === false || ns.weeklyDigestEnabled !== true) return 0;

  const { tokens, priv } = await loadPushTokens(uid, u);
  if (tokens.length === 0) return 0;

  const wlSnap = await db
    .collection(`Lists/${uid}/watchList`)
    .limit(STREAM_MAX_WATCHLIST_PER_USER)
    .get();
  if (wlSnap.empty) return 0;

  const toMillis = (value) =>
    value?.toMillis?.() ?? (typeof value === "string" ? Date.parse(value) || 0 : 0);
  const tracked = pickTrackedTitles(
    wlSnap.docs.map((itemDoc) => ({ itemDoc, updatedAtMs: toMillis(itemDoc.get("updatedAt")) })),
    DIGEST_MAX_TITLES_PER_USER,
  ).map((entry) => entry.itemDoc);

  const entries = [];
  for (const itemDoc of tracked) {
    const it = itemDoc.data() || {};
    const type = it.type === "tv" ? "tv" : "movie";
    const tmdbId = Number(it.id);
    if (!Number.isInteger(tmdbId) || tmdbId <= 0) continue;
    const details = await getDetails(type, tmdbId);
    const release = weeklyDigest.releaseInWindow(type, details, window);
    if (release) entries.push({ key: `${type}_${tmdbId}`, title: it.name || details?.title || details?.name || "", type, tmdbId, release });
  }

  const items = weeklyDigest.pickDigestItems(entries);
  const lang = pickNotificationLang(u.notificationLanguage);
  const message = weeklyDigest.buildDigestMessage(lang, items);
  if (!message) return 0;

  const messages = tokens.map((to) => ({
    to,
    sound: "default",
    title: message.title,
    body: message.body,
    channelId: "reminders",
    data: { kind: "weeklyDigest", count: String(items.length) },
  }));

  const deadTokens = await sendExpoPushes(expo, messages, { label: "weeklyDigest" });
  await clearDeadPushTokens(uid, u, priv, deadTokens);
  return items.length;
}

exports.weeklyReleaseDigest = onSchedule(
  {
    ...CAPACITY.singleton,
    schedule: "0 10 * * 0", // her Pazar 10:00
    timeZone: "Europe/Istanbul",
    secrets: [TMDB_API_KEY],
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const apiKey = TMDB_API_KEY.value();
    if (!apiKey) {
      console.error("[weeklyDigest] TMDB_API_KEY secret tanımsız — atlandı.");
      return;
    }
    const usersSnap = await db
      .collection("Users")
      .where("notificationSettings.weeklyDigestEnabled", "==", true)
      .limit(DIGEST_MAX_USERS)
      .get();
    if (usersSnap.empty) {
      console.log("[weeklyDigest] özellik açık kullanıcı yok.");
      return;
    }

    const window = weeklyDigest.weekWindow(new Date());
    const detailsCache = new Map();
    const getDetails = async (type, id) => {
      const key = `${type}|${id}`;
      if (detailsCache.has(key)) return detailsCache.get(key);
      const details = await fetchTitleDetails(type, id, apiKey);
      detailsCache.set(key, details);
      return details;
    };

    let users = 0;
    let titles = 0;
    for (const userDoc of usersSnap.docs) {
      try {
        const sent = await processUserDigest(userDoc, getDetails, window);
        if (sent > 0) users += 1;
        titles += sent;
      } catch (e) {
        console.error(`[weeklyDigest] kullanıcı ${userDoc.id}:`, e && e.message);
      }
    }
    console.log(
      `[weeklyDigest] tamam — pencere ${window.from}..${window.to}, kullanıcı: ${usersSnap.size}, bildirim: ${users}, yapım: ${titles}, benzersiz TMDB sorgusu: ${detailsCache.size}`,
    );
  },
);

// ───────────────────────────────────────────────────────────────────────────
// AYLIK TURNUVA — KAZANAN ARŞİVİ
//
// Biten her ayın podyumunu tournamentWinners/{YYYY-MM} altına yazar; uygulama
// "Geçen Ayın Kazananı" sayfasındaki GEÇMİŞ KAZANANLAR listesini buradan okur
// (aksi halde her geçmiş ay için doküman + agg + havuz okuması gerekirdi).
//
// Neden sunucu? Şampiyon istemcide de türetilebilir ama arşiv KALICI bir kayıt:
// istemciye yazdırmak sahte şampiyon enjeksiyonuna açık olurdu. Admin SDK
// kuralları es geçer, rules tarafında koleksiyon salt-okunurdur.
//
// Determinizm: hesap functions/tournamentBracket.js'te (motorun birebir
// kopyası, __tests__/tournamentWinnerArchive.test.js ile kilitli). Zaman
// duyarlılığı yok — yalnız BİTMİŞ aylar işlenir ve bracket "ay başı + 40 gün"
// anına göre çözülür, yani sunucunun UTC olması sonucu değiştirmez.
//
// Idempotent: var olan kayıt bir daha yazılmaz (create-if-absent). Yeniden
// hesaplatmak istersen ilgili tournamentWinners dokümanını silmek yeterli.
// ───────────────────────────────────────────────────────────────────────────

const ARCHIVE_MAX_PERIODS_PER_RUN = 24; // ilk çalışmada geçmişi toparlar

// Bir yarışmacıyı arşiv kaydına uygun sade şekle indirger.
function archiveEntry(c, totalVotes) {
  if (!c) return null;
  return {
    id: c.id,
    title: c.title || "—",
    posterPath: c.posterPath || null,
    mediaType: c.mediaType || null,
    seed: c.seed || null,
    totalVotes: totalVotes || 0,
  };
}

// Bir dönemin oy sayımları: önce agg dokümanı, yoksa votes koleksiyonu.
async function readPeriodTallies(periodId) {
  const aggSnap = await db.doc(`tournaments/${periodId}/agg/tallies`).get();
  if (aggSnap.exists) {
    const a = aggSnap.data() || {};
    return { nomTally: a.noms || {}, tallies: a.picks || {}, voters: a.voters || 0 };
  }
  const votesSnap = await db.collection(`tournaments/${periodId}/votes`).get();
  const votes = votesSnap.docs.map((d) => d.data());
  return {
    nomTally: tournamentBracket.tallyNominations(votes),
    tallies: tournamentBracket.tallyVotes(votes),
    voters: votesSnap.size,
  };
}

// Topluluğun aramayla eklediği adaylar — istemcideki havuzla AYNI olmalı,
// yoksa arşivdeki şampiyon ekranda görünenden farklı çıkabilir.
async function readPeriodPool(periodId) {
  const snap = await db.collection(`tournaments/${periodId}/pool`).get();
  return snap.docs.map((d) => {
    const v = d.data() || {};
    const num = Number(d.id);
    return {
      id: Number.isFinite(num) ? num : d.id,
      title: v.title || "—",
      posterPath: v.posterPath || null,
      mediaType: v.mediaType || null,
      popularity: v.popularity || 0,
      voteAverage: v.voteAverage || 0,
      year: v.year || null,
      addedAtMs: v.addedAt && v.addedAt.toMillis ? v.addedAt.toMillis() : 0,
    };
  });
}

async function archivePeriod(periodId, tournament) {
  const [{ nomTally, tallies, voters }, suggested] = await Promise.all([
    readPeriodTallies(periodId),
    readPeriodPool(periodId),
  ]);

  const podium = tournamentBracket.resolvePodium({
    periodId,
    nominees: tournament.nominees || [],
    suggested,
    nomTally,
    tallies,
  });
  if (!podium) {
    console.log(`[turnuva-arşiv] ${periodId}: şampiyon türetilemedi (aday yok) — atlandı.`);
    return false;
  }

  const parsed = tournamentBracket.parsePeriodId(periodId);
  await db.doc(`tournamentWinners/${periodId}`).create({
    periodId,
    // İstek: kazananlar YIL ve AY olarak kayıtlı olsun.
    year: parsed.year,
    monthIndex: parsed.monthIndex,
    theme: tournament.theme || null,
    themeEn: tournament.themeEn || null,
    mediaType: tournament.mediaType || null,
    genreId: tournament.genreId || null,
    champion: archiveEntry(podium.champion, podium.championTotalVotes),
    runnerUp: archiveEntry(podium.runnerUp, podium.runnerUpTotalVotes),
    third: archiveEntry(podium.third, podium.thirdTotalVotes),
    finalVotes: podium.finalVotes,
    finalTotal: podium.finalTotal,
    totalVotes: podium.totalVotes,
    voters,
    poolSize: (tournament.nominees || []).length + suggested.length,
    archivedAt: FieldValue.serverTimestamp(),
  });
  console.log(
    `[turnuva-arşiv] ${periodId}: ${podium.champion.title} (toplam oy ${podium.totalVotes}, katılımcı ${voters}).`,
  );
  return true;
}

exports.archiveTournamentWinners = onSchedule(
  {
    ...CAPACITY.singleton,
    schedule: "30 3 * * *", // her gün 03:30 — ay dönümünü ertesi gün yakalar
    timeZone: "Europe/Istanbul",
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async () => {
    // Yalnız BİTMİŞ dönemler arşivlenir: periodId'ler sıfır dolgulu olduğu için
    // ("2026-03") dizgi karşılaştırması kronolojik sırayla aynıdır.
    const nowIst = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Europe/Istanbul" }),
    );
    const currentPeriod = `${nowIst.getFullYear()}-${String(nowIst.getMonth() + 1).padStart(2, "0")}`;

    // Arşivlenmiş dönemler ÖNCE elenir, kota SONRA uygulanır. Tersi olsaydı
    // (önce kes, sonra ele) kota kadar yeni dönem her çalışmada slotları
    // doldurur, geçmişteki eski aylara HİÇ sıra gelmezdi.
    const [tournSnap, winnersSnap] = await Promise.all([
      db.collection("tournaments").get(),
      db.collection("tournamentWinners").get(),
    ]);
    const archived = new Set(winnersSnap.docs.map((d) => d.id));
    const pending = tournSnap.docs
      .filter((d) => d.id < currentPeriod && !archived.has(d.id))
      .sort((a, b) => (a.id < b.id ? 1 : -1)) // yeniden eskiye
      .slice(0, ARCHIVE_MAX_PERIODS_PER_RUN);

    let written = 0;
    for (const d of pending) {
      try {
        if (await archivePeriod(d.id, d.data() || {})) written += 1;
      } catch (e) {
        // ALREADY_EXISTS: iki çalışma yarıştı — sorun değil, kayıt zaten var.
        if (e && e.code === 6) continue;
        console.error(`[turnuva-arşiv] ${d.id}:`, e);
      }
    }

    console.log(
      `[turnuva-arşiv] tamam — bekleyen dönem: ${pending.length}, yeni kayıt: ${written}, arşivde: ${archived.size}.`,
    );
  },
);


// CineSwipe: wait until both devices have saved the final result locally.
const { resultsDelivered, deleteDeliveredRoom, deleteExpiredRooms } = require("./cineRoomCleanup");
exports.cleanupDeliveredCineRoom = onDocumentUpdated(
  { ...CAPACITY.trigger, document: "CineRooms/{roomId}", retry: true },
  async (event) => {
    if (event.data?.after && resultsDelivered(event.data.after.data())) {
      await deleteDeliveredRoom(db, event.data.after.ref);
    }
  },
);

// Fallback for disconnected/abandoned clients (including legacy rooms).
exports.cleanupExpiredCineRooms = onSchedule(
  { ...CAPACITY.singleton, schedule: "every 15 minutes", timeoutSeconds: 300 },
  async () => {
    const { Timestamp } = require("firebase-admin/firestore");
    await deleteExpiredRooms(db, Timestamp);
  },
);
