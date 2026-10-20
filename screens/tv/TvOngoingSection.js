// screens/tv/TvOngoingSection.js
//
// "Devam Eden Dizilerim" rayı. Eskiden yalnız poster + ilerleme çubuğu
// gösteriyordu; artık SIRADAKİ BÖLÜM yapısını da taşıyor: her kart hangi
// bölümün beklediğini söyler ve tek dokunuşla izlendi işaretlenir.
//
// Sıradaki ekranı (screens/tabs/UpNextScreen) silinmedi — "Tümü" ondan açılıyor
// ve dizi gizleme/yönetim orada duruyor. Ortak mantık hooks/useUpNextQueue'da:
// iki yüzey aynı kuyruğu, aynı iyimser ilerletmeyi ve aynı çözümleme
// önbelleğini paylaşır.
//
// Bölüm çözümlemesi ETKİLEŞİMLER BİTTİKTEN sonra başlar: ray posterleri yerel
// veriyle anında çizilir, bölüm bilgisi sonradan dolar. Ana ekranın ilk karesi
// TMDB isteklerini beklemez.

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  View,
  FlatList,
  StyleSheet,
  InteractionManager,
} from "react-native";

import SectionHeader, { SectionBadge } from "../../components/home/SectionHeader";
import UpNextRailCard from "../../components/tv/UpNextRailCard";
import WatchedDateSheet from "../../components/detail/WatchedDateSheet";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useMediaQuickActions } from "../../context/MediaQuickActionsContext";
import useRailPosterStyle from "../../hooks/useRailPosterStyle";
import { useHomeRenderKey } from "../../hooks/useHomeContentSettings";
import useUpNextQueue from "../../hooks/useUpNextQueue";
import { i18nText } from "../../utils/i18nText";
import { getSeeAllLabel } from "../../utils/homeSectionCopy";

// Rayda çözülecek dizi sayısı. Her dizi en az bir dizi + bir sezon isteği
// demek; ana ekran açılışında bunun sınırsız olması pahalı olurdu. Kalanı
// "Tümü" ile açılan Sıradaki ekranı çözer.
const RAIL_LIMIT = 10;

export default function TvOngoingSection({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const poster = useRailPosterStyle();
  // renderItem useCallback ile sabit; poster kalitesi/rozet ayarı değişince
  // hücreleri yeniden çizdirmek için (bkz. utils/homeContentSettings.js).
  const renderKey = useHomeRenderKey();
  const { openQuickActions } = useMediaQuickActions();
  const [dateItem, setDateItem] = useState(null);
  const [resolveReady, setResolveReady] = useState(false);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() =>
      setResolveReady(true)
    );
    // Emniyet supabı: ekranda sürekli dönen bir Animated animasyonu varsa
    // runAfterInteractions hiç tetiklenmeyebilir; kartlar iskelette kalmasın.
    const timer = setTimeout(() => setResolveReady(true), 1500);
    return () => {
      task.cancel?.();
      clearTimeout(timer);
    };
  }, []);

  const { shows, totalCount, itemsByShow, readyCount, markWatched } =
    useUpNextQueue({
      limit: RAIL_LIMIT,
      concurrency: 3,
      enabled: resolveReady,
      surface: "rail",
    });

  // Basma animasyonu kart başına tek Animated.Value kullanır.
  const scaleValuesRef = useRef({});
  const getScaleValue = (id) => {
    if (!scaleValuesRef.current[id]) {
      scaleValuesRef.current[id] = new Animated.Value(1);
    }
    return scaleValuesRef.current[id];
  };

  const onPressIn = useCallback((id) => {
    Animated.timing(getScaleValue(id), {
      toValue: 0.9,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, []);
  const onPressOut = useCallback((id) => {
    Animated.timing(getScaleValue(id), {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleOpen = useCallback(
    (show) => navigation.push("TvShowsDetails", { id: show.id }),
    [navigation]
  );

  const handleWatched = useCallback(
    (item) => markWatched(item),
    [markWatched]
  );

  // Basılı tutma: diğer raylardaki gibi hızlı eylem sayfası. Buradaki `show`
  // izlenen-dizi kaydı (name/imagePath); sayfa kalan alanları TMDB'den çeker.
  const handleQuickActions = useCallback(
    (show) => openQuickActions({ item: show, mediaType: "tv", navigation }),
    [openQuickActions, navigation]
  );

  const renderItem = useCallback(
    ({ item: show }) => {
      const key = String(show.id);
      return (
        <UpNextRailCard
          show={show}
          item={itemsByShow[key]}
          resolved={key in itemsByShow}
          poster={poster}
          theme={theme}
          language={language}
          scaleValue={getScaleValue(show.id)}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onOpen={handleOpen}
          onWatched={handleWatched}
          onChooseDate={setDateItem}
          onQuickActions={handleQuickActions}
        />
      );
    },
    [
      handleOpen,
      handleQuickActions,
      handleWatched,
      itemsByShow,
      language,
      onPressIn,
      onPressOut,
      poster,
      theme,
    ]
  );

  // Devam eden dizi yoksa bölüm hiç çizilmez.
  if (shows.length === 0) return null;

  return (
    <View style={styles.container}>
      <SectionHeader
        section="ongoing"
        mediaType="tv"
        title={i18nText("autoI18n.devam_eden_dizilerim", "Devam Edenler")}
        // Sırası gelmiş (bir sonraki bölümü hazır) dizi sayısı.
        badge={
          readyCount > 0 ? <SectionBadge icon="play-skip-forward" text={readyCount} /> : null
        }
        // Ray ilk RAIL_LIMIT diziyi gösterir; kesildiğini sayı söylesin.
        actionLabel={
          totalCount > shows.length
            ? `${getSeeAllLabel(language)} (${totalCount})`
            : undefined
        }
        onPressAction={() => navigation.navigate("UpNextScreen")}
      />

      <FlatList
        data={shows}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        keyExtractor={(item) => String(item.id)}
        extraData={renderKey}
        initialNumToRender={3}
        maxToRenderPerBatch={3}
        updateCellsBatchingPeriod={80}
        windowSize={5}
        removeClippedSubviews
        renderItem={renderItem}
      />

      <WatchedDateSheet
        visible={!!dateItem}
        onClose={() => setDateItem(null)}
        subtitle={
          dateItem
            ? `${dateItem.showName} · S${dateItem.seasonNumber} B${dateItem.episodeNumber}`
            : undefined
        }
        pickerSubtitle={i18nText(
          "autoI18n.up_next_tarih_alt_baslik",
          "Bu bölümü ne zaman izledin?"
        )}
        releaseDate={dateItem?.airDate || undefined}
        minDate={dateItem?.airDate || undefined}
        mediaType="tv"
        scope="episode"
        onConfirm={(date) => {
          const selected = dateItem;
          if (!selected) return;
          // Kart arkada zaten anında ilerliyor; sayfa kaydı beklemeden kapanır.
          setDateItem(null);
          markWatched(selected, date);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  list: { paddingHorizontal: 15 },
});
