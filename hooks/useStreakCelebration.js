// hooks/useStreakCelebration.js
//
// Haftalık seri alevinin anlarını bir kez kutlar: toast + başarı titreşimi.
//   • alev ilk kez yandı (ilk başarılı hafta)
//   • yeni HAFTA — yeni kıvılcım biçimi
//   • yeni RENK kademesi (her 4 hafta)
//   • seri KURTARILDI: geçen hafta kaçtı, bu hafta 4 günle telafi edildi
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
import { haptic } from "@services/hapticsService";
import { Keys, get as getStored, set as setStored } from "@services/storage";
import { streakCelebrationStep } from "@utils/streakFlame";
import { getStreakFlameCopy } from "@utils/streakFlameCopy";

/**
 * Seri kutlamasını gösterir (toast + titreşim). `celebrate` / `patch` biçimi
 * utils/streakFlame `streakCelebrationStep` çıktısıdır. Hook ve Ayarlar >
 * Geliştirici Laboratuvarı aynı yolu kullanır.
 * @returns {boolean} bir şey gösterildi mi
 */
export function showStreakCelebration({ celebrate, patch } = {}, language) {
  const copy = getStreakFlameCopy(language);
  const c = copy.celebrate;
  // Aynı turda hem kurtarma hem kademe olabilir (telafi seriyi yeni renge taşıdı):
  // tek toast — kademe daha büyük haber.
  if (celebrate) {
    const { kind, state } = celebrate;
    if (kind === "lit") toast.success(c.litTitle, c.litMessage(state.weeks));
    else if (kind === "tier") {
      toast.success(
        c.tierTitle(copy.palettes[state.look.palette.id]),
        c.tierMessage(state.weeks, state.protection.shields),
      );
    } else {
      const spark = copy.sparks[state.look.spark?.shape] || copy.sparks.ember;
      toast.success(c.weekTitle(state.weeks), c.weekMessage(spark));
    }
  } else if (patch) {
    if (patch.tur === "telafi") toast.success(c.repairTitle, c.repairMessage(patch.state.weeks));
    else toast.success(c.shieldTitle, c.shieldMessage(patch.state.weeks));
  } else {
    return false;
  }
  haptic("streak");
  return true;
}

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

    showStreakCelebration({ celebrate, patch }, language);
    // Dil değişimi kutlamayı yeniden tetiklemesin: kayıt zaten güncellendi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, seriler]);
}
