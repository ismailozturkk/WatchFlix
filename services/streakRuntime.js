// services/streakRuntime.js
//
// Seri köprüsünün (utils/streakBridge) GERÇEK uygulamaları: sunucu saati, Firestore
// eşitlemesi (Users/{uid}/private/streak) ve hatırlatma bildirimi. App.js açılışta
// `startStreakRuntime()` çağırır; testler bu dosyayı hiç yüklemez.

import { AppState } from "react-native";
import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { streakBridgeKaydet } from "../utils/streakBridge";
import { gunIndexi } from "../utils/watchActivity";
import { serverClockReady, serverClockVerified, serverNow, syncServerClock } from "./serverClock";
import {
  cancelScheduledNotification,
  getPermissionInfo,
  scheduleLocalNotification,
  CHANNELS,
} from "./pushNotificationsService";
import { STREAK_REMINDER_ID } from "../utils/streakReminder";

const streakRef = (uid) => doc(db, "Users", uid, "private", "streak");

let basladi = false;

export function startStreakRuntime() {
  if (basladi) return;
  basladi = true;
  syncServerClock();
  AppState.addEventListener("change", (durum) => {
    if (durum === "active") syncServerClock();
  });

  streakBridgeKaydet({
    simdi: serverNow,
    dogrulandi: serverClockVerified,
    hazir: serverClockReady,
    // { veri } başarı (belge yoksa veri null); hata atarsa köprü null döner = okunamadı.
    bulutOku: async (uid) => {
      const snap = await getDoc(streakRef(uid));
      return { veri: snap.exists() ? snap.data() : null };
    },
    bulutYaz: async (uid, veri) => {
      const son = veri.gunler[veri.gunler.length - 1];
      const sonGunMs = son ? gunIndexi(son) * 86400000 : 0;
      await setDoc(streakRef(uid), { ...veri, sonGunMs, guncellendi: serverTimestamp() });
    },
    bulutSil: async (uid) => {
      await deleteDoc(streakRef(uid));
    },
    hatirlatmaPlanla: async (plan) => {
      await cancelScheduledNotification(STREAK_REMINDER_ID);
      if (!plan) return;
      const izin = await getPermissionInfo();
      if (!izin.granted) return;
      await scheduleLocalNotification({
        identifier: plan.identifier,
        title: plan.title,
        body: plan.body,
        date: plan.date,
        channelId: CHANNELS.reminders,
        data: { type: "streakReminder" },
      });
    },
  });
}
