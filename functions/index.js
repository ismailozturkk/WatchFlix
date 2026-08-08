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
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
// firebase-admin v14: eski namespaced API (admin.firestore()) KALDIRILDI —
// modüler girişler kullanılır (firebase-admin/app + firebase-admin/firestore).
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { Expo } = require("expo-server-sdk");
const { createHash, timingSafeEqual } = require("node:crypto");
const { extractRegionProviders, computeNewlyAvailable } = require("./streamingDiff");
const tournamentBracket = require("./tournamentBracket");
const {
  getTransferChanges,
  parseRevenueCatPremiumState,
  resolveFirebaseUserId,
  resolvePremiumWebhookState,
} = require("./revenueCatWebhook");

initializeApp();
const db = getFirestore();
const expo = new Expo();

// Aynı anda çok fazla instance açıp maliyeti şişirmemek için tavan.
setGlobalOptions({ maxInstances: 10 });

// Google native SDK'nin idToken'i bu web OAuth client'i icin uretilir.
// Istemcideki googleAuthService WEB_CLIENT_ID ile ayni kalmali.
const GOOGLE_WEB_CLIENT_ID =
  "427087836931-in7lreg3vjgnvudn5h8gauradaeo58kc.apps.googleusercontent.com";

// RevenueCat Dashboard > Integrations > Webhooks ekranındaki Authorization
// header ile aynı olmalı. Public SDK anahtarı değildir.
const REVENUECAT_WEBHOOK_AUTH = defineSecret("REVENUECAT_WEBHOOK_AUTH");
const REVENUECAT_SECRET_API_KEY = defineSecret("REVENUECAT_SECRET_API_KEY");

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

function premiumEntitlementPatch(event, state) {
  return {
    entitlements: {
      premium: state.premium,
      premiumUnlimited: state.premiumUnlimited,
      premiumPlan: state.premiumPlan,
      premiumProductId: state.productId,
      premiumStore: event.store || null,
      premiumExpiresAt: state.expiresAt,
      premiumSyncedAt: FieldValue.serverTimestamp(),
      premiumSource: "revenuecat",
    },
  };
}

