// components/PosterActivityBadge.js
//
// Poster üzerinde kullanıcının O İÇERİĞE verdiği KİŞİSEL puanı (yıldız + puan)
// ve yorum yaptıysa bir yorum ikonunu gösteren rozet. İçerik adının kaldırıldığı
// yerlerde (istatistik ekranları, liste posterleri) başlık yerine gösterilir.
//
//   <MyPosterActivityBadge mediaId={id} mediaType="movie" posterWidth={110} />
//
// Arkadaş profili gibi BAŞKA bir kullanıcının etkinliğini göstermesi gereken
// yerlerde (kendi MediaActivityContext'imiz o kullanıcıyı bilmez) veriler dıştan
// hazır gelir — bu yüzden saf/sunum bileşeni ayrı export edilir.

import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useListLayoutSettings } from "../context/AppSettingsContext";
import { useMediaActivity } from "@hooks/useMediaActivity";
import { usePillMetrics, cornerStyle } from "./PosterInfoBadges";

const STAR_COLOR = "#FFB300";

/**
 * Saf/sunum bileşeni: hasRating/hasComment/rating dışarıdan verilir.
 *
 * `layout`:
 *  - "below"   (varsayılan) — posterin ALTINDA, normal akışta, ortalanmış satır.
 *  - "overlay" — posterin ÜZERİNDE, `corner` köşesine mutlak konumlanmış rozet
 *    (eski davranış; artık kullanılmıyor ama ihtiyaç olursa diye korunuyor).
 */
export function PosterActivityBadge({
  hasRating,
  rating,
  hasComment,
  layout = "below",
  corner = "bottomLeft",
  style,
  scale,
  posterWidth,
  showRating = true,
  showComment = true,
  // "below" düzende, gösterilecek bir şey olmasa bile alan sabit kalsın diye
  // aynı yükseklikte BOŞ bir yer tutucu render edilir. Aksi halde puanlı/
  // yorumlu posterler ile olmayanlar farklı toplam yükseklikte kalır; grid
  // hücresi bunları dikeyde ortaladığında (justifyContent:"center") posterin
  // kendisi satır satır hizasız görünür. Poster HER ZAMAN aynı yerde dursun
  // diye bu boşluk veri olsa da olmasa da ayrılır.
  reserveSpace = true,
}) {
  const { s, r, box } = usePillMetrics(scale, posterWidth);
  const showStar = !!showRating && !!hasRating && rating != null;
  const showBubble = !!showComment && !!hasComment;
  const marginTop = Math.max(4, Math.round(5 * s));

  if (!showStar && !showBubble) {
    if (layout !== "below" || !reserveSpace) return null;
    const line = Math.round(r(10.5) * 1.25) + box.paddingVertical * 2;
    return <View style={[styles.belowRow, { height: line, marginTop }, style]} />;
  }

  const gap = Math.max(3, Math.round(4 * s));
  const containerStyle =
    layout === "overlay"
      ? [styles.overlayRow, { gap }, cornerStyle(corner, s), style]
      : [styles.belowRow, { gap, marginTop }, style];

  return (
    <View style={containerStyle}>
      {showStar ? (
        <View style={[styles.pill, box]}>
          <Ionicons name="star" size={r(10.5)} color={STAR_COLOR} />
          <Text allowFontScaling={false} style={[styles.score, { fontSize: r(10.5) }]}>
            {Number(rating).toFixed(1)}
          </Text>
        </View>
      ) : null}
      {showBubble ? (
        <View style={[styles.pill, box]}>
          <Ionicons name="chatbubble" size={r(10)} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Oturum sahibinin KENDİ puanı/yorumu için: mediaId/mediaType verilir,
 * useMediaActivity'den (0 ek Firestore okumasıyla) veri çekilir. Ayarlar >
 * Poster Görünümü'ndeki genel "rated"/"commented" rozet anahtarlarını da
 * (ListBadges ile aynı sözleşme) miras alır; `showRating`/`showComment` ile
 * çağıran taraf (ör. listelerin kendi "Poster bilgileri" seçeneği) ek olarak
 * kısıtlayabilir.
 */
export function MyPosterActivityBadge({
  mediaId,
  mediaType,
  showRating = true,
  showComment = true,
  ...rest
}) {
  const { posterBadges } = useListLayoutSettings();
  const { hasRating, hasComment, rating } = useMediaActivity(mediaId, mediaType);
  const ratingOn = showRating && posterBadges?.rated !== false;
  const commentOn = showComment && posterBadges?.commented !== false;

  return (
    <PosterActivityBadge
      hasRating={hasRating}
      rating={rating}
      hasComment={hasComment}
      showRating={ratingOn}
      showComment={commentOn}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  overlayRow: { position: "absolute", flexDirection: "row", alignItems: "center" },
  belowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(10,12,18,0.78)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  score: { color: "#fff", fontWeight: "800", letterSpacing: 0.1 },
});
