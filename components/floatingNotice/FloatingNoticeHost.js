// components/floatingNotice/FloatingNoticeHost.js
//
// Yüzen bildirim katmanı (App.js, NavigationContainer içinde bir kez). Yanıt bekleyen davetler ve
// turnuva gibi özel anlar için profilin üstündeki eski "Önemli davetler" çubuğunun yerini alır:
//
//   yeni bildirim ──► üstte toast gibi kart (süre çizgisiyle)
//                       │ süre doldu / yukarı-yana kaydırıldı / küçült
//                       ▼
//                     kenarda yüzen simge (sürüklenir, en yakın kenara oturur)
//                       │ dokun
//                       ▼
//                     kart yeniden açılır (simgenin yerinden büyür)
//
// Davette seçim zorunlu: kart kapanmaz, yalnız simgeye küçülür; Kabul / Reddet kaldırır. Özel an
// "Tamam" ya da "Aç" ile kalkar. Kurallar: utils/floatingNotices.js; veri: hooks/useFloatingNotices.js.
//
// Kap HER ZAMAN çizilir: kart/simge kaldırılırken çıkış animasyonu ebeveynin ayakta olmasına bağlı.
// Katman toast'ların ALTINDA (zIndex 9000 < ToastHost 9999): bir hata toast'ı kartın üstünde okunur.
// Native Modal / alt sayfa açıkken katman onların arkasında kalır — bilinçli: sayfayı kapatınca simge yerinde.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
// Pencere kenarına çizilir: ekranın Premium şeridiyle büyütülmüş üst boşluğunu değil gerçeğini al.
import { useWindowSafeAreaInsets } from "@context/ScreenInsetsContext";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import useFloatingNotices from "../../hooks/useFloatingNotices";
import useReduceMotion from "../../hooks/useReduceMotion";
import { Keys, get, set } from "../../services/storage";
import { navigateRoot, rootNavigationRef } from "../../services/rootNavigation";
import {
  clearFloatingNoticeFocus,
  pendingFloatingNoticeFocus,
  setFloatingNoticesPresenting,
  subscribeFloatingNoticeFocus,
} from "../../services/floatingNoticeBus";
import { invitationDestination } from "../../utils/importantInvites";
import {
  NOTICE_IDLE_MS,
  NOTICE_KIND,
  NOTICE_TOAST_MS,
  dockBounds,
  dockOrigin,
  eventDestination,
  floatingNoticesAllowed,
  nextAnnouncement,
  nextNoticeId,
  noticeIndex,
  resolveDock,
} from "../../utils/floatingNotices";
import { floatingNoticeCopy, floatingNoticeText } from "../../utils/floatingNoticeCopy";
import FloatingNoticeBubble from "./FloatingNoticeBubble";
import FloatingNoticeCard from "./FloatingNoticeCard";

// Güvenli alanın altına bırakılan boşluk (ToastHost ile aynı): kart çentik/ada altında başlar.
const TOP_GAP = 8;
const MIN_TOP = 12;
// Kart simgeye küçülürken simge, kart yerine varınca belirir.
const BUBBLE_APPEAR_DELAY_MS = 200;

const readRouteName = () =>
  rootNavigationRef.isReady() ? rootNavigationRef.getCurrentRoute()?.name ?? null : null;

/** Kök navigasyonun odaktaki (en derindeki) rotası. */
function useRootRouteName() {
  const [name, setName] = useState(readRouteName);
  useEffect(() => {
    const update = () => setName(readRouteName());
    update();
    const offState = rootNavigationRef.addListener("state", update);
    const offReady = rootNavigationRef.addListener("ready", update);
    return () => {
      offState?.();
      offReady?.();
    };
  }, []);
  return name;
}

const CLOSED = { open: false, via: "toast", activeId: null, enterFrom: "top", token: 0 };

