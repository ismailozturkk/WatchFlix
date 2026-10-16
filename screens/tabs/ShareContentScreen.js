import { tmdbLanguageOf } from "../../utils/appLanguages";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Image } from "expo-image";
import AppIcon from "../../components/AppIcon";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../context/ThemeContext";
import { useLanguage } from "../../context/LanguageContext";
import { useAuth } from "../../context/AuthContext";
import { useProfileUi } from "../../context/ProfileUiContext";
import { usePosts } from "../../context/PostsContext";
import {
  useApiSettings,
  useImageQualitySettings,
  useListLayoutSettings,
} from "../../context/AppSettingsContext";
import CreatePostModal from "@components/modals/CreatePostModal";
import SaveSharedListModal from "@components/modals/SaveSharedListModal";
import ShareToChatSheet from "@components/chat/ShareToChatSheet";
import { buildPostShare } from "@utils/chatShare";
import PostCommentSheetModal from "@components/modals/PostCommentSheetModal";
import StaggerItem from "@components/StaggerItem";
import BackButton from "@components/BackButton";
import FeedPostCard from "@components/feed/FeedPostCard";
import {
  FeedComposerCard,
  MyPostsLink,
  FeedTrendingRail,
  FeedFilterBar,
  FeedSortBar,
} from "@components/feed/FeedHeaderSections";
import { FeedSkeleton } from "@components/Skeleton";
import { i18nText } from "../../utils/i18nText";
import { appAlert } from "@components/AppAlert";
import { toast } from "@components/AppToast";
import { reportPost } from "../../services/postsService";
import axios from "axios";
import ScreenDecor from "@components/ScreenDecor";
import { alpha } from "../../theme/colors";

