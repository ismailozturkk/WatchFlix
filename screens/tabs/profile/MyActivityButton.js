// screens/tabs/profile/MyActivityButton.js
//
// Profilde modern, interaktif "Etkinliklerim" kartı: puanlama / yorum / post /
// beğeni sayılarını canlı, profesyonel bir özet panelinde gösterir; dokununca
// Etkinliklerim hub'ına gider.

import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../../firebase";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { i18nText } from "@utils/i18nText";
import { subscribeToMyRatings } from "@services/ratingsService";
import {
  subscribeToMyComments,
  subscribeToMyLikes,
  subscribeToMyBookmarks,
} from "@services/activityService";
import { StoryDraftService } from "@services/StoryDraftService";

// Büyük sayıları kompaktlaştır (1250 → 1.2K)
function formatCount(n) {
  if (n >= 1000) {
    const v = n / 1000;
    return `${v >= 10 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}K`;
  }
  return `${n}`;
}

function StatCell({ icon, value, label, color, theme }) {
  return (
    <View style={styles.statCell}>
      <View style={[styles.statIconChip, { backgroundColor: color + "1F" }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text allowFontScaling={false} style={[styles.statValue, { color: theme.text.primary }]}>
        {formatCount(value)}
      </Text>
      <Text allowFontScaling={false} style={[styles.statLabel, { color: theme.text.muted }]}>
        {label}
      </Text>
    </View>
  );
}

export default function MyActivityButton({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const uid = user?.uid;

  const [ratingCount, setRatingCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [postCount, setPostCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [draftCount, setDraftCount] = useState(0);
  const [storyCount, setStoryCount] = useState(0);

  const scale = useRef(new Animated.Value(1)).current;

  // Firestore canlı sayaçlar
  useEffect(() => {
    if (!uid) return;
    const unsubR = subscribeToMyRatings(uid, (l) => setRatingCount(l.length));
    const unsubC = subscribeToMyComments(uid, (l) => setCommentCount(l.length));
    const unsubL = subscribeToMyLikes(uid, (l) => setLikeCount(l.length));
    const unsubB = subscribeToMyBookmarks(uid, (l) => setBookmarkCount(l.length));
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

  // Yerel taslaklar (post + story) — ekran odaklandığında tazele
  const loadLocal = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("post_drafts");
      const arr = raw ? JSON.parse(raw) : [];
      setDraftCount(Array.isArray(arr) ? arr.length : 0);
    } catch {
      setDraftCount(0);
    }
    try {
      const sd = await StoryDraftService.getDrafts();
      setStoryCount(sd.length);
    } catch {
      setStoryCount(0);
    }
  }, []);
  useEffect(() => {
    const unsub = navigation.addListener("focus", loadLocal);
    loadLocal();
    return unsub;
  }, [navigation, loadLocal]);

  const interactionCount = likeCount + bookmarkCount;
  const total =
    ratingCount + commentCount + postCount + interactionCount + draftCount + storyCount;
  const hasActivity = total > 0;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, friction: 7 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 7 }).start();

  const stats = [
    { icon: "star", value: ratingCount, label: i18nText("autoI18n.puan", "Puan"), color: theme.colors.orange },
    { icon: "chatbubble-ellipses", value: commentCount, label: i18nText("autoI18n.yorum", "Yorum"), color: theme.colors.green },
    { icon: "newspaper", value: postCount, label: i18nText("autoI18n.post", "Post"), color: theme.colors.blue },
    { icon: "heart", value: interactionCount, label: i18nText("autoI18n.begeni", "Beğeni"), color: theme.colors.red },
  ];

  return (
    <View style={styles.section}>
      <Text allowFontScaling={false} style={[styles.sectionTitle, { color: theme.text.muted }]}>
        {i18nText("autoI18n.etkinliklerim", "Etkinliklerim")}
      </Text>

      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={() => navigation.navigate("MyActivityScreen")}
          onPressIn={pressIn}
          onPressOut={pressOut}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.etkinliklerim", "Etkinliklerim")}
          style={[
            styles.card,
            { backgroundColor: theme.secondary, borderColor: theme.border, shadowColor: theme.shadow },
          ]}
        >
          {/* Yumuşak köşe parıltısı */}
          <LinearGradient
            colors={[theme.accent + "1A", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Başlık satırı */}
          <View style={styles.headerRow}>
            <LinearGradient
              colors={[theme.accent, theme.accent + "B3"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconWrap}
            >
              <Ionicons name="sparkles" size={21} color="#fff" />
            </LinearGradient>

            <View style={styles.headerText}>
              <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
                {hasActivity
                  ? i18nText("autoI18n.n_etkinlik", "{{n}} etkinlik", { n: total })
                  : i18nText("autoI18n.etkinlige_basla", "Etkinliğe başla")}
              </Text>
              <Text allowFontScaling={false} style={[styles.subtitle, { color: theme.text.muted }]} numberOfLines={1}>
                {i18nText("autoI18n.tumunu_gor", "Tümünü Gör")}
              </Text>
            </View>

            <View style={[styles.chevron, { backgroundColor: theme.accent + "1A" }]}>
              <Ionicons name="chevron-forward" size={17} color={theme.accent} />
            </View>
          </View>

          {/* İstatistik paneli */}
          <View style={[styles.statPanel, { backgroundColor: theme.primary, borderColor: theme.border }]}>
            {stats.map((s, i) => (
              <React.Fragment key={s.label}>
                {i > 0 && <View style={[styles.statDivider, { backgroundColor: theme.border }]} />}
                <StatCell {...s} theme={theme} />
              </React.Fragment>
            ))}
          </View>
        </Pressable>
      </Animated.View>
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
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    gap: 14,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },

  // Başlık
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
  subtitle: { fontSize: 12, fontWeight: "600" },
  chevron: {
    width: 32,
    height: 32,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  // İstatistik paneli
  statPanel: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statCell: { flex: 1, alignItems: "center", gap: 5 },
  statIconChip: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statValue: { fontSize: 17, fontWeight: "800" },
  statLabel: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.2 },
  statDivider: { width: 1, marginVertical: 6, opacity: 0.7 },
});
