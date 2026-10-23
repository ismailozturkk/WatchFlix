"use strict";

// functions/expoSend.js
//
// Expo push gönderim döngüsü — TÜM push tetikleyicilerinin ortak yolu
// (socialPush.js, dailyStreamingAvailability, weeklyReleaseDigest).
//
// Expo, bir istekte birden çok projenin (ör. eski geliştirme build'i + yeni
// build) token'ı varsa İSTEĞİN TAMAMINI `PUSH_TOO_MANY_EXPERIENCE_IDS` ile reddeder;
// `details` = { proje: [token] }. 22 Eki günlüklerinde görüldü: böyle bir
// kullanıcıya hiçbir cihazından push gitmiyordu. Burada istek projeye göre bölünüp
// her parça ayrı gönderilir (tek seviye; bölünmüş parça yine reddedilirse
// yeniden denenmez).

const MIXED_PROJECTS_ERROR = "PUSH_TOO_MANY_EXPERIENCE_IDS";

/**
 * Karışık proje hatasındaki `details`e göre mesajları proje gruplarına böler.
 * `details`te geçmeyen token'lar kendi grubunda toplanır.
 */
function splitByProject(messages, details) {
  const projectOf = new Map();
  for (const [project, tokens] of Object.entries(details || {})) {
    for (const token of Array.isArray(tokens) ? tokens : []) projectOf.set(token, project);
  }
  const groups = new Map();
  for (const m of messages) {
    const key = projectOf.has(m.to) ? `p:${projectOf.get(m.to)}` : "?";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  return [...groups.values()];
}

/**
 * Mesajları Expo'nun 100'lük parçalarında gönderir.
 * @param {{ chunkPushNotifications: Function, sendPushNotificationsAsync: Function }} expo
 * @param {Array<{ to: string }>} messages  her mesajda tek token (`to` string)
 * @param {{ log?: Pick<Console, "warn" | "error">, label?: string }} [opts]
 * @returns {Promise<string[]>} `DeviceNotRegistered` dönen (ölü) token'lar
 */
async function sendExpoPushes(expo, messages, { log = console, label = "push" } = {}) {
  const dead = [];
  const sendChunk = async (chunk, allowSplit) => {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          dead.push(chunk[i].to);
        }
      });
    } catch (e) {
      if (allowSplit && e?.code === MIXED_PROJECTS_ERROR) {
        const groups = splitByProject(chunk, e.details);
        if (groups.length > 1) {
          log.warn(`[${label}] karışık Expo projesi: istek ${groups.length} parçaya bölündü`);
          for (const group of groups) await sendChunk(group, false);
          return;
        }
      }
      log.error(`[${label}] Expo push gönderim hatası:`, e?.message || e);
    }
  };
  for (const chunk of expo.chunkPushNotifications(messages || [])) await sendChunk(chunk, true);
  return dead;
}

module.exports = { MIXED_PROJECTS_ERROR, splitByProject, sendExpoPushes };
