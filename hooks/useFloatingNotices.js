// hooks/useFloatingNotices.js
//
// Yüzen bildirim katmanının verisi (components/floatingNotice/FloatingNoticeHost): yanıt bekleyen
// davetler (NotificationsContext) + süren turnuva anı (takvimden), cihazdaki toast/kapatma durumuyla
// birlikte. Kararlar saf: utils/floatingNotices.js.
//
// Turnuva anı, Eğlence ekranında Turnuva bölümü gizlenmişse (Ayarlar > Ekran bölümleri) duyurulmaz.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNotifications } from "../context/NotificationsContext";
import useScreenSections from "./useSectionVisibility";
import { Keys, get, set, useStored } from "../services/storage";
import { now as tournamentNow } from "../services/tournamentEngine";
import {
  inviteNotices,
  markNoticeDismissed,
  markNoticesAnnounced,
  tournamentNotice,
  tournamentStepAt,
  visibleNotices,
} from "../utils/floatingNotices";

const EMPTY = Object.freeze({});
const TICK_MS = 60 * 1000;
// setTimeout üst sınırı (~24,8 gün) aşılmasın; uzak an için arada uyanmak yeter.
const MAX_WAIT_MS = 6 * 60 * 60 * 1000;

export default function useFloatingNotices() {
  const inbox = useNotifications();
  const items = inbox?.items;
  const { isVisible } = useScreenSections("hub");
  const state = useStored(Keys.floatingNotices);
  const [now, setNow] = useState(Date.now());

  // Dakikada bir (davetin süresi dolar) + turnuva anının bittiği anda yeniden hesapla.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const step = tournamentStepAt(tournamentNow());
  const stepEndsAt = step?.endsAt ?? null;
  useEffect(() => {
    if (!stepEndsAt) return undefined;
    const wait = Math.min(Math.max(stepEndsAt - tournamentNow(), 0) + 50, MAX_WAIT_MS);
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [stepEndsAt, now]);

  const showTournament = isVisible("tournament");
  const stepKey = step ? `${step.periodId}:${step.step}` : null;
  const notices = useMemo(() => {
    const event = showTournament ? tournamentNotice(step) : null;
    return visibleNotices({
      invites: inviteNotices(items, now),
      events: event ? [event] : [],
      dismissed: state?.dismissed,
    });
    // `step` her render yeni nesne; kimliği stepKey taşır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, now, stepKey, showTournament, state?.dismissed]);

  // Güncel değer depodan okunur: art arda iki çağrı birbirini ezmesin.
  const markAnnounced = useCallback((ids) => {
    if (ids?.length) set(Keys.floatingNotices, markNoticesAnnounced(get(Keys.floatingNotices), ids));
  }, []);
  const dismiss = useCallback((id) => {
    set(Keys.floatingNotices, markNoticeDismissed(get(Keys.floatingNotices), id));
  }, []);

  return {
    notices,
    announced: state?.announced || EMPTY,
    loading: Boolean(inbox?.loading),
    respond: inbox?.respond,
    markAnnounced,
    dismiss,
  };
}
