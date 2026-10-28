import { intlLocaleOf } from "../../utils/appLanguages";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import Toast from "@components/AppToast";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DatePickerModal, { normalizeDate } from "../modals/DatePickerModal";
import BottomSheetModal from "../common/BottomSheetModal";
import RatingInput from "../RatingInput";
import { useTheme } from "../../context/ThemeContext";
import GlassCloseButton from "../common/GlassCloseButton";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useUserProfile } from "../../context/UserProfileContext";
import { useImageQualitySettings } from "../../context/AppSettingsContext";
import usePosterUri from "../../hooks/usePosterUri";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { isUnreleased } from "../../utils/watchState";
import { selectionAsync } from "../../services/hapticsService";
import {
  mediaKey,
  removeMyRating,
  setMyRating,
  subscribeToMyRating,
} from "../../services/ratingsService";
import { addMediaComment } from "../../services/mediaCommentsService";
import GlassTouchable from "../common/GlassTouchable";
import GlassBox from "../common/GlassBox";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

const todayIso = () => normalizeDate(new Date());
const COMMENT_TEXT_LIMIT = 500;

const parseLocalDate = (value) => {
  const iso = normalizeDate(value);
  if (!iso) return null;
  const date = new Date(`${iso}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default function WatchedDateSheet({
  visible,
  onClose,
  subtitle,
  pickerSubtitle,
  releaseDate,
  minDate,
  onConfirm,
  busy = false,
  mediaType = "movie",
  scope = mediaType === "tv" ? "show" : "movie",
  mediaId = null,
  mediaTitle = "",
  posterPath = null,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { getTmdbUrl } = useImageQualitySettings();
  const posterUri = usePosterUri();
  const {
    displayName: myDisplayName,
    username: myUsername,
    avatarIndex: myAvatarIndex,
    photoURL: myPhotoURL,
  } = useUserProfile();
  const insets = useSafeAreaInsets();
  const [selectedDate, setSelectedDate] = useState(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [myRating, setMyRatingValue] = useState(null);
  const [ratingDraft, setRatingDraft] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [commentInputHeight, setCommentInputHeight] = useState(42);
  const submitLock = useRef(false);
  const resetTimer = useRef(null);

  const today = todayIso();
  const releaseIso = normalizeDate(releaseDate);
  const minIso = normalizeDate(minDate);
  const hasValidRange = !minIso || minIso <= today;
  const canUseReleaseDate = !!releaseIso && releaseIso <= today;
  const isBusy = busy || submitting;
  // Sadece dizinin/filmin GENELİNİ izlendi işaretlerken puan+yorum göster —
  // Ratings/Comment veri modeli medya bazlı, tekil sezon/bölüm işaretlemede
  // (SeasonItem/WatchedAdd/UpNext gibi toplu akışlarda) her seferinde sorup
  // kullanıcıyı yormanın karşılığı yok.
  const showExtras = (scope === "movie" || scope === "show") && mediaId != null;
  const ratingKey = showExtras ? mediaKey(mediaType, mediaId) : null;
  const ratingLocked = showExtras && isUnreleased(releaseDate) && myRating == null;
  const scopeMeta = useMemo(() => {
    if (scope === "episode") {
      return {
        icon: "play-skip-forward-outline",
        label: i18nText("autoI18n.bolum", "Bölüm"),
        title: i18nText("autoI18n.bolum_izleme_tarihi", "Bölüm izleme tarihi"),
      };
    }
    if (scope === "season") {
      return {
        icon: "albums-outline",
        label: i18nText("autoI18n.sezon", "Sezon"),
        title: i18nText("autoI18n.sezon_izleme_tarihi", "Sezon izleme tarihi"),
      };
    }
    if (scope === "show") {
      return {
        icon: "tv-outline",
        label: i18nText("autoI18n.dizi", "Dizi"),
        title: i18nText("autoI18n.dizi_izleme_tarihi", "Dizi izleme tarihi"),
      };
    }
    return {
      icon: "film-outline",
      label: i18nText("autoI18n.film", "Film"),
      title: i18nText("autoI18n.film_izleme_tarihi", "Film izleme tarihi"),
    };
  }, [language, scope]);

  useEffect(() => {
    if (visible) return;
    setDatePickerVisibility(false);
    // BottomSheetModal kapanış animasyonu sırasında son seçim görünür kalsın.
    // Temizlik panel ekrandan çıktıktan sonra yapılır; hızlı yeniden açılışta
    // eski zamanlayıcı iptal edilir.
    resetTimer.current = setTimeout(() => {
      setSelectedDate(null);
      setSubmitting(false);
      setRatingDraft(0);
      setCommentText("");
      setCommentInputHeight(42);
      submitLock.current = false;
      resetTimer.current = null;
    }, 300);
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
        resetTimer.current = null;
      }
    };
  }, [visible]);

  // Açılışta tarih boşsa (henüz seçim yapılmadıysa) bugünü öntanımlı seç —
  // izin verilen aralık buna uygunsa. Aralık uygun DEĞİLSE (ör. yayın tarihi
  // ileride) bilerek null bırakılır: Onayla butonu `!selectedDate` kontrolüyle
  // devre dışı kalır, yoksa henüz yayınlanmamış içerik geçersiz bir tarihle
  // (bugün < minDate) işaretlenebilir hale gelir.
  useEffect(() => {
    if (!visible) return;
    setSelectedDate((prev) => (prev ? prev : hasValidRange ? today : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Kendi oyunu dinle — modal içindeki puanlama, detay sayfasındaki
  // "Derecelendirme" sheet'iyle AYNI Ratings/{mediaKey} kaydını paylaşır.
  useEffect(() => {
    if (!visible || !showExtras || !ratingKey || !user?.uid) return;
    const unsubscribe = subscribeToMyRating(ratingKey, user.uid, (r) => {
      setMyRatingValue(r);
      setRatingDraft(r ?? 0);
    });
    return unsubscribe;
  }, [visible, showExtras, ratingKey, user?.uid]);

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocaleOf(language), {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [language],
  );

  const formatDate = (value) => {
    const date = parseLocalDate(value);
    return date ? formatter.format(date) : "";
  };

  const selectDate = (date) => {
    if (isBusy || !date) return;
    const next = normalizeDate(date);
    if (!next || next === selectedDate) return;
    setSelectedDate(next);
    selectionAsync().catch(() => {});
  };

  const handlePickerConfirm = (date) => {
    setDatePickerVisibility(false);
    selectDate(date);
  };

  // Puan/yorum, izlendi kaydından bağımsız iki ayrı Firestore yazımıdır
  // (Ratings/{mediaKey}, MovieComment|TvComment/{id}/comments) — biri
  // başarısız olsa da asıl "izlendi işaretle" eylemi (onConfirm) engellenmez,
  // sadece kullanıcıya toast ile bildirilir.
  const submitExtras = async () => {
    if (!showExtras || !user?.uid || mediaId == null) return;
    if (ratingDraft <= 0 && myRating != null && !ratingLocked) {
      try {
        await removeMyRating({ mediaType, mediaId, uid: user.uid });
      } catch (e) {
        Toast.show({
          type: "error",
          text1: i18nText("autoI18n.puan_kaydedilemedi", "Puan sıfırlanamadı"),
        });
      }
    } else if (ratingDraft > 0 && !ratingLocked && ratingDraft !== (myRating ?? 0)) {
      try {
        await setMyRating({
          mediaType,
          mediaId,
          uid: user.uid,
          rating: ratingDraft,
          title: mediaTitle,
          poster: posterPath,
        });
      } catch (e) {
        Toast.show({
          type: "error",
          text1: i18nText("autoI18n.puan_kaydedilemedi", "Puan kaydedilemedi"),
        });
      }
    }
    const trimmedComment = commentText.trim();
    if (trimmedComment) {
      try {
        await addMediaComment({
          mediaType,
          mediaId,
          text: trimmedComment,
          uid: user.uid,
          username: myDisplayName || user.displayName || "",
          userHandle: myUsername || "",
          avatar: myPhotoURL || user.photoURL || null,
          avatarIndex: myAvatarIndex,
          title: mediaTitle,
          poster: posterPath,
        });
      } catch (e) {
        Toast.show({
          type: "error",
          text1: i18nText("autoI18n.yorum_gonderilemedi", "Yorum gönderilemedi"),
        });
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedDate || isBusy || submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      await submitExtras();
      await onConfirm?.(selectedDate);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const closeSheet = () => {
    if (isBusy) return;
    if (isDatePickerVisible) {
      setDatePickerVisibility(false);
      return;
    }
    onClose?.();
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={closeSheet}
      intensity={38}
      dimColor="rgba(0,0,0,0.42)"
      dismissOnBackdropPress={!isBusy}
      liftWithKeyboard={showExtras}
      sheetStyle={[
        styles.sheet,
        {
          backgroundColor: theme.secondary,
          borderColor: theme.border,
          paddingBottom: Math.max(insets.bottom + 22, 34),
          maxHeight: "92%",
        },
      ]}
    >
      <View style={[styles.handle, { backgroundColor: theme.border }]} />

      <View style={styles.header}>
        {posterPath ? (
          <View style={[styles.posterFrame, { borderColor: alpha(theme.accent, 0.3) }]}>
            <Image
              source={{
                // Sezon/bölüm kapsamı sezon afişi taşır: özel afiş yalnız film/dizi kapsamında.
                uri:
                  scope === "movie" || scope === "show"
                    ? posterUri(mediaType, mediaId, posterPath)
                    : getTmdbUrl(posterPath, "poster", 200),
              }}
              style={styles.poster}
              contentFit="cover"
            />
            <View style={[styles.posterIconBadge, { backgroundColor: theme.accent, borderColor: theme.secondary }]}>
              <Ionicons name={scopeMeta.icon} size={11} color="#FFFFFF" />
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.headerIcon,
              { backgroundColor: alpha(theme.accent, 0.14) },
            ]}
          >
            <Ionicons name={scopeMeta.icon} size={21} color={theme.accent} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.title, { color: theme.text.primary }]}
          >
            {mediaTitle || scopeMeta.title}
          </Text>
          <View
            style={[
              styles.scopePill,
              { backgroundColor: alpha(theme.accent, 0.11) },
            ]}
          >
            <View style={[styles.scopeDot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.scopeText, { color: theme.accent }]}>
              {scopeMeta.label}
            </Text>
          </View>
          {!!subtitle && (
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[styles.subtitle, { color: theme.text.muted }]}
            >
              {subtitle}
            </Text>
          )}
        </View>
        <GlassCloseButton
          size={34}
          fallbackRadius={11}
          backgroundColor={theme.between}
          disabled={isBusy}
          onPress={closeSheet}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      <View
        style={[
          styles.selectionSummary,
          selectedDate
            ? {
                backgroundColor: alpha(theme.accent, 0.12),
                borderColor: alpha(theme.accent, 0.32),
              }
            : { backgroundColor: theme.primary, borderColor: theme.border },
        ]}
      >
        <Ionicons
          name={selectedDate ? "checkmark-circle" : "information-circle-outline"}
          size={17}
          color={selectedDate ? theme.accent : theme.text.muted}
        />
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            styles.selectionText,
            { color: selectedDate ? theme.text.primary : theme.text.muted },
          ]}
        >
          {selectedDate
            ? i18nText(
                "autoI18n.secilen_izleme_tarihi",
                "Seçilen tarih: {{date}}",
                { date: formatDate(selectedDate) },
              )
            : i18nText(
                "autoI18n.kaydetmeden_once_tarih_sec",
                "Kaydetmeden önce bir izleme tarihi seçin",
              )}
        </Text>
      </View>

      <View style={styles.quickRow}>
        <QuickDateOption
          icon="time-outline"
          title={i18nText("autoI18n.bugun", "Bugün")}
          subtitle={formatDate(today)}
          selected={selectedDate === today}
          disabled={!hasValidRange || isBusy}
          onPress={() => selectDate(today)}
        />
        <QuickDateOption
          calendarDate={selectedDate || today}
          title={i18nText("autoI18n.tarih_sec", "Tarih Seç")}
          subtitle={
            hasValidRange
              ? i18nText("autoI18n.takvim", "Takvim")
              : i18nText("autoI18n.kullanilamaz", "Kullanılamaz")
          }
          selected={!!selectedDate && selectedDate !== today && selectedDate !== releaseIso}
          disabled={!hasValidRange || isBusy}
          onPress={() => setDatePickerVisibility(true)}
        />
        <QuickDateOption
          icon={mediaType === "tv" ? "tv-outline" : "film-outline"}
          title={i18nText("autoI18n.yayin_tarihi", "Yayın Tarihi")}
          subtitle={
            canUseReleaseDate
              ? formatDate(releaseIso)
              : i18nText("autoI18n.kullanilamaz", "Kullanılamaz")
          }
          selected={selectedDate === releaseIso}
          disabled={!canUseReleaseDate || isBusy}
          onPress={() => selectDate(releaseIso)}
        />
      </View>

      {showExtras && (
        <>
          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />

          <View style={styles.sectionHeader}>
            <View style={[styles.sectionPill, { backgroundColor: alpha(theme.colors.orange, 0.12) }]}>
              <Ionicons name="star" size={12} color={theme.colors.orange} />
              <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.colors.orange }]}>
                {i18nText("autoI18n.puanla_opsiyonel", "Puanla (opsiyonel)")}
              </Text>
            </View>
            <GlassTouchable
              accessibilityRole="button"
              accessibilityState={{ disabled: ratingDraft <= 0 || isBusy }}
              disabled={ratingDraft <= 0 || isBusy}
              onPress={() => setRatingDraft(0)}
              style={[
                styles.ratingReset,
                { borderColor: theme.border, opacity: ratingDraft > 0 && !isBusy ? 1 : 0.42 },
              ]}
            >
              <Ionicons name="refresh" size={13} color={theme.text.muted} />
              <Text allowFontScaling={false} style={[styles.ratingResetText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.sifirla", "Sıfırla")}
              </Text>
            </GlassTouchable>
          </View>
          {ratingLocked ? (
            <View style={[styles.lockedBox, { backgroundColor: theme.between, borderColor: theme.border }]}>
              <Ionicons name="lock-closed-outline" size={15} color={theme.text.muted} />
              <Text allowFontScaling={false} style={[styles.lockedText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.henuz_yayinlanmadi", "Bu içerik henüz yayınlanmadı")}
              </Text>
            </View>
          ) : (
            <View
              pointerEvents={isBusy ? "none" : "auto"}
              style={[
                styles.ratingCard,
                {
                  backgroundColor: theme.between,
                  borderColor: ratingDraft > 0 ? alpha(theme.colors.orange, 0.4) : theme.border,
                  opacity: isBusy ? 0.6 : 1,
                },
              ]}
            >
              <RatingInput value={ratingDraft} onChange={setRatingDraft} size={27} color={theme.colors.orange} />
              <Text allowFontScaling={false} style={[styles.ratingValue, { color: ratingDraft > 0 ? theme.colors.orange : theme.text.muted }]}>
                {ratingDraft > 0
                  ? `${ratingDraft.toFixed(1)} / 10`
                  : i18nText(
                      "autoI18n.yildizlara_dokun_veya_kaydir",
                      "Dokun veya kaydır",
                    )}
              </Text>
            </View>
          )}

          <View style={[styles.sectionPill, { backgroundColor: alpha(theme.accent, 0.12), marginTop: 10 }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={12} color={theme.accent} />
            <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.accent }]}>
              {i18nText("autoI18n.yorum_yap_opsiyonel", "Yorum yap (opsiyonel)")}
            </Text>
          </View>
          <GlassBox role="field"
            style={[
              styles.commentField,
              {
                backgroundColor: theme.primary,
                borderColor: commentText.trim() ? alpha(theme.accent, 0.4) : theme.border,
              },
            ]}
          >
            <TextInput
              allowFontScaling={false}
              placeholder={i18nText(
                "autoI18n.bu_yapim_hakkinda_ne_dusunuyorsun",
                "Bu yapım hakkında ne düşünüyorsun?",
              )}
              placeholderTextColor={theme.text.muted}
              multiline
              value={commentText}
              onChangeText={setCommentText}
              onContentSizeChange={({ nativeEvent }) => {
                const next = Math.ceil(nativeEvent.contentSize.height + 18);
                setCommentInputHeight(Math.max(42, Math.min(104, next)));
              }}
              maxLength={COMMENT_TEXT_LIMIT}
              textAlignVertical="center"
              editable={!isBusy}
              style={[
                styles.commentInput,
                { color: theme.text.primary, height: commentInputHeight },
              ]}
            />
            <Text allowFontScaling={false} style={[styles.commentCounter, { color: theme.text.muted }]}>
              {Math.max(0, COMMENT_TEXT_LIMIT - commentText.length)}
            </Text>
          </GlassBox>
          <Text allowFontScaling={false} style={[styles.commentHint, { color: theme.text.muted }]}>
            {i18nText(
              "autoI18n.yorumun_herkese_acik_paylasilir",
              "Yorumun, bu içeriğin Yorumlar bölümünde herkese açık paylaşılır.",
            )}
          </Text>
        </>
      )}
      </ScrollView>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: !selectedDate || isBusy, busy: isBusy }}
        activeOpacity={0.86}
        disabled={!selectedDate || isBusy}
        onPress={handleSubmit}
        style={styles.confirmButtonWrap}
      >
        <LinearGradient
          colors={
            selectedDate && !isBusy
              ? [theme.accent, theme.bold || theme.accent]
              : [theme.border, theme.border]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.confirmButton}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="checkmark-done" size={20} color="#FFFFFF" />
          )}
          <Text allowFontScaling={false} style={styles.confirmText}>
            {isBusy
              ? i18nText("autoI18n.kaydediliyor", "Kaydediliyor...")
              : i18nText(
                  "autoI18n.izlendi_olarak_isaretle",
                  "İzlendi olarak işaretle",
                )}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <DatePickerModal
        visible={isDatePickerVisible}
        value={selectedDate || today}
        onConfirm={handlePickerConfirm}
        onClose={() => setDatePickerVisibility(false)}
        title={i18nText("autoI18n.izleme_tarihi", "İzleme Tarihi")}
        subtitle={pickerSubtitle}
        confirmLabel={i18nText("autoI18n.tarihi_onayla", "Tarihi Onayla")}
        minDate={minIso || undefined}
        maxDate={today}
      />
    </BottomSheetModal>
  );
}

function QuickDateOption({
  icon,
  calendarDate,
  title,
  subtitle,
  selected,
  disabled,
  onPress,
}) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const calendarValue = parseLocalDate(calendarDate);
  const calendarMonth = calendarValue
    ? new Intl.DateTimeFormat(intlLocaleOf(language), { month: "short" }).format(calendarValue)
    : "";
  return (
    <GlassTouchable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      activeOpacity={0.82}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.quickOption,
        {
          backgroundColor: selected ? alpha(theme.accent, 0.12) : theme.between,
          borderColor: selected ? theme.accent : theme.border,
          opacity: disabled ? 0.48 : 1,
        },
      ]}
    >
      {calendarValue ? (
        <View style={[styles.calendarPreview, { borderColor: alpha(theme.accent, 0.48) }]}>
          <View style={[styles.calendarPreviewTop, { backgroundColor: theme.accent }]} />
          <Text allowFontScaling={false} style={[styles.calendarPreviewDay, { color: theme.text.primary }]}>
            {calendarValue.getDate()}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.calendarPreviewMonth, { color: theme.accent }]}>
            {calendarMonth}
          </Text>
        </View>
      ) : (
        <View style={[styles.quickIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
          <Ionicons name={icon} size={18} color={theme.accent} />
        </View>
      )}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.quickTitle, { color: theme.text.primary }]}
      >
        {title}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.quickSubtitle, { color: theme.text.muted }]}
      >
        {subtitle}
      </Text>
      {selected && (
        <Ionicons
          name="checkmark-circle"
          size={18}
          color={theme.accent}
          style={styles.selectedMark}
        />
      )}
    </GlassTouchable>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 9,
    paddingBottom: 34,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 10,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 12 },
  headerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  posterFrame: { width: 48, height: 68, borderRadius: 13, borderWidth: 1.5 },
  poster: { width: "100%", height: "100%", borderRadius: 11.5 },
  posterIconBadge: { position: "absolute", right: -5, bottom: -5, width: 22, height: 22, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.25 },
  scopePill: { alignSelf: "flex-start", marginTop: 4, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexDirection: "row", alignItems: "center" },
  scopeDot: { width: 5, height: 5, borderRadius: 3 },
  scopeText: { fontSize: 9.5, lineHeight: 12, fontWeight: "800" },
  subtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  quickRow: { flexDirection: "row", gap: 7, marginTop: 7 },
  quickOption: { flex: 1, minHeight: 72, borderRadius: 14, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 6, alignItems: "center", justifyContent: "center" },
  quickIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 3 },
  quickTitle: { fontSize: 10.5, lineHeight: 13, fontWeight: "800", textAlign: "center" },
  quickSubtitle: { fontSize: 8.5, lineHeight: 11, marginTop: 1, textAlign: "center" },
  selectedMark: { position: "absolute", top: 5, right: 5 },
  calendarPreview: { width: 31, height: 34, borderRadius: 8, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center", marginBottom: 2 },
  calendarPreviewTop: { position: "absolute", top: 0, left: 0, right: 0, height: 6 },
  calendarPreviewDay: { fontSize: 13, lineHeight: 15, fontWeight: "900", marginTop: 5 },
  calendarPreviewMonth: { fontSize: 6.5, lineHeight: 8, fontWeight: "900", textTransform: "uppercase" },
  selectionSummary: { minHeight: 39, borderRadius: 13, borderWidth: 1, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  selectionText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  // Tam genişlikteki cam kart/seçenekler basılınca kaydırma sınırında kesilmesin: üstte ve
  // yanlarda GLASS_PRESS_ROOM (dolgu + sayfanın yan/başlık boşluğuna taşan negatif dış boşluk).
  scroll: { flexGrow: 0, marginTop: -GLASS_PRESS_ROOM, marginHorizontal: -GLASS_PRESS_ROOM },
  scrollContent: { paddingTop: GLASS_PRESS_ROOM, paddingBottom: 2, paddingHorizontal: GLASS_PRESS_ROOM },
  sectionDivider: { height: StyleSheet.hairlineWidth, marginTop: 12, marginBottom: 9 },
  sectionHeader: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sectionPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 6 },
  sectionTitle: { fontSize: 11.5, fontWeight: "800" },
  ratingReset: { minHeight: 28, borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  ratingResetText: { fontSize: 10.5, fontWeight: "700" },
  lockedBox: { minHeight: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  lockedText: { flex: 1, fontSize: 11.5, lineHeight: 15, fontWeight: "600" },
  ratingCard: { minHeight: 52, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  ratingValue: { fontSize: 11.5, fontWeight: "700" },
  commentField: { position: "relative", minHeight: 42, borderRadius: 14, borderWidth: 1.5, overflow: "hidden" },
  commentInput: { width: "100%", minHeight: 42, maxHeight: 104, paddingTop: 9, paddingHorizontal: 11, paddingRight: 42, paddingBottom: 9, fontSize: 13, lineHeight: 18 },
  commentCounter: { position: "absolute", right: 9, bottom: 6, fontSize: 9, fontWeight: "700" },
  commentHint: { fontSize: 9.5, lineHeight: 12, marginTop: 4 },
  confirmButtonWrap: { marginTop: 10, borderRadius: 16, overflow: "hidden" },
  confirmButton: { height: 48, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  confirmText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "800", letterSpacing: -0.1 },
});
