// hooks/useStreakCelebration.js
//
// Günlük seri alevinin anlarını bir kez kutlar: toast + başarı titreşimi.
//   • alev ilk kez yandı (3. gün)
//   • yeni HAFTA kademesi (ay içinde 7·14·21·28) — alevine yeni efekt
//   • yeni AY kademesi (her 30 gün) — yeni renk + kalkan
//   • seri KURTARILDI: dün kaçtı, bugün 2 içerikle telafi edildi
//   • KALKAN seriyi korudu
// Rozet kutlaması gibi WatchProgressProvider içinde koşar; işaretlemeyi hangi
// ekranda yaptıysan kutlama orada, o an çıkar (bkz. hooks/useBadgeCelebration.js).
//
// SON KUTLANAN DURUM cihazda (Keys.streakFlameSeen). Seri sönünce seviye sessizce
// düşer; alev yeniden yanınca aynı kademeler yine kutlanır — sönmüş bir seriyi
// yeniden yakmak da bir başarı. Karar saf: utils/streakFlame.js streakCelebrationStep.

import { useEffect } from "react";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { toast } from "@components/AppToast";
import { NotificationFeedbackType, notificationAsync } from "@services/hapticsService";
import { Keys, get as getStored, set as setStored } from "@services/storage";
import { streakCelebrationStep } from "@utils/streakFlame";
import { getStreakFlameCopy, streakLevelText } from "@utils/streakFlameCopy";

export default function useStreakCelebration({ seriler }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const uid = user?.uid;

  useEffect(() => {
    // `seriler` defter okununca gelir; o ana kadar null — "alev yok" sanıp kaydı
    // düşürmemek için beklenir.
    if (!uid || !seriler) return;
    const { celebrate, patch, store } = streakCelebrationStep(getStored(Keys.streakFlameSeen, { uid }), seriler);
    if (!store) return;
    setStored(Keys.streakFlameSeen, store, { uid });

    const copy = getStreakFlameCopy(language);
    const c = copy.celebrate;
    // Aynı turda hem kurtarma hem kademe olabilir (telafi seriyi 7. güne taşıdı):
    // tek toast — kademe daha büyük haber.
    if (celebrate) {
      const { kind, state } = celebrate;
      if (kind === "lit") toast.success(c.litTitle, c.litMessage(state.days));
      else if (kind === "month") {
        toast.success(
          c.monthTitle(copy.palettes[state.look.palette.id]),
          c.monthMessage(state.days, state.protection.shields),
        );
      } else toast.success(c.weekTitle(streakLevelText(copy, state.level)), c.weekMessage);
    } else if (patch) {
      if (patch.tur === "telafi") toast.success(c.repairTitle, c.repairMessage(patch.state.days));
      else toast.success(c.shieldTitle, c.shieldMessage(patch.state.days));
    } else {
      return;
    }
    notificationAsync(NotificationFeedbackType.Success).catch(() => {});
    // Dil değişimi kutlamayı yeniden tetiklemesin: kayıt zaten güncellendi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, seriler]);
}
