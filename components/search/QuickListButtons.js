// components/search/QuickListButtons.js
//
// Arama sonuçlarındaki (Film/Dizi arama) satır ve ızgara kartlarında hızlı
// liste eylemleri: dört buton.
//
// NEDEN AYRI DOSYA: MovieSearch.js ve TvShowSearch.js birebir aynı kart
// yapısını iki kez tanımlıyor (bkz. dosya başlıklarındaki not); bu buton
// grubu da ikisinde aynı davranmalı. Tek kaynak burada, `mediaType` prop'u
// farkı yönetiyor.
//
// DÖRT BUTON, DÖRT AYRI HEDEF:
//   • İzlenecekler / Favoriler → anında, tek dokunuşlu ekle/çıkar
//     (services/libraryActions.setListMembership: sıralı, iyimser, hatada geri alır).
//   • İzledim → components/detail/WatchedDateSheet'i DOĞRUDAN açar (detay
//     ekranı ve MediaQuickActionsSheet'in kullandığı AYNI, standalone sayfa).
//     Onay anında services/listQuickAdd.addMediaToList çağrılır — bu
//     fonksiyon filmde yayın-tarihi kapısını, DİZİDE TÜM SEZON/BÖLÜM
//     verisinin TMDB'den çekilip TEK seferde yazılmasını zaten
//     doğru yapıyor (ListsScreen'in global arama "hızlı ekle" akışıyla
//     birebir aynı yol). Bu mantığı burada YENİDEN YAZMAK — özellikle dizi
//     sezon/bölüm çekimi — ikinci, sapabilecek bir kopya doğururdu.
//   • Diğer Listeler → components/lists/OtherListsPickerModal'ı açar (aynı
//     ListStatusContext.otherListKeys verisi + setListMembership özel liste
//     yolu, ListView.js'in "Diğer Listeler" ızgarasıyla aynı davranış).
//
// Önceki sürümde bu iki buton `useMediaQuickActions().openQuickActions()`
// çağırıp UZUN BASMAYLA açılan genel sayfayı açıyordu — ikisi de aynı yere
// gidiyordu. Bu, doğru hedefe gitmiyor.

import React, { useRef, useState, memo } from "react";
import { StyleSheet, View, TouchableOpacity, Animated } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "react-native-toast-message";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useHapticsSettings, useApiSettings } from "../../context/AppSettingsContext";
import { useListStatus } from "@hooks/useListStatus";
import * as Haptics from "@services/hapticsService";
import { setListMembership } from "../../services/libraryActions";
import { addMediaToList } from "../../services/listQuickAdd";
import { showLibraryError } from "../../utils/libraryErrorText";
import { toCandidate } from "../../utils/listSearch";
import { todayListDate } from "../../utils/mediaFacts";
import { i18nText } from "../../utils/i18nText";
import WatchedDateSheet from "../detail/WatchedDateSheet";
import OtherListsPickerModal from "../lists/OtherListsPickerModal";

const FALLBACK = { blue: "#64b4ff", green: "#29b864", red: "#e33", orange: "#ff6400" };

const QuickButton = memo(function QuickButton({
  active,
  iconOn,
  iconOff,
  tint,
  size,
  iconSize,
  theme,
  onPress,
  accessibilityLabel,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    scale.stopAnimation();
    scale.setValue(0.8);
    Animated.spring(scale, {
      toValue: 1,
      speed: 20,
      bounciness: 9,
      useNativeDriver: true,
    }).start();
    onPress();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View
        style={[
          styles.btn,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: active ? tint + "2e" : theme.secondary,
            borderColor: active ? tint + "77" : theme.border,
            transform: [{ scale }],
          },
        ]}
      >
        <Ionicons
          name={active ? iconOn : iconOff}
          size={iconSize}
          color={active ? tint : (theme.text?.muted ?? "#888")}
        />
      </Animated.View>
    </TouchableOpacity>
  );
});

/**
 * Props:
 *  - item                : ham TMDB öğesi (id, title/name, poster_path, …) —
 *                           hem liste yazımı hem İzledim/Diğer Listeler için
 *  - mediaType            : "movie" | "tv"
 *  - navigation           : Diğer Listeler'den "Tüm Listeler"e gitmek için
 *  - orientation          : "vertical" (satır kartı, sağda üstten alta) |
 *                            "horizontal" (ızgara kartı, posterin altında)
 *  - size, iconSize       : buton ölçüleri (verilmezse orientation'a göre)
 *  - style                : dış konumlandırma
 */
