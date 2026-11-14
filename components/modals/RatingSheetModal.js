// components/modals/RatingSheetModal.js
//
// Film / dizi için yıldız derecelendirme bottom-sheet'i.
//   - Kompakt düzen (9 Kas kullanıcı kararı): sayfa yüksekliği İÇERİĞE göre (eskiden
//     ekranın %70'i sabit). HYBRID skor (TMDB + uygulama oyları), TMDB puanı ve
//     kullanıcı ortalaması başlıkta afişin yanında tek blokta.
//   - Kullanıcı kendi oyunu RatingInput ile 10 yıldız, yarım puan adımlı (0,5-10) verir
//   - Kaydet / Oyumu kaldır (yalnız çöp simgesi)
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
} from "react-native";
import LensLoader from "../LensLoader";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Toast from "@components/AppToast";
import { useTheme } from "@context/ThemeContext";
import GlassCloseButton from "@components/common/GlassCloseButton";
import { useAuth } from "@context/AuthContext";
import usePosterUri from "../../hooks/usePosterUri";
import { i18nText } from "@utils/i18nText";
import { isUnreleased } from "@utils/watchState";
import { alpha } from "../../theme/colors";
import RatingStars from "@components/RatingStars";
import RatingInput from "@components/RatingInput";
import { useLanguage } from "@context/LanguageContext";
import { formatRatingInScale, ratingScaleSpec } from "@utils/ratingScale";
import useRatingScale from "@hooks/useRatingScale";
import {
  mediaKey,
  subscribeToAggregate,
  subscribeToMyRating,
  setMyRating,
  removeMyRating,
  computeHybrid,
  userAverage,
} from "@services/ratingsService";
import GlassTouchable from "../common/GlassTouchable";

