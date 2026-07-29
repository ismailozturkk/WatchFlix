// components/modals/RatingSheetModal.js
//
// Film / dizi için yıldız derecelendirme bottom-sheet'i.
//   - Üstte HYBRID skor (TMDB + uygulama oyları, Bayesian) büyük gösterilir
//   - TMDB puanı ve uygulama kullanıcı ortalaması ayrı rozetlerde
//   - Kullanıcı kendi oyunu RatingInput ile 0-10 (yarım yıldız) verir
//   - Kaydet / Oyumu kaldır
//
// Kullanım (CommentSheetModal gibi, parent <Modal> ile sarmalanır):
//   <Modal transparent visible={...} ...>
//     <RatingSheetModal
//       visible={ratingVisible}
//       onClose={() => setRatingVisible(false)}
//       mediaType="movie"            // 'movie' | 'tv'
//       mediaId={id}
//       tmdbAvg={details.vote_average}
//       tmdbCount={details.vote_count}
//       details={details}
//     />
//   </Modal>

import { Image } from "expo-image";
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import AdaptiveBlurView from "../common/AdaptiveBlurView";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "react-native-toast-message";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useImageQualitySettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import { isUnreleased } from "@utils/watchState";
import { alpha } from "../../theme/colors";
import RatingStars from "@components/RatingStars";
import RatingInput from "@components/RatingInput";
import {
  mediaKey,
  subscribeToAggregate,
  subscribeToMyRating,
  setMyRating,
  removeMyRating,
  computeHybrid,
  userAverage,
} from "@services/ratingsService";

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get("window");
const SHEET_RATIO = 0.7;

