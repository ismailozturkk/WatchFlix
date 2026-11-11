// hooks/useStreakActions.js
//
// Seri alevi sayfasındaki kullanıcı eylemleri: MOLA ver ve seri HATIRLATICISINI aç/kapat.
// Mola defteri değiştirir (utils/watchBadgeLedger.molaVerDefter); canlı kanca
// (useWatchProgress) değişikliği abonelikle duyar, alev aynı anda griye döner.

import { useCallback, useState } from "react";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { toast } from "@components/AppToast";
import { haptic } from "@services/hapticsService";
import { Keys, set as setStored, useStored } from "@services/storage";
import { molaVerDefter } from "@utils/watchBadgeLedger";
import { getStreakFlameCopy } from "@utils/streakFlameCopy";

export default function useStreakActions() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const uid = user?.uid;
  const reminderOn = useStored(Keys.streakReminder, { uid }) !== false;
  const [breakBusy, setBreakBusy] = useState(false);

  const takeBreak = useCallback(async () => {
    if (!uid || breakBusy) return false;
    const copy = getStreakFlameCopy(language);
    setBreakBusy(true);
    try {
      const r = await molaVerDefter(uid);
      if (!r.ok) {
        if (r.sebep === "hak") toast.info(copy.breakTitle, copy.breakUsed);
        else toast.error(copy.breakTitle, copy.breakFailed);
        return false;
      }
      haptic("success");
      toast.success(
        copy.celebrate.breakTitle,
        r.hedef === "gecen" ? copy.celebrate.breakLastMessage : copy.celebrate.breakMessage,
      );
      return true;
    } catch {
      toast.error(copy.breakTitle, copy.breakFailed);
      return false;
    } finally {
      setBreakBusy(false);
    }
  }, [uid, breakBusy, language]);

  const toggleReminder = useCallback(() => {
    if (!uid) return;
    setStored(Keys.streakReminder, !reminderOn, { uid });
  }, [uid, reminderOn]);

  return { takeBreak, breakBusy, reminderOn, toggleReminder };
}