const { height: SCREEN_H } = Dimensions.get("window");

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
  const { language } = useLanguage();
  // Ayarlar > Kişiselleştirme: 10 yıldız (yarım puan) ya da 5 yıldız. Saklama hep 0-10.
  const ratingScale = useRatingScale();
  const posterUri = usePosterUri();
  const insets = useSafeAreaInsets();

  const key = mediaId != null ? mediaKey(mediaType, mediaId) : null;

  const [agg, setAgg] = useState({ count: 0, sum: 0 });
  const [myRating, setMyRatingState] = useState(null); // kayıtlı oy
  const [draft, setDraft] = useState(0); // input'taki geçici değer
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Yükseklik içeriğe göre değiştiği için sayfa giriş/çıkışta ekran boyu kadar kayar
  // (her yükseklikte tamamen görünmez başlar).
  const SHEET_H = SCREEN_H;
  const slideAnim = useRef(new Animated.Value(SHEET_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(SHEET_H);
      backdropOpacity.setValue(0);
      const anim = Animated.parallel([
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
      ]);
      anim.start();
      return () => anim.stop();
    } else {
      const anim = Animated.parallel([
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
      ]);
      anim.start();
      return () => anim.stop();
    }
  }, [visible, SHEET_H, slideAnim, backdropOpacity]);

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
      <Animated.View
        pointerEvents="none"
        style={[styles.backdrop, { opacity: backdropOpacity }]}
      >
        <ModalBlurBackdrop intensity={28} />
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

        {/* Başlık: afiş + ad + genel puan + kaynak rozetleri */}
        <View style={styles.header}>
          {poster ? (
            <Image source={{ uri: posterUri(mediaType, mediaId, poster) }} style={styles.poster} />
          ) : (
            <View style={styles.posterPlaceholder}>
              <Ionicons name="film-outline" size={14} color="rgba(255,255,255,0.4)" />
            </View>
          )}
          <View style={styles.headerCopy}>
            <Text allowFontScaling={false} style={[styles.mediaTitle, { color: theme.text.primary }]} numberOfLines={1}>
              {title}
            </Text>
            {loading ? (
              <View style={styles.headerLoader}>
                <LensLoader color={theme.text.muted} size="small" />
              </View>
            ) : (
              <>
                <View
                  style={styles.hybridRow}
                  accessibilityLabel={`${i18nText("autoI18n.genel_puan", "Genel Puan")} ${hybrid.toFixed(1)} / 10`}
                >
                  <Text allowFontScaling={false} style={[styles.hybridScore, { color: theme.colors.orange }]}>
                    {hybrid.toFixed(1)}
                  </Text>
                  <Text allowFontScaling={false} style={[styles.hybridMax, { color: theme.text.muted }]}>/10</Text>
                  <RatingStars rating={hybrid} max={10} size={12} color={theme.colors.orange} />
                </View>
                <View style={styles.sourcesRow}>
                  <View style={styles.source}>
                    <MaterialCommunityIcons name="movie-open-star-outline" size={12} color={theme.colors.blue} />
                    <Text allowFontScaling={false} style={[styles.sourceLabel, { color: theme.text.muted }]}>TMDB</Text>
                    <Text allowFontScaling={false} style={[styles.sourceValue, { color: theme.text.secondary }]}>
                      {Number(tmdbAvg || 0).toFixed(1)}
                    </Text>
                  </View>
                  <View style={[styles.sourceDot, { backgroundColor: theme.text.muted }]} />
                  <View style={styles.source}>
                    <Ionicons name="people-outline" size={12} color={theme.colors.green} />
                    <Text allowFontScaling={false} style={[styles.sourceLabel, { color: theme.text.muted }]}>
                      {i18nText("autoI18n.kullanicilar", "Kullanıcılar")}
                    </Text>
                    <Text allowFontScaling={false} style={[styles.sourceValue, { color: theme.text.secondary }]}>
                      {appAvg != null ? `${appAvg.toFixed(1)} (${agg.count})` : "—"}
                    </Text>
                  </View>
                </View>
              </>
            )}
          </View>
          <GlassCloseButton
            size={30}
            fallbackRadius={15}
            color={theme.text.secondary}
            backgroundColor={alpha(theme.text.primary, 0.07)}
            borderColor={theme.border}
            hitSlop={10}
            onPress={handleClose}
          />
        </View>

        <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          {/* Kendi oyun — yayınlanmadıysa kilitli bilgi satırı */}
          {locked ? (
            <View style={[styles.lockedBox, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <Ionicons name="lock-closed" size={20} color={theme.text.muted} />
              <View style={styles.lockedCopy}>
                <Text allowFontScaling={false} style={[styles.rateTitle, { color: theme.text.primary }]}>
                  {i18nText("autoI18n.henuz_yayinlanmadi", "Henüz yayınlanmadı")}
                </Text>
                <Text allowFontScaling={false} style={[styles.draftValue, { color: theme.text.secondary }]}>
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
            </View>
          ) : (
            <View style={[styles.rateBox, { backgroundColor: theme.primary, borderColor: theme.border }]}>
              <View style={styles.rateHead}>
                <Text allowFontScaling={false} style={[styles.rateTitle, { color: theme.text.primary }]}>
                  {myRating != null
                    ? i18nText("autoI18n.puanin", "Puanın")
                    : i18nText("autoI18n.puan_ver", "Puan ver")}
                </Text>
                <Text
                  allowFontScaling={false}
                  style={[styles.draftValue, { color: draft > 0 ? theme.colors.orange : theme.text.muted }]}
                >
                  {draft > 0 ? `${formatRatingInScale(draft, language, ratingScale)} / ${ratingScaleSpec(ratingScale).max}` : i18nText("autoI18n.yildizlara_dokun", "Yıldızlara dokun")}
                </Text>
              </View>
              <RatingInput value={draft} onChange={setDraft} size={ratingScale === "five" ? 36 : 32} color={theme.colors.orange} scale={ratingScale} />
            </View>
          )}

          {/* Aksiyonlar: Kaldır yalnız simge, Kaydet geniş */}
          <View style={styles.actions}>
            {myRating != null && (
              <GlassTouchable
                style={[styles.removeBtn, { borderColor: theme.border }]}
                onPress={handleRemove}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={i18nText("autoI18n.kaldir", "Kaldır")}
              >
                <Ionicons name="trash-outline" size={18} color={theme.colors.red} />
              </GlassTouchable>
            )}
            <GlassTouchable
              style={[
                styles.saveBtn,
                { backgroundColor: theme.accent },
                (draft <= 0 || saving || locked || loading) && styles.saveBtnDisabled,
              ]}
              onPress={handleSave}
              disabled={draft <= 0 || saving || locked || loading}
            >
              {saving ? (
                <LensLoader tone="mono" color="#fff" size="small" />
              ) : (
                <Text allowFontScaling={false} style={styles.saveBtnText}>
                  {myRating != null
                    ? i18nText("autoI18n.guncelle", "Güncelle")
                    : i18nText("autoI18n.kaydet", "Kaydet")}
                </Text>
              )}
            </GlassTouchable>
          </View>
        </View>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill },
  // Sayfanın üstündeki her yer kapatır; sayfa bu katmanın üstünde çizilir.
  backdropTouchable: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
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
  handleWrapper: { alignItems: "center", paddingTop: 8, paddingBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.14)" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  poster: { width: 40, height: 60, borderRadius: 7 },
  posterPlaceholder: {
    width: 40,
    height: 60,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  headerLoader: { height: 36, justifyContent: "center", alignItems: "flex-start" },
  mediaTitle: { fontSize: 15, lineHeight: 19, fontWeight: "800", letterSpacing: -0.2 },
  hybridRow: { flexDirection: "row", alignItems: "center" },
  hybridScore: { fontSize: 18, lineHeight: 22, fontWeight: "900", includeFontPadding: false },
  hybridMax: { fontSize: 11, fontWeight: "700", marginLeft: 1, marginRight: 6, marginTop: 4 },
  sourcesRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
  source: { flexDirection: "row", alignItems: "center", gap: 3 },
  sourceLabel: { fontSize: 10.5, fontWeight: "600" },
  sourceValue: { fontSize: 11, fontWeight: "800" },
  sourceDot: { width: 3, height: 3, borderRadius: 2, opacity: 0.6 },

  body: { paddingHorizontal: 16, gap: 12 },

  rateBox: {
    alignItems: "center",
    gap: 8,
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  rateHead: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  lockedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  lockedCopy: { flex: 1, minWidth: 0, gap: 2 },
  rateTitle: { fontSize: 13.5, fontWeight: "800" },
  draftValue: { fontSize: 12.5, fontWeight: "700" },

  actions: { flexDirection: "row", gap: 10 },
  removeBtn: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 1,
  },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