function QuickListButtons({
  item,
  mediaType,
  navigation,
  orientation = "vertical",
  size,
  iconSize,
  style,
}) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { hapticsEnabled } = useHapticsSettings();
  const { API_KEY } = useApiSettings();
  const mediaId = item?.id ?? null;
  const title = item?.title || item?.name || "";
  const posterPath = item?.poster_path ?? null;
  const releaseDate = item?.release_date || item?.first_air_date || null;
  const { inWatchList, inFavorites, isWatched, isInOtherLists } = useListStatus(
    mediaId,
    mediaType,
  );

  // NOT: iyimser durum burada TUTULMUYOR. useListStatus'un döndürdüğü bayraklar
  // services/libraryOverlay bindirmesini zaten içerir: işlem başlar başlamaz
  // düğme döner, hata olursa kendiliğinden geri döner — üstelik aynı eseri
  // gösteren başka ekranlar da aynı anda güncellenir.

  const c = theme?.colors ?? {};
  const btnSize = size ?? (orientation === "vertical" ? 24 : 20);
  const btnIconSize = iconSize ?? (orientation === "vertical" ? 12 : 10);

  const kindLabel = mediaType === "tv"
    ? i18nText("autoI18n.dizi", "Dizi")
    : i18nText("autoI18n.film", "Film");

  const requireAuth = () => {
    if (user?.uid) return true;
    Toast.show({
      type: "warning",
      text1: i18nText(
        "autoI18n.listeye_eklemek_icin_giris_yap",
        "Listeye eklemek için giriş yap",
      ),
    });
    return false;
  };

  const toggle = async (listKey) => {
    if (mediaId == null || !requireAuth()) return;
    // Hedef durum GÖRÜNEN (bindirmeli) durumdan türer: art arda iki dokunuş
    // ekle→çıkar olur, ekle→ekle değil; sıralamayı libraryActions korur.
    const nextActive = !(listKey === "favorites" ? inFavorites : inWatchList);
    if (hapticsEnabled) {
      Haptics.impactAsync(
        nextActive
          ? Haptics.ImpactFeedbackStyle.Medium
          : Haptics.ImpactFeedbackStyle.Light,
      );
    }
    const listLabel = listKey === "favorites" ? t.favorites : t.watchList;
    try {
      await setListMembership({
        uid: user.uid,
        listKey,
        item: {
          id: mediaId,
          type: mediaType,
          name: title,
          imagePath: posterPath,
          dateAdded: todayListDate(),
        },
        desired: nextActive,
      });
      if (nextActive) {
        Toast.show({
          type: "success",
          text1: i18nText(
            "autoI18n.media_added_to_list",
            "{{media}} {{list}} listesine eklendi!",
            { media: kindLabel, list: listLabel },
          ),
        });
      } else {
        Toast.show({
          type: "warning",
          text1: i18nText(
            "autoI18n.media_removed_from_list",
            "{{media}} {{list}} listesinden kaldırıldı!",
            { media: kindLabel, list: listLabel },
          ),
        });
      }
    } catch (error) {
      // Bindirme ve yerel liste kendiliğinden geri döndü; yalnız bildir.
      showLibraryError(error, { source: "quick_list_toggle" });
    }
  };

  const [watchedSheetVisible, setWatchedSheetVisible] = useState(false);
  const [otherListsVisible, setOtherListsVisible] = useState(false);

  const openWatchedSheet = () => {
    if (mediaId == null || !requireAuth()) return;
    setWatchedSheetVisible(true);
  };

  const openOtherLists = () => {
    if (mediaId == null || !requireAuth()) return;
    setOtherListsVisible(true);
  };

  // İzledim onayı: film/dizi ayrımını, yayın-tarihi kapısını ve dizide tüm
  // sezon/bölüm çekimini services/listQuickAdd.addMediaToList çözüyor.
  const confirmWatch = async (date) => {
    try {
      const candidate = toCandidate(item, { fallbackType: mediaType });
      const { status } = await addMediaToList({
        uid: user.uid,
        listName: mediaType === "tv" ? "watchedTv" : "watchedMovies",
        media: candidate,
        apiKey: API_KEY,
        language,
        watchDate: date,
      });

      if (status === "empty-show") {
        Toast.show({
          type: "warning",
          text1: i18nText(
            "autoI18n.bolum_bilgisi_bulunamadi",
            "Bu dizinin bölüm bilgisi bulunamadı.",
          ),
        });
      } else if (status === "unreleased" || status === "unknown-release") {
        Toast.show({
          type: "warning",
          text1:
            status === "unreleased"
              ? i18nText("autoI18n.henuz_yayinlanmadi", "Henüz yayınlanmadı")
              : i18nText(
                  "autoI18n.yayin_tarihi_bilinmiyor",
                  "Yayın tarihi bilinmiyor",
                ),
          text2: i18nText(
            "autoI18n.izlendi_olarak_eklenemez",
            "İzlendi olarak eklenemez.",
          ),
        });
      } else {
        Toast.show({
          type: "success",
          text1: i18nText(
            "autoI18n.media_added_to_list",
            "{{media}} {{list}} listesine eklendi!",
            { media: kindLabel, list: mediaType === "tv" ? t.watchedTv : t.watchedMovies },
          ),
        });
      }
      setWatchedSheetVisible(false);
    } catch (error) {
      showLibraryError(error, { source: "quick_list_watched" });
    }
  };

  if (mediaId == null) return null;

  return (
    <>
      <View
        style={[
          orientation === "vertical" ? styles.colVertical : styles.colHorizontal,
          style,
        ]}
      >
        <QuickButton
          active={inWatchList}
          iconOn="bookmark"
          iconOff="bookmark-outline"
          tint={c.blue ?? FALLBACK.blue}
          size={btnSize}
          iconSize={btnIconSize}
          theme={theme}
          onPress={() => toggle("watchList")}
          accessibilityLabel={t.watchList}
        />
        <QuickButton
          active={isWatched}
          iconOn="eye"
          iconOff="eye-outline"
          tint={c.green ?? FALLBACK.green}
          size={btnSize}
          iconSize={btnIconSize}
          theme={theme}
          onPress={openWatchedSheet}
          accessibilityLabel={t.watchedMovies}
        />
        <QuickButton
          active={inFavorites}
          iconOn="heart"
          iconOff="heart-outline"
          tint={c.red ?? FALLBACK.red}
          size={btnSize}
          iconSize={btnIconSize}
          theme={theme}
          onPress={() => toggle("favorites")}
          accessibilityLabel={t.favorites}
        />
        <QuickButton
          active={isInOtherLists}
          iconOn="grid"
          iconOff="grid-outline"
          tint={c.orange ?? FALLBACK.orange}
          size={btnSize}
          iconSize={btnIconSize}
          theme={theme}
          onPress={openOtherLists}
          accessibilityLabel={i18nText("autoI18n.diger_listeler", "Diğer Listeler")}
        />
      </View>

      <WatchedDateSheet
        visible={watchedSheetVisible}
        onClose={() => setWatchedSheetVisible(false)}
        subtitle={
          mediaType === "tv"
            ? i18nText(
                "autoI18n.bu_diziyi_ne_zaman_izlediniz",
                "Bu diziyi ne zaman izlediniz?",
              )
            : i18nText(
                "autoI18n.bu_filmi_ne_zaman_izlediniz",
                "Bu filmi ne zaman izlediniz?",
              )
        }
        pickerSubtitle={
          mediaType === "tv"
            ? i18nText(
                "autoI18n.bu_diziyi_ne_zaman_izlemeye_basladiniz",
                "Bu diziyi ne zaman izlemeye başladınız?",
              )
            : i18nText(
                "autoI18n.film_izleme_tarihini_sec",
                "Filmi izlediğiniz tarihi seçin",
              )
        }
        releaseDate={releaseDate}
        minDate={releaseDate}
        mediaType={mediaType}
        scope={mediaType === "tv" ? "show" : "movie"}
        mediaId={mediaId}
        mediaTitle={title}
        posterPath={posterPath}
        onConfirm={confirmWatch}
      />

      <OtherListsPickerModal
        visible={otherListsVisible}
        onClose={() => setOtherListsVisible(false)}
        mediaId={mediaId}
        mediaType={mediaType}
        title={title}
        posterPath={posterPath}
        navigation={navigation}
      />
    </>
  );
}

export default memo(QuickListButtons);

const styles = StyleSheet.create({
  colVertical: {
    alignItems: "center",
    gap: 6,
  },
  colHorizontal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  btn: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
