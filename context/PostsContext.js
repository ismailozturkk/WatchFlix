// context/PostsContext.js
//
// Feed state yönetimi:
//  - Cold start: AsyncStorage cache → fetchFeed (ilk sayfa) → realtime listener
//  - Filter değişimi: fetchFeed yeni filtreyle çekilir, realtime devre dışı kalır
//    (yine de "all" filtresine dönüldüğünde tekrar açılır)
//  - Pagination: onEndReached → loadMore (startAfter ile sayfa sonrası)
//  - Like/Bookmark: optimistic UI + rollback
//
// PostsProvider AuthProvider altında render edilmeli — `user?.uid` lazım.

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import * as PostsApi from "../services/postsService";
import { useAuth } from "./AuthContext";
import { i18nText } from "../utils/i18nText";
import { shouldPersistInternetData } from "../utils/dataCacheSettings";
import { POST_TYPES } from "../utils/postComposer";
import useStartupGate from "../hooks/useStartupGate";


const PostsContext = createContext();
export const usePosts = () => useContext(PostsContext);

const FEED_CACHE_KEY = "feed_cache_v1";
// Tip filtreleri composer'ın desteklediği paylaşım tiplerinden türetilir —
// yeni bir tip eklendiğinde feed filtresi de kendiliğinden gelir.
const FILTERS = ["all", ...POST_TYPES, "following"];
const SORTS = ["recent", "likes", "comments"];

const sortLoadedPosts = (posts, sort) => {
  const next = [...posts];
  if (sort === "likes") {
    return next.sort(
      (a, b) =>
        (b.likesCount || 0) - (a.likesCount || 0) ||
        (b._createdAtMs || 0) - (a._createdAtMs || 0),
    );
  }
  if (sort === "comments") {
    return next.sort(
      (a, b) =>
        (b.commentsCount || 0) - (a.commentsCount || 0) ||
        (b._createdAtMs || 0) - (a._createdAtMs || 0),
    );
  }
  return next.sort((a, b) => (b._createdAtMs || 0) - (a._createdAtMs || 0));
};

const sameIds = (a, b) =>
  a.length === b.length && a.every((x, i) => x.id === b[i].id);