exports.revenueCatWebhook = onRequest(
  {
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

      for (const change of changes) {
        tx.set(
          db.doc(`Users/${change.uid}`),
          premiumEntitlementPatch(event, change.state),
          { merge: true },
        );
      }
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
exports.checkGoogleSignInEligibility = onCall(async (request) => {
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
// dokümanında transaction'lı sayaç (UTC). Free 5/30, Premium 20/300,
// Unlimited 50/900.
// Premium durumu Users/{uid}.entitlements.premium alanından okunur (Faz 1'de
// RevenueCat webhook'u bu alanı dolduracak; alan yoksa herkes free'dir).
//
// App Check: Faz 0 Hafta 2'de Play Integrity kurulunca aşağıdaki
// enforceAppCheck true yapılmalı (şimdilik false — istemcide App Check yok).
// ───────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
// TMDB v4 "Read Access Token" — watch/providers sorgusu için (streaming
// uygunluk bildirimleri). Kurulum: firebase functions:secrets:set TMDB_API_KEY
const TMDB_API_KEY = defineSecret("TMDB_API_KEY");

const AI_MODEL = "gemini-2.5-flash";
const AI_UPSTREAM_TIMEOUT_MS = 25000;
// İstek boyutu tavanları (kötüye kullanım / maliyet freni)
const AI_MAX_HISTORY = 12;          // istemcideki MAX_HISTORY_MESSAGES ile aynı
const AI_MAX_MSG_CHARS = 4000;      // tek kullanıcı mesajı
const AI_MAX_HISTORY_CHARS = 8000;  // geçmişteki tek mesaj
const AI_MAX_SYSTEM_CHARS = 24000;  // sistem talimatı (kütüphane özeti dahil)

const aiSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** UTC gün anahtarı (kota penceresi). */
function aiTodayKey() {
  return new Date().toISOString().slice(0, 10); // "2026-07-08"
}

/** UTC ay anahtarı. */
function aiMonthKey() {
  return new Date().toISOString().slice(0, 7); // "2026-07"
}

/** İstemciden gelen history'yi doğrula + Gemini `contents` dizisine çevir. */
function buildAiContents(history, userMessage) {
  const contents = [];
  const recent = Array.isArray(history) ? history.slice(-AI_MAX_HISTORY) : [];
  for (const m of recent) {
    if (!m || typeof m.text !== "string" || m.text.trim() === "") continue;
    if (m.text.length > AI_MAX_HISTORY_CHARS) {
      throw new HttpsError("invalid-argument", "History message too long");
    }
    contents.push({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: m.text }],
    });
  }
  contents.push({ role: "user", parts: [{ text: userMessage }] });
  return contents;
}

/** Kota transaction'ı: günlük ve aylık hakkı birlikte, atomik olarak tüketir. */
async function consumeAiQuota(uid, plan) {
  const ref = db.doc(`AiUsage/${uid}`);
  const today = aiTodayKey();
  const month = aiMonthKey();
  const limits = getAiPlanLimits(plan);
  return db.runTransaction(async (tx) => {
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
}

/** Üst akış hatasında günlük ve aylık sayaçları birlikte geri al. */
async function refundAiQuota(uid) {
  try {
    const ref = db.doc(`AiUsage/${uid}`);
    const today = aiTodayKey();
    const month = aiMonthKey();
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

/** Gemini generateContent'e tek istek (timeout'lu). */
async function postGeminiOnce(body, apiKey) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${AI_MODEL}` +
    `:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_UPSTREAM_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    const e = new Error(err?.name === "AbortError" ? "UPSTREAM_TIMEOUT" : "UPSTREAM_NETWORK");
    e.transient = true;
    throw e;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let detail = "";
    try {
      detail = await res.text();
    } catch {
      /* yoksay */
    }
    // Anahtar sızıntısı olmasın: detail'i logla ama istemciye statü dışında bilgi verme.
    console.warn(`[callGemini] Gemini HTTP ${res.status}: ${detail.slice(0, 500)}`);
    const e = new Error(`UPSTREAM_${res.status}`);
    e.status = res.status;
    e.transient = res.status === 500 || res.status === 503;
    throw e;
  }
  return res.json();
}

exports.callGemini = onCall(
  {
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

    // ── Girdi doğrulama ──
    const { mode, history, userMessage, systemInstruction } = request.data || {};
    if (mode !== "chat" && mode !== "cine") {
      throw new HttpsError("invalid-argument", "mode must be 'chat' or 'cine'");
    }
    if (typeof userMessage !== "string" || userMessage.trim() === "") {
      throw new HttpsError("invalid-argument", "userMessage required");
    }
    if (userMessage.length > AI_MAX_MSG_CHARS) {
      throw new HttpsError("invalid-argument", "userMessage too long");
    }
    if (typeof systemInstruction !== "string" || systemInstruction.trim() === "") {
      throw new HttpsError("invalid-argument", "systemInstruction required");
    }
    if (systemInstruction.length > AI_MAX_SYSTEM_CHARS) {
      throw new HttpsError("invalid-argument", "systemInstruction too long");
    }
    const contents = buildAiContents(history, userMessage);

    // ── Üyelik seviyesi → kota tavanı ──
    let plan = "free";
    try {
      const userSnap = await db.doc(`Users/${uid}`).get();
      const entitlements = userSnap.data()?.entitlements;
      plan = resolveAiPlan(entitlements);
    } catch (e) {
      console.warn("[callGemini] Users okunamadı (free varsayıldı):", e?.message);
    }

    // ── Kota tüket (yetersizse burada resource-exhausted fırlar) ──
    const quota = await consumeAiQuota(uid, plan);

    // ── Gemini isteği ──
    const body = {
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: mode === "cine" ? 0.8 : 0.85,
        topP: 0.95,
        topK: 40,
        // CineMatch yalnız kompakt JSON döndürür; düz sohbet biraz daha geniş kalır.
        maxOutputTokens: mode === "cine" ? 1200 : 2048,
        responseMimeType: mode === "cine" ? "application/json" : "text/plain",
        thinkingConfig: { thinkingBudget: 0 },
      },
      safetySettings: [
        "HARM_CATEGORY_HARASSMENT",
        "HARM_CATEGORY_HATE_SPEECH",
        "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        "HARM_CATEGORY_DANGEROUS_CONTENT",
      ].map((category) => ({ category, threshold: "BLOCK_ONLY_HIGH" })),
    };

    const apiKey = GEMINI_API_KEY.value();
    if (!apiKey) {
      await refundAiQuota(uid);
      console.error("[callGemini] GEMINI_API_KEY secret tanımsız!");
      throw new HttpsError("failed-precondition", "AI is not configured");
    }

    try {
      let data;
      try {
        data = await postGeminiOnce(body, apiKey);
      } catch (err) {
        if (!err.transient) throw err;
        await aiSleep(800); // geçici hatada tek retry (istemcideki davranışla aynı)
        data = await postGeminiOnce(body, apiKey);
      }
      const u = data?.usageMetadata || {};
      const quotaLabel =
        `${quota.plan} daily=${quota.daily.used}/${quota.daily.limit} ` +
        `monthly=${quota.monthly.used}/${quota.monthly.limit}`;
      console.log(
        `[callGemini] uid=${uid} mode=${mode} kota=${quotaLabel} ` +
          `token(giriş/çıkış/toplam)=${u.promptTokenCount || 0}/${u.candidatesTokenCount || 0}/${u.totalTokenCount || 0}`,
      );
      return { data, quota };
    } catch (err) {
      // Üst akış başarısız → kullanıcının hakkını iade et.
      await refundAiQuota(uid);
      if (err.status === 429) {
        throw new HttpsError("resource-exhausted", "Upstream rate limited", {
          reason: "UPSTREAM_RATE_LIMIT",
        });
      }
      if (err.message === "UPSTREAM_TIMEOUT") {
        throw new HttpsError("deadline-exceeded", "Upstream timeout");
      }
      if (err.transient || err.message === "UPSTREAM_NETWORK") {
        throw new HttpsError("unavailable", "Upstream unavailable");
      }
      console.error("[callGemini] hata:", err?.message);
      throw new HttpsError("internal", "AI request failed");
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
};

// notification.type → {title, body}. lang: "tr" | "en".
function buildContent(n, lang) {
  const S = STRINGS[lang === "en" ? "en" : "tr"];
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
    default:
      return { title: S.notification, body: name };
  }
}

exports.onSocialNotificationCreated = onDocumentCreated(
  "Users/{uid}/notifications/{notifId}",
  async (event) => {
    const snap = event.data;
    if (!snap) return;

    const n = snap.data() || {};
    const recipientUid = event.params.uid;
    const notifId = event.params.notifId;

    // Alıcının token'larını oku.
    let userData;
    try {
      const userSnap = await db.doc(`Users/${recipientUid}`).get();
      if (!userSnap.exists) return;
      userData = userSnap.data() || {};
    } catch (e) {
      console.error("Kullanıcı dökümanı okunamadı:", e);
      return;
    }

    // Tür-bazlı ayar kontrolü. İstemci Users/{uid}.notificationSettings'e yansıtır.
    // Ayar yoksa/alan tanımsızsa → GÖNDER (eski kullanıcıları susturmamak için);
    // yalnızca açıkça false ise atla. İstemci foreground filtresiyle tutarlı.
    const ns = userData.notificationSettings || {};
    if (ns.enabled === false) {
      console.log(`Bildirimler kapalı (master): ${recipientUid}`);
      return;
    }
    const TYPE_SETTING_KEY = {
      friend_request: "friendRequestsEnabled",
      friend_accepted: "friendAcceptedEnabled",
      post_like: "postLikesEnabled",
      post_comment: "postCommentsEnabled",
      comment_reply: "postCommentsEnabled",
      mention: "mentionsEnabled",
      message: "messagesEnabled",
    };
    const settingKey = TYPE_SETTING_KEY[n.type];
    if (settingKey && ns[settingKey] === false) {
      console.log(`Tür kapalı (${n.type}): ${recipientUid}`);
      return;
    }

    // expoPushToken (tek) + expoPushTokens (dizi) → birleştir, tekille, geçerli olanları al.
    const tokenSet = new Set();
    if (userData.expoPushToken) tokenSet.add(userData.expoPushToken);
    if (Array.isArray(userData.expoPushTokens)) {
      userData.expoPushTokens.forEach((t) => t && tokenSet.add(t));
    }
    const tokens = [...tokenSet].filter((t) => Expo.isExpoPushToken(t));
    if (tokens.length === 0) {
      console.log(`Geçerli Expo push token yok: ${recipientUid}`);
      return;
    }

    // Dil: istemci Users/{uid}.notificationLanguage'a yansıtır (tr varsayılan).
    const lang = userData.notificationLanguage === "en" ? "en" : "tr";
    const { title, body } = buildContent(n, lang);
    const messages = tokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      channelId: "social", // istemcideki Android kanalıyla aynı
      priority: "high",
      data: {
        kind: "social",
        type: n.type || "",
        notifId,
        postId: n.postId || null,
        fromUid: n.fromUid || null,
        fromName: n.fromName || null,
        groupId: n.groupId || null,
        groupName: n.groupName || null,
      },
    }));

    // Gönder (chunk'lı) + ölü token tespiti.
    const deadTokens = [];
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk);
        tickets.forEach((ticket, i) => {
          if (
            ticket.status === "error" &&
            ticket.details &&
            ticket.details.error === "DeviceNotRegistered"
          ) {
            deadTokens.push(chunk[i].to);
          }
        });
      } catch (e) {
        console.error("Expo push gönderim hatası:", e);
      }
    }

    // Uygulaması silinmiş/çıkış yapılmış cihazların token'larını temizle.
    // Legacy tek alan (expoPushToken) da gönderim setine giriyor — yalnız
    // diziden silersek ölü token oradan sonsuza dek yeniden denenir.
    if (deadTokens.length) {
      try {
        const patch = { expoPushTokens: FieldValue.arrayRemove(...deadTokens) };
        if (userData.expoPushToken && deadTokens.includes(userData.expoPushToken)) {
          patch.expoPushToken = FieldValue.delete();
        }
        await db.doc(`Users/${recipientUid}`).update(patch);
      } catch (e) {
        console.error("Ölü token temizliği hatası:", e);
      }
    }

    console.log(
      `Push gönderildi → ${recipientUid} | tür: ${n.type} | cihaz: ${tokens.length} | ölü: ${deadTokens.length}`,
    );
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
// Kapsam (kullanıcı kararı): Posts + post yorumları, arkadaş kayıtları + istekler
// (friendRequests/sentRequests), bildirimler. Film/dizi yorumları KAPSAM DIŞI.
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

