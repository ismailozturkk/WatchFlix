// components/hub/FeedWidget.js
//
// Hub'ın "Sosyal" bölümündeki Paylaşımlar kartı. Eskiden HubScreen içindeydi.
//
// İki katman:
//   1. Başlık  — feed'i açar. Son paylaşanların avatarları metnin yanında durur
//                (kartın canlı olduğunu söyler); sağda beyaz "aç" düğmesi.
//   2. Yazma   — "Ne paylaşmak istersin?" çubuğu + dört tür karosu. Karolar
//                feed'deki rozet dilini taşır (inceleme=mavi, liste=yeşil,
//                anket=mor), böylece paylaşım türü ikondan okunur.
//
// Hızlı paylaşım, ShareContentScreen'in composePost mekanizmasıyla çalışır:
// feed'e gidip seçili tiple CreatePostModal'ı açar.
//
// `posts` / `avatar` burada okunur (HubScreen'den prop geçilmez): feed her
// güncellendiğinde yalnız bu kart yeniden çizilir, tüm Hub değil.

import React, { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@components/game/ui";
import AppIcon from "@components/AppIcon";
import UserAvatar from "@components/common/UserAvatar";
import HubCard, { HubArrow } from "@components/hub/HubCard";
import { useTheme } from "@context/ThemeContext";
import { useAuth } from "@context/AuthContext";
import { useProfileUi } from "@context/ProfileUiContext";
import { usePosts } from "@context/PostsContext";
import { getAvatarSource } from "@utils/avatars";
import { postTypeBadge } from "@utils/postComposer";
import { i18nText } from "@utils/i18nText";

const MAX_FACES = 3;
// Beyaz düğmelerin içindeki ikon/ok rengi: gradyanın orta tonu.
const INK = "#3A4FC4";

const getPostAvatar = (post, currentUid, currentAvatar) => {
  if (currentUid && post?.authorId === currentUid && currentAvatar) {
    return currentAvatar;
  }
  return getAvatarSource(
    post?.authorAvatarIndex,
    post?.authorPhotoURL || (typeof post?.authorAvatar === "string" ? post.authorAvatar : null)
  );
};

function FeedWidget({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { avatar } = useProfileUi();
  const { posts } = usePosts();

  const blue = theme.colors?.blue || "#3B82F6";
  const colors = [blue, "#4A5BD4", "#1C2A74"];

  const goFeed = () => navigation.navigate("ShareContentScreen");
  const goCompose = (postType) =>
    navigation.navigate("ShareContentScreen", {
      composePost: { postType, composeKey: `${postType}-${Date.now()}` },
    });

  const typeTiles = [
    { key: "review", icon: "create", label: i18nText("autoI18n.inceleme", "İnceleme") },
    { key: "list", icon: "list", label: i18nText("autoI18n.liste_2", "Liste") },
    { key: "text", icon: "chatbubble-ellipses", label: i18nText("autoI18n.sohbet", "Sohbet") },
    { key: "poll", icon: "stats-chart", label: i18nText("autoI18n.anket", "Anket") },
  ];

  const recentAuthors = useMemo(
    () =>
      (posts || [])
        .filter(
          (post, index, all) =>
            post?.authorId && all.findIndex((item) => item?.authorId === post.authorId) === index,
        )
        .slice(0, MAX_FACES),
    [posts],
  );

  return (
    <HubCard colors={colors} shadowColor={blue}>
      <View pointerEvents="none" style={styles.artwork}>
        <AppIcon family="Ionicons" name="chatbubbles" size={132} color="rgba(255,255,255,0.08)" />
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={i18nText("autoI18n.paylasimlari_ac", "Paylaşımları aç")}
        onPress={goFeed}
        scaleTo={0.985}
        style={styles.header}
      >
        <View style={styles.iconTile}>
          <AppIcon family="Ionicons" name="newspaper" size={24} color="#FFFFFF" />
        </View>

        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {i18nText("autoI18n.hub_paylasimlar", "Paylaşımlar")}
            </Text>
            {recentAuthors.length > 0 && (
              <View style={styles.faces}>
                {recentAuthors.map((post, index) => (
                  <UserAvatar
                    key={post.authorId}
                    source={getPostAvatar(post, user?.uid, avatar)}
                    isCustomPhoto
                    size={22}
                    borderWidth={1.5}
                    borderColor="rgba(255,255,255,0.85)"
                    style={{ marginLeft: index === 0 ? 0 : -8 }}
                  />
                ))}
              </View>
            )}
          </View>
          <Text style={styles.desc} numberOfLines={2}>
            {i18nText("autoI18n.hub_feed_aciklama", "Topluluk feed'i, incelemeler ve listeler")}
          </Text>
        </View>

        <HubArrow color={INK} />
      </PressableScale>

      <View style={styles.compose}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.ne_paylasmak_istersin", "Ne paylaşmak istersin?")}
          onPress={() => goCompose("review")}
          scaleTo={0.98}
          style={styles.prompt}
        >
          {avatar ? (
            <UserAvatar source={avatar} isCustomPhoto size={34} />
          ) : (
            <View style={styles.promptAvatarFallback}>
              <AppIcon family="Ionicons" name="person" size={17} color="rgba(255,255,255,0.85)" />
            </View>
          )}
          <Text style={styles.promptText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
            {i18nText("autoI18n.ne_paylasmak_istersin", "Ne paylaşmak istersin?")}
          </Text>
          <View style={styles.promptPlus}>
            <AppIcon family="Ionicons" name="add" size={20} color={INK} />
          </View>
        </PressableScale>

        <View style={styles.tiles}>
          {typeTiles.map((tile) => (
            <PressableScale
              key={tile.key}
              accessibilityRole="button"
              accessibilityLabel={tile.label}
              onPress={() => goCompose(tile.key)}
              scaleTo={0.94}
              style={styles.tile}
            >
              <View style={styles.tileIcon}>
                <AppIcon
                  family="Ionicons"
                  name={tile.icon}
                  size={17}
                  color={postTypeBadge(tile.key, theme.colors).color}
                />
              </View>
              <Text style={styles.tileText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {tile.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      </View>
    </HubCard>
  );
}

export default memo(FeedWidget);

const styles = StyleSheet.create({
  artwork: { position: "absolute", right: -8, top: -6, transform: [{ rotate: "-8deg" }] },

  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconTile: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { flexShrink: 1, color: "#FFFFFF", fontSize: 20, lineHeight: 24, fontWeight: "900" },
  faces: { flexDirection: "row", alignItems: "center" },
  desc: {
    color: "rgba(255,255,255,0.84)",
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 3,
  },

  compose: { paddingHorizontal: 12, paddingBottom: 12 },
  prompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 18,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  promptAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  promptText: {
    flex: 1,
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "700",
  },
  promptPlus: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  tiles: { flexDirection: "row", gap: 8, marginTop: 10 },
  tile: {
    flex: 1,
    alignItems: "center",
    gap: 7,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  tileIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { color: "rgba(255,255,255,0.94)", fontSize: 11.5, fontWeight: "800" },
});