export default function FloatingNoticeHost() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const { theme } = useTheme();
  const reduceMotion = useReduceMotion();
  const insets = useWindowSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const routeName = useRootRouteName();
  const { notices, announced, loading, respond, markAnnounced, dismiss } = useFloatingNotices();
  const uid = user?.uid || null;
  const allowed = floatingNoticesAllowed({ signedIn: Boolean(uid), routeName });

  // open: kart açık mı · via: "toast" (kendiliğinden, kısa süre) | "tap" (kullanıcı açtı/dokundu)
  // token: zamanlayıcıyı ve süre çizgisini yeniden başlatır.
  const [view, setView] = useState(CLOSED);
  const [exitTo, setExitTo] = useState("dock");
  // Yanıtlanan / kapatılan bildirimler, kaynak (Firestore, depo) yetişene kadar burada gizlenir.
  const [gone, setGone] = useState(() => new Set());
  const [busyId, setBusyId] = useState(null);
  const [errorId, setErrorId] = useState(null);
  const [savedDock, setSavedDock] = useState(() => get(Keys.floatingNoticeDock));
  const [focus, setFocus] = useState(() => {
    const id = pendingFloatingNoticeFocus();
    return id ? { id } : null;
  });

  const list = useMemo(() => notices.filter((notice) => !gone.has(notice.id)), [notices, gone]);
  const active = list.find((notice) => notice.id === view.activeId) || list[0] || null;
  const bounds = useMemo(
    () => dockBounds({ width, height, insetTop: insets.top, insetBottom: insets.bottom }),
    [width, height, insets.top, insets.bottom],
  );
  const dock = useMemo(() => resolveDock(savedDock, bounds), [savedDock, bounds]);
  const origin = useMemo(() => dockOrigin(dock, bounds), [dock, bounds]);
  const top = Math.max(insets.top, MIN_TOP) + TOP_GAP;

  // Ön plandaki cihaz bildirimi davet için bununla karar verir (services/floatingNoticeBus).
  useEffect(() => {
    setFloatingNoticesPresenting(allowed);
  }, [allowed]);
  useEffect(() => () => setFloatingNoticesPresenting(false), []);

  // Hesap değişti: önceki hesabın yerel izleri ve açık kartı kalmasın.
  useEffect(() => {
    setGone(new Set());
    setBusyId(null);
    setErrorId(null);
    setView(CLOSED);
  }, [uid]);

  const openNotice = useCallback((id, via, enterFrom) => {
    setExitTo("dock");
    setErrorId(null);
    setView((previous) => ({
      open: true,
      via,
      activeId: id ?? previous.activeId,
      // Giriş yalnız kart kurulurken okunur; açık kartın içeriği değişince yeniden girmez.
      enterFrom: previous.open ? previous.enterFrom : enterFrom,
      token: previous.token + 1,
    }));
  }, []);

  const collapse = useCallback(() => {
    setExitTo("dock");
    setView((previous) => (previous.open ? { ...previous, open: false } : previous));
  }, []);

  // Dokunuş kartı "okunuyor"a çevirir: kısa toast süresi yerine uzun bekleme süresi başlar.
  const touch = useCallback(() => {
    setView((previous) => (previous.open ? { ...previous, via: "tap", token: previous.token + 1 } : previous));
  }, []);

  // Yeni bildirim: bir kez toast. Kullanıcı açık bir kartla meşgulse yalnız sayılır (simge/sayaç).
  // Bildirim kutusu yüklenmeden duyurulmaz: açılışta önce turnuva anı, ardından davet diye kart
  // içeriği sıçramasın.
  useEffect(() => {
    if (!allowed || loading || !list.length) return;
    const { target, fresh } = nextAnnouncement(list, announced);
    if (!fresh.length) return;
    markAnnounced(fresh);
    if (busyId || (view.open && view.via === "tap")) return;
    openNotice(target.id, "toast", "top");
  }, [allowed, loading, list, announced, busyId, view.open, view.via, markAnnounced, openNotice]);

  // Bildirime dokunuldu (push): ilgili kart açılsın; bulunamazsa (başka cihazda yanıtlandı) ilki.
  useEffect(() => subscribeFloatingNoticeFocus((id) => setFocus({ id })), []);
  useEffect(() => {
    if (!focus || !allowed || loading) return;
    clearFloatingNoticeFocus();
    setFocus(null);
    const target = list.find((notice) => notice.id === focus.id) || list[0];
    if (!target) return;
    markAnnounced([target.id]);
    openNotice(target.id, "tap", "dock");
  }, [focus, allowed, loading, list, markAnnounced, openNotice]);

  // Gizli rotaya geçildi ya da bildirim kalmadı: kart kapanır (dönünce simge olarak bekler).
  useEffect(() => {
    if ((!allowed || !list.length) && view.open) setView((previous) => ({ ...previous, open: false }));
  }, [allowed, list.length, view.open]);

  // Zamanlayıcı: toast süresi (türüne göre) ya da açılmış kartın bekleme süresi dolunca küçül.
  const activeKind = active?.kind || null;
  useEffect(() => {
    if (!allowed || !view.open || !activeKind || busyId) return undefined;
    const timer = setTimeout(collapse, view.via === "toast" ? NOTICE_TOAST_MS[activeKind] : NOTICE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [allowed, view.open, view.via, view.token, activeKind, busyId, collapse]);

  /**
   * Bildirim yanıtlandı/kapatıldı. Başka bildirim varsa kart sıradakini gösterir; yoksa kart yukarı
   * solar. Çıkış türü kartın SON çiziminden okunur: önce "away" çizilir, kaldırma bir kare sonra.
   * `commit`: kaynağı değiştiren yazım (ör. anı kapat) — kaldırmayla aynı anda yapılır.
   */
  const finish = useCallback(
    (id, commit) => {
      const remove = () => {
        commit?.();
        setGone((previous) => new Set(previous).add(id));
      };
      const rest = list.filter((notice) => notice.id !== id);
      if (rest.length) {
        remove();
        setView((previous) => ({ ...previous, activeId: rest[0].id, via: "tap", token: previous.token + 1 }));
        return;
      }
      setExitTo("away");
      requestAnimationFrame(() => {
        remove();
        setView((previous) => ({ ...previous, open: false }));
      });
    },
    [list],
  );

  const answer = useCallback(
    async (notice, response) => {
      if (busyId || typeof respond !== "function") return;
      const destination = response === "accepted" ? invitationDestination(notice.item) : null;
      if (response === "accepted" && !destination) return;
      const last = list.length <= 1;
      setBusyId(notice.id);
      setErrorId(null);
      // Son davetse kart yukarı solacak: yanıtın Firestore'dan dönüşü kaldırmadan önce gelebilir.
      if (last) setExitTo("away");
      try {
        const saved = await respond(notice.sourceId, response);
        finish(notice.id);
        if (saved && destination) navigateRoot(destination.name, destination.params);
      } catch {
        setExitTo("dock");
        setErrorId(notice.id);
      } finally {
        setBusyId(null);
      }
    },
    [busyId, respond, list.length, finish],
  );

  const closeEvent = useCallback(
    (notice, openIt) => {
      finish(notice.id, () => dismiss(notice.id));
      const destination = openIt ? eventDestination(notice) : null;
      if (destination) navigateRoot(destination.name, destination.params);
    },
    [finish, dismiss],
  );

  const onPrimary = useCallback(() => {
    if (!active) return;
    if (active.kind === NOTICE_KIND.invite) answer(active, "accepted");
    else closeEvent(active, true);
  }, [active, answer, closeEvent]);

  const onSecondary = useCallback(() => {
    if (!active) return;
    if (active.kind === NOTICE_KIND.invite) answer(active, "declined");
    else closeEvent(active, false);
  }, [active, answer, closeEvent]);

  const onNext = useCallback(() => {
    const id = nextNoticeId(list, active?.id);
    if (!id) return;
    setErrorId(null);
    setView((previous) => ({ ...previous, activeId: id, via: "tap", token: previous.token + 1 }));
  }, [list, active?.id]);

  const onOpenBubble = useCallback(() => {
    openNotice(active?.id ?? null, "tap", "dock");
  }, [active?.id, openNotice]);

  const onDockChange = useCallback((next) => {
    setSavedDock(next);
    set(Keys.floatingNoticeDock, next);
  }, []);

  const copy = floatingNoticeCopy(language);
  const cardVisible = allowed && view.open && Boolean(active);
  const bubbleVisible = allowed && !view.open && list.length > 0;
  const text = active ? floatingNoticeText(active, { language, someone: t?.someone }) : null;
  const lead = list[0] || null;
  const leadText = bubbleVisible && lead ? floatingNoticeText(lead, { language, someone: t?.someone }) : null;

  return (
    <View style={styles.root} pointerEvents="box-none" collapsable={false}>
      {cardVisible && (
        <FloatingNoticeCard
          key="card"
          notice={active}
          text={text}
          index={noticeIndex(list, active.id)}
          count={list.length}
          theme={theme}
          copy={copy}
          top={top}
          screenWidth={width}
          dock={origin}
          enterFrom={view.enterFrom}
          exitTo={exitTo}
          countdownMs={view.via === "toast" ? NOTICE_TOAST_MS[active.kind] : null}
          timerToken={view.token}
          busy={busyId === active.id}
          error={errorId === active.id}
          reduceMotion={reduceMotion}
          onPrimary={onPrimary}
          onSecondary={onSecondary}
          onNext={onNext}
          onMinimize={collapse}
          onTouch={touch}
        />
      )}
      {bubbleVisible && lead && (
        <FloatingNoticeBubble
          key="bubble"
          notice={lead}
          count={list.length}
          dock={dock}
          bounds={bounds}
          theme={theme}
          label={`${copy.bubble(list.length)}. ${leadText?.title || ""}`}
          hint={copy.bubbleHint}
          appearDelay={BUBBLE_APPEAR_DELAY_MS}
          reduceMotion={reduceMotion}
          onOpen={onOpenBubble}
          onDockChange={onDockChange}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, zIndex: 9000, elevation: 9000 },
});
