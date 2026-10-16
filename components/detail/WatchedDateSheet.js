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
import Toast from "react-native-toast-message";
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
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";
import { isUnreleased } from "../../utils/watchState";
import { selectionAsync } from "../../services/hapticsService";
import {
  mediaKey,
  setMyRating,
  subscribeToMyRating,
} from "../../services/ratingsService";
import { addMediaComment } from "../../services/mediaCommentsService";

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
    if (ratingDraft > 0 && !ratingLocked && ratingDraft !== (myRating ?? 0)) {
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
              source={{ uri: getTmdbUrl(posterPath, "poster", 200) }}
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
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{
          selected: !!selectedDate,
          disabled: !hasValidRange || isBusy,
        }}
        activeOpacity={0.8}
        disabled={!hasValidRange || isBusy}
        onPress={() => setDatePickerVisibility(true)}
        style={[
          styles.customDate,
          {
            backgroundColor: selectedDate
              ? alpha(theme.accent, 0.12)
              : theme.between,
            borderColor: selectedDate ? theme.accent : theme.border,
            opacity: hasValidRange ? 1 : 0.55,
          },
        ]}
      >
        <View
          style={[
            styles.optionIcon,
            { backgroundColor: alpha(theme.accent, 0.16) },
          ]}
        >
          <Ionicons name="calendar-outline" size={21} color={theme.accent} />
        </View>
        <View style={styles.optionText}>
          <Text
            allowFontScaling={false}
            style={[styles.optionTitle, { color: theme.text.primary }]}
          >
            {selectedDate
              ? formatDate(selectedDate)
              : i18nText("autoI18n.tarih_sec", "Tarih Seç")}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.optionSubtitle, { color: theme.text.muted }]}
          >
            {hasValidRange
              ? i18nText(
                  "autoI18n.takvimden_izleme_tarihi_sec",
                  "Takvimden izleme tarihini belirle",
                )
              : i18nText(
                  "autoI18n.henuz_yayinlanmadi",
                  "Bu içerik henüz yayınlanmadı",
                )}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={19} color={theme.text.muted} />
      </TouchableOpacity>

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
        <View
          style={[
            styles.selectionIcon,
            {
              backgroundColor: selectedDate
                ? alpha(theme.accent, 0.18)
                : alpha(theme.text.muted, 0.14),
            },
          ]}
        >
          <Ionicons
            name={selectedDate ? "checkmark-circle" : "information-circle-outline"}
            size={17}
            color={selectedDate ? theme.accent : theme.text.muted}
          />
        </View>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
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

      {showExtras && (
        <>
          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />

          <View style={[styles.sectionPill, { backgroundColor: alpha(theme.colors.orange, 0.12) }]}>
            <Ionicons name="star" size={12} color={theme.colors.orange} />
            <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.colors.orange }]}>
              {i18nText("autoI18n.puanla_opsiyonel", "Puanla (opsiyonel)")}
            </Text>
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
              <RatingInput value={ratingDraft} onChange={setRatingDraft} size={30} color={theme.colors.orange} />
              <Text allowFontScaling={false} style={[styles.ratingValue, { color: ratingDraft > 0 ? theme.colors.orange : theme.text.muted }]}>
                {ratingDraft > 0
                  ? `${ratingDraft.toFixed(1)} / 10`
                  : i18nText("autoI18n.yildizlara_dokun", "Yıldızlara dokun")}
              </Text>
            </View>
          )}

          <View style={[styles.sectionPill, { backgroundColor: alpha(theme.accent, 0.12), marginTop: 16 }]}>
            <Ionicons name="chatbubble-ellipses-outline" size={12} color={theme.accent} />
            <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.accent }]}>
              {i18nText("autoI18n.yorum_yap_opsiyonel", "Yorum yap (opsiyonel)")}
            </Text>
          </View>
          <View
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
              style={[styles.commentInput, { color: theme.text.primary }]}
              placeholder={i18nText(
                "autoI18n.bu_yapim_hakkinda_ne_dusunuyorsun",
                "Bu yapım hakkında ne düşünüyorsun?",
              )}
              placeholderTextColor={theme.text.muted}
              multiline
              value={commentText}
              onChangeText={setCommentText}
              maxLength={COMMENT_TEXT_LIMIT}
              textAlignVertical="top"
              editable={!isBusy}
            />
            <Text allowFontScaling={false} style={[styles.commentCounter, { color: theme.text.muted }]}>
              {Math.max(0, COMMENT_TEXT_LIMIT - commentText.length)}
            </Text>
          </View>
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
  title,
  subtitle,
  selected,
  disabled,
  onPress,
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
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
      <View style={[styles.quickIcon, { backgroundColor: alpha(theme.accent, 0.14) }]}>
        <Ionicons name={icon} size={19} color={theme.accent} />
      </View>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.quickTitle, { color: theme.text.primary }]}
      >
        {title}
      </Text>
      <Text
        allowFontScaling={false}
        numberOfLines={2}
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
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 18,
    paddingTop: 11,
    paddingBottom: 34,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 18 },
  headerIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  posterFrame: { width: 42, height: 60, borderRadius: 13, borderWidth: 1.5 },
  poster: { width: "100%", height: "100%", borderRadius: 11.5 },
  posterIconBadge: { position: "absolute", right: -5, bottom: -5, width: 22, height: 22, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  headerText: { flex: 1 },
  title: { fontSize: 17, fontWeight: "800", letterSpacing: -0.25 },
  scopePill: { alignSelf: "flex-start", marginTop: 4, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, flexDirection: "row", alignItems: "center" },
  scopeDot: { width: 5, height: 5, borderRadius: 3 },
  scopeText: { fontSize: 9.5, lineHeight: 12, fontWeight: "800" },
  subtitle: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  customDate: { minHeight: 68, borderRadius: 17, borderWidth: 1, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 11 },
  optionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 13.5, fontWeight: "700" },
  optionSubtitle: { fontSize: 10.5, lineHeight: 14, marginTop: 2 },
  quickRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  quickOption: { flex: 1, minHeight: 104, borderRadius: 16, borderWidth: 1, padding: 11, justifyContent: "center" },
  quickIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  quickTitle: { fontSize: 12, fontWeight: "700" },
  quickSubtitle: { fontSize: 9.5, lineHeight: 12.5, marginTop: 3 },
  selectedMark: { position: "absolute", top: 8, right: 8 },
  selectionSummary: { minHeight: 50, borderRadius: 16, borderWidth: 1, paddingHorizontal: 10, marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  selectionIcon: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  selectionText: { flex: 1, fontSize: 11, lineHeight: 15, fontWeight: "600" },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: 2 },
  sectionDivider: { height: StyleSheet.hairlineWidth, marginTop: 18, marginBottom: 14 },
  sectionPill: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, marginBottom: 9 },
  sectionTitle: { fontSize: 11.5, fontWeight: "800" },
  lockedBox: { minHeight: 44, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  lockedText: { flex: 1, fontSize: 11.5, lineHeight: 15, fontWeight: "600" },
  ratingCard: { minHeight: 84, borderRadius: 16, borderWidth: 1.5, paddingVertical: 16, alignItems: "center", justifyContent: "center", gap: 10 },
  ratingValue: { fontSize: 11.5, fontWeight: "700" },
  commentField: { position: "relative", borderRadius: 16, borderWidth: 1.5, overflow: "hidden" },
  commentInput: { width: "100%", minHeight: 84, maxHeight: 130, paddingTop: 11, paddingHorizontal: 12, paddingBottom: 22, fontSize: 13.5, lineHeight: 19 },
  commentCounter: { position: "absolute", right: 10, bottom: 7, fontSize: 10, fontWeight: "700" },
  commentHint: { fontSize: 10.5, lineHeight: 14, marginTop: 6 },
  confirmButtonWrap: { marginTop: 14, borderRadius: 17, overflow: "hidden" },
  confirmButton: { height: 52, borderRadius: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  confirmText: { color: "#FFFFFF", fontSize: 14.5, fontWeight: "800", letterSpacing: -0.1 },
});