exports.onUserProfileUpdated = onDocumentUpdated("Users/{uid}", async (event) => {
  const uid = event.params.uid;
  const before = event.data?.before?.data() || {};
  const after = event.data?.after?.data() || {};

  const nameChanged = before.displayName !== after.displayName;
  const userChanged = before.username !== after.username;
  const avaChanged = before.avatarIndex !== after.avatarIndex;
  if (!nameChanged && !userChanged && !avaChanged) return; // ilgisiz güncelleme

  const name = typeof after.displayName === "string" ? after.displayName : "";
  const username = typeof after.username === "string" ? after.username : "";
  const avatarIndex = typeof after.avatarIndex === "number" ? after.avatarIndex : 0;

  // Hedefe göre yalnız DEĞİŞEN alanları içeren patch'ler (gereksiz yazma yok).
  const patchAuthor = {}; // Posts + post yorumları (username tutmaz)
  if (nameChanged) patchAuthor.authorName = name;
  if (avaChanged) patchAuthor.authorAvatarIndex = avatarIndex;

  const patchFriend = {}; // Users/{friendUid}/friends/{uid}
  if (nameChanged) patchFriend.friendName = name;
  if (userChanged) patchFriend.friendUsername = username;
  if (avaChanged) patchFriend.friendAvatarIndex = avatarIndex;

  const patchFrom = {}; // friendRequests (fromUid==uid)
  if (nameChanged) patchFrom.fromName = name;
  if (userChanged) patchFrom.fromUsername = username;
  if (avaChanged) patchFrom.fromAvatarIndex = avatarIndex;

  const patchTo = {}; // sentRequests (toUid==uid) — karşı tarafın listesindeki ben
  if (nameChanged) patchTo.toName = name;
  if (userChanged) patchTo.toUsername = username;
  if (avaChanged) patchTo.toAvatarIndex = avatarIndex;

  const patchNotif = {}; // notifications (fromUid==uid) — username tutmaz
  if (nameChanged) patchNotif.fromName = name;
  if (avaChanged) patchNotif.fromAvatarIndex = avatarIndex;

  const log = (k, c) => console.log(`profil fan-out [${k}] uid=${uid}: ${c}`);

  // 1) Postlar (authorId==uid) + 2) post yorumları (collectionGroup "comments")
  if (Object.keys(patchAuthor).length) {
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

  // 3) Arkadaş kayıtları: her arkadaşın listesindeki benim kaydım.
  if (Object.keys(patchFriend).length) {
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
  if (Object.keys(patchFrom).length) {
    try {
      const s = await db.collectionGroup("friendRequests").where("fromUid", "==", uid).get();
      log("friendRequests", await commitRefs(s.docs.map((d) => d.ref), patchFrom));
    } catch (e) {
      console.error("fan-out friendRequests:", e);
    }
  }

  // 5) Giden istekler (başka kullanıcıların bana gönderdiği sentRequests'te toUid==uid)
  if (Object.keys(patchTo).length) {
    try {
      const s = await db.collectionGroup("sentRequests").where("toUid", "==", uid).get();
      log("sentRequests", await commitRefs(s.docs.map((d) => d.ref), patchTo));
    } catch (e) {
      console.error("fan-out sentRequests:", e);
    }
  }

  // 6) Bildirimler (başka kullanıcıların notifications'ında fromUid==uid)
  if (Object.keys(patchNotif).length) {
    try {
      const s = await db.collectionGroup("notifications").where("fromUid", "==", uid).get();
      log("notifications", await commitRefs(s.docs.map((d) => d.ref), patchNotif));
    } catch (e) {
      console.error("fan-out notifications:", e);
    }
  }

  // 7) Gruplar: üyesi olduğum grupların memberInfo.{uid} kaydı. Grup sohbetinde
  //    gönderen ad/avatar bu denormalize alandan CANLI çözülür (istemci),
  //    böylece eski mesajlar da güncel ad/avatarı gösterir. username tutulmaz →
  //    yalnız isim veya avatar değişince güncelle.
  if (nameChanged || avaChanged) {
    try {
      const s = await db
        .collection("groups")
        .where("members", "array-contains", uid)
        .get();
      const memberPatch = { [`memberInfo.${uid}`]: { name, avatarIndex } };
      log("groups", await commitRefs(s.docs.map((d) => d.ref), memberPatch));
    } catch (e) {
      console.error("fan-out groups:", e);
    }
  }
});

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
  "tournaments/{periodId}/votes/{voterUid}",
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

  // Geçerli Expo token'ları.
  const tokenSet = new Set();
  if (u.expoPushToken) tokenSet.add(u.expoPushToken);
  if (Array.isArray(u.expoPushTokens)) u.expoPushTokens.forEach((t) => t && tokenSet.add(t));
  const tokens = [...tokenSet].filter((t) => Expo.isExpoPushToken(t));
  if (tokens.length === 0) return 0;

  // Abone olunan sağlayıcılar + bölge.
  const sp = u.streamingProviders || {};
  const subscribedIds = (Array.isArray(sp.ids) ? sp.ids : [])
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  if (subscribedIds.length === 0) return 0;
  const region = typeof sp.region === "string" && sp.region ? sp.region : "US";
  const lang = u.notificationLanguage === "en" ? "en" : "tr";
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

  for (const itemDoc of wlSnap.docs) {
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

  // Gönder + ölü token temizliği (onSocialNotificationCreated ile aynı desen).
  const deadTokens = [];
  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (
          ticket.status === "error" &&
          ticket.details &&
          ticket.details.error === "DeviceNotRegistered"
        ) {
          deadTokens.push(chunk[i].to);
        }
      });
    } catch (e) {
      console.error("[streaming] push hatası:", e && e.message);
    }
  }
  if (deadTokens.length) {
    const patch = { expoPushTokens: FieldValue.arrayRemove(...deadTokens) };
    if (u.expoPushToken && deadTokens.includes(u.expoPushToken)) {
      patch.expoPushToken = FieldValue.delete();
    }
    await db.doc(`Users/${uid}`).update(patch).catch(() => {});
  }

  return new Set(messages.map((m) => m.title)).size;
}

exports.dailyStreamingAvailability = onSchedule(
  {
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
