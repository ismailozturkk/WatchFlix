// hooks/useStreakActions.js
//
// Seri alevi sayfasındaki kullanıcı eylemi: seri HATIRLATICISINI aç/kapat.
// (Mola 11 Kas'ta kaldırıldı: esnek hafta + kalkan yeterli koruma.)

import { useCallback } from "react";
import { useAuth } from "@context/AuthContext";
import { Keys, set as setStored, useStored } from "@services/storage";

export default function useStreakActions() {
  const { user } = useAuth();
  const uid = user?.uid;
  const reminderOn = useStored(Keys.streakReminder, { uid }) !== false;

  const toggleReminder = useCallback(() => {
    if (!uid) return;
    setStored(Keys.streakReminder, !reminderOn, { uid });
  }, [uid, reminderOn]);

  return { reminderOn, toggleReminder };
}
