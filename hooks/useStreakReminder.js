// hooks/useStreakReminder.js
//
// Haftalık seri HATIRLATMASI: seri her değiştiğinde tek bir yerel bildirim yeniden
// planlanır (aynı kimlik — eski plan iptal edilir). Hafta kazanılınca, mola verilince
// ya da kullanıcı alevin sayfasından hatırlatıcıyı kapatınca bildirim iptal olur.
// Ne zaman gideceği utils/streakReminder.js'te (saf); zamanlama köprü üzerinden
// (utils/streakBridge → services/streakRuntime). OS izni yoksa hiçbir şey olmaz;
// izin İSTENMEZ (izin akışı bildirim ayarlarının işi).
//
// WatchProgressProvider içinde, seri kutlamasıyla aynı yerde koşar.

import { useEffect } from "react";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { Keys, useStored } from "@services/storage";
import { streakBridge } from "@utils/streakBridge";
import { planStreakReminder } from "@utils/streakReminder";
import { getStreakFlameCopy } from "@utils/streakFlameCopy";
import { cihazDilimi } from "@utils/watchActivity";

export default function useStreakReminder({ seriler }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const uid = user?.uid;
  const on = useStored(Keys.streakReminder, { uid }) !== false;

  useEffect(() => {
    if (!uid || !seriler) return;
    if (!on) {
      streakBridge.hatirlatmaPlanla(null);
      return;
    }
    const simdi = streakBridge.simdi();
    const plan = planStreakReminder({
      seriler,
      bugun: seriler.seriGunu,
      dilim: seriler.dilim ?? cihazDilimi(simdi),
      simdi,
      cihazFark: Date.now() - simdi,
      copy: getStreakFlameCopy(language),
    });
    streakBridge.hatirlatmaPlanla(plan);
  }, [uid, seriler, on, language]);

  // Çıkışta / hesap değişiminde eski hesabın hatırlatması kalmasın.
  useEffect(() => () => {
    streakBridge.hatirlatmaPlanla(null);
  }, [uid]);
}
