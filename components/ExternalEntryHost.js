// components/ExternalEntryHost.js
//
// Uygulamaya dışarıdan girişleri işler (görsel çıktısı yok):
//   1) Paylaş menüsü (expo-share-intent): IMDb / TMDB bağlantısı → o yapımın detay sayfası (ekle / izledim orada).
//   2) Simge uzun basma kısayolları (expo-quick-actions): Ara / Sıradaki / Hatırlatıcılar / Listelerim.
//
// NavigationContainer'ın İÇİNDE, Auth/Language/ApiSettings sağlayıcılarının altında olmalı.
// Kapı: oturum açık + profil tamamlanmış + gezinme hazır olana kadar gelen paylaşım / kısayol BEKLER (kaybolmaz),
// böylece soğuk açılışta ve giriş ekranındayken de doğru çalışır. Karar mantığı utils/externalEntry.js'te (saf, testli).
// Native modüller yoksa (Expo Go / eski build) her ikisi de sessizce no-op olur.

import { useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useShareIntent } from "expo-share-intent";
import * as QuickActions from "expo-quick-actions";
import { useQuickActionCallback } from "expo-quick-actions/hooks";

import { toast } from "./AppToast";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { useApiSettings } from "../context/AppSettingsContext";
import { navigateRoot, rootNavigationRef } from "../services/rootNavigation";
import { resolveMediaLink } from "../services/mediaLinkResolver";
import {
  buildQuickActionItems,
  hasShareableText,
  linkFromShareIntent,
  routeForQuickAction,
} from "../utils/externalEntry";
import { getExternalEntryCopy } from "../utils/externalEntryCopy";

// Soğuk açılışta `initial` süreç boyunca aynı kalır; bileşen yeniden mount olursa aynı kısayol ikinci kez işlenmesin.
let initialQuickActionConsumed = false;

/** Gezinme kökü hazır mı? (ref hazırlığı reaktif değil: hazır olana dek kısa aralıkla yoklar.) */
function useNavigationReady() {
  const [ready, setReady] = useState(() => rootNavigationRef.isReady());
  useEffect(() => {
    if (ready) return undefined;
    const timer = setInterval(() => {
      if (rootNavigationRef.isReady()) {
        setReady(true);
        clearInterval(timer);
      }
    }, 250);
    return () => clearInterval(timer);
  }, [ready]);
  return ready;
}

export default function ExternalEntryHost() {
  const { user, needsProfileCompletion } = useAuth();
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const copy = useMemo(() => getExternalEntryCopy(language), [language]);
  const navReady = useNavigationReady();
  const ready = navReady && Boolean(user) && !needsProfileCompletion;

  // ── Simge kısayolları ─────────────────────────────────────────────────────
  // Başlıklar uygulama dilinde: dil değişince liste yeniden kurulur. Çıkışta temizlenir (oturumsuz kısayol anlamsız).
  useEffect(() => {
    const items = user ? buildQuickActionItems(copy, Platform.OS) : [];
    Promise.resolve(QuickActions.setItems(items)).catch(() => {});
  }, [user, copy]);

  const [pendingAction, setPendingAction] = useState(null);
  useQuickActionCallback((action) => {
    if (action === QuickActions.initial) {
      if (initialQuickActionConsumed) return;
      initialQuickActionConsumed = true;
    }
    setPendingAction(action);
  });
  useEffect(() => {
    if (!pendingAction || !ready) return;
    const target = routeForQuickAction(pendingAction.id);
    setPendingAction(null);
    if (target) navigateRoot(target.name, target.params);
  }, [pendingAction, ready]);

  // ── Paylaş menüsü ─────────────────────────────────────────────────────────
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: true });
  const busy = useRef(false);
  useEffect(() => {
    if (!hasShareIntent || !ready || busy.current) return;
    if (!hasShareableText(shareIntent)) {
      resetShareIntent();
      return;
    }
    busy.current = true;
    const link = linkFromShareIntent(shareIntent);
    (async () => {
      try {
        if (!link) {
          toast.info(copy.shareUnrecognized);
          return;
        }
        const target = await resolveMediaLink(link, { apiKey: API_KEY, language });
        if (!target) {
          toast.info(copy.shareNotFound);
          return;
        }
        navigateRoot(target.type === "movie" ? "MovieDetails" : "TvShowsDetails", { id: target.id });
      } finally {
        busy.current = false;
        resetShareIntent();
      }
    })();
    // resetShareIntent her render yeni işlev; `busy` zaten tekrar girişi engelliyor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShareIntent, shareIntent, ready, API_KEY, language, copy]);

  return null;
}
