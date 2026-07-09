// screens/tabs/HubScreen.js
//
// "Hub" sekmesinin yapısı. Eskiden bu sekme doğrudan
// sosyal feed'i (ShareContentScreen) gösteriyordu; artık feed ayrı bir stack
// ekranına taşındı ve buradan modern bir widget ile açılıyor. Profildeki oyun
// modülü de (ProfileGamesModule) buraya taşındı.
//
// İçerik:
//   • Selamlama başlığı + avatar
//   • Sosyal: Feed'e yönlendiren büyük, interaktif gradyan widget
//   • Oyunlar: taşınan ProfileGamesModule (öne çıkan oyun + istatistik)

import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import ProfileGamesModule from "@components/profile/ProfileGamesModule";
import TournamentWidget from "@components/hub/TournamentWidget";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { useAuth } from "@context/AuthContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { usePosts } from "@context/PostsContext";
import { getAvatarSource } from "@utils/avatars";
import { i18nText } from "@utils/i18nText";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const SPRING = { mass: 0.4, damping: 12, stiffness: 180 };

// ─── Feed yönlendirme widget'ı (interaktif) ─────────────────────────────────
const getPostAvatar = (post) => {
  if (typeof post?.authorAvatarIndex === "number") {
    return getAvatarSource(post.authorAvatarIndex);
  }
  if (typeof post?.authorAvatar === "string") return { uri: post.authorAvatar };
  return post?.authorAvatar || getAvatarSource(0);
};

