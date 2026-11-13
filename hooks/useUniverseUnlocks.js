// hooks/useUniverseUnlocks.js
//
// Gizli evrenler kancası: hangi atmosfer evrenleri açık? Bir evren, yapımı izlenince detay
// sayfasında çıkan sorunun doğru cevaplanmasıyla açılır. Kural: utils/universeUnlocks.js,
// sorular: utils/universeRiddles.js.
//
// Kayıt yerel-öncelikli tek belge (services/userData universeUnlocksDomain →
// Users/{uid}/private/universes). Okuma senkron ve yerelden; bulut yalnız bu cihazda yerel
// kopya yokken BİR KEZ okunur, çözülen her evren buluta BİR yazma (merge) olarak gider.

import { useCallback, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { universeUnlocksDomain } from "../services/userData";
import useUserDataDomain from "./useUserDataDomain";
import { UNIVERSE_IDS } from "../utils/weatherUniverses";
import {
  UNIVERSE_DOC_KEY,
  buildUniverseDoc,
  isUniverseId,
  solvedFromDoc,
  universeDayUniverses,
  unlockedUniverses,
  withSolved,
} from "../utils/universeUnlocks";

export default function useUniverseUnlocks() {
  const { user } = useAuth();
  const authUid = user?.uid ?? null;
  const view = useUserDataDomain(universeUnlocksDomain);
  const solved = useMemo(() => solvedFromDoc(view.get("doc", UNIVERSE_DOC_KEY)), [view]);

  /** Evreni açık olarak kaydeder; zaten açıksa yazmaz. Oturum yoksa false. */
  const solve = useCallback(
    (id) => {
      if (!authUid || !isUniverseId(id)) return false;
      const next = withSolved(solved, id);
      if (next === solved) return true;
      universeUnlocksDomain.apply(authUid, [{ kind: "doc", doc: buildUniverseDoc(next) }]);
      return true;
    },
    [authUid, solved],
  );

  // Evren günü (4 Mayıs Star Wars…): o gün geçici açık. Gün anahtarı değişince yeniden hesaplanır.
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const today = useMemo(() => universeDayUniverses(now), [dayKey]);

  return useMemo(() => {
    const unlocked = unlockedUniverses(solved);
    return {
      /** Kalıcı açık evrenler (soru çözülmüş) — sayaçlar bundan. */
      unlocked,
      /** Bugün evren günü olduğu için geçici açık evrenler. */
      today,
      count: unlocked.size,
      total: UNIVERSE_IDS.length,
      /** Seçilebilir mi: evren değilse (kar, yağmur…) her zaman; evrense çözülmüş ya da bugün evren günü. */
      isUnlocked: (id) => !isUniverseId(id) || unlocked.has(id) || today.has(id),
      /** Kalıcı olarak çözülmüş mü (detaydaki gizli kart bunu sorar). */
      isSolved: (id) => unlocked.has(id),
      /** Türe göre çizimde kullanılabilir mi (kalıcı ya da bugün). */
      canDraw: (id) => unlocked.has(id) || today.has(id),
      solve,
    };
  }, [solved, solve, today]);
}
