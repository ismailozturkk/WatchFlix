// context/PosterChoicesProvider.js
//
// ÖZEL AFİŞ VE ARKA PLANLAR — kök sağlayıcı ve arkadaş okuması. Çekirdek (context
// nesnesi, çözücüler, PosterChoicesScope) hafif kalsın diye context/PosterChoicesContext.js'te.
//
// Kendi seçimlerin yerel-öncelikli alandan (services/userData posterChoicesDomain)
// gelir: okuma ağa gitmez, yazma önce yerelde + günlükte, buluta arka planda.
// Planın `custom_posters` izni yoksa seçimler SİLİNMEZ ama çizilmez (abonelik
// yenilenince geri gelir) — diğer kozmetiklerle aynı kural.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { usePremium } from "./PremiumContext";
import {
  POSTER_CHOICE_RESULT,
  PosterChoicesContext,
  usePosterChoices,
} from "./PosterChoicesContext";
import useUserDataDomain from "../hooks/useUserDataDomain";
import { posterChoicesDomain } from "../services/userData";
import { fetchUserPosterChoices } from "../services/posterChoicesService";
import { getFeatureLimit } from "../utils/premiumFeatures";
import { resolveServerPlan } from "../utils/premium";
import {
  buildPosterChoicesDoc,
  CHOICE_KIND,
  choicesOfKind,
  choiceSetFromDoc,
  EMPTY_CHOICE_SET,
  POSTER_CHOICES_DOC_KEY,
  posterChoiceKey,
  resolvePosterPath,
  withChoiceSetKind,
  withPosterChoice,
} from "../utils/posterChoices";

const isAllowedFor = (plan) => Boolean(getFeatureLimit("custom_posters", plan));

export function PosterChoicesProvider({ children }) {
  const { user } = useAuth();
  const authUid = user?.uid ?? null;
  const { plan } = usePremium();
  const allowed = isAllowedFor(plan);
  const view = useUserDataDomain(posterChoicesDomain);

  const stored = useMemo(
    () => choiceSetFromDoc(view.get("doc", POSTER_CHOICES_DOC_KEY)),
    [view],
  );
  const active = allowed ? stored : EMPTY_CHOICE_SET;

  const resolve = useCallback(
    (type, id, fallback = null) => resolvePosterPath(active.posters, type, id, fallback),
    [active],
  );
  const resolveBackdrop = useCallback(
    (type, id, fallback = null) => resolvePosterPath(active.backdrops, type, id, fallback),
    [active],
  );
  const chosenFor = useCallback(
    (type, id, kind = CHOICE_KIND.POSTER) =>
      resolvePosterPath(choicesOfKind(active, kind), type, id, null),
    [active],
  );

  const write = useCallback(
    (nextSet) => {
      posterChoicesDomain.apply(authUid, [{ kind: "doc", doc: buildPosterChoicesDoc(nextSet) }]);
      return POSTER_CHOICE_RESULT.OK;
    },
    [authUid],
  );

  const choose = useCallback(
    (type, id, path, kind = CHOICE_KIND.POSTER) => {
      if (!authUid) return POSTER_CHOICE_RESULT.SIGNED_OUT;
      if (!allowed) return POSTER_CHOICE_RESULT.LOCKED;
      if (!posterChoiceKey(type, id)) return POSTER_CHOICE_RESULT.INVALID;
      const nextMap = withPosterChoice(choicesOfKind(stored, kind), type, id, path);
      if (nextMap === null) return path ? POSTER_CHOICE_RESULT.FULL : POSTER_CHOICE_RESULT.INVALID;
      const next = withChoiceSetKind(stored, kind, nextMap);
      if (next === stored) return POSTER_CHOICE_RESULT.UNCHANGED;
      return write(next);
    },
    [allowed, authUid, stored, write],
  );

  // Varsayılana dönmek plan istemez: abonelik bitmiş kullanıcı da seçimini temizleyebilsin.
  const reset = useCallback(
    (type, id, kind = CHOICE_KIND.POSTER) => {
      if (!authUid) return POSTER_CHOICE_RESULT.SIGNED_OUT;
      const nextMap = withPosterChoice(choicesOfKind(stored, kind), type, id, null);
      if (nextMap === null) return POSTER_CHOICE_RESULT.INVALID;
      const next = withChoiceSetKind(stored, kind, nextMap);
      if (next === stored) return POSTER_CHOICE_RESULT.UNCHANGED;
      return write(next);
    },
    [authUid, stored, write],
  );

  const value = useMemo(
    () => ({
      resolve,
      resolveBackdrop,
      chosenFor,
      choose,
      reset,
      allowed,
      choices: active,
      uid: authUid,
    }),
    [active, allowed, authUid, choose, chosenFor, reset, resolve, resolveBackdrop],
  );

  return <PosterChoicesContext.Provider value={value}>{children}</PosterChoicesContext.Provider>;
}

/**
 * Başka bir kullanıcının seçimleri { posters, backdrops } (arkadaş profili). TEK okuma, yalnız:
 *   • `canRead` (listeleri izleyene açık — kuraldaki canReadLists ile aynı koşul) VE
 *   • sahibin SUNUCU planı (`Users/{uid}.entitlements`, herkese açık profil
 *     belgesinde) özel afişe izin veriyorsa. Free sahibi için okuma hiç yapılmaz.
 * Kendi uid'in verilirse ağa gidilmez (kendi seçimlerin kökte zaten var).
 */
export function useUserPosterChoices(ownerUid, { entitlements, canRead = true } = {}) {
  const { uid: myUid } = usePosterChoices();
  const ownerAllowed = isAllowedFor(resolveServerPlan(entitlements));
  const enabled = Boolean(ownerUid) && ownerUid !== myUid && canRead && ownerAllowed;
  const [choices, setChoices] = useState(EMPTY_CHOICE_SET);

  useEffect(() => {
    if (!enabled) {
      setChoices(EMPTY_CHOICE_SET);
      return undefined;
    }
    let alive = true;
    fetchUserPosterChoices(ownerUid).then((next) => {
      if (alive) setChoices(next);
    });
    return () => {
      alive = false;
    };
  }, [enabled, ownerUid]);

  return enabled ? choices : EMPTY_CHOICE_SET;
}
