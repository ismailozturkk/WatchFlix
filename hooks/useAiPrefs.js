// hooks/useAiPrefs.js
//
// CineMatch tercihlerinin React bağı. Sohbet paneli ve Ayarlar > Yapay zeka
// ekranı AYNI kaydı (Keys.aiCinePrefs) `useStored` ile dinler: biri değiştirince
// diğeri anında güncellenir, ikisinin arasında ayrı bir durum tutulmaz.
//
// Şema, varsayılanlar ve doğrulama utils/aiPrefs.js'te.

import { useCallback, useMemo, useRef } from "react";
import { Keys, set, useStored } from "../services/storage";
import {
  STREAMING_PROVIDERS,
  useStreamingProviderSettings,
} from "@context/AppSettingsContext";
import { ONBOARDING_GENRES } from "@utils/onboardingPreferences";
import { DEFAULT_AI_PREFS, mergeAiPrefs, normalizeAiPrefs } from "@utils/aiPrefs";

const PROVIDER_IDS = STREAMING_PROVIDERS.map((provider) => provider.id);
const GENRE_KEYS = ONBOARDING_GENRES.map((genre) => genre.key);

export default function useAiPrefs() {
  const saved = useStored(Keys.aiCinePrefs);
  const { streamingProviderIds } = useStreamingProviderSettings();

  // Kayıtta platform seçimi hiç yoksa başlangıç, uygulamadaki "Platform
  // üyeliklerim" seçimidir (eski sohbet panelindeki davranışın aynısı).
  const context = useMemo(
    () => ({
      fallbackProviderIds: streamingProviderIds,
      validProviderIds: PROVIDER_IDS,
      validGenreKeys: GENRE_KEYS,
    }),
    [streamingProviderIds],
  );

  const prefs = useMemo(() => normalizeAiPrefs(saved, context), [saved, context]);

  // Aynı turda art arda gelen iki yama birbirini ezmesin: depo aboneliği
  // yeniden çizimden ÖNCE tetiklenir, bu yüzden güncel değer burada tutulur.
  const latestRef = useRef(prefs);
  latestRef.current = prefs;

  const updatePrefs = useCallback(
    (patch) => {
      const next = mergeAiPrefs(latestRef.current, patch, context);
      latestRef.current = next;
      set(Keys.aiCinePrefs, next);
      return next;
    },
    [context],
  );

  const resetPrefs = useCallback(() => {
    const next = normalizeAiPrefs(
      { ...DEFAULT_AI_PREFS, providerIds: context.fallbackProviderIds },
      context,
    );
    latestRef.current = next;
    set(Keys.aiCinePrefs, next);
    return next;
  }, [context]);

  return { prefs, updatePrefs, resetPrefs };
}
