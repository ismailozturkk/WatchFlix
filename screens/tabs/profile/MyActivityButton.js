// screens/tabs/profile/MyActivityButton.js
//
// Profildeki Etkinliklerim merkezi. Üst alan tüm arşivi açar; kategori
// kartları ise ilgili sekmeye doğrudan geçiş sağlar.

import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useHapticsSettings } from "@context/AppSettingsContext";
import { i18nText } from "@utils/i18nText";
import { subscribeToMyRatings } from "@services/ratingsService";
import {
  subscribeToMyComments,
  subscribeToMyLikes,
  subscribeToMyBookmarks,
} from "@services/activityService";
import { StoryDraftService } from "@services/StoryDraftService";

function formatCount(n) {
  if (n >= 1000) {
    const v = n / 1000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${n}`;
}

// Kompakt mini hücre: renkli kategori ikonu + sayı. Etiket ekranda yok
// (renk/ikon MyActivityScreen sekmeleriyle eşleşir), erişilebilirlikte korunur.
function QuickAccessCell({ item, theme, onPress }) {
  return (
    <Pressable
      onPress={() => onPress(item.key)}
      accessibilityRole="button"
      accessibilityLabel={`${item.label}, ${item.value}`}
      accessibilityHint={i18nText(
        "autoI18n.etkinlik_kategorisini_ac",
        "Etkinlik kategorisini açar",
      )}
      style={({ pressed }) => [
        styles.quickCell,
        {
          backgroundColor: theme.primary,
          borderColor: pressed ? item.color + "70" : theme.border,
        },
        pressed && styles.pressedCell,
      ]}
    >
      <Ionicons name={item.icon} size={15} color={item.color} />
      <Text
        allowFontScaling={false}
        style={[styles.quickValue, { color: theme.text.primary }]}
      >
        {formatCount(item.value)}
      </Text>
    </Pressable>
  );
}

export default function MyActivityButton({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { hapticsEnabled } = useHapticsSettings();
  const uid = user?.uid;

  const [ratingCount, setRatingCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [storyCount, setStoryCount] = useState(0);

  useEffect(() => {
    if (!uid) return undefined;
    const unsubR = subscribeToMyRatings(uid, (list) => setRatingCount(list.length));
    const unsubC = subscribeToMyComments(uid, (list) => setCommentCount(list.length));
    const unsubL = subscribeToMyLikes(uid, (list) => setLikeCount(list.length));
    const unsubB = subscribeToMyBookmarks(uid, (list) => setBookmarkCount(list.length));
    const unsubU = onSnapshot(
      doc(db, "Users", uid),
      (snap) => setPostCount(snap.exists() ? snap.data()?.postsCount || 0 : 0),
      () => {},
    );
    return () => {
      unsubR();
      unsubC();
      unsubL();
      unsubB();
      unsubU();
    };
  }, [uid]);

  const loadLocal = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("post_drafts");
      const drafts = raw ? JSON.parse(raw) : [];
      setDraftCount(Array.isArray(drafts) ? drafts.length : 0);
    } catch {
      setDraftCount(0);
    }

    try {
      const storyDrafts = await StoryDraftService.getDrafts();
      setStoryCount(storyDrafts.length);
    } catch {
      setStoryCount(0);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", loadLocal);
    loadLocal();
    return unsubscribe;
  }, [navigation, loadLocal]);

  const interactionCount = likeCount + bookmarkCount;
  const total =
    ratingCount + commentCount + postCount + interactionCount + draftCount + storyCount;
  const hasActivity = total > 0;

  const openActivity = useCallback(
    (initialTab) => {
      if (hapticsEnabled) Haptics.selectionAsync().catch(() => {});
      navigation.navigate(
        "MyActivityScreen",
        initialTab ? { initialTab } : undefined,
      );
    },
    [hapticsEnabled, navigation],
  );

  const stats = [
    {
      key: "ratings",
      icon: "star",
      value: ratingCount,
      label: i18nText("autoI18n.puanlamalar", "Puanlamalar"),
      color: theme.colors.orange,
    },
    {
      key: "comments",
      icon: "chatbubble-ellipses",
      value: commentCount,
      label: i18nText("autoI18n.yorumlar", "Yorumlar"),
      color: theme.colors.green,
    },
    {
      key: "posts",
      icon: "newspaper",
      value: postCount,
      label: i18nText("autoI18n.postlar", "Postlar"),
      color: theme.colors.blue,
    },
    {
      key: "drafts",
      icon: "document-text",
      value: draftCount,
      label: i18nText("autoI18n.taslaklar", "Taslaklar"),
      color: theme.colors.purple,
    },
    {
      key: "story",
      icon: "images",
      value: storyCount,
      label: i18nText("autoI18n.story", "Story"),
      color: "#EC4899",
    },
    {
      key: "interactions",
      icon: "heart",
      value: interactionCount,
      label: i18nText("autoI18n.etkilesimler", "Etkileşimler"),
      color: theme.colors.red,
    },
  ];

  return (
    <View style={styles.section}>
      <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text.muted }]}>
        {i18nText("autoI18n.etkinliklerim", "Etkinliklerim")}
      </Text>

      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.secondary,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <LinearGradient
          colors={[theme.accent + "24", theme.colors.purple + "0D", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <Pressable
          onPress={() => openActivity()}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.etkinliklerim", "Etkinliklerim")}
          accessibilityHint={i18nText(
            "autoI18n.etkinlik_arsivini_ac",
            "Tüm etkinlik arşivini açar",
          )}
          style={({ pressed }) => [styles.headerButton, pressed && styles.pressedHeader]}
        >
          <LinearGradient
            colors={[theme.accent, theme.colors.purple]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <Ionicons name="sparkles" size={18} color="#fff" />
          </LinearGradient>

          <View style={styles.headerText}>
            <Text
              allowFontScaling={false}
              style={[styles.title, { color: theme.text.primary }]}
              numberOfLines={1}
            >
              {hasActivity
                ? i18nText("autoI18n.n_etkinlik", "{{n}} etkinlik", { n: total })
                : i18nText("autoI18n.etkinlige_basla", "Etkinliğe başla")}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.subtitle, { color: theme.text.muted }]}
              numberOfLines={1}
            >
              {i18nText(
                "autoI18n.aktivite_arsivi_aciklama",
                "Tüm aktivitelerin tek yerde",
              )}
            </Text>
          </View>

          <View style={[styles.openButton, { backgroundColor: theme.accent + "1F" }]}>
            <Ionicons name="arrow-forward" size={16} color={theme.accent} />
          </View>
        </Pressable>

        <View style={styles.quickRow}>
          {stats.map((item) => (
            <QuickAccessCell
              key={item.key}
              item={item}
              theme={theme}
              onPress={openActivity}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { width: "100%", marginBottom: 14 },
  sectionTitle: {
    fontSize: 14,
    marginBottom: 10,
    marginLeft: 10,
    textTransform: "uppercase",
  },
  card: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 9,
    elevation: 4,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  pressedHeader: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 3,
  },
  headerText: { flex: 1, marginLeft: 10, marginRight: 8 },
  title: { fontSize: 15, fontWeight: "800", letterSpacing: 0.1 },
  subtitle: { fontSize: 10.5, fontWeight: "600", marginTop: 1 },
  openButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  quickRow: {
    flexDirection: "row",
    gap: 6,
  },
  quickCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    gap: 3,
  },
  pressedCell: { opacity: 0.76, transform: [{ scale: 0.97 }] },
  quickValue: { fontSize: 12, fontWeight: "800", letterSpacing: -0.2 },
});
