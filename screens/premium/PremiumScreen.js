import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import axios from "axios";
import Toast from "react-native-toast-message";
import AppIcon from "../../components/AppIcon";
import AppBadge from "../../components/badges/AppBadge";
import {
  IDENTITY_BADGES,
  badgeDesc,
  badgeLabel,
} from "../../components/badges/badgeCatalog";
import PosterMarqueeBackground from "../../components/PosterMarqueeBackground";
import {
  useApiSettings,
  useImageQualitySettings,
} from "../../context/AppSettingsContext";
import { useLanguage } from "../../context/LanguageContext";
import { usePremium } from "../../context/PremiumContext";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import {
  getPackagesForTier,
  getPackageDisplayProduct,
  getPackagePeriodKey,
  getPackageSavings,
  getPackageTierKey,
  PREMIUM_PLAN,
  selectPreferredPackage,
} from "../../utils/premium";
import { SettingsSubScreen, buildUiColors } from "../tabs/settings/settingsUi";

const FEATURES = {
  premium: [
    {
      icon: "sparkles",
      tr: "Günde 100 CineMatch AI mesajı",
      en: "100 CineMatch AI messages per day",
    },
    {
      icon: "stats-chart",
      tr: "Gelişmiş istatistikler ve tüm Wrapped yılları",
      en: "Advanced stats and every Wrapped year",
    },
    {
      icon: "color-palette",
      tr: "Özel temalar ve premium kişiselleştirme",
      en: "Custom themes and premium personalization",
    },
    {
      icon: "game-controller",
      tr: "Premium oyun modları ve başarımlar",
      en: "Premium game modes and achievements",
    },
  ],
  unlimited: [
    {
      icon: "infinite",
      tr: "Sınırsız CineMatch AI kullanımı",
      en: "Unlimited CineMatch AI usage",
    },
    {
      icon: "albums",
      tr: "Sınırsız liste, not ve hatırlatıcı",
      en: "Unlimited lists, notes, and reminders",
    },
    {
      icon: "diamond",
      tr: "Tüm Premium özellikleri dahil",
      en: "Every Premium feature included",
    },
    {
      icon: "rocket",
      tr: "Yeni premium özelliklere tam erişim",
      en: "Full access to new premium features",
    },
  ],
};

const EXPERIENCE_GROUPS = [
  {
    id: "library",
    icon: "albums",
    title: {
      tr: "Listelerin ve izleme günlüğün",
      en: "Your lists and watch diary",
    },
    summary: {
      tr: "İzlediğin, planladığın ve sevdiğin her şey tek yerde.",
      en: "Everything you watched, planned, and loved in one place.",
    },
    bullets: {
      tr: [
        "Film ve diziler için özel listeler oluştur, içerik ekle ve düzenle",
        "İzleme geçmişini, favorilerini ve devam eden dizilerini takip et",
        "Notlarını, hatırlatıcılarını ve yayın takvimini birlikte yönet",
      ],
      en: [
        "Create, organize, and fill custom movie and TV lists",
        "Track your history, favorites, and ongoing shows",
        "Manage notes, reminders, and your release calendar together",
      ],
    },
    unlimited: {
      tr: "Unlimited ile liste, not ve hatırlatıcı sınırlarını kaldır.",
      en: "Remove list, note, and reminder limits with Unlimited.",
    },
  },
  {
    id: "insights",
    icon: "stats-chart",
    title: {
      tr: "İstatistikler ve CineMatch AI",
      en: "Insights and CineMatch AI",
    },
    summary: {
      tr: "İzleme alışkanlıklarını gör, sana özel öneriler al.",
      en: "Understand your viewing habits and get personal picks.",
    },
    bullets: {
      tr: [
        "Film ve dizi istatistiklerini ayrıntılı grafiklerle incele",
        "Tüm Wrapped yıllarına ve kişisel keşif özetlerine eriş",
        "CineMatch AI ile ruh haline ve zevkine göre içerik keşfet",
      ],
      en: [
        "Explore movie and TV stats with detailed charts",
        "Access every Wrapped year and personalized discovery summary",
        "Use CineMatch AI for picks shaped around your mood and taste",
      ],
    },
    unlimited: {
      tr: "Unlimited planda CineMatch AI mesaj sınırı yok.",
      en: "Unlimited removes the CineMatch AI message limit.",
    },
  },
  {
    id: "social",
    icon: "chatbubbles",
    title: { tr: "Arkadaşlar ve mesajlaşma", en: "Friends and messaging" },
    summary: {
      tr: "İzlediklerin hakkında yalnızca takip etme, birlikte konuş.",
      en: "Do more than track what you watch—talk about it together.",
    },
    bullets: {
      tr: [
        "Arkadaş profillerini keşfet; birebir veya grup sohbeti başlat",
        "Sohbette film, dizi, oyuncu, görsel ve bağlantı paylaş",
        "Yanıtla, sabitle, düzenle ve sohbet içinde anket oluştur",
      ],
      en: [
        "Discover friend profiles and start direct or group chats",
        "Share movies, shows, people, images, and links in chat",
        "Reply, pin, edit, and create polls inside conversations",
      ],
    },
  },
  {
    id: "together",
    icon: "people",
    title: { tr: "Ortak listeler", en: "Shared lists" },
    summary: {
      tr: "Ne izleyeceğinize birlikte karar verin.",
      en: "Decide what to watch together.",
    },
    bullets: {
      tr: [
        "Arkadaşlarınla ortak film ve dizi listeleri oluştur",
        "Üye ekle, içerikleri birlikte biriktir ve listeyi düzenle",
        "Ortak liste rozetlerini posterlerin üzerinde anında gör",
      ],
      en: [
        "Build shared movie and TV lists with friends",
        "Invite members, collect titles together, and organize the list",
        "See shared-list badges directly on your posters",
      ],
    },
  },
  {
    id: "community",
    icon: "heart",
    title: {
      tr: "Yorumlar, puanlar ve Story",
      en: "Comments, ratings, and Stories",
    },
    summary: {
      tr: "Fikrini puanla, anlat ve sana özgü bir tasarımla paylaş.",
      en: "Rate it, talk about it, and share it in your own style.",
    },
    bullets: {
      tr: [
        "Film ve dizilere yorum yap, 10 üzerinden yıldızlı puan ver",
        "Topluluk gönderilerini beğen, kaydet, yanıtla ve paylaş",
        "Poster, puan ve metinlerle Story tasarla; taslaklarını sakla",
      ],
      en: [
        "Comment on movies and shows and rate them out of 10",
        "Like, save, reply to, and share community posts",
        "Design Stories with posters, ratings, and text; save drafts",
      ],
    },
  },
  {
    id: "hub",
    icon: "trophy",
    title: { tr: "Hub, turnuva ve oyunlar", en: "Hub, tournaments, and games" },
    summary: {
      tr: "Keşfini rekabete ve paylaşılabilir anlara dönüştür.",
      en: "Turn discovery into competition and shareable moments.",
    },
    bullets: {
      tr: [
        "Aylık film turnuvasında seçim yap ve şampiyonunu belirle",
        "Sahne Tahmin oyununu farklı modlarla oyna",
        "Skorlarını, başarımlarını ve Hub gönderilerini paylaş",
      ],
      en: [
        "Vote through the monthly movie tournament and crown a winner",
        "Play Scene Guess across different modes",
        "Share scores, achievements, and posts from the Hub",
      ],
    },
  },
  {
    id: "personalize",
    icon: "color-palette",
    title: {
      tr: "Profil ve kişiselleştirme",
      en: "Profile and personalization",
    },
    summary: {
      tr: "Seelogd görünümünü ve deneyimini kendine göre şekillendir.",
      en: "Shape Seelogd's look and feel around you.",
    },
    bullets: {
      tr: [
        "Özel temalarla uygulamanın renklerini kişiselleştir",
        "Poster boyutu, köşeleri, sütunları ve durum rozetlerini ayarla",
        "Profilini, gizliliğini ve bildirim tercihlerini yönet",
      ],
      en: [
        "Personalize app colors with custom themes",
        "Tune poster size, corners, columns, and status badges",
        "Manage your profile, privacy, and notification preferences",
      ],
    },
  },
];