function FeedWidget({ navigation, theme, posts, loading }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const latestPost = posts?.[0] || null;
  const latestPoster = latestPost?.mediaList?.find((item) => item?.poster)?.poster;
  const recentAuthors = (posts || [])
    .filter((post, index, all) =>
      post?.authorId && all.findIndex((item) => item?.authorId === post.authorId) === index,
    )
    .slice(0, 3);

  const blue = theme.colors?.blue || "#4a7cf6";
  const colors = [
    blue,
    theme.colors?.primary || "#3b5998",
    theme.colors?.darkBlue || "#192f6a",
  ];

  const handlePressIn = () => {
    scale.value = withSpring(0.98, SPRING);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING);
  };

  return (
    <Animated.View
      style={[styles.widgetShadow, { shadowColor: theme.shadow || blue }, animStyle]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.widget}
      >
        <View pointerEvents="none" style={styles.glowOne} />
        <View pointerEvents="none" style={styles.glowTwo} />
        <View pointerEvents="none" style={styles.widgetArtwork}>
          <AppIcon family="Ionicons" name="chatbubbles" size={124} color="rgba(255,255,255,0.07)" />
        </View>

        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.paylasimlari_ac", "Paylaşımları aç")}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={() => navigation.navigate("ShareContentScreen")}
          style={styles.widgetHeader}
        >
          <View style={styles.widgetIcon}>
            <AppIcon family="Ionicons" name="newspaper" size={24} color="#fff" />
          </View>

          <View style={styles.widgetCopy}>
            <Text style={styles.widgetTitle}>
              {i18nText("autoI18n.hub_paylasimlar", "Paylaşımlar")}
            </Text>
            <Text style={styles.widgetDesc} numberOfLines={1}>
              {i18nText("autoI18n.hub_feed_aciklama", "Topluluk feed'i, incelemeler ve listeler")}
            </Text>
          </View>

          {recentAuthors.length > 0 && (
            <View style={styles.recentAvatars}>
              {recentAuthors.map((post, index) => (
                <Image
                  key={post.authorId}
                  source={getPostAvatar(post)}
                  style={[styles.recentAvatar, { marginLeft: index === 0 ? 0 : -8 }]}
                />
              ))}
            </View>
          )}

          <View style={styles.widgetCta}>
            <AppIcon family="Ionicons" name="arrow-forward" size={19} color="#fff" />
          </View>
        </AnimatedPressable>

        <View style={styles.widgetDivider} />

        {loading && !latestPost ? (
          <View style={styles.feedLoading}>
            <ActivityIndicator color="#fff" size="small" />
          </View>
        ) : latestPost ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={latestPost.title}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => navigation.navigate("PostDetailScreen", { postId: latestPost.id })}
            style={({ pressed }) => [
              styles.latestPostCard,
              { backgroundColor: pressed ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.11)" },
            ]}
          >
            {latestPoster ? (
              <Image source={{ uri: latestPoster }} style={styles.latestPoster} contentFit="cover" />
            ) : (
              <View style={styles.latestPosterFallback}>
                <AppIcon
                  family="Ionicons"
                  name={latestPost.type === "list" ? "list" : "star"}
                  size={22}
                  color="rgba(255,255,255,0.75)"
                />
              </View>
            )}

            <View style={styles.latestPostCopy}>
              <View style={styles.latestPostKicker}>
                <Image source={getPostAvatar(latestPost)} style={styles.latestAuthorAvatar} />
                <Text style={styles.latestAuthor} numberOfLines={1}>
                  {latestPost.authorName || i18nText("autoI18n.kullanici", "Kullanıcı")}
                </Text>
                <View style={styles.latestTypeBadge}>
                  <Text style={styles.latestTypeText}>
                    {latestPost.type === "list"
                      ? i18nText("autoI18n.liste_upper", "LİSTE")
                      : i18nText("autoI18n.inceleme_upper", "İNCELEME")}
                  </Text>
                </View>
              </View>

              <Text style={styles.latestPostTitle} numberOfLines={2}>
                {latestPost.title}
              </Text>

              <View style={styles.latestPostStats}>
                <AppIcon family="Ionicons" name="heart" size={13} color="rgba(255,255,255,0.76)" />
                <Text style={styles.latestPostStatText}>{latestPost.likesCount || 0}</Text>
                <AppIcon family="Ionicons" name="chatbubble" size={12} color="rgba(255,255,255,0.76)" />
                <Text style={styles.latestPostStatText}>{latestPost.commentsCount || 0}</Text>
              </View>
            </View>

            <AppIcon family="Ionicons" name="chevron-forward" size={20} color="rgba(255,255,255,0.82)" />
          </Pressable>
        ) : (
          <Pressable
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={() => navigation.navigate("ShareContentScreen")}
            style={styles.emptyFeedCard}
          >
            <AppIcon family="Ionicons" name="sparkles" size={20} color="#fff" />
            <Text style={styles.emptyFeedText}>
              {i18nText("autoI18n.henuz_paylasim_yok", "Henüz paylaşım yok")}
            </Text>
            <AppIcon family="Ionicons" name="arrow-forward" size={17} color="#fff" />
          </Pressable>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

export default function HubScreen({ navigation }) {
  const { theme } = useTheme();
  useLanguage();
  const { user } = useAuth();
  const { avatar } = useProfileUi();
  const { posts, loading: postsLoading } = usePosts();

  const greeting = useMemo(() => {
    const name = user?.displayName?.split(" ")[0] || "";
    const hi = i18nText("autoI18n.merhaba", "Merhaba");
    return name ? `${hi}, ${name}` : hi;
  }, [user?.displayName]);

  return (
    <SafeAreaView edges={["top"]} style={[styles.container, { backgroundColor: theme.primary }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Başlık */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.greeting, { color: theme.text.primary }]}>{greeting}</Text>
            <Text style={[styles.greetingSub, { color: theme.text.secondary }]}>
              {i18nText("autoI18n.hub_alt_baslik", "Paylaşımlar ve oyunlar tek yerde")}
            </Text>
          </View>
          {avatar ? (
            <Image source={avatar} style={styles.avatar} />
          ) : (
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor: theme.secondary,
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: theme.border,
                },
              ]}
            >
              <AppIcon family="Ionicons" name="person" size={22} color={theme.text.muted} />
            </View>
          )}
        </View>

        {/* Sosyal */}
        <Text style={[styles.sectionTitle, { color: theme.text.muted }]}>
          {i18nText("autoI18n.sosyal", "Sosyal")}
        </Text>
        <FeedWidget
          navigation={navigation}
          theme={theme}
          posts={posts}
          loading={postsLoading}
        />

        {/* Turnuva */}
        <Text style={[styles.sectionTitle, { color: theme.text.muted, marginTop: 18 }]}>
          {i18nText("autoI18n.tournament_section", "Turnuva")}
        </Text>
        <TournamentWidget navigation={navigation} />

        {/* Oyunlar (profilden taşındı) */}
        <ProfileGamesModule navigation={navigation} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { alignItems: "center", paddingTop: 10, paddingBottom: 110 },

  headerRow: {
    width: "90%",
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 6,
    paddingBottom: 18,
  },
  greeting: { fontSize: 22, fontWeight: "800" },
  greetingSub: { fontSize: 13, marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginLeft: 12 },

  sectionTitle: {
    width: "90%",
    fontSize: 14,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 12,
    paddingHorizontal: 10,
  },

  // Feed widget
  widgetShadow: {
    width: "90%",
    borderRadius: 24,
    elevation: 8,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    marginBottom: 6,
  },
  widget: {
    borderRadius: 24,
    overflow: "hidden",
  },
  widgetHeader: {
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
  },
  glowOne: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    right: -50,
    top: -70,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  glowTwo: {
    position: "absolute",
    width: 100,
    height: 100,
    borderRadius: 50,
    right: 30,
    bottom: -50,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  widgetArtwork: {
    position: "absolute",
    right: -6,
    bottom: -10,
    transform: [{ rotate: "-8deg" }],
  },
  widgetIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.17)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  widgetCopy: { flex: 1, marginLeft: 14 },
  widgetTitle: { color: "#fff", fontSize: 19, fontWeight: "900" },
  widgetDesc: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 3,
  },
  recentAvatars: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 6,
  },
  recentAvatar: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.72)",
  },
  widgetCta: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  widgetDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginHorizontal: 16,
  },
  latestPostCard: {
    minHeight: 88,
    margin: 12,
    marginTop: 10,
    borderRadius: 17,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  latestPoster: {
    width: 48,
    height: 68,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  latestPosterFallback: {
    width: 48,
    height: 68,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  latestPostCopy: { flex: 1, marginLeft: 11, marginRight: 8 },
  latestPostKicker: { flexDirection: "row", alignItems: "center", gap: 5 },
  latestAuthorAvatar: { width: 18, height: 18, borderRadius: 9 },
  latestAuthor: {
    maxWidth: "48%",
    color: "rgba(255,255,255,0.82)",
    fontSize: 10.5,
    fontWeight: "700",
  },
  latestTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.13)",
  },
  latestTypeText: { color: "rgba(255,255,255,0.82)", fontSize: 7.5, fontWeight: "900" },
  latestPostTitle: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "800",
    marginTop: 5,
  },
  latestPostStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  latestPostStatText: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 10,
    fontWeight: "700",
    marginRight: 5,
  },
  feedLoading: {
    minHeight: 94,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyFeedCard: {
    minHeight: 66,
    margin: 12,
    marginTop: 10,
    paddingHorizontal: 16,
    borderRadius: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.11)",
  },
  emptyFeedText: {
    flex: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