export function PostsProvider({ children }) {
  const { user } = useAuth();

  // Feed açılışta hiçbir ekranda görünmüyor (Hub sekmesi lazy mount).
  // Cache parse + ilk fetch + realtime listener'ı splash sonrası donma
  // penceresinin dışına ertele; kapı açılana dek loading=true kalır.
  const startupReady = useStartupGate(2200);

  const [posts, setPosts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Pagination cursor — Firestore DocumentSnapshot, JSON'a serialize edilmez.
  const lastDocRef = useRef(null);

  const [likedIds, setLikedIds] = useState(() => new Set());
  const [bookmarkIds, setBookmarkIds] = useState(() => new Set());

  // Realtime listener — sadece "all" filtresinde aktif.
  const unsubRef = useRef(null);

  // Cold-start fetch'i geç biterse ve kullanıcı bu arada filtre değiştirdiyse
  // "all" sonuçları filtreli listeyi ezmesin diye güncel filtreyi ref'te tut.
  const filterStateRef = useRef({ filter, sort });
  filterStateRef.current = { filter, sort };

  // ── 1. Cold start: cache + ilk fetch ─────────────────────────────────────
  useEffect(() => {
    if (!startupReady) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const cached = await AsyncStorage.getItem(FEED_CACHE_KEY);
        if (cached && !cancelled) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) setPosts(parsed);
        }
      } catch {}

      try {
        const { posts: fresh, lastDoc } = await PostsApi.fetchFeed({
          filter: "all",
        });
        if (cancelled) return;
        if (
          filterStateRef.current.filter !== "all" ||
          filterStateRef.current.sort !== "recent"
        ) {
          // Kullanıcı startup penceresinde filtre değiştirmiş; effect 3 hallediyor.
          setLoading(false);
          return;
        }
        setPosts((prev) => (sameIds(prev, fresh) ? prev : fresh));
        lastDocRef.current = lastDoc;
        setHasMore(fresh.length > 0);
        if (shouldPersistInternetData({ category: "posts" })) {
          AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(fresh)).catch(
            () => {},
          );
        }
      } catch (e) {
        if (__DEV__) console.warn("Initial feed fetch failed:", e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startupReady]);

  // ── 2. Realtime listener (sadece "all" filtresinde) ──────────────────────
  useEffect(() => {
    if (!startupReady || filter !== "all" || sort !== "recent") {
      unsubRef.current?.();
      unsubRef.current = null;
      return;
    }
    // İlk snapshot'ta listeyi olduğu gibi değiştir: başka bir filtreden
    // dönülüyorsa prev o filtrenin gönderilerini içerir; slice(15) merge'ü
    // yabancı gönderileri feed'e karıştırır (yinelenen key'ler dahil).
    let isFirstSnapshot = true;
    unsubRef.current = PostsApi.subscribeToFreshFeed((live) => {
      setPosts((prev) => {
        if (isFirstSnapshot) {
          isFirstSnapshot = false;
          return live;
        }
        // Eğer paginate edilmişse (ilk 15'ten fazla varsa), realtime'dan gelen
        // ilk 15'i prev'in geri kalanıyla birleştir; aksi halde direkt değiştir.
        if (prev.length <= 15) return live;
        const extra = prev.slice(15);
        return [...live, ...extra];
      });
      if (shouldPersistInternetData({ category: "posts" })) {
        AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(live)).catch(
          () => {},
        );
      }
    });
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [startupReady, filter, sort]);

  // ── 3. Filter değişimi ────────────────────────────────────────────────────
  // İlk mount'ta cold-start effect'i (1) fetch'i yapıyor; burada atla.
  // Sonraki değişimlerde "all/recent" dahil her filtre için fetch gerekir:
  // aksi halde lastDocRef başka filtrenin cursor'ında kalır ve "all" feed'inde
  // pagination ya yanlış yerden devam eder ya da hiç çalışmaz.
  const filterEffectFirstRun = useRef(true);
  useEffect(() => {
    if (filterEffectFirstRun.current) {
      filterEffectFirstRun.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      lastDocRef.current = null;
      try {
        if (filter === "following") {
          if (!user?.uid) {
            if (!cancelled) setPosts([]);
            return;
          }
          const { posts: p } = await PostsApi.fetchFollowingFeed(user.uid, sort);
          if (!cancelled) {
            setPosts(p);
            setHasMore(false); // following feed pagination şimdilik yok
          }
        } else {
          const { posts: p, lastDoc } = await PostsApi.fetchFeed({ filter, sort });
          if (!cancelled) {
            setPosts(p);
            lastDocRef.current = lastDoc;
            setHasMore(p.length > 0);
          }
        }
      } catch (e) {
        if (__DEV__) console.warn("Filter fetch failed:", e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, sort, user?.uid]);

  // ── 4. Liked + Bookmark ID set'leri (user değişince yenile) ──────────────
  useEffect(() => {
    if (!user?.uid) {
      setLikedIds(new Set());
      setBookmarkIds(new Set());
      return;
    }
    if (!startupReady) return;
    PostsApi.fetchMyLikedPostIds(user.uid).then(setLikedIds).catch(() => {});
    PostsApi.fetchMyBookmarkIds(user.uid).then(setBookmarkIds).catch(() => {});
  }, [user?.uid, startupReady]);

  // ── 5. Pagination ────────────────────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    if (filter === "following") return; // following pagination şimdilik kapalı
    if (!lastDocRef.current) return;

    setLoadingMore(true);
    try {
      const { posts: more, lastDoc } = await PostsApi.fetchFeed({
        filter,
        sort,
        lastDoc: lastDocRef.current,
      });
      setPosts((prev) => [...prev, ...more]);
      lastDocRef.current = lastDoc;
      setHasMore(more.length > 0);
    } catch (e) {
      if (__DEV__) console.warn("loadMore failed:", e.message);
    } finally {
      setLoadingMore(false);
    }
  }, [filter, sort, hasMore, loadingMore, loading]);

  // ── 6. Pull-to-refresh ───────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true);
    lastDocRef.current = null;
    try {
      if (filter === "following" && user?.uid) {
        const { posts: p } = await PostsApi.fetchFollowingFeed(user.uid, sort);
        setPosts(p);
      } else {
        const { posts: p, lastDoc } = await PostsApi.fetchFeed({ filter, sort });
        setPosts(p);
        lastDocRef.current = lastDoc;
        setHasMore(p.length > 0);
        if (filter === "all" && sort === "recent" && shouldPersistInternetData({ category: "posts" })) {
          AsyncStorage.setItem(FEED_CACHE_KEY, JSON.stringify(p)).catch(
            () => {},
          );
        }
      }
    } catch (e) {
      if (__DEV__) console.warn("refresh failed:", e.message);
    } finally {
      setRefreshing(false);
    }
  }, [filter, sort, user?.uid]);

  // ── 7. Like toggle (optimistic) ──────────────────────────────────────────
  const toggleLike = useCallback(
    async (postId) => {
      if (!user?.uid) {
        Toast.show({ type: "warning", text1: i18nText("autoI18n.begenmek_icin_giris_yap", "Beğenmek için giriş yap") });
        return;
      }
      const wasLiked = likedIds.has(postId);

      // Optimistic apply
      setLikedIds((prev) => {
        const next = new Set(prev);
        wasLiked ? next.delete(postId) : next.add(postId);
        return next;
      });
      setPosts((prev) =>
        sortLoadedPosts(
          prev.map((p) =>
            p.id === postId
              ? {
                  ...p,
                  likesCount: Math.max(
                    0,
                    (p.likesCount || 0) + (wasLiked ? -1 : 1),
                  ),
                }
              : p,
          ),
          sort,
        ),
      );

      try {
        // Beğeni ekleniyorsa post sahibine bildirim için meta geç.
        const post = posts.find((p) => p.id === postId);
        const notifyMeta =
          !wasLiked && post?.authorId && post.authorId !== user.uid
            ? {
                toUid: post.authorId,
                fromName: user.displayName || "",
                fromAvatarIndex: 0,
                postTitle: post.title || "",
              }
            : null;
        const postMeta = post
          ? {
              title: post.title || "",
              authorName: post.authorName || "",
              type: post.type || "",
              poster: post.mediaList?.[0]?.poster || null,
            }
          : null;
        await PostsApi.toggleLike(postId, user.uid, wasLiked, notifyMeta, postMeta);
      } catch (e) {
        // Rollback
        setLikedIds((prev) => {
          const next = new Set(prev);
          wasLiked ? next.add(postId) : next.delete(postId);
          return next;
        });
        setPosts((prev) =>
          sortLoadedPosts(
            prev.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    likesCount: Math.max(
                      0,
                      (p.likesCount || 0) + (wasLiked ? 1 : -1),
                    ),
                  }
                : p,
            ),
            sort,
          ),
        );
        Toast.show({ type: "error", text1: i18nText("autoI18n.begeni_kaydedilemedi", "Beğeni kaydedilemedi") });
      }
    },
    [user?.uid, likedIds, posts, sort],
  );

  // ── 8. Bookmark toggle (optimistic) ──────────────────────────────────────
  const toggleBookmark = useCallback(
    async (postId) => {
      if (!user?.uid) {
        Toast.show({ type: "warning", text1: i18nText("autoI18n.kaydetmek_icin_giris_yap", "Kaydetmek için giriş yap") });
        return;
      }
      const wasBookmarked = bookmarkIds.has(postId);

      setBookmarkIds((prev) => {
        const next = new Set(prev);
        wasBookmarked ? next.delete(postId) : next.add(postId);
        return next;
      });

      try {
        const post = posts.find((p) => p.id === postId);
        const postMeta = post
          ? {
              title: post.title || "",
              authorName: post.authorName || "",
              type: post.type || "",
              poster: post.mediaList?.[0]?.poster || null,
            }
          : null;
        await PostsApi.toggleBookmark(postId, user.uid, wasBookmarked, postMeta);
      } catch (e) {
        setBookmarkIds((prev) => {
          const next = new Set(prev);
          wasBookmarked ? next.add(postId) : next.delete(postId);
          return next;
        });
        Toast.show({ type: "error", text1: i18nText("autoI18n.kaydetme_basarisiz", "Kaydetme başarısız") });
      }
    },
    [user?.uid, bookmarkIds, posts],
  );

  // ── Sahibi: post sil ────────────────────────────────────────────────────
  const deletePost = useCallback(
    async (postId) => {
      if (!user?.uid) return false;
      // Optimistic remove
      let snapshotBefore;
      setPosts((prev) => {
        snapshotBefore = prev;
        return prev.filter((p) => p.id !== postId);
      });
      try {
        await PostsApi.deletePost(postId, user.uid);
        Toast.show({ type: "success", text1: i18nText("autoI18n.paylasim_silindi", "Paylaşım silindi") });
        return true;
      } catch (e) {
        // Rollback
        if (snapshotBefore) setPosts(snapshotBefore);
        Toast.show({ type: "error", text1: "Silinemedi: " + e.message });
        return false;
      }
    },
    [user?.uid],
  );

  // ── Sahibi: post düzenle ────────────────────────────────────────────────
  const editPost = useCallback(
    async (postId, partial) => {
      if (!user?.uid) return false;
      // Optimistic update
      let snapshotBefore;
      setPosts((prev) => {
        snapshotBefore = prev;
        return prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                ...partial,
                _createdAtMs: p._createdAtMs, // korunsun
              }
            : p,
        );
      });
      try {
        await PostsApi.updatePost(postId, partial);
        Toast.show({ type: "success", text1: i18nText("autoI18n.guncellendi", "Güncellendi") });
        return true;
      } catch (e) {
        if (snapshotBefore) setPosts(snapshotBefore);
        Toast.show({ type: "error", text1: i18nText("autoI18n.guncellenemedi_2", "Güncellenemedi: ") + e.message });
        return false;
      }
    },
    [user?.uid],
  );

  // ── 9. Post oluştur — yeni post'u feed'in başına eklemek için kullanılır ─
  const submitPost = useCallback(
    async (payload) => {
      if (!user?.uid) {
        Toast.show({ type: "warning", text1: i18nText("autoI18n.paylasmak_icin_giris_yap", "Paylaşmak için giriş yap") });
        return null;
      }
      try {
        const newId = await PostsApi.createPost(user, payload);
        // Realtime listener `all` filtresinde otomatik ekleyecek; başka
        // filtrelerde manuel optimistic insert.
        const matchesFilter = filter === "all" || filter === payload.type;
        if (filter !== "following" && matchesFilter && (filter !== "all" || sort !== "recent")) {
          const optimistic = {
            id: newId,
            authorId: user.uid,
            authorName: user.displayName || i18nText("autoI18n.kullanici", "Kullanıcı"),
            // payload.authorAvatarIndex CreatePostModal tarafından eklenir
            authorAvatarIndex: payload.authorAvatarIndex ?? 0,
            ...payload,
            likesCount: 0,
            commentsCount: 0,
            _createdAtMs: Date.now(),
          };
          setPosts((prev) => sortLoadedPosts([optimistic, ...prev], sort));
        }
        Toast.show({ type: "success", text1: i18nText("autoI18n.paylasildi", "Paylaşıldı!") });
        return newId;
      } catch (e) {
        Toast.show({
          type: "error",
          text1: i18nText("autoI18n.paylasim_basarisiz", "Paylaşım başarısız: ") + e.message,
        });
        return null;
      }
    },
    [user, filter, sort],
  );

  // ── Anket oyu (optimistic toggle) ────────────────────────────────────────
  const votePoll = useCallback(
    async (postId, optionId) => {
      if (!user?.uid) {
        Toast.show({ type: "warning", text1: i18nText("autoI18n.oy_vermek_icin_giris_yap", "Oy vermek için giriş yap") });
        return;
      }
      const uid = user.uid;
      const post = posts.find((p) => p.id === postId);
      const currentVote = post?.poll?.votes?.[uid] ?? null;
      const nextVote = currentVote === optionId ? null : optionId;

      const applyVote = (voteVal) =>
        setPosts((prev) =>
          prev.map((p) => {
            if (p.id !== postId || !p.poll) return p;
            const votes = { ...(p.poll.votes || {}) };
            if (voteVal == null) delete votes[uid];
            else votes[uid] = voteVal;
            return { ...p, poll: { ...p.poll, votes } };
          }),
        );

      applyVote(nextVote); // optimistic
      try {
        await PostsApi.votePoll(postId, uid, optionId, currentVote);
      } catch (e) {
        applyVote(currentVote); // rollback
        Toast.show({ type: "error", text1: i18nText("autoI18n.oy_kaydedilemedi", "Oy kaydedilemedi") });
      }
    },
    [user?.uid, posts],
  );

  const value = useMemo(
    () => ({
      // state
      posts,
      filter,
      sort,
      loading,
      loadingMore,
      refreshing,
      hasMore,
      likedIds,
      bookmarkIds,
      // setters / actions
      setFilter,
      setSort,
      loadMore,
      refresh,
      toggleLike,
      toggleBookmark,
      submitPost,
      deletePost,
      editPost,
      votePoll,
      // constants
      FILTERS,
      SORTS,
    }),
    [
      posts,
      filter,
      sort,
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
    ],
  );

  return <PostsContext.Provider value={value}>{children}</PostsContext.Provider>;
}