const EmptyState = memo(function EmptyState({ theme, t }) {
  return (
    <View style={emptyStyles.container}>
      <View
        style={[
          emptyStyles.halo,
          { backgroundColor: alpha(theme.accent, 0.1), borderColor: alpha(theme.accent, 0.22) },
        ]}
      >
        <View
          style={[
            emptyStyles.iconWrap,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <AppIcon
            family="MaterialCommunityIcons"
            name="comment-text-multiple-outline"
            size={38}
            color={theme.accent}
          />
        </View>
      </View>
      <Text style={[emptyStyles.title, { color: theme.text.primary }]}>
        {t.empty.title}
      </Text>
      <Text style={[emptyStyles.subtitle, { color: theme.text.secondary }]}>
        {t.empty.subtitle}
      </Text>
    </View>
  );
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ShareContentScreen({ route }) {
  const { theme } = useTheme();
  const { t, language } = useLanguage();
  const ts = t.shareScreen;
  const { user } = useAuth();
  const { avatar } = useProfileUi();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const { postListPosterLayout } = useListLayoutSettings();
  const navigation = useNavigation();

  // Gerçek trend içerikler (film + dizi)
  const [trending, setTrending] = useState([]);

  useEffect(() => {
    let active = true;
    const lang = tmdbLanguageOf(language);
    (async () => {
      try {
        const res = await axios.get(
          "https://api.themoviedb.org/3/trending/all/week",
          {
            params: { language: lang },
            headers: { accept: "application/json", Authorization: API_KEY },
          },
        );
        if (!active) return;
        const items = (res.data?.results || [])
          .filter(
            (r) =>
              (r.media_type === "movie" || r.media_type === "tv") &&
              r.poster_path,
          )
          .slice(0, 15)
          .map((r) => ({
            id: r.id,
            media_type: r.media_type,
            title: r.title || r.name || "",
            poster: getTmdbUrl(r.poster_path, "poster", 300),
          }));
        setTrending(items);
      } catch (e) {
        if (__DEV__) console.warn("[Trending] fetch:", e?.message);
      }
    })();
    return () => {
      active = false;
    };
  }, [API_KEY, language]);

  const onPressTrending = useCallback(
    (item) => {
      if (item.media_type === "tv") {
        navigation.navigate("TvShowsDetails", { id: item.id });
      } else {
        navigation.navigate("MovieDetails", { id: item.id });
      }
    },
    [navigation],
  );

  const {
    posts,
    filter,
    sort,
    setFilter,
    setSort,
    loading,
    loadingMore,
    refreshing,
    hasMore,
    likedIds,
    bookmarkIds,
    loadMore,
    refresh,
    toggleLike,
    toggleBookmark,
    submitPost,
    deletePost,
    editPost,
    votePoll,
  } = usePosts();

  const [modalVisible, setModalVisible] = useState(false);
  const [editingPost, setEditingPost] = useState(null); // null = create, obj = edit
  const [initialPost, setInitialPost] = useState(null);
  const [commentPost, setCommentPost] = useState(null); // yorum modalı açık post
  // "Listeyi kaydet" sayfası kart başına değil ekran başına: 30 kartın her
  // biri kendi modalını taşısaydı gereksiz ağaç kurulurdu.
  const [saveListPost, setSaveListPost] = useState(null);
  // "Sohbete gönder": seçilen gönderinin paylaşım gövdesi (alıcı sayfası açıkken dolu).
  const [sendShare, setSendShare] = useState(null);
  const handleSendPost = useCallback((post) => {
    const share = buildPostShare(post);
    if (share) setSendShare(share);
  }, []);
  const consumedComposeKey = useRef(null);

  useEffect(() => {
    const composePost = route?.params?.composePost;
    if (!composePost) return;
    const composeKey = composePost.composeKey || `${composePost.postType || "review"}-${Date.now()}`;
    if (consumedComposeKey.current === composeKey) return;
    consumedComposeKey.current = composeKey;
    setEditingPost(null);
    setInitialPost(composePost);
    setModalVisible(true);
    navigation.setParams?.({ composePost: undefined });
  }, [route?.params?.composePost, navigation]);

  // Her post'a "ben beğendim/kaydettim mi?" bayrağını burada bind et.
  const enrichedPosts = useMemo(
    () =>
      posts.map((p) => ({
        ...p,
        likedByMe: likedIds.has(p.id),
        bookmarkedByMe: bookmarkIds.has(p.id),
      })),
    [posts, likedIds, bookmarkIds],
  );

  const handleSubmitPost = useCallback(
    async (payload) => {
      // Sonucu döndür: CreatePostModal truthy alınca handleClose() çağırır
      // (formu sıfırlar + onClose → handleCloseModal ile editingPost temizlenir).
      if (editingPost) {
        const ok = await editPost(editingPost.id, payload); // mevcut gönderiyi güncelle
        return ok ? true : null;
      }
      const id = await submitPost(payload);
      return id || null;
    },
    [editingPost, editPost, submitPost],
  );

  const handleEditRequest = useCallback((post) => {
    setInitialPost(null);
    setEditingPost(post);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setEditingPost(null);
    setInitialPost(null);
  }, []);

  const handleOpenComments = useCallback((post) => {
    setCommentPost(post);
  }, []);

  const handleOpenProfile = useCallback(
    (post) => {
      if (!post?.authorId) return;
      // Kendi postun → yönlendirme yok. Sadece başkasının profiline git.
      if (post.authorId === user?.uid) return;
      navigation.navigate("FriendProfileScreen", {
        friendUid: post.authorId,
        friendName: post.authorName || "",
      });
    },
    [navigation, user?.uid],
  );

  const handleCloseComments = useCallback(() => {
    setCommentPost(null);
  }, []);

  // Başkasının gönderisini şikayet et (onay → PostReports'a yaz).
  const handleReportPost = useCallback(
    (post) => {
      if (!post?.id) return;
      if (!user?.uid) {
        toast.warning(i18nText("autoI18n.sikayet_icin_giris_yap", "Şikayet için giriş yap"));
        return;
      }
      appAlert(
        i18nText("autoI18n.gonderiyi_sikayet_et", "Gönderiyi şikayet et"),
        i18nText("autoI18n.bu_gonderiyi_uygunsuz_olarak_bildirmek_istiyor_musun", "Bu gönderiyi uygunsuz olarak bildirmek istiyor musun?"),
        [
          { text: i18nText("autoI18n.vazgec", "Vazgeç"), style: "cancel" },
          {
            text: i18nText("autoI18n.sikayet_et", "Şikayet et"),
            style: "destructive",
            onPress: async () => {
              try {
                await reportPost(post.id, user.uid, {
                  postAuthorId: post.authorId || null,
                });
                toast.success(
                  i18nText("autoI18n.sikayetin_alindi", "Şikayetin alındı"),
                  i18nText("autoI18n.inceleyecegiz_tesekkurler", "İnceleyeceğiz, teşekkürler."),
                );
              } catch (e) {
                toast.error(i18nText("autoI18n.sikayet_gonderilemedi", "Şikayet gönderilemedi"));
              }
            },
          },
        ],
      );
    },
    [user?.uid],
  );

  const greeting = useMemo(() => {
    const name = user?.displayName?.split(" ")[0] || "";
    return name ? `${ts.welcome}, ${name}` : ts.welcome;
  }, [user?.displayName, ts.welcome]);

  // Composer: tipsiz açılış (CreatePostModal varsayılan tipte başlar).
  const handleOpenComposer = useCallback(() => {
    setEditingPost(null);
    setInitialPost(null);
    setModalVisible(true);
  }, []);

  // Composer kartındaki hızlı tip kutuları: seçili tiple aç (Hub widget'ıyla aynı akış).
  const handleComposeType = useCallback((postType) => {
    setEditingPost(null);
    setInitialPost({ postType });
    setModalVisible(true);
  }, []);

  const handleOpenMyPosts = useCallback(
    () => navigation.navigate("MyPostsScreen"),
    [navigation],
  );

  // Eleman olarak verilir (bileşen tipi olarak değil): filtre/sıralama değişince
  // başlık yeniden mount olmaz, filtre ve trend rayının kaydırma konumu korunur.
  const header = useMemo(
    () => (
      <View>
        {/* Greeting */}
        <View style={mainStyles.greetingRow}>
          <BackButton absolute={false} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={[mainStyles.greeting, { color: theme.text.primary }]} numberOfLines={1}>
              {greeting}
            </Text>
            <Text style={[mainStyles.greetingSub, { color: theme.text.secondary }]} numberOfLines={1}>
              {ts.subtitle}
            </Text>
          </View>
          {avatar ? (
            <Image
              source={avatar}
              style={[mainStyles.headerAvatar, { borderColor: alpha(theme.accent, 0.5) }]}
            />
          ) : (
            <View
              style={[
                mainStyles.headerAvatar,
                {
                  backgroundColor: theme.secondary,
                  justifyContent: "center",
                  alignItems: "center",
                  borderColor: theme.border,
                },
              ]}
            >
              <AppIcon family="Ionicons" name="person" size={22} color={theme.text.muted} />
            </View>
          )}
        </View>

        {/* Create post composer + hızlı tip kutuları */}
        <FeedComposerCard
          theme={theme}
          avatar={avatar}
          placeholder={ts.createPostPlaceholder}
          onOpen={handleOpenComposer}
          onCompose={handleComposeType}
        />

        {/* Postlarım */}
        <MyPostsLink
          theme={theme}
          title={i18nText("autoI18n.postlarim", "Postlarım")}
          subtitle={i18nText("autoI18n.paylastigin_gonderileri_gor", "Paylaştığın gönderileri gör")}
          onPress={handleOpenMyPosts}
        />

        {/* Trending Rail */}
        <FeedTrendingRail
          theme={theme}
          label={ts.trending}
          data={trending}
          onPressItem={onPressTrending}
        />

        {/* Filtre + sıralama */}
        <FeedFilterBar theme={theme} t={ts} active={filter} onChange={setFilter} />
        <FeedSortBar theme={theme} t={ts} active={sort} onChange={setSort} />
      </View>
    ),
    [
      theme,
      ts,
      greeting,
      avatar,
      filter,
      sort,
      trending,
      onPressTrending,
      setFilter,
      setSort,
      handleOpenComposer,
      handleComposeType,
      handleOpenMyPosts,
    ],
  );

  const renderItem = useCallback(
    ({ item, index }) => (
      <StaggerItem index={index}>
        <FeedPostCard
          post={item}
          theme={theme}
          t={ts}
          currentUid={user?.uid}
          currentUserAvatar={avatar}
          onLike={toggleLike}
          onBookmark={toggleBookmark}
          onComment={handleOpenComments}
          onEdit={handleEditRequest}
          onDelete={deletePost}
          onPressAuthor={handleOpenProfile}
          onReport={handleReportPost}
          onVote={votePoll}
          onSaveList={setSaveListPost}
          onSend={handleSendPost}
          getTmdbUrl={getTmdbUrl}
          postListPosterLayout={postListPosterLayout}
        />
      </StaggerItem>
    ),
    [theme, ts, user?.uid, avatar, toggleLike, toggleBookmark, handleOpenComments, handleOpenProfile, handleEditRequest, deletePost, handleReportPost, votePoll, handleSendPost, getTmdbUrl, postListPosterLayout],
  );

  const listFooter = useMemo(() => {
    if (loadingMore) {
      return (
        <View style={{ paddingVertical: 24 }}>
          <ActivityIndicator color={theme.text.muted} />
        </View>
      );
    }
    if (!hasMore && enrichedPosts.length > 0) {
      return <View style={{ paddingVertical: 24 }} />;
    }
    return null;
  }, [loadingMore, hasMore, enrichedPosts.length, theme.text.muted]);

  const listEmpty = useMemo(() => {
    // İlk yüklemede feed kartı skeleton'ı, sonra empty state.
    if (loading) {
      return <FeedSkeleton count={4} />;
    }
    return <EmptyState theme={theme} t={ts} />;
  }, [loading, theme, ts]);

  return (
    <SafeAreaView
      style={[mainStyles.container, { backgroundColor: theme.primary }]}
      edges={["top"]}
    >
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="social" iconOpacity={0.25} />
      <FlatList
        data={enrichedPosts}
        keyExtractor={(p) => p.id}
        renderItem={renderItem}
        ListHeaderComponent={header}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={listFooter}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={theme.text.muted}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        removeClippedSubviews
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={7}
      />

      <CreatePostModal
        visible={modalVisible}
        onClose={handleCloseModal}
        onSubmit={handleSubmitPost}
        editingPost={editingPost}
        initialPost={initialPost}
      />

      <Modal
        animationType="none"
        transparent
        visible={commentPost != null}
        onRequestClose={handleCloseComments}
        statusBarTranslucent
      >
        <PostCommentSheetModal
          visible={commentPost != null}
          post={commentPost}
          onClose={handleCloseComments}
        />
      </Modal>

      <ShareToChatSheet
        visible={sendShare != null}
        share={sendShare}
        onClose={() => setSendShare(null)}
      />

      <SaveSharedListModal
        visible={saveListPost != null}
        post={saveListPost}
        onClose={() => setSaveListPost(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const mainStyles = StyleSheet.create({
  container: { flex: 1 },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 16,
  },
  greeting: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  greetingSub: { fontSize: 13, marginTop: 2 },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 12,
    borderWidth: 2,
  },
});

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingHorizontal: 32,
    paddingTop: 30,
    paddingBottom: 60,
  },
  halo: {
    width: 128,
    height: 128,
    borderRadius: 64,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 18,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  title: { fontSize: 17, fontWeight: "800", marginBottom: 6 },
  subtitle: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
