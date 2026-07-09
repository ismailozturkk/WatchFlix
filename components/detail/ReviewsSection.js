import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import SectionHeader from "./SectionHeader";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { i18nText } from "../../utils/i18nText";

/* TMDB kritikleri: kart başına genişlet/daralt + "tüm yorumlar" düğmesi.
   Genişletme durumlarını kendi içinde tutar. */
export default function ReviewsSection({ reviews }) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [reviewLength, setReviewLength] = useState(5);
  const [reviewTextLength, setReviewTextLength] = useState(null);

  if (!reviews?.length) return null;

  return (
    <View style={[styles.section, { marginBottom: 40 }]}>
      <SectionHeader title={t.reviews} />
      {reviews.slice(0, reviewLength).map((review) => (
        <TouchableOpacity
          key={review.id}
          activeOpacity={0.85}
          onPress={() =>
            setReviewTextLength(
              review.id === reviewTextLength ? null : review.id,
            )
          }
          style={[
            styles.reviewCard,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <View style={styles.reviewTop}>
            <View
              style={[
                styles.reviewAvatar,
                { backgroundColor: theme.accent + "28" },
              ]}
            >
              <Ionicons name="person" size={13} color={theme.accent} />
            </View>
            <Text
              allowFontScaling={false}
              style={[styles.reviewAuthor, { color: theme.text.primary }]}
              numberOfLines={1}
            >
              {review.author}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.reviewDate, { color: theme.text.muted }]}
            >
              {review.created_at
                ? new Date(review.created_at).toLocaleDateString()
                : ""}
            </Text>
          </View>
          <Text
            allowFontScaling={false}
            style={[styles.reviewBody, { color: theme.text.secondary }]}
            numberOfLines={review.id === reviewTextLength ? null : 3}
          >
            {review.content}
          </Text>
          {review.id !== reviewTextLength && (
            <Text
              allowFontScaling={false}
              style={[styles.readMore, { color: theme.accent }]}
            >{i18nText("autoI18n.devamini_oku", "Devamını oku")}</Text>
          )}
        </TouchableOpacity>
      ))}
      {reviews.length > 5 && (
        <TouchableOpacity
          onPress={() =>
            setReviewLength(reviews.length === reviewLength ? 5 : reviews.length)
          }
          style={[styles.expandBtn, { marginTop: 4 }]}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name={reviewLength > 5 ? "keyboard-arrow-up" : "keyboard-arrow-down"}
            size={22}
            color={theme.accent}
          />
          <Text style={[styles.expandBtnText, { color: theme.accent }]}>
            {reviewLength > 5 ? "Daha az" : i18nText("autoI18n.tum_yorumlar", "Tüm yorumlar")}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  reviewCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  reviewTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 10,
  },
  reviewAvatar: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewAuthor: { fontSize: 13, fontWeight: "700", flex: 1 },
  reviewDate: { fontSize: 11 },
  reviewBody: { fontSize: 13, lineHeight: 20 },
  readMore: { fontSize: 12, fontWeight: "600", marginTop: 8 },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "center",
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  expandBtnText: { fontSize: 13, fontWeight: "600" },
});
