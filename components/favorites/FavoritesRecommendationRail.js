// components/favorites/FavoritesRecommendationRail.js
//
// Film / Dizi sekmesindeki "Favorilerine Göre" rayı: kullanıcının dört
// favorisinden (film|dizi + oyuncu) türetilen öneriler.
//
//   • Film rayı  : seçilen filmlerin "bunu sevenler" listesi + oyuncuların
//                  en bilinen filmleri
//   • Dizi rayı  : aynısı diziler için
//
// Favorisi olmayan kullanıcıda HİÇ çizilmez — ve ekran bu bileşeni bölüm
// listesine hiç eklemez (utils/fourFavorites.hasRecommendationSignal), yoksa boş
// bölüm "kaç bölüm gösterildi" sayacında yer tutardı.
//
// İZLENMİŞLER ELENİR: kullanıcının zaten izlediğini önermek öneri değildir.
// Süzme çekimden SONRA, ListStatusContext'teki mevcut durum indeksiyle yapılır;
// ek okuma yok ve izleme durumu değişince ray ağa çıkmadan güncellenir.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import PaginatedRail from "../PaginatedRail";
import SectionHeader from "../home/SectionHeader";
import { RailSkeleton } from "../Skeleton";
import { DiscoveryCard } from "../DiscoveryMediaRail";
import { useLanguage } from "../../context/LanguageContext";
import { useApiSettings } from "../../context/AppSettingsContext";
import { useUserProfile } from "../../context/UserProfileContext";
import { useListStatusContext } from "../../context/ListStatusContext";
import { trackEvent, ANALYTICS_EVENTS } from "../../services/analytics";
import { fetchFavoriteRecommendations } from "../../services/favoriteRecommendations";
import { getFavoritesCopy } from "../../utils/favoritesCopy";
import {
  describeSources,
  readProfileFavorites,
  recommendationSources,
} from "../../utils/fourFavorites";

const EMPTY_CATALOG = Object.freeze({});
const VISIBLE_LIMIT = 20;

export default function FavoritesRecommendationRail({ mediaType, navigation }) {
  const { language } = useLanguage();
  const { API_KEY } = useApiSettings();
  const { profile } = useUserProfile();
  const { statusIndex } = useListStatusContext() || {};
  const copy = getFavoritesCopy(language);

  const favorites = useMemo(() => readProfileFavorites(profile), [profile]);
  // Firestore her anlık görüntüde YENİ nesne üretir; efekti nesneye değil
  // kaynakların kimliğine bağla, yoksa profildeki ilgisiz bir değişiklik (sayaç)
  // ağ isteklerini yeniden başlatırdı.
  const sourceKey = useMemo(
    () => recommendationSources(favorites, mediaType).map((source) => source.key).join("|"),
    [favorites, mediaType],
  );

  const [state, setState] = useState({ status: "loading", items: [], sources: [] });

  useEffect(() => {
    if (!sourceKey || !API_KEY) {
      setState({ status: "empty", items: [], sources: [] });
      return undefined;
    }
    let active = true;
    // Önceki öneriler varsa onları koru (yenilemede posterler yanıp sönmesin).
    setState((current) =>
      current.items.length ? current : { status: "loading", items: [], sources: [] },
    );
    fetchFavoriteRecommendations({
      favorites,
      mediaType,
      apiKey: API_KEY,
      language,
      limit: 40,
    })
      .then(({ items, sources }) => {
        if (active) setState({ status: "ready", items, sources });
      })
      .catch(() => {
        if (active) {
          setState((current) =>
            current.items.length ? current : { status: "error", items: [], sources: [] },
          );
        }
      });
    return () => {
      active = false;
    };
    // `favorites` kimliği sourceKey'den türüyor (yukarıdaki not).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [API_KEY, language, mediaType, sourceKey]);

  const visible = useMemo(() => {
    const seen = statusIndex?.[mediaType] || {};
    return state.items.filter((item) => !seen[item.id]?.isWatched).slice(0, VISIBLE_LIMIT);
  }, [mediaType, state.items, statusIndex]);

  const renderItem = useCallback(
    ({ item }) => (
      <DiscoveryCard
        item={item}
        mediaType={mediaType}
        navigation={navigation}
        providerCatalog={EMPTY_CATALOG}
        onOpen={() => trackEvent(ANALYTICS_EVENTS.FAVORITES_REC_OPENED, { media_type: mediaType })}
      />
    ),
    [mediaType, navigation],
  );

  if (state.status === "empty" || state.status === "error") return null;
  if (state.status === "ready" && visible.length === 0) return null;

  const subtitle = copy.rail.subtitle(
    describeSources(state.sources.length ? state.sources : recommendationSources(favorites, mediaType), {
      limit: 2,
      more: copy.rail.more,
    }),
  );

  return (
    <View style={styles.section}>
      <SectionHeader
        title={copy.rail.title}
        subtitle={subtitle}
        section="fromFavorites"
        mediaType={mediaType}
      />
      {state.status === "loading" ? (
        <RailSkeleton />
      ) : (
        <PaginatedRail
          data={visible}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.rail}
          initialNumToRender={3}
          maxToRenderPerBatch={3}
          windowSize={5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: 10 },
  rail: { paddingHorizontal: 15 },
});