// Yayın tarihini kullanıcının cihaz diline göre okunur biçime çevirir.
const formatReleaseDate = (str) => {
  if (!str) return "";
  const d = new Date(str);
  if (isNaN(d.getTime())) return "";
  try {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {
    return str;
  }
};

export default function RatingSheetModal({
  visible,
  onClose,
  mediaType,
  mediaId,
  tmdbAvg = 0,
  tmdbCount = 0,
  details,
  releaseDate,
}) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { getTmdbUrl } = useImageQualitySettings();

  const key = mediaId != null ? mediaKey(mediaType, mediaId) : null;

  const [agg, setAgg] = useState({ count: 0, sum: 0 });
  const [myRating, setMyRatingState] = useState(null); // kayıtlı oy
  const [draft, setDraft] = useState(0); // input'taki geçici değer
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const SHEET_H = SCREEN_H * SHEET_RATIO;
  const slideAnim = useRef(new Animated.Value(SHEET_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 180,
          mass: 0.9,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SHEET_H,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Agregat + kendi oyu dinle
  useEffect(() => {
    if (!visible || !key) return;
    setLoading(true);
    const unsubAgg = subscribeToAggregate(key, (a) => {
      setAgg(a);
      setLoading(false);
    });
    const unsubMine = user?.uid
      ? subscribeToMyRating(key, user.uid, (r) => {
          setMyRatingState(r);
          setDraft(r ?? 0);
        })
      : () => {};
    return () => {
      unsubAgg();
      unsubMine();
    };
  }, [visible, key, user?.uid]);

  const handleClose = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: SHEET_H,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => onClose());
  }, [onClose, SHEET_H]);

  // Yayın tarihi ileride olan içeriğe puan verilemez. Kullanıcının önceden
  // verilmiş bir oyu varsa (nadir durum) yönetimine izin verilir.
  // NOT: Bu tanım handleSave'in ÜSTÜNDE olmalı — deps dizisi render sırasında
  // değerlendirildiği için sonra tanımlanırsa TDZ ReferenceError fırlatır.
  const relDate = releaseDate ?? details?.release_date ?? details?.first_air_date;
  const locked = isUnreleased(relDate) && myRating == null;

  const handleSave = useCallback(async () => {
    if (!user?.uid) {
      Toast.show({ type: "warning", text1: i18nText("autoI18n.puan_vermek_icin_giris_yap", "Puan vermek için giriş yap") });
      return;
    }
    if (draft <= 0 || saving || locked) return;
    setSaving(true);
    try {
      await setMyRating({
        mediaType,
        mediaId,
        uid: user.uid,
        rating: draft,
        title: details?.title || details?.name || "",
        poster: details?.poster_path || null,
      });
      Toast.show({ type: "success", text1: i18nText("autoI18n.puanin_kaydedildi", "Puanın kaydedildi") });
      handleClose();
    } catch (e) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.puan_kaydedilemedi", "Puan kaydedilemedi") });
    } finally {
      setSaving(false);
    }
  }, [user?.uid, draft, saving, locked, mediaType, mediaId, details, handleClose]);

  const handleRemove = useCallback(async () => {
    if (!user?.uid || saving) return;
    setSaving(true);
    try {
      await removeMyRating({ mediaType, mediaId, uid: user.uid });
      setDraft(0);
      Toast.show({ type: "success", text1: i18nText("autoI18n.oyun_kaldirildi", "Oyun kaldırıldı") });
    } catch (e) {
      Toast.show({ type: "error", text1: i18nText("autoI18n.islem_basarisiz", "İşlem başarısız") });
    } finally {
      setSaving(false);
    }
  }, [user?.uid, saving, mediaType, mediaId]);

  const hybrid = computeHybrid({ tmdbAvg, tmdbCount, count: agg.count, sum: agg.sum });
  const appAvg = userAverage(agg);
  const poster = details?.poster_path;
  const title = details?.title || details?.name || i18nText("autoI18n.icerik", "İçerik");
  const relText = formatReleaseDate(relDate);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <AdaptiveBlurView
          tint="dark"
          intensity={28}
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.82)"]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <TouchableOpacity
        style={styles.backdropTouchable}
        activeOpacity={1}
        onPress={handleClose}
      />

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: slideAnim }], backgroundColor: theme.secondary },
        ]}
      >
        <View style={[styles.topGlow, { backgroundColor: theme.accent }]} />

        <View style={styles.handleWrapper}>
          <View style={styles.handle} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.mediaPill}>
            {poster ? (
              <Image source={{ uri: getTmdbUrl(poster, "poster", 200) }} style={styles.poster} />
            ) : (
              <View style={styles.posterPlaceholder}>
                <Ionicons name="film-outline" size={14} color="rgba(255,255,255,0.4)" />
              </View>
            )}
            <Text allowFontScaling={false} style={[styles.mediaTitle, { color: theme.text.secondary }]} numberOfLines={1}>
              {title}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: alpha(theme.text.primary, 0.07), borderColor: theme.border }]}
            onPress={handleClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={18} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.divider, { backgroundColor: theme.border }]} />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.text.muted} />
          </View>
        ) : (
          <View style={styles.body}>
            {/* Hybrid skor */}
            <View style={styles.hybridBlock}>
              <Text allowFontScaling={false} style={[styles.hybridLabel, { color: theme.text.muted }]}>
                {i18nText("autoI18n.genel_puan", "Genel Puan")}
              </Text>
              <View style={styles.hybridScoreRow}>
                <Text allowFontScaling={false} style={[styles.hybridScore, { color: theme.colors.orange }]}>
                  {hybrid.toFixed(1)}
                </Text>
                <Text allowFontScaling={false} style={[styles.hybridMax, { color: theme.text.muted }]}>/10</Text>
              </View>
              <RatingStars rating={hybrid} max={10} size={20} color={theme.colors.orange} />
            </View>

            {/* Kaynak rozetleri */}
            <View style={styles.badgesRow}>
              <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                <MaterialCommunityIcons name="movie-open-star-outline" size={15} color={theme.colors.blue} />
                <Text allowFontScaling={false} style={[styles.badgeLabel, { color: theme.text.muted }]}>TMDB</Text>
                <Text allowFontScaling={false} style={[styles.badgeValue, { color: theme.text.primary }]}>
                  {Number(tmdbAvg || 0).toFixed(1)}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                <Ionicons name="people-outline" size={15} color={theme.colors.green} />
                <Text allowFontScaling={false} style={[styles.badgeLabel, { color: theme.text.muted }]}>
                  {i18nText("autoI18n.kullanicilar", "Kullanıcılar")}
                </Text>
                <Text allowFontScaling={false} style={[styles.badgeValue, { color: theme.text.primary }]}>
                  {appAvg != null ? `${appAvg.toFixed(1)} (${agg.count})` : "—"}
                </Text>
              </View>
            </View>

            {/* Kendi oyun — yayınlanmadıysa kilitli bilgi kutusu */}
            {locked ? (
              <View style={[styles.rateBox, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                <Ionicons name="lock-closed" size={30} color={theme.text.muted} />
                <Text allowFontScaling={false} style={[styles.rateTitle, { color: theme.text.primary }]}>
                  {i18nText("autoI18n.henuz_yayinlanmadi", "Henüz yayınlanmadı")}
                </Text>
                <Text allowFontScaling={false} style={[styles.draftValue, { color: theme.text.secondary, textAlign: "center" }]}>
                  {relText
                    ? i18nText(
                        "autoI18n.puanlama_su_tarihte_acilir",
                        "Puanlama {{date}} tarihinde açılır",
                        { date: relText },
                      )
                    : i18nText(
                        "autoI18n.yayinlandiginda_puan_verebilirsin",
                        "Yayınlandığında puan verebilirsin",
                      )}
                </Text>
              </View>
            ) : (
              <View style={[styles.rateBox, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                <Text allowFontScaling={false} style={[styles.rateTitle, { color: theme.text.primary }]}>
                  {myRating != null
                    ? i18nText("autoI18n.puanin", "Puanın")
                    : i18nText("autoI18n.puan_ver", "Puan ver")}
                </Text>
                <RatingInput value={draft} onChange={setDraft} size={36} color={theme.colors.orange} />
                <Text allowFontScaling={false} style={[styles.draftValue, { color: theme.text.secondary }]}>
                  {draft > 0 ? `${draft.toFixed(1)} / 10` : i18nText("autoI18n.yildizlara_dokun", "Yıldızlara dokun")}
                </Text>
              </View>
            )}

            {/* Aksiyonlar */}
            <View style={styles.actions}>
              {myRating != null && (
                <TouchableOpacity
                  style={[styles.removeBtn, { borderColor: theme.border }]}
                  onPress={handleRemove}
                  disabled={saving}
                >
                  <Ionicons name="trash-outline" size={16} color={theme.colors.red} />
                  <Text allowFontScaling={false} style={[styles.removeBtnText, { color: theme.colors.red }]}>
                    {i18nText("autoI18n.kaldir", "Kaldır")}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.saveBtn,
                  { backgroundColor: theme.accent },
                  (draft <= 0 || saving || locked) && styles.saveBtnDisabled,
                ]}
                onPress={handleSave}
                disabled={draft <= 0 || saving || locked}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text allowFontScaling={false} style={styles.saveBtnText}>
                    {myRating != null
                      ? i18nText("autoI18n.guncelle", "Güncelle")
                      : i18nText("autoI18n.kaydet", "Kaydet")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  backdropTouchable: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: SCREEN_H * SHEET_RATIO,
  },
  sheet: {
    height: SCREEN_H * SHEET_RATIO,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 28,
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: "15%",
    right: "15%",
    height: 1.5,
    opacity: 0.7,
    borderRadius: 1,
  },
  handleWrapper: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.14)" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
    gap: 10,
  },
  mediaPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 6,
    flex: 1,
    maxWidth: SCREEN_W * 0.6,
  },
  poster: { width: 26, height: 39, borderRadius: 5 },
  posterPlaceholder: {
    width: 26,
    height: 39,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  mediaTitle: { flex: 1, fontSize: 12, fontWeight: "600" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  divider: { height: StyleSheet.hairlineWidth },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, padding: 20, gap: 18 },

  hybridBlock: { alignItems: "center", gap: 6 },
  hybridLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  hybridScoreRow: { flexDirection: "row", alignItems: "flex-end" },
  hybridScore: { fontSize: 48, fontWeight: "800", lineHeight: 52 },
  hybridMax: { fontSize: 16, fontWeight: "600", marginBottom: 8, marginLeft: 2 },

  badgesRow: { flexDirection: "row", gap: 12, justifyContent: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  badgeLabel: { fontSize: 11, fontWeight: "600" },
  badgeValue: { fontSize: 13, fontWeight: "800" },

  rateBox: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
  },
  rateTitle: { fontSize: 15, fontWeight: "700" },
  draftValue: { fontSize: 13, fontWeight: "600" },

  actions: { flexDirection: "row", gap: 12, marginTop: "auto" },
  removeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  removeBtnText: { fontSize: 14, fontWeight: "700" },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