function packageTitle(aPackage, tr) {
  const key = getPackagePeriodKey(aPackage);
  if (key === "annual") return tr ? "Yıllık" : "Annual";
  if (key === "monthly") return tr ? "Aylık" : "Monthly";
  if (key === "weekly") return tr ? "Haftalık" : "Weekly";
  if (key === "lifetime") return tr ? "Ömür boyu" : "Lifetime";
  return aPackage?.product?.title || aPackage?.identifier || "Premium";
}

function packagePeriodLabel(aPackage, tr) {
  const key = getPackagePeriodKey(aPackage);
  if (key === "annual") return tr ? "/ yıl" : "/ year";
  if (key === "monthly") return tr ? "/ ay" : "/ month";
  if (key === "weekly") return tr ? "/ hafta" : "/ week";
  return "";
}

export default function PremiumScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const { API_KEY } = useApiSettings();
  const { getTmdbUrl } = useImageQualitySettings();
  const C = buildUiColors(theme);
  const tr = language === "tr";
  const {
    isPremium,
    isUnlimited,
    plan,
    packages,
    loading,
    busyAction,
    configurationError,
    entitlementId,
    usingTestStore,
    purchasePackage,
    restorePurchases,
    showPaywall,
    openCustomerCenter,
  } = usePremium();
  const [selectedTier, setSelectedTier] = useState(PREMIUM_PLAN.PREMIUM);
  const [backgroundPosters, setBackgroundPosters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [expandedBenefitId, setExpandedBenefitId] = useState(null);
  const [exploreVisible, setExploreVisible] = useState(false);
  const [showBillingOptions, setShowBillingOptions] = useState(false);
  const planTransition = useRef(new Animated.Value(0)).current;
  const ctaShimmer = useRef(new Animated.Value(0)).current;
  const displayPackages = useMemo(
    () =>
      [...packages].sort((left, right) => {
        const tierOrder =
          (getPackageTierKey(left) === PREMIUM_PLAN.UNLIMITED ? 1 : 0) -
          (getPackageTierKey(right) === PREMIUM_PLAN.UNLIMITED ? 1 : 0);
        if (tierOrder) return tierOrder;
        const periodRank = (item) =>
          getPackagePeriodKey(item) === "monthly" ? 0 : 1;
        return periodRank(left) - periodRank(right);
      }),
    [packages]
  );
  const pricedPackages = useMemo(
    () =>
      displayPackages.map((item) => ({
        ...item,
        product: getPackageDisplayProduct(item, {
          usingTestStore,
          language,
        }),
      })),
    [displayPackages, language, usingTestStore]
  );
  const bestAnnualDiscount = useMemo(
    () =>
      pricedPackages.reduce(
        (best, item) =>
          Math.max(
            best,
            getPackageSavings(item, pricedPackages, language)?.percent || 0
          ),
        0
      ),
    [language, pricedPackages]
  );

  useEffect(() => {
    if (selectedId && packages.some((item) => item.identifier === selectedId)) {
      return;
    }
    const targetTier =
      plan === PREMIUM_PLAN.PREMIUM
        ? PREMIUM_PLAN.UNLIMITED
        : plan === PREMIUM_PLAN.UNLIMITED
        ? PREMIUM_PLAN.UNLIMITED
        : PREMIUM_PLAN.PREMIUM;
    const initialPackage = selectPreferredPackage(
      getPackagesForTier(packages, targetTier)
    );
    setSelectedId(
      initialPackage?.identifier || packages[0]?.identifier || null
    );
    setSelectedTier(
      initialPackage ? getPackageTierKey(initialPackage) : targetTier
    );
  }, [packages, plan, selectedId]);

  useEffect(() => {
    let active = true;
    const headers = { accept: "application/json", Authorization: API_KEY };
    const tmdbLanguage = tr ? "tr-TR" : "en-US";

    Promise.all([
      axios.get("https://api.themoviedb.org/3/discover/movie", {
        params: { sort_by: "vote_count.desc", language: tmdbLanguage, page: 1 },
        headers,
      }),
      axios.get("https://api.themoviedb.org/3/discover/tv", {
        params: { sort_by: "vote_count.desc", language: tmdbLanguage, page: 1 },
        headers,
      }),
    ])
      .then(([movies, shows]) => {
        if (!active) return;
        const items = [
          ...(movies.data?.results || []),
          ...(shows.data?.results || []),
        ].filter((item) => item.poster_path);
        const posterUris = items
          .map((item) => getTmdbUrl(item.poster_path, "poster", 200))
          .filter(Boolean);
        setBackgroundPosters(posterUris);
      })
      .catch(() => {
        // Poster ağı yüklenemezse paywall, tema gradyanıyla çalışmaya devam eder.
      });

    return () => {
      active = false;
    };
  }, [API_KEY, getTmdbUrl, tr]);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(ctaShimmer, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.delay(450),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [ctaShimmer]);

  const selectedPackage =
    packages.find((item) => item.identifier === selectedId) || null;
  const selectedDisplayPackage =
    pricedPackages.find((item) => item.identifier === selectedId) || null;
  const selectedTierPackages = getPackagesForTier(pricedPackages, selectedTier);
  const busy = Boolean(busyAction);
  const selectedPlanName =
    selectedTier === PREMIUM_PLAN.UNLIMITED ? "Premium Unlimited" : "Premium";
  const selectedIdentityBadge =
    selectedTier === PREMIUM_PLAN.UNLIMITED
      ? IDENTITY_BADGES.unlimited
      : IDENTITY_BADGES.premium;
  const localized = tr ? "tr" : "en";
  const combinedBenefitGroups = [
    {
      id: "plan",
      icon: selectedTier === PREMIUM_PLAN.UNLIMITED ? "infinite" : "diamond",
      title: {
        tr: `${selectedPlanName} ayrıcalıkları`,
        en: `${selectedPlanName} benefits`,
      },
      summary: {
        tr: "Seçtiğin planla açılan temel premium özellikler.",
        en: "The core premium features unlocked by your selected plan.",
      },
      compactItems: FEATURES[selectedTier].map((feature) => ({
        icon: feature.icon,
        text: feature[localized],
      })),
    },
    ...EXPERIENCE_GROUPS.map((group) => ({
      ...group,
      compactItems: group.bullets[localized].map((text) => ({
        icon: group.icon,
        text,
      })),
    })),
  ];

  const toggleBenefit = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedBenefitId((current) => (current === id ? null : id));
  };

  const selectTier = (tier) => {
    if (isUnlimited && tier !== PREMIUM_PLAN.UNLIMITED) return;
    const preferredPackage = selectPreferredPackage(
      getPackagesForTier(packages, tier)
    );
    setSelectedTier(tier);
    setSelectedId(preferredPackage?.identifier || null);
    planTransition.setValue(0);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowBillingOptions(true);
    requestAnimationFrame(() => {
      Animated.spring(planTransition, {
        toValue: 1,
        damping: 16,
        stiffness: 150,
        mass: 0.8,
        useNativeDriver: true,
      }).start();
    });
  };

  const showTierSelection = () => {
    Animated.timing(planTransition, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowBillingOptions(false);
    });
  };

  const buy = async () => {
    if (!selectedPackage || busy) return;
    try {
      await purchasePackage(selectedPackage);
      Toast.show({
        type: "success",
        text1: tr ? "Seelogd Premium etkin" : "Seelogd Premium is active",
      });
    } catch (error) {
      if (error?.userCancelled) return;
      Toast.show({
        type: "error",
        text1: tr
          ? "Satın alma tamamlanamadı"
          : "Purchase could not be completed",
        text2: error?.message,
      });
    }
  };

  const restore = async () => {
    if (busy) return;
    try {
      const info = await restorePurchases();
      const restored = Boolean(info?.entitlements?.active?.[entitlementId]);
      Toast.show({
        type: restored ? "success" : "info",
        text1: restored
          ? tr
            ? "Premium satın alımı geri yüklendi"
            : "Premium purchase restored"
          : tr
          ? "Aktif satın alım bulunamadı"
          : "No active purchase found",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: tr
          ? "Satın alımlar geri yüklenemedi"
          : "Purchases could not be restored",
        text2: error?.message,
      });
    }
  };

  const manage = async () => {
    if (busy) return;
    try {
      await openCustomerCenter();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: tr
          ? "Abonelik ayarları açılamadı"
          : "Subscription settings could not be opened",
        text2: error?.message,
      });
    }
  };

  const openPaywall = async () => {
    if (busy) return;
    try {
      // `source` = paywall'ı açan kapı. Bugün tek giriş burası; ileride
      // AI kotası / tema kilidi gibi kapılar eklenince kendi adlarını geçsin
      // ki hangi kapının dönüştüğü ölçülebilsin.
      const { result } = await showPaywall({ source: "premium_screen" });
      if (result === "PURCHASED" || result === "RESTORED") {
        Toast.show({
          type: "success",
          text1: tr ? "Premium erişimin güncellendi" : "Premium access updated",
        });
      } else if (result === "ERROR") {
        throw new Error("RevenueCat paywall returned an error");
      }
    } catch (error) {
      Toast.show({
        type: "error",
        text1: tr ? "Ödeme ekranı açılamadı" : "Paywall could not be opened",
        text2: error?.message,
      });
    }
  };

  return (
    <SettingsSubScreen
      title="Seelogd Premium"
      background={
        backgroundPosters.length ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <PosterMarqueeBackground
              posters={backgroundPosters}
              style={styles.posterBackdrop}
            />
            <LinearGradient
              colors={[
                alpha(theme.primary, 0.64),
                alpha(theme.primary, 0.82),
                theme.primary,
              ]}
              locations={[0, 0.48, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={[alpha(theme.accent, 0.15), "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0.65 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : null
      }
    >
      <LinearGradient
        colors={["#11101A", theme.bold || "#2B1757", alpha(theme.accent, 0.9)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroOrbTop} />
        <View style={styles.heroOrbBottom} />
        <View style={styles.heroTopRow}>
          <View style={styles.heroBrandBadge}>
            <View style={styles.heroBrandDot} />
            <Text style={styles.heroBrandText}>SEELOGD PREMIUM</Text>
          </View>
          {isPremium && (
            <View style={styles.heroActiveBadge}>
              <AppIcon name="checkmark" size={12} color="#FFFFFF" />
              <Text style={styles.heroActiveText}>
                {isUnlimited ? "UNLIMITED" : tr ? "AKTİF" : "ACTIVE"}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.heroContent}>
          <View style={styles.crownOuter}>
            <LinearGradient
              colors={["rgba(255,255,255,0.28)", "rgba(255,255,255,0.08)"]}
              style={styles.crown}
            >
              <AppIcon
                family="Ionicons"
                name="diamond"
                size={28}
                color="#fff"
              />
            </LinearGradient>
          </View>
          <Text style={styles.heroTitle}>
            {isUnlimited
              ? tr
                ? "Sınırları kaldırdın."
                : "You removed the limits."
              : isPremium
              ? tr
                ? "Premium deneyimin hazır."
                : "Your Premium experience is ready."
              : tr
              ? "İzlediklerin kadar sana özel."
              : "As personal as what you watch."}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isUnlimited
              ? tr
                ? "CineMatch AI ve tüm Seelogd ayrıcalıkları artık sınırsız."
                : "CineMatch AI and every Seelogd benefit are now unlimited."
              : isPremium
              ? tr
                ? "Tüm Premium ayrıcalıkların açık. Dilersen Unlimited'a geç."
                : "Your Premium benefits are unlocked. Upgrade to Unlimited anytime."
              : tr
              ? "Daha güçlü öneriler, derin istatistikler ve kusursuz bir keşif deneyimi."
              : "Smarter recommendations, deeper insights, and effortless discovery."}
          </Text>
        </View>
        <View style={styles.heroTrustRow}>
          {["shield-checkmark", "flash", "sync"].map((icon, index) => (
            <View key={icon} style={styles.heroTrustItem}>
              <AppIcon name={icon} size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.heroTrustText}>
                {index === 0
                  ? tr
                    ? "Güvenli ödeme"
                    : "Secure payment"
                  : index === 1
                  ? tr
                    ? "Anında erişim"
                    : "Instant access"
                  : tr
                  ? "İstediğin zaman iptal"
                  : "Cancel anytime"}
              </Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {usingTestStore && (
        <View style={[styles.testBadge, { backgroundColor: C.iconAmber }]}>
          <AppIcon
            family="Ionicons"
            name="flask-outline"
            size={14}
            color={C.amber}
          />
          <Text style={[styles.testBadgeText, { color: C.amber }]}>
            REVENUECAT TEST STORE
          </Text>
        </View>
      )}

      <View style={styles.sectionHeadingCompact}>
        <Text style={[styles.sectionKicker, { color: C.accent }]}>01</Text>
        <Text style={[styles.sectionTitle, { color: C.text }]}>
          {tr ? "Premium'u keşfet" : "Explore Premium"}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tr ? "Premium'u keşfet" : "Explore Premium"}
        onPress={() => setExploreVisible(true)}
        style={({ pressed }) => [
          styles.exploreCard,
          {
            backgroundColor: C.card,
            borderColor: alpha(C.accent, 0.3),
            opacity: pressed ? 0.78 : 1,
          },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={[alpha(C.accent, 0.17), "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.exploreIcon, { backgroundColor: C.accentDim }]}>
          <AppIcon name="sparkles" size={20} color={C.accent} />
        </View>
        <View style={styles.exploreCopy}>
          <Text style={[styles.exploreTitle, { color: C.text }]}>
            {tr ? "Premium'u yakından incele" : "See what Premium unlocks"}
          </Text>
          <Text style={[styles.exploreSubtitle, { color: C.muted }]}>
            {tr
              ? "Plan ayrıcalıklarını, kimlik rozetini ve Seelogd deneyimini görüntüle."
              : "View plan benefits, your identity badge, and the Seelogd experience."}
          </Text>
        </View>
        <View style={[styles.exploreArrow, { backgroundColor: C.cardAlt }]}>
          <AppIcon name="arrow-forward" size={17} color={C.accent} />
        </View>
      </Pressable>

      <Modal
        visible={exploreVisible}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setExploreVisible(false)}
      >
        <View style={styles.exploreModalRoot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tr ? "Kapat" : "Close"}
            style={styles.exploreModalBackdrop}
            onPress={() => setExploreVisible(false)}
          />
          <View
            style={[
              styles.exploreModalSheet,
              { backgroundColor: C.bg, borderColor: C.border },
            ]}
          >
            <View
              style={[styles.exploreModalHandle, { backgroundColor: C.border }]}
            />
            <View style={styles.exploreModalHeader}>
              <View style={styles.exploreModalHeaderCopy}>
                <Text style={[styles.exploreModalTitle, { color: C.text }]}>
                  {tr ? "Premium'u keşfet" : "Explore Premium"}
                </Text>
                <Text style={[styles.exploreModalSubtitle, { color: C.muted }]}>
                  {tr
                    ? `${selectedPlanName} ile açılan deneyim`
                    : `The experience unlocked with ${selectedPlanName}`}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr ? "Kapat" : "Close"}
                onPress={() => setExploreVisible(false)}
                style={[
                  styles.exploreModalClose,
                  { backgroundColor: C.cardAlt },
                ]}
              >
                <AppIcon name="close" size={20} color={C.text} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.exploreModalContent}
            >
              <Text style={[styles.badgeSectionLabel, { color: C.accent }]}>
                {tr ? "ÖZEL KİMLİK ROZETİ" : "EXCLUSIVE IDENTITY BADGE"}
              </Text>

              <LinearGradient
                colors={[
                  alpha(C.accent, 0.2),
                  C.card,
                  selectedTier === PREMIUM_PLAN.UNLIMITED
                    ? alpha("#F5C518", 0.1)
                    : alpha(C.accent, 0.08),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[
                  styles.badgeShowcase,
                  { borderColor: alpha(C.accent, 0.32) },
                ]}
              >
                <View style={styles.badgeGlow} />
                <View style={styles.badgeVisual}>
                  <AppBadge
                    glyph={selectedIdentityBadge.glyph}
                    glyphSolid={selectedIdentityBadge.glyphSolid}
                    rarity={selectedIdentityBadge.rarity}
                    ornate={selectedIdentityBadge.ornate}
                    size={78}
                    accessibilityLabel={badgeLabel(
                      selectedIdentityBadge,
                      language
                    )}
                  />
                  <View
                    style={[
                      styles.rarityPill,
                      {
                        backgroundColor:
                          selectedTier === PREMIUM_PLAN.UNLIMITED
                            ? alpha("#F5C518", 0.16)
                            : C.accentDim,
                      },
                    ]}
                  >
                    <AppIcon
                      name={
                        selectedTier === PREMIUM_PLAN.UNLIMITED
                          ? "sparkles"
                          : "diamond"
                      }
                      size={10}
                      color={
                        selectedTier === PREMIUM_PLAN.UNLIMITED
                          ? "#D8A900"
                          : C.accent
                      }
                    />
                    <Text
                      style={[
                        styles.rarityText,
                        {
                          color:
                            selectedTier === PREMIUM_PLAN.UNLIMITED
                              ? "#D8A900"
                              : C.accent,
                        },
                      ]}
                    >
                      {selectedTier === PREMIUM_PLAN.UNLIMITED
                        ? tr
                          ? "EFSANEVİ"
                          : "LEGENDARY"
                        : tr
                        ? "EPİK"
                        : "EPIC"}
                    </Text>
                  </View>
                </View>

                <View style={styles.badgeShowcaseCopy}>
                  <Text style={[styles.badgeShowcaseTitle, { color: C.text }]}>
                    {badgeLabel(selectedIdentityBadge, language)}
                  </Text>
                  <Text style={[styles.badgeShowcaseDesc, { color: C.muted }]}>
                    {badgeDesc(selectedIdentityBadge, language)}
                  </Text>
                  <View style={styles.badgePerks}>
                    <View style={styles.badgePerk}>
                      <AppIcon
                        name="person-circle-outline"
                        size={14}
                        color={C.accent}
                      />
                      <Text style={[styles.badgePerkText, { color: C.text }]}>
                        {tr ? "Profilinde görünür" : "Shown on your profile"}
                      </Text>
                    </View>
                    <View style={styles.badgePerk}>
                      <AppIcon name="sync" size={14} color={C.accent} />
                      <Text style={[styles.badgePerkText, { color: C.text }]}>
                        {tr
                          ? "Planınla otomatik güncellenir"
                          : "Updates automatically with your plan"}
                      </Text>
                    </View>
                  </View>
                </View>
              </LinearGradient>

              <View style={styles.experienceHeading}>
                <View style={styles.experienceHeadingCopy}>
                  <Text style={[styles.experienceTitle, { color: C.text }]}>
                    {tr ? "Premium ayrıcalıkları" : "Premium benefits"}
                  </Text>
                  <Text style={[styles.experienceSubtitle, { color: C.muted }]}>
                    {tr
                      ? "Bir başlığa dokunarak özellikleri kompakt görünümde incele."
                      : "Tap a category to review its features in a compact view."}
                  </Text>
                </View>
                <View
                  style={[
                    styles.selectedPlanPill,
                    { backgroundColor: C.accentDim },
                  ]}
                >
                  <AppIcon
                    name={
                      selectedTier === PREMIUM_PLAN.UNLIMITED
                        ? "infinite"
                        : "diamond"
                    }
                    size={12}
                    color={C.accent}
                  />
                  <Text
                    style={[styles.selectedPlanPillText, { color: C.accent }]}
                  >
                    {selectedPlanName}
                  </Text>
                </View>
              </View>

              <View style={styles.experienceGroups}>
                {combinedBenefitGroups.map((group) => {
                  const expanded = expandedBenefitId === group.id;
                  return (
                    <View
                      key={group.id}
                      style={[
                        styles.experienceCard,
                        {
                          backgroundColor: C.card,
                          borderColor: expanded ? C.accent : C.border,
                        },
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ expanded }}
                        onPress={() => toggleBenefit(group.id)}
                        style={({ pressed }) => [
                          styles.experienceTrigger,
                          pressed && { opacity: 0.72 },
                        ]}
                      >
                        <View
                          style={[
                            styles.experienceIcon,
                            {
                              backgroundColor: expanded
                                ? C.accentDim
                                : C.cardAlt,
                            },
                          ]}
                        >
                          <AppIcon
                            name={group.icon}
                            size={18}
                            color={expanded ? C.accent : C.muted}
                          />
                        </View>
                        <View style={styles.experienceCopy}>
                          <Text
                            style={[
                              styles.experienceCardTitle,
                              { color: C.text },
                            ]}
                          >
                            {group.title[localized]}
                          </Text>
                          <Text
                            numberOfLines={expanded ? undefined : 1}
                            style={[
                              styles.experienceSummary,
                              { color: C.muted },
                            ]}
                          >
                            {group.summary[localized]}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.expandButton,
                            { backgroundColor: C.cardAlt },
                          ]}
                        >
                          <AppIcon
                            name={expanded ? "chevron-up" : "chevron-down"}
                            size={15}
                            color={expanded ? C.accent : C.muted}
                          />
                        </View>
                      </Pressable>

                      {expanded && (
                        <View
                          style={[
                            styles.experienceDetails,
                            { borderTopColor: C.border },
                          ]}
                        >
                          <View style={styles.compactBenefitGrid}>
                            {group.compactItems.map((item) => (
                              <View
                                key={item.text}
                                style={[
                                  styles.compactBenefitItem,
                                  {
                                    backgroundColor: C.cardAlt,
                                    borderColor: alpha(C.accent, 0.1),
                                  },
                                ]}
                              >
                                <View
                                  style={[
                                    styles.compactBenefitIcon,
                                    {
                                      backgroundColor: C.accentDim,
                                      borderColor: alpha(C.accent, 0.16),
                                    },
                                  ]}
                                >
                                  <AppIcon
                                    name={item.icon}
                                    size={12}
                                    color={C.accent}
                                  />
                                </View>
                                <Text
                                  style={[
                                    styles.compactBenefitText,
                                    { color: C.text },
                                  ]}
                                >
                                  {item.text}
                                </Text>
                              </View>
                            ))}
                          </View>
                          {selectedTier === PREMIUM_PLAN.UNLIMITED &&
                            group.unlimited && (
                              <LinearGradient
                                colors={[C.accentDim, alpha(C.accent, 0.04)]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[
                                  styles.unlimitedNote,
                                  { borderColor: alpha(C.accent, 0.22) },
                                ]}
                              >
                                <AppIcon
                                  name="infinite"
                                  size={15}
                                  color={C.accent}
                                />
                                <Text
                                  style={[
                                    styles.unlimitedNoteText,
                                    { color: C.accent },
                                  ]}
                                >
                                  {group.unlimited[localized]}
                                </Text>
                              </LinearGradient>
                            )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <>
        <View style={styles.sectionHeadingCompact}>
          <View style={styles.planHeadingCopy}>
            <Text style={[styles.sectionKicker, { color: C.accent }]}>02</Text>
            <Text style={[styles.sectionTitle, { color: C.text }]}>
              {tr ? "Ödeme ve plan seçimi" : "Payment and plan selection"}
            </Text>
            <Text style={[styles.planOfferHint, { color: C.muted }]}>
              {bestAnnualDiscount > 0
                ? tr
                  ? `Yıllık planlarda aylık ödemeye göre %${bestAnnualDiscount} avantaj`
                  : `${bestAnnualDiscount}% off annual plans compared with monthly billing`
                : tr
                ? "Yıllık planla aylık ödemeye göre daha avantajlı"
                : "Save more with annual billing"}
            </Text>
          </View>
        </View>
        {!showBillingOptions ? (
          <View style={styles.tierGrid}>
            {[PREMIUM_PLAN.PREMIUM, PREMIUM_PLAN.UNLIMITED].map((tier) => {
              const selected = selectedTier === tier;
              const unlimited = tier === PREMIUM_PLAN.UNLIMITED;
              const disabled = isUnlimited && !unlimited;
              const glowColor = unlimited ? "#F5C518" : C.accent;
              return (
                <Pressable
                  key={tier}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  disabled={disabled}
                  onPress={() => selectTier(tier)}
                  style={[
                    styles.tierCard,
                    {
                      // Keep the card surface opaque so Android elevation does
                      // not remain visible through the selected accent wash.
                      backgroundColor: C.card,
                      borderColor: selected ? glowColor : C.border,
                    },
                    selected && styles.tierCardSelected,
                    selected && {
                      shadowColor: glowColor,
                      shadowOpacity: 0.5,
                      shadowRadius: 18,
                      shadowOffset: { width: 0, height: 10 },
                      elevation: 12,
                    },
                    disabled && { opacity: 0.42 },
                  ]}
                >
                  {selected && (
                    <>
                      <LinearGradient
                        pointerEvents="none"
                        colors={[
                          alpha(glowColor, 0.32),
                          alpha(C.accent, 0.08),
                          "transparent",
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
                      />
                      <LinearGradient
                        pointerEvents="none"
                        colors={["rgba(255,255,255,0.22)", "transparent"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0.85, y: 0.6 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: 22 }]}
                      />
                    </>
                  )}
                  <View
                    style={[
                      styles.tierIcon,
                      { backgroundColor: selected ? C.accent : C.cardAlt },
                    ]}
                  >
                    {selected && (
                      <LinearGradient
                        pointerEvents="none"
                        colors={["rgba(255,255,255,0.4)", "transparent"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                      />
                    )}
                    <AppIcon
                      name={unlimited ? "infinite" : "diamond-outline"}
                      size={24}
                      color={selected ? "#fff" : C.muted}
                    />
                  </View>
                  <Text style={[styles.tierTitle, { color: C.text }]}>
                    {unlimited ? "Premium Unlimited" : "Premium"}
                  </Text>
                  <Text style={[styles.tierDescription, { color: C.muted }]}>
                    {unlimited
                      ? tr
                        ? "Limitleri kaldır"
                        : "Remove every limit"
                      : tr
                      ? "Premium deneyimi aç"
                      : "Unlock Premium"}
                  </Text>
                  <View
                    style={[
                      styles.tierSelection,
                      {
                        backgroundColor: selected ? C.accent : C.cardAlt,
                      },
                    ]}
                  >
                    <AppIcon
                      name={selected ? "checkmark" : "arrow-forward"}
                      size={12}
                      color={selected ? "#fff" : C.muted}
                    />
                    <Text
                      style={[
                        styles.tierSelectionText,
                        { color: selected ? "#fff" : C.muted },
                      ]}
                    >
                      {selected
                        ? tr
                          ? "Seçildi"
                          : "Selected"
                        : tr
                        ? "Seç"
                        : "Select"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Animated.View
            style={[
              styles.billingStage,
              {
                opacity: planTransition,
                transform: [
                  {
                    translateX: planTransition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [28, 0],
                    }),
                  },
                  {
                    scale: planTransition.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.94, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.billingHeading}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={tr ? "Planlara geri dön" : "Back to plans"}
                onPress={showTierSelection}
                style={({ pressed }) => [
                  styles.billingBack,
                  { backgroundColor: C.card, borderColor: C.border },
                  pressed && { opacity: 0.65 },
                ]}
              >
                <AppIcon name="arrow-back" size={18} color={C.text} />
              </Pressable>
              <View style={styles.billingHeadingCopy}>
                <Text style={[styles.billingTitle, { color: C.text }]}>
                  {tr ? "Ödeme dönemi" : "Billing period"}
                </Text>
                <Text style={[styles.billingSubtitle, { color: C.muted }]}>
                  {tr
                    ? `${selectedPlanName} için planını seç`
                    : `Choose a plan for ${selectedPlanName}`}
                </Text>
              </View>
              <AppIcon name="calendar-outline" size={18} color={C.accent} />
            </View>

            {loading ? (
              <ActivityIndicator style={styles.loader} color={C.accent} />
            ) : selectedTierPackages.length > 0 ? (
              <View style={styles.billingGrid}>
                {selectedTierPackages.map((aPackage) => {
                  const selected =
                    aPackage.identifier === selectedPackage?.identifier;
                  const savings = getPackageSavings(
                    aPackage,
                    pricedPackages,
                    language
                  );
                  const annual = getPackagePeriodKey(aPackage) === "annual";
                  const glowColor = annual ? "#F5C518" : C.accent;
                  return (
                    <Pressable
                      key={aPackage.identifier}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setSelectedId(aPackage.identifier)}
                      style={[
                        styles.billingCard,
                        {
                          // Accent is painted by the clipped gradient below;
                          // the solid surface prevents the shadow bleeding
                          // through translucent selected cards.
                          backgroundColor: C.card,
                          borderColor: selected
                            ? glowColor
                            : annual
                            ? alpha(glowColor, 0.5)
                            : C.border,
                        },
                        selected && styles.billingCardSelected,
                        selected && {
                          shadowColor: glowColor,
                          shadowOpacity: 0.36,
                          shadowRadius: 16,
                          shadowOffset: { width: 0, height: 8 },
                          elevation: 8,
                        },
                      ]}
                    >
                      {(selected || annual) && (
                        <>
                          <LinearGradient
                            pointerEvents="none"
                            colors={[
                              alpha(glowColor, selected ? 0.34 : 0.16),
                              alpha(C.accent, 0.06),
                              "transparent",
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={[
                              StyleSheet.absoluteFill,
                              { borderRadius: 20 },
                            ]}
                          />
                          {selected && (
                            <LinearGradient
                              pointerEvents="none"
                              colors={["rgba(255,255,255,0.2)", "transparent"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 0.85, y: 0.6 }}
                              style={[
                                StyleSheet.absoluteFill,
                                { borderRadius: 20 },
                              ]}
                            />
                          )}
                        </>
                      )}
                      <View style={styles.billingCardTop}>
                        <View
                          style={[
                            styles.periodIcon,
                            {
                              backgroundColor: selected ? C.accent : C.cardAlt,
                            },
                          ]}
                        >
                          {selected && (
                            <LinearGradient
                              pointerEvents="none"
                              colors={["rgba(255,255,255,0.4)", "transparent"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={[
                                StyleSheet.absoluteFill,
                                { borderRadius: 11 },
                              ]}
                            />
                          )}
                          <AppIcon
                            name={annual ? "calendar" : "calendar-outline"}
                            size={16}
                            color={selected ? "#fff" : C.muted}
                          />
                        </View>
                        <View
                          style={[
                            styles.radio,
                            { borderColor: selected ? C.accent : C.muted },
                          ]}
                        >
                          {selected && (
                            <View
                              style={[
                                styles.radioDot,
                                { backgroundColor: C.accent },
                              ]}
                            />
                          )}
                        </View>
                      </View>
                      <Text style={[styles.billingPeriod, { color: C.text }]}>
                        {packageTitle(aPackage, tr)}
                      </Text>
                      {savings ? (
                        <>
                          <View
                            style={[
                              styles.discountBadge,
                              { backgroundColor: C.iconGreen },
                            ]}
                          >
                            <Text
                              style={[styles.discountText, { color: C.green }]}
                            >
                              {tr
                                ? `%${savings.percent} İNDİRİM`
                                : `${savings.percent}% OFF`}
                            </Text>
                          </View>
                          <Text
                            style={[styles.originalPrice, { color: C.muted }]}
                          >
                            {savings.originalPrice}
                          </Text>
                        </>
                      ) : (
                        <View style={styles.discountPlaceholder} />
                      )}
                      <Text
                        // "₺149,99" — para birimi yüzünden saf rakam sayılmaz,
                        // ama rolü fiyattır: rakam fontunu kullanmalı.
                        fontRole="numeric"
                        style={[
                          styles.billingPrice,
                          { color: savings ? C.green : C.text },
                        ]}
                      >
                        {aPackage.product?.priceString}
                      </Text>
                      <Text style={[styles.periodSuffix, { color: C.muted }]}>
                        {packagePeriodLabel(aPackage, tr)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <View
                style={[
                  styles.notice,
                  { backgroundColor: C.card, borderColor: C.border },
                ]}
              >
                <AppIcon
                  family="Ionicons"
                  name="construct-outline"
                  size={20}
                  color={C.amber}
                />
                <Text style={[styles.noticeText, { color: C.muted }]}>
                  {configurationError === "missing-api-key"
                    ? tr
                      ? "RevenueCat API anahtarı bekleniyor. Kurulum adımları docs/REVENUECAT_KURULUM.md dosyasında."
                      : "RevenueCat API key is missing. See docs/REVENUECAT_KURULUM.md."
                    : tr
                    ? `${selectedPlanName} mağaza paketleri henüz yayında değil.`
                    : `${selectedPlanName} store packages are not available yet.`}
                </Text>
              </View>
            )}

            <Pressable
              disabled={(selectedTier !== plan && !selectedPackage) || busy}
              onPress={selectedTier === plan ? manage : buy}
              style={({ pressed }) => [
                styles.cta,
                {
                  opacity:
                    (selectedTier !== plan && !selectedPackage) || busy
                      ? 0.48
                      : pressed
                      ? 0.82
                      : 1,
                },
              ]}
            >
              <LinearGradient
                colors={[C.accent, C.purple || C.accent]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaFill}
              >
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.ctaShimmer,
                    {
                      transform: [
                        {
                          translateX: ctaShimmer.interpolate({
                            inputRange: [0, 1],
                            outputRange: [-210, 390],
                          }),
                        },
                        { rotate: "-16deg" },
                      ],
                    },
                  ]}
                >
                  <LinearGradient
                    colors={[
                      "transparent",
                      "rgba(255,255,255,0.08)",
                      "rgba(255,255,255,0.34)",
                      "rgba(255,255,255,0.08)",
                      "transparent",
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
                {busyAction === "purchase" ||
                busyAction === "customer-center" ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <View style={styles.ctaIconWrap}>
                      <AppIcon
                        name={
                          selectedTier === PREMIUM_PLAN.UNLIMITED
                            ? "infinite"
                            : "diamond"
                        }
                        size={17}
                        color="#fff"
                      />
                    </View>
                    <View style={styles.ctaCopy}>
                      <Text style={styles.ctaText}>
                        {selectedTier === plan
                          ? tr
                            ? "Aboneliği yönet"
                            : "Manage subscription"
                          : selectedTier === PREMIUM_PLAN.UNLIMITED
                          ? tr
                            ? "Unlimited'a geç"
                            : "Upgrade to Unlimited"
                          : tr
                          ? "Premium'a geç"
                          : "Upgrade to Premium"}
                      </Text>
                      {selectedTier !== plan && selectedDisplayPackage && (
                        <Text style={styles.ctaSubtext}>
                          {selectedDisplayPackage.product?.priceString}{" "}
                          {packagePeriodLabel(selectedDisplayPackage, tr)}
                        </Text>
                      )}
                    </View>
                    <AppIcon name="arrow-forward" size={19} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}
      </>

      <Pressable
        disabled={busy || loading || !packages.length}
        onPress={openPaywall}
        style={({ pressed }) => [
          styles.paywallButton,
          {
            backgroundColor: C.card,
            borderColor: C.border,
            opacity:
              busy || loading || !packages.length ? 0.48 : pressed ? 0.78 : 1,
          },
        ]}
      >
        {busyAction === "paywall" ? (
          <ActivityIndicator color={C.accent} />
        ) : (
          <>
            <View style={[styles.secureIcon, { backgroundColor: C.accentDim }]}>
              <AppIcon name="shield-checkmark" size={16} color={C.accent} />
            </View>
            <Text style={[styles.paywallButtonText, { color: C.text }]}>
              {tr
                ? "Güvenli ödeme seçeneklerini aç"
                : "Open secure checkout options"}
            </Text>
            <AppIcon name="open-outline" size={15} color={C.muted} />
          </>
        )}
      </Pressable>

      <Pressable disabled={busy} onPress={restore} style={styles.restore}>
        {busyAction === "restore" ? (
          <ActivityIndicator size="small" color={C.accent} />
        ) : (
          <Text style={[styles.restoreText, { color: C.accent }]}>
            {tr ? "Satın alımları geri yükle" : "Restore purchases"}
          </Text>
        )}
      </Pressable>

      <Text style={[styles.legal, { color: C.muted }]}>
        {tr
          ? "Satın alma mağaza hesabından tahsil edilir. Abonelik, mevcut dönem bitmeden en az 24 saat önce iptal edilmezse otomatik yenilenir. Aboneliğini mağaza hesap ayarlarından yönetebilirsin."
          : "Payment is charged to your store account. The subscription renews automatically unless canceled at least 24 hours before the current period ends. You can manage it in your store account settings."}
      </Text>
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  posterBackdrop: { opacity: 0.48 },
  hero: {
    borderRadius: 28,
    padding: 20,
    overflow: "hidden",
    minHeight: 306,
  },
  heroOrbTop: {
    position: "absolute",
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: "rgba(255,255,255,0.10)",
    right: -82,
    top: -112,
  },
  heroOrbBottom: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.11)",
    left: -80,
    bottom: -108,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBrandBadge: {
    minHeight: 28,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  heroBrandDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  heroBrandText: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 1.15,
  },
  heroActiveBadge: {
    minHeight: 27,
    borderRadius: 10,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroActiveText: {
    color: "#FFFFFF",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  heroContent: { flex: 1, justifyContent: "center", paddingTop: 17 },
  crownOuter: {
    width: 62,
    height: 62,
    borderRadius: 22,
    padding: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginBottom: 18,
  },
  crown: {
    flex: 1,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "900",
    letterSpacing: -0.9,
    maxWidth: "92%",
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.74)",
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 9,
    maxWidth: "94%",
  },
  heroTrustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
  },
  heroTrustItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroTrustText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 8.5,
    fontWeight: "600",
  },
  sectionHeadingCompact: {
    marginTop: 23,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionKicker: { fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: -0.35,
    marginTop: 2,
  },
  testBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginTop: 12,
  },
  testBadgeText: { fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  exploreCard: {
    minHeight: 92,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 13,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  exploreIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreCopy: { flex: 1, minWidth: 0 },
  exploreTitle: { fontSize: 14, fontWeight: "850", letterSpacing: -0.25 },
  exploreSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "550",
    marginTop: 4,
  },
  exploreArrow: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  exploreModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.64)",
  },
  exploreModalSheet: {
    maxHeight: "92%",
    minHeight: "72%",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  exploreModalHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 9,
  },
  exploreModalHeader: {
    minHeight: 70,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  exploreModalHeaderCopy: { flex: 1 },
  exploreModalTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  exploreModalSubtitle: { fontSize: 10.5, lineHeight: 15, marginTop: 3 },
  exploreModalClose: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  exploreModalContent: {
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  paywallButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: 16,
    marginTop: 11,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  secureIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  paywallButtonText: { flex: 1, fontSize: 11, fontWeight: "700" },
  badgeSectionLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.15,
    marginBottom: 9,
  },
  experienceHeading: {
    marginTop: 17,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  experienceHeadingCopy: { flex: 1 },
  experienceTitle: { fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
  experienceSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
    marginTop: 4,
  },
  selectedPlanPill: {
    minHeight: 27,
    maxWidth: 116,
    borderRadius: 9,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  selectedPlanPillText: { fontSize: 8.5, fontWeight: "900" },
  experienceGroups: { gap: 8 },
  experienceCard: {
    borderWidth: 1,
    borderRadius: 18,
    overflow: "hidden",
  },
  experienceTrigger: {
    minHeight: 72,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  experienceIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  experienceCopy: { flex: 1 },
  experienceCardTitle: { fontSize: 12.5, fontWeight: "800", lineHeight: 17 },
  experienceSummary: {
    fontSize: 9.5,
    fontWeight: "500",
    lineHeight: 14,
    marginTop: 3,
  },
  expandButton: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  experienceDetails: {
    borderTopWidth: 1,
    paddingHorizontal: 11,
    paddingTop: 11,
    paddingBottom: 12,
    gap: 9,
  },
  compactBenefitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  compactBenefitItem: {
    width: "48.8%",
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  compactBenefitIcon: {
    width: 27,
    height: 27,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  compactBenefitText: {
    flex: 1,
    fontSize: 9.25,
    lineHeight: 13,
    fontWeight: "700",
  },
  unlimitedNote: {
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  unlimitedNoteText: {
    flex: 1,
    fontSize: 9.5,
    lineHeight: 14,
    fontWeight: "800",
  },
  badgeShowcase: {
    minHeight: 152,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 17,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  badgeGlow: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    left: -42,
    top: -48,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  badgeVisual: { width: 92, alignItems: "center", gap: 7 },
  rarityPill: {
    minHeight: 22,
    borderRadius: 8,
    paddingHorizontal: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  rarityText: { fontSize: 7.5, fontWeight: "900", letterSpacing: 0.6 },
  badgeShowcaseCopy: { flex: 1 },
  badgeShowcaseTitle: { fontSize: 17, fontWeight: "900", letterSpacing: -0.35 },
  badgeShowcaseDesc: {
    fontSize: 10,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 3,
  },
  badgePerks: { marginTop: 11, gap: 7 },
  badgePerk: { flexDirection: "row", alignItems: "center", gap: 7 },
  badgePerkText: { flex: 1, fontSize: 9.5, lineHeight: 13, fontWeight: "700" },
  planHeadingCopy: { flex: 1 },
  planOfferHint: {
    fontSize: 10.5,
    lineHeight: 15,
    fontWeight: "600",
    marginTop: 4,
  },
  tierGrid: {
    flexDirection: "row",
    gap: 10,
  },
  tierCard: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 22,
    padding: 13,
    alignItems: "flex-start",
  },
  tierCardSelected: { borderWidth: 2 },
  tierIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tierTitle: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "900",
    letterSpacing: -0.2,
    marginTop: 12,
  },
  tierDescription: {
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: "600",
    marginTop: 3,
  },
  tierSelection: {
    minHeight: 25,
    borderRadius: 9,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: "auto",
  },
  tierSelectionText: { fontSize: 8.5, fontWeight: "900" },
  billingHeading: {
    marginTop: 2,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  billingStage: { marginTop: 15 },
  billingBack: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  billingHeadingCopy: { flex: 1 },
  billingTitle: { fontSize: 13.5, fontWeight: "900", letterSpacing: -0.15 },
  billingSubtitle: {
    fontSize: 9.5,
    lineHeight: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  billingGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  billingCard: {
    width: "48.5%",
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 20,
    padding: 12,
  },
  billingCardSelected: { borderWidth: 2 },
  billingCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  periodIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  billingPeriod: { fontSize: 14, fontWeight: "900", marginTop: 12 },
  discountBadge: {
    alignSelf: "flex-start",
    minHeight: 21,
    borderRadius: 7,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  discountText: { fontSize: 7.5, fontWeight: "900", letterSpacing: 0.3 },
  originalPrice: {
    fontSize: 10,
    fontWeight: "700",
    textDecorationLine: "line-through",
    textDecorationStyle: "solid",
    marginTop: "auto",
  },
  discountPlaceholder: { flex: 1 },
  billingPrice: { fontSize: 20, lineHeight: 23, fontWeight: "900" },
  periodSuffix: { fontSize: 8.5, fontWeight: "600", marginTop: 2 },
  loader: { marginVertical: 28 },
  notice: {
    marginTop: 18,
    padding: 14,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 17 },
  cta: {
    minHeight: 60,
    borderRadius: 19,
    marginTop: 18,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ctaFill: {
    flex: 1,
    minHeight: 60,
    paddingHorizontal: 17,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaShimmer: {
    position: "absolute",
    top: -32,
    bottom: -32,
    width: 130,
  },
  ctaIconWrap: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.13)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaCopy: { flex: 1 },
  ctaText: { color: "#fff", fontSize: 14, fontWeight: "900" },
  ctaSubtext: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 9,
    fontWeight: "600",
    marginTop: 2,
  },
  restore: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  restoreText: { fontSize: 12, fontWeight: "700" },
  legal: {
    fontSize: 9.5,
    lineHeight: 14,
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 8,
  },
});
