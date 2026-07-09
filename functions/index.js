// functions/index.js
//
// Watchify push bildirim sunucusu (Cloud Functions v2 + Expo Push API).
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
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { defineSecret } = require("firebase-functions/params");
// firebase-admin v14: eski namespaced API (admin.firestore()) KALDIRILDI —
// modüler girişler kullanılır (firebase-admin/app + firebase-admin/firestore).
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { Expo } = require("expo-server-sdk");

initializeApp();
const db = getFirestore();
const expo = new Expo();

// Aynı anda çok fazla instance açıp maliyeti şişirmemek için tavan.
setGlobalOptions({ maxInstances: 10 });

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
// Kota: kullanıcı başına GÜNLÜK mesaj tavanı — AiUsage/{uid} dokümanında
// transaction'lı sayaç (UTC gün). Free 5 / premium 100 (yol haritası §2.1).
// Premium durumu Users/{uid}.entitlements.premium alanından okunur (Faz 1'de
// RevenueCat webhook'u bu alanı dolduracak; alan yoksa herkes free'dir).
//
// App Check: Faz 0 Hafta 2'de Play Integrity kurulunca aşağıdaki
// enforceAppCheck true yapılmalı (şimdilik false — istemcide App Check yok).
// ───────────────────────────────────────────────────────────────────────────

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

const AI_MODEL = "gemini-2.5-flash";
const AI_DAILY_LIMIT_FREE = 5;
const AI_DAILY_LIMIT_PREMIUM = 100;
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

/** Kota transaction'ı: hakkı varsa sayacı artırır, yoksa resource-exhausted atar. */
async function consumeAiQuota(uid, limit) {
  const ref = db.doc(`AiUsage/${uid}`);
  const today = aiTodayKey();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const used = data.date === today ? data.count || 0 : 0;
    if (used >= limit) {
      throw new HttpsError("resource-exhausted", "Daily AI quota exceeded", {
        reason: "DAILY_QUOTA",
        used,
        limit,
      });
    }
    tx.set(
      ref,
      {
        date: today,
        count: used + 1,
        limit,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { used: used + 1, limit, remaining: limit - used - 1 };
  });
}

/** Üst akış hatasında sayacı geri al (kullanıcı hakkı boşa gitmesin). */
async function refundAiQuota(uid) {
  try {
    const ref = db.doc(`AiUsage/${uid}`);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data();
      if (data.date !== aiTodayKey() || !(data.count > 0)) return;
      tx.update(ref, { count: data.count - 1 });
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

    // ── Premium → kota tavanı ──
    let limit = AI_DAILY_LIMIT_FREE;
    try {
      const userSnap = await db.doc(`Users/${uid}`).get();
      if (userSnap.exists && userSnap.data()?.entitlements?.premium === true) {
        limit = AI_DAILY_LIMIT_PREMIUM;
      }
    } catch (e) {
      console.warn("[callGemini] Users okunamadı (free varsayıldı):", e?.message);
    }

    // ── Kota tüket (yetersizse burada resource-exhausted fırlar) ──
    const quota = await consumeAiQuota(uid, limit);

    // ── Gemini isteği ──
    const body = {
      contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: mode === "cine" ? 0.8 : 0.85,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
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
      console.log(
        `[callGemini] uid=${uid} mode=${mode} kota=${quota.used}/${quota.limit} ` +
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
    if (deadTokens.length) {
      try {
        await db.doc(`Users/${recipientUid}`).update({
          expoPushTokens: FieldValue.arrayRemove(...deadTokens),
        });
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
      log("friends", await commitRefs(refs, patchFriend));
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
